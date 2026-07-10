"""
Dados de exemplo de uma venda, no formato que o gerador de XML espera.

Num ERP real esses dados viriam do banco de dados: cadastro da empresa (emit),
cadastro do cliente (dest) e os itens do pedido de venda.

Tudo aqui é FICTÍCIO e usado só em ambiente de HOMOLOGAÇÃO (tpAmb=2).
"""

import datetime

# data/hora de emissão no formato exigido: ISO 8601 com fuso horário.
# Ex.: 2026-07-09T14:30:00-03:00
_agora = datetime.datetime.now().astimezone().replace(microsecond=0)
DH_EMI = _agora.isoformat()

DADOS = {
    "ide": {
        "ano": _agora.year,
        "mes": _agora.month,
        "natOp": "VENDA DE MERCADORIA",
        "serie": "1",
        "nNF": "123",              # número da nota (controlado pelo seu ERP)
        "dhEmi": DH_EMI,
        "tpAmb": "2",              # 2 = HOMOLOGAÇÃO (sempre em testes!)
    },
    "emit": {
        "CNPJ": "12345678000190",
        "xNome": "EMPRESA TESTE LTDA",
        "xFant": "LOJA TESTE",
        "xLgr": "RUA DAS FLORES",
        "nro": "100",
        "xBairro": "CENTRO",
        "cMun": "3550308",         # São Paulo/SP (código IBGE)
        "xMun": "SAO PAULO",
        "UF": "SP",
        "cUF": "35",               # 35 = SP
        "CEP": "01001000",
        "fone": "1130000000",
        "IE": "110042490114",      # inscrição estadual (fictícia)
        "CRT": "1",                # 1 = Simples Nacional
    },
    "dest": {
        "doc": "11122233396",      # 11 díg. = CPF | 14 díg. = CNPJ
        "xNome": "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
        "xLgr": "AVENIDA BRASIL",
        "nro": "500",
        "xBairro": "JARDIM",
        "cMun": "3304557",         # Rio de Janeiro/RJ
        "xMun": "RIO DE JANEIRO",
        "UF": "RJ",
        "CEP": "20040002",
        "indIEDest": "9",          # 9 = não contribuinte
    },
    "itens": [
        {
            "cProd": "001",
            "cEAN": "SEM GTIN",
            "xProd": "CAMISETA ALGODAO AZUL M",
            "NCM": "61091000",     # NCM de camisetas de algodão
            "CFOP": "6102",        # venda interestadual, mercadoria de terceiros
            "uCom": "UN",
            "qtd": 2,
            "vUnit": "49.90",
        },
        {
            "cProd": "002",
            "cEAN": "SEM GTIN",
            "xProd": "CALCA JEANS PRETA 42",
            "NCM": "62034200",
            "CFOP": "6102",
            "uCom": "UN",
            "qtd": 1,
            "vUnit": "129.90",
        },
    ],
    "pagamento": {
        "tPag": "17",              # 17 = Pix (01=dinheiro, 03=cartão crédito...)
    },
    "obs": "Pedido de venda numero 4567.",
}
