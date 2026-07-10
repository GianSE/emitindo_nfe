"""
SIMULAÇÃO COMPLETA de emissão de NFe — do zero ao XML assinado.

Roda o fluxo inteiro na sua máquina, SEM enviar para a SEFAZ:

    dados da venda  ->  monta XML  ->  calcula chave  ->  assina  ->  salva

Execute:  python main.py
"""

import sys
from pathlib import Path
from lxml import etree

# O console do Windows costuma usar cp1252; forçamos UTF-8 para os acentos saírem certos.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from provider.nfe.certificado import gerar_certificado_teste
from provider.nfe.gerar_xml import gerar_nfe
from provider.nfe.assinar import assinar_nfe
from provider.nfe.verificar import verificar_nfe
from provider.nfe.validar import validar_nfe
from provider.nfe.danfe import gerar_danfe
from provider.nfe.chave_acesso import formatar_chave
from provider.nfe.dados_exemplo import DADOS

SENHA_PFX = "1234"
PFX = "certificado_teste.pfx"
SAIDA = Path("saida")


def separador(titulo: str):
    print("\n" + "=" * 68)
    print(f"  {titulo}")
    print("=" * 68)


def main():
    SAIDA.mkdir(exist_ok=True)

    # -----------------------------------------------------------------
    separador("PASSO 1/6  —  Certificado digital (A1 de teste)")
    if not Path(PFX).exists():
        gerar_certificado_teste(PFX, senha=SENHA_PFX,
                                cnpj=DADOS["emit"]["CNPJ"],
                                razao_social=DADOS["emit"]["xNome"])
        print(f"Certificado de teste criado: {PFX}  (senha: {SENHA_PFX})")
    else:
        print(f"Usando certificado existente: {PFX}")
    print("Num cenário real, aqui você carregaria SEU e-CNPJ A1 (.pfx).")

    # -----------------------------------------------------------------
    separador("PASSO 2/6  —  Montando o XML da NFe (layout 4.00)")
    xml_bytes, chave = gerar_nfe(DADOS)
    print(f"Emitente : {DADOS['emit']['xNome']}  (CNPJ {DADOS['emit']['CNPJ']})")
    print(f"Ambiente : {'HOMOLOGACAO (teste)' if DADOS['ide']['tpAmb'] == '2' else 'PRODUCAO'}")
    print(f"Itens    : {len(DADOS['itens'])}")
    print(f"\nCHAVE DE ACESSO (44 dígitos):")
    print(f"   {formatar_chave(chave)}")
    print(f"   DV (último dígito, módulo 11): {chave[-1]}")

    caminho_sem_assinatura = SAIDA / "nfe_sem_assinatura.xml"
    caminho_sem_assinatura.write_bytes(
        etree.tostring(etree.fromstring(xml_bytes), pretty_print=True,
                       xml_declaration=True, encoding="UTF-8")
    )
    print(f"\nXML (sem assinatura) salvo em: {caminho_sem_assinatura}")

    # -----------------------------------------------------------------
    separador("PASSO 3/6  —  Assinando digitalmente (XML-DSig / RSA-SHA1)")
    xml_assinado = assinar_nfe(xml_bytes, PFX, SENHA_PFX, chave)
    print("Assinatura ENVELOPED inserida dentro de <NFe>.")
    print("Algoritmos: DigestMethod=SHA-1, SignatureMethod=RSA-SHA1 (exigência SEFAZ).")

    # Mostra um trechinho da assinatura para o aluno ver
    arv = etree.fromstring(xml_assinado)
    sig = arv.find(".//{http://www.w3.org/2000/09/xmldsig#}Signature")
    digest = sig.find(".//{http://www.w3.org/2000/09/xmldsig#}DigestValue")
    print(f"DigestValue (hash do infNFe): {digest.text[:32]}...")

    caminho_assinado = SAIDA / "nfe_assinada.xml"
    caminho_assinado.write_bytes(
        etree.tostring(arv, pretty_print=True, xml_declaration=True, encoding="UTF-8")
    )
    print(f"XML ASSINADO salvo em: {caminho_assinado}")

    # Prova de que a assinatura é válida (é o que a SEFAZ faria ao receber).
    verificar_nfe(xml_assinado)
    print("✔ Assinatura VERIFICADA: o hash confere e bate com o certificado.")

    # -----------------------------------------------------------------
    separador("PASSO 4/6  —  Validando contra o schema oficial (XSD)")
    print("É a 1ª coisa que a SEFAZ faz: conferir a ESTRUTURA contra o nfe_v4.00.xsd.")
    valido, erros = validar_nfe(xml_assinado)
    if valido:
        print("✔ XML VÁLIDO segundo o schema oficial da SEFAZ (nfe_v4.00.xsd).")
    else:
        print("✘ XML REJEITADO pelo schema. Motivos:")
        for erro in erros:
            print("   -", erro)

    # -----------------------------------------------------------------
    separador("PASSO 5/6  —  Gerando o DANFE (PDF)")
    print("O DANFE é a REPRESENTAÇÃO visual do XML (não tem valor fiscal por si só).")
    caminho_danfe = SAIDA / "danfe.pdf"
    gerar_danfe(xml_assinado, str(caminho_danfe))
    print(f"DANFE gerado em: {caminho_danfe}")
    print("Traz o código de barras (Code-128) da chave de acesso p/ consulta na SEFAZ.")

    # -----------------------------------------------------------------
    separador("PASSO 6/6  —  O que aconteceria a seguir (SEFAZ)")
    print("""\
  Já temos um XML assinado E aprovado na validação de ESTRUTURA (o mesmo XSD que
  a SEFAZ usa). Num sistema real, os próximos passos seriam:

    1. Enviar o XML ao webservice NFeAutorizacao4 do seu estado
       (SOAP sobre HTTPS, o certificado autentica a conexão).
    2. A SEFAZ revalida o schema E aplica as REGRAS DE NEGÓCIO (cadastro do
       emitente, situação do destinatário, cálculo dos impostos...).
    3. Devolve um PROTOCOLO com status '100 - Autorizado o uso da NF-e'.
    4. Você anexa o protocolo ao XML  ->  XML AUTORIZADO.
    5. Regera o DANFE já com o nº do protocolo e guarda o XML por 5 anos.

  (O DANFE que geramos no passo 5 é uma PRÉVIA — sem protocolo, marcado como
   'SEM VALOR FISCAL'. Passe protocolo=... para gerar_danfe() quando tiver o real.)

  Para fazer isso de verdade, use PyNFe ou erpbrasil.edoc (não faça o SOAP na mão)
  e um certificado A1 ICP-Brasil real. Veja o README, seção 8.
""")

    separador("CONCLUÍDO")
    print(f"Abra os arquivos em '{SAIDA}\\' e compare com o README para estudar cada campo.")


if __name__ == "__main__":
    main()
