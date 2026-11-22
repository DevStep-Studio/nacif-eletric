import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, FileSpreadsheet, GitBranch, Plus, Sparkles, Zap } from "lucide-react";
import { FEATURED_PROJECT_ASSETS, resolveFeaturedProjectBanner } from "@/lib/dashboardAssets";
import { computeProjectMetricsSafe, isProjectCompleted } from "@/lib/projectAnalytics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const formatBrl = (value) =>
  `R$ ${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function FeaturedProjectCard({
  featuredItem,
  allProjects = [],
  onSelectProject,
  loading = false,
}) {
  const project = featuredItem?.project || null;
  const computed = featuredItem || (project ? computeProjectMetricsSafe(project) : null);
  const banner = resolveFeaturedProjectBanner(project);

  const badgeLabel = !project
    ? "PLATAFORMA NACIF ENERGY"
    : isProjectCompleted(project)
    ? "PROJETO CONCLUÍDO"
    : project.status
    ? String(project.status).toUpperCase()
    : "PROJETO EM ANDAMENTO";

  const progressPct = computed?.progress?.percent ?? 0;
  const demandDisplay = computed
    ? computed.demandKva > 0
      ? `${computed.demandKva.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kVA`
      : computed.demandKw > 0
      ? `${computed.demandKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`
      : "0,0 kVA"
    : "—";

  const circuitsCount = computed?.circuitsCount ?? 0;
  const budgetDisplay = computed?.budgetHasRealSource
    ? formatBrl(computed.budgetTotal)
    : "Não calculado";

  return (
    <div className="relative flex min-h-[258px] flex-col justify-between overflow-hidden rounded-[22px] border border-[#0D3A46] bg-[#031923] p-5 sm:p-7 text-white shadow-[0_14px_34px_rgba(3,25,35,0.16)]">
      {/* Glow verde-tecnológico ao fundo */}
      <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-72 rounded-full bg-[#00D98A]/18 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-full lg:w-[64%] overflow-hidden">
        {loading ? (
          <div className="h-full w-full animate-pulse bg-[#082732]/80" />
        ) : (
          <picture className="block h-full w-full">
            <source media="(max-width: 767px)" srcSet={banner.mobileSrc} />
            <img
              src={banner.desktopSrc}
              alt={banner.alt}
              style={{ objectPosition: banner.objectPosition || FEATURED_PROJECT_ASSETS.defaultObjectPosition }}
              className="h-full w-full object-cover opacity-75 sm:opacity-90 lg:opacity-95 transition-transform duration-700"
              onError={(e) => {
                if (e.currentTarget.src !== banner.fallbackSrc) {
                  e.currentTarget.src = banner.fallbackSrc;
                }
              }}
            />
          </picture>
        )}

        {/* Máscara para manter legibilidade perfeita do conteúdo textual à esquerda */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#031923] via-[#031923]/85 sm:via-[#031923]/70 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#031923]/80 via-transparent to-[#031923]/30 lg:hidden" />
      </div>

      {/* Camada HTML real à esquerda */}
      <div className="relative z-10 flex max-w-xl flex-col justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00D98A]/35 bg-[#082732]/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#00F0A0] backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00F0A0] shadow-[0_0_8px_#00F0A0]" />
            <span>{badgeLabel}</span>
          </span>

          {allProjects.length > 1 && onSelectProject && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/20 transition backdrop-blur-sm"
                >
                  <span>Trocar destaque</span>
                  <ChevronDown className="h-3 w-3 opacity-80" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 rounded-xl border-[#E5EBF1] bg-white p-1.5 shadow-xl">
                {allProjects.slice(0, 8).map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold cursor-pointer ${
                      p.id === project?.id ? "bg-[#DDFCF0] text-[#006F51]" : "text-[#101828]"
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {project ? (
          <>
            <div>
              <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-white leading-tight">
                {project.name}
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-300">
                {computed.installationTypeLabel} • {computed.voltageLabel}
              </p>
            </div>

            {/* Barra de Progresso Real */}
            <div className="flex max-w-sm items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00D98A] to-[#00F0A0] transition-all duration-500 shadow-[0_0_10px_rgba(0,240,160,0.45)]"
                  style={{ width: `${Math.max(4, progressPct)}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-bold text-slate-200 tabular-nums">
                {progressPct}% concluído
              </span>
            </div>

            {/* Indicadores Técnicos Reais */}
            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-[#082732]/85 px-3 py-2 backdrop-blur-md">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00D98A]/15 text-[#00F0A0]">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-white leading-none tabular-nums">{demandDisplay}</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-300 leading-none">Carga total</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-[#082732]/85 px-3 py-2 backdrop-blur-md">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00D98A]/15 text-[#00F0A0]">
                  <GitBranch className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-white leading-none tabular-nums">{circuitsCount}</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-300 leading-none">
                    {circuitsCount === 1 ? "Circuito" : "Circuitos"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-[#082732]/85 px-3 py-2 backdrop-blur-md">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00D98A]/15 text-[#00F0A0]">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-white leading-none tabular-nums">{budgetDisplay}</p>
                  <p className="mt-1 text-[10px] font-medium text-slate-300 leading-none">Orçamento</p>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <Button
                asChild
                className="h-10 rounded-full bg-gradient-to-r from-[#00D98A] to-[#00F0A0] px-5 text-xs font-extrabold text-[#031923] shadow-[0_6px_18px_rgba(0,217,138,0.32)] hover:brightness-105 transition"
              >
                <Link to={`/projects/${project.id}`}>
                  <span>Abrir projeto</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3 py-2">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                Inicie seu primeiro projeto elétrico
              </h2>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-300 max-w-md">
                Dimensione circuitos conforme NBR 5410, monte quadros DIN e acompanhe cargas em tempo real.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                asChild
                className="h-10 rounded-full bg-gradient-to-r from-[#00D98A] to-[#00F0A0] px-5 text-xs font-extrabold text-[#031923] shadow-[0_6px_18px_rgba(0,217,138,0.32)] hover:brightness-105"
              >
                <Link to="/projects/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  <span>Novo projeto</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-full border-white/25 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/20"
              >
                <Link to="/calculator">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#00F0A0]" />
                  <span>Abrir calculadora</span>
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
