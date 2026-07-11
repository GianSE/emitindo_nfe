import type { FastifyReply, FastifyRequest } from "fastify";
import * as service from "../services/notas.service.js";

export const listar = () => service.listar();

export async function arquivoUrl(req: FastifyRequest, reply: FastifyReply) {
  const chave = (req.params as any).chave as string;
  const tipo = (req.query as any).tipo === "danfe" ? "danfe" : "xml";
  if (!/^\d{44}$/.test(chave)) return reply.code(400).send({ erro: "chave inválida" });
  return { url: await service.urlArquivo(chave, tipo) };
}
