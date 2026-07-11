import Fastify from "fastify";
import cors from "@fastify/cors";
import { autenticar } from "./plugins/auth.js";
import { seed } from "./services/seed.service.js";
import registrarRotas from "./routes/index.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// dados iniciais (admin, produtos, cliente, config SSO)
await seed((m) => app.log.info(m));

// autenticação global (o hook libera /health, /auth/login e GET /config/sso)
app.addHook("onRequest", autenticar);

app.get("/health", async () => ({ ok: true }));

await app.register(registrarRotas);

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).then(() => app.log.info(`ERP backend on :${port}`));
