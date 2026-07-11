import type { FastifyReply, FastifyRequest } from "fastify";
import * as service from "../services/vendas.service.js";

export async function criar(req: FastifyRequest, reply: FastifyReply) {
  const r = await service.criarVenda(req.body as any);
  if (r.erro) return reply.code(400).send({ erro: r.erro });
  reply.code(201);
  return r;
}
