import { brl, data } from "../api/client.js";
import { usePolling } from "../hooks/usePolling.js";
import { Tabela, Tr, Td } from "../components/ui.js";

export function Financeiro() {
  const receber = usePolling<any[]>("/titulos?tipo=receber");
  const pagar = usePolling<any[]>("/titulos?tipo=pagar");
  const tab = (linhas: any[] | null) => (
    <Tabela linhas={linhas} vazio="—" cabecalho={["Descrição", "Parc.", "Venc.", "Valor"]}
      render={(t, i) => (
        <Tr key={i}><Td>{t.descricao}</Td><Td>{t.parcela}/{t.totalParcelas ?? t.total_parcelas}</Td>
          <Td>{data(t.vencimento)}</Td><Td>{brl(t.valor)}</Td></Tr>
      )} />
  );
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div><h3 className="mb-2 font-semibold text-success">A receber (vendas)</h3>{tab(receber)}</div>
      <div><h3 className="mb-2 font-semibold text-error">A pagar (compras)</h3>{tab(pagar)}</div>
    </div>
  );
}
