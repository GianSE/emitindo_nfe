import { usePolling } from "../hooks/usePolling.js";
import { brl } from "../api/client.js";
import { StatCard, StatusBadge } from "../components/ui.js";
import { Icon } from "../components/icons.js";

export function Dashboard() {
  const d = usePolling<any>("/dashboard");
  const notas = usePolling<any[]>("/notas");
  if (!d) return <p className="py-6 text-on-surface-variant">carregando…</p>;

  const rec = Number(d.receber.total), pag = Number(d.pagar.total);
  const max = Math.max(rec, pag, 1);
  const saldo = rec - pag;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Notas autorizadas" valor={d.notas.autorizadas} icone="nota" cor="primary" barra={70}
          rodape={<><Icon name="ok" size={16} className="text-success" /><span>{d.notas.pendentes} pendentes · {d.notas.rejeitadas} rejeitadas</span></>} />
        <StatCard titulo="Itens em estoque" valor={Number(d.estoque.total_saldo).toLocaleString("pt-BR")} icone="estoque" cor="neutral" barra={55}
          rodape={<span>{d.estoque.itens} produtos ativos</span>} />
        <StatCard titulo="A receber" valor={brl(d.receber.total)} icone="financeiro" cor="success" barra={Math.round(rec / max * 100)}
          rodape={<><Icon name="trend_up" size={16} className="text-success" /><span>{d.receber.qtd} títulos em aberto</span></>} />
        <StatCard titulo="A pagar" valor={brl(d.pagar.total)} icone="financeiro" cor="error" barra={Math.round(pag / max * 100)}
          rodape={<><Icon name="trend_down" size={16} className="text-error" /><span>{d.pagar.qtd} títulos em aberto</span></>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Últimas notas (feed) */}
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <h3 className="text-headline-sm text-on-background">Últimas notas emitidas</h3>
            <span className="flex items-center gap-1 text-xs text-on-surface-variant"><Icon name="sync" size={14} /> atualizado agora</span>
          </div>
          <ul className="divide-y divide-outline-variant">
            {(notas ?? []).slice(0, 6).map((n) => (
              <li key={n.chave ?? n.numero} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface-container-low">
                <div className={`grid size-8 shrink-0 place-items-center rounded-full ${n.status === "autorizada" ? "bg-success/10 text-success" : n.status === "rejeitada" ? "bg-error/10 text-error" : "bg-surface-container text-on-surface-variant"}`}>
                  <Icon name={n.status === "rejeitada" ? "alerta" : "ok"} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-on-background">
                    NF <span className="mono font-mono text-[13px] text-primary">nº {n.numero ?? "—"}</span> · {n.cliente}
                  </p>
                  <p className="mono truncate font-mono text-[11px] text-on-surface-variant">{n.chave ? "…" + n.chave.slice(-18) : "sem chave"}</p>
                </div>
                <StatusBadge s={n.status} motivo={n.motivo} />
              </li>
            ))}
            {(!notas || notas.length === 0) && <li className="px-4 py-8 text-center text-sm text-on-surface-variant">Nenhuma nota emitida ainda.</li>}
          </ul>
        </div>

        {/* Resumo financeiro */}
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
          <h3 className="mb-4 text-headline-sm text-on-background">Resumo financeiro</h3>
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">A receber</span>
                <span className="mono font-mono font-semibold text-success">{brl(rec)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-success" style={{ width: `${(rec / max) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">A pagar</span>
                <span className="mono font-mono font-semibold text-error">{brl(pag)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-error" style={{ width: `${(pag / max) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-outline-variant pt-3">
              <span className="text-label-caps uppercase text-on-surface-variant">Saldo</span>
              <span className={`mono font-mono text-lg font-bold ${saldo >= 0 ? "text-success" : "text-error"}`}>{brl(saldo)}</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
              <Icon name="compras" size={18} className="text-tertiary-container" />
              <span><strong className="text-on-background">{d.compras.qtd}</strong> compras recebidas (Distribuição DFe)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
