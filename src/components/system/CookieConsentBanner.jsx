import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, Shield, Check, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const COOKIE_CONSENT_KEY = "nacif_cookie_consent_v1";

export const getCookieConsent = () => {
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const openCookiePreferences = () => {
  window.dispatchEvent(new CustomEvent("nacif:open-cookie-preferences"));
};

export default function CookieConsentBanner() {
  const [consent, setConsent] = useState(() => getCookieConsent());
  const [modalOpen, setModalOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true
    functional: true,
    analytics: true,
  });

  useEffect(() => {
    const handleOpenModal = () => {
      const current = getCookieConsent() || { necessary: true, functional: true, analytics: false };
      setPreferences(current);
      setModalOpen(true);
    };

    window.addEventListener("nacif:open-cookie-preferences", handleOpenModal);
    return () => window.removeEventListener("nacif:open-cookie-preferences", handleOpenModal);
  }, []);

  const saveConsent = (prefs) => {
    const data = {
      ...prefs,
      necessary: true,
      timestamp: new Date().toISOString(),
      version: "1.0",
    };
    try {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(data));
    } catch {}
    setConsent(data);
    setModalOpen(false);
  };

  const handleAcceptAll = () => {
    saveConsent({ necessary: true, functional: true, analytics: true });
  };

  const handleAcceptNecessary = () => {
    saveConsent({ necessary: true, functional: false, analytics: false });
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
  };

  // If consent already given and modal not open, render nothing
  if (consent && !modalOpen) return null;

  return (
    <>
      {/* Floating Bottom Banner if no consent given yet */}
      {!consent && (
        <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-2xl">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
                <Cookie className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-[#0F172A]">
                  Privacidade & Cookies
                </p>
                <p className="text-[11px] sm:text-xs font-medium leading-relaxed text-[#64748B]">
                  Utilizamos cookies estritamente necessários para autenticação e segurança, além de cookies analíticos para aprimorar o desempenho das ferramentas de engenharia elétrica. Saiba mais na nossa{" "}
                  <Link to="/cookies" className="text-[#00d8b8] font-bold underline hover:text-[#00bda1]">
                    Política de Cookies
                  </Link>.
                </p>
              </div>
            </div>

            <div className="flex w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(true)}
                className="h-9 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B]"
              >
                Personalizar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAcceptNecessary}
                className="h-9 w-full sm:w-auto rounded-xl text-xs font-bold text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Apenas necessários
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAcceptAll}
                className="h-9 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs shadow-sm"
              >
                Aceitar todos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-[#E2E8F0] p-6 shadow-2xl">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
              <Shield className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-extrabold text-[#0F172A]">
              Preferências de Privacidade & Cookies
            </DialogTitle>
            <DialogDescription className="text-xs font-medium leading-relaxed text-[#64748B]">
              Gerencie como tratamos dados de navegação no seu dispositivo. Você pode atualizar suas preferências a qualquer momento.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y divide-[#F1F5F9] my-2">
            {/* Necessários */}
            <div className="flex items-start justify-between gap-4 py-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-[#0F172A]">Cookies Necessários</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-600">Sempre Ativos</span>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Essenciais para autenticação segura, retenção de sessão, segurança contra CSRF e carregamento da aplicação.
                </p>
              </div>
              <Switch checked={true} disabled className="mt-1" />
            </div>

            {/* Funcionais */}
            <div className="flex items-start justify-between gap-4 py-3.5">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-[#0F172A]">Preferências & Funcionalidades</span>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Permitem lembrar suas preferências de layout, zoom do editor elétrico e configurações de tema.
                </p>
              </div>
              <Switch
                checked={preferences.functional}
                onCheckedChange={(val) => setPreferences({ ...preferences, functional: val })}
                className="mt-1 data-[state=checked]:bg-[#00d8b8]"
              />
            </div>

            {/* Analíticos */}
            <div className="flex items-start justify-between gap-4 py-3.5">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-[#0F172A]">Métricas & Diagnósticos</span>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Ajudam a identificar falhas de cálculo elétrico e lentidão sem coletar informações pessoais identificáveis.
                </p>
              </div>
              <Switch
                checked={preferences.analytics}
                onCheckedChange={(val) => setPreferences({ ...preferences, analytics: val })}
                className="mt-1 data-[state=checked]:bg-[#00d8b8]"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleAcceptNecessary}
              className="h-10 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B]"
            >
              Apenas necessários
            </Button>
            <Button
              type="button"
              onClick={handleSavePreferences}
              className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs"
            >
              Salvar preferências
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
