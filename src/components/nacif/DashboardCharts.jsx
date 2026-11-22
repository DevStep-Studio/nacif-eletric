import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import EmptyState from "./EmptyState";

const formatCurrencyBrl = (val) =>
  `R$ ${Number(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function CustomBarTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const val = unit === "kva" ? item.powerKva : item.powerKw;
  return (
    <div className="rounded-xl border border-white/10 bg-[#031923] px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-extrabold text-[#00F0A0]">
        {Number(val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
        {unit === "kva" ? "kVA" : "kW"}
      </p>
      <p className="mt-0.5 max-w-[160px] truncate text-[11px] font-medium text-slate-200">{item.name}</p>
      <p className="text-[10px] text-slate-400">{item.fullDate}</p>
    </div>
  );
}

function CustomAreaTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const val = metric === "cost" ? item.budget : item.demandKw;
  return (
    <div className="rounded-xl border border-white/10 bg-[#031923] px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-extrabold text-[#00F0A0]">
        {metric === "cost"
          ? formatCurrencyBrl(val)
          : `${Number(val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`}
      </p>
      <p className="mt-0.5 max-w-[160px] truncate text-[11px] font-medium text-slate-200">{item.name}</p>
      <p className="text-[10px] text-slate-400">{item.fullDate}</p>
    </div>
  );
}

export function LoadsBarChartCard({ charts, unit = "kva", onUnitChange }) {
  const series = charts?.series || [];
  const dataKey = unit === "kva" ? "powerKva" : "powerKw";
  const maxVal = series.reduce((max, s) => Math.max(max, Number(s[dataKey] || 0)), 0);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <h3 className="text-[13px] font-bold text-[#101828]">Cargas dimensionadas</h3>
            <span className="text-[11px] font-medium text-[#64748B]">
              ({unit === "kva" ? "Potência aparente" : "Potência ativa"})
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Sobre o gráfico de cargas" className="text-[#94A3B8] hover:text-[#101828]">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Somatório das cargas por projeto no período selecionado, com base nos cálculos da NBR 5410.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-0.5 text-[21px] font-extrabold tracking-tight text-[#101828] tabular-nums leading-tight">
            {unit === "kva"
              ? `${Number(charts?.totalKva || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kVA`
              : `${Number(charts?.totalKw || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`}
          </p>
        </div>

        <div className="inline-flex shrink-0 rounded-full border border-[#E5EBF1] bg-[#F6F9FC] p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onUnitChange?.("kva")}
            className={`rounded-full px-2.5 py-0.5 transition ${
              unit === "kva" ? "bg-[#00D98A] text-[#031923]" : "text-[#64748B] hover:text-[#101828]"
            }`}
          >
            kVA
          </button>
          <button
            type="button"
            onClick={() => onUnitChange?.("kw")}
            className={`rounded-full px-2.5 py-0.5 transition ${
              unit === "kw" ? "bg-[#00D98A] text-[#031923]" : "text-[#64748B] hover:text-[#101828]"
            }`}
          >
            kW
          </button>
        </div>
      </div>

      <div className="mt-2 h-[120px] w-full">
        {charts?.isEmpty ? (
          <EmptyState
            title="Sem projetos no período"
            description="Ajuste o filtro ou cadastre circuitos."
            className="h-full py-2"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5EBF1" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }}
              />
              <RechartsTooltip cursor={{ fill: "rgba(0, 217, 138, 0.06)" }} content={<CustomBarTooltip unit={unit} />} />
              <Bar dataKey={dataKey} radius={[7, 7, 2, 2]} maxBarSize={24}>
                {series.map((entry, idx) => {
                  const isMax = Number(entry[dataKey] || 0) === maxVal && maxVal > 0;
                  return <Cell key={entry.id || idx} fill={isMax ? "#00D98A" : "#C5F6E3"} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function AverageDemandAreaChartCard({ charts, metric = "demand", onMetricChange }) {
  const series = charts?.series || [];
  const canToggleBudget = Boolean(charts?.hasBudgetData);
  const activeMetric = metric === "cost" && canToggleBudget ? "cost" : "demand";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h3 className="text-[13px] font-bold text-[#101828]">
              {activeMetric === "cost" ? "Orçamento médio estimado" : "Demanda média estimada"}
            </h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Sobre o gráfico de demanda" className="text-[#94A3B8] hover:text-[#101828]">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Média calculada sobre os projetos válidos no período selecionado. A opção R$ só é habilitada quando há orçamentos reais calculados.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-0.5 text-[21px] font-extrabold tracking-tight text-[#101828] tabular-nums leading-tight">
            {activeMetric === "cost"
              ? formatCurrencyBrl(charts?.avgBudget || 0)
              : `${Number(charts?.avgDemandKw || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`}
          </p>
        </div>

        <div className="inline-flex shrink-0 rounded-full border border-[#E5EBF1] bg-[#F6F9FC] p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onMetricChange?.("demand")}
            className={`rounded-full px-2.5 py-0.5 transition ${
              activeMetric === "demand" ? "bg-[#00D98A] text-[#031923]" : "text-[#64748B] hover:text-[#101828]"
            }`}
          >
            kW
          </button>
          <button
            type="button"
            disabled={!canToggleBudget}
            title={canToggleBudget ? "Exibir média financeira em R$" : "Requer projetos com orçamento calculado"}
            onClick={() => canToggleBudget && onMetricChange?.("cost")}
            className={`rounded-full px-2.5 py-0.5 transition ${
              activeMetric === "cost"
                ? "bg-[#00D98A] text-[#031923]"
                : canToggleBudget
                ? "text-[#64748B] hover:text-[#101828]"
                : "cursor-not-allowed opacity-45 text-[#94A3B8]"
            }`}
          >
            R$
          </button>
        </div>
      </div>

      <div className="mt-2 h-[120px] w-full">
        {charts?.isEmpty ? (
          <EmptyState
            title="Sem série no período"
            description="Nenhum dado para a janela selecionada."
            className="h-full py-2"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="nacifDemandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D98A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00D98A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5EBF1" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }}
              />
              <RechartsTooltip content={<CustomAreaTooltip metric={activeMetric} />} />
              <Area
                type="monotone"
                dataKey={activeMetric === "cost" ? "budget" : "demandKw"}
                stroke="#00D98A"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#nacifDemandGradient)"
                dot={series.length <= 2 ? { r: 4, fill: "#00D98A", stroke: "#031923", strokeWidth: 2 } : false}
                activeDot={{ r: 5, fill: "#031923", stroke: "#00F0A0", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
