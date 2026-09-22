import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, CheckCircle2, FileText, Sparkles } from "lucide-react";
import SolarConsumptionHistoryModal from "./SolarConsumptionHistoryModal";

const TARIFF_CLASSES = [
  "B1 - Residencial",
  "B2 - Rural",
  "B3 - Comercial/Industrial (baixa tensão)",
  "A4 - Verde (média tensão)",
  "A4 - Azul (média tensão)",
];

export default function StepConsumo({ state, onChange }) {
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const setField = (field, value) => onChange({ [field]: value });

  const hasHistory = Array.isArray(state.bill_history_12_months) && state.bill_history_12_months.length > 0;

  return (
    <div className="space-y-5">
      {hasHistory && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black text-emerald-950">Histórico de 12 meses importado com sucesso</p>
              <p className="text-[11px] font-semibold text-emerald-800">
                Média calculada: <strong>{state.monthly_consumption_kwh || 842} kWh/mês</strong>
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-emerald-300 bg-white text-xs font-bold text-emerald-900 hover:bg-emerald-100"
            onClick={() => setHistoryModalOpen(true)}
          >
            <BarChart3 className="mr-1 h-3.5 w-3.5" /> Editar Histórico
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-extrabold">Consumo médio mensal (kWh) *</Label>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Ex: 842"
            value={state.monthly_consumption_kwh}
            onChange={(e) => setField("monthly_consumption_kwh", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-extrabold">Tarifa de energia (R$/kWh) *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex: 0,95"
            value={state.tariff_brl_kwh}
            onChange={(e) => setField("tariff_brl_kwh", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-extrabold">Modalidade tarifária</Label>
          <Select value={state.tariff_class} onValueChange={(v) => setField("tariff_class", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TARIFF_CLASSES.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-extrabold">Demanda contratada (kW) — se aplicável</Label>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Ex: 15 (grupo A ou tarifação por demanda)"
            value={state.contracted_demand_kw}
            onChange={(e) => setField("contracted_demand_kw", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-extrabold">Distribuidora de Energia</Label>
        <Input
          placeholder="Ex: Enel SP, CPFL, Cemig, Light, Copel..."
          value={state.distributor}
          onChange={(e) => setField("distributor", e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-xs font-semibold text-muted-foreground">
        <p>
          A economia anual e o payback do projeto consideram este consumo e a tarifa informada.
        </p>
        {!hasHistory && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHistoryModalOpen(true)}
            className="h-7 text-xs font-bold text-primary hover:bg-primary/10"
          >
            <BarChart3 className="mr-1 h-3.5 w-3.5" /> Preencher 12 meses
          </Button>
        )}
      </div>

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
    </div>
  );
}
