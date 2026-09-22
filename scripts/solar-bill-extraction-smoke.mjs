/**
 * scripts/solar-bill-extraction-smoke.mjs
 * Teste automatizado de extração inteligente de contas e motor de consumo
 */

import { computeConsumptionMetrics, buildDefault12MonthTimeline, normalizeHistoryItem } from "../src/lib/solarConsumptionEngine.js";
import { sanitizeAndValidateBillResult, identifyDistributor, identifyTariffClass } from "../src/lib/solarBillExtractor.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log("--- 1. TESTE DO MOTOR DE CÁLCULO DE CONSUMO (solarConsumptionEngine) ---");

// Teste 1.1: Histórico Vazio
const emptyMetrics = computeConsumptionMetrics([]);
assert(emptyMetrics.hasHistory === false, "Histórico vazio marca hasHistory = false");
assert(emptyMetrics.averageKwh === 0, "Histórico vazio não inventa média de 842");
assert(emptyMetrics.peakKwh === 0, "Histórico vazio tem pico 0 (não 1 kWh)");
assert(emptyMetrics.totalKwh === 0, "Histórico vazio tem total 0");
assert(emptyMetrics.validCount === 0, "Histórico vazio tem 0 registros válidos");

// Teste 1.2: Histórico Completo de 12 Meses com valores reais
const full12History = [
  { month: "Out/24", kwh: 400 },
  { month: "Nov/24", kwh: 450 },
  { month: "Dez/24", kwh: 600 },
  { month: "Jan/25", kwh: 750 },
  { month: "Fev/25", kwh: 700 },
  { month: "Mar/25", kwh: 550 },
  { month: "Abr/25", kwh: 500 },
  { month: "Mai/25", kwh: 480 },
  { month: "Jun/25", kwh: 420 },
  { month: "Jul/25", kwh: 390 },
  { month: "Ago/25", kwh: 410 },
  { month: "Set/25", kwh: 450 },
];
const fullMetrics = computeConsumptionMetrics(full12History);
const sumFull = full12History.reduce((s, i) => s + i.kwh, 0); // 6100
const expectedAvg = Math.round(6100 / 12); // 508

assert(fullMetrics.hasHistory === true, "12 meses: hasHistory = true");
assert(fullMetrics.validCount === 12, "12 meses: validCount = 12");
assert(fullMetrics.totalKwh === 6100, `12 meses: totalKwh = ${fullMetrics.totalKwh} (esperado 6100)`);
assert(fullMetrics.averageKwh === expectedAvg, `12 meses: averageKwh = ${fullMetrics.averageKwh} (esperado ${expectedAvg})`);
assert(fullMetrics.peakKwh === 750, "12 meses: peakKwh = 750");
assert(fullMetrics.peakMonth === "Jan/25", "12 meses: peakMonth = Jan/25");
assert(fullMetrics.isCompleteAnnual === true, "12 meses: isCompleteAnnual = true");
assert(fullMetrics.totalLabel === "Total Anual", "12 meses: rotulado como 'Total Anual'");

// Teste 1.3: Histórico Parcial de 6 Meses
const partial6History = [
  { month: "Abr/25", kwh: 500 },
  { month: "Mai/25", kwh: 480 },
  { month: "Jun/25", kwh: 420 },
  { month: "Jul/25", kwh: 390 },
  { month: "Ago/25", kwh: 410 },
  { month: "Set/25", kwh: 450 },
];
const partMetrics = computeConsumptionMetrics(partial6History);
const sumPart = 500 + 480 + 420 + 390 + 410 + 450; // 2650
const expectedPartAvg = Math.round(2650 / 6); // 442

assert(partMetrics.hasHistory === true, "6 meses: hasHistory = true");
assert(partMetrics.validCount === 6, "6 meses: validCount = 6");
assert(partMetrics.totalKwh === 2650, `6 meses: totalKwh = ${partMetrics.totalKwh}`);
assert(partMetrics.averageKwh === expectedPartAvg, `6 meses: averageKwh = ${partMetrics.averageKwh}`);
assert(partMetrics.isCompleteAnnual === false, "6 meses: não é ano completo");
assert(partMetrics.totalLabel === "Total (6 meses)", `6 meses: rotulado como '${partMetrics.totalLabel}' e NÃO Total Anual`);
assert(partMetrics.projectedAnnualKwh === Math.round(expectedPartAvg * 12), "6 meses: projeção anual baseada na média");

console.log("\n--- 2. TESTE DE IDENTIFICAÇÃO DE DISTRIBUIDORAS E TARIFAS ---");

const distEnel = identifyDistributor("Fatura ENEL DISTRIBUIÇÃO SÃO PAULO S.A.");
assert(distEnel?.name === "Enel SP", "Reconhece Enel SP");

const distCemig = identifyDistributor("Companhia Energética de Minas Gerais - CEMIG");
assert(distCemig?.name === "Cemig", "Reconhece Cemig");

const distCpfl = identifyDistributor("CPFL Paulista - Companhia Paulista de Força e Luz");
assert(distCpfl?.name === "CPFL Paulista", "Reconhece CPFL Paulista");

const distLight = identifyDistributor("LIGHT SERVIÇOS DE ELETRICIDADE S.A.");
assert(distLight?.name === "Light", "Reconhece Light");

const distEq = identifyDistributor("Equatorial Maranhão Distribuidora de Energia");
assert(distEq?.name === "Equatorial Maranhão", "Reconhece Equatorial Maranhão");

const tariffB1 = identifyTariffClass("Classificação: B1 Residencial Normal");
assert(tariffB1 === "B1 - Residencial", "Identifica B1 Residencial");

const tariffA4 = identifyTariffClass("Subgrupo A4 Verde Horossazonal");
assert(tariffA4 === "A4 - Verde (média tensão)", "Identifica A4 Verde");

console.log("\n--- 3. TESTE DE EXTRAÇÃO E SANITIZAÇÃO (solarBillExtractor) ---");

// Teste 3.1: Conta Residencial B1 NÃO DEVE ter demanda de 15 kW imposta
const rawResidencial = {
  holder_name: "Maria Oliveira",
  address: "Av Paulista 1000, São Paulo - SP",
  distributor: "Enel SP",
  tariff_class: "B1 - Residencial",
  contracted_demand_kw: 15, // Valor espúrio detectado por erro de OCR
  history_12_months: full12History,
};
const sanitizedRes = sanitizeAndValidateBillResult(rawResidencial);
assert(sanitizedRes.success === true, "Sanitização de B1 foi bem sucedida");
assert(sanitizedRes.holder_name === "Maria Oliveira", "Nome do titular preservado");
assert(sanitizedRes.distributor === "Enel SP", "Distribuidora preservada");
assert(sanitizedRes.tariff_class === "B1 - Residencial", "Classe B1 preservada");
assert(sanitizedRes.contracted_demand_kw === null, "Demanda espúria de 15 kW em conta B1 residencial foi corretamente descartada");
assert(sanitizedRes.monthly_consumption_kwh === expectedAvg, `Consumo médio calculado exatamente: ${sanitizedRes.monthly_consumption_kwh}`);

// Teste 3.2: Conta A4 Média Tensão DEVE aceitar demanda legítima
const rawA4 = {
  holder_name: "Metalúrgica ABC",
  address: "Distrito Industrial, Betim - MG",
  distributor: "Cemig",
  tariff_class: "A4 - Verde (média tensão)",
  contracted_demand_kw: 75,
  history_12_months: [{ month: "Jan/25", kwh: 12500 }, { month: "Fev/25", kwh: 13200 }],
};
const sanitizedA4 = sanitizeAndValidateBillResult(rawA4);
assert(sanitizedA4.contracted_demand_kw === 75, "Demanda legítima de 75 kW em conta A4 foi preservada");
assert(sanitizedA4.confidence === "low", "Histórico de apenas 2 meses marcado como confiança baixa/parcial");

// Teste 3.3: Linha do tempo padrão de 12 meses
const timeline = buildDefault12MonthTimeline([{ month: "Jan", kwh: 500 }]);
assert(timeline.length === 12, "Linha do tempo gerada possui exatamente 12 meses");

console.log("\n🎉 TODOS OS TESTES DE EXTRAÇÃO E CÁLCULO DE CONSUMO PASSARAM COM SUCESSO!");
