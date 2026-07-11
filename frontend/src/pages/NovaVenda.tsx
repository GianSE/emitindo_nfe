import { useState } from "react";
import { apiPost, brl } from "../api/client.js";
import { usePolling } from "../hooks/usePolling.js";
import { input, btnPrim, Field } from "../components/ui.js";

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
    <div className="space-y-4">
      {/* Destinatário / condições */}
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="border-b border-outline-variant bg-surface-container-low px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Destinatário
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
          <div className="sm:col-span-3">
            <Field label="Cliente">
              <select className={input} value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">— destinatário padrão (homologação) —</option>
                {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Parcelas">
            <input type="number" min={1} max={12} value={parcelas} className={input}
              onChange={(e) => setParcelas(Number(e.target.value))} />
          </Field>
        </div>
      </div>

      {/* Itens da venda (grid list-view compacto) */}
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="border-b border-outline-variant bg-surface-container-low px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Itens da venda
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-outline-variant bg-surface-container-low">
              <tr className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-2 text-left">Produto</th>
                <th className="px-3 py-2 text-right">Preço</th>
                <th className="px-3 py-2 text-right">Estoque</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {(produtos ?? []).map((p) => (
                <tr key={p.cod} className="hover:bg-surface-container-low">
                  <td className="px-4 py-1.5 text-sm text-on-surface-variant">{p.nome}</td>
                  <td className="px-3 py-1.5 text-right text-sm text-on-surface-variant">{brl(p.preco)}</td>
                  <td className="px-3 py-1.5 text-right text-sm text-on-surface-variant">{Number(p.saldo).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input type="number" min={0} value={qtd[p.cod] ?? 0} className={`${input} ml-auto !w-24 text-right`}
                      onChange={(e) => setQtd({ ...qtd, [p.cod]: Number(e.target.value) })} />
                  </td>
                  <td className="px-4 py-1.5 text-right text-sm font-medium text-on-surface">{brl((qtd[p.cod] ?? 0) * Number(p.preco))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 border-t border-outline-variant px-4 py-3">
          {msg && <span className="text-sm text-warning">{msg}</span>}
          <div className="ml-auto text-sm text-on-surface-variant">Total: <span className="text-base font-semibold text-on-surface">{brl(total)}</span></div>
          <button className={btnPrim} onClick={enviar}>Emitir NF-e</button>
        </div>
      </div>
    </div>
  );
}
