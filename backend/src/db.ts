import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

// Local (fora do Docker) usa a porta 5433 mapeada; no compose, 5432.
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://erp:erp@localhost:5433/erp";

// Pool cru — usado para o NOTIFY (que o Drizzle não abstrai).
export const pool = new pg.Pool({ connectionString });

// Instância do Drizzle (ORM) sobre o mesmo pool.
export const db = drizzle(pool, { schema });
