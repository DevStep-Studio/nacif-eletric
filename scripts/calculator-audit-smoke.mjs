import {
  calcNominalCurrent,
  calcCorrectedCurrent,
  normalizeElectricalPower,
  calcVoltageDrop,
  calcNeutralWireGauge,
  calcProtectionWireGauge,
  calcConduitOccupation,
  convertElectricalUnits,
  dimensionCircuitNBR5410,
  calculateProjectDemand,
  selectBreaker,
  selectWireGauge,
  WIRE_TABLE,
  CONDUIT_SIZES,
} from "../src/lib/electricalEngine.js";

console.log("=== INICIANDO AUDITORIA TÉCNICA E MATEMÁTICA DA CALCULADORA NBR 5410 ===\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// ─── 1. AUDITORIA DE FÓRMULAS DE POTÊNCIA E CONVERSÕES ────────────────────────────────
console.log("1. Auditoria de Potência e Conversão de Unidades (W, kW, VA, kVA, cv, HP)");
{
  // 1.1 Conversão kW -> W
  const p1 = normalizeElectricalPower({ power: 5.5, power_unit: "kW", power_factor: 0.92 });
  assert(p1.power_w === 5500, `5.5 kW deve ser 5500 W (obtido: ${p1.power_w} W)`);
  assert(Math.round(p1.power_va) === 5978, `5500 W com fp 0.92 deve resultar em ~5978 VA (obtido: ${p1.power_va} VA)`);

  // 1.2 Conversão kVA -> W
  const p2 = normalizeElectricalPower({ power: 10, power_unit: "kVA", power_factor: 0.85 });
  assert(p2.power_va === 10000, `10 kVA deve ser 10000 VA (obtido: ${p2.power_va} VA)`);
  assert(p2.power_w === 8500, `10 kVA com fp 0.85 deve ser 8500 W (obtido: ${p2.power_w} W)`);

  // 1.3 Conversão cv (mecânico) com rendimento
  // 1 cv = 735.49875 W. Motor de 2 cv com rendimento 85%: P_eletrica = (2 * 735.49875) / 0.85 = 1730.58 W
  const p3 = normalizeElectricalPower({ power: 2, power_unit: "cv", power_factor: 0.82, efficiency: 0.85 });
  assert(Math.abs(p3.power_w - 1730.59) < 1.0, `Motor 2 cv eta 0.85 deve ter pot eletrica ~1730.59 W (obtido: ${p3.power_w} W)`);

  // 1.4 Conversor geral de grandezas e potência reativa Q
  // P = 4000 W, fp = 0.8 -> S = 5000 VA -> Q = sqrt(5000² - 4000²) = 3000 VAr
  const conv = convertElectricalUnits({ value: 4000, fromUnit: "W", power_factor: 0.8, voltage: 220, supply_type: "Monofásico" });
  assert(conv.va === 5000, `P=4000W fp=0.8 deve dar S=5000VA (obtido: ${conv.va})`);
  assert(conv.var === 3000, `P=4000W fp=0.8 deve dar Q=3000 VAr (obtido: ${conv.var})`);
  assert(conv.kvar === 3, `Q em kVAr deve ser 3.0 (obtido: ${conv.kvar})`);
}

// ─── 2. VALIDAÇÃO DOS CÁLCULOS DE CORRENTE ELÉTRICA ──────────────────────────────────
console.log("\n2. Validação dos Cálculos de Corrente Elétrica (Monofásico, Bifásico, Trifásico)");
{
  // 2.1 Monofásico 220V, 2200W, fp = 1.0 -> I = 2200 / 220 = 10 A
  const i1 = calcNominalCurrent(2200, 220, "Monofásico", 1.0);
  assert(i1 === 10, `Monofásico 2200W / 220V fp 1.0 deve ser 10.0 A (obtido: ${i1} A)`);

  // 2.2 Bifásico 220V (F+F sem neutro na carga), 4400W, fp = 1.0 -> I = 4400 / 220 = 20 A (NÃO divide por sqrt(3)!)
  const i2 = calcNominalCurrent(4400, 220, "Bifásico", 1.0);
  assert(i2 === 20, `Bifásico 4400W / 220V fp 1.0 deve ser 20.0 A (obtido: ${i2} A)`);

  // 2.3 Trifásico 380V equilibrado, 10000W, fp = 0.92
  // S = 10000 / 0.92 = 10869.57 VA -> I = 10869.57 / (sqrt(3) * 380) = 10869.57 / 658.179 = 16.51 A
  const i3 = calcNominalCurrent(10000, 380, "Trifásico", 0.92);
  assert(Math.abs(i3 - 16.51) <= 0.05, `Trifásico 10kW 380V fp 0.92 deve ser ~16.51 A (obtido: ${i3} A)`);

  // 2.4 Proteção contra divisão por zero e valores inválidos
  const iZeroV = calcNominalCurrent(5000, 0, "Monofásico", 1.0);
  assert(iZeroV === 0, `Tensão 0V deve retornar corrente 0 sem gerar Infinity (obtido: ${iZeroV})`);
  const iZeroP = calcNominalCurrent(0, 220, "Monofásico", 1.0);
  assert(iZeroP === 0, `Potência 0W deve retornar corrente 0 (obtido: ${iZeroP})`);
}

// ─── 3. AUDITORIA DOS FATORES DE CORREÇÃO (TEMPERATURA E AGRUPAMENTO) ─────────────────
console.log("\n3. Auditoria dos Fatores de Correção NBR 5410");
{
  // 3.1 Temperatura 40°C para PVC (f_t = 0.87) e Agrupamento 3 circuitos (f_g = 0.70)
  // Corrente nominal = 10 A -> Corrente corrigida = 10 / (0.87 * 0.70) = 10 / 0.609 = 16.42 A
  const icorr = calcCorrectedCurrent(10, 40, 3);
  assert(Math.abs(icorr - 16.42) <= 0.05, `10A a 40°C (ft=0.87) e 3 circ (fg=0.70) deve ser ~16.42 A (obtido: ${icorr} A)`);

  // 3.2 Condição de referência (30°C, 1 circuito -> ft=1.0, fg=1.0)
  const icorrRef = calcCorrectedCurrent(25, 30, 1);
  assert(icorrRef === 25, `Condição de referência 30°C / 1 circ deve manter 25 A (obtido: ${icorrRef} A)`);
}

// ─── 4. AUDITORIA DA QUEDA DE TENSÃO (NBR 5410 ITEM 6.2.7) ────────────────────────────
console.log("\n4. Auditoria dos Cálculos de Queda de Tensão");
{
  // 4.1 Monofásico 220V, cabo 2.5mm² cobre (R_20 = 7.41 ohm/km), L = 20m, I = 10A, fp = 1.0
  // R_70 = 7.41 * (1 + 0.00393 * 50) = 8.866 ohm/km = 0.008866 ohm/m
  // DeltaU = 2 * 10 * 0.008866 * 20 = 3.546 V -> DeltaU% = (3.546 / 220) * 100 = 1.61% <= 4%
  const vd1 = calcVoltageDrop(2200, 220, "Monofásico", 20, "2.5mm²", 1.0, { current: 10, material: "Cobre" });
  assert(vd1.ok === true, `Queda em 20m deve ser aprovada (obtido: ${vd1.drop_pct}%, ok: ${vd1.ok})`);
  assert(Math.abs(vd1.drop_pct - 1.61) <= 0.2, `DeltaU% esperado ~1.61% (obtido: ${vd1.drop_pct}%)`);

  // 4.2 Distância longa com reprovação: L = 100m, I = 15A em 2.5mm² cobre
  // DeltaU = 2 * 15 * 0.008866 * 100 = 26.6 V -> DeltaU% = (26.6 / 220) * 100 = 12.09% > 4%
  const vdLong = calcVoltageDrop(3300, 220, "Monofásico", 100, "2.5mm²", 1.0, { current: 15, material: "Cobre" });
  assert(vdLong.ok === false, `Queda em 100m com 15A em 2.5mm² deve ser reprovada (obtido: ${vdLong.drop_pct}%)`);

  // 4.3 Sistema Trifásico 380V: fator sqrt(3) em vez de 2
  // Para mesmas condições de condutor e corrente, a queda trifásica de linha é multiplicada por sqrt(3)
  const vdTri = calcVoltageDrop(null, 380, "Trifásico", 30, "4mm²", 0.92, { current: 20 });
  assert(vdTri.factor === Math.sqrt(3), `Trifásico deve utilizar fator sqrt(3) (obtido: ${vdTri.factor})`);

  // 4.4 Material Alumínio vs Cobre: Alumínio deve apresentar queda maior devido a resistividade superior
  const vdCu = calcVoltageDrop(null, 220, "Monofásico", 50, "16mm²", 0.92, { current: 30, material: "Cobre" });
  const vdAl = calcVoltageDrop(null, 220, "Monofásico", 50, "16mm²", 0.92, { current: 30, material: "Alumínio" });
  assert(vdAl.drop_v > vdCu.drop_v, `Queda com condutor de alumínio (${vdAl.drop_v}V) deve ser maior que cobre (${vdCu.drop_v}V)`);
}

// ─── 5. VALIDAÇÃO DO DIMENSIONAMENTO DO NEUTRO E PROTEÇÃO (TABELAS 48 E 58) ────────────
console.log("\n5. Validação do Dimensionamento do Neutro e da Proteção (PE)");
{
  // 5.1 Neutro Monofásico: Sn = Sf
  const nMono = calcNeutralWireGauge(10, false);
  assert(nMono.area === 10, `Neutro monofásico de fase 10mm² deve ser 10mm² (obtido: ${nMono.area}mm²)`);

  // 5.2 Neutro Trifásico Tabela 48: Sf <= 25 -> Sn = Sf; Sf = 50 -> Sn = 25; Sf = 120 -> Sn = 70
  const nTri25 = calcNeutralWireGauge(25, true);
  assert(nTri25.area === 25, `Neutro trifásico fase 25mm² deve ser 25mm² (obtido: ${nTri25.area}mm²)`);

  const nTri50 = calcNeutralWireGauge(50, true);
  assert(nTri50.area === 25, `Neutro trifásico fase 50mm² deve ser 25mm² conforme Tab 48 (obtido: ${nTri50.area}mm²)`);

  const nTri120 = calcNeutralWireGauge(120, true);
  assert(nTri120.area === 70, `Neutro trifásico fase 120mm² deve ser 70mm² conforme Tab 48 (obtido: ${nTri120.area}mm²)`);

  // 5.3 Proteção PE Tabela 58: Sf <= 16 -> Spe = Sf; 16 < Sf <= 35 -> Spe = 16; Sf > 35 -> Spe = Sf/2
  const pe10 = calcProtectionWireGauge(10);
  assert(pe10.area === 10, `Terra para fase 10mm² deve ser 10mm² (obtido: ${pe10.area}mm²)`);

  const pe25 = calcProtectionWireGauge(25);
  assert(pe25.area === 16, `Terra para fase 25mm² deve ser 16mm² conforme Tab 58 (obtido: ${pe25.area}mm²)`);

  const pe70 = calcProtectionWireGauge(70);
  assert(pe70.area === 35, `Terra para fase 70mm² deve ser 35mm² (70/2) conforme Tab 58 (obtido: ${pe70.area}mm²)`);
}

// ─── 6. AUDITORIA DA TAXA DE OCUPAÇÃO DE ELETRODUTOS (NBR 5410 ITEM 6.2.11.1) ───────────
console.log("\n6. Auditoria da Taxa de Ocupação de Eletrodutos");
{
  // 6.1 Um condutor: taxa máxima de 53%
  const occ1 = calcConduitOccupation([{ area: 16, count: 1 }]);
  assert(occ1.maxFillPct === 53, `1 condutor deve ter taxa máxima de 53% (obtido: ${occ1.maxFillPct}%)`);

  // 6.2 Dois condutores: taxa máxima de 31%
  const occ2 = calcConduitOccupation([{ area: 2.5, count: 2 }]);
  assert(occ2.maxFillPct === 31, `2 condutores deve ter taxa máxima de 31% (obtido: ${occ2.maxFillPct}%)`);

  // 6.3 Três ou mais condutores: taxa máxima de 40%
  const occ3 = calcConduitOccupation([{ area: 2.5, count: 3 }]);
  assert(occ3.maxFillPct === 40, `3 condutores deve ter taxa máxima de 40% (obtido: ${occ3.maxFillPct}%)`);

  // 6.4 Eletroduto 3/4" (DN 25, área interna útil = 327 mm²) com 3 cabos 2.5mm² (área total ~ 35.7 mm²)
  // Ocupação = (35.7 / 327) * 100 = ~10.9% <= 40% -> ok
  const occTest = calcConduitOccupation([{ area: 2.5, count: 3 }], 25);
  assert(occTest.ok === true, `3 cabos 2.5mm² em DN 25 deve estar aprovado (obtido: ${occTest.actualFillPct}%, ok: ${occTest.ok})`);

  // 6.5 Superlotação: 15 cabos de 6mm² em DN 20 (área interna 201 mm²)
  const occOver = calcConduitOccupation([{ area: 6.0, count: 15 }], 20);
  assert(occOver.ok === false, `Superlotação em DN 20 deve ser reprovada (obtido: ${occOver.actualFillPct}%)`);
}

// ─── 7. DIMENSIONAMENTO INTEGRADO NBR 5410 (COORDENAÇÃO IB <= IN <= IZ) ────────────────
console.log("\n7. Dimensionamento Integrado e Coordenação de Proteção NBR 5410");
{
  // Chuveiro 5500W, 220V, Monofásico, L = 15m, B2 (embutido)
  // Ib = 5500 / 220 = 25 A
  // Cabo corrigido para 25A em B2 -> 6mm² (Iz base 31A a 30°C)
  // Disjuntor: 25A ou 32A. Se In=32A e Iz=31A -> Alerta de coordenação!
  // Se for cabo 6mm² com disjuntor 25A ou 10mm² para disjuntor 32A.
  const dimShower = dimensionCircuitNBR5410({
    power: 5500,
    voltage: 220,
    supply_type: "Monofásico",
    type: "Chuveiro",
    length_m: 15,
  });

  assert(dimShower.project_current_a === 25, `Corrente de projeto do chuveiro deve ser 25A (obtido: ${dimShower.project_current_a}A)`);
  assert(dimShower.needs_dr === true, `Chuveiro deve exigir proteção DR de 30mA (obtido: ${dimShower.needs_dr})`);
  assert(dimShower.voltage_drop.ok === true, `Queda de tensão do chuveiro em 15m deve ser <= 4% (obtido: ${dimShower.voltage_drop.drop_pct}%)`);
  assert(dimShower.conduit.ok === true, `Eletroduto do chuveiro dimensionado adequadamente`);
}

// ─── 8. RESILIÊNCIA E VALORES EXTREMOS ────────────────────────────────────────────────
console.log("\n8. Testes com Valores Extremos e Entradas Inválidas");
{
  const dimZero = dimensionCircuitNBR5410({ power: 0, voltage: 0 });
  assert(dimZero.project_current_a === 0, `Potência zero não causa erro e retorna corrente 0 (obtido: ${dimZero.project_current_a})`);

  const dimExtremeL = dimensionCircuitNBR5410({ power: 1000, voltage: 220, length_m: 500 });
  // Comprimento 500m deve forçar aumento de bitola para queda de tensão
  assert(dimExtremeL.wire.wireUpscaledForVoltageDrop === true, `Circuito de 500m deve ter bitola elevada por queda de tensão`);
}

console.log(`\n=== RESUMO DOS TESTES: ${passed} PASSARAM, ${failed} FALHARAM ===\n`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("TODOS OS TESTES MATEMÁTICOS E TÉCNICOS PASSARAM COM SUCESSO!");
}
