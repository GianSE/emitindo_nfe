import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { fornecedores } from "../db/schema.js";

export const listar = () => db.select().from(fornecedores).orderBy(fornecedores.nome);

export async function criar(f: any) {
  const [row] = await db.insert(fornecedores)
    .values({ cnpj: f.cnpj, nome: f.nome })
    .onConflictDoUpdate({ target: fornecedores.cnpj, set: { nome: f.nome } })
    .returning({ id: fornecedores.id });
  return row.id;
}

export const atualizar = (id: string, f: any) =>
  db.update(fornecedores).set({ nome: f.nome }).where(eq(fornecedores.id, id));

export const remover = (id: string) => db.delete(fornecedores).where(eq(fornecedores.id, id));
