import type { ReactNode } from "react";
import { Icon } from "./icons.js";

/* classes reutilizáveis (usam os tokens semânticos de styles.css) */
export const input =
  "w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/25";
export const btnPrim =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-ink shadow-sm transition hover:brightness-110 active:brightness-95 disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel2 px-4 py-2 text-sm font-medium text-ink transition hover:bg-panel";

/* Cabeçalho de página (título + subtítulo + ação opcional) */
export function PageHeader({ titulo, subtitulo, acao }: { titulo: string; subtitulo?: string; acao?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-sm text-muted">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

/* Cartão de estatística do dashboard (com ícone e cor de acento) */
const CORES: Record<string, string> = {
  brand: "text-brand bg-brand/10",
  green: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  red: "text-red-600 dark:text-red-400 bg-red-500/10",
  violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
};
export function StatCard({ titulo, valor, rodape, icone, cor = "brand" }:
  { titulo: string; valor: ReactNode; rodape?: string; icone: string; cor?: keyof typeof CORES }) {
  return (
    <div className="themed rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{titulo}</span>
        <span className={`grid size-9 place-items-center rounded-lg ${CORES[cor]}`}>
          <Icon name={icone} className="size-5" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{valor}</div>
      {rodape && <div className="mt-1 text-xs text-muted">{rodape}</div>}
    </div>
  );
}

/* Painel/cartão genérico */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`themed rounded-2xl border border-line bg-panel p-5 shadow-sm ${className}`}>{children}</div>;
}

export function StatusBadge({ s, motivo }: { s: string; motivo?: string }) {
  const cor: Record<string, string> = {
    autorizada: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    rejeitada: "bg-red-500/12 text-red-600 dark:text-red-400",
    pendente: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  };
  return <span title={motivo ?? ""} className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cor[s] ?? "bg-panel2 text-muted"}`}>{s}</span>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">{children}</span>;
}

export function Field({ label, children, span2 }: { label: string; children: ReactNode; span2?: boolean }) {
  return (
    <label className={`block text-xs font-medium text-muted ${span2 ? "col-span-2" : ""}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-t border-line transition hover:bg-panel2/70">{children}</tr>;
}
export function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-3 text-sm ${mono ? "font-mono text-xs text-muted" : ""}`}>{children}</td>;
}

export function Tabela({ linhas, cabecalho, render, vazio }: {
  linhas: any[] | null; cabecalho: string[]; render: (l: any, i: number) => ReactNode; vazio: string;
}) {
  if (!linhas) return <p className="py-6 text-sm text-muted">carregando…</p>;
  if (linhas.length === 0) return <div className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">{vazio}</div>;
  return (
    <div className="themed overflow-x-auto rounded-2xl border border-line bg-panel shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-panel2/50 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
            {cabecalho.map((c) => <th key={c} className="px-4 py-3">{c}</th>)}
          </tr>
        </thead>
        <tbody>{linhas.map(render)}</tbody>
      </table>
    </div>
  );
}
