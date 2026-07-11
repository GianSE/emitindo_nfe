import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api/client.js";
import { type SsoConfig } from "../auth/auth.js";
import { input, btnPrim } from "../components/ui.js";

export function Configuracoes() {
  const [cfg, setCfg] = useState<SsoConfig>({ enabled: false, issuer: "", clientId: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => { apiGet<SsoConfig>("/config/sso").then(setCfg).catch(() => {}); }, []);

  async function salvar() {
    setMsg("salvando…");
    await apiPut("/config/sso", cfg);
    setMsg("✔ salvo. O botão de SSO na tela de login reflete isso.");
  }

  return (
    <div className="max-w-xl rounded-md border border-outline-variant bg-surface-container-lowest p-4">
      <h2 className="text-lg font-bold">Single Sign-On (Authentik / OIDC)</h2>
      <p className="mt-1 mb-5 text-sm text-on-surface-variant">
        Configure aqui — igual ao MinIO, o SSO vive dentro do sistema, não no <code className="rounded bg-surface-container px-1.5">.env</code>.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />
        Habilitar login via SSO
      </label>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-on-surface-variant">Issuer URL</label>
          <input className={input} placeholder="https://authentik.suaempresa.com/application/o/erp/"
            value={cfg.issuer} onChange={(e) => setCfg({ ...cfg, issuer: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-on-surface-variant">Client ID</label>
          <input className={input} placeholder="erp-client"
            value={cfg.clientId} onChange={(e) => setCfg({ ...cfg, clientId: e.target.value })} />
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button className={btnPrim} onClick={salvar}>Salvar</button>
        {msg && <span className="text-sm text-on-surface-variant">{msg}</span>}
      </div>
      <p className="mt-4 text-xs text-on-surface-variant">
        No Authentik: crie um Provider OIDC + Application, com Redirect URI <code className="rounded bg-surface-container px-1.5">{window.location.origin}/</code>.
      </p>
    </div>
  );
}
