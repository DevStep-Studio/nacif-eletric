import { AlertTriangle, CheckCircle2, ShieldAlert, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Painel de revisões automatizadas NBR 5410 com plano de ação e localização de circuito.
 */
export default function TechnicalReviewCard({
  hasCircuits = false,
  validations = [],
  actionPlan = [],
  onAutoFix,
  canAutoFix = false,
  saving = false,
  feedback = null,
  onLocateCircuit,
}) {
  const errorCount = validations.filter((item) => item.severity === "error").length;
  const warningCount = validations.filter((item) => item.severity === "warning").length;

  const feedbackClass =
    feedback?.tone === "danger"
      ? "border-red-200 bg-[#FEF2F2] text-red-700"
      : feedback?.tone === "warning"
      ? "border-amber-200 bg-[#FFF3E6] text-amber-800"
      : "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]";

  return (
    <section className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                errorCount > 0
                  ? "bg-[#FEF2F2] text-[#EF4444]"
                  : warningCount > 0
                  ? "bg-[#FFF3E6] text-amber-700"
                  : "bg-[#E5FBF2] text-[#006B50]"
              )}
            >
              <ShieldAlert className="h-4 w-4 stroke-[2.1]" />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-[#101828] leading-tight">
                Revisões NBR
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#64748B] leading-tight">
                Verificações automatizadas de dimensionamento
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums",
                errorCount > 0
                  ? "border-red-200 bg-[#FEF2F2] text-[#EF4444]"
                  : "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B]"
              )}
            >
              {errorCount} {errorCount === 1 ? "erro" : "erros"}
            </span>
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums",
                warningCount > 0
                  ? "border-amber-200 bg-[#FFF3E6] text-amber-800"
                  : "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B]"
              )}
            >
              {warningCount} {warningCount === 1 ? "aviso" : "avisos"}
            </span>
            {canAutoFix && (
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={onAutoFix}
                className="h-7 rounded-lg bg-[#00D98A] px-2.5 text-[11px] font-extrabold text-[#031923] hover:bg-[#00C987]"
              >
                <Zap className="mr-1 h-3 w-3" />
                {saving ? "Ajustando..." : "Ajustar projeto"}
              </Button>
            )}
          </div>
        </div>

        {feedback && (
          <div className={cn("mt-3 rounded-xl border px-3 py-2 text-xs font-semibold leading-snug", feedbackClass)}>
            {feedback.message}
          </div>
        )}

        {!hasCircuits ? (
          <div className="mt-3 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-3.5 py-3 text-xs font-medium text-[#64748B]">
            Cadastre pelo menos um circuito para executar as verificações técnicas preliminares.
          </div>
        ) : validations.length === 0 ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[#BEEAD2] bg-[#E5FBF2] px-3.5 py-3 text-xs font-semibold text-[#006B50]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Nenhuma inconsistência identificada nas verificações executadas.</span>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5 max-h-[220px] overflow-y-auto pr-0.5">
            {actionPlan.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-[#E5EBF1] bg-[#F8FAFC] p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Ações recomendadas
                </p>
                {actionPlan.map((action, idx) => (
                  <div
                    key={action.key}
                    className="flex items-start gap-2 rounded-lg border border-[#E5EBF1] bg-white px-2.5 py-2 text-xs"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold",
                        action.tone === "danger"
                          ? "bg-[#FEF2F2] text-[#EF4444]"
                          : "bg-[#FFF3E6] text-amber-700"
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#101828]">{action.title}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[#64748B]">{action.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {validations.map((v, i) => {
                const isError = v.severity === "error";
                const circuitRef = v.circuit_name || v.circuitName || null;
                const circuitIdx = typeof v.circuit_index === "number" ? v.circuit_index : null;
                return (
                  <div
                    key={`${v.code || "val"}-${i}`}
                    className={cn(
                      "flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-xs",
                      isError
                        ? "border-red-200 bg-[#FEF2F2] text-red-800"
                        : "border-amber-200 bg-[#FFF3E6] text-amber-900"
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-extrabold uppercase">
                            {isError ? "Erro" : "Aviso"}
                          </span>
                          {v.code && (
                            <span className="text-[10px] font-semibold opacity-75">{v.code}</span>
                          )}
                          {circuitRef && (
                            <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold">
                              {circuitRef}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-semibold leading-snug">{v.msg}</p>
                        {v.action && <p className="mt-0.5 text-[11px] opacity-85">{v.action}</p>}
                      </div>
                    </div>

                    {onLocateCircuit && (v.circuit_id || circuitIdx !== null || circuitRef) && (
                      <button
                        type="button"
                        onClick={() => onLocateCircuit(v)}
                        className="shrink-0 rounded-lg border border-current/25 bg-white px-2 py-1 text-[10.5px] font-bold hover:opacity-85 transition"
                      >
                        Localizar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 border-t border-[#E5EBF1] pt-2.5 text-[11px] font-medium leading-snug text-[#64748B]">
        A aprovação definitiva do projeto e a emissão de memorial técnico dependem de revisão e ART/RRT por profissional legalmente habilitado.
      </p>
    </section>
  );
}
