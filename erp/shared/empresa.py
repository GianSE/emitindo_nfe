"""Carrega os dados do EMITENTE do banco (tabela configuracoes, chave 'empresa')."""

# fallback caso o seed ainda não tenha rodado
PADRAO = {
    "CNPJ": "12345678000190", "xNome": "EMPRESA TESTE LTDA", "xFant": "LOJA TESTE",
    "xLgr": "RUA DAS FLORES", "nro": "100", "xBairro": "CENTRO",
    "cMun": "3550308", "xMun": "SAO PAULO", "UF": "SP", "cUF": "35",
    "CEP": "01001000", "fone": "1130000000", "IE": "110042490114", "CRT": "1",
    "ambiente": "2",
}


def carregar_empresa(conn) -> dict:
    """Retorna o dict do emitente (psycopg devolve o jsonb já como dict)."""
    row = conn.execute("SELECT valor FROM configuracoes WHERE chave='empresa'").fetchone()
    if not row or not row[0]:
        return dict(PADRAO)
    return {**PADRAO, **row[0]}
