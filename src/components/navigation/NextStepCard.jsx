import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, X } from "lucide-react";
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
      <div className={`flex items-center justify-between gap-3 rounded-2xl border border-[#00D98A]/35 bg-[#DDFCF0]/35 p-3 shadow-xs ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#DDFCF0] text-[#006F51]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#006F51]">Próxima etapa</p>
            <p className="truncate text-xs font-bold text-[#101828]">{progress.nextStepActionTitle}</p>
          </div>
        </div>
        <Button asChild size="sm" className="h-8 rounded-xl bg-[#00D98A] px-3 text-xs font-bold text-[#031923] hover:bg-[#00C47C]">
          <Link to={next.href}>
            Continuar
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[#00D98A]/35 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DDFCF0] text-[#006F51]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#006F51]">Modo Guiado</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D98A]" />
              <span className="text-xs font-semibold text-[#64748B]">Etapa {progress.completedCount + 1} de {progress.totalCount}</span>
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
          className="text-[#94A3B8] hover:text-[#101828] transition p-1"
          title="Ocultar sugestão"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-sm font-medium leading-relaxed text-[#64748B] max-w-2xl">
        {progress.nextStepActionDescription}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild className="h-9 rounded-xl bg-[#00D98A] px-4 text-xs font-bold text-[#031923] hover:bg-[#00C47C] shadow-xs">
          <Link to={next.href}>
            {progress.nextStepButtonLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>

        {next.id === "plant" && (
          <Button asChild variant="outline" className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-bold text-[#101828] hover:bg-[#F6F9FC]">
            <Link to={`/scanner?project=${project.id}`}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#5B4AE8]" />
              Digitalizar com IA
            </Link>
          </Button>
        )}

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-2 text-xs font-semibold text-[#64748B] hover:text-[#101828] transition"
        >
          Fazer depois
        </button>
      </div>
    </div>
  );
}
