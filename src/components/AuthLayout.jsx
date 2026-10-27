import React from "react";
import { motion } from "framer-motion";
import authCardHero from "@/assets/auth-card-hero.jpg";
import { useBranding } from "@/lib/appPreferences";

/**
 * AuthLayout
 * 
 * Layout unificado para as páginas de autenticação (Login, Cadastro, Recuperação de Senha)
 * com efeito de abertura cinematográfico e movimentação fluida (Framer Motion):
 * - Painel esquerdo com entrada tridimensional (scale + blur reveal) e varredura de luz.
 * - Formulário à direita com deslizamento lateral suave e harmonioso.
 */
export default function AuthLayout({ title, subtitle, footer, children }) {
  const { branding } = useBranding();
  const brandName = [branding?.appName, branding?.appSuffix].filter(Boolean).join(" ") || "NACIF Energy";
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#FAFCFC] text-slate-900 flex flex-col justify-between selection:bg-[#00d8b8]/20 selection:text-slate-950 overflow-hidden">
      {/* Container Principal de 2 Colunas */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8 xl:px-12">
        <div className="w-full max-w-[1020px] mx-auto grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] xl:grid-cols-[1.18fr_0.82fr] gap-8 lg:gap-14 xl:gap-20 items-center">
          
          {/* ─────────────────────────────────────────────────────────────
              PAINEL ESQUERDO (Desktop):
              Card visual com a imagem oficial da Nacif Energy e 
              animação de abertura com feixe de luz reflexivo
             ───────────────────────────────────────────────────────────── */}
          <motion.aside
            initial={{ opacity: 0, scale: 0.94, y: 36, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.015, transition: { duration: 0.35 } }}
            className="hidden lg:flex relative overflow-hidden rounded-[24px] border border-slate-200/80 shadow-[0_20px_50px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.02)] w-full max-w-[490px] h-[640px] xl:h-[660px] mx-auto bg-slate-900 group cursor-default"
          >
            <img
              src={authCardHero}
              alt="Nacif Energy — Grandes projetos começam aqui"
              className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
            {/* Feixe animado de iluminação que varre o card na abertura */}
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: "200%", opacity: [0, 0.65, 0] }}
              transition={{ duration: 1.6, delay: 0.25, ease: "easeInOut" }}
              className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg] pointer-events-none"
            />
          </motion.aside>

          {/* ─────────────────────────────────────────────────────────────
              COLUNA DIREITA: Formulário Compacto com Entrada Deslizante
             ───────────────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, x: 28, y: 16 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.75, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[360px] mx-auto flex flex-col justify-center"
          >
            
            {/* Versão compacta para Mobile (< lg): Banner com animação suave */}
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden mb-6 flex flex-col items-center text-center"
            >
              <div className="w-full relative h-[210px] overflow-hidden rounded-[18px] border border-slate-200/80 shadow-md">
                <img
                  src={authCardHero}
                  alt="Nacif Energy"
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </motion.div>

            {/* Cabeçalho do Formulário (Centralizado) */}
            {(title || subtitle) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="mb-7 text-center"
              >
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
              </motion.div>
            )}

            {/* Conteúdo do Formulário */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>

            {/* Rodapé auxiliar do formulário (ex: Links de Alternância) */}
            {footer && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-6 text-center text-xs font-normal text-slate-500"
              >
                {footer}
              </motion.div>
            )}
          </motion.section>
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
