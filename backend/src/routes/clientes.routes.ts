import type { FastifyInstance } from "fastify";
import * as c from "../controllers/clientes.controller.js";

export default async function clientesRoutes(app: FastifyInstance) {
  app.get("/clientes", c.listar);
  app.post("/clientes", { schema: { body: { type: "object", required: ["nome"] } } }, c.criar);
  app.put("/clientes/:id", c.atualizar);
  app.delete("/clientes/:id", c.remover);
}
