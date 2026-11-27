import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  ShieldCheck,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { dimensionCircuitNBR5410 } from "@/lib/electricalEngine";
import { computeProjectMetricsSafe } from "@/lib/projectAnalytics";
import {
  DEFAULT_SIZING_PREMISES,
  computeInstantResults,
  sizeFromDesiredPower,
} from "@/lib/solarSizing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NacifAIAssistantDialog from "@/components/nacif/NacifAIAssistantDialog";
import ProjectHealthCard from "@/components/nacif/ProjectHealthCard";

const formatDecimalBR = (val, digits = 1) =>
  Number(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const formatCurrencyBR = (val) =>
  `R$ ${Number(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function Simulations() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiDialogMode, setAiDialogMode] = useState("loads");

  // Simulador Elétrico NBR 5410
  const [simPowerW, setSimPowerW] = useState(5500);
  const [simVoltage, setSimVoltage] = useState(220);
  const [simLengthM, setSimLengthM] = useState(28);
  const [simPf, setSimPf] = useState(0.95);
  const [simSupplyType, setSimSupplyType] = useState("Bifásico");

  // Simulador Solar NBR 16690
  const [monthlyKwh, setMonthlyKwh] = useState(650);
  const [tariffBrl, setTariffBrl] = useState(0.92);
  const [hsp, setHsp] = useState(DEFAULT_SIZING_PREMISES.dailyIrradiationHspKwhM2);

  useEffect(() => {
    let active = true;
    backend.entities.Project.list("-updated_date", 50)
      .then((list) => {
        if (!active) return;
        const rows = Array.isArray(list) ? list : [];
        setProjects(rows);
        if (rows.length > 0) {
          const savedId = window.localStorage.getItem("voltai_active_project_id");
          const initial = rows.find((p) => p.id === savedId) || rows[0];
          setSelectedProjectId(initial.id);
        }
      })
      .catch(() => {
        if (active) setProjects([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const selectedMetrics = useMemo(
    () => (selectedProject ? computeProjectMetricsSafe(selectedProject) : null),
    [selectedProject]
  );

  const handleSelectProject = (nextId) => {
    setSelectedProjectId(nextId);
    try {
      if (nextId) window.localStorage.setItem("voltai_active_project_id", nextId);
    } catch {}
  };

  const electricalSimulation = useMemo(() => {
    const dim = dimensionCircuitNBR5410({
      name: "Circuito Simulado",
      type: "Tomada de Uso Específico (TUE)",
      power: Number(simPowerW) || 0,
      power_unit: "W",
      voltage: Number(simVoltage) || 220,
      supply_type: simSupplyType,
      power_factor: Number(simPf) || 0.92,
      length_m: Number(simLengthM) || 1,
    });
    return { dim, vd: dim.voltage_drop };
  }, [simPowerW, simVoltage, simLengthM, simPf, simSupplyType]);

  const solarSimulation = useMemo(() => {
    const kwh = Math.max(0, Number(monthlyKwh) || 0);
    const hspVal = Math.max(1, Number(hsp) || DEFAULT_SIZING_PREMISES.dailyIrradiationHspKwhM2);
    const targetKwp = kwh > 0 ? kwh / 30 / (hspVal * DEFAULT_SIZING_PREMISES.performanceRatio) : 0;
    const sized = sizeFromDesiredPower(targetKwp, 550);
    const results = computeInstantResults({
      panelCount: sized.panelCount,
      moduleWp: 550,
      monthlyConsumptionKwh: kwh,
      tariffBrlPerKwh: Number(tariffBrl) || 0.9,
      premises: {
        ...DEFAULT_SIZING_PREMISES,
        dailyIrradiationHspKwhM2: hspVal,
      },
    });
    return { sized, results };
  }, [monthlyKwh, tariffBrl, hsp]);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 pb-12">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#101828] leading-tight">
            Simulações e Cenários
          </h1>
          <p className="mt-0.5 text-xs font-medium text-[#64748B]">
            Dimensionamento rápido NBR 5410, projeção solar NBR 16690 e diagnóstico técnico assistido.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedProject && (
            <select
              value={selectedProjectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              aria-label="Selecionar projeto de referência"
              className="h-9 rounded-xl border border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] shadow-2xs focus:border-[#00D98A] focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            onClick={() => {
              setAiDialogMode("loads");
              setAiDialogOpen(true);
            }}
            className="h-9 rounded-xl bg-[#5B4AE8] px-3.5 text-xs font-bold text-white shadow-2xs hover:bg-[#4b3bd4]"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Assistente Nacif IA
          </Button>
        </div>
      </header>

      {selectedProject && (
        <ProjectHealthCard project={selectedProject} />
      )}

      <Tabs defaultValue="electrical" className="space-y-4">
        <TabsList className="h-10 rounded-xl border border-[#E5EBF1] bg-white p-1">
          <TabsTrigger value="electrical" className="gap-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#DDFCF0] data-[state=active]:text-[#006F51]">
            <Zap className="h-3.5 w-3.5 text-[#006F51]" />
            Cenário Elétrico (NBR 5410)
          </TabsTrigger>
          <TabsTrigger value="solar" className="gap-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#DDFCF0] data-[state=active]:text-[#006F51]">
            <Sun className="h-3.5 w-3.5 text-[#006F51]" />
            Cenário Solar (NBR 16690)
          </TabsTrigger>
          <TabsTrigger value="project" className="gap-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#DDFCF0] data-[state=active]:text-[#006F51]">
            <FolderOpen className="h-3.5 w-3.5 text-[#006F51]" />
            Resumo do Projeto Ativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="electrical" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] lg:col-span-5">
            <div>
              <h2 className="text-sm font-extrabold text-[#101828]">Parâmetros do Circuito</h2>
              <p className="text-xs text-[#64748B]">Altere os valores para simular corrente, seção e proteção.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Potência Ativa (W)</Label>
                <Input type="number" min={100} value={simPowerW} onChange={(e) => setSimPowerW(e.target.value)} className="h-9 rounded-xl text-xs font-semibold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Tensão Nominal (V)</Label>
                <Input type="number" min={110} value={simVoltage} onChange={(e) => setSimVoltage(e.target.value)} className="h-9 rounded-xl text-xs font-semibold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Comprimento (m)</Label>
                <Input type="number" min={1} value={simLengthM} onChange={(e) => setSimLengthM(e.target.value)} className="h-9 rounded-xl text-xs font-semibold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Fator de Potência</Label>
                <Input type="number" step="0.01" min={0.5} max={1} value={simPf} onChange={(e) => setSimPf(e.target.value)} className="h-9 rounded-xl text-xs font-semibold" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#101828]">Sistema de Fornecimento</Label>
              <select
                value={simSupplyType}
                onChange={(e) => setSimSupplyType(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] cursor-pointer"
              >
                <option value="Monofásico">Monofásico</option>
                <option value="Bifásico">Bifásico</option>
                <option value="Trifásico">Trifásico</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] lg:col-span-7">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-[#101828]">Dimensionamento NBR 5410</h2>
                  <p className="text-xs text-[#64748B]">
                    Coordenação: {electricalSimulation.dim.breaker?.coordinationRule || "Ib ≤ In ≤ Iz"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    electricalSimulation.vd?.ok !== false
                      ? "bg-[#DDFCF0] text-[#006F51]"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {electricalSimulation.vd?.ok !== false ? "Conforme NBR 5410" : "Revisar queda ΔU"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Corrente Nominal</span>
                  <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                    {formatDecimalBR(electricalSimulation.dim.nominal_current_a, 1)} A
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Condutor Sugerido</span>
                  <p className="mt-1 text-lg font-extrabold text-[#006F51] tabular-nums">
                    {formatDecimalBR(electricalSimulation.dim.wire?.area || 2.5, 1)} mm²
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Disjuntor DIN</span>
                  <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                    {electricalSimulation.dim.breaker?.current || 16} A{" "}
                    <span className="text-xs font-bold text-[#64748B]">
                      ({electricalSimulation.dim.breaker?.poles || 1}P/{electricalSimulation.dim.breaker?.curve || "C"})
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Queda de Tensão</span>
                  <p
                    className={`mt-1 text-lg font-extrabold tabular-nums ${
                      electricalSimulation.vd?.ok !== false ? "text-[#101828]" : "text-[#EF4444]"
                    }`}
                  >
                    {formatDecimalBR(electricalSimulation.vd?.drop_pct || 0, 2)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-4 py-3 text-xs">
              <span className="font-medium text-[#64748B]">
                Eletroduto mínimo recomendado:{" "}
                <strong className="text-[#101828]">
                  Ø {electricalSimulation.dim.conduit?.conduit_mm || 20} mm ({electricalSimulation.dim.conduit?.conduit_inch || '3/4"'})
                </strong>
              </span>
              <Button asChild size="sm" className="h-8 rounded-xl bg-[#00D98A] px-3.5 text-xs font-bold text-[#031923] hover:bg-[#00C47C]">
                <Link to={selectedProject ? `/circuit-editor?project=${selectedProject.id}` : "/projects/new"}>
                  Abrir Editor de Circuitos <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="solar" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] lg:col-span-5">
            <div>
              <h2 className="text-sm font-extrabold text-[#101828]">Premissas Fotovoltaicas</h2>
              <p className="text-xs text-[#64748B]">Estimativa preliminar com Performance Ratio de 80%.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Consumo Médio Mensal (kWh/mês)</Label>
                <Input type="number" min={50} value={monthlyKwh} onChange={(e) => setMonthlyKwh(e.target.value)} className="h-9 rounded-xl text-xs font-semibold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Tarifa de Energia (R$/kWh)</Label>
                <Input type="number" step="0.01" min={0.2} value={tariffBrl} onChange={(e) => setTariffBrl(e.target.value)} className="h-9 rounded-xl text-xs font-semibold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Irradiação Diária (HSP kWh/m²·dia)</Label>
                <Input type="number" step="0.1" min={2} max={7.5} value={hsp} onChange={(e) => setHsp(e.target.value)} className="h-9 rounded-xl text-xs font-semibold" />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] lg:col-span-7">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-[#101828]">Projeção Fotovoltaica Preliminar</h2>
                  <p className="text-xs text-[#64748B]">
                    Área útil estimada: {formatDecimalBR(solarSimulation.sized?.areaM2 || 0, 1)} m²
                  </p>
                </div>
                <span className="rounded-full bg-[#DDFCF0] px-2.5 py-1 text-[11px] font-bold text-[#006F51]">
                  Módulos 550 Wp
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Potência Ideal</span>
                  <p className="mt-1 text-lg font-extrabold text-[#006F51] tabular-nums">
                    {formatDecimalBR(solarSimulation.results.installedKwp || 0, 2)} kWp
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Módulos FV</span>
                  <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                    {solarSimulation.results.panelCount} un
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Geração Anual</span>
                  <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                    {solarSimulation.results.annualGenerationKwh
                      ? `${Math.round(solarSimulation.results.annualGenerationKwh).toLocaleString("pt-BR")} kWh`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Payback Simples</span>
                  <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                    {solarSimulation.results.paybackYears
                      ? `${formatDecimalBR(solarSimulation.results.paybackYears, 1)} anos`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-4 py-3 text-xs">
              <span className="font-medium text-[#64748B]">
                Economia anual estimada:{" "}
                <strong className="text-[#006F51]">
                  {solarSimulation.results.annualSavingsBrl
                    ? formatCurrencyBR(solarSimulation.results.annualSavingsBrl)
                    : "—"}
                </strong>
              </span>
              <Button asChild size="sm" className="h-8 rounded-xl bg-[#00D98A] px-3.5 text-xs font-bold text-[#031923] hover:bg-[#00C47C]">
                <Link to={selectedProject ? `/solar-project?project=${selectedProject.id}` : "/solar-project"}>
                  Ir para Projeto Solar <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="project">
          {selectedProject && selectedMetrics ? (
            <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[#101828]">{selectedProject.name}</h2>
                  <p className="text-xs font-medium text-[#64748B]">
                    {selectedMetrics.installationTypeLabel} · {selectedMetrics.supplyLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setAiDialogMode("nbr5410");
                      setAiDialogOpen(true);
                    }}
                    className="h-8 rounded-xl bg-[#5B4AE8] px-3 text-xs font-bold text-white hover:bg-[#4b3bd4]"
                  >
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    Auditoria NBR 5410
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8 rounded-xl border-[#E5EBF1] px-3 text-xs font-bold">
                    <Link to={`/projects/${selectedProject.id}`}>Abrir projeto</Link>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    {selectedMetrics.isSolar && selectedMetrics.solarKwp > 0 ? "Potência FV" : "Demanda Estimada"}
                  </span>
                  <p className="mt-1 text-base font-extrabold text-[#101828] tabular-nums">
                    {selectedMetrics.isSolar && selectedMetrics.solarKwp > 0
                      ? `${formatDecimalBR(selectedMetrics.solarKwp, 1)} kWp`
                      : `${formatDecimalBR(selectedMetrics.demandKw, 1)} kW`}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    {selectedMetrics.isSolar && selectedMetrics.solarPanelsCount > 0 && selectedMetrics.circuitsCount === 0
                      ? "Módulos FV"
                      : "Circuitos"}
                  </span>
                  <p className="mt-1 text-base font-extrabold text-[#101828] tabular-nums">
                    {selectedMetrics.isSolar && selectedMetrics.solarPanelsCount > 0 && selectedMetrics.circuitsCount === 0
                      ? `${selectedMetrics.solarPanelsCount} un`
                      : selectedMetrics.circuitsCount}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Potência Aparente</span>
                  <p className="mt-1 text-base font-extrabold text-[#101828] tabular-nums">
                    {formatDecimalBR(selectedMetrics.demandKva, 1)} kVA
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Orçamento Estimado</span>
                  <p className="mt-1 text-base font-extrabold text-[#006F51] tabular-nums">
                    {selectedMetrics.budgetHasRealSource ? formatCurrencyBR(selectedMetrics.budgetTotal) : "Não calculado"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E5EBF1] bg-white p-8 text-center text-xs text-[#64748B]">
              Nenhum projeto disponível para análise contextual.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NacifAIAssistantDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        mode={aiDialogMode}
        project={selectedProject}
      />
    </div>
  );
}
