import React from "react";
import { Maximize2, Monitor } from "lucide-react";
import brandLogoEnergy from "@/assets/brand-logo-principal.png";

/**
 * Aviso de Redimensionamento para Navegadores Desktop
 *
 * Exibido quando um usuário em computador/notebook redimensiona a janela para menos de 768px,
 * prevenindo quebra de layout dos painéis e grids técnicos.
 * Desaparece automaticamente assim que a janela é ampliada para 768px ou mais.
 */
export default function DesktopResizeAdvisory({ currentWidth = 0 }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed inset-0 z-[99998] bg-white text-[#0F172A] flex flex-col justify-between p-6 text-center select-none overflow-y-auto"
      style={{ minHeight: "100dvh" }}
    >
      <header className="w-full flex justify-center py-4">
        <img
          src={brandLogoEnergy}
          alt="Nacif Energy"
          className="h-9 w-auto object-contain"
        />
      </header>

      <main className="max-w-md mx-auto my-auto flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-[#E6FAF6] border border-[#00D8B8]/30 flex items-center justify-center text-[#00A892] mb-5">
          <Maximize2 className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-[#0F172A] mb-2">
          Amplie a janela do navegador
        </h2>

        <p className="text-sm text-[#475569] leading-relaxed mb-6">
          Para garantir a correta visualização dos diagramas unifilares, ferramentas CAD e plantas baixas, o Nacif Energy requer uma largura útil mínima de <strong>768px</strong>.
        </p>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
          <Monitor className="w-3.5 h-3.5 text-slate-500" />
          <span>Largura atual: {currentWidth}px / Mínima: 768px</span>
        </div>
      </main>

      <footer className="w-full py-4 text-center text-xs text-[#64748B] border-t border-slate-100">
        © Nacif Energy — Engenharia e tecnologia em um só lugar.
      </footer>
    </div>
  );
}
