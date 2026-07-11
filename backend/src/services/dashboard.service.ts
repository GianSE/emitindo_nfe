import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export async function resumo() {
  const one = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows[0];
  const [notas, estoque, receber, pagar, compras] = await Promise.all([
    one(sql`SELECT
        count(*) FILTER (WHERE status='autorizada') AS autorizadas,
        count(*) FILTER (WHERE status='rejeitada') AS rejeitadas,
        count(*) FILTER (WHERE status NOT IN ('autorizada','rejeitada')) AS pendentes
      FROM notas_fiscais`),
    one(sql`SELECT COALESCE(sum(saldo),0) AS total_saldo, count(*) AS itens FROM produtos`),
    one(sql`SELECT COALESCE(sum(valor),0) AS total, count(*) AS qtd FROM titulos WHERE tipo='receber' AND status='aberto'`),
    one(sql`SELECT COALESCE(sum(valor),0) AS total, count(*) AS qtd FROM titulos WHERE tipo='pagar' AND status='aberto'`),
    one(sql`SELECT count(*) AS qtd FROM notas_entrada`),
  ]);
  return { notas, estoque, receber, pagar, compras };
}
