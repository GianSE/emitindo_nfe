import { apiGet } from "../api/client.js";
import { usePolling } from "../hooks/usePolling.js";
import { Tabela, Tr, Td, StatusBadge } from "../components/ui.js";

async function baixar(chave: string, tipo: "xml" | "danfe") {
  const r = await apiGet<{ url?: string }>(`/notas/${chave}/arquivo-url?tipo=${tipo}`);
  if (r.url) window.open(r.url, "_blank");
}

export function Notas() {
  const notas = usePolling<any[]>("/notas");
  return (
    <Tabela linhas={notas} vazio="Nenhuma nota ainda — crie uma venda."
      cabecalho={["Nº", "Cliente", "Status", "Protocolo", "Chave", "Arquivos"]}
      render={(n) => (
        <Tr key={n.chave ?? n.numero}>
          <Td>{n.numero ?? "—"}</Td><Td>{n.cliente}</Td>
          <Td><StatusBadge s={n.status} motivo={n.motivo} /></Td>
          <Td>{n.nprot ?? "—"}</Td>
          <Td mono>{n.chave ? "…" + n.chave.slice(-12) : "—"}</Td>
          <Td>
            {n.armazenado ? (
              <span className="flex gap-3 text-xs">
                <button onClick={() => baixar(n.chave, "xml")} className="text-primary hover:underline">XML</button>
                <button onClick={() => baixar(n.chave, "danfe")} className="text-primary hover:underline">DANFE</button>
              </span>
            ) : <span className="text-xs text-on-surface-variant">—</span>}
          </Td>
        </Tr>
      )} />
  );
}
