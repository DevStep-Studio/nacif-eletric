import React from "react";
import { useBranding } from "@/lib/appPreferences";
import { DEFAULT_LOGO_WHITE_URL } from "@/lib/brandingDefaults";
import authElectricalPanel from "@/assets/auth-electrical-panel.jpg";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { branding } = useBranding();
  const authLogo = branding.authLogoDataUrl || branding.logoDataUrl || branding.compactLogoDataUrl;
  const heroLogo = DEFAULT_LOGO_WHITE_URL;
  const brandName = [branding.appName, branding.appSuffix].filter(Boolean).join(" ") || "NACIF Solutions";
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white text-slate-950 lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14 xl:px-20">
        <header className="flex h-10 items-center">
          {authLogo ? (
            <img
              src={authLogo}
              alt={brandName}
              className="h-8 max-w-[150px] object-contain object-left"
            />
          ) : Icon ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          ) : null}
        </header>

        <main className="flex flex-1 items-center py-10 sm:py-12">
          <div className="mx-auto w-full max-w-[430px]">
            <div className="mb-7 text-left">
              <h1 className="text-[32px] font-extrabold leading-tight tracking-normal text-slate-950 sm:text-[34px]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  {subtitle}
                </p>
              )}
            </div>

            {children}

            {footer && (
              <p className="mt-6 text-center text-sm font-medium text-slate-500">
                {footer}
              </p>
            )}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-medium text-slate-400">
          <span>© {currentYear} {brandName}</span>
          <span className="flex items-center gap-5">
            <span>Privacidade</span>
            <span>Termos</span>
          </span>
        </footer>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden bg-[#061615] lg:block">
        <img
          src={authElectricalPanel}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#031211]/72" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_45%,rgba(0,216,184,0.30),rgba(3,18,17,0.18)_34%,rgba(3,18,17,0.82)_78%)]" />
        <div className="absolute inset-0 flex items-center justify-center px-16">
          <div className="flex w-full max-w-[430px] items-center justify-center">
            {heroLogo ? (
              <img
                src={heroLogo}
                alt={brandName}
                className="w-full object-contain drop-shadow-[0_22px_42px_rgba(0,0,0,0.45)]"
              />
            ) : (
              Icon && <Icon className="h-16 w-16 text-primary" aria-hidden="true" />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
