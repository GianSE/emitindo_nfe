/** Cria o usuário admin inicial e a config de SSO padrão (na 1ª subida). */
import { sql } from "drizzle-orm";
import { db } from "./db.js";
import { usuarios } from "./schema.js";
import { hashSenha } from "./auth.js";
import { getSso, setSso } from "./config.js";

export async function seed(log: (m: string) => void) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usuarios);

  if (Number(count) === 0) {
    await db.insert(usuarios).values({
      username: "admin",
      senhaHash: hashSenha("admin"),
      nome: "Administrador",
      papel: "admin",
    });
    log("usuário inicial criado -> admin / admin (troque a senha!)");
  }

  // garante a linha de config do SSO (desligado por padrão)
  const sso = await getSso();
  if (!sso) await setSso({ enabled: false, issuer: "", clientId: "" });
}
