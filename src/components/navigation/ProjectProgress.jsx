import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, Circle, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getProjectProgress } from "@/lib/projectProgress";

export default function ProjectProgress({
  project,
  variant = "full", // "full" | "compact" | "horizontal" | "card"
  showSteps = true,
  className = "",
}) {
  const progress = useMemo(() => getProjectProgress(project), [project]);

  if (variant === "compact") {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-xs font-bold text-[#475467]">
          <span>Progresso</span>
          <span className="text-[#00d8b8] font-black">{progress.percent}%</span>
        </div>
        <Progress value={progress.percent} className="h-1.5 bg-[#EAECF0]" />
      </div>
    );
  }

  if (variant === "horizontal") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Progress value={progress.percent} className="h-2 w-28 bg-[#EAECF0]" />
        <span className="text-xs font-extrabold text-[#101828]">{progress.percent}%</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm ${className}`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#667085]">Progresso do Projeto</h4>
            <p className="mt-0.5 text-sm font-extrabold text-[#101828]">{project?.name || "Projeto"}</p>
          </div>
          <span className="text-sm font-black text-[#00d8b8]">{progress.percent}%</span>
        </div>

        <Progress value={progress.percent} className="mt-3 h-2 bg-[#EAECF0]" />

        {showSteps && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {progress.steps.map((step) => (
              <Link
                key={step.id}
                to={step.href}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                  step.done
                    ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                    : "border-[#EAECF0] bg-[#F9FAFB] text-[#667085] hover:border-[#00d8b8]/40 hover:text-[#101828]"
                }`}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 stroke-[3]" />
                ) : (
                  <Circle className="h-3 w-3 shrink-0 text-[#98A2B3]" />
                )}
                <span className="truncate">{step.shortLabel}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Variant === "full"
  return (
    <div className={`rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-[#101828] uppercase tracking-wider">Fluxo do Projeto Elétrico</h3>
          <p className="text-xs font-semibold text-[#667085]">
            {progress.completedCount} de {progress.totalCount} etapas concluídas
          </p>
        </div>
        <span className="text-base font-black text-[#00d8b8]">{progress.percent}%</span>
      </div>

      <Progress value={progress.percent} className="h-2 bg-[#EAECF0]" />

      <div className="space-y-1.5 pt-1">
        {progress.steps.map((step) => (
          <Link
            key={step.id}
            to={step.href}
            className={`flex items-center justify-between rounded-lg p-2 text-xs transition ${
              step.done
                ? "bg-emerald-50/50 text-[#101828]"
                : "text-[#475467] hover:bg-[#F9FAFB] hover:text-[#101828]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {step.done ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#D0D5DD] text-transparent" />
              )}
              <span className={`font-bold ${step.done ? "text-emerald-900" : "text-[#344054]"}`}>
                {step.label}
              </span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 opacity-40 hover:opacity-100 transition" />
          </Link>
        ))}
      </div>
    </div>
  );
}
