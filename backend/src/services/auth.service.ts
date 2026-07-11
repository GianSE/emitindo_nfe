import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { usuarios } from "../db/schema.js";
import { conferirSenha } from "../lib/senha.js";
import { emitirTokenLocal } from "../lib/tokens.js";

export async function login(username: string, senha: string) {
  const [u] = await db.select().from(usuarios).where(eq(usuarios.username, username));
  if (!u || !conferirSenha(senha, u.senhaHash)) return null;
  const token = await emitirTokenLocal(u);
  return { token, usuario: { nome: u.nome, papel: u.papel } };
}
