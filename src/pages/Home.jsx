import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileText,
  FolderOpen,
  GitBranch,
  Grid2X2,
  PencilLine,
  Plus,
  ScanLine,
  Shield,
  Upload,
  Zap,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { calcProjectMetrics } from "@/lib/electricalEngine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import PageHeader from "@/components/PageHeader";

const MODULES = [
  { path: "/projects", icon: FolderOpen, label: "Projetos", desc: "Gestão e abertura dos projetos técnicos.", tone: "blue" },
  { path: "/planta-ia", icon: Cpu, label: "Planta IA", desc: "Pontos, circuitos e infraestrutura na planta.", tone: "cyan" },
  { path: "/circuit-editor", icon: PencilLine, label: "Circuitos", desc: "Circuitos e cargas conforme NBR 5410.", tone: "green" },
  { path: "/panel-generator", icon: Grid2X2, label: "Quadro elétrico", desc: "Distribuição DIN e proteção.", tone: "amber" },
  { path: "/unifilar", icon: GitBranch, label: "Diagrama unifilar", desc: "Documentação elétrica do projeto.", tone: "indigo" },
  { path: "/phase-balance", icon: Activity, label: "Balanço de fases", desc: "Equilíbrio e leitura por fase.", tone: "teal" },
  { path: "/scanner", icon: ScanLine, label: "Scanner IA", desc: "Leitura de imagens e plantas.", tone: "rose" },
  { path: "/calculator", icon: Calculator, label: "Calculadora", desc: "Cálculos auxiliares de engenharia.", tone: "slate" },
  { path: "/nbr-library", icon: BookOpen, label: "Biblioteca NBR", desc: "Referências técnicas de consulta.", tone: "blue" },
  { path: "/materials", icon: BarChart3, label: "Materiais", desc: "Quantitativos e lista técnica.", tone: "green" },
  { path: "/budget", icon: FileText, label: "Orçamento", desc: "Estimativas e composição de custos.", tone: "amber" },
  { path: "/components-library", icon: Shield, label: "Biblioteca", desc: "Componentes e fabricantes.", tone: "cyan" },
];

const metricToneStyles = {
  blue: {
    card: "border-[#00d8b8] bg-[#00d8b8]",
    icon: "bg-white text-[#00d8b8]",
    softText: "text-[#DCEEF8]",
  },
  cyan: {
    card: "border-[#00d8b8] bg-[#00d8b8]",
    icon: "bg-white text-[#00d8b8]",
    softText: "text-[#DCEEF8]",
  },
  amber: {
    card: "border-[#00d8b8] bg-[#00d8b8]",
    icon: "bg-white text-[#00d8b8]",
    softText: "text-[#DCEEF8]",
  },
  green: {
    card: "border-[#00d8b8] bg-[#00d8b8]",
    icon: "bg-white text-[#00d8b8]",
    softText: "text-[#DCEEF8]",
  },
};

const moduleToneStyles = {
  blue: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  cyan: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  green: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  amber: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  indigo: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  teal: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  rose: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  slate: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
};

const CHECKLIST_STORAGE_KEY = "voltai:dashboard-checklist-dismissed";

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const formatKw = (watts) =>
  `${(Number(watts || 0) / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} kW`;

const getProjectDate = (project) => project?.updated_date || project?.updated_at || project?.created_date || project?.created_at;

const formatProjectDate = (project) => {
  const value = getProjectDate(project);
  if (!value) return "Sem atualização registrada";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atualização registrada";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isProjectCompleted = (project) => {
  const status = normalizeText(project?.status);
  return status.includes("concluido") || status.includes("aprovado") || status.includes("finalizado");
};

const hasPlantData = (project) =>
  Boolean(
    project?.plant_design ||
      project?.plantDocument ||
      project?.floor_plan ||
      project?.floorPlan ||
      project?.importedPlanElements?.length,
  );

const hasElectricalPoint = (project) =>
  Boolean(
    project?.electrical_points?.length ||
      project?.electricalPoints?.length ||
      project?.points?.length ||
      project?.lighting_points?.length ||
      project?.outlets?.length,
  );

const hasBoardData = (project) =>
  Boolean(project?.panel_layout || project?.panelLayout || project?.board_layout || project?.distribution_board || project?.panel_boards?.length);

const buildMetrics = (projects) => {
  let totalPower = 0;
  let totalCircuits = 0;
  let errCount = 0;
  let warnCount = 0;
  let completedProjects = 0;

  projects.forEach((project) => {
    const circuitCount = project?.circuits?.length || 0;
    totalCircuits += circuitCount;
    if (isProjectCompleted(project)) completedProjects += 1;

    if (circuitCount > 0) {
      try {
        const metrics = calcProjectMetrics(project);
        totalPower += metrics.totalPower || 0;
        errCount += metrics.validations.filter((item) => item.severity === "error").length;
        warnCount += metrics.validations.filter((item) => item.severity === "warning").length;
      } catch {
        totalPower += Number(project?.total_demand_w || 0);
      }
      return;
    }

    totalPower += Number(project?.total_demand_w || 0);
  });

  return {
    activeProjects: projects.filter((project) => !isProjectCompleted(project) && normalizeText(project?.status) !== "arquivado").length,
    completedProjects,
    totalPower,
    totalCircuits,
    errCount,
    warnCount,
  };
};

const buildChecklist = (projects) => {
  const hasProject = projects.length > 0;
  const hasPlant = projects.some(hasPlantData);
  const hasPoint = projects.some(hasElectricalPoint);
  const hasCircuit = projects.some((project) => (project?.circuits?.length || 0) > 0);
  const hasBoard = projects.some(hasBoardData);
  const hasExport = projects.some((project) => Number(project?.exports_count || project?.exportsCount || 0) > 0);

  return [
    { label: "Criar primeiro projeto", done: hasProject },
    { label: "Desenhar ou importar a primeira planta", done: hasPlant },
    { label: "Adicionar ponto elétrico", done: hasPoint },
    { label: "Criar circuito", done: hasCircuit },
    { label: "Adicionar quadro elétrico", done: hasBoard },
    { label: "Exportar documentação", done: hasExport },
  ];
};

const buildPendingItems = (projects, metrics) => {
  const items = [];
  const withoutCircuits = projects.filter((project) => (project?.circuits?.length || 0) === 0);
  const withoutPlant = projects.filter((project) => !hasPlantData(project));
  const withoutBoard = projects.filter((project) => !hasBoardData(project));

  if (metrics.errCount + metrics.warnCount > 0) {
    items.push({
      title: "Validações NBR pendentes",
      description: `${metrics.errCount} erro(s) e ${metrics.warnCount} aviso(s) encontrados em projetos com circuitos.`,
      href: "/projects",
    });
  }

  if (withoutCircuits.length > 0) {
    items.push({
      title: "Projetos sem circuitos",
      description: `${withoutCircuits.length} projeto(s) ainda não possuem circuitos cadastrados.`,
      href: "/projects",
    });
  }

  if (withoutPlant.length > 0) {
    items.push({
      title: "Plantas não estruturadas",
      description: `${withoutPlant.length} projeto(s) ainda não possuem planta ou importação registrada.`,
      href: "/planta-ia",
    });
  }

  if (withoutBoard.length > 0) {
    items.push({
      title: "Quadros não definidos",
      description: `${withoutBoard.length} projeto(s) ainda não possuem quadro elétrico associado.`,
      href: "/panel-generator",
    });
  }

  return items.slice(0, 4);
};

export default function Home() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("loading");
  const [checklistDismissed, setChecklistDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(CHECKLIST_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
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

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const metrics = useMemo(() => buildMetrics(projects), [projects]);
  const checklist = useMemo(() => buildChecklist(projects), [projects]);
  const checklistProgress = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);
  const pendingItems = useMemo(() => buildPendingItems(projects, metrics), [projects, metrics]);
  const recentProjects = projects.slice(0, 5);
  const firstName = user?.full_name?.split(" ")?.[0] || "Admin";
  const showChecklist = !checklistDismissed && checklistProgress < 100;

  const dismissChecklist = () => {
    setChecklistDismissed(true);
    try {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, "true");
    } catch {
      // Local dismissal is optional.
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-16">
      <PageHeader
        icon={Zap}
        title={`Olá, ${firstName}`}
        subtitle="Painel técnico para projetos elétricos, documentação e conformidade."
        actionsPlacement="right"
        actions={
          <>
            <Button asChild variant="outline" className="h-10 rounded-[8px] border-[#D0D5DD] font-extrabold">
              <Link to="/planta-ia">
                <Upload className="h-4 w-4" />
                Importar planta
              </Link>
            </Button>
            <Button asChild className="h-10 rounded-[8px] font-extrabold">
              <Link to="/projects/new">
                <Plus className="h-4 w-4" />
                Novo projeto
              </Link>
            </Button>
          </>
        }
      />

      {status === "error" && (
        <section className="rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Não foi possível carregar os projetos. Verifique a conexão com o backend e tente atualizar a página.
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#667085]">Resumo operacional</p>
              <h2 className="mt-2 text-[24px] font-extrabold leading-tight text-[#101828] sm:text-[28px]">
                {status === "loading" ? "Carregando projetos" : `${projects.length} projeto${projects.length === 1 ? "" : "s"} no workspace`}
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#667085]">
                Acompanhe carga instalada, circuitos, validações e documentação sem carregar o motor do editor antes da abertura do projeto.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
              <DashboardPill label="Ativos" value={metrics.activeProjects} />
              <DashboardPill label="Concluídos" value={metrics.completedProjects} />
              <DashboardPill label="Circuitos" value={metrics.totalCircuits} />
              <DashboardPill label="Alertas" value={metrics.errCount + metrics.warnCount} />
            </div>
          </div>
        </article>

        {showChecklist ? (
          <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#101828]">Checklist inicial</p>
                <p className="mt-1 text-xs font-semibold text-[#667085]">{checklistProgress}% concluído</p>
              </div>
              <button type="button" onClick={dismissChecklist} className="text-xs font-extrabold text-[#667085] hover:text-[#101828]">
                Ocultar
              </button>
            </div>
            <Progress value={checklistProgress} className="mt-3 h-2 bg-[#EAECF0]" />
            <div className="mt-4 space-y-2">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm font-semibold text-[#344054]">
                  <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-[#00d8b8]" : "text-[#98A2B3]"}`} />
                  <span className={item.done ? "text-[#667085] line-through decoration-[#98A2B3]" : ""}>{item.label}</span>
                </div>
              ))}
            </div>
          </article>
        ) : (
          <RecentFocus project={recentProjects[0]} />
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Zap} label="Potência instalada" value={formatKw(metrics.totalPower)} footer="Total calculado em projetos" tone="blue" />
        <MetricCard icon={Activity} label="Circuitos totais" value={metrics.totalCircuits} footer="Circuitos cadastrados" tone="cyan" />
        <MetricCard icon={AlertTriangle} label="Validações" value={`${metrics.errCount} erros · ${metrics.warnCount} avisos`} footer="Conformidade NBR" tone="amber" />
        <MetricCard icon={CheckCircle2} label="Projetos concluídos" value={`${metrics.completedProjects} / ${projects.length}`} footer="Status do workspace" tone="green" />
      </section>

      {status === "loading" ? (
        <LoadingPanel />
      ) : projects.length === 0 ? (
        <EmptyProjects />
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <article className="rounded-[12px] border border-[#E4E7EC] bg-white">
            <div className="flex items-center justify-between border-b border-[#EAECF0] px-5 py-4">
              <div>
                <h2 className="text-base font-extrabold text-[#101828]">Projetos recentes</h2>
                <p className="mt-1 text-sm font-medium text-[#667085]">Últimas atualizações registradas no backend.</p>
              </div>
              <Button asChild variant="outline" className="h-9 rounded-[8px] border-[#D0D5DD] text-xs font-extrabold">
                <Link to="/projects">Ver todos</Link>
              </Button>
            </div>
            <div className="divide-y divide-[#EAECF0]">
              {recentProjects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[#101828]">Pendências</h2>
                  <p className="mt-1 text-sm font-medium text-[#667085]">Itens calculados com base nos projetos atuais.</p>
                </div>
                <Badge variant="outline" className="rounded-[8px] border-[#D0D5DD] text-[#344054]">
                  {pendingItems.length}
                </Badge>
              </div>
              <div className="mt-4 space-y-3">
                {pendingItems.length === 0 ? (
                  <div className="rounded-[10px] border border-[#BCEEE5] bg-[#F7FBFE] p-3 text-sm font-semibold text-[#0f4f49]">
                    Nenhuma pendência técnica detectada nos dados carregados.
                  </div>
                ) : (
                  pendingItems.map((item) => (
                    <Link key={item.title} to={item.href} className="block rounded-[10px] border border-[#EAECF0] p-3 transition hover:border-[#BCEEE5] hover:bg-[#F9FAFB]">
                      <p className="text-sm font-extrabold text-[#101828]">{item.title}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-[#667085]">{item.description}</p>
                    </Link>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
              <h2 className="text-base font-extrabold text-[#101828]">Atividade recente</h2>
              <div className="mt-4 space-y-3">
                {recentProjects.slice(0, 4).map((project) => (
                  <div key={project.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#F2F4F7] text-[#00d8b8]">
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#101828]">{project.name}</p>
                      <p className="text-xs font-medium text-[#667085]">Atualizado em {formatProjectDate(project)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-[#101828]">Módulos do sistema</h2>
            <p className="mt-1 text-sm font-medium text-[#667085]">Ferramentas técnicas disponíveis no workspace.</p>
          </div>
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#98A2B3]">{MODULES.length} módulos</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((module) => (
            <ModuleCard key={module.path} module={module} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DashboardPill({ label, value }) {
  return (
    <div className="rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB] px-3 py-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#667085]">{label}</p>
      <p className="mt-1 truncate text-xl font-extrabold text-[#101828]">{value}</p>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, footer, tone = "blue" }) {
  const styles = metricToneStyles[tone] || metricToneStyles.blue;

  return (
    <article className={`rounded-[12px] border p-4 text-white ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className={`mt-4 text-xs font-extrabold uppercase tracking-[0.08em] ${styles.softText}`}>{label}</p>
      <p className="mt-1 truncate text-xl font-extrabold text-white">{value}</p>
      <p className={`mt-1 truncate text-sm font-medium ${styles.softText}`}>{footer}</p>
    </article>
  );
}

function RecentFocus({ project }) {
  if (!project) {
    return (
      <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
        <p className="text-sm font-extrabold text-[#101828]">Próxima ação</p>
        <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">Crie ou importe uma planta para iniciar um projeto técnico.</p>
        <Button asChild className="mt-4 h-10 rounded-[8px] font-extrabold">
          <Link to="/projects/new">
            <Plus className="h-4 w-4" />
            Novo projeto
          </Link>
        </Button>
      </article>
    );
  }

  return (
    <Link to={`/projects/${project.id}`} className="group flex min-h-[170px] flex-col justify-between rounded-[12px] border border-[#E4E7EC] bg-white p-5 transition hover:border-[#BCEEE5] hover:bg-[#F9FAFB]">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E8FCF8] text-[#00d8b8]">
          <FolderOpen className="h-5 w-5" />
        </span>
        <ChevronRight className="h-5 w-5 text-[#98A2B3] transition group-hover:text-[#00d8b8]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#667085]">Projeto recente</p>
        <p className="mt-2 truncate text-lg font-extrabold text-[#101828]">{project.name}</p>
        <p className="mt-1 truncate text-sm font-medium text-[#667085]">
          {project.client_name || "Sem cliente"} - {formatProjectDate(project)}
        </p>
      </div>
    </Link>
  );
}

function ProjectRow({ project }) {
  const circuitCount = project?.circuits?.length || 0;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <Link to={`/projects/${project.id}`} className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#F2F4F7] text-[#00d8b8]">
          <FolderOpen className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-[#101828]">{project.name}</span>
          <span className="mt-1 block truncate text-xs font-medium text-[#667085]">
            {project.client_name || "Sem cliente"} - {project.supply_type || "Sem alimentação"} - {circuitCount} circuito{circuitCount === 1 ? "" : "s"}
          </span>
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:justify-end">
        <Badge variant="outline" className="rounded-[8px] border-[#D0D5DD] text-[#344054]">
          {project.status || "Rascunho"}
        </Badge>
        <Button asChild variant="outline" className="h-9 rounded-[8px] border-[#D0D5DD] text-xs font-extrabold">
          <Link to={`/projects/${project.id}`}>Abrir</Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyProjects() {
  return (
    <section className="rounded-[12px] border border-[#E4E7EC] bg-white p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#E8FCF8] text-[#00d8b8]">
        <FolderOpen className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-[#101828]">Nenhum projeto cadastrado</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-[#667085]">
        O dashboard será preenchido com projetos, circuitos, validações e atividades assim que houver dados reais no backend.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild className="h-10 rounded-[8px] font-extrabold">
          <Link to="/projects/new">
            <Plus className="h-4 w-4" />
            Criar projeto
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-10 rounded-[8px] border-[#D0D5DD] font-extrabold">
          <Link to="/planta-ia">
            <Upload className="h-4 w-4" />
            Importar planta
          </Link>
        </Button>
      </div>
    </section>
  );
}

function LoadingPanel() {
  return (
    <section className="rounded-[12px] border border-[#E4E7EC] bg-white p-6">
      <p className="text-sm font-extrabold text-[#101828]">Carregando projetos</p>
      <p className="mt-1 text-sm font-medium text-[#667085]">Buscando dados reais do workspace para montar o painel.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB]" />
        ))}
      </div>
    </section>
  );
}

function ModuleCard({ module }) {
  const styles = moduleToneStyles[module.tone] || moduleToneStyles.blue;

  return (
    <Link
      to={module.path}
      className={`group relative flex min-h-[112px] items-center justify-between overflow-hidden rounded-[12px] border p-4 transition ${styles.card}`}
    >
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${styles.rail}`} />
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] transition ${styles.icon}`}>
          <module.icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[#101828]">{module.label}</p>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-[#667085]">{module.desc}</p>
        </span>
      </div>
      <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-[#98A2B3] transition group-hover:text-[#00d8b8]" />
    </Link>
  );
}
