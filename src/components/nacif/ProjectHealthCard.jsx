import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import { auditProjectNBR5410, calcProjectMetrics } from "@/lib/electricalEngine";
import { getProjectProgress } from "@/lib/projectProgress";
import { cn } from "@/lib/utils";

export default function ProjectHealthCard({ project, className = "", compact = false }) {
  const health = useMemo(() => {
    if (!project) return null;
    let metrics = null;
    try {
      metrics = calcProjectMetrics(project);
    } catch {
      metrics = null;
    }
    const audit = metrics?.audit || auditProjectNBR5410(project, metrics || {});
    const progress = getProjectProgress(project);
    const errorCount = audit?.errorCount || 0;
    const warnCount = audit?.warnCount || 0;
    const passedCount = audit?.passedCount || 0;
    const hasCircuits = (project.circuits?.length || metrics?.circuits?.length || 0) > 0;

    return {
      audit,
      progress,
      errorCount,
      warnCount,
      passedCount,
      hasCircuits,
      score: audit?.score,
      statusText: audit?.statusText || "Sem verificação",
      imbalancePct: metrics?.imbalance_pct ?? 0,
    };
  }, [project]);

  if (!project || !health) return null;

  const badgeClass =
    health.errorCount > 0
      ? "bg-red-50 text-[#EF4444] border-red-200"
      : health.warnCount > 0
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : health.hasCircuits
      ? "bg-[#DDFCF0] text-[#006F51] border-[#00D98A]/35"
      : "bg-[#F6F9FC] text-[#64748B] border-[#E5EBF1]";

  const StatusIcon =
    health.errorCount > 0
      ? AlertTriangle
      : health.hasCircuits
      ? CheckCircle2
      : Clock;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E5EBF1] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDFCF0] text-[#006F51]">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#101828]">Saúde Técnica & NBR 5410</h3>
            <p className="text-[11px] font-medium text-[#64748B]">
              {health.hasCircuits
                ? `${health.passedCount} aprovadas · ${health.warnCount} alertas · ${health.errorCount} pendências críticas`
                : "Adicione circuitos para iniciar a auditoria automática"}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
            badgeClass
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          <span>{health.score !== null && health.score !== undefined ? `NBR ${health.score}/100` : health.statusText}</span>
        </span>
      </div>

      {!compact && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Conclusão</span>
            <p className="mt-0.5 text-sm font-extrabold text-[#101828] tabular-nums">{health.progress.percent}%</p>
          </div>
          <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Etapa Atual</span>
            <p className="mt-0.5 truncate text-xs font-bold text-[#101828]">
              {health.progress.nextStep?.shortLabel || "Concluído"}
            </p>
          </div>
          <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Desequilíbrio Fases</span>
            <p className="mt-0.5 text-sm font-extrabold text-[#101828] tabular-nums">
              {health.hasCircuits ? `${Number(health.imbalancePct || 0).toFixed(1)}%` : "—"}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-3 py-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">Próximo passo</span>
              <p className="mt-0.5 truncate text-xs font-bold text-[#006F51]">Abrir etapa</p>
            </div>
            <Link
              to={health.progress.nextStep?.href || `/projects/${project.id}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00D98A] text-[#031923] hover:bg-[#00C47C]"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
