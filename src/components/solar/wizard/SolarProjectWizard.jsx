import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Loader2, Rocket } from "lucide-react";
import {
  CREATION_WIZARD_STEPS,
  DRAFT_STORAGE_KEY,
  defaultWizardState,
  getInstantResults,
  getStepErrors,
} from "@/lib/solarWizardState";
import SolarStepper from "./SolarStepper";
import StepDadosProjeto from "./StepDadosProjeto";
import StepLocalizacao from "./StepLocalizacao";
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
  const { user } = useAuth();
  const [state, setState] = useState(() => loadDraft() || defaultWizardState());
  const [stepIndex, setStepIndex] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [attemptedAdvance, setAttemptedAdvance] = useState(false);
  const [creating, setCreating] = useState(false);

  // Auto-save do rascunho com debounce
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage indisponível
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [state]);

  const stepKey = CREATION_WIZARD_STEPS[stepIndex]?.key || "dados";
  const stepErrors = useMemo(() => getStepErrors(stepKey, state), [stepKey, state]);
  const results = useMemo(() => getInstantResults(state), [state]);

  const updateState = (patch) => setState((current) => ({ ...current, ...patch }));

  const isLastStep = stepIndex === CREATION_WIZARD_STEPS.length - 1;

  const handleCreate = async () => {
    const finalErrors = CREATION_WIZARD_STEPS.flatMap((step) => getStepErrors(step.key, state));
    if (finalErrors.length > 0) {
      toast({ title: "Revise os campos obrigatórios", description: finalErrors[0], variant: "destructive" });
      setAttemptedAdvance(true);
      return;
    }

    setCreating(true);
    try {
      const solar_config = {
        inverter_kw: state.inverter_kw || (state.desired_power_kwp ? Number(state.desired_power_kwp) * 0.9 : 5),
        inverter_quantity: state.inverter_quantity || 1,
        inverter_manufacturer: state.inverter_manufacturer || "Growatt",
        inverter_model: state.inverter_model || "MIN 5000TL-X",
        module_wp: state.module_wp || 550,
        module_manufacturer: state.module_manufacturer || "Jinko Solar",
        module_model: state.module_model || "JKM550M-72HL4",
        requested_panel_count: state.requested_panel_count || results.panelCount || 0,
        roof_area_m2: state.roof_area_m2 || Number(state.available_area_m2) || 72,
        roof_utilization_pct: state.roof_utilization_pct || 80,
        module_width_m: state.module_width_m || 1.134,
        module_height_m: state.module_height_m || 2.278,
        roof_width_m: state.roof_width_m || 20,
        roof_height_m: state.roof_height_m || 5,
        roof_rotation_deg: state.roof_rotation_deg || 0,
        roof_pitch_deg: state.roof_pitch_deg || 12,
        map_center_lat: state.map_center_lat,
        map_center_lng: state.map_center_lng,
        map_zoom: state.map_zoom || 19,
        roof_polygon: state.roof_polygon || [],
        roof_defined: state.roof_defined || false,
        module_orientation: state.module_orientation || "auto",
        obstacles: state.obstacles || [],
        layout_strategy: state.layout_strategy || "max_generation",
        ac_voltage: state.ac_voltage || 220,
        ac_supply_type: state.ac_supply_type || "Bifásico",
        connection_point: state.connection_point || "Quadro de distribuição principal da unidade consumidora",
        connection_location: state.connection_location || "Quadro elétrico principal da unidade consumidora",
        entry_standard_location: state.entry_standard_location || "Padrão de entrada da unidade consumidora",
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
        voltage: state.ac_voltage || 220,
        supply_type: state.ac_supply_type || "Bifásico",
        solar_config,
        system_mode: state.system_mode || "on-grid",
        has_battery: state.has_battery || false,
        battery_config: state.has_battery ? state.battery_config : null,
        consumption: {
          monthly_consumption_kwh: Number(state.monthly_consumption_kwh) || null,
          tariff_brl_kwh: Number(state.tariff_brl_kwh) || null,
          contracted_demand_kw: Number(state.contracted_demand_kw) || null,
          tariff_class: state.tariff_class || "B1 - Residencial",
          distributor: state.distributor || "",
          consumer_unit: state.consumer_unit || "",
        },
        energy_bill: {
          file_name: state.bill_file_name,
          file_url: state.bill_file_url,
          reading_status: state.bill_reading_status,
          history_12_months: state.bill_history_12_months,
          installation_code: state.consumer_unit,
        },
        technical_responsible: {
          name: user?.full_name || user?.name || "",
          crea: user?.crea || "",
          company: user?.company || "",
        },
        investment_brl: Number(state.investment_brl) || null,
        sizing_results_snapshot: results,
      };

      const project = await backend.entities.Project.create(payload);
      try { window.localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      toast({
        title: "Projeto solar criado com sucesso!",
        description: "Abrindo o projeto na visualização 3D e satélite.",
      });
      navigate(`/solar-project?project=${project.id}`);
    } catch (error) {
      toast({
        title: "Não foi possível criar o projeto",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const goNext = () => {
    if (stepErrors.length > 0) {
      setAttemptedAdvance(true);
      return;
    }
    setAttemptedAdvance(false);
    if (isLastStep) {
      handleCreate();
      return;
    }
    const nextIndex = Math.min(CREATION_WIZARD_STEPS.length - 1, stepIndex + 1);
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

  return (
    <div className="space-y-5">
      {/* 1. Indicador de Progresso (Passo 1: Dados do projeto -> Passo 2: Localização) */}
      <SolarStepper
        steps={CREATION_WIZARD_STEPS}
        currentIndex={stepIndex}
        maxVisited={maxVisited}
        hasErrors={attemptedAdvance && stepErrors.length > 0}
        onStepClick={jumpTo}
      />

      {/* Conteúdo da Etapa Atual */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {stepKey === "dados" && <StepDadosProjeto state={state} onChange={updateState} />}
        {stepKey === "localizacao" && <StepLocalizacao state={state} onChange={updateState} />}
      </div>

      {/* Barra de Resultados Integrados */}
      <ResultsBar results={results} investmentIsEstimated={results.investmentIsEstimated} />

      {/* Alerta de Validação Contextual */}
      {attemptedAdvance && stepErrors.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-950 shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-black text-amber-900 mb-1">Preencha os campos obrigatórios para avançar:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {stepErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Botões de Navegação Inferiores */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={stepIndex === 0 ? handleCancel : goBack}
          disabled={creating}
          className="h-11 rounded-xl px-5 text-sm font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          {stepIndex === 0 ? "Cancelar" : <><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</>}
        </Button>

        <Button
          type="button"
          onClick={goNext}
          disabled={creating}
          className="h-11 rounded-xl bg-primary px-6 text-sm font-black text-primary-foreground shadow-md hover:bg-primary/90 transition flex items-center gap-2"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Criando projeto...
            </>
          ) : stepIndex === 0 ? (
            "Avançar para localização →"
          ) : (
            <>
              <Rocket className="h-4 w-4" />
              Criar Projeto →
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
