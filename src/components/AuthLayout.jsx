import React from "react";
import authCardHero from "@/assets/auth-card-hero.jpg";
import { useBranding } from "@/lib/appPreferences";

/**
 * AuthLayout
 * 
 * Layout unificado para as páginas de autenticação (Login, Cadastro, Recuperação de Senha)
 * com o card visual conceitual da Nacif Energy à esquerda e o formulário flutuante à direita.
 */
export default function AuthLayout({ title, subtitle, footer, children }) {
  const { branding } = useBranding();
  const brandName = [branding?.appName, branding?.appSuffix].filter(Boolean).join(" ") || "NACIF Energy";
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#FAFCFC] text-slate-900 flex flex-col justify-between selection:bg-[#00d8b8]/20 selection:text-slate-950">
      {/* Container Principal de 2 Colunas */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8 xl:px-12">
        <div className="w-full max-w-[1020px] mx-auto grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] xl:grid-cols-[1.18fr_0.82fr] gap-8 lg:gap-14 xl:gap-20 items-center">
          
          {/* ─────────────────────────────────────────────────────────────
              PAINEL ESQUERDO (Desktop):
              Card visual com a imagem oficial da Nacif Energy
              (Casa contemporânea com energia solar e vista panorâmica)
             ───────────────────────────────────────────────────────────── */}
          <aside className="hidden lg:flex relative overflow-hidden rounded-[24px] border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.02)] w-full max-w-[490px] h-[640px] xl:h-[660px] mx-auto auth-panel-enter bg-slate-900 group">
            <img
              src={authCardHero}
              alt="Nacif Energy — Grandes projetos começam aqui"
              className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
            />
            {/* Feixe sutil de iluminação na abertura */}
            <div className="absolute inset-0 pointer-events-none glass-sweep-motion opacity-0 bg-gradient-to-b from-white/25 via-transparent to-transparent" />
          </aside>

          {/* ─────────────────────────────────────────────────────────────
              COLUNA DIREITA: Formulário Compacto sem Card Externo
             ───────────────────────────────────────────────────────────── */}
          <section className="w-full max-w-[360px] mx-auto flex flex-col justify-center auth-form-enter">
            
            {/* Versão compacta para Mobile (< lg): Banner com a imagem oficial */}
            <div className="lg:hidden mb-6 flex flex-col items-center text-center auth-mobile-enter">
              <div className="w-full relative h-[210px] overflow-hidden rounded-[18px] border border-slate-200/80 shadow-md">
                <img
                  src={authCardHero}
                  alt="Nacif Energy"
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </div>

            {/* Cabeçalho do Formulário (Centralizado) */}
            {(title || subtitle) && (
              <div className="mb-7 text-center">
                {title && (
                  <h1 className="text-[25px] sm:text-[27px] font-extrabold tracking-tight text-slate-900">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-1.5 text-xs sm:text-sm font-normal text-slate-500">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Conteúdo do Formulário */}
            {children}

            {/* Rodapé auxiliar do formulário (ex: Links de Alternância) */}
            {footer && (
              <div className="mt-6 text-center text-xs font-normal text-slate-500">
                {footer}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          RODAPÉ DISCRETO: Centralizado abaixo da composição
         ───────────────────────────────────────────────────────────── */}
      <footer className="mt-auto py-6 text-center text-[11px] font-normal text-slate-400">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>© {currentYear} {brandName}</span>
          <span className="text-slate-300">•</span>
          <a href="/privacidade" className="hover:text-slate-600 transition-colors">
            Privacidade
          </a>
          <span className="text-slate-300">•</span>
          <a href="/termos" className="hover:text-slate-600 transition-colors">
            Termos
          </a>
        </div>
      </footer>
    </div>
  );
}
