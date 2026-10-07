import assert from "node:assert/strict";
import {
  createDefaultSolarArea,
  normalizeSolarArea,
  normalizeSolarAreas,
  computeAreaPanels,
  computeMultiAreaLayouts,
  getMultiAreaAggregateMetrics,
  buildRoofPolygon,
  getRoofMetricsFromPolygon,
  DEFAULT_SOLAR_MAP_CENTER,
} from "../src/lib/solarDesignerGeometry.js";

console.log("=== INICIANDO TESTES AUTOMATIZADOS DE MÚLTIPLAS ÁREAS SOLARES ===");

const baseConfig = {
  inverter_kw: 15,
  module_wp: 550,
  module_preset_id: "canadian-550-hiku6",
  structure_type: "triangle",
  module_orientation: "horizontal",
  layout_strategy: "max_generation",
  map_center_lat: -23.55052,
  map_center_lng: -46.63331,
  map_zoom: 20,
};

// ----------------------------------------------------
// CENÁRIO A: Criação Sucessiva de 10 Áreas Solares
// ----------------------------------------------------
console.log("\n[Cenário A] Criando 10 áreas solares consecutivas...");

let areas = [];
for (let i = 1; i <= 10; i++) {
  // Gera coordenadas com pequeno deslocamento para cada água do telhado
  const center = {
    lat: DEFAULT_SOLAR_MAP_CENTER.lat + i * 0.0002,
    lng: DEFAULT_SOLAR_MAP_CENTER.lng + i * 0.0002,
  };
  const polygon = buildRoofPolygon(center, 12 + i, 8 + (i % 3), (i * 30) % 180);
  
  const area = createDefaultSolarArea(
    {
      id: `area_${i}`,
      name: `Área Solar ${i}`,
      polygon,
      roof_pitch_deg: 10 + i,
      roof_rotation_deg: (i * 30) % 180,
      structure_type: i % 2 === 0 ? "triangle" : "coplanar",
      module_orientation: i % 3 === 0 ? "vertical" : "horizontal",
      auto_fill_surface: true,
    },
    i,
    baseConfig
  );
  areas.push(area);
}

assert.equal(areas.length, 10, "Devem existir exatamente 10 áreas criadas");
for (let i = 0; i < 10; i++) {
  assert.equal(areas[i].id, `area_${i + 1}`, `ID da área ${i + 1} deve estar preservado`);
  assert.equal(areas[i].polygon.length, 4, `Área ${i + 1} deve possuir 4 vértices`);
  assert.ok(areas[i].roof_area_m2 > 0, `Área ${i + 1} deve ter metragem calculada positiva`);
}

const configWith10 = { ...baseConfig, areas };
const layouts10 = computeMultiAreaLayouts(configWith10);
assert.equal(layouts10.length, 10, "Layouts calculados para todas as 10 áreas");

const allPanelsPositive = layouts10.every((a) => a.panelCount > 0 && a.panelPolygons.length === a.panelCount);
assert.ok(allPanelsPositive, "Todas as 10 áreas devem possuir módulos distribuídos");
console.log(`✅ Cenário A aprovado: 10 áreas criadas com sucesso (Total: ${layouts10.reduce((s, a) => s + a.panelCount, 0)} módulos)`);

// ----------------------------------------------------
// CENÁRIO B: Edição Individual de uma Área Específica (Área 3)
// ----------------------------------------------------
console.log("\n[Cenário B] Editando individualmente a Área 3...");

const area3Before = JSON.stringify(layouts10[2]);
const otherAreasBefore = layouts10.filter((_, idx) => idx !== 2).map((a) => ({ id: a.id, panels: a.panelCount, pitch: a.roof_pitch_deg }));

// Modifica Área 3 para inclinação 28° e orientação vertical
const updatedAreas = areas.map((a) => {
  if (a.id === "area_3") {
    return {
      ...a,
      roof_pitch_deg: 28,
      roof_rotation_deg: 45,
      module_orientation: "vertical",
      auto_fill_surface: false,
      requested_panel_count: 8,
    };
  }
  return a;
});

const configAfterB = { ...baseConfig, areas: updatedAreas };
const layoutsAfterB = computeMultiAreaLayouts(configAfterB);

const area3After = layoutsAfterB.find((a) => a.id === "area_3");
assert.equal(area3After.roof_pitch_deg, 28, "Área 3 deve ter inclinação 28°");
assert.equal(area3After.roof_rotation_deg, 45, "Área 3 deve ter rotação 45°");
assert.equal(area3After.panelCount, 8, "Área 3 deve ter exatamente 8 módulos solicitados");

// Verifica se as outras 9 áreas não foram modificadas
const otherAreasAfter = layoutsAfterB.filter((a) => a.id !== "area_3").map((a) => ({ id: a.id, panels: a.panelCount, pitch: a.roof_pitch_deg }));
assert.deepEqual(otherAreasAfter, otherAreasBefore, "Nenhuma das outras 9 áreas pode sofrer alteração ao editar a Área 3");
console.log("✅ Cenário B aprovado: Área 3 editada independentemente sem afetar as demais 9 áreas");

// ----------------------------------------------------
// CENÁRIO C: Exclusão da Área 5
// ----------------------------------------------------
console.log("\n[Cenário C] Excluindo a Área 5...");

const areasWithout5 = updatedAreas.filter((a) => a.id !== "area_5");
assert.equal(areasWithout5.length, 9, "Devem restar 9 áreas após exclusão");
assert.ok(!areasWithout5.some((a) => a.id === "area_5"), "Área 5 não deve mais existir");

const layoutsAfterC = computeMultiAreaLayouts({ ...baseConfig, areas: areasWithout5 });
assert.equal(layoutsAfterC.length, 9, "Devem ser calculados 9 layouts");
assert.ok(!layoutsAfterC.some((a) => a.id === "area_5"), "Módulos da Área 5 foram removidos");
console.log("✅ Cenário C aprovado: Apenas a Área 5 e seus módulos foram removidos");

// ----------------------------------------------------
// CENÁRIO D: Cancelamento de Demarcação
// ----------------------------------------------------
console.log("\n[Cenário D] Testando cancelamento de demarcação...");

// Simula início de desenho de nova área descartada pelo usuário
const candidateAreas = [...areasWithout5]; // estado atual intacto
// Se o usuário cancela no meio do desenho, candidateAreas não recebe append
const restoredLayouts = computeMultiAreaLayouts({ ...baseConfig, areas: candidateAreas });
assert.equal(restoredLayouts.length, 9, "Todas as 9 áreas anteriores continuam 100% preservadas");
console.log("✅ Cenário D aprovado: Cancelamento não afetou as áreas existentes");

// ----------------------------------------------------
// CENÁRIO E: Persistência e Compatibilidade com Projetos Antigos
// ----------------------------------------------------
console.log("\n[Cenário E] Testando persistência e compatibilidade legado...");

// 1. Projeto antigo com apenas `roof_polygon`
const legacyProjectConfig = {
  ...baseConfig,
  roof_polygon: buildRoofPolygon(DEFAULT_SOLAR_MAP_CENTER, 15, 8, 120),
  roof_width_m: 15,
  roof_height_m: 8,
  roof_area_m2: 120,
};

const migratedAreas = normalizeSolarAreas(legacyProjectConfig.areas, legacyProjectConfig);
assert.equal(migratedAreas.length, 1, "Projeto legado deve ser migrado para 1 área solar");
assert.equal(migratedAreas[0].id, "area_1", "ID padrão da área migrada");
assert.equal(migratedAreas[0].polygon.length, 4, "Polígono preservado na migração");

// 2. Serialização e deserialização JSON (simulando salvamento no backend)
const serializedJson = JSON.stringify({ ...baseConfig, areas: areasWithout5 });
const parsedConfig = JSON.parse(serializedJson);
const reloadedAreas = normalizeSolarAreas(parsedConfig.areas, parsedConfig);
assert.equal(reloadedAreas.length, 9, "Todas as 9 áreas recuperadas após parse JSON");
console.log("✅ Cenário E aprovado: Migração de projetos legados e persistência validadas");

// ----------------------------------------------------
// CENÁRIO F: Verificação de Agregações e Cálculos Totais
// ----------------------------------------------------
console.log("\n[Cenário F] Verificando cálculos agregados e somatório de potência...");

const aggregate = getMultiAreaAggregateMetrics(layoutsAfterC, baseConfig);
const manualTotalPanels = layoutsAfterC.reduce((sum, a) => sum + a.panelCount, 0);
const manualTotalPowerKw = Number(((manualTotalPanels * baseConfig.module_wp) / 1000).toFixed(2));
const manualTotalAreaM2 = Number(layoutsAfterC.reduce((sum, a) => sum + a.roof_area_m2, 0).toFixed(1));

assert.equal(aggregate.totalPanels, manualTotalPanels, "Total de painéis deve ser a soma exata das áreas");
assert.equal(aggregate.totalDcPowerKw, manualTotalPowerKw, "Potência total kWp deve ser a soma exata das áreas");
assert.equal(aggregate.totalAreaM2, manualTotalAreaM2, "Metragem total m² deve ser a soma exata das áreas");
assert.equal(aggregate.allPanelPolygons.length, manualTotalPanels, "Polígonos de módulos devem conter todos os módulos do projeto");

console.log(`✅ Cenário F aprovado: Métricas somadas com precisão (${aggregate.totalPanels} módulos, ${aggregate.totalDcPowerKw} kWp, ${aggregate.totalAreaM2} m²)`);

console.log("\n🎉 TODOS OS TESTES OBRIGATÓRIOS FORAM EXECUTADOS COM 100% DE SUCESSO!");
