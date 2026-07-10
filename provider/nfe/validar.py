"""
Validação do XML contra os SCHEMAS OFICIAIS (XSD) da SEFAZ.

Esta é a PRIMEIRA coisa que a SEFAZ faz ao receber uma nota: conferir se o XML
respeita a estrutura definida nos schemas. Se um campo obrigatório falta, tem
tamanho errado ou valor fora do domínio, a nota é REJEITADA antes mesmo de
qualquer regra de negócio.

Fazer essa validação LOCALMENTE (antes de enviar) é a melhor forma de aprender
o layout e de evitar rejeições. As mensagens de erro do lxml apontam exatamente
qual elemento violou qual regra do XSD.

Os XSDs oficiais vêm empacotados na biblioteca `nfelib`. O schema de entrada
para uma NFe avulsa (modelo 55, versão 4.00) é o `nfe_v4.00.xsd`, que define o
elemento raiz <NFe> — incluindo a <Signature>. Ele importa, por caminhos
relativos, os demais (leiauteNFe, tiposBasico, xmldsig...).
"""

from pathlib import Path
import nfelib
from lxml import etree

# Pasta onde a nfelib guarda os schemas da NFe 4.00
SCHEMA_DIR = Path(nfelib.__file__).parent / "nfe" / "schemas" / "v4_0"
SCHEMA_NFE = SCHEMA_DIR / "nfe_v4.00.xsd"


def _carregar_schema() -> etree.XMLSchema:
    # Passamos base_url para o lxml resolver os <xs:import>/<xs:include> relativos.
    doc = etree.parse(str(SCHEMA_NFE))
    return etree.XMLSchema(doc)


def validar_nfe(xml_bytes: bytes) -> tuple[bool, list[str]]:
    """
    Valida o XML contra o nfe_v4.00.xsd.
    Retorna (valido, lista_de_erros). Se válido, a lista vem vazia.
    """
    schema = _carregar_schema()
    doc = etree.fromstring(xml_bytes)
    valido = schema.validate(doc)

    erros = []
    if not valido:
        for e in schema.error_log:
            # e.path aponta o caminho do elemento; e.message explica a violação
            erros.append(f"linha {e.line}: {e.message}")
    return valido, erros


if __name__ == "__main__":
    dados = Path("saida/nfe_assinada.xml").read_bytes()
    ok, erros = validar_nfe(dados)
    print("VÁLIDO!" if ok else "INVÁLIDO:")
    for erro in erros:
        print("  -", erro)
