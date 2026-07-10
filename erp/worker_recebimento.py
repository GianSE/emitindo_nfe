"""
WORKER DE RECEBIMENTO (compras) — o terceiro serviço.

Diferente do worker de emissão (que consome uma OUTBOX interna), este faz POLL
de uma fonte EXTERNA: a Distribuição DFe da SEFAZ, que entrega os documentos
emitidos CONTRA o nosso CNPJ (as notas que os fornecedores emitem para nós).

Fluxo:
  1. lê o cursor (até que NSU já consumimos)
  2. pergunta à SEFAZ o que há de novo  (provider.consultar_entradas)
  3. para cada nota nova: grava (idempotente por chave) + publica 'nfe.recebida'
  4. manifesta 'Ciência da Operação' (boa prática) — best-effort
  5. avança o cursor

O worker de estoque consome 'nfe.recebida' e dá ENTRADA no saldo (o oposto da
saída na venda). Assim fechamos o ciclo do estoque: entra na compra, sai na venda.

⚠️ Em PRODUÇÃO a Distribuição DFe tem intervalo mínimo (~1h) e pune consulta
   excessiva (cStat 656 - consumo indevido). Aqui usamos um intervalo curto só
   para a demonstração.
"""

import datetime
import json
import os
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "provider"))
from nfe.provider import ConfigNFe  # noqa: E402
from nfe.fabrica import criar_provider  # noqa: E402

from db import conectar  # noqa: E402

INTERVALO_POLL = int(os.environ.get("DFE_POLL_SEG", "10"))  # produção: ~3600

_config = ConfigNFe(
    backend=os.environ.get("FISCAL_BACKEND", "proprio"),
    cnpj="12345678000190", uf="SP", ambiente="2", modo="simulado",
    focus_token=os.environ.get("FOCUS_TOKEN", ""),
)
provider = criar_provider(_config)


def log(msg: str):
    print(f"[{datetime.datetime.now():%H:%M:%S}] {msg}", flush=True)


def poll_uma_vez(conn) -> int:
    """Uma rodada de consulta. Retorna quantas notas NOVAS foram recebidas."""
    cursor = conn.execute("SELECT ult_nsu FROM dfe_cursor WHERE id=1").fetchone()[0]

    # chamada externa (rede) FORA de transação
    resp = provider.consultar_entradas(cursor)

    if resp.cstat == "137":     # nada novo
        return 0
    if resp.cstat != "138":     # algum aviso (ex.: 656 consumo indevido)
        log(f"  distribuição retornou cStat {resp.cstat} - {resp.xmotivo}")
        return 0

    novas = []
    with conn.transaction():
        # trava o cursor p/ permitir várias réplicas do worker com segurança
        atual = conn.execute("SELECT ult_nsu FROM dfe_cursor WHERE id=1 FOR UPDATE").fetchone()[0]
        if atual != cursor:
            return 0  # outra réplica já avançou; recomeça no próximo ciclo

        for doc in resp.documentos:
            inserido = conn.execute(
                "INSERT INTO notas_entrada (nsu, chave, cnpj_emitente, xml, itens) "
                "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (chave) DO NOTHING RETURNING id",
                (doc.nsu, doc.chave, doc.cnpj_emitente, doc.xml, json.dumps(doc.itens)),
            ).fetchone()
            if inserido:  # nota realmente nova (idempotência por chave)
                conn.execute(
                    "INSERT INTO eventos (tipo, payload) VALUES ('nfe.recebida', %s)",
                    (json.dumps({"chave": doc.chave, "cnpj_emitente": doc.cnpj_emitente,
                                 "itens": doc.itens}),),
                )
                novas.append(doc)
                log(f"  ⬇ recebida NF-e de {doc.cnpj_emitente}  chave …{doc.chave[-6:]}  (NSU {doc.nsu})")

        conn.execute("UPDATE dfe_cursor SET ult_nsu=%s WHERE id=1", (resp.ult_nsu,))
        if novas:
            conn.execute("NOTIFY evento_novo")

    # manifestação 'Ciência da Operação' — best-effort, após o commit
    for doc in novas:
        try:
            r = provider.manifestar_ciencia(doc.chave)
            if r.registrado:
                conn.execute("UPDATE notas_entrada SET manifestacao='ciencia' WHERE chave=%s", (doc.chave,))
                conn.commit()
                log(f"    ✓ manifestada Ciência da Operação (…{doc.chave[-6:]})")
        except Exception as e:
            log(f"    (manifestação adiada: {e})")

    return len(novas)


def main():
    conn = conectar()
    log(f"worker de recebimento pronto (poll a cada {INTERVALO_POLL}s)…")
    while True:
        try:
            n = poll_uma_vez(conn)
            if n:
                log(f"  {n} nota(s) de entrada processada(s)")
        except KeyboardInterrupt:
            log("encerrando…")
            break
        except Exception as e:
            log(f"ERRO no poll: {e!r}")
        time.sleep(INTERVALO_POLL)


if __name__ == "__main__":
    main()
