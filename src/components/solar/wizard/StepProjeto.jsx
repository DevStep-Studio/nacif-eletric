import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ChevronDown,
  FileCheck,
  Info,
  Loader2,
  MapPin,
  Rocket,
  Sun,
  Zap,
} from "lucide-react";
import { getInstantResults } from "@/lib/solarWizardState";
import { DEFAULT_SIZING_PREMISES } from "@/lib/solarSizing";
import PtBrNumericInput from "./PtBrNumericInput";
import ResultsBar from "./ResultsBar";

function SummaryRow({ label, value, highlight = false }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-xs font-semibold last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${highlight ? "text-primary font-black" : "text-foreground"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

export default function StepProjeto({ state, onChange, onCreate, creating }) {
  const [showPremises, setShowPremises] = useState(false);
  const results = getInstantResults(state);

  const fullAddress = [state.address, state.number, state.neighborhood, state.city, state.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      {/* 1. Resumo Executivo Consolidado */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileCheck className="h-4 w-4 text-primary" /> Resumo Consolidado do Projeto
        </p>

        <div className="divide-y divide-slate-100">
          <SummaryRow label="Nome do projeto" value={state.name} highlight />
          <SummaryRow label="Cliente" value={state.client_name || "Não informado"} />
          <SummaryRow label="Localização da obra" value={fullAddress || "Não informada"} />
          <SummaryRow
            label="Tipo e modo do sistema"
            value={`${state.installation_type} · ${
              state.system_mode === "on-grid"
                ? "On-grid (conectado à rede)"
                : state.system_mode === "off-grid"
                ? "Off-grid (isolado)"
                : "Híbrido (com backup)"
            }`}
          />
          <SummaryRow
            label="Arranjo fotovoltaico"
            value={`${results?.panelCount || 0} módulos de ${state.module_wp} Wp (${Number(results?.installedKwp || 0).toFixed(2).replace(".", ",")} kWp)`}
            highlight
          />
          <SummaryRow
            label="Inversor de frequência"
            value={`${state.inverter_kw} kW · ${state.ac_supply_type} ${state.ac_voltage}V`}
          />
          <SummaryRow
            label="Banco de baterias"
            value={
              state.has_battery
                ? `${state.battery_config?.capacity_kwh || 10} kWh (${state.battery_config?.technology || "Lítio"})`
                : "Não incluído"
            }
          />
        </div>
      </div>

      {/* 2. Investimento Estimado (Opcional) */}
      <div className="space-y-1.5">
        <Label className="text-xs font-black text-foreground">
          Investimento estimado (R$) — opcional
        </Label>
        <PtBrNumericInput
          value={state.investment_brl}
          onChange={(v) => onChange({ investment_brl: v })}
          placeholder={`Deixe em branco para estimar por R$ ${DEFAULT_SIZING_PREMISES.costPerWpBrl.toFixed(2).replace(".", ",")}/Wp`}
          suffix="R$"
          min={0}
        />
        <p className="text-[11px] font-semibold text-muted-foreground">
          Utilizado para o cálculo do Payback simples e indicadores de viabilidade financeira.
        </p>
      </div>

      {/* 3. Barra de Resultados Finais */}
      <ResultsBar results={results} investmentIsEstimated={results.investmentIsEstimated} />

      {/* 4. Premissas Técnicas Utilizadas */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowPremises((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPremises ? "rotate-180" : ""}`} />
          {showPremises ? "Ocultar premissas de cálculo" : "Ver premissas normativas e técnicas do cálculo"}
        </button>

        {showPremises && (
          <ul className="list-disc space-y-1 rounded-2xl bg-slate-50 border border-slate-200 p-4 pl-8 text-xs font-semibold text-slate-600">
            <li>Irradiação solar média de referência: {DEFAULT_SIZING_PREMISES.dailyIrradiationHspKwhM2} HSP/dia.</li>
            <li>Performance Ratio (PR) considerado: {Math.round(DEFAULT_SIZING_PREMISES.performanceRatio * 100)}% (perdas térmicas, sujeira e cabos).</li>
            <li>Fator de autoconsumo/compensação simultânea: {Math.round(DEFAULT_SIZING_PREMISES.selfConsumptionCreditFactor * 100)}%.</li>
            <li>Custo de referência de mercado: R$ {DEFAULT_SIZING_PREMISES.costPerWpBrl.toFixed(2).replace(".", ",")}/Wp instalado.</li>
            <li>Dimensionamento elétrico em conformidade com as normas NBR 5410:2004 e NBR 16690.</li>
          </ul>
        )}
      </div>

      {/* 5. Botão de Conclusão / Criação do Projeto */}
      <Button
        type="button"
        className="h-12 w-full text-base font-black bg-primary text-primary-foreground shadow-md hover:bg-primary/90 rounded-2xl transition"
        onClick={onCreate}
        disabled={creating}
      >
        {creating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Criando projeto e preparando telhado...
          </>
        ) : (
          <>
            <Rocket className="mr-2 h-5 w-5" />
            Criar projeto e abrir editor do telhado
          </>
        )}
      </Button>
    </div>
  );
}
