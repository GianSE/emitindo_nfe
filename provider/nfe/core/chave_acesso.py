"""
Cálculo da CHAVE DE ACESSO da NFe (44 dígitos).

A chave não é um número aleatório: ela CODIFICA dados da nota. Isso permite
que qualquer sistema no Brasil identifique e valide uma NFe só pela chave.

Layout dos 44 dígitos (posição por posição):

    cUF   (2)  -> código IBGE da UF do emitente (ex.: 35 = SP, 33 = RJ)
    AAMM  (4)  -> ano (2 díg.) + mês (2 díg.) da emissão
    CNPJ  (14) -> CNPJ do emitente (só números)
    mod   (2)  -> modelo do documento (55 = NFe, 65 = NFCe)
    serie (3)  -> série da nota
    nNF   (9)  -> número da nota
    tpEmis(1)  -> tipo de emissão (1 = normal/online)
    cNF   (8)  -> código numérico ALEATÓRIO (evita adivinhar a chave)
    cDV   (1)  -> dígito verificador (módulo 11) dos 43 dígitos anteriores
"""

import random


def calcular_dv(chave43: str) -> str:
    """
    Dígito verificador por MÓDULO 11.

    Regra oficial:
      1. Pesos 2,3,4,...,9 aplicados da DIREITA para a ESQUERDA, ciclando.
      2. Soma dos (dígito * peso).
      3. resto = soma % 11.
      4. dv = 11 - resto. Se dv for 10 ou 11, dv = 0.
    """
    if len(chave43) != 43 or not chave43.isdigit():
        raise ValueError("A base da chave deve ter exatamente 43 dígitos numéricos.")

    peso = 2
    soma = 0
    # percorre da direita para a esquerda
    for digito in reversed(chave43):
        soma += int(digito) * peso
        peso = 2 if peso == 9 else peso + 1  # cicla 2..9

    resto = soma % 11
    dv = 11 - resto
    if dv >= 10:
        dv = 0
    return str(dv)


def gerar_codigo_numerico() -> str:
    """cNF: 8 dígitos aleatórios. (Não pode ser igual ao nNF.)"""
    return f"{random.randint(0, 99999999):08d}"


def montar_chave(
    cUF: str,
    ano: int,
    mes: int,
    cnpj: str,
    modelo: str,
    serie: str,
    numero_nf: str,
    tp_emis: str,
    codigo_numerico: str,
) -> str:
    """
    Monta a chave de 44 dígitos já com o DV no final.
    Retorna a string dos 44 números (sem o prefixo 'NFe').
    """
    aamm = f"{ano % 100:02d}{mes:02d}"
    base43 = (
        f"{int(cUF):02d}"
        f"{aamm}"
        f"{int(cnpj):014d}"
        f"{int(modelo):02d}"
        f"{int(serie):03d}"
        f"{int(numero_nf):09d}"
        f"{int(tp_emis):01d}"
        f"{int(codigo_numerico):08d}"
    )
    dv = calcular_dv(base43)
    return base43 + dv


def formatar_chave(chave44: str) -> str:
    """Formata a chave em blocos de 4 para leitura humana."""
    return " ".join(chave44[i : i + 4] for i in range(0, 44, 4))


if __name__ == "__main__":
    # Teste rápido do módulo
    cnf = "45678901"
    chave = montar_chave("35", 2026, 7, "12345678000190", "55", "1", "123", "1", cnf)
    print("Chave (44):", chave)
    print("Formatada :", formatar_chave(chave))
    print("DV         :", chave[-1])
