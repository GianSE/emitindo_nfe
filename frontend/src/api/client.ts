import { getToken } from "../auth/auth.js";

const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:3001";

/** Monta os headers, anexando o Bearer token quando houver login. */
function headers(extra: Record<string, string> = {}): Record<string, string> {
  const t = getToken();
  return { ...extra, ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const r = await fetch(BASE + path, { headers: headers() });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}

export async function apiPost<T = any>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function apiPut<T = any>(path: string, body: unknown): Promise<T> {
  const r = await fetch(BASE + path, {
    method: "PUT",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const r = await fetch(BASE + path, { method: "DELETE", headers: headers() });
  return r.json();
}

export const brl = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const data = (v?: string) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
