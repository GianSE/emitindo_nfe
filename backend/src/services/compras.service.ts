import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { notasEntrada } from "../db/schema.js";

export const listar = () =>
  db.select().from(notasEntrada).orderBy(sql`${notasEntrada.nsu} DESC`);
