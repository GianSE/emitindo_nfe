/**
 * Autenticação — dois caminhos, mesma sessão:
 *
 *   1) LOCAL: usuário/senha -> o backend emite um JWT próprio (HS256).
 *   2) SSO (Authentik/OIDC): o SPA loga no Authentik e manda o access token;
 *      o backend valida contra o JWKS do provedor.
 *
 * O SSO é configurado EM RUNTIME (tabela `configuracoes`, via UI) — estilo MinIO.
 * O hook aceita QUALQUER um dos dois tokens.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getSso } from "./config.js";

const AUTH_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-secret-troque-em-producao"
);
const LOCAL_ISS = "erp-local";

// ---- senha (scrypt, sem dependência externa) ------------------------------ #
export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const h = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${h}`;
}
export function conferirSenha(senha: string, armazenado: string): boolean {
  const [salt, h] = armazenado.split(":");
  if (!salt || !h) return false;
  const calc = scryptSync(senha, salt, 64);
  const orig = Buffer.from(h, "hex");
  return calc.length === orig.length && timingSafeEqual(calc, orig);
}

// ---- JWT local ------------------------------------------------------------ #
export async function emitirTokenLocal(u: { username: string; nome: string | null; papel: string }) {
  return new SignJWT({ nome: u.nome, papel: u.papel, tipo: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(u.username)
    .setIssuer(LOCAL_ISS)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(AUTH_SECRET);
}

// ---- JWKS remoto (SSO), cacheado por issuer ------------------------------- #
const jwksPorIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
async function jwksDe(issuer: string) {
  if (!jwksPorIssuer.has(issuer)) {
    const base = issuer.endsWith("/") ? issuer : issuer + "/";
    const conf = await fetch(base + ".well-known/openid-configuration").then((r) => r.json());
    jwksPorIssuer.set(issuer, createRemoteJWKSet(new URL(conf.jwks_uri)));
  }
  return jwksPorIssuer.get(issuer)!;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JWTPayload & { papel?: string };
  }
}

/** Rotas liberadas sem token (sensível ao método!). */
function ehPublica(method: string, url: string): boolean {
  if (method === "OPTIONS") return true;
  const p = url.split("?")[0];
  if (p === "/health") return true;
  if (p === "/auth/login" && method === "POST") return true;
  if (p === "/config/sso" && method === "GET") return true; // PUT exige admin
  return false;
}

export async function autenticar(req: FastifyRequest, reply: FastifyReply) {
  if (ehPublica(req.method, req.url)) return;

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.code(401).send({ erro: "não autenticado" });
  }
  const token = header.slice(7);

  // 1) tenta como token LOCAL
  try {
    const { payload } = await jwtVerify(token, AUTH_SECRET, { issuer: LOCAL_ISS });
    req.user = payload as any;
    return;
  } catch {
    /* não é local; tenta SSO */
  }

  // 2) tenta como token do SSO (se configurado)
  const sso = await getSso();
  if (sso.enabled && sso.issuer) {
    try {
      const iss = sso.issuer.endsWith("/") ? sso.issuer.slice(0, -1) : sso.issuer;
      const { payload } = await jwtVerify(token, await jwksDe(sso.issuer), {
        issuer: iss,
        audience: sso.clientId || undefined,
      });
      // mapeia papel a partir dos grupos do Authentik, se vierem
      const grupos = (payload as any).groups as string[] | undefined;
      req.user = { ...payload, papel: grupos?.includes("erp-admin") ? "admin" : "operador" };
      return;
    } catch {
      /* inválido */
    }
  }

  return reply.code(401).send({ erro: "token inválido ou expirado" });
}

/** Exige um papel específico (ex.: admin) numa rota. */
export function exigirPapel(papel: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.papel !== papel) {
      return reply.code(403).send({ erro: `requer papel '${papel}'` });
    }
  };
}
