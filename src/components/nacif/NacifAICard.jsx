import { useState } from "react";
import { ChevronRight, ClipboardCheck, Lightbulb, Sparkles, Sun } from "lucide-react";
import { NACIF_AI_ASSETS } from "@/lib/dashboardAssets";
import NacifAIAssistantDialog from "./NacifAIAssistantDialog";

const AI_ACTIONS = [
  {
    id: "loads",
    label: "Dimensione a carga deste projeto",
    icon: Lightbulb,
    iconColor: "text-amber-500",
  },
  {
    id: "nbr5410",
    label: "Verifique a conformidade com a NBR 5410",
    icon: ClipboardCheck,
    iconColor: "text-[#5B4AE8]",
  },
  {
    id: "solar",
    label: "Sugira um sistema solar ideal",
    icon: Sun,
    iconColor: "text-[#006F51]",
  },
];

export default function NacifAICard({ project = null }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("loads");

  const handleOpenMode = (mode) => {
    setDialogMode(mode);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="relative flex min-h-[240px] lg:h-[252px] flex-col justify-between overflow-hidden rounded-[18px] bg-gradient-to-br from-[#162032] via-[#1A2C42] to-[#123E3A] p-4 sm:p-4.5 text-white shadow-[0_8px_24px_rgba(18,62,58,0.14)] border border-white/10">
        {/* Aura luminosa sutil */}
        <div className="pointer-events-none absolute -right-3 -top-4 h-32 w-32 rounded-full bg-[#00F0A0]/14 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 left-0 h-20 w-28 rounded-full bg-[#38BDF8]/12 blur-2xl" />

        {/* Mascote Compacto e Proporcional Integrado ao Topo Direito */}
        <div className="pointer-events-none absolute right-2 top-2 z-10 h-[88px] w-[88px] sm:h-[98px] sm:w-[98px] select-none opacity-90">
          <img
            src={NACIF_AI_ASSETS.mascot}
            alt={NACIF_AI_ASSETS.mascotAlt}
            className="h-full w-full object-contain object-top drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
          />
        </div>

        {/* Cabeçalho Limpo */}
        <div className="relative z-20 max-w-[65%] pr-2">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#00F0A0]/20 text-[#00F0A0]">
              <Sparkles className="h-3 w-3" />
            </span>
            <h2 className="text-[17px] font-extrabold tracking-tight text-white leading-none">Nacif IA</h2>
          </div>
          <p className="mt-1 text-[11px] font-medium leading-snug text-slate-300">
            Assistente inteligente de engenharia
          </p>
        </div>

        {/* 3 Ações Principais Otimizadas */}
        <div className="relative z-20 mt-auto space-y-1.5 pt-2">
          {AI_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleOpenMode(action.id)}
                className="group flex h-[33px] w-full items-center justify-between gap-2 rounded-xl bg-white/95 px-3 text-left text-[11.5px] font-semibold text-[#101828] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-150 hover:bg-white hover:translate-x-0.5 active:scale-[0.99]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${action.iconColor}`} />
                  <span className="truncate">{action.label}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#00A86B]" />
              </button>
            );
          })}
        </div>
      </div>

      <NacifAIAssistantDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        project={project}
      />
    </>
  );
}
