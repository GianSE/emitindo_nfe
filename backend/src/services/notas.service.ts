import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { notasFiscais, vendas } from "../db/schema.js";
import { urlDownload } from "../lib/storage.js";

export async function listar() {
  const rows = await db
    .select({
      numero: notasFiscais.numero,
      serie: notasFiscais.serie,
      status: notasFiscais.status,
      cstat: notasFiscais.cstat,
      nprot: notasFiscais.nprot,
      chave: notasFiscais.chave,
      motivo: notasFiscais.motivo,
      atualizadaEm: notasFiscais.atualizadaEm,
      armazenado: notasFiscais.armazenado,
      cliente: vendas.cliente,
    })
    .from(notasFiscais)
    .leftJoin(vendas, eq(vendas.id, notasFiscais.vendaId))
    .orderBy(sql`${notasFiscais.numero} DESC NULLS LAST`);
  return rows.map((r) => ({ ...r, cliente: (r.cliente as any)?.xNome ?? "—" }));
}

/** URL de download (presigned) do XML ou DANFE guardado no MinIO. */
export function urlArquivo(chave: string, tipo: "xml" | "danfe") {
  const key = tipo === "danfe" ? `danfe/${chave}.pdf` : `nfe/${chave}.xml`;
  return urlDownload(key);
}
