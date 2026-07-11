import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { clientes } from "../db/schema.js";

export const listar = () => db.select().from(clientes).orderBy(clientes.nome);

export async function criar(c: any) {
  const [row] = await db.insert(clientes).values({
    nome: c.nome, doc: c.doc, logradouro: c.logradouro, numero: c.numero, bairro: c.bairro,
    codMunicipio: c.codMunicipio, municipio: c.municipio, uf: c.uf, cep: c.cep,
    indIeDest: c.indIeDest ?? "9",
  }).returning({ id: clientes.id });
  return row.id;
}

export const atualizar = (id: string, c: any) =>
  db.update(clientes).set({
    nome: c.nome, doc: c.doc, logradouro: c.logradouro, numero: c.numero, bairro: c.bairro,
    codMunicipio: c.codMunicipio, municipio: c.municipio, uf: c.uf, cep: c.cep, indIeDest: c.indIeDest,
  }).where(eq(clientes.id, id));

export const remover = (id: string) => db.delete(clientes).where(eq(clientes.id, id));

/** Mapeia um cliente do banco para o formato "dest" que o worker/provider espera. */
export function clienteParaDest(c: typeof clientes.$inferSelect) {
  return {
    doc: c.doc, xNome: c.nome, xLgr: c.logradouro, nro: c.numero, xBairro: c.bairro,
    cMun: c.codMunicipio, xMun: c.municipio, UF: c.uf, CEP: c.cep, indIEDest: c.indIeDest ?? "9",
  };
}
