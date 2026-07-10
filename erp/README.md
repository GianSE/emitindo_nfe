# ERP desacoplado por eventos (outbox + workers)

Esta pasta é o **núcleo do ERP**: recebe vendas e orquestra a emissão fiscal de
forma **assíncrona e desacoplada**, usando o Postgres como fila (padrão *outbox*)
e eventos de domínio para o *fan-out* (estoque, financeiro…).

O ERP **não conhece** XML/SEFAZ/certificado — isso é responsabilidade do
[`../provider`](../provider). O worker de emissão é quem chama o provider.

## Arquitetura

```
  VENDAS (saída)                                   COMPRAS (entrada)
  ──────────────                                   ─────────────────
  app_erp (API/CLI)                                worker_recebimento
     │ BEGIN;INSERT venda;INSERT outbox;COMMIT       │ poll Distribuição DFe (SEFAZ)
     │ NOTIFY outbox_nova                            │ (cursor por NSU)
     ▼                                               ▼
  ┌─────────────────┐  FOR UPDATE SKIP LOCKED     grava nota_entrada (idempot. p/ chave)
  │  worker_emissao │                             manifesta 'Ciência'
  └─────────────────┘                             INSERT eventos('nfe.recebida')
     │ reserva nº+cNF → provider.emitir() → SEFAZ        │
     │ INSERT eventos('nfe.autorizada')                  │
     └───────────────┬───────────────────────────────────┘
                     ▼   (log de eventos; cada consumidor tem seu cursor)
        ┌──────────────────┐   ┌────────────────────┐
        │  worker_estoque  │   │  worker_financeiro │   (cada um seu cursor)
        │ autorizada→saída │   │ autorizada→receber │
        │ recebida →entrada│   │ recebida →pagar    │
        └──────────────────┘   └────────────────────┘
```

Repare que os **quatro serviços** (`worker_emissao`, `worker_recebimento`,
`worker_estoque`, `worker_financeiro`) só se comunicam por **tabelas/eventos** —
nenhum chama o outro direto. `worker_estoque` e `worker_financeiro` leem os MESMOS
eventos, cada um com seu cursor, de forma independente (fan-out). Adicionar um 5º
(ex.: envio de DANFE por e-mail) é só mais um consumidor de `eventos`.

## Por que Postgres (e não RabbitMQ) para começar

- **Outbox transacional**: gravar a venda **e** enfileirar a emissão na mesma
  transação elimina o *dual-write* (o problema de "gravei no banco mas o broker caiu").
- **`FOR UPDATE SKIP LOCKED`**: fila concorrente de verdade, vários workers sem
  processar a mesma linha.
- **`LISTEN/NOTIFY`**: baixa latência sem *polling* agressivo (é só um sino; a
  verdade está nas tabelas).
- Migrar para RabbitMQ/Kafka depois é fácil: um relay lê a `outbox` e publica.

## O que este exemplo demonstra (tudo testado)

| Conceito | Onde |
|---|---|
| Outbox transacional | `app_erp.py` |
| Fila concorrente (`SKIP LOCKED`) | `worker_emissao.py` |
| Numeração sequencial idempotente (chave estável em retries) | `worker_emissao.py` |
| Chamada à SEFAZ **fora** de transação | `worker_emissao.py` |
| Máquina de estados (`pendente→autorizada|rejeitada`) | `notas_fiscais` |
| Retry com backoff só p/ falha transitória | `worker_emissao.py` |
| Rejeição de regra = terminal (sem retry) | `worker_emissao.py` |
| Reaper de itens presos (`processando`) | `worker_emissao.py` |
| Eventos + fan-out com cursor por consumidor | `worker_estoque.py` |
| Recebimento de compras (Distribuição DFe + cursor NSU) | `worker_recebimento.py` |
| Manifestação do destinatário (Ciência da Operação) | `worker_recebimento.py` |
| Entrada de estoque a partir de nota de fornecedor | `worker_estoque.py` |
| Troca de provider por env var (próprio ↔ Focus) | `provider/nfe/fabrica.py` |
| Financeiro: contas a receber/pagar + parcelamento | `worker_financeiro.py` |

## Rodar com Docker (recomendado)

Na **raiz do repositório**:

```bash
docker compose up --build              # sobe postgres + os 2 workers
# noutro terminal, crie vendas:
docker compose run --rm erp python app_erp.py --qtd 2   # 2 vendas normais
docker compose run --rm erp python app_erp.py --ruim    # NCM inválido -> rejeição
docker compose run --rm erp python app_erp.py --instavel # SEFAZ instável -> retry
```

## Rodar local (sem Docker para os workers)

Só o Postgres em container, workers no seu Python:

```bash
docker run -d --name erp-postgres -e POSTGRES_USER=erp -e POSTGRES_PASSWORD=erp \
  -e POSTGRES_DB=erp -p 5433:5432 postgres:16-alpine
docker exec -i erp-postgres psql -U erp -d erp < erp/schema.sql

# usando o venv do provider (que já tem as dependências fiscais + psycopg):
provider/.venv/Scripts/python erp/worker_emissao.py      # terminal 1 (vendas)
provider/.venv/Scripts/python erp/worker_estoque.py      # terminal 2 (estoque)
provider/.venv/Scripts/python erp/worker_recebimento.py  # terminal 3 (compras)
provider/.venv/Scripts/python erp/worker_financeiro.py   # terminal 4 (financeiro)
provider/.venv/Scripts/python erp/app_erp.py --parcelas 3 # terminal 5 (cria venda 3x)
```

O `worker_recebimento` já "recebe" 2 notas de fornecedores simuladas (Distribuição
DFe) e dá entrada no estoque automaticamente.

## Tabelas

| Tabela | Papel |
|---|---|
| `vendas` | pedidos de venda (o "negócio") |
| `outbox` | comandos a processar (fila) — gravada junto com a venda |
| `notas_fiscais` | máquina de estados do documento fiscal (chave = âncora de idempotência) |
| `numeracao` | próximo `nNF` por série (ponto de contenção) |
| `eventos` | log append-only de eventos de domínio |
| `consumidores` | cursor de cada serviço sobre `eventos` (fan-out) |
| `produtos` | saldo de estoque (dono é o ERP, nunca o provider) |
| `dfe_cursor` | até que NSU já consumimos da Distribuição DFe |
| `notas_entrada` | notas de fornecedores recebidas (chave = idempotência) |
| `titulos` | contas a receber (vendas) e a pagar (compras) |

## Ainda faltam (próximos exercícios)

- **Consulta de recuperação** (`NFeConsultaProtocolo`) para o caso "enviei mas não
  sei se autorizou" — a idempotência real depende disso.
- **Relay** outbox→RabbitMQ/Kafka quando precisar de escala/poliglota.
- **DLQ** (dead-letter) para o que esgota as tentativas (`status='erro'`).
- Workers de **financeiro** e **DANFE** (novos consumidores do mesmo evento).
