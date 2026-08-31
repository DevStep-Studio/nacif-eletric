import { useState, useEffect } from "react";
import { backend } from "@/api/backendClient";
import {
  autoBalancePhases,
  buildProjectElectricalSyncPayload,
  calcProjectMetrics,
} from "@/lib/electricalEngine";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  CircleGauge,
  Edit3,
  Layers,
  Plus,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import CircuitFormDialog from "@/components/CircuitFormDialog";
import PageHeader from "@/components/PageHeader";

const PHASE_COLORS = { A: "text-amber-600", B: "text-blue-600", C: "text-emerald-600", ABC: "text-violet-600" };
const PHASE_DOT = { A: "bg-amber-500", B: "bg-blue-500", C: "bg-emerald-500", ABC: "bg-violet-500" };
const PHASE_BAR = { A: "#D97706", B: "#00d8b8", C: "#059669" };

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

function formatNumber(value, suffix = "") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `0${suffix}`;
  return `${numberFormatter.format(numeric)}${suffix}`;
}

function formatPower(watts = 0) {
  const value = Number(watts) || 0;
  if (value >= 1000) return `${formatNumber(value / 1000)} kW`;
  return `${formatNumber(value)} W`;
}

function getCircuitStatus(circuit) {
  if (!circuit.voltage_drop_ok) {
    return {
      label: "Revisar queda de tensão",
      description: `ΔU ${formatNumber(circuit.voltage_drop_pct, "%")} acima do limite`,
      className: "border-red-200 bg-red-50 text-red-700",
      icon: AlertTriangle,
    };
  }

  return {
    label: "Conforme",
    description: "Proteção e dimensionamento calculados",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: ShieldCheck,
  };
}

function getCircuitCriticals(circuit) {
  const items = [];
  if (!circuit.voltage_drop_ok) items.push({ label: "Queda de tensão", value: `${formatNumber(circuit.voltage_drop_pct, "%")}`, tone: "danger" });
  if (circuit.needs_dr) items.push({ label: "DR", value: "30mA", tone: "ok" });
  if (circuit.needs_dps) items.push({ label: "DPS", value: "Previsto", tone: "info" });
  if (circuit.wet_area) items.push({ label: "Área molhada", value: "sim", tone: "warning" });
  return items;
}

function Pill({ children, tone = "default" }) {
  const tones = {
    default: "border-[#CDEFE8] bg-white text-[#344054]",
    info: "border-[#BCEEE5] bg-[#E8FCF8] text-[#00d8b8]",
    ok: "border-emerald-100 bg-emerald-50 text-emerald-700",
    warning: "border-amber-100 bg-amber-50 text-amber-700",
    danger: "border-red-100 bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex min-h-8 items-center rounded-[10px] border px-3 text-[11px] font-extrabold leading-none ${tones[tone] || tones.default}`}>
      {children}
    </span>
  );
}

function CompactStat({ label, value, tone = "text-[#101828]", className = "border-[#CDEFE8] bg-white" }) {
  return (
    <div className={`min-w-0 rounded-[13px] border px-4 py-3 ${className}`}>
      <span className="block text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">{label}</span>
      <span className={`mt-1 block truncate text-[17px] font-extrabold leading-tight ${tone}`}>{value}</span>
    </div>
  );
}

function DetailLine({ label, value, tone = "text-[#101828]" }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-[12px] border border-[#CDEFE8] bg-white px-3 py-2.5">
      <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#667085]">{label}</span>
      <span className={`min-w-0 truncate text-right text-sm font-extrabold leading-5 ${tone}`}>{value}</span>
    </div>
  );
}

function CircuitCard({ circuit, index, onEdit, onRemove, saving }) {
  const [expanded, setExpanded] = useState(false);
  const status = getCircuitStatus(circuit);
  const StatusIcon = status.icon;
  const phase = circuit.phase || "A";
  const phaseLabel = circuit.phase === "ABC"
    ? "Fases ABC"
    : circuit.phase?.length === 2
      ? `Fases ${circuit.phase.split("").join("/")}`
      : `Fase ${circuit.phase || "A"}`;
  const effectivePower = (Number(circuit.power_w) || 0) * (Number(circuit.demand_factor) || 1);

  return (
    <article className="relative overflow-hidden rounded-[18px] border border-[#CDEFE8] bg-white shadow-[0_16px_40px_rgba(0,100,166,0.05)] transition hover:-translate-y-0.5 hover:border-[#BCEEE5] hover:shadow-[0_20px_48px_rgba(0,100,166,0.085)]">
      <span className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${circuit.voltage_drop_ok ? "bg-[#00d8b8]" : "bg-red-500"}`} />
      <div className="p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <span className="inline-flex h-8 shrink-0 items-center rounded-[10px] border border-[#BCEEE5] bg-[#E8FCF8] px-3 text-[11px] font-extrabold text-[#00d8b8]">
              C{String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="min-w-0 truncate text-xl font-extrabold leading-tight text-[#101828]">
              {circuit.name || "Circuito sem nome"}
            </h3>
            <Pill>{circuit.type || "Circuito"}</Pill>
            <span className={`inline-flex min-h-8 items-center rounded-[10px] border border-[#CDEFE8] bg-white px-3 text-[11px] font-extrabold ${PHASE_COLORS[phase] || "text-slate-700"}`}>
              <span className={`mr-1.5 h-2 w-2 rounded-[3px] ${PHASE_DOT[phase] || "bg-slate-400"}`} />
              {phaseLabel}
            </span>
            <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-[10px] border px-3 text-[11px] font-extrabold ${status.className}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </span>
          </div>

          {circuit.description && (
            <p className="mt-2 max-w-4xl truncate text-sm font-medium text-[#667085]">{circuit.description}</p>
          )}
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:justify-end">
            <CircuitFormDialog
              initialData={circuit}
              onSave={onEdit}
              trigger={
                <Button variant="outline" size="sm" disabled={saving} className="h-11 rounded-[12px] border-[#CDEFE8] bg-white px-4 font-extrabold shadow-[0_10px_22px_rgba(0,100,166,0.06)] hover:bg-[#F2FFFC]">
                  <Edit3 className="h-4 w-4" />
                  Editar
                </Button>
              }
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={saving}
              onClick={onRemove}
              aria-label={`Excluir ${circuit.name || `circuito ${index + 1}`}`}
              className="h-11 w-11 rounded-[12px] border-[#CDEFE8] bg-white text-[#667085] shadow-[0_10px_22px_rgba(0,100,166,0.05)] hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-[#CDEFE8] pt-4">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <CompactStat label="Carga" value={formatPower(effectivePower)} className="border-[#BCEEE5] bg-[#F2FFFC]" tone="text-[#101828]" />
            <CompactStat label="Corrente" value={formatNumber(circuit.project_current_a, " A")} className="border-cyan-100 bg-cyan-50/70" tone="text-cyan-950" />
            <CompactStat label="Proteção" value={`${circuit.breaker_a}A ${circuit.breaker_poles}P/${circuit.breaker_curve}`} className="border-emerald-100 bg-emerald-50/70" tone="text-emerald-950" />
            <CompactStat label="Condutor" value={circuit.wire_gauge} className="border-[#D8C8FF] bg-[#F6F2FF]" tone="text-[#43268B]" />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#CDEFE8] bg-white px-4 text-xs font-extrabold text-[#344054] transition hover:border-[#7DBDDF] hover:bg-[#F2FFFC] hover:text-[#00d8b8]"
            >
              {expanded ? "Ocultar detalhes" : "Ver mais detalhes"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>

          {expanded && (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <DetailLine label="Queda" value={`${formatNumber(circuit.voltage_drop_pct, "%")} · ${formatNumber(circuit.voltage_drop_v, " V")}`} tone={circuit.voltage_drop_ok ? "text-slate-950" : "text-red-600"} />
              <DetailLine label="Instalação" value={circuit.install_method || "A definir"} />
              <DetailLine label="DR / DPS" value={`${circuit.needs_dr ? "DR 30mA" : "Sem DR"} · ${circuit.needs_dps ? "DPS previsto" : "Sem DPS"}`} />
              <DetailLine label="Ambiente" value={`${circuit.temp_ambient || 30}°C · Ft ${formatNumber(circuit.temp_factor || 1)} · Fg ${formatNumber(circuit.group_factor || 1)}`} />
              <DetailLine label="Alimentação" value={`${circuit.supply_type || "A definir"} · ${circuit.voltage || 220}V · fp ${formatNumber(circuit.power_factor || 1)}`} />
              <DetailLine label="Quadro" value={`${circuit.din_modules || 1} DIN · ${circuit.group_count || 1} agrupado(s) · ${circuit.point_count || 1} ponto(s)`} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ExecutiveMetric({ icon: Icon, label, value, sub, tone = "default" }) {
  const toneClass = tone === "warning"
    ? "border-red-200 bg-red-50"
    : "border-[#BCEEE5] bg-[#F7FBFE]";

  return (
    <div className={`relative flex min-h-[110px] min-w-0 items-center gap-4 overflow-hidden rounded-[16px] border px-4 py-4 shadow-[0_14px_34px_rgba(0,100,166,0.055)] transition hover:-translate-y-0.5 hover:border-[#7DBDDF] hover:bg-white ${toneClass}`}>
      <span className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${tone === "warning" ? "bg-red-500" : "bg-[#00d8b8]"}`} />
      <span className="ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#00d8b8] ring-1 ring-[#D6E8F3]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#667085]">{label}</span>
        <span className="mt-1 block truncate text-[22px] font-extrabold leading-tight text-[#101828]">{value}</span>
        <span className="mt-1 block truncate text-[13px] font-bold text-[#667085]">{sub}</span>
      </span>
    </div>
  );
}

function PhaseReviewPanel({ metrics }) {
  const max = Math.max(metrics.phaseLoad.A, metrics.phaseLoad.B, metrics.phaseLoad.C, 1);

  return (
    <section className="rounded-[18px] border border-[#BCEEE5] bg-[#F7FBFE] p-4 shadow-[0_16px_40px_rgba(0,100,166,0.055)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[18px] font-extrabold text-[#0f1728]">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white text-[#00d8b8] ring-1 ring-[#D6E8F3]">
              <Activity className="h-4 w-4" />
            </span>
            Distribuição de fases
          </h3>
        </div>
        <span className={`rounded-[10px] px-3 py-2 text-xs font-extrabold ${metrics.imbalance_pct > 10 ? "bg-red-50 text-red-600 ring-1 ring-red-100" : "bg-white text-[#00d8b8] ring-1 ring-[#D6E8F3]"}`}>
          {metrics.imbalance_pct}% desequilíbrio
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {["A", "B", "C"].map((ph) => {
          const load = metrics.phaseLoad[ph] || 0;
          return (
            <div key={ph} className="rounded-[14px] border border-[#CDEFE8] bg-white p-4">
              <div className="flex justify-between text-xs font-extrabold">
                <span className={PHASE_COLORS[ph] || ""}>Fase {ph}</span>
                <span className="text-[#687386]">{load.toFixed(1)}A</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-md bg-[#EEF2F6]">
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${(load / max) * 100}%`, background: PHASE_BAR[ph] }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-[14px] border border-[#CDEFE8] bg-white px-4 py-3 text-sm font-bold text-[#687386]">
        Neutro estimado: <span className="text-[#0f1728]">{formatNumber(metrics.neutral_a, " A")}</span>
      </div>
    </section>
  );
}

function ValidationPanel({ validations }) {
  const errorCount = validations.filter((item) => item.severity === "error").length;
  const warningCount = validations.filter((item) => item.severity === "warning").length;

  return (
    <section className="rounded-[18px] border border-[#BCEEE5] bg-white p-4 shadow-[0_16px_40px_rgba(0,100,166,0.055)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[18px] font-extrabold text-[#0f1728]">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F2FFFC] text-[#00d8b8] ring-1 ring-[#D6E8F3]">
              <AlertTriangle className="h-4 w-4" />
            </span>
            Revisões NBR
          </h3>
        </div>
        <span className="rounded-[10px] bg-[#E8FCF8] px-3 py-2 text-xs font-extrabold text-[#00d8b8] ring-1 ring-[#D6E8F3]">
          {errorCount} erros · {warningCount} avisos
        </span>
      </div>

      {validations.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          Sem pendências críticas no cálculo atual.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {validations.map((v, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-[12px] border px-3 py-3 text-sm font-bold ${
                v.severity === "error"
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{v.msg}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CircuitEditor() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("project") || "");
  const [project, setProject] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { backend.entities.Project.list().then(setProjects); }, []);
  useEffect(() => {
    if (selectedId) backend.entities.Project.get(selectedId).then(p => { setProject(p); setMetrics(calcProjectMetrics(p)); });
  }, [selectedId]);

  const saveCircuits = async (circuits) => {
    setSaving(true);
    try {
      const balanced = autoBalancePhases(circuits);
      const updated = await backend.entities.Project.update(
        selectedId,
        buildProjectElectricalSyncPayload(project, balanced)
      );
      setProject(updated);
      setMetrics(calcProjectMetrics(updated));
    } finally {
      setSaving(false);
    }
  };

  const addCircuit = (calc) => saveCircuits([...(project?.circuits || []), calc]);
  const updateCircuit = (index, calc) => saveCircuits((project?.circuits || []).map((item, idx) => idx === index ? calc : item));
  const removeCircuit = (i) => saveCircuits((project?.circuits || []).filter((_, idx) => idx !== i));

  const circuits = metrics?.circuits || project?.circuits || [];
  const m = metrics;
  const criticalCount = circuits.filter((c) => !c.voltage_drop_ok).length;
  const drCount = circuits.filter((c) => c.needs_dr).length;

  return (
    <div className="mx-auto max-w-[1520px] space-y-5 pb-20">
      <PageHeader
        icon={Edit3}
        title="Editor de Circuitos"
        actions={selectedId && (
          <>
            <Button variant="outline" size="sm" asChild className="h-11 rounded-[12px] border-[#CDEFE8] bg-white px-4 font-extrabold shadow-[0_10px_24px_rgba(0,100,166,0.06)] hover:bg-[#F2FFFC]">
              <Link to={`/panel-generator?project=${selectedId}`}><Zap className="h-4 w-4" />Quadro SVG</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="h-11 rounded-[12px] border-[#CDEFE8] bg-white px-4 font-extrabold shadow-[0_10px_24px_rgba(0,100,166,0.06)] hover:bg-[#F2FFFC]">
              <Link to={`/planta-ia?project=${selectedId}`}><Layers className="h-4 w-4" />Montar Planta</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="h-11 rounded-[12px] border-[#CDEFE8] bg-white px-4 font-extrabold shadow-[0_10px_24px_rgba(0,100,166,0.06)] hover:bg-[#F2FFFC]">
              <Link to={`/unifilar?project=${selectedId}`}><Activity className="h-4 w-4" />Diagrama</Link>
            </Button>
          </>
        )}
      >
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-12 min-w-0 flex-1 rounded-[14px] border-[#BCEEE5] bg-white text-sm font-bold shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <SelectValue placeholder="Selecionar projeto..." />
          </SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </PageHeader>

      {!project ? (
        <div className="rounded-[18px] border border-dashed border-[#BCEEE5] bg-[#F2FFFC] px-6 py-12 text-center">
          <Edit3 className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="text-base font-extrabold text-[#0f1728]">Selecione um projeto</p>
        </div>
      ) : (
        <>
          {m && (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <ExecutiveMetric icon={Zap} label="Carga total" value={formatNumber(m.totalPower / 1000, " kW")} sub={`${formatNumber(m.generalCurrent, " A")} corrente geral`} />
                <ExecutiveMetric icon={ShieldCheck} label="Geral" value={`${m.generalBreakerPoles || 2}P ${m.generalBreaker}A`} sub={`IDR ${m.generalDrPoles || 2}P ${m.generalDr}A 30mA · ${project.supply_type || "Alimentação"}`} />
                <ExecutiveMetric icon={Layers} label="Quadro" value={`${m.panelSize} DIN`} sub={`${m.totalDins} módulos + reserva`} />
                <ExecutiveMetric icon={CircleGauge} label="DR / críticos" value={`${drCount} / ${criticalCount}`} sub="circuitos com atenção" tone={criticalCount ? "warning" : "default"} />
                <ExecutiveMetric
                  icon={m.nbrScore >= 90 ? CheckCircle2 : AlertTriangle}
                  label="Conformidade NBR"
                  value={`${m.nbrScore}%`}
                  sub={m.nbrScore >= 90 ? "Conforme" : "Revisar pendências"}
                  tone={m.nbrScore >= 90 ? "default" : "warning"}
                />
              </section>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <PhaseReviewPanel metrics={m} />
                <ValidationPanel validations={m.validations || []} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-3 rounded-[18px] border border-[#BCEEE5] bg-[#E8FCF8] px-4 py-4 shadow-[0_14px_34px_rgba(0,100,166,0.055)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#00d8b8]">Circuitos</p>
              <h2 className="mt-1 text-[24px] font-extrabold leading-tight text-[#101828]">
                {circuits.length} circuito{circuits.length === 1 ? "" : "s"} configurado{circuits.length === 1 ? "" : "s"}
              </h2>
            </div>
            <CircuitFormDialog
              onSave={addCircuit}
              trigger={<Button size="sm" disabled={saving} className="h-11 rounded-[12px] px-5 font-extrabold"><Plus className="w-4 h-4 mr-2" />Novo circuito</Button>}
            />
          </div>

          {circuits.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[#BCEEE5] bg-[#F7FBFE] px-6 py-12 text-center shadow-[0_14px_34px_rgba(0,100,166,0.04)]">
              <Edit3 className="mx-auto mb-3 h-10 w-10 text-[#00d8b8]" />
              <p className="text-base font-extrabold text-[#0f1728]">Nenhum circuito cadastrado</p>
              <p className="mt-1 text-sm font-medium text-[#667085]">Adicione circuitos para calcular proteção, fases e conformidade NBR.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {circuits.map((c, i) => (
                <CircuitCard
                  key={`${c.name}-${i}`}
                  circuit={c}
                  index={i}
                  saving={saving}
                  onEdit={(calc) => updateCircuit(i, calc)}
                  onRemove={() => removeCircuit(i)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
