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
import { calcVoltageDrop, dimensionCircuitNBR5410 } from "@/lib/electricalEngine";
import { computeProjectMetricsSafe } from "@/lib/projectAnalytics";
import {
  DEFAULT_SIZING_PREMISES,
  computeInstantResults,
  sizeFromDesiredPower,
} from "@/lib/solarSizing";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NacifAIAssistantDialog from "@/components/nacif/NacifAIAssistantDialog";
import ProjectHealthCard from "@/components/nacif/ProjectHealthCard";

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

  const electricalSimulation = useMemo(() => {
    const dim = dimensionCircuitNBR5410({
      name: "Circuito Simulado",
      type: "Tomada de Uso Específico (TUE)",
      power_w: Number(simPowerW) || 0,
      voltage: Number(simVoltage) || 220,
      supply_type: simSupplyType,
      power_factor: Number(simPf) || 0.92,
      cable_length_m: Number(simLengthM) || 1,
    });
    const vd = calcVoltageDrop(
      Number(simPowerW) || 0,
      Number(simVoltage) || 220,
      Number(simLengthM) || 1,
      dim.wire_area || 2.5,
      simSupplyType,
      Number(simPf) || 0.92
    );
    return { dim, vd };
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
    <div className="mx-auto w-full max-w-[1360px] space-y-6 pb-10">
      <PageHeader
        icon={Sparkles}
        badge="SIMULAÇÕES & NACIF IA"
        title="Simulações Técnicas e Cenários"
        subtitle="Compare cenários de dimensionamento NBR 5410, sistemas solares NBR 16690 e análises assistidas para seus projetos."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedProject && (
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                aria-label="Selecionar projeto de referência"
                className="h-10 rounded-xl border border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] focus:border-[#00D98A] focus:outline-none"
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
              className="h-10 rounded-xl bg-[#5B4AE8] px-4 text-xs font-bold text-white hover:bg-[#4b3bd4]"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Abrir Assistente Nacif IA
            </Button>
          </div>
        }
      />

      {selectedProject && (
        <ProjectHealthCard project={selectedProject} />
      )}

      <Tabs defaultValue="electrical" className="space-y-5">
        <TabsList>
          <TabsTrigger value="electrical" className="gap-1.5">
            <Zap className="h-3.5 w-3.5 text-[#006F51]" />
            Cenário Elétrico (NBR 5410)
          </TabsTrigger>
          <TabsTrigger value="solar" className="gap-1.5">
            <Sun className="h-3.5 w-3.5 text-[#006F51]" />
            Cenário Solar (NBR 16690)
          </TabsTrigger>
          <TabsTrigger value="project" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 text-[#5B4AE8]" />
            Resumo do Projeto Ativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="electrical" className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 lg:col-span-5">
            <div>
              <h2 className="text-sm font-extrabold text-[#101828]">Parâmetros do Circuito Simulado</h2>
              <p className="text-xs text-[#64748B]">Calculado pelo motor determinístico NBR 5410 da plataforma.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Potência Ativa (W)</Label>
                <Input type="number" min={100} value={simPowerW} onChange={(e) => setSimPowerW(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Tensão Nominal (V)</Label>
                <Input type="number" min={110} value={simVoltage} onChange={(e) => setSimVoltage(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Comprimento (m)</Label>
                <Input type="number" min={1} value={simLengthM} onChange={(e) => setSimLengthM(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Fator de Potência</Label>
                <Input type="number" step="0.01" min={0.5} max={1} value={simPf} onChange={(e) => setSimPf(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#101828]">Sistema de Fornecimento</Label>
              <select
                value={simSupplyType}
                onChange={(e) => setSimSupplyType(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828]"
              >
                <option value="Monofásico">Monofásico</option>
                <option value="Bifásico">Bifásico</option>
                <option value="Trifásico">Trifásico</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#101828]">Resultado Técnico NBR 5410</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#DDFCF0] px-2.5 py-1 text-[11px] font-bold text-[#006F51]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cálculo determinístico
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Corrente Nominal</span>
                <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                  {Number(electricalSimulation.dim.nominal_current || 0).toFixed(1)} A
                </p>
              </div>
              <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Condutor Sugerido</span>
                <p className="mt-1 text-lg font-extrabold text-[#006F51] tabular-nums">
                  {electricalSimulation.dim.wire_area || 2.5} mm²
                </p>
              </div>
              <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Disjuntor</span>
                <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                  {electricalSimulation.dim.breaker_a || 16} A
                </p>
              </div>
              <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Queda de Tensão</span>
                <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                  {Number(electricalSimulation.vd?.voltage_drop_pct || electricalSimulation.dim.voltage_drop_pct || 0).toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3.5 text-xs">
              <span className="text-[#64748B]">
                Quer levar essa parametrização para um projeto real?
              </span>
              <Button asChild size="sm" className="rounded-xl bg-[#00D98A] text-[#031923] font-bold hover:bg-[#00C47C]">
                <Link to={selectedProject ? `/circuit-editor?project=${selectedProject.id}` : "/projects/new"}>
                  Abrir Editor de Circuitos <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="solar" className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 lg:col-span-5">
            <div>
              <h2 className="text-sm font-extrabold text-[#101828]">Premissas Fotovoltaicas</h2>
              <p className="text-xs text-[#64748B]">Estimativa preliminar com premissas editáveis (PR = 80%).</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Consumo Médio Mensal (kWh/mês)</Label>
                <Input type="number" min={50} value={monthlyKwh} onChange={(e) => setMonthlyKwh(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Tarifa Média (R$/kWh)</Label>
                <Input type="number" step="0.01" min={0.2} value={tariffBrl} onChange={(e) => setTariffBrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Irradiação Média Diária (HSP kWh/m²·dia)</Label>
                <Input type="number" step="0.1" min={2} max={7.5} value={hsp} onChange={(e) => setHsp(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[#101828]">Projeção Fotovoltaica Preliminar</h2>
              <span className="rounded-full bg-[#DDFCF0] px-2.5 py-1 text-[11px] font-bold text-[#006F51]">
                Módulos 550 Wp
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Potência Ideal</span>
                <p className="mt-1 text-lg font-extrabold text-[#006F51] tabular-nums">
                  {Number(solarSimulation.results.installedKwp || 0).toFixed(2)} kWp
                </p>
              </div>
              <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Módulos</span>
                <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                  {solarSimulation.results.panelCount} un
                </p>
              </div>
              <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Geração Anual</span>
                <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                  {solarSimulation.results.annualGenerationKwh
                    ? `${Math.round(solarSimulation.results.annualGenerationKwh).toLocaleString("pt-BR")} kWh`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                <span className="text-[10px] font-bold uppercase text-[#64748B]">Payback Simples</span>
                <p className="mt-1 text-lg font-extrabold text-[#101828] tabular-nums">
                  {solarSimulation.results.paybackYears
                    ? `${solarSimulation.results.paybackYears.toFixed(1)} anos`
                    : "—"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3.5 text-xs">
              <span className="text-[#64748B]">
                Valores estimados por premissas padrão editáveis. Abra o estudo 2D/3D para projeto executivo.
              </span>
              <Button asChild size="sm" className="rounded-xl bg-[#00D98A] text-[#031923] font-bold hover:bg-[#00C47C]">
                <Link to={selectedProject ? `/solar-project?project=${selectedProject.id}` : "/solar-project"}>
                  Ir para Projeto Solar <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="project">
          {selectedProject && selectedMetrics ? (
            <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-[#101828]">{selectedProject.name}</h2>
                  <p className="text-xs text-[#64748B]">
                    {selectedMetrics.installationTypeLabel} · {selectedMetrics.voltageLabel} · {selectedMetrics.circuitsCount} circuitos
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
                    className="rounded-xl bg-[#5B4AE8] text-white font-bold hover:bg-[#4b3bd4]"
                  >
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                    Auditoria NBR 5410
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-xl">
                    <Link to={`/projects/${selectedProject.id}`}>Abrir projeto</Link>
                  </Button>
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
