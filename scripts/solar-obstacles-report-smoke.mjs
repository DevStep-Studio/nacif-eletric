import assert from "node:assert/strict";
import {
  buildPanelPolygons,
  getBestPanelLayout,
  getAzimuthWithCardinal,
  calculateStringGrouping,
  computeRoofFaceTechnicalAnalysis,
} from "../src/lib/solarDesignerGeometry.js";
import {
  generateSitePlanReport,
  generateElectricalDiagramReport,
  generateTechnicalMemorialReport,
  generateBillOfMaterialsReport,
  generateGenerationSimulationReport,
  generateCommercialProposalReport,
} from "../src/lib/solarReportGenerator.js";

console.log("🧪 Iniciando testes de obstáculos interativos e relatórios solares...");

// 1. Configuração base de telhado
const baseRoof = [
  { lat: -23.55052, lng: -46.63331 },
  { lat: -23.55052, lng: -46.63316 },
  { lat: -23.55047, lng: -46.63316 },
  { lat: -23.55047, lng: -46.63331 },
];

const configWithoutObstacles = {
  roof_polygon: baseRoof,
  roof_defined: true,
  module_wp: 550,
  inverter_kw: 5,
  module_orientation: "auto",
  obstacles: [],
};

const layoutNoObs = getBestPanelLayout(configWithoutObstacles, 1200, "max_generation");
console.log(`✅ Telhado livre sem obstáculos: ${layoutNoObs.panelCount} módulos`);
assert.ok(layoutNoObs.panelCount > 0, "Deveria caber módulos no telhado livre");

// 2. Adição de um obstáculo no centro (Caixa d'água com raio 1.5m)
const obstacleCenter = {
  id: "obs_test_1",
  name: "Caixa d'água",
  type: "caixa_dagua",
  lat: -23.550495,
  lng: -46.633235,
  radiusM: 1.5,
  excludeArea: true,
};

const configWithCenterObs = {
  ...configWithoutObstacles,
  obstacles: [obstacleCenter],
};

const layoutWithObs = getBestPanelLayout(configWithCenterObs, 1200, "max_generation");
console.log(`✅ Telhado com caixa d'água central (raio 1.5m): ${layoutWithObs.panelCount} módulos`);
assert.ok(
  layoutWithObs.panelCount < layoutNoObs.panelCount,
  "A contagem de módulos deve diminuir para desviar do obstáculo"
);

// 3. Ajuste do raio do obstáculo para 2.5m (deve reduzir ainda mais os módulos)
const configWithLargerObs = {
  ...configWithoutObstacles,
  obstacles: [{ ...obstacleCenter, radiusM: 2.5 }],
};

const layoutLargerObs = getBestPanelLayout(configWithLargerObs, 1200, "max_generation");
console.log(`✅ Telhado com obstáculo expandido (raio 2.5m): ${layoutLargerObs.panelCount} módulos`);
assert.ok(
  layoutLargerObs.panelCount <= layoutWithObs.panelCount,
  "A expansão do raio deve reduzir ou manter o espaço livre"
);

// 4. Teste de geração de todos os relatórios PDF
const mockProject = {
  name: "Projeto Solar Residencial",
  client_name: "Engenheiro Teste",
  address: "Rua Ouro Branco, 1046",
  city: "São Paulo",
  state: "SP",
  installation_type: "Residencial",
  consumption: {
    monthly_consumption_kwh: 750,
    tariff_brl_kwh: 0.92,
    distributor: "Enel SP",
  },
};

const mockSizing = {
  panelCount: layoutWithObs.panelCount,
  dcPowerKw: (layoutWithObs.panelCount * 550) / 1000,
  annualGenerationKwh: 14500,
  annualSavingsBrl: 11200,
  acCurrent: 22.7,
  breaker: 32,
  usableArea: 48.5,
};

const p1 = generateSitePlanReport(mockProject, configWithCenterObs, mockSizing);
assert.ok(p1 && typeof p1.save === "function", "Planta de Implantação deve gerar jsPDF válido");

const p2 = generateElectricalDiagramReport(mockProject, configWithCenterObs, mockSizing);
assert.ok(p2 && typeof p2.save === "function", "Diagrama Elétrico deve gerar jsPDF válido");

const p3 = generateTechnicalMemorialReport(mockProject, configWithCenterObs, mockSizing);
assert.ok(p3 && typeof p3.save === "function", "Memorial Descritivo deve gerar jsPDF válido");

const p4 = generateBillOfMaterialsReport(mockProject, configWithCenterObs, mockSizing);
assert.ok(p4 && typeof p4.save === "function", "BOM deve gerar jsPDF válido");

const p5 = generateGenerationSimulationReport(mockProject, configWithCenterObs, mockSizing);
assert.ok(p5 && typeof p5.save === "function", "Simulação de Geração deve gerar jsPDF válido");

const p6 = generateCommercialProposalReport(mockProject, configWithCenterObs, mockSizing);
assert.ok(p6 && typeof p6.save === "function", "Proposta Comercial deve gerar jsPDF válido");

console.log("✅ Todos os 6 geradores de relatórios PDF funcionam perfeitamente!");
console.log("🎉 Bateria de testes de obstáculos e relatórios concluída com 100% de sucesso!");
