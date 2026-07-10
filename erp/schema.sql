-- =====================================================================
-- Schema do ERP (fatia mínima para demonstrar o desacoplamento por eventos)
--
-- Ideias-chave:
--   * OUTBOX TRANSACIONAL: a venda e o comando de emissão são gravados na
--     MESMA transação -> nunca ficam inconsistentes (resolve o "dual-write").
--   * FILA VIA POSTGRES: o worker consome a outbox com FOR UPDATE SKIP LOCKED,
--     o que permite vários workers em paralelo sem processar a mesma linha.
--   * EVENTOS DE DOMÍNIO: quando a nota é autorizada, publicamos um evento
--     ('nfe.autorizada') que OUTROS serviços (estoque, financeiro) consomem.
--   * NOTIFY: só um "sino" para reduzir latência; a verdade está nas tabelas.
-- =====================================================================

-- Numeração fiscal: sequencial por série, sem buracos. É o ponto de
-- CONTENÇÃO — a alocação do número precisa ser serializada.
CREATE TABLE IF NOT EXISTS numeracao (
    serie           INT PRIMARY KEY,
    proximo_numero  BIGINT NOT NULL DEFAULT 1
);
INSERT INTO numeracao (serie, proximo_numero) VALUES (1, 1)
    ON CONFLICT DO NOTHING;

-- Pedidos de venda (o "negócio"). Simplificado.
CREATE TABLE IF NOT EXISTS vendas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente     JSONB NOT NULL,
    itens       JSONB NOT NULL,
    opcoes      JSONB NOT NULL DEFAULT '{}',   -- p/ demonstrar rejeição/falha
    criada_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notas fiscais: MÁQUINA DE ESTADOS do documento fiscal.
--   pendente -> autorizada | rejeitada
-- A chave é UNIQUE: é a âncora de IDEMPOTÊNCIA (não emite a mesma nota 2x).
CREATE TABLE IF NOT EXISTS notas_fiscais (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id        UUID NOT NULL REFERENCES vendas(id),
    serie           INT,
    numero          BIGINT,
    cnf             VARCHAR(8),               -- código numérico -> chave estável em retries
    chave           VARCHAR(44) UNIQUE,
    status          TEXT NOT NULL DEFAULT 'pendente',
    cstat           TEXT,
    motivo          TEXT,
    nprot           TEXT,
    xml_autorizado  BYTEA,
    tentativas      INT NOT NULL DEFAULT 0,
    atualizada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (venda_id)                          -- 1 nota por venda (idempotência por venda)
);

-- OUTBOX: comandos a processar. Gravada junto com a venda (mesma transação).
CREATE TABLE IF NOT EXISTS outbox (
    id             BIGSERIAL PRIMARY KEY,
    tipo           TEXT NOT NULL,              -- 'nfe.emitir'
    payload        JSONB NOT NULL,             -- {"venda_id": "..."}
    status            TEXT NOT NULL DEFAULT 'pendente',  -- pendente|processando|concluido|erro
    tentativas        INT NOT NULL DEFAULT 0,
    disponivel_em     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- p/ backoff de retry
    processando_desde TIMESTAMPTZ,                          -- p/ o reaper (crash recovery)
    ultimo_erro       TEXT,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pendente
    ON outbox (disponivel_em) WHERE status = 'pendente';

-- EVENTOS de domínio publicados (log append-only). Vários consumidores leem.
CREATE TABLE IF NOT EXISTS eventos (
    id         BIGSERIAL PRIMARY KEY,
    tipo       TEXT NOT NULL,                  -- 'nfe.autorizada'
    payload    JSONB NOT NULL,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cursor por consumidor: cada serviço processa cada evento UMA vez (fan-out).
CREATE TABLE IF NOT EXISTS consumidores (
    nome       TEXT PRIMARY KEY,
    ultimo_id  BIGINT NOT NULL DEFAULT 0
);
INSERT INTO consumidores (nome, ultimo_id) VALUES ('estoque', 0), ('financeiro', 0)
    ON CONFLICT DO NOTHING;

-- Títulos financeiros: contas a RECEBER (vendas) e a PAGAR (compras).
-- UNIQUE evita duplicar o título se o evento for reprocessado.
CREATE TABLE IF NOT EXISTS titulos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            TEXT NOT NULL,              -- 'receber' | 'pagar'
    origem_chave    VARCHAR(44),               -- chave da NFe que originou
    descricao       TEXT,
    valor           NUMERIC(14,2) NOT NULL,
    parcela         INT NOT NULL DEFAULT 1,
    total_parcelas  INT NOT NULL DEFAULT 1,
    vencimento      DATE,
    status          TEXT NOT NULL DEFAULT 'aberto',   -- aberto | liquidado
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (origem_chave, tipo, parcela)
);

-- ===================== RECEBIMENTO (compras) ========================= --
-- Cursor da Distribuição DFe: até que NSU já consumimos da SEFAZ.
CREATE TABLE IF NOT EXISTS dfe_cursor (
    id       INT PRIMARY KEY DEFAULT 1,
    ult_nsu  BIGINT NOT NULL DEFAULT 0
);
INSERT INTO dfe_cursor (id, ult_nsu) VALUES (1, 0) ON CONFLICT DO NOTHING;

-- Notas de ENTRADA (emitidas por fornecedores contra o nosso CNPJ).
-- chave UNIQUE = idempotência (a mesma nota pode chegar 2x no polling).
CREATE TABLE IF NOT EXISTS notas_entrada (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nsu            BIGINT,
    chave          VARCHAR(44) UNIQUE,
    cnpj_emitente  TEXT,
    xml            BYTEA,
    itens          JSONB,
    manifestacao   TEXT,               -- ciencia | confirmacao | ...
    recebida_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estoque (dono do saldo é o ERP, NUNCA o provider fiscal).
CREATE TABLE IF NOT EXISTS produtos (
    cod    TEXT PRIMARY KEY,
    nome   TEXT,
    saldo  NUMERIC(14,4) NOT NULL DEFAULT 0
);
INSERT INTO produtos (cod, nome, saldo) VALUES
    ('001', 'CAMISETA ALGODAO AZUL M', 100),
    ('002', 'CALCA JEANS PRETA 42', 100)
    ON CONFLICT DO NOTHING;
