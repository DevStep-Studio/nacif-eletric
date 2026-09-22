import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Check,
  TrendingUp,
  Info,
  Calendar,
  Sparkles,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import {
  computeConsumptionMetrics,
  buildDefault12MonthTimeline,
  normalizeHistoryItem,
} from "@/lib/solarConsumptionEngine";
import PtBrNumericInput from "./PtBrNumericInput";

export default function SolarConsumptionHistoryModal({
  open,
  onOpenChange,
  history = [],
  onSave,
}) {
  const [localHistory, setLocalHistory] = useState([]);
  const [isApplying, setIsApplying] = useState(false);

  // Inicializa a linha do tempo de 12 meses sempre que o modal abre
  useEffect(() => {
    if (open) {
      if (Array.isArray(history) && history.length === 12) {
        setLocalHistory(history.map((h, i) => normalizeHistoryItem(h, `Mês ${i + 1}`)));
      } else {
        setLocalHistory(buildDefault12MonthTimeline(history || []));
      }
    }
  }, [open, history]);

  // Cálculos centralizados em tempo real a partir da Single Source of Truth
  const metrics = useMemo(() => {
    return computeConsumptionMetrics(localHistory);
  }, [localHistory]);

  const handleUpdateMonth = (index, rawValue) => {
    const updated = [...localHistory];
    const val = rawValue === "" || rawValue === null || rawValue === undefined ? null : Number(rawValue);
    updated[index] = {
      ...updated[index],
      kwh: val !== null && Number.isFinite(val) && val >= 0 ? val : null,
      source: "manual",
      is_valid: val !== null && val > 0,
    };
    setLocalHistory(updated);
  };

  const handleApplyAverageToEmpty = () => {
    if (metrics.averageKwh <= 0) return;
    const updated = localHistory.map((item) => {
      if (item.kwh === null || item.kwh === undefined || item.kwh === 0) {
        return {
          ...item,
          kwh: metrics.averageKwh,
          source: "manual",
          is_valid: true,
        };
      }
      return item;
    });
    setLocalHistory(updated);
  };

  const handleClearAll = () => {
    const updated = localHistory.map((item) => ({
      ...item,
      kwh: null,
      source: "manual",
      is_valid: false,
    }));
    setLocalHistory(updated);
  };

  const handleSave = async () => {
    setIsApplying(true);
    try {
      // Salva apenas registros válidos com mês e kWh
      const finalHistory = localHistory.map((item) => ({
        month: item.month,
        kwh: item.kwh,
        value_brl: item.value_brl || null,
        source: item.source || "manual",
        is_valid: item.kwh !== null && item.kwh > 0,
      }));

      const finalAvgKwh = metrics.averageKwh > 0 ? metrics.averageKwh : null;
      onSave?.(finalHistory, finalAvgKwh);
      onOpenChange(false);
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-slate-900">
              <BarChart3 className="h-5 w-5 text-[#00d8b8]" />
              Histórico de Consumo — Últimos 12 Meses
            </DialogTitle>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
              <Calendar className="h-3 w-3 text-slate-500" />
              {metrics.validCount} de 12 meses preenchidos
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            Confira, complete ou ajuste os consumos mensais (em kWh). As alterações atualizam automaticamente a média e o dimensionamento solar.
          </p>
        </DialogHeader>

        {/* 1. Indicadores Superiores (KPIs Reais e Precisos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Consumo Médio
            </span>
            <p className="text-xl font-black text-slate-900">
              {metrics.averageKwh > 0 ? (
                <>
                  {metrics.averageKwh.toLocaleString("pt-BR")}{" "}
                  <span className="text-xs font-bold text-slate-500">kWh/mês</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-400">Não informado</span>
              )}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              {metrics.validCount > 0
                ? `Média de ${metrics.validCount} ${metrics.validCount === 1 ? "mês válido" : "meses válidos"}`
                : "Sem meses válidos"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              {metrics.totalLabel}
            </span>
            <p className="text-xl font-black text-slate-900">
              {metrics.totalKwh > 0 ? (
                <>
                  {metrics.totalKwh.toLocaleString("pt-BR")}{" "}
                  <span className="text-xs font-bold text-slate-500">kWh</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-400">0 kWh</span>
              )}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              {metrics.hasHistory ? metrics.periodRangeText : "Aguardando preenchimento"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Pico de Consumo
            </span>
            <p className="text-xl font-black text-slate-900">
              {metrics.peakKwh > 0 ? (
                <>
                  {metrics.peakKwh.toLocaleString("pt-BR")}{" "}
                  <span className="text-xs font-bold text-slate-500">kWh</span>
                </>
              ) : (
                <span className="text-sm font-semibold text-slate-400">—</span>
              )}
            </p>
            <p className="text-[11px] font-semibold text-slate-500">
              {metrics.peakMonth ? `Ocorrido em ${metrics.peakMonth}` : "Nenhum pico registrado"}
            </p>
          </div>
        </div>

        {/* 2. Gráfico Mensal de Barras */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-[#00d8b8]" />
              Distribuição Mensal de Consumo (kWh)
            </span>
            {metrics.validCount > 0 && !metrics.isCompleteAnnual && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Histórico parcial ({metrics.validCount}/12 meses)
              </span>
            )}
          </div>

          {metrics.validCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
              <BarChart3 className="h-8 w-8 text-slate-300 mb-1.5" />
              <p className="text-xs font-bold text-slate-600">Nenhum consumo mensal informado ainda</p>
              <p className="text-[11px] text-slate-400 max-w-sm mt-0.5">
                Preencha os valores mensais na grade abaixo para visualizar o gráfico e calibrar a média anual.
              </p>
            </div>
          ) : (
            <div className="flex h-36 items-end gap-1.5 sm:gap-2 pt-4 px-1">
              {localHistory.map((item, index) => {
                const kwh = item.kwh !== null && item.kwh > 0 ? Number(item.kwh) : 0;
                const maxPeak = metrics.peakKwh > 0 ? metrics.peakKwh : 100;
                const heightPct = kwh > 0 ? Math.max(12, Math.round((kwh / maxPeak) * 100)) : 4;
                const isPeak = kwh > 0 && kwh === metrics.peakKwh;

                return (
                  <div key={index} className="flex flex-1 flex-col items-center gap-1 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute -top-7 hidden group-hover:flex items-center bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                      {item.month}: {kwh.toLocaleString("pt-BR")} kWh
                    </div>

                    <span className="text-[9px] font-bold text-slate-600 truncate w-full text-center">
                      {kwh > 0 ? kwh : "—"}
                    </span>

                    <div className="w-full flex items-end justify-center h-24">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[28px] rounded-t transition-all ${
                          kwh > 0
                            ? isPeak
                              ? "bg-[#00d8b8] shadow-sm"
                              : "bg-[#00d8b8]/75 group-hover:bg-[#00d8b8]"
                            : "bg-slate-200 border-dashed border-t border-slate-300"
                        }`}
                      />
                    </div>

                    <span className="text-[9px] font-bold text-slate-500">
                      {item.month?.split("/")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Grade de Edição dos 12 Meses */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-900">
              Valores Mensais Detalhados
            </span>
            <div className="flex items-center gap-2">
              {metrics.validCount > 0 && metrics.validCount < 12 && (
                <button
                  type="button"
                  onClick={handleApplyAverageToEmpty}
                  className="text-[11px] font-bold text-[#00d8b8] hover:underline flex items-center gap-1"
                  title="Preenche os meses vazios com a média atual calculada"
                >
                  <Sparkles className="h-3 w-3" /> Preencher vazios com média ({metrics.averageKwh} kWh)
                </button>
              )}
              {metrics.validCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Limpar
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {localHistory.map((item, index) => {
              const hasValue = item.kwh !== null && item.kwh !== undefined && item.kwh > 0;
              return (
                <div
                  key={index}
                  className={`flex flex-col justify-between rounded-xl border p-2.5 transition-colors ${
                    hasValue
                      ? "border-slate-200 bg-white"
                      : "border-slate-200/70 bg-slate-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black text-slate-800">{item.month}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        item.source === "extracted"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : hasValue
                          ? "bg-slate-100 text-slate-600"
                          : "text-slate-400"
                      }`}
                    >
                      {item.source === "extracted" ? "Extraído" : hasValue ? "Manual" : "Vazio"}
                    </span>
                  </div>

                  <PtBrNumericInput
                    value={item.kwh ?? ""}
                    onChange={(val) => handleUpdateMonth(index, val)}
                    placeholder="0"
                    suffix="kWh"
                    min={0}
                    className="h-9 text-xs font-bold"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isApplying}
            className="h-10 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isApplying}
            className="h-10 bg-[#00d8b8] text-slate-950 font-black hover:bg-[#00c4a7] transition-all shadow-none"
          >
            <Check className="mr-1.5 h-4 w-4 stroke-[2.5]" />
            {isApplying ? "Salvando..." : "Aplicar Histórico"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
