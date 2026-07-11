import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client.js";
import { input, btnPrim, Field } from "./ui.js";

/** Cadastro do EMITENTE (vai no <emit> da NF-e). Antes ficava fixo no worker. */
export function EmpresaForm() {
  const [e, setE] = useState<any | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { apiGet("/empresa").then(setE).catch(() => {}); }, []);
  if (!e) return null;

  const set = (k: string, v: any) => setE({ ...e, [k]: v });
  async function salvar() {
    setMsg("salvando…");
    await apiPut("/empresa", e);
    setMsg("✔ emitente salvo — as próximas notas usam esses dados.");
  }

  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-lowest p-4">
      <h2 className="text-headline-sm text-on-background">Empresa (emitente)</h2>
      <p className="mb-3 mt-1 text-sm text-on-surface-variant">
        Dados que vão no grupo <code className="rounded bg-surface-container px-1.5">&lt;emit&gt;</code> da NF-e.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="CNPJ"><input className={input} value={e.CNPJ} onChange={(ev) => set("CNPJ", ev.target.value)} /></Field>
        <Field label="Razão social" span2><input className={input} value={e.xNome} onChange={(ev) => set("xNome", ev.target.value)} /></Field>
        <Field label="Nome fantasia"><input className={input} value={e.xFant} onChange={(ev) => set("xFant", ev.target.value)} /></Field>
        <Field label="Inscrição Estadual"><input className={input} value={e.IE} onChange={(ev) => set("IE", ev.target.value)} /></Field>
        <Field label="Regime (CRT)">
          <select className={input} value={e.CRT} onChange={(ev) => set("CRT", ev.target.value)}>
            <option value="1">1 · Simples Nacional</option>
            <option value="3">3 · Regime Normal</option>
          </select>
        </Field>
        <Field label="Ambiente">
          <select className={input} value={e.ambiente} onChange={(ev) => set("ambiente", ev.target.value)}>
            <option value="2">2 · Homologação</option>
            <option value="1">1 · Produção</option>
          </select>
        </Field>
        <Field label="Telefone"><input className={input} value={e.fone} onChange={(ev) => set("fone", ev.target.value)} /></Field>
        <Field label="Logradouro" span2><input className={input} value={e.xLgr} onChange={(ev) => set("xLgr", ev.target.value)} /></Field>
        <Field label="Número"><input className={input} value={e.nro} onChange={(ev) => set("nro", ev.target.value)} /></Field>
        <Field label="Bairro"><input className={input} value={e.xBairro} onChange={(ev) => set("xBairro", ev.target.value)} /></Field>
        <Field label="Cód. Município (IBGE)"><input className={input} value={e.cMun} onChange={(ev) => set("cMun", ev.target.value)} /></Field>
        <Field label="Município"><input className={input} value={e.xMun} onChange={(ev) => set("xMun", ev.target.value)} /></Field>
        <Field label="UF"><input className={input} value={e.UF} onChange={(ev) => set("UF", ev.target.value)} /></Field>
        <Field label="cUF (IBGE)"><input className={input} value={e.cUF} onChange={(ev) => set("cUF", ev.target.value)} /></Field>
        <Field label="CEP"><input className={input} value={e.CEP} onChange={(ev) => set("CEP", ev.target.value)} /></Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className={btnPrim} onClick={salvar}>Salvar emitente</button>
        {msg && <span className="text-sm text-on-surface-variant">{msg}</span>}
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">
        Quando tiver o certificado A1 (.pfx), troca-se o provider para o modo real — estes dados continuam valendo.
      </p>
    </div>
  );
}
