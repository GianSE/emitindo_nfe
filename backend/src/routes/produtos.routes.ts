import type { FastifyInstance } from "fastify";
import * as c from "../controllers/produtos.controller.js";

const bodyProduto = {
  type: "object",
  required: ["cod", "nome"],
  properties: {
    cod: { type: "string" }, nome: { type: "string" },
    ncm: { type: "string" }, cfop: { type: "string" }, unidade: { type: "string" },
    preco: { type: "number", minimum: 0 }, saldo: { type: "number" },
  },
} as const;

export default async function produtosRoutes(app: FastifyInstance) {
  app.get("/produtos", c.listar);
  app.post("/produtos", { schema: { body: bodyProduto } }, c.criar);
  app.put("/produtos/:cod", c.atualizar);
  app.delete("/produtos/:cod", c.remover);
}
