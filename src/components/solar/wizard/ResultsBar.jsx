import { BarChart3, Clock3, Grid2X2, PiggyBank, Zap } from "lucide-react";

const formatKwp = (value) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp`;
const formatMwh = (value) => `${(value / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh/ano`;
const formatBrl = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const formatYears = (value) => `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} anos`;

function Metric({ icon: Icon, label, value, pending, pendingReason }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{label}</p>
        {pending ? (
          <p className="truncate text-sm font-bold text-amber-600" title={pendingReason}>Pendente</p>
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric icon={Zap} label="Potência instalada" value={formatKwp(installedKwp)} pending={installedKwp <= 0} pendingReason="Defina a quantidade de módulos." />
        <Metric icon={Grid2X2} label="Módulos" value={`${panelCount} unidades`} pending={panelCount <= 0} pendingReason="Escolha o método de entrada na etapa 1." />
        <Metric
          icon={BarChart3}
          label="Geração estimada"
          value={annualGenerationKwh ? formatMwh(annualGenerationKwh) : ""}
          pending={!annualGenerationKwh}
          pendingReason="Depende da potência instalada."
        />
        <Metric
          icon={PiggyBank}
          label="Economia estimada"
          value={annualSavingsBrl ? `${formatBrl(annualSavingsBrl)}/ano` : ""}
          pending={!annualSavingsBrl}
          pendingReason="Informe consumo médio e tarifa na etapa 2."
        />
        <Metric
          icon={Clock3}
          label="Payback simples"
          value={paybackYears ? formatYears(paybackYears) : ""}
          pending={!paybackYears}
          pendingReason="Depende da economia estimada e do investimento."
        />
      </div>
      <p className="px-1 text-[11px] font-semibold text-muted-foreground">
        Estimativas calculadas com premissas configuráveis (irradiação, perdas do sistema, tarifa e{" "}
        {investmentIsEstimated ? "investimento estimado por R$/Wp" : "investimento informado"}). Ajustáveis na etapa 6 — Projeto.
      </p>
    </div>
  );
}
