import type { ReactNode } from "react";
import { Icon } from "./icons.js";

/* Inputs / botões (Nexus) — borda visível, foco azul com glow sutil */
export const input =
  "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20";
export const btnPrim =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-primary-container px-3 py-1.5 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-low";

export function PageHeader({ titulo, subtitulo, acao }: { titulo: string; subtitulo?: string; acao?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-headline-md text-on-background">{titulo}</h2>
        {subtitulo && <p className="mt-0.5 text-sm text-on-surface-variant">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

/* Card genérico (Level 1): superfície branca, borda 1px, shadow-sm */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm ${className}`}>{children}</div>;
}

/* KPI card do dashboard: label-caps + número display + rodapé + barra de acento */
const CORES: Record<string, { fg: string; bar: string }> = {
  primary: { fg: "text-primary-container", bar: "bg-primary-container" },
  tertiary: { fg: "text-tertiary-container", bar: "bg-tertiary-container" },
  neutral: { fg: "text-on-surface-variant", bar: "bg-outline-variant" },
  error: { fg: "text-error", bar: "bg-error" },
  success: { fg: "text-success", bar: "bg-success" },
};
export function StatCard({ titulo, valor, icone, cor = "primary", rodape, barra = 33 }:
  { titulo: string; valor: ReactNode; icone: string; cor?: keyof typeof CORES; rodape?: ReactNode; barra?: number }) {
  const c = CORES[cor];
  return (
    <div className="group relative overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <span className="text-label-caps uppercase text-on-surface-variant">{titulo}</span>
        <Icon name={icone} size={22} className={c.fg} />
      </div>
      <div className="mono mb-1 text-display-lg text-on-background">{valor}</div>
      {rodape && <div className="flex items-center gap-1 text-sm text-on-surface-variant">{rodape}</div>}
      <div className={`absolute bottom-0 left-0 h-1 ${c.bar}`} style={{ width: `${barra}%` }} />
    </div>
  );
}

/* Chips de status (fundo 10% + texto + borda) */
export function StatusBadge({ s, motivo }: { s: string; motivo?: string }) {
  const cor: Record<string, string> = {
    autorizada: "bg-success/10 text-success border-success/30",
    rejeitada: "bg-error/10 text-error border-error/30",
    pendente: "bg-warning/10 text-warning border-warning/30",
  };
  return <span title={motivo ?? ""} className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${cor[s] ?? "border-outline-variant bg-surface-container text-on-surface-variant"}`}>{s}</span>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{children}</span>;
}

/* Label sempre visível, acima do input */
export function Field({ label, children, span2 }: { label: string; children: ReactNode; span2?: boolean }) {
  return (
    <label className={`block text-xs font-semibold text-on-surface-variant ${span2 ? "col-span-2" : ""}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition hover:bg-surface-container-low">{children}</tr>;
}
export function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 text-sm text-on-surface-variant ${mono ? "mono font-mono text-[13px] text-on-surface" : ""}`}>{children}</td>;
}

/* Data table (list-view): header label-caps, linhas divididas, densa */
export function Tabela({ linhas, cabecalho, render, vazio }: {
  linhas: any[] | null; cabecalho: string[]; render: (l: any, i: number) => ReactNode; vazio: string;
}) {
  if (!linhas) return <p className="py-6 text-sm text-on-surface-variant">carregando…</p>;
  if (linhas.length === 0) return <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest py-10 text-center text-sm text-on-surface-variant">{vazio}</div>;
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm">
      <table className="w-full">
        <thead className="border-b border-outline-variant bg-surface-container-low">
          <tr className="text-left text-label-caps uppercase text-on-surface-variant">
            {cabecalho.map((c) => <th key={c} className="px-3 py-2.5">{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">{linhas.map(render)}</tbody>
      </table>
    </div>
  );
}
