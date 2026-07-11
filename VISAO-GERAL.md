# ERP — visão geral do projeto

Um ERP de Centro de Distribuição construído em camadas desacopladas, do zero.
Cada pasta é uma responsabilidade independente:

```
emitindo_nfe/
├── provider/     🐍 Serviço FISCAL (Python) — pacote `nfe/` em subpacotes:
│   └── nfe/{core/, sefaz/, danfe.py, provider.py}   XML, assinatura, SEFAZ, DANFE,
│                    Distribuição DFe. "Botão" p/ trocar por Focus NFe.
│
├── erp/          🐍 ORQUESTRAÇÃO por eventos (Python + Postgres):
│   ├── workers/  {emissao, estoque, recebimento, financeiro}
│   └── shared/   {db, storage}          outbox + 4 workers desacoplados.
│
├── backend/      🟢 CORE / API (Node + Fastify + TypeScript), em CAMADAS:
│   └── src/{routes/, controllers/, services/, db/, lib/, plugins/}
│   └── drizzle/  migrations (Drizzle é o dono do schema)
│
├── frontend/     ⚛️  UI (React + Vite + Tailwind):
│   └── src/{pages/, components/, hooks/, api/, auth/}
│
└── docker-compose.yml   postgres → migrate → workers + backend + frontend + minio.
```

## O fluxo completo (o que acontece ao clicar "Emitir NF-e")

```
  React (frontend)
     │  POST /vendas
     ▼
  Fastify (backend) ──BEGIN; INSERT venda; INSERT outbox; COMMIT──► Postgres
     │                                                                 │ NOTIFY
     │                                                                 ▼
     │                                          worker_emissao (Python) ──► provider ──► SEFAZ
     │                                                 │ evento 'nfe.autorizada'
     │                        ┌────────────────────────┼────────────────────────┐
     │                        ▼                                                  ▼
     │                 worker_estoque (baixa)                          worker_financeiro (a receber)
     │
     └──◄ GET /notas /dashboard /titulos … (a UI faz polling e mostra o resultado)

  Em paralelo: worker_recebimento faz poll da Distribuição DFe (compras dos
  fornecedores) e publica 'nfe.recebida' -> estoque (entrada) + financeiro (a pagar).
```

Nenhuma camada chama a outra direto: tudo por **tabelas/eventos no Postgres**.
Isso permite trocar qualquer peça (ex.: o provider fiscal próprio pela Focus,
ou o backend Node por outro) sem tocar no resto.

## Subir tudo com Docker

```bash
docker compose up --build
```

- Frontend:  http://localhost:5173
- Backend:   http://localhost:3001  (ex.: `GET /dashboard`)
- Postgres:  localhost:5433  (usuário/senha/db = erp)

O schema é criado automaticamente na 1ª subida. Crie vendas pela tela **Nova Venda**
ou via API:

```bash
curl -X POST localhost:3001/vendas -H 'Content-Type: application/json' \
  -d '{"cliente":{"xNome":"LOJA X"},"parcelas":3,"itens":[{"cProd":"001","qtd":2}]}'
```

O worker de recebimento já "recebe" 2 notas de fornecedores simuladas e dá entrada
no estoque, então o painel de Compras e o Financeiro (a pagar) já aparecem populados.

## Rodar em modo dev (fora do Docker)

Precisa de um Postgres (o `docker run` da seção do [erp/README](erp/README.md)) e:

```bash
# backend
cd backend && npm install && npm run dev         # :3001

# frontend
cd frontend && npm install && npm run dev         # :5173

# workers (usando o venv do provider)
provider/.venv/Scripts/python erp/worker_emissao.py
provider/.venv/Scripts/python erp/worker_estoque.py
provider/.venv/Scripts/python erp/worker_recebimento.py
provider/.venv/Scripts/python erp/worker_financeiro.py
```

## Documentação por camada

- Fiscal (XML, assinatura, SEFAZ, DANFE): [README.md](README.md) + [provider/](provider/)
- Orquestração por eventos (outbox, workers): [erp/README.md](erp/README.md)
- Stack recomendada e decisões: este arquivo.

## Stack e por quê

| Camada | Escolha | Motivo |
|--------|---------|--------|
| Fiscal | **Python** | melhores libs fiscais BR (nfelib, assinatura, lxml) |
| Orquestração | **Postgres (outbox + SKIP LOCKED + NOTIFY)** | resolve o *dual-write* sem broker externo |
| API/Core | **Node + Fastify + TypeScript** | validação por schema, rápido, TS-first |
| ORM | **Drizzle** | type-safe e leve; não briga com o schema (dono é o Python) |
| Auth | **Local (usuário/senha) + OIDC (Authentik)** | login local sempre; SSO opcional |
| UI | **React + Vite + Tailwind** | padrão de mercado, build/HMR rápidos |

## Login: local + SSO configurável no app (estilo MinIO)

A tela de login tem **usuário/senha** (sempre) e um botão **Entrar com SSO** que
aparece só quando o SSO está habilitado. O usuário inicial é **admin / admin**
(criado no 1º boot; troque a senha).

O SSO **não** é configurado no `.env` — é configurado **dentro do ERP** (menu
**Configurações**, visível para admin), e fica salvo no banco (tabela
`configuracoes`). É o mesmo padrão do MinIO.

Como ligar o Authentik:
1. No Authentik, crie um **Provider OIDC** + **Application**.
   - Redirect URI: `http://localhost:5173/` (origem do frontend).
2. No ERP: **Configurações → SSO**, marque "Habilitar", cole o **Issuer** e o
   **Client ID**, salve. O botão de SSO passa a aparecer no login.

Por baixo: o SPA faz **Authorization Code + PKCE** no Authentik e manda o token à
API. O backend aceita **dois tipos** de token — o JWT local (HS256, sessão
usuário/senha) e o JWT do Authentik (validado via **JWKS**, issuer, audience) — em
todas as rotas exceto `/health`, `/auth/login` e `GET /config/sso`.
Defina `AUTH_SECRET` (assina o JWT local) em produção.

Poliglota de propósito: cada camada na linguagem mais forte para o seu papel,
conversando por eventos no banco.
