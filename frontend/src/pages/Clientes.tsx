import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../api/client.js";
import { Tabela, Tr, Td, Field, input, btnPrim } from "../components/ui.js";

export function Clientes() {
  const [lista, setLista] = useState<any[] | null>(null);
  const vazio = { nome: "", doc: "", logradouro: "", numero: "", bairro: "", codMunicipio: "", municipio: "", uf: "", cep: "" };
  const [novo, setNovo] = useState<any>(vazio);
  const recarregar = () => apiGet("/clientes").then(setLista);
  useEffect(() => { recarregar(); }, []);

  async function criar() {
    if (!novo.nome) return;
    const r = await apiPost("/clientes", novo);
    if (r.id) { setNovo(vazio); recarregar(); }
  }
  async function remover(id: string) { await apiDelete(`/clientes/${id}`); recarregar(); }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
        <h3 className="mb-3 font-semibold">Novo cliente</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Nome" span2><input className={input} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Field>
          <Field label="CPF/CNPJ"><input className={input} value={novo.doc} onChange={(e) => setNovo({ ...novo, doc: e.target.value })} /></Field>
          <Field label="CEP"><input className={input} value={novo.cep} onChange={(e) => setNovo({ ...novo, cep: e.target.value })} /></Field>
          <Field label="Logradouro" span2><input className={input} value={novo.logradouro} onChange={(e) => setNovo({ ...novo, logradouro: e.target.value })} /></Field>
          <Field label="Número"><input className={input} value={novo.numero} onChange={(e) => setNovo({ ...novo, numero: e.target.value })} /></Field>
          <Field label="Bairro"><input className={input} value={novo.bairro} onChange={(e) => setNovo({ ...novo, bairro: e.target.value })} /></Field>
          <Field label="Cód. Município (IBGE)"><input className={input} value={novo.codMunicipio} onChange={(e) => setNovo({ ...novo, codMunicipio: e.target.value })} /></Field>
          <Field label="Município"><input className={input} value={novo.municipio} onChange={(e) => setNovo({ ...novo, municipio: e.target.value })} /></Field>
          <Field label="UF"><input className={input} value={novo.uf} onChange={(e) => setNovo({ ...novo, uf: e.target.value })} /></Field>
        </div>
        <button className={`${btnPrim} mt-4`} onClick={criar}>Adicionar</button>
      </div>
      <Tabela linhas={lista} vazio="Nenhum cliente." cabecalho={["Nome", "CPF/CNPJ", "Município", "UF", ""]}
        render={(c) => (
          <Tr key={c.id}><Td>{c.nome}</Td><Td mono>{c.doc}</Td><Td>{c.municipio}</Td><Td>{c.uf}</Td>
            <Td><button onClick={() => remover(c.id)} className="text-xs text-error hover:underline">excluir</button></Td>
          </Tr>
        )} />
    </div>
  );
}
