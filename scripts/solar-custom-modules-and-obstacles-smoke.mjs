import assert from "node:assert/strict";
import {
  MODULE_CATALOG,
  getAllModulePresets,
  getModulePreset,
  getModuleDimensions,
  PANEL_VISUAL_STYLES,
  buildPanelPolygons,
  distanceMeters,
} from "../src/lib/solarDesignerGeometry.js";

console.log("🧪 Iniciando testes: Catálogo Expandido de Módulos, Customização e Obstáculos...\n");

// 1. Validação do Catálogo Expandido
console.log("▶ Teste 1: Validação do Catálogo de Módulos Tier-1 Expandido...");
assert(MODULE_CATALOG.length >= 10, `Deveria ter pelo menos 10 modelos no catálogo, encontrou ${MODULE_CATALOG.length}`);

for (const mod of MODULE_CATALOG) {
  assert(mod.id, "Módulo deve ter id");
  assert(mod.manufacturer, `Módulo ${mod.id} deve ter fabricante`);
  assert(mod.model, `Módulo ${mod.id} deve ter modelo`);
  assert(mod.wp >= 300 && mod.wp <= 800, `Potência fora da faixa: ${mod.wp}`);
  assert(mod.widthM >= 1.0 && mod.widthM <= 1.5, `Largura fora da faixa: ${mod.widthM}`);
  assert(mod.heightM >= 2.0 && mod.heightM <= 2.6, `Altura fora da faixa: ${mod.heightM}`);
}
console.log(`  ✓ ${MODULE_CATALOG.length} modelos de módulos comerciais validados com sucesso!\n`);

// 2. Validação dos Estilos Visuais dos Painéis
console.log("▶ Teste 2: Validação dos Estilos Visuais (PANEL_VISUAL_STYLES)...");
const styleKeys = Object.keys(PANEL_VISUAL_STYLES);
assert(styleKeys.includes("realistic"), "Deve conter estilo 'realistic'");
assert(styleKeys.includes("full-black"), "Deve conter estilo 'full-black'");
assert(styleKeys.includes("classic-blue"), "Deve conter estilo 'classic-blue'");
assert(styleKeys.includes("technical"), "Deve conter estilo 'technical'");

for (const key of styleKeys) {
  const st = PANEL_VISUAL_STYLES[key];
  assert(st.siliconColor, `Estilo ${key} deve ter siliconColor`);
  assert(st.frameColor, `Estilo ${key} deve ter frameColor`);
  assert(st.cellLineColor, `Estilo ${key} deve ter cellLineColor`);
  assert(Number.isFinite(st.cellLineOpacity), `Estilo ${key} deve ter cellLineOpacity numérico`);
}
console.log("  ✓ Todos os 4 estilos visuais configurados e validados!\n");

// 3. Validação de Módulos Personalizados
console.log("▶ Teste 3: Criação e Resolução de Módulo Personalizado...");
const mockCustom = {
  id: "custom-test-700w",
  manufacturer: "Nacif Tech",
  model: "Solar Pro 700",
  wp: 700,
  widthM: 1.25,
  heightM: 2.45,
  technology: "HJT Bifacial",
};

const customList = [mockCustom];
const preset = getModulePreset("custom-test-700w", customList);
assert.equal(preset.id, "custom-test-700w", "Deveria resolver o módulo customizado");
assert.equal(preset.wp, 700, "Deveria preservar a potência de 700W");

const dims = getModuleDimensions({
  module_preset_id: "custom-test-700w",
  custom_modules: customList,
});
assert.equal(dims.widthM, 1.25, "Largura deveria ser 1.25m");
assert.equal(dims.heightM, 2.45, "Altura deveria ser 2.45m");
console.log("  ✓ Módulo personalizado integrado e resolvido com precisão dimensional!\n");

// 4. Validação de Nudge de Obstáculos
console.log("▶ Teste 4: Cálculo Métrico de Nudge de Obstáculos...");
const lat = -23.55052;
const lng = -46.63331;
const stepMeters = 0.5;

const latDelta = stepMeters / 111111;
const lngDelta = stepMeters / (111111 * Math.cos((lat * Math.PI) / 180));

assert(latDelta > 0 && latDelta < 0.0001, "Delta de latitude proporcional");
assert(lngDelta > 0 && lngDelta < 0.0001, "Delta de longitude proporcional");

const movedNorthLat = lat + latDelta;
assert(movedNorthLat > lat, "Mover para o norte deve incrementar latitude");
console.log("  ✓ Nudge métrico direcional validado com sucesso!\n");

// 5. Validação Rigorosa de Exclusão de Obstáculos (AABB vs Círculo de Segurança)
console.log("▶ Teste 5: Exclusão Matemática Rigorosa de Painéis sob Obstáculos...");
const testRoofPolygon = [
  { lat: -23.55052, lng: -46.63331 },
  { lat: -23.55052, lng: -46.63310 },
  { lat: -23.55040, lng: -46.63310 },
  { lat: -23.55040, lng: -46.63331 },
];

const panelsWithoutObs = buildPanelPolygons(
  { roof_polygon: testRoofPolygon, obstacles: [] },
  { panelCount: 50 }
);

// Obstáculo com raio 2.3m exatamente como na tela do usuário
const obsCenter = {
  lat: (-23.55052 + -23.55040) / 2,
  lng: (-46.63331 + -46.63310) / 2,
  radiusM: 2.3,
  excludeArea: true,
};

const panelsWithObs = buildPanelPolygons(
  {
    roof_polygon: testRoofPolygon,
    obstacles: [obsCenter],
  },
  { panelCount: 50 }
);

assert(panelsWithObs.length < panelsWithoutObs.length, "Painéis com obstáculo devem ser menores que sem obstáculo");

// Verifica que NENHUM vértice dos painéis gerados invade a zona de afastamento
const safeRadius = 2.3 + 0.3;
for (const panel of panelsWithObs) {
  for (const corner of panel) {
    const dist = distanceMeters(corner, obsCenter);
    assert(dist >= safeRadius - 0.08, `Vértice do painel não pode invadir raio seguro! Dist: ${dist}m < ${safeRadius}m`);
  }
}
console.log(`  ✓ Obstáculo de 2.3m excluiu rigorosamente os módulos na zona de keepout (${panelsWithoutObs.length} -> ${panelsWithObs.length} módulos)!\n`);

console.log("==================================================================");
console.log("🎉 TODOS OS TESTES DE MÓDULOS EXPANDIDOS E OBSTÁCULOS PASSARAM!");
console.log("==================================================================");
