import { useEffect, useRef, useState } from "react";
import { apiGet } from "../api/client.js";
import { Icon } from "./icons.js";

type Resultado = { grupo: string; icone: string; titulo: string; sub?: string; aba: string };

/** Busca global do ERP: acha produtos, clientes, notas e títulos e navega até a tela. */
export function GlobalSearch({ onNavigate }: { onNavigate: (aba: string) => void }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<{ produtos: any[]; clientes: any[]; notas: any[]; titulos: any[]; fornecedores: any[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // carrega os dados uma vez (na 1ª abertura)
  async function carregar() {
    if (dados) return;
    const [produtos, clientes, notas, titulos, fornecedores] = await Promise.all([
      apiGet<any[]>("/produtos").catch(() => []),
      apiGet<any[]>("/clientes").catch(() => []),
      apiGet<any[]>("/notas").catch(() => []),
      apiGet<any[]>("/titulos").catch(() => []),
      apiGet<any[]>("/fornecedores").catch(() => []),
    ]);
    setDados({ produtos, clientes, notas, titulos, fornecedores });
  }

  // atalho Ctrl/Cmd+K e Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // fecha ao clicar fora
  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const termo = q.trim().toLowerCase();
  const inc = (s: any) => String(s ?? "").toLowerCase().includes(termo);
  const res: Resultado[] = [];
  if (termo && dados) {
    for (const p of dados.produtos) if (inc(p.cod) || inc(p.nome) || inc(p.ncm))
      res.push({ grupo: "Produto", icone: "produto", titulo: p.nome, sub: `cód ${p.cod} · R$ ${p.preco}`, aba: "Produtos" });
    for (const c of dados.clientes) if (inc(c.nome) || inc(c.doc) || inc(c.municipio))
      res.push({ grupo: "Cliente", icone: "cliente", titulo: c.nome, sub: c.doc ?? "", aba: "Clientes" });
    for (const n of dados.notas) if (inc(n.numero) || inc(n.cliente) || inc(n.chave) || inc(n.nprot))
      res.push({ grupo: "Nota", icone: "nota", titulo: `NF nº ${n.numero ?? "—"} · ${n.cliente}`, sub: n.chave ?? n.nprot ?? "", aba: "Notas" });
    for (const t of dados.titulos) if (inc(t.descricao) || inc(t.origemChave))
      res.push({ grupo: "Financeiro", icone: "financeiro", titulo: t.descricao, sub: `${t.tipo} · R$ ${t.valor}`, aba: "Financeiro" });
    for (const f of dados.fornecedores) if (inc(f.cnpj) || inc(f.nome))
      res.push({ grupo: "Fornecedor", icone: "fornecedor", titulo: f.nome ?? f.cnpj, sub: f.cnpj, aba: "Fornecedores" });
  }
  const lista = res.slice(0, 12);

  return (
    <div ref={boxRef} className="relative">
      <Icon name="busca" size={18} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-outline" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setAberto(true); }}
        onFocus={() => { setAberto(true); carregar(); }}
        placeholder="Buscar produtos, clientes, notas…"
        className="w-64 rounded-md border border-outline-variant bg-surface-container-lowest py-1.5 pl-9 pr-14 text-sm outline-none transition focus:w-80 focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-outline-variant bg-surface-container px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">Ctrl K</kbd>

      {aberto && termo && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-96 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
          {lista.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-on-surface-variant">
              {dados ? <>Nada encontrado para <span className="font-semibold text-on-surface">"{q}"</span></> : "carregando índice…"}
            </div>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {lista.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => { onNavigate(r.aba); setAberto(false); setQ(""); }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-surface-container-low"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded bg-surface-container text-on-surface-variant">
                      <Icon name={r.icone} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-on-surface">{r.titulo}</span>
                      {r.sub && <span className="mono block truncate font-mono text-[11px] text-on-surface-variant">{r.sub}</span>}
                    </span>
                    <span className="text-label-caps uppercase text-outline">{r.grupo}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
