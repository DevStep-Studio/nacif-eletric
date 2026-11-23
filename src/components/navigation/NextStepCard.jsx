import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProjectProgress } from "@/lib/projectProgress";
import { cn } from "@/lib/utils";

/**
 * Barra contextual minimalista de próxima etapa guiada do projeto (sem gradientes).
 */
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
  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]",
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
            <Sparkles className="h-4 w-4 stroke-[2]" />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#006B50]">
              Próxima etapa
            </p>
            <p className="truncate text-xs font-bold text-[#101828]">
              {progress.nextStepActionTitle}
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          className="h-8 shrink-0 rounded-xl bg-[#00D98A] px-3 text-xs font-bold text-[#031923] hover:bg-[#00C47C]"
        >
          <Link to={next.href}>
            Continuar
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] md:flex-row md:items-center md:justify-between md:px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
          <Sparkles className="h-4 w-4 stroke-[2.1]" />
        </span>

        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#475569]">
              Etapa {progress.completedCount + 1} de {progress.totalCount}
            </span>
            <h3 className="text-sm font-extrabold text-[#101828]">
              {progress.nextStepActionTitle}
            </h3>
          </div>
          <p className="text-xs font-medium leading-relaxed text-[#64748B]">
            {progress.nextStepActionDescription}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
        {next.id === "plant" && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
          >
            <Link to={`/scanner?project=${project.id}`}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#5B4AE8]" />
              Digitalizar com IA
            </Link>
          </Button>
        )}

        <Button
          asChild
          size="sm"
          className="h-8 rounded-xl bg-[#00D98A] px-3.5 text-xs font-extrabold text-[#031923] hover:bg-[#00C47C]"
        >
          <Link to={next.href}>
            {progress.nextStepButtonLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>

        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#64748B] transition hover:bg-[#F6F9FC] hover:text-[#101828]"
        >
          Fazer depois
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F6F9FC] hover:text-[#101828]"
          aria-label="Ocultar sugestão de próxima etapa"
          title="Ocultar sugestão"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}
