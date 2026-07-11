/**
 * Dados do EMITENTE (a empresa que emite as NFe). Guardado na tabela
 * `configuracoes` (chave 'empresa'), editável pela UI — antes ficava fixo no
 * código do worker. É o que vai no grupo <emit> do XML.
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { configuracoes } from "../db/schema.js";

export interface Empresa {
  CNPJ: string; xNome: string; xFant: string;
  xLgr: string; nro: string; xBairro: string;
  cMun: string; xMun: string; UF: string; cUF: string; CEP: string; fone: string;
  IE: string; CRT: string;        // CRT: 1=Simples Nacional, 3=Regime Normal
  ambiente: string;               // 1=produção, 2=homologação
}

const PADRAO: Empresa = {
  CNPJ: "12345678000190", xNome: "EMPRESA TESTE LTDA", xFant: "LOJA TESTE",
  xLgr: "RUA DAS FLORES", nro: "100", xBairro: "CENTRO",
  cMun: "3550308", xMun: "SAO PAULO", UF: "SP", cUF: "35", CEP: "01001000", fone: "1130000000",
  IE: "110042490114", CRT: "1", ambiente: "2",
};

export async function getEmpresa(): Promise<Empresa> {
  const [row] = await db.select().from(configuracoes).where(eq(configuracoes.chave, "empresa"));
  return row ? { ...PADRAO, ...(row.valor as any) } : PADRAO;
}

export async function existeEmpresa(): Promise<boolean> {
  const [row] = await db.select().from(configuracoes).where(eq(configuracoes.chave, "empresa"));
  return !!row;
}

export async function setEmpresa(v: Partial<Empresa>): Promise<Empresa> {
  const valor: Empresa = { ...(await getEmpresa()), ...v };
  await db.insert(configuracoes).values({ chave: "empresa", valor })
    .onConflictDoUpdate({ target: configuracoes.chave, set: { valor } });
  return valor;
}

export { PADRAO as EMPRESA_PADRAO };
