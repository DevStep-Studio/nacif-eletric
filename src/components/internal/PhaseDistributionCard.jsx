import { Activity, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const formatPhaseAmp = (value) =>
  `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} A`;

function getPhaseDiagnosis(metrics) {
  const imbalance = Number(metrics?.imbalance_pct) || 0;
  const loads = ["A", "B", "C"].map((phase) => ({
    phase,
    load: Number(metrics?.phaseLoad?.[phase]) || 0,
  }));
  const total = loads.reduce((sum, item) => sum + item.load, 0);
  if (total <= 0) return null;

  const activePhases = loads.filter((p) => p.load > 0);
  const highest = [...loads].sort((a, b) => b.load - a.load)[0];

  if (imbalance <= 5) {
    return {
      tone: "ok",
      text: "Cargas distribuídas dentro da faixa de equilíbrio recomendada.",
    };
  }

  if (activePhases.length === 1) {
    return {
      tone: imbalance > 10 ? "danger" : "warning",
      text: `Distribuição de carga concentrada na fase ${activePhases[0].phase}.`,
    };
  }

  const sharePct = Math.round((highest.load / total) * 100);
  return {
    tone: imbalance > 10 ? "danger" : "warning",
    text: `Maior concentração de demanda na fase ${highest.phase} (${sharePct}% da soma das fases).`,
  };
}

/**
 * Painel de distribuição de cargas por fase A/B/C com barra proporcional, diagnóstico factual e neutro estimado.
 */
export default function PhaseDistributionCard({ metrics, hasCircuits = true }) {
  const phaseLoad = metrics?.phaseLoad || { A: 0, B: 0, C: 0 };
  const totalPhaseCurrent = (Number(phaseLoad.A) || 0) + (Number(phaseLoad.B) || 0) + (Number(phaseLoad.C) || 0);
  const maxLoad = Math.max(Number(phaseLoad.A) || 0, Number(phaseLoad.B) || 0, Number(phaseLoad.C) || 0, 1);
  const imbalance = Number(metrics?.imbalance_pct) || 0;
  const diagnosis = hasCircuits ? getPhaseDiagnosis(metrics) : null;

  const badgeTone =
    !hasCircuits || totalPhaseCurrent <= 0
      ? "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B]"
      : imbalance > 10
      ? "border-red-200 bg-red-50 text-[#EF4444]"
      : imbalance > 5
      ? "border-amber-200 bg-[#FFF3E6] text-amber-800"
      : "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]";

  return (
    <section className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
              <Activity className="h-4 w-4 stroke-[2.1]" />
            </span>
            <div>
              <h2 className="text-[14px] font-bold text-[#101828] leading-tight">
                Distribuição de fases
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#64748B] leading-tight">
                Visualize o equilíbrio das cargas elétricas entre as fases.
              </p>
            </div>
          </div>

          <span className={cn("shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-extrabold tabular-nums", badgeTone)}>
            {hasCircuits && totalPhaseCurrent > 0 ? `${imbalance}% desequilíbrio` : "Sem cargas"}
          </span>
        </div>

        {/* Diagnóstico objetivo somente quando sustentado pelos dados */}
        {diagnosis && (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold",
              diagnosis.tone === "danger"
                ? "border-red-200 bg-[#FEF2F2] text-red-700"
                : diagnosis.tone === "warning"
                ? "border-amber-200 bg-[#FFF3E6] text-amber-800"
                : "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]"
            )}
          >
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>{diagnosis.text}</span>
          </div>
        )}

        {/* Barras das Fases A, B e C */}
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {["A", "B", "C"].map((ph) => {
            const load = Number(phaseLoad[ph]) || 0;
            const barWidthPct = totalPhaseCurrent > 0 ? (load / maxLoad) * 100 : 0;
            const sharePct = totalPhaseCurrent > 0 ? Math.round((load / totalPhaseCurrent) * 100) : null;

            const statusState =
              load <= 0
                ? { bar: "#CBD5E1", text: "text-[#64748B]", label: "Sem carga" }
                : imbalance > 10 && load === maxLoad
                ? { bar: "#EF4444", text: "text-[#EF4444]", label: "Sobrecarga relativa" }
                : imbalance > 5 && load === maxLoad
                ? { bar: "#F59E0B", text: "text-amber-700", label: "Atenção" }
                : { bar: "#00D98A", text: "text-[#006B50]", label: "Adequada" };

            return (
              <div key={ph} className="rounded-xl border border-[#E5EBF1] bg-[#F8FAFC] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#101828]">Fase {ph}</span>
                  <span className="text-xs font-extrabold text-[#101828] tabular-nums">
                    {formatPhaseAmp(load)}
                  </span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5EBF1]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, barWidthPct)}%`, backgroundColor: statusState.bar }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[10.5px] font-semibold">
                  <span className={statusState.text}>{statusState.label}</span>
                  <span className="text-[#64748B] tabular-nums">
                    {sharePct !== null ? `${sharePct}% do total` : "0%"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Área Técnica Compacta do Neutro Estimado */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-3.5 py-2 text-xs">
        <span className="font-semibold text-[#64748B]">
          Neutro estimado (soma vetorial das fases)
        </span>
        <span className="font-extrabold text-[#101828] tabular-nums">
          {(Number(metrics?.neutral_a) || 0).toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}{" "}
          A
        </span>
      </div>
    </section>
  );
}
