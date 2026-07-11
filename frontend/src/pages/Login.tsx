import { useEffect, useState } from "react";
import { loginLocal, loginSso, carregarSso, type SsoConfig } from "../auth/auth.js";
import { input, btnPrim } from "../components/ui.js";

export function Login({ onEntrar }: { onEntrar: () => void }) {
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
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 shadow-lg">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand text-2xl text-brand-ink shadow-sm">🏭</div>
        <h1 className="text-center text-xl font-bold">ERP · Centro de Distribuição</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted">Acesse com sua conta</p>

        <form onSubmit={entrar} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Usuário</label>
            <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Senha</label>
            <input className={input} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button className={`${btnPrim} w-full`} disabled={carregando}>
            {carregando ? "entrando…" : "Entrar"}
          </button>
        </form>

        {sso?.enabled && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted">
              <div className="h-px flex-1 bg-panel2" /> ou <div className="h-px flex-1 bg-panel2" />
            </div>
            <button onClick={loginSso}
              className="w-full rounded-lg border border-line bg-panel2 px-4 py-2 text-sm font-semibold transition hover:bg-panel">
              🔐 Entrar com SSO (Authentik)
            </button>
          </>
        )}
        <p className="mt-6 text-center text-[11px] text-muted">padrão inicial: admin / admin</p>
      </div>
    </div>
  );
}
