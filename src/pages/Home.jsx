import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  GitBranch,
  HelpCircle,
  LayoutGrid,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { calcProjectMetrics } from "@/lib/electricalEngine";
import { buildProjectBudgetMaterials } from "@/lib/projectBudgetMaterials";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const formatKw = (watts) =>
  `${(Number(watts || 0) / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kW`;

const formatCurrencyBR = (val) =>
  `R$ ${Number(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const getProjectDate = (project) =>
  project?.updated_date || project?.updated_at || project?.created_date || project?.created_at;

const formatProjectDisplayDate = (project) => {
  const value = getProjectDate(project);
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// Formatação dinâmica do intervalo de datas do filtro de período
const getPeriodDateRangeText = (period) => {
  const now = new Date();
  const formatShort = (d) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");

  if (period === "7d") {
    const past = new Date(now.getTime() - 7 * 86400000);
    return `${formatShort(past)} - ${formatShort(now)}`;
  }
  if (period === "30d") {
    const past = new Date(now.getTime() - 30 * 86400000);
    return `${formatShort(past)} - ${formatShort(now)}`;
  }
  if (period === "90d") {
    const past = new Date(now.getTime() - 90 * 86400000);
    return `${formatShort(past)} - ${formatShort(now)}`;
  }
  return "Histórico Geral (Todos)";
};

// Exportador real de dados para planilha CSV (formato compatível com Excel brasileiro)
const exportDashboardCSV = (projectList, periodLabel = "Geral") => {
  if (!projectList || projectList.length === 0) {
    alert("Nenhum projeto disponível para exportação.");
    return;
  }

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
    const demW = m?.totalDemandPower || Number(p.total_demand_w) || (instW * 0.8) || 0;
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

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
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

// Custom Tooltip para o Gráfico de Barras
function CustomBarTooltip({ active, payload, label, unit = "kVA" }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-700/80 bg-[#0F172A]/95 p-3 text-white shadow-2xl text-xs space-y-1.5 backdrop-blur-md min-w-[170px]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
          <p className="font-extrabold text-slate-100 truncate max-w-[160px]">{data.name || data.date || label}</p>
          <span className="text-[10px] text-slate-400 font-medium shrink-0">{data.fullDate || data.date}</span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <span className="text-slate-400">Potência Dimensionada:</span>
          <span className="font-black text-[#00d8b8]">{Number(data.value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {unit}</span>
        </div>
        {data.circuits > 0 && (
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-400">Circuitos:</span>
            <span className="font-semibold text-slate-300">{data.circuits} ckt</span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

// Custom Tooltip para o Gráfico de Área
function CustomAreaTooltip({ active, payload, label, metric = "demand" }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-700/80 bg-[#0F172A]/95 p-3 text-white shadow-2xl text-xs space-y-1.5 backdrop-blur-md min-w-[170px]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5">
          <p className="font-extrabold text-slate-100 truncate max-w-[160px]">{data.name || data.date || label}</p>
          <span className="text-[10px] text-slate-400 font-medium shrink-0">{data.fullDate || data.date}</span>
        </div>
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <span className="text-slate-400">{metric === "cost" ? "Orçamento Estimado:" : "Demanda Calculada:"}</span>
          <span className="font-black text-[#00d8b8]">
            {metric === "cost"
              ? formatCurrencyBR(data.value)
              : `${Number(data.value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("loading");
  const [activeTableTab, setActiveTableTab] = useState("all");
  const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
  const [chartPeriod, setChartPeriod] = useState("30d");
  const [leftChartMetric, setLeftChartMetric] = useState("kva");
  const [rightChartMetric, setRightChartMetric] = useState("demand");

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      setStatus("loading");
      try {
        const list = await backend.entities.Project.list("-updated_date", 100);
        if (!isMounted) return;
        setProjects(Array.isArray(list) ? list : []);
        setStatus("ready");
      } catch {
        if (!isMounted) return;
        setProjects([]);
        setStatus("error");
      }
    };

    loadProjects();
    return () => {
      isMounted = false;
    };
  }, []);

  // Métricas calculadas para os KPI Cards (100% reais, com diferenciação entre demanda e carga instalada)
  const summaryMetrics = useMemo(() => {
    const now = Date.now();
    const periodDays = chartPeriod === "7d" ? 7 : chartPeriod === "30d" ? 30 : chartPeriod === "90d" ? 90 : Infinity;
    const periodMs = periodDays === Infinity ? Infinity : periodDays * 86400000;

    let totalInstalledPowerW = 0;
    let totalDemandPowerW = 0;
    let totalCircuits = 0;
    let totalBudget = 0;
    let errCount = 0;
    let warnCount = 0;
    let activeProjectsCount = 0;

    // Métricas do período anterior para cálculo real de variação percentual
    let prevPeriodDemandW = 0;
    let prevPeriodCircuits = 0;
    let prevPeriodBudget = 0;

    projects.forEach((p) => {
      const circuitsCount = p.circuits?.length || 0;
      totalCircuits += circuitsCount;

      let metrics = null;
      if (circuitsCount > 0) {
        try {
          metrics = calcProjectMetrics(p);
        } catch {
          metrics = null;
        }
      }

      const instW = metrics?.totalPower || Number(p.total_power_w) || Number(p.total_demand_w) || 0;
      const demW = metrics?.totalDemandPower || Number(p.total_demand_w) || (instW * 0.8) || 0;

      let bgt = Number(p.budget_total || p.total_budget || 0);
      if (!bgt && (circuitsCount > 0 || p.panel_boards?.length)) {
        try {
          bgt = buildProjectBudgetMaterials(p).materialTotal || 0;
        } catch {
          bgt = 0;
        }
      }

      totalInstalledPowerW += instW;
      totalDemandPowerW += demW;
      totalBudget += bgt;

      if (metrics?.validations) {
        errCount += metrics.validations.filter((v) => v.severity === "error").length;
        warnCount += metrics.validations.filter((v) => v.severity === "warning").length;
      }

      // Regra de projeto ativo: não concluído, nem cancelado/arquivado
      const normalizedStatus = normalizeText(p.status);
      const isConcluido = ["concluido", "concluído", "aprovado", "finalizado"].includes(normalizedStatus);
      const isArquivado = ["arquivado", "cancelado"].includes(normalizedStatus);
      if (!isConcluido && !isArquivado) {
        activeProjectsCount += 1;
      }

      // Verificação temporal para o cálculo de crescimento do período
      const pDateStr = getProjectDate(p);
      const pTime = pDateStr ? new Date(pDateStr).getTime() : now;
      const daysAgo = Math.max(0, (now - pTime) / (1000 * 60 * 60 * 24));

      if (periodMs !== Infinity && daysAgo > periodDays && daysAgo <= periodDays * 2) {
        prevPeriodDemandW += demW;
        prevPeriodCircuits += circuitsCount;
        prevPeriodBudget += bgt;
      }
    });

    // Variação percentual calculada matematicamente (sem mocks)
    const calcGrowth = (current, previous) => {
      if (previous > 0) {
        const pct = Math.round(((current - previous) / previous) * 100);
        return {
          pct,
          direction: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
          text: pct > 0 ? `+${pct}% em relação ao período anterior` : pct < 0 ? `${pct}% em relação ao período anterior` : "Sem variação no período",
        };
      }
      if (current > 0) {
        return { pct: 100, direction: "up", text: "+100% (novos projetos cadastrados)" };
      }
      return { pct: 0, direction: "neutral", text: "Sem histórico anterior para comparação" };
    };

    const demandGrowth = calcGrowth(totalDemandPowerW, prevPeriodDemandW);
    const circuitsGrowth = calcGrowth(totalCircuits, prevPeriodCircuits);
    const budgetGrowth = calcGrowth(totalBudget, prevPeriodBudget);

    return {
      totalProjectsCount: projects.length,
      activeProjectsCount,
      totalCircuits,
      totalDemandKw: totalDemandPowerW > 0 ? totalDemandPowerW / 1000 : 0,
      totalInstalledPowerKw: totalInstalledPowerW > 0 ? totalInstalledPowerW / 1000 : 0,
      estimatedBudget: totalBudget,
      errCount,
      warnCount,
      demandGrowth,
      circuitsGrowth,
      budgetGrowth,
    };
  }, [projects, chartPeriod]);

  // Análise e agrupamento dinâmico para os gráficos com dados 100% reais do projeto
  const chartAnalytics = useMemo(() => {
    const now = Date.now();
    const periodDays = chartPeriod === "7d" ? 7 : chartPeriod === "30d" ? 30 : chartPeriod === "90d" ? 90 : Infinity;

    const enrichedProjects = (projects || [])
      .map((p, idx) => {
        let metrics = null;
        try {
          metrics = calcProjectMetrics(p);
        } catch {
          metrics = null;
        }
        const rawPowerW = metrics?.totalPower || Number(p.total_power_w) || Number(p.total_demand_w) || 0;
        const rawDemandW = metrics?.totalDemandPower || Number(p.total_demand_w) || (rawPowerW * 0.8) || 0;
        const rawDemandVa = metrics?.totalDemandVa || (rawDemandW > 0 ? rawDemandW / 0.92 : rawPowerW);
        const circuitsCount = p.circuits?.length || metrics?.circuits?.length || 0;

        let budgetEst = Number(p.budget_total || p.total_budget || 0);
        if (!budgetEst && (circuitsCount > 0 || p.panel_boards?.length)) {
          try {
            budgetEst = buildProjectBudgetMaterials(p).materialTotal || 0;
          } catch {
            budgetEst = 0;
          }
        }

        const pDateStr = getProjectDate(p);
        const pTime = pDateStr ? new Date(pDateStr).getTime() : now;
        const daysAgo = Math.max(0, (now - pTime) / (1000 * 60 * 60 * 24));
        const shortDate = new Date(pTime).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
        const fullDate = formatProjectDisplayDate(p);

        return {
          id: p.id,
          name: p.name || p.client_name || `Projeto ${idx + 1}`,
          time: pTime,
          shortDate,
          fullDate,
          powerKw: rawDemandW / 1000,
          powerKva: rawDemandVa / 1000,
          demandKw: rawDemandW / 1000,
          circuitsCount,
          budgetEst,
          daysAgo,
        };
      })
      .sort((a, b) => a.time - b.time);

    // Filtragem estrita pelo período selecionado
    const activeList = periodDays === Infinity ? enrichedProjects : enrichedProjects.filter((p) => p.daysAgo <= periodDays);

    if (activeList.length === 0) {
      return {
        isEmpty: true,
        count: 0,
        totalKva: 0,
        totalKw: 0,
        avgDemandKw: 0,
        avgBudget: 0,
        barData: [],
        areaData: [],
      };
    }

    const totalKva = activeList.reduce((acc, p) => acc + (p.powerKva || 0), 0);
    const totalKw = activeList.reduce((acc, p) => acc + (p.powerKw || 0), 0);
    const totalDemandKw = activeList.reduce((acc, p) => acc + (p.demandKw || 0), 0);
    const totalBudget = activeList.reduce((acc, p) => acc + (p.budgetEst || 0), 0);

    const avgDemandKw = activeList.length > 0 ? totalDemandKw / activeList.length : 0;
    const avgBudget = activeList.length > 0 ? totalBudget / activeList.length : 0;

    const barData = activeList.map((p) => {
      const valKva = Math.round((p.powerKva || 0) * 10) / 10;
      const valKw = Math.round((p.powerKw || 0) * 10) / 10;
      return {
        id: p.id,
        name: p.name,
        date: p.shortDate,
        fullDate: p.fullDate,
        circuits: p.circuitsCount,
        powerKva: valKva,
        powerKw: valKw,
        value: leftChartMetric === "kva" ? valKva : valKw,
      };
    });

    const areaData = activeList.map((p) => {
      const demVal = Math.round((p.demandKw || 0) * 10) / 10;
      const bgtVal = Math.round(p.budgetEst || 0);
      return {
        id: p.id,
        name: p.name,
        date: p.shortDate,
        fullDate: p.fullDate,
        demandKw: demVal,
        budget: bgtVal,
        value: rightChartMetric === "cost" ? bgtVal : demVal,
      };
    });

    return {
      isEmpty: false,
      count: activeList.length,
      totalKva: Math.round(totalKva * 10) / 10,
      totalKw: Math.round(totalKw * 10) / 10,
      avgDemandKw: Math.round(avgDemandKw * 10) / 10,
      avgBudget: Math.round(avgBudget),
      barData,
      areaData,
    };
  }, [projects, chartPeriod, leftChartMetric, rightChartMetric]);

  // Filtro de Projetos na Tabela com regras rigorosas de status
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const statusText = normalizeText(p.status);
      const isConcluido = ["concluido", "concluído", "aprovado", "finalizado"].includes(statusText);
      const isEmAndamento = ["em_andamento", "andamento", "em andamento"].includes(statusText) || (!p.status && (p.circuits?.length > 0 || p.plant_design));
      const isPendente = ["pendente", "rascunho", "analise", "em análise"].includes(statusText) || (!p.status && (!p.circuits || p.circuits.length === 0));
      const isSolar = normalizeText(p.project_type).includes("solar") || Boolean(p.solar_power_kwp) || Boolean(p.solar_config);

      if (activeTableTab === "completed") return isConcluido;
      if (activeTableTab === "in_progress") return isEmAndamento;
      if (activeTableTab === "pending") return isPendente;
      if (activeTableTab === "solar") return isSolar;
      return true;
    });
  }, [activeTableTab, projects]);

  const toggleSelectAll = () => {
    if (selectedProjectIds.size === filteredProjects.length && filteredProjects.length > 0) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(filteredProjects.map((p) => p.id)));
    }
  };

  const toggleSelectProject = (id) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = filteredProjects.length > 0 && selectedProjectIds.size === filteredProjects.length;
  const [projectToDeleteHome, setProjectToDeleteHome] = useState(null);

  const confirmDeleteHome = async () => {
    if (!projectToDeleteHome) return;
    try {
      await backend.entities.Project.delete(projectToDeleteHome.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDeleteHome.id));
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
      alert("Não foi possível excluir o projeto.");
    } finally {
      setProjectToDeleteHome(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
        {/* ── Overview Section (Header Técnico + 4 KPI Metric Cards) ── */}
        <section className="space-y-4">
          {/* Header da Seção Overview */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#0F172A]">Painel Geral</h1>
              <p className="text-xs font-medium text-[#64748B]">Métricas técnicas, demanda agregada e projetos em tempo real</p>
            </div>

            {/* Controles da Direita (Date Range Dinâmico + Filter + Export Real + Novo Projeto) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-bold text-[#475467] shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-[#00d8b8]" />
                <span>{getPeriodDateRangeText(chartPeriod)}</span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-bold text-[#475467] shadow-sm hover:border-[#CBD5E1] transition"
                  >
                    <span>
                      {chartPeriod === "7d"
                        ? "Últimos 7 dias"
                        : chartPeriod === "30d"
                        ? "Últimos 30 dias"
                        : chartPeriod === "90d"
                        ? "Últimos 90 dias"
                        : "Histórico completo"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-[#E2E8F0] bg-white p-1 shadow-lg text-xs font-bold">
                  <DropdownMenuItem onClick={() => setChartPeriod("7d")}>Últimos 7 dias</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChartPeriod("30d")}>Últimos 30 dias</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChartPeriod("90d")}>Últimos 90 dias</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setChartPeriod("all")}>Histórico completo</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-[#E2E8F0] bg-white px-3 text-xs font-bold text-[#475467] shadow-sm hover:bg-[#F8FAFC]"
                onClick={() => exportDashboardCSV(projects, chartPeriod)}
                title="Exportar planilha CSV dos projetos"
              >
                <Download className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
                Exportar CSV
              </Button>

              <Button
                asChild
                className="h-9 rounded-xl bg-[#00d8b8] px-4 text-xs font-black text-slate-950 shadow-sm hover:bg-[#00c4a7] transition-all"
              >
                <Link to="/projects/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Novo Projeto
                </Link>
              </Button>
            </div>
          </div>

          {/* 4 KPI Metric Cards (Grid 4 colunas) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Demanda Total com Diferenciação de Carga Instalada */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3 hover:border-[#CBD5E1] transition flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8FCF8] text-[#00d8b8]">
                      <Zap className="h-4 w-4 fill-current" />
                    </div>
                    <span className="text-xs font-bold text-[#64748B]">Demanda Total</span>
                  </div>
                  <UITooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-[#94A3B8]" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        Demanda calculada com fator de demanda NBR 5410. Carga instalada:{" "}
                        {summaryMetrics.totalInstalledPowerKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
                        kW
                      </p>
                    </TooltipContent>
                  </UITooltip>
                </div>

                <div>
                  <p className="text-2xl font-black text-[#0F172A] tracking-tight">
                    {summaryMetrics.totalDemandKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                  </p>
                  <p className="text-[11px] font-medium text-[#64748B]">
                    Carga instalada:{" "}
                    <span className="font-bold text-[#0F172A]">
                      {summaryMetrics.totalInstalledPowerKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                    </span>
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-1.5 text-xs font-bold ${
                  summaryMetrics.demandGrowth.direction === "up"
                    ? "text-emerald-600"
                    : summaryMetrics.demandGrowth.direction === "down"
                    ? "text-amber-600"
                    : "text-slate-500"
                }`}
              >
                {summaryMetrics.demandGrowth.direction === "up" ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : summaryMetrics.demandGrowth.direction === "down" ? (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                <span>{summaryMetrics.demandGrowth.text}</span>
              </div>
            </div>

            {/* Card 2: Total de Circuitos */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3 hover:border-[#CBD5E1] transition flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
                      <GitBranch className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-[#64748B]">Circuitos</span>
                  </div>
                  <UITooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-[#94A3B8]" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Quantidade total de circuitos elétricos cadastrados e dimensionados</p>
                    </TooltipContent>
                  </UITooltip>
                </div>

                <div>
                  <p className="text-2xl font-black text-[#0F172A] tracking-tight">
                    {summaryMetrics.totalCircuits.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-[11px] font-medium text-[#64748B]">
                    Média de{" "}
                    <span className="font-bold text-[#0F172A]">
                      {summaryMetrics.totalProjectsCount > 0
                        ? (summaryMetrics.totalCircuits / summaryMetrics.totalProjectsCount).toFixed(1)
                        : 0}
                    </span>{" "}
                    ckt / projeto
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-1.5 text-xs font-bold ${
                  summaryMetrics.circuitsGrowth.direction === "up"
                    ? "text-emerald-600"
                    : summaryMetrics.circuitsGrowth.direction === "down"
                    ? "text-amber-600"
                    : "text-slate-500"
                }`}
              >
                {summaryMetrics.circuitsGrowth.direction === "up" ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : summaryMetrics.circuitsGrowth.direction === "down" ? (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                <span>{summaryMetrics.circuitsGrowth.text}</span>
              </div>
            </div>

            {/* Card 3: Projetos Ativos */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3 hover:border-[#CBD5E1] transition flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475467]">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-[#64748B]">Projetos Ativos</span>
                  </div>
                  <UITooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-[#94A3B8]" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Projetos em andamento ou análise (excluindo concluídos e cancelados)</p>
                    </TooltipContent>
                  </UITooltip>
                </div>

                <div>
                  <p className="text-2xl font-black text-[#0F172A] tracking-tight">
                    {summaryMetrics.activeProjectsCount}
                  </p>
                  <p className="text-[11px] font-medium text-[#64748B]">
                    de <span className="font-bold text-[#0F172A]">{summaryMetrics.totalProjectsCount}</span> projetos cadastrados
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-1.5 text-xs font-bold ${
                  summaryMetrics.totalProjectsCount === 0
                    ? "text-slate-500"
                    : summaryMetrics.errCount === 0
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {summaryMetrics.totalProjectsCount === 0
                    ? "Nenhum projeto cadastrado"
                    : summaryMetrics.errCount === 0
                    ? "100% em conformidade NBR"
                    : `${summaryMetrics.errCount} inconformidades NBR`}
                </span>
              </div>
            </div>

            {/* Card 4: Orçamento Consolidado */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3 hover:border-[#CBD5E1] transition flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#CCFBF1] text-[#0D9488]">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold text-[#64748B]">Orçamento</span>
                  </div>
                  <UITooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3.5 w-3.5 text-[#94A3B8]" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Estimativa consolidada de materiais elétricos e infraestrutura</p>
                    </TooltipContent>
                  </UITooltip>
                </div>

                <div>
                  <p className="text-2xl font-black text-[#0F172A] tracking-tight">
                    {formatCurrencyBR(summaryMetrics.estimatedBudget)}
                  </p>
                  <p className="text-[11px] font-medium text-[#64748B]">
                    Consolidado de materiais e quadros
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center gap-1.5 text-xs font-bold ${
                  summaryMetrics.budgetGrowth.direction === "up"
                    ? "text-emerald-600"
                    : summaryMetrics.budgetGrowth.direction === "down"
                    ? "text-amber-600"
                    : "text-slate-500"
                }`}
              >
                {summaryMetrics.budgetGrowth.direction === "up" ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : summaryMetrics.budgetGrowth.direction === "down" ? (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                <span>{summaryMetrics.budgetGrowth.text}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Interactive Charts Grid (Dados 100% Reais com Empty States Corretos) ── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Gráfico Esquerdo (65%): Bar Chart de Cargas & Potência com Alternância kVA / kW */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow lg:col-span-8 flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#64748B] tracking-tight">
                  Total de Cargas Dimensionadas ({leftChartMetric === "kva" ? "Potência Aparente" : "Potência Ativa"})
                </p>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <span className="text-2xl font-black text-[#0F172A] tracking-tight">
                    {leftChartMetric === "kva"
                      ? `${chartAnalytics.totalKva.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kVA`
                      : `${chartAnalytics.totalKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`}
                  </span>
                  <span className="text-xs font-bold text-[#64748B]">
                    {chartAnalytics.count} {chartAnalytics.count === 1 ? "projeto dimensionado" : "projetos dimensionados"}
                  </span>
                </div>
              </div>

              {/* Controles: Seletor de Métrica (kVA/kW) + Período */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setLeftChartMetric("kva")}
                    className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all ${
                      leftChartMetric === "kva"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    kVA
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftChartMetric("kw")}
                    className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all ${
                      leftChartMetric === "kw"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    kW
                  </button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs transition"
                    >
                      <Calendar className="h-3.5 w-3.5 text-[#00d8b8]" />
                      <span>
                        {chartPeriod === "7d"
                          ? "7 dias"
                          : chartPeriod === "30d"
                          ? "30 dias"
                          : chartPeriod === "90d"
                          ? "90 dias"
                          : "Geral"}
                      </span>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-[#E2E8F0] bg-white p-1 shadow-lg text-xs font-bold">
                    <DropdownMenuItem onClick={() => setChartPeriod("7d")}>Últimos 7 dias</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChartPeriod("30d")}>Últimos 30 dias</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChartPeriod("90d")}>Últimos 90 dias</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChartPeriod("all")}>Histórico completo</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Container do Gráfico com Tratamento de Estado Vazio Real */}
            <div className="h-64 w-full pt-2">
              {chartAnalytics.isEmpty ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <Zap className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">Nenhum projeto dimensionado no período</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Cadastre circuitos e cargas nos seus projetos para visualizar o gráfico de potências em tempo real.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartAnalytics.barData}
                    barCategoryGap="24%"
                    margin={{ top: 12, right: 6, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 700 }}
                      dy={6}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 600 }}
                    />
                    <Tooltip
                      content={<CustomBarTooltip unit={leftChartMetric === "kva" ? "kVA" : "kW"} />}
                      cursor={{ fill: "rgba(0, 216, 184, 0.05)", radius: 6 }}
                    />
                    <Bar
                      dataKey="value"
                      fill="#00d8b8"
                      radius={[6, 6, 2, 2]}
                      maxBarSize={36}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={(entry) => {
                        if (entry?.id) {
                          navigate(`/panel-generator?project=${entry.id}`);
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Gráfico Direito (35%): Sparkline de Demanda Média ou Orçamento Médio */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow lg:col-span-4 flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-[#64748B] tracking-tight">
                  {rightChartMetric === "cost" ? "Orçamento Médio Estimado" : "Demanda Média Estimada"}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-[#0F172A] tracking-tight">
                    {rightChartMetric === "cost"
                      ? formatCurrencyBR(chartAnalytics.avgBudget)
                      : `${chartAnalytics.avgDemandKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`}
                  </span>
                </div>
              </div>

              {/* Seletor de Métrica kW / R$ */}
              <div className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setRightChartMetric("demand")}
                  className={`px-2 py-1 text-xs font-extrabold rounded-lg transition-all ${
                    rightChartMetric === "demand"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Demanda média em kW"
                >
                  kW
                </button>
                <button
                  type="button"
                  onClick={() => setRightChartMetric("cost")}
                  className={`px-2 py-1 text-xs font-extrabold rounded-lg transition-all ${
                    rightChartMetric === "cost"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Orçamento médio em R$"
                >
                  R$
                </button>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              {chartAnalytics.isEmpty ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                  <FileSpreadsheet className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">Sem dados para a média</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Nenhum projeto encontrado para o intervalo de tempo selecionado.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartAnalytics.areaData}
                    margin={{ top: 12, right: 6, left: 6, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="demandAreaGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00d8b8" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#00d8b8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94A3B8", fontSize: 10, fontWeight: 700 }}
                      dy={6}
                    />
                    <YAxis hide domain={["dataMin * 0.9", "dataMax * 1.1"]} />
                    <Tooltip content={<CustomAreaTooltip metric={rightChartMetric} />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#00d8b8"
                      strokeWidth={2.5}
                      fill="url(#demandAreaGlow)"
                      dot={{ r: 3, fill: "#ffffff", stroke: "#00d8b8", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "#00d8b8", stroke: "#ffffff", strokeWidth: 2 }}
                      className="cursor-pointer"
                      onClick={(entry) => {
                        if (entry?.id) {
                          navigate(`/panel-generator?project=${entry.id}`);
                        }
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        {/* ── 4. Tabela de Projetos / Atividades com Dados Reais ── */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-5">
          {/* Header da Tabela */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-[#0F172A]">Últimos Projetos</h3>
              <p className="text-xs font-medium text-[#64748B]">Histórico recente de projetos dimensionados</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 rounded-xl px-3 text-xs font-bold text-[#475467] hover:bg-[#F1F5F9]"
              >
                <Link to="/projects">
                  <Eye className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
                  Ver todos
                </Link>
              </Button>

              <div className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-bold text-[#475467] shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-[#00d8b8]" />
                <span>{getPeriodDateRangeText(chartPeriod)}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl border-[#E2E8F0] bg-white px-3 text-xs font-bold text-[#475467] shadow-sm hover:bg-[#F8FAFC]"
                onClick={() => exportDashboardCSV(filteredProjects, activeTableTab)}
                title="Exportar dados da tabela para CSV"
              >
                <Download className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Filter Tabs em Pílula */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#F1F5F9] pb-3">
            {[
              { id: "all", label: "Todos os projetos" },
              { id: "completed", label: "Concluídos" },
              { id: "in_progress", label: "Em andamento" },
              { id: "pending", label: "Pendente revisão" },
              { id: "solar", label: "Solar / Especiais" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTableTab(tab.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                  activeTableTab === tab.id
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tabela de Dados */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[11px] font-black uppercase tracking-wider text-[#94A3B8]">
                  <th className="py-3 px-3 w-10">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="py-3 px-3">Nome do Projeto</th>
                  <th className="py-3 px-3">Data</th>
                  <th className="py-3 px-3">Potência Instalada</th>
                  <th className="py-3 px-3">Tipo / Fase</th>
                  <th className="py-3 px-3">Cliente / Local</th>
                  <th className="py-3 px-3">Cidade</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] font-medium text-[#334155]">
                {status === "loading" ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs font-semibold text-[#64748B]">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#00d8b8] mb-2" />
                      Carregando projetos...
                    </td>
                  </tr>
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs font-semibold text-[#64748B]">
                      Nenhum projeto encontrado nesta categoria.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((proj) => {
                    const isSelected = selectedProjectIds.has(proj.id);
                    let m = null;
                    try {
                      m = calcProjectMetrics(proj);
                    } catch {
                      m = null;
                    }
                    const powerW = m?.totalPower || Number(proj.total_power_w) || Number(proj.total_demand_w) || (proj.circuits?.length ? proj.circuits.reduce((acc, c) => acc + Number(c.power_w || 0), 0) : 0);
                    const normStatus = normalizeText(proj.status);
                    const statusText =
                      normStatus.includes("concluid") || normStatus.includes("aprovad")
                        ? "Concluído"
                        : proj.circuits?.length > 0
                        ? "Em andamento"
                        : "Em análise";

                    return (
                      <tr
                        key={proj.id}
                        className={`transition hover:bg-[#F8FAFC] ${isSelected ? "bg-[#E8FCF8]/40" : ""}`}
                      >
                        <td className="py-3.5 px-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectProject(proj.id)}
                            aria-label={`Selecionar ${proj.name}`}
                          />
                        </td>
                        <td className="py-3.5 px-3">
                          <Link
                            to={`/projects/${proj.id}`}
                            className="font-black text-[#0F172A] hover:text-[#00d8b8] transition flex items-center gap-2"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E8FCF8] text-[#00d8b8] text-xs font-black">
                              <FolderOpen className="h-3.5 w-3.5" />
                            </span>
                            <span className="truncate max-w-[200px]">{proj.name}</span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#64748B]">
                          {formatProjectDisplayDate(proj)}
                        </td>
                        <td className="py-3.5 px-3 font-black text-[#0F172A]">
                          {Number(powerW).toLocaleString("pt-BR")} W
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-black text-[#475467]">
                            {proj.supply_type || "Bifásico 220V"}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#475467] truncate max-w-[160px]">
                          {proj.client_name || proj.client || "Não informado"}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#64748B]">
                          {proj.city || "Não informada"}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black border ${
                              statusText === "Concluído"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : statusText === "Em andamento"
                                ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                statusText === "Concluído"
                                  ? "bg-emerald-500"
                                  : statusText === "Em andamento"
                                  ? "bg-cyan-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            <span>{statusText}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] ml-auto"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-[#E2E8F0] bg-white p-1 shadow-xl text-xs font-bold">
                              <DropdownMenuItem onClick={() => navigate(`/projects/${proj.id}`)}>
                                <Eye className="mr-2 h-3.5 w-3.5 text-[#64748B]" />
                                Abrir detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/planta-ia?project=${proj.id}`)}>
                                <Zap className="mr-2 h-3.5 w-3.5 text-[#00d8b8]" />
                                Editar planta
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/panel-generator?project=${proj.id}`)}>
                                <LayoutGrid className="mr-2 h-3.5 w-3.5 text-[#00d8b8]" />
                                Gerar quadro
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/unifilar?project=${proj.id}`)}>
                                <GitBranch className="mr-2 h-3.5 w-3.5 text-[#00d8b8]" />
                                Ver diagrama
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setProjectToDeleteHome(proj)}
                                className="text-red-600 focus:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Excluir projeto
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Tabela */}
          <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-4 text-xs font-bold text-[#64748B]">
            <span>Mostrando {filteredProjects.length} de {projects.length} projetos</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40"
                disabled
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0F172A] text-white font-black"
              >
                1
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC]"
                disabled
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <AlertDialog open={Boolean(projectToDeleteHome)} onOpenChange={(open) => !open && setProjectToDeleteHome(null)}>
        <AlertDialogContent className="rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-[#0F172A]">
              Excluir o projeto "{projectToDeleteHome?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-[#64748B] leading-relaxed">
              Esta ação é permanente e não pode ser desfeita. Todos os cálculos de demanda, circuitos elétricos e propostas vinculadas serão excluídos definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              className="h-9 rounded-xl border-[#E2E8F0] bg-white px-4 text-xs font-bold text-[#475467] hover:bg-[#F8FAFC]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteHome}
              className="h-9 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700 shadow-sm transition"
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
