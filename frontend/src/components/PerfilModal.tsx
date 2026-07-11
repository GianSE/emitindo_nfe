import { Icon } from "./icons.js";
import type { Usuario } from "../auth/auth.js";

/** Modal simples de perfil (dados vindos de /auth/me). */
export function PerfilModal({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <h3 className="text-headline-sm text-on-background">Meu perfil</h3>
          <button onClick={onClose} className="grid size-7 place-items-center rounded text-on-surface-variant transition hover:bg-surface-container-low">
            <Icon name="fechar" size={18} />
          </button>
        </div>
        <div className="flex items-center gap-4 p-5">
          <div className="grid size-14 place-items-center rounded-full bg-primary-container text-2xl font-bold text-on-primary">
            {(usuario.nome ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-base font-semibold text-on-surface">{usuario.nome}</p>
            <p className="text-sm text-on-surface-variant">
              Papel: <span className="capitalize">{usuario.papel}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-outline-variant px-4 py-3">
          <span className="mr-auto text-xs text-on-surface-variant">Edição de perfil e troca de senha — em breve.</span>
          <button onClick={onClose} className="rounded-md border border-outline-variant px-3 py-1.5 text-sm text-on-surface transition hover:bg-surface-container-low">Fechar</button>
        </div>
      </div>
    </div>
  );
}
