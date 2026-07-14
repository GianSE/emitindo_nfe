import type { FastifyReply, FastifyRequest } from "fastify";
import * as service from "../services/fornecedores.service.js";

export const listar = () => service.listar();

export async function criar(req: FastifyRequest, reply: FastifyReply) {
  const id = await service.criar(req.body);
  reply.code(201);
  return { id };
}

export async function atualizar(req: FastifyRequest) {
  await service.atualizar((req.params as any).id, req.body);
  return { ok: true };
}

export async function remover(req: FastifyRequest) {
  await service.remover((req.params as any).id);
  return { ok: true };
}
