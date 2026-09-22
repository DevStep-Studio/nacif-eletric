import { Check, AlertCircle } from "lucide-react";

/**
 * SolarStepper.jsx — Indicador de etapas minimalista, limpo e perfeitamente alinhado.
 *
 * Características:
 * - Círculos e conectores perfeitamente alinhados e simétricos (sem desvios).
 * - Identidade visual moderna: branco, cinza claro e verde-turquesa (#00d8b8).
 * - Sem gradientes ou transparências decorativas.
 * - Versão mobile responsiva e compacta com indicador e barra de progresso.
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
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      {/* Mobile: Barra de progresso compacta e elegante */}
      <div className="block sm:hidden space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-md bg-[#00d8b8]/15 px-2 py-0.5 text-[10px] font-black tracking-wide text-slate-900">
              Etapa {currentIndex + 1} de {steps.length}
            </span>
            <span className="text-xs font-black text-slate-900">
              {currentStep?.label}
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            {Math.round(((currentIndex + 1) / steps.length) * 100)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-[#00d8b8] transition-all duration-300 ease-out rounded-full"
            style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: Stepper linear perfeitamente simétrico */}
      <nav aria-label="Progresso do cadastro" className="hidden sm:block">
        <ol className="flex items-center justify-between w-full">
          {steps.map((step, index) => {
            const isCurrent = index === currentIndex;
            const isDone = index < currentIndex;
            const isClickable = index <= maxVisited;
            const isError = isCurrent && hasErrors;

            return (
              <li key={step.key} className="flex-1 flex flex-col items-center relative">
                {/* Linhas conectoras horizontais contínuas e simétricas */}
                <div className="w-full flex items-center justify-center relative">
                  {/* Conector esquerdo */}
                  {index > 0 && (
                    <div
                      className={`absolute left-0 right-1/2 top-1/2 -translate-y-1/2 h-[2px] -mr-4.5 ${
                        index <= currentIndex ? "bg-[#00d8b8]" : "bg-slate-200"
                      } transition-colors duration-300`}
                      aria-hidden="true"
                    />
                  )}

                  {/* Conector direito */}
                  {index < steps.length - 1 && (
                    <div
                      className={`absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-[2px] -ml-4.5 ${
                        index < currentIndex ? "bg-[#00d8b8]" : "bg-slate-200"
                      } transition-colors duration-300`}
                      aria-hidden="true"
                    />
                  )}

                  {/* Círculo indicador */}
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onStepClick?.(index)}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`Etapa ${index + 1}: ${step.label}`}
                    className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-xs font-black transition-all duration-200 ${
                      isCurrent
                        ? isError
                          ? "bg-amber-500 text-white ring-4 ring-amber-500/20 shadow-sm"
                          : "bg-[#00d8b8] text-slate-950 ring-4 ring-[#00d8b8]/25 shadow-sm"
                        : isDone
                        ? "bg-[#00d8b8] text-slate-950 font-black hover:opacity-90"
                        : "border border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                    } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : isError ? (
                      <AlertCircle className="h-4 w-4 stroke-[2.5]" />
                    ) : (
                      index + 1
                    )}
                  </button>
                </div>

                {/* Título da etapa centralizado */}
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick?.(index)}
                  className={`mt-2 text-center text-xs transition-colors block select-none ${
                    isCurrent
                      ? "font-black text-slate-900"
                      : isDone
                      ? "font-bold text-slate-700 hover:text-slate-900"
                      : "font-semibold text-slate-400 hover:text-slate-600"
                  } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  {step.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
