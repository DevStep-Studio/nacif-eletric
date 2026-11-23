import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { useBranding } from "@/lib/appPreferences";
import loginBackground from "@/assets/nacif_energy_login_fundo_sem_modal.webp";

/**
 * AuthLayout
 *
 * Layout fullscreen unificado para todas as telas de autenticação
 * (Login, Criar conta, Recuperação e Redefinição de senha),
 * com fotografia oficial ao fundo e modal branco flutuante à direita no desktop.
 */
export default function AuthLayout({
  headingId = "auth-heading",
  title,
  subtitle,
  error = "",
  afterContent = null,
  footer = null,
  children,
}) {
  const { branding } = useBranding();
  const brandName =
    [branding?.appName, branding?.appSuffix].filter(Boolean).join(" ") ||
    "NACIF Energy";
  const currentYear = new Date().getFullYear();

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#031923] font-sans text-[#101828] antialiased selection:bg-[#00d8b8]/25 selection:text-[#031923]">
      {/* Imagem arquitetônica oficial fullscreen sem distorção, blur ou gradientes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 min-h-full bg-cover bg-no-repeat bg-right lg:bg-[position:4%_center] xl:bg-[position:12%_center] 2xl:bg-center"
        style={{ backgroundImage: `url(${loginBackground})` }}
      />

      {/* Alternativa acessível para leitores de tela referente à arte de fundo */}
      <div className="sr-only">
        {brandName} — Grandes projetos começam aqui. Da planta ao sol, dê vida às
        suas ideias. Energia limpa e inteligente, projetos de alto desempenho e
        mais eficiência e valor.
      </div>

      {/* Card flutuante branco à direita no desktop e centralizado em telas menores */}
      <main className="relative z-10 flex min-h-[100dvh] w-full items-center justify-center px-4 py-6 sm:px-8 sm:py-8 lg:justify-end lg:px-8 lg:py-8 xl:pr-[84px] 2xl:pr-[126px]">
        <section
          aria-labelledby={title ? headingId : undefined}
          className="flex w-full max-w-[440px] flex-col justify-between rounded-[28px] bg-white p-6 shadow-[0_24px_64px_rgba(3,25,35,0.24)] ring-1 ring-black/[0.06] sm:max-w-[480px] sm:rounded-[32px] sm:p-9 lg:w-[445px] lg:max-w-[445px] lg:p-8 xl:w-[495px] xl:max-w-[495px] xl:rounded-[34px] xl:p-10 2xl:w-[530px] 2xl:max-w-[530px] 2xl:rounded-[36px] 2xl:px-11 2xl:py-10"
        >
          <div>
            {(title || subtitle) && (
              <header className="text-left">
                {title && (
                  <h1
                    id={headingId}
                    className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#081827] sm:text-[34px] 2xl:text-[40px]"
                  >
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-2.5 text-sm font-medium leading-[1.55] text-[#64748B] sm:text-[15px]">
                    {subtitle}
                  </p>
                )}
              </header>
            )}

            {error && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-700"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            )}

            <div className={title || subtitle ? "mt-6" : ""}>{children}</div>

            {(afterContent || footer) && (
              <div className="mt-5">
                {afterContent}
                {!afterContent && footer}
              </div>
            )}
          </div>

          <footer className="mt-6 border-t border-[#F1F5F9] pt-4 text-center text-xs font-medium text-[#64748B]">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span>
                © {currentYear} {brandName}
              </span>
              <span aria-hidden="true" className="h-3 w-px bg-[#DCE4EC]" />
              <Link
                to="/privacidade"
                className="transition-colors hover:text-[#081827] hover:underline"
              >
                Privacidade
              </Link>
              <span aria-hidden="true" className="h-3 w-px bg-[#DCE4EC]" />
              <Link
                to="/termos"
                className="transition-colors hover:text-[#081827] hover:underline"
              >
                Termos
              </Link>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
