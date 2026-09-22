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
import { BarChart3, CheckCircle2, Info, TrendingUp, Calendar } from "lucide-react";
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
  const isB1 = state.tariff_class === "B1 - Residencial" || state.tariff_class?.startsWith("B1") || state.tariff_class?.startsWith("B2");

  return (
    <div className="space-y-5">
      {/* 1. Banner de Sincronização do Histórico */}
      {hasHistory && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black text-emerald-950">
                {metrics.isCompleteAnnual
                  ? "Histórico anual completo (12 meses) importado"
                  : `Histórico de consumo importado (${metrics.validCount} meses identificados)`}
              </p>
              <p className="text-[11px] font-semibold text-emerald-800">
                Média calculada: <strong>{metrics.averageKwh.toLocaleString("pt-BR")} kWh/mês</strong>{" "}
                • {metrics.totalLabel}: <strong>{metrics.totalKwh.toLocaleString("pt-BR")} kWh</strong>
                {metrics.peakKwh > 0 && (
                  <span> • Pico: <strong>{metrics.peakKwh.toLocaleString("pt-BR")} kWh</strong></span>
                )}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 border-emerald-300 bg-white text-xs font-bold text-emerald-900 hover:bg-emerald-100 self-start sm:self-auto shadow-none"
            onClick={() => setHistoryModalOpen(true)}
          >
            <BarChart3 className="mr-1.5 h-4 w-4 text-emerald-700" /> Editar Histórico ({metrics.validCount}/12)
          </Button>
        </div>
      )}

      {/* 2. Campos Principais de Consumo e Tarifa */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">
            Consumo médio mensal (kWh) <span className="text-[#00d8b8] font-bold">*</span>
          </Label>
          <PtBrNumericInput
            value={state.monthly_consumption_kwh}
            onChange={(v) => {
              setField("monthly_consumption_kwh", v);
            }}
            placeholder="Ex: 450"
            suffix="kWh/mês"
            min={1}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">
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

      {/* 3. Modalidade Tarifária e Demanda Contratada */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-700">Modalidade tarifária</Label>
          <Select value={state.tariff_class} onValueChange={(v) => setField("tariff_class", v)}>
            <SelectTrigger className="h-11 font-medium bg-white border-slate-200 text-slate-900 rounded-xl">
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
          <Label className="text-xs font-bold text-slate-700">
            Demanda contratada (kW) {isB1 ? "— Não aplicável (B1)" : "— Grupo A/B3"}
          </Label>
          <PtBrNumericInput
            value={isB1 ? "" : state.contracted_demand_kw}
            onChange={(v) => setField("contracted_demand_kw", v)}
            placeholder={isB1 ? "Não aplicável para residencial B1" : "Ex: 30 kW"}
            suffix="kW"
            min={0}
            disabled={isB1}
          />
        </div>
      </div>

      {/* 4. Distribuidora de Energia */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-700">Distribuidora de energia</Label>
        <Input
          placeholder="Ex: Enel SP, CPFL, Cemig, Light, Copel, Equatorial, Neoenergia..."
          value={state.distributor || ""}
          onChange={(e) => setField("distributor", e.target.value)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 hover:border-slate-300 focus:border-[#00d8b8] focus:ring-2 focus:ring-[#00d8b8]/15 focus:outline-none transition-colors shadow-none"
        />
      </div>

      {/* 5. Mini Gráfico Resumo de Histórico quando disponível */}
      {hasHistory && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-[#00d8b8]" />
              Curva de Consumo Mensal Importada
            </span>
            <button
              type="button"
              onClick={() => setHistoryModalOpen(true)}
              className="text-xs font-bold text-[#00d8b8] hover:underline"
            >
              Ajustar valores
            </button>
          </div>

          <div className="flex h-24 items-end gap-1 sm:gap-2 pt-2 px-1">
            {metrics.entries.map((item, idx) => {
              const kwh = item.kwh !== null && item.kwh !== undefined ? Number(item.kwh) : null;
              const hasVal = kwh !== null;
              const maxVal = metrics.peakKwh > 0 ? metrics.peakKwh : 100;
              const heightPct = hasVal && kwh > 0 ? Math.max(15, Math.round((kwh / maxVal) * 100)) : 6;
              const isPeak = hasVal && kwh > 0 && kwh === metrics.peakKwh;

              return (
                <div key={idx} className="flex flex-1 flex-col items-center gap-1 group relative">
                  <div className="w-full flex items-end justify-center h-16">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[20px] rounded-t transition-all ${
                        hasVal
                          ? isPeak
                            ? "bg-[#00d8b8]"
                            : "bg-[#00d8b8]/70 group-hover:bg-[#00d8b8]"
                          : "bg-slate-200 border-dashed border-t border-slate-300"
                      }`}
                      title={`${item.month}: ${hasVal ? `${kwh} kWh` : "Não informado"}`}
                    />
                  </div>
                  <span className="text-[8px] font-bold text-slate-500 truncate max-w-[28px]">
                    {item.month?.split("/")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Rodapé Informativo */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs font-semibold text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Info className="h-4 w-4 text-[#00d8b8] shrink-0" />
          A economia financeira e a geração fotovoltaica são dimensionadas com base no consumo médio ({metrics.averageKwh || 0} kWh) e na tarifa informada.
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
