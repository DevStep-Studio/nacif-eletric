import React, { useState } from "react";
import { Check, Copy, Laptop, Tablet, Monitor } from "lucide-react";
import brandLogoEnergy from "@/assets/brand-logo-principal.png";

/**
 * Ilustração Vetorial Minimalista: Notebook e Tablet
 * Utiliza estritamente linhas puras e a cor principal #00D8B8 da Nacif Energy, sem gradientes.
 */
function DevicesIllustration({ className = "w-64 sm:w-72 h-auto" }) {
  return (
    <svg
      viewBox="0 0 360 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ilustração de notebook e tablet"
    >
      {/* --- NOTEBOOK (Computador / Laptop) --- */}
      {/* Tela do Notebook - Moldura externa */}
      <rect
        x="24"
        y="24"
        width="230"
        height="144"
        rx="10"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="3"
      />

      {/* Tela do Notebook - Área útil de exibição */}
      <rect
        x="36"
        y="36"
        width="206"
        height="120"
        rx="4"
        fill="#FAFAFA"
        stroke="#E2E8F0"
        strokeWidth="1.5"
      />

      {/* Câmera superior do notebook */}
      <circle cx="139" cy="30" r="2.5" fill="#0F172A" />

      {/* Interface técnica estilizada no notebook - Verde-turquesa (#00D8B8) */}
      {/* Barra superior de ferramentas do editor */}
      <rect x="44" y="44" width="70" height="7" rx="3.5" fill="#00D8B8" />
      <circle cx="122" cy="47.5" r="3.5" fill="#00D8B8" />
      <circle cx="134" cy="47.5" r="3.5" fill="#00D8B8" />
      <circle cx="146" cy="47.5" r="3.5" fill="#00D8B8" />

      {/* Grid de projeto elétrico / esquemático */}
      <line x1="44" y1="62" x2="190" y2="62" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="44" y1="82" x2="190" y2="82" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="44" y1="102" x2="190" y2="102" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="44" y1="122" x2="190" y2="122" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />

      {/* Diagrama elétrico com circuitos e nós em #00D8B8 */}
      <path
        d="M 52 110 L 84 110 L 84 76 L 140 76 L 140 94 L 182 94"
        stroke="#00D8B8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="52" cy="110" r="4.5" fill="#00D8B8" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="84" cy="76" r="3.5" fill="#0F172A" />
      <circle cx="140" cy="94" r="4.5" fill="#00D8B8" stroke="#0F172A" strokeWidth="1.5" />
      <circle cx="182" cy="94" r="4.5" fill="#00D8B8" stroke="#0F172A" strokeWidth="1.5" />

      {/* Painel lateral de componentes */}
      <rect x="198" y="44" width="36" height="104" rx="3" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
      <rect x="204" y="52" width="24" height="5" rx="2.5" fill="#00D8B8" />
      <rect x="204" y="63" width="24" height="4" rx="2" fill="#E2E8F0" />
      <rect x="204" y="73" width="24" height="4" rx="2" fill="#E2E8F0" />
      <rect x="204" y="83" width="24" height="4" rx="2" fill="#E2E8F0" />
      <rect x="204" y="93" width="24" height="4" rx="2" fill="#E2E8F0" />

      {/* Base do Notebook (Chassis e teclado) */}
      <path
        d="M 8 168 L 270 168 L 286 182 C 288 184 286 187 282 187 L 0 187 C -4 187 -6 184 -4 182 Z"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Rebaixo de abertura da tampa */}
      <rect x="120" y="169" width="38" height="3" rx="1.5" fill="#0F172A" />

      {/* --- TABLET (Sobreposto com elegância à direita) --- */}
      {/* Corpo do Tablet */}
      <rect
        x="220"
        y="58"
        width="118"
        height="150"
        rx="14"
        fill="#FFFFFF"
        stroke="#0F172A"
        strokeWidth="3"
      />

      {/* Área útil da tela do tablet */}
      <rect
        x="230"
        y="72"
        width="98"
        height="122"
        rx="6"
        fill="#FAFAFA"
        stroke="#E2E8F0"
        strokeWidth="1.5"
      />

      {/* Câmera superior do tablet */}
      <circle cx="279" cy="65" r="2.5" fill="#0F172A" />

      {/* Indicador inferior do tablet */}
      <line x1="264" y1="200" x2="294" y2="200" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />

      {/* Interface técnica estilizada no tablet - Verde-turquesa (#00D8B8) */}
      {/* Cabeçalho no tablet */}
      <rect x="238" y="80" width="46" height="6" rx="3" fill="#00D8B8" />
      <circle cx="316" cy="83" r="3" fill="#00D8B8" />

      {/* Cartões de medição solar e circuitos no tablet */}
      <rect x="238" y="94" width="82" height="36" rx="4" fill="#FFFFFF" stroke="#00D8B8" strokeWidth="1.5" />
      <line x1="244" y1="104" x2="268" y2="104" stroke="#00D8B8" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="244" y1="114" x2="292" y2="114" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
      <line x1="244" y1="122" x2="280" y2="122" stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round" />

      {/* Gráfico técnico de geração solar em verde-turquesa */}
      <path
        d="M 242 178 L 254 164 L 268 170 L 282 150 L 298 158 L 312 144"
        stroke="#00D8B8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="282" cy="150" r="3.5" fill="#00D8B8" stroke="#0F172A" strokeWidth="1" />
      <circle cx="312" cy="144" r="3.5" fill="#00D8B8" stroke="#0F172A" strokeWidth="1" />
    </svg>
  );
}

/**
 * Tela Exclusiva para Celulares
 *
 * Implementa 100% das diretrizes do Nacif Energy:
 * - Fundo branco (#FFFFFF)
 * - Cor principal verde-turquesa (#00D8B8)
 * - Textos principais em preto ou cinza-escuro
 * - Tipografia moderna e legível
 * - Ícones minimalistas
 * - Sem gradientes
 * - Sem elementos decorativos desnecessários
 * - Espaçamentos equilibrados e excelente hierarquia visual
 * - Logo oficial preservando proporções
 * - Ilustração vetorial minimalista notebook + tablet em #00D8B8
 * - Título, Descrição, Destaque informativo, Botão principal "Entendi" e Rodapé exatos
 */
export default function MobileDeviceBlockedScreen() {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopyLink = () => {
    try {
      const url = window.location.origin || "https://nacifenergy.com.br";
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback gracioso
    }
  };

  const handleUnderstood = () => {
    setConfirmed(true);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de restrição por dispositivo"
      className="fixed inset-0 z-[99999] bg-white text-[#0F172A] flex flex-col justify-between overflow-x-hidden overflow-y-auto selection:bg-[#00D8B8] selection:text-[#0A3833]"
      style={{
        minHeight: "100dvh",
        backgroundColor: "#FFFFFF",
      }}
    >
      {/* Topo: Logo oficial do Nacif Energy preservando proporções */}
      <header className="w-full pt-8 pb-4 px-6 flex items-center justify-center shrink-0">
        <img
          src={brandLogoEnergy}
          alt="Nacif Energy"
          className="h-9 sm:h-10 w-auto object-contain max-w-[200px]"
          loading="eager"
        />
      </header>

      {/* Centro: Ilustração vetorial e textos informativos */}
      <main className="w-full max-w-lg mx-auto px-6 py-4 flex flex-col items-center justify-center text-center my-auto">
        {/* Ilustração vetorial minimalista notebook + tablet */}
        <div className="mb-6 flex justify-center items-center">
          <DevicesIllustration className="w-64 sm:w-72 h-auto" />
        </div>

        {/* Título Oficial */}
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight mb-3">
          Uma experiência melhor em telas maiores.
        </h1>

        {/* Descrição Oficial */}
        <p className="text-sm text-[#475569] leading-relaxed mb-5 max-w-sm">
          O Nacif Energy foi desenvolvido para oferecer precisão e desempenho em projetos elétricos e solares.
          <br className="my-1.5 hidden sm:block" />
          Para utilizar a plataforma, acesse por um computador, notebook ou tablet.
        </p>

        {/* Destaque Informativo Oficial */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E6FAF6] border border-[#00D8B8]/30 text-[#0A3833] text-xs font-semibold mb-6">
          <div className="flex items-center gap-1.5 text-[#00A892]">
            <Monitor className="w-3.5 h-3.5" />
            <Tablet className="w-3.5 h-3.5" />
          </div>
          <span>Disponível para computadores e tablets.</span>
        </div>

        {/* Ação Principal: Botão "Entendi" */}
        <div className="w-full max-w-xs space-y-2.5">
          <button
            type="button"
            onClick={handleUnderstood}
            className="w-full h-12 rounded-xl bg-[#00D8B8] hover:bg-[#00c5a8] active:bg-[#00b297] text-[#0A3833] font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-none cursor-pointer"
          >
            {confirmed ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Entendi</span>
              </>
            ) : (
              <span>Entendi</span>
            )}
          </button>

          {/* Feedback amigável após clique no Entendi */}
          {confirmed && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left animate-in fade-in duration-200">
              <p className="text-xs text-[#334155] leading-relaxed mb-2">
                Acesse <strong className="text-[#0F172A]">nacifenergy.com.br</strong> no navegador do seu computador ou tablet para iniciar seus projetos com máxima precisão.
              </p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full h-8 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00A892]" />
                    <span className="text-[#00A892]">Link copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copiar link do sistema</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Rodapé Oficial */}
      <footer className="w-full py-6 px-6 text-center text-xs text-[#64748B] border-t border-slate-100 shrink-0">
        <p>© Nacif Energy — Engenharia e tecnologia em um só lugar.</p>
      </footer>
    </div>
  );
}
