import type { FastifyReply, FastifyRequest } from "fastify";
import * as authService from "../services/auth.service.js";
import { getSso, setSso } from "../lib/sso.js";

export async function login(req: FastifyRequest, reply: FastifyReply) {
  const { username, senha } = req.body as { username: string; senha: string };
  const r = await authService.login(username, senha);
  if (!r) return reply.code(401).send({ erro: "usuário ou senha inválidos" });
  return r;
}

export async function me(req: FastifyRequest) {
  return { nome: req.user?.nome ?? req.user?.sub, papel: req.user?.papel };
}

export async function getSsoConfig() {
  const { enabled, issuer, clientId } = await getSso();
  return { enabled, issuer, clientId };
}

export async function putSsoConfig(req: FastifyRequest) {
  const b = req.body as any;
  return setSso({ enabled: !!b.enabled, issuer: b.issuer ?? "", clientId: b.clientId ?? "" });
}
