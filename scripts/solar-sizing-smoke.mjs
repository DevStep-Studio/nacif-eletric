import assert from "node:assert/strict";
import {
  computeInstantResults,
  estimateAnnualGenerationKwh,
  estimateAnnualSavingsBrl,
  estimateBatteryAutonomyHours,
  estimateSimplePaybackYears,
  sizeFromAvailableArea,
  sizeFromDesiredPower,
} from "../src/lib/solarSizing.js";

// ── Opção 2: potência desejada -> módulos ─────────────────────────────────────
{
  const { panelCount, installedKwp } = sizeFromDesiredPower(11.55, 550);
  assert.equal(panelCount, 21, "11,55 kWp / 550 Wp arredonda para 21 módulos");
  assert.equal(installedKwp, 11.55, "21 x 550 Wp reconstitui 11,55 kWp exatos");
}
{
  const { panelCount, installedKwp } = sizeFromDesiredPower(10, 550);
  assert.equal(panelCount, 19, "10000W / 550W arredonda para cima (19)");
  assert.equal(installedKwp, 10.45, "potência efetiva instalada recalculada");
}

// ── Opção 3: área disponível -> capacidade preliminar (não é área/área_painel simples) ──
{
  const naive = Math.floor(72.4 / (SOLAR_MODULE_AREA()));
  const { panelCount, effectiveArea } = sizeFromAvailableArea(72.4, { moduleWp: 550 });
  assert.ok(panelCount < naive, "o fator de aproveitamento deve reduzir o resultado ingênuo");
  assert.ok(effectiveArea < 72.4, "área efetiva deve ser menor que a área bruta informada");
}

function SOLAR_MODULE_AREA() {
  return 2.4 * 1.14;
}

// ── Geração anual: pendente sem potência instalada ────────────────────────────
assert.equal(estimateAnnualGenerationKwh(0), null, "sem potência instalada, geração é pendente (não zero fictício)");
{
  const kwh = estimateAnnualGenerationKwh(11.55, { dailyIrradiationHspKwhM2: 4.8, performanceRatio: 0.8 });
  const expected = 11.55 * 4.8 * 365 * 0.8;
  assert.ok(Math.abs(kwh - expected) < 0.01, "geração segue kWp x HSP x 365 x PR");
}

// ── Economia: pendente sem consumo/tarifa ─────────────────────────────────────
assert.equal(estimateAnnualSavingsBrl(5000, null, 0.95), null, "sem consumo mensal, economia é pendente");
assert.equal(estimateAnnualSavingsBrl(5000, 800, null), null, "sem tarifa, economia é pendente");
{
  // geração menor que o consumo anual inteiro: tudo autoconsumido
  const savings = estimateAnnualSavingsBrl(3000, 300, 1); // consumo anual = 3600
  assert.equal(savings, 3000 * 1, "geração < consumo -> autoconsumo total, sem excedente");
}
{
  // geração maior que o consumo: parte vira excedente com fator de crédito
  const savings = estimateAnnualSavingsBrl(5000, 300, 1, { selfConsumptionCreditFactor: 0.9 });
  // consumo anual = 3600, autoconsumido = 3600, excedente = 1400 * 0.9
  assert.ok(Math.abs(savings - (3600 * 1 + 1400 * 1 * 0.9)) < 0.01, "excedente aplica o fator de crédito");
}

// ── Payback: pendente sem investimento ou economia ────────────────────────────
assert.equal(estimateSimplePaybackYears(null, 5000), null, "sem investimento, payback é pendente");
assert.equal(estimateSimplePaybackYears(50000, 0), null, "sem economia positiva, payback é pendente");
assert.equal(estimateSimplePaybackYears(50000, 12500), 4, "payback simples = investimento / economia anual");

// ── Autonomia de bateria: fórmula real, não fictícia ──────────────────────────
assert.equal(estimateBatteryAutonomyHours({ capacityKwh: 10, priorityLoadsW: [] }), null, "sem cargas prioritárias, autonomia é pendente");
{
  const hours = estimateBatteryAutonomyHours({
    capacityKwh: 10,
    depthOfDischargePct: 80,
    efficiencyPct: 90,
    priorityLoadsW: [300, 200],
  });
  const expected = (10 * 0.8 * 0.9 * 1000) / 500;
  assert.ok(Math.abs(hours - expected) < 0.001, "autonomia = capacidade útil / carga total");
}

// ── Painel de resultados instantâneos: estados pendentes coerentes ────────────
{
  const results = computeInstantResults({ panelCount: 0, moduleWp: 550 });
  assert.equal(results.annualGenerationKwh, null, "0 módulos -> geração pendente");
  assert.equal(results.annualSavingsBrl, null, "0 módulos -> economia pendente");
  assert.equal(results.paybackYears, null, "0 módulos -> payback pendente");
}
{
  const results = computeInstantResults({
    panelCount: 21,
    moduleWp: 550,
    monthlyConsumptionKwh: 842,
    tariffBrlPerKwh: 0.95,
  });
  assert.equal(results.installedKwp, 11.55, "21 x 550Wp = 11,55 kWp");
  assert.ok(results.annualGenerationKwh > 0, "geração calculada com premissas padrão");
  assert.ok(results.annualSavingsBrl > 0, "economia calculada a partir do consumo e tarifa informados");
  assert.ok(results.investmentIsEstimated, "sem investimento informado, sinaliza que foi estimado por R$/Wp");
  assert.ok(results.paybackYears > 0, "payback calculado com investimento estimado");
}

console.log("solar-sizing-smoke: OK");
