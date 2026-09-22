import assert from "node:assert/strict";
import { WIZARD_STEPS, defaultWizardState, getStepErrors } from "../src/lib/solarWizardState.js";
import { identifyDistributorByLocation, BRAZILIAN_REGULATORY_DISTRIBUTORS } from "../src/lib/solarDistributorRates.js";
import {
  generateExecutiveSolarPdf,
  generateSitePlanReport,
  generateElectricalDiagramReport,
  generateTechnicalMemorialReport,
  generateBillOfMaterialsReport,
  generateGenerationSimulationReport,
  generateCommercialProposalReport,
} from "../src/lib/solarReportGenerator.js";

console.log("⚡ Executando testes automatizados: Stepper, Reordenação de Etapas, Auto-detecção de Distribuidora e Relatórios PDF...");

// 1. Validar Nova Ordem das Etapas (5 Etapas: Dados, Localização, Consumo, Equipamentos, Projeto)
console.log("1. Validando a ordem exata das etapas do Wizard...");
const expectedKeys = ["dados", "localizacao", "consumo", "equipamentos", "projeto"];
assert.equal(WIZARD_STEPS.length, 5, "O wizard deve ter exatamente 5 etapas.");
expectedKeys.forEach((key, idx) => {
  assert.equal(WIZARD_STEPS[idx].key, key, `Etapa ${idx + 1} deve ser '${key}' mas é '${WIZARD_STEPS[idx].key}'`);
});
assert.equal(WIZARD_STEPS[1].key, "localizacao", "Etapa 2 DEVE ser Localização.");
assert.equal(WIZARD_STEPS[2].key, "consumo", "Etapa 3 DEVE ser Consumo.");
assert.equal(WIZARD_STEPS[3].key, "equipamentos", "Etapa 4 DEVE ser Equipamentos.");
assert.equal(WIZARD_STEPS[4].key, "projeto", "Etapa 5 DEVE ser Projeto.");
console.log("   ✓ Ordem das etapas validada com sucesso: Dados -> Localização -> Consumo -> Equipamentos -> Projeto.");

// 2. Validar Auto-detecção de Concessionária e Tarifa por Localidade
console.log("2. Validando auto-detecção de distribuidoras e tarifas...");

const testCases = [
  { input: { state: "SP", city: "São Paulo" }, expectedDistributor: "Enel SP", minTariff: 0.85 },
  { input: { state: "SP", city: "Campinas" }, expectedDistributor: "CPFL Paulista", minTariff: 0.90 },
  { input: { state: "SP", city: "Santos" }, expectedDistributor: "CPFL Piratininga", minTariff: 0.90 },
  { input: { state: "RJ", city: "Rio de Janeiro" }, expectedDistributor: "Light", minTariff: 1.05 },
  { input: { state: "RJ", city: "Niterói" }, expectedDistributor: "Enel RJ", minTariff: 1.05 },
  { input: { state: "MG", city: "Belo Horizonte" }, expectedDistributor: "Cemig", minTariff: 0.90 },
  { input: { state: "DF", city: "Brasília" }, expectedDistributor: "Neoenergia Brasília", minTariff: 0.80 },
  { input: { state: "BA", city: "Salvador" }, expectedDistributor: "Neoenergia Coelba", minTariff: 0.90 },
  { input: { state: "PR", city: "Curitiba" }, expectedDistributor: "Copel", minTariff: 0.80 },
  { input: { state: "SC", city: "Florianópolis" }, expectedDistributor: "Celesc", minTariff: 0.80 },
  { input: { state: "RS", city: "Porto Alegre" }, expectedDistributor: "RGE Sul", minTariff: 0.90 },
  { input: { state: "GO", city: "Goiânia" }, expectedDistributor: "Equatorial Goiás", minTariff: 0.85 },
  { input: { state: "CE", city: "Fortaleza" }, expectedDistributor: "Enel Ceará", minTariff: 0.90 },
  { input: { state: "PE", city: "Recife" }, expectedDistributor: "Neoenergia Pernambuco", minTariff: 0.85 },
  { input: { zip_code: "01310-100" }, expectedDistributor: "Enel SP" }, // Av Paulista CEP
  { input: { zip_code: "30140-071" }, expectedDistributor: "Cemig" }, // Savassi BH
];

testCases.forEach((tc) => {
  const result = identifyDistributorByLocation(tc.input);
  assert.ok(result, `Deveria identificar distribuidora para ${JSON.stringify(tc.input)}`);
  assert.equal(result.distributor, tc.expectedDistributor, `Distribuidora para ${JSON.stringify(tc.input)} esperada: ${tc.expectedDistributor}, obtida: ${result?.distributor}`);
  if (tc.minTariff) {
    assert.ok(result.referenceTariffBrlKwh >= tc.minTariff, `Tarifa esperada >= ${tc.minTariff}, obtida: ${result.referenceTariffBrlKwh}`);
  }
});
console.log(`   ✓ ${testCases.length} localidades de alta relevância testadas e validadas.`);

// 3. Validar Validações de Etapas e Estado Inicial
console.log("3. Validando validações de etapas e fluxo de transição...");
const freshState = defaultWizardState();

// Etapa 1 - Dados vazios deve ter erros
const dadosErrors = getStepErrors("dados", freshState);
assert.ok(dadosErrors.length > 0, "Etapa dados sem preenchimento deve acusar erros");

// Etapa 2 - Localização vazia deve ter erros
const locErrors = getStepErrors("localizacao", freshState);
assert.ok(locErrors.includes("Informe o endereço."), "Deve exigir endereço");
assert.ok(locErrors.includes("Informe a cidade."), "Deve exigir cidade");
assert.ok(locErrors.includes("Informe o estado (UF)."), "Deve exigir estado");

// Etapa 3 - Consumo vazio deve ter erros
const consumoErrors = getStepErrors("consumo", freshState);
assert.ok(consumoErrors.includes("Informe o consumo médio mensal (kWh)."), "Deve exigir consumo");
assert.ok(consumoErrors.includes("Informe a tarifa de energia (R$/kWh)."), "Deve exigir tarifa");
console.log("   ✓ Validações das etapas 1, 2 e 3 funcionando rigorosamente.");

// 4. Validar Geração dos 7 Relatórios PDF Técnicos sem Falhas
console.log("4. Validando geradores de relatórios PDF (jsPDF)...");
const mockProject = {
  id: "test-proj-001",
  name: "Residência Teste Solar",
  client_name: "Engenheiro Carlos Silva",
  address: "Av. Paulista, 1000",
  city: "São Paulo",
  state: "SP",
  zip_code: "01310-100",
  consumption: {
    monthly_consumption_kwh: 650,
    tariff_brl_kwh: 0.95,
    distributor: "Enel SP",
    tariff_class: "B1 - Residencial",
  },
  technical_responsible: {
    name: "Eng. Responsável",
    crea: "CREA-SP 123456/D",
    company: "Solar Tech Engenharia",
  },
};

const mockConfig = {
  inverter_kw: 6,
  inverter_quantity: 1,
  inverter_manufacturer: "Deye",
  inverter_model: "SUN-6K-G03",
  module_wp: 550,
  module_manufacturer: "Canadian Solar",
  module_model: "CS6W-550MS",
  requested_panel_count: 14,
  ac_voltage: 220,
  ac_supply_type: "Bifásico",
  roof_pitch_deg: 15,
  roof_rotation_deg: 0,
};

const mockSizing = {
  installedPowerKwp: 7.7,
  monthlyGenKwh: 924,
  annualGenKwh: 11088,
  monthlySavingsBrl: 877.8,
  annualSavingsBrl: 10533.6,
  paybackYears: 2.8,
  estimatedInvestmentBrl: 29500,
};

const pdfGenerators = [
  { name: "Relatório Executivo Completo", fn: generateExecutiveSolarPdf },
  { name: "Planta de Implantação", fn: generateSitePlanReport },
  { name: "Diagrama Elétrico", fn: generateElectricalDiagramReport },
  { name: "Memorial Descritivo", fn: generateTechnicalMemorialReport },
  { name: "Lista de Materiais (BOM)", fn: generateBillOfMaterialsReport },
  { name: "Simulação de Geração", fn: generateGenerationSimulationReport },
  { name: "Proposta Comercial", fn: generateCommercialProposalReport },
];

pdfGenerators.forEach(({ name, fn }) => {
  const doc = fn(mockProject, mockConfig, mockSizing);
  assert.ok(doc, `Gerador de ${name} deve retornar uma instância válida`);
  const blob = doc.output("blob");
  assert.ok(blob.size > 1000, `PDF de ${name} deve conter dados (tamanho: ${blob.size} bytes)`);
});
console.log(`   ✓ Todos os ${pdfGenerators.length} relatórios PDF foram gerados com sucesso.`);

console.log("\n========================================================");
console.log("🎉 TODOS OS TESTES DE STEPPER, LOCALIZAÇÃO E PDF PASSARAM!");
console.log("========================================================\n");
