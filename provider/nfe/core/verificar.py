"""
Verificação da assinatura digital — o "outro lado" do processo.

É basicamente o que a SEFAZ faz ao receber a nota: recalcula o hash do infNFe,
confere com o DigestValue, e checa se o SignatureValue bate com a chave pública
do certificado embutido. Se qualquer byte do infNFe tivesse sido adulterado
depois de assinado, esta verificação FALHARIA.
"""

import textwrap
from lxml import etree
from signxml import XMLVerifier, SignatureConfiguration
from signxml.algorithms import DigestAlgorithm, SignatureMethod

DSIG = "http://www.w3.org/2000/09/xmldsig#"


class VerificadorNFe(XMLVerifier):
    """Permite SHA-1 porque a NFe usa SHA-1 (ver nota em assinar.py)."""

    def check_deprecated_methods(self):
        return


def verificar_nfe(xml_assinado: bytes) -> bool:
    """
    Verifica a assinatura usando o certificado embutido no próprio XML.
    Retorna True se válida; levanta exceção se inválida.
    """
    raiz = etree.fromstring(xml_assinado)

    # Extrai o certificado público que está dentro do <X509Certificate> e o
    # formata como PEM (quebrando a base64 em linhas de 64 colunas).
    b64 = raiz.find(f".//{{{DSIG}}}X509Certificate").text
    cert_pem = (
        "-----BEGIN CERTIFICATE-----\n"
        + "\n".join(textwrap.wrap(b64, 64))
        + "\n-----END CERTIFICATE-----\n"
    )

    # Diz ao verificador que ESPERAMOS RSA-SHA1/SHA-1 e exatamente 1 referência.
    config = SignatureConfiguration(
        signature_methods=frozenset({SignatureMethod.RSA_SHA1}),
        digest_algorithms=frozenset({DigestAlgorithm.SHA1}),
        expect_references=1,
    )

    VerificadorNFe().verify(
        raiz,
        x509_cert=cert_pem,
        expect_config=config,
        id_attribute="Id",
    )
    return True
