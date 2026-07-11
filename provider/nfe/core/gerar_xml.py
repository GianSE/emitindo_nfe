"""
Geração do XML da NFe (modelo 55, layout 4.00).

Este módulo monta o XML "campo a campo" com lxml, para você ENXERGAR a estrutura.
Num ERP de produção você usaria a nfelib/PyNFe, mas aqui o objetivo é aprender.

Namespace oficial da NFe: http://www.portalfiscal.inf.br/nfe
Todos os elementos vivem dentro dele.

O exemplo modela uma empresa do SIMPLES NACIONAL (crt=1), que é o caso mais
comum de quem começa. Por isso os impostos usam:
  - ICMS  -> ICMSSN102 (CSOSN 102: tributada pelo Simples, sem crédito)
  - PIS   -> CST 07 (isento)
  - COFINS-> CST 07 (isento)
Empresas do regime normal usariam CST de ICMS (00, 20, 60...) e alíquotas.
"""

from decimal import Decimal
from lxml import etree

from .chave_acesso import montar_chave, gerar_codigo_numerico

NS = "http://www.portalfiscal.inf.br/nfe"


def _sub(pai, tag, texto=None):
    """Cria um subelemento no namespace da NFe. Se `texto` vier, preenche o valor."""
    el = etree.SubElement(pai, f"{{{NS}}}{tag}")
    if texto is not None:
        el.text = str(texto)
    return el


def _dec(valor, casas=2) -> str:
    """Formata número no padrão da SEFAZ: ponto decimal, sem separador de milhar."""
    return f"{Decimal(str(valor)):.{casas}f}"


def gerar_nfe(dados: dict) -> tuple[bytes, str]:
    """
    Recebe um dicionário com os dados da venda e devolve:
      (xml_em_bytes, chave_de_acesso_44_digitos)

    O XML retornado ainda NÃO está assinado — a assinatura é o passo seguinte.
    """
    ide = dados["ide"]
    emit = dados["emit"]
    dest = dados["dest"]
    itens = dados["itens"]
    pagamento = dados["pagamento"]

    # ---------------------------------------------------------------
    # 1) CHAVE DE ACESSO — precisa ser calculada ANTES de montar o XML,
    #    porque ela vira o atributo Id do infNFe (e é referenciada na assinatura).
    #
    #    IDEMPOTÊNCIA: se `ide["cNF"]` vier preenchido, reutilizamos ele. Isso
    #    mantém a CHAVE estável entre tentativas (retry não gera nota nova).
    #    Se não vier, geramos um aleatório (comportamento antigo).
    # ---------------------------------------------------------------
    codigo_numerico = ide.get("cNF") or gerar_codigo_numerico()
    chave = montar_chave(
        cUF=emit["cUF"],
        ano=ide["ano"],
        mes=ide["mes"],
        cnpj=emit["CNPJ"],
        modelo="55",
        serie=ide["serie"],
        numero_nf=ide["nNF"],
        tp_emis="1",
        codigo_numerico=codigo_numerico,
    )

    # ---------------------------------------------------------------
    # 2) Elemento raiz <NFe> e <infNFe>
    # ---------------------------------------------------------------
    nfe = etree.Element(f"{{{NS}}}NFe", nsmap={None: NS})
    inf = _sub(nfe, "infNFe")
    inf.set("versao", "4.00")
    inf.set("Id", f"NFe{chave}")  # <- Id que a assinatura vai referenciar

    # ---------------------------------------------------------------
    # 3) <ide> — IDENTIFICAÇÃO da nota
    # ---------------------------------------------------------------
    g_ide = _sub(inf, "ide")
    _sub(g_ide, "cUF", emit["cUF"])                 # UF do emitente (IBGE)
    _sub(g_ide, "cNF", codigo_numerico)             # código numérico da chave
    _sub(g_ide, "natOp", ide["natOp"])              # natureza da operação (ex.: "Venda")
    _sub(g_ide, "mod", "55")                        # modelo 55 = NFe
    _sub(g_ide, "serie", ide["serie"])
    _sub(g_ide, "nNF", ide["nNF"])                  # número da nota
    _sub(g_ide, "dhEmi", ide["dhEmi"])              # data/hora de emissão (com fuso!)
    _sub(g_ide, "tpNF", ide.get("tpNF", "1"))       # 0=entrada, 1=saída
    _sub(g_ide, "idDest", "1")                      # 1=interna, 2=interestadual, 3=exterior
    _sub(g_ide, "cMunFG", emit["cMun"])             # município do fato gerador
    _sub(g_ide, "tpImp", "1")                       # formato do DANFE: 1=retrato
    _sub(g_ide, "tpEmis", "1")                      # 1=emissão normal
    _sub(g_ide, "cDV", chave[-1])                   # dígito verificador da chave
    _sub(g_ide, "tpAmb", ide["tpAmb"])              # 1=produção, 2=homologação
    _sub(g_ide, "finNFe", "1")                      # 1=normal
    _sub(g_ide, "indFinal", "1")                    # 1=consumidor final
    _sub(g_ide, "indPres", "1")                     # 1=presencial
    _sub(g_ide, "procEmi", "0")                     # 0=emissão por app do contribuinte
    _sub(g_ide, "verProc", "ERP-Educacional-1.0")  # versão do seu sistema

    # ---------------------------------------------------------------
    # 4) <emit> — EMITENTE (sua empresa)
    # ---------------------------------------------------------------
    g_emit = _sub(inf, "emit")
    _sub(g_emit, "CNPJ", emit["CNPJ"])
    _sub(g_emit, "xNome", emit["xNome"])            # razão social
    _sub(g_emit, "xFant", emit.get("xFant", ""))    # nome fantasia
    ender_emit = _sub(g_emit, "enderEmit")
    _sub(ender_emit, "xLgr", emit["xLgr"])          # logradouro
    _sub(ender_emit, "nro", emit["nro"])            # número
    _sub(ender_emit, "xBairro", emit["xBairro"])
    _sub(ender_emit, "cMun", emit["cMun"])          # cód. município IBGE
    _sub(ender_emit, "xMun", emit["xMun"])          # nome do município
    _sub(ender_emit, "UF", emit["UF"])
    _sub(ender_emit, "CEP", emit["CEP"])
    _sub(ender_emit, "cPais", "1058")               # 1058 = Brasil
    _sub(ender_emit, "xPais", "BRASIL")
    _sub(ender_emit, "fone", emit.get("fone", ""))
    _sub(g_emit, "IE", emit["IE"])                  # inscrição estadual
    _sub(g_emit, "CRT", emit["CRT"])                # 1=Simples Nacional

    # ---------------------------------------------------------------
    # 5) <dest> — DESTINATÁRIO (cliente)
    # ---------------------------------------------------------------
    g_dest = _sub(inf, "dest")
    # aceita CPF (pessoa física) ou CNPJ (jurídica)
    if len(dest["doc"]) == 14:
        _sub(g_dest, "CNPJ", dest["doc"])
    else:
        _sub(g_dest, "CPF", dest["doc"])
    _sub(g_dest, "xNome", dest["xNome"])
    ender_dest = _sub(g_dest, "enderDest")
    _sub(ender_dest, "xLgr", dest["xLgr"])
    _sub(ender_dest, "nro", dest["nro"])
    _sub(ender_dest, "xBairro", dest["xBairro"])
    _sub(ender_dest, "cMun", dest["cMun"])
    _sub(ender_dest, "xMun", dest["xMun"])
    _sub(ender_dest, "UF", dest["UF"])
    _sub(ender_dest, "CEP", dest["CEP"])
    _sub(ender_dest, "cPais", "1058")
    _sub(ender_dest, "xPais", "BRASIL")
    # indIEDest: 9 = não contribuinte do ICMS (pessoa física, p.ex.)
    _sub(g_dest, "indIEDest", dest.get("indIEDest", "9"))

    # ---------------------------------------------------------------
    # 6) <det> — DETALHE de cada ITEM (produto + impostos)
    # ---------------------------------------------------------------
    total_produtos = Decimal("0")
    for i, item in enumerate(itens, start=1):
        g_det = _sub(inf, "det")
        g_det.set("nItem", str(i))

        valor_item = Decimal(str(item["qtd"])) * Decimal(str(item["vUnit"]))
        total_produtos += valor_item

        # --- <prod> dados comerciais do produto ---
        g_prod = _sub(g_det, "prod")
        _sub(g_prod, "cProd", item["cProd"])         # código interno do produto
        _sub(g_prod, "cEAN", item.get("cEAN", "SEM GTIN"))   # código de barras
        _sub(g_prod, "xProd", item["xProd"])         # descrição
        _sub(g_prod, "NCM", item["NCM"])             # classificação fiscal (8 díg.)
        _sub(g_prod, "CFOP", item["CFOP"])           # natureza da operação (4 díg.)
        _sub(g_prod, "uCom", item["uCom"])           # unidade comercial (UN, KG...)
        _sub(g_prod, "qCom", _dec(item["qtd"], 4))
        _sub(g_prod, "vUnCom", _dec(item["vUnit"], 10))
        _sub(g_prod, "vProd", _dec(valor_item))
        _sub(g_prod, "cEANTrib", item.get("cEAN", "SEM GTIN"))
        _sub(g_prod, "uTrib", item["uCom"])          # unidade tributável
        _sub(g_prod, "qTrib", _dec(item["qtd"], 4))
        _sub(g_prod, "vUnTrib", _dec(item["vUnit"], 10))
        _sub(g_prod, "indTot", "1")                  # 1 = compõe o total da nota

        # --- <imposto> ICMS / PIS / COFINS ---
        g_imp = _sub(g_det, "imposto")

        # ICMS — para Simples Nacional usa-se o grupo ICMSSN com CSOSN
        g_icms = _sub(g_imp, "ICMS")
        icms_sn = _sub(g_icms, "ICMSSN102")
        _sub(icms_sn, "orig", "0")                   # 0 = mercadoria nacional
        _sub(icms_sn, "CSOSN", "102")                # tributada pelo Simples, sem crédito

        # PIS — CST 07 (operação isenta)
        g_pis = _sub(g_imp, "PIS")
        pis_nt = _sub(g_pis, "PISNT")
        _sub(pis_nt, "CST", "07")

        # COFINS — CST 07 (operação isenta)
        g_cof = _sub(g_imp, "COFINS")
        cof_nt = _sub(g_cof, "COFINSNT")
        _sub(cof_nt, "CST", "07")

    # ---------------------------------------------------------------
    # 7) <total> — TOTAIS da nota
    #    Para Simples com CSOSN 102 os valores de ICMS ficam zerados.
    # ---------------------------------------------------------------
    g_total = _sub(inf, "total")
    g_icmstot = _sub(g_total, "ICMSTot")
    _sub(g_icmstot, "vBC", _dec(0))
    _sub(g_icmstot, "vICMS", _dec(0))
    _sub(g_icmstot, "vICMSDeson", _dec(0))
    _sub(g_icmstot, "vFCP", _dec(0))
    _sub(g_icmstot, "vBCST", _dec(0))
    _sub(g_icmstot, "vST", _dec(0))
    _sub(g_icmstot, "vFCPST", _dec(0))
    _sub(g_icmstot, "vFCPSTRet", _dec(0))
    _sub(g_icmstot, "vProd", _dec(total_produtos))
    _sub(g_icmstot, "vFrete", _dec(0))
    _sub(g_icmstot, "vSeg", _dec(0))
    _sub(g_icmstot, "vDesc", _dec(0))
    _sub(g_icmstot, "vII", _dec(0))
    _sub(g_icmstot, "vIPI", _dec(0))
    _sub(g_icmstot, "vIPIDevol", _dec(0))
    _sub(g_icmstot, "vPIS", _dec(0))
    _sub(g_icmstot, "vCOFINS", _dec(0))
    _sub(g_icmstot, "vOutro", _dec(0))
    _sub(g_icmstot, "vNF", _dec(total_produtos))    # valor total da nota

    # ---------------------------------------------------------------
    # 8) <transp> — TRANSPORTE (9 = sem frete / sem transporte)
    # ---------------------------------------------------------------
    g_transp = _sub(inf, "transp")
    _sub(g_transp, "modFrete", "9")

    # ---------------------------------------------------------------
    # 9) <pag> — PAGAMENTO
    # ---------------------------------------------------------------
    g_pag = _sub(inf, "pag")
    det_pag = _sub(g_pag, "detPag")
    _sub(det_pag, "tPag", pagamento["tPag"])         # 01=dinheiro, 03=cartão crédito, 17=Pix...
    _sub(det_pag, "vPag", _dec(total_produtos))

    # ---------------------------------------------------------------
    # 10) <infAdic> — INFORMAÇÕES ADICIONAIS
    # ---------------------------------------------------------------
    g_infadic = _sub(inf, "infAdic")
    obs = dados.get("obs", "")
    if ide["tpAmb"] == "2":
        # exigência legal em homologação
        obs = ("NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL. "
               + obs).strip()
    _sub(g_infadic, "infCpl", obs)

    xml_bytes = etree.tostring(nfe, xml_declaration=True, encoding="UTF-8")
    return xml_bytes, chave


if __name__ == "__main__":
    from ..dados_exemplo import DADOS
    xml, chave = gerar_nfe(DADOS)
    print("Chave:", chave)
    print(etree.tostring(etree.fromstring(xml), pretty_print=True).decode())
