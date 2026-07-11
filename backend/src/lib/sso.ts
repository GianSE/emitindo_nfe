/**
 * Configuração de SSO (OIDC/Authentik) guardada no banco e editável pela UI —
 * padrão MinIO (o SSO vive dentro do sistema, não no .env).
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { configuracoes } from "../db/schema.js";

export interface SsoConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
}

const PADRAO: SsoConfig = { enabled: false, issuer: "", clientId: "" };
let cache: SsoConfig | null = null;

export async function getSso(): Promise<SsoConfig> {
  if (cache) return cache;
  const [row] = await db.select().from(configuracoes).where(eq(configuracoes.chave, "sso"));
  const valor: SsoConfig = row ? { ...PADRAO, ...(row.valor as any) } : PADRAO;
  cache = valor;
  return valor;
}

export async function setSso(v: SsoConfig): Promise<SsoConfig> {
  const valor: SsoConfig = {
    enabled: !!v.enabled,
    issuer: (v.issuer ?? "").trim(),
    clientId: (v.clientId ?? "").trim(),
  };
  await db.insert(configuracoes).values({ chave: "sso", valor })
    .onConflictDoUpdate({ target: configuracoes.chave, set: { valor } });
  cache = valor;
  return valor;
}
