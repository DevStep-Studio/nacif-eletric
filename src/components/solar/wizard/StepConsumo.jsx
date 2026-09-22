import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TARIFF_CLASSES = [
  "B1 - Residencial",
  "B2 - Rural",
  "B3 - Comercial/Industrial (baixa tensão)",
  "A4 - Verde (média tensão)",
  "A4 - Azul (média tensão)",
];

export default function StepConsumo({ state, onChange }) {
  const setField = (field, value) => onChange({ [field]: value });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Consumo médio mensal (kWh) *</Label>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Ex: 842"
            value={state.monthly_consumption_kwh}
            onChange={(e) => setField("monthly_consumption_kwh", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tarifa de energia (R$/kWh) *</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex: 0,95"
            value={state.tariff_brl_kwh}
            onChange={(e) => setField("tariff_brl_kwh", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Modalidade tarifária</Label>
          <Select value={state.tariff_class} onValueChange={(v) => setField("tariff_class", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TARIFF_CLASSES.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Demanda contratada (kW) — se aplicável</Label>
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Somente grupo A"
            value={state.contracted_demand_kw}
            onChange={(e) => setField("contracted_demand_kw", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Distribuidora</Label>
        <Input placeholder="Ex: Enel SP, CPFL, Light..." value={state.distributor} onChange={(e) => setField("distributor", e.target.value)} />
      </div>

      <p className="rounded-lg bg-muted/50 p-3 text-xs font-semibold leading-5 text-muted-foreground">
        A economia estimada usa o consumo e a tarifa informados aqui. Quando a leitura automática da conta de
        energia estiver disponível (requer o backend de IA), estes campos poderão ser pré-preenchidos e o
        histórico dos últimos 12 meses poderá ser importado — hoje o preenchimento é manual.
      </p>
    </div>
  );
}
