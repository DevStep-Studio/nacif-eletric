import { Link } from "react-router-dom";
import { Cloud, Info, Leaf, Sun, TreePine } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export default function ProjectImpactCard({ sustainability }) {
  const available = Boolean(sustainability?.available);

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#E5EBF1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {/* Detalhe botânico sutil no canto direito inferior/superior sem cobrir textos */}
      <div className="pointer-events-none absolute -right-4 top-0 h-28 w-28 opacity-15">
        <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className="h-full w-full">
          <path d="M95 10C65 18 48 42 52 72C78 72 102 48 95 10Z" fill="#00D98A" />
          <path d="M115 38C88 42 74 64 78 90C102 88 118 66 115 38Z" fill="#006F51" />
        </svg>
      </div>

      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#DDFCF0] text-[#006F51]">
            <Leaf className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#101828]">Impacto do projeto</h3>
            <p className="text-xs font-medium text-[#64748B]">Sustentabilidade e eficiência</p>
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Metodologia de impacto ambiental"
              className="flex h-6 w-6 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F6F9FC] hover:text-[#101828]"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {sustainability?.methodologyNote ||
              "Calculado somente quando existem projetos fotovoltaicos ou parâmetros de geração reais."}
          </TooltipContent>
        </Tooltip>
      </div>

      {available ? (
        <div className="relative z-10 mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#DDFCF0] bg-[#F4FDF9] p-3.5">
              <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#DDFCF0] text-[#006F51]">
                <Cloud className="h-3.5 w-3.5" />
              </div>
              <p className="text-xl font-extrabold tracking-tight text-[#101828] tabular-nums">
                -{sustainability.avoidedCo2KgYear.toLocaleString("pt-BR")}{" "}
                <span className="text-xs font-bold text-[#64748B]">kg</span>
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">CO₂ evitada/ano</p>
            </div>

            <div className="rounded-2xl border border-[#DDFCF0] bg-[#F4FDF9] p-3.5">
              <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#DDFCF0] text-[#006F51]">
                <TreePine className="h-3.5 w-3.5" />
              </div>
              <p className="text-xl font-extrabold tracking-tight text-[#101828] tabular-nums">
                {sustainability.treesEquivalent.toLocaleString("pt-BR")}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">Árvores equivalentes</p>
            </div>
          </div>

          <p className="text-[11px] font-medium text-[#64748B] leading-relaxed">
            Base: {sustainability.solarProjectsCount}{" "}
            {sustainability.solarProjectsCount === 1 ? "sistema solar" : "sistemas solares"} ({sustainability.totalSolarKwp.toLocaleString("pt-BR")} kWp · fator SIN {sustainability.emissionFactorKgKwh} kg CO₂/kWh).
          </p>
        </div>
      ) : (
        <div className="relative z-10 mt-4 rounded-2xl border border-dashed border-[#E5EBF1] bg-[#F6F9FC] p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#101828]">
            <Sun className="h-4 w-4 text-[#006F51]" />
            <span>Sem geração solar calculada</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#64748B]">
            Os indicadores de CO₂ evitado e árvores equivalentes são exibidos após dimensionar um sistema solar nos seus projetos.
          </p>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-bold text-[#006F51] hover:bg-[#DDFCF0]/60"
          >
            <Link to="/solar-project">Simular sistema solar</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
