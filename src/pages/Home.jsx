import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  ChevronDown,
  CircleDollarSign,
  Download,
  FolderOpen,
  Gauge,
  GitBranch,
  HelpCircle,
  Plus,
  Zap,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { calcProjectMetrics } from "@/lib/electricalEngine";
import { buildProjectBudgetMaterials } from "@/lib/projectBudgetMaterials";
import { authorizePlanExport } from "@/lib/planEnforcement";
import { buildDashboardAnalytics } from "@/lib/projectAnalytics";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FeaturedProjectCard from "@/components/nacif/FeaturedProjectCard";
import NacifAICard from "@/components/nacif/NacifAICard";
import MetricCard from "@/components/nacif/MetricCard";
import {
  AverageDemandAreaChartCard,
  LoadsBarChartCard,
} from "@/components/nacif/DashboardCharts";
import ProjectImpactCard from "@/components/nacif/ProjectImpactCard";
import RecentProjectsTable from "@/components/nacif/RecentProjectsTable";
import QuickActionsCard from "@/components/nacif/QuickActionsCard";
import LoadingSkeleton from "@/components/nacif/LoadingSkeleton";

const PERIOD_LABELS = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  all: "Histórico completo",
};

const formatCurrencyBR = (val) =>
  `R$ ${Number(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatProjectDisplayDate = (project) => {
  const value = project?.updated_date || project?.updated_at || project?.created_date || project?.created_at;
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const exportDashboardCSV = async (projectList, periodLabel = "Geral") => {
  if (!projectList || projectList.length === 0) {
    alert("Nenhum projeto disponível para exportação.");
    return;
  }
  const auth = await authorizePlanExport({
    moduleKey: "budget",
    format: "CSV",
    label: "Relatório de Projetos",
  });
  if (!auth.allowed) return;

  const headers = [
    "Nome do Projeto",
    "Data Atualização",
    "Carga Instalada (W)",
    "Demanda Estimada (kW)",
    "Potência Aparente (kVA)",
    "Qtd Circuitos",
    "Tipo de Fornecimento",
    "Cliente",
    "Cidade",
    "Status",
    "Orçamento Estimado (R$)",
  ];

  const rows = projectList.map((p) => {
    let m = null;
    try {
      m = calcProjectMetrics(p);
    } catch {
      m = null;
    }
    const instW = m?.totalPower || Number(p.total_power_w) || Number(p.total_demand_w) || 0;
    const demW = m?.totalDemandPower || Number(p.total_demand_w) || instW * 0.8 || 0;
    const demVa = m?.totalDemandVa || (demW > 0 ? demW / 0.92 : instW);
    const circuitsCount = p.circuits?.length || m?.circuits?.length || 0;

    let bgt = Number(p.budget_total || p.total_budget || 0);
    if (!bgt && (circuitsCount > 0 || p.panel_boards?.length)) {
      try {
        bgt = buildProjectBudgetMaterials(p).materialTotal || 0;
      } catch {
        bgt = 0;
      }
    }

    return [
      `"${String(p.name || "").replace(/"/g, '""')}"`,
      `"${formatProjectDisplayDate(p)}"`,
      Math.round(instW),
      (demW / 1000).toFixed(2).replace(".", ","),
      (demVa / 1000).toFixed(2).replace(".", ","),
      circuitsCount,
      `"${String(p.supply_type || "Bifásico 220V").replace(/"/g, '""')}"`,
      `"${String(p.client_name || p.client || "Não informado").replace(/"/g, '""')}"`,
      `"${String(p.city || "Não informada").replace(/"/g, '""')}"`,
      `"${String(p.status || "Em análise").replace(/"/g, '""')}"`,
      bgt.toFixed(2).replace(".", ","),
    ].join(";");
  });

  const csvContent = "\uFEFF" + [...(auth.watermark ? [auth.watermark] : []), headers.join(";"), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `relatorio_projetos_nacif_${periodLabel.toLowerCase().replace(/\s+/g, "_")}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("loading");
  const [chartPeriod, setChartPeriod] = useState("30d");
  const [leftChartUnit, setLeftChartUnit] = useState("kva");
  const [rightChartMetric, setRightChartMetric] = useState("demand");
  const [selectedFeaturedId, setSelectedFeaturedId] = useState(() => {
    try {
      return window.localStorage.getItem("voltai_active_project_id") || null;
    } catch {
      return null;
    }
  });
  const [projectToDeleteHome, setProjectToDeleteHome] = useState(null);

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    backend.entities.Project.list("-updated_date", 100)
      .then((list) => {
        if (!mounted) return;
        setProjects(Array.isArray(list) ? list : []);
        setStatus("ready");
      })
      .catch(() => {
        if (!mounted) return;
        setProjects([]);
        setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const analytics = useMemo(
    () => buildDashboardAnalytics(projects, chartPeriod, selectedFeaturedId),
    [projects, chartPeriod, selectedFeaturedId]
  );

  const handleSelectFeaturedProject = (projectId) => {
    setSelectedFeaturedId(projectId);
    try {
      if (projectId) window.localStorage.setItem("voltai_active_project_id", projectId);
    } catch {}
  };

  const confirmDeleteHome = async () => {
    if (!projectToDeleteHome) return;
    try {
      const deletedId = projectToDeleteHome.id;
      await backend.entities.Project.delete(deletedId);
      setProjects((prev) => prev.filter((p) => p.id !== deletedId));
      if (selectedFeaturedId === deletedId) {
        setSelectedFeaturedId(null);
        try {
          window.localStorage.removeItem("voltai_active_project_id");
        } catch {}
      }
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
      alert("Não foi possível excluir o projeto.");
    } finally {
      setProjectToDeleteHome(null);
    }
  };

  const { kpis, charts, sustainability, featuredItem } = analytics;

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-[1440px] space-y-3.5 pb-10">
        {/* Cabeçalho Principal Compacto */}
        <header className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#101828] leading-tight">
              Painel Geral
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] shadow-2xs transition hover:border-[#CBD5E1] hover:bg-[#F6F9FC]"
                >
                  <Calendar className="h-3.5 w-3.5 text-[#64748B]" />
                  <span>{PERIOD_LABELS[chartPeriod]}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl border-[#E5EBF1] bg-white p-1 shadow-xl text-xs font-semibold">
                {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setChartPeriod(key)}
                    className={chartPeriod === key ? "bg-[#DDFCF0] text-[#006F51] font-bold" : ""}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                exportDashboardCSV(
                  analytics.periodProjects?.length > 0 ? analytics.periodProjects : projects,
                  PERIOD_LABELS[chartPeriod] || chartPeriod
                )
              }
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] shadow-2xs hover:bg-[#F6F9FC]"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
              Exportar CSV
            </Button>

            <Button
              asChild
              className="h-9 rounded-xl bg-gradient-to-r from-[#00D98A] to-[#00C87F] px-3.5 text-xs font-extrabold text-white shadow-[0_4px_14px_rgba(0,217,138,0.28)] hover:brightness-105 transition"
            >
              <Link to="/projects/new">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Novo Projeto
              </Link>
            </Button>
          </div>
        </header>

        {status === "loading" ? (
          <LoadingSkeleton variant="dashboard" />
        ) : (
          <>
            {/* Linha 1: Projeto em Andamento + Painel Nacif IA */}
            <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:items-stretch">
              <div className="lg:col-span-8 flex">
                <FeaturedProjectCard
                  featuredItem={featuredItem}
                  allProjects={projects}
                  onSelectProject={handleSelectFeaturedProject}
                />
              </div>
              <div className="lg:col-span-4 flex">
                <NacifAICard project={featuredItem?.project || null} />
              </div>
            </section>

            {/* Linha 2: 5 Indicadores Consolidados do Período */}
            <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCard
                icon={Zap}
                value={`${kpis.demandKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`}
                label="Demanda total"
                hint={`Consolidado do período (${PERIOD_LABELS[chartPeriod]}): ${kpis.installedKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW de carga instalada.`}
                delta={kpis.deltas.demandKw}
              />

              <MetricCard
                icon={GitBranch}
                value={kpis.circuits.toLocaleString("pt-BR")}
                label="Circuitos"
                hint={`Total de circuitos cadastrados em todos os projetos (${PERIOD_LABELS[chartPeriod]}).`}
                delta={kpis.deltas.circuits}
              />

              <MetricCard
                icon={FolderOpen}
                value={kpis.activeProjects.toLocaleString("pt-BR")}
                label="Projetos ativos"
                hint="Projetos em elaboração, dimensionamento ou análise técnica no período."
                delta={kpis.deltas.activeProjects}
              />

              <MetricCard
                icon={CircleDollarSign}
                value={kpis.hasBudgetData ? formatCurrencyBR(kpis.budgetTotal) : "Não calculado"}
                label="Orçamento total"
                hint={`Consolidado de orçamentos e materiais elétricos de todos os projetos (${PERIOD_LABELS[chartPeriod]}).`}
                delta={kpis.deltas.budgetTotal}
              />

              <MetricCard
                icon={Gauge}
                value={`${kpis.demandKva.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kVA`}
                label="Potência aparente"
                hint={`Potência aparente agregada de todos os projetos (${PERIOD_LABELS[chartPeriod]}) via NBR 5410.`}
                delta={kpis.deltas.demandKva}
                className="col-span-2 sm:col-span-1"
              />
            </section>

            {/* Estado Inicial Guiado quando ainda não há projetos cadastrados */}
            {projects.length === 0 && (
              <section className="rounded-2xl border border-dashed border-[#00D98A]/50 bg-white p-6 text-center shadow-2xs">
                <div className="mx-auto max-w-lg space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DDFCF0] text-[#006F51]">
                    <FolderOpen className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-extrabold text-[#101828]">
                      Bem-vindo ao Nacif Electric!
                    </h2>
                    <p className="text-xs font-medium leading-relaxed text-[#64748B]">
                      Você ainda não possui projetos cadastrados. Comece criando seu primeiro dimensionamento elétrico em conformidade com a ABNT NBR 5410.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <Button
                      asChild
                      className="h-9 rounded-xl bg-[#00D98A] px-4 text-xs font-bold text-[#031923] hover:bg-[#00C47C]"
                    >
                      <Link to="/projects/new">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Criar Primeiro Projeto
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="h-9 rounded-xl border-[#E5EBF1] bg-white px-4 text-xs font-semibold text-[#101828] hover:bg-[#F6F9FC]"
                    >
                      <Link to="/ajuda">
                        <HelpCircle className="mr-1.5 h-3.5 w-3.5 text-[#006F51]" />
                        Guia Rápido de Uso
                      </Link>
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {/* Linha 3: Cargas dimensionadas + Demanda média + Impacto do projeto */}
            <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:items-stretch">
              <div className="lg:col-span-4 flex">
                <LoadsBarChartCard
                  charts={charts}
                  unit={leftChartUnit}
                  onUnitChange={setLeftChartUnit}
                />
              </div>
              <div className="lg:col-span-4 flex">
                <AverageDemandAreaChartCard
                  charts={charts}
                  metric={rightChartMetric}
                  onMetricChange={setRightChartMetric}
                />
              </div>
              <div className="lg:col-span-4 flex">
                <ProjectImpactCard sustainability={sustainability} />
              </div>
            </section>

            {/* Linha 4: Últimos projetos + Ações rápidas */}
            <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:items-stretch">
              <div className="lg:col-span-8 flex">
                <RecentProjectsTable
                  projects={projects}
                  onRequestDelete={(proj) => setProjectToDeleteHome(proj)}
                />
              </div>
              <div className="lg:col-span-4 flex">
                <QuickActionsCard activeProjectId={featuredItem?.project?.id || null} />
              </div>
            </section>
          </>
        )}
      </div>

      {/* Confirmação de Exclusão Segura */}
      <AlertDialog
        open={Boolean(projectToDeleteHome)}
        onOpenChange={(open) => !open && setProjectToDeleteHome(null)}
      >
        <AlertDialogContent className="rounded-2xl border-[#E5EBF1] bg-white p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-extrabold text-[#101828]">
              Excluir o projeto "{projectToDeleteHome?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-[#64748B]">
              Esta ação é permanente e não pode ser desfeita. Todos os cálculos de demanda, circuitos elétricos e propostas vinculadas serão excluídos definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="h-9 rounded-xl border-[#E5EBF1] bg-white px-4 text-xs font-semibold text-[#101828] hover:bg-[#F6F9FC]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteHome}
              className="h-9 rounded-xl bg-[#EF4444] px-4 text-xs font-bold text-white hover:bg-red-600"
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
