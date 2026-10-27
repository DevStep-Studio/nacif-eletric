import React from "react";
import authLogoEnergy from "@/assets/brand-logo-principal.png";
import { useBranding } from "@/lib/appPreferences";
import FlutedGlassArtwork from "@/components/login/FlutedGlassArtwork";

/**
 * AuthLayout
 * 
 * Layout unificado para as páginas de autenticação (Login, Cadastro, Recuperação de Senha)
 * reproduzindo fielmente a composição sofisticada e minimalista do tema light da Nacif Energy:
 * - À esquerda (desktop): Painel visual vertical de vidro canelado com proporção 4:5,
 *   bordas arredondadas (24px), logo oficial, ponto luminoso e tipografia editorial.
 * - À direita: Formulário compacto sem card externo, flutuando sobre o fundo claro da página.
 * - Mobile: Prioridade imediata aos campos com banner compacto e respiro otimizado.
 * - Rodapé: Discreto e centralizado com direitos autorais e links legais.
 */
export default function AuthLayout({ title, subtitle, footer, children }) {
  const { branding } = useBranding();
  const isDefaultLogo =
    !branding?.authLogoDataUrl ||
    branding.authLogoDataUrl === "/brand-logo-principal.png" ||
    branding.authLogoDataUrl.includes("brand-logo-principal") ||
    branding.authLogoDataUrl.includes("Logo-Principal") ||
    branding.authLogoDataUrl.includes("nacif");
  const authLogo = isDefaultLogo ? authLogoEnergy : (branding.authLogoDataUrl || authLogoEnergy);
  const brandName = [branding?.appName, branding?.appSuffix].filter(Boolean).join(" ") || "NACIF Energy";
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#FAFCFC] text-slate-900 flex flex-col justify-between selection:bg-[#00d8b8]/20 selection:text-slate-950">
      {/* Container Principal de 2 Colunas */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8 xl:px-12">
        <div className="w-full max-w-[1020px] mx-auto grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] xl:grid-cols-[1.18fr_0.82fr] gap-8 lg:gap-14 xl:gap-20 items-center">
          
          {/* ─────────────────────────────────────────────────────────────
              PAINEL ESQUERDO (Desktop):
              Proporção ~4:5, cantos arredondados (24px), arte de vidro canelado 
              e tipografia refinada com a palavra 'sol' em itálico editorial
             ───────────────────────────────────────────────────────────── */}
          <aside className="hidden lg:flex relative flex-col justify-between overflow-hidden rounded-[24px] border border-slate-200/80 bg-[#F8FBFB] shadow-[0_20px_50px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] w-full max-w-[490px] min-h-[640px] xl:min-h-[660px] p-8 xl:p-9 mx-auto">
            
            {/* Topo: Logo oficial da marca no canto superior esquerdo */}
            <header className="relative z-10 flex items-center">
              <img
                src={authLogo}
                alt={brandName}
                className="h-8 max-w-[160px] object-contain object-left"
                onError={(e) => {
                  if (e.currentTarget.src !== authLogoEnergy) {
                    e.currentTarget.src = authLogoEnergy;
                  }
                }}
              />
            </header>

            {/* Arte abstrata: lâminas de vidro canelado com luz e acentos #00d8b8 */}
            <div className="absolute inset-x-0 top-0 pt-10 pointer-events-none">
              <FlutedGlassArtwork />
            </div>

            {/* Conteúdo inferior do painel: Respiro, contraste e tipografia editorial */}
            <footer className="relative z-10 pt-8">
              {/* Linha introdutória com ponto indicador na cor da marca */}
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-[#00d8b8] shadow-[0_0_8px_rgba(0,216,184,0.9)]" />
                <span className="text-xs font-semibold tracking-wide text-slate-600">
                  Seu próximo projeto começa aqui
                </span>
              </div>

              {/* Título com destaque tipográfico na palavra 'sol' */}
              <h2 className="text-[31px] xl:text-[34px] font-extrabold leading-[1.18] tracking-tight text-slate-900 mb-3.5">
                Da planta ao{" "}
                <span className="font-editorial text-[1.26em] font-normal italic text-slate-950 inline-block px-1 transform -translate-y-0.5">
                  sol
                </span>
                ,<br />
                tudo em um só lugar.
              </h2>

              {/* Descrição curta e legível */}
              <p className="text-[13px] leading-relaxed text-slate-500 font-normal max-w-[390px]">
                Planeje instalações elétricas, monte quadros e desenvolva projetos solares em uma única plataforma.
              </p>
            </footer>
          </aside>

          {/* ─────────────────────────────────────────────────────────────
              COLUNA DIREITA: Formulário Compacto sem Card Externo
             ───────────────────────────────────────────────────────────── */}
          <section className="w-full max-w-[360px] mx-auto flex flex-col justify-center">
            
            {/* Versão compacta para Mobile (< lg): Logo e Banner sutil sem rolagem excessiva */}
            <div className="lg:hidden mb-6 flex flex-col items-center text-center">
              <img
                src={authLogo}
                alt={brandName}
                className="h-8 max-w-[150px] object-contain mb-4"
                onError={(e) => {
                  if (e.currentTarget.src !== authLogoEnergy) {
                    e.currentTarget.src = authLogoEnergy;
                  }
                }}
              />
              
              <div className="w-full relative overflow-hidden rounded-[16px] border border-slate-200/80 bg-[#F8FBFB] p-4 text-left shadow-sm">
                <div className="inline-flex items-center gap-2 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00d8b8]" />
                  <span className="text-[11px] font-semibold text-slate-600">
                    Seu próximo projeto começa aqui
                  </span>
                </div>
                <p className="text-sm font-extrabold text-slate-900 leading-snug">
                  Da planta ao <span className="font-editorial italic font-normal text-base">sol</span>, tudo em um só lugar.
                </p>
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
