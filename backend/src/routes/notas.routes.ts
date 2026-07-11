import type { FastifyInstance } from "fastify";
import * as c from "../controllers/notas.controller.js";

export default async function notasRoutes(app: FastifyInstance) {
  app.get("/notas", c.listar);
  app.get("/notas/:chave/arquivo-url", c.arquivoUrl);
}
