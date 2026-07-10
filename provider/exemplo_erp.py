"""
EXEMPLO: como o SEU ERP usaria o provider de NFe.

Repare que este arquivo — que representa o seu sistema — NÃO importa nada de
XML, assinatura, XSD ou SOAP. Ele só conhece o provider e os dados da venda.
É essa separação que te permite, amanhã, trocar o provider (ou o transporte
simulado pelo real) sem mexer no ERP.

Execute:  python exemplo_erp.py
"""

import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from provider.nfe.provider import NFeProvider, ConfigNFe
from provider.nfe.danfe import gerar_danfe
from provider.nfe.dados_exemplo import DADOS  # no seu ERP, isso viria do banco de dados

SAIDA = Path("saida")


def main():
    SAIDA.mkdir(exist_ok=True)

    # -----------------------------------------------------------------
    # Configuração (no ERP, viria do cadastro da empresa emitente).
    # modo="simulado" -> funciona SEM certificado. Troque para "real"
    # (e informe caminho_pfx/senha_pfx) quando tiver o A1 ICP-Brasil.
    # -----------------------------------------------------------------
    config = ConfigNFe(uf="SP", ambiente="2", modo="simulado")
    provider = NFeProvider(config)

    print("=== 1) A SEFAZ está no ar? (NFeStatusServico4) ===")
    status = provider.status()
    print(f"   cStat {status.cstat} - {status.xmotivo}")
    if not status.em_operacao:
        print("   SEFAZ fora do ar; abortaria a emissão.")
        return

    print("\n=== 2) Emitindo a nota a partir dos dados da venda ===")
    resultado = provider.emitir(DADOS)
    print(f"   Chave : {resultado.chave}")
    print(f"   Status: cStat {resultado.cstat} - {resultado.xmotivo}")

    if not resultado.autorizada:
        print("   ✘ NÃO autorizada.")
        for e in resultado.erros_schema:
            print("     -", e)
        return

    print(f"   ✔ AUTORIZADA! Protocolo nº {resultado.nprot}")

    # -----------------------------------------------------------------
    # 3) Guardar o XML AUTORIZADO (nfeProc) — é ele que tem valor fiscal.
    # -----------------------------------------------------------------
    caminho_xml = SAIDA / "nfe_autorizada.xml"
    caminho_xml.write_bytes(resultado.xml_autorizado)
    print(f"\n=== 3) XML autorizado salvo em: {caminho_xml} ===")

    # -----------------------------------------------------------------
    # 4) Gerar o DANFE definitivo (já com o nº do protocolo).
    # -----------------------------------------------------------------
    caminho_pdf = SAIDA / "danfe_autorizada.pdf"
    gerar_danfe(resultado.xml_autorizado, str(caminho_pdf))
    print(f"=== 4) DANFE gerado em: {caminho_pdf} ===")

    print("\nPronto. No modo 'simulado' o protocolo é fictício; no modo 'real'")
    print("este seria o número oficial de autorização da SEFAZ.")


if __name__ == "__main__":
    main()
