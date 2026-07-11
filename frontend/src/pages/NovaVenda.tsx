import { useState } from "react";
import { apiPost, brl } from "../api/client.js";
import { usePolling } from "../hooks/usePolling.js";
import { input, btnPrim } from "../components/ui.js";

export function NovaVenda({ onCriada }: { onCriada: () => void }) {
  const produtos = usePolling<any[]>("/produtos", 60000);
  const clientes = usePolling<any[]>("/clientes", 60000);
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [clienteId, setClienteId] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [msg, setMsg] = useState("");

  const itens = Object.entries(qtd).filter(([, q]) => q > 0).map(([cod, q]) => ({ cod, qtd: q }));
  const total = (produtos ?? []).reduce((s, p) => s + (qtd[p.cod] ?? 0) * Number(p.preco), 0);

  async function enviar() {
    if (itens.length === 0) { setMsg("Selecione ao menos um item."); return; }
    setMsg("enviando…");
    const r = await apiPost("/vendas", { clienteId: clienteId || undefined, parcelas, itens });
    if (r.venda_id) { setMsg(""); onCriada(); } else setMsg(r.erro ?? "erro ao criar venda");
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-6">
      <h2 className="mb-4 text-lg font-bold">Nova venda</h2>
      <label className="mb-1 block text-xs text-muted">Cliente</label>
      <select className={`${input} max-w-sm`} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
        <option value="">— destinatário padrão (homologação) —</option>
        {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2">Produto</th><th>Preço</th><th>Estoque</th><th>Qtd</th><th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(produtos ?? []).map((p) => (
            <tr key={p.cod} className="border-t border-line">
              <td className="py-2.5">{p.nome}</td>
              <td>{brl(p.preco)}</td>
              <td className="text-muted">{Number(p.saldo).toLocaleString("pt-BR")}</td>
              <td>
                <input type="number" min={0} value={qtd[p.cod] ?? 0} className={`${input} w-20`}
                  onChange={(e) => setQtd({ ...qtd, [p.cod]: Number(e.target.value) })} />
              </td>
              <td>{brl((qtd[p.cod] ?? 0) * Number(p.preco))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex flex-wrap items-end gap-5">
        <div>
          <label className="mb-1 block text-xs text-muted">Parcelas</label>
          <input type="number" min={1} max={12} value={parcelas} className={`${input} w-20`}
            onChange={(e) => setParcelas(Number(e.target.value))} />
        </div>
        <div className="ml-auto text-lg">Total: <strong>{brl(total)}</strong></div>
        <button className={btnPrim} onClick={enviar}>Emitir NF-e</button>
      </div>
      {msg && <p className="mt-3 text-sm text-yellow-400">{msg}</p>}
    </div>
  );
}
