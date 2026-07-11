import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { produtos } from "../db/schema.js";

export interface ProdutoInput {
  cod: string; nome: string; ncm?: string; cfop?: string;
  unidade?: string; preco?: number; saldo?: number;
}

export const listar = () => db.select().from(produtos).orderBy(produtos.cod);

export const criar = (p: ProdutoInput) =>
  db.insert(produtos).values({
    cod: p.cod, nome: p.nome, ncm: p.ncm, cfop: p.cfop,
    unidade: p.unidade ?? "UN", preco: String(p.preco ?? 0), saldo: String(p.saldo ?? 0),
  });

export const atualizar = (cod: string, p: Partial<ProdutoInput>) =>
  db.update(produtos).set({
    nome: p.nome, ncm: p.ncm, cfop: p.cfop, unidade: p.unidade,
    preco: p.preco != null ? String(p.preco) : undefined,
  }).where(eq(produtos.cod, cod));

export const remover = (cod: string) => db.delete(produtos).where(eq(produtos.cod, cod));
