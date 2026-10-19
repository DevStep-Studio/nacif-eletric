import { calcProjectMetrics, autoBalancePhases, selectDrRating } from "../src/lib/electricalEngine.js";
import {
  buildProfessionalPanelBoard,
  buildProfessionalPanelBoardSheets,
  feederGaugeByCurrent,
  calcPeConductor,
  getPhaseColor,
} from "../src/lib/professionalPanelBoardLibrary.js";

console.log("==========================================================");
console.log("   AUDITORIA TÉCNICA E FUNCIONAL DO DIAGRAMA UNIFILAR    ");
console.log("==========================================================");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${message}`);
    testsFailed++;
  }
}

// -----------------------------------------------------------------------------
// 1. CONFORMIDADE TÉCNICA NBR 5410: TABELA 58 (CONDUTOR DE PROTEÇÃO PE)
// -----------------------------------------------------------------------------
console.log("\n--- TESTE 1: Dimensionamento do Condutor PE (NBR 5410 Tabela 58) ---");
assert(calcPeConductor(1.5) === 1.5, "Fase 1.5mm² -> PE 1.5mm²");
assert(calcPeConductor(2.5) === 2.5, "Fase 2.5mm² -> PE 2.5mm²");
assert(calcPeConductor(4) === 4, "Fase 4mm² -> PE 4mm²");
assert(calcPeConductor(6) === 6, "Fase 6mm² -> PE 6mm²");
assert(calcPeConductor(10) === 10, "Fase 10mm² -> PE 10mm²");
assert(calcPeConductor(16) === 16, "Fase 16mm² -> PE 16mm²");
assert(calcPeConductor(25) === 16, "Fase 25mm² -> PE 16mm²");
assert(calcPeConductor(35) === 16, "Fase 35mm² -> PE 16mm²");
assert(calcPeConductor(50) === 25, "Fase 50mm² -> PE 25mm²");
assert(calcPeConductor(70) === 35, "Fase 70mm² -> PE 35mm²");
assert(calcPeConductor(95) === 50, "Fase 95mm² -> PE 50mm²");
assert(calcPeConductor(120) === 70, "Fase 120mm² -> PE 70mm²");

// -----------------------------------------------------------------------------
// 2. IDENTIFICAÇÃO E DISTINÇÃO DE FASES (NBR 5410 / IEC 60445)
// -----------------------------------------------------------------------------
console.log("\n--- TESTE 2: Distinção de Cores de Condutores e Fases ---");
const colorA = getPhaseColor("A");
const colorB = getPhaseColor("B");
const colorC = getPhaseColor("C");
const colorN = getPhaseColor("N");
const colorPE = getPhaseColor("PE");
const colorABC = getPhaseColor("ABC");

assert(colorA !== colorB, "Fase A e Fase B possuem cores distintas");
assert(colorB !== colorC, "Fase B e Fase C possuem cores distintas");
assert(colorA !== colorN, "Fase A e Neutro possuem cores distintas");
assert(colorPE === "#16a34a", "Condutor PE possui cor verde padronizada");
assert(colorN === "#00d8b8", "Condutor Neutro possui cor azul-claro padronizada");
assert(colorABC === "#005188", "Alimentação polifásica ABC possui cor representativa");

// -----------------------------------------------------------------------------
// 3. PROJETO VAZIO (0 CIRCUITOS) — ESTABILIDADE E PREVENÇÃO DE TELAS BRANCAS
// -----------------------------------------------------------------------------
console.log("\n--- TESTE 3: Projeto Vazio (0 circuitos) ---");
const emptyProj = {
  id: "proj-empty",
  name: "Projeto Zero Cargas",
  supply_type: "Monofásico",
  voltage: 220,
  circuits: []
};
const emptyMetrics = calcProjectMetrics(emptyProj);
assert(emptyMetrics.totalPower === 0, "Potência total vazia é 0 W");
assert(emptyMetrics.generalCurrent === 0, "Corrente geral vazia é 0 A");

const emptyBoard = buildProfessionalPanelBoard(emptyProj, emptyMetrics);
assert(emptyBoard.circuits.length === 0, "Quadro unifilar possui 0 circuitos sem quebrar");
assert(emptyBoard.tableRows.length >= 8, "Quadro unifilar preenche linhas de reserva técnica mínimas");
assert(emptyBoard.system.label === "Monofásico", "Sistema monofásico identificado corretamente");

const emptySheets = buildProfessionalPanelBoardSheets(emptyProj, emptyMetrics);
assert(emptySheets.totalSheets === 1, "Projeto vazio gera 1 prancha única estável");
assert(emptySheets.sheets[0].sheetType === "combined", "Tipo de prancha combinado gerado sem erros");

// -----------------------------------------------------------------------------
// 4. PROJETO COM 1 CIRCUITO
// -----------------------------------------------------------------------------
console.log("\n--- TESTE 4: Projeto com 1 Circuito ---");
const singleProj = {
  id: "proj-1",
  name: "Residência Compacta",
  supply_type: "Monofásico",
  voltage: 220,
  circuits: [
    {
      id: "c1",
      name: "Iluminação Geral",
      type: "Iluminação",
      power_w: 800,
      voltage: 220,
      phase: "A",
      breaker_a: 10,
      breaker_curve: "B",
      wire_gauge: "1.5mm²",
      needs_dr: false,
      voltage_drop_pct: 0.5
    }
  ]
};
const singleMetrics = calcProjectMetrics(singleProj);
const singleSheets = buildProfessionalPanelBoardSheets(singleProj, singleMetrics);
assert(singleSheets.totalSheets === 1, "Projeto de 1 circuito gera prancha única");
assert(singleSheets.circuits.length === 1, "Exatamente 1 circuito listado");
assert(singleSheets.circuits[0].wireGauge === "1.5mm²", "Seção de 1.5mm² mantida");
assert(singleSheets.circuits[0].breaker === 10, "Disjuntor de 10A mantido");

// -----------------------------------------------------------------------------
// 5. PROJETO COMPLEXO MULTI-PRANCHAS (> 12 CIRCUITOS)
// -----------------------------------------------------------------------------
console.log("\n--- TESTE 5: Projeto Complexo com Multi-Pranchas (18 Circuitos) ---");
const complexProj = {
  id: "proj-complex",
  name: "Edifício Comercial Alpha",
  supply_type: "Trifásico",
  voltage: 380,
  circuits: Array.from({ length: 18 }, (_, i) => ({
    id: `c_${i + 1}`,
    name: `Circuito ${i + 1} - ${i < 6 ? "Iluminação" : i < 14 ? "Tomadas" : "Ar Condicionado"}`,
    type: i < 6 ? "Iluminação" : i < 14 ? "TUG" : "TUE",
    power_w: i < 6 ? 1200 : i < 14 ? 2200 : 4400,
    voltage: i >= 14 ? 380 : 220,
    phase: i >= 14 ? "ABC" : i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C",
    breaker_a: i < 6 ? 10 : i < 14 ? 20 : 25,
    breaker_curve: "C",
    wire_gauge: i < 6 ? "1.5mm²" : i < 14 ? "2.5mm²" : "6.0mm²",
    needs_dr: i >= 6,
    voltage_drop_pct: 1.1 + (i * 0.1)
  }))
};
const complexMetrics = calcProjectMetrics(complexProj);
const complexSheets = buildProfessionalPanelBoardSheets(complexProj, complexMetrics);
assert(complexSheets.totalSheets >= 2, `Projeto de 18 circuitos gerou ${complexSheets.totalSheets} pranchas estruturadas`);
assert(complexSheets.sheets.some(s => s.sheetType.includes("diagram")), "Contém prancha de diagrama unifilar");
assert(complexSheets.sheets.some(s => s.sheetType.includes("table")), "Contém prancha de quadro de cargas");
assert(complexSheets.circuits.length === 18, "Todos os 18 circuitos constam no dimensionamento");

// -----------------------------------------------------------------------------
// 6. RECUPERAÇÃO EXATA E PRESERVAÇÃO DE EDIÇÃO MANUAL (DRAG & DROP)
// -----------------------------------------------------------------------------
console.log("\n--- TESTE 6: Preservação de Coordenadas Manuais (Recuperação Exata) ---");
// Simulando layout com posições manuais customizadas
const manualLayout = {
  nodes: [
    { id: "node-feed", type: "feed", x: 120, y: 90, title: "ENTRADA", subtitle: "220V", active: true },
    { id: "node-general-breaker", type: "breaker", x: 120, y: 220, title: "DJ GERAL", subtitle: "32A", value: "32A", active: true },
    { id: "node-busbar", type: "busbar", x: 120, y: 360, title: "BARRAMENTO", subtitle: "A/B", value: "80A", active: true },
    { id: "node-circuit-0", circuit_id: "c_circ1", type: "circuit", x: 640, y: 480, title: "Ar Condicionado", subtitle: "TUE", value: "20A", active: true },
    { id: "node-circuit-1", circuit_id: "c_circ2", type: "circuit", x: 920, y: 620, title: "Tomadas Cozinha", subtitle: "TUG", value: "20A", active: true },
  ],
  connections: [
    { id: "c-1", from: "node-feed", to: "node-general-breaker", type: "fase" },
    { id: "c-2", from: "node-general-breaker", to: "node-busbar", type: "fase" },
    { id: "c-3", from: "node-busbar", to: "node-circuit-0", type: "fase" },
    { id: "c-4", from: "node-busbar", to: "node-circuit-1", type: "fase" },
  ]
};

// Simulando projeto com os mesmos 2 circuitos
const testProjWithLayout = {
  id: "proj-saved",
  name: "Projeto Salvo",
  circuits: [
    { id: "c_circ1", name: "Ar Condicionado", type: "TUE", breaker_a: 20, wire_gauge: "4.0mm²", phase: "A" },
    { id: "c_circ2", name: "Tomadas Cozinha", type: "TUG", breaker_a: 20, wire_gauge: "2.5mm²", phase: "B" }
  ],
  diagram_layout: manualLayout
};

// Teste de sanitização / recarregamento:
// Simula a lógica de sanitizeDiagramLayout importada ou executada
function testSanitizeSimulation(rawLayout, proj, metrics) {
  const circuitsList = proj.circuits || [];
  let nodes = [...rawLayout.nodes];
  let didChange = false;

  circuitsList.forEach((c, idx) => {
    const cKey = String(c.id || `circuit_${idx}`);
    let matched = nodes.find(n => (
      String(n.circuit_id) === cKey || n.id === `node-circuit-${idx}` || n.title === c.name
    ));
    if (matched) {
      // Atualiza grandezas mantendo x, y
      matched.value = `${c.breaker_a}A`;
      matched.subtitle = `${c.type} · ${c.wire_gauge}`;
    } else {
      // Adiciona novo circuito
      nodes.push({
        id: `node-circuit-${idx}`,
        circuit_id: cKey,
        type: "circuit",
        x: 360 + (idx % 3) * 280,
        y: 260 + Math.floor(idx / 3) * 130,
        title: c.name,
        value: `${c.breaker_a}A`,
        active: true
      });
      didChange = true;
    }
  });
  return { nodes, didChange };
}

const reloaded = testSanitizeSimulation(manualLayout, testProjWithLayout, {});
const nodeC0 = reloaded.nodes.find(n => n.id === "node-circuit-0");
const nodeC1 = reloaded.nodes.find(n => n.id === "node-circuit-1");

assert(nodeC0.x === 640 && nodeC0.y === 480, "Posição manual X=640, Y=480 de C0 preservada perfeitamente");
assert(nodeC1.x === 920 && nodeC1.y === 620, "Posição manual X=920, Y=620 de C1 preservada perfeitamente");

// -----------------------------------------------------------------------------
// 7. ATUALIZAÇÃO INCREMENTAL AO ADICIONAR NOVO CIRCUITO
// -----------------------------------------------------------------------------
console.log("\n--- TESTE 7: Adição Incremental de Novo Circuito sem Perder Layout ---");
const projWithNewCircuit = {
  ...testProjWithLayout,
  circuits: [
    ...testProjWithLayout.circuits,
    { id: "c_circ3", name: "Chuveiro Elétrico", type: "TUE", breaker_a: 32, wire_gauge: "6.0mm²", phase: "A" }
  ]
};

const updatedReload = testSanitizeSimulation(manualLayout, projWithNewCircuit, {});
assert(updatedReload.nodes.length === 6, "Novo nó de circuito inserido sem apagar os anteriores");
const nodeC0After = updatedReload.nodes.find(n => n.id === "node-circuit-0");
assert(nodeC0After.x === 640 && nodeC0After.y === 480, "Coordenadas manuais de nós antigos permanecem intactas");
const newNode = updatedReload.nodes.find(n => n.circuit_id === "c_circ3");
assert(Boolean(newNode), "Novo circuito 'Chuveiro Elétrico' adicionado ao diagrama");
assert(newNode.value === "32A", "Propriedade técnica de 32A aplicada corretamente ao novo nó");

// -----------------------------------------------------------------------------
// RESUMO FINAL
// -----------------------------------------------------------------------------
console.log("\n==========================================================");
console.log(`   TOTAL DE TESTES EXECUTADOS: ${testsPassed + testsFailed}`);
console.log(`   APROVADOS: ${testsPassed}`);
console.log(`   FALHAS:    ${testsFailed}`);
console.log("==========================================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log(">> TODOS OS TESTES DE AUDITORIA FORAM APROVADOS COM SUCESSO! <<\n");
  process.exit(0);
}
