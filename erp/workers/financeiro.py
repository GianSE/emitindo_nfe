"""
WORKER FINANCEIRO — o 4º serviço, mais um CONSUMIDOR dos mesmos eventos.

Ele não sabe nada de XML/SEFAZ/estoque. Só reage a eventos de negócio:

  'nfe.autorizada' (venda/saída)  -> CONTAS A RECEBER  (o cliente te deve)
  'nfe.recebida'   (compra/entrada) -> CONTAS A PAGAR   (você deve ao fornecedor)

Repare que ele lê a MESMA tabela `eventos` que o estoque, mas com o SEU PRÓPRIO
cursor ('financeiro'). Por isso os dois processam cada evento de forma
independente — adicionar consumidores não afeta os existentes. É o fan-out.

Suporta parcelas: uma venda com `opcoes.parcelas = 3` gera 3 títulos a receber
com vencimentos em 30/60/90 dias.
"""

import datetime
import sys
import time

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # erp/ para 'shared'
from shared.db import conectar

CONSUMIDOR = "financeiro"
PRAZO_DIAS = 30   # intervalo entre parcelas


def log(msg: str):
    print(f"[{datetime.datetime.now():%H:%M:%S}] {msg}", flush=True)


def processar_um(conn) -> bool:
    with conn.transaction():
        cur = conn.execute(
            "SELECT ultimo_id FROM consumidores WHERE nome=%s FOR UPDATE", (CONSUMIDOR,)
        ).fetchone()[0]
        ev = conn.execute(
            "SELECT id, tipo, payload FROM eventos WHERE id > %s ORDER BY id LIMIT 1", (cur,)
        ).fetchone()
        if ev is None:
            return False

        ev_id, tipo, payload = ev
        if tipo == "nfe.autorizada":
            _lancar_receber(conn, payload)
        elif tipo == "nfe.recebida":
            _lancar_pagar(conn, payload)

        conn.execute("UPDATE consumidores SET ultimo_id=%s WHERE nome=%s", (ev_id, CONSUMIDOR))
    return True


def _lancar(conn, tipo, chave, descricao, total, parcelas):
    """Cria os títulos (1 por parcela). Idempotente por (chave, tipo, parcela)."""
    hoje = datetime.date.today()
    valor_parcela = round(total / parcelas, 2)
    verbo = "A RECEBER" if tipo == "receber" else "A PAGAR"
    for p in range(1, parcelas + 1):
        # ajusta centavos residuais na última parcela
        valor = valor_parcela if p < parcelas else round(total - valor_parcela * (parcelas - 1), 2)
        venc = hoje + datetime.timedelta(days=PRAZO_DIAS * p)
        inserido = conn.execute(
            "INSERT INTO titulos (tipo, origem_chave, descricao, valor, parcela, total_parcelas, vencimento) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (origem_chave, tipo, parcela) DO NOTHING RETURNING id",
            (tipo, chave, descricao, valor, p, parcelas, venc),
        ).fetchone()
        if inserido:
            log(f"  💰 {verbo}: R$ {valor:.2f}  parc {p}/{parcelas}  venc {venc}  ({descricao})")


def _lancar_receber(conn, payload):
    venda = conn.execute(
        "SELECT itens, opcoes FROM vendas WHERE id=%s", (payload["venda_id"],)
    ).fetchone()
    if not venda:
        return
    itens, opcoes = venda
    total = sum(float(i["qtd"]) * float(i["vUnit"]) for i in itens)
    parcelas = int((opcoes or {}).get("parcelas", 1))
    _lancar(conn, "receber", payload.get("chave"),
            f"Venda NF nº {payload.get('numero')}", total, parcelas)


def _lancar_pagar(conn, payload):
    total = sum(float(i.get("valor", 0)) for i in payload.get("itens", []))
    _lancar(conn, "pagar", payload.get("chave"),
            f"Compra de {payload.get('cnpj_emitente')}", total, 1)


def main():
    conn = conectar()
    ouvinte = conectar(autocommit=True)
    ouvinte.execute("LISTEN evento_novo")
    log("worker financeiro pronto (contas a pagar/receber)…")
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
