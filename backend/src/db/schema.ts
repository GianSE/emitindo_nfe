/**
 * Schema Drizzle — fonte da verdade do banco (o drizzle-kit gera as migrations
 * a partir daqui). Modela TODAS as tabelas do ERP, inclusive as usadas só pelos
 * workers Python, para que uma migration única crie o banco do zero.
 */
import {
  pgTable, uuid, text, integer, bigint, bigserial, jsonb, numeric, date,
  timestamp, boolean, customType,
} from "drizzle-orm/pg-core";

// bytea (Postgres) — para os XML autorizados guardados pelos workers.
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const numeracao = pgTable("numeracao", {
  serie: integer("serie").primaryKey(),
  proximoNumero: bigint("proximo_numero", { mode: "number" }).notNull().default(1),
});

export const vendas = pgTable("vendas", {
  id: uuid("id").primaryKey().defaultRandom(),
  cliente: jsonb("cliente").$type<Record<string, any>>(),
  itens: jsonb("itens").$type<any[]>(),
  opcoes: jsonb("opcoes").$type<Record<string, any>>().default({}),
  criadaEm: timestamp("criada_em", { withTimezone: true }).defaultNow(),
});

export const notasFiscais = pgTable("notas_fiscais", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendaId: uuid("venda_id").notNull(),
  serie: integer("serie"),
  numero: bigint("numero", { mode: "number" }),
  cnf: text("cnf"),
  chave: text("chave"),
  status: text("status").notNull().default("pendente"),
  cstat: text("cstat"),
  motivo: text("motivo"),
  nprot: text("nprot"),
  xmlAutorizado: bytea("xml_autorizado"),
  armazenado: boolean("armazenado").notNull().default(false),
  tentativas: integer("tentativas").notNull().default(0),
  atualizadaEm: timestamp("atualizada_em", { withTimezone: true }).defaultNow(),
});

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
});

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

export const produtos = pgTable("produtos", {
  cod: text("cod").primaryKey(),
  nome: text("nome"),
  saldo: numeric("saldo").notNull().default("0"),
  ncm: text("ncm"),
  cfop: text("cfop"),
  unidade: text("unidade").default("UN"),
  preco: numeric("preco").default("0"),
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

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  nome: text("nome"),
  papel: text("papel").notNull().default("operador"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const configuracoes = pgTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: jsonb("valor").$type<Record<string, any>>().notNull(),
  atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).defaultNow(),
});

export const titulos = pgTable("titulos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: text("tipo").notNull(),
  origemChave: text("origem_chave"),
  descricao: text("descricao"),
  valor: numeric("valor").notNull(),
  parcela: integer("parcela").notNull().default(1),
  totalParcelas: integer("total_parcelas").notNull().default(1),
  vencimento: date("vencimento"),
  status: text("status").notNull().default("aberto"),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const dfeCursor = pgTable("dfe_cursor", {
  id: integer("id").primaryKey().default(1),
  ultNsu: bigint("ult_nsu", { mode: "number" }).notNull().default(0),
});

export const notasEntrada = pgTable("notas_entrada", {
  id: uuid("id").primaryKey().defaultRandom(),
  nsu: bigint("nsu", { mode: "number" }),
  chave: text("chave").unique(),
  cnpjEmitente: text("cnpj_emitente"),
  xml: bytea("xml"),
  itens: jsonb("itens").$type<any[]>(),
  manifestacao: text("manifestacao"),
  recebidaEm: timestamp("recebida_em", { withTimezone: true }).defaultNow(),
});
