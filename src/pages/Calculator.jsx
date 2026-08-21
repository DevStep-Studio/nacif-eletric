import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator as CalcIcon, Zap, Cable } from "lucide-react";
import { motion } from "framer-motion";
import PageHeader from "@/components/PageHeader";

function calcDemand(power, simultaneity) {
  return power * (simultaneity / 100);
}

function calcCurrent(power, voltage, fp, phases) {
  if (phases === 3) return power / (Math.sqrt(3) * voltage * fp);
  return power / (voltage * fp);
}

function calcVoltageDrop(current, length, area, voltage) {
  const resistivity = 0.0172; // cobre
  const drop = (2 * resistivity * length * current) / area;
  return (drop / voltage) * 100;
}

function getWireGauge(current) {
  const gauges = [
    { area: 1.5, max: 10 }, { area: 2.5, max: 16 }, { area: 4, max: 21 },
    { area: 6, max: 32 }, { area: 10, max: 40 }, { area: 16, max: 56 },
    { area: 25, max: 68 }, { area: 35, max: 84 }, { area: 50, max: 107 },
    { area: 70, max: 135 }, { area: 95, max: 164 }, { area: 120, max: 188 },
  ];
  const g = gauges.find(g => current <= g.max);
  return g || gauges[gauges.length - 1];
}

function getBreaker(current) {
  const breakers = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
  return breakers.find(b => b >= current * 1.15) || breakers[breakers.length - 1];
}

export default function CalculatorPage() {
  const [form, setForm] = useState({ power: 1000, voltage: 220, fp: 1, length: 10, simultaneity: 70, phases: 1 });
  const [result, setResult] = useState(null);

  const calculate = () => {
    const demand = calcDemand(form.power, form.simultaneity);
    const current = calcCurrent(demand, form.voltage, form.fp, form.phases);
    const gauge = getWireGauge(current);
    const vDrop = calcVoltageDrop(current, form.length, gauge.area, form.voltage);
    const breaker = getBreaker(current);
    setResult({ demand: Math.round(demand), current: current.toFixed(2), gauge: `${gauge.area}mm²`, maxCurrent: gauge.max, voltageDrop: vDrop.toFixed(2), breaker: `${breaker}A` });
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
      <PageHeader
        icon={CalcIcon}
        title="Cálculo Inteligente"
        subtitle="Dimensionamento rápido conforme NBR 5410 e NBR 14039."
      />

      <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Potência (W)</Label><Input type="number" value={form.power} onChange={e => setForm({...form, power: Number(e.target.value)})} /></div>
          <div><Label>Tensão (V)</Label>
            <Select value={String(form.voltage)} onValueChange={v => setForm({...form, voltage: Number(v)})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="127">127V</SelectItem><SelectItem value="220">220V</SelectItem><SelectItem value="380">380V</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Fator de Potência</Label><Input type="number" step="0.01" value={form.fp} onChange={e => setForm({...form, fp: Number(e.target.value)})} /></div>
          <div><Label>Comprimento (m)</Label><Input type="number" value={form.length} onChange={e => setForm({...form, length: Number(e.target.value)})} /></div>
          <div><Label>Simultaneidade (%)</Label><Input type="number" value={form.simultaneity} onChange={e => setForm({...form, simultaneity: Number(e.target.value)})} /></div>
          <div><Label>Fases</Label>
            <Select value={String(form.phases)} onValueChange={v => setForm({...form, phases: Number(v)})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">Monofásico</SelectItem><SelectItem value="3">Trifásico</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={calculate} className="w-full"><Zap className="w-4 h-4 mr-2" />Calcular</Button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "Demanda", value: `${result.demand}W`, icon: Zap },
            { label: "Corrente", value: `${result.current}A`, icon: Zap },
            { label: "Bitola Mínima", value: result.gauge, icon: Cable },
            { label: "Queda de Tensão", value: `${result.voltageDrop}%`, icon: Zap },
            { label: "Disjuntor", value: result.breaker, icon: Zap },
            { label: "Capacidade Fio", value: `${result.maxCurrent}A`, icon: Cable },
          ].map((r, i) => (
            <div key={i} className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="text-xl font-bold text-primary mt-1">{r.value}</p>
            </div>
          ))}
        </motion.div>
      )}
      </div>
    </div>
  );
}
