# Emitindo NFe — Projeto Educacional

Um projeto **passo a passo** para aprender como uma NFe (Nota Fiscal eletrônica)
é realmente construída, assinada e enviada — a peça mais complexa de qualquer ERP
brasileiro.

Aqui a gente **simula** a emissão: gera o XML completo no layout oficial 4.00,
calcula a chave de acesso de 44 dígitos, assina digitalmente com um certificado
de teste e valida a estrutura — **sem enviar nada para a SEFAZ**. Quando você
entender isso, conectar no ambiente de homologação é o passo final e fácil.

---

## 1. O que é uma NFe (na prática)

Uma NFe **não é um PDF**. Ela é um **arquivo XML** com uma estrutura rígida,
definido por schemas oficiais (XSD) publicados pela SEFAZ no
[Portal da Nota Fiscal eletrônica](https://www.nfe.fazenda.gov.br).

O PDF bonitinho que a gente vê (com código de barras) é o **DANFE**
(Documento Auxiliar da NFe) — é só uma *representação* do XML para humanos.
O que tem valor fiscal é o XML autorizado pela SEFAZ.

Cada NFe tem uma **chave de acesso de 44 dígitos** que a identifica de forma
única no Brasil inteiro. É aquele número gigante embaixo do código de barras.

Modelos:
- **55 (NFe)** — nota "normal", entre empresas, transporte de mercadoria. É a que fazemos aqui.
- **65 (NFCe)** — Nota Fiscal de Consumidor eletrônica (o "cupom fiscal" do varejo).

---

## 2. O fluxo completo de emissão

```
  ┌──────────────┐   1. monta    ┌──────────────┐   2. assina   ┌──────────────┐
  │  Dados da    │ ────────────▶ │   XML da     │ ────────────▶ │  XML         │
  │  venda (ERP) │               │   NFe (4.00) │  (certificado)│  ASSINADO    │
  └──────────────┘               └──────────────┘               └──────┬───────┘
                                                                        │ 3. envia (SOAP/HTTPS)
                                                                        ▼
  ┌──────────────┐   6. guarda   ┌──────────────┐   4. valida   ┌──────────────┐
  │  DANFE (PDF) │ ◀──────────── │  XML +       │ ◀──────────── │    SEFAZ     │
  │  p/ o cliente│  autorizado   │  PROTOCOLO   │  5. autoriza  │  (webservice)│
  └──────────────┘               └──────────────┘               └──────────────┘
```

1. **Montar o XML** a partir dos dados da venda (emitente, destinatário, produtos, impostos).
2. **Assinar digitalmente** o XML com o certificado da empresa (e-CNPJ). Sem assinatura a SEFAZ rejeita.
3. **Enviar** para o webservice da SEFAZ do estado do emitente (protocolo SOAP sobre HTTPS, com o certificado autenticando a conexão).
4. A SEFAZ **valida** contra os schemas + centenas de regras de negócio.
5. Se tudo ok, ela devolve um **protocolo de autorização** com o status `100 - Autorizado o uso da NF-e`.
6. Você anexa o protocolo ao XML → esse é o **XML autorizado**. Dele você gera o DANFE (PDF) e guarda o XML por 5 anos.

Existem **dois ambientes**:
- **Homologação (tpAmb=2)** — ambiente de testes. As notas NÃO têm valor fiscal. É onde você aprende e testa.
- **Produção (tpAmb=1)** — vale de verdade, gera obrigação fiscal.

> ⚠️ Em homologação, a lei exige que o primeiro item tenha a descrição:
> `NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL`.

---

## 3. A estrutura do XML (os grandes blocos)

O XML raiz é `<NFe>` e dentro dele o `<infNFe>` com os grupos:

| Grupo        | O que é                                                              |
|--------------|---------------------------------------------------------------------|
| `ide`        | Identificação da nota: número, série, data, natureza da operação, chave |
| `emit`       | Emitente — quem emite (sua empresa): CNPJ, endereço, regime tributário |
| `dest`       | Destinatário — para quem vai (cliente): CNPJ/CPF, endereço          |
| `det` (1..N) | Detalhe de cada item: `prod` (produto) + `imposto` (ICMS, PIS, COFINS) |
| `total`      | Totais da nota (soma dos produtos, impostos, valor total)           |
| `transp`     | Transporte / frete                                                  |
| `pag`        | Formas de pagamento                                                 |
| `infAdic`    | Informações adicionais (observações)                                |

Depois do `infNFe` vem o `<Signature>` — a assinatura digital (padrão XML-DSig).

Veja [`nfe/gerar_xml.py`](nfe/gerar_xml.py) — cada linha é comentada explicando o campo.

---

## 4. A chave de acesso (44 dígitos)

Não é aleatória: ela **codifica** informações da nota. Da esquerda p/ direita:

```
 35   2607   12345678000190   55   001   000000123   1   45678901   9
 cUF  AAMM   CNPJ do emit.    mod  série  número     tpE  cNF(aleat) DV
 (2)  (4)    (14)             (2)  (3)    (9)        (1)  (8)        (1)
```

O último dígito (**DV**) é um dígito verificador calculado por **módulo 11** sobre
os 43 primeiros. Veja [`nfe/chave_acesso.py`](nfe/chave_acesso.py).

---

## 5. Certificado digital e assinatura

A SEFAZ precisa ter certeza de que foi *você* que emitiu. Isso é feito com um
**certificado digital ICP-Brasil**:

- **A1** — um arquivo `.pfx`/`.p12` (chave + certificado) que fica no computador. Validade 1 ano. É o mais usado em ERPs/servidores.
- **A3** — fica num token/smartcard/HSM (hardware). Mais chato de automatizar.

A assinatura usa o padrão **XML-DSig** (assinatura *enveloped*). A NFe exige:
- `DigestMethod`: **SHA-1**  (sim, ainda SHA-1 por definição do MOC da NFe)
- `SignatureMethod`: **RSA-SHA1**
- Canonicalização C14N
- A `Reference URI` aponta para o `Id` do `infNFe` (`#NFe<chave>`)

Aqui geramos um certificado **autoassinado de teste** só para você ver a assinatura
funcionando ([`nfe/certificado.py`](nfe/certificado.py)). A SEFAZ real **rejeitaria**
esse certificado (não é ICP-Brasil), mas para aprender a *mecânica* da assinatura é perfeito.

---

## 6. Bibliotecas do mundo real

Você **não** vai montar o XML na mão num ERP de produção. Use bibliotecas maduras:

### Python
- **[nfelib](https://github.com/akretion/nfelib)** — classes Python geradas a partir dos XSDs oficiais. Você preenche objetos e ela serializa o XML validado. Excelente para aprender a estrutura.
- **[PyNFe](https://github.com/TadaSoftware/PyNFe)** — biblioteca mais "alto nível": monta, assina e comunica com a SEFAZ.
- **[erpbrasil.edoc](https://github.com/erpbrasil/erpbrasil.edoc)** — camada de comunicação com os webservices.

### Outras linguagens (referência)
- **PHP**: [`nfephp-org/sped-nfe`](https://github.com/nfephp-org/sped-nfe) — o padrão de mercado no Brasil, muito completo.
- **.NET**: [`Zeus Nfe`](https://github.com/adeniltonbs/Zeus.Net.NFe.Nota) / DFe.NET.

### Serviços (API pronta, se não quiser lidar com certificado/SEFAZ)
- Focus NFe, PlugNotas, WebmaniaBR, eNotas — você manda um JSON e eles cuidam do XML+SEFAZ. Bom para produção rápida, ruim para *aprender* o que acontece por baixo.

---

## 7. Como rodar este projeto

```bash
# 1. Criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate      # Windows (PowerShell: .venv\Scripts\Activate.ps1)

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Rodar a simulação completa
python main.py
```

O `main.py` vai:
1. Gerar um certificado de teste (`certificado_teste.pfx`).
2. Montar o XML da NFe a partir dos dados de exemplo e calcular a chave de acesso.
3. Assinar o XML e **verificar** a assinatura.
4. **Validar o XML contra o schema oficial (XSD)** — o mesmo que a SEFAZ usa.
5. **Gerar o DANFE em PDF** (`saida/danfe.pdf`) com o código de barras da chave.
6. Salvar tudo em `saida/` e mostrar cada etapa explicada no terminal.

### 7.1. Validação contra os schemas oficiais (XSD)

Antes de enviar qualquer coisa à SEFAZ, o passo mais valioso para aprender (e para
evitar rejeições) é validar o XML contra os **schemas oficiais** — os arquivos `.xsd`
que definem, campo a campo, o que é obrigatório, os tamanhos e os domínios de valores.

Este projeto usa os XSDs que vêm empacotados na biblioteca **nfelib**
(`nfelib/nfe/schemas/v4_0/nfe_v4.00.xsd`). Veja [`nfe/validar.py`](nfe/validar.py).

A validação é **exatamente a 1ª verificação que a SEFAZ faz**. Exemplos reais de
mensagens que você verá ao quebrar o XML de propósito:

| O que você quebra                     | Mensagem do validador                                        |
|---------------------------------------|-------------------------------------------------------------|
| Remove a `<Signature>`                | `Missing child element(s). Expected is ... Signature`       |
| Põe um NCM inválido (`123`)           | `[facet 'pattern'] '123' is not accepted by ... [0-9]{2}|[0-9]{8}` |

É assim que você decifra os códigos de "Rejeição" da SEFAZ. Rode você mesmo:

```bash
python -m nfe.validar        # valida saida/nfe_assinada.xml
```

### 7.2. DANFE em PDF

O **DANFE** (Documento Auxiliar da NFe) é a representação visual do XML — é o
"papel" que acompanha a mercadoria e que o cliente recebe. **Ele não tem valor
fiscal por si só**: o que vale é o XML autorizado. Todo dado do DANFE é *lido* do XML.

O elemento essencial é o **código de barras (Code-128C)** da chave de acesso, por
onde se consulta a autenticidade da nota no portal da SEFAZ.

Este projeto gera um DANFE simplificado (mas fiel) com **reportlab** — veja
[`nfe/danfe.py`](nfe/danfe.py). Rode:

```bash
python -m nfe.danfe          # gera saida/danfe.pdf a partir de saida/nfe_assinada.xml
```

Como ainda não enviamos à SEFAZ, o DANFE sai marcado como
`SEM VALOR FISCAL` (homologação). Quando você tiver o protocolo real de autorização,
basta passá-lo para `gerar_danfe(xml, pdf, protocolo={"nProt": "...", "dhRecbto": "..."})`.

---

## 7.3. Arquitetura de "provider" (para plugar no seu ERP)

O jeito profissional de organizar isso num ERP é separar **duas responsabilidades**:

| Camada | Sabe sobre... | Arquivo |
|--------|---------------|---------|
| **Seu ERP** | pedido, cliente, produto, estoque | [`exemplo_erp.py`](exemplo_erp.py) |
| **Provider de NFe** | XML, assinatura, XSD, SEFAZ, DANFE | [`nfe/provider.py`](nfe/provider.py) |

O ERP só faz isto — sem conhecer XML, certificado ou SOAP:

```python
from nfe.provider import NFeProvider, ConfigNFe

provider = NFeProvider(ConfigNFe(uf="SP", ambiente="2", modo="simulado"))

if provider.status().em_operacao:              # SEFAZ está no ar?
    r = provider.emitir(dados_da_venda)        # gera+assina+valida+envia+protocola
    if r.autorizada:
        salvar(r.xml_autorizado)               # nfeProc — guardar 5 anos
        gerar_danfe(r.xml_autorizado, "danfe.pdf")
```

### O truque do "transporte" plugável

A comunicação com a SEFAZ ([`nfe/sefaz.py`](nfe/sefaz.py)) usa um **transporte**
que você troca sem mexer no resto:

- **`TransporteSimulado`** — não fala com a SEFAZ; devolve respostas no mesmo
  formato dela (status `107 - Serviço em Operação`, autorização `100 - Autorizado`).
  **Funciona hoje, sem certificado nem credenciamento.** É o padrão.
- **`TransporteReal`** — fala HTTPS de verdade, autenticando com o certificado A1.
  Só troque `modo="real"` na config quando tiver o certificado e o credenciamento.

```bash
python exemplo_erp.py    # roda o fluxo do ERP em modo simulado (status -> emitir -> DANFE)
```

Isso gera `saida/nfe_autorizada.xml` (o **nfeProc**: NFe + protocolo, validado contra
o `procNFe_v4.00.xsd`) e `saida/danfe_autorizada.pdf` (já com o nº do protocolo).

> É o mesmo padrão dos gateways de pagamento: uma interface, várias implementações.
> No modo simulado o protocolo é fictício; no real, é o número oficial da SEFAZ.

---

## 8. Próximos passos (quando quiser emitir de verdade)

A mecânica toda já está montada (gerar → assinar → validar → **enviar** → protocolar →
DANFE), rodando no `TransporteSimulado`. Para ligar no mundo real:

1. Adquirir um **certificado A1 e-CNPJ** (Serasa, Certisign, Valid… ~R$ 150/ano).
2. Fazer o **credenciamento** da empresa na SEFAZ do seu estado (homologação).
3. Na config, trocar `modo="simulado"` por `modo="real"` e apontar `caminho_pfx`/`senha_pfx`
   para o seu `.pfx`. O `TransporteReal` já está implementado em [`nfe/sefaz.py`](nfe/sefaz.py).
4. Ajustar/checar as **URLs** dos webservices do seu autorizador em `URLS` (algumas UFs
   usam o SVRS/SVAN). Lista oficial em [nfe.fazenda.gov.br](https://www.nfe.fazenda.gov.br).
5. Conferir a **cadeia de certificados ICP-Brasil** (`verify` do requests) para o TLS.

> Em produção séria, muitos preferem `erpbrasil.edoc` ou `PyNFe` no lugar do SOAP
> manual — mas ter feito na mão (como aqui) é o que te faz **entender** o que elas fazem.

### Ainda faltam (bons próximos exercícios)

- **Autorização assíncrona**: quando `indSinc=0`, a SEFAZ devolve um *recibo* e você
  consulta o resultado depois com `NFeRetAutorizacao4`.
- **Eventos**: **cancelamento**, **carta de correção (CCe)** e **inutilização** de numeração
  (mesma pegada: montar XML do evento → assinar → enviar → protocolar).
- **Contingência** (SVC) quando a SEFAZ do estado está fora do ar.
- **Controle de numeração** sequencial (série/nNF) no banco do ERP.

---

## Aviso legal

Projeto **exclusivamente educacional**. O certificado gerado aqui é autoassinado e
não tem validade jurídica. Nenhuma nota gerada aqui tem valor fiscal.
