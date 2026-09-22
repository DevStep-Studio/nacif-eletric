import assert from "node:assert/strict";
import {
  calcCircuit,
  calcMainProtection,
  calcProjectMetrics,
  generateDefaultPanelLayout,
  getDefaultDemandFactor,
  selectDrRating,
} from "../src/lib/electricalEngine.js";

const findComponent = (layout, id) => (
  layout.rails.flatMap((rail) => rail.components || []).find((component) => component.id === id)
);

// ── Fatores de demanda padrão (NBR 5410 / Concessionárias) ─────────────────────
assert.equal(getDefaultDemandFactor("Iluminação"), 1.0, "Iluminação padrão = 1.0");
assert.equal(getDefaultDemandFactor("Tomadas de Uso Geral"), 0.70, "TUG padrão = 0.70");
assert.equal(getDefaultDemandFactor("Chuveiro"), 1.0, "Chuveiro = 1.0");
assert.equal(getDefaultDemandFactor("Ar Condicionado"), 0.85, "Ar condicionado = 0.85");
assert.equal(getDefaultDemandFactor("Motor"), 0.80, "Motor = 0.80");
assert.equal(getDefaultDemandFactor("", "Tomada da sala"), 0.70, "detecta por nome tomada = 0.70");
assert.equal(getDefaultDemandFactor("", "Split Inverter 12000"), 0.85, "detecta por nome ar cond = 0.85");

// ── selectDrRating: In do IDR ≥ In do disjuntor, em degraus comerciais ────────
assert.equal(selectDrRating(16), 40, "piso do IDR é 40 A");
assert.equal(selectDrRating(40), 40, "40 A casa exato");
assert.equal(selectDrRating(41), 63, "acima de 40 vai para 63");
assert.equal(selectDrRating(50), 63, "50 A de disjuntor pede IDR 63 A");
assert.equal(selectDrRating(63), 63, "63 A casa exato");
assert.equal(selectDrRating(80), 80, "80 A casa exato");
assert.equal(selectDrRating(160), 160, "160 A casa com IDR industrial/bloco 160 A");

// ── calcCircuit: cálculo de potência e corrente com base na demanda ────────────
const testTug = calcCircuit({
  name: "Tomadas Gerais",
  type: "Tomadas de Uso Geral",
  power_w: 2000,
  voltage: 127,
  supply_type: "Monofásico",
  power_factor: 1.0,
});
assert.equal(testTug.demand_factor, 0.70, "TUG assume Fd = 0.70 automaticamente");
assert.equal(testTug.power_w, 2000, "Potência instalada = 2000W");
assert.equal(testTug.demand_power_w, 1400, "Potência demandada = 1400W (2000 * 0.7)");
assert.equal(testTug.nominal_current_a, 15.75, "Corrente nominal sem Fd = 15.75 A");
assert.equal(testTug.project_current_a, 11.02, "Corrente de projeto sobre a demanda = 11.02 A");

// ── Projeto bifásico (perfil do "Simulação": ~8,6 kW / 220 V) ─────────────────
const biProject = {
  supply_type: "Bifásico",
  voltage: 220,
  circuits: [
    { id: "c1", name: "Ar condicionado 18000", type: "Ar Condicionado", supply_type: "Bifásico", power_w: 1300, breaker_poles: 2 },
    { id: "c2", name: "Iluminação quarto", type: "Iluminação", supply_type: "Monofásico", power_w: 500 },
    { id: "c3", name: "Iluminação social", type: "Iluminação", supply_type: "Monofásico", power_w: 600 },
    { id: "c4", name: "Tomadas cozinha", type: "Tomadas de Uso Geral", supply_type: "Monofásico", power_w: 1200 },
    { id: "c5", name: "Tomadas área", type: "Tomadas de Uso Geral", supply_type: "Monofásico", power_w: 1200 },
    { id: "c6", name: "Tomadas quartos", type: "Tomadas de Uso Geral", supply_type: "Monofásico", power_w: 1100 },
    { id: "c7", name: "Chuveiro", type: "Chuveiro", supply_type: "Bifásico", power_w: 5500, breaker_poles: 2 },
    { id: "c8", name: "Máquina de lavar", type: "Tomadas de Uso Específico", supply_type: "Monofásico", power_w: 1500 },
  ],
};

const biMetrics = calcProjectMetrics(biProject);
const biMain = calcMainProtection(biProject, biMetrics);

assert.ok(biMetrics.totalPower > biMetrics.totalDemandPower, "Demanda total menor que potência instalada");
assert.ok(biMetrics.averageDemandFactor < 1.0, "Fator de demanda médio < 1.0");

// Âncora: o editor de circuitos mostra metrics.generalBreaker — tudo deve seguir isso.
assert.equal(biMain.breaker.current, biMetrics.generalBreaker, "proteção geral parte do dimensionamento do editor");
assert.equal(biMetrics.generalDr, selectDrRating(biMetrics.generalBreaker), "metrics.generalDr acompanha o disjuntor geral");
assert.equal(biMain.dr.current, biMetrics.generalDr, "calcMainProtection e metrics concordam no IDR");
assert.ok(biMain.dr.current >= biMain.breaker.current, "IDR nunca menor que o disjuntor geral");
assert.equal(biMain.breaker.poles, 2, "disjuntor geral bifásico = 2P");
assert.equal(biMain.dr.poles, 2, "IDR geral bifásico = 2P");
assert.equal(biMetrics.generalBreakerPoles, 2, "metrics expõe polos do disjuntor geral");
assert.equal(biMetrics.generalDrPoles, 2, "metrics expõe polos do IDR geral");

// O quadro gerado tem que bater com o dimensionamento.
const biLayout = generateDefaultPanelLayout(biProject, { forceDistribution: true });
const biGenBrk = findComponent(biLayout, "gen_brk");
const biGenDr = findComponent(biLayout, "gen_dr");
assert.equal(biGenBrk.current, biMetrics.generalBreaker, "DJ GERAL do quadro = disjuntor geral do dimensionamento");
assert.equal(biGenBrk.poles, biMain.breaker.poles, "DJ GERAL do quadro com polos corretos");
assert.equal(biGenDr.current, biMetrics.generalDr, "IDR GERAL do quadro = IDR do dimensionamento");
assert.equal(biGenDr.poles, biMain.dr.poles, "IDR GERAL do quadro com polos corretos");
assert.equal(biGenDr.current >= biGenBrk.current, true, "no quadro, IDR ≥ disjuntor geral");

// ── Projeto trifásico comercial / grande porte (ex: Igreja 69 kW) ─────────────
const churchProject = {
  name: "Igreja Conquistando vidas",
  supply_type: "Trifásico",
  voltage: 380,
  circuits: [
    { id: "ch1", name: "Ar Condicionado Central 1", type: "Ar Condicionado", supply_type: "Trifásico", voltage: 380, power_w: 15000, demand_factor: 0.85 },
    { id: "ch2", name: "Ar Condicionado Central 2", type: "Ar Condicionado", supply_type: "Trifásico", voltage: 380, power_w: 15000, demand_factor: 0.85 },
    { id: "ch3", name: "Iluminação Templo", type: "Iluminação", supply_type: "Trifásico", voltage: 380, power_w: 8000, demand_factor: 1.0 },
    { id: "ch4", name: "Som e Mídia", type: "Servidor", supply_type: "Monofásico", voltage: 220, power_w: 6000, demand_factor: 0.85 },
    { id: "ch5", name: "Tomadas Nave", type: "Tomadas de Uso Geral", supply_type: "Monofásico", voltage: 220, power_w: 5000, demand_factor: 0.70 },
    { id: "ch6", name: "Tomadas Anexo", type: "Tomadas de Uso Geral", supply_type: "Monofásico", voltage: 220, power_w: 5000, demand_factor: 0.70 },
    { id: "ch7", name: "Cozinha e Cantina", type: "Tomadas de Uso Específico", supply_type: "Bifásico", voltage: 380, power_w: 8000, demand_factor: 0.80 },
    { id: "ch8", name: "Bomba Caixa D'Água", type: "Bomba Hidráulica", supply_type: "Trifásico", voltage: 380, power_w: 4000, demand_factor: 0.80 },
    { id: "ch9", name: "Iluminação Externa", type: "Iluminação", supply_type: "Monofásico", voltage: 220, power_w: 3000, demand_factor: 1.0 },
  ],
};
const churchMetrics = calcProjectMetrics(churchProject);
assert.equal(churchMetrics.totalInstalledPower, 69000, "Carga instalada da igreja = 69 kW");
assert.ok(churchMetrics.totalDemandPower < 60000, "Demanda calculada sobre Fd deve ser menor que 60 kW");
assert.ok(churchMetrics.generalCurrent < 120, "Corrente geral de demanda em 380V calculada adequadamente");
assert.equal(churchMetrics.generalBreaker, 125, "Disjuntor geral dimensionado para 125A com base na demanda");

console.log("main protection smoke: ok");
