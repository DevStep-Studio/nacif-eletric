import { Check, AlertCircle } from "lucide-react";

/**
 * SolarStepper.jsx — Indicador de etapas minimalista, limpo e profissional (sem gradientes).
 */
export default function SolarStepper({
  steps = [],
  currentIndex = 0,
  maxVisited = 0,
  hasErrors = false,
  onStepClick,
}) {
  const currentStep = steps[currentIndex] || steps[0];
  const progressPct = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Mobile: Barra de progresso compacta e minimalista */}
      <div className="block sm:hidden space-y-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-600">
            Etapa {currentIndex + 1} de {steps.length}
          </span>
          <span className="text-xs font-black text-slate-900">
            {currentStep?.label}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-[#00d8b8] transition-all duration-300 ease-out rounded-full"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: Stepper linear minimalista */}
      <nav aria-label="Progresso do cadastro" className="hidden sm:block">
        <ol className="relative flex items-center justify-between w-full">
          {/* Linha conectora de fundo (track cinza neutro) */}
          <div
            className="absolute top-4.5 h-[2px] bg-slate-100 -z-0"
            style={{
              left: `${100 / (steps.length * 2)}%`,
              right: `${100 / (steps.length * 2)}%`,
            }}
            aria-hidden="true"
          />

          {/* Linha de progresso ativa preenchida (sem gradiente) */}
          <div
            className="absolute top-4.5 h-[2px] bg-[#00d8b8] transition-all duration-300 ease-out -z-0"
            style={{
              left: `${100 / (steps.length * 2)}%`,
              width: `calc(${progressPct}% * ${(steps.length - 1) / steps.length})`,
            }}
            aria-hidden="true"
          />

          {steps.map((step, index) => {
            const isCurrent = index === currentIndex;
            const isDone = index < currentIndex;
            const isClickable = index <= maxVisited;
            const isError = isCurrent && hasErrors;

            return (
              <li
                key={step.key}
                className="relative z-10 flex flex-1 flex-col items-center"
              >
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick?.(index)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`group flex flex-col items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8] focus-visible:ring-offset-2 rounded-xl transition-all ${
                    isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-90"
                  }`}
                >
                  {/* Círculo da etapa */}
                  <span
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all duration-200 ${
                      isCurrent
                        ? isError
                          ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                          : "bg-[#00d8b8] text-white ring-4 ring-[#00d8b8]/20"
                        : isDone
                        ? "bg-[#00d8b8] text-white"
                        : "border-2 border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:text-slate-500"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : isError ? (
                      <AlertCircle className="h-4 w-4 stroke-[2.5]" />
                    ) : (
                      index + 1
                    )}
                  </span>

                  {/* Texto da etapa */}
                  <span
                    className={`whitespace-nowrap text-center text-[11px] sm:text-[12px] transition-colors ${
                      isCurrent
                        ? "font-black text-slate-900"
                        : isDone
                        ? "font-bold text-slate-700"
                        : "font-semibold text-slate-400 group-hover:text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
