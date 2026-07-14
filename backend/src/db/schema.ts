/**
 * Schema Drizzle — fonte da verdade do banco (o drizzle-kit gera as migrations).
 *
 * Integridade referencial: foreign keys ligam as entidades. Onde há valor FISCAL
 * (nota emitida), mantemos TAMBÉM um snapshot imutável (jsonb) — se o preço de um
 * produto ou o endereço do cliente mudar amanhã, a nota antiga preserva o original.
 */
import {
  pgTable, uuid, text, integer, bigint, bigserial, jsonb, numeric, date,
  timestamp, boolean, customType, index, unique,
} from "drizzle-orm/pg-core";

// bytea (Postgres) — para os XML autorizados guardados pelos workers.
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

/* ----------------------------------------------------- cadastros ---------- */
export const produtos = pgTable("produtos", {
  cod: text("cod").primaryKey(),
  nome: text("nome"),
  saldo: numeric("saldo", { precision: 14, scale: 4 }).notNull().default("0"),
  ncm: text("ncm"),
  cfop: text("cfop"),
  unidade: text("unidade").default("UN"),
  preco: numeric("preco", { precision: 14, scale: 2 }).default("0"),
});

export const clientes = pgTable("clientes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  doc: text("doc"),
  logradouro: text("logradouro"),
  numero: text("numero"),
  bairro: text("bairro"),
  codMunicipio: text("cod_municipio"),
  municipio: text("municipio"),
  uf: text("uf"),
  cep: text("cep"),
  indIeDest: text("ind_ie_dest").default("9"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const fornecedores = pgTable("fornecedores", {
  id: uuid("id").primaryKey().defaultRandom(),
  cnpj: text("cnpj").notNull().unique(),
  nome: text("nome"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  nome: text("nome"),
  papel: text("papel").notNull().default("operador"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

/* ------------------------------------------------------- vendas ----------- */
export const vendas = pgTable("vendas", {
  id: uuid("id").primaryKey().defaultRandom(),
  clienteId: uuid("cliente_id").references(() => clientes.id),   // FK (null = destinatário padrão)
  cliente: jsonb("cliente").$type<Record<string, any>>(),        // snapshot fiscal (imutável)
  itens: jsonb("itens").$type<any[]>(),                          // snapshot fiscal (imutável)
  opcoes: jsonb("opcoes").$type<Record<string, any>>().default({}),
  criadaEm: timestamp("criada_em", { withTimezone: true }).defaultNow(),
}, (t) => [index("idx_vendas_cliente").on(t.clienteId)]);

// itens da venda em formato RELACIONAL (além do snapshot jsonb acima)
export const vendaItens = pgTable("venda_itens", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendaId: uuid("venda_id").notNull().references(() => vendas.id, { onDelete: "cascade" }),
  produtoCod: text("produto_cod").references(() => produtos.cod),
  qtd: numeric("qtd", { precision: 14, scale: 4 }).notNull(),
  precoUnit: numeric("preco_unit", { precision: 14, scale: 2 }).notNull(),
}, (t) => [index("idx_venda_itens_venda").on(t.vendaId)]);

/* --------------------------------------------------- notas fiscais -------- */
export const numeracao = pgTable("numeracao", {
  serie: integer("serie").primaryKey(),
  proximoNumero: bigint("proximo_numero", { mode: "number" }).notNull().default(1),
});

export const notasFiscais = pgTable("notas_fiscais", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendaId: uuid("venda_id").notNull().references(() => vendas.id).unique(),  // 1 nota por venda
  serie: integer("serie"),
  numero: bigint("numero", { mode: "number" }),
  cnf: text("cnf"),
  chave: text("chave").unique(),
  status: text("status").notNull().default("pendente"),
  cstat: text("cstat"),
  motivo: text("motivo"),
  nprot: text("nprot"),
  xmlAutorizado: bytea("xml_autorizado"),
  armazenado: boolean("armazenado").notNull().default(false),
  tentativas: integer("tentativas").notNull().default(0),
  atualizadaEm: timestamp("atualizada_em", { withTimezone: true }).defaultNow(),
}, (t) => [index("idx_notas_status").on(t.status)]);

/* --------------------------------------------------- financeiro ----------- */
export const titulos = pgTable("titulos", {
  id: uuid("id").primaryKey().defaultRandom(),
  notaId: uuid("nota_id").references(() => notasFiscais.id),   // FK (venda -> nota); null p/ contas a pagar
  tipo: text("tipo").notNull(),                                // receber | pagar
  origemChave: text("origem_chave"),
  descricao: text("descricao"),
  valor: numeric("valor", { precision: 14, scale: 2 }).notNull(),
  parcela: integer("parcela").notNull().default(1),
  totalParcelas: integer("total_parcelas").notNull().default(1),
  vencimento: date("vencimento"),
  status: text("status").notNull().default("aberto"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_titulos_nota").on(t.notaId),
  index("idx_titulos_status_venc").on(t.status, t.vencimento),
  // idempotência do worker financeiro: 1 título por (origem, tipo, parcela)
  unique("titulos_origem_tipo_parcela_uq").on(t.origemChave, t.tipo, t.parcela),
]);

/* ---------------------------------------------------- recebimento --------- */
export const dfeCursor = pgTable("dfe_cursor", {
  id: integer("id").primaryKey().default(1),
  ultNsu: bigint("ult_nsu", { mode: "number" }).notNull().default(0),
});

export const notasEntrada = pgTable("notas_entrada", {
  id: uuid("id").primaryKey().defaultRandom(),
  fornecedorId: uuid("fornecedor_id").references(() => fornecedores.id),  // FK
  nsu: bigint("nsu", { mode: "number" }),
  chave: text("chave").unique(),
  cnpjEmitente: text("cnpj_emitente"),
  xml: bytea("xml"),
  itens: jsonb("itens").$type<any[]>(),
  manifestacao: text("manifestacao"),
  recebidaEm: timestamp("recebida_em", { withTimezone: true }).defaultNow(),
});

/* -------------------------------------------- infra (fila/eventos/config) - */
export const outbox = pgTable("outbox", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tipo: text("tipo").notNull(),
  payload: jsonb("payload").$type<Record<string, any>>().notNull(),
  status: text("status").notNull().default("pendente"),
  tentativas: integer("tentativas").notNull().default(0),
  disponivelEm: timestamp("disponivel_em", { withTimezone: true }).notNull().defaultNow(),
  processandoDesde: timestamp("processando_desde", { withTimezone: true }),
  ultimoErro: text("ultimo_erro"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("idx_outbox_status").on(t.status, t.disponivelEm)]);

export const eventos = pgTable("eventos", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tipo: text("tipo").notNull(),
  payload: jsonb("payload").$type<Record<string, any>>().notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
});

export const consumidores = pgTable("consumidores", {
  nome: text("nome").primaryKey(),
  ultimoId: bigint("ultimo_id", { mode: "number" }).notNull().default(0),
});

export const configuracoes = pgTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: jsonb("valor").$type<Record<string, any>>().notNull(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow(),
});
