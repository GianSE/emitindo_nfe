/**
 * Emissão e verificação de tokens de sessão.
 *   - LOCAL: JWT HS256 assinado por nós (login usuário/senha).
 *   - SSO:   JWT do Authentik, validado contra o JWKS do provedor (config no banco).
 */
import { SignJWT, jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import { getSso } from "./sso.js";

const AUTH_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-troque-em-producao"
);
const LOCAL_ISS = "erp-local";

export interface Sessao extends JWTPayload {
  papel?: string;
  nome?: string | null;
}

export async function emitirTokenLocal(u: { username: string; nome: string | null; papel: string }) {
  return new SignJWT({ nome: u.nome, papel: u.papel, tipo: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(u.username)
    .setIssuer(LOCAL_ISS)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(AUTH_SECRET);
}

// JWKS remoto (SSO) cacheado por issuer.
const jwksPorIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
async function jwksDe(issuer: string) {
  if (!jwksPorIssuer.has(issuer)) {
    const base = issuer.endsWith("/") ? issuer : issuer + "/";
    const conf = await fetch(base + ".well-known/openid-configuration").then((r) => r.json());
    jwksPorIssuer.set(issuer, createRemoteJWKSet(new URL(conf.jwks_uri)));
  }
  return jwksPorIssuer.get(issuer)!;
}

/** Valida um token (local OU SSO). Retorna a sessão ou null. */
export async function verificarToken(token: string): Promise<Sessao | null> {
  // 1) tenta local
  try {
    const { payload } = await jwtVerify(token, AUTH_SECRET, { issuer: LOCAL_ISS });
    return payload as Sessao;
  } catch { /* tenta SSO */ }

  // 2) tenta SSO (se configurado)
  const sso = await getSso();
  if (sso.enabled && sso.issuer) {
    try {
      const iss = sso.issuer.endsWith("/") ? sso.issuer.slice(0, -1) : sso.issuer;
      const { payload } = await jwtVerify(token, await jwksDe(sso.issuer), {
        issuer: iss,
        audience: sso.clientId || undefined,
      });
      const grupos = (payload as any).groups as string[] | undefined;
      return { ...payload, papel: grupos?.includes("erp-admin") ? "admin" : "operador" };
    } catch { /* inválido */ }
  }
  return null;
}
