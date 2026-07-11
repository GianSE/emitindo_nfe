import { defineConfig } from "drizzle-kit";

// drizzle-kit é o DONO do schema: gera migrations SQL a partir de db/schema.ts.
//   npm run db:generate  -> gera nova migration a partir das mudanças no schema
//   npm run db:migrate   -> aplica as migrations pendentes no banco
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://erp:erp@localhost:5433/erp",
  },
});
