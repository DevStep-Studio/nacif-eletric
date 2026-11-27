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
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#BCEAD1] bg-gradient-to-br from-[#F3FDF8] via-[#E8FAEF] to-[#D6F6E4] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      {/* Ilustração botânica em camadas vibrantes no canto superior direito */}
      <div className="pointer-events-none absolute -right-2 -top-2 h-28 w-28 opacity-95">
        <svg viewBox="0 0 140 140" fill="none" aria-hidden="true" className="h-full w-full drop-shadow-sm">
          <defs>
            <linearGradient id="leafMain" x1="120" y1="6" x2="45" y2="85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#136F3A" />
              <stop offset="55%" stopColor="#22A858" />
              <stop offset="100%" stopColor="#5BE691" />
            </linearGradient>
            <linearGradient id="leafFront" x1="138" y1="34" x2="72" y2="108" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0E5A30" />
              <stop offset="60%" stopColor="#19964D" />
              <stop offset="100%" stopColor="#00E091" />
            </linearGradient>
            <linearGradient id="leafSmall" x1="88" y1="-4" x2="36" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1A8847" />
              <stop offset="100%" stopColor="#7CF0A8" />
            </linearGradient>
          </defs>
          <path d="M84 -2C62 12 46 32 50 56C74 52 90 28 84 -2Z" fill="url(#leafSmall)" opacity="0.88" />
          <path d="M84 -2C68 20 58 38 51 55" stroke="#0F522B" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M122 4C84 14 58 44 62 84C98 82 128 50 122 4Z" fill="url(#leafMain)" />
          <path d="M122 4C94 34 77 56 64 82" stroke="#0C4A26" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M106 24L91 22M94 38L77 36M82 54L69 53" stroke="#7CF0A8" strokeOpacity="0.45" strokeWidth="1" strokeLinecap="round" />
          <path d="M142 36C106 42 84 68 88 106C122 104 144 74 142 36Z" fill="url(#leafFront)" />
          <path d="M142 36C116 62 101 81 89 104" stroke="#093B1E" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Cabeçalho */}
      <div className="relative z-10 flex items-start justify-between gap-2 pr-14">
        <div className="flex items-start gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#00A86B] shadow-2xs">
            <Leaf className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="text-[13px] font-bold text-[#101828] leading-tight">Impacto ambiental</h3>
            <p className="mt-0.5 text-[11px] font-medium text-[#64748B] leading-tight">
              Sustentabilidade fotovoltaica
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
            {sustainability.solarProjectsCount === 1 ? "sistema solar" : "sistemas solares"} (
            {sustainability.totalSolarKwp.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWp · SIN{" "}
            {Number(sustainability.emissionFactorKgKwh || 0).toLocaleString("pt-BR")} kg/kWh).
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
