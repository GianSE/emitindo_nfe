import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { titulos } from "../db/schema.js";

export function listarTitulos(tipo?: string) {
  const base = db.select().from(titulos);
  return tipo
    ? base.where(eq(titulos.tipo, tipo)).orderBy(titulos.vencimento)
    : base.orderBy(titulos.vencimento);
}
