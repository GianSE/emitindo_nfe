"""
Geração do DANFE em PDF (Documento Auxiliar da NFe).

IMPORTANTE: o DANFE **não** tem valor fiscal — quem vale é o XML autorizado.
O DANFE é só a REPRESENTAÇÃO em papel/PDF da nota, para o ser humano ler e para
acompanhar a mercadoria. Todo dado que aparece aqui é LIDO do XML.

O elemento mais importante é o CÓDIGO DE BARRAS da chave de acesso (Code-128C):
é por ele que se consulta a autenticidade da nota no portal da SEFAZ.

Layout simplificado (mas fiel) de uma página A4, desenhado com reportlab:

    ┌───────────────────────────────────────────────┐
    │ canhoto (recibo de entrega)                    │
    ├───────────────────────┬───────────────────────┤
    │ EMITENTE              │ DANFE + código de barras│
    │                       │ + CHAVE DE ACESSO       │
    ├───────────────────────┴───────────────────────┤
    │ NATUREZA DA OPERAÇÃO      │ PROTOCOLO           │
    ├───────────┬───────────────┴─────────────────────
    │ IE        │ IE ST         │ CNPJ                │
    ├────────────────────────────────────────────────┤
    │ DESTINATÁRIO / REMETENTE                        │
    ├────────────────────────────────────────────────┤
    │ CÁLCULO DO IMPOSTO (totais)                     │
    ├────────────────────────────────────────────────┤
    │ DADOS DOS PRODUTOS / SERVIÇOS (tabela)          │
    ├────────────────────────────────────────────────┤
    │ DADOS ADICIONAIS                                │
    └────────────────────────────────────────────────┘
"""

from lxml import etree
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import code128

NS = {"n": "http://www.portalfiscal.inf.br/nfe"}

# tPag -> descrição legível (tabela oficial resumida)
FORMAS_PAG = {
    "01": "Dinheiro", "02": "Cheque", "03": "Cartão de Crédito",
    "04": "Cartão de Débito", "05": "Crédito Loja", "10": "Vale Alimentação",
    "15": "Vale Combustível", "17": "Pix", "90": "Sem pagamento", "99": "Outros",
}


# --------------------------------------------------------------------------- #
# Helpers de leitura do XML
# --------------------------------------------------------------------------- #
def _t(el, caminho, padrao=""):
    """Texto de um elemento pelo caminho (namespace da NFe). '' se não existir."""
    achado = el.find(caminho, NS)
    return achado.text if achado is not None and achado.text else padrao


def _fmt_cnpj_cpf(doc: str) -> str:
    if len(doc) == 14:
        return f"{doc[:2]}.{doc[2:5]}.{doc[5:8]}/{doc[8:12]}-{doc[12:]}"
    if len(doc) == 11:
        return f"{doc[:3]}.{doc[3:6]}.{doc[6:9]}-{doc[9:]}"
    return doc


def _fmt_cep(cep: str) -> str:
    return f"{cep[:5]}-{cep[5:]}" if len(cep) == 8 else cep


def _br(valor: str, casas: int = 2) -> str:
    """Formata número no padrão brasileiro: 1.234,56."""
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return valor or ""
    inteiro, dec = f"{n:,.{casas}f}".split(".")
    inteiro = inteiro.replace(",", ".")
    return f"{inteiro},{dec}"


# --------------------------------------------------------------------------- #
# Helpers de desenho
# --------------------------------------------------------------------------- #
class Danfe:
    def __init__(self, c: canvas.Canvas):
        self.c = c

    def caixa(self, x, y_top, w, h):
        """Retângulo cujo TOPO está em y_top."""
        self.c.rect(x, y_top - h, w, h)

    def rotulo(self, x, y_top, texto, size=5):
        self.c.setFont("Helvetica", size)
        self.c.drawString(x + 2, y_top - size - 1, texto)

    def valor(self, x, y_top, texto, size=8, bold=False, dy=14, centro=None):
        self.c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        if centro is not None:
            self.c.drawCentredString(centro, y_top - dy, texto)
        else:
            self.c.drawString(x + 3, y_top - dy, texto)

    def campo(self, x, y_top, w, h, rotulo, valor, valor_size=8, bold=False):
        """Caixa com rótulo pequeno no topo e valor abaixo."""
        self.caixa(x, y_top, w, h)
        self.rotulo(x, y_top, rotulo)
        self.valor(x, y_top, valor, size=valor_size, bold=bold, dy=h - 3)


# --------------------------------------------------------------------------- #
# Geração
# --------------------------------------------------------------------------- #
def gerar_danfe(xml_bytes: bytes, caminho_pdf: str, protocolo: dict | None = None) -> str:
    """
    Lê o XML da NFe e gera o DANFE em PDF.
    `protocolo` (opcional): {"nProt": "...", "dhRecbto": "..."} do retorno da SEFAZ.
    """
    root = etree.fromstring(xml_bytes)
    # Aceita tanto <NFe> quanto <nfeProc> (XML autorizado): busca o infNFe onde estiver.
    inf = root.find(".//n:infNFe", NS)
    chave = inf.get("Id").replace("NFe", "")

    # Se veio um nfeProc (autorizado) e nenhum protocolo foi passado, extrai daqui.
    if protocolo is None:
        infprot = root.find(".//n:protNFe/n:infProt", NS)
        if infprot is not None:
            protocolo = {
                "nProt": _t(infprot, "n:nProt"),
                "dhRecbto": _t(infprot, "n:dhRecbto")[:19].replace("T", " "),
            }

    ide = inf.find("n:ide", NS)
    emit = inf.find("n:emit", NS)
    dest = inf.find("n:dest", NS)
    total = inf.find("n:total/n:ICMSTot", NS)

    homolog = _t(ide, "n:tpAmb") == "2"
    tp_nf = _t(ide, "n:tpNF")

    W, H = A4
    m = 15  # margem
    x0, x1 = m, W - m
    largura = x1 - x0

    c = canvas.Canvas(caminho_pdf, pagesize=A4)
    d = Danfe(c)
    y = H - m

    # ----------------------------------------------------------------- #
    # CANHOTO (recibo de entrega)
    # ----------------------------------------------------------------- #
    h_canhoto = 22
    d.caixa(x0, y, largura - 90, h_canhoto)
    c.setFont("Helvetica", 6)
    c.drawString(
        x0 + 3, y - 8,
        "RECEBEMOS DE " + _t(emit, "n:xNome").upper()
        + " OS PRODUTOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO",
    )
    c.drawString(x0 + 3, y - 18, "DATA DE RECEBIMENTO                    IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR")
    # caixinha do número da NF
    d.caixa(x1 - 88, y, 88, h_canhoto)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(x1 - 44, y - 8, "NF-e")
    c.setFont("Helvetica", 7)
    c.drawCentredString(x1 - 44, y - 18, f"Nº {int(_t(ide,'n:nNF')):,}".replace(",", ".")
                        + f"   Série {_t(ide,'n:serie')}")
    y -= h_canhoto + 6

    # ----------------------------------------------------------------- #
    # BLOCO IDENTIFICAÇÃO: emitente | DANFE + barcode + chave
    # ----------------------------------------------------------------- #
    h_ident = 92
    w_emit = largura * 0.42
    w_danfe = 70
    w_bar = largura - w_emit - w_danfe

    # -- coluna EMITENTE --
    d.caixa(x0, y, w_emit, h_ident)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x0 + 4, y - 16, _t(emit, "n:xNome"))
    ender = emit.find("n:enderEmit", NS)
    c.setFont("Helvetica", 7)
    linhas_emit = [
        f"{_t(ender,'n:xLgr')}, {_t(ender,'n:nro')} - {_t(ender,'n:xBairro')}",
        f"{_t(ender,'n:xMun')} / {_t(ender,'n:UF')}   CEP {_fmt_cep(_t(ender,'n:CEP'))}",
        f"CNPJ {_fmt_cnpj_cpf(_t(emit,'n:CNPJ'))}",
        f"Fone {_t(ender,'n:fone')}",
    ]
    for i, ln in enumerate(linhas_emit):
        c.drawString(x0 + 4, y - 32 - i * 10, ln)

    # -- coluna DANFE (título) --
    xd = x0 + w_emit
    d.caixa(xd, y, w_danfe, h_ident)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(xd + w_danfe / 2, y - 16, "DANFE")
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(xd + w_danfe / 2, y - 26, "Documento Auxiliar da")
    c.drawCentredString(xd + w_danfe / 2, y - 33, "Nota Fiscal Eletrônica")
    c.setFont("Helvetica", 6)
    c.drawCentredString(xd + w_danfe / 2, y - 46, "0 - Entrada")
    c.drawCentredString(xd + w_danfe / 2, y - 54, "1 - Saída")
    # caixinha do tipo (entrada/saída)
    c.rect(xd + w_danfe / 2 + 14, y - 56, 14, 14)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(xd + w_danfe / 2 + 21, y - 53, tp_nf)
    c.setFont("Helvetica", 7)
    c.drawCentredString(xd + w_danfe / 2, y - 70, f"Nº {int(_t(ide,'n:nNF')):,}".replace(",", "."))
    c.drawCentredString(xd + w_danfe / 2, y - 79, f"Série {_t(ide,'n:serie')}")
    c.drawCentredString(xd + w_danfe / 2, y - 88, "Folha 1/1")

    # -- coluna código de barras + chave --
    xb = xd + w_danfe
    d.caixa(xb, y, w_bar, h_ident)
    # Code-128C da chave de 44 dígitos
    bar = code128.Code128(chave, barHeight=32, barWidth=0.98, humanReadable=False)
    # centraliza; se estourar a largura, reduz a escala
    escala = min(1.0, (w_bar - 12) / bar.width)
    c.saveState()
    c.translate(xb + (w_bar - bar.width * escala) / 2, y - 42)
    c.scale(escala, 1)
    bar.drawOn(c, 0, 0)
    c.restoreState()
    # chave por extenso
    c.setFont("Helvetica", 5)
    c.drawCentredString(xb + w_bar / 2, y - 52, "CHAVE DE ACESSO")
    c.setFont("Helvetica-Bold", 7.5)
    c.drawCentredString(xb + w_bar / 2, y - 62, " ".join(chave[i:i+4] for i in range(0, 44, 4)))
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(xb + w_bar / 2, y - 76,
                        "Consulta de autenticidade no portal nacional da NF-e")
    c.drawCentredString(xb + w_bar / 2, y - 84, "www.nfe.fazenda.gov.br/portal")
    y -= h_ident

    # ----------------------------------------------------------------- #
    # NATUREZA DA OPERAÇÃO | PROTOCOLO
    # ----------------------------------------------------------------- #
    h = 26
    d.campo(x0, y, largura * 0.6, h, "NATUREZA DA OPERAÇÃO", _t(ide, "n:natOp"))
    if protocolo:
        prot_txt = f"{protocolo.get('nProt','')} - {protocolo.get('dhRecbto','')}"
    elif homolog:
        prot_txt = "AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL"
    else:
        prot_txt = "(não autorizada)"
    d.campo(x0 + largura * 0.6, y, largura * 0.4, h,
            "PROTOCOLO DE AUTORIZAÇÃO DE USO", prot_txt, valor_size=7)
    y -= h

    # IE | IE ST | CNPJ
    h = 26
    t = largura / 3
    d.campo(x0, y, t, h, "INSCRIÇÃO ESTADUAL", _t(emit, "n:IE"))
    d.campo(x0 + t, y, t, h, "INSCRIÇÃO ESTADUAL DO SUBST. TRIB.", "")
    d.campo(x0 + 2 * t, y, t, h, "CNPJ", _fmt_cnpj_cpf(_t(emit, "n:CNPJ")))
    y -= h

    # ----------------------------------------------------------------- #
    # DESTINATÁRIO
    # ----------------------------------------------------------------- #
    c.setFont("Helvetica-Bold", 6)
    c.drawString(x0, y - 6, "DESTINATÁRIO / REMETENTE")
    y -= 8
    doc_dest = _t(dest, "n:CNPJ") or _t(dest, "n:CPF")
    ed = dest.find("n:enderDest", NS)
    h = 24
    d.campo(x0, y, largura * 0.6, h, "NOME / RAZÃO SOCIAL", _t(dest, "n:xNome"), valor_size=7)
    d.campo(x0 + largura * 0.6, y, largura * 0.25, h, "CNPJ / CPF", _fmt_cnpj_cpf(doc_dest), valor_size=7)
    d.campo(x0 + largura * 0.85, y, largura * 0.15, h, "DATA EMISSÃO", _t(ide, "n:dhEmi")[:10], valor_size=7)
    y -= h
    h = 24
    d.campo(x0, y, largura * 0.5, h, "ENDEREÇO",
            f"{_t(ed,'n:xLgr')}, {_t(ed,'n:nro')} - {_t(ed,'n:xBairro')}", valor_size=7)
    d.campo(x0 + largura * 0.5, y, largura * 0.3, h, "MUNICÍPIO",
            f"{_t(ed,'n:xMun')} / {_t(ed,'n:UF')}", valor_size=7)
    d.campo(x0 + largura * 0.8, y, largura * 0.2, h, "CEP", _fmt_cep(_t(ed, "n:CEP")), valor_size=7)
    y -= h

    # ----------------------------------------------------------------- #
    # CÁLCULO DO IMPOSTO
    # ----------------------------------------------------------------- #
    c.setFont("Helvetica-Bold", 6)
    c.drawString(x0, y - 6, "CÁLCULO DO IMPOSTO")
    y -= 8
    h = 24
    campos_tot = [
        ("BASE DE CÁLC. DO ICMS", _br(_t(total, "n:vBC"))),
        ("VALOR DO ICMS", _br(_t(total, "n:vICMS"))),
        ("BASE CÁLC. ICMS ST", _br(_t(total, "n:vBCST"))),
        ("VALOR ICMS ST", _br(_t(total, "n:vST"))),
        ("VALOR TOTAL PRODUTOS", _br(_t(total, "n:vProd"))),
    ]
    w = largura / len(campos_tot)
    for i, (rot, val) in enumerate(campos_tot):
        d.campo(x0 + i * w, y, w, h, rot, val, valor_size=7)
    y -= h
    campos_tot2 = [
        ("VALOR DO FRETE", _br(_t(total, "n:vFrete"))),
        ("VALOR DO SEGURO", _br(_t(total, "n:vSeg"))),
        ("DESCONTO", _br(_t(total, "n:vDesc"))),
        ("OUTRAS DESPESAS", _br(_t(total, "n:vOutro"))),
        ("VALOR TOTAL DA NOTA", _br(_t(total, "n:vNF"))),
    ]
    for i, (rot, val) in enumerate(campos_tot2):
        bold = i == len(campos_tot2) - 1
        d.campo(x0 + i * w, y, w, h, rot, val, valor_size=7, bold=bold)
    y -= h

    # ----------------------------------------------------------------- #
    # DADOS DOS PRODUTOS / SERVIÇOS (tabela)
    # ----------------------------------------------------------------- #
    c.setFont("Helvetica-Bold", 6)
    c.drawString(x0, y - 6, "DADOS DOS PRODUTOS / SERVIÇOS")
    y -= 8

    # colunas: (rótulo, largura relativa, alinhamento)
    colunas = [
        ("CÓD", 0.08, "l"),
        ("DESCRIÇÃO", 0.40, "l"),
        ("NCM", 0.10, "c"),
        ("CFOP", 0.07, "c"),
        ("UN", 0.06, "c"),
        ("QTD", 0.09, "r"),
        ("V.UNIT", 0.10, "r"),
        ("V.TOTAL", 0.10, "r"),
    ]
    # cabeçalho
    hc = 12
    d.caixa(x0, y, largura, hc)
    c.setFont("Helvetica-Bold", 6)
    xc = x0
    for rot, lw, al in colunas:
        cw = largura * lw
        c.drawString(xc + 2, y - 8, rot)
        xc += cw
    y -= hc

    # linhas
    c.setFont("Helvetica", 6.5)
    for det in inf.findall("n:det", NS):
        prod = det.find("n:prod", NS)
        valores = [
            _t(prod, "n:cProd"),
            _t(prod, "n:xProd"),
            _t(prod, "n:NCM"),
            _t(prod, "n:CFOP"),
            _t(prod, "n:uCom"),
            _br(_t(prod, "n:qCom"), 4),
            _br(_t(prod, "n:vUnCom"), 2),
            _br(_t(prod, "n:vProd"), 2),
        ]
        hl = 12
        d.caixa(x0, y, largura, hl)
        xc = x0
        for (rot, lw, al), val in zip(colunas, valores):
            cw = largura * lw
            if al == "r":
                c.drawRightString(xc + cw - 3, y - 8, val)
            elif al == "c":
                c.drawCentredString(xc + cw / 2, y - 8, val)
            else:
                # trunca descrição longa
                maxch = int(cw / 3.2)
                c.drawString(xc + 2, y - 8, val[:maxch])
            xc += cw
        y -= hl

    # ----------------------------------------------------------------- #
    # DADOS ADICIONAIS
    # ----------------------------------------------------------------- #
    y -= 4
    c.setFont("Helvetica-Bold", 6)
    c.drawString(x0, y - 6, "DADOS ADICIONAIS")
    y -= 8
    h = 60
    d.caixa(x0, y, largura, h)
    c.setFont("Helvetica", 7)
    infcpl = _t(inf, "n:infAdic/n:infCpl")
    pag = inf.find("n:pag/n:detPag", NS)
    forma = FORMAS_PAG.get(_t(pag, "n:tPag"), _t(pag, "n:tPag"))
    linhas_add = [
        infcpl,
        f"Forma de pagamento: {forma}   Valor: R$ {_br(_t(pag, 'n:vPag'))}",
    ]
    for i, ln in enumerate(linhas_add):
        c.drawString(x0 + 3, y - 12 - i * 11, ln[:130])

    # marca d'água de homologação
    if homolog:
        c.saveState()
        c.setFont("Helvetica-Bold", 40)
        c.setFillGray(0.85)
        c.translate(W / 2, H / 2)
        c.rotate(45)
        c.drawCentredString(0, 0, "SEM VALOR FISCAL")
        c.restoreState()

    c.showPage()
    c.save()
    return caminho_pdf


if __name__ == "__main__":
    from pathlib import Path
    xml = Path("saida/nfe_assinada.xml").read_bytes()
    caminho = gerar_danfe(xml, "saida/danfe.pdf")
    print("DANFE gerado em:", caminho)
