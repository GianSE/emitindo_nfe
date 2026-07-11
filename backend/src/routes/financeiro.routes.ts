import type { FastifyInstance } from "fastify";
import * as c from "../controllers/financeiro.controller.js";

export default async function financeiroRoutes(app: FastifyInstance) {
  app.get("/titulos", c.listar);
}
