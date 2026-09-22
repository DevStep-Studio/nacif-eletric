import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BatteryCharging, Plus, ShieldCheck, Trash2, Zap } from "lucide-react";
import { getBatteryAutonomyHours, getEffectivePanelCount, getRoofPhysicalLayout } from "@/lib/solarWizardState";
import { normalizeRoofPolygon } from "@/lib/solarDesignerGeometry";
import PtBrNumericInput from "./PtBrNumericInput";

const BATTERY_TECHNOLOGIES = ["Íon-lítio", "Chumbo-ácido (AGM/GEL)", "Sódio-íon"];

export default function StepEquipamentos({ state, onChange }) {
  const setField = (field, value) => onChange({ [field]: value });
  const setBatteryField = (field, value) => onChange({ battery_config: { ...state.battery_config, [field]: value } });

  const hasDrawnRoof = normalizeRoofPolygon(state.roof_polygon).length >= 3 && state.roof_defined === true;
  const physicalCapacity = hasDrawnRoof ? getRoofPhysicalLayout(state).panelCount : null;
  const { fits, physicalCapacity: capacity } = getEffectivePanelCount(state);
  const autonomyHours = getBatteryAutonomyHours(state.battery_config);
  const totalPriorityLoadW = (state.battery_config?.priority_loads || []).reduce((sum, l) => sum + Number(l.power_w || 0), 0);
  const inverterExceeded = totalPriorityLoadW > Number(state.inverter_kw || 0) * 1000;

  const addLoad = () => {
    setBatteryField("priority_loads", [...(state.battery_config?.priority_loads || []), { name: "", power_w: 150 }]);
  };

  const updateLoad = (index, field, value) => {
    const loads = [...(state.battery_config?.priority_loads || [])];
    loads[index] = { ...loads[index], [field]: value };
    setBatteryField("priority_loads", loads);
  };

  const removeLoad = (index) => {
    setBatteryField("priority_loads", (state.battery_config?.priority_loads || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* 1. Equipamentos Principais (Inversor & Módulos) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-primary" /> Inversor & Arranjo Fotovoltaico
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Potência do inversor (kW)</Label>
            <PtBrNumericInput
              value={state.inverter_kw}
              onChange={(v) => setField("inverter_kw", v)}
              placeholder="Ex: 5"
              suffix="kW"
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

          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Quantidade de módulos</Label>
            <PtBrNumericInput
              value={state.requested_panel_count}
              onChange={(v) => setField("requested_panel_count", v)}
              placeholder="Ex: 21"
              suffix="unidades"
              min={1}
            />
            {hasDrawnRoof && physicalCapacity !== null && (
              <p className="text-[11px] font-semibold text-muted-foreground">
                Capacidade física do telhado: {physicalCapacity} módulos.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Orientação dos módulos</Label>
            <Select value={state.module_orientation} onValueChange={(v) => setField("module_orientation", v)}>
              <SelectTrigger className="h-11 font-medium"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automática (melhor encaixe)</SelectItem>
                <SelectItem value="vertical">Em pé (retrato / portrait)</SelectItem>
                <SelectItem value="horizontal">Deitada (paisagem / landscape)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Tensão CA (V)</Label>
            <PtBrNumericInput
              value={state.ac_voltage}
              onChange={(v) => setField("ac_voltage", v)}
              placeholder="Ex: 220"
              suffix="V"
              min={110}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Alimentação CA</Label>
            <Select value={state.ac_supply_type} onValueChange={(v) => setField("ac_supply_type", v)}>
              <SelectTrigger className="h-11 font-medium"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Monofásico">Monofásico (F+N)</SelectItem>
                <SelectItem value="Bifásico">Bifásico (2F+N)</SelectItem>
                <SelectItem value="Trifásico">Trifásico (3F+N)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div>
            <p className="text-xs font-black text-slate-800">Dados automáticos do memorial descritivo</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              Estes campos serão levados diretamente para o PDF técnico.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Fabricante dos módulos</Label>
              <Input value={state.module_manufacturer || ""} onChange={(e) => setField("module_manufacturer", e.target.value)} placeholder="Ex: Jinko Solar" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Modelo dos módulos</Label>
              <Input value={state.module_model || ""} onChange={(e) => setField("module_model", e.target.value)} placeholder="Ex: JKM550M-72HL4" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Fabricante do inversor</Label>
              <Input value={state.inverter_manufacturer || ""} onChange={(e) => setField("inverter_manufacturer", e.target.value)} placeholder="Ex: Growatt" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Modelo do inversor</Label>
              <Input value={state.inverter_model || ""} onChange={(e) => setField("inverter_model", e.target.value)} placeholder="Ex: MIN 5000TL-X" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Quantidade de inversores</Label>
              <PtBrNumericInput value={state.inverter_quantity} onChange={(v) => setField("inverter_quantity", v)} placeholder="Ex: 1" suffix="unidade(s)" min={1} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-black text-foreground">Ponto de conexão à rede</Label>
              <Input value={state.connection_point || ""} onChange={(e) => setField("connection_point", e.target.value)} placeholder="Ex: QDG principal" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Localização da conexão</Label>
              <Input value={state.connection_location || ""} onChange={(e) => setField("connection_location", e.target.value)} placeholder="Ex: Abrigo do quadro principal" className="h-11 font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Local do padrão de entrada</Label>
              <Input value={state.entry_standard_location || ""} onChange={(e) => setField("entry_standard_location", e.target.value)} placeholder="Ex: Muro frontal do imóvel" className="h-11 font-medium" />
            </div>
          </div>
        </div>

        {hasDrawnRoof && !fits && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            A quantidade solicitada ({state.requested_panel_count} módulos) excede a capacidade geométrica do telhado desenhado ({capacity} módulos). O projeto adotará {capacity} módulos até que a área seja ampliada.
          </p>
        )}
      </div>

      {/* 2. Sistema de Baterias (se ativado) */}
      {state.has_battery && (
        <div className="space-y-4 rounded-2xl border border-primary/20 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
              <BatteryCharging className="h-4 w-4 text-primary" /> Banco de Baterias & Cargas Prioritárias
            </p>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
              Backup Ativo
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Capacidade nominal (kWh) *</Label>
              <PtBrNumericInput
                value={state.battery_config?.capacity_kwh}
                onChange={(v) => setBatteryField("capacity_kwh", v)}
                placeholder="Ex: 10"
                suffix="kWh"
                min={0.5}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Modelo / Fabricante</Label>
              <Input
                value={state.battery_config?.model || ""}
                onChange={(e) => setBatteryField("model", e.target.value)}
                placeholder="Ex: Bateria Lítio 48V / 200Ah"
                className="h-11 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Tensão nominal (V)</Label>
              <PtBrNumericInput
                value={state.battery_config?.voltage}
                onChange={(v) => setBatteryField("voltage", v)}
                placeholder="Ex: 48"
                suffix="V"
                min={12}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Tecnologia</Label>
              <Select
                value={state.battery_config?.technology || "Íon-lítio"}
                onValueChange={(v) => setBatteryField("technology", v)}
              >
                <SelectTrigger className="h-11 font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BATTERY_TECHNOLOGIES.map((tech) => <SelectItem key={tech} value={tech}>{tech}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cargas Prioritárias */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black text-foreground">Cargas prioritárias no backup *</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLoad} className="h-8 text-xs font-bold border-primary text-primary hover:bg-primary/10">
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Carga
              </Button>
            </div>

            {(state.battery_config?.priority_loads || []).length === 0 && (
              <p className="text-xs font-semibold text-muted-foreground bg-slate-50 border border-slate-200 p-3 rounded-xl">
                Nenhuma carga prioritária adicionada. Adicione os circuitos essenciais para calcular a autonomia do backup.
              </p>
            )}

            {(state.battery_config?.priority_loads || []).map((load, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_40px] gap-2 items-center">
                <Input
                  placeholder="Nome da carga (ex: Geladeira, Iluminação, Roteador)"
                  value={load.name}
                  onChange={(e) => updateLoad(index, "name", e.target.value)}
                  className="h-10 font-medium"
                />
                <PtBrNumericInput
                  value={load.power_w}
                  onChange={(v) => updateLoad(index, "power_w", v)}
                  placeholder="Potência"
                  suffix="W"
                  min={1}
                  className="h-10"
                />
                <button
                  type="button"
                  onClick={() => removeLoad(index)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-red-600 hover:bg-red-50 transition border border-red-200"
                  title="Remover carga"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {inverterExceeded && (
            <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              A soma das cargas prioritárias ({totalPriorityLoadW} W) ultrapassa a potência nominal do inversor ({Number(state.inverter_kw) * 1000} W).
            </p>
          )}

          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Autonomia estimada do banco:
            </span>
            <strong className="text-primary text-sm font-black">
              {Number(autonomyHours) > 0 ? `${Number(autonomyHours).toFixed(1).replace(".", ",")} horas` : "—"}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
