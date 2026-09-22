/**
 * Motor NBR 5410 Profissional
 * Cálculos elétricos paramétricos e auditoria normativa conforme ABNT NBR 5410:2004 + Em.1:2008
 */

// ─── Tabela de bitolas NBR 5410 (corrente nominal em A por método de instalação) ──────────────
// Método B2 = Eletroduto embutido | B1 = Eletroduto aparente | D1 = No solo
export const WIRE_TABLE = [
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
  { gauge: "150mm²",  area: 150,  B2: 216, B1: 260, D1: 299, resistance: 0.124 },
  { gauge: "185mm²",  area: 185,  B2: 245, B1: 297, D1: 341, resistance: 0.099 },
  { gauge: "240mm²",  area: 240,  B2: 286, B1: 350, D1: 403, resistance: 0.075 },
];

// ─── Fatores de correção NBR 5410 Tabela 40 (temperatura ambiente para condutores PVC) ─────────
export const TEMP_FACTORS = {
  25: 1.06, 30: 1.00, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.50,
};

// ─── Fatores de agrupamento NBR 5410 Tabela 42 (em feixe ou eletroduto) ────────────────────────
export const GROUP_FACTORS = {
  1: 1.00, 2: 0.80, 3: 0.70, 4: 0.65, 5: 0.60, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.50,
};

// ─── Capacidade de interrupção recomendada por nível de tensão e porte ────────────────────────
export const BREAKING_CAPACITY = (voltage) => {
  if (voltage <= 220) return 3; // kA mínimo residencial / comercial leve
  if (voltage <= 380) return 6; // kA padrão comercial
  return 10;
};

// ─── Método de instalação → coluna da tabela NBR 5410 ─────────────────────────────────────────
export const METHOD_COL = {
  "Eletroduto Embutido em Parede":    "B2",
  "Eletroduto Aparente":              "B1",
  "Cabo Multipolar Fixado":           "B1",
  "Bandeja Perfurada":                "B1",
  "Enterrado Direto no Solo":         "D1",
  "Eletroduto Enterrado":             "D1",
};

// ─── DR obrigatório por tipo (NBR 5410 item 5.1.3.2.2) ────────────────────────────────────────
export const NEEDS_DR = (type = "") => {
  const norm = String(type || "").toLowerCase();
  return (
    norm.includes("tomada") ||
    norm.includes("tug") ||
    norm.includes("tue") ||
    norm.includes("chuveiro") ||
    norm.includes("ducha") ||
    norm.includes("banheiro") ||
    norm.includes("cozinha") ||
    norm.includes("lavanderia") ||
    norm.includes("extern") ||
    norm.includes("ar condicionado") ||
    norm.includes("bomba") ||
    norm.includes("veicular") ||
    norm.includes("piscina")
  );
};

// ─── Curva do disjuntor por tipo de carga ─────────────────────────────────────────────────────
export const BREAKER_CURVE = (type = "") => {
  const norm = String(type || "").toLowerCase();
  if (norm.includes("motor") || norm.includes("bomba") || norm.includes("ar condicionado") || norm.includes("compressor")) return "D";
  if (norm.includes("servidor") || norm.includes("nobreak") || norm.includes("cftv") || norm.includes("rack")) return "C";
  if (norm.includes("chuveiro") || norm.includes("forno") || norm.includes("resistiv") || norm.includes("ilumina")) return "B";
  return "C";
};

// ─── Número de polos por tipo de alimentação da carga ─────────────────────────────────────────
export const POLES = (supply) => {
  if (supply === "Monofásico") return 1;
  if (supply === "Bifásico")   return 2;
  if (supply === "Trifásico")  return 3;
  return 1;
};

// ─── Série comercial padronizada de disjuntores (NBR NM 60898 / NBR IEC 60947-2) ──────────────
export const COMMERCIAL_BREAKER_RATINGS = [
  6, 10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125, 160, 200, 225, 250, 315, 350, 400, 500, 630, 800,
];

// ─── Degraus comerciais de IDR de entrada (Piso padrão 40A em conformidade com materiais) ─────
export const DR_RATINGS = [40, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];

// ─── Fatores de demanda padrão (NBR 5410 / Concessionárias brasileiras) ───────────────────────
export const DEFAULT_DEMAND_FACTORS = {
  "Iluminação": 1.0,
  "Tomadas de Uso Geral": 0.70,
  "Tomadas de Uso Específico": 0.80,
  "Chuveiro": 1.0,
  "Forno": 0.80,
  "Ar Condicionado": 0.85,
  "Motor": 0.80,
  "Bomba Hidráulica": 0.80,
  "Servidor": 0.85,
  "CFTV": 0.80,
  "Nobreak": 0.85,
  "Carregador Veicular": 1.0,
};

export function getDefaultDemandFactor(type = "", name = "") {
  const normType = String(type || "").trim();
  const normName = String(name || "").toLowerCase();

  if (normName.includes("chuveiro") || normName.includes("ducha")) return 1.0;
  if (normName.includes("ar condicionado") || normName.includes("split") || normName.includes("inverter")) return 0.85;
  if (normName.includes("forno") || normName.includes("cooktop") || normName.includes("fogão")) return 0.80;
  if (normName.includes("microondas") || normName.includes("micro-ondas")) return 0.70;
  if (normName.includes("motor") || normName.includes("bomba")) return 0.80;
  if (normName.includes("carregador") || normName.includes("veicular") || normName.includes("ev")) return 1.0;
  if (normName.includes("ilumin") || normName.includes("luz") || normName.includes("lustre")) return 1.0;
  if (normName.includes("tomada") || normName.includes("tug")) return 0.70;

  if (DEFAULT_DEMAND_FACTORS[normType] !== undefined) {
    return DEFAULT_DEMAND_FACTORS[normType];
  }

  const lower = normType.toLowerCase();
  if (lower.includes("ilumina")) return 1.0;
  if (lower.includes("geral") || lower.includes("tug")) return 0.70;
  if (lower.includes("chuveiro")) return 1.0;
  if (lower.includes("ar condicionado")) return 0.85;
  if (lower.includes("motor") || lower.includes("bomba")) return 0.80;
  if (lower.includes("específico") || lower.includes("tue")) return 0.80;

  return 0.80;
}

// ─── Normalização e Conversão de Potências (W, kW, VA, kVA, cv, HP) ───────────────────────────
export function normalizeElectricalPower({
  power = 0,
  power_unit = "W",
  power_w = null,
  power_va = null,
  power_factor = 0.92,
  efficiency = 1.0,
} = {}) {
  const fp = Math.max(0.01, Number(power_factor) || 0.92);
  const eta = Math.min(1.0, Math.max(0.1, Number(efficiency) || 1.0));
  const rawVal = Number(power_w !== null && power_w !== undefined && power_w !== "" ? power_w : power || 0);
  const unit = String(power_unit || "W").trim().toUpperCase();

  let activeW = 0;
  let apparentVa = 0;

  if (unit === "KW") {
    activeW = rawVal * 1000;
    apparentVa = activeW / fp;
  } else if (unit === "KVA") {
    apparentVa = rawVal * 1000;
    activeW = apparentVa * fp;
  } else if (unit === "VA") {
    apparentVa = rawVal;
    activeW = apparentVa * fp;
  } else if (unit === "CV") {
    // 1 cv = 735.49875 W mecânicos; Potência elétrica de entrada = Pmec / eta
    const pMecW = rawVal * 735.49875;
    activeW = pMecW / eta;
    apparentVa = activeW / fp;
  } else if (unit === "HP") {
    // 1 HP = 745.69987 W mecânicos; Potência elétrica de entrada = Pmec / eta
    const pMecW = rawVal * 745.69987;
    activeW = pMecW / eta;
    apparentVa = activeW / fp;
  } else {
    // Padrão em W
    activeW = rawVal;
    apparentVa = activeW / fp;
  }

  if (power_va !== null && power_va !== undefined && Number(power_va) > 0) {
    apparentVa = Number(power_va);
    activeW = apparentVa * fp;
  }

  return {
    power_w: Math.round(activeW * 100) / 100,
    power_va: Math.round(apparentVa * 100) / 100,
    power_factor: fp,
    efficiency: eta,
  };
}

// ─── Motor de Cálculo de Corrente por Tipo de Alimentação ─────────────────────────────────────
export function calcNominalCurrent(power_w, voltage, supply_type, power_factor = 0.92, power_va = null) {
  const p = Number(power_w) || 0;
  const v = Number(voltage) || 0;
  const fp = Math.max(0.01, Number(power_factor) || 0.92);
  if (v <= 0) return 0;

  const s = (power_va !== null && power_va !== undefined && Number(power_va) > 0)
    ? Number(power_va)
    : (p > 0 ? p / fp : 0);

  if (p <= 0 && s <= 0) return 0;

  let I = 0;
  if (supply_type === "Trifásico") {
    // Trifásico equilibrado: I = P / (√3 × V_linha × fp) = S / (√3 × V_linha)
    I = s / (Math.sqrt(3) * v);
  } else if (supply_type === "Bifásico") {
    // Carga monofásica ligada entre duas fases (tensão entre fases V_FF):
    // I = P / (V_linha × fp) = S / V_linha (NÃO aplicar raiz de 3)
    I = s / v;
  } else {
    // Monofásico F+N: I = P / (V_fn × fp) = S / V_fn
    I = s / v;
  }

  return Math.round(I * 100) / 100;
}

// ─── Corrente corrigida (fatores de temperatura e agrupamento NBR 5410) ─────────────────────────
export function calcCorrectedCurrent(nominal_a, temp_ambient = 30, group_count = 1) {
  const current = Number(nominal_a) || 0;
  if (current <= 0) return 0;
  const ft = TEMP_FACTORS[temp_ambient] || 1.0;
  const fg = GROUP_FACTORS[Math.min(Math.max(1, Number(group_count) || 1), 9)] || 0.50;
  return Math.round((current / (ft * fg)) * 100) / 100;
}

// ─── Seção mínima dos condutores (NBR 5410 Tabela 47) ─────────────────────────────────────────
export function minimumWireAreaForCircuit(type = "") {
  const normalized = String(type).toLowerCase();
  if (normalized.includes("ilumina") || normalized.includes("luz")) return 1.5;
  return 2.5;
}

// ─── Seleção da bitola do condutor (critério da capacidade de condução) ───────────────────────
export function selectWireGauge(corrected_a, install_method = "Eletroduto Embutido em Parede", min_area = 1.5) {
  const col = METHOD_COL[install_method] || "B2";
  const min = WIRE_TABLE.find(w => w[col] >= corrected_a && w.area >= min_area);
  return min || WIRE_TABLE[WIRE_TABLE.length - 1];
}

// ─── Seleção do condutor alimentador geral ────────────────────────────────────────────────────
export function selectFeederCable(designCurrent_a, installMethod = "Eletroduto Embutido em Parede", tempAmbient = 30, groupCount = 1) {
  const current = Number(designCurrent_a) || 0;
  const corrected_a = calcCorrectedCurrent(current, tempAmbient, groupCount);
  const col = METHOD_COL[installMethod] || "B2";
  const cable = WIRE_TABLE.find(w => w[col] >= corrected_a && w.area >= 2.5) || WIRE_TABLE[WIRE_TABLE.length - 1];
  const ft = TEMP_FACTORS[tempAmbient] || 1.0;
  const fg = GROUP_FACTORS[Math.min(Math.max(1, Number(groupCount) || 1), 9)] || 0.50;
  const iz = Math.round(cable[col] * ft * fg * 10) / 10;
  return {
    gauge: cable.gauge,
    area: cable.area,
    baseAmpacity: cable[col],
    iz,
    correctedAmpacity: iz,
  };
}

// ─── Seleção comercial do disjuntor (NBR 5410) ────────────────────────────────────────────────
export function selectBreaker(nominal_a) {
  const val = Number(nominal_a);
  if (!Number.isFinite(val) || val <= 0) return null;
  return COMMERCIAL_BREAKER_RATINGS.find(s => s >= val) || COMMERCIAL_BREAKER_RATINGS[COMMERCIAL_BREAKER_RATINGS.length - 1];
}

// ─── Seleção do IDR geral (In,DR ≥ In,disjuntor) ──────────────────────────────────────────────
export function selectDrRating(breaker_a) {
  const n = Number(breaker_a);
  if (!Number.isFinite(n) || n <= 0) return null;
  return DR_RATINGS.find(r => r >= n) || DR_RATINGS[DR_RATINGS.length - 1];
}

// ─── Polos da proteção geral conforme a alimentação ──────────────────────────────────────────
export function mainProtectionPoles(supply_type, { neutral_switched = true } = {}) {
  if (supply_type === "Trifásico") {
    return {
      breaker: neutral_switched ? 3 : 3, // Padrão 3P (ou 4P em esquemas com neutro seccionado)
      dr: 4,                             // IDR Tetrapolar (3F+N)
    };
  }
  if (supply_type === "Bifásico") {
    return {
      breaker: 2, // Bipolar (2 fases)
      dr: 2,      // IDR Bipolar
    };
  }
  return {
    breaker: neutral_switched ? 2 : 1, // Monofásico com seccionamento de entrada (2P ou 1P)
    dr: 2,
  };
}

// ─── Proteção Geral: Fonte Única de Verdade do Dimensionamento da Entrada ─────────────────────
export function calcMainProtection(project = {}, precomputedMetrics = null) {
  const metrics = precomputedMetrics || calcProjectMetrics(project);
  const supply = project?.supply_type || "Monofásico";
  const poles = mainProtectionPoles(supply);
  const circuits = metrics?.circuits || [];
  const hasCircuits = circuits.length > 0;
  const generalCurrent = Number(metrics?.generalCurrent) || 0;

  if (!hasCircuits || generalCurrent <= 0) {
    return {
      breaker: {
        current: null,
        poles: poles.breaker,
        curve: "C",
        status: "insufficient_data",
        statusMessage: "Nenhuma carga cadastrada",
        isManual: false,
        isVerified: false,
      },
      dr: {
        current: null,
        poles: poles.dr,
        sensitivity_ma: 30,
        status: "insufficient_data",
      },
      feeder: null,
      current: 0,
      status: "insufficient_data",
      statusMessage: "Dados insuficientes — cadastre circuitos para dimensionar a proteção geral",
    };
  }

  const autoBreaker = selectBreaker(generalCurrent);
  const manualBreaker = project?.manual_general_breaker ? Number(project.manual_general_breaker) : null;
  const breakerCurrent = manualBreaker || autoBreaker;
  const isManual = Boolean(manualBreaker);

  // Dimensionamento / verificação do alimentador geral
  const installMethod = project?.feeder_install_method || "Eletroduto Embutido em Parede";
  const tempAmbient = project?.temp_ambient || 30;
  const groupCount = project?.group_count || 1;
  const feeder = selectFeederCable(breakerCurrent, installMethod, tempAmbient, groupCount);

  // Verificação de sobrecarga NBR 5410: Ib <= In <= Iz
  let status = "verified";
  let statusMessage = "Dimensionamento verificado conforme NBR 5410";
  let isOverloaded = false;
  let isCableProtected = true;

  if (breakerCurrent < generalCurrent) {
    status = "incompatible";
    statusMessage = `Disjuntor geral (${breakerCurrent}A) menor que a corrente de demanda Ib (${generalCurrent}A)`;
    isOverloaded = true;
  } else if (feeder.iz < breakerCurrent) {
    status = "incompatible";
    statusMessage = `Capacidade do cabo alimentador (${feeder.iz}A) menor que o disjuntor geral In (${breakerCurrent}A)`;
    isCableProtected = false;
  } else if (isManual) {
    status = "verified_manual";
    statusMessage = `Disjuntor manual (${breakerCurrent}A) verificado (Ib: ${generalCurrent}A ≤ In: ${breakerCurrent}A ≤ Iz: ${feeder.iz}A)`;
  }

  const drRating = selectDrRating(breakerCurrent);

  return {
    breaker: {
      current: breakerCurrent,
      poles: poles.breaker,
      curve: "C",
      status,
      statusMessage,
      isManual,
      isOverloaded,
      isCableProtected,
      isVerified: status === "verified" || status === "verified_manual",
    },
    dr: {
      current: drRating,
      poles: poles.dr,
      sensitivity_ma: 30,
      status: "verified",
      statusMessage: `IDR ${poles.dr}P ${drRating}A 30mA coordenado (In,DR ≥ In)`,
    },
    feeder,
    current: generalCurrent,
    status,
    statusMessage,
  };
}

// ─── Cálculo da Queda de Tensão (NBR 5410 item 6.2.7) ──────────────────────────────────────────
export function calcVoltageDrop(power_w, voltage, supply_type, length_m, wire_gauge, power_factor = 0.92) {
  const wireData = WIRE_TABLE.find(w => w.gauge === wire_gauge) || WIRE_TABLE[1];
  const I = calcNominalCurrent(power_w, voltage, supply_type, power_factor);
  const R = wireData.resistance / 1000; // Ω/km → Ω/m
  const isTri = supply_type === "Trifásico";
  // ΔU = (√3 ou 2) × I × R × L  /  tensão  × 100
  const factor = isTri ? Math.sqrt(3) : 2;
  const deltaU = factor * I * R * length_m;
  const pct = voltage > 0 ? (deltaU / voltage) * 100 : 0;
  return {
    drop_v:   Math.round(deltaU * 100) / 100,
    drop_pct: Math.round(pct * 100) / 100,
    ok: pct <= 4, // NBR 5410 item 6.2.7 — limite de 4% para circuitos terminais
  };
}

// ─── Cálculo Completo de um Circuito Individual ───────────────────────────────────────────────
export function calcCircuit(circuit = {}) {
  const {
    power,
    power_unit = "W",
    power_w = 0,
    power_va = null,
    voltage = 220,
    supply_type = "Monofásico",
    type = "Tomadas de Uso Geral",
    install_method = "Eletroduto Embutido em Parede",
    temp_ambient = 30,
    group_count = 1,
    length_m = 15,
    power_factor,
    demand_factor,
    efficiency = 1.0,
  } = circuit;

  const rawDemand = (demand_factor !== undefined && demand_factor !== null && demand_factor !== "")
    ? Number(demand_factor)
    : getDefaultDemandFactor(type, circuit?.name);
  const resolvedDemandFactor = Number.isFinite(rawDemand) && rawDemand > 0 ? rawDemand : 1.0;

  const defaultFp = (type === "Motor" || type === "Ar Condicionado" ? 0.85 : type === "Iluminação" ? 0.92 : 1.0);
  const fp = Number(power_factor) || defaultFp;

  const normalized = normalizeElectricalPower({
    power,
    power_unit,
    power_w,
    power_va,
    power_factor: fp,
    efficiency,
  });

  const installedPowerW = normalized.power_w;
  const effectivePowerW = Math.round(installedPowerW * resolvedDemandFactor * 100) / 100;
  const installedPowerVa = normalized.power_va;
  const effectivePowerVa = Math.round(installedPowerVa * resolvedDemandFactor * 100) / 100;

  const nominal_a       = calcNominalCurrent(installedPowerW, voltage, supply_type, fp, installedPowerVa);
  const demand_a        = calcNominalCurrent(effectivePowerW, voltage, supply_type, fp, effectivePowerVa);
  const project_current_a = demand_a;
  const corrected_a     = calcCorrectedCurrent(project_current_a, temp_ambient, group_count);
  const minWireArea     = minimumWireAreaForCircuit(type);
  let wireData          = selectWireGauge(corrected_a, install_method, minWireArea);

  // Dimensionamento do disjuntor do circuito: In >= Ib
  const breaker_a       = selectBreaker(project_current_a) || (project_current_a > 0 ? 10 : null);
  let vd                = calcVoltageDrop(effectivePowerW, voltage, supply_type, length_m, wireData.gauge, fp);

  if (!vd.ok) {
    const methodCol = METHOD_COL[install_method] || "B2";
    const voltageDropWire = WIRE_TABLE.find((wire) => (
      wire.area >= wireData.area &&
      wire.area >= minWireArea &&
      wire[methodCol] >= corrected_a &&
      calcVoltageDrop(effectivePowerW, voltage, supply_type, length_m, wire.gauge, fp).ok
    ));
    if (voltageDropWire) {
      wireData = voltageDropWire;
      vd = calcVoltageDrop(effectivePowerW, voltage, supply_type, length_m, wireData.gauge, fp);
    }
  }

  const temp_factor     = TEMP_FACTORS[temp_ambient] || 1.0;
  const group_factor    = GROUP_FACTORS[Math.min(Math.max(1, Number(group_count) || 1), 9)] || 0.50;
  const poles           = POLES(supply_type);
  const curve           = BREAKER_CURVE(type);
  const breaking_ka     = BREAKING_CAPACITY(voltage);

  return {
    ...circuit,
    power_w:              installedPowerW,
    demand_factor:        resolvedDemandFactor,
    demand_power_w:       effectivePowerW,
    power_va:             installedPowerVa,
    demand_power_va:      effectivePowerVa,
    nominal_current_a:    nominal_a,
    demand_current_a:     demand_a,
    project_current_a:    project_current_a,
    corrected_current_a:  corrected_a,
    wire_gauge:           wireData.gauge,
    wire_area:            wireData.area,
    minimum_wire_area:    minWireArea,
    breaker_a:            breaker_a || 0,
    breaker_curve:        curve,
    breaker_poles:        poles,
    breaking_capacity_ka: breaking_ka,
    needs_dr:             NEEDS_DR(type) || Boolean(circuit.wet_area),
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

// ─── Balanceamento Automático de Fases ────────────────────────────────────────────────────────
const PHASE_CODES = ["A", "B", "C"];
const BIPHASE_PAIRS = ["AB", "BC", "AC"];

const phaseOptionsForCircuit = (circuit = {}, projectSupplyType = "Trifásico") => {
  const projSupply = projectSupplyType || "Trifásico";
  if (projSupply === "Monofásico") return ["A"];
  if (projSupply === "Bifásico") {
    if (circuit.supply_type === "Bifásico" || circuit.supply_type === "Trifásico") return ["AB"];
    return ["A", "B"];
  }
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

export function autoBalancePhases(circuits, projectSupplyType = "Trifásico") {
  const calculated = (Array.isArray(circuits) ? circuits : []).map(calcCircuit);
  let basePhaseLoad = { A: 0, B: 0, C: 0 };
  const fixedAssignments = {};
  const variableItems = [];

  calculated.forEach((circuit, index) => {
    const current = Number(circuit.project_current_a) || 0;
    const options = phaseOptionsForCircuit(circuit, projectSupplyType);
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
    phase: bestAssignments[index] || fixedAssignments[index] || phaseOptionsForCircuit(circuit, projectSupplyType)[0],
  }));
}

// ─── Auditoria Técnica Rastreável de Conformidade NBR 5410 ────────────────────────────────────
export function auditProjectNBR5410(project = {}, metrics = {}) {
  const circuits = metrics?.circuits || [];
  const checks = [];
  const hasCircuits = circuits.length > 0;

  if (!hasCircuits) {
    return {
      score: null,
      status: "pending",
      statusText: "Sem cargas cadastradas",
      checks: [
        {
          id: "no_loads",
          title: "Cadastro de Circuitos",
          standardRef: "NBR 5410 item 4.2",
          status: "pending",
          detail: "Nenhum circuito cadastrado no projeto. Adicione cargas para iniciar as verificações normativas.",
          action: "Cadastre os circuitos terminais no Editor de Circuitos.",
        },
      ],
      passedCount: 0,
      warnCount: 0,
      errorCount: 0,
      pendingCount: 1,
      disclaimer: "Aprovação final do projeto sujeita à validação e emissão de ART/RRT por Engenheiro Eletricista habilitado.",
    };
  }

  const mainProtection = metrics?.mainProtection || calcMainProtection(project, metrics);
  const generalBreaker = mainProtection?.breaker?.current;
  const feeder = mainProtection?.feeder;

  // 1. Proteção contra Sobrecarga (NBR 5410 item 5.3.4: Ib <= In <= Iz)
  if (mainProtection?.breaker?.isOverloaded) {
    checks.push({
      id: "overload_protection",
      title: "Proteção contra Sobrecarga (Alimentador)",
      standardRef: "NBR 5410 item 5.3.4",
      status: "fail",
      detail: `Disjuntor geral (${generalBreaker}A) é inferior à corrente de demanda de projeto (${metrics.generalCurrent}A). Condição Ib ≤ In violada.`,
      action: "Aumente a corrente nominal do disjuntor geral para acompanhar a demanda.",
    });
  } else if (feeder && feeder.iz < generalBreaker) {
    checks.push({
      id: "overload_protection",
      title: "Proteção contra Sobrecarga (Alimentador)",
      standardRef: "NBR 5410 item 5.3.4",
      status: "fail",
      detail: `Capacidade corrigida do condutor alimentador (${feeder.iz}A) é menor que o disjuntor (${generalBreaker}A). Condição In ≤ Iz violada.`,
      action: "Aumente a seção dos condutores do alimentador geral.",
    });
  } else {
    checks.push({
      id: "overload_protection",
      title: "Proteção contra Sobrecarga (Alimentador)",
      standardRef: "NBR 5410 item 5.3.4",
      status: "pass",
      detail: `Condição Ib (${metrics.generalCurrent}A) ≤ In (${generalBreaker}A) ≤ Iz (${feeder?.iz || "—"}A) plenamente satisfeita.`,
    });
  }

  // 2. Queda de Tensão nos Circuitos Terminais (NBR 5410 item 6.2.7: Delta U <= 4%)
  const highVdCircuits = circuits.filter(c => !c.voltage_drop_ok);
  if (highVdCircuits.length > 0) {
    checks.push({
      id: "voltage_drop",
      title: "Limites de Queda de Tensão (Terminais)",
      standardRef: "NBR 5410 item 6.2.7",
      status: "fail",
      detail: `${highVdCircuits.length} circuito(s) excedem o limite de 4% de queda de tensão (máx: ${Math.max(...highVdCircuits.map(c => c.voltage_drop_pct))}%)`,
      action: "Aumente a seção dos condutores dos circuitos críticos ou reduza a extensão do alimentador.",
    });
  } else {
    checks.push({
      id: "voltage_drop",
      title: "Limites de Queda de Tensão (Terminais)",
      standardRef: "NBR 5410 item 6.2.7",
      status: "pass",
      detail: `Todos os ${circuits.length} circuitos atendem ao limite normativo de queda de tensão (ΔU ≤ 4%).`,
    });
  }

  // 3. Seções Mínimas de Condutores (NBR 5410 Tabela 47: 1.5mm² Iluminação / 2.5mm² Tomadas/Força)
  const invalidGaugeCircuits = circuits.filter(c => {
    const min = minimumWireAreaForCircuit(c.type);
    return (c.wire_area || 2.5) < min;
  });
  if (invalidGaugeCircuits.length > 0) {
    checks.push({
      id: "minimum_conductor_section",
      title: "Seções Mínimas dos Condutores",
      standardRef: "NBR 5410 Tabela 47",
      status: "fail",
      detail: `${invalidGaugeCircuits.length} circuito(s) com bitola inferior ao mínimo normativo (1,5 mm² iluminação / 2,5 mm² tomadas).`,
      action: "Adequar a seção mínima dos condutores conforme a Tabela 47 da NBR 5410.",
    });
  } else {
    checks.push({
      id: "minimum_conductor_section",
      title: "Seções Mínimas dos Condutores",
      standardRef: "NBR 5410 Tabela 47",
      status: "pass",
      detail: `Seções mínimas de cobre atendidas (1,5 mm² para iluminação e 2,5 mm² para tomadas/força).`,
    });
  }

  // 4. Proteção Diferencial-Residual Obrigatória (NBR 5410 item 5.1.3.2.2)
  const missingDrCircuits = circuits.filter(c => NEEDS_DR(c.type) && !c.needs_dr);
  if (missingDrCircuits.length > 0) {
    checks.push({
      id: "dr_protection",
      title: "Proteção Diferencial Residual (DR 30mA)",
      standardRef: "NBR 5410 item 5.1.3.2.2",
      status: "warn",
      detail: `${missingDrCircuits.length} circuito(s) em locais molhados ou tomadas gerais sem indicação de proteção DR de 30mA.`,
      action: "Preveja dispositivo IDR de alta sensibilidade (30mA) para as cargas exigidas pela norma.",
    });
  } else {
    checks.push({
      id: "dr_protection",
      title: "Proteção Diferencial Residual (DR 30mA)",
      standardRef: "NBR 5410 item 5.1.3.2.2",
      status: "pass",
      detail: `Proteção DR de alta sensibilidade (30mA) aplicada a todos os circuitos obrigatórios.`,
    });
  }

  // 5. Coordenação Disjuntor-IDR (In,DR >= In,disjuntor)
  const drCurrent = mainProtection?.dr?.current;
  if (generalBreaker && drCurrent && drCurrent < generalBreaker) {
    checks.push({
      id: "dr_coordination",
      title: "Coordenação IDR Geral com Disjuntor",
      standardRef: "NBR 5410 item 5.3.5",
      status: "fail",
      detail: `Corrente nominal do IDR (${drCurrent}A) é inferior ao disjuntor à montante (${generalBreaker}A).`,
      action: "Adote IDR com corrente nominal igual ou superior à do disjuntor geral.",
    });
  } else {
    checks.push({
      id: "dr_coordination",
      title: "Coordenação IDR Geral com Disjuntor",
      standardRef: "NBR 5410 item 5.3.5",
      status: "pass",
      detail: `IDR dimensionado com capacidade adequada (${drCurrent || 40}A ≥ ${generalBreaker || 0}A).`,
    });
  }

  // 6. Equilíbrio de Fases (NBR 5410 item 4.2.5.5)
  const supply = project?.supply_type || "Monofásico";
  if (supply === "Trifásico" || supply === "Bifásico") {
    const imbalance = metrics?.imbalance_pct || 0;
    if (imbalance > 10) {
      checks.push({
        id: "phase_balance",
        title: "Equilíbrio de Fases",
        standardRef: "NBR 5410 item 4.2.5.5",
        status: "fail",
        detail: `Desequilíbrio de ${imbalance}% entre as fases (limite de projeto recomendado: 5% a 10%).`,
        action: "Redistribua os circuitos entre as fases através do balanceamento automático.",
      });
    } else if (imbalance > 5) {
      checks.push({
        id: "phase_balance",
        title: "Equilíbrio de Fases",
        standardRef: "NBR 5410 item 4.2.5.5",
        status: "warn",
        detail: `Desequilíbrio moderado de ${imbalance}% entre as fases.`,
        action: "Rebalanceie as fases para buscar desequilíbrio inferior a 5%.",
      });
    } else {
      checks.push({
        id: "phase_balance",
        title: "Equilíbrio de Fases",
        standardRef: "NBR 5410 item 4.2.5.5",
        status: "pass",
        detail: `Fases equilibradas com desequilíbrio de apenas ${imbalance}%.`,
      });
    }
  }

  // 7. Dispositivo de Proteção contra Surtos - DPS (NBR 5410 item 5.4.2.1)
  const hasDps = circuits.some(c => c.needs_dps) || project?.has_dps !== false;
  if (!hasDps) {
    checks.push({
      id: "dps_protection",
      title: "Proteção contra Sobretensões (DPS)",
      standardRef: "NBR 5410 item 5.4.2.1",
      status: "warn",
      detail: "DPS Classe II não previsto na entrada do quadro de distribuição.",
      action: "Inclua DPS Classe II (mínimo 20kA 275V) para cada fase e neutro.",
    });
  } else {
    checks.push({
      id: "dps_protection",
      title: "Proteção contra Sobretensões (DPS)",
      standardRef: "NBR 5410 item 5.4.2.1",
      status: "pass",
      detail: "Proteção contra sobretensões transitórias prevista com DPS Classe II.",
    });
  }

  // 8. Espaço de Reserva no Quadro (NBR 5410 item 6.5.4.7)
  const totalDins = metrics?.totalDins || 0;
  const panelSize = metrics?.panelSize || 0;
  const reserveDins = Math.max(0, panelSize - totalDins);
  if (reserveDins < 2) {
    checks.push({
      id: "panel_reserve",
      title: "Espaço de Reserva no Quadro Elétrico",
      standardRef: "NBR 5410 item 6.5.4.7",
      status: "warn",
      detail: `Espaço de reserva insuficiente (${reserveDins} módulos livres). A norma exige de 15% a 30% de reserva.`,
      action: "Aumente as dimensões do quadro para prever expansões futuras.",
    });
  } else {
    checks.push({
      id: "panel_reserve",
      title: "Espaço de Reserva no Quadro Elétrico",
      standardRef: "NBR 5410 item 6.5.4.7",
      status: "pass",
      detail: `Quadro com ${reserveDins} módulos de reserva técnica (atende à NBR 5410 item 6.5.4.7).`,
    });
  }

  const passedCount = checks.filter(c => c.status === "pass").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const errorCount = checks.filter(c => c.status === "fail").length;
  const pendingCount = checks.filter(c => c.status === "pending").length;

  const score = checks.length > 0 ? Math.round((passedCount / checks.length) * 100) : 0;
  let status = "conforme";
  if (errorCount > 0) status = "incompativel";
  else if (warnCount > 0) status = "revisar";

  return {
    score,
    status,
    statusText: errorCount > 0 ? `${errorCount} incompatibilidade(s)` : warnCount > 0 ? `${warnCount} aviso(s)` : "Conforme",
    checks,
    passedCount,
    warnCount,
    errorCount,
    pendingCount,
    disclaimer: "Aprovação final do projeto sujeita à validação e emissão de ART/RRT por Engenheiro Eletricista habilitado.",
  };
}

// ─── Métricas Consolidadas do Projeto ─────────────────────────────────────────────────────────
export function calcProjectMetrics(project) {
  const circuits = autoBalancePhases(project?.circuits || [], project?.supply_type || "Trifásico");
  const rawCircuits = (project?.circuits || []).map(calcCircuit);
  const hasCircuits = circuits.length > 0;
  const phaseLoad = { A: 0, B: 0, C: 0 };
  let totalPower = 0;
  let totalDemandPower = 0;
  let totalDemandVa = 0;

  circuits.forEach(c => {
    const pInst = Number(c.power_w) || 0;
    const pDem = Number(c.demand_power_w) !== undefined && !Number.isNaN(Number(c.demand_power_w))
      ? Number(c.demand_power_w)
      : (pInst * (Number(c.demand_factor) || 1));
    const sDem = Number(c.demand_power_va) || pDem;

    totalPower += pInst;
    totalDemandPower += pDem;
    totalDemandVa += sDem;

    const ph = String(c.phase || "A");
    const I = Number(c.project_current_a) || 0;
    if (ph === "ABC") { phaseLoad.A += I; phaseLoad.B += I; phaseLoad.C += I; }
    else if (ph.length === 2) {
      if (phaseLoad[ph[0]] != null) phaseLoad[ph[0]] += I;
      if (phaseLoad[ph[1]] != null) phaseLoad[ph[1]] += I;
    }
    else {
      if (phaseLoad[ph] != null) phaseLoad[ph] += I;
      else phaseLoad.A += I;
    }
  });

  const maxI = Math.max(phaseLoad.A, phaseLoad.B, phaseLoad.C) || 0;
  const minI = Math.min(phaseLoad.A, phaseLoad.B, phaseLoad.C);
  const imbalance_pct = maxI > 0 ? Math.round(((maxI - minI) / maxI) * 100) : 0;
  const neutral_a = Math.round((phaseLoad.A + phaseLoad.B + phaseLoad.C) * 0.1 * 10) / 10;

  // Desequilíbrio com as fases salvas antes do auto-balance
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
  const storedMax = Math.max(storedPhaseLoad.A, storedPhaseLoad.B, storedPhaseLoad.C) || 0;
  const storedMin = Math.min(storedPhaseLoad.A, storedPhaseLoad.B, storedPhaseLoad.C);
  const storedImbalance_pct = storedMax > 0 ? Math.round(((storedMax - storedMin) / storedMax) * 100) : 0;

  const totalDins = hasCircuits ? circuits.reduce((s, c) => s + (c.din_modules || 1), 0) + 4 + 2 : 0;
  const drCircuits = circuits.filter(c => c.needs_dr).length;
  const drDins = Math.ceil(drCircuits / 2) * 2;
  const panelSize = hasCircuits ? Math.ceil((totalDins + drDins) * 1.2 / 6) * 6 : 12;

  // Corrente geral = fase mais carregada (NBR 5410)
  const generalCurrent = hasCircuits ? Math.round(maxI * 10) / 10 : 0;

  // Proteção geral rigorosa (sem 40A fictício se não houver circuitos)
  const generalBreaker = hasCircuits ? selectBreaker(generalCurrent) : null;
  const generalPolesSet = mainProtectionPoles(project?.supply_type || "Monofásico");
  const generalBreakerPoles = generalPolesSet.breaker;
  const generalDr = generalBreaker ? selectDrRating(generalBreaker) : null;
  const generalDrPoles = generalPolesSet.dr;

  const averageDemandFactor = totalPower > 0 ? Math.round((totalDemandPower / totalPower) * 100) / 100 : 1.0;
  const totalDemandKva = Math.round((totalDemandVa / 1000) * 100) / 100;

  // Carga monofásica que trava o balanceamento
  let imbalanceBlocker = null;
  if (imbalance_pct > 5 && hasCircuits) {
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

  // Objeto de métricas preliminar para passar à auditoria
  const partialMetrics = {
    circuits, phaseLoad, imbalance_pct, storedImbalance_pct, imbalanceBlocker, neutral_a,
    totalPower, totalInstalledPower: totalPower, totalDemandPower: Math.round(totalDemandPower * 100) / 100,
    totalDemandVa: Math.round(totalDemandVa * 100) / 100, totalDemandKva, averageDemandFactor,
    totalDins, panelSize, generalBreaker, generalCurrent,
    generalBreakerPoles, generalDr, generalDrPoles,
  };

  const mainProtection = calcMainProtection(project, partialMetrics);
  const audit = auditProjectNBR5410(project, { ...partialMetrics, mainProtection });

  // Lista de validações compatível com componentes existentes
  const validations = [];
  audit.checks.forEach(check => {
    if (check.status === "fail") {
      validations.push({
        severity: "error",
        code: check.id,
        msg: `${check.title}: ${check.detail}`,
        action: check.action,
      });
    } else if (check.status === "warn") {
      validations.push({
        severity: "warning",
        code: check.id,
        msg: `${check.title}: ${check.detail}`,
        action: check.action,
      });
    }
  });

  return {
    ...partialMetrics,
    mainProtection,
    audit,
    validations,
    nbrScore: audit.score ?? 0,
    hasLoads: hasCircuits,
  };
}

// ─── Geração de Layout de Quadro de Distribuição ──────────────────────────────────────────────
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

  const mainProtection = calcMainProtection({ ...proj, circuits, supply_type: supply, voltage });
  const hasValidProtection = mainProtection.breaker.current !== null;
  const genCurrent = hasValidProtection ? mainProtection.breaker.current : 0;
  const genPoles = mainProtection.breaker.poles;
  const genDrCurrent = hasValidProtection ? mainProtection.dr.current : 0;
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
    current: genCurrent || 0,
    curve: "C",
    poles: genPoles,
    isGeneral: true,
    phase: supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A",
    status: hasValidProtection ? "ON" : "OFF",
  });

  // DR Geral (padrão em quadros de distribuição conforme NBR 5410, exceto se desabilitado)
  const hasDR = Boolean(proj?.has_dr !== false);
  if (hasDR) {
    rail1Components.push({
      id: "gen_dr",
      type: "dr",
      label: "IDR GERAL",
      current: genDrCurrent || 0,
      poles: genDrPoles,
      phase: supply === "Trifásico" ? "ABCN" : supply === "Bifásico" ? "AB" : "AN",
      supply_type: supply,
      status: hasValidProtection ? "ON" : "OFF",
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

  // Fiação automática
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

  // 3. Neutro geral e barramento superior
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

  // 4. Alimentação superior por fase
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

export function isSolarProject(project) {
  return project?.project_type === "Solar" || Boolean(project?.solar_config);
}

const NON_PRIMARY_BOARD_TYPES = ["qgbt", "solar_ac", "solar", "solar_board"];

export function isDedicatedSolarBoard(board = {}) {
  const type = String(board?.type || "").toLowerCase();
  const id = String(board?.id || "").toLowerCase();
  const name = String(board?.name || "").trim();
  return (
    type === "solar_ac"
    || type === "solar"
    || type === "solar_board"
    || Boolean(board?.is_solar_board)
    || id === "solar_board"
    || id.includes("solar_board")
    || id.includes("solar_ac")
    || /^(qd[-\s]*)?solar(\s*ca)?$/i.test(name)
    || /qd\s*solar|solar\s*ca/i.test(name)
  );
}

export function getPrimaryPanelBoard(boards = []) {
  return (boards || []).find((board) => (
    !NON_PRIMARY_BOARD_TYPES.includes(String(board?.type || "").toLowerCase())
    && !isDedicatedSolarBoard(board)
  )) || null;
}

export function findSolarInverterCircuit(circuits = []) {
  return (circuits || []).find((circuit) => (
    /inversor|solar fotovoltaico/i.test(`${circuit?.name || ""} ${circuit?.type || ""}`)
    && !/dps/i.test(`${circuit?.name || ""} ${circuit?.type || ""}`)
  )) || null;
}

export function nextBusbarIndex(wires = [], busbarId) {
  const pattern = new RegExp(`^${busbarId}:(\\d+)$`);
  const used = (wires || [])
    .flatMap((wire) => [wire?.source, wire?.target])
    .map((ref) => {
      const match = typeof ref === "string" && ref.match(pattern);
      return match ? Number(match[1]) : null;
    })
    .filter((value) => value !== null);
  return used.length ? Math.max(...used) + 1 : 0;
}

export function remapBusbarIndices(wires = [], busbarId, startIndex) {
  const pattern = new RegExp(`^${busbarId}:(\\d+)$`);
  const remap = new Map();
  let next = startIndex;
  const rewrite = (ref) => {
    if (typeof ref !== "string") return ref;
    const match = ref.match(pattern);
    if (!match) return ref;
    if (!remap.has(match[1])) {
      remap.set(match[1], next);
      next += 1;
    }
    return `${busbarId}:${remap.get(match[1])}`;
  };
  return (wires || []).map((wire) => ({ ...wire, source: rewrite(wire.source), target: rewrite(wire.target) }));
}

const SOLAR_PHASE_COLORS = ["black", "red", "brown"];
const SOLAR_RAIL_MAX_POLES = 18;
const solarAcPhaseCount = (supply) => (supply === "Trifásico" ? 3 : supply === "Monofásico" ? 1 : 2);
const solarAcPoles = (supply) => (supply === "Trifásico" ? 3 : 2);

function withSolarRailReserve(components, id, label = "RESERVA TÉCNICA") {
  const used = components.reduce((sum, component) => sum + (Number(component.poles) || 0), 0);
  return used >= SOLAR_RAIL_MAX_POLES ? components : [...components, { id, type: "spacer", poles: SOLAR_RAIL_MAX_POLES - used, label }];
}

export function buildSolarAcCircuitLayout(project = {}, existingWires = []) {
  const supply = project?.solar_config?.ac_supply_type || "Bifásico";
  const phaseCount = solarAcPhaseCount(supply);
  const poles = solarAcPoles(supply);
  const solarCircuit = findSolarInverterCircuit(project?.circuits);
  const breakerCurrent = Number(solarCircuit?.breaker_a) || 32;
  const breakerCurve = solarCircuit?.breaker_curve || "C";
  const phase = supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A";
  const feederGauge = breakerCurrent > 63 ? "16mm²" : breakerCurrent > 40 ? "10mm²" : breakerCurrent > 25 ? "6mm²" : "4mm²";

  const feederBreaker = { id: "solar_feeder_breaker", type: "breaker", label: "DJ ENTRADA CA", current: breakerCurrent, curve: breakerCurve, poles, isSolarFeeder: true, phase, supply_type: supply, status: "ON" };
  const serviceBreaker = { id: "solar_service_breaker", type: "breaker", label: "DJ SAÍDA CA", current: breakerCurrent, curve: breakerCurve, poles, isSolarServiceDisconnect: true, phase, supply_type: supply, status: "ON" };
  const inverterBreaker = { id: "solar_main_breaker", type: "breaker", label: "DJ INVERSOR CA", current: breakerCurrent, curve: breakerCurve, poles, phase, supply_type: supply, status: "ON" };
  const dpsComponents = Array.from({ length: phaseCount }, (_, index) => ({
    id: `solar_dps_${index}`,
    type: "dps",
    label: `DPS CA ${String.fromCharCode(65 + index)}`,
    poles: 1,
    phase: String.fromCharCode(65 + index),
    status: "ON",
    dpsStatus: "OK",
  }));

  const groundStart = nextBusbarIndex(existingWires, "busbar_ground");
  const neutralIndex = nextBusbarIndex(existingWires, "busbar_neutral");

  const wires = [
    { id: "solar_ground_feed", color: "green", gauge: "10mm²", source: "terminal_left_top:0", target: `busbar_ground:${groundStart}`, label: "" },
  ];

  dpsComponents.forEach((component, index) => {
    wires.push({ id: `solar_dps_phase_${index}`, color: SOLAR_PHASE_COLORS[index], gauge: "6mm²", source: `terminal_left_top:${index + 1}`, target: `comp:${component.id}:top:0`, label: "" });
    wires.push({ id: `solar_dps_ground_${index}`, color: "green", gauge: "6mm²", source: `comp:${component.id}:bottom:0`, target: `busbar_ground:${groundStart + 1 + index}`, label: "" });
  });

  if (supply === "Monofásico") {
    wires.push({ id: "solar_neutral_feed", color: "blue", gauge: feederGauge, source: `busbar_neutral:${neutralIndex}`, target: `comp:${feederBreaker.id}:top:1`, label: "" });
    wires.push({ id: "solar_neutral_feeder_to_inverter", color: "blue", gauge: feederGauge, source: `comp:${feederBreaker.id}:bottom:1`, target: `comp:${inverterBreaker.id}:top:1`, label: "" });
    wires.push({ id: "solar_neutral_load", color: "blue", gauge: feederGauge, source: `comp:${inverterBreaker.id}:bottom:1`, target: "load_out:solar_inverter:neutral", label: "" });
  }

  for (let index = 0; index < phaseCount; index += 1) {
    wires.push({ id: `solar_phase_feed_${index}`, color: SOLAR_PHASE_COLORS[index], gauge: feederGauge, source: `terminal_left_top:${index + 1}`, target: `comp:${feederBreaker.id}:top:${index}`, label: "" });
    wires.push({ id: `solar_phase_feeder_to_service_${index}`, color: SOLAR_PHASE_COLORS[index], gauge: feederGauge, source: `comp:${feederBreaker.id}:bottom:${index}`, target: `comp:${serviceBreaker.id}:top:${index}`, label: "" });
    wires.push({ id: `solar_phase_service_to_inverter_${index}`, color: SOLAR_PHASE_COLORS[index], gauge: feederGauge, source: `comp:${serviceBreaker.id}:bottom:${index}`, target: `comp:${inverterBreaker.id}:top:${index}`, label: "" });
    wires.push({ id: `solar_phase_load_${index}`, color: SOLAR_PHASE_COLORS[index], gauge: feederGauge, source: `comp:${inverterBreaker.id}:bottom:${index}`, target: `load_out:solar_inverter:${index}`, label: "" });
  }

  return {
    rails: [
      { id: "rail_solar_1", name: "Trilho DIN — Entrada e Proteção CA (Solar)", components: withSolarRailReserve([feederBreaker, ...dpsComponents, serviceBreaker], "spacer_solar_protection") },
      { id: "rail_solar_2", name: "Trilho DIN — Disjuntor do Inversor (Solar)", components: withSolarRailReserve([inverterBreaker], "spacer_solar_inverter", "RESERVA") },
    ],
    wires,
  };
}

export function mergeSolarLayoutIntoPrincipal(project, layout, { forceRegenerate = false } = {}) {
  if (!isSolarProject(project)) return layout;
  const rails = Array.isArray(layout?.rails) ? layout.rails : [];
  const wires = Array.isArray(layout?.wires) ? layout.wires : [];
  const alreadyMerged = rails.some((rail) => rail.id === "rail_solar_1" || rail.id === "rail_solar_2");

  if (alreadyMerged && !forceRegenerate) return { ...layout, rails, wires };

  const baseRails = alreadyMerged ? rails.filter((rail) => rail.id !== "rail_solar_1" && rail.id !== "rail_solar_2") : rails;
  const baseWires = alreadyMerged ? wires.filter((wire) => !String(wire?.id || "").startsWith("solar_")) : wires;
  const solar = buildSolarAcCircuitLayout(project, baseWires);

  return { ...layout, rails: [...baseRails, ...solar.rails], wires: [...baseWires, ...solar.wires] };
}

export function buildPanelBoardsWithLayout(project, panelLayout = generateDefaultPanelLayout(project, { forceDistribution: true })) {
  const existingBoards = (Array.isArray(project?.panel_boards) ? project.panel_boards : [])
    .filter((board) => !isDedicatedSolarBoard(board));
  const distributionType = "principal";
  const mergedLayout = mergeSolarLayoutIntoPrincipal(project, panelLayout, { forceRegenerate: true });
  const makeDistributionBoard = () => ({
    id: `board_distribution_${Date.now()}`,
    name: "QD-01 Principal",
    location: "Entrada / Distribuição",
    type: distributionType,
    supply_type: project?.supply_type || "Monofásico",
    layout: mergedLayout,
  });

  if (existingBoards.length === 0) {
    return [makeDistributionBoard()];
  }

  const primaryIndex = existingBoards.findIndex((board) => (
    !NON_PRIMARY_BOARD_TYPES.includes(String(board?.type || "").toLowerCase())
    && !isDedicatedSolarBoard(board)
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
          layout: mergedLayout,
        }
      : board
  ));
}

export function calculateProjectDemand(circuits = []) {
  return (Array.isArray(circuits) ? circuits : []).reduce((sum, circuit) => {
    if (circuit?.demand_power_w !== undefined && !Number.isNaN(Number(circuit.demand_power_w))) {
      return sum + Number(circuit.demand_power_w);
    }
    const pInst = Number(circuit?.power_w) || 0;
    const df = (circuit?.demand_factor !== undefined && circuit?.demand_factor !== null && circuit?.demand_factor !== "")
      ? Number(circuit.demand_factor)
      : getDefaultDemandFactor(circuit?.type, circuit?.name);
    return sum + pInst * (Number.isFinite(df) && df > 0 ? df : 1);
  }, 0);
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
    panel_layout: getPrimaryPanelBoard(panelBoards)?.layout || panelLayout,
    panel_boards: panelBoards,
    diagram_layout: null,
  };
}
