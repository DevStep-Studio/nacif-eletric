import assert from "node:assert/strict";
import {
  computeConsumptionMetrics,
  buildDefault12MonthTimeline,
  parseMonthYearString,
  normalizeHistoryItem,
} from "../src/lib/solarConsumptionEngine.js";
import {
  identifyDistributor,
  identifyTariffClass,
  identifySupplyType,
  extractConsumptionHistoryFromText,
  extractStructuredBillData,
  sanitizeAndValidateBillResult,
  SUPPORTED_DISTRIBUTORS,
} from "../src/lib/solarBillExtractor.js";

console.log("⚡ Executando testes automatizados: Extração Inteligente de Contas e Motor de Consumo Solar...\n");

// --- TESTE 1: Identificação de Distribuidoras Brasileiras ---
console.log("1. Testando reconhecimento de distribuidoras...");
assert.equal(identifyDistributor("FATURA DE ENERGIA ELÉTRICA ENEL SÃO PAULO")?.name, "Enel SP");
assert.equal(identifyDistributor("CEMIG DISTRIBUIÇÃO S.A.")?.name, "Cemig");
assert.equal(identifyDistributor("LIGHT SERVIÇOS DE ELETRICIDADE S.A.")?.name, "Light");
assert.equal(identifyDistributor("CPFL PAULISTA - COMPANHIA PAULISTA DE FORÇA E LUZ")?.name, "CPFL Paulista");
assert.equal(identifyDistributor("NEOENERGIA COELBA COMPANHIA DE ELETRICIDADE DO ESTADO DA BAHIA")?.name, "Neoenergia Coelba");
assert.equal(identifyDistributor("EQUATORIAL PARÁ DISTRIBUIDORA DE ENERGIA S.A.")?.name, "Equatorial Pará");
assert.equal(identifyDistributor("COPEL DISTRIBUIÇÃO S.A.")?.name, "Copel");
assert.equal(identifyDistributor("ENERGISA MATO GROSSO")?.name, "Energisa");
assert.equal(identifyDistributor("CELESC DISTRIBUIÇÃO")?.name, "Celesc");
assert.equal(identifyDistributor("RGE SUL DISTRIBUIDORA DE ENERGIA S.A.")?.name, "RGE Sul");
console.log("   ✓ Todas as 10+ distribuidoras reconhecidas com sucesso.");

// --- TESTE 2: Identificação de Classe Tarifária e Tipo de Fornecimento ---
console.log("2. Testando identificação de classes tarifárias e tipo de fornecimento...");
assert.equal(identifyTariffClass("CLASSIFICAÇÃO: B1 - RESIDENCIAL NORMAL"), "B1 - Residencial");
assert.equal(identifyTariffClass("TARIFA: B2 - RURAL"), "B2 - Rural");
assert.equal(identifyTariffClass("CONVENCIONAL B3 COMERCIAL"), "B3 - Comercial/Industrial (baixa tensão)");
assert.equal(identifyTariffClass("SUBGRUPO A4 HORO-SAZONAL VERDE"), "A4 - Verde (média tensão)");
assert.equal(identifyTariffClass("GRUPO A4 AZUL"), "A4 - Azul (média tensão)");

assert.equal(identifySupplyType("TIPO DE FORNECIMENTO: TRIFÁSICO A 3 FIOS"), "Trifásico");
assert.equal(identifySupplyType("TIPO DE FORNECIMENTO: BIFÁSICO 220/127V"), "Bifásico");
assert.equal(identifySupplyType("LIGAÇÃO MONOFÁSICA 127V"), "Monofásico");
console.log("   ✓ Classes tarifárias e tipos de fornecimento identificados.");

// --- TESTE 3: Parser de Mês e Alinhamento de Linha do Tempo ---
console.log("3. Testando parser flexível de meses e pareamento cronológico...");
const p1 = parseMonthYearString("JAN/25");
assert.equal(p1?.shortName, "Jan");
assert.equal(p1?.year, 2025);
assert.equal(p1?.label, "Jan/25");

const p2 = parseMonthYearString("Janeiro/2026");
assert.equal(p2?.shortName, "Jan");
assert.equal(p2?.year, 2026);
assert.equal(p2?.label, "Jan/26");

const p3 = parseMonthYearString("12/2024");
assert.equal(p3?.shortName, "Dez");
assert.equal(p3?.year, 2024);

const p4 = parseMonthYearString("OUT-25");
assert.equal(p4?.shortName, "Out");

// Timeline builder test with extracted history
const rawHistory6Months = [
  { month: "Jan/25", kwh: 420 },
  { month: "Fev/25", kwh: 480 },
  { month: "Mar/25", kwh: 510 },
  { month: "Abr/25", kwh: 390 },
  { month: "Mai/25", kwh: 360 },
  { month: "Jun/25", kwh: 340 },
];
const timeline = buildDefault12MonthTimeline(rawHistory6Months);
assert.equal(timeline.length, 12);
const filledCount = timeline.filter((t) => t.is_valid && t.kwh > 0).length;
assert.ok(filledCount >= 1, "Meses correspondentes foram pareados na timeline");
console.log("   ✓ Parser de meses e pareamento com a timeline validados.");

// --- TESTE 4: Motor de Cálculo Centralizado (12 meses vs Parcial vs Vazio) ---
console.log("4. Testando cálculos de consumo centralizados (Única Fonte da Verdade)...");
// Caso 1: 12 meses completos
const fullHistory12 = [
  { month: "Jan/25", kwh: 400 },
  { month: "Fev/25", kwh: 500 },
  { month: "Mar/25", kwh: 450 },
  { month: "Abr/25", kwh: 380 },
  { month: "Mai/25", kwh: 320 },
  { month: "Jun/25", kwh: 300 },
  { month: "Jul/25", kwh: 310 },
  { month: "Ago/25", kwh: 350 },
  { month: "Set/25", kwh: 370 },
  { month: "Out/25", kwh: 420 },
  { month: "Nov/25", kwh: 460 },
  { month: "Dez/25", kwh: 480 },
];
const fullMetrics = computeConsumptionMetrics(fullHistory12);
assert.equal(fullMetrics.hasHistory, true);
assert.equal(fullMetrics.validCount, 12);
assert.equal(fullMetrics.isCompleteAnnual, true);
assert.equal(fullMetrics.totalKwh, 4740);
assert.equal(fullMetrics.averageKwh, 395);
assert.equal(fullMetrics.peakKwh, 500);
assert.equal(fullMetrics.peakMonth, "Fev/25");
assert.equal(fullMetrics.minKwh, 300);
assert.equal(fullMetrics.minMonth, "Jun/25");
assert.equal(fullMetrics.totalLabel, "Total Anual");

// Caso 2: Histórico parcial (6 meses) — NUNCA tratar como "0 kWh/ano"
const partialMetrics = computeConsumptionMetrics(rawHistory6Months);
assert.equal(partialMetrics.hasHistory, true);
assert.equal(partialMetrics.validCount, 6);
assert.equal(partialMetrics.isCompleteAnnual, false);
assert.equal(partialMetrics.totalKwh, 2500);
assert.equal(partialMetrics.averageKwh, 417);
assert.equal(partialMetrics.peakKwh, 510);
assert.equal(partialMetrics.peakMonth, "Mar/25");
assert.equal(partialMetrics.totalLabel, "Total (6 meses)");

// Caso 3: Histórico vazio (0 meses)
const emptyMetrics = computeConsumptionMetrics([]);
assert.equal(emptyMetrics.hasHistory, false);
assert.equal(emptyMetrics.validCount, 0);
assert.equal(emptyMetrics.totalKwh, 0);
assert.equal(emptyMetrics.averageKwh, 0);
assert.equal(emptyMetrics.peakKwh, 0);
assert.equal(emptyMetrics.peakMonth, null);
console.log("   ✓ Métricas de consumo calculadas com precisão e consistência.");

// --- TESTE 5: Validação Estrita Anti-Dados Fictícios ---
console.log("5. Testando proteção estrita contra dados fictícios...");
const residentialRaw = {
  distributor: "Enel SP",
  tariff_class: "B1 - Residencial",
  contracted_demand_kw: 15, // Testando tentativa de injetar 15 kW em residencial
  tariff_brl_kwh: 0.95,
  monthly_consumption_kwh: 842,
  history_12_months: [
    { month: "Jan/25", kwh: 400 },
    { month: "Fev/25", kwh: 500 },
  ],
};
const validated = sanitizeAndValidateBillResult(residentialRaw);
assert.equal(validated.distributor, "Enel SP");
assert.equal(validated.tariff_class, "B1 - Residencial");
// Regra crítica: Demanda DEVE ser null para B1 Residencial
assert.equal(validated.contracted_demand_kw, null, "Demanda em B1 residencial deve ser estritamente null!");
// Consumo médio deve ser calculado a partir do histórico real fornecido (450 kWh), não do 842 fictício
assert.equal(validated.monthly_consumption_kwh, 450);
console.log("   ✓ Proteção anti-dados fictícios validada (demanda e média blindadas).");

// --- TESTE 6: Extração de Fatura Completa a partir de Texto Estruturado ---
console.log("6. Testando extração completa de fatura estruturada...");
const sampleBillText = `
ENEL DISTRIBUIÇÃO SÃO PAULO
NOME DO CLIENTE: CARLOS EDUARDO MENDES
UNIDADE CONSUMIDORA: 00987654321
ENDEREÇO DA INSTALAÇÃO: RUA DAS PALMEIRAS, 450 - JARDINS - SÃO PAULO/SP
CLASSIFICAÇÃO: B1 - RESIDENCIAL
TIPO DE FORNECIMENTO: BIFÁSICO
TOTAL A PAGAR: R$ 412,80
VENCIMENTO: 15/03/2026
MÊS DE REFERÊNCIA: FEV/2026

HISTÓRICO DE CONSUMO
MÊS/ANO   kWh   DIAS
MAR/25    380   30
ABR/25    390   30
MAI/25    370   30
JUN/25    350   30
JUL/25    340   30
AGO/25    360   30
SET/25    400   30
OUT/25    420   30
NOV/25    450   30
DEZ/25    470   30
JAN/26    490   30
FEV/26    460   30
`;

const extracted = extractStructuredBillData(sampleBillText);
assert.equal(extracted.distributor, "Enel SP");
assert.equal(extracted.holder_name, "CARLOS EDUARDO MENDES");
assert.equal(extracted.installation_code, "00987654321");
assert.equal(extracted.tariff_class, "B1 - Residencial");
assert.equal(extracted.supply_type, "Bifásico");
assert.equal(extracted.bill_total_brl, 412.80);
assert.equal(extracted.due_date, "15/03/2026");
assert.equal(extracted.history_12_months.length, 12);
assert.equal(extracted.history_12_months[0].month, "Mar/25");
assert.equal(extracted.history_12_months[0].kwh, 380);
assert.equal(extracted.history_12_months[11].month, "Fev/26");
assert.equal(extracted.history_12_months[11].kwh, 460);

const sanitizedExtracted = sanitizeAndValidateBillResult(extracted);
assert.equal(sanitizedExtracted.success, true);
assert.equal(sanitizedExtracted.confidence, "high");
assert.equal(sanitizedExtracted.metrics.isCompleteAnnual, true);
assert.equal(sanitizedExtracted.metrics.validCount, 12);
assert.equal(sanitizedExtracted.monthly_consumption_kwh, 407); // Média exata de 4880 / 12
assert.equal(sanitizedExtracted.metrics.peakKwh, 490);
assert.equal(sanitizedExtracted.metrics.peakMonth, "Jan/26");
console.log("   ✓ Fatura estruturada extraída e validada com 100% de sucesso.");

console.log("\n========================================================");
console.log("🎉 TODOS OS TESTES PASSARAM COM ÊXITO!");
console.log("========================================================");
