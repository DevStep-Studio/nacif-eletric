import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Headphones, MessageSquareText, Sparkles, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const DEFAULT_SUPPORT_WHATSAPP = "5521985814035";

const QUICK_TOPICS = [
  {
    id: "dimensionamento",
    label: "Dúvida técnica / Dimensionamento",
  },
  {
    id: "quadros_planta",
    label: "Suporte em Quadros ou Planta",
  },
  {
    id: "planos_financeiro",
    label: "Planos, Assinatura e Financeiro",
  },
];

/**
 * Normaliza o número de WhatsApp garantindo apenas dígitos e DDI 55 (Brasil)
 */
function normalizeWhatsAppNumber(rawValue) {
  const digits = String(rawValue || DEFAULT_SUPPORT_WHATSAPP).replace(/\D/g, "");
  if (!digits) return DEFAULT_SUPPORT_WHATSAPP;
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Ícone SVG Oficial do WhatsApp
 */
function WhatsAppIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.031 2C6.508 2 2.023 6.485 2.023 12.008c0 1.766.461 3.49 1.337 5.011L2 22l5.122-1.343a9.97 9.97 0 0 0 4.909 1.292h.004c5.522 0 10.007-4.485 10.007-10.008C22.042 6.485 17.554 2 12.031 2Zm5.823 14.155c-.246.693-1.434 1.326-1.996 1.411-.513.077-1.163.11-1.878-.118-.434-.138-.99-.322-1.703-.63-2.996-1.294-4.953-4.31-5.103-4.51-.149-.2-1.218-1.621-1.218-3.092 0-1.471.771-2.194 1.045-2.494.274-.3.598-.375.797-.375.199 0 .398.002.573.01.184.009.43-.07.673.514.249.599.847 2.071.921 2.221.075.15.125.325.025.524-.1.2-.15.325-.299.499-.15.175-.314.39-.449.524-.15.15-.305.312-.131.612.174.299.774 1.277 1.662 2.069 1.142 1.018 2.104 1.333 2.403 1.483.299.15.473.125.648-.075.175-.2.747-.873.947-1.173.199-.3.398-.25.672-.15.274.1 1.744.823 2.043.973.299.15.498.225.573.35.075.125.075.723-.171 1.417Z" />
    </svg>
  );
}

export default function SupportWhatsAppWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(QUICK_TOPICS[0].label);
  const [customMessage, setCustomMessage] = useState("");
  const containerRef = useRef(null);

  const rawSupportPhone =
    import.meta.env.VITE_SUPPORT_WHATSAPP || DEFAULT_SUPPORT_WHATSAPP;
  const supportPhone = normalizeWhatsAppNumber(rawSupportPhone);

  // Fecha ao pressionar ESC ou clicar fora do widget
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const buildWhatsAppUrl = () => {
    const userName =
      user?.full_name?.trim() ||
      user?.name?.trim() ||
      (user?.email ? user.email.split("@")[0] : "");
    const userEmail = user?.email?.trim() || "";

    const identityPart =
      userName && userEmail
        ? `Sou ${userName} (${userEmail}). `
        : userName
          ? `Sou ${userName}. `
          : userEmail
            ? `Meu e-mail é ${userEmail}. `
            : "";

    const trimmedCustom = customMessage.trim();
    let subjectText = selectedTopic || "Atendimento técnico e comercial";

    if (selectedTopic && trimmedCustom) {
      subjectText = `${selectedTopic} — ${trimmedCustom}`;
    } else if (!selectedTopic && trimmedCustom) {
      subjectText = trimmedCustom;
    }

    const fullMessage = `Olá, equipe Nacif Energy! ${identityPart}Preciso de suporte sobre: ${subjectText}.`;
    return `https://wa.me/${supportPhone}?text=${encodeURIComponent(fullMessage)}`;
  };

  const handleStartWhatsAppChat = (e) => {
    e.preventDefault();
    const url = buildWhatsAppUrl();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      ref={containerRef}
      data-html2canvas-ignore="true"
      className="no-print fixed bottom-1.5 right-3 z-50 flex flex-col items-end print:hidden"
    >
      {/* Mini-Aba / Card de Suporte (Estado Aberto) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="support-whatsapp-card"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label="Suporte Nacif Energy via WhatsApp"
            className="mb-3.5 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#ffffff] text-[#0f172a] shadow-2xl"
          >
            {/* Cabeçalho Institucional */}
            <div className="relative overflow-hidden bg-[#031923] px-4 py-3.5 text-white">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#00D98A]/20 blur-xl"
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00D98A]/15 text-[#00F0A0] ring-1 ring-[#00D98A]/35">
                    <Headphones className="h-4 w-4" />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F0A0] opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-[#031923] bg-[#00D98A]" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-extrabold tracking-tight text-white">
                      Suporte Nacif Energy
                    </h3>
                    <p className="flex items-center gap-1.5 truncate text-[11px] font-medium text-slate-300">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00F0A0]" />
                      Online • Atendimento técnico e comercial
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fechar aba de suporte"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Corpo da Aba */}
            <form onSubmit={handleStartWhatsAppChat} className="p-4 space-y-3.5">
              {/* Balão de Boas-Vindas */}
              <div className="rounded-xl border border-[#e2e8f0] bg-[#F8FAFC] p-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#E8FCF8] text-[#00d8b8]">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs font-medium leading-relaxed text-[#0f172a]">
                    Olá! Precisa de ajuda com seus projetos elétricos,
                    dimensionamento solar ou assinatura?
                  </p>
                </div>
              </div>

              {/* Atalhos Rápidos (Chips clicáveis) */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">
                  Selecione o assunto
                </p>
                <div className="flex flex-col gap-1.5">
                  {QUICK_TOPICS.map((topic) => {
                    const isSelected = selectedTopic === topic.label;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() =>
                          setSelectedTopic(isSelected ? "" : topic.label)
                        }
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-all ${
                          isSelected
                            ? "border-[#00d8b8] bg-[#E8FCF8] text-[#0f4f49] shadow-sm ring-1 ring-[#00d8b8]/30"
                            : "border-[#e2e8f0] bg-white text-[#0f172a] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span className="truncate">{topic.label}</span>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                            isSelected
                              ? "border-[#00d8b8] bg-[#00d8b8] text-slate-950"
                              : "border-[#CBD5E1] bg-white text-transparent"
                          }`}
                        >
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campo de Texto Rápido (Opcional) */}
              <div className="space-y-1">
                <label
                  htmlFor="nacif-support-quick-input"
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#64748B]"
                >
                  <MessageSquareText className="h-3 w-3 text-[#00d8b8]" />
                  Mensagem adicional (opcional)
                </label>
                <textarea
                  id="nacif-support-quick-input"
                  rows={2}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Ou digite sua dúvida aqui..."
                  className="w-full resize-none rounded-xl border border-[#e2e8f0] bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#0f172a] placeholder:text-[#94A3B8] transition focus:border-[#00d8b8] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Botão de Ação Principal */}
              <button
                type="submit"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#00D98A] px-4 text-xs font-extrabold text-[#031923] shadow-md transition-all hover:bg-[#00C47C] active:scale-[0.99]"
              >
                <WhatsAppIcon className="h-4 w-4 shrink-0" />
                <span>Iniciar conversa no WhatsApp</span>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão Disparador Compacto */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Suporte Nacif via WhatsApp"
        title="Suporte Nacif"
        className="group relative flex h-9 items-center justify-center rounded-full border border-[#00D98A]/45 bg-[#031923]/95 px-1.5 text-white shadow-lg transition-all duration-300 hover:border-[#00F0A0] hover:bg-[#082732] hover:shadow-xl active:scale-95"
      >
        {/* Indicador visual de status online (ponto verde pulsante) */}
        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F0A0] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-[#00D98A]" />
        </span>

        {/* Círculo com ícone oficial do WhatsApp */}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#00D98A] text-[#031923] transition-transform duration-200 group-hover:scale-105">
          {isOpen ? (
            <X className="h-3.5 w-3.5 stroke-[2.5]" />
          ) : (
            <WhatsAppIcon className="h-3.5 w-3.5" />
          )}
        </span>

        {/* Rótulo expansível no hover */}
        <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-black tracking-tight text-white opacity-0 transition-all duration-300 ease-out group-hover:ml-1.5 group-hover:max-w-[105px] group-hover:pr-1.5 group-hover:opacity-100">
          Suporte Nacif
        </span>
      </button>
    </div>
  );
}
