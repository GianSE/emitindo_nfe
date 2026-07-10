"""
WORKER DE ESTOQUE — reage ao evento 'nfe.autorizada'.

Isto demonstra o FAN-OUT: o estoque não sabe nada de NFe, XML ou SEFAZ. Ele só
escuta um evento de negócio ("uma nota foi autorizada") e baixa o saldo dos itens.

Ponto-chave de projeto: o estoque só se movimenta QUANDO A NOTA É AUTORIZADA.
Se a emissão fosse rejeitada, nenhum evento 'nfe.autorizada' seria publicado e o
saldo não mexeria. O documento fiscal é a fonte da verdade do movimento.

Cada consumidor tem seu próprio CURSOR (tabela `consumidores`), então processa
cada evento exatamente uma vez — e outros consumidores (financeiro, DANFE...)
teriam o seu, lendo o mesmo log de eventos de forma independente.
"""

import datetime
import sys
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from db import conectar

CONSUMIDOR = "estoque"


def log(msg: str):
    print(f"[{datetime.datetime.now():%H:%M:%S}] {msg}", flush=True)


def processar_um(conn) -> bool:
    """Processa o PRÓXIMO evento ainda não consumido por 'estoque'."""
    with conn.transaction():
        # trava o cursor deste consumidor (permite rodar várias réplicas com segurança)
        cur = conn.execute(
            "SELECT ultimo_id FROM consumidores WHERE nome=%s FOR UPDATE",
            (CONSUMIDOR,),
        ).fetchone()[0]

        ev = conn.execute(
            "SELECT id, tipo, payload FROM eventos WHERE id > %s ORDER BY id LIMIT 1",
            (cur,),
        ).fetchone()
        if ev is None:
            return False

        ev_id, tipo, payload = ev
        if tipo == "nfe.autorizada":
            _movimentar(conn, payload, sinal=-1, ref=f"venda nº {payload.get('numero')}")
        elif tipo == "nfe.recebida":
            _movimentar(conn, payload, sinal=+1, ref=f"compra …{payload.get('chave','')[-6:]}")

        conn.execute("UPDATE consumidores SET ultimo_id=%s WHERE nome=%s", (ev_id, CONSUMIDOR))
    return True


def _movimentar(conn, payload, sinal: int, ref: str):
    """
    sinal = -1 -> SAÍDA (venda, baixa) ; sinal = +1 -> ENTRADA (compra, soma).
    Para 'nfe.autorizada' os itens vêm da venda; para 'nfe.recebida' vêm no evento.
    """
    if "venda_id" in payload:
        itens = conn.execute("SELECT itens FROM vendas WHERE id=%s", (payload["venda_id"],)).fetchone()[0]
    else:
        itens = payload.get("itens", [])

    verbo = "entrada" if sinal > 0 else "saída"
    for item in itens:
        cod = item["cProd"]
        qtd = float(item["qtd"])
        novo = conn.execute(
            "UPDATE produtos SET saldo = saldo + %s WHERE cod=%s RETURNING saldo",
            (sinal * qtd, cod),
        ).fetchone()
        if novo is None:
            # de-para pendente: o código do fornecedor não existe no nosso catálogo
            log(f"  estoque: produto {cod} NÃO cadastrado (de-para pendente)  [{ref}]")
            continue
        log(f"  estoque {verbo}: item {cod} {sinal*qtd:+g}  (saldo agora: {novo[0]})  [{ref}]")


def main():
    conn = conectar()
    ouvinte = conectar(autocommit=True)
    ouvinte.execute("LISTEN evento_novo")
    log("worker de estoque pronto (aguardando eventos 'nfe.autorizada')…")

    while True:
        try:
            while processar_um(conn):
                pass
            for _ in ouvinte.notifies(timeout=3, stop_after=1):
                pass
        except KeyboardInterrupt:
            log("encerrando…")
            break
        except Exception as e:
            log(f"ERRO inesperado no loop: {e!r}")
            time.sleep(2)


if __name__ == "__main__":
    main()
