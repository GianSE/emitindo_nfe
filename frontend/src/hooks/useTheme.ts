import { useEffect, useState } from "react";

type Tema = "light" | "dark";

function inicial(): Tema {
  const salvo = localStorage.getItem("tema");
  if (salvo === "light" || salvo === "dark") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Tema claro/escuro por classe no <html>, persistido e seguindo o sistema por padrão. */
export function useTheme() {
  const [tema, setTema] = useState<Tema>(inicial);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
    localStorage.setItem("tema", tema);
  }, [tema]);
  return { tema, alternar: () => setTema((t) => (t === "dark" ? "light" : "dark")) };
}
