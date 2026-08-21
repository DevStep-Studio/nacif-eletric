export const PANEL_SHEET = {
  width: 1189,
  height: 841,
};

export const PANEL_COLORS = {
  ink: "#111827",
  muted: "#5f6b7a",
  faint: "#e5eaf0",
  surface: "#ffffff",
  soft: "#f7fafc",
  blue: "#00d8b8",
  blueDark: "#123D5C",
  cyan: "#E6F2FA",
  yellow: "#FFF8BF",
  red: "#dc2626",
  green: "#16a34a",
  phaseA: "#111827",
  phaseB: "#dc2626",
  phaseC: "#8b4513",
  neutral: "#00d8b8",
  earth: "#16a34a",
};

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatNumber = (value, digits = 1) =>
  asNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const clipText = (value, max = 42) => {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
};

export const normalizeText = (value, fallback = "—") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

export function feederGaugeByCurrent(current) {
  const value = asNumber(current);
  const table = [
    [50, 10],
    [70, 16],
    [100, 25],
    [150, 35],
    [200, 50],
    [250, 70],
    [320, 95],
    [380, 120],
    [460, 150],
    [540, 185],
  ];
  return (table.find(([limit]) => value <= limit) || table[table.length - 1])[1];
}

function phaseSetForCircuit(circuit) {
  const phase = String(circuit?.phase || "A").toUpperCase();
  if (circuit?.supply_type === "Trifásico" || phase === "ABC") return ["A", "B", "C"];
  if (circuit?.supply_type === "Bifásico" || phase.length === 2) return phase.split("").filter((item) => ["A", "B", "C"].includes(item));
  return [["A", "B", "C"].includes(phase[0]) ? phase[0] : "A"];
}

function polesForCircuit(circuit) {
  if (circuit?.breaker_poles) return asNumber(circuit.breaker_poles, 1);
  const phases = phaseSetForCircuit(circuit);
  return phases.length;
}

function inferPanelSystem(project, circuits) {
  const supply = project?.supply_type || "Monofásico";
  const hasTriphase = supply === "Trifásico" || circuits.some((circuit) => phaseSetForCircuit(circuit).length === 3);
  const hasBiphase = supply === "Bifásico" || circuits.some((circuit) => phaseSetForCircuit(circuit).length === 2);

  if (hasTriphase) {
    return {
      supply,
      label: "Trifásico",
      phaseLabels: ["R", "S", "T", "N", "PE"],
      phaseCodes: ["A", "B", "C"],
      busbar: "3F+N+PE",
      generalPoles: 3,
    };
  }

  if (hasBiphase) {
    return {
      supply,
      label: "Bifásico",
      phaseLabels: ["R", "S", "N", "PE"],
      phaseCodes: ["A", "B"],
      busbar: "2F+N+PE",
      generalPoles: 2,
    };
  }

  return {
    supply,
    label: "Monofásico",
    phaseLabels: ["F", "N", "PE"],
    phaseCodes: ["A"],
    busbar: "F+N+PE",
    generalPoles: 2,
  };
}

function normalizeCircuit(circuit, index, fallbackVoltage) {
  const powerW = asNumber(circuit?.power_w);
  const voltage = asNumber(circuit?.voltage, fallbackVoltage || 220);
  const projectCurrent = asNumber(circuit?.project_current_a, voltage ? powerW / voltage : 0);
  const correctedCurrent = asNumber(circuit?.corrected_current_a, projectCurrent);
  const phaseSet = phaseSetForCircuit(circuit);
  const breaker = asNumber(circuit?.breaker_a, 16);
  const dinModules = asNumber(circuit?.din_modules, polesForCircuit(circuit));
  const name = normalizeText(circuit?.name || circuit?.description || circuit?.type, `Circuito ${index + 1}`);

  return {
    raw: circuit,
    index,
    id: `C${String(index + 1).padStart(2, "0")}`,
    name,
    description: name.toUpperCase(),
    type: normalizeText(circuit?.type || circuit?.circuit_type, "Circuito final"),
    powerW,
    voltage,
    projectCurrent,
    correctedCurrent,
    groupFactor: asNumber(circuit?.group_factor, 1),
    breaker,
    breakerCurve: normalizeText(circuit?.breaker_curve, "B"),
    poles: polesForCircuit(circuit),
    wireGauge: normalizeText(circuit?.wire_gauge, "2.5mm²"),
    phase: normalizeText(circuit?.phase, "A"),
    phaseSet,
    dinModules,
    voltageDropPct: asNumber(circuit?.voltage_drop_pct),
    voltageDropOk: circuit?.voltage_drop_ok !== false,
    needsDr: Boolean(circuit?.needs_dr),
    needsDps: circuit?.needs_dps !== false,
    lengthM: asNumber(circuit?.length_m, 15),
    breakingCapacityKa: asNumber(circuit?.breaking_capacity_ka, 3),
  };
}

function buildWarnings(metrics, circuits) {
  const warnings = [];
  const validations = Array.isArray(metrics?.validations) ? metrics.validations : [];

  validations.forEach((item) => {
    if (item?.msg) warnings.push(item.msg);
  });

  circuits.forEach((circuit) => {
    if (!circuit.voltageDropOk) {
      warnings.push(`${circuit.id}: queda de tensão ${formatNumber(circuit.voltageDropPct, 1)}% acima do limite.`);
    }
  });

  return [...new Set(warnings)].slice(0, 4);
}

function buildPhaseLoads(metrics, circuits) {
  const base = {
    A: asNumber(metrics?.phaseLoad?.A),
    B: asNumber(metrics?.phaseLoad?.B),
    C: asNumber(metrics?.phaseLoad?.C),
  };

  if (base.A || base.B || base.C) return base;

  circuits.forEach((circuit) => {
    circuit.phaseSet.forEach((phase) => {
      base[phase] += circuit.projectCurrent;
    });
  });

  return base;
}

const getActivePanelLayout = (project) => {
  const boards = Array.isArray(project?.panel_boards) ? project.panel_boards : [];
  const activeBoard = boards[0] || null;
  const layout = activeBoard?.layout || project?.panel_layout || null;
  return {
    board: activeBoard,
    layout: layout && Array.isArray(layout.rails) ? layout : { rails: [], wires: [] },
  };
};

const getPanelComponents = (layout) => (
  (layout?.rails || []).flatMap((rail) => rail.components || [])
    .filter((component) => component && component.type !== "spacer")
);

const componentCircuitIndex = (component) => {
  const idMatch = String(component?.id || "").match(/circuit[_-](\d+)/i);
  if (idMatch) return Number(idMatch[1]);
  const labelMatch = String(component?.label || "").match(/\bC0?(\d+)\b/i);
  if (labelMatch) return Math.max(0, Number(labelMatch[1]) - 1);
  return -1;
};

const buildBranchRowsFromLayout = (components, circuits, reserveModules) => {
  const used = new Set();
  const circuitRows = components
    .filter((component) => component.type === "breaker" && !component.isGeneral)
    .map((component) => {
      const index = componentCircuitIndex(component);
      const circuit = circuits[index] || circuits.find((item) => (
        String(component.label || "").toLowerCase().includes(String(item.name || "").toLowerCase())
      ));
      if (!circuit) return null;
      used.add(circuit.index);
      return {
        type: "circuit",
        circuit: {
          ...circuit,
          breaker: asNumber(component.current, circuit.breaker),
          poles: asNumber(component.poles, circuit.poles),
          phase: normalizeText(component.phase, circuit.phase),
          phaseSet: phaseSetForCircuit({ ...circuit.raw, phase: component.phase || circuit.phase, supply_type: circuit.raw?.supply_type }),
        },
      };
    })
    .filter(Boolean);

  const remainingRows = circuits
    .filter((circuit) => !used.has(circuit.index))
    .map((circuit) => ({ type: "circuit", circuit }));

  return [
    ...circuitRows,
    ...remainingRows,
    ...Array.from({ length: Math.min(6, Math.max(2, reserveModules)) }, (_, index) => ({
      type: "reserve",
      label: `Reserva ${index + 1}`,
    })),
  ].slice(0, 20);
};

export function buildProfessionalPanelBoard(project = {}, metrics = {}) {
  const rawCircuits = Array.isArray(metrics?.circuits)
    ? metrics.circuits
    : Array.isArray(project?.circuits)
      ? project.circuits
      : [];
  const voltage = asNumber(project?.voltage, 220);
  const circuits = rawCircuits.map((circuit, index) => normalizeCircuit(circuit, index, voltage));
  const system = inferPanelSystem(project, circuits);
  const phaseLoads = buildPhaseLoads(metrics, circuits);
  const generalCurrent = asNumber(metrics?.generalCurrent, Math.max(phaseLoads.A, phaseLoads.B, phaseLoads.C));
  const generalBreaker = asNumber(metrics?.generalBreaker, Math.max(16, Math.ceil(generalCurrent)));
  const totalPower = asNumber(metrics?.totalPower, circuits.reduce((sum, circuit) => sum + circuit.powerW, 0));
  const { board: activeBoard, layout: activeLayout } = getActivePanelLayout(project);
  const layoutComponents = getPanelComponents(activeLayout);
  const mainBreakerComponent = layoutComponents.find((component) => component.type === "breaker" && component.isGeneral);
  const dpsComponents = layoutComponents.filter((component) => component.type === "dps");
  const drComponents = layoutComponents.filter((component) => component.type === "dr");
  const layoutModules = layoutComponents.reduce((sum, component) => sum + asNumber(component.poles, 1), 0);
  const totalDin = layoutModules || circuits.reduce((sum, circuit) => sum + circuit.dinModules, 0) + system.generalPoles + 2;
  const panelSize = asNumber(metrics?.panelSize, Math.ceil(totalDin * 1.2 / 6) * 6 || 12);
  const reserveModules = Math.max(0, panelSize - totalDin);
  const warnings = buildWarnings(metrics, circuits);
  const projectName = normalizeText(project?.name, "Projeto elétrico");
  const panelName = normalizeText(activeBoard?.name || project?.panel_name || project?.name, "Quadro de distribuição");
  const client = normalizeText(project?.client_name || project?.client || project?.customer, "Cliente");
  const address = normalizeText(project?.address || project?.project_address, "Endereço da obra");
  const today = new Date().toLocaleDateString("pt-BR");

  const circuitRows = circuits.slice(0, 18);
  const tableRows = [
    ...circuitRows,
    ...Array.from({ length: Math.max(0, 10 - circuitRows.length) }, (_, index) => ({
      id: `R${String(index + 1).padStart(2, "0")}`,
      description: "RESERVA TÉCNICA",
      type: "Reserva",
      powerW: "",
      voltage: "",
      projectCurrent: "",
      groupFactor: "",
      correctedCurrent: "",
      breaker: "",
      wireGauge: "",
      phaseSet: [],
      dinModules: "",
      voltageDropPct: "",
      voltageDropOk: true,
      isReserve: true,
    })),
  ];

  const branchRows = layoutComponents.length
    ? buildBranchRowsFromLayout(layoutComponents, circuits, reserveModules)
    : [
        ...circuits.slice(0, 14).map((circuit) => ({ type: "circuit", circuit })),
        ...Array.from({ length: Math.min(6, Math.max(2, reserveModules)) }, (_, index) => ({
          type: "reserve",
          label: `Reserva ${index + 1}`,
        })),
      ];

  const generalBreakerFromLayout = mainBreakerComponent
    ? asNumber(mainBreakerComponent.current, generalBreaker)
    : generalBreaker;
  const generalPolesFromLayout = mainBreakerComponent
    ? asNumber(mainBreakerComponent.poles, system.generalPoles)
    : system.generalPoles;
  const feederGauge = feederGaugeByCurrent(Math.max(generalCurrent, generalBreakerFromLayout));
  const dpsPoleCount = dpsComponents.length
    ? dpsComponents.reduce((sum, component) => sum + asNumber(component.poles, 1), 0)
    : circuits.length ? Math.max(1, system.phaseCodes.length) : 0;
  const drDeviceCount = drComponents.length;
  const drProtectedCount = drDeviceCount ? circuits.length : circuits.filter((circuit) => circuit.needsDr).length;

  return {
    sheet: PANEL_SHEET,
    colors: PANEL_COLORS,
    project,
    projectName,
    panelName,
    client,
    date: today,
    title: "DIAGRAMA UNIFILAR E QUADRO DE CARGAS",
    drawingCode: "QE-201",
    revision: normalizeText(project?.revision, "R00"),
    system,
    circuits,
    tableRows,
    branchRows,
    hiddenCircuits: Math.max(0, circuits.length - 18),
    hiddenBranches: Math.max(0, circuits.length - 14),
    phaseLoads,
    imbalancePct: asNumber(metrics?.imbalance_pct),
    neutralCurrent: asNumber(metrics?.neutral_a),
    generalCurrent,
    generalBreaker: generalBreakerFromLayout,
    generalPoles: generalPolesFromLayout,
    feederGauge,
    totalPower,
    totalKva: totalPower / 1000,
    totalDin,
    panelSize,
    reserveModules,
    drCount: drProtectedCount,
    drDeviceCount,
    dpsCount: dpsPoleCount,
    dpsDeviceCount: dpsComponents.length,
    warnings,
    demandRows: [
      ["Potência instalada", `${Math.round(totalPower)} W`],
      ["Demanda de projeto", `${formatNumber(totalPower / 1000, 2)} kVA`],
      ["Corrente geral", `${formatNumber(generalCurrent, 1)} A`],
      ["Proteção geral", `${generalPolesFromLayout}P ${generalBreakerFromLayout} A`],
      ["Alimentador", `${feederGauge}mm² Cu`],
      ["Quadro DIN", `${panelSize} módulos (${reserveModules} reserva)`],
    ],
    characteristicRows: [
      ["Origem", panelName.toUpperCase()],
      ["Sistema", `${system.label} ${voltage}V`],
      ["Barramento", `${system.busbar} · ${Math.max(80, generalBreakerFromLayout)}A`],
      ["Proteção geral", `Disjuntor termomagnético ${generalPolesFromLayout}P ${generalBreakerFromLayout}A`],
      ["DPS", dpsPoleCount ? `Classe II · ${dpsPoleCount} polo(s) no quadro` : "Prever DPS classe II"],
      ["DR", drDeviceCount ? `${drDeviceCount} dispositivo(s) 30mA · ${drProtectedCount} circuito(s)` : "Prever conforme ambiente e uso"],
      ["Condutores", `Fase/Neutro ${feederGauge}mm² · PE ${Math.max(6, Math.round(feederGauge / 2))}mm²`],
    ],
    notes: [
      "Condutores dimensionados conforme NBR 5410:2004, considerando corrente de projeto, agrupamento e queda de tensão.",
      "Seção mínima: iluminação 1,5mm²; tomadas/TUE/força 2,5mm², salvo cálculo específico superior.",
      "Confirmar Icu/Icn, método de instalação, temperatura ambiente, eletrodutos e coordenação de proteção em obra.",
      "Identificar todos os circuitos no quadro e executar ensaios de continuidade, isolação, polaridade e atuação do DR.",
    ],
    titleRows: [
      ["CLIENTE", client],
      ["ENDEREÇO", address],
      ["PROJETO", projectName],
      ["DISCIPLINA", "INSTALAÇÕES ELÉTRICAS"],
      ["DESENHO", "DIAGRAMA UNIFILAR E MEMÓRIA DO QUADRO"],
      ["RESPONSÁVEL", normalizeText(project?.engineer || project?.designer, "ENGENHEIRO ELETRICISTA")],
    ],
  };
}
