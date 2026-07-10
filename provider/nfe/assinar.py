"""
Assinatura digital do XML da NFe (padrão XML-DSig).

A SEFAZ exige uma assinatura ENVELOPED (a tag <Signature> fica DENTRO do <NFe>,
logo após o <infNFe>) com estas características, definidas no Manual da NFe:

  - Reference URI = "#NFe<chave>"  -> aponta para o Id do infNFe
  - Transforms: enveloped-signature + canonicalização C14N
  - DigestMethod   = SHA-1
  - SignatureMethod = RSA-SHA1
  - KeyInfo com o X509Certificate (certificado público do emitente)

Usamos a biblioteca `signxml`, que implementa o padrão. Repare que passamos
SHA-1 explicitamente — o default da signxml é SHA-256, que a SEFAZ NÃO aceita.
"""

from lxml import etree
from signxml import XMLSigner, methods

from .certificado import carregar_pfx

NS = "http://www.portalfiscal.inf.br/nfe"


class AssinadorNFe(XMLSigner):
    """
    O signxml 5.x bloqueia SHA-1 por padrão (com razão: SHA-1 é inseguro).
    Mas o Manual de Orientação da NFe AINDA exige SHA-1/RSA-SHA1. Como não
    escolhemos o algoritmo — a SEFAZ é que impõe — sobrescrevemos a checagem.
    (Fora do universo NFe, NUNCA use SHA-1.)
    """

    def check_deprecated_methods(self):
        return  # permitido apenas porque a NFe exige


def assinar_nfe(xml_bytes: bytes, caminho_pfx: str, senha: str, chave: str) -> bytes:
    """
    Assina o XML da NFe e devolve o XML assinado (bytes), com a <Signature>
    inserida dentro do elemento <NFe>.
    """
    # 1) Carrega chave privada + certificado do .pfx
    chave_privada, certificado = carregar_pfx(caminho_pfx, senha)

    # Converte para os formatos PEM que a signxml espera
    from cryptography.hazmat.primitives import serialization

    key_pem = chave_privada.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    cert_pem = certificado.public_bytes(serialization.Encoding.PEM)

    # 2) Parse do XML. Assinamos a RAIZ <NFe> inteira (não o infNFe isolado):
    #    no método "enveloped" o signxml insere a <Signature> como ÚLTIMO filho
    #    do elemento assinado. Assinando <NFe>, a <Signature> nasce já no lugar
    #    certo — como irmã do <infNFe> — que é exatamente o layout da NFe.
    #    (Assinar o infNFe e depois mover a tag na mão quebra a canonicalização:
    #     o lxml redeclara namespaces e a assinatura fica inválida.)
    raiz = etree.fromstring(xml_bytes)  # <NFe>

    # 3) Configura o assinador com os algoritmos EXIGIDOS pela SEFAZ
    signer = AssinadorNFe(
        method=methods.enveloped,
        signature_algorithm="rsa-sha1",
        digest_algorithm="sha1",
        c14n_algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    )

    # 4) Assina. reference_uri="NFe<chave>" faz a <Reference> apontar para o
    #    Id do infNFe (URI "#NFe<chave>"). O signxml então:
    #      - calcula o hash SHA-1 do infNFe          -> <DigestValue>
    #      - canonicaliza e cifra o <SignedInfo>      -> <SignatureValue>
    #      - embute o certificado público            -> <X509Certificate>
    assinado = signer.sign(
        raiz,
        key=key_pem,
        cert=cert_pem,
        reference_uri=f"NFe{chave}",
        id_attribute="Id",
    )

    return etree.tostring(assinado, xml_declaration=True, encoding="UTF-8")


if __name__ == "__main__":
    print("Use via main.py — este módulo expõe assinar_nfe().")
