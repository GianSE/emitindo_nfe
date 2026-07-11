/**
 * Plugin de autenticação: hook onRequest que valida o token nas rotas
 * protegidas (libera /health, POST /auth/login e GET /config/sso).
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { verificarToken, type Sessao } from "../lib/tokens.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: Sessao;
  }
}

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
  const sessao = await verificarToken(header.slice(7));
  if (!sessao) {
    return reply.code(401).send({ erro: "token inválido ou expirado" });
  }
  req.user = sessao;
}

/** preHandler: exige um papel específico (ex.: admin). */
export function exigirPapel(papel: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.papel !== papel) {
      return reply.code(403).send({ erro: `requer papel '${papel}'` });
    }
  };
}
