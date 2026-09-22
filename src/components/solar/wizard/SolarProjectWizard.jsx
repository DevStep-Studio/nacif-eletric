import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Sparkles, Sun, X, Zap } from "lucide-react";
import {
  DRAFT_STORAGE_KEY,
  WIZARD_STEPS,
  defaultWizardState,
  estimateRoofRectangleFromArea,
  getInstantResults,
  getPreliminarySizing,
  getStepErrors,
} from "@/lib/solarWizardState";
import { normalizeRoofPolygon } from "@/lib/solarDesignerGeometry";
import StepDadosProjeto from "./StepDadosProjeto";
import StepConsumo from "./StepConsumo";
import StepLocalizacao from "./StepLocalizacao";
import StepTelhado from "./StepTelhado";
import StepEquipamentos from "./StepEquipamentos";
import StepProjeto from "./StepProjeto";
import ResultsBar from "./ResultsBar";

function loadDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...defaultWizardState(), ...parsed } : null;
  } catch {
    return null;
  }
}

export default function SolarProjectWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState(() => loadDraft() || defaultWizardState());
  const [stepIndex, setStepIndex] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [attemptedAdvance, setAttemptedAdvance] = useState(false);
  const [creating, setCreating] = useState(false);
  const roofSeededRef = useRef(normalizeRoofPolygon(state.roof_polygon).length >= 3);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // storage indisponível
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [state]);

  const stepKey = WIZARD_STEPS[stepIndex].key;
  const stepErrors = useMemo(() => getStepErrors(stepKey, state), [stepKey, state]);
  const results = useMemo(() => getInstantResults(state), [state]);

  const updateState = (patch) => setState((current) => ({ ...current, ...patch }));

  const seedRoofIfNeeded = () => {
    if (roofSeededRef.current) return;
    const preliminary = getPreliminarySizing(state);
    const moduleArea = state.module_width_m * state.module_height_m;
    const approxArea = state.entry_method === "area"
      ? Math.max(4, Number(state.available_area_m2) || 0)
      : (Math.max(1, preliminary.panelCount) * moduleArea) / 0.55;
    const { widthM, heightM } = estimateRoofRectangleFromArea(approxArea);
    roofSeededRef.current = true;
    updateState({
      roof_width_m: widthM,
      roof_height_m: heightM,
      roof_area_m2: Math.round(widthM * heightM * 10) / 10,
      requested_panel_count: preliminary.panelCount || state.requested_panel_count,
    });
  };

  const goNext = () => {
    if (stepErrors.length > 0) {
      setAttemptedAdvance(true);
      return;
    }
    setAttemptedAdvance(false);
    if (stepKey === "localizacao") seedRoofIfNeeded();
    const nextIndex = Math.min(WIZARD_STEPS.length - 1, stepIndex + 1);
    setStepIndex(nextIndex);
    setMaxVisited((current) => Math.max(current, nextIndex));
  };

  const goBack = () => {
    setAttemptedAdvance(false);
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const jumpTo = (index) => {
    if (index > maxVisited) return;
    setAttemptedAdvance(false);
    setStepIndex(index);
  };

  const handleCancel = () => {
    if (state.name || state.monthly_consumption_kwh) {
      if (window.confirm("Deseja cancelar o cadastro? O rascunho atual será descartado.")) {
        try { window.localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };

  const handleCreate = async () => {
    const finalErrors = WIZARD_STEPS.flatMap((step) => getStepErrors(step.key, state));
    if (finalErrors.length > 0) {
      toast({ title: "Revise o cadastro", description: finalErrors[0], variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const solar_config = {
        inverter_kw: state.inverter_kw,
        module_wp: state.module_wp,
        requested_panel_count: state.requested_panel_count,
        roof_area_m2: state.roof_area_m2,
        roof_utilization_pct: state.roof_utilization_pct,
        module_width_m: state.module_width_m,
        module_height_m: state.module_height_m,
        roof_width_m: state.roof_width_m,
        roof_height_m: state.roof_height_m,
        roof_rotation_deg: state.roof_rotation_deg,
        roof_pitch_deg: state.roof_pitch_deg || 12,
        map_center_lat: state.map_center_lat,
        map_center_lng: state.map_center_lng,
        map_zoom: state.map_zoom,
        roof_polygon: state.roof_polygon,
        roof_defined: state.roof_defined,
        module_orientation: state.module_orientation,
        obstacles: state.obstacles || [],
        layout_strategy: state.layout_strategy || "max_generation",
        ac_voltage: state.ac_voltage,
        ac_supply_type: state.ac_supply_type,
      };

      const payload = {
        name: state.name,
        client_name: state.client_name,
        address: [state.address, state.number].filter(Boolean).join(", "),
        complement: state.complement,
        neighborhood: state.neighborhood,
        city: state.city,
        state: state.state,
        zip_code: state.zip_code,
        project_type: "Solar",
        installation_type: state.installation_type,
        voltage: state.ac_voltage,
        supply_type: state.ac_supply_type,
        solar_config,
        system_mode: state.system_mode,
        has_battery: state.has_battery,
        battery_config: state.has_battery ? state.battery_config : null,
        consumption: {
          monthly_consumption_kwh: Number(state.monthly_consumption_kwh) || null,
          tariff_brl_kwh: Number(state.tariff_brl_kwh) || null,
          contracted_demand_kw: Number(state.contracted_demand_kw) || null,
          tariff_class: state.tariff_class,
          distributor: state.distributor,
        },
        energy_bill: {
          file_name: state.bill_file_name,
          file_url: state.bill_file_url,
          reading_status: state.bill_reading_status,
          history_12_months: state.bill_history_12_months,
        },
        investment_brl: Number(state.investment_brl) || null,
        sizing_results_snapshot: results,
      };

      const project = await backend.entities.Project.create(payload);
      try { window.localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      toast({ title: "Projeto solar criado com sucesso!", description: "Abrindo o layout do telhado." });
      navigate(`/solar-project?project=${project.id}`);
    } catch (error) {
      toast({ title: "Não foi possível criar o projeto", description: error?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const nextButtonLabel = stepIndex === 0
    ? "Avançar para o telhado →"
    : stepIndex === WIZARD_STEPS.length - 2
    ? "Revisar Projeto →"
    : "Avançar →";

  return (
    <div className="space-y-6">
      {/* 1. Indicador de Progresso (Stepper de 6 etapas) */}
      <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm">
        <ol className="flex items-center justify-between overflow-x-auto">
          {WIZARD_STEPS.map((step, index) => {
            const isCurrent = index === stepIndex;
            const isDone = index < stepIndex || (index === stepIndex && stepErrors.length === 0 && index < maxVisited);
            const isClickable = index <= maxVisited;
            return (
              <li key={step.key} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => jumpTo(index)}
                  className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed group transition"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black transition-all ${
                      isCurrent
                        ? "border-primary bg-primary text-white shadow-md shadow-primary/20 scale-105"
                        : isDone
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-border bg-muted/40 text-muted-foreground group-hover:border-primary/40"
                    }`}
                  >
                    {isDone && !isCurrent ? <Check className="h-4 w-4 stroke-[3]" /> : index + 1}
                  </span>
                  <span
                    className={`hidden whitespace-nowrap text-[11px] font-bold sm:block ${
                      isCurrent ? "text-primary font-black" : isDone ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {index < WIZARD_STEPS.length - 1 && (
                  <span
                    className={`mx-2 h-0.5 flex-1 transition ${
                      index < stepIndex ? "bg-emerald-400" : "bg-border"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Conteúdo da Etapa Atual */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm">
        {stepKey === "dados" && <StepDadosProjeto state={state} onChange={updateState} />}
        {stepKey === "consumo" && <StepConsumo state={state} onChange={updateState} />}
        {stepKey === "localizacao" && <StepLocalizacao state={state} onChange={updateState} />}
        {stepKey === "telhado" && <StepTelhado state={state} onChange={updateState} />}
        {stepKey === "equipamentos" && <StepEquipamentos state={state} onChange={updateState} />}
        {stepKey === "projeto" && (
          <StepProjeto state={state} onChange={updateState} onCreate={handleCreate} creating={creating} />
        )}
      </div>

      {/* Barra de Resultados Integrados (se não estiver na etapa final) */}
      {stepKey !== "projeto" && (
        <ResultsBar results={results} investmentIsEstimated={results.investmentIsEstimated} />
      )}

      {/* Alerta de Validação */}
      {attemptedAdvance && stepErrors.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-950 shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-black text-amber-900 mb-1">Preencha os campos obrigatórios desta etapa:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {stepErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Botões de Navegação Inferiores */}
      {stepKey !== "projeto" && (
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={stepIndex === 0 ? handleCancel : goBack}
            className="h-11 rounded-xl px-5 text-sm font-bold"
          >
            {stepIndex === 0 ? (
              <>Cancelar</>
            ) : (
              <><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</>
            )}
          </Button>

          <Button
            type="button"
            onClick={goNext}
            className="h-11 rounded-xl bg-primary px-6 text-sm font-black text-primary-foreground shadow-md hover:bg-primary/90"
          >
            {nextButtonLabel}
          </Button>
        </div>
      )}

      {stepKey === "projeto" && stepIndex > 0 && (
        <div className="flex items-center justify-start pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            className="h-11 rounded-xl px-5 text-sm font-bold"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para Equipamentos
          </Button>
        </div>
      )}
    </div>
  );
}
