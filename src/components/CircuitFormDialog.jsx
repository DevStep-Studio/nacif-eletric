import { useEffect, useState } from "react";
import { backend } from "@/api/backendClient";
import { calcCircuit, getDefaultDemandFactor } from "@/lib/electricalEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cable, CircleGauge, Loader2, Plus, ShieldCheck, Sparkles, Zap } from "lucide-react";

const CIRCUIT_CATEGORIES = [
  "Iluminação", "Tomadas de Uso Geral", "Tomadas de Uso Específico",
  "Motor", "Ar Condicionado", "Chuveiro", "Forno", "Bomba Hidráulica",
  "Servidor", "CFTV", "Nobreak", "Carregador Veicular",
];

const SUPPLY_TYPES = ["Monofásico", "Bifásico", "Trifásico"];
const VOLTAGES = [127, 220, 380, 440, 480];
const METHODS = [
  "Eletroduto Embutido em Parede", "Eletroduto Aparente",
  "Cabo Multipolar Fixado", "Bandeja Perfurada",
  "Enterrado Direto no Solo", "Eletroduto Enterrado",
];
const TEMPS = [25, 30, 35, 40, 45, 50];

const DEMAND_PRESETS = [
  { label: "1.00 (Chuveiro / Luz / Contínuo)", value: 1.0 },
  { label: "0.85 (Ar Cond. / Servidor)", value: 0.85 },
  { label: "0.80 (TUE / Forno / Motor)", value: 0.80 },
  { label: "0.70 (TUG Geral / Micro-ondas)", value: 0.70 },
  { label: "0.60 (Uso Intermitente)", value: 0.60 },
];

const POWER_UNITS = ["W", "kW", "VA", "kVA", "cv", "HP"];

const EMPTY_CIRCUIT = {
  name: "", description: "", type: "Tomadas de Uso Geral",
  supply_type: "", voltage: "",
  power_w: "", power_unit: "W", efficiency: 0.85,
  power_factor: "", length_m: "",
  install_method: "Eletroduto Embutido em Parede",
  temp_ambient: 30, group_count: 1,
  point_count: 1, demand_factor: 0.70,
  wet_area: false,
};

const EQUIPMENT_KNOWLEDGE = [
  { keywords: ["ar condicionado", "split", "inverter"], btuMap: { "9000": 900, "12000": 1300, "18000": 1800, "24000": 2400, "30000": 3000, "36000": 3500 }, defaultPower: 1300, voltage: 220, supply: "Bifásico", fp: 0.92, demand_factor: 0.85 },
  { keywords: ["chuveiro"], defaultPower: 5500, voltage: 220, supply: "Monofásico", fp: 1.0, demand_factor: 1.0 },
  { keywords: ["microondas", "micro-ondas"], defaultPower: 1200, voltage: 220, supply: "Monofásico", fp: 0.95, demand_factor: 0.70 },
  { keywords: ["forno", "forno elétrico", "cooktop", "fogão"], defaultPower: 3000, voltage: 220, supply: "Monofásico", fp: 1.0, demand_factor: 0.80 },
  { keywords: ["motor", "motor trifásico", "motor elétrico"], defaultPower: 2200, voltage: 380, supply: "Trifásico", fp: 0.85, demand_factor: 0.80 },
  { keywords: ["bomba", "bomba hidráulica"], defaultPower: 1500, voltage: 220, supply: "Trifásico", fp: 0.85, demand_factor: 0.80 },
  { keywords: ["servidor", "rack", "data center"], defaultPower: 2000, voltage: 220, supply: "Monofásico", fp: 0.95, demand_factor: 0.85 },
  { keywords: ["nobreak", "ups"], defaultPower: 1500, voltage: 220, supply: "Monofásico", fp: 0.95, demand_factor: 0.85 },
  { keywords: ["carregador veicular", "ev", "carro elétrico", "eletroposto"], defaultPower: 7400, voltage: 220, supply: "Bifásico", fp: 0.98, demand_factor: 1.0 },
  { keywords: ["iluminação", "lâmpadas", "luminárias"], defaultPower: 1000, voltage: 127, supply: "Monofásico", fp: 0.92, demand_factor: 1.0 },
  { keywords: ["tomada", "tug"], defaultPower: 3000, voltage: 127, supply: "Monofásico", fp: 1.0, demand_factor: 0.70 },
  { keywords: ["tue"], defaultPower: 3000, voltage: 220, supply: "Monofásico", fp: 1.0, demand_factor: 0.80 },
  { keywords: ["cftv", "câmera", "câmeras", "nvr"], defaultPower: 400, voltage: 127, supply: "Monofásico", fp: 0.90, demand_factor: 0.80 },
];

function getInitialForm(initialData) {
  if (initialData) {
    const df = initialData.demand_factor !== undefined && initialData.demand_factor !== null
      ? initialData.demand_factor
      : getDefaultDemandFactor(initialData.type, initialData.name);
    return { ...EMPTY_CIRCUIT, ...initialData, demand_factor: df };
  }
  return { ...EMPTY_CIRCUIT };
}

function suggestFromKnowledge(name) {
  const lower = name.toLowerCase();
  const found = EQUIPMENT_KNOWLEDGE.find(e => e.keywords.some(k => lower.includes(k)));
  if (!found) return null;

  let power = found.defaultPower;
  if (found.btuMap) {
    const btuMatch = lower.match(/(\d+)\s*btu/);
    if (btuMatch && found.btuMap[btuMatch[1]]) power = found.btuMap[btuMatch[1]];
  }

  return {
    power_w: power,
    voltage: found.voltage,
    supply_type: found.supply,
    power_factor: found.fp,
    demand_factor: found.demand_factor || getDefaultDemandFactor("", name),
  };
}

function PreviewItem({ icon: Icon, label, value, detail, tone = "text-slate-950" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        {label}
      </div>
      <p className={`mt-1 text-base font-extrabold leading-tight ${tone}`}>{value}</p>
      {detail && <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{detail}</p>}
    </div>
  );
}

export default function CircuitFormDialog({ onSave, initialData, trigger, disabled = false }) {
  const [form, setForm] = useState(() => getInitialForm(initialData));
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleCategoryChange = (newType) => {
    const suggestedDf = getDefaultDemandFactor(newType, form.name);
    setForm(f => ({
      ...f,
      type: newType,
      demand_factor: suggestedDf,
    }));
  };

  useEffect(() => {
    if (form.power_w && form.voltage && form.supply_type) {
      setPreview(calcCircuit({
        ...form,
        power_w: Number(form.power_w),
        power_unit: form.power_unit || "W",
        efficiency: Number(form.efficiency) || 0.85,
        voltage: Number(form.voltage),
        demand_factor: Number(form.demand_factor) || getDefaultDemandFactor(form.type, form.name),
      }));
    } else {
      setPreview(null);
    }
  }, [form.power_w, form.power_unit, form.efficiency, form.voltage, form.supply_type, form.power_factor, form.length_m, form.temp_ambient, form.group_count, form.install_method, form.demand_factor, form.type]);

  useEffect(() => {
    if (!open) return;
    setForm(getInitialForm(initialData));
    setAiSuggestion(null);
  }, [initialData, open]);

  const applyAiSuggestion = async () => {
    if (!form.name.trim()) return;

    const local = suggestFromKnowledge(form.name);
    if (local) {
      setAiSuggestion(local);
      setForm(f => ({
        ...f,
        power_w: String(local.power_w),
        power_unit: "W",
        voltage: String(local.voltage),
        supply_type: local.supply_type,
        power_factor: String(local.power_factor),
        demand_factor: local.demand_factor ?? f.demand_factor,
      }));
      return;
    }

    setAiLoading(true);
    try {
      const res = await backend.integrations.Core.InvokeLLM({
        prompt: `Você é um engenheiro eletricista especialista em NBR 5410. Para o equipamento "${form.name}" da categoria "${form.type}", forneça a sugestão técnica elétrica incluindo fator de demanda.`,
        response_json_schema: {
          type: "object",
          properties: {
            power_w: { type: "number" },
            voltage: { type: "number", enum: [127, 220, 380, 440, 480] },
            supply_type: { type: "string", enum: ["Monofásico", "Bifásico", "Trifásico"] },
            power_factor: { type: "number" },
            demand_factor: { type: "number" },
            justification: { type: "string" },
          }
        }
      });

      if (res?.power_w) {
        setAiSuggestion(res);
        setForm(f => ({
          ...f,
          power_w: String(res.power_w),
          power_unit: "W",
          voltage: String(res.voltage),
          supply_type: res.supply_type,
          power_factor: String(res.power_factor),
          demand_factor: res.demand_factor || getDefaultDemandFactor(f.type, f.name),
        }));
      }
    } catch {
      setAiSuggestion({ justification: "Sugestão automática indisponível no momento." });
    } finally {
      setAiLoading(false);
    }
  };

  const canSave = form.name.trim() && form.voltage && form.supply_type;

  const handleSave = () => {
    const calc = calcCircuit({
      ...form,
      power_w: Number(form.power_w) || 0,
      power_unit: form.power_unit || "W",
      efficiency: Number(form.efficiency) || 0.85,
      voltage: Number(form.voltage),
      power_factor: Number(form.power_factor) || undefined,
      length_m: Number(form.length_m) || 15,
      demand_factor: Number(form.demand_factor) || getDefaultDemandFactor(form.type, form.name),
      group_count: Number(form.group_count) || 1,
      point_count: Number(form.point_count) || 1,
      temp_ambient: Number(form.temp_ambient) || 30,
    });

    onSave(calc);
    setForm(getInitialForm(null));
    setOpen(false);
  };

  const currentEffectivePower = Math.round((Number(form.power_w) || 0) * (Number(form.demand_factor) || 1));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {initialData ? "Editar circuito" : "Novo circuito"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-[#CDEFE8] bg-[#F8FBFD] p-3">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-extrabold text-[#0f1728]">Sugestão técnica automática</p>
              {aiSuggestion
                ? <p className="text-[11px] font-medium text-[#687386]">{aiSuggestion.justification || `${aiSuggestion.power_w}W · ${aiSuggestion.voltage}V · ${aiSuggestion.supply_type} (Fd: ${aiSuggestion.demand_factor || form.demand_factor}) - parâmetros aplicados`}</p>
                : <p className="text-[11px] font-medium text-[#687386]">Digite o nome do circuito/equipamento e clique em sugerir para preencher potência, tensão, fp e demanda.</p>}
            </div>
            <button
              type="button"
              onClick={applyAiSuggestion}
              disabled={aiLoading || !form.name.trim()}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-extrabold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? "Calculando..." : "Sugerir"}
            </button>
          </div>

          <section>
            <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Identificação</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="col-span-2 space-y-1">
                <Label>Nome do Circuito *</Label>
                <Input placeholder="Ex: Tomadas Cozinha" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Input placeholder="Descrição técnica do circuito" value={form.description} onChange={e => set("description", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.type} onValueChange={handleCategoryChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CIRCUIT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantidade de Pontos</Label>
                <Input type="number" min="1" value={form.point_count} onChange={e => set("point_count", Number(e.target.value))} />
              </div>
              <div className="col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  id="wet_area"
                  checked={!!form.wet_area}
                  onChange={e => set("wet_area", e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <div>
                  <label htmlFor="wet_area" className="text-sm font-extrabold cursor-pointer text-[#0f1728]">Área molhada</label>
                  <p className="text-[11px] font-medium text-muted-foreground">Banheiro, cozinha, lavanderia, área externa ou piscina. Reforça a exigência de DR 30mA.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              Alimentação elétrica
            </h3>
            <div className="grid gap-3 rounded-xl border border-[#CDEFE8] bg-[#F8FBFD] p-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipo de Alimentação *</Label>
                <Select value={form.supply_type} onValueChange={v => set("supply_type", v)}>
                  <SelectTrigger className={!form.supply_type ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>{SUPPLY_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                {!form.supply_type && <p className="text-[10px] text-destructive">Campo obrigatório</p>}
              </div>
              <div className="space-y-1">
                <Label>Tensão do Circuito *</Label>
                <Select value={String(form.voltage)} onValueChange={v => set("voltage", v)}>
                  <SelectTrigger className={!form.voltage ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>{VOLTAGES.map(v => <SelectItem key={v} value={String(v)}>{v}V</SelectItem>)}</SelectContent>
                </Select>
                {!form.voltage && <p className="text-[10px] text-destructive">Campo obrigatório</p>}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Carga e demanda (NBR 5410)</h3>
              {preview?.power_w > 0 && (
                <span className="text-xs font-bold text-primary">
                  {preview.power_w} W ({preview.power_va} VA) · Demanda: {preview.demand_power_w} W
                </span>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1 col-span-2">
                <Label>Potência Instalada</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Ex: 2000"
                    value={form.power_w}
                    onChange={e => set("power_w", e.target.value)}
                    className="flex-1"
                  />
                  <Select value={form.power_unit || "W"} onValueChange={v => set("power_unit", v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POWER_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Fator de Potência (fp)</Label>
                <Input type="number" step="0.01" min="0.1" max="1" placeholder="Ex: 0.92" value={form.power_factor} onChange={e => set("power_factor", e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Fator Demanda (Fd)</Label>
                  <span className="text-[10px] font-bold text-slate-500">Padrão: {getDefaultDemandFactor(form.type, form.name)}</span>
                </div>
                <Input type="number" step="0.05" min="0.05" max="1" placeholder="Ex: 0.70" value={form.demand_factor} onChange={e => set("demand_factor", e.target.value)} />
              </div>

              {(["cv", "HP"].includes(form.power_unit) || ["Motor", "Bomba Hidráulica"].includes(form.type)) && (
                <div className="space-y-1 col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Rendimento do Motor (η)</Label>
                    <span className="text-[10px] font-bold text-slate-500">Ex: 0.85 = 85%</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.4"
                    max="1.0"
                    placeholder="0.85"
                    value={form.efficiency ?? 0.85}
                    onChange={e => set("efficiency", Number(e.target.value))}
                  />
                </div>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 mr-1">Atalhos Fd:</span>
              {DEMAND_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => set("demand_factor", preset.value)}
                  className={`rounded-md border px-2 py-1 text-[10px] font-bold transition-colors ${
                    Number(form.demand_factor) === preset.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {preset.value}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Instalação</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 col-span-2">
                <Label>Método de Instalação</Label>
                <Select value={form.install_method} onValueChange={v => set("install_method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Distância / Comprimento (m)</Label>
                <Input type="number" min="1" placeholder="Ex: 15" value={form.length_m} onChange={e => set("length_m", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Temperatura Ambiente (°C)</Label>
                <Select value={String(form.temp_ambient)} onValueChange={v => set("temp_ambient", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TEMPS.map(t => <SelectItem key={t} value={String(t)}>{t}°C</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantidade de Circuitos Agrupados</Label>
                <Input type="number" min="1" max="9" value={form.group_count} onChange={e => set("group_count", Number(e.target.value))} />
              </div>
            </div>
          </section>

          {preview && (
            <section className="space-y-3 rounded-xl border border-[#CDEFE8] bg-[#F8FBFD] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#0f1728]">Dimensionamento NBR 5410</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">
                    Demanda: {preview.demand_power_w} W (Fd {preview.demand_factor})
                  </Badge>
                  {preview.needs_dr && <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">DR 30mA</Badge>}
                  <Badge className="bg-blue-50 text-blue-700 text-[10px]">DPS previsto</Badge>
                  <Badge className={preview.voltage_drop_ok ? "bg-emerald-50 text-emerald-700 text-[10px]" : "bg-red-50 text-red-700 text-[10px]"}>
                    Queda {preview.voltage_drop_ok ? "OK" : "revisar"}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-3 text-xs md:grid-cols-4">
                <PreviewItem
                  icon={CircleGauge}
                  label="Corrente de Projeto (Ib)"
                  value={`${preview.project_current_a} A`}
                  detail={`${preview.nominal_current_a} A nominal (${preview.corrected_current_a} A corrigida)`}
                  tone="text-primary"
                />
                <PreviewItem icon={Cable} label="Condutor" value={preview.wire_gauge} detail={`mín. ${preview.minimum_wire_area}mm²`} />
                <PreviewItem icon={ShieldCheck} label="Proteção" value={`${preview.breaker_a}A ${preview.breaker_poles}P/${preview.breaker_curve}`} detail={`${preview.breaking_capacity_ka} kA`} />
                <PreviewItem
                  icon={Zap}
                  label="Queda ΔU"
                  value={`${preview.voltage_drop_pct}%`}
                  detail={`${preview.voltage_drop_v} V em ${Number(form.length_m) || 15} m`}
                  tone={preview.voltage_drop_ok ? "text-slate-950" : "text-red-600"}
                />
                <PreviewItem icon={Sparkles} label="Correções" value={`Ft ${preview.temp_factor}`} detail={`Fg ${preview.group_factor}`} />
                <PreviewItem icon={Plus} label="Quadro" value={`${preview.din_modules} DIN`} detail="ocupação estimada" />
              </div>
            </section>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} className="font-bold">Cancelar</Button>
            <Button onClick={handleSave} disabled={!canSave} className="font-extrabold">
              <Plus className="w-4 h-4 mr-1" />{initialData ? "Atualizar circuito" : "Salvar circuito"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
