import type { FastifyRequest } from "fastify";
import * as service from "../services/financeiro.service.js";

export const listar = (req: FastifyRequest) =>
  service.listarTitulos((req.query as any).tipo);
