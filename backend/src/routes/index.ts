import type { FastifyInstance } from "fastify";
import authRoutes from "./auth.routes.js";
import empresaRoutes from "./empresa.routes.js";
import produtosRoutes from "./produtos.routes.js";
import clientesRoutes from "./clientes.routes.js";
import vendasRoutes from "./vendas.routes.js";
import notasRoutes from "./notas.routes.js";
import financeiroRoutes from "./financeiro.routes.js";
import dashboardRoutes from "./dashboard.routes.js";

/** Registra todos os grupos de rotas. */
export default async function registrarRotas(app: FastifyInstance) {
  await app.register(authRoutes);
  await app.register(empresaRoutes);
  await app.register(produtosRoutes);
  await app.register(clientesRoutes);
  await app.register(vendasRoutes);
  await app.register(notasRoutes);
  await app.register(financeiroRoutes);
  await app.register(dashboardRoutes);
}
