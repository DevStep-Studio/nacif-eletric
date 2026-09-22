import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, Calendar, Check, TrendingUp } from "lucide-react";

export default function SolarConsumptionHistoryModal({ open, onOpenChange, history = [], onSave }) {
  const [localHistory, setLocalHistory] = useState(history);

  // Sincroniza quando abrir
  const handleOpenChange = (isOpen) => {
    if (isOpen) {
      setLocalHistory(
        Array.isArray(history) && history.length === 12
          ? history
          : generateDefaultMonths(history)
      );
    }
    onOpenChange(isOpen);
  };

  const updateMonth = (index, field, value) => {
    const updated = [...localHistory];
    updated[index] = { ...updated[index], [field]: Number(value) || 0 };
    setLocalHistory(updated);
  };

  const totalKwh = localHistory.reduce((sum, item) => sum + (Number(item.kwh) || 0), 0);
  const avgKwh = localHistory.length > 0 ? Math.round(totalKwh / localHistory.length) : 0;
  const maxKwh = Math.max(...localHistory.map((item) => Number(item.kwh) || 0), 1);

  const handleSave = () => {
    onSave?.(localHistory, avgKwh);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            <BarChart3 className="h-5 w-5 text-primary" />
            Histórico de Consumo (Últimos 12 Meses)
          </DialogTitle>
          <p className="text-xs font-semibold text-muted-foreground">
            Visualize e edite os valores extraídos da conta de energia para refinar a média e o dimensionamento.
          </p>
        </DialogHeader>

        {/* Resumo executivo do histórico */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/80 bg-muted/30 p-3 sm:grid-cols-3">
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Consumo Médio</p>
            <p className="text-lg font-black text-primary">{avgKwh.toLocaleString("pt-BR")} <span className="text-xs">kWh/mês</span></p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Total Anual</p>
            <p className="text-lg font-black text-foreground">{totalKwh.toLocaleString("pt-BR")} <span className="text-xs">kWh/ano</span></p>
          </div>
          <div className="col-span-2 space-y-0.5 sm:col-span-1">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Pico de Consumo</p>
            <p className="text-lg font-black text-amber-600">{maxKwh.toLocaleString("pt-BR")} <span className="text-xs">kWh</span></p>
          </div>
        </div>

        {/* Gráfico simplificado de barras */}
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="mb-3 text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> Distribuição Mensal (kWh)
          </p>
          <div className="flex h-28 items-end gap-1.5 pt-2">
            {localHistory.map((item, index) => {
              const kwh = Number(item.kwh) || 0;
              const heightPct = Math.max(8, Math.round((kwh / maxKwh) * 100));
              return (
                <div key={index} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-muted-foreground">{kwh}</span>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                    title={`${item.month}: ${kwh} kWh`}
                  />
                  <span className="text-[8px] font-bold text-muted-foreground">{item.month?.split("/")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabela de edição rápida */}
        <div className="space-y-2">
          <p className="text-xs font-extrabold text-foreground">Valores Mensais Detalhados</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {localHistory.map((item, index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                <span className="w-14 shrink-0 text-xs font-bold text-foreground">{item.month}</span>
                <Input
                  type="number"
                  min="0"
                  step="10"
                  className="h-8 text-xs font-bold"
                  value={item.kwh}
                  onChange={(e) => updateMonth(index, "kwh", e.target.value)}
                />
                <span className="text-[10px] font-semibold text-muted-foreground">kWh</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} className="font-bold">
            <Check className="mr-1.5 h-4 w-4" /> Aplicar Histórico
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateDefaultMonths(existing = []) {
  const months = ["Out/24", "Nov/24", "Dez/24", "Jan/25", "Fev/25", "Mar/25", "Abr/25", "Mai/25", "Jun/25", "Jul/25", "Ago/25", "Set/25"];
  return months.map((month, i) => {
    const existingVal = existing[i]?.kwh || 842;
    return {
      month,
      kwh: existingVal,
      value_brl: Math.round(existingVal * 0.95 * 100) / 100,
    };
  });
}
