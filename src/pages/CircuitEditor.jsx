import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import {
  autoBalancePhases,
  buildProjectElectricalSyncPayload,
  calcProjectMetrics,
} from "@/lib/electricalEngine";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleGauge,
  Edit3,
  Layers,
  ShieldCheck,
  Zap,
} from "lucide-react";
import InternalPageHeader from "@/components/internal/InternalPageHeader";
import ProjectContextBar from "@/components/internal/ProjectContextBar";
import TechnicalStatCard from "@/components/internal/TechnicalStatCard";
import PhaseDistributionCard from "@/components/internal/PhaseDistributionCard";
import TechnicalReviewCard from "@/components/internal/TechnicalReviewCard";
import CircuitList from "@/components/internal/CircuitList";

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

function formatNumber(value, suffix = "") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `0${suffix}`;
  return `${numberFormatter.format(numeric)}${suffix}`;
}

const NBR_TARGET_IMBALANCE_PCT = 5;

function phaseExtremes(metrics) {
  const loads = ["A", "B", "C"].map((phase) => ({
    phase,
    load: Number(metrics?.phaseLoad?.[phase]) || 0,
  }));
  return {
    highest: [...loads].sort((a, b) => b.load - a.load)[0],
    lowest: [...loads].sort((a, b) => a.load - b.load)[0],
  };
}

const DEDICATED_LOAD_HINT = /chuveiro|ar cond|bomba|motor|aquecedor|forno|cooktop|torneira|secadora|m[aá]quina|boiler/i;

function blockerRemedy(blocker) {
  if (!blocker) return "";
  if (DEDICATED_LOAD_HINT.test(String(blocker.type || blocker.name || ""))) {
    return `converta o circuito "${blocker.name}" para 220 V (bifásico) — assim a carga passa a ocupar duas fases ao mesmo tempo`;
  }
  return `divida os pontos do circuito "${blocker.name}" em dois ou mais circuitos e distribua-os em fases diferentes`;
}

function buildNBRActionPlan(metrics, validations = []) {
  const actions = [];
  const added = new Set();
  const addAction = (key, title, description, tone = "warning") => {
    if (added.has(key)) return;
    added.add(key);
    actions.push({ key, title, description, tone });
  };

  if ((Number(metrics?.imbalance_pct) || 0) > NBR_TARGET_IMBALANCE_PCT) {
    const { highest, lowest } = phaseExtremes(metrics);
    const blocker = metrics?.imbalanceBlocker;
    const tone = metrics.imbalance_pct > 10 ? "danger" : "warning";
    if (blocker) {
      addAction(
        "phase_imbalance",
        "Reduzir o desequilíbrio de fases",
        `O balanceamento automático já distribuiu os circuitos da melhor forma possível, mas a fase ${highest.phase} (${formatNumber(highest.load, " A")}) segue ${metrics.imbalance_pct}% acima da fase ${lowest.phase} (${formatNumber(lowest.load, " A")}). O peso está na carga monofásica "${blocker.name}" (${formatNumber(blocker.current_a, " A")}). Para zerar: ${blockerRemedy(blocker)}.`,
        tone
      );
    } else {
      const transfer = Math.max(0, (highest.load - lowest.load) / 2);
      addAction(
        "phase_imbalance",
        "Balancear as fases",
        `A fase ${highest.phase} está com ${formatNumber(highest.load, " A")} e a fase ${lowest.phase} com ${formatNumber(lowest.load, " A")}. Utilize "Ajustar projeto" para redistribuir cerca de ${formatNumber(transfer, " A")} de carga para a fase ${lowest.phase}.`,
        tone
      );
    }
  }

  validations.forEach((validation) => {
    if (validation.code === "phase_imbalance") return;
    if (validation.code === "voltage_drop") {
      addAction(
        `voltage_drop-${validation.circuit_id || validation.msg}`,
        "Corrigir queda de tensão",
        `${validation.msg}. ${validation.action || "Aumente a seção do condutor, reduza o comprimento ou divida o circuito."}`,
        "danger"
      );
      return;
    }
    if (validation.code === "dr_required") {
      addAction(
        `dr-${validation.circuit_id || validation.msg}`,
        "Prever DR 30 mA",
        `${validation.msg}. ${validation.action || "Adicione proteção DR de 30 mA ao circuito indicado."}`
      );
      return;
    }
    if (validation.code === "dps_required") {
      addAction("dps_required", "Prever DPS no quadro", validation.action || validation.msg);
      return;
    }
    addAction(
      validation.msg,
      "Revisar item NBR",
      validation.action || validation.msg,
      validation.severity === "error" ? "danger" : "warning"
    );
  });

  return actions;
}

export default function CircuitEditor() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(
    () =>
      searchParams.get("project") ||
      (typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : "") ||
      ""
  );
  const [project, setProject] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [autoFixFeedback, setAutoFixFeedback] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    const urlProjectId = searchParams.get("project");
    if (urlProjectId && urlProjectId !== selectedId) {
      setSelectedId(urlProjectId);
      try {
        window.localStorage.setItem("voltai_active_project_id", urlProjectId);
      } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    backend.entities.Project.list("-updated_date", 100).then((list) => {
      if (cancelled) return;
      const safeList = Array.isArray(list) ? list : [];
      setProjects(safeList);
      const currentUrlId = searchParams.get("project");
      if (!currentUrlId && !selectedId && safeList.length > 0) {
        const storedId =
          typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : null;
        const target = safeList.find((p) => p.id === storedId) || safeList[0];
        if (target?.id) {
          setSelectedId(target.id);
          try {
            window.localStorage.setItem("voltai_active_project_id", target.id);
          } catch {}
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectProject = (newId) => {
    setSelectedId(newId || "");
    setSaveState("idle");
    setSaveError("");
    setHighlightedIndex(null);
    if (newId) {
      try {
        window.localStorage.setItem("voltai_active_project_id", newId);
      } catch {}
    }
  };

  useEffect(() => {
    if (selectedId) {
      backend.entities.Project.get(selectedId)
        .then((p) => {
          setProject(p);
          setMetrics(calcProjectMetrics(p));
          setAutoFixFeedback(null);
        })
        .catch((err) => {
          console.error("Erro ao carregar projeto:", err);
        });
    } else {
      setProject(null);
      setMetrics(null);
    }
  }, [selectedId]);

  const saveCircuits = async (circuits) => {
    setSaving(true);
    setSaveState("saving");
    setSaveError("");
    setAutoFixFeedback(null);
    try {
      const balanced = autoBalancePhases(circuits);
      const updated = await backend.entities.Project.update(
        selectedId,
        buildProjectElectricalSyncPayload(project, balanced)
      );
      setProject(updated);
      setMetrics(calcProjectMetrics(updated));
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err?.message || "Erro ao salvar alterações.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const autoFixNBR = async () => {
    if (!project || !selectedId) return;
    setSaving(true);
    setSaveState("saving");
    setSaveError("");
    try {
      const storedCircuits = project.circuits || [];
      const before = metrics || calcProjectMetrics(project);
      const balanced = autoBalancePhases(storedCircuits);

      const moved = balanced
        .map((circuit, index) => ({
          index,
          from: storedCircuits[index]?.phase,
          to: circuit.phase,
          name: circuit.name,
        }))
        .filter((change) => change.from && change.to && change.from !== change.to);

      const updated = await backend.entities.Project.update(
        selectedId,
        buildProjectElectricalSyncPayload(project, balanced)
      );
      const after = calcProjectMetrics(updated);
      setProject(updated);
      setMetrics(after);
      setSaveState("saved");

      const parts = [];
      if (moved.length) {
        const list = moved
          .map((change) => `${change.name || `Circuito ${change.index + 1}`} → fase ${change.to}`)
          .join(", ");
        parts.push(`Circuitos rebalanceados: ${list}.`);
      }
      const beforeImbalance = Number.isFinite(before?.storedImbalance_pct)
        ? before.storedImbalance_pct
        : after.imbalance_pct;
      if (beforeImbalance > after.imbalance_pct) {
        parts.push(`Desequilíbrio de fases: ${beforeImbalance}% → ${after.imbalance_pct}%.`);
      }
      parts.push("Quadro e diagrama sincronizados com o balanceamento.");

      let tone = "ok";
      if (after.validations.length === 0) {
        parts.push("Verificações preliminares atendidas.");
      } else {
        tone = "warning";
        const blocker = after.imbalanceBlocker;
        if (after.imbalance_pct > 5 && blocker) {
          parts.push(
            `O desequilíbrio restante de ${after.imbalance_pct}% vem da carga monofásica "${blocker.name}" (${formatNumber(blocker.current_a, " A")}). Para reduzir: ${blockerRemedy(blocker)}.`
          );
        } else {
          parts.push(
            `Verificação automatizada em ${after.nbrScore}%. Revise os itens pendentes manualmente.`
          );
        }
      }
      setAutoFixFeedback({ tone, message: parts.join(" ") });
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setSaveError("Falha ao aplicar ajuste automático.");
      setAutoFixFeedback({
        tone: "danger",
        message: "Não foi possível aplicar o ajuste automático. Tente novamente ou revise os circuitos manualmente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const addCircuit = (calc) => saveCircuits([...(project?.circuits || []), calc]);
  const updateCircuit = (index, calc) =>
    saveCircuits((project?.circuits || []).map((item, idx) => (idx === index ? calc : item)));

  const confirmRemoveCircuit = async () => {
    if (!pendingDelete) return;
    const { index } = pendingDelete;
    setPendingDelete(null);
    await saveCircuits((project?.circuits || []).filter((_, idx) => idx !== index));
  };

  const circuits = metrics?.circuits || project?.circuits || [];
  const m = metrics;
  const criticalCount = circuits.filter((c) => !c.voltage_drop_ok).length;
  const drCount = circuits.filter((c) => c.needs_dr).length;
  const actionPlan = m ? buildNBRActionPlan(m, m.validations || []) : [];

  const handleLocateCircuit = (validation) => {
    let targetIdx = typeof validation.circuit_index === "number" ? validation.circuit_index : -1;
    if (targetIdx < 0 && validation.circuit_id) {
      targetIdx = circuits.findIndex((c) => c.id === validation.circuit_id);
    }
    if (targetIdx < 0 && validation.circuit_name) {
      targetIdx = circuits.findIndex((c) => c.name === validation.circuit_name);
    }
    if (targetIdx < 0 && validation.msg) {
      targetIdx = circuits.findIndex((c) => c.name && validation.msg.includes(c.name));
    }
    if (targetIdx >= 0) {
      setHighlightedIndex(targetIdx);
      const el = document.getElementById(`circuit-card-${targetIdx}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 pb-16">
      <InternalPageHeader
        icon={Edit3}
        title="Editor de Circuitos"
        subtitle="Configure, dimensione e acompanhe os circuitos elétricos do seu projeto."
        actions={
          selectedId && (
            <>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
              >
                <Link to={`/panel-generator?project=${selectedId}`}>
                  <Zap className="mr-1.5 h-3.5 w-3.5 text-[#006B50]" />
                  Quadro SVG
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
              >
                <Link to={`/planta-ia?project=${selectedId}`}>
                  <Layers className="mr-1.5 h-3.5 w-3.5 text-[#006B50]" />
                  Montar Planta
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
              >
                <Link to={`/unifilar?project=${selectedId}`}>
                  <Activity className="mr-1.5 h-3.5 w-3.5 text-[#006B50]" />
                  Diagrama
                </Link>
              </Button>
            </>
          )
        }
      />

      {!project ? (
        <div className="rounded-2xl border border-[#E5EBF1] bg-white p-6 text-center shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div className="mx-auto max-w-md space-y-3">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
              <Edit3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-[#101828]">Selecione um projeto para editar</p>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                Escolha o projeto ativo no workspace para visualizar cargas, fases e circuitos.
              </p>
            </div>
            {projects.length > 0 && (
              <Select value={selectedId} onValueChange={handleSelectProject}>
                <SelectTrigger className="h-10 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs font-bold">
                  <SelectValue placeholder="Selecionar projeto..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      ) : (
        <>
          <ProjectContextBar
            project={project}
            projects={projects}
            onSelectProject={handleSelectProject}
            activeTool="circuits"
            saveState={saveState}
            saveError={saveError}
          />

          {m && (
            <>
              {/* 5 Indicadores Compactos */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <TechnicalStatCard
                  icon={Zap}
                  label="Carga e demanda"
                  value={
                    circuits.length === 0
                      ? "0,00 kW"
                      : formatNumber((m.totalDemandPower ?? m.totalPower) / 1000, " kW")
                  }
                  subtext={
                    circuits.length === 0
                      ? "Sem cargas cadastradas"
                      : `${formatNumber(m.totalPower / 1000, " kW")} instalada · ${formatNumber(m.generalCurrent, " A")}`
                  }
                />

                <TechnicalStatCard
                  icon={ShieldCheck}
                  label="Proteção geral"
                  value={
                    circuits.length === 0 || !m.generalBreaker
                      ? "Pendente"
                      : `${m.generalBreakerPoles || 2}P ${m.generalBreaker}A`
                  }
                  subtext={
                    circuits.length === 0
                      ? "Adicione circuitos"
                      : m.mainProtection?.breaker?.statusMessage ||
                        (m.generalDr
                          ? `IDR ${m.generalDrPoles || 2}P ${m.generalDr}A 30mA · ${project.supply_type || "Padrão"}`
                          : `Padrão ${project.supply_type || "Mono/Bifásico"}`)
                  }
                  tone={m.mainProtection?.breaker?.isOverloaded ? "danger" : "default"}
                />

                <TechnicalStatCard
                  icon={Layers}
                  label="Quadro elétrico"
                  value={`${m.panelSize} DIN`}
                  subtext={
                    circuits.length === 0
                      ? "Padrão inicial 12 DIN"
                      : `${m.totalDins} módulo(s) + reserva`
                  }
                />

                <TechnicalStatCard
                  icon={CircleGauge}
                  label="DR e críticos"
                  value={`${drCount} / ${criticalCount}`}
                  subtext={
                    criticalCount > 0
                      ? `${criticalCount} circuito(s) com atenção`
                      : drCount > 0
                      ? `${drCount} com DR 30mA · 0 críticos`
                      : "Nenhum circuito com DR ou crítico"
                  }
                  tone={criticalCount > 0 ? "warning" : "default"}
                />

                <TechnicalStatCard
                  icon={
                    circuits.length === 0
                      ? CircleGauge
                      : (m.validations || []).length === 0
                      ? CheckCircle2
                      : AlertTriangle
                  }
                  label="Verificações técnicas"
                  value={circuits.length === 0 ? "Sem cargas" : `${m.nbrScore}%`}
                  subtext={
                    circuits.length === 0
                      ? "Aguardando circuitos"
                      : (m.validations || []).length === 0
                      ? "Preliminar NBR 5410 OK"
                      : `${m.validations.length} apontamento(s) preliminar(es)`
                  }
                  tone={
                    circuits.length === 0
                      ? "default"
                      : (m.validations || []).length === 0
                      ? "default"
                      : "warning"
                  }
                />
              </section>

              {/* Distribuição de Fases + Revisões NBR */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
                <PhaseDistributionCard metrics={m} hasCircuits={circuits.length > 0} />
                <TechnicalReviewCard
                  hasCircuits={circuits.length > 0}
                  validations={m.validations || []}
                  actionPlan={actionPlan}
                  onAutoFix={autoFixNBR}
                  saving={saving}
                  canAutoFix={(m.validations || []).length > 0}
                  feedback={autoFixFeedback}
                  onLocateCircuit={handleLocateCircuit}
                />
              </div>
            </>
          )}

          {/* Lista Operacional de Circuitos */}
          <CircuitList
            circuits={circuits}
            saving={saving}
            onAddCircuit={addCircuit}
            onEditCircuit={updateCircuit}
            onRemoveCircuit={(index, circuit) => setPendingDelete({ index, circuit })}
            highlightedIndex={highlightedIndex}
          />
        </>
      )}

      {/* Confirmação Segura de Exclusão */}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl border-[#E5EBF1] bg-white p-6 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold text-[#101828]">
              Excluir circuito "{pendingDelete?.circuit?.name || "selecionado"}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-medium leading-relaxed text-[#64748B]">
              Os cálculos de demanda, distribuição de fases e quadro elétrico do projeto serão recalculados automaticamente sem este circuito.
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
