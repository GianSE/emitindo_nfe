import type { FastifyReply, FastifyRequest } from "fastify";
import * as service from "../services/produtos.service.js";

export const listar = () => service.listar();

export async function criar(req: FastifyRequest, reply: FastifyReply) {
  await service.criar(req.body as any);
  reply.code(201);
  return { ok: true };
}

export async function atualizar(req: FastifyRequest) {
  await service.atualizar((req.params as any).cod, req.body as any);
  return { ok: true };
}

export async function remover(req: FastifyRequest) {
  await service.remover((req.params as any).cod);
  return { ok: true };
}
