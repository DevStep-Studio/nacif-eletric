import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Check, Loader2, Save, Sliders, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  FULL_PROJECT_STEPS,
  defaultWizardState,
  getInstantResults,
  getStepErrors,
  validateProjectDataForReports,
} from "@/lib/solarWizardState";
import SolarStepper from "./wizard/SolarStepper";
import StepDadosProjeto from "./wizard/StepDadosProjeto";
import StepLocalizacao from "./wizard/StepLocalizacao";
import StepConsumo from "./wizard/StepConsumo";
import StepEquipamentos from "./wizard/StepEquipamentos";
import StepProjeto from "./wizard/StepProjeto";
import ResultsBar from "./wizard/ResultsBar";

export default function SolarProjectParametersModal({
  open,
  onOpenChange,
  project,
  config,
  sizing,
  onSave,
  initialStep = "consumo",
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(2); // Inicia por padrão no Passo 3 (Consumo)
  const [maxVisited, setMaxVisited] = useState(4);
  const [attemptedAdvance, setAttemptedAdvance] = useState(false);

  // Inicializa o estado a partir do projeto e da configuração atual do telhado
  const [state, setState] = useState(() => {
    const base = defaultWizardState();
    return {
      ...base,
      name: project?.name || "",
      client_name: project?.client_name || "",
      installation_type: project?.installation_type || "Residencial",
      system_mode: project?.system_mode || "on-grid",
      has_battery: Boolean(project?.has_battery),
      battery_config: project?.battery_config || null,
      address: project?.address || "",
      number: project?.number || "",
      complement: project?.complement || "",
      neighborhood: project?.neighborhood || "",
      city: project?.city || "",
      state: project?.state || "",
      zip_code: project?.zip_code || "",
      map_center_lat: config?.map_center_lat || project?.solar_config?.map_center_lat || base.map_center_lat,
      map_center_lng: config?.map_center_lng || project?.solar_config?.map_center_lng || base.map_center_lng,
      map_zoom: config?.map_zoom || 19,
      monthly_consumption_kwh:
        project?.consumption?.monthly_consumption_kwh ||
        project?.monthly_consumption_kwh ||
        config?.monthly_consumption_kwh ||
        "",
      tariff_brl_kwh:
        project?.consumption?.tariff_brl_kwh ||
        config?.tariff_brl_kwh ||
        "",
      distributor:
        project?.consumption?.distributor ||
        config?.distributor ||
        "",
      consumer_unit:
        project?.consumption?.consumer_unit ||
        config?.consumer_unit ||
        "",
      tariff_class: project?.consumption?.tariff_class || "B1 - Residencial",
      bill_file_name: project?.energy_bill?.file_name || "",
      bill_file_url: project?.energy_bill?.file_url || "",
      bill_reading_status: project?.energy_bill?.reading_status || "idle",
      bill_history_12_months: project?.energy_bill?.history_12_months || [],
      inverter_kw: config?.inverter_kw || 5,
      inverter_quantity: config?.inverter_quantity || 1,
      inverter_manufacturer: config?.inverter_manufacturer || "Growatt",
      inverter_model: config?.inverter_model || "MIN 5000TL-X",
      module_wp: config?.module_wp || 550,
      module_manufacturer: config?.module_manufacturer || "Jinko Solar",
      module_model: config?.module_model || "JKM550M-72HL4",
      module_orientation: config?.module_orientation || "auto",
      requested_panel_count: sizing?.panelCount || config?.requested_panel_count || 21,
      ac_voltage: config?.ac_voltage || 220,
      ac_supply_type: config?.ac_supply_type || "Bifásico",
      connection_point: config?.connection_point || "Quadro de distribuição principal da unidade consumidora",
      connection_location: config?.connection_location || "Quadro elétrico principal da unidade consumidora",
      entry_standard_location: config?.entry_standard_location || "Padrão de entrada da unidade consumidora",
      roof_polygon: config?.roof_polygon || [],
      roof_defined: config?.roof_defined || false,
      roof_area_m2: config?.roof_area_m2 || 54,
      roof_rotation_deg: config?.roof_rotation_deg || 0,
      roof_pitch_deg: config?.roof_pitch_deg || 12,
      investment_brl: project?.investment_brl || "",
    };
  });

  // Atualiza estado quando o modal abre ou o projeto/config muda
  useEffect(() => {
    if (open) {
      const targetStepIdx = FULL_PROJECT_STEPS.findIndex((s) => s.key === initialStep);
      setStepIndex(targetStepIdx >= 0 ? targetStepIdx : 2);
      setMaxVisited(4);

      setState((prev) => ({
        ...prev,
        name: project?.name || prev.name,
        client_name: project?.client_name || prev.client_name,
        address: project?.address || prev.address,
        city: project?.city || prev.city,
        state: project?.state || prev.state,
        zip_code: project?.zip_code || prev.zip_code,
        monthly_consumption_kwh:
          project?.consumption?.monthly_consumption_kwh ||
          project?.monthly_consumption_kwh ||
          config?.monthly_consumption_kwh ||
          prev.monthly_consumption_kwh,
        tariff_brl_kwh:
          project?.consumption?.tariff_brl_kwh ||
          config?.tariff_brl_kwh ||
          prev.tariff_brl_kwh,
        inverter_kw: config?.inverter_kw || prev.inverter_kw,
        module_wp: config?.module_wp || prev.module_wp,
        requested_panel_count: sizing?.panelCount || config?.requested_panel_count || prev.requested_panel_count,
      }));
    }
  }, [open, initialStep, project, config, sizing]);

  const stepKey = FULL_PROJECT_STEPS[stepIndex]?.key || "consumo";
  const stepErrors = useMemo(() => getStepErrors(stepKey, state), [stepKey, state]);
  const results = useMemo(() => getInstantResults(state), [state]);
  const reportValidation = useMemo(
    () => validateProjectDataForReports(project ? { ...project, ...state } : state, { ...config, ...state }, sizing),
    [project, config, state, sizing]
  );

  const updateState = (patch) => setState((current) => ({ ...current, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedConfigPatch = {
        inverter_kw: Number(state.inverter_kw) || config.inverter_kw,
        inverter_quantity: Number(state.inverter_quantity) || 1,
        inverter_manufacturer: state.inverter_manufacturer || config.inverter_manufacturer,
        inverter_model: state.inverter_model || config.inverter_model,
        module_wp: Number(state.module_wp) || config.module_wp,
        module_manufacturer: state.module_manufacturer || config.module_manufacturer,
        module_model: state.module_model || config.module_model,
        module_orientation: state.module_orientation || config.module_orientation,
        requested_panel_count: Number(state.requested_panel_count) || sizing?.panelCount || config.requested_panel_count,
        ac_voltage: Number(state.ac_voltage) || config.ac_voltage,
        ac_supply_type: state.ac_supply_type || config.ac_supply_type,
        connection_point: state.connection_point || config.connection_point,
        connection_location: state.connection_location || config.connection_location,
        entry_standard_location: state.entry_standard_location || config.entry_standard_location,
        distributor: state.distributor || config.distributor,
        consumer_unit: state.consumer_unit || config.consumer_unit,
      };

      const updatedProjectPayload = {
        name: state.name,
        client_name: state.client_name,
        address: state.address,
        city: state.city,
        state: state.state,
        zip_code: state.zip_code,
        installation_type: state.installation_type,
        system_mode: state.system_mode,
        has_battery: state.has_battery,
        battery_config: state.has_battery ? state.battery_config : null,
        consumption: {
          monthly_consumption_kwh: Number(state.monthly_consumption_kwh) || null,
          tariff_brl_kwh: Number(state.tariff_brl_kwh) || null,
          contracted_demand_kw: Number(state.contracted_demand_kw) || null,
          tariff_class: state.tariff_class,
          distributor: state.distributor,
          consumer_unit: state.consumer_unit,
        },
        solar_config: {
          ...(project?.solar_config || {}),
          ...updatedConfigPatch,
        },
        investment_brl: Number(state.investment_brl) || null,
      };

      if (onSave) {
        await onSave(updatedProjectPayload, updatedConfigPatch);
      }

      toast({
        title: "Parâmetros salvos com sucesso!",
        description: "Os dados do projeto foram atualizados e sincronizados com a visualização.",
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erro ao salvar parâmetros",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (stepErrors.length > 0) {
      setAttemptedAdvance(true);
      return;
    }
    setAttemptedAdvance(false);
    const nextIndex = Math.min(FULL_PROJECT_STEPS.length - 1, stepIndex + 1);
    setStepIndex(nextIndex);
  };

  const goBack = () => {
    setAttemptedAdvance(false);
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const jumpTo = (index) => {
    setAttemptedAdvance(false);
    setStepIndex(index);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-white border-slate-200 text-slate-900 p-6 shadow-2xl rounded-3xl">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
                <Sliders className="h-5 w-5 text-[#00d8b8]" />
                Parâmetros & Dados do Projeto Solar
              </DialogTitle>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Configure os dados de consumo, equipamentos, arranjo e dados para o memorial descritivo.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 bg-[#00d8b8] hover:bg-[#00c4a7] text-slate-950 text-xs font-black rounded-xl shadow-sm shrink-0 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogHeader>

        {/* Banner de Validação dos Relatórios */}
        {!reportValidation.valid && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 shadow-sm mt-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-black text-amber-950">Atenção para emissão de relatórios:</p>
              <p className="text-[11px] font-semibold text-amber-800 mt-0.5">
                {reportValidation.message}
              </p>
            </div>
          </div>
        )}

        {/* Stepper com as 5 Etapas completas */}
        <div className="pt-2">
          <SolarStepper
            steps={FULL_PROJECT_STEPS}
            currentIndex={stepIndex}
            maxVisited={maxVisited}
            hasErrors={attemptedAdvance && stepErrors.length > 0}
            onStepClick={jumpTo}
          />
        </div>

        {/* Conteúdo da Etapa Selecionada */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm mt-2">
          {stepKey === "dados" && <StepDadosProjeto state={state} onChange={updateState} />}
          {stepKey === "localizacao" && <StepLocalizacao state={state} onChange={updateState} />}
          {stepKey === "consumo" && <StepConsumo state={state} onChange={updateState} />}
          {stepKey === "equipamentos" && <StepEquipamentos state={state} onChange={updateState} />}
          {stepKey === "projeto" && (
            <StepProjeto state={state} onChange={updateState} onCreate={handleSave} creating={saving} />
          )}
        </div>

        {/* Barra de Resultados Integrados */}
        <ResultsBar results={results} investmentIsEstimated={results.investmentIsEstimated} />

        {/* Alerta de Validação da Etapa Atual */}
        {attemptedAdvance && stepErrors.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-950 shadow-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="font-black text-amber-900 mb-1">Preencha os campos obrigatórios desta etapa:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {stepErrors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* Rodapé com Navegação e Salvar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={stepIndex === 0 ? () => onOpenChange(false) : goBack}
            className="h-10 rounded-xl px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            {stepIndex === 0 ? "Fechar" : <><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Etapa Anterior</>}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSave}
              disabled={saving}
              className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5 text-[#00d8b8]" />}
              Salvar
            </Button>

            {stepIndex < FULL_PROJECT_STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={goNext}
                className="h-10 rounded-xl bg-primary px-5 text-xs font-black text-primary-foreground shadow-sm hover:bg-primary/90 transition"
              >
                Próxima Etapa →
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-10 rounded-xl bg-[#00d8b8] px-5 text-xs font-black text-slate-950 shadow-sm hover:bg-[#00c4a7] transition flex items-center gap-1.5"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                Concluir e Salvar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
