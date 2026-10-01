import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GitBranch,
  Grid2X2,
  Layers,
  LayoutGrid,
  Loader2,
  PencilLine,
  Plus,
  ScanLine,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { calcProjectMetrics } from "@/lib/electricalEngine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProjectProgress } from "@/lib/projectProgress";
import NextStepCard from "@/components/navigation/NextStepCard";
import ProjectProgress from "@/components/navigation/ProjectProgress";

const CHECKLIST_STORAGE_KEY = "nacif:dashboard-onboarding-checklist-hidden";

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

const formatProjectTimeAgo = (project) => {
  const value = getProjectDate(project);
  if (!value) return "recentemente";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recentemente";

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "há poucos minutos";
  if (diffHours === 1) return "há 1h";
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return "ontem";
  if (diffDays < 30) return `há ${diffDays} dias`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("loading");
  const [checklistHidden, setChecklistHidden] = useState(() => {
    try {
      return window.localStorage.getItem(CHECKLIST_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

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
  const recentProject = projects[0] || null;
  const recentProjectProgress = useMemo(
    () => (recentProject ? getProjectProgress(recentProject) : null),
    [recentProject]
  );

  // Calcula indicadores compactos reais
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

    return {
      projectCount: projects.length,
      totalCircuits,
      totalPowerKw: totalPower / 1000,
      errCount,
      warnCount,
    };
  }, [projects]);

  // Identifica pendências reais e críticas
  const criticalAttentionItems = useMemo(() => {
    const items = [];

    projects.forEach((p) => {
      const circuits = p.circuits || [];
      if (circuits.length > 0) {
        try {
          const m = calcProjectMetrics(p);
          const errors = (m.validations || []).filter((v) => v.severity === "error");
          if (errors.length > 0) {
            items.push({
              id: `val_${p.id}`,
              projectId: p.id,
              projectName: p.name,
              title: `${errors.length} validação(ões) NBR pendente(s)`,
              description: `Em ${p.name}: ${errors[0]?.message || "Verifique condutores e proteções."}`,
              href: `/circuit-editor?project=${p.id}`,
            });
          }
        } catch {
          // Ignore
        }
      }
    });

    return items.slice(0, 3);
  }, [projects]);

  const handleHideChecklist = () => {
    setChecklistHidden(true);
    try {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, "true");
    } catch {
      // Storage fallback
    }
  };

  const showInitialChecklist = !checklistHidden && projects.length <= 2;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-16">
      {/* 1. Saudação & Hero de Ação Principal */}
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#101828]">
            Olá, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm font-semibold text-[#667085]">
            O que você quer fazer hoje?
          </p>
        </div>

        {/* Barra de Ações Principais do Dia */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recentProject ? (
            <Link
              to={recentProjectProgress?.nextStep?.href || `/projects/${recentProject.id}`}
              className="group flex flex-col justify-between rounded-xl border border-[#00d8b8]/60 bg-[#E8FCF8]/60 p-4 shadow-sm hover:border-[#00d8b8] hover:bg-[#E8FCF8] transition"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00d8b8] text-slate-950 font-black">
                  <FolderOpen className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0f4f49] bg-white/80 px-2 py-0.5 rounded-md">
                  Continuar
                </span>
              </div>
              <div className="mt-3 min-w-0">
                <p className="truncate text-sm font-black text-[#101828] group-hover:text-[#0f4f49] transition">
                  {recentProject.name}
                </p>
                <p className="text-[11px] font-medium text-[#667085] mt-0.5">
                  Editado {formatProjectTimeAgo(recentProject)}
                </p>
              </div>
            </Link>
          ) : (
            <Link
              to="/projects/new"
              className="group flex flex-col justify-between rounded-xl border border-[#00d8b8]/40 bg-[#E8FCF8]/40 p-4 shadow-sm hover:border-[#00d8b8] hover:bg-[#E8FCF8] transition"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00d8b8] text-slate-950 font-black">
                  <Plus className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-[#101828]">Criar primeiro projeto</p>
                <p className="text-[11px] font-medium text-[#667085]">Iniciar dimensionamento elétrico</p>
              </div>
            </Link>
          )}

          <Link
            to="/projects/new"
            className="group flex flex-col justify-between rounded-xl border border-[#EAECF0] bg-white p-4 shadow-sm hover:border-[#00d8b8]/60 hover:bg-[#F9FAFB] transition"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F4F7] text-[#344054] group-hover:bg-[#E8FCF8] group-hover:text-[#00d8b8] transition">
                <Plus className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-sm font-black text-[#101828]">Novo projeto</p>
              <p className="text-[11px] font-medium text-[#667085]">Residencial, comercial ou solar</p>
            </div>
          </Link>

          <Link
            to="/planta-ia"
            className="group flex flex-col justify-between rounded-xl border border-[#EAECF0] bg-white p-4 shadow-sm hover:border-[#00d8b8]/60 hover:bg-[#F9FAFB] transition"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F4F7] text-[#344054] group-hover:bg-[#E8FCF8] group-hover:text-[#00d8b8] transition">
                <Upload className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-sm font-black text-[#101828]">Importar planta</p>
              <p className="text-[11px] font-medium text-[#667085]">Desenhar ou carregar arquivo</p>
            </div>
          </Link>
        </div>

        {/* 2. Barra Compacta de Indicadores (Sem 4 cards gigantes cheios de zeros) */}
        {projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[#EAECF0] bg-white px-4 py-2.5 text-xs font-semibold text-[#475467] shadow-sm">
            <span className="flex items-center gap-1.5 font-bold text-[#101828]">
              <FolderOpen className="h-3.5 w-3.5 text-[#00d8b8]" />
              {summaryMetrics.projectCount} {summaryMetrics.projectCount === 1 ? "projeto" : "projetos"}
            </span>
            <span className="text-[#D0D5DD]">•</span>
            <span>
              {summaryMetrics.totalCircuits} circuitos cadastrados
            </span>
            <span className="text-[#D0D5DD]">•</span>
            <span>
              {summaryMetrics.totalPowerKw.toFixed(1)} kW instalados
            </span>
            <span className="text-[#D0D5DD]">•</span>
            {summaryMetrics.errCount === 0 ? (
              <span className="flex items-center gap-1 font-bold text-emerald-600">
                <Check className="h-3.5 w-3.5 stroke-[3]" /> Sem erros NBR
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" /> {summaryMetrics.errCount} alerta(s)
              </span>
            )}
          </div>
        )}
      </section>

      {/* 3. Modo Guiado / Checklist Inicial (Discreto e Ocultável) */}
      {showInitialChecklist && (
        <section className="rounded-xl border border-[#BCEEE5] bg-[#F7FBFE] p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#0f4f49]">Configuração Inicial</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#00d8b8]" />
                <span className="text-xs font-bold text-[#667085]">
                  {projects.length > 0 ? "1 de 4 etapas concluídas" : "0 de 4 etapas concluídas"}
                </span>
              </div>
              <h3 className="text-sm font-black text-[#101828] mt-0.5">
                Configure seu primeiro projeto elétrico
              </h3>
            </div>
            <button
              type="button"
              onClick={handleHideChecklist}
              className="text-xs font-bold text-[#667085] hover:text-[#101828] transition"
            >
              Ocultar
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold ${projects.length > 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#EAECF0] bg-white text-[#667085]"}`}>
              <Check className={`h-3.5 w-3.5 ${projects.length > 0 ? "text-emerald-600 stroke-[3]" : "text-[#98A2B3]"}`} />
              <span>Criar projeto</span>
            </div>
            <div className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold ${recentProjectProgress?.steps[1]?.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#EAECF0] bg-white text-[#667085]"}`}>
              <Check className={`h-3.5 w-3.5 ${recentProjectProgress?.steps[1]?.done ? "text-emerald-600 stroke-[3]" : "text-[#98A2B3]"}`} />
              <span>Adicionar planta</span>
            </div>
            <div className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold ${recentProjectProgress?.steps[3]?.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#EAECF0] bg-white text-[#667085]"}`}>
              <Check className={`h-3.5 w-3.5 ${recentProjectProgress?.steps[3]?.done ? "text-emerald-600 stroke-[3]" : "text-[#98A2B3]"}`} />
              <span>Criar circuitos</span>
            </div>
            <div className={`flex items-center gap-2 rounded-lg border p-2 text-xs font-bold ${recentProjectProgress?.steps[4]?.done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#EAECF0] bg-white text-[#667085]"}`}>
              <Check className={`h-3.5 w-3.5 ${recentProjectProgress?.steps[4]?.done ? "text-emerald-600 stroke-[3]" : "text-[#98A2B3]"}`} />
              <span>Gerar quadro</span>
            </div>
          </div>
        </section>
      )}

      {/* 4. Projetos Recentes com Progresso Real */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-[#101828]">Projetos recentes</h2>
            <p className="text-xs font-medium text-[#667085]">Continue seu trabalho de onde parou</p>
          </div>
          {projects.length > 0 && (
            <Button asChild variant="outline" size="sm" className="h-8 text-xs font-black text-[#344054] border-[#D0D5DD]">
              <Link to="/projects">
                Ver todos
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>

        {status === "loading" ? (
          <div className="p-8 text-center text-xs font-semibold text-[#667085]">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#00d8b8] mb-2" />
            Carregando projetos...
          </div>
        ) : projects.length === 0 ? (
          /* Empty State Limpo */
          <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
              <FolderOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-[#101828]">Seu primeiro projeto começa aqui</h3>
              <p className="text-xs font-medium text-[#667085] max-w-sm mx-auto">
                Crie um projeto elétrico do zero ou importe uma planta baixa para dimensionar circuitos.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <Button asChild className="h-9 rounded-lg bg-[#00d8b8] px-4 text-xs font-black text-slate-950 hover:bg-[#00d8b8]/90">
                <Link to="/projects/new">
                  <Plus className="mr-1.5 h-4 w-4" /> Criar projeto
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-9 rounded-lg border-[#D0D5DD] text-xs font-bold text-[#344054]">
                <Link to="/planta-ia">
                  <Upload className="mr-1.5 h-4 w-4" /> Importar planta
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.slice(0, 4).map((project) => {
              const prog = getProjectProgress(project);
              const circuitsCount = project.circuits?.length || 0;

              return (
                <div
                  key={project.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#EAECF0] bg-white p-4 shadow-sm hover:border-[#00d8b8]/60 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F2F4F7] text-[#00d8b8]">
                      <FolderOpen className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${project.id}`}
                          className="truncate text-sm font-black text-[#101828] hover:text-[#00d8b8] transition"
                        >
                          {project.name}
                        </Link>
                        <span className="text-[10px] font-bold text-[#667085] bg-[#F2F4F7] px-2 py-0.5 rounded">
                          {project.supply_type || "Bifásico"}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#667085] mt-0.5">
                        {project.client_name || "Sem cliente"} • {circuitsCount} circuito{circuitsCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  {/* Barra de Progresso Real e Botão Continuar */}
                  <div className="flex items-center gap-4 sm:justify-end">
                    <div className="w-28 space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-[#667085]">
                        <span>Progresso</span>
                        <span className="text-[#00d8b8] font-black">{prog.percent}%</span>
                      </div>
                      <Progress value={prog.percent} className="h-1.5 bg-[#EAECF0]" />
                    </div>

                    <Button asChild size="sm" className="h-8 rounded-lg bg-[#00d8b8] px-3 text-xs font-black text-slate-950 hover:bg-[#00d8b8]/90">
                      <Link to={prog.nextStep.href}>
                        Continuar
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Atenção Necessária (Somente se existirem pendências reais) */}
      <section className="space-y-3">
        <h2 className="text-base font-black text-[#101828]">Atenção necessária</h2>

        {criticalAttentionItems.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-emerald-900">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-black">Tudo certo por aqui</p>
              <p className="text-xs font-medium text-emerald-700 mt-0.5">Nenhuma pendência crítica ou erro NBR nos seus projetos.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {criticalAttentionItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-[#101828]">{item.title}</p>
                    <p className="text-xs font-medium text-[#667085] truncate">{item.description}</p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-amber-300 text-xs font-bold text-amber-900 hover:bg-amber-100">
                  <Link to={item.href}>
                    Revisar
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
