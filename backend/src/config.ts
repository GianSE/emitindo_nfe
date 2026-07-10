/**
 * Configurações de runtime do ERP (guardadas no banco, editáveis pela UI).
 * É o padrão do MinIO: o SSO não vem "chumbado" no .env — você liga e configura
 * dentro do próprio sistema.
 */
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { configuracoes } from "./schema.js";

export interface SsoConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
}

const PADRAO_SSO: SsoConfig = { enabled: false, issuer: "", clientId: "" };

let cache: SsoConfig | null = null;

export async function getSso(): Promise<SsoConfig> {
  if (cache) return cache;
  const [row] = await db.select().from(configuracoes).where(eq(configuracoes.chave, "sso"));
  const valor: SsoConfig = row ? { ...PADRAO_SSO, ...(row.valor as any) } : PADRAO_SSO;
  cache = valor;
  return valor;
}

export async function setSso(v: SsoConfig): Promise<SsoConfig> {
  const valor: SsoConfig = {
    enabled: !!v.enabled,
    issuer: (v.issuer ?? "").trim(),
    clientId: (v.clientId ?? "").trim(),
  };
  await db
    .insert(configuracoes)
    .values({ chave: "sso", valor })
    .onConflictDoUpdate({ target: configuracoes.chave, set: { valor } });
  cache = valor; // invalida/atualiza o cache
  return valor;
}
