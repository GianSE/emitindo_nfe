// Gerenciador de tema (claro/escuro/sistema). Aplica a classe .dark no <html>.
export type Tema = "light" | "dark" | "system";

export function temaAtual(): Tema {
  const t = localStorage.getItem("tema");
  return t === "light" || t === "dark" ? t : "system";
}

function ehEscuro(t: Tema): boolean {
  return t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/** Aplica e persiste o tema. */
export function aplicarTema(t: Tema) {
  if (t === "system") localStorage.removeItem("tema");
  else localStorage.setItem("tema", t);
  document.documentElement.classList.toggle("dark", ehEscuro(t));
}
