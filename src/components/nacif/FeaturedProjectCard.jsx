import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, FileText, GitBranch, Plus, Sparkles, Zap } from "lucide-react";
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

  const isSolar = Boolean(computed?.isSolar);
  const progressPct = computed?.progress?.percent ?? 0;

  // Resolução inteligente da potência e métricas do projeto
  let demandDisplay = "—";
  let demandLabel = "Carga total";
  let circuitsDisplay = 0;
  let circuitsLabel = "Circuitos";

  if (computed) {
    if (isSolar) {
      if (computed.solarKwp > 0) {
        demandDisplay = `${computed.solarKwp.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWp`;
        demandLabel = "Potência FV";
      } else if (computed.demandKva > 0) {
        demandDisplay = `${computed.demandKva.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kVA`;
        demandLabel = "Carga total";
      } else {
        demandDisplay = "A dimensionar";
        demandLabel = "Potência FV";
      }

      if (computed.circuitsCount > 0) {
        circuitsDisplay = computed.circuitsCount;
        circuitsLabel = computed.circuitsCount === 1 ? "Circuito" : "Circuitos";
      } else if (computed.solarPanelsCount > 0) {
        circuitsDisplay = computed.solarPanelsCount;
        circuitsLabel = computed.solarPanelsCount === 1 ? "Módulo FV" : "Módulos FV";
      } else {
        circuitsDisplay = "Sistema FV";
        circuitsLabel = "Arranjo solar";
      }
    } else {
      if (computed.demandKva > 0) {
        demandDisplay = `${computed.demandKva.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kVA`;
        demandLabel = "Carga total";
      } else if (computed.demandKw > 0) {
        demandDisplay = `${computed.demandKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`;
        demandLabel = "Demanda estimada";
      } else {
        demandDisplay = "A dimensionar";
        demandLabel = "Carga total";
      }

      circuitsDisplay = computed.circuitsCount;
      circuitsLabel = computed.circuitsCount === 1 ? "Circuito" : "Circuitos";
    }
  }

  const budgetDisplay = computed?.budgetHasRealSource
    ? formatBrl(computed.budgetTotal)
    : "Não calculado";

  return (
    <div className="relative flex min-h-[240px] lg:h-[252px] flex-col justify-between overflow-hidden rounded-[18px] bg-gradient-to-br from-[#012224] via-[#013B30] to-[#054A42] px-5 py-4 sm:px-6 sm:py-4.5 text-white shadow-[0_12px_30px_rgba(2,38,42,0.16)]">
      {/* Glow sutil de fundo verde-esmeralda na base esquerda */}
      <div className="pointer-events-none absolute -bottom-20 left-4 h-52 w-72 rounded-full bg-[#00F0A0]/18 blur-3xl" />

      {/* Camada 3: Residência 3D Iluminada à Direita — transição orgânica multi-borda sem linha reta */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-full md:w-[61%] lg:w-[60%] xl:w-[61%] overflow-hidden"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.03) 4%, rgba(0,0,0,0.22) 11%, rgba(0,0,0,0.68) 20%, rgba(0,0,0,0.95) 28%, black 36%, black 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.03) 4%, rgba(0,0,0,0.22) 11%, rgba(0,0,0,0.68) 20%, rgba(0,0,0,0.95) 28%, black 36%, black 100%)",
        }}
      >
        {loading ? (
          <div className="h-full w-full animate-pulse bg-[#063A32]/60" />
        ) : (
          <picture className="block h-full w-full">
            <source media="(max-width: 767px)" srcSet={banner.mobileSrc} />
            <img
              src={banner.desktopSrc}
              alt={banner.alt}
              style={{ objectPosition: banner.objectPosition || FEATURED_PROJECT_ASSETS.defaultObjectPosition }}
              className="h-full w-full object-cover md:object-contain md:object-right opacity-100 brightness-[1.06] contrast-[1.04] saturate-[1.08]"
              onError={(e) => {
                if (e.currentTarget.src !== banner.fallbackSrc) {
                  e.currentTarget.src = banner.fallbackSrc;
                }
              }}
            />
          </picture>
        )}

        {/* Proteção para legibilidade em telas estreitas onde texto e foto se sobrepõem */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#012224]/92 via-[#012C29]/75 to-[#013D31]/35 md:hidden" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[46%] bg-gradient-to-r from-[#012224]/95 via-[#012A27]/68 to-transparent md:block" />

      {/* Camada 4: Conteúdo HTML Real à Esquerda */}
      <div className="relative z-10 flex h-full max-w-[385px] flex-col justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md border border-[#00F0A0]/35 bg-[#053830]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            <span>{badgeLabel}</span>
          </span>

          {allProjects.length > 1 && onSelectProject && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold text-white/90 hover:bg-white/20 transition backdrop-blur-sm"
                >
                  <span>Trocar</span>
                  <ChevronDown className="h-3 w-3 opacity-80" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 max-h-64 overflow-y-auto rounded-xl border-[#E5EBF1] bg-white p-1.5 shadow-xl">
                {allProjects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                      p.id === project?.id ? "bg-[#DDFCF0] text-[#006F51]" : "text-[#101828]"
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="ml-2 text-[10px] text-[#64748B] shrink-0 font-normal">
                      {p.project_type || (p.circuits?.length > 0 ? `${p.circuits.length} ckt` : "Projeto")}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {project ? (
          <>
            <div>
              <h2 className="truncate text-[22px] sm:text-[26px] font-extrabold tracking-tight text-white leading-tight">
                {project.name}
              </h2>
              <p className="mt-0.5 text-xs font-medium text-emerald-100/80">
                {computed.installationTypeLabel} • {computed.voltageLabel}
              </p>
            </div>

            {/* Barra de Progresso Fina e Brilhante */}
            <div className="flex max-w-[330px] items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00D98A] to-[#00F0A0] transition-all duration-500 shadow-[0_0_8px_rgba(0,240,160,0.5)]"
                  style={{ width: `${Math.max(4, progressPct)}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-emerald-50/90 tabular-nums">
                {progressPct}% concluído
              </span>
            </div>

            {/* Indicadores Internos Limpos — Sem Caixas com Bordas Pesadas */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-0.5">
              <div className="flex items-center gap-2" title={`Métrica do projeto ${project.name}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00F0A0]/16 text-[#00F0A0]">
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-extrabold text-white leading-tight tabular-nums">{demandDisplay}</p>
                  <p className="text-[10px] font-medium text-emerald-100/75 leading-tight">{demandLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-2" title={`Circuitos ou arranjos de ${project.name}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00F0A0]/16 text-[#00F0A0]">
                  <GitBranch className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-extrabold text-white leading-tight tabular-nums">{circuitsDisplay}</p>
                  <p className="text-[10px] font-medium text-emerald-100/75 leading-tight">{circuitsLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-2" title={`Orçamento estimado de ${project.name}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00F0A0]/16 text-[#00F0A0]">
                  <FileText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-extrabold text-white leading-tight tabular-nums">{budgetDisplay}</p>
                  <p className="text-[10px] font-medium text-emerald-100/75 leading-tight">Orçamento</p>
                </div>
              </div>
            </div>

            <div>
              <Button
                asChild
                className="h-9 rounded-full bg-gradient-to-r from-[#00D98A] to-[#00F0A0] px-5 text-xs font-extrabold text-[#031923] shadow-[0_6px_16px_rgba(0,240,160,0.34)] hover:brightness-105 transition"
              >
                <Link to={`/projects/${project.id}`}>
                  <span>Abrir projeto</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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
              <p className="mt-1 text-xs font-medium text-emerald-100/80 max-w-md">
                Dimensione circuitos conforme NBR 5410, monte quadros DIN e acompanhe cargas em tempo real.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                asChild
                className="h-9 rounded-full bg-gradient-to-r from-[#00D98A] to-[#00F0A0] px-5 text-xs font-extrabold text-[#031923] shadow-[0_6px_16px_rgba(0,240,160,0.34)] hover:brightness-105"
              >
                <Link to="/projects/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  <span>Novo projeto</span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-9 rounded-full border-white/25 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/20"
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
