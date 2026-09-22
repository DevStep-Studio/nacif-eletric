import assert from "node:assert/strict";
import {
  buildPanelPolygons,
  calculateStringGrouping,
  computeRoofFaceTechnicalAnalysis,
  getAzimuthWithCardinal,
  getBestPanelLayout,
} from "../src/lib/solarDesignerGeometry.js";
import {
  generateBillOfMaterialsReport,
  generateCommercialProposalReport,
  generateElectricalDiagramReport,
  generateGenerationSimulationReport,
  generateSitePlanReport,
  generateTechnicalMemorialReport,
} from "../src/lib/solarReportGenerator.js";

console.log("🧪 Iniciando testes de fumaça das novas funcionalidades solares...");

// 1. Teste de Azimute com Ponto Cardeal
const az1 = getAzimuthWithCardinal(0);
assert.equal(az1.cardinal, "N", "0° deve ser N");

const az2 = getAzimuthWithCardinal(24);
assert.equal(az2.cardinal, "NE", "24° deve ser NE");

const az3 = getAzimuthWithCardinal(90);
assert.equal(az3.cardinal, "L", "90° deve ser L");

const az4 = getAzimuthWithCardinal(180);
assert.equal(az4.cardinal, "S", "180° deve ser S");
console.log("✅ 1. Cálculo de azimute e rosa dos ventos OK");

// 2. Teste de Agrupamento de Strings
const strings21 = calculateStringGrouping(21, { moduleWp: 550, inverterKw: 5 });
assert.equal(strings21.length, 2, "21 módulos devem ser divididos em 2 strings");
assert.equal(strings21[0].moduleCount, 11, "String 01 deve ter 11 módulos");
assert.equal(strings21[1].moduleCount, 10, "String 02 deve ter 10 módulos");
assert.equal(strings21[0].startModule, 1);
assert.equal(strings21[0].endModule, 11);
assert.equal(strings21[1].startModule, 12);
assert.equal(strings21[1].endModule, 21);
console.log("✅ 2. Agrupamento e balanceamento de strings OK");

// 3. Teste de Exclusão de Obstáculos na Geometria
const testConfigWithoutObstacles = {
  roof_width_m: 14.67,
  roof_height_m: 4.8,
  roof_rotation_deg: 24,
  roof_pitch_deg: 12,
  module_orientation: "auto",
  obstacles: [],
};

const layoutNoObs = getBestPanelLayout(testConfigWithoutObstacles, 1200);
assert.ok(layoutNoObs.panelCount > 0, "Deve encaixar painéis em telhado sem obstáculos");

const testConfigWithObstacles = {
  ...testConfigWithoutObstacles,
  obstacles: [
    {
      id: "obs_test_1",
      lat: -23.55052,
      lng: -46.63331,
      radiusM: 2.5,
      excludeArea: true,
    },
  ],
};

const layoutWithObs = getBestPanelLayout(testConfigWithObstacles, 1200);
assert.ok(
  layoutWithObs.panelCount <= layoutNoObs.panelCount,
  "Telhado com obstáculo deve ter capacidade igual ou menor que telhado sem obstáculo"
);
console.log("✅ 3. Subtração e exclusão de obstáculos no empacotamento OK");

// 4. Teste de Estratégias de Layout
const stratMaxGen = getBestPanelLayout(testConfigWithoutObstacles, 1200, "max_generation");
const stratMaxUtil = getBestPanelLayout(testConfigWithoutObstacles, 1200, "max_utilization");
const stratAesthetic = getBestPanelLayout(testConfigWithoutObstacles, 1200, "best_aesthetic");
const stratMinCost = getBestPanelLayout(testConfigWithoutObstacles, 1200, "min_cost");

assert.ok(stratMaxGen.panelCount > 0);
assert.ok(stratMaxUtil.panelCount >= stratAesthetic.panelCount);
console.log("✅ 4. Simulação de layout com as 4 estratégias OK");

// 5. Teste de Geração dos 6 Relatórios em PDF
const mockProject = {
  name: "Residência João Silva",
  client_name: "João Silva",
  address: "Rua das Flores, 123 - São Paulo - SP",
  city: "São Paulo",
  state: "SP",
  installation_type: "Residencial",
  consumption: {
    monthly_consumption_kwh: 842,
    tariff_brl_kwh: 0.95,
    distributor: "Enel SP",
  },
};

const mockSizing = {
  panelCount: 21,
  dcPowerKw: 11.55,
  annualGenerationKwh: 15250,
  annualSavingsBrl: 12430,
  breaker: 32,
  usableArea: 58.7,
  acCurrent: 22.7,
};

const r1 = generateSitePlanReport(mockProject, testConfigWithoutObstacles, mockSizing);
const r2 = generateElectricalDiagramReport(mockProject, testConfigWithoutObstacles, mockSizing);
const r3 = generateTechnicalMemorialReport(mockProject, testConfigWithoutObstacles, mockSizing);
const r4 = generateBillOfMaterialsReport(mockProject, testConfigWithoutObstacles, mockSizing);
const r5 = generateGenerationSimulationReport(mockProject, testConfigWithoutObstacles, mockSizing);
const r6 = generateCommercialProposalReport(mockProject, testConfigWithoutObstacles, mockSizing);

assert.ok(r1 && typeof r1.output === "function", "Planta de implantação deve gerar PDF");
assert.ok(r2 && typeof r2.output === "function", "Diagrama elétrico deve gerar PDF");
assert.ok(r3 && typeof r3.output === "function", "Memorial descritivo deve gerar PDF");
assert.ok(r4 && typeof r4.output === "function", "BOM deve gerar PDF");
assert.ok(r5 && typeof r5.output === "function", "Simulação de geração deve gerar PDF");
assert.ok(r6 && typeof r6.output === "function", "Proposta comercial deve gerar PDF");
console.log("✅ 5. Geração dos 6 relatórios em PDF OK");

console.log("🎉 Todos os testes de fumaça solares passaram com sucesso!");
