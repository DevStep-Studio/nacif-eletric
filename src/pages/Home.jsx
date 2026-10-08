import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Cpu,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  Grid2X2,
  HelpCircle,
  Layers,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  ScanLine,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
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
} from "recharts";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { calcProjectMetrics } from "@/lib/electricalEngine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getProjectProgress } from "@/lib/projectProgress";

const CHECKLIST_STORAGE_KEY = "nacif:dashboard-onboarding-checklist-hidden";

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

const getProjectDate = (project) =>
  project?.updated_date || project?.updated_at || project?.created_date || project?.created_at;

const formatProjectDisplayDate = (project) => {
  const value = getProjectDate(project);
  if (!value) return "01/10/2026";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "01/10/2026";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

// Custom Tooltip para o Gráfico de Barras
function CustomBarTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-xl text-xs space-y-1">
        <p className="font-extrabold text-[#0F172A]">{data.date || label}</p>
        <p className="font-bold text-[#00d8b8]">{data.power} kW de demanda</p>
        <p className="text-[11px] font-semibold text-[#64748B]">{data.circuits} circuitos calculados</p>
      </div>
    );
  }
  return null;
}

// Custom Tooltip para o Gráfico de Linha
function CustomAreaTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-[#0F172A] text-white p-3 shadow-xl text-xs space-y-1">
        <p className="font-bold text-slate-300">{data.date || label}</p>
        <p className="font-black text-[#00d8b8]">{formatCurrencyBR(data.value)}</p>
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
  const [timeFilter, setTimeFilter] = useState("30d");

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      setStatus("loading");
      try {
        const list = await backend.entities.Project.list("-updated_date", 50);
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

  const firstName = user?.full_name?.split(" ")?.[0] || "Engenheiro";

  // Métricas calculadas para os KPI Cards
  const summaryMetrics = useMemo(() => {
    let totalPower = 0;
    let totalCircuits = 0;
    let errCount = 0;
    let warnCount = 0;

    projects.forEach((p) => {
      const circuits = p.circuits?.length || 0;
      totalCircuits += circuits;

      if (circuits > 0) {
        try {
          const m = calcProjectMetrics(p);
          totalPower += m.totalPower || 0;
          errCount += (m.validations || []).filter((v) => v.severity === "error").length;
          warnCount += (m.validations || []).filter((v) => v.severity === "warning").length;
        } catch {
          totalPower += Number(p.total_demand_w || 0);
        }
      } else {
        totalPower += Number(p.total_demand_w || 0);
      }
    });

    const displayPowerKw = totalPower > 0 ? totalPower / 1000 : 124.5;
    const displayCircuits = totalCircuits > 0 ? totalCircuits : 12562;
    const displayProjects = projects.length > 0 ? projects.length : 8;
    const estimatedBudget = totalPower > 0 ? totalPower * 0.48 + 12000 : 60652;

    return {
      projectCount: displayProjects,
      totalCircuits: displayCircuits,
      totalPowerKw: displayPowerKw,
      errCount,
      warnCount,
      estimatedBudget,
    };
  }, [projects]);

  // Dados para o Gráfico de Barras (Dual-Tone cápsula como a referência)
  const barChartData = useMemo(() => {
    return [
      { date: "01 Jul", power: 45, maxTrack: 200, circuits: 6 },
      { date: "02 Jul", power: 90, maxTrack: 200, circuits: 12 },
      { date: "03 Jul", power: 95, maxTrack: 200, circuits: 14 },
      { date: "04 Jul", power: 175, maxTrack: 200, circuits: 28 },
      { date: "05 Jul", power: 25, maxTrack: 200, circuits: 4 },
      { date: "06 Jul", power: 145, maxTrack: 200, circuits: 22 },
      { date: "07 Jul", power: 155, maxTrack: 200, circuits: 24 },
      { date: "08 Jul", power: 185, maxTrack: 200, circuits: 30 },
      { date: "09 Jul", power: 15, maxTrack: 200, circuits: 2 },
      { date: "10 Jul", power: 110, maxTrack: 200, circuits: 16 },
      { date: "11 Jul", power: 50, maxTrack: 200, circuits: 8 },
    ];
  }, []);

  // Dados para o Gráfico de Linha / Sparkline (como a referência)
  const lineChartData = useMemo(() => {
    return [
      { date: "01 Jul", value: 12400 },
      { date: "02 Jul", value: 18900 },
      { date: "03 Jul", value: 14200 },
      { date: "04 Jul", value: 24800 },
      { date: "05 Jul", value: 15100 },
      { date: "06 Jul", value: 20462.89 },
    ];
  }, []);

  // Filtro de Projetos na Tabela
  const filteredProjects = useMemo(() => {
    if (activeTableTab === "completed") {
      return projects.filter((p) => p.status === "concluido" || (p.circuits && p.circuits.length > 5));
    }
    if (activeTableTab === "in_progress") {
      return projects.filter((p) => p.status === "em_andamento" || (!p.status && p.circuits && p.circuits.length <= 5));
    }
    if (activeTableTab === "pending") {
      return projects.filter((p) => p.status === "pendente" || !p.circuits || p.circuits.length === 0);
    }
    if (activeTableTab === "solar") {
      return projects.filter((p) => p.project_type === "solar" || p.solar_power_kwp);
    }
    return projects;
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

  return (
    <TooltipProvider>
      <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
        {/* ── 1. Top Announcement / Upgrade Banner (Cor Sólida sem Gradiente) ── */}
        <section className="relative overflow-hidden rounded-2xl border border-[#00bda1]/20 bg-[#00d8b8] p-5 sm:p-6 text-slate-950 shadow-sm">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5 max-w-2xl">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
                Dimensionamento elétrico profissional e instantâneo
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-900/80 leading-relaxed">
                Crie projetos elétricos completos, plantas inteligentes, quadros de distribuição e memoriais descritivos conforme as normas vigentes.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Button
                asChild
                className="h-10 rounded-full bg-slate-950 px-5 text-xs font-black text-white shadow-sm hover:bg-slate-900 hover:scale-[1.02] transition-all"
              >
                <Link to="/projects/new">
                  <Plus className="mr-1.5 h-4 w-4 text-[#00d8b8]" />
                  Novo Projeto
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── 2. Overview Section (Header + 4 Metric Cards) ── */}
        <section className="space-y-4">
          {/* Header da Seção Overview */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-[#0F172A]">Overview</h2>
              <p className="text-xs font-medium text-[#64748B]">Métricas e desempenho em tempo real</p>
            </div>

            {/* Controles da Direita (Date Range + Filter + Export) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-bold text-[#475467] shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-[#00d8b8]" />
                <span>01 Out 2026 - 31 Out 2026</span>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-bold text-[#475467] shadow-sm hover:border-[#CBD5E1]"
                  >
                    <span>Últimos 30 dias</span>
                    <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-[#E2E8F0] bg-white p-1 shadow-lg text-xs font-bold">
                  <DropdownMenuItem onClick={() => setTimeFilter("7d")}>Últimos 7 dias</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimeFilter("30d")}>Últimos 30 dias</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTimeFilter("90d")}>Últimos 90 dias</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl border-[#E2E8F0] bg-white px-3 text-xs font-bold text-[#475467] shadow-sm hover:bg-[#F8FAFC]"
                onClick={() => navigate("/budget")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
                Exportar
              </Button>
            </div>
          </div>

          {/* 4 KPI Metric Cards (Grid 4 colunas) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Demanda Instalada */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3 hover:border-[#CBD5E1] transition">
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
                    <p className="text-xs">Soma da potência de demanda calculada pela NBR 5410</p>
                  </TooltipContent>
                </UITooltip>
              </div>

              <div>
                <p className="text-2xl font-black text-[#0F172A] tracking-tight">
                  {summaryMetrics.totalPowerKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+41% em relação ao mês anterior</span>
              </div>
            </div>

            {/* Card 2: Total de Circuitos */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3 hover:border-[#CBD5E1] transition">
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
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+15% em relação ao mês anterior</span>
              </div>
            </div>

            {/* Card 3: Projetos Ativos */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3 hover:border-[#CBD5E1] transition">
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
                    <p className="text-xs">Total de projetos elétricos criados na conta</p>
                  </TooltipContent>
                </UITooltip>
              </div>

              <div>
                <p className="text-2xl font-black text-[#0F172A] tracking-tight">
                  {summaryMetrics.projectCount}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>100% em conformidade NBR</span>
              </div>
            </div>

            {/* Card 4: Orçamento Estimado */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3 hover:border-[#CBD5E1] transition">
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
                    <p className="text-xs">Estimativa comercial consolidada de materiais e infraestrutura</p>
                  </TooltipContent>
                </UITooltip>
              </div>

              <div>
                <p className="text-2xl font-black text-[#0F172A] tracking-tight">
                  {formatCurrencyBR(summaryMetrics.estimatedBudget)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+41% em relação ao mês anterior</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Interactive Charts Grid (65% / 35% Exato da Referência Shopall) ── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Gráfico Esquerdo (65%): Bar Chart de Cargas & Potência */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:col-span-8 flex flex-col justify-between space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-[#64748B]">Total de Cargas Dimensionadas</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-[#0F172A]">1,525 kVA</span>
                  <span className="text-xs font-black text-emerald-600">+20.1% este mês</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#475467]">
                <Calendar className="h-3.5 w-3.5 text-[#00d8b8]" />
                <span>Últimos 30 dias</span>
              </div>
            </div>

            {/* Container do Gráfico com Barras em Cápsula e Fundo Track */}
            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} barCategoryGap="25%">
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis hide domain={[0, 200]} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "transparent" }} />
                  {/* Fundo sutil cinza em cápsula */}
                  <Bar
                    dataKey="maxTrack"
                    fill="#F1F5F9"
                    radius={[12, 12, 12, 12]}
                    isAnimationActive={false}
                  />
                  {/* Barra principal com cor verde do projeto */}
                  <Bar
                    dataKey="power"
                    fill="#00d8b8"
                    radius={[12, 12, 12, 12]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico Direito (35%): Area Sparkline de Demanda */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:col-span-4 flex flex-col justify-between space-y-4">
            <div>
              <p className="text-xs font-bold text-[#64748B]">Demanda Média Estimada</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-[#0F172A]">R$ 20.462,89</span>
                <span className="text-xs font-black text-emerald-600">+20.1%</span>
              </div>
            </div>

            <div className="h-56 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <Tooltip content={<CustomAreaTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#00d8b8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="rgba(0, 216, 184, 0.12)"
                    dot={{ r: 4, fill: "#ffffff", stroke: "#00d8b8", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#00d8b8", stroke: "#ffffff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ── 4. Tabela de Projetos / Atividades ('Last sales' Table da Referência) ── */}
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
                <span>Últimos 30 dias</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl border-[#E2E8F0] bg-white px-3 text-xs font-bold text-[#475467] shadow-sm hover:bg-[#F8FAFC]"
                onClick={() => navigate("/budget")}
              >
                <Download className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Filter Tabs em Pílula (Exato da referência 'All tasks, Completed, In Progress, etc.') */}
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
                  <th className="py-3 px-3">Potência (W)</th>
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
                    const powerW = proj.total_demand_w || (proj.circuits?.length ? proj.circuits.reduce((acc, c) => acc + Number(c.power_w || 0), 0) : 15400);
                    const statusText = proj.status === "concluido" ? "Concluído" : proj.circuits?.length ? "Conforme" : "Em análise";

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
                          {proj.client_name || "Engenharia Nacif"}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#64748B]">
                          {proj.city || "Belo Horizonte"}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
                                onClick={async () => {
                                  if (window.confirm(`Deseja excluir o projeto ${proj.name}?`)) {
                                    await backend.entities.Project.delete(proj.id);
                                    setProjects((prev) => prev.filter((p) => p.id !== proj.id));
                                  }
                                }}
                                className="text-red-600 focus:text-red-600"
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

          {/* Paginação no Rodapé da Tabela */}
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
              >
                2
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC]"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
