/**
 * Motor NBR 5410 Profissional
 * Cálculos elétricos paramétricos conforme NBR 5410:2004 + Em.1:2008
 */

// ─── Tabela de bitolas NBR 5410 (corrente nominal em A por método de instalação) ──────────────
// Método B2 = Eletroduto embutido | B1 = Eletroduto aparente | D1 = No solo
const WIRE_TABLE = [
  { gauge: "1.5mm²",  area: 1.5,  B2: 13,  B1: 15,  D1: 18,  resistance: 12.1 },
  { gauge: "2.5mm²",  area: 2.5,  B2: 18,  B1: 21,  D1: 24,  resistance: 7.41 },
  { gauge: "4mm²",    area: 4,    B2: 24,  B1: 28,  D1: 32,  resistance: 4.61 },
  { gauge: "6mm²",    area: 6,    B2: 31,  B1: 36,  D1: 41,  resistance: 3.08 },
  { gauge: "10mm²",   area: 10,   B2: 42,  B1: 50,  D1: 57,  resistance: 1.83 },
  { gauge: "16mm²",   area: 16,   B2: 56,  B1: 66,  D1: 76,  resistance: 1.15 },
  { gauge: "25mm²",   area: 25,   B2: 73,  B1: 84,  D1: 96,  resistance: 0.727 },
  { gauge: "35mm²",   area: 35,   B2: 89,  B1: 104, D1: 119, resistance: 0.524 },
  { gauge: "50mm²",   area: 50,   B2: 108, B1: 125, D1: 144, resistance: 0.387 },
  { gauge: "70mm²",   area: 70,   B2: 136, B1: 160, D1: 184, resistance: 0.268 },
  { gauge: "95mm²",   area: 95,   B2: 164, B1: 194, D1: 223, resistance: 0.193 },
  { gauge: "120mm²",  area: 120,  B2: 188, B1: 225, D1: 259, resistance: 0.153 },
];

// ─── Fatores de correção NBR 5410 Table 40 (temperatura ambiente) ─────────────────────────────
const TEMP_FACTORS = {
  25: 1.06, 30: 1.00, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.50
};

// ─── Fatores de agrupamento NBR 5410 Table 42 ─────────────────────────────────────────────────
const GROUP_FACTORS = { 1: 1.00, 2: 0.80, 3: 0.70, 4: 0.65, 5: 0.60, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.50 };

// ─── Capacidade de interrupção por tensão ─────────────────────────────────────────────────────
const BREAKING_CAPACITY = (voltage) => {
  if (voltage <= 220) return 3; // kA mínimo residencial
  if (voltage <= 380) return 6;
  return 10;
};

// ─── Método de instalação → coluna da tabela ──────────────────────────────────────────────────
const METHOD_COL = {
  "Eletroduto Embutido em Parede":    "B2",
  "Eletroduto Aparente":              "B1",
  "Cabo Multipolar Fixado":           "B1",
  "Bandeja Perfurada":                "B1",
  "Enterrado Direto no Solo":         "D1",
  "Eletroduto Enterrado":             "D1",
};

// ─── DR obrigatório por tipo (NBR 5410 item 6.3.6) ────────────────────────────────────────────
const NEEDS_DR = (type) => [
  "Tomadas de Uso Geral", "Tomadas de Uso Específico", "Chuveiro", "Ar Condicionado",
  "Bomba Hidráulica", "Carregador Veicular",
].includes(type);

// ─── Curva do disjuntor por tipo de carga ─────────────────────────────────────────────────────
const BREAKER_CURVE = (type) => {
  if (["Motor", "Ar Condicionado", "Bomba Hidráulica"].includes(type)) return "D";
  if (["Servidor", "Nobreak"].includes(type)) return "C";
  return "B";
};

// ─── Número de polos por tipo de alimentação ──────────────────────────────────────────────────
const POLES = (supply) => {
  if (supply === "Monofásico") return 1;
  if (supply === "Bifásico")   return 2;
  if (supply === "Trifásico")  return 3;
  return 1;
};

// ─── Corrente nominal de projeto ──────────────────────────────────────────────────────────────
export function calcNominalCurrent(power_w, voltage, supply_type, power_factor = 0.92) {
  if (!power_w || !voltage) return 0;
  const isTri = supply_type === "Trifásico";
  const isBi  = supply_type === "Bifásico";
  let I;
  if (isTri) {
    // I = P / (√3 × V_linha × fp) — cada fase transporta I
    I = power_w / (Math.sqrt(3) * voltage * power_factor);
  } else if (isBi) {
    // Bifásico 220V: dois condutores de fase (127V cada), tensão entre eles = 220V
    // I = P / (V_linha × fp) — AMBOS os condutores transportam a mesma corrente I
    // NÃO dividir por 2: cada condutor carrega a corrente total, não P/2
    I = power_w / (voltage * power_factor);
  } else {
    I = power_w / (voltage * power_factor);
  }
  return Math.round(I * 100) / 100;
}

// ─── Corrente corrigida (com fatores de temperatura e agrupamento) ─────────────────────────────
export function calcCorrectedCurrent(nominal_a, temp_ambient = 30, group_count = 1) {
  const ft = TEMP_FACTORS[temp_ambient] || 1.0;
  const fg = GROUP_FACTORS[Math.min(group_count, 9)] || 0.50;
  return Math.round((nominal_a / (ft * fg)) * 100) / 100;
}

// ─── Seleção da bitola do condutor ────────────────────────────────────────────────────────────
export function minimumWireAreaForCircuit(type = "") {
  const normalized = String(type).toLowerCase();
  if (normalized.includes("ilumina")) return 1.5;
  return 2.5;
}

export function selectWireGauge(corrected_a, install_method = "Eletroduto Embutido em Parede", min_area = 1.5) {
  const col = METHOD_COL[install_method] || "B2";
  const min = WIRE_TABLE.find(w => w[col] >= corrected_a && w.area >= min_area);
  return min || WIRE_TABLE[WIRE_TABLE.length - 1];
}

// ─── Seleção do disjuntor (NBR 5410) ──────────────────────────────────────────────────────────
export function selectBreaker(nominal_a) {
  const SIZES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400];
  return SIZES.find(s => s >= nominal_a) || 400;
}

// ─── Seleção do IDR de entrada (In ≥ In do disjuntor geral) ───────────────────────────────────
// Piso de 40 A: alinha com a base de materiais/orçamento, que cota IDR a partir de 40 A.
export const DR_RATINGS = [40, 63, 80, 100, 125];

export function selectDrRating(breaker_a) {
  const n = Number(breaker_a) || 0;
  return DR_RATINGS.find(r => r >= n) || DR_RATINGS[DR_RATINGS.length - 1];
}

// Polos da proteção geral (disjuntor e IDR) conforme a alimentação.
export function mainProtectionPoles(supply_type) {
  if (supply_type === "Trifásico") return { breaker: 3, dr: 4 };
  return { breaker: 2, dr: 2 };
}

// ─── Proteção geral: fonte única de verdade do dimensionamento da entrada ─────────────────────
// Usada pelo editor de circuitos, balanceamento, diagrama, quadro, orçamento e materiais
// para que o disjuntor geral e o IDR geral batam em todas as telas.
export function calcMainProtection(project = {}, precomputedMetrics = null) {
  const metrics = precomputedMetrics || calcProjectMetrics(project);
  const poles = mainProtectionPoles(project?.supply_type || "Monofásico");
  // Sem circuitos dimensionados o valor não tem significado — usa 40 A como padrão de entrada.
  const hasCircuits = (metrics?.circuits?.length || 0) > 0;
  const breakerCurrent = hasCircuits ? (Number(metrics?.generalBreaker) || 40) : 40;
  return {
    breaker: { current: breakerCurrent, poles: poles.breaker, curve: "C" },
    dr: { current: selectDrRating(breakerCurrent), poles: poles.dr, sensitivity_ma: 30 },
    current: Number(metrics?.generalCurrent) || 0,
  };
}

// ─── Cálculo da queda de tensão ────────────────────────────────────────────────────────────────
export function calcVoltageDrop(power_w, voltage, supply_type, length_m, wire_gauge, power_factor = 0.92) {
  const wireData = WIRE_TABLE.find(w => w.gauge === wire_gauge) || WIRE_TABLE[1];
  const I = calcNominalCurrent(power_w, voltage, supply_type, power_factor);
  const R = wireData.resistance / 1000; // Ω/m → mΩ/m
  const isTri = supply_type === "Trifásico";
  // ΔU = (√3 ou 2) × I × R × L  /  tensão  × 100
  const factor = isTri ? Math.sqrt(3) : 2;
  const deltaU = factor * I * R * length_m;
  const pct = (deltaU / voltage) * 100;
  return {
    drop_v:   Math.round(deltaU * 100) / 100,
    drop_pct: Math.round(pct * 100) / 100,
    ok: pct <= 4, // NBR 5410 item 6.2.7 — 4% para terminais
  };
}

// ─── Cálculo completo de um circuito ──────────────────────────────────────────────────────────
export function calcCircuit(circuit) {
  const {
    power_w = 0,
    voltage = 220,
    supply_type = "Monofásico",
    type = "Tomadas de Uso Geral",
    install_method = "Eletroduto Embutido em Parede",
    temp_ambient = 30,
    group_count = 1,
    length_m = 15,
    power_factor,
    demand_factor = 1,
    point_count = 1,
  } = circuit;

  const fp = power_factor || (type === "Motor" || type === "Ar Condicionado" ? 0.85 : type === "Iluminação" ? 0.92 : 1.0);
  const effectivePower = power_w * demand_factor;

  const nominal_a      = calcNominalCurrent(effectivePower, voltage, supply_type, fp);
  const corrected_a    = calcCorrectedCurrent(nominal_a, temp_ambient, group_count);
  const minWireArea    = minimumWireAreaForCircuit(type);
  let wireData         = selectWireGauge(corrected_a, install_method, minWireArea);
  const breaker_a      = selectBreaker(nominal_a * 1.25);
  let vd               = calcVoltageDrop(effectivePower, voltage, supply_type, length_m, wireData.gauge, fp);
  if (!vd.ok) {
    const methodCol = METHOD_COL[install_method] || "B2";
    const voltageDropWire = WIRE_TABLE.find((wire) => (
      wire.area >= wireData.area &&
      wire.area >= minWireArea &&
      wire[methodCol] >= corrected_a &&
      calcVoltageDrop(effectivePower, voltage, supply_type, length_m, wire.gauge, fp).ok
    ));
    if (voltageDropWire) {
      wireData = voltageDropWire;
      vd = calcVoltageDrop(effectivePower, voltage, supply_type, length_m, wireData.gauge, fp);
    }
  }
  const temp_factor    = TEMP_FACTORS[temp_ambient] || 1.0;
  const group_factor   = GROUP_FACTORS[Math.min(group_count, 9)] || 0.50;
  const poles          = POLES(supply_type);
  const curve          = BREAKER_CURVE(type);
  const breaking_ka    = BREAKING_CAPACITY(voltage);

  return {
    ...circuit,
    project_current_a:    nominal_a,
    corrected_current_a:  corrected_a,
    wire_gauge:           wireData.gauge,
    wire_area:            wireData.area,
    minimum_wire_area:    minWireArea,
    breaker_a,
    breaker_curve:        curve,
    breaker_poles:        poles,
    breaking_capacity_ka: breaking_ka,
    needs_dr:             NEEDS_DR(type),
    needs_dps:            true,
    voltage_drop_v:       vd.drop_v,
    voltage_drop_pct:     vd.drop_pct,
    voltage_drop_ok:      vd.ok,
    temp_factor,
    group_factor,
    install_method,
    din_modules:          poles === 3 ? 3 : poles === 2 ? 2 : 1,
  };
}

// ─── Balanceamento automático de fases ────────────────────────────────────────────────────────
const PHASE_CODES = ["A", "B", "C"];
const BIPHASE_PAIRS = ["AB", "BC", "AC"];

const phaseOptionsForCircuit = (circuit = {}) => {
  if (circuit.supply_type === "Trifásico") return ["ABC"];
  if (circuit.supply_type === "Bifásico") return BIPHASE_PAIRS;
  return PHASE_CODES;
};

const addCurrentToPhaseLoad = (phaseLoad, phase, current) => {
  const next = { ...phaseLoad };
  String(phase || "A").split("").forEach((phaseCode) => {
    if (Object.prototype.hasOwnProperty.call(next, phaseCode)) {
      next[phaseCode] += current;
    }
  });
  return next;
};

const phaseLoadScore = (phaseLoad) => {
  const loads = PHASE_CODES.map((phase) => Number(phaseLoad[phase]) || 0);
  const max = Math.max(...loads, 1);
  const min = Math.min(...loads);
  const average = loads.reduce((sum, value) => sum + value, 0) / PHASE_CODES.length;
  const variance = loads.reduce((sum, value) => sum + (value - average) ** 2, 0);
  return {
    imbalance: (max - min) / max,
    spread: max - min,
    max,
    variance,
  };
};

const isBetterPhaseLoad = (candidate, currentBest) => {
  if (!currentBest) return true;
  const nextScore = candidate.score;
  const bestScore = currentBest.score;
  if (nextScore.imbalance !== bestScore.imbalance) return nextScore.imbalance < bestScore.imbalance;
  if (nextScore.spread !== bestScore.spread) return nextScore.spread < bestScore.spread;
  if (nextScore.max !== bestScore.max) return nextScore.max < bestScore.max;
  return nextScore.variance < bestScore.variance;
};

const greedyPhaseAssignments = (items, phaseLoad) => {
  const assignments = {};
  let load = { ...phaseLoad };
  [...items]
    .sort((a, b) => b.current - a.current || a.index - b.index)
    .forEach((item) => {
      const bestOption = item.options
        .map((phase) => {
          const nextLoad = addCurrentToPhaseLoad(load, phase, item.current);
          return { phase, load: nextLoad, score: phaseLoadScore(nextLoad) };
        })
        .sort((a, b) => (
          a.score.imbalance - b.score.imbalance ||
          a.score.spread - b.score.spread ||
          a.score.max - b.score.max ||
          a.score.variance - b.score.variance
        ))[0];
      assignments[item.index] = bestOption.phase;
      load = bestOption.load;
    });
  return { assignments, load, score: phaseLoadScore(load) };
};

export function autoBalancePhases(circuits) {
  const calculated = (Array.isArray(circuits) ? circuits : []).map(calcCircuit);
  let basePhaseLoad = { A: 0, B: 0, C: 0 };
  const fixedAssignments = {};
  const variableItems = [];

  calculated.forEach((circuit, index) => {
    const current = Number(circuit.project_current_a) || 0;
    const options = phaseOptionsForCircuit(circuit);
    if (options.length === 1) {
      fixedAssignments[index] = options[0];
      basePhaseLoad = addCurrentToPhaseLoad(basePhaseLoad, options[0], current);
      return;
    }
    variableItems.push({ index, current, options });
  });

  const rankedItems = [...variableItems].sort((a, b) => b.current - a.current || a.index - b.index);
  let best = null;

  if (rankedItems.length <= 12) {
    const walk = (itemIndex, load, itemAssignments) => {
      if (itemIndex >= rankedItems.length) {
        const candidate = { assignments: itemAssignments, load, score: phaseLoadScore(load) };
        if (isBetterPhaseLoad(candidate, best)) best = candidate;
        return;
      }

      const item = rankedItems[itemIndex];
      item.options.forEach((phase) => {
        walk(
          itemIndex + 1,
          addCurrentToPhaseLoad(load, phase, item.current),
          { ...itemAssignments, [item.index]: phase },
        );
      });
    };
    walk(0, basePhaseLoad, {});
  } else {
    best = greedyPhaseAssignments(rankedItems, basePhaseLoad);
  }

  const bestAssignments = best?.assignments || {};
  return calculated.map((circuit, index) => ({
    ...circuit,
    phase: bestAssignments[index] || fixedAssignments[index] || phaseOptionsForCircuit(circuit)[0],
  }));
}

// ─── Métricas do projeto ───────────────────────────────────────────────────────────────────────
export function calcProjectMetrics(project) {
  const circuits = autoBalancePhases(project?.circuits || []);
  // Circuitos com as fases "como estão" no projeto salvo, antes do balanceamento automático.
  const rawCircuits = (project?.circuits || []).map(calcCircuit);
  const phaseLoad = { A: 0, B: 0, C: 0 };
  let totalPower = 0;

  circuits.forEach(c => {
    totalPower += c.power_w || 0;
    const ph = c.phase || "A";
    if (ph === "ABC") { phaseLoad.A += c.project_current_a; phaseLoad.B += c.project_current_a; phaseLoad.C += c.project_current_a; }
    else if (ph.length === 2) { phaseLoad[ph[0]] += c.project_current_a; phaseLoad[ph[1]] += c.project_current_a; }
    else { phaseLoad[ph] += c.project_current_a; }
  });

  const maxI = Math.max(phaseLoad.A, phaseLoad.B, phaseLoad.C) || 1;
  const minI = Math.min(phaseLoad.A, phaseLoad.B, phaseLoad.C);
  const imbalance_pct = Math.round(((maxI - minI) / maxI) * 100);
  const neutral_a = Math.round((phaseLoad.A + phaseLoad.B + phaseLoad.C) * 0.1 * 10) / 10;

  // Desequilíbrio "como está" (fases informadas nos circuitos), para comparar antes/depois do ajuste.
  const storedPhaseLoad = { A: 0, B: 0, C: 0 };
  rawCircuits.forEach((c) => {
    const ph = String(c.phase || "A");
    const I = Number(c.project_current_a) || 0;
    if (ph === "ABC") { storedPhaseLoad.A += I; storedPhaseLoad.B += I; storedPhaseLoad.C += I; }
    else if (ph.length === 2) {
      if (storedPhaseLoad[ph[0]] != null) storedPhaseLoad[ph[0]] += I;
      if (storedPhaseLoad[ph[1]] != null) storedPhaseLoad[ph[1]] += I;
    } else if (storedPhaseLoad[ph] != null) { storedPhaseLoad[ph] += I; }
    else { storedPhaseLoad.A += I; }
  });
  const storedMax = Math.max(storedPhaseLoad.A, storedPhaseLoad.B, storedPhaseLoad.C) || 1;
  const storedMin = Math.min(storedPhaseLoad.A, storedPhaseLoad.B, storedPhaseLoad.C);
  const storedImbalance_pct = Math.round(((storedMax - storedMin) / storedMax) * 100);

  const totalDins = circuits.reduce((s, c) => s + (c.din_modules || 1), 0) + 4 + 2; // + geral + DPS
  const drCircuits = circuits.filter(c => c.needs_dr).length;
  const drDins = Math.ceil(drCircuits / 2) * 2; // DRs 2P agrupam 2 circuitos
  const panelSize = Math.ceil((totalDins + drDins) * 1.2 / 6) * 6; // +20% reserva, multiplo de 6

  // Corrente geral = fase mais carregada (NBR 5410 — proteção geral)
  const generalCurrent = Math.round(maxI * 10) / 10;
  const generalBreaker = selectBreaker(maxI * 1.25);
  const generalPolesSet = mainProtectionPoles(project?.supply_type || "Monofásico");
  const generalBreakerPoles = generalPolesSet.breaker;
  const generalDr = selectDrRating(generalBreaker);
  const generalDrPoles = generalPolesSet.dr;

  // Validações NBR 5410
  const validations = [];
  if (imbalance_pct > 10) validations.push({
    severity: "error",
    code: "phase_imbalance",
    msg: `Desequilíbrio severo de fases: ${imbalance_pct}%`,
    action: "Redistribua os circuitos entre as fases até o desequilíbrio ficar em 5% ou menos.",
  });
  else if (imbalance_pct > 5) validations.push({
    severity: "warning",
    code: "phase_imbalance",
    msg: `Desequilíbrio de fases: ${imbalance_pct}% (recomendado < 5%)`,
    action: "Rebalanceie os circuitos monofásicos e bifásicos para aproximar as correntes das fases A, B e C.",
  });
  circuits.forEach(c => {
    if (!c.voltage_drop_ok) validations.push({
      severity: "error",
      code: "voltage_drop",
      circuit_id: c.id || c.circuit_id,
      msg: `Circuito "${c.name}": queda de tensão ${c.voltage_drop_pct}% > 4%`,
      action: "Aumente a seção do condutor; se continuar acima de 4%, reduza o comprimento ou divida o circuito.",
    });
    if (!c.needs_dr && ["Tomadas de Uso Geral", "Chuveiro", "Ar Condicionado"].includes(c.type)) validations.push({
      severity: "warning",
      code: "dr_required",
      circuit_id: c.id || c.circuit_id,
      msg: `Circuito "${c.name}": DR recomendado`,
      action: "Preveja proteção DR de 30 mA para esse circuito.",
    });
  });
  if (!circuits.some(c => c.needs_dps)) validations.push({
    severity: "warning",
    code: "dps_required",
    msg: "DPS não instalado — recomendado NBR 5410",
    action: "Inclua DPS no quadro e atualize o diagrama do projeto.",
  });

  const nbrScore = Math.max(0, 100 - validations.filter(v => v.severity === "error").length * 15 - validations.filter(v => v.severity === "warning").length * 5);

  // Carga monofásica de maior corrente na fase mais carregada: é ela que trava o
  // balanceamento automático, porque não pode ser dividida entre fases.
  let imbalanceBlocker = null;
  if (imbalance_pct > 5) {
    const heaviestPhase = ["A", "B", "C"].reduce((a, b) => (phaseLoad[b] > phaseLoad[a] ? b : a));
    const blocker = circuits
      .filter((c) => {
        const ph = String(c.phase || "A");
        return ph.length === 1 && ph === heaviestPhase;
      })
      .sort((a, b) => (Number(b.project_current_a) || 0) - (Number(a.project_current_a) || 0))[0];
    if (blocker) {
      imbalanceBlocker = {
        name: blocker.name || "circuito sem nome",
        current_a: Math.round((Number(blocker.project_current_a) || 0) * 10) / 10,
        phase: heaviestPhase,
        supply_type: blocker.supply_type || "Monofásico",
        type: blocker.type || null,
      };
    }
  }

  return {
    circuits, phaseLoad, imbalance_pct, storedImbalance_pct, imbalanceBlocker, neutral_a, totalPower,
    totalDins, panelSize, generalBreaker, generalCurrent: Math.round(generalCurrent * 10) / 10,
    generalBreakerPoles, generalDr, generalDrPoles,
    validations, nbrScore,
  };
}

export function generateDefaultPanelLayout(proj, options = {}) {
  const ROW_MAX = 18;
  if (!proj) return { rails: [], wires: [], infrastructure: [] };
  const isSolarProject = !options.forceDistribution && (proj.project_type === "Solar" || Boolean(proj.solar_config));
  const supply = proj.supply_type || "Monofásico";
  const isMonophase = supply === "Monofásico";
  const hasNeutralConductor = supply === "Monofásico" || supply === "Trifásico";
  const voltage = proj.voltage || 220;
  const circuits = proj.circuits || [];
  const phaseWireColor = (poleIndex = 0) => ["black", "red", "brown"][poleIndex] || "black";
  const formatWireLabel = (gauge = "") => String(gauge || "").replace("mm²", " mm²");
  const cleanDisplayText = (value = "") => String(value ?? "").replace(/\s+/g, " ").trim();
  const isTechnicalDisplayText = (value = "") => {
    const text = cleanDisplayText(value);
    if (!text) return true;
    return /^(retorno|conex[aã]o|fase|sa[ií]da)$/i.test(text)
      || /^(circuit|circuit_group|breaker|busbar|load_out|comp|wire)[_: -]?\w*$/i.test(text);
  };
  const getCircuitNumber = (circuit = {}, index = null) => {
    const explicit = cleanDisplayText(
      circuit.circuitNumber
      ?? circuit.circuit_number
      ?? circuit.number
      ?? circuit.circuit_no
      ?? circuit.ref
      ?? "",
    );
    if (explicit) return explicit;
    return Number.isFinite(Number(index)) ? `C${Number(index) + 1}` : "";
  };
  const getCircuitLabel = (circuit = {}, index = null) => {
    const label = cleanDisplayText(circuit.label ?? circuit.circuit_label ?? "");
    if (label && !isTechnicalDisplayText(label)) return label;
    const number = getCircuitNumber(circuit, index);
    const name = cleanDisplayText(circuit.name ?? circuit.circuit_name ?? "");
    if (number && name && !isTechnicalDisplayText(name)) return `${number} - ${name}`;
    if (name && !isTechnicalDisplayText(name)) return name;
    return number || "Circuito sem identificação";
  };
  const phaseCountForBreaker = (breaker) => {
    if (breaker?.supply_type === "Trifásico" || breaker?.phase === "ABC" || Number(breaker?.poles) >= 3) return 3;
    if (breaker?.supply_type === "Bifásico" || breaker?.phase === "AB" || Number(breaker?.poles) === 2) return 2;
    return 1;
  };
  const breakerNeedsNeutral = (breaker) => {
    if (breaker?.supply_type) return breaker.supply_type === "Monofásico";
    const phase = String(breaker?.phase || "");
    return phase.length === 1 && phase !== "N" && Number(breaker?.poles || 1) <= 1;
  };
  
  const totalPower = circuits.reduce((sum, c) => sum + (c.power_w || 0), 0);
  // Proteção geral vem do dimensionamento (mesma fonte do editor de circuitos),
  // para o quadro bater com balanceamento, diagrama, orçamento e materiais.
  const mainProtection = calcMainProtection({ ...proj, circuits, supply_type: supply, voltage });
  const genCurrent = mainProtection.breaker.current;
  const genPoles = mainProtection.breaker.poles;
  const genDrCurrent = mainProtection.dr.current;
  const genDrPoles = mainProtection.dr.poles;
  
  const rail1Components = [];
  
  // DPS
  const dpsCount = supply === "Trifásico" ? 3 : supply === "Bifásico" ? 2 : 1;
  for (let i = 0; i < dpsCount; i++) {
    rail1Components.push({
      id: `dps_${i}`,
      type: "dps",
      label: `DPS F${String.fromCharCode(65 + i)}`,
      poles: 1,
      phase: String.fromCharCode(65 + i),
      status: "ON",
      dpsStatus: "OK"
    });
  }
  
  // Geral
  rail1Components.push({
    id: "gen_brk",
    type: "breaker",
    label: "DJ GERAL",
    current: genCurrent,
    curve: "C",
    poles: genPoles,
    isGeneral: true,
    phase: supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A",
    status: "ON"
  });
  
  // DR Geral
  const hasDR = circuits.some(c => c.needs_dr || c.wet_area) || true;
  if (hasDR) {
    rail1Components.push({
      id: "gen_dr",
      type: "dr",
      label: "IDR GERAL",
      current: genDrCurrent,
      poles: genDrPoles,
      phase: supply === "Trifásico" ? "ABCN" : supply === "Bifásico" ? "AB" : "AN",
      supply_type: supply,
      status: "ON"
    });
  }
  
  // Preenche trilho 1
  const rail1Used = rail1Components.reduce((sum, c) => sum + c.poles, 0);
  if (rail1Used < ROW_MAX) {
    rail1Components.push({
      id: "spacer_1",
      type: "spacer",
      poles: ROW_MAX - rail1Used,
      label: "RESERVA TÉCNICA"
    });
  }
  
  // Trilhos 2 e 3
  const rail2Components = [];
  const rail3Components = [];
  
  circuits.forEach((c, idx) => {
    const circuitId = c.id || c.circuit_id || c.source_point_id || `circuit_${idx}`;
    const circuitNumber = getCircuitNumber(c, idx);
    const circuitLabel = getCircuitLabel(c, idx);
    const circuitName = cleanDisplayText(c.name ?? c.circuit_name ?? "");
    const comp = {
      id: `circuit_${idx}`,
      type: "breaker",
      label: circuitLabel,
      name: circuitName && !isTechnicalDisplayText(circuitName) ? circuitName : circuitLabel,
      circuitNumber,
      circuitLabel,
      description: c.description || c.short_description || "",
      circuit_id: circuitId,
      source: c.source,
      source_point_id: c.source_point_id,
      circuit_type: c.type,
      conductorSection: c.conductorSection || c.wire_gauge,
      current: c.breaker_a || 16,
      curve: c.breaker_curve || "B",
      poles: c.breaker_poles || 1,
      phase: c.phase || "A",
      supply_type: c.supply_type || "Monofásico",
      wire_gauge: c.wire_gauge,
      conduit_diameter: c.conduit_diameter,
      status: "ON"
    };
    
    const rail2Used = rail2Components.reduce((sum, item) => sum + item.poles, 0);
    if (rail2Used + comp.poles <= ROW_MAX) {
      rail2Components.push(comp);
    } else {
      rail3Components.push(comp);
    }
  });
  
  const rail2Used = rail2Components.reduce((sum, item) => sum + item.poles, 0);
  if (rail2Used < ROW_MAX) {
    rail2Components.push({
      id: "spacer_2",
      type: "spacer",
      poles: ROW_MAX - rail2Used,
      label: "RESERVA"
    });
  }
  
  const rails = [{
    id: "rail_1",
    name: isSolarProject ? "Trilho DIN Solar (Proteção e Inversor)" : "Trilho DIN Superior (Entrada e Proteção)",
    components: rail1Components,
  }];

  if (!isSolarProject) {
    rails.push({ id: "rail_2", name: "Trilho DIN Central (Distribuição)", components: rail2Components });
  }
  
  if (!isSolarProject && (rail3Components.length > 0 || circuits.length > 6)) {
    const rail3Used = rail3Components.reduce((sum, item) => sum + item.poles, 0);
    if (rail3Used < ROW_MAX) {
      rail3Components.push({
        id: "spacer_3",
        type: "spacer",
        poles: ROW_MAX - rail3Used,
        label: "RESERVA"
      });
    }
    rails.push({ id: "rail_3", name: "Trilho DIN Inferior (Distribuição)", components: rail3Components });
  }

  // FIOS AUTOMÁTICOS
  const wires = [];
  
  // 1. Terra alimentação externa ao barramento
  wires.push({
    id: "w_ground_feed",
    color: "green",
    gauge: "10mm²",
    source: "terminal_left_top:0",
    target: "busbar_ground:0",
    label: "10 mm²"
  });
  
  // 2. Terra aos DPS
  for (let i = 0; i < dpsCount; i++) {
    wires.push({
      id: `w_dps_ground_${i}`,
      color: "green",
      gauge: "6mm²",
      source: `comp:dps_${i}:bottom:0`,
      target: `busbar_ground:${2 + i}`,
      label: "6 mm²"
    });
  }
  
  // 3. Neutro geral e barramento superior.
  if (hasNeutralConductor) {
    const neutralPoleIndex = supply === "Trifásico" ? 3 : 1;
    if (hasDR) {
      wires.push({
        id: "w_neutral_feed",
        color: "blue",
        gauge: "10mm²",
        source: "terminal_left_top:4",
        target: `comp:gen_dr:top:${neutralPoleIndex}`,
        label: "10 mm²"
      });
      wires.push({
        id: "w_neutral_dr_to_bar",
        color: "blue",
        gauge: "10mm²",
        source: `comp:gen_dr:bottom:${neutralPoleIndex}`,
        target: "busbar_neutral:0",
        label: "10 mm²"
      });
    } else if (isMonophase) {
      wires.push({
        id: "w_neutral_gen_to_bar",
        color: "blue",
        gauge: "10mm²",
        source: "comp:gen_brk:bottom:1",
        target: "busbar_neutral:0",
        label: "10 mm²"
      });
    } else {
      wires.push({
        id: "w_neutral_feed_to_bar",
        color: "blue",
        gauge: "10mm²",
        source: "terminal_left_top:4",
        target: "busbar_neutral:0",
        label: "10 mm²"
      });
    }
  }
  
  // 4. Alimentação superior por fase conforme o tipo do quadro.
  const feedCount = supply === "Trifásico" ? 3 : supply === "Bifásico" ? 2 : 1;
  for (let i = 0; i < feedCount; i++) {
    wires.push({
      id: `w_phase_feed_${i}`,
      color: phaseWireColor(i),
      gauge: "10mm²",
      source: `terminal_left_top:${i + 1}`,
      target: `comp:gen_brk:top:${i}`,
      label: "10 mm²"
    });
  }
  
  // DR Alimentação Fases
  if (hasDR) {
    for (let i = 0; i < feedCount; i++) {
      wires.push({
        id: `w_phase_gen_to_dr_${i}`,
        color: phaseWireColor(i),
        gauge: "10mm²",
        source: `comp:gen_brk:bottom:${i}`,
        target: `comp:gen_dr:top:${i}`,
        label: "10 mm²"
      });
    }
  }
  
  // Distribuição Trilho 2
  const sourceComp = hasDR ? "gen_dr" : "gen_brk";
  const distributionBreakers = isSolarProject ? [] : [...rail2Components, ...rail3Components].filter(c => c.type === "breaker");
  if (distributionBreakers.length > 0) {
    const firstBreaker = distributionBreakers[0];
    const distributionGauge = firstBreaker.wire_gauge || "2.5mm²";
    wires.push({
      id: "w_r2_dist_main_in",
      color: "red",
      gauge: distributionGauge,
      source: `comp:${sourceComp}:bottom:0`,
      target: `comp:${firstBreaker.id}:top:0`,
      label: formatWireLabel(distributionGauge)
    });
  }
  distributionBreakers.forEach((breaker) => {
    const breakerPhaseCount = phaseCountForBreaker(breaker);
    const circuitGauge = breaker.wire_gauge || "2.5mm²";
    const circuitLabel = formatWireLabel(circuitGauge);
    for (let poleIndex = 0; poleIndex < breakerPhaseCount; poleIndex++) {
      const color = phaseWireColor(poleIndex);
      wires.push({
        id: `w_r2_dist_out_${breaker.id}_${poleIndex}`,
        color,
        gauge: circuitGauge,
        name: `Fase L${poleIndex + 1} - ${breaker.circuitLabel || breaker.label}`,
        circuit_id: breaker.circuit_id,
        circuitNumber: breaker.circuitNumber,
        circuitName: breaker.name,
        circuitLabel: breaker.circuitLabel || breaker.label,
        conductorType: "phase",
        phase: `L${poleIndex + 1}`,
        source: `comp:${breaker.id}:bottom:${poleIndex}`,
        target: `load_out:${breaker.id}:${poleIndex}`,
        label: circuitLabel
      });
    }
  });

  // Conexões de circuitos individuais
  distributionBreakers.forEach((b, idx) => {
    if (breakerNeedsNeutral(b)) {
      const circuitGauge = b.wire_gauge || "2.5mm²";
      wires.push({
        id: `w_circ_n_${b.id}`,
        color: "blue",
        gauge: circuitGauge,
        name: `Neutro - ${b.circuitLabel || b.label}`,
        circuit_id: b.circuit_id,
        circuitNumber: b.circuitNumber,
        circuitName: b.name,
        circuitLabel: b.circuitLabel || b.label,
        conductorType: "neutral",
        source: `busbar_neutral:${3 + idx}`,
        target: `load_out:${b.id}:neutral`,
        label: formatWireLabel(circuitGauge)
      });
    }
    const circuitGauge = b.wire_gauge || "2.5mm²";
    wires.push({
      id: `w_circ_g_${b.id}`,
      color: "green",
      gauge: circuitGauge,
      name: `Terra - ${b.circuitLabel || b.label}`,
      circuit_id: b.circuit_id,
      circuitNumber: b.circuitNumber,
      circuitName: b.name,
      circuitLabel: b.circuitLabel || b.label,
      conductorType: "ground",
      source: `busbar_ground:${4 + idx}`,
      target: `load_out:${b.id}:ground`,
      label: formatWireLabel(circuitGauge)
    });
  });

  return { rails, wires, infrastructure: [] };
}

export function buildPanelBoardsWithLayout(project, panelLayout = generateDefaultPanelLayout(project, { forceDistribution: true })) {
  const existingBoards = Array.isArray(project?.panel_boards) ? project.panel_boards : [];
  const distributionType = "principal";
  const makeDistributionBoard = () => ({
    id: `board_distribution_${Date.now()}`,
    name: "QD-01 Principal",
    location: "Entrada / Distribuição",
    type: distributionType,
    supply_type: project?.supply_type || "Monofásico",
    layout: panelLayout,
  });

  if (existingBoards.length === 0) {
    return [makeDistributionBoard()];
  }

  const primaryIndex = existingBoards.findIndex((board) => (
    !["qgbt", "solar_ac"].includes(String(board?.type || "").toLowerCase())
  ));

  if (primaryIndex < 0) {
    return [...existingBoards, makeDistributionBoard()];
  }

  return existingBoards.map((board, index) => (
    index === primaryIndex
      ? {
          ...board,
          id: board.id || "board_distribution_1",
          name: board.name || "QD-01 Principal",
          location: board.location || "Entrada / Distribuição",
          type: board.type || distributionType,
          supply_type: board.supply_type || project?.supply_type || "Monofásico",
          layout: panelLayout,
        }
      : board
  ));
}

export function calculateProjectDemand(circuits = []) {
  return (Array.isArray(circuits) ? circuits : []).reduce((sum, circuit) => (
    sum + (Number(circuit?.power_w) || 0) * (Number(circuit?.demand_factor) || 1)
  ), 0);
}

export function buildProjectElectricalSyncPayload(project, circuits = []) {
  const syncedCircuits = Array.isArray(circuits) ? circuits : [];
  const totalDemand = calculateProjectDemand(syncedCircuits);
  const projectForPanel = { ...(project || {}), circuits: syncedCircuits, total_demand_w: totalDemand };
  const panelLayout = generateDefaultPanelLayout(projectForPanel, { forceDistribution: true });
  const panelBoards = buildPanelBoardsWithLayout(projectForPanel, panelLayout);

  return {
    circuits: syncedCircuits,
    total_demand_w: totalDemand,
    panel_layout: panelLayout,
    panel_boards: panelBoards,
    diagram_layout: null,
  };
}
