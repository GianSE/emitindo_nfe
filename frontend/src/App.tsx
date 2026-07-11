import { useEffect, useState } from "react";
import { initAuth, getUsuario, type Usuario } from "./auth/auth.js";
import { Icon } from "./components/icons.js";
import { GlobalSearch } from "./components/GlobalSearch.js";
import { UserMenu } from "./components/UserMenu.js";
import { PerfilModal } from "./components/PerfilModal.js";
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
];

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pronto, setPronto] = useState(false);
  const [aba, setAba] = useState("Dashboard");
  const [perfilAberto, setPerfilAberto] = useState(false);

  useEffect(() => { initAuth().then((u) => { setUsuario(u); setPronto(true); }); }, []);

  if (!pronto) return <div className="grid min-h-screen place-items-center text-on-surface-variant">carregando…</div>;
  if (!usuario) return <Login onEntrar={() => setUsuario(getUsuario())} />;

  const itens = NAV.filter((i) => !i.admin || usuario.papel === "admin");

  return (
    <div className="flex min-h-screen">
      {/* ---------------- Sidebar (navy) ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-outline-variant bg-on-secondary-fixed px-3 py-5">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="grid size-9 place-items-center rounded-md bg-primary-container font-bold text-on-primary">N</div>
          <div className="leading-tight">
            <h1 className="text-headline-sm font-bold text-primary-fixed">ERP · CD</h1>
            <p className="text-xs text-secondary-fixed-dim">Centro de Distribuição</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {itens.map((i) => {
            const ativo = i.aba === aba;
            return (
              <button key={i.aba} onClick={() => setAba(i.aba)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition
                  ${ativo
                    ? "border-l-4 border-primary-fixed bg-primary-container pl-2 font-semibold text-on-primary-container"
                    : "text-secondary-fixed-dim hover:bg-on-secondary-fixed-variant hover:text-white"}`}>
                <Icon name={i.icone} size={20} filled={ativo} />
                {i.aba}
              </button>
            );
          })}
        </nav>

        <button onClick={() => setAba("Nova Venda")}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-md bg-primary-container py-2 text-sm font-bold text-on-primary shadow-sm transition hover:bg-primary">
          <Icon name="add" size={18} /> Nova Venda
        </button>
      </aside>

      {/* ---------------- Conteúdo ---------------- */}
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-outline-variant bg-surface px-6">
          <h2 className="text-headline-sm text-on-background">{aba}</h2>
          <div className="ml-2 hidden sm:block">
            <GlobalSearch onNavigate={setAba} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning md:inline-flex">● HOMOLOGAÇÃO</span>
            <UserMenu usuario={usuario} admin={usuario.papel === "admin"}
              onNavigate={setAba} onPerfil={() => setPerfilAberto(true)} />
          </div>
        </header>

        <main className="flex-1 p-6">
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

      {perfilAberto && <PerfilModal usuario={usuario} onClose={() => setPerfilAberto(false)} />}
    </div>
  );
}
