/** Semeia dados iniciais (admin, config SSO, produtos e cliente demo). */
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { usuarios, produtos, clientes, numeracao, consumidores, dfeCursor } from "../db/schema.js";
import { hashSenha } from "../lib/senha.js";
import { getSso, setSso } from "../lib/sso.js";
import { existeEmpresa, setEmpresa, EMPRESA_PADRAO } from "../lib/empresa.js";

export async function seed(log: (m: string) => void) {
  // linhas de controle (idempotentes)
  await db.insert(numeracao).values({ serie: 1, proximoNumero: 1 }).onConflictDoNothing();
  await db.insert(dfeCursor).values({ id: 1, ultNsu: 0 }).onConflictDoNothing();
  await db.insert(consumidores).values([{ nome: "estoque" }, { nome: "financeiro" }]).onConflictDoNothing();

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(usuarios);
  if (Number(count) === 0) {
    await db.insert(usuarios).values({
      username: "admin", senhaHash: hashSenha("admin"), nome: "Administrador", papel: "admin",
    });
    log("usuário inicial criado -> admin / admin (troque a senha!)");
  }

  const [{ count: nprod }] = await db.select({ count: sql<number>`count(*)::int` }).from(produtos);
  if (Number(nprod) === 0) {
    await db.insert(produtos).values([
      { cod: "001", nome: "CAMISETA ALGODAO AZUL M", saldo: "100", ncm: "61091000", cfop: "6102", unidade: "UN", preco: "49.90" },
      { cod: "002", nome: "CALCA JEANS PRETA 42", saldo: "100", ncm: "62034200", cfop: "6102", unidade: "UN", preco: "129.90" },
    ]);
  }

  const [{ count: ncli }] = await db.select({ count: sql<number>`count(*)::int` }).from(clientes);
  if (Number(ncli) === 0) {
    await db.insert(clientes).values({
      nome: "LOJA CENTRO RJ", doc: "11122233396", logradouro: "AVENIDA BRASIL", numero: "500",
      bairro: "JARDIM", codMunicipio: "3304557", municipio: "RIO DE JANEIRO", uf: "RJ", cep: "20040002",
    });
  }

  if (!(await getSso())) await setSso({ enabled: false, issuer: "", clientId: "" });
  if (!(await existeEmpresa())) await setEmpresa(EMPRESA_PADRAO);
}
