import React from "react";
import { useBranding } from "@/lib/appPreferences";
import authNacifEnergy from "@/assets/auth-nacif-energy.jpg";
import authLogoEnergy from "@/assets/brand-logo-principal.png";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
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
    <div className="min-h-screen bg-white text-slate-950 lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14 xl:px-20">
        <header className="flex h-10 items-center">
          {authLogo ? (
            <img
              src={authLogo}
              alt={brandName}
              className="h-8 max-w-[150px] object-contain object-left"
              onError={(e) => {
                if (e.currentTarget.src !== authLogoEnergy) {
                  e.currentTarget.src = authLogoEnergy;
                }
              }}
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
            <a href="/privacidade" className="hover:text-slate-600 transition">Privacidade</a>
            <a href="/termos" className="hover:text-slate-600 transition">Termos</a>
          </span>
        </footer>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden bg-[#061615] lg:block">
        <img
          src={authNacifEnergy}
          alt="NACIF Energy"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </aside>
    </div>
  );
}
