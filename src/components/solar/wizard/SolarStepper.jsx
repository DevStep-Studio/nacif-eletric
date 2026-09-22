import { Check, AlertCircle } from "lucide-react";

/**
 * SolarStepper.jsx — Indicador de etapas com alinhamento geométrico perfeito e conectores responsivos.
 */
export default function SolarStepper({
  steps = [],
  currentIndex = 0,
  maxVisited = 0,
  hasErrors = false,
  onStepClick,
}) {
  const currentStep = steps[currentIndex] || steps[0];

  return (
    <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
      {/* Visualização Mobile: Barra de progresso + Etapa atual */}
      <div className="block sm:hidden">
        <div className="flex items-center justify-between text-xs font-black text-foreground mb-2">
          <span className="text-primary uppercase tracking-wider font-extrabold text-[11px]">
            Etapa {currentIndex + 1} de {steps.length}
          </span>
          <span className="text-foreground">{currentStep?.label}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Visualização Desktop: Stepper completo com círculos e conectores perfeitos */}
      <nav aria-label="Progresso do cadastro" className="hidden sm:block">
        <ol className="relative flex items-center justify-between w-full">
          {/* Linha de fundo contínua que passa exatamente pelo centro dos círculos */}
          <div
            className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0"
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
                className="relative z-10 flex flex-col items-center flex-1"
              >
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick?.(index)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`group flex flex-col items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl p-1 transition ${
                    isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-80"
                  }`}
                >
                  {/* Círculo do passo */}
                  <span
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition-all duration-200 ${
                      isCurrent
                        ? isError
                          ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-105"
                          : "border-primary bg-primary text-white shadow-md shadow-primary/20 scale-105"
                        : isDone
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-slate-200 bg-white text-slate-400 group-hover:border-slate-300"
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

                  {/* Rótulo do passo */}
                  <span
                    className={`whitespace-nowrap text-center text-[11px] transition-colors ${
                      isCurrent
                        ? "font-black text-primary"
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
