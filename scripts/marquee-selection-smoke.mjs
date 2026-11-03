import assert from "node:assert/strict";
import {
  normalizeAABB,
  isPointInsideAABB,
  doesAABBOverlap,
  doesSegmentIntersectAABB,
  doesPolylineIntersectAABB,
  computeRailComponentBoxes,
  queryMarqueeSelection,
  wireReferencesComponentId,
  executeBatchDelete,
  MOD,
  BRK_H,
  RAIL_COMPONENT_START_X,
} from "../src/lib/marqueeSelection.js";

console.log("================================================================================");
console.log("📐 NACIF ELECTRIC — TESTES DA FERRAMENTA DE SELEÇÃO RETANGULAR (MARQUEE)");
console.log("   Verificação de AABB, Colisão de Fios/Disjuntores e Exclusão em Massa");
console.log("================================================================================\n");

// 1. Teste de Normalização AABB
console.log("1. Testando normalização de AABB (arrasto em qualquer quadrante)...");
const aabb1 = normalizeAABB({ x: 100, y: 150 }, { x: 300, y: 400 });
assert.equal(aabb1.minX, 100);
assert.equal(aabb1.maxX, 300);
assert.equal(aabb1.minY, 150);
assert.equal(aabb1.maxY, 400);
assert.equal(aabb1.width, 200);
assert.equal(aabb1.height, 250);

// Arrasto invertido (baixo/direita para cima/esquerda)
const aabb2 = normalizeAABB({ x: 300, y: 400 }, { x: 100, y: 150 });
assert.equal(aabb2.minX, 100);
assert.equal(aabb2.maxX, 300);
assert.equal(aabb2.minY, 150);
assert.equal(aabb2.maxY, 400);
console.log("  [OK] Normalização de coordenadas bidirecionais aprovada.");

// 2. Teste de Ponto e Sobreposição AABB x AABB
console.log("2. Testando AABB x AABB (caixas de colisão de disjuntores)...");
assert.equal(isPointInsideAABB({ x: 150, y: 200 }, aabb1), true);
assert.equal(isPointInsideAABB({ x: 50, y: 200 }, aabb1), false);
assert.equal(isPointInsideAABB({ x: 150, y: 500 }, aabb1), false);

const compBox = { minX: 160, minY: 145, maxX: 160 + MOD, maxY: 145 + BRK_H }; // Disjuntor monopolar
assert.equal(doesAABBOverlap(compBox, aabb1), true, "Disjuntor contido deve colidir");

const compBoxOutside = { minX: 500, minY: 145, maxX: 500 + MOD, maxY: 145 + BRK_H };
assert.equal(doesAABBOverlap(compBoxOutside, aabb1), false, "Disjuntor fora não pode colidir");
console.log("  [OK] Colisão AABB de componentes aprovada.");

// 3. Teste de Interseção de Linha/Segmento com AABB
console.log("3. Testando interseção de fios e segmentos ortogonais com AABB...");
const box = { minX: 200, minY: 200, maxX: 400, maxY: 400 };

// Fio horizontal que atravessa a caixa de fora a fora
assert.equal(doesSegmentIntersectAABB({ x: 100, y: 250 }, { x: 500, y: 250 }, box), true, "Fio horizontal que cruza a caixa deve colidir");

// Fio vertical que cruza a caixa
assert.equal(doesSegmentIntersectAABB({ x: 250, y: 50 }, { x: 250, y: 550 }, box), true, "Fio vertical que cruza a caixa deve colidir");

// Fio completamente fora
assert.equal(doesSegmentIntersectAABB({ x: 50, y: 50 }, { x: 150, y: 50 }, box), false, "Fio fora não pode colidir");

// Fio com uma ponta dentro da caixa
assert.equal(doesSegmentIntersectAABB({ x: 250, y: 250 }, { x: 500, y: 250 }, box), true, "Fio com ponta dentro deve colidir");

// Polilinha ortogonal (curva em 90°)
const polylineCrossing = [
  { x: 100, y: 100 },
  { x: 250, y: 100 },
  { x: 250, y: 300 }, // entra na caixa
  { x: 500, y: 300 },
];
assert.equal(doesPolylineIntersectAABB(polylineCrossing, box), true, "Polilinha que passa pela caixa deve colidir");
console.log("  [OK] Interseção de segmentos e polilinhas aprovada.");

// 4. Teste de Consulta de Seleção em Massa (queryMarqueeSelection)
console.log("4. Testando queryMarqueeSelection com trilhos DIN e fios reais...");
const mockRails = [
  {
    id: "rail_1",
    components: [
      { id: "c1", poles: 1, type: "breaker", label: "C1 ILUMINAÇÃO" },
      { id: "c2", poles: 2, type: "breaker", label: "C2 CHUVEIRO" },
      { id: "c3", poles: 1, type: "breaker", label: "C3 TOMADAS" },
    ],
  },
];

const mockWires = [
  {
    id: "wire_c1",
    source: "comp:c1:bottom:0",
    target: "terminal_left_top:0",
    route: { points: [{ x: 160 + MOD / 2, y: 145 + BRK_H }, { x: 160 + MOD / 2, y: 400 }, { x: 50, y: 400 }] },
  },
  {
    id: "wire_c3",
    source: "comp:c3:bottom:0",
    target: "terminal_left_top:1",
    route: { points: [{ x: 500, y: 500 }, { x: 600, y: 500 }] },
  },
];

// Selecionar retângulo ao redor de C1 e C2
const compBoxes = computeRailComponentBoxes(mockRails);
assert.equal(compBoxes.length, 3);
const c1Box = compBoxes[0];
const c2Box = compBoxes[1];

const selectionBox = normalizeAABB(
  { x: c1Box.minX - 10, y: c1Box.minY - 10 },
  { x: c2Box.maxX + 1, y: c2Box.maxY + 10 }
);

const result = queryMarqueeSelection({
  marqueeBox: selectionBox,
  rails: mockRails,
  wires: mockWires,
});

assert.deepEqual(result.selectedComponentIds, ["c1", "c2"], "Deve selecionar exatamente C1 e C2");
assert(result.selectedWireIds.includes("wire_c1"), "wire_c1 deve ser selecionado pois se origina de C1 dentro da caixa");
assert(!result.selectedWireIds.includes("wire_c3"), "wire_c3 está fora e NÃO deve ser selecionado");
console.log("  [OK] Seleção em massa de componentes e fios simultâneos aprovada.");

// 5. Teste de Exclusão em Lote (executeBatchDelete)
console.log("5. Testando exclusão em massa e desvinculação atômica...");
const mockCircuits = [
  { id: "c1", number: 1, name: "Iluminação" },
  { id: "c2", number: 2, name: "Chuveiro" },
  { id: "c3", number: 3, name: "Tomadas" },
];

const deleteResult = executeBatchDelete({
  rails: mockRails,
  wires: mockWires,
  compsToDelete: result.selectedComponentIds,
  wiresToDelete: result.selectedWireIds,
  circuits: mockCircuits,
});

assert.equal(deleteResult.deletedComponentIds.length, 2, "2 componentes devem ter sido marcados para exclusão");
assert.equal(deleteResult.nextRails[0].components.length, 1, "Deve restar apenas 1 componente no trilho (C3)");
assert.equal(deleteResult.nextRails[0].components[0].id, "c3", "Componente restante deve ser C3");
assert.equal(deleteResult.nextWires.length, 1, "wire_c1 deve ter sido excluído e sobrar apenas wire_c3");
assert.equal(deleteResult.nextWires[0].id, "wire_c3");
assert.equal(deleteResult.nextCircuits.length, 1, "Devem restar apenas circuitos não deletados");
assert.equal(deleteResult.nextCircuits[0].id, "c3");

console.log("  [OK] Exclusão em lote atômica com limpeza de fiação e circuitos aprovada.");

console.log("\n================================================================================");
console.log("🎉 TODOS OS TESTES DA FERRAMENTA DE SELEÇÃO RETANGULAR FORAM APROVADOS!");
console.log("================================================================================\n");
