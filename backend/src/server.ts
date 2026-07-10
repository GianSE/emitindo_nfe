import Fastify from "fastify";
import cors from "@fastify/cors";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./db.js";
import { vendas, outbox, notasFiscais, produtos, titulos, notasEntrada, usuarios } from "./schema.js";
import { CATALOGO, CLIENTE_PADRAO } from "./catalogo.js";
import { autenticar, exigirPapel, conferirSenha, emitirTokenLocal } from "./auth.js";
import { getSso, setSso } from "./config.js";
import { seed } from "./seed.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

await seed((m) => app.log.info(m));

// Autenticação em TODAS as rotas (o hook libera /health, /auth/login, /config/sso).
app.addHook("onRequest", autenticar);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
app.get("/health", async () => ({ ok: true }));

app.post(
  "/auth/login",
  {
    schema: {
      body: {
        type: "object",
        required: ["username", "senha"],
        properties: { username: { type: "string" }, senha: { type: "string" } },
      },
    },
  },
  async (req, reply) => {
    const { username, senha } = req.body as { username: string; senha: string };
    const [u] = await db.select().from(usuarios).where(eq(usuarios.username, username));
    if (!u || !conferirSenha(senha, u.senhaHash)) {
      return reply.code(401).send({ erro: "usuário ou senha inválidos" });
    }
    const token = await emitirTokenLocal(u);
    return { token, usuario: { nome: u.nome, papel: u.papel } };
  }
);

app.get("/auth/me", async (req) => ({
  nome: (req.user as any)?.nome ?? req.user?.sub,
  papel: (req.user as any)?.papel,
}));

// Config do SSO — GET é público (o SPA precisa saber se mostra o botão de SSO
// e com qual issuer/client_id iniciar o login). PUT só admin (estilo MinIO).
app.get("/config/sso", async () => {
  const { enabled, issuer, clientId } = await getSso();
  return { enabled, issuer, clientId };
});

app.put("/config/sso", { preHandler: exigirPapel("admin") }, async (req) => {
  const body = req.body as { enabled?: boolean; issuer?: string; clientId?: string };
  return setSso({ enabled: !!body.enabled, issuer: body.issuer ?? "", clientId: body.clientId ?? "" });
});

// ---------------------------------------------------------------------------
app.get("/catalogo", async () => Object.values(CATALOGO));

// ---------------------------------------------------------------------------
// POST /vendas — cria a venda E enfileira a emissão na MESMA transação (outbox).
// Agora via Drizzle (db.transaction). O worker Python consome a outbox.
// ---------------------------------------------------------------------------
app.post(
  "/vendas",
  {
    schema: {
      body: {
        type: "object",
        required: ["itens"],
        properties: {
          cliente: {
            type: "object",
            properties: { xNome: { type: "string" }, doc: { type: "string" } },
          },
          parcelas: { type: "integer", minimum: 1, maximum: 12 },
          itens: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["cProd", "qtd"],
              properties: {
                cProd: { type: "string" },
                qtd: { type: "number", exclusiveMinimum: 0 },
              },
            },
          },
        },
      },
    },
  },
  async (req, reply) => {
    const body = req.body as {
      cliente?: { xNome?: string; doc?: string };
      parcelas?: number;
      itens: { cProd: string; qtd: number }[];
    };

    const desconhecido = body.itens.find((it) => !CATALOGO[it.cProd]);
    if (desconhecido) {
      reply.code(400);
      return { erro: `Produto ${desconhecido.cProd} inexistente no catálogo` };
    }
    const itens = body.itens.map((it) => ({ ...CATALOGO[it.cProd], qtd: it.qtd }));
    const cliente = {
      ...CLIENTE_PADRAO,
      ...(body.cliente?.xNome ? { xNome: body.cliente.xNome } : {}),
      ...(body.cliente?.doc ? { doc: body.cliente.doc } : {}),
    };
    const opcoes = { parcelas: body.parcelas ?? 1 };

    const vendaId = await db.transaction(async (tx) => {
      const [v] = await tx.insert(vendas).values({ cliente, itens, opcoes }).returning({ id: vendas.id });
      await tx.insert(outbox).values({ tipo: "nfe.emitir", payload: { venda_id: v.id } });
      return v.id;
    });

    await pool.query("NOTIFY outbox_nova"); // "sino" para o worker
    reply.code(201);
    return { venda_id: vendaId };
  }
);

// ---------------------------------------------------------------------------
// Consultas (Drizzle)
// ---------------------------------------------------------------------------
app.get("/notas", async () => {
  const rows = await db
    .select({
      numero: notasFiscais.numero,
      serie: notasFiscais.serie,
      status: notasFiscais.status,
      cstat: notasFiscais.cstat,
      nprot: notasFiscais.nprot,
      chave: notasFiscais.chave,
      motivo: notasFiscais.motivo,
      atualizadaEm: notasFiscais.atualizadaEm,
      cliente: vendas.cliente,
    })
    .from(notasFiscais)
    .leftJoin(vendas, eq(vendas.id, notasFiscais.vendaId))
    .orderBy(sql`${notasFiscais.numero} DESC NULLS LAST`);
  return rows.map((r) => ({ ...r, cliente: (r.cliente as any)?.xNome ?? "—" }));
});

app.get("/produtos", async () =>
  db.select().from(produtos).orderBy(produtos.cod)
);

app.get("/titulos", async (req) => {
  const tipo = (req.query as { tipo?: string }).tipo;
  const base = db.select().from(titulos);
  const rows = tipo
    ? await base.where(eq(titulos.tipo, tipo)).orderBy(titulos.vencimento)
    : await base.orderBy(titulos.vencimento);
  return rows;
});

app.get("/compras", async () =>
  db.select().from(notasEntrada).orderBy(sql`${notasEntrada.nsu} DESC`)
);

app.get("/dashboard", async () => {
  const one = async (query: ReturnType<typeof sql>) => (await db.execute(query)).rows[0];
  const [notas, estoque, receber, pagar, compras] = await Promise.all([
    one(sql`SELECT
        count(*) FILTER (WHERE status='autorizada') AS autorizadas,
        count(*) FILTER (WHERE status='rejeitada') AS rejeitadas,
        count(*) FILTER (WHERE status NOT IN ('autorizada','rejeitada')) AS pendentes
      FROM notas_fiscais`),
    one(sql`SELECT COALESCE(sum(saldo),0) AS total_saldo, count(*) AS itens FROM produtos`),
    one(sql`SELECT COALESCE(sum(valor),0) AS total, count(*) AS qtd FROM titulos WHERE tipo='receber' AND status='aberto'`),
    one(sql`SELECT COALESCE(sum(valor),0) AS total, count(*) AS qtd FROM titulos WHERE tipo='pagar' AND status='aberto'`),
    one(sql`SELECT count(*) AS qtd FROM notas_entrada`),
  ]);
  return { notas, estoque, receber, pagar, compras };
});

// ---------------------------------------------------------------------------
const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`ERP backend on :${port}`);
});
