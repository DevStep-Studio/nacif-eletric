import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2, Rocket } from "lucide-react";
import { getInstantResults } from "@/lib/solarWizardState";
import { DEFAULT_SIZING_PREMISES } from "@/lib/solarSizing";
import ResultsBar from "./ResultsBar";

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value || "—"}</span>
    </div>
  );
}

export default function StepProjeto({ state, onChange, onCreate, creating }) {
  const [showPremises, setShowPremises] = useState(false);
  const results = getInstantResults(state);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-white p-4">
        <p className="mb-2 text-sm font-extrabold text-foreground">Resumo do projeto</p>
        <SummaryRow label="Projeto" value={state.name} />
        <SummaryRow label="Cliente" value={state.client_name} />
        <SummaryRow label="Endereço" value={[state.address, state.number, state.city, state.state].filter(Boolean).join(", ")} />
        <SummaryRow label="Modo do sistema" value={state.system_mode === "on-grid" ? "On-grid" : state.system_mode === "off-grid" ? "Off-grid" : "Híbrido"} />
        <SummaryRow label="Bateria" value={state.has_battery ? `${state.battery_config.capacity_kwh || "?"} kWh · ${state.battery_config.technology}` : "Não incluída"} />
        <SummaryRow label="Módulos" value={`${results.panelCount} × ${state.module_wp} Wp`} />
        <SummaryRow label="Inversor" value={`${state.inverter_kw} kW · ${state.ac_supply_type} ${state.ac_voltage}V`} />
      </div>

      <div className="space-y-1.5">
        <Label>Investimento estimado (R$) — opcional</Label>
        <Input
          type="number"
          min="0"
          step="100"
          placeholder={`Deixe em branco para estimar por R$ ${DEFAULT_SIZING_PREMISES.costPerWpBrl}/Wp`}
          value={state.investment_brl}
          onChange={(e) => onChange({ investment_brl: e.target.value })}
        />
      </div>

      <ResultsBar results={results} investmentIsEstimated={results.investmentIsEstimated} />

      <button
        type="button"
        onClick={() => setShowPremises((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-extrabold text-primary"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition ${showPremises ? "rotate-180" : ""}`} />
        Ver premissas utilizadas no cálculo
      </button>
      {showPremises && (
        <ul className="list-disc space-y-1 rounded-lg bg-muted/50 p-4 pl-8 text-xs font-semibold text-muted-foreground">
          <li>Irradiação solar média: {DEFAULT_SIZING_PREMISES.dailyIrradiationHspKwhM2} HSP/dia (média Brasil — premissa editável, não a irradiação exata do local).</li>
          <li>Performance ratio (perdas do sistema): {Math.round(DEFAULT_SIZING_PREMISES.performanceRatio * 100)}%.</li>
          <li>Aproveitamento de área: {DEFAULT_SIZING_PREMISES.areaUtilizationPct}%, com {DEFAULT_SIZING_PREMISES.gridSpacingLossPct}% adicionais de perda por espaçamento entre fileiras.</li>
          <li>Fator de crédito do excedente injetado na rede: {Math.round(DEFAULT_SIZING_PREMISES.selfConsumptionCreditFactor * 100)}%.</li>
          <li>Custo estimado por Wp (quando o investimento não é informado): R$ {DEFAULT_SIZING_PREMISES.costPerWpBrl}/Wp.</li>
        </ul>
      )}

      <Button type="button" className="h-12 w-full text-base font-extrabold" onClick={onCreate} disabled={creating}>
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {creating ? "Criando projeto..." : "Criar projeto e abrir editor do telhado"}
      </Button>
    </div>
  );
}
