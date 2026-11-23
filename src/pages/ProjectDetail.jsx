import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Copy,
  Edit3,
  FileText,
  FolderOpen,
  GitBranch,
  Plus,
  ShieldCheck,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
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
import CircuitFormDialog from "@/components/CircuitFormDialog";
import EditProjectModal from "@/components/EditProjectModal";
import InternalPageHeader from "@/components/internal/InternalPageHeader";
import NextStepCard from "@/components/navigation/NextStepCard";
import ProjectProgress from "@/components/navigation/ProjectProgress";
import ProjectHealthCard from "@/components/nacif/ProjectHealthCard";
import BrandLoadingScreen from "@/components/system/BrandLoadingScreen";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import {
  autoBalancePhases,
  buildProjectElectricalSyncPayload,
  calcCircuit,
  calcProjectMetrics,
} from "@/lib/electricalEngine";
import { cn } from "@/lib/utils";

const formatNumber = (value, suffix = "") =>
  `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}${suffix}`;

const formatPower = (watts) => {
  const value = Number(watts || 0);
  if (value >= 1000) return formatNumber(value / 1000, " kW");
  return formatNumber(value, " W");
};

const formatVoltage = (voltage) => {
  if (!voltage) return "220 V";
  return `${String(voltage).trim().replace(/\s*v$/i, "")} V`;
};

const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const phaseLabel = (phase) => {
  if (!phase) return "Fase A";
  if (phase === "ABC") return "Fases A/B/C";
  if (phase.length === 2) return `Fases ${phase.split("").join("/")}`;
  return `Fase ${phase}`;
};

const breakerLabel = (circuit) => {
  if (circuit.breaker_a) {
    return `${circuit.breaker_a}A ${circuit.breaker_poles || 1}P/${circuit.breaker_curve || "B"}`;
  }
  return circuit.breaker || "A definir";
};

const getProjectNavItems = (project) => {
  const isSolar =
    String(project?.project_type || "").toLowerCase().includes("solar") ||
    Boolean(project?.solar_config);
  return [
    ...(isSolar
      ? [{ label: "Projeto Solar", icon: Sun, href: (id) => `/solar-project?project=${id}` }]
      : []),
    { label: "Circuitos", icon: Edit3, href: (id) => `/circuit-editor?project=${id}` },
    { label: "Quadro", icon: Zap, href: (id) => `/panel-generator?project=${id}` },
    { label: "Diagrama", icon: GitBranch, href: (id) => `/unifilar?project=${id}` },
    { label: "Orçamento", icon: FileText, href: (id) => `/budget?project=${id}` },
    { label: "Materiais", icon: BarChart3, href: (id) => `/materials?project=${id}` },
    { label: "Memorial", icon: BookOpen, href: (id) => `/memorial?project=${id}` },
  ];
};

const STAT_TONES = {
  default: {
    icon: "bg-white text-[#64748B] border-[#E5EBF1]",
    value: "text-[#101828]",
  },
  emerald: {
    icon: "bg-[#E5FBF2] text-[#006B50] border-[#BEEAD2]/60",
    value: "text-[#101828]",
  },
  warning: {
    icon: "bg-[#FFF3E6] text-amber-700 border-amber-200",
    value: "text-amber-900",
  },
  danger: {
    icon: "bg-[#FEF2F2] text-[#EF4444] border-red-200",
    value: "text-red-700",
  },
};

function MinimalStatTile({ icon: Icon, label, value, tone = "default" }) {
  const styles = STAT_TONES[tone] || STAT_TONES.default;
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#EEF2F6] bg-[#F8FAFC]/80 px-3.5 py-3 transition hover:border-[#E5EBF1] hover:bg-white">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          styles.icon
        )}
      >
        <Icon className="h-4 w-4 stroke-[2]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">
          {label}
        </p>
        <p className={cn("mt-0.5 truncate text-lg font-extrabold leading-tight tabular-nums", styles.value)}>
          {value}
        </p>
      </div>
    </div>
  );
}

function CircuitSummaryCell({ label, value, alert = false, success = false }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border px-3 py-2.5",
        alert
          ? "border-red-200/80 bg-[#FEF2F2]/60"
          : "border-[#EEF2F6] bg-[#F8FAFC]/75"
      )}
    >
      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-extrabold leading-tight tabular-nums",
          alert ? "text-[#EF4444]" : success ? "text-[#006B50]" : "text-[#101828]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CircuitDetailCell({ label, value, alert = false, success = false }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#E5EBF1] bg-white px-3 py-2">
      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-xs font-bold",
          alert ? "text-[#EF4444]" : success ? "text-[#006B50]" : "text-[#101828]"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MinimalCircuitCard({ circuit, index, onRequestRemove }) {
  const [expanded, setExpanded] = useState(false);
  const voltageDropOk = circuit.voltage_drop_ok !== false;
  const voltageDropStatus = voltageDropOk ? "Dentro do limite" : "Revisar";
  const detailsId = `circuit-details-${index}`;
  const code = circuit.code || `C${String(index + 1).padStart(2, "0")}`;

  return (
    <article
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition sm:px-5",
        voltageDropOk
          ? "border-[#E5EBF1] hover:border-[#CBEAD9]"
          : "border-red-200 hover:border-red-300"
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-xs font-extrabold tabular-nums",
              voltageDropOk
                ? "bg-[#E5FBF2] text-[#006B50]"
                : "bg-[#FEF2F2] text-[#EF4444]"
            )}
          >
            {code}
          </span>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-bold text-[#101828]">
                {circuit.name || "Circuito sem nome"}
              </h3>
              <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#475569]">
                {phaseLabel(circuit.phase)}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-[#64748B]">
              {circuit.type || "Circuito"} · {circuit.supply_type || "Monofásico"} ·{" "}
              {formatVoltage(circuit.voltage)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
          <div className="flex flex-wrap items-center gap-1.5">
            {circuit.needs_dr && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5EBF1] bg-[#F8FAFC] px-2.5 text-[11px] font-semibold text-[#475569]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#006B50]" />
                DR 30mA
              </span>
            )}

            <span
              className={cn(
                "inline-flex h-8 items-center rounded-lg px-2.5 text-[11px] font-bold",
                voltageDropOk
                  ? "bg-[#E5FBF2] text-[#006B50]"
                  : "bg-[#FEF2F2] text-[#EF4444]"
              )}
            >
              {voltageDropStatus}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5EBF1] bg-white px-2.5 text-xs font-semibold text-[#475569] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#101828]"
              aria-expanded={expanded}
              aria-controls={detailsId}
            >
              <span>{expanded ? "Ocultar" : "Detalhes"}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
              />
            </button>

            <button
              type="button"
              onClick={() => onRequestRemove(index, circuit)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#FEF2F2] hover:text-[#EF4444]"
              aria-label={`Excluir circuito ${circuit.name || index + 1}`}
              title="Excluir circuito"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <CircuitSummaryCell label="Potência" value={formatPower(circuit.power_w)} />
        <CircuitSummaryCell
          label="Corrente"
          value={formatNumber(circuit.corrected_current_a, " A")}
        />
        <CircuitSummaryCell label="Disjuntor" value={breakerLabel(circuit)} />
        <CircuitSummaryCell label="Condutor" value={circuit.wire_gauge || "A definir"} />
        <CircuitSummaryCell
          label="Queda ΔU"
          value={formatNumber(circuit.voltage_drop_pct, "%")}
          success={voltageDropOk}
          alert={!voltageDropOk}
        />
      </div>

      {expanded && (
        <div
          id={detailsId}
          className="mt-3 rounded-xl border border-[#EEF2F6] bg-[#F8FAFC] p-3"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <CircuitDetailCell
              label="Alimentação"
              value={`${circuit.supply_type || "Monofásico"} · ${phaseLabel(circuit.phase)}`}
            />
            <CircuitDetailCell label="Comprimento" value={formatNumber(circuit.length_m || 15, " m")} />
            <CircuitDetailCell
              label="Instalação"
              value={circuit.install_method || "Eletroduto Embutido em Parede"}
            />
            <CircuitDetailCell
              label="Corrente nominal"
              value={formatNumber(circuit.project_current_a, " A")}
            />
            <CircuitDetailCell
              label="Corrente corrigida"
              value={formatNumber(circuit.corrected_current_a, " A")}
            />
            <CircuitDetailCell label="Fator potência" value={formatNumber(circuit.power_factor || 1)} />
            <CircuitDetailCell label="Ruptura" value={`${circuit.breaking_capacity_ka || 3} kA`} />
            <CircuitDetailCell
              label="Status queda"
              value={`${formatNumber(circuit.voltage_drop_pct, "%")} · ${voltageDropStatus}`}
              success={voltageDropOk}
              alert={!voltageDropOk}
            />
          </div>
        </div>
      )}
    </article>
  );
}

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [pendingCircuitDelete, setPendingCircuitDelete] = useState(null);

  const load = async () => {
    try {
      const currentProject = await backend.entities.Project.get(projectId);
      setProject(currentProject);
    } catch (err) {
      console.error("Erro ao carregar detalhes do projeto:", err);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateProject = async () => {
    setActionLoading(true);
    try {
      const duplicated = await backend.entities.Project.duplicate(projectId);
      navigate(`/projects/${duplicated.id}`);
    } catch (err) {
      console.error("Erro ao duplicar projeto:", err);
      alert(err?.message || "Não foi possível duplicar o projeto.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDeleteProject = async () => {
    setConfirmDeleteProject(false);
    setActionLoading(true);
    try {
      await backend.entities.Project.delete(projectId);
      navigate("/projects");
    } catch (err) {
      console.error("Erro ao excluir projeto:", err);
      alert(err?.message || "Não foi possível excluir o projeto.");
      setActionLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const circuits = useMemo(
    () => (project?.circuits || []).map((circuit) => calcCircuit(circuit)),
    [project?.circuits]
  );

  const metrics = useMemo(() => {
    if (!project) return null;
    return calcProjectMetrics({ ...project, circuits });
  }, [project, circuits]);

  const errorCount = metrics?.validations.filter((item) => item.severity === "error").length || 0;
  const warningCount = metrics?.validations.filter((item) => item.severity === "warning").length || 0;
  const nbrScore = metrics?.nbrScore ?? 100;
  const scoreTone = errorCount > 0 ? "danger" : warningCount > 0 ? "warning" : "emerald";
  const issueSummary =
    errorCount > 0 || warningCount > 0
      ? [
          errorCount > 0 ? pluralize(errorCount, "erro") : null,
          warningCount > 0 ? pluralize(warningCount, "aviso") : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Sem pendências";

  const addCircuit = async (calc) => {
    const updatedCircuits = autoBalancePhases([...(project.circuits || []), calc]);
    await backend.entities.Project.update(
      projectId,
      buildProjectElectricalSyncPayload(project, updatedCircuits)
    );
    load();
  };

  const confirmRemoveCircuit = async () => {
    if (!pendingCircuitDelete) return;
    const { index } = pendingCircuitDelete;
    setPendingCircuitDelete(null);
    const updatedCircuits = autoBalancePhases(
      (project.circuits || []).filter((_, i) => i !== index)
    );
    await backend.entities.Project.update(
      projectId,
      buildProjectElectricalSyncPayload(project, updatedCircuits)
    );
    load();
  };

  if (loading) {
    return <BrandLoadingScreen />;
  }

  if (!project) {
    return (
      <div className="py-20 text-center text-muted-foreground">Projeto não encontrado</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 pb-16">
      <InternalPageHeader
        icon={FolderOpen}
        title={project.name}
        subtitle={`${project.client_name || "Sem cliente"} · ${project.supply_type || "Monofásico"} · ${formatVoltage(project.voltage)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
              onClick={() => setIsEditModalOpen(true)}
              disabled={actionLoading}
            >
              <Edit3 className="mr-1.5 h-3.5 w-3.5 text-[#006B50]" />
              Editar Dados
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
              onClick={handleDuplicateProject}
              disabled={actionLoading}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
              Duplicar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#EF4444] hover:border-red-200 hover:bg-[#FEF2F2]"
              onClick={() => setConfirmDeleteProject(true)}
              disabled={actionLoading}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Excluir
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] hover:bg-[#F6F9FC]"
              onClick={() => navigate("/projects")}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
              Projetos
            </Button>
          </div>
        }
      />

      {/* Próxima Etapa (Modo Guiado Minimalista) */}
      <NextStepCard project={project} />

      {/* Saúde Técnica & Progresso */}
      <ProjectHealthCard project={project} />
      <ProjectProgress project={project} variant="card" />

      {/* Barra de Navegação entre Módulos */}
      <section className="rounded-2xl border border-[#E5EBF1] bg-white p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <nav
            className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Navegação do projeto"
          >
            <div className="flex min-w-max items-center gap-1">
              {getProjectNavItems(project).map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.href(projectId)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#E5FBF2] hover:text-[#006B50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D98A]/35"
                  >
                    <ItemIcon className="h-3.5 w-3.5 text-[#006B50]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-2 border-t border-[#E5EBF1] pt-2 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
            <span className="inline-flex h-8 items-center rounded-lg border border-[#E5EBF1] bg-[#F8FAFC] px-2.5 text-xs font-bold text-[#101828] tabular-nums">
              {pluralize(circuits.length, "circuito")}
            </span>
            <ProjectStatusBadge status={project.status} size="sm" />
          </div>
        </div>
      </section>

      {/* Resumo Técnico Minimalista */}
      <section className="rounded-2xl border border-[#E5EBF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 border-b border-[#E5EBF1] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              Resumo técnico
            </p>
            <h2 className="mt-0.5 text-base font-extrabold text-[#101828]">
              Visão geral do projeto
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold tabular-nums",
                scoreTone === "danger"
                  ? "bg-[#FEF2F2] text-[#EF4444]"
                  : scoreTone === "warning"
                  ? "bg-[#FFF3E6] text-amber-800"
                  : "bg-[#E5FBF2] text-[#006B50]"
              )}
            >
              {scoreTone === "danger" ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              <span>NBR 5410 · {nbrScore}%</span>
            </span>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
            >
              <Link to={`/circuit-editor?project=${projectId}`}>
                <span>Revisar</span>
                <ArrowUpRight className="ml-1 h-3.5 w-3.5 text-[#64748B]" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MinimalStatTile
            icon={Zap}
            label="Demanda / Carga"
            value={formatPower(metrics?.totalDemandPower ?? metrics?.totalPower)}
            tone="emerald"
          />
          <MinimalStatTile
            icon={Calculator}
            label="Corrente geral (Ib)"
            value={formatNumber(metrics?.generalCurrent, " A")}
            tone="default"
          />
          <MinimalStatTile
            icon={CheckCircle2}
            label="Circuitos"
            value={pluralize(circuits.length, "ativo")}
            tone={circuits.length > 0 ? "emerald" : "default"}
          />
          <MinimalStatTile
            icon={errorCount > 0 ? AlertTriangle : ShieldCheck}
            label="Pendências"
            value={issueSummary}
            tone={scoreTone}
          />
        </div>
      </section>

      {/* Circuitos (Cabeçalho + Lista Minimalista) */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
              <Zap className="h-[18px] w-[18px] stroke-[2.1]" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-[#101828]">Circuitos</h2>
              <p className="text-xs font-medium text-[#64748B]">
                {circuits.length} circuito{circuits.length === 1 ? "" : "s"} cadastrado
                {circuits.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <CircuitFormDialog
            onSave={addCircuit}
            trigger={
              <Button
                size="sm"
                className="h-9 rounded-xl bg-[#00D98A] px-4 text-xs font-extrabold text-[#031923] hover:bg-[#00C47C]"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Novo circuito
              </Button>
            }
          />
        </div>

        {circuits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5EBF1] bg-white px-6 py-10 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
              <Calculator className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-bold text-[#101828]">Nenhum circuito cadastrado</p>
            <p className="mt-1 text-xs font-medium text-[#64748B]">
              Adicione o primeiro circuito para gerar quadro, diagrama, orçamento e materiais.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {circuits.map((circuit, index) => (
              <MinimalCircuitCard
                key={`${circuit.id || circuit.name}-${index}`}
                circuit={circuit}
                index={index}
                onRequestRemove={(idx, item) => setPendingCircuitDelete({ index: idx, circuit: item })}
              />
            ))}
          </div>
        )}
      </section>

      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={project}
        onSuccess={(updated) => setProject(updated)}
      />

      {/* Confirmação segura de exclusão do projeto */}
      <AlertDialog
        open={confirmDeleteProject}
        onOpenChange={(open) => !open && setConfirmDeleteProject(false)}
      >
        <AlertDialogContent className="rounded-2xl border-[#E5EBF1] bg-white p-6 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold text-[#101828]">
              Excluir projeto "{project.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium leading-relaxed text-[#64748B]">
              Todos os circuitos, quadros e plantas associadas serão removidos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 gap-2">
            <AlertDialogCancel className="h-9 rounded-xl border-[#E5EBF1] bg-white text-xs font-semibold text-[#101828]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteProject}
              className="h-9 rounded-xl bg-[#EF4444] text-xs font-bold text-white hover:bg-red-600"
            >
              Excluir projeto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação segura de exclusão de circuito */}
      <AlertDialog
        open={Boolean(pendingCircuitDelete)}
        onOpenChange={(open) => !open && setPendingCircuitDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl border-[#E5EBF1] bg-white p-6 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold text-[#101828]">
              Excluir circuito "{pendingCircuitDelete?.circuit?.name || "selecionado"}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium leading-relaxed text-[#64748B]">
              Os cálculos de demanda, distribuição de fases e resumo técnico do projeto serão recalculados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 gap-2">
            <AlertDialogCancel className="h-9 rounded-xl border-[#E5EBF1] bg-white text-xs font-semibold text-[#101828]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveCircuit}
              className="h-9 rounded-xl bg-[#EF4444] text-xs font-bold text-white hover:bg-red-600"
            >
              Excluir circuito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
