import type { FastifyInstance } from "fastify";
import * as c from "../controllers/auth.controller.js";
import { exigirPapel } from "../plugins/auth.js";

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", {
    schema: {
      body: {
        type: "object",
        required: ["username", "senha"],
        properties: { username: { type: "string" }, senha: { type: "string" } },
      },
    },
  }, c.login);

  app.get("/auth/me", c.me);

  // Config do SSO — GET público (o SPA decide se mostra o botão); PUT só admin.
  app.get("/config/sso", c.getSsoConfig);
  app.put("/config/sso", { preHandler: exigirPapel("admin") }, c.putSsoConfig);
}
