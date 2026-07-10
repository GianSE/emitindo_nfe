/**
 * Schema Drizzle — mapeia as tabelas que o Python (erp/schema.sql) já criou.
 *
 * IMPORTANTE: aqui o Drizzle NÃO é dono das migrations — quem cria/altera as
 * tabelas é o `erp/schema.sql` (lado Python). Estas definições só descrevem as
 * tabelas para consultá-las com type-safety no Node. Num projeto de dono único,
 * você deixaria UMA camada responsável pelo DDL.
 */
import {
  pgTable, uuid, text, integer, bigint, bigserial, jsonb, numeric, date, timestamp,
} from "drizzle-orm/pg-core";

export const vendas = pgTable("vendas", {
  id: uuid("id").primaryKey().defaultRandom(),
  cliente: jsonb("cliente").$type<Record<string, any>>(),
  itens: jsonb("itens").$type<any[]>(),
  opcoes: jsonb("opcoes").$type<Record<string, any>>(),
  criadaEm: timestamp("criada_em", { withTimezone: true }),
});

export const outbox = pgTable("outbox", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tipo: text("tipo").notNull(),
  payload: jsonb("payload").$type<Record<string, any>>().notNull(),
  status: text("status"),
});

export const notasFiscais = pgTable("notas_fiscais", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendaId: uuid("venda_id"),
  serie: integer("serie"),
  numero: bigint("numero", { mode: "number" }),
  chave: text("chave"),
  status: text("status"),
  cstat: text("cstat"),
  motivo: text("motivo"),
  nprot: text("nprot"),
  atualizadaEm: timestamp("atualizada_em", { withTimezone: true }),
});

export const produtos = pgTable("produtos", {
  cod: text("cod").primaryKey(),
  nome: text("nome"),
  saldo: numeric("saldo"),
});

export const titulos = pgTable("titulos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: text("tipo").notNull(),
  origemChave: text("origem_chave"),
  descricao: text("descricao"),
  valor: numeric("valor").notNull(),
  parcela: integer("parcela"),
  totalParcelas: integer("total_parcelas"),
  vencimento: date("vencimento"),
  status: text("status"),
});

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  senhaHash: text("senha_hash").notNull(),
  nome: text("nome"),
  papel: text("papel").notNull(),
});

export const configuracoes = pgTable("configuracoes", {
  chave: text("chave").primaryKey(),
  valor: jsonb("valor").$type<Record<string, any>>().notNull(),
});

export const notasEntrada = pgTable("notas_entrada", {
  id: uuid("id").primaryKey().defaultRandom(),
  nsu: bigint("nsu", { mode: "number" }),
  chave: text("chave"),
  cnpjEmitente: text("cnpj_emitente"),
  itens: jsonb("itens").$type<any[]>(),
  manifestacao: text("manifestacao"),
  recebidaEm: timestamp("recebida_em", { withTimezone: true }),
});
