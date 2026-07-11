/** Aplica as migrations pendentes e sai. Rodado antes de subir a app. */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

await migrate(db, { migrationsFolder: "./drizzle" });
console.log("migrations aplicadas");
await pool.end();
