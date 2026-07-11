import type { FastifyInstance } from "fastify";
import * as c from "../controllers/empresa.controller.js";
import { exigirPapel } from "../plugins/auth.js";

export default async function empresaRoutes(app: FastifyInstance) {
  app.get("/empresa", c.obter);
  app.put("/empresa", { preHandler: exigirPapel("admin") }, c.salvar);
}
