import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { vendas, vendaItens, outbox, produtos, clientes } from "../db/schema.js";
import { clienteParaDest } from "./clientes.service.js";
import { CLIENTE_PADRAO } from "../lib/catalogo.js";

export interface VendaInput {
  clienteId?: string;
  parcelas?: number;
  itens: { cod: string; qtd: number }[];
}

/** Cria a venda e enfileira a emissão na MESMA transação (outbox). */
export async function criarVenda(body: VendaInput): Promise<{ venda_id?: string; erro?: string }> {
  const cods = body.itens.map((i) => i.cod);
  const prods = await db.select().from(produtos).where(inArray(produtos.cod, cods));
  const mapa = new Map(prods.map((p) => [p.cod, p]));
  const faltando = cods.find((c) => !mapa.has(c));
  if (faltando) return { erro: `Produto ${faltando} inexistente` };

  const itens = body.itens.map((it) => {
    const p = mapa.get(it.cod)!;
    return {
      cProd: p.cod, xProd: p.nome, NCM: p.ncm, CFOP: p.cfop,
      uCom: p.unidade ?? "UN", qtd: it.qtd, vUnit: String(p.preco ?? 0),
    };
  });

  let cliente: any = CLIENTE_PADRAO;
  let clienteId: string | null = null;
  if (body.clienteId) {
    const [c] = await db.select().from(clientes).where(eq(clientes.id, body.clienteId));
    if (c) { cliente = clienteParaDest(c); clienteId = c.id; }
  }
  const opcoes = { parcelas: body.parcelas ?? 1 };

  const vendaId = await db.transaction(async (tx) => {
    // snapshot fiscal (jsonb) + referências (cliente_id FK)
    const [v] = await tx.insert(vendas).values({ clienteId, cliente, itens, opcoes }).returning({ id: vendas.id });
    // itens em formato relacional (FK -> produtos), além do snapshot jsonb
    await tx.insert(vendaItens).values(
      body.itens.map((it) => {
        const p = mapa.get(it.cod)!;
        return { vendaId: v.id, produtoCod: p.cod, qtd: String(it.qtd), precoUnit: String(p.preco ?? 0) };
      })
    );
    await tx.insert(outbox).values({ tipo: "nfe.emitir", payload: { venda_id: v.id } });
    return v.id;
  });

  await pool.query("NOTIFY outbox_nova");
  return { venda_id: vendaId };
}
