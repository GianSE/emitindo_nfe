"""
"API" do ERP (aqui via CLI). Cria uma VENDA e, na MESMA TRANSAÇÃO, grava um
comando na OUTBOX pedindo a emissão da NFe.

Esse é o coração do padrão Transactional Outbox:

    BEGIN
      INSERT INTO vendas ...
      INSERT INTO outbox ('nfe.emitir', {venda_id})
    COMMIT            <- atômico: ou as duas gravações acontecem, ou nenhuma

Depois do COMMIT, um NOTIFY "cutuca" o worker (otimização de latência).
Se o NOTIFY se perder, tudo bem: o worker também varre a outbox por conta própria.

Uso:
    python app_erp.py                 # cria 1 venda normal
    python app_erp.py --qtd 3         # cria 3 vendas
    python app_erp.py --ruim          # venda com NCM inválido (vai ser REJEITADA)
    python app_erp.py --instavel      # simula SEFAZ fora do ar nas 1as tentativas (mostra retry)
"""

import argparse
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from db import conectar

# Catálogo simples: cliente + itens de uma venda (no ERP real, viria da tela/API).
CLIENTE = {
    "doc": "11122233396",
    "xNome": "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
    "xLgr": "AVENIDA BRASIL", "nro": "500", "xBairro": "JARDIM",
    "cMun": "3304557", "xMun": "RIO DE JANEIRO", "UF": "RJ",
    "CEP": "20040002", "indIEDest": "9",
}
ITENS_OK = [
    {"cProd": "001", "xProd": "CAMISETA ALGODAO AZUL M", "NCM": "61091000",
     "CFOP": "6102", "uCom": "UN", "qtd": 2, "vUnit": "49.90"},
    {"cProd": "002", "xProd": "CALCA JEANS PRETA 42", "NCM": "62034200",
     "CFOP": "6102", "uCom": "UN", "qtd": 1, "vUnit": "129.90"},
]
ITENS_RUINS = [
    {"cProd": "001", "xProd": "CAMISETA ALGODAO AZUL M", "NCM": "123",  # NCM inválido!
     "CFOP": "6102", "uCom": "UN", "qtd": 1, "vUnit": "49.90"},
]


def criar_venda(conn, itens, opcoes):
    """Insere venda + comando na outbox NA MESMA TRANSAÇÃO e sinaliza via NOTIFY."""
    with conn.transaction():
        venda_id = conn.execute(
            "INSERT INTO vendas (cliente, itens, opcoes) VALUES (%s, %s, %s) RETURNING id",
            (json.dumps(CLIENTE), json.dumps(itens), json.dumps(opcoes)),
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO outbox (tipo, payload) VALUES (%s, %s)",
            ("nfe.emitir", json.dumps({"venda_id": str(venda_id)})),
        )
    # COMMIT já ocorreu; agora o "sino":
    conn.execute("NOTIFY outbox_nova")
    return venda_id


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--qtd", type=int, default=1)
    p.add_argument("--ruim", action="store_true", help="NCM inválido -> rejeição")
    p.add_argument("--instavel", action="store_true", help="simula SEFAZ fora do ar")
    p.add_argument("--parcelas", type=int, default=1, help="nº de parcelas (contas a receber)")
    args = p.parse_args()

    itens = ITENS_RUINS if args.ruim else ITENS_OK
    opcoes = {"simular_falha": args.instavel, "parcelas": args.parcelas}

    with conectar() as conn:
        for _ in range(args.qtd):
            vid = criar_venda(conn, itens, opcoes)
            tag = " (RUIM/rejeição)" if args.ruim else " (instável/retry)" if args.instavel else ""
            print(f"Venda criada: {vid}{tag}  -> outbox 'nfe.emitir' enfileirado")


if __name__ == "__main__":
    main()
