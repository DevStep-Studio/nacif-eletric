import React, { useState } from "react";
import { RotateCw, X } from "lucide-react";

/**
 * Orientação de Rotação para Tablets
 *
 * Exibido quando um usuário acessa o sistema via tablet em modo vertical (retrato).
 * Não bloqueia o acesso: apenas orienta de maneira profissional e elegante a rotação
 * para a horizontal (paisagem), priorizando a ergonomia dos editores técnicos.
 */
export default function TabletOrientationAdvisory() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <aside
      aria-label="Recomendação de orientação do tablet"
      className="sticky top-0 z-[9990] w-full bg-white border-b border-[#00D8B8]/40 px-4 py-2.5 shadow-sm text-[#0F172A] animate-in slide-in-from-top duration-200"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E6FAF6] border border-[#00D8B8]/30 flex items-center justify-center shrink-0">
            <RotateCw className="w-4 h-4 text-[#00A892]" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-[#0F172A]">
              Melhor experiência na horizontal
            </p>
            <p className="text-[11px] text-[#475569]">
              Recomendamos girar seu tablet para o modo horizontal para obter melhor ergonomia e precisão nos editores técnicos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-semibold transition-colors"
          >
            Continuar na vertical
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Fechar aviso de orientação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
