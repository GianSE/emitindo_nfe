"""
NFeProvider — a FACHADA que o seu ERP vai usar.

O ERP não precisa saber nada de XML, assinatura, XSD ou SOAP. Ele só faz:

    provider = NFeProvider(config)
    resultado = provider.emitir(dados_da_venda)
    if resultado.autorizada:
        salvar(resultado.xml_autorizado)   # guardar por 5 anos
        gerar_pdf(resultado.xml_autorizado)

Por baixo, o provider orquestra: gerar XML -> assinar -> validar (XSD) ->
enviar à SEFAZ -> anexar o protocolo. Trocar do modo "simulado" para o "real"
é só mudar a config; o ERP não muda uma linha.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from lxml import etree

from .core.certificado import gerar_certificado_teste
from .core.gerar_xml import gerar_nfe
from .core.assinar import assinar_nfe
from .core.validar import validar_nfe
from .sefaz.comunicador import (
    ComunicadorSEFAZ,
    TransporteSimulado,
    TransporteReal,
    NS_NFE,
)


@dataclass
class ConfigNFe:
    """Configuração do provider (viria do cadastro da empresa no seu ERP)."""
    # backend: qual IMPLEMENTAÇÃO usar. É "o botão".
    #   "proprio" -> nosso provider (gera/assina/envia à SEFAZ)
    #   "focus"   -> delega para a API da Focus NFe (você só manda JSON)
    backend: str = "proprio"

    cnpj: str = "12345678000190"        # CNPJ da empresa (p/ Distribuição DFe)
    uf: str = "SP"
    ambiente: str = "2"                 # 1=produção, 2=homologação
    modo: str = "simulado"             # "simulado" | "real"  (só p/ backend "proprio")
    caminho_pfx: str = "certificado_teste.pfx"
    senha_pfx: str = "1234"
    autorizador: str | None = None      # ex.: "SVRS" se a UF usa o SVRS

    # --- específicos do backend "focus" ---
    focus_token: str = ""
    focus_url: str = "https://homologacao.focusnfe.com.br"  # produção: https://api.focusnfe.com.br


@dataclass
class ResultadoEmissao:
    autorizada: bool
    cstat: str
    xmotivo: str
    chave: str
    nprot: str | None = None
    pendente: bool = False               # True = ainda processando (assíncrono) -> o worker faz retry
    xml_assinado: bytes | None = None
    xml_autorizado: bytes | None = None  # nfeProc (NFe + protNFe) — o que se guarda
    erros_schema: list[str] = field(default_factory=list)


class NFeProvider:
    def __init__(self, config: ConfigNFe):
        self.config = config
        self.comunicador = ComunicadorSEFAZ(
            uf=config.uf,
            ambiente=config.ambiente,
            transporte=self._montar_transporte(),
            autorizador=config.autorizador,
        )

    # -- infraestrutura --------------------------------------------------- #
    def _montar_transporte(self):
        if self.config.modo == "real":
            return TransporteReal(self.config.caminho_pfx, self.config.senha_pfx)
        # modo simulado: garante um certificado de teste p/ a ASSINATURA existir
        if not Path(self.config.caminho_pfx).exists():
            gerar_certificado_teste(self.config.caminho_pfx, senha=self.config.senha_pfx)
        return TransporteSimulado()

    # -- API pública ------------------------------------------------------ #
    def status(self):
        """Pergunta à SEFAZ se o serviço está no ar (NFeStatusServico4)."""
        return self.comunicador.status_servico()

    def consultar_entradas(self, ult_nsu: int):
        """
        Baixa os documentos emitidos CONTRA o nosso CNPJ (compras/recebimento),
        via Distribuição DFe. Retorna uma RespostaDistribuicao (com o novo cursor
        `ult_nsu` e a lista de documentos). É o 'outro lado' da emissão.
        """
        return self.comunicador.distribuir_dfe(self.config.cnpj, ult_nsu)

    def manifestar_ciencia(self, chave: str):
        """Manifesta 'Ciência da Operação' (210210) sobre uma nota recebida."""
        return self.comunicador.manifestar(self.config.cnpj, chave, tp_evento="210210")

    def emitir(self, dados_venda: dict, ref: str | None = None) -> ResultadoEmissao:
        """Fluxo completo de emissão a partir dos dados de uma venda.

        `ref` (referência idempotente) é ignorado aqui — a idempotência do
        backend próprio é feita pelo ERP (via cNF/chave). O parâmetro existe só
        para a interface bater com o backend Focus, que usa `ref`.
        """
        # 1) gerar + 2) assinar
        xml, chave = gerar_nfe(dados_venda)
        xml_assinado = assinar_nfe(xml, self.config.caminho_pfx, self.config.senha_pfx, chave)

        # 3) validar contra o schema ANTES de mandar (evita rejeição à toa)
        valido, erros = validar_nfe(xml_assinado)
        if not valido:
            return ResultadoEmissao(
                autorizada=False, cstat="LOCAL", xmotivo="XML reprovado no schema (XSD)",
                chave=chave, xml_assinado=xml_assinado, erros_schema=erros,
            )

        # 4) enviar para a SEFAZ (autorização síncrona)
        resp = self.comunicador.autorizar(xml_assinado)

        # 5) se autorizada, anexar o protocolo -> XML AUTORIZADO (nfeProc)
        xml_autorizado = None
        if resp.autorizada:
            xml_autorizado = anexar_protocolo(xml_assinado, resp.prot_nfe_xml)

        return ResultadoEmissao(
            autorizada=resp.autorizada,
            cstat=resp.cstat,
            xmotivo=resp.xmotivo,
            chave=chave,
            nprot=resp.nprot,
            xml_assinado=xml_assinado,
            xml_autorizado=xml_autorizado,
        )


def anexar_protocolo(xml_nfe_assinada: bytes, prot_nfe_xml: bytes) -> bytes:
    """
    Monta o documento final <nfeProc> = <NFe assinada> + <protNFe>.
    É ESTE arquivo (o "XML autorizado") que tem valor fiscal e deve ser guardado.
    """
    proc = etree.Element(f"{{{NS_NFE}}}nfeProc", nsmap={None: NS_NFE})
    proc.set("versao", "4.00")
    proc.append(etree.fromstring(xml_nfe_assinada))  # <NFe>
    proc.append(etree.fromstring(prot_nfe_xml))       # <protNFe>
    return etree.tostring(proc, xml_declaration=True, encoding="UTF-8")
