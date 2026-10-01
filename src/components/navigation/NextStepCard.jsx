import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Sparkles, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProjectProgress } from "@/lib/projectProgress";

export default function NextStepCard({
  project,
  className = "",
  onDismiss,
  compact = false,
}) {
  const [dismissed, setDismissed] = useState(false);
  const progress = useMemo(() => getProjectProgress(project), [project]);

  if (!project || progress.isComplete || dismissed) return null;

  const next = progress.nextStep;

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-xl border border-[#BCEEE5] bg-[#F7FBFE] p-3 shadow-sm ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8FCF8] text-[#00d8b8]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#0f4f49]">Próxima etapa</p>
            <p className="truncate text-xs font-bold text-[#101828]">{progress.nextStepActionTitle}</p>
          </div>
        </div>
        <Button asChild size="sm" className="h-8 rounded-lg bg-[#00d8b8] px-3 text-xs font-black text-slate-950 hover:bg-[#00d8b8]/90">
          <Link to={next.href}>
            Continuar
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-[#BCEEE5] bg-[#F7FBFE] p-5 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8] ring-1 ring-[#00d8b8]/20">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#0f4f49]">Modo Guiado</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#00d8b8]" />
              <span className="text-xs font-bold text-[#667085]">Etapa {progress.completedCount + 1} de {progress.totalCount}</span>
            </div>
            <h3 className="text-base font-extrabold text-[#101828] mt-0.5">
              {progress.nextStepActionTitle}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          className="text-[#98A2B3] hover:text-[#101828] transition p-1"
          title="Ocultar sugestão"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-sm font-medium leading-relaxed text-[#475467] max-w-2xl">
        {progress.nextStepActionDescription}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild className="h-9 rounded-lg bg-[#00d8b8] px-4 text-xs font-black text-slate-950 hover:bg-[#00d8b8]/90 shadow-sm">
          <Link to={next.href}>
            {progress.nextStepButtonLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>

        {next.id === "plant" && (
          <Button asChild variant="outline" className="h-9 rounded-lg border-[#D0D5DD] bg-white px-3 text-xs font-extrabold text-[#344054] hover:bg-[#F9FAFB]">
            <Link to={`/scanner?project=${project.id}`}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#00d8b8]" />
              Digitalizar com IA
            </Link>
          </Button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-2 text-xs font-bold text-[#667085] hover:text-[#101828] transition"
        >
          Fazer depois
        </button>
      </div>
    </div>
  );
}
