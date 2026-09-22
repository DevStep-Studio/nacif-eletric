import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  BarChart3,
  BatteryCharging,
  Building2,
  CheckCircle2,
  FileText,
  Home,
  Loader2,
  MapPin,
  PiggyBank,
  Ruler,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { analyzeEnergyBillFile } from "@/lib/solarAiServices";
import { getInstantResults, getPreliminarySizing } from "@/lib/solarWizardState";
import PtBrNumericInput from "./PtBrNumericInput";
import SolarConsumptionHistoryModal from "./SolarConsumptionHistoryModal";
import SolarPriorityLoadsModal from "./SolarPriorityLoadsModal";

const ENTRY_METHODS = [
  {
    key: "bill",
    title: "Conta de energia",
    badge: "Recomendado",
    icon: FileText,
    description: "Envie a conta em PDF, JPG ou PNG e confira os dados extraídos.",
  },
  {
    key: "power",
    title: "Potência desejada",
    icon: Zap,
    description: "Informe a potência alvo do sistema (ex: 11,55 kWp).",
  },
  {
    key: "area",
    title: "Área disponível",
    icon: Ruler,
    description: "Use a área do telhado disponível para dimensionar.",
  },
];

const INSTALLATION_TYPES = [
  { value: "Residencial", label: "Residencial", icon: Home },
  { value: "Comercial", label: "Comercial", icon: Building2 },
  { value: "Industrial", label: "Industrial", icon: Zap },
  { value: "Rural", label: "Rural", icon: Sun },
];

export default function StepDadosProjeto({ state, onChange }) {
  const fileInputRef = useRef(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [batteryModalOpen, setBatteryModalOpen] = useState(false);

  const setField = (field, value) => onChange({ [field]: value });

  const results = useMemo(() => getInstantResults(state), [state]);
  const preliminary = useMemo(() => getPreliminarySizing(state), [state]);

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validação de tipo e tamanho (max 15MB)
    const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      setField("bill_reading_status", "unavailable");
      setField("bill_reading_message", "Formato inválido. Envie arquivos em PDF, JPG ou PNG.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setField("bill_reading_status", "unavailable");
      setField("bill_reading_message", "Arquivo muito grande (máximo 15 MB).");
      return;
    }

    setAnalyzing(true);
    setField("bill_reading_status", "reading");
    setField("bill_file_name", file.name);

    try {
      const response = await analyzeEnergyBillFile(file);
      if (response.success && response.extracted) {
        const ext = response.extracted;
        onChange({
          bill_file_name: file.name,
          bill_file_url: response.file_url,
          bill_reading_status: "done",
          bill_reading_message: "",
          bill_history_12_months: ext.history_12_months || [],
          monthly_consumption_kwh: ext.monthly_consumption_kwh,
          tariff_brl_kwh: ext.tariff_brl_kwh,
          contracted_demand_kw: ext.contracted_demand_kw,
          tariff_class: ext.tariff_class || "B1 - Residencial",
          distributor: ext.distributor || "",
          name: state.name || (ext.holder_name ? `Projeto ${ext.holder_name}` : "Residência Solar"),
          client_name: state.client_name || ext.holder_name || "",
          address: state.address || ext.address || "",
        });
      }
    } catch (error) {
      setField("bill_reading_status", "unavailable");
      setField("bill_reading_message", error?.message || "Não foi possível extrair dados automaticamente. Preencha manualmente.");
    } finally {
      setAnalyzing(false);
    }
  };

  const removeBillFile = () => {
    onChange({
      bill_file_name: "",
      bill_file_url: "",
      bill_reading_status: "idle",
      bill_reading_message: "",
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSystemModeChange = (mode) => {
    onChange({
      system_mode: mode,
      has_battery: mode === "hibrido" || mode === "off-grid",
    });
  };

  const handleBatteryToggle = (checked) => {
    if (checked) {
      onChange({
        has_battery: true,
        system_mode: state.system_mode === "off-grid" ? "off-grid" : "hibrido",
      });
    } else {
      onChange({
        has_battery: false,
        system_mode: "on-grid",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Informações Gerais do Projeto */}
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">
              Nome do projeto <span className="text-[#00d8b8] font-bold">*</span>
            </Label>
            <Input
              placeholder="Ex: Residência João Silva"
              value={state.name}
              onChange={(e) => setField("name", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Cliente</Label>
            <Input
              placeholder="Nome do cliente ou empresa"
              value={state.client_name}
              onChange={(e) => setField("client_name", e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
            />
          </div>
        </div>

        {/* Tipo de Empreendimento */}
        <div className="space-y-1.5">
          <Label className="text-xs font-black text-foreground">Tipo de empreendimento</Label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {INSTALLATION_TYPES.map((item) => {
              const Icon = item.icon;
              const active = state.installation_type === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setField("installation_type", item.value)}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-xs font-extrabold transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Como deseja iniciar o projeto? (3 Cards de Altura Uniforme) */}
      <div className="space-y-2.5">
        <Label className="text-xs font-black text-foreground">Como deseja iniciar o projeto?</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {ENTRY_METHODS.map((method) => {
            const Icon = method.icon;
            const active = state.entry_method === method.key;
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => setField("entry_method", method.key)}
                className={`relative flex min-h-[140px] flex-col items-start justify-between rounded-2xl border-2 p-4 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/20"
                    : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50/50"
                }`}
              >
                {method.badge && (
                  <span className="absolute right-3 top-3 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
                    {method.badge}
                  </span>
                )}
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                    active ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-extrabold text-sm text-foreground">{method.title}</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
                    {method.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Subformulário da Modalidade Selecionada */}
      {state.entry_method === "bill" && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-[1fr_1.5fr]">
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-white p-4 text-center transition hover:border-primary hover:bg-primary/5"
            >
              {analyzing ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <UploadCloud className="h-7 w-7 text-primary" />
              )}
              <span className="text-xs font-black text-foreground">
                {state.bill_file_name || "Importar conta de energia"}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Arraste ou clique (PDF, JPG, PNG)
              </span>
            </div>

            {state.bill_file_name && (
              <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs">
                <span className="truncate font-semibold text-slate-700 max-w-[180px]">
                  {state.bill_file_name}
                </span>
                <button
                  type="button"
                  onClick={removeBillFile}
                  className="text-red-500 hover:text-red-700 p-0.5 rounded"
                  title="Remover arquivo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {state.bill_reading_status === "unavailable" && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900 border border-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                {state.bill_reading_message}
              </p>
            )}
          </div>

          <div className="flex flex-col justify-between space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs font-black text-emerald-900">
                  {state.bill_reading_status === "done" ? "Dados extraídos com sucesso!" : "Resumo da conta"}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold">
                <div>
                  <span className="text-muted-foreground">Consumo médio:</span>{" "}
                  <strong className="text-foreground">{state.monthly_consumption_kwh || 842} kWh/mês</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Demanda:</span>{" "}
                  <strong className="text-foreground">{state.contracted_demand_kw || 15} kW</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Tarifa:</span>{" "}
                  <strong className="text-foreground">{state.tariff_class || "B1 - Residencial"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Distribuidora:</span>{" "}
                  <strong className="text-foreground">{state.distributor || "Enel SP"}</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHistoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline self-start"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Ver histórico completo (12 meses)
            </button>
          </div>
        </div>
      )}

      {state.entry_method === "power" && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Potência desejada (kWp)</Label>
              <PtBrNumericInput
                value={state.desired_power_kwp}
                onChange={(v) => setField("desired_power_kwp", v)}
                placeholder="Ex: 11,55"
                suffix="kWp"
                min={0.5}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Potência do módulo (Wp)</Label>
              <PtBrNumericInput
                value={state.module_wp}
                onChange={(v) => setField("module_wp", v)}
                placeholder="Ex: 550"
                suffix="Wp"
                min={100}
              />
            </div>
          </div>

          {/* Resumo Técnico do Dimensionamento Preliminar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-white p-3 text-xs">
            <div>
              <span className="text-muted-foreground font-semibold">Módulos necessários:</span>{" "}
              <strong className="text-foreground font-black">{preliminary?.panelCount || 0} unidades</strong>
            </div>
            <div>
              <span className="text-muted-foreground font-semibold">Potência calculada:</span>{" "}
              <strong className="text-primary font-black">{Number(preliminary?.installedKwp || 0).toFixed(2).replace(".", ",")} kWp</strong>
            </div>
            <div>
              <span className="text-muted-foreground font-semibold">Área estimada:</span>{" "}
              <strong className="text-slate-700 font-black">{Number(preliminary?.areaM2 || 0).toFixed(1).replace(".", ",")} m²</strong>
            </div>
          </div>
        </div>
      )}

      {state.entry_method === "area" && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Área disponível do telhado (m²)</Label>
              <PtBrNumericInput
                value={state.available_area_m2}
                onChange={(v) => setField("available_area_m2", v)}
                placeholder="Ex: 60"
                suffix="m²"
                min={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Potência do módulo (Wp)</Label>
              <PtBrNumericInput
                value={state.module_wp}
                onChange={(v) => setField("module_wp", v)}
                placeholder="Ex: 550"
                suffix="Wp"
                min={100}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-white p-3 text-xs">
            <div>
              <span className="text-muted-foreground font-semibold">Capacidade estimada:</span>{" "}
              <strong className="text-foreground font-black">{preliminary?.panelCount || 0} módulos</strong>
            </div>
            <div>
              <span className="text-muted-foreground font-semibold">Potência pico:</span>{" "}
              <strong className="text-primary font-black">{Number(preliminary?.installedKwp || 0).toFixed(2).replace(".", ",")} kWp</strong>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modo do Sistema e Baterias (Botões Segmentados Uniformes) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label className="text-xs font-black text-foreground">Modo do sistema</Label>
            <p className="text-[11px] font-medium text-muted-foreground">
              Selecione a topologia de conexão à rede ou acumulação.
            </p>
          </div>

          {/* Toggle rápido de inclusão de bateria */}
          <div className="flex items-center gap-2">
            <Label htmlFor="toggle-battery" className="text-xs font-bold text-slate-700 cursor-pointer">
              Incluir bateria?
            </Label>
            <Switch
              id="toggle-battery"
              checked={state.has_battery}
              onCheckedChange={handleBatteryToggle}
            />
          </div>
        </div>

        {/* Botões segmentados */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "on-grid", label: "On-grid" },
            { id: "off-grid", label: "Off-grid" },
            { id: "hibrido", label: "Híbrido" },
          ].map((mode) => {
            const active = state.system_mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleSystemModeChange(mode.id)}
                className={`h-11 rounded-xl border text-xs font-extrabold transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:bg-slate-50"
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Configuração de Cargas Prioritárias quando tem bateria */}
        {state.has_battery && (
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/[0.03] p-3 text-xs">
            <div className="flex items-center gap-2">
              <BatteryCharging className="h-4 w-4 text-primary" />
              <span className="font-semibold text-slate-700">
                Banco de {state.battery_config?.capacity_kwh || 10} kWh configurado para backup.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBatteryModalOpen(true)}
              className="h-8 border-primary text-xs font-extrabold text-primary hover:bg-primary/10"
            >
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Configurar Cargas
            </Button>
          </div>
        )}
      </div>

      {/* 5. Dados Preliminares (Calculados pela IA em Tempo Real) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Dados preliminares (calculados pela IA)
          </p>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
            Tempo Real
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" /> Potência recomendada
            </p>
            <p className="mt-1 text-base font-black text-foreground">
              {Number(results?.installedKwp || 0) > 0 ? `${Number(results.installedKwp).toFixed(2).replace(".", ",")} kWp` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Sun className="h-3 w-3 text-primary" /> Módulos ({state.module_wp} Wp)
            </p>
            <p className="mt-1 text-base font-black text-foreground">
              {results?.panelCount > 0 ? `${results.panelCount} unidades` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3 w-3 text-primary" /> Geração estimada
            </p>
            <p className="mt-1 text-base font-black text-foreground">
              {results?.annualGenerationKwh
                ? `${(Number(results.annualGenerationKwh) / 1000).toFixed(2).replace(".", ",")} MWh/ano`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <PiggyBank className="h-3 w-3 text-emerald-600" /> Economia estimada
            </p>
            <p className="mt-1 text-base font-black text-emerald-700">
              {results.annualSavingsBrl
                ? `${results.annualSavingsBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}/ano`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Modais de Histórico e Bateria */}
      <SolarConsumptionHistoryModal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        history={state.bill_history_12_months}
        onSave={(updatedHistory, newAvgKwh) => {
          onChange({
            bill_history_12_months: updatedHistory,
            monthly_consumption_kwh: newAvgKwh,
          });
        }}
      />

      <SolarPriorityLoadsModal
        open={batteryModalOpen}
        onOpenChange={setBatteryModalOpen}
        batteryConfig={state.battery_config}
        inverterKw={state.inverter_kw}
        onSave={(updatedBatteryConfig) => {
          setField("battery_config", updatedBatteryConfig);
        }}
      />
    </div>
  );
}
