import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons.js";
import { logout, type Usuario } from "../auth/auth.js";

/** Chip do usuário com menu suspenso: Perfil · Configurações · Sair. */
export function UserMenu({ usuario, admin, onNavigate, onPerfil }:
  { usuario: Usuario; admin: boolean; onNavigate: (aba: string) => void; onPerfil: () => void }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAberto((a) => !a)}
        className="flex items-center gap-2 rounded-md border border-outline-variant py-1 pl-2 pr-2 transition hover:bg-surface-container-low">
        <div className="grid size-6 place-items-center rounded-full bg-primary-container text-xs font-semibold text-on-primary">
          {(usuario.nome ?? "?").charAt(0).toUpperCase()}
        </div>
        <span className="hidden text-sm text-on-surface sm:inline">{usuario.nome}</span>
        <Icon name="chevron" size={16} className={`text-on-surface-variant transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
          <div className="border-b border-outline-variant px-4 py-3">
            <p className="truncate text-sm font-semibold text-on-surface">{usuario.nome}</p>
            <p className="text-xs capitalize text-on-surface-variant">{usuario.papel}</p>
          </div>
          <div className="py-1">
            <MenuItem icone="perfil" label="Meu perfil" onClick={() => { onPerfil(); setAberto(false); }} />
            {admin && <MenuItem icone="config" label="Configurações" onClick={() => { onNavigate("Configurações"); setAberto(false); }} />}
            <div className="my-1 border-t border-outline-variant" />
            <MenuItem icone="sair" label="Sair" danger onClick={logout} />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icone, label, onClick, danger }: { icone: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition
        ${danger ? "text-error hover:bg-error/10" : "text-on-surface hover:bg-surface-container-low"}`}>
      <Icon name={icone} size={18} className={danger ? "" : "text-on-surface-variant"} />
      {label}
    </button>
  );
}
