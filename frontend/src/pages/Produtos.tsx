import { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete, brl } from "../api/client.js";
import { Tabela, Tr, Td, Field, input, btnPrim } from "../components/ui.js";

export function Produtos() {
  const [lista, setLista] = useState<any[] | null>(null);
  const vazio = { cod: "", nome: "", preco: 0, ncm: "", cfop: "6102", unidade: "UN", saldo: 0 };
  const [novo, setNovo] = useState<any>(vazio);
  const [msg, setMsg] = useState("");
  const recarregar = () => apiGet("/produtos").then(setLista);
  useEffect(() => { recarregar(); }, []);

  async function criar() {
    if (!novo.cod || !novo.nome) { setMsg("cod e nome são obrigatórios"); return; }
    const r = await apiPost("/produtos", { ...novo, preco: Number(novo.preco), saldo: Number(novo.saldo) });
    if (r.ok) { setMsg(""); setNovo(vazio); recarregar(); } else setMsg(r.erro ?? "erro");
  }
  async function remover(cod: string) { await apiDelete(`/produtos/${cod}`); recarregar(); }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-panel p-5">
        <h3 className="mb-3 font-semibold">Novo produto</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Código"><input className={input} value={novo.cod} onChange={(e) => setNovo({ ...novo, cod: e.target.value })} /></Field>
          <Field label="Nome" span2><input className={input} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Field>
          <Field label="Preço"><input type="number" className={input} value={novo.preco} onChange={(e) => setNovo({ ...novo, preco: e.target.value })} /></Field>
          <Field label="NCM"><input className={input} value={novo.ncm} onChange={(e) => setNovo({ ...novo, ncm: e.target.value })} /></Field>
          <Field label="CFOP"><input className={input} value={novo.cfop} onChange={(e) => setNovo({ ...novo, cfop: e.target.value })} /></Field>
          <Field label="Unidade"><input className={input} value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value })} /></Field>
          <Field label="Saldo inicial"><input type="number" className={input} value={novo.saldo} onChange={(e) => setNovo({ ...novo, saldo: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className={btnPrim} onClick={criar}>Adicionar</button>
          {msg && <span className="text-sm text-yellow-400">{msg}</span>}
        </div>
      </div>
      <Tabela linhas={lista} vazio="Nenhum produto." cabecalho={["Cód", "Nome", "Preço", "NCM", "CFOP", "UN", "Saldo", ""]}
        render={(p) => (
          <Tr key={p.cod}><Td mono>{p.cod}</Td><Td>{p.nome}</Td><Td>{brl(p.preco)}</Td>
            <Td mono>{p.ncm}</Td><Td>{p.cfop}</Td><Td>{p.unidade}</Td><Td>{Number(p.saldo).toLocaleString("pt-BR")}</Td>
            <Td><button onClick={() => remover(p.cod)} className="text-xs text-red-400 hover:underline">excluir</button></Td>
          </Tr>
        )} />
    </div>
  );
}
