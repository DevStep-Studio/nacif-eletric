import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { getBatteryAutonomyHours, getEffectivePanelCount, getRoofPhysicalLayout } from "@/lib/solarWizardState";

const BATTERY_TECHNOLOGIES = ["Íon-lítio", "Chumbo-ácido (AGM/GEL)", "Sódio-íon"];

export default function StepEquipamentos({ state, onChange }) {
  const setField = (field, value) => onChange({ [field]: value });
  const setBatteryField = (field, value) => onChange({ battery_config: { ...state.battery_config, [field]: value } });

  const physicalCapacity = getRoofPhysicalLayout(state).panelCount;
  const { fits, physicalCapacity: capacity } = getEffectivePanelCount(state);
  const autonomyHours = getBatteryAutonomyHours(state.battery_config);
  const totalPriorityLoadW = (state.battery_config.priority_loads || []).reduce((sum, l) => sum + Number(l.power_w || 0), 0);
  const inverterExceeded = totalPriorityLoadW > Number(state.inverter_kw || 0) * 1000;

  const addLoad = () => {
    setBatteryField("priority_loads", [...(state.battery_config.priority_loads || []), { name: "", power_w: "" }]);
  };
  const updateLoad = (index, field, value) => {
    const loads = [...(state.battery_config.priority_loads || [])];
    loads[index] = { ...loads[index], [field]: value };
    setBatteryField("priority_loads", loads);
  };
  const removeLoad = (index) => {
    setBatteryField("priority_loads", (state.battery_config.priority_loads || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Inversor (kW)</Label>
          <Input type="number" min="0.5" step="0.5" value={state.inverter_kw} onChange={(e) => setField("inverter_kw", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Potência do módulo (Wp)</Label>
          <Input type="number" min="300" step="10" value={state.module_wp} onChange={(e) => setField("module_wp", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Quantidade de módulos</Label>
          <Input type="number" min="1" step="1" value={state.requested_panel_count} onChange={(e) => setField("requested_panel_count", Number(e.target.value))} />
          <p className="text-[11px] font-semibold text-muted-foreground">Capacidade física do telhado desenhado: {physicalCapacity} módulos.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Orientação dos módulos</Label>
          <Select value={state.module_orientation} onValueChange={(v) => setField("module_orientation", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automática (melhor encaixe)</SelectItem>
              <SelectItem value="vertical">Em pé (retrato)</SelectItem>
              <SelectItem value="horizontal">Deitada (paisagem)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tensão CA (V)</Label>
          <Input type="number" min="110" step="1" value={state.ac_voltage} onChange={(e) => setField("ac_voltage", Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Alimentação CA</Label>
          <Select value={state.ac_supply_type} onValueChange={(v) => setField("ac_supply_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Monofásico">Monofásico</SelectItem>
              <SelectItem value="Bifásico">Bifásico</SelectItem>
              <SelectItem value="Trifásico">Trifásico</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!fits && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          A quantidade solicitada ({state.requested_panel_count}) excede a capacidade física do telhado desenhado ({capacity}). O projeto usará {capacity} módulos até que a área seja ampliada.
        </p>
      )}

      {state.has_battery && (
        <div className="space-y-4 rounded-xl border border-border bg-white p-4">
          <p className="text-sm font-extrabold text-foreground">Banco de baterias</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Capacidade (kWh) *</Label>
              <Input type="number" min="0.5" step="0.5" value={state.battery_config.capacity_kwh} onChange={(e) => setBatteryField("capacity_kwh", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input value={state.battery_config.model} onChange={(e) => setBatteryField("model", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tensão (V)</Label>
              <Input type="number" min="0" step="1" value={state.battery_config.voltage} onChange={(e) => setBatteryField("voltage", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tecnologia</Label>
              <Select value={state.battery_config.technology} onValueChange={(v) => setBatteryField("technology", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BATTERY_TECHNOLOGIES.map((tech) => <SelectItem key={tech} value={tech}>{tech}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Profundidade de descarga (%)</Label>
              <Input type="number" min="10" max="100" step="5" value={state.battery_config.depth_of_discharge_pct} onChange={(e) => setBatteryField("depth_of_discharge_pct", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Eficiência (%)</Label>
              <Input type="number" min="30" max="100" step="1" value={state.battery_config.efficiency_pct} onChange={(e) => setBatteryField("efficiency_pct", Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cargas prioritárias *</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLoad}><Plus className="h-3.5 w-3.5" /> Adicionar carga</Button>
            </div>
            {(state.battery_config.priority_loads || []).length === 0 && (
              <p className="text-xs font-semibold text-muted-foreground">Nenhuma carga adicionada. A autonomia depende das cargas que devem continuar ligadas sem rede.</p>
            )}
            {(state.battery_config.priority_loads || []).map((load, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_36px] gap-2">
                <Input placeholder="Nome do circuito/equipamento" value={load.name} onChange={(e) => updateLoad(index, "name", e.target.value)} />
                <Input type="number" min="0" step="10" placeholder="Potência (W)" value={load.power_w} onChange={(e) => updateLoad(index, "power_w", e.target.value)} />
                <button type="button" onClick={() => removeLoad(index)} className="flex items-center justify-center rounded-md text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {inverterExceeded && (
            <p className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              A soma das cargas prioritárias ({totalPriorityLoadW} W) ultrapassa a potência do inversor selecionado ({Number(state.inverter_kw) * 1000} W). Revise o inversor ou as cargas.
            </p>
          )}

          <div className="rounded-lg bg-muted/50 p-3 text-sm font-bold text-foreground">
            Autonomia estimada: {autonomyHours ? `${autonomyHours.toFixed(1)} horas` : "pendente — informe capacidade e cargas prioritárias"}
          </div>
        </div>
      )}
    </div>
  );
}
