import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  ChevronDown,
  CheckCircle2,
  Edit3,
  FileText,
  FolderOpen,
  GitBranch,
  Plus,
  BarChart3,
  BookOpen,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CircuitFormDialog from "@/components/CircuitFormDialog";
import PageHeader from "@/components/PageHeader";
import { autoBalancePhases, buildProjectElectricalSyncPayload, calcCircuit, calcProjectMetrics } from "@/lib/electricalEngine";

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

const statusClass = {
  Rascunho: "border-[#BCEEE5] bg-[#E8FCF8] text-[#0f4f49]",
  "Em andamento": "border-amber-200 bg-amber-50 text-amber-700",
  Concluído: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Aprovado: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const statTones = {
  default: {
    tile: "border-[#CDEFE8] bg-white",
    icon: "bg-[#F2FFFC] text-[#00d8b8] ring-[#D6E8F3]",
  },
  primary: {
    tile: "border-[#BCEEE5] bg-[#E8FCF8]",
    icon: "bg-white text-[#00d8b8] ring-[#B7D7EA]",
  },
  success: {
    tile: "border-emerald-200 bg-emerald-50/50",
    icon: "bg-white text-emerald-600 ring-emerald-200",
  },
  warning: {
    tile: "border-amber-200 bg-amber-50/50",
    icon: "bg-white text-amber-600 ring-amber-200",
  },
  danger: {
    tile: "border-red-200 bg-red-50/50",
    icon: "bg-white text-red-600 ring-red-200",
  },
};

const scoreTones = {
  success: {
    panel: "border-emerald-200 bg-emerald-50/70",
    icon: "bg-white text-emerald-600 ring-emerald-200",
    badge: "bg-white text-emerald-700 ring-emerald-200",
    bar: "bg-emerald-500",
    track: "bg-emerald-100",
  },
  warning: {
    panel: "border-amber-200 bg-amber-50/75",
    icon: "bg-white text-amber-600 ring-amber-200",
    badge: "bg-white text-amber-700 ring-amber-200",
    bar: "bg-amber-500",
    track: "bg-amber-100",
  },
  danger: {
    panel: "border-red-200 bg-red-50/75",
    icon: "bg-white text-red-600 ring-red-200",
    badge: "bg-white text-red-700 ring-red-200",
    bar: "bg-red-500",
    track: "bg-red-100",
  },
};

const projectNavItems = [
  { label: "Circuitos", icon: Edit3, href: (id) => `/circuit-editor?project=${id}` },
  { label: "Quadro", icon: Zap, href: (id) => `/panel-generator?project=${id}` },
  { label: "Diagrama", icon: GitBranch, href: (id) => `/unifilar?project=${id}` },
  { label: "Orçamento", icon: FileText, href: (id) => `/budget?project=${id}` },
  { label: "Materiais", icon: BarChart3, href: (id) => `/materials?project=${id}` },
  { label: "Memorial", icon: BookOpen, href: (id) => `/memorial?project=${id}` },
];

function ProjectStat({ icon: Icon, label, value, tone = "default" }) {
  const styles = statTones[tone] || statTones.default;

  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-[14px] border px-4 py-4 shadow-[0_10px_24px_rgba(0,100,166,0.035)] ${styles.tile}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ring-1 ${styles.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#667085]">{label}</p>
        <p className="mt-1 truncate text-[22px] font-extrabold leading-tight text-[#101828]">{value}</p>
      </div>
    </div>
  );
}

function CircuitSummaryItem({ label, value, tone = "default" }) {
  const toneClass = tone === "danger"
    ? "border-red-200 bg-red-50/70 text-red-800"
    : tone === "success"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-800"
      : "border-[#CDEFE8] bg-white text-[#101828]";

  return (
    <div className={`min-w-0 rounded-[12px] border px-3.5 py-3 ${toneClass}`}>
      <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#667085]">{label}</p>
      <p className="mt-1 truncate text-[15px] font-extrabold leading-tight">{value}</p>
    </div>
  );
}

function CircuitDetailItem({ label, value, tone = "default" }) {
  const valueClass = tone === "danger"
    ? "text-red-700"
    : tone === "success"
      ? "text-emerald-700"
      : "text-[#101828]";

  return (
    <div className="min-w-0 rounded-[12px] border border-[#CDEFE8] bg-white px-3 py-2.5">
      <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#667085]">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-extrabold ${valueClass}`}>{value}</p>
    </div>
  );
}

function CircuitCard({ circuit, index, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const voltageDropOk = circuit.voltage_drop_ok !== false;
  const voltageDropStatus = voltageDropOk ? "Dentro do limite" : "Revisar";
  const detailsId = `circuit-details-${index}`;

  return (
    <article className={`relative overflow-hidden rounded-[18px] border bg-white p-4 shadow-[0_14px_34px_rgba(0,100,166,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(0,100,166,0.08)] ${voltageDropOk ? "border-[#CDEFE8] hover:border-[#7DBDDF]" : "border-red-200"}`}>
      <span className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${voltageDropOk ? "bg-[#00d8b8]" : "bg-red-500"}`} />
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4 pl-1">
          <span className="mt-0.5 shrink-0 rounded-[10px] border border-[#BCEEE5] bg-[#E8FCF8] px-3 py-1.5 text-xs font-extrabold text-[#00d8b8]">
            C{String(index + 1).padStart(2, "0")}
          </span>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
              <h3 className="truncate text-base font-extrabold leading-tight text-[#0f1728] sm:text-lg">{circuit.name || "Circuito sem nome"}</h3>
              <span className="rounded-[9px] bg-[#EEF2F6] px-2.5 py-1 text-xs font-bold text-[#4B5565]">
                {phaseLabel(circuit.phase)}
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-[#667085]">
              {circuit.type || "Circuito"} · {circuit.supply_type || "Monofásico"} · {circuit.voltage || 220}V
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {circuit.needs_dr && (
            <span className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#BCEEE5] bg-[#E8FCF8] px-3 text-xs font-extrabold text-[#00d8b8]">
              <ShieldCheck className="h-4 w-4" />
              DR 30mA
            </span>
          )}

          <span className={`inline-flex h-9 items-center rounded-[10px] border px-3 text-xs font-extrabold ${voltageDropOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {voltageDropStatus}
          </span>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#CDEFE8] bg-white px-3 text-xs font-extrabold text-[#344054] transition hover:border-[#7DBDDF] hover:bg-[#F2FFFC] hover:text-[#00d8b8]"
            aria-expanded={expanded}
            aria-controls={detailsId}
          >
            {expanded ? "Ocultar" : "Ver detalhes"}
            <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-500 transition hover:bg-red-50 hover:text-red-600"
            aria-label={`Excluir circuito ${circuit.name || index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <CircuitSummaryItem label="Potência" value={formatPower(circuit.power_w)} />
        <CircuitSummaryItem label="Corrente" value={formatNumber(circuit.corrected_current_a, " A")} />
        <CircuitSummaryItem label="Disjuntor" value={breakerLabel(circuit)} />
        <CircuitSummaryItem label="Condutor" value={circuit.wire_gauge || "A definir"} />
        <CircuitSummaryItem
          label="Queda ΔU"
          value={formatNumber(circuit.voltage_drop_pct, "%")}
          tone={voltageDropOk ? "success" : "danger"}
        />
      </div>

      {expanded && (
        <div id={detailsId} className="mt-4 border-t border-[#CDEFE8] pt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <CircuitDetailItem
              label="Alimentação"
              value={`${circuit.supply_type || "Monofásico"} · ${phaseLabel(circuit.phase)}`}
            />
            <CircuitDetailItem label="Comprimento" value={formatNumber(circuit.length_m || 15, " m")} />
            <CircuitDetailItem label="Instalação" value={circuit.install_method || "Eletroduto Embutido em Parede"} />
            <CircuitDetailItem label="Corrente nominal" value={formatNumber(circuit.project_current_a, " A")} />
            <CircuitDetailItem label="Corrente corrigida" value={formatNumber(circuit.corrected_current_a, " A")} />
            <CircuitDetailItem label="Fator potência" value={formatNumber(circuit.power_factor || 1)} />
            <CircuitDetailItem label="Ruptura" value={`${circuit.breaking_capacity_ka || 3} kA`} />
            <CircuitDetailItem
              label="Status queda"
              value={`${formatNumber(circuit.voltage_drop_pct, "%")} · ${voltageDropStatus}`}
              tone={voltageDropOk ? "success" : "danger"}
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

  const load = async () => {
    const currentProject = await backend.entities.Project.get(projectId);
    setProject(currentProject);
    setLoading(false);
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
  const scoreTone = errorCount > 0 ? "danger" : warningCount > 0 ? "warning" : "success";
  const scoreStyle = scoreTones[scoreTone];
  const issueSummary = errorCount > 0 || warningCount > 0
    ? [
      errorCount > 0 ? pluralize(errorCount, "erro") : null,
      warningCount > 0 ? pluralize(warningCount, "aviso") : null,
    ].filter(Boolean).join(" / ")
    : "Sem pendências";
  const statusTone = statusClass[project?.status] || statusClass.Rascunho;
  const alertTone = errorCount > 0 ? "danger" : warningCount > 0 ? "warning" : "success";
  const alertValue = errorCount > 0
    ? pluralize(errorCount, "erro")
    : warningCount > 0
      ? pluralize(warningCount, "aviso")
      : "Sem pendências";

  const addCircuit = async (calc) => {
    const updatedCircuits = autoBalancePhases([...(project.circuits || []), calc]);

    await backend.entities.Project.update(projectId, buildProjectElectricalSyncPayload(project, updatedCircuits));
    load();
  };

  const removeCircuit = async (idx) => {
    const updatedCircuits = autoBalancePhases((project.circuits || []).filter((_, i) => i !== idx));

    await backend.entities.Project.update(projectId, buildProjectElectricalSyncPayload(project, updatedCircuits));
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  if (!project) {
    return <div className="py-20 text-center text-muted-foreground">Projeto não encontrado</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1520px] space-y-5 pb-20">
      <PageHeader
        icon={FolderOpen}
        title={project.name}
        subtitle={`${project.client_name || "Sem cliente"} · ${project.supply_type || "Monofásico"} · ${project.voltage || 220}V`}
        actionsPlacement="right"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="border-[#BCEEE5] bg-white text-[#0f1728] shadow-[0_10px_24px_rgba(0,100,166,0.08)] hover:bg-[#F2FFFC]" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-4 w-4" />
              Projetos
            </Button>
          </div>
        }
      />

      <section className="rounded-[18px] border border-[#BCEEE5] bg-[#F7FBFE] p-2 shadow-[0_16px_44px_rgba(0,100,166,0.06)]">
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <nav className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Navegação do projeto">
            <div className="flex min-w-max items-center gap-1.5">
              {projectNavItems.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.href(projectId)}
                    className="inline-flex h-11 items-center gap-2 rounded-[12px] px-4 text-sm font-extrabold text-[#344054] transition hover:bg-white hover:text-[#00d8b8] hover:shadow-[0_8px_20px_rgba(0,100,166,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <ItemIcon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-2 border-t border-[#CDEFE8] pt-2 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
            <span className="inline-flex h-10 items-center rounded-[11px] bg-white px-3 text-xs font-extrabold text-[#344054] ring-1 ring-[#D6E8F3]">
              {circuits.length} circuito{circuits.length === 1 ? "" : "s"}
            </span>
            <Badge variant="outline" className={`h-10 rounded-[11px] px-3 text-xs font-extrabold ${statusTone}`}>
              {project.status || "Rascunho"}
            </Badge>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-[#BCEEE5] bg-white shadow-[0_18px_48px_rgba(0,100,166,0.06)]">
        <div className="flex min-w-0 flex-col gap-4 border-b border-[#CDEFE8] bg-[#E8FCF8] px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#00d8b8]">Resumo técnico</p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-[#101828]">
              Visão geral do projeto
            </h2>
          </div>

          <div className={`flex min-w-0 flex-col gap-3 rounded-[14px] border px-3 py-3 sm:flex-row sm:items-center sm:justify-between xl:w-[430px] ${scoreStyle.panel}`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ring-1 ${scoreStyle.icon}`}>
                {scoreTone === "danger" ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-500">NBR</p>
                <p className="mt-0.5 truncate text-xl font-extrabold leading-tight text-slate-950">{nbrScore}%</p>
              </div>
            </div>

            <p className="min-w-0 truncate text-sm font-extrabold text-slate-700">{issueSummary}</p>

            <Button asChild variant="outline" size="sm" className="h-9 shrink-0 rounded-[10px] bg-white/85 px-3 text-xs font-extrabold">
              <Link to={`/circuit-editor?project=${projectId}`}>Revisar</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
          <ProjectStat icon={Zap} label="Potência" value={formatPower(metrics?.totalPower)} tone="primary" />
          <ProjectStat icon={Calculator} label="Corrente geral" value={formatNumber(metrics?.generalCurrent, " A")} />
          <ProjectStat icon={CheckCircle2} label="Circuitos" value={circuits.length} tone={circuits.length > 0 ? "success" : "default"} />
          <ProjectStat
            icon={errorCount > 0 ? AlertTriangle : ShieldCheck}
            label="Pendências"
            value={alertValue}
            tone={alertTone}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[16px] border border-[#CDEFE8] bg-[#F7FBFE] px-4 py-4 shadow-[0_12px_32px_rgba(0,100,166,0.04)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#667085]">Circuitos</p>
            <h2 className="mt-1 text-[22px] font-extrabold text-[#0f1728]">{circuits.length} circuito{circuits.length === 1 ? "" : "s"} cadastrados</h2>
          </div>

          <div className="grid gap-2 sm:flex sm:items-center sm:justify-end">
            <CircuitFormDialog
              onSave={addCircuit}
              trigger={
                <Button size="sm" className="h-11 rounded-[12px] px-5 font-extrabold">
                  <Plus className="h-4 w-4" />
                  Novo circuito
                </Button>
              }
            />
          </div>
        </div>

        {circuits.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#BCEEE5] bg-[#F2FFFC] px-6 py-12 text-center">
            <Calculator className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 text-base font-extrabold text-[#0f1728]">Nenhum circuito cadastrado</p>
            <p className="mt-1 text-sm font-medium text-[#687386]">Adicione o primeiro circuito para gerar quadro, diagrama, orçamento e materiais.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {circuits.map((circuit, index) => (
              <CircuitCard key={`${circuit.name}-${index}`} circuit={circuit} index={index} onRemove={removeCircuit} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
