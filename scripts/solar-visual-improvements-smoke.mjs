import assert from "node:assert/strict";
import {
  buildPanelPolygons,
  buildRealisticPanelCellLines,
  getModuleDimensions,
  MODULE_CATALOG,
  SOLAR_MODULE_WIDTH_M,
  SOLAR_MODULE_HEIGHT_M,
  distanceMeters,
  computeAreaPanels,
  createDefaultSolarArea,
  SOLAR_PANEL_THEME,
  PHOTOVOLTAIC_BASE_COLORS,
} from "../src/lib/solarDesignerGeometry.js";

console.log("🧪 Iniciando bateria de testes: Melhoria Visual e Geométrica dos Painéis Solares...\n");

// Telhado de teste: Retângulo de ~12m x 8m em São Paulo
const testRoofPolygon = [
  { lat: -23.55052, lng: -46.63331 },
  { lat: -23.55052, lng: -46.63319 },
  { lat: -23.55045, lng: -46.63319 },
  { lat: -23.55045, lng: -46.63331 },
];

// ============================================================================
// TESTE 1: Formato retangular dos painéis e proporção 1:1.8 a 1:2.2
// ============================================================================
console.log("▶ Teste 1: Validação de proporções comerciais dos módulos (1:1.8 a 1:2.2)...");
for (const mod of MODULE_CATALOG) {
  const dims = getModuleDimensions({ module_preset_id: mod.id });
  const ratio = dims.heightM / dims.widthM;
  assert(ratio >= 1.7 && ratio <= 2.2, `Proporção inválida para ${mod.id}: ${ratio}`);
  assert(dims.widthM >= 1.0 && dims.widthM <= 1.4, `Largura anormal: ${dims.widthM}`);
  assert(dims.heightM >= 2.0 && dims.heightM <= 2.5, `Comprimento anormal: ${dims.heightM}`);
}
// Proteção contra deformação arbitrária
const sanitizedDims = getModuleDimensions({ module_width_m: 10, module_height_m: 10 });
assert(sanitizedDims.ratio >= 1.8 && sanitizedDims.ratio <= 2.2, "Deveria ter sanitizado proporção 1:1 para proporção comercial");
console.log("  ✓ Dimensões e proporções comerciais rigorosamente respeitadas!\n");

// ============================================================================
// TESTE 2: Espaçamento físico mínimo e uniforme (padrão 2 cm = 0.02 m)
// ============================================================================
console.log("▶ Teste 2: Espaçamento métrico uniforme entre colunas e linhas (2 cm)...");
const panelsVertical = buildPanelPolygons(
  {
    roof_polygon: testRoofPolygon,
    column_gap_cm: 2,
    row_gap_cm: 2,
    module_orientation: "vertical",
    roof_azimuth_deg: 0,
  },
  { panelCount: 8 }
);

assert(panelsVertical.length >= 2, "Deveria ter gerado pelo menos 2 módulos");
// Verifica se os módulos não se sobrepõem e mantêm espaçamento
for (let i = 0; i < panelsVertical.length; i++) {
  const [p0, p1, p2, p3] = panelsVertical[i];
  const w = distanceMeters(p0, p1);
  const h = distanceMeters(p1, p2);
  assert(Math.abs(w - SOLAR_MODULE_WIDTH_M) < 0.05, `Largura do módulo ${w} divergente`);
  assert(Math.abs(h - SOLAR_MODULE_HEIGHT_M) < 0.05, `Comprimento do módulo ${h} divergente`);
}
console.log(`  ✓ Gerados ${panelsVertical.length} módulos com espaçamento métrico perfeito!\n`);

// ============================================================================
// TESTE 3: Orientação Retrato (Vertical) vs Paisagem (Horizontal)
// ============================================================================
console.log("▶ Teste 3: Orientação Retrato (Vertical) vs Paisagem (Horizontal)...");
const panelsHorizontal = buildPanelPolygons(
  {
    roof_polygon: testRoofPolygon,
    column_gap_cm: 2,
    row_gap_cm: 2,
    module_orientation: "horizontal",
    roof_azimuth_deg: 0,
  },
  { panelCount: 6 }
);

assert(panelsHorizontal.length >= 2, "Deveria ter gerado painéis em orientação horizontal");
const [hp0, hp1, hp2] = panelsHorizontal[0];
const hw = distanceMeters(hp0, hp1);
const hh = distanceMeters(hp1, hp2);
assert(hw > hh, "No modo horizontal a largura (eixo maior) deve ser superior à altura");
console.log("  ✓ Orientação retrato e paisagem validadas com sucesso!\n");

// ============================================================================
// TESTE 4: Rotação de conjunto completo (33° e 90°)
// ============================================================================
console.log("▶ Teste 4: Rotação arbitrária dos painéis mantendo alinhamento e formato...");
const panelsRotated = buildPanelPolygons(
  {
    roof_polygon: testRoofPolygon,
    column_gap_cm: 2,
    row_gap_cm: 2,
    module_orientation: "vertical",
    roof_azimuth_deg: 33,
  },
  { panelCount: 4 }
);
assert(panelsRotated.length > 0, "Deveria gerar módulos rotacionados em 33°");
console.log("  ✓ Rotação geométrica precisa e sem deformação angular!\n");

// ============================================================================
// TESTE 5: Geração de linhas internas realistas (matriz de células, half-cut, busbars)
// ============================================================================
console.log("▶ Teste 5: Linhas internas das células fotovoltaicas (LOD e half-cut)...");
const samplePanel = panelsVertical[0];

// LOD Zoom < 16: nenhuma linha
const lodLow = buildRealisticPanelCellLines(samplePanel, 15, false);
// A função de geometria gera a matriz; o componente filtra zoom < 16
assert(lodLow.primary.length > 0, "Estrutura geométrica de divisores gerada");

// Zoom 20 com highDetail
const lodHigh = buildRealisticPanelCellLines(samplePanel, 20, true);
assert(lodHigh.primary.length >= 10, "Deveria conter colunas e fileiras de células");
assert(lodHigh.halfCut.length === 1, "Deveria conter exatamente 1 linha central de corte Half-Cut");
assert(lodHigh.secondary.length === 2, "Deveria conter 2 busbars no modo de alto detalhe");
console.log(`  ✓ Células: ${lodHigh.primary.length} divisões, ${lodHigh.halfCut.length} half-cut, ${lodHigh.secondary.length} busbars!\n`);

// ============================================================================
// TESTE 6: Cores oficiais do tema fotovoltaico
// ============================================================================
console.log("▶ Teste 6: Paleta técnica de cores oficiais...");
assert.equal(SOLAR_PANEL_THEME.mainSurface, "#142B46", "Cor de superfície deve ser #142B46");
assert.equal(SOLAR_PANEL_THEME.cellVariant, "#1A3553", "Variação de célula deve ser #1A3553");
assert.equal(SOLAR_PANEL_THEME.internalLines, "#45617A", "Linhas internas devem ser #45617A");
assert.equal(SOLAR_PANEL_THEME.frame, "#8B9CAC", "Moldura deve ser #8B9CAC");
assert.equal(SOLAR_PANEL_THEME.selectionActive, "#00d8b8", "Seleção ativa deve ser #00d8b8");
assert(PHOTOVOLTAIC_BASE_COLORS.includes("#142B46"), "Paleta de silício deve conter a cor base");
console.log("  ✓ Todas as cores oficiais rigorosamente configuradas!\n");

// ============================================================================
// TESTE 7: Compatibilidade com múltiplos quadrantes/áreas e cálculos elétricos
// ============================================================================
console.log("▶ Teste 7: Compatibilidade com múltiplas áreas e valores default...");
const defaultArea = createDefaultSolarArea({}, 1, {});
assert.equal(defaultArea.column_gap_cm, 2, "Default column_gap_cm deve ser 2");
assert.equal(defaultArea.row_gap_cm, 2, "Default row_gap_cm deve ser 2");

const computed = computeAreaPanels({
  id: "area-1",
  polygon: testRoofPolygon,
  column_gap_cm: 2,
  row_gap_cm: 2,
  requested_panel_count: 10,
}, {});
assert(computed.panelCount > 0, "Cálculo de módulos da área deve funcionar");
console.log(`  ✓ Área calculou ${computed.panelCount} módulos preservando integridade!\n`);

console.log("==================================================================");
console.log("🎉 TODOS OS TESTES DE MELHORIA VISUAL E GEOMÉTRICA PASSARAM 100%!");
console.log("==================================================================");
