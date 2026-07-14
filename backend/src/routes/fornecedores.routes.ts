import type { FastifyInstance } from "fastify";
import * as c from "../controllers/fornecedores.controller.js";

export default async function fornecedoresRoutes(app: FastifyInstance) {
  app.get("/fornecedores", c.listar);
  app.post("/fornecedores", { schema: { body: { type: "object", required: ["cnpj"] } } }, c.criar);
  app.put("/fornecedores/:id", c.atualizar);
  app.delete("/fornecedores/:id", c.remover);
}
