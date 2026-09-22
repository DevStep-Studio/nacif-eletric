import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, CheckCircle2, Info } from "lucide-react";
import PtBrNumericInput from "./PtBrNumericInput";
import SolarConsumptionHistoryModal from "./SolarConsumptionHistoryModal";
import { computeConsumptionMetrics } from "@/lib/solarConsumptionEngine";

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

  const metrics = useMemo(() => {
    return computeConsumptionMetrics(state.bill_history_12_months, state.monthly_consumption_kwh);
  }, [state.bill_history_12_months, state.monthly_consumption_kwh]);

  const hasHistory = metrics.validCount > 0;

  return (
    <div className="space-y-5">
      {hasHistory && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black text-emerald-950">
                {metrics.isCompleteAnnual
                  ? "Histórico anual completo (12 meses) importado"
                  : `Histórico de consumo importado (${metrics.validCount} meses)`}
              </p>
              <p className="text-[11px] font-semibold text-emerald-800">
                Média calculada: <strong>{metrics.averageKwh.toLocaleString("pt-BR")} kWh/mês</strong>{" "}
                • {metrics.totalLabel}: <strong>{metrics.totalKwh.toLocaleString("pt-BR")} kWh</strong>
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
            <BarChart3 className="mr-1 h-3.5 w-3.5" /> Editar Histórico ({metrics.validCount}/12)
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-black text-foreground">
            Consumo médio mensal (kWh) <span className="text-[#00d8b8] font-bold">*</span>
          </Label>
          <PtBrNumericInput
            value={state.monthly_consumption_kwh}
            onChange={(v) => setField("monthly_consumption_kwh", v)}
            placeholder="Ex: 450"
            suffix="kWh/mês"
            min={1}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-black text-foreground">
            Tarifa de energia (R$/kWh) <span className="text-[#00d8b8] font-bold">*</span>
          </Label>
          <PtBrNumericInput
            value={state.tariff_brl_kwh}
            onChange={(v) => setField("tariff_brl_kwh", v)}
            placeholder="Ex: 0,95"
            suffix="R$/kWh"
            min={0.1}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-black text-foreground">Modalidade tarifária</Label>
          <Select value={state.tariff_class} onValueChange={(v) => setField("tariff_class", v)}>
            <SelectTrigger className="h-11 font-medium bg-white border-slate-200">
              <SelectValue placeholder="Selecione a classe" />
            </SelectTrigger>
            <SelectContent>
              {TARIFF_CLASSES.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-black text-foreground">Demanda contratada (kW) — se aplicável</Label>
          <PtBrNumericInput
            value={state.contracted_demand_kw}
            onChange={(v) => setField("contracted_demand_kw", v)}
            placeholder={state.tariff_class?.startsWith("A4") ? "Ex: 30 (Média tensão)" : "Não aplicável para grupo B"}
            suffix="kW"
            min={0}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-black text-foreground">Distribuidora de energia</Label>
        <Input
          placeholder="Ex: Enel SP, CPFL, Cemig, Light, Copel, Equatorial..."
          value={state.distributor || ""}
          onChange={(e) => setField("distributor", e.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs font-semibold text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Info className="h-4 w-4 text-[#00d8b8] shrink-0" />
          A economia anual e o dimensionamento fotovoltaico são calculados com base no consumo e na tarifa informada.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setHistoryModalOpen(true)}
          className="h-7 text-xs font-bold text-[#00d8b8] hover:bg-[#00d8b8]/10 self-start sm:self-auto"
        >
          <BarChart3 className="mr-1 h-3.5 w-3.5" />
          {hasHistory ? `Ver histórico (${metrics.validCount}/12)` : "Preencher 12 meses"}
        </Button>
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
