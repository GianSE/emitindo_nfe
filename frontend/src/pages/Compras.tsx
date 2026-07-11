import { usePolling } from "../hooks/usePolling.js";
import { Tabela, Tr, Td } from "../components/ui.js";

export function Compras() {
  const c = usePolling<any[]>("/compras");
  return (
    <Tabela linhas={c} vazio="Nenhuma nota de fornecedor recebida."
      cabecalho={["NSU", "Fornecedor (CNPJ)", "Chave", "Manifestação"]}
      render={(n) => (
        <Tr key={n.chave}><Td>{n.nsu}</Td><Td mono>{n.cnpjEmitente ?? n.cnpj_emitente}</Td>
          <Td mono>…{String(n.chave).slice(-12)}</Td>
          <Td>{n.manifestacao ? <span className="rounded-full bg-success/100/15 px-2 py-0.5 text-xs text-success">✓ {n.manifestacao}</span> : "—"}</Td>
        </Tr>
      )} />
  );
}
