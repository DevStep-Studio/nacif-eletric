import { BarChart3, Clock3, Grid2X2, PiggyBank, Sparkles, Zap } from "lucide-react";

const formatKwp = (value) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp`;
const formatMwh = (value) => `${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh/ano`;
const formatBrl = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const formatYears = (value) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} anos`;

function MetricCard({ icon: Icon, label, value, pending, pendingReason }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/80 bg-white px-4 py-3.5 shadow-sm transition hover:border-primary/40">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
        {pending ? (
          <p className="truncate text-xs font-bold text-amber-600" title={pendingReason}>Pendente</p>
        ) : (
          <p className="truncate text-base font-black text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function ResultsBar({ results, investmentIsEstimated }) {
  const {
    installedKwp,
    panelCount,
    annualGenerationKwh,
    annualSavingsBrl,
    paybackYears,
  } = results;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Resultados Integrados
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          icon={Zap}
          label="Potência instalada"
          value={formatKwp(installedKwp)}
          pending={installedKwp <= 0}
          pendingReason="Defina a quantidade de módulos."
        />
        <MetricCard
          icon={Grid2X2}
          label="Módulos"
          value={`${panelCount} Módulos`}
          pending={panelCount <= 0}
          pendingReason="Escolha o método de entrada na etapa 1."
        />
        <MetricCard
          icon={BarChart3}
          label="Geração estimada"
          value={annualGenerationKwh ? formatMwh(annualGenerationKwh) : ""}
          pending={!annualGenerationKwh}
          pendingReason="Depende da potência instalada."
        />
        <MetricCard
          icon={PiggyBank}
          label="Economia estimada"
          value={annualSavingsBrl ? `${formatBrl(annualSavingsBrl)}/ano` : ""}
          pending={!annualSavingsBrl}
          pendingReason="Informe consumo e tarifa na etapa 2."
        />
        <MetricCard
          icon={Clock3}
          label="Payback simples"
          value={paybackYears ? formatYears(paybackYears) : ""}
          pending={!paybackYears}
          pendingReason="Depende do investimento."
        />
      </div>
    </div>
  );
}
