import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../api/client.js";
import { Tabela, Tr, Td, Field, input, btnPrim } from "../components/ui.js";

export function Fornecedores() {
  const [lista, setLista] = useState<any[] | null>(null);
  const [novo, setNovo] = useState({ cnpj: "", nome: "" });
  const recarregar = () => apiGet("/fornecedores").then(setLista);
  useEffect(() => { recarregar(); }, []);

  async function criar() {
    if (!novo.cnpj) return;
    const r = await apiPost("/fornecedores", novo);
    if (r.id) { setNovo({ cnpj: "", nome: "" }); recarregar(); }
  }
  async function remover(id: string) { await apiDelete(`/fornecedores/${id}`); recarregar(); }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
        <h3 className="mb-3 font-semibold">Novo fornecedor</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="CNPJ"><input className={input} value={novo.cnpj} onChange={(e) => setNovo({ ...novo, cnpj: e.target.value })} /></Field>
          <Field label="Nome" span2><input className={input} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Field>
        </div>
        <button className={`${btnPrim} mt-4`} onClick={criar}>Adicionar</button>
        <p className="mt-2 text-xs text-on-surface-variant">
          Fornecedores também são criados automaticamente ao receber notas via Distribuição DFe.
        </p>
      </div>
      <Tabela linhas={lista} vazio="Nenhum fornecedor." cabecalho={["CNPJ", "Nome", ""]}
        render={(f) => (
          <Tr key={f.id}>
            <Td mono>{f.cnpj}</Td>
            <Td>{f.nome}</Td>
            <Td><button onClick={() => remover(f.id)} className="text-xs text-error hover:underline">excluir</button></Td>
          </Tr>
        )} />
    </div>
  );
}
