"""
Certificado digital de TESTE (A1 autoassinado).

Um certificado A1 real é um arquivo .pfx (também chamado .p12) que contém:
  - a CHAVE PRIVADA (secreta, usada para assinar)
  - o CERTIFICADO (público, com os dados da empresa e a chave pública)

A SEFAZ real só aceita certificados emitidos pela cadeia ICP-Brasil.
Aqui geramos um AUTOASSINADO só para você ver a MECÂNICA da assinatura.
A estrutura do .pfx e a forma de carregá-lo são idênticas às de um certificado real.
"""

import datetime
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID


def gerar_certificado_teste(
    caminho_pfx: str,
    senha: str = "1234",
    cnpj: str = "12345678000190",
    razao_social: str = "EMPRESA TESTE LTDA",
) -> str:
    """
    Gera um par de chaves RSA + certificado X.509 autoassinado e salva em .pfx.
    Retorna o caminho do arquivo gerado.
    """
    # 1) Gera a chave privada RSA de 2048 bits (padrão dos certificados e-CNPJ)
    chave_privada = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # 2) Monta o "sujeito"/"emissor" do certificado.
    #    Em certificados ICP-Brasil o CN costuma ser "RAZAO SOCIAL:CNPJ".
    nome = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "BR"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "ICP-Brasil (TESTE)"),
            x509.NameAttribute(NameOID.COMMON_NAME, f"{razao_social}:{cnpj}"),
        ]
    )

    agora = datetime.datetime.now(datetime.timezone.utc)
    certificado = (
        x509.CertificateBuilder()
        .subject_name(nome)
        .issuer_name(nome)  # autoassinado: emissor == sujeito
        .public_key(chave_privada.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(agora)
        .not_valid_after(agora + datetime.timedelta(days=365))  # validade 1 ano (como o A1)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(chave_privada, hashes.SHA256())
    )

    # 3) Empacota chave + certificado num .pfx protegido por senha
    pfx_bytes = pkcs12.serialize_key_and_certificates(
        name=razao_social.encode(),
        key=chave_privada,
        cert=certificado,
        cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(senha.encode()),
    )

    Path(caminho_pfx).write_bytes(pfx_bytes)
    return caminho_pfx


def carregar_pfx(caminho_pfx: str, senha: str):
    """
    Carrega um .pfx e retorna (chave_privada, certificado).
    É EXATAMENTE assim que você carregaria seu certificado A1 real.
    """
    dados = Path(caminho_pfx).read_bytes()
    chave, cert, _cadeia = pkcs12.load_key_and_certificates(dados, senha.encode())
    return chave, cert


if __name__ == "__main__":
    caminho = gerar_certificado_teste("certificado_teste.pfx")
    print(f"Certificado de teste gerado em: {caminho}")
    chave, cert = carregar_pfx(caminho, "1234")
    print("Titular:", cert.subject.rfc4514_string())
    print("Válido de:", cert.not_valid_before_utc, "até", cert.not_valid_after_utc)
