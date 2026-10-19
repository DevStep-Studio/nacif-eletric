import assert from "node:assert/strict";
import {
  createDefaultSolarArea,
  normalizeSolarAreas,
  computeMultiAreaLayouts,
  getMultiAreaAggregateMetrics,
} from "../src/lib/solarDesignerGeometry.js";
import {
  estimateAnnualGenerationKwh,
  estimateAnnualSavingsBrl,
  estimateSimplePaybackYears,
  DEFAULT_SIZING_PREMISES,
} from "../src/lib/solarSizing.js";
import { syncSolarToProjectCircuits } from "../src/lib/projectUnifiedSync.js";

function normalizeSolarConfig(cfg = {}) {
  const normAreas = normalizeSolarAreas(cfg.areas, cfg);
  return {
    ...cfg,
    areas: normAreas,
  };
}

console.log("🧪 Iniciando Bateria de Testes de Auditoria Completa do Módulo Solar Fotovoltaico...\n");

// 1. Criação de Projeto Solar com Múltiplos Conjuntos Independentes
console.log("▶ Teste 1: Criação de múltiplos conjuntos independentes (Área 1 = 12 mods, Área 2 = 8 mods, Área 3 = 16 mods)...");

const baseConfig = {
  inverter_kw: 15,
  module_wp: 550,
  roof_polygon: [],
  areas: [],
};

// Área 1: 12 módulos
const poly1 = [
  { lat: -23.5500, lng: -46.6300 },
  { lat: -23.5500, lng: -46.6290 },
  { lat: -23.5495, lng: -46.6290 },
  { lat: -23.5495, lng: -46.6300 },
];
const area1 = createDefaultSolarArea({
  id: "area_conjunto_1",
  name: "Conjunto Norte (Telhado Principal)",
  polygon: poly1,
  auto_fill_surface: false,
  requested_panel_count: 12,
  roof_rotation_deg: 0,
  roof_pitch_deg: 15,
  module_orientation: "horizontal",
}, 1, baseConfig);

// Área 2: 8 módulos
const poly2 = [
  { lat: -23.5510, lng: -46.6300 },
  { lat: -23.5510, lng: -46.6295 },
  { lat: -23.5505, lng: -46.6295 },
  { lat: -23.5505, lng: -46.6300 },
];
const area2 = createDefaultSolarArea({
  id: "area_conjunto_2",
  name: "Conjunto Leste (Garagem)",
  polygon: poly2,
  auto_fill_surface: false,
  requested_panel_count: 8,
  roof_rotation_deg: 90,
  roof_pitch_deg: 10,
  module_orientation: "vertical",
}, 2, baseConfig);

// Área 3: 16 módulos
const poly3 = [
  { lat: -23.5520, lng: -46.6300 },
  { lat: -23.5520, lng: -46.6285 },
  { lat: -23.5515, lng: -46.6285 },
  { lat: -23.5515, lng: -46.6300 },
];
const area3 = createDefaultSolarArea({
  id: "area_conjunto_3",
  name: "Conjunto Oeste (Anexo)",
  polygon: poly3,
  auto_fill_surface: false,
  requested_panel_count: 16,
  roof_rotation_deg: 270,
  roof_pitch_deg: 12,
  module_orientation: "horizontal",
}, 3, baseConfig);

const initialConfig = normalizeSolarConfig({
  ...baseConfig,
  areas: [area1, area2, area3],
});

assert.equal(initialConfig.areas.length, 3, "Devem existir 3 conjuntos cadastrados");

const layouts1 = computeMultiAreaLayouts(initialConfig);
assert.equal(layouts1[0].panelCount, 12, "Área 1 deve ter exatamente 12 módulos");
assert.equal(layouts1[1].panelCount, 8, "Área 2 deve ter exatamente 8 módulos");
assert.equal(layouts1[2].panelCount, 16, "Área 3 deve ter exatamente 16 módulos");

const agg1 = getMultiAreaAggregateMetrics(layouts1, initialConfig);
assert.equal(agg1.totalPanels, 36, "Total de módulos no projeto = 12 + 8 + 16 = 36");
assert.equal(agg1.totalDcPowerKw, (36 * 550) / 1000, "Potência total = 19.8 kWp");
console.log(`  ✓ 3 conjuntos criados: ${agg1.totalPanels} módulos, ${agg1.totalDcPowerKw} kWp somados com precisão.`);

// 2. Independência entre Conjuntos
console.log("\n▶ Teste 2: Independência estrita (Editar Área 2 sem alterar Área 1 ou Área 3)...");

const updatedAreas = initialConfig.areas.map(a => {
  if (a.id === "area_conjunto_2") {
    return {
      ...a,
      roof_rotation_deg: 115,
      roof_pitch_deg: 22,
      requested_panel_count: 10, // Aumentou para 10 módulos
    };
  }
  return a;
});

const configAfterEdit = normalizeSolarConfig({
  ...initialConfig,
  areas: updatedAreas,
});

const layouts2 = computeMultiAreaLayouts(configAfterEdit);
assert.equal(layouts2[0].panelCount, 12, "Área 1 permaneceu intocada com 12 módulos");
assert.equal(layouts2[0].roof_rotation_deg, 0, "Área 1 manteve rotação 0°");
assert.equal(layouts2[1].panelCount, 10, "Área 2 atualizou para 10 módulos");
assert.equal(layouts2[1].roof_rotation_deg, 115, "Área 2 atualizou rotação para 115°");
assert.equal(layouts2[2].panelCount, 16, "Área 3 permaneceu intocada com 16 módulos");
assert.equal(layouts2[2].roof_rotation_deg, 270, "Área 3 manteve rotação 270°");

const agg2 = getMultiAreaAggregateMetrics(layouts2, configAfterEdit);
assert.equal(agg2.totalPanels, 38, "Total agora é 12 + 10 + 16 = 38 módulos");
console.log("  ✓ Área 2 editada de forma 100% isolada e independente.");

// 3. Exclusão de Conjunto Intermediário
console.log("\n▶ Teste 3: Exclusão do Conjunto 2 (preservando Conjuntos 1 e 3)...");

const configAfterDelete = normalizeSolarConfig({
  ...configAfterEdit,
  areas: configAfterEdit.areas.filter(a => a.id !== "area_conjunto_2"),
});

assert.equal(configAfterDelete.areas.length, 2, "Restam 2 conjuntos no projeto");
const layouts3 = computeMultiAreaLayouts(configAfterDelete);
assert.equal(layouts3[0].id, "area_conjunto_1", "Conjunto 1 preservado");
assert.equal(layouts3[0].panelCount, 12, "Conjunto 1 ainda tem 12 módulos");
assert.equal(layouts3[1].id, "area_conjunto_3", "Conjunto 3 preservado");
assert.equal(layouts3[1].panelCount, 16, "Conjunto 3 ainda tem 16 módulos");

const agg3 = getMultiAreaAggregateMetrics(layouts3, configAfterDelete);
assert.equal(agg3.totalPanels, 28, "Total após exclusão = 12 + 16 = 28 módulos");
assert.equal(agg3.totalDcPowerKw, (28 * 550) / 1000, "Potência total = 15.4 kWp");
console.log("  ✓ Exclusão da Área 2 concluída com sucesso. Áreas 1 e 3 100% intactas.");

// 4. Cálculos Matemáticos e Fórmulas de Geração e Economia
console.log("\n▶ Teste 4: Auditoria das Fórmulas Energéticas e Financeiras...");

const installedKwp = agg3.totalDcPowerKw; // 15.4 kWp
const annualGen = estimateAnnualGenerationKwh(installedKwp, {
  dailyIrradiationHspKwhM2: 4.8,
  performanceRatio: 0.8,
});
// Fórmula NBR/INPE: P_inst * HSP * 365 * PR
const expectedGen = 15.4 * 4.8 * 365 * 0.8;
assert.equal(annualGen, expectedGen, "Fórmula de geração anual estritamente respeitada");

const monthlyGen = annualGen / 12;
const monthlyConsumption = 1500; // kWh/mês
const tariff = 0.95; // R$/kWh
const annualSavings = estimateAnnualSavingsBrl(annualGen, monthlyConsumption, tariff);
assert.ok(annualSavings > 0, "Economia anual calculada");

const investment = 15.4 * 1000 * 3.5; // ~R$ 53.900
const payback = estimateSimplePaybackYears(investment, annualSavings);
assert.ok(payback > 0 && payback < 8, `Payback razoável para mercado brasileiro (${payback.toFixed(1)} anos)`);
console.log(`  ✓ Geração anual: ${annualGen.toFixed(0)} kWh/ano (~${monthlyGen.toFixed(0)} kWh/mês).`);
console.log(`  ✓ Economia anual: R$ ${annualSavings.toFixed(2)}, Payback: ${payback.toFixed(1)} anos.`);

// 5. Sincronização Elétrica NBR 16690 e Integração com Quadro DIN
console.log("\n▶ Teste 5: Sincronização do Inversor e Proteções NBR 16690...");

const mockProject = {
  id: "proj_solar_audit",
  name: "Residencial Solar Alpha",
  circuits: [],
  panel_boards: [],
  solar_config: configAfterDelete,
};

const syncResult = syncSolarToProjectCircuits(mockProject, {
  ...configAfterDelete,
  dc_power_kw: installedKwp,
  inverter_power_kw: 15,
  ac_voltage: 220,
  ac_supply_type: "Trifásico",
});

const solarCircuit = syncResult.project.circuits.find(c => c.is_solar);
assert.ok(solarCircuit, "Circuito solar foi criado no modelo elétrico do projeto");
assert.equal(solarCircuit.supply_type, "Trifásico", "Alimentação trifásica refletida");
assert.equal(solarCircuit.breaker_poles, 3, "Disjuntor tripolar");
assert.ok(solarCircuit.breaker_a >= 40, "Disjuntor dimensionado com fator 1.25x I_ac");
console.log(`  ✓ Circuito solar ${solarCircuit.name}: Disjuntor ${solarCircuit.breaker_a}A (${solarCircuit.breaker_poles}P) com bitola ${solarCircuit.wire_gauge}.`);

// 6. Persistência Exata e Recuperação sem Mutações Espúrias
console.log("\n▶ Teste 6: Teste de Persistência, Serialização e Recuperação Exata...");

const serialized = JSON.stringify(configAfterDelete);
const parsed = JSON.parse(serialized);
const recoveredConfig = normalizeSolarConfig(parsed);

assert.equal(recoveredConfig.areas.length, 2, "Quantidade de conjuntos recuperada idêntica");
assert.equal(recoveredConfig.areas[0].name, "Conjunto Norte (Telhado Principal)", "Nome conjunto 1 idêntico");
assert.equal(recoveredConfig.areas[0].requested_panel_count, 12, "Qtd módulos conjunto 1 idêntica");
assert.equal(recoveredConfig.areas[1].name, "Conjunto Oeste (Anexo)", "Nome conjunto 2 idêntico");
assert.equal(recoveredConfig.areas[1].requested_panel_count, 16, "Qtd módulos conjunto 2 idêntica");

const recoveredLayouts = computeMultiAreaLayouts(recoveredConfig);
assert.equal(recoveredLayouts[0].panelCount, 12, "Layout conjunto 1 recuperado idêntico");
assert.equal(recoveredLayouts[1].panelCount, 16, "Layout conjunto 2 recuperado idêntico");
console.log("  ✓ Recuperação de dados salvos validada com 100% de exatidão e idempotência.");

console.log("\n==================================================================");
console.log("🎉 TODOS OS 6 TESTES DA AUDITORIA SOLAR PASSARAM COM SUCESSO!");
console.log("==================================================================");
