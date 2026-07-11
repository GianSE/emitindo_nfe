import { usePolling } from "../hooks/usePolling.js";
import { Tabela, Tr, Td } from "../components/ui.js";

export function Estoque() {
  const p = usePolling<any[]>("/produtos");
  return (
    <Tabela linhas={p} vazio="—" cabecalho={["Código", "Produto", "Saldo"]}
      render={(x) => (
        <Tr key={x.cod}><Td mono>{x.cod}</Td><Td>{x.nome}</Td>
          <Td><strong>{Number(x.saldo).toLocaleString("pt-BR")}</strong></Td></Tr>
      )} />
  );
}
