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
    <div className="grid min-h-screen place-items-center bg-surface-container-low px-4">
      <div className="w-full max-w-sm rounded-md border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-primary-container text-2xl text-white shadow-sm">🏭</div>
        <h1 className="text-center text-xl font-bold">ERP · Centro de Distribuição</h1>
        <p className="mb-6 mt-1 text-center text-sm text-on-surface-variant">Acesse com sua conta</p>

        <form onSubmit={entrar} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Usuário</label>
            <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Senha</label>
            <input className={input} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <p className="text-sm text-error">{erro}</p>}
          <button className={`${btnPrim} w-full`} disabled={carregando}>
            {carregando ? "entrando…" : "Entrar"}
          </button>
        </form>

        {sso?.enabled && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-on-surface-variant">
              <div className="h-px flex-1 bg-surface-container" /> ou <div className="h-px flex-1 bg-surface-container" />
            </div>
            <button onClick={loginSso}
              className="w-full rounded-md border border-outline-variant bg-surface-container px-4 py-2 text-sm font-semibold transition hover:bg-surface-container-lowest">
              🔐 Entrar com SSO (Authentik)
            </button>
          </>
        )}
        <p className="mt-6 text-center text-[11px] text-on-surface-variant">padrão inicial: admin / admin</p>
      </div>
    </div>
  );
}
