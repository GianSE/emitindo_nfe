import type { FastifyInstance } from "fastify";
import * as c from "../controllers/vendas.controller.js";

export default async function vendasRoutes(app: FastifyInstance) {
  app.post("/vendas", {
    schema: {
      body: {
        type: "object",
        required: ["itens"],
        properties: {
          clienteId: { type: "string" },
          parcelas: { type: "integer", minimum: 1, maximum: 12 },
          itens: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["cod", "qtd"],
              properties: { cod: { type: "string" }, qtd: { type: "number", exclusiveMinimum: 0 } },
            },
          },
        },
      },
    },
  }, c.criar);
}
