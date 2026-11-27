import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
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
    <div className="rounded-xl border border-white/10 bg-[#031923] px-3.5 py-2.5 text-xs text-white shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="font-extrabold text-[#00F0A0] text-sm">
          {Number(val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
          {unit === "kva" ? "kVA" : "kW"}
        </p>
        {item.projectCount > 1 && (
          <span className="rounded-full bg-[#00F0A0]/20 px-2 py-0.5 text-[10px] font-bold text-[#00F0A0]">
            {item.projectCount} projetos
          </span>
        )}
      </div>
      <p className="mt-1 max-w-[220px] truncate text-[11px] font-medium text-slate-200">{item.name}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{item.fullDate}</p>
    </div>
  );
}

function CustomAreaTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const val = metric === "cost" ? item.budget : item.demandKw;
  return (
    <div className="rounded-xl border border-white/10 bg-[#031923] px-3.5 py-2.5 text-xs text-white shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="font-extrabold text-[#00F0A0] text-sm">
          {metric === "cost"
            ? formatCurrencyBrl(val)
            : `${Number(val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`}
        </p>
        {item.projectCount > 1 && (
          <span className="rounded-full bg-[#00F0A0]/20 px-2 py-0.5 text-[10px] font-bold text-[#00F0A0]">
            {item.projectCount} projetos
          </span>
        )}
      </div>
      <p className="mt-1 max-w-[220px] truncate text-[11px] font-medium text-slate-200">{item.name}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{item.fullDate}</p>
    </div>
  );
}

export function LoadsBarChartCard({ charts, unit = "kva", onUnitChange }) {
  const series = charts?.series || [];
  const dataKey = unit === "kva" ? "powerKva" : "powerKw";
  const maxIndex = series.reduce((bestIdx, item, idx, arr) => {
    return Number(item[dataKey] || 0) > Number(arr[bestIdx]?.[dataKey] ?? -1) ? idx : bestIdx;
  }, 0);
  const maxVal = Number(series[maxIndex]?.[dataKey] || 0);

  const renderPeakPill = (props) => {
    const { x = 0, y = 0, width = 0, value, index } = props;
    if (index !== maxIndex || maxVal <= 0) return null;
    const formatted = `${Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} ${unit === "kva" ? "kVA" : "kW"}`;
    const pillW = Math.max(54, formatted.length * 6.4 + 14);
    const pillX = x + width / 2 - pillW / 2;
    const pillY = Math.max(2, y - 24);
    return (
      <g pointerEvents="none">
        <rect x={pillX} y={pillY} width={pillW} height={18} rx={9} fill="#031923" />
        <polygon
          points={`${x + width / 2 - 3.5},${pillY + 18} ${x + width / 2 + 3.5},${pillY + 18} ${x + width / 2},${pillY + 21.5}`}
          fill="#031923"
        />
        <text
          x={x + width / 2}
          y={pillY + 12}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={9.5}
          fontWeight={700}
        >
          {formatted}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
            <h3 className="truncate text-[13px] font-bold text-[#101828]">Cargas dimensionadas</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Sobre o gráfico de cargas" className="shrink-0 text-[#94A3B8] hover:text-[#101828]">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Somatório das cargas ({unit === "kva" ? "potência aparente em kVA" : "potência ativa em kW"}) por data no período selecionado, conforme NBR 5410.
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
              unit === "kva"
                ? "bg-[#00D98A] text-[#031923] shadow-[0_2px_6px_rgba(0,217,138,0.28)]"
                : "text-[#64748B] hover:text-[#101828]"
            }`}
          >
            kVA
          </button>
          <button
            type="button"
            onClick={() => onUnitChange?.("kw")}
            className={`rounded-full px-2.5 py-0.5 transition ${
              unit === "kw"
                ? "bg-[#00D98A] text-[#031923] shadow-[0_2px_6px_rgba(0,217,138,0.28)]"
                : "text-[#64748B] hover:text-[#101828]"
            }`}
          >
            kW
          </button>
        </div>
      </div>

      <div className="mt-1 h-[118px] w-full">
        {charts?.isEmpty ? (
          <EmptyState
            title="Sem projetos no período"
            description="Ajuste o filtro ou cadastre circuitos."
            className="h-full py-2"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 28, right: 12, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="nacifActiveBarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00F0A0" />
                  <stop offset="100%" stopColor="#00BD77" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2F7" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, (dataMax) => Math.max(2, Math.ceil((dataMax || 1) * 1.25))]}
                tickFormatter={(val) => Number(val || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }}
              />
              {series.length === 1 && maxVal > 0 && (
                <ReferenceLine y={maxVal} stroke="#00D98A" strokeDasharray="4 4" strokeOpacity={0.35} />
              )}
              <RechartsTooltip cursor={{ fill: "rgba(0, 217, 138, 0.06)" }} content={<CustomBarTooltip unit={unit} />} />
              <Bar dataKey={dataKey} radius={[8, 8, 2, 2]} maxBarSize={series.length <= 2 ? 32 : 22}>
                <LabelList dataKey={dataKey} content={renderPeakPill} />
                {series.map((entry, idx) => (
                  <Cell
                    key={entry.id || idx}
                    fill={idx === maxIndex && maxVal > 0 ? "url(#nacifActiveBarFill)" : "#C5F6E3"}
                  />
                ))}
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
  const areaDataKey = activeMetric === "cost" ? "budget" : "demandKw";
  const peakIndex = series.reduce((bestIdx, item, idx, arr) => {
    return Number(item[areaDataKey] || 0) >= Number(arr[bestIdx]?.[areaDataKey] ?? -1) ? idx : bestIdx;
  }, 0);
  const peakVal = Number(series[peakIndex]?.[areaDataKey] || 0);

  const renderAreaPeakPill = (props) => {
    const { x = 0, y = 0, value, index } = props;
    if (index !== peakIndex || peakVal <= 0) return null;
    const formatted =
      activeMetric === "cost"
        ? formatCurrencyBrl(value)
        : `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`;
    const pillW = Math.max(50, formatted.length * 6.3 + 14);
    const isLastPoint = series.length > 1 && index === series.length - 1;
    const isFirstPoint = series.length > 1 && index === 0;
    const pillX = isLastPoint
      ? Math.max(4, x - pillW + 14)
      : isFirstPoint
      ? Math.max(4, x - 14)
      : Math.max(4, x - pillW / 2);
    const pillY = Math.max(2, y - 26);
    return (
      <g pointerEvents="none">
        <rect x={pillX} y={pillY} width={pillW} height={18} rx={9} fill="#031923" />
        <polygon
          points={`${x - 3.5},${pillY + 18} ${x + 3.5},${pillY + 18} ${x},${pillY + 21.5}`}
          fill="#031923"
        />
        <text
          x={pillX + pillW / 2}
          y={pillY + 12}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={9.5}
          fontWeight={700}
        >
          {formatted}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
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
              activeMetric === "demand"
                ? "bg-[#00D98A] text-[#031923] shadow-[0_2px_6px_rgba(0,217,138,0.28)]"
                : "text-[#64748B] hover:text-[#101828]"
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
                ? "bg-[#00D98A] text-[#031923] shadow-[0_2px_6px_rgba(0,217,138,0.28)]"
                : canToggleBudget
                ? "text-[#64748B] hover:text-[#101828]"
                : "cursor-not-allowed opacity-45 text-[#94A3B8]"
            }`}
          >
            R$
          </button>
        </div>
      </div>

      <div className="mt-1 h-[118px] w-full">
        {charts?.isEmpty ? (
          <EmptyState
            title="Sem série no período"
            description="Nenhum dado para a janela selecionada."
            className="h-full py-2"
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 28, right: 24, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="nacifDemandGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D98A" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#00D98A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF2F7" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, (dataMax) => Math.max(2, Math.ceil((dataMax || 1) * 1.25))]}
                tickFormatter={(val) => Number(val || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                tick={{ fill: "#64748B", fontSize: 10, fontWeight: 500 }}
              />
              {series.length === 1 && peakVal > 0 && (
                <ReferenceLine y={peakVal} stroke="#00D98A" strokeDasharray="4 4" strokeOpacity={0.42} />
              )}
              <RechartsTooltip content={<CustomAreaTooltip metric={activeMetric} />} />
              <Area
                type="monotone"
                dataKey={areaDataKey}
                stroke="#00C87F"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#nacifDemandGradient)"
                dot={(dotProps) => {
                  const { cx, cy, index } = dotProps;
                  if (typeof cx !== "number" || typeof cy !== "number") return null;
                  if (series.length > 2 && index !== peakIndex) return null;
                  return (
                    <g key={`dot-${index}`}>
                      <circle cx={cx} cy={cy} r={9} fill="#00D98A" fillOpacity={0.22} />
                      <circle cx={cx} cy={cy} r={4} fill="#00F0A0" stroke="#031923" strokeWidth={2} />
                    </g>
                  );
                }}
                activeDot={{ r: 5.5, fill: "#031923", stroke: "#00F0A0", strokeWidth: 2 }}
              >
                <LabelList dataKey={areaDataKey} content={renderAreaPeakPill} />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
