import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BatteryCharging, Check, Clock, Plus, ShieldCheck, Trash2, Zap } from "lucide-react";
import { estimateBatteryAutonomyHours } from "@/lib/solarSizing";

const PRESET_LOADS = [
  { name: "Geladeira / Freezer Frost-Free", power_w: 250, icon: "❄️" },
  { name: "Roteador Wi-Fi & Fibra", power_w: 30, icon: "📶" },
  { name: "Iluminação LED de Emergência", power_w: 150, icon: "💡" },
  { name: "Portão Eletrônico + CFTV", power_w: 120, icon: "📹" },
  { name: "Servidor / Computadores", power_w: 400, icon: "💻" },
  { name: "Bomba D'água 1/2 CV", power_w: 550, icon: "🚰" },
];

export default function SolarPriorityLoadsModal({ open, onOpenChange, batteryConfig, inverterKw, onSave }) {
  const [capacityKwh, setCapacityKwh] = useState(batteryConfig?.capacity_kwh || "10");
  const [technology, setTechnology] = useState(batteryConfig?.technology || "Íon-lítio");
  const [loads, setLoads] = useState(
    Array.isArray(batteryConfig?.priority_loads) && batteryConfig.priority_loads.length > 0
      ? batteryConfig.priority_loads
      : [
          { name: "Geladeira / Freezer", power_w: 250 },
          { name: "Iluminação essencial", power_w: 180 },
          { name: "Roteador Wi-Fi & CFTV", power_w: 80 },
        ]
  );

  const totalLoadW = loads.reduce((sum, item) => sum + (Number(item.power_w) || 0), 0);
  const autonomyHours = estimateBatteryAutonomyHours({
    capacityKwh: Number(capacityKwh) || 10,
    depthOfDischargePct: batteryConfig?.depth_of_discharge_pct || 80,
    efficiencyPct: batteryConfig?.efficiency_pct || 90,
    priorityLoadsW: loads.map((l) => Number(l.power_w) || 0),
  });

  const addLoad = (preset) => {
    setLoads([...loads, { name: preset?.name || "", power_w: preset?.power_w || "" }]);
  };

  const updateLoad = (index, field, value) => {
    const next = [...loads];
    next[index] = { ...next[index], [field]: value };
    setLoads(next);
  };

  const removeLoad = (index) => {
    setLoads(loads.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave?.({
      ...batteryConfig,
      capacity_kwh: capacityKwh,
      technology,
      priority_loads: loads.filter((l) => l.name && Number(l.power_w) > 0),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Configurar Cargas Prioritárias (Backup por Bateria)
          </DialogTitle>
          <p className="text-xs font-semibold text-muted-foreground">
            Defina os circuitos essenciais que continuarão funcionando em caso de queda da rede elétrica.
          </p>
        </DialogHeader>

        {/* Indicador de Autonomia e Capacidade */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-800">Capacidade da Bateria</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <BatteryCharging className="h-4 w-4 text-emerald-700" />
              <Input
                type="number"
                min="1"
                step="0.5"
                className="h-7 w-20 bg-white text-xs font-black text-emerald-950"
                value={capacityKwh}
                onChange={(e) => setCapacityKwh(e.target.value)}
              />
              <span className="text-xs font-bold text-emerald-900">kWh</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-800">Carga Prioritária Total</p>
            <p className="mt-1 text-base font-black text-emerald-950 flex items-center gap-1">
              <Zap className="h-4 w-4 text-emerald-600" />
              {totalLoadW} <span className="text-xs font-bold text-emerald-800">W</span>
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[10px] font-black uppercase text-emerald-800">Autonomia Estimada</p>
            <p className="mt-1 text-base font-black text-emerald-950 flex items-center gap-1">
              <Clock className="h-4 w-4 text-emerald-600" />
              {autonomyHours ? `${autonomyHours.toFixed(1)} horas` : "—"}
            </p>
          </div>
        </div>

        {/* Presets Rápidos */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground">Adicionar circuitos comuns:</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_LOADS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => addLoad(preset)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-bold text-foreground transition hover:border-primary/50 hover:bg-primary/5"
              >
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
                <span className="text-[10px] font-extrabold text-muted-foreground">({preset.power_w}W)</span>
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Cargas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-extrabold">Lista de Cargas Configuradas</Label>
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs font-bold" onClick={() => addLoad()}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar Manual
            </Button>
          </div>

          <div className="space-y-2">
            {loads.map((load, index) => (
              <div key={index} className="grid grid-cols-[1fr_110px_36px] gap-2 items-center">
                <Input
                  placeholder="Nome do circuito ou equipamento"
                  className="h-9 text-xs font-semibold"
                  value={load.name}
                  onChange={(e) => updateLoad(index, "name", e.target.value)}
                />
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="Potência"
                    className="h-9 pr-6 text-xs font-bold"
                    value={load.power_w}
                    onChange={(e) => updateLoad(index, "power_w", e.target.value)}
                  />
                  <span className="absolute right-2 top-2.5 text-[10px] font-bold text-muted-foreground">W</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeLoad(index)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 transition"
                  title="Remover carga"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} className="font-bold">
            <Check className="mr-1.5 h-4 w-4" /> Salvar Configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
