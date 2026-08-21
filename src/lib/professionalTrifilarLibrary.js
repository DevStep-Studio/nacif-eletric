import {
  buildProfessionalPanelBoard,
  clipText,
  formatNumber,
} from "@/lib/professionalPanelBoardLibrary";

const PHASE_COLORS = {
  A: "#111827",
  B: "#dc2626",
  C: "#8b4513",
  N: "#00d8b8",
  PE: "#16a34a",
};

const PHASE_LABELS = {
  A: "Fase A",
  B: "Fase B",
  C: "Fase C",
  N: "Neutro",
  PE: "Proteção",
};

const CONDUCTOR_COLORS = {
  A: "preto",
  B: "vermelho",
  C: "marrom",
  N: "azul-claro",
  PE: "verde / verde-amarelo",
};

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function conductorCodesForCircuit(circuit) {
  const phases = Array.isArray(circuit.phaseSet) && circuit.phaseSet.length > 0
    ? circuit.phaseSet
    : ["A"];
  const needsNeutral = phases.length === 1 || circuit.raw?.neutral_required === true || circuit.raw?.needs_neutral === true;
  return [...phases, ...(needsNeutral ? ["N"] : []), "PE"];
}

function conductorBundleLabel(circuit) {
  const conductors = conductorCodesForCircuit(circuit);
  const phaseCount = conductors.filter((item) => ["A", "B", "C"].includes(item)).length;
  const neutralCount = conductors.includes("N") ? 1 : 0;
  const peCount = conductors.includes("PE") ? 1 : 0;
  const parts = [];

  if (phaseCount > 0) parts.push(`${phaseCount}F`);
  if (neutralCount) parts.push("N");
  if (peCount) parts.push("PE");

  return `${parts.join("+")} · ${circuit.wireGauge}`;
}

function circuitSupplyLabel(circuit) {
  const phases = circuit.phaseSet || ["A"];
  if (phases.length === 3) return "FA+FB+FC";
  if (phases.length === 2) return `F${phases[0]}+F${phases[1]}`;
  return `F${phases[0]}+N`;
}

function buildBusbars(board) {
  const phaseBars = board.system.phaseCodes.map((phase) => ({
    code: phase,
    label: PHASE_LABELS[phase],
    colorName: CONDUCTOR_COLORS[phase],
    color: PHASE_COLORS[phase],
    current: board.phaseLoads[phase] || 0,
    voltage: phase === "A" && board.system.phaseCodes.length === 1 ? `${board.project?.voltage || 220}V` : "127V/fase",
  }));

  return [
    ...phaseBars,
    {
      code: "N",
      label: PHASE_LABELS.N,
      colorName: CONDUCTOR_COLORS.N,
      color: PHASE_COLORS.N,
      current: board.neutralCurrent || 0,
      voltage: "N",
    },
    {
      code: "PE",
      label: PHASE_LABELS.PE,
      colorName: CONDUCTOR_COLORS.PE,
      color: PHASE_COLORS.PE,
      current: 0,
      voltage: "PE",
    },
  ];
}

function buildVisibleCircuits(board) {
  return board.circuits.slice(0, 22).map((circuit) => ({
    ...circuit,
    conductors: conductorCodesForCircuit(circuit),
    conductorLabel: conductorBundleLabel(circuit),
    supplyLabel: circuitSupplyLabel(circuit),
    breakerLabel: `${circuit.poles}P ${circuit.breaker}A Curva ${circuit.breakerCurve}`,
    loadLabel: `${formatNumber(circuit.projectCurrent, 1)}A · ${Math.round(circuit.powerW)}W`,
  }));
}

function circuitCadCode(circuit, index) {
  const id = String(circuit.id || `C${String(index + 1).padStart(2, "0")}`).toUpperCase();
  const numeric = id.match(/\d+/)?.[0] || String(index + 1).padStart(2, "0");
  return `C${numeric.padStart(2, "0")}F-AC`;
}

function circuitCadDescription(circuit) {
  const source = `${circuit.type || ""} ${circuit.description || ""}`.toLowerCase();
  const description = String(circuit.description || circuit.name || circuit.type || "Circuito").toUpperCase();

  if (source.includes("ilumina")) return `ILUMINAÇÃO ${description.replace(/^ILUMINAÇÃO\s*/i, "")}`;
  if (source.includes("chuveiro")) return `TOMADA CHUVEIRO - ${description.replace(/^CHUVEIRO\s*/i, "")}`;
  if (source.includes("ar condicionado")) return `PF - AR CONDICIONADO - ${description.replace(/^AR CONDICIONADO\s*/i, "")}`;
  if (source.includes("tomada") || source.includes("tug")) return `TOMADA ${description.replace(/^TOMADA\s*/i, "")}`;
  return description;
}

export function buildTrifilarReferenceLayout(data, options = {}) {
  const maxRows = options.maxRows || 16;
  const visible = data.visibleCircuits.slice(0, maxRows);
  const reserveRows = Math.max(0, maxRows - visible.length);
  const phaseOrder = ["R", "S", "T"];
  const rows = [
    ...visible.map((circuit, index) => ({
      id: circuit.id,
      key: circuit.id,
      circuit,
      index,
      side: index % 2 === 0 ? "left" : "right",
      phase: phaseOrder[index % phaseOrder.length],
      code: circuitCadCode(circuit, index),
      label: `${circuitCadCode(circuit, index)} - ${circuitCadDescription(circuit)}`,
      breaker: circuit.breaker,
      wireGauge: circuit.wireGauge,
      reserve: false,
    })),
    ...Array.from({ length: reserveRows }, (_, reserveIndex) => {
      const index = visible.length + reserveIndex;
      return {
        id: `RES-${reserveIndex + 1}`,
        key: `RES-${reserveIndex + 1}`,
        circuit: null,
        index,
        side: index % 2 === 0 ? "left" : "right",
        phase: phaseOrder[index % phaseOrder.length],
        code: `RES-${String(reserveIndex + 1).padStart(2, "0")}`,
        label: "Reserva",
        breaker: null,
        wireGauge: data.feederGauge ? `${data.feederGauge}mm²` : "10mm²",
        reserve: true,
      };
    }),
  ];

  return {
    title: `QDLF - ${data.panelName.toUpperCase().slice(0, 18)}`,
    subtitle: `MEMÓRIA DE CÁLCULO - ${data.panelName.toUpperCase().slice(0, 28)}`,
    phaseOrder,
    feederGaugeLabel: `${data.feederGauge || 10}mm`,
    mainBreakerLabel: `${data.generalBreaker}A`,
    surgeLabel: "275V/20kA",
    rows,
    hiddenRows: Math.max(0, data.visibleCircuits.length - visible.length),
  };
}

export function buildProfessionalTrifilar(project = {}, metrics = {}) {
  const board = buildProfessionalPanelBoard(project, metrics);
  const busbars = buildBusbars(board);
  const visibleCircuits = buildVisibleCircuits(board);
  const phaseCount = board.system.phaseCodes.length;
  const lineVoltage = phaseCount > 1 ? "220V entre fases" : `${project?.voltage || 220}V`;

  return {
    ...board,
    title: "DIAGRAMA TRIFILAR EXECUTIVO",
    drawingCode: "QE-301",
    busbars,
    visibleCircuits,
    hiddenCircuits: Math.max(0, board.circuits.length - visibleCircuits.length),
    phaseColors: PHASE_COLORS,
    colorLegend: busbars.map((bar) => ({
      code: bar.code,
      label: bar.label,
      colorName: bar.colorName,
      color: bar.color,
    })),
    lineVoltage,
    feederLabel: `${phaseCount}F${board.system.phaseLabels.includes("N") ? "+N" : ""}+PE · ${board.feederGauge}mm² Cu`,
    upstreamDevices: [
      ["REDE / ENTRADA", `${board.system.label} · ${lineVoltage}`],
      ["MEDIÇÃO kWh", "Classe B · bidirecional"],
      ["DISJUNTOR GERAL", `${board.system.generalPoles}P ${board.generalBreaker}A · curva C`],
      ["DPS CLASSE II", `${Math.max(1, phaseCount)} polo(s) · 15kA`],
      ["IDR / DR", board.drCount ? "30mA nos circuitos aplicáveis" : "prever por ambiente"],
    ],
    engineeringRows: [
      ["Alimentador", `${phaseCount}F + N + PE · ${board.feederGauge}mm² Cu`],
      ["I projeto", `${formatNumber(board.generalCurrent, 1)}A`],
      ["Proteção geral", `${board.system.generalPoles}P ${board.generalBreaker}A`],
      ["Barramento", `${board.system.busbar} · ${Math.max(80, board.generalBreaker)}A`],
      ["DPS", "Classe II, ligação curta ao PE"],
      ["Reserva DIN", `${board.reserveModules} módulo(s)`],
    ],
    notes: [
      "Cada circuito representa fase(s), neutro quando aplicável e PE em condutores separados.",
      "Cores dos condutores seguem IEC 60445: fases identificadas, neutro azul e PE verde/verde-amarelo.",
      "DPS deve ter conexão curta ao barramento PE e proteção coordenada conforme especificação do fabricante.",
      "Validar seções, método de instalação, agrupamento, Icu/Icn e ensaios antes da emissão final.",
    ],
    circuitSummary: visibleCircuits.map((circuit) => [
      circuit.id,
      clipText(circuit.description, 24),
      circuit.supplyLabel,
      circuit.breakerLabel,
      circuit.conductorLabel,
      `${formatNumber(asNumber(circuit.voltageDropPct), 1)}%`,
    ]),
  };
}
