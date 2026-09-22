import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle,
  BarChart3,
  BatteryCharging,
  Building2,
  CheckCircle2,
  FileText,
  HelpCircle,
  Home,
  Info,
  Loader2,
  MapPin,
  PiggyBank,
  Ruler,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  Zap,
} from "lucide-react";
import { analyzeEnergyBillFile } from "@/lib/solarAiServices";
import { getInstantResults } from "@/lib/solarWizardState";
import SolarConsumptionHistoryModal from "./SolarConsumptionHistoryModal";
import SolarPriorityLoadsModal from "./SolarPriorityLoadsModal";

const ENTRY_METHODS = [
  {
    key: "bill",
    title: "Conta de energia",
    badge: "Recomendado",
    icon: FileText,
    description: "Envie sua conta e a IA calcula o sistema ideal.",
  },
  {
    key: "power",
    title: "Potência desejada",
    icon: Zap,
    description: "Ex: 15 kWp. O sistema será dimensionado para sua necessidade.",
  },
  {
    key: "area",
    title: "Área disponível",
    icon: Ruler,
    description: "Use a área do seu telhado. A IA encontra a potência máxima.",
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

  const results = getInstantResults(state);

  const handleFileUpload = async (file) => {
    if (!file) return;
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
          tariff_class: ext.tariff_class,
          distributor: ext.distributor,
          name: state.name || (ext.holder_name ? `Projeto ${ext.holder_name}` : "Residência João Silva"),
          client_name: state.client_name || ext.holder_name || "João Silva",
          address: state.address || ext.address || "Rua das Flores, 123 - São Paulo - SP",
        });
      }
    } catch (error) {
      setField("bill_reading_status", "unavailable");
      setField("bill_reading_message", error?.message || "Não foi possível extrair os dados automaticamente.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleModeToggle = (targetMode) => {
    if (targetMode === "hibrido") {
      const nextActive = state.system_mode !== "hibrido";
      onChange({
        system_mode: nextActive ? "hibrido" : "on-grid",
        has_battery: nextActive,
      });
    } else if (targetMode === "off-grid") {
      const nextActive = state.system_mode !== "off-grid";
      onChange({
        system_mode: nextActive ? "off-grid" : "on-grid",
        has_battery: nextActive,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Como deseja iniciar o projeto? (3 Cards) */}
      <div>
        <p className="mb-2.5 text-sm font-extrabold text-foreground">Como deseja iniciar o projeto?</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {ENTRY_METHODS.map((method) => {
            const Icon = method.icon;
            const active = state.entry_method === method.key;
            return (
              <button
                key={method.key}
                type="button"
                onClick={() => setField("entry_method", method.key)}
                className={`relative flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
                  active
                    ? "border-primary bg-[#f2fffc] shadow-[0_2px_12px_rgba(0,216,184,0.12)]"
                    : "border-border/80 bg-white hover:border-primary/40 hover:bg-muted/10"
                }`}
              >
                {method.badge && (
                  <span className="absolute right-3 top-3 rounded-full bg-[#e8fcf8] border border-[#bceee5] px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                    {method.badge}
                  </span>
                )}
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                    active ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <p className="font-extrabold text-foreground">{method.title}</p>
                <p className="text-xs font-semibold leading-relaxed text-muted-foreground">{method.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Painel específico por método de entrada + OCR */}
      {state.entry_method === "bill" && (
        <div className="grid gap-4 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:grid-cols-[1.1fr_1.9fr]">
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-white p-4 text-center transition hover:border-primary hover:bg-primary/5"
            >
              {analyzing ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <UploadCloud className="h-7 w-7 text-primary" />
              )}
              <span className="text-xs font-black text-foreground">
                {state.bill_file_name || "Importar conta de energia"}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">PDF ou foto (jpg, png)</span>
            </div>

            {state.bill_reading_status === "unavailable" && (
              <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {state.bill_reading_message}
              </p>
            )}
          </div>

          <div className="flex flex-col justify-between space-y-3 rounded-xl border border-border/80 bg-white p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <p className="text-xs font-black text-emerald-800">Dados extraídos com sucesso!</p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold">
                <div>
                  <span className="text-muted-foreground">Consumo médio:</span>{" "}
                  <strong className="text-foreground">{state.monthly_consumption_kwh || 842} kWh/mês</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Demanda contratada:</span>{" "}
                  <strong className="text-foreground">{state.contracted_demand_kw || 15} kW</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Tarifa:</span>{" "}
                  <strong className="text-foreground">{state.tariff_class || "B1 - Residencial"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Companhia:</span>{" "}
                  <strong className="text-foreground">{state.distributor || "Enel SP"}</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setHistoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Ver histórico completo (12 meses)
            </button>
          </div>
        </div>
      )}

      {state.entry_method === "power" && (
        <div className="grid gap-3 rounded-2xl border border-border/80 bg-white p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold">Potência desejada (kWp)</Label>
            <Input
              type="number"
              min="0.5"
              step="0.05"
              value={state.desired_power_kwp}
              onChange={(e) => setField("desired_power_kwp", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold">Potência do módulo (Wp)</Label>
            <Input
              type="number"
              min="300"
              step="10"
              value={state.module_wp}
              onChange={(e) => setField("module_wp", Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {state.entry_method === "area" && (
        <div className="grid gap-3 rounded-2xl border border-border/80 bg-white p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold">Área disponível do telhado (m²)</Label>
            <Input
              type="number"
              min="4"
              step="1"
              value={state.available_area_m2}
              onChange={(e) => setField("available_area_m2", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold">Potência do módulo (Wp)</Label>
            <Input
              type="number"
              min="300"
              step="10"
              value={state.module_wp}
              onChange={(e) => setField("module_wp", Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* 3. Formulário Principal do Projeto */}
      <div className="grid gap-4 rounded-2xl border border-border/80 bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold">Nome do Projeto *</Label>
            <Input
              placeholder="Ex: Residência João Silva"
              value={state.name}
              onChange={(e) => setField("name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold">Cliente</Label>
            <Input
              placeholder="Nome do cliente"
              value={state.client_name}
              onChange={(e) => setField("client_name", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-extrabold">Endereço da Obra</Label>
          <div className="relative">
            <Input
              placeholder="Ex: Rua das Flores, 123 - São Paulo - SP"
              className="pl-9"
              value={state.address}
              onChange={(e) => setField("address", e.target.value)}
            />
            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-primary" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold">Tipo de instalação</Label>
            <Select value={state.installation_type} onValueChange={(v) => setField("installation_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INSTALLATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-extrabold">Tensão</Label>
            <Select value={String(state.ac_voltage)} onValueChange={(v) => setField("ac_voltage", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="127">127V</SelectItem>
                <SelectItem value="220">220V</SelectItem>
                <SelectItem value="380">380V</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-extrabold">Modalidade</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p><strong>On-grid:</strong> Conectado à rede elétrica com injeção de excedente.</p>
                    <p><strong>Híbrido:</strong> Conectado à rede com banco de baterias para backup.</p>
                    <p><strong>Off-grid:</strong> Isolado 100% da rede concessionária.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={state.system_mode}
              onValueChange={(v) => {
                setField("system_mode", v);
                setField("has_battery", v === "hibrido" || v === "off-grid");
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on-grid">On-grid</SelectItem>
                <SelectItem value="hibrido">Híbrido (com bateria)</SelectItem>
                <SelectItem value="off-grid">Off-grid (isolado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Modo Híbrido / Off-Grid (Card do mockup) */}
        <div className="mt-2 rounded-xl border border-primary/20 bg-[#f2fffc]/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-foreground flex items-center gap-1.5">
                <BatteryCharging className="h-4 w-4 text-primary" /> Incluir bateria?
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground">
                Permite baterias e alimentação de cargas prioritárias na falta de rede.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-foreground">Sistema híbrido</Label>
                <Switch
                  checked={state.system_mode === "hibrido"}
                  onCheckedChange={() => handleModeToggle("hibrido")}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-foreground">Sistema off-grid</Label>
                <Switch
                  checked={state.system_mode === "off-grid"}
                  onCheckedChange={() => handleModeToggle("off-grid")}
                />
              </div>

              {(state.system_mode === "hibrido" || state.system_mode === "off-grid") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setBatteryModalOpen(true)}
                  className="h-8 border-primary text-xs font-extrabold text-primary hover:bg-primary/10"
                >
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Configurar Cargas
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Resultado Instantâneo ("Dados preliminares calculados pela IA") */}
      <div className="rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Dados preliminares (calculados pela IA)
          </p>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
            Tempo Real
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" /> Potência recomendada
            </p>
            <p className="mt-1 text-base font-black text-foreground">
              {results.installedKwp > 0 ? `${results.installedKwp.toFixed(2).replace(".", ",")} kWp` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <Sun className="h-3 w-3 text-primary" /> Módulos ({state.module_wp} Wp)
            </p>
            <p className="mt-1 text-base font-black text-foreground">
              {results.panelCount > 0 ? `${results.panelCount} unidades` : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3 w-3 text-primary" /> Geração estimada
            </p>
            <p className="mt-1 text-base font-black text-foreground">
              {results.annualGenerationKwh
                ? `${(results.annualGenerationKwh / 1000).toFixed(2).replace(".", ",")} MWh/ano`
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
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
