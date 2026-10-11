import assert from "node:assert/strict";
import {
  fetchGoogleBuildingInsights,
  convertGoogleSegmentsToSolarAreas,
  getGoogleApiKey,
  getCardinalDirection,
} from "../src/lib/googleSolarApi.js";
import {
  calculateStringGrouping,
  getPolygonAreaSquareMeters,
  computeRoofFaceTechnicalAnalysis,
  normalizeSolarAreas,
  createDefaultSolarArea,
  INVERTER_CATALOG,
  getInverterPreset,
} from "../src/lib/solarDesignerGeometry.js";
import {
  syncSolarToProjectCircuits,
} from "../src/lib/projectUnifiedSync.js";

console.log("🧪 Iniciando bateria de testes do Módulo Solar 2D/3D Profissional...");

// =========================================================================
// TESTE 1: Google Solar API - Verificação de Credencial e Fallback Gracioso
// =========================================================================
console.log("▶ Teste 1: Google Solar API (Detecção de chave e fallback seguro)...");
const apiKey = getGoogleApiKey();
assert.equal(typeof apiKey, "string", "Chave deve ser string");

// Sem chave ou com chave ausente, deve retornar objeto informativo sem quebrar
const fallbackResult = await fetchGoogleBuildingInsights({ lat: -23.55052, lng: -46.63331 });
assert.ok(fallbackResult, "Resultado não pode ser nulo");
assert.equal(typeof fallbackResult.available, "boolean", "Campo available deve ser booleano");
assert.ok(Array.isArray(fallbackResult.roofSegments), "roofSegments deve ser array");
assert.ok(typeof fallbackResult.message === "string", "Mensagem explicativa deve ser string");
console.log("  ✓ Teste 1 aprovado com sucesso!");

// =========================================================================
// TESTE 2: Google Solar API - Conversão de Segmentos de Telhado em Áreas Solares
// =========================================================================
console.log("▶ Teste 2: Conversão de segmentos Google Solar em áreas editáveis...");
const mockGoogleSegments = [
  {
    id: "seg_1",
    name: "Água Norte",
    pitchDeg: 15,
    azimuthDeg: 350,
    areaM2: 52.4,
    polygon: [
      { lat: -23.55, lng: -46.63 },
      { lat: -23.55, lng: -46.631 },
      { lat: -23.551, lng: -46.631 },
      { lat: -23.551, lng: -46.63 },
    ],
  },
  {
    id: "seg_2",
    name: "Água Sul",
    pitchDeg: 18,
    azimuthDeg: 175,
    areaM2: 44.0,
    polygon: [
      { lat: -23.551, lng: -46.63 },
      { lat: -23.551, lng: -46.631 },
      { lat: -23.552, lng: -46.631 },
      { lat: -23.552, lng: -46.63 },
    ],
  },
];
const convertedAreas = convertGoogleSegmentsToSolarAreas(mockGoogleSegments);
assert.equal(convertedAreas.length, 2, "Deve converter exatamente os 2 segmentos");
assert.equal(convertedAreas[0].roof_pitch_deg, 15, "Inclinação da água 1 deve ser 15°");
assert.equal(convertedAreas[0].roof_rotation_deg, 350, "Azimute da água 1 deve ser 350°");
assert.equal(convertedAreas[0].source, "google_solar_api", "Origem deve ser identificada");
console.log("  ✓ Teste 2 aprovado com sucesso!");

// =========================================================================
// TESTE 3: Cálculo Cardeal de Azimute (0° = Norte, 90° = Leste, 180° = Sul, 270° = Oeste)
// =========================================================================
console.log("▶ Teste 3: Cálculo e rótulo cardeal de azimute...");
assert.equal(getCardinalDirection(0), "Norte");
assert.equal(getCardinalDirection(90), "Leste");
assert.equal(getCardinalDirection(180), "Sul");
assert.equal(getCardinalDirection(270), "Oeste");
assert.equal(getCardinalDirection(330), "Noroeste");
assert.equal(getCardinalDirection(45), "Nordeste");
console.log("  ✓ Teste 3 aprovado com sucesso!");

// =========================================================================
// TESTE 4: Dimensionamento e Validação de Strings NBR 16690 (Tmin e Tcell)
// =========================================================================
console.log("▶ Teste 4: Dimensionamento térmico de strings com Voc(Tmin) e Vmp(Tcell)...");
const testPanelCount = 24; // 2 strings de 12 módulos
const strings = calculateStringGrouping(testPanelCount, {
  moduleWp: 550,
  inverterKw: 10,
  vocModuleV: 49.8,
  vmpModuleV: 41.5,
  minTempC: 5, // Temperatura mínima crítica 5°C
  maxCellTempC: 70, // Temperatura máxima da célula 70°C
  maxInverterDcVoltageV: 1000,
  minMpptVoltageV: 160,
  maxMpptVoltageV: 800,
});
assert.equal(strings.length, 2, "24 módulos devem ser divididos em 2 strings");
assert.equal(strings[0].moduleCount, 12, "Cada string deve ter 12 módulos");
assert.ok(strings[0].vocColdV > strings[0].vocV, "Voc em temperatura fria (5°C) deve ser maior que Voc STC (25°C)");
assert.ok(strings[0].vmpHotV < strings[0].vmpV, "Vmp em temperatura quente (70°C) deve ser menor que Vmp STC (25°C)");
assert.ok(strings[0].isVocSafe, "Voc no frio (12 * ~52.5V = ~630V) deve ser seguro para inversor de 1000V");
assert.ok(strings[0].isMpptSafe, "Vmp no calor deve estar dentro da janela MPPT");
assert.ok(strings[0].isCompatible, "String deve estar 100% compatível");
console.log("  ✓ Teste 4 aprovado com sucesso!");

// =========================================================================
// TESTE 5: Integração Solar com Circuito CA e Disjuntor no Quadro DIN
// =========================================================================
console.log("▶ Teste 5: Sincronização do inversor com circuitos e quadro DIN...");
const baseProject = {
  id: "proj_solar_sync_test",
  project_type: "Solar",
  solar_config: {
    inverter_power_kw: 8.0,
    ac_voltage: 220,
    ac_supply_type: "Bifásico",
  },
  circuits: [],
};
const syncResult = syncSolarToProjectCircuits(baseProject);
assert.ok(syncResult.solarCircuit, "Gera o circuito solar do inversor");
assert.equal(syncResult.solarCircuit.power_w, 8000, "Potência CA de 8000W");
assert.equal(syncResult.solarCircuit.breaker_poles, 2, "Bifásico requer 2 polos");
assert.ok(syncResult.solarCircuit.breaker_a >= 40, "Disjuntor dimensionado com margem >= 40A");
assert.ok(syncResult.project.panel_layout.rails.flatMap(r => r.components || []).some(c => c.circuit_id === "ckt_solar_inverter"), "Disjuntor posicionado nos trilhos DIN");
console.log("  ✓ Teste 5 aprovado com sucesso!");

// =========================================================================
// TESTE 6: Cálculo de Área Projetada vs Área Inclinada Real
// =========================================================================
console.log("▶ Teste 6: Cálculo de área geométrica e análise técnica...");
const polySquare = [
  { lat: -23.5500, lng: -46.6300 },
  { lat: -23.5500, lng: -46.6301 },
  { lat: -23.5501, lng: -46.6301 },
  { lat: -23.5501, lng: -46.6300 },
];
const areaM2 = getPolygonAreaSquareMeters(polySquare);
assert.ok(areaM2 > 0, "Área projetada deve ser positiva");
const techAnalysis = computeRoofFaceTechnicalAnalysis(polySquare, { roof_pitch_deg: 20 });
assert.ok(techAnalysis, "Análise técnica deve retornar dados de orientação e HSP");
assert.ok(techAnalysis.effectiveHsp > 0, "HSP efetivo deve ser positivo");
assert.ok(techAnalysis.realTiltedAreaM2 > techAnalysis.projectedAreaM2, "Área inclinada real (20°) deve ser estritamente maior que a área projetada no solo");
console.log("  ✓ Teste 6 aprovado com sucesso!");

// =========================================================================
// TESTE 7: Catálogo de Inversores Fotovoltaicos Reais
// =========================================================================
console.log("▶ Teste 7: Catálogo de inversores fotovoltaicos reais com MPPT...");
assert.ok(Array.isArray(INVERTER_CATALOG) && INVERTER_CATALOG.length >= 5, "Catálogo deve conter múltiplos inversores reais");
const growatt = getInverterPreset("growatt-min-5000tl-x");
assert.equal(growatt.kw, 5.0, "Growatt 5.0 kW");
assert.equal(growatt.mpptCount, 2, "2 MPPTs");
assert.ok(growatt.minMpptV < growatt.maxMpptV, "Janela MPPT válida");
const weg = getInverterPreset("weg-siw500-10k");
assert.equal(weg.kw, 10.0, "WEG 10 kW");
console.log("  ✓ Teste 7 aprovado com sucesso!");

console.log("\n========================================================");
console.log("🎉 TODOS OS TESTES DO MÓDULO SOLAR FORAM APROVADOS COM SUCESSO!");
console.log("========================================================\n");
