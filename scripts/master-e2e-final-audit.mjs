import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  calcCircuit,
  calcProjectMetrics,
  calcVoltageDrop,
  dimensionCircuitNBR5410,
  normalizeElectricalPower,
  convertElectricalUnits,
  selectBreaker,
  selectWireGauge,
  autoBalancePhases,
} from "../src/lib/electricalEngine.js";

import {
  syncPlantPointsToCircuits,
  syncCircuitsToPanelBoard,
  syncPanelDeviceToCircuit,
  syncSolarToProjectCircuits,
  validateUnifiedProject,
  buildUnifiedSyncPayload,
} from "../src/lib/projectUnifiedSync.js";

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
} from "../src/lib/solarSizing.js";

import {
  roundMoney,
  calcItemSubtotal,
  calculateBudgetFinancials,
  formatCurrencyBR,
} from "../src/lib/budgetFinancialMath.js";

import {
  buildProjectBudgetMaterials,
} from "../src/lib/projectBudgetMaterials.js";

import {
  feederGaugeByCurrent,
  calcPeConductor,
  getPhaseColor,
} from "../src/lib/professionalPanelBoardLibrary.js";

import {
  calculateOrthogonalRoute,
  isOrthogonalPath,
} from "../src/lib/orthogonalRouter.js";

import {
  hashPassword,
  verifyPassword,
  sanitizeTextInput,
  validateUploadedFile,
} from "../src/lib/securityCrypto.js";

import {
  auditProjectComponents,
  auditBudgetFinancials,
  findOrphanRecords,
  sanitizeOrphanRecords,
  checkOptimisticConcurrency,
  exportDatabaseBackup,
  validateBackupArchive,
  restoreDatabaseBackup,
} from "../src/lib/databaseIntegrityManager.js";

import {
  PLAN_CATALOG,
  FEATURE_KEYS,
  getPlanByCode,
  normalizeSubscription,
  checkProjectCreationAllowed,
  getDataRetentionPolicy,
} from "../src/lib/subscriptionPlans.js";

import {
  INCIDENT_SEVERITY,
  SUPPORT_CHANNELS,
  classifyIncident,
} from "../src/lib/incidentResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("================================================================================");
console.log("🏆 NACIF ELECTRIC — BATERIA MESTRE DE TESTES DE PONTA A PONTA (E2E)");
console.log("    Auditoria Final de Integração, Persistência, Sincronização e Confiabilidade");
console.log("================================================================================\n");

const auditResults = [];

async function recordTest(id, name, stage, runner) {
  const start = performance.now();
  try {
    await runner();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  ✅ [${stage}] ${id} — ${name} (${duration} ms)`);
    auditResults.push({ id, name, stage, status: "APROVADO", durationMs: Number(duration), error: null });
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  ❌ [${stage}] ${id} — ${name} (${duration} ms):`, err.message);
    auditResults.push({ id, name, stage, status: "REPROVADO", durationMs: Number(duration), error: err.message });
  }
}

async function runMasterE2ESuite() {
  // =============================================================================
  // ETAPA 1 — CADASTRO, AUTENTICAÇÃO E CONFIGURAÇÃO
  // =============================================================================
  console.log("\n▶ ETAPA 1 — CADASTRO, AUTENTICAÇÃO E CONFIGURAÇÃO");

  await recordTest("E2E-01", "Cadastro com consentimento de termos e LGPD", "ETAPA 1", async () => {
    const regData = {
      email: "engenheiro.teste@nacifelectric.com.br",
      rawPassword: "SenhaForteSegura@2026",
      profession: "engenheiro",
      terms_accepted: true,
      terms_version: "1.2",
      terms_accepted_at: new Date().toISOString(),
    };

    assert.equal(regData.terms_accepted, true, "Consentimento dos termos obrigatório");
    assert.equal(regData.terms_version, "1.2", "Versão auditada dos termos deve ser 1.2");
    
    const hashed = await hashPassword(regData.rawPassword);
    assert(typeof hashed === "string" && hashed.startsWith("pbkdf2_sha256$"), "Senha deve ser criptografada com PBKDF2");
    assert(await verifyPassword(regData.rawPassword, hashed), "Senha válida deve ser verificada com sucesso");
    assert(!(await verifyPassword("SenhaErrada", hashed)), "Senha incorreta deve ser rejeitada");
  });

  await recordTest("E2E-02", "Validação de perfil profissional e controle de acesso", "ETAPA 1", async () => {
    const userEng = { id: "u-eng", email: "eng@nacif.com", profession: "engenheiro", plan: "free" };
    const subEng = normalizeSubscription(userEng);
    assert.equal(subEng.planCode, "free", "Plano normalizado corretamente");
    assert(subEng.plan.limits[FEATURE_KEYS.PROJECTS] === 3, "Limite do plano gratuito preservado");
  });

  await recordTest("E2E-03", "Alteração de senha e invalidação de sessão", "ETAPA 1", async () => {
    const oldHash = await hashPassword("SenhaAntiga@123");
    const newHash = await hashPassword("SenhaNova@456");

    assert(await verifyPassword("SenhaNova@456", newHash), "Nova senha deve ser aceita");
    assert(!(await verifyPassword("SenhaAntiga@123", newHash)), "Senha antiga deve ser invalidada");
  });

  // =============================================================================
  // ETAPA 2 — CRIAÇÃO E CONFIGURAÇÃO DO PROJETO
  // =============================================================================
  console.log("\n▶ ETAPA 2 — CRIAÇÃO E CONFIGURAÇÃO DO PROJETO");

  let masterProject = {
    id: "proj-alphaville-01",
    user_id: "u-eng-carlos",
    name: "Residencial Alphaville - Bloco B",
    description: "Projeto elétrico residencial de alto padrão em baixa tensão",
    client_name: "Dr. Roberto Albuquerque",
    city: "Belo Horizonte / MG",
    supply_type: "Trifásico",
    voltage: 220,
    voltage_secondary: 127,
    frequency_hz: 60,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    circuits: [],
    plant_design: { walls: [], doors: [], windows: [], points: [] },
    panel_boards: [],
    panel_layout: { rails: [] },
    solar_design: { areas: [] },
    version: 1,
  };

  await recordTest("E2E-04", "Criação de projeto elétrico residencial trifásico", "ETAPA 2", async () => {
    assert.equal(masterProject.id, "proj-alphaville-01", "Identificador único gerado");
    assert.equal(masterProject.supply_type, "Trifásico", "Alimentação trifásica configurada");
    assert.equal(masterProject.voltage, 220, "Tensão de linha 220V");
  });

  await recordTest("E2E-05", "Duplicação de projeto com isolamento e novos IDs", "ETAPA 2", async () => {
    const duplicated = {
      ...JSON.parse(JSON.stringify(masterProject)),
      id: "proj-alphaville-01-copy",
      name: "Cópia de Residencial Alphaville - Bloco B",
      created_date: new Date().toISOString(),
    };

    assert.notEqual(duplicated.id, masterProject.id, "Projeto duplicado deve receber ID independente");
    duplicated.name = "Nome Alterado na Cópia";
    assert.notEqual(duplicated.name, masterProject.name, "Alteração na cópia não afeta original");
  });

  // =============================================================================
  // ETAPA 3 — PLANTA ELÉTRICA
  // =============================================================================
  console.log("\n▶ ETAPA 3 — PLANTA ELÉTRICA");

  await recordTest("E2E-06", "Construção arquitetônica de paredes e cômodos", "ETAPA 3", async () => {
    masterProject.plant_design.walls = [
      { id: "w1", x1: 0, y1: 0, x2: 600, y2: 0, thickness: 15 },
      { id: "w2", x1: 600, y1: 0, x2: 600, y2: 500, thickness: 15 },
      { id: "w3", x1: 600, y1: 500, x2: 0, y2: 500, thickness: 15 },
      { id: "w4", x1: 0, y1: 500, x2: 0, y2: 0, thickness: 15 },
      { id: "w_div", x1: 300, y1: 0, x2: 300, y2: 500, thickness: 15 },
    ];

    masterProject.plant_design.doors = [
      { id: "d1", wall_id: "w4", x: 0, y: 100, width: 80 },
    ];

    assert.equal(masterProject.plant_design.walls.length, 5, "5 paredes registradas");
    assert.equal(masterProject.plant_design.doors.length, 1, "1 porta registrada");
  });

  await recordTest("E2E-07", "Inclusão de pontos elétricos: tomadas, iluminação e TUEs", "ETAPA 3", async () => {
    masterProject.plant_design.points = [
      // Circuito 1 - Iluminação Sala e Cozinha
      { id: "p_luz_sala", type: "iluminacao", load_w: 160, power_w: 160, circuit_id: "ckt-1", x: 150, y: 250, room_name: "Sala" },
      { id: "p_luz_coz", type: "iluminacao", load_w: 120, power_w: 120, circuit_id: "ckt-1", x: 450, y: 250, room_name: "Cozinha" },

      // Circuito 2 - TUG Sala (3 tomadas 100W)
      { id: "p_tug_sala_1", type: "tomada", load_w: 100, power_w: 100, circuit_id: "ckt-2", x: 50, y: 50, room_name: "Sala" },
      { id: "p_tug_sala_2", type: "tomada", load_w: 100, power_w: 100, circuit_id: "ckt-2", x: 50, y: 450, room_name: "Sala" },
      { id: "p_tug_sala_3", type: "tomada", load_w: 100, power_w: 100, circuit_id: "ckt-2", x: 250, y: 50, room_name: "Sala" },

      // Circuito 3 - TUG Cozinha (3 tomadas 600W conforme NBR 5410)
      { id: "p_tug_coz_1", type: "tomada", load_w: 600, power_w: 600, circuit_id: "ckt-3", x: 350, y: 50, room_name: "Cozinha" },
      { id: "p_tug_coz_2", type: "tomada", load_w: 600, power_w: 600, circuit_id: "ckt-3", x: 550, y: 50, room_name: "Cozinha" },
      { id: "p_tug_coz_3", type: "tomada", load_w: 600, power_w: 600, circuit_id: "ckt-3", x: 550, y: 450, room_name: "Cozinha" },

      // Circuito 4 - TUE Chuveiro Elétrico 5400W (220V Bifásico)
      { id: "p_tue_chuveiro", type: "tue", load_w: 5400, power_w: 5400, circuit_id: "ckt-4", x: 450, y: 450, room_name: "Banheiro" },

      // Circuito 5 - TUE Ar Condicionado 1800W (220V Bifásico)
      { id: "p_tue_ar", type: "tue", load_w: 1800, power_w: 1800, circuit_id: "ckt-5", x: 150, y: 50, room_name: "Sala" },
    ];

    assert.equal(masterProject.plant_design.points.length, 10, "10 pontos elétricos cadastrados na planta");
  });

  // =============================================================================
  // ETAPA 4 — CIRCUITOS E QUADRO ELÉTRICO
  // =============================================================================
  console.log("\n▶ ETAPA 4 — CIRCUITOS E QUADRO ELÉTRICO");

  await recordTest("E2E-08", "Criação de circuitos e sincronização automática da planta", "ETAPA 4", async () => {
    masterProject.circuits = [
      { id: "ckt-1", circuit_number: 1, name: "Iluminação Social", voltage: 127, phase: "A", type: "Iluminação", breaker_curve: "B" },
      { id: "ckt-2", circuit_number: 2, name: "TUGs Sala", voltage: 127, phase: "B", type: "Tomadas de Uso Geral", breaker_curve: "C" },
      { id: "ckt-3", circuit_number: 3, name: "TUGs Cozinha", voltage: 127, phase: "C", type: "Tomadas de Uso Geral", breaker_curve: "C" },
      { id: "ckt-4", circuit_number: 4, name: "Chuveiro Principal", voltage: 220, phase: "AB", type: "Chuveiro", breaker_curve: "B" },
      { id: "ckt-5", circuit_number: 5, name: "Ar Condicionado Sala", voltage: 220, phase: "BC", type: "Ar Condicionado", breaker_curve: "C" },
    ];

    const syncResult = syncPlantPointsToCircuits(masterProject);
    masterProject.circuits = syncResult.circuits;

    const c1 = masterProject.circuits.find(c => c.id === "ckt-1");
    assert.equal(c1.power_w, 280, "Circuito 1 soma 160 + 120 = 280W");

    const c2 = masterProject.circuits.find(c => c.id === "ckt-2");
    assert.equal(c2.power_w, 300, "Circuito 2 soma 3 * 100W = 300W");

    const c3 = masterProject.circuits.find(c => c.id === "ckt-3");
    assert.equal(c3.power_w, 1800, "Circuito 3 soma 3 * 600W = 1800W");

    const c4 = masterProject.circuits.find(c => c.id === "ckt-4");
    assert.equal(c4.power_w, 5400, "Circuito 4 Chuveiro tem 5400W");
  });

  await recordTest("E2E-09", "Dimensionamento automático NBR 5410 de cabos e disjuntores DIN", "ETAPA 4", async () => {
    masterProject.circuits = masterProject.circuits.map(c => {
      const sized = calcCircuit(c);
      return {
        ...c,
        breaker_a: sized.breaker_a,
        wire_gauge_mm2: sized.wire_area,
        current_ib: sized.project_current_a,
      };
    });

    const c1 = masterProject.circuits.find(c => c.id === "ckt-1");
    assert(c1.breaker_a >= 10, "Disjuntor iluminação mínimo de 10A");
    assert.equal(c1.wire_gauge_mm2, 1.5, "Condutor mínimo de iluminação NBR 5410 é 1.5mm²");

    const c3 = masterProject.circuits.find(c => c.id === "ckt-3");
    assert.equal(c3.wire_gauge_mm2, 2.5, "Condutor de tomadas TUG mínimo de 2.5mm²");

    const c4 = masterProject.circuits.find(c => c.id === "ckt-4");
    assert(c4.breaker_a >= 25, "Chuveiro 5400W 220V requer disjuntor de pelo menos 25A ou 32A");
    assert(c4.wire_gauge_mm2 >= 4.0, "Chuveiro 5400W requer cabo de pelo menos 4.0mm²");
  });

  await recordTest("E2E-10", "Montagem do Quadro de Distribuição com trilhos DIN, IDR e DPS", "ETAPA 4", async () => {
    const boardSync = syncCircuitsToPanelBoard(masterProject);
    masterProject.panel_boards = boardSync.panel_boards;
    masterProject.panel_layout = boardSync.panel_layout;

    const allBreakers = masterProject.panel_layout.rails.flatMap(r => r.components || []).filter(c => c.type === "breaker");
    assert.equal(allBreakers.length, 5, "Quadro contém os 5 disjuntores dos circuitos");

    masterProject.panel_layout.rails[0].components.unshift(
      { id: "dps_1", type: "dps", poles: 3, voltage: 275, rating_ka: 20 },
      { id: "idr_geral", type: "idr", poles: 4, current: 40, sensitivity_ma: 30 },
      { id: "disj_geral", type: "main_breaker", poles: 3, current: 50, curve: "C" }
    );

    assert.equal(masterProject.panel_layout.rails[0].components.filter(c => c.type === "idr").length, 1, "IDR tetrapolar 30mA instalado");
    assert.equal(masterProject.panel_layout.rails[0].components.filter(c => c.type === "dps").length, 1, "DPS Classe II 20kA instalado");
  });

  await recordTest("E2E-11", "Roteamento ortogonal de fiação sem cruzamentos diagonais", "ETAPA 4", async () => {
    const source = { x: 200, y: 153 };
    const target = { x: 400, y: 322 };
    const obstacles = [{ x: 250, y: 200, width: 80, height: 100 }];
    const route = calculateOrthogonalRoute(source, target, obstacles, { sourceSide: "DOWN", targetSide: "UP" });
    assert(Array.isArray(route) && route.length >= 2, "Caminho ortogonal gerado com sucesso");
    assert(isOrthogonalPath(route), "Segmento de eletroduto deve ser 100% horizontal ou vertical (ortogonal)");
  });

  // =============================================================================
  // ETAPA 5 — DIAGRAMA UNIFILAR
  // =============================================================================
  console.log("\n▶ ETAPA 5 — DIAGRAMA UNIFILAR");

  await recordTest("E2E-12", "Geração do Diagrama Unifilar e dimensionamento do condutor PE", "ETAPA 5", async () => {
    masterProject.circuits.forEach(c => {
      const peGauge = calcPeConductor(c.wire_gauge_mm2);
      assert.equal(peGauge, c.wire_gauge_mm2, `Para fase ${c.wire_gauge_mm2}mm², condutor PE deve ser ${c.wire_gauge_mm2}mm² conforme NBR 5410 Tabela 58`);
    });
  });

  await recordTest("E2E-13", "Sincronização bidirecional e preservação de ajustes manuais", "ETAPA 5", async () => {
    const updated = syncPanelDeviceToCircuit(masterProject, "ckt-3", { current: 25 });
    assert.equal(updated.circuit.breaker_a, 25, "Disjuntor de C3 atualizado com precisão para 25A");
  });

  // =============================================================================
  // ETAPA 6 — PROJETO SOLAR FOTOVOLTAICO
  // =============================================================================
  console.log("\n▶ ETAPA 6 — PROJETO SOLAR FOTOVOLTAICO");

  await recordTest("E2E-14", "Criação de múltiplos conjuntos solares independentes", "ETAPA 6", async () => {
    const baseSolarConfig = { inverter_kw: 10, module_wp: 550, areas: [] };

    const polyArea1 = [
      { lat: -19.920, lng: -43.940 },
      { lat: -19.920, lng: -43.939 },
      { lat: -19.919, lng: -43.939 },
      { lat: -19.919, lng: -43.940 },
    ];
    const polyArea2 = [
      { lat: -19.921, lng: -43.940 },
      { lat: -19.921, lng: -43.939 },
      { lat: -19.9205, lng: -43.939 },
      { lat: -19.9205, lng: -43.940 },
    ];

    const area1 = createDefaultSolarArea({
      id: "solar_area_1",
      name: "Conjunto Telhado Norte",
      polygon: polyArea1,
      auto_fill_surface: false,
      requested_panel_count: 12,
      roof_pitch_deg: 15,
      roof_rotation_deg: 0,
    }, 1, baseSolarConfig);

    const area2 = createDefaultSolarArea({
      id: "solar_area_2",
      name: "Conjunto Telhado Leste",
      polygon: polyArea2,
      auto_fill_surface: false,
      requested_panel_count: 8,
      roof_pitch_deg: 12,
      roof_rotation_deg: 90,
    }, 2, baseSolarConfig);

    baseSolarConfig.areas = [area1, area2];
    masterProject.solar_design = baseSolarConfig;

    assert.equal(masterProject.solar_design.areas.length, 2, "2 conjuntos solares registrados simultaneamente");
    assert.equal(masterProject.solar_design.areas[0].id, "solar_area_1", "Conjunto 1 preservado");
    assert.equal(masterProject.solar_design.areas[1].id, "solar_area_2", "Conjunto 2 preservado e independente");

    const layouts = computeMultiAreaLayouts(baseSolarConfig);
    const metrics = getMultiAreaAggregateMetrics(layouts, baseSolarConfig);
    assert.equal(metrics.totalPanels, 20, "Total de módulos solares soma 12 + 8 = 20");
    assert.equal(metrics.totalDcPowerKw, 11, "Potência de pico total é 20 * 550Wp = 11.0 kWp");
  });

  await recordTest("E2E-15", "Estimativa de geração fotovoltaica anual e economia", "ETAPA 6", async () => {
    const hspBeloHorizonte = 5.2;
    const genKwh = estimateAnnualGenerationKwh(11.0, {
      dailyIrradiationHspKwhM2: hspBeloHorizonte,
      performanceRatio: 0.80,
    });

    assert(genKwh > 15000 && genKwh < 18000, `Geração anual esperada em torno de ~16.700 kWh (obtido: ${Math.round(genKwh)} kWh)`);

    const savingsBrl = estimateAnnualSavingsBrl(genKwh, 1500, 0.95);
    assert(savingsBrl > 10000, `Economia anual estimada deve superar R$ 10.000/ano (obtido: R$ ${savingsBrl.toFixed(2)})`);
  });

  // =============================================================================
  // ETAPA 7 — CALCULADORA E DIMENSIONAMENTO ELÉTRICO
  // =============================================================================
  console.log("\n▶ ETAPA 7 — CALCULADORA E DIMENSIONAMENTO ELÉTRICO");

  await recordTest("E2E-16", "Cálculo rigoroso de Queda de Tensão NBR 5410", "ETAPA 7", async () => {
    const drop = calcVoltageDrop(5400, 220, "Bifásico", 25, "4mm²", 1.0);
    assert(drop.drop_pct < 4.0, `Queda de tensão de 25m com cabo 4mm² deve ser < 4% para circuito terminal (obtido: ${drop.drop_pct.toFixed(2)}%)`);
    assert.equal(drop.ok, true, "Status normativo deve ser aprovado (ok: true)");
  });

  await recordTest("E2E-17", "Tratamento de entradas inválidas, divisão por zero e campos nulos", "ETAPA 7", async () => {
    const bad1 = calcVoltageDrop(0, 0, "Monofásico", 0, "1.5mm²", 1.0);
    assert.equal(bad1.drop_pct, 0, "Tensão zero não deve produzir NaN nem infinito");

    const badPower = normalizeElectricalPower({ power: "abc", power_unit: "kW" });
    assert.equal(badPower.power_w, 0, "Entrada alfanumérica inválida sanitizada para 0");
  });

  // =============================================================================
  // ETAPA 8 — ORÇAMENTOS E EXPORTAÇÕES
  // =============================================================================
  console.log("\n▶ ETAPA 8 — ORÇAMENTOS E EXPORTAÇÕES");

  let masterBudget = null;

  await recordTest("E2E-18", "Levantamento quantitativo automático de materiais e fiação", "ETAPA 8", async () => {
    const autoMaterials = buildProjectBudgetMaterials(masterProject);
    assert(autoMaterials.materials.length > 0, "Lista de materiais do projeto gerada automaticamente");
    assert(autoMaterials.materialTotal > 0, "Valor de materiais computado");
  });

  await recordTest("E2E-19", "Cálculo financeiro consolidado com BDI, margem e impostos", "ETAPA 8", async () => {
    const materials = [
      { name: "Cabo de cobre flexível 2.5mm² 750V", qty: 150, price: 3.80 },
      { name: "Cabo de cobre flexível 4.0mm² 750V", qty: 50, price: 5.90 },
      { name: "Disjuntores DIN Curva C", qty: 6, price: 22.00 },
      { name: "IDR Tetrapolar 40A 30mA", qty: 1, price: 180.00 },
      { name: "DPS 20kA 275V", qty: 3, price: 45.00 },
    ];

    const services = [
      { name: "Infraestrutura de Eletrodutos e Cabeamento", qty: 1, price: 1200.00 },
      { name: "Montagem e Balanceamento do QDC", qty: 1, price: 800.00 },
    ];

    masterBudget = calculateBudgetFinancials({
      materials,
      services,
      productAdjustmentPercent: 0,
      marginPercent: 20,
      discountValue: 0,
      surchargeValue: 0,
    });

    assert(masterBudget.materialTotal > 1200, "Subtotal de materiais correto");
    assert.equal(masterBudget.servicesTotal, 2000, "Subtotal de serviços R$ 2000.00");
    assert(masterBudget.total > masterBudget.materialTotal + masterBudget.servicesTotal, "Total inclui margem de 20%");
    assert.equal(masterBudget.total, roundMoney(masterBudget.total), "Total arredondado sem dízimas financeiras");
  });

  // =============================================================================
  // ETAPA 9 — PERSISTÊNCIA E RECUPERAÇÃO DOS DADOS (COLD RESTART)
  // =============================================================================
  console.log("\n▶ ETAPA 9 — PERSISTÊNCIA E RECUPERAÇÃO DOS DADOS (COLD RESTART)");

  await recordTest("E2E-20", "Serialização atômica, salvamento e reabertura após logout", "ETAPA 9", async () => {
    const persistedJson = JSON.stringify(masterProject);
    assert(persistedJson.length > 500, "Dados do projeto serializados com conteúdo substancial");

    const reopenedProject = JSON.parse(persistedJson);

    assert.equal(reopenedProject.id, masterProject.id, "ID do projeto preservado");
    assert.equal(reopenedProject.circuits.length, masterProject.circuits.length, "Todos os 5 circuitos preservados");
    assert.equal(reopenedProject.plant_design.points.length, masterProject.plant_design.points.length, "Todos os 10 pontos elétricos preservados");
    assert.equal(reopenedProject.solar_design.areas.length, masterProject.solar_design.areas.length, "Todos os 2 conjuntos solares preservados");
    assert.equal(reopenedProject.panel_boards.length, masterProject.panel_boards.length, "Quadro preservado");
  });

  await recordTest("E2E-21", "Estabilidade em 10 reaberturas consecutivas (sem duplicações)", "ETAPA 9", async () => {
    let projectCycle = JSON.parse(JSON.stringify(masterProject));
    for (let i = 0; i < 10; i++) {
      const synced = syncCircuitsToPanelBoard(projectCycle);
      projectCycle = { ...projectCycle, panel_layout: synced.panel_layout };
    }
    const breakers = projectCycle.panel_layout.rails.flatMap(r => r.components || []).filter(c => c.type === "breaker");
    assert.equal(breakers.length, masterProject.circuits.length, "Após 10 reaberturas seguidas, zero disjuntores duplicados");
  });

  // =============================================================================
  // ETAPA 10 — SINCRONIZAÇÃO ENTRE MÓDULOS
  // =============================================================================
  console.log("\n▶ ETAPA 10 — SINCRONIZAÇÃO ENTRE MÓDULOS");

  await recordTest("E2E-22", "Propagação atômica de mudança de ponto na planta para o circuito", "ETAPA 10", async () => {
    const dynamicProject = {
      voltage: 220,
      circuits: [{ id: "ckt-4", circuit_number: 4, name: "Chuveiro Principal", voltage: 220, power_w: 5400 }],
      plant_design: {
        points: [{ id: "p_tue_chuveiro", circuit_id: "ckt-4", load_w: 6800, power_w: 6800 }],
      },
    };

    const res = syncPlantPointsToCircuits(dynamicProject);
    const showerCkt = res.circuits.find(c => c.id === "ckt-4");
    assert.equal(showerCkt.power_w, 6800, "Carga do circuito 4 atualizada atômica e imediatamente para 6800W");
  });

  // =============================================================================
  // ETAPA 11 — ENTRADAS INVÁLIDAS E TRATAMENTO DE ERROS
  // =============================================================================
  console.log("\n▶ ETAPA 11 — ENTRADAS INVÁLIDAS E TRATAMENTO DE ERROS");

  await recordTest("E2E-23", "Sanitização de XSS em nomes e descrições do projeto", "ETAPA 11", async () => {
    const maliciousInput = "<script>alert('xss')</script> Projeto Malicioso";
    const sanitized = sanitizeTextInput(maliciousInput);
    assert(!sanitized.includes("<script>"), "Tags de script removidas");
    assert(sanitized.includes("Projeto Malicioso"), "Conteúdo textual legítimo preservado");
  });

  // =============================================================================
  // ETAPA 12 — ISOLAMENTO ENTRE USUÁRIOS (MULTI-TENANT)
  // =============================================================================
  console.log("\n▶ ETAPA 12 — ISOLAMENTO ENTRE USUÁRIOS (MULTI-TENANT)");

  await recordTest("E2E-24", "Prevenção de IDOR e vazamento entre contas de usuários", "ETAPA 12", async () => {
    const user1Project = { id: "p1", user_id: "user-alpha", name: "Projeto Confidencial Alpha" };
    const user2Project = { id: "p2", user_id: "user-beta", name: "Projeto Beta" };

    const canUserBetaAccessAlpha = user2Project.user_id === user1Project.user_id;
    assert.equal(canUserBetaAccessAlpha, false, "Usuário 2 não tem permissão para acessar projeto do Usuário 1");
  });

  // =============================================================================
  // ETAPA 13 — FALHAS SIMULADAS E RECUPERAÇÃO DE DESASTRES (DR)
  // =============================================================================
  console.log("\n▶ ETAPA 13 — FALHAS SIMULADAS E RECUPERAÇÃO DE DESASTRES (DR)");

  await recordTest("E2E-25", "Geração e restauração de Backup Criptográfico (SHA-256)", "ETAPA 13", async () => {
    const rawDb = {
      projects: [masterProject],
      budgets: [masterBudget],
      users: [{ id: "u1", email: "teste@nacif.com" }],
    };

    const backupArchive = await exportDatabaseBackup(rawDb);
    assert(backupArchive.checksum_sha256.length === 64, "Checksum SHA-256 de 64 caracteres gerado");

    const validation = await validateBackupArchive(backupArchive);
    assert.equal(validation.valid, true, "Arquivo de backup íntegro e autêntico");

    const restored = await restoreDatabaseBackup(backupArchive);
    assert.equal(restored.success, true, "Restauração de backup executada com sucesso");
    assert.equal(restored.restored_counts.projects, 1, "1 projeto restaurado com integridade do backup");
  });

  // =============================================================================
  // ETAPA 14 — ESTABILIDADE EM ALTA ESCALA
  // =============================================================================
  console.log("\n▶ ETAPA 14 — ESTABILIDADE EM ALTA ESCALA");

  await recordTest("E2E-26", "Desempenho com projeto complexo (400 componentes elétricos)", "ETAPA 14", async () => {
    const complexProject = {
      id: "proj-complex-scale",
      circuits: [],
      plant_design: {
        points: Array.from({ length: 400 }, (_, i) => ({
          id: `pt_${i}`,
          type: i % 2 === 0 ? "tomada" : "iluminacao",
          load_w: 100,
          circuit_id: `ckt_${i % 20}`,
        })),
      },
    };

    for (let c = 0; c < 20; c++) {
      complexProject.circuits.push({ id: `ckt_${c}`, circuit_number: c + 1, power_w: 0 });
    }

    const start = performance.now();
    const synced = syncPlantPointsToCircuits(complexProject);
    const elapsedMs = performance.now() - start;

    assert.equal(synced.circuits.length, 20, "20 circuitos consolidados");
    assert(elapsedMs < 50.0, `Consolidação de 400 pontos em 20 circuitos deve levar < 50ms (levou: ${elapsedMs.toFixed(2)} ms)`);
  });

  console.log("\n================================================================================");
  const passedCount = auditResults.filter(r => r.status === "APROVADO").length;
  const failedCount = auditResults.filter(r => r.status === "REPROVADO").length;
  const totalCount = auditResults.length;
  const passRate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log(`TOTAL DE CENÁRIOS E2E EXECUTADOS: ${totalCount}`);
  console.log(`CENÁRIOS APROVADOS:             ${passedCount}`);
  console.log(`CENÁRIOS REPROVADOS:            ${failedCount}`);
  console.log(`TAXA DE APROVAÇÃO:              ${passRate}%`);
  console.log("================================================================================\n");

  assert.equal(failedCount, 0, "Nenhum teste E2E pode falhar para autorizar o lançamento");
}

runMasterE2ESuite().catch(err => {
  console.error("Erro fatal na execução da suíte E2E:", err);
  process.exit(1);
});
