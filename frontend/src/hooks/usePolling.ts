import { useEffect, useState, useCallback } from "react";
import { apiGet } from "../api/client.js";

/** Rebusca `path` a cada `intervalo` ms. Retorna os dados (ou null enquanto carrega). */
export function usePolling<T>(path: string, intervalo = 2500) {
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
