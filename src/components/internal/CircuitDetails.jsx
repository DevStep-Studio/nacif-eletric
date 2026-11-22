import { cn } from "@/lib/utils";

const numFmt = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const fmtNum = (val, suffix = "") => {
  const n = Number(val);
  if (!Number.isFinite(n)) return `0${suffix}`;
  return `${numFmt.format(n)}${suffix}`;
};

function DetailGroup({ title, items }) {
  return (
    <div className="rounded-xl border border-[#E5EBF1] bg-white p-3">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">
        {title}
      </p>
      <dl className="space-y-1.5 text-xs">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <dt className="text-[#64748B] font-medium">{item.label}</dt>
            <dd className={cn("font-bold text-right tabular-nums", item.tone || "text-[#101828]")}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Painel expansível de parâmetros técnicos de engenharia do circuito.
 */
export default function CircuitDetails({ circuit }) {
  const installedPower = Number(circuit.power_w) || 0;
  const demandFactor =
    circuit.demand_factor !== undefined && !Number.isNaN(Number(circuit.demand_factor))
      ? Number(circuit.demand_factor)
      : 1;
  const effectivePower =
    circuit.demand_power_w !== undefined && !Number.isNaN(Number(circuit.demand_power_w))
      ? Number(circuit.demand_power_w)
      : Math.round(installedPower * demandFactor);

  return (
    <div className="mt-3 rounded-xl border border-[#E5EBF1] bg-[#F8FAFC] p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailGroup
          title="Dimensionamento"
          items={[
            { label: "Potência instalada", value: `${fmtNum(installedPower)} W` },
            { label: "Demanda (Fd)", value: `${fmtNum(effectivePower)} W (Fd ${fmtNum(demandFactor)})` },
            { label: "Alimentação", value: `${circuit.supply_type || "—"} · ${circuit.voltage || 220} V` },
            { label: "Fator de potência", value: `fp ${fmtNum(circuit.power_factor || 1)}` },
          ]}
        />

        <DetailGroup
          title="Proteções & Quadro"
          items={[
            { label: "Disjuntor", value: `${circuit.breaker_a || "—"} A ${circuit.breaker_poles || 1}P/${circuit.breaker_curve || "C"}` },
            { label: "DR", value: circuit.needs_dr ? "DR 30 mA previsto" : "Não exigido" },
            { label: "DPS", value: circuit.needs_dps ? "DPS previsto" : "Sem DPS" },
            { label: "Quadro", value: `${circuit.din_modules || 1} DIN · ${circuit.point_count || 1} ponto(s)` },
          ]}
        />

        <DetailGroup
          title="Condutores & Instalação"
          items={[
            { label: "Seção / Cabo", value: circuit.wire_gauge || "—" },
            { label: "Corrente nominal", value: `${fmtNum(circuit.nominal_current_a, " A")}` },
            { label: "Corrente corrigida", value: `${fmtNum(circuit.corrected_current_a, " A")}` },
            { label: "Método", value: circuit.install_method || "A definir" },
          ]}
        />

        <DetailGroup
          title="Queda de tensão & Ambiente"
          items={[
            {
              label: "Queda ΔU",
              value: `${fmtNum(circuit.voltage_drop_pct, "%")} · ${fmtNum(circuit.voltage_drop_v, " V")}`,
              tone: circuit.voltage_drop_ok ? "text-[#006B50]" : "text-[#EF4444]",
            },
            { label: "Comprimento", value: `${fmtNum(circuit.length_m || 15, " m")}` },
            { label: "Fatores (Ft / Fg)", value: `Ft ${fmtNum(circuit.temp_factor || 1)} · Fg ${fmtNum(circuit.group_factor || 1)}` },
            {
              label: "Verificação",
              value: circuit.voltage_drop_ok ? "Parâmetros atendidos" : "Revisar queda ΔU",
              tone: circuit.voltage_drop_ok ? "text-[#006B50]" : "text-[#EF4444]",
            },
          ]}
        />
      </div>

      {circuit.description && (
        <div className="mt-2.5 rounded-lg border border-[#E5EBF1] bg-white px-3 py-2 text-xs text-[#64748B]">
          <span className="font-bold text-[#101828]">Observações: </span>
          {circuit.description}
        </div>
      )}
    </div>
  );
}
