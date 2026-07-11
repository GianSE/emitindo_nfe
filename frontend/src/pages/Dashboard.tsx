import { usePolling } from "../hooks/usePolling.js";
import { brl } from "../api/client.js";
import { StatCard } from "../components/ui.js";

export function Dashboard() {
  const d = usePolling<any>("/dashboard");
  if (!d) return <p className="py-6 text-muted">carregando…</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard titulo="Notas autorizadas" valor={d.notas.autorizadas} icone="nota" cor="brand"
        rodape={`${d.notas.pendentes} pendentes · ${d.notas.rejeitadas} rejeitadas`} />
      <StatCard titulo="Itens em estoque" valor={Number(d.estoque.total_saldo).toLocaleString("pt-BR")}
        icone="estoque" cor="brand" rodape={`${d.estoque.itens} produtos`} />
      <StatCard titulo="Compras recebidas" valor={d.compras.qtd} icone="compras" cor="violet"
        rodape="via Distribuição DFe" />
      <StatCard titulo="Contas a receber" valor={brl(d.receber.total)} icone="financeiro" cor="green"
        rodape={`${d.receber.qtd} títulos em aberto`} />
      <StatCard titulo="Contas a pagar" valor={brl(d.pagar.total)} icone="financeiro" cor="red"
        rodape={`${d.pagar.qtd} títulos em aberto`} />
    </div>
  );
}
