import { useEffect, useState } from "react";
import { initAuth, logout, getUsuario, type Usuario } from "./auth/auth.js";
import { useTheme } from "./hooks/useTheme.js";
import { Icon } from "./components/icons.js";
import { Login } from "./pages/Login.js";
import { Dashboard } from "./pages/Dashboard.js";
import { NovaVenda } from "./pages/NovaVenda.js";
import { Notas } from "./pages/Notas.js";
import { Produtos } from "./pages/Produtos.js";
import { Clientes } from "./pages/Clientes.js";
import { Estoque } from "./pages/Estoque.js";
import { Financeiro } from "./pages/Financeiro.js";
import { Compras } from "./pages/Compras.js";
import { Configuracoes } from "./pages/Configuracoes.js";

type Item = { aba: string; icone: string; admin?: boolean };
const NAV: Item[] = [
  { aba: "Dashboard", icone: "dashboard" },
  { aba: "Nova Venda", icone: "venda" },
  { aba: "Notas", icone: "nota" },
  { aba: "Produtos", icone: "produto" },
  { aba: "Clientes", icone: "cliente" },
  { aba: "Estoque", icone: "estoque" },
  { aba: "Financeiro", icone: "financeiro" },
  { aba: "Compras", icone: "compras" },
  { aba: "Configurações", icone: "config", admin: true },
];

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pronto, setPronto] = useState(false);
  const [aba, setAba] = useState("Dashboard");
  const { tema, alternar } = useTheme();

  useEffect(() => { initAuth().then((u) => { setUsuario(u); setPronto(true); }); }, []);

  if (!pronto) return <div className="grid min-h-screen place-items-center text-muted">carregando…</div>;
  if (!usuario) return <Login onEntrar={() => setUsuario(getUsuario())} />;

  const itens = NAV.filter((i) => !i.admin || usuario.papel === "admin");

  return (
    <div className="min-h-screen">
      {/* -------- Sidebar: rail de ícones que EXPANDE no hover, SOBREPONDO o conteúdo --------
          transition-all (não 'themed') p/ animar largura+sombra+cores; sem 'themed' porque a
          regra global fora de layer sobrescreveria a transição de width. -------- */}
      <aside className="group fixed inset-y-0 left-0 z-30 flex w-16 flex-col overflow-hidden
        border-r border-line bg-panel transition-all duration-300 ease-in-out will-change-[width] hover:w-60 hover:shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm">🏭</span>
          <div className="whitespace-nowrap leading-tight opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:delay-100">
            <div className="text-sm font-bold">ERP · CD</div>
            <div className="text-[11px] text-muted">Centro de Distribuição</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-2.5 py-2">
          {itens.map((i) => {
            const ativo = i.aba === aba;
            return (
              <button key={i.aba} onClick={() => setAba(i.aba)} title={i.aba}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
                  ${ativo ? "bg-brand/10 text-brand" : "text-muted hover:bg-panel2 hover:text-ink"}`}>
                <Icon name={i.icone} className="size-[18px] shrink-0" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:delay-100">{i.aba}</span>
              </button>
            );
          })}
        </nav>
        <div className="whitespace-nowrap px-3 py-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:delay-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            ● HOMOLOGAÇÃO
          </span>
        </div>
      </aside>

      {/* -------- Conteúdo (deslocado só pela largura do rail = 64px; o hover não empurra) -------- */}
      <div className="ml-16 flex min-h-screen flex-col">
        <header className="themed sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-panel/80 px-5 py-3 backdrop-blur">
          <h1 className="text-base font-semibold">{aba}</h1>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={alternar} title="Alternar tema"
              className="grid size-9 place-items-center rounded-lg border border-line text-muted transition hover:bg-panel2 hover:text-ink">
              <Icon name={tema === "dark" ? "sol" : "lua"} className="size-[18px]" />
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-panel2 py-1 pl-2 pr-1">
              <div className="grid size-6 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                {(usuario.nome ?? "?").charAt(0).toUpperCase()}
              </div>
              <span className="text-sm">{usuario.nome}</span>
              <button onClick={logout} title="Sair"
                className="grid size-7 place-items-center rounded-md text-muted transition hover:bg-red-500/15 hover:text-red-500">
                <Icon name="sair" className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-5 md:p-7">
          {aba === "Dashboard" && <Dashboard />}
          {aba === "Nova Venda" && <NovaVenda onCriada={() => setAba("Notas")} />}
          {aba === "Notas" && <Notas />}
          {aba === "Produtos" && <Produtos />}
          {aba === "Clientes" && <Clientes />}
          {aba === "Estoque" && <Estoque />}
          {aba === "Financeiro" && <Financeiro />}
          {aba === "Compras" && <Compras />}
          {aba === "Configurações" && <Configuracoes />}
        </main>
      </div>
    </div>
  );
}
