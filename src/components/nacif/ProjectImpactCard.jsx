import { Link } from "react-router-dom";
import { ArrowRight, Cloud, Info, Leaf, Sun, TreePine } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function ProjectImpactCard({ sustainability }) {
  const available = Boolean(sustainability?.available);

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#BEEAD2] bg-gradient-to-br from-[#F3FDF8] via-[#E9FAF0] to-[#DBF8E8] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      {/* Ilustração botânica no canto superior direito fiel à referência */}
      <div className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 opacity-85">
        <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className="h-full w-full drop-shadow-xs">
          <path d="M98 6C65 14 48 38 52 68C80 66 105 42 98 6Z" fill="#22A858" fillOpacity="0.88" />
          <path d="M98 6C78 28 65 46 53 67" stroke="#136F3A" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M118 32C90 36 74 58 78 86C104 84 120 60 118 32Z" fill="#00D98A" fillOpacity="0.78" />
          <path d="M72 4C54 14 44 30 48 48C66 44 76 26 72 4Z" fill="#46C978" fillOpacity="0.72" />
        </svg>
      </div>

      {/* Cabeçalho */}
      <div className="relative z-10 flex items-start justify-between gap-2 pr-14">
        <div className="flex items-start gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#00A86B] shadow-2xs">
            <Leaf className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="text-[13px] font-bold text-[#101828] leading-tight">Impacto do projeto</h3>
            <p className="mt-0.5 text-[11px] font-medium text-[#64748B] leading-tight">
              Sustentabilidade e eficiência
            </p>
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Metodologia de impacto ambiental"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/75 text-[#64748B] hover:bg-white hover:text-[#101828]"
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {sustainability?.methodologyNote ||
              "Calculado somente quando existem projetos fotovoltaicos ou parâmetros de geração reais."}
          </TooltipContent>
        </Tooltip>
      </div>

      {available ? (
        <div className="relative z-10 mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-[#C3F0D9] bg-white/80 p-3 backdrop-blur-xs">
              <div className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#DDFCF0] text-[#006F51]">
                <Cloud className="h-3.5 w-3.5" />
              </div>
              <p className="text-lg font-extrabold tracking-tight text-[#101828] tabular-nums leading-tight">
                -{sustainability.avoidedCo2KgYear.toLocaleString("pt-BR")}{" "}
                <span className="text-xs font-bold text-[#64748B]">kg</span>
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[#64748B]">CO₂ evitada/ano</p>
            </div>

            <div className="rounded-xl border border-[#C3F0D9] bg-white/80 p-3 backdrop-blur-xs">
              <div className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#DDFCF0] text-[#006F51]">
                <TreePine className="h-3.5 w-3.5" />
              </div>
              <p className="text-lg font-extrabold tracking-tight text-[#101828] tabular-nums leading-tight">
                {sustainability.treesEquivalent.toLocaleString("pt-BR")}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[#64748B]">Árvores equivalentes</p>
            </div>
          </div>

          <p className="text-[10px] font-medium text-[#476E5A] leading-snug">
            Base: {sustainability.solarProjectsCount}{" "}
            {sustainability.solarProjectsCount === 1 ? "sistema solar" : "sistemas solares"} ({sustainability.totalSolarKwp.toLocaleString("pt-BR")} kWp · SIN {sustainability.emissionFactorKgKwh} kg/kWh).
          </p>
        </div>
      ) : (
        <div className="relative z-10 mt-3 flex flex-col justify-between gap-2.5 rounded-xl border border-[#C3F0D9] bg-white/75 p-3 backdrop-blur-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#006F51]">
              <Sun className="h-3.5 w-3.5 shrink-0" />
              <span>Impacto ambiental ainda não calculado</span>
            </div>
            <p className="text-[11px] leading-snug text-[#4B6B5A]">
              Dimensione um sistema solar para visualizar estimativas de economia e emissões evitadas.
            </p>
          </div>
          <Link
            to="/solar-project"
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-xl bg-[#00D98A] px-3 text-[11px] font-extrabold text-[#031923] shadow-2xs transition hover:bg-[#00C47C]"
          >
            <span>Simular sistema solar</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
