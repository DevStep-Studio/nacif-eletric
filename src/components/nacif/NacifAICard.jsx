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
      <div className="relative flex min-h-[240px] lg:h-[252px] flex-col justify-between overflow-hidden rounded-[18px] bg-gradient-to-br from-[#644AEF] via-[#4D61ED] to-[#3888F8] p-4 sm:p-5 text-white shadow-[0_12px_30px_rgba(91,74,232,0.28)]">
        {/* Aura luminosa atrás do mascote */}
        <div className="pointer-events-none absolute -right-4 -top-6 h-44 w-44 rounded-full bg-[#B9D2FF]/35 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-0 h-28 w-36 rounded-full bg-[#00F0A0]/16 blur-2xl" />

        {/* Mascote Nítido em Alta Resolução Integrado ao Topo Direito */}
        <div className="pointer-events-none absolute right-1 top-1 z-10 h-[144px] w-[144px] sm:h-[156px] sm:w-[156px] select-none">
          <img
            src={NACIF_AI_ASSETS.mascot}
            alt={NACIF_AI_ASSETS.mascotAlt}
            className="h-full w-full object-contain object-top drop-shadow-[0_12px_22px_rgba(20,16,78,0.34)]"
          />
        </div>

        {/* Cabeçalho */}
        <div className="relative z-20 max-w-[60%] pr-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4.5 w-4.5 text-[#DDFCF0]" />
            <h2 className="text-[18px] font-extrabold tracking-tight text-white leading-none">Nacif IA</h2>
          </div>
          <p className="mt-1.5 text-[11px] font-medium leading-snug text-white/88">
            Seu assistente em projetos elétricos
          </p>
        </div>

        {/* 3 Ações Principais */}
        <div className="relative z-20 mt-auto space-y-1.5 pt-2">
          {AI_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleOpenMode(action.id)}
                className="group flex h-[36px] w-full items-center justify-between gap-2 rounded-xl bg-[#F8FAFF] px-3 text-left text-[12px] font-semibold text-[#101828] shadow-[0_2px_8px_rgba(22,36,104,0.1)] transition-all duration-150 hover:bg-white hover:translate-x-0.5 active:scale-[0.99]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${action.iconColor}`} />
                  <span className="truncate">{action.label}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5B4AE8]" />
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
