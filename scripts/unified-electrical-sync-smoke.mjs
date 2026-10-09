import assert from "node:assert/strict";
import {
  syncPlantPointsToCircuits,
  syncCircuitsToPanelBoard,
  syncPanelDeviceToCircuit,
  syncSolarToProjectCircuits,
  validateUnifiedProject,
  buildUnifiedSyncPayload,
} from "../src/lib/projectUnifiedSync.js";
import { calcCircuit, calcProjectMetrics } from "../src/lib/electricalEngine.js";

console.log("🧪 Iniciando bateria de testes obrigatórios do Motor de Sincronização Unificada...");

// =========================================================================
// CENÁRIO A: Inclusão de ponto na planta e atualização de carga
// =========================================================================
console.log("▶ Teste A: Inclusão de ponto na planta e soma de cargas...");
const projA = {
  id: "proj-a",
  supply_type: "Trifásico",
  voltage: 220,
  circuits: [
    { id: "c1", circuit_number: 1, name: "C1 - Iluminação", power_w: 200, voltage: 127, supply_type: "Monofásico", phase: "A" }
  ],
  plant_design: {
    points: [
      { id: "p1", type: "iluminacao", load_w: 100, circuit_id: "c1", room_name: "Sala" },
      { id: "p2", type: "iluminacao", load_w: 150, circuit_id: "c1", room_name: "Cozinha" }
    ]
  }
};
const resA = syncPlantPointsToCircuits(projA);
const c1A = resA.circuits.find(c => c.id === "c1");
assert.equal(c1A.power_w, 250, "Carga de C1 deve ser a soma dos pontos (100 + 150 = 250W)");
assert.equal(c1A.point_count, 2, "Contagem de pontos deve ser 2");
console.log("  ✓ Teste A aprovado com sucesso!");

// =========================================================================
// CENÁRIO B: Mover ponto de C1 para C2
// =========================================================================
console.log("▶ Teste B: Mover ponto de C1 para C2 (recálculo atômico)...");
const projB = {
  id: "proj-b",
  supply_type: "Trifásico",
  voltage: 220,
  circuits: [
    { id: "c1", circuit_number: 1, name: "C1 - Iluminação", power_w: 250, voltage: 127, supply_type: "Monofásico", phase: "A" },
    { id: "c2", circuit_number: 2, name: "C2 - Tomadas", power_w: 1000, voltage: 127, supply_type: "Monofásico", phase: "B" }
  ],
  plant_design: {
    points: [
      { id: "p1", type: "iluminacao", load_w: 100, circuit_id: "c1", room_name: "Sala" },
      // p2 foi movido de c1 para c2:
      { id: "p2", type: "tomada", load_w: 150, circuit_id: "c2", room_name: "Cozinha" }
    ]
  }
};
const resB = syncPlantPointsToCircuits(projB);
const c1B = resB.circuits.find(c => c.id === "c1");
const c2B = resB.circuits.find(c => c.id === "c2");
assert.equal(c1B.power_w, 100, "C1 deve conter apenas p1 (100W)");
assert.equal(c2B.power_w, 150, "C2 deve conter p2 (150W)");
console.log("  ✓ Teste B aprovado com sucesso!");

// =========================================================================
// CENÁRIO C: Geração assistida do quadro a partir dos circuitos
// =========================================================================
console.log("▶ Teste C: Geração do quadro a partir de 4 circuitos...");
const projC = {
  id: "proj-c",
  circuits: [
    { id: "c1", circuit_number: 1, name: "C1 - Iluminação", breaker_a: 10, breaker_curve: "B", breaker_poles: 1, phase: "A" },
    { id: "c2", circuit_number: 2, name: "C2 - Tomadas Quartos", breaker_a: 16, breaker_curve: "C", breaker_poles: 1, phase: "B" },
    { id: "c3", circuit_number: 3, name: "C3 - Tomadas Cozinha", breaker_a: 20, breaker_curve: "C", breaker_poles: 1, phase: "C" },
    { id: "c4", circuit_number: 4, name: "C4 - Chuveiro", breaker_a: 32, breaker_curve: "B", breaker_poles: 2, phase: "AB" }
  ]
};
const resC = syncCircuitsToPanelBoard(projC);
const allCompsC = resC.panel_layout.rails.flatMap(r => r.components || []).filter(c => c.type === "breaker");
assert.equal(allCompsC.length, 4, "Quadro deve conter exatamente os 4 disjuntores");
const showerComp = allCompsC.find(c => c.circuit_id === "c4");
assert.equal(showerComp.current, 32, "Disjuntor C4 deve ter 32A");
assert.equal(showerComp.poles, 2, "Disjuntor C4 deve ter 2 polos");
console.log("  ✓ Teste C aprovado com sucesso!");

// =========================================================================
// CENÁRIO D: Sincronização repetida (idempotência garantida)
// =========================================================================
console.log("▶ Teste D: 10 sincronizações consecutivas sem duplicatas...");
let projD = { ...projC, panel_boards: resC.panel_boards, panel_layout: resC.panel_layout };
for (let i = 0; i < 10; i++) {
  const syncLoop = syncCircuitsToPanelBoard(projD);
  projD = { ...projD, panel_boards: syncLoop.panel_boards, panel_layout: syncLoop.panel_layout };
}
const allCompsD = projD.panel_layout.rails.flatMap(r => r.components || []).filter(c => c.type === "breaker");
assert.equal(allCompsD.length, 4, "Após 10 sincronizações seguidas, continua com exatamente 4 disjuntores");
console.log("  ✓ Teste D aprovado com sucesso!");

// =========================================================================
// CENÁRIO E: Alteração manual de disjuntor no quadro propagando para circuito
// =========================================================================
console.log("▶ Teste E: Alteração manual no quadro com auditoria NBR 5410...");
const projE = {
  id: "proj-e",
  voltage: 127,
  circuits: [
    { id: "c1", circuit_number: 1, name: "C1 - Chuveiro", power_w: 5500, voltage: 127, supply_type: "Monofásico", phase: "A", breaker_a: 50 }
  ]
};
// Usuário alterou manualmente o disjuntor de 50A para 20A no quadro (subdimensionado para 5500W @ 127V = 43.3A!)
const resE = syncPanelDeviceToCircuit(projE, "c1", { current: 20 });
assert.equal(resE.circuit.breaker_a, 20, "Corrente deve ser atualizada para 20A");
assert.equal(resE.circuit.validation_status, "incompatible", "Deve ser marcado como incompatível");
assert.ok(resE.circuit.validation_message.includes("inferior"), "Mensagem deve alertar sobre disjuntor inferior à corrente de projeto");
console.log("  ✓ Teste E aprovado com sucesso!");

// =========================================================================
// CENÁRIO F: Exclusão de ponto e atualização de cargas
// =========================================================================
console.log("▶ Teste F: Exclusão de ponto da planta sem remover o circuito...");
const projF = {
  id: "proj-f",
  circuits: [
    { id: "c1", circuit_number: 1, name: "C1", power_w: 300 }
  ],
  plant_design: {
    // Originalmente tinha p1 (100W) e p2 (200W). p2 foi deletado, restando apenas p1:
    points: [
      { id: "p1", type: "tomada", load_w: 100, circuit_id: "c1" }
    ]
  }
};
const resF = syncPlantPointsToCircuits(projF);
assert.equal(resF.circuits.find(c => c.id === "c1").power_w, 100, "Carga deve cair para 100W");
assert.equal(resF.circuits.length, 1, "Circuito C1 é preservado");
console.log("  ✓ Teste F aprovado com sucesso!");

// =========================================================================
// CENÁRIO G: Persistência e integridade referencial de IDs
// =========================================================================
console.log("▶ Teste G: Preservação de IDs e relacionamentos referenciados...");
const fullSyncG = buildUnifiedSyncPayload(projC);
assert.ok(fullSyncG.circuits.every(c => Boolean(c.id)), "Todos os circuitos possuem IDs");
assert.ok(fullSyncG.panel_layout.rails.every(r => Boolean(r.id)), "Todos os trilhos possuem IDs");
console.log("  ✓ Teste G aprovado com sucesso!");

// =========================================================================
// CENÁRIO H: Compatibilidade com projetos legados sem campos novos
// =========================================================================
console.log("▶ Teste H: Projeto legado sem panel_boards nem plant_design...");
const legacyProj = {
  id: "legacy-1",
  circuits: [
    { name: "C1", power_w: 1200 }
  ]
};
const resH = buildUnifiedSyncPayload(legacyProj);
assert.ok(Array.isArray(resH.panel_boards), "Gera panel_boards para projeto legado");
assert.equal(resH.circuits.length, 1, "Mantém circuito legado");
console.log("  ✓ Teste H aprovado com sucesso!");

// =========================================================================
// CENÁRIO I: Multi-quadros e preservação de outros quadros
// =========================================================================
console.log("▶ Teste I: Preservação de quadros secundários e múltiplos trilhos...");
const multiBoardProj = {
  id: "multi-proj",
  panel_boards: [
    { id: "board-principal", name: "QGBT", layout: { rails: [{ id: "r1", name: "T1", components: [] }] } },
    { id: "board-andar-1", name: "QD Pavimento 1", layout: { rails: [{ id: "r2", name: "T1", components: [] }] } }
  ],
  circuits: [{ id: "c1", name: "C1", breaker_a: 16 }]
};
const resI = syncCircuitsToPanelBoard(multiBoardProj);
assert.equal(resI.panel_boards.length, 2, "Mantém os 2 quadros intactos");
assert.ok(resI.panel_boards.some(b => b.id === "board-andar-1"), "Quadro secundário preservado");
console.log("  ✓ Teste I aprovado com sucesso!");

// =========================================================================
// CENÁRIO J: Preservação de conexões e rotas de fios existentes
// =========================================================================
console.log("▶ Teste J: Preservação de rotas ortogonais de fiação...");
const projJ = {
  id: "proj-j",
  circuits: [{ id: "c1", name: "C1", breaker_a: 16 }],
  panel_layout: {
    rails: [{
      id: "r1",
      name: "T1",
      components: [{ id: "comp_c1", circuit_id: "c1", type: "breaker", poles: 1, current: 16 }]
    }],
    wires: [{
      id: "wire_c1",
      source: "busbar_phase_A:0",
      target: "comp:comp_c1:top:0",
      route: { mode: "orthogonal", points: [{ x: 100, y: 100 }, { x: 200, y: 200 }] }
    }]
  }
};
const resJ = syncCircuitsToPanelBoard(projJ);
assert.equal(resJ.panel_layout.wires.length, 1, "Fio existente é preservado");
assert.equal(resJ.panel_layout.wires[0].route.points.length, 2, "Pontos ortogonais são preservados");
console.log("  ✓ Teste J aprovado com sucesso!");

// =========================================================================
// CENÁRIO K: Projeto solar atualizando circuito CA e disjuntor do inversor
// =========================================================================
console.log("▶ Teste K: Integração solar (inversor gerando circuito CA e disjuntor)...");
const projK = {
  id: "proj-k",
  project_type: "Solar",
  solar_config: {
    inverter_power_kw: 6,
    ac_voltage: 220,
    ac_supply_type: "Bifásico"
  },
  circuits: []
};
const resK = syncSolarToProjectCircuits(projK);
assert.ok(resK.solarCircuit, "Gera circuito solar do inversor");
assert.equal(resK.solarCircuit.power_w, 6000, "Potência CA de 6000W");
assert.ok(resK.solarCircuit.breaker_a >= 32, "Disjuntor dimensionado com folga normativa (>= 32A)");
assert.ok(resK.project.panel_layout.rails.flatMap(r => r.components || []).some(c => c.circuit_id === "ckt_solar_inverter"), "Disjuntor do inversor inserido no quadro");
console.log("  ✓ Teste K aprovado com sucesso!");

// =========================================================================
// CENÁRIO L: Condições incompletas e exibição de pendências normativas
// =========================================================================
console.log("▶ Teste L: Detecção de pendências técnicas e pontos órfãos...");
const projL = {
  id: "proj-l",
  circuits: [],
  plant_design: {
    points: [
      { id: "p1", type: "tomada", load_w: 100 } // sem circuit_id!
    ]
  }
};
const valL = validateUnifiedProject(projL);
assert.equal(valL.valid, true, "Sem erros críticos de bloqueio");
assert.ok(valL.issues.some(i => i.id === "unlinked-plant-points"), "Detecta ponto sem circuito atribuído");
console.log("  ✓ Teste L aprovado com sucesso!");

console.log("\n🎉 TODOS OS 12 CENÁRIOS DE SINCRONIZAÇÃO UNIFICADA FORAM EXECUTADOS E APROVADOS COM SUCESSO!");
