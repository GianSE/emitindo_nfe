/**
 * Autenticação no SPA — dois caminhos:
 *   - LOCAL: usuário/senha -> POST /auth/login -> guarda o JWT do backend.
 *   - SSO:   Authorization Code + PKCE no Authentik, com issuer/client_id vindos
 *            de GET /config/sso (configurado DENTRO do ERP, estilo MinIO).
 *
 * Usa fetch direto (sem importar api.ts) para evitar dependência circular.
 */
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";
const CHAVE_TOKEN = "erp_token";

export interface SsoConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
}
export interface Usuario {
  nome: string;
  papel: string;
}

let token: string | null = localStorage.getItem(CHAVE_TOKEN);
let usuario: Usuario | null = null;

export function getToken() {
  return token;
}
export function getUsuario() {
  return usuario;
}

function guardarToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem(CHAVE_TOKEN, t);
  else localStorage.removeItem(CHAVE_TOKEN);
}

export async function carregarSso(): Promise<SsoConfig> {
  const r = await fetch(BASE + "/config/sso");
  return r.json();
}

function criarManager(cfg: SsoConfig) {
  return new UserManager({
    authority: cfg.issuer,
    client_id: cfg.clientId,
    redirect_uri: window.location.origin + "/",
    post_logout_redirect_uri: window.location.origin + "/",
    response_type: "code",
    scope: "openid profile email",
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  });
}

/** Boot: completa callback do SSO (se houver) e valida a sessão atual. */
export async function initAuth(): Promise<Usuario | null> {
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") && params.has("state")) {
    try {
      const cfg = await carregarSso();
      if (cfg.enabled && cfg.issuer) {
        const user: User = await criarManager(cfg).signinRedirectCallback();
        guardarToken(user.access_token);
      }
    } catch {
      /* estado inválido; ignora */
    }
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (token) {
    const r = await fetch(BASE + "/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      usuario = await r.json();
      return usuario;
    }
    guardarToken(null); // token expirado/ inválido
  }
  return null;
}

export async function loginLocal(username: string, senha: string): Promise<string | null> {
  const r = await fetch(BASE + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, senha }),
  });
  const data = await r.json();
  if (r.ok && data.token) {
    guardarToken(data.token);
    usuario = data.usuario;
    return null; // sucesso
  }
  return data.erro ?? "falha no login";
}

export async function loginSso() {
  const cfg = await carregarSso();
  if (!cfg.enabled || !cfg.issuer) return;
  await criarManager(cfg).signinRedirect();
}

export function logout() {
  guardarToken(null);
  usuario = null;
  window.location.reload();
}
