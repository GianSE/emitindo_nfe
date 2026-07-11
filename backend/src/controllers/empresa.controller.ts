import type { FastifyRequest } from "fastify";
import { getEmpresa, setEmpresa } from "../lib/empresa.js";

export const obter = () => getEmpresa();
export const salvar = (req: FastifyRequest) => setEmpresa(req.body as any);
