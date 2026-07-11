"""
Comunicação com a SEFAZ (webservices SOAP da NFe 4.00).

Esta camada NÃO conhece regras de negócio do ERP. Ela só sabe:
  - montar o envelope SOAP de cada serviço,
  - enviar pelo "transporte" (real ou simulado),
  - interpretar a resposta da SEFAZ (cStat / xMotivo / protocolo).

A grande sacada de design é o TRANSPORTE ser plugável:
  - TransporteSimulado -> funciona SEM certificado, devolve respostas fake
    (bom para desenvolver e aprender o formato das respostas).
  - TransporteReal -> usa o certificado A1 e fala HTTPS de verdade com a SEFAZ.

Assim o mesmo código de emissão roda hoje (simulado) e amanhã (real), trocando
só uma linha na configuração.
"""

from __future__ import annotations

import abc
import base64
import datetime
import gzip
import random
from dataclasses import dataclass, field

from lxml import etree

NS_NFE = "http://www.portalfiscal.inf.br/nfe"
NS_SOAP = "http://www.w3.org/2003/05/soap-envelope"  # SOAP 1.2
NS = {"n": NS_NFE, "s": NS_SOAP}

# --------------------------------------------------------------------------- #
# URLs dos webservices (só um recorte; a lista completa está no portal da SEFAZ).
# Cada estado tem seu autorizador. Muitos usam o SVRS. Aqui: SP e SVRS.
# ambiente: "1"=produção, "2"=homologação.
# --------------------------------------------------------------------------- #
URLS = {
    ("SP", "2"): {
        "NFeStatusServico4": "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
        "NFeAutorizacao4": "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
    },
    ("SP", "1"): {
        "NFeStatusServico4": "https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
        "NFeAutorizacao4": "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
    },
    # SVRS atende vários estados (RS, BA, CE, PB, etc.) — útil como referência.
    ("SVRS", "2"): {
        "NFeStatusServico4": "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx",
        "NFeAutorizacao4": "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx",
        # Manifestação do destinatário (evento) também fica no SVRS/AN:
        "NFeRecepcaoEvento4": "https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx",
    },
    # DISTRIBUIÇÃO DFe é NACIONAL (Ambiente Nacional), não é por UF.
    ("AN", "2"): {
        "NFeDistribuicaoDFe": "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
        "NFeRecepcaoEvento4": "https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    },
    ("AN", "1"): {
        "NFeDistribuicaoDFe": "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
    },
}

# Código IBGE da UF -> usado no consStatServ
CUF = {"SP": "35", "RJ": "33", "MG": "31", "RS": "43", "PR": "41", "SC": "42", "BA": "29"}


# --------------------------------------------------------------------------- #
# Montagem das mensagens XML de cada serviço
# --------------------------------------------------------------------------- #
def montar_cons_stat_serv(cuf: str, tp_amb: str) -> bytes:
    """XML do serviço de status (consStatServ_v4.00)."""
    cons = etree.Element(f"{{{NS_NFE}}}consStatServ", nsmap={None: NS_NFE})
    cons.set("versao", "4.00")
    etree.SubElement(cons, f"{{{NS_NFE}}}tpAmb").text = tp_amb
    etree.SubElement(cons, f"{{{NS_NFE}}}cUF").text = cuf
    etree.SubElement(cons, f"{{{NS_NFE}}}xServ").text = "STATUS"
    return etree.tostring(cons, encoding="UTF-8")


def montar_envi_nfe(xml_nfe_assinada: bytes, id_lote: str, sincrono: bool = True) -> bytes:
    """
    XML de envio para autorização (enviNFe_v4.00), embrulhando a NFe assinada
    num "lote". indSinc=1 pede processamento SÍNCRONO (a resposta já vem com o
    protocolo, sem precisar consultar recibo depois).
    """
    envi = etree.Element(f"{{{NS_NFE}}}enviNFe", nsmap={None: NS_NFE})
    envi.set("versao", "4.00")
    etree.SubElement(envi, f"{{{NS_NFE}}}idLote").text = id_lote
    etree.SubElement(envi, f"{{{NS_NFE}}}indSinc").text = "1" if sincrono else "0"
    # anexa o elemento <NFe> assinado
    nfe_el = etree.fromstring(xml_nfe_assinada)
    envi.append(nfe_el)
    return etree.tostring(envi, encoding="UTF-8")


def montar_dist_dfe(cnpj: str, ult_nsu: str, cuf: str, tp_amb: str) -> bytes:
    """
    XML da consulta de Distribuição DFe (distDFeInt). Você pede os documentos
    emitidos CONTRA o seu CNPJ com NSU maior que `ult_nsu` (o seu cursor).
    O NSU é um número sequencial único que a SEFAZ dá a cada documento seu.
    """
    dist = etree.Element(f"{{{NS_NFE}}}distDFeInt", nsmap={None: NS_NFE})
    dist.set("versao", "1.35")
    etree.SubElement(dist, f"{{{NS_NFE}}}tpAmb").text = tp_amb
    etree.SubElement(dist, f"{{{NS_NFE}}}cUFAutor").text = cuf
    etree.SubElement(dist, f"{{{NS_NFE}}}CNPJ").text = cnpj
    dist_nsu = etree.SubElement(dist, f"{{{NS_NFE}}}distNSU")
    etree.SubElement(dist_nsu, f"{{{NS_NFE}}}ultNSU").text = f"{int(ult_nsu):015d}"
    return etree.tostring(dist, encoding="UTF-8")


def montar_evento_manifestacao(cnpj: str, chave: str, tp_evento: str,
                               n_seq: int, tp_amb: str, cuf: str) -> bytes:
    """
    XML de um evento de MANIFESTAÇÃO do destinatário (envEvento). Ex.:
      210210 = Ciência da Operação   210200 = Confirmação
      210220 = Desconhecimento       210240 = Operação não Realizada
    OBS: em produção o <evento> precisa ser ASSINADO (igual à NFe). No simulado
    pulamos a assinatura para focar no fluxo.
    """
    descricoes = {
        "210200": "Confirmacao da Operacao", "210210": "Ciencia da Operacao",
        "210220": "Desconhecimento da Operacao", "210240": "Operacao nao Realizada",
    }
    dh = datetime.datetime.now().astimezone().replace(microsecond=0).isoformat()
    id_evento = f"ID{tp_evento}{chave}{n_seq:02d}"
    env = etree.Element(f"{{{NS_NFE}}}envEvento", nsmap={None: NS_NFE})
    env.set("versao", "1.00")
    etree.SubElement(env, f"{{{NS_NFE}}}idLote").text = "1"
    ev = etree.SubElement(env, f"{{{NS_NFE}}}evento")
    ev.set("versao", "1.00")
    inf = etree.SubElement(ev, f"{{{NS_NFE}}}infEvento")
    inf.set("Id", id_evento)
    etree.SubElement(inf, f"{{{NS_NFE}}}cOrgao").text = "91"  # 91 = Ambiente Nacional
    etree.SubElement(inf, f"{{{NS_NFE}}}tpAmb").text = tp_amb
    etree.SubElement(inf, f"{{{NS_NFE}}}CNPJ").text = cnpj
    etree.SubElement(inf, f"{{{NS_NFE}}}chNFe").text = chave
    etree.SubElement(inf, f"{{{NS_NFE}}}dhEvento").text = dh
    etree.SubElement(inf, f"{{{NS_NFE}}}tpEvento").text = tp_evento
    etree.SubElement(inf, f"{{{NS_NFE}}}nSeqEvento").text = str(n_seq)
    etree.SubElement(inf, f"{{{NS_NFE}}}verEvento").text = "1.00"
    det = etree.SubElement(inf, f"{{{NS_NFE}}}detEvento")
    det.set("versao", "1.00")
    etree.SubElement(det, f"{{{NS_NFE}}}descEvento").text = descricoes.get(tp_evento, "Manifestacao")
    return etree.tostring(env, encoding="UTF-8")


def _envelope_soap(servico: str, conteudo_xml: bytes) -> bytes:
    """
    Embrulha a mensagem no envelope SOAP 1.2. O conteúdo vai dentro de
    <nfeDadosMsg>, cujo namespace é o WSDL específico do serviço.
    """
    wsdl_ns = f"http://www.portalfiscal.inf.br/nfe/wsdl/{servico}"
    env = etree.Element(f"{{{NS_SOAP}}}Envelope", nsmap={"soap12": NS_SOAP})
    body = etree.SubElement(env, f"{{{NS_SOAP}}}Body")
    dados = etree.SubElement(body, f"{{{wsdl_ns}}}nfeDadosMsg", nsmap={None: wsdl_ns})
    dados.append(etree.fromstring(conteudo_xml))
    return etree.tostring(env, xml_declaration=True, encoding="UTF-8")


# --------------------------------------------------------------------------- #
# Transportes (interface + duas implementações)
# --------------------------------------------------------------------------- #
class Transporte(abc.ABC):
    """Contrato: dado um serviço, URL e envelope SOAP, devolve o XML de resposta."""

    @abc.abstractmethod
    def enviar(self, servico: str, url: str, envelope: bytes) -> bytes:
        ...


class TransporteSimulado(Transporte):
    """
    NÃO fala com a SEFAZ. Detecta qual serviço foi chamado e devolve uma
    resposta plausível, no MESMO formato que a SEFAZ devolveria. Perfeito para
    desenvolver o ERP sem certificado nem credenciamento.
    """

    def enviar(self, servico: str, url: str, envelope: bytes) -> bytes:
        texto = envelope.decode("utf-8")
        agora = datetime.datetime.now().astimezone().replace(microsecond=0).isoformat()

        if servico == "NFeStatusServico4":
            return self._resp_status(agora)
        if servico == "NFeAutorizacao4":
            chave = self._extrair_chave(envelope)
            return self._resp_autorizacao(chave, agora)
        if servico == "NFeDistribuicaoDFe":
            return self._resp_distribuicao(envelope, agora)
        if servico == "NFeRecepcaoEvento4":
            return self._resp_evento(envelope, agora)
        raise NotImplementedError(f"Serviço não simulado: {servico}")

    def _extrair_chave(self, envelope: bytes) -> str:
        raiz = etree.fromstring(envelope)
        inf = raiz.find(f".//{{{NS_NFE}}}infNFe")
        return inf.get("Id").replace("NFe", "")

    def _resp_status(self, agora: str) -> bytes:
        return (
            f'<retConsStatServ versao="4.00" xmlns="{NS_NFE}">'
            f"<tpAmb>2</tpAmb><verAplic>SIMULADO_1.0</verAplic>"
            f"<cStat>107</cStat><xMotivo>Servico em Operacao</xMotivo>"
            f"<cUF>35</cUF><dhRecbto>{agora}</dhRecbto><tMed>1</tMed>"
            f"</retConsStatServ>"
        ).encode("utf-8")

    def _resp_autorizacao(self, chave: str, agora: str) -> bytes:
        # nº de protocolo fictício (15 dígitos, como o real)
        nprot = f"1{random.randint(0, 10**14 - 1):014d}"
        return (
            f'<retEnviNFe versao="4.00" xmlns="{NS_NFE}">'
            f"<tpAmb>2</tpAmb><verAplic>SIMULADO_1.0</verAplic>"
            f"<cStat>104</cStat><xMotivo>Lote processado</xMotivo>"
            f"<cUF>35</cUF><dhRecbto>{agora}</dhRecbto>"
            f'<protNFe versao="4.00"><infProt>'
            f"<tpAmb>2</tpAmb><verAplic>SIMULADO_1.0</verAplic>"
            f"<chNFe>{chave}</chNFe><dhRecbto>{agora}</dhRecbto>"
            f"<nProt>{nprot}</nProt><digVal>SIMULADO</digVal>"
            f"<cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo>"
            f"</infProt></protNFe></retEnviNFe>"
        ).encode("utf-8")

    # --- Distribuição DFe: simula um "universo" fixo de 2 notas de FORNECEDORES
    #     emitidas contra o nosso CNPJ (NSU 1 e 2). ---------------------------- #
    _UNIVERSO = [
        # (NSU, cnpj_emitente_fornecedor, [(cProd, xProd, qtd, vUnit)])
        (1, "99888777000166", [("001", "CAMISETA ALGODAO AZUL M", 10, "30.00")]),
        (2, "99888777000166", [("002", "CALCA JEANS PRETA 42", 5, "80.00")]),
    ]

    def _resp_distribuicao(self, envelope: bytes, agora: str) -> bytes:
        raiz = etree.fromstring(envelope)
        ult_nsu = int(raiz.findtext(f".//{{{NS_NFE}}}ultNSU") or "0")
        max_nsu = max(n for n, _, _ in self._UNIVERSO)
        novos = [d for d in self._UNIVERSO if d[0] > ult_nsu]

        if not novos:
            # 137 = Nenhum documento localizado (você está "em dia")
            return (
                f'<retDistDFeInt versao="1.35" xmlns="{NS_NFE}">'
                f"<tpAmb>2</tpAmb><verAplic>SIMULADO</verAplic>"
                f"<cStat>137</cStat><xMotivo>Nenhum documento localizado</xMotivo>"
                f"<dhResp>{agora}</dhResp><ultNSU>{ult_nsu:015d}</ultNSU>"
                f"<maxNSU>{max_nsu:015d}</maxNSU></retDistDFeInt>"
            ).encode("utf-8")

        docs = []
        for nsu, cnpj_emit, itens in novos:
            xml_nfe = self._fake_nfe_fornecedor(nsu, cnpj_emit, itens, agora)
            gz_b64 = base64.b64encode(gzip.compress(xml_nfe)).decode()
            docs.append(
                f'<docZip NSU="{nsu:015d}" schema="procNFe_v4.00.xsd">{gz_b64}</docZip>'
            )
        entregue = max(n for n, _, _ in novos)
        return (
            f'<retDistDFeInt versao="1.35" xmlns="{NS_NFE}">'
            f"<tpAmb>2</tpAmb><verAplic>SIMULADO</verAplic>"
            f"<cStat>138</cStat><xMotivo>Documento(s) localizado(s)</xMotivo>"
            f"<dhResp>{agora}</dhResp><ultNSU>{entregue:015d}</ultNSU>"
            f"<maxNSU>{max_nsu:015d}</maxNSU>"
            f"<loteDistDFeInt>{''.join(docs)}</loteDistDFeInt>"
            f"</retDistDFeInt>"
        ).encode("utf-8")

    def _fake_nfe_fornecedor(self, nsu, cnpj_emit, itens, agora) -> bytes:
        """Constrói uma NFe mínima (procNFe) 'emitida por um fornecedor' p/ nós."""
        chave = f"3526{cnpj_emit}550010000{nsu:05d}1{nsu:08d}0"[:44].ljust(44, "0")
        dets = ""
        for i, (cprod, xprod, qtd, vunit) in enumerate(itens, start=1):
            vprod = f"{qtd * float(vunit):.2f}"
            dets += (
                f'<det nItem="{i}"><prod>'
                f"<cProd>{cprod}</cProd><xProd>{xprod}</xProd>"
                f"<qCom>{qtd:.4f}</qCom><vUnCom>{vunit}</vUnCom><vProd>{vprod}</vProd>"
                f"</prod></det>"
            )
        return (
            f'<nfeProc versao="4.00" xmlns="{NS_NFE}"><NFe><infNFe Id="NFe{chave}" versao="4.00">'
            f"<ide><nNF>{nsu}</nNF><dhEmi>{agora}</dhEmi></ide>"
            f"<emit><CNPJ>{cnpj_emit}</CNPJ><xNome>FORNECEDOR EXEMPLO LTDA</xNome></emit>"
            f"<dest><CNPJ>12345678000190</CNPJ></dest>"
            f"{dets}"
            f"</infNFe></NFe></nfeProc>"
        ).encode("utf-8")

    def _resp_evento(self, envelope: bytes, agora: str) -> bytes:
        raiz = etree.fromstring(envelope)
        chave = raiz.findtext(f".//{{{NS_NFE}}}chNFe") or ""
        nprot = f"1{random.randint(0, 10**14 - 1):014d}"
        return (
            f'<retEnvEvento versao="1.00" xmlns="{NS_NFE}">'
            f"<idLote>1</idLote><tpAmb>2</tpAmb><verAplic>SIMULADO</verAplic>"
            f"<cOrgao>91</cOrgao><cStat>128</cStat><xMotivo>Lote de Evento Processado</xMotivo>"
            f'<retEvento versao="1.00"><infEvento>'
            f"<tpAmb>2</tpAmb><verAplic>SIMULADO</verAplic><cOrgao>91</cOrgao>"
            f"<cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo>"
            f"<chNFe>{chave}</chNFe><nProt>{nprot}</nProt><dhRegEvento>{agora}</dhRegEvento>"
            f"</infEvento></retEvento></retEnvEvento>"
        ).encode("utf-8")


class TransporteReal(Transporte):
    """
    Fala HTTPS de verdade com a SEFAZ, usando o certificado A1 para autenticar
    a conexão (TLS com certificado de cliente). Só funciona com um certificado
    ICP-Brasil real e a empresa credenciada.

    Requer `requests`. O .pfx é convertido para PEM temporário porque o requests
    espera arquivos PEM de cert/chave.
    """

    def __init__(self, caminho_pfx: str, senha: str, verificar_ssl: bool = True):
        self.caminho_pfx = caminho_pfx
        self.senha = senha
        self.verificar_ssl = verificar_ssl

    def enviar(self, servico: str, url: str, envelope: bytes) -> bytes:
        import tempfile
        import os
        import requests  # import tardio: só necessário no modo real
        from cryptography.hazmat.primitives import serialization
        from ..core.certificado import carregar_pfx

        chave, cert = carregar_pfx(self.caminho_pfx, self.senha)
        cert_pem = cert.public_bytes(serialization.Encoding.PEM)
        key_pem = chave.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        )

        # grava cert/chave em arquivos temporários (o requests lê por caminho)
        fd_c, path_c = tempfile.mkstemp(suffix=".pem")
        fd_k, path_k = tempfile.mkstemp(suffix=".pem")
        try:
            os.write(fd_c, cert_pem); os.close(fd_c)
            os.write(fd_k, key_pem); os.close(fd_k)
            resp = requests.post(
                url,
                data=envelope,
                headers={"Content-Type": "application/soap+xml; charset=utf-8"},
                cert=(path_c, path_k),
                verify=self.verificar_ssl,  # idealmente aponte para a CA ICP-Brasil
                timeout=60,
            )
            resp.raise_for_status()
            return resp.content
        finally:
            os.unlink(path_c)
            os.unlink(path_k)


# --------------------------------------------------------------------------- #
# Resultados tipados
# --------------------------------------------------------------------------- #
@dataclass
class RespostaStatus:
    cstat: str
    xmotivo: str
    em_operacao: bool


@dataclass
class RespostaAutorizacao:
    cstat: str
    xmotivo: str
    autorizada: bool
    nprot: str | None
    prot_nfe_xml: bytes | None  # o <protNFe> para anexar ao XML autorizado


@dataclass
class DocumentoRecebido:
    """Um documento (NFe de fornecedor) baixado via Distribuição DFe."""
    nsu: int
    chave: str
    cnpj_emitente: str
    xml: bytes
    itens: list = field(default_factory=list)  # [{"cProd","qtd"}] p/ dar entrada


@dataclass
class RespostaDistribuicao:
    cstat: str
    xmotivo: str
    ult_nsu: int          # até onde a SEFAZ entregou (novo cursor)
    max_nsu: int          # o maior NSU existente (se > ult_nsu, ainda há mais)
    documentos: list      # list[DocumentoRecebido]
    tem_mais: bool        # ainda há documentos além deste lote?


@dataclass
class RespostaEvento:
    cstat: str
    xmotivo: str
    registrado: bool


# --------------------------------------------------------------------------- #
# Comunicador: orquestra montagem + transporte + parsing
# --------------------------------------------------------------------------- #
class ComunicadorSEFAZ:
    def __init__(self, uf: str, ambiente: str, transporte: Transporte, autorizador: str | None = None):
        self.uf = uf
        self.ambiente = ambiente
        self.transporte = transporte
        # autorizador: a SEFAZ que responde (pode ser a própria UF ou SVRS)
        self.autorizador = autorizador or uf

    def _url(self, servico: str, autorizador: str | None = None) -> str:
        chave = (autorizador or self.autorizador, self.ambiente)
        if chave not in URLS or servico not in URLS[chave]:
            raise KeyError(
                f"Sem URL para {servico} em {chave}. "
                f"Consulte o portal da SEFAZ e adicione em URLS."
            )
        return URLS[chave][servico]

    def _chamar(self, servico: str, conteudo: bytes, autorizador: str | None = None) -> bytes:
        url = (self._url(servico, autorizador)
               if not isinstance(self.transporte, TransporteSimulado) else "SIMULADO")
        envelope = _envelope_soap(servico, conteudo)
        resposta_soap = self.transporte.enviar(servico, url, envelope)
        # extrai o conteúdo de dentro do Body SOAP (se vier embrulhado)
        raiz = etree.fromstring(resposta_soap)
        if raiz.tag == f"{{{NS_SOAP}}}Envelope":
            corpo = raiz.find(f".//{{{NS_SOAP}}}Body")
            # o retorno fica dentro de nfeResultMsg
            return etree.tostring(corpo[0][0])
        return resposta_soap

    def status_servico(self) -> RespostaStatus:
        cuf = CUF.get(self.uf, "35")
        conteudo = montar_cons_stat_serv(cuf, self.ambiente)
        ret = etree.fromstring(self._chamar("NFeStatusServico4", conteudo))
        cstat = ret.findtext(f"{{{NS_NFE}}}cStat", "")
        xmot = ret.findtext(f"{{{NS_NFE}}}xMotivo", "")
        return RespostaStatus(cstat, xmot, em_operacao=cstat == "107")

    def autorizar(self, xml_nfe_assinada: bytes, id_lote: str = "1") -> RespostaAutorizacao:
        conteudo = montar_envi_nfe(xml_nfe_assinada, id_lote, sincrono=True)
        ret = etree.fromstring(self._chamar("NFeAutorizacao4", conteudo))
        prot = ret.find(f"{{{NS_NFE}}}protNFe")
        if prot is None:
            # lote rejeitado antes de gerar protocolo
            return RespostaAutorizacao(
                ret.findtext(f"{{{NS_NFE}}}cStat", ""),
                ret.findtext(f"{{{NS_NFE}}}xMotivo", ""),
                False, None, None,
            )
        inf = prot.find(f"{{{NS_NFE}}}infProt")
        cstat = inf.findtext(f"{{{NS_NFE}}}cStat", "")
        xmot = inf.findtext(f"{{{NS_NFE}}}xMotivo", "")
        nprot = inf.findtext(f"{{{NS_NFE}}}nProt")
        return RespostaAutorizacao(
            cstat, xmot,
            autorizada=cstat == "100",
            nprot=nprot,
            prot_nfe_xml=etree.tostring(prot, encoding="UTF-8"),
        )

    def distribuir_dfe(self, cnpj: str, ult_nsu: int) -> RespostaDistribuicao:
        """
        Consulta a Distribuição DFe (documentos emitidos CONTRA o nosso CNPJ).
        Serviço NACIONAL (autorizador 'AN'). Cada docZip vem gzipado+base64.
        """
        cuf = CUF.get(self.uf, "35")
        conteudo = montar_dist_dfe(cnpj, str(ult_nsu), cuf, self.ambiente)
        ret = etree.fromstring(self._chamar("NFeDistribuicaoDFe", conteudo, autorizador="AN"))

        cstat = ret.findtext(f"{{{NS_NFE}}}cStat", "")
        xmot = ret.findtext(f"{{{NS_NFE}}}xMotivo", "")
        novo_ult = int(ret.findtext(f"{{{NS_NFE}}}ultNSU", "0"))
        max_nsu = int(ret.findtext(f"{{{NS_NFE}}}maxNSU", "0"))

        documentos = []
        for doczip in ret.findall(f".//{{{NS_NFE}}}docZip"):
            nsu = int(doczip.get("NSU"))
            # descompacta: base64 -> gzip -> XML
            xml = gzip.decompress(base64.b64decode(doczip.text))
            doc = etree.fromstring(xml)
            inf = doc.find(f".//{{{NS_NFE}}}infNFe")
            chave = inf.get("Id").replace("NFe", "") if inf is not None else ""
            cnpj_emit = doc.findtext(f".//{{{NS_NFE}}}emit/{{{NS_NFE}}}CNPJ", "")
            itens = []
            for prod in doc.findall(f".//{{{NS_NFE}}}det/{{{NS_NFE}}}prod"):
                itens.append({
                    "cProd": prod.findtext(f"{{{NS_NFE}}}cProd", ""),
                    "qtd": float(prod.findtext(f"{{{NS_NFE}}}qCom", "0")),
                    "valor": float(prod.findtext(f"{{{NS_NFE}}}vProd", "0")),  # p/ contas a pagar
                })
            documentos.append(DocumentoRecebido(nsu, chave, cnpj_emit, xml, itens))

        return RespostaDistribuicao(
            cstat=cstat, xmotivo=xmot, ult_nsu=novo_ult, max_nsu=max_nsu,
            documentos=documentos, tem_mais=max_nsu > novo_ult,
        )

    def manifestar(self, cnpj: str, chave: str, tp_evento: str, n_seq: int = 1) -> RespostaEvento:
        """Envia um evento de manifestação do destinatário (ex.: 210210 Ciência)."""
        cuf = CUF.get(self.uf, "35")
        conteudo = montar_evento_manifestacao(cnpj, chave, tp_evento, n_seq, self.ambiente, cuf)
        ret = etree.fromstring(self._chamar("NFeRecepcaoEvento4", conteudo, autorizador="AN"))
        inf = ret.find(f".//{{{NS_NFE}}}retEvento/{{{NS_NFE}}}infEvento")
        if inf is None:
            return RespostaEvento(ret.findtext(f"{{{NS_NFE}}}cStat", ""),
                                  ret.findtext(f"{{{NS_NFE}}}xMotivo", ""), False)
        cstat = inf.findtext(f"{{{NS_NFE}}}cStat", "")
        xmot = inf.findtext(f"{{{NS_NFE}}}xMotivo", "")
        # 135/136 = evento registrado com sucesso
        return RespostaEvento(cstat, xmot, registrado=cstat in ("135", "136"))
