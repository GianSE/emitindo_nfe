import { useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { apiGet, apiPost, apiPut, brl, data } from "./api.js";
import {
  initAuth, loginLocal, loginSso, logout, carregarSso, getUsuario,
  type Usuario, type SsoConfig,
} from "./auth.js";

/* ------------------------------------------------------------------ hooks */
function usePolling<T>(path: string, intervalo = 2500) {
  const [dados, setDados] = useState<T | null>(null);
  const carregar = useCallback(() => {
    apiGet<T>(path).then(setDados).catch(() => {});
  }, [path]);
  useEffect(() => {
    carregar();
    const id = setInterval(carregar, intervalo);
    return () => clearInterval(id);
  }, [carregar, intervalo]);
  return dados;
}

/* -------------------------------------------------------------- UI helpers */
const input =
  "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-blue-500";
const btnPrim =
  "rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

/* -------------------------------------------------------------------- App */
const ABAS = ["Dashboard", "Nova Venda", "Notas", "Estoque", "Financeiro", "Compras"] as const;
type Aba = (typeof ABAS)[number] | "Configurações";

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pronto, setPronto] = useState(false);
  const [aba, setAba] = useState<Aba>("Dashboard");

  useEffect(() => {
    initAuth().then((u) => { setUsuario(u); setPronto(true); });
  }, []);

  if (!pronto) return <div className="grid min-h-screen place-items-center text-slate-500">carregando…</div>;
  if (!usuario) return <Login onEntrar={() => setUsuario(getUsuario())} />;

  const abas: Aba[] = [...ABAS, ...(usuario.papel === "admin" ? (["Configurações"] as const) : [])];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex items-center gap-4 py-5">
        <h1 className="text-xl font-bold">🏭 ERP · Centro de Distribuição</h1>
        <span className="rounded bg-yellow-400 px-2 py-0.5 text-[11px] font-bold tracking-wide text-yellow-950">
          HOMOLOGAÇÃO
        </span>
        <div className="ml-auto flex items-center gap-3 text-sm text-slate-400">
          <span>👤 {usuario.nome} <span className="text-slate-600">·</span> {usuario.papel}</span>
          <button onClick={logout} className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-red-600 hover:text-white">
            sair
          </button>
        </div>
      </header>

      <nav className="mb-5 flex flex-wrap gap-1 border-b border-slate-700">
        {abas.map((a) => (
          <button key={a} onClick={() => setAba(a)}
            className={`rounded-t-lg px-4 py-2.5 text-sm ${
              a === aba ? "border-b-2 border-blue-500 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}>
            {a}
          </button>
        ))}
      </nav>

      <main>
        {aba === "Dashboard" && <Dashboard />}
        {aba === "Nova Venda" && <NovaVenda onCriada={() => setAba("Notas")} />}
        {aba === "Notas" && <Notas />}
        {aba === "Estoque" && <Estoque />}
        {aba === "Financeiro" && <Financeiro />}
        {aba === "Compras" && <Compras />}
        {aba === "Configurações" && <Configuracoes />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ Login */
function Login({ onEntrar }: { onEntrar: () => void }) {
  const [sso, setSso] = useState<SsoConfig | null>(null);
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { carregarSso().then(setSso).catch(() => {}); }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const msg = await loginLocal(username, senha);
    setCarregando(false);
    if (msg) setErro(msg);
    else onEntrar();
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-8">
        <h1 className="text-center text-xl font-bold">🏭 ERP · Centro de Distribuição</h1>
        <p className="mb-6 mt-1 text-center text-sm text-slate-400">Acesse com sua conta</p>

        <form onSubmit={entrar} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Usuário</label>
            <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Senha</label>
            <input className={input} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button className={`${btnPrim} w-full`} disabled={carregando}>
            {carregando ? "entrando…" : "Entrar"}
          </button>
        </form>

        {sso?.enabled && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
              <div className="h-px flex-1 bg-slate-700" /> ou <div className="h-px flex-1 bg-slate-700" />
            </div>
            <button onClick={loginSso}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600">
              🔐 Entrar com SSO (Authentik)
            </button>
          </>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-500">padrão inicial: admin / admin</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Dashboard */
function Dashboard() {
  const d = usePolling<any>("/dashboard");
  if (!d) return <p className="py-6 text-slate-500">carregando…</p>;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
      <Card titulo="Notas autorizadas" valor={d.notas.autorizadas} cor="border-green-500"
        rodape={`${d.notas.pendentes} pendentes · ${d.notas.rejeitadas} rejeitadas`} />
      <Card titulo="Itens em estoque" valor={Number(d.estoque.total_saldo).toLocaleString("pt-BR")}
        cor="border-blue-500" rodape={`${d.estoque.itens} produtos`} />
      <Card titulo="Contas a receber" valor={brl(d.receber.total)} cor="border-green-500"
        rodape={`${d.receber.qtd} títulos em aberto`} />
      <Card titulo="Contas a pagar" valor={brl(d.pagar.total)} cor="border-red-500"
        rodape={`${d.pagar.qtd} títulos em aberto`} />
      <Card titulo="Compras recebidas" valor={d.compras.qtd} cor="border-purple-500" rodape="via Distribuição DFe" />
    </div>
  );
}
function Card({ titulo, valor, rodape, cor }: { titulo: string; valor: any; rodape?: string; cor: string }) {
  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-800 p-5 border-l-4 ${cor}`}>
      <div className="text-[13px] text-slate-400">{titulo}</div>
      <div className="my-1.5 text-3xl font-bold">{valor}</div>
      {rodape && <div className="text-xs text-slate-400">{rodape}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Nova Venda */
function NovaVenda({ onCriada }: { onCriada: () => void }) {
  const catalogo = usePolling<any[]>("/catalogo", 60000);
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [cliente, setCliente] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [msg, setMsg] = useState("");

  const itens = Object.entries(qtd).filter(([, q]) => q > 0).map(([cProd, q]) => ({ cProd, qtd: q }));
  const total = (catalogo ?? []).reduce((s, p) => s + (qtd[p.cProd] ?? 0) * Number(p.vUnit), 0);

  async function enviar() {
    if (itens.length === 0) { setMsg("Selecione ao menos um item."); return; }
    setMsg("enviando…");
    const r = await apiPost("/vendas", { cliente: { xNome: cliente || undefined }, parcelas, itens });
    if (r.venda_id) { setMsg(""); onCriada(); } else setMsg(r.erro ?? "erro ao criar venda");
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
      <h2 className="mb-4 text-lg font-bold">Nova venda</h2>
      <label className="mb-1 block text-xs text-slate-400">Cliente</label>
      <input className={`${input} max-w-sm`} value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente (opcional)" />

      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2">Produto</th><th>Preço</th><th>Qtd</th><th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {(catalogo ?? []).map((p) => (
            <tr key={p.cProd} className="border-t border-slate-700">
              <td className="py-2.5">{p.xProd}</td>
              <td>{brl(p.vUnit)}</td>
              <td>
                <input type="number" min={0} value={qtd[p.cProd] ?? 0} className={`${input} w-20`}
                  onChange={(e) => setQtd({ ...qtd, [p.cProd]: Number(e.target.value) })} />
              </td>
              <td>{brl((qtd[p.cProd] ?? 0) * Number(p.vUnit))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5 flex flex-wrap items-end gap-5">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Parcelas</label>
          <input type="number" min={1} max={12} value={parcelas} className={`${input} w-20`}
            onChange={(e) => setParcelas(Number(e.target.value))} />
        </div>
        <div className="ml-auto text-lg">Total: <strong>{brl(total)}</strong></div>
        <button className={btnPrim} onClick={enviar}>Emitir NF-e</button>
      </div>
      {msg && <p className="mt-3 text-sm text-yellow-400">{msg}</p>}
      <p className="mt-4 text-xs text-slate-500">
        A venda entra na <code className="rounded bg-slate-900 px-1.5 py-0.5">outbox</code>; o worker Python emite a NF-e e o estoque/financeiro reagem por evento.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- listas */
function Notas() {
  const notas = usePolling<any[]>("/notas");
  return (
    <Tabela linhas={notas} vazio="Nenhuma nota ainda — crie uma venda."
      cabecalho={["Nº", "Cliente", "Status", "Protocolo", "Chave"]}
      render={(n) => (
        <Tr key={n.chave ?? n.numero}>
          <Td>{n.numero ?? "—"}</Td><Td>{n.cliente}</Td>
          <Td><StatusBadge s={n.status} motivo={n.motivo} /></Td>
          <Td>{n.nprot ?? "—"}</Td>
          <Td mono>{n.chave ? "…" + n.chave.slice(-12) : "—"}</Td>
        </Tr>
      )} />
  );
}
function Estoque() {
  const p = usePolling<any[]>("/produtos");
  return (
    <Tabela linhas={p} vazio="—" cabecalho={["Código", "Produto", "Saldo"]}
      render={(x) => (
        <Tr key={x.cod}><Td mono>{x.cod}</Td><Td>{x.nome}</Td>
          <Td><strong>{Number(x.saldo).toLocaleString("pt-BR")}</strong></Td></Tr>
      )} />
  );
}
function Financeiro() {
  const receber = usePolling<any[]>("/titulos?tipo=receber");
  const pagar = usePolling<any[]>("/titulos?tipo=pagar");
  const tab = (linhas: any[] | null) => (
    <Tabela linhas={linhas} vazio="—" cabecalho={["Descrição", "Parc.", "Venc.", "Valor"]}
      render={(t, i) => (
        <Tr key={i}><Td>{t.descricao}</Td><Td>{t.parcela}/{t.totalParcelas ?? t.total_parcelas}</Td>
          <Td>{data(t.vencimento)}</Td><Td>{brl(t.valor)}</Td></Tr>
      )} />
  );
  return (
    <div className="grid gap-7 md:grid-cols-2">
      <div><h3 className="mb-2 font-semibold text-green-400">A receber (vendas)</h3>{tab(receber)}</div>
      <div><h3 className="mb-2 font-semibold text-red-400">A pagar (compras)</h3>{tab(pagar)}</div>
    </div>
  );
}
function Compras() {
  const c = usePolling<any[]>("/compras");
  return (
    <Tabela linhas={c} vazio="Nenhuma nota de fornecedor recebida."
      cabecalho={["NSU", "Fornecedor (CNPJ)", "Chave", "Manifestação"]}
      render={(n) => (
        <Tr key={n.chave}><Td>{n.nsu}</Td><Td mono>{n.cnpjEmitente ?? n.cnpj_emitente}</Td>
          <Td mono>…{String(n.chave).slice(-12)}</Td>
          <Td>{n.manifestacao ? <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">✓ {n.manifestacao}</span> : "—"}</Td>
        </Tr>
      )} />
  );
}

/* -------------------------------------------------------- Configurações */
function Configuracoes() {
  const [cfg, setCfg] = useState<SsoConfig>({ enabled: false, issuer: "", clientId: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => { apiGet<SsoConfig>("/config/sso").then(setCfg).catch(() => {}); }, []);

  async function salvar() {
    setMsg("salvando…");
    await apiPut("/config/sso", cfg);
    setMsg("✔ salvo. O botão de SSO na tela de login reflete isso.");
  }

  return (
    <div className="max-w-xl rounded-xl border border-slate-700 bg-slate-800 p-6">
      <h2 className="text-lg font-bold">Single Sign-On (Authentik / OIDC)</h2>
      <p className="mt-1 mb-5 text-sm text-slate-400">
        Configure aqui — igual ao MinIO, o SSO vive dentro do sistema, não no <code className="rounded bg-slate-900 px-1.5">.env</code>.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
        Habilitar login via SSO
      </label>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Issuer URL</label>
          <input className={input} placeholder="https://authentik.suaempresa.com/application/o/erp/"
            value={cfg.issuer} onChange={(e) => setCfg({ ...cfg, issuer: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Client ID</label>
          <input className={input} placeholder="erp-client"
            value={cfg.clientId} onChange={(e) => setCfg({ ...cfg, clientId: e.target.value })} />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button className={btnPrim} onClick={salvar}>Salvar</button>
        {msg && <span className="text-sm text-slate-400">{msg}</span>}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        No Authentik: crie um Provider OIDC + Application, com Redirect URI <code className="rounded bg-slate-900 px-1.5">{window.location.origin}/</code>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ table atoms */
function StatusBadge({ s, motivo }: { s: string; motivo?: string }) {
  const cor: Record<string, string> = {
    autorizada: "bg-green-500/15 text-green-400",
    rejeitada: "bg-red-500/15 text-red-400",
    pendente: "bg-yellow-500/15 text-yellow-400",
  };
  return <span title={motivo ?? ""} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor[s] ?? "bg-slate-700 text-slate-400"}`}>{s}</span>;
}
function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-t border-slate-700 hover:bg-slate-800/60">{children}</tr>;
}
function Td({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2.5 ${mono ? "font-mono text-xs text-slate-400" : ""}`}>{children}</td>;
}
function Tabela({ linhas, cabecalho, render, vazio }: {
  linhas: any[] | null; cabecalho: string[]; render: (l: any, i: number) => ReactNode; vazio: string;
}) {
  if (!linhas) return <p className="py-6 text-slate-500">carregando…</p>;
  if (linhas.length === 0) return <p className="py-6 text-slate-500">{vazio}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            {cabecalho.map((c) => <th key={c} className="px-3 py-2.5">{c}</th>)}
          </tr>
        </thead>
        <tbody>{linhas.map(render)}</tbody>
      </table>
    </div>
  );
}
