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
      <div className="relative flex min-h-[258px] flex-col justify-between overflow-hidden rounded-[22px] bg-gradient-to-br from-[#5B4AE8] via-[#4E61EB] to-[#3B82F6] p-5 text-white shadow-[0_14px_34px_rgba(91,74,232,0.28)]">
        {/* Glow decorativo restrito à identidade IA */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-0 h-32 w-40 rounded-full bg-[#00F0A0]/15 blur-2xl" />

        {/* Cabeçalho com Mascote Substituível */}
        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="pt-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-[#00F0A0]" />
              </span>
              <h2 className="text-lg font-extrabold tracking-tight text-white">Nacif IA</h2>
            </div>
            <p className="mt-1 text-xs font-medium text-white/80">
              Seu assistente em projetos elétricos
            </p>
          </div>

          <div className="relative -mr-2 -mt-2 h-20 w-24 shrink-0 select-none">
            <img
              src={NACIF_AI_ASSETS.mascot}
              alt={NACIF_AI_ASSETS.mascotAlt}
              className="h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(3,25,35,0.35)]"
            />
          </div>
        </div>

        {/* 3 Botões Principais */}
        <div className="relative z-10 mt-3 space-y-2">
          {AI_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => handleOpenMode(action.id)}
                className="group flex h-10 w-full items-center justify-between gap-2.5 rounded-xl bg-white px-3.5 text-left text-xs font-semibold text-[#101828] shadow-sm transition-all duration-150 hover:bg-[#F6F9FC] hover:translate-x-0.5 active:scale-[0.99]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Icon className={`h-4 w-4 shrink-0 ${action.iconColor}`} />
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
