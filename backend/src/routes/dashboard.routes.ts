import type { FastifyInstance } from "fastify";
import * as c from "../controllers/dashboard.controller.js";

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", c.resumo);
  app.get("/compras", c.compras);
}
