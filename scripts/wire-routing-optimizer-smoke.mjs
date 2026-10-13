import assert from "node:assert/strict";
import {
  optimizePanelWiring,
  identifyPanelCorridors,
  removeRedundantOrthogonalBends,
  DEFAULT_COMPACT_WIRE_SPACING,
} from "../src/lib/wireRoutingOptimizer.js";
import {
  isOrthogonalPath,
  pathIntersectsObstacles,
  extractPanelObstacles,
  resolvePinPosition,
} from "../src/lib/orthogonalRouter.js";

console.log("Iniciando bateria de testes do Otimizador Inteligente de Fiação...");

// ─── TESTE 1: Identificação de Corredores de Roteamento ────────────────────────
{
  const mockRails = [
    { id: "rail_1", components: [{ id: "c1", poles: 3 }, { id: "c2", poles: 2 }] },
    { id: "rail_2", components: [{ id: "c3", poles: 1 }, { id: "c4", poles: 1 }] },
  ];
  const { horizontalCorridors, verticalCorridors } = identifyPanelCorridors(mockRails, [], 820);

  assert.ok(horizontalCorridors.length >= 3, "TESTE 1: Deve identificar canaletas superior, inter-trilhos e inferior");
  assert.ok(verticalCorridors.length >= 2, "TESTE 1: Deve identificar canaletas verticais esquerda e direita");
  console.log("✓ TESTE 1: Identificação de corredores e canaletas do quadro: OK");
}

// ─── TESTE 2: Eliminação de Curvas e Desvios Redundantes ──────────────────────
{
  const obstacles = [];
  // Caminho com zigue-zague desnecessário:
  // (100, 100) -> (100, 150) -> (150, 150) -> (150, 200) -> (200, 200) -> (200, 300)
  const jaggedPath = [
    { x: 100, y: 100 },
    { x: 100, y: 150 },
    { x: 150, y: 150 },
    { x: 150, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 300 },
  ];

  const simplified = removeRedundantOrthogonalBends(jaggedPath, obstacles, 10);
  assert.ok(isOrthogonalPath(simplified), "TESTE 2: Caminho simplificado deve ser 100% ortogonal");
  assert.ok(simplified.length < jaggedPath.length, "TESTE 2: Quantidade de pontos e curvas deve ser reduzida");
  console.log("✓ TESTE 2: Eliminação de zigue-zagues e simplificação de curvas: OK");
}

// ─── TESTE 3: Otimização de Quadro Real com Feixe Trifásico (L1, L2, L3) ───────
{
  const mockRails = [
    {
      id: "rail_1",
      components: [
        { id: "gen_brk", type: "breaker", poles: 3, dinSize: 3 },
        { id: "dps_1", type: "dps", poles: 1, dinSize: 1 },
      ],
    },
  ];

  const mockWires = [
    {
      id: "wire_l1",
      source: "terminal_left_top:1",
      target: "comp:gen_brk:top:0",
      color: "black",
      gauge: "10mm²",
      conductorType: "phase",
      name: "Fase L1",
    },
    {
      id: "wire_l2",
      source: "terminal_left_top:2",
      target: "comp:gen_brk:top:1",
      color: "red",
      gauge: "10mm²",
      conductorType: "phase",
      name: "Fase L2",
    },
    {
      id: "wire_l3",
      source: "terminal_left_top:3",
      target: "comp:gen_brk:top:2",
      color: "brown",
      gauge: "10mm²",
      conductorType: "phase",
      name: "Fase L3",
    },
  ];

  const { optimizedWires, stats } = optimizePanelWiring({
    wires: mockWires,
    rails: mockRails,
    infrastructure: [],
    panelHeight: 820,
    options: { minWireSpacing: 9 },
  });

  assert.equal(optimizedWires.length, 3, "TESTE 3: Todas as 3 conexões devem existir");
  optimizedWires.forEach((w, i) => {
    assert.equal(w.id, mockWires[i].id, "TESTE 3: ID preservado");
    assert.equal(w.source, mockWires[i].source, "TESTE 3: Origem preservada");
    assert.equal(w.target, mockWires[i].target, "TESTE 3: Destino preservado");
    assert.equal(w.color, mockWires[i].color, "TESTE 3: Cor preservada");
    assert.ok(isOrthogonalPath(w.route.points), "TESTE 3: Trajeto deve ser 100% ortogonal");
  });

  // Verifica que os cabos paralelos no feixe têm espaçamento compacto consistente e não se sobrepõem
  const ptsL1 = optimizedWires[0].route.points;
  const ptsL2 = optimizedWires[1].route.points;
  const ptsL3 = optimizedWires[2].route.points;

  const yHorizL1 = ptsL1.find((p, idx) => idx > 0 && p.y === ptsL1[idx - 1].y)?.y;
  const yHorizL2 = ptsL2.find((p, idx) => idx > 0 && p.y === ptsL2[idx - 1].y)?.y;
  const yHorizL3 = ptsL3.find((p, idx) => idx > 0 && p.y === ptsL3[idx - 1].y)?.y;

  assert.ok(yHorizL1 && yHorizL2 && yHorizL3, "TESTE 3: Cada fase deve ter segmento horizontal bem definido");
  assert.notEqual(yHorizL1, yHorizL2, "TESTE 3: Trilhas paralelas distintas sem sobreposição");
  assert.notEqual(yHorizL2, yHorizL3, "TESTE 3: Trilhas paralelas distintas sem sobreposição");

  console.log("✓ TESTE 3: Feixe trifásico organizado em trilhas paralelas compactas: OK");
}

// ─── TESTE 4: Idempotência Estrita (Executar 2x consecutivas não altera o resultado) ──
{
  const mockRails = [
    {
      id: "rail_1",
      components: [
        { id: "gen_brk", type: "breaker", poles: 3 },
      ],
    },
  ];
  const mockWires = [
    { id: "w1", source: "terminal_left_top:1", target: "comp:gen_brk:top:0", color: "black" },
    { id: "w2", source: "terminal_left_top:2", target: "comp:gen_brk:top:1", color: "red" },
  ];

  const pass1 = optimizePanelWiring({ wires: mockWires, rails: mockRails, panelHeight: 820 });
  const pass2 = optimizePanelWiring({ wires: pass1.optimizedWires, rails: mockRails, panelHeight: 820 });

  assert.deepEqual(
    pass1.optimizedWires.map(w => w.route.points),
    pass2.optimizedWires.map(w => w.route.points),
    "TESTE 4: Roteamento deve ser estritamente idempotente (sem desvios progressivos)"
  );
  console.log("✓ TESTE 4: Idempotência estrita: OK");
}

// ─── TESTE 5: Preservação de Conexões Especiais e Obstáculos ──────────────────
{
  const mockRails = [
    {
      id: "rail_1",
      components: [
        { id: "b1", type: "breaker", poles: 1 },
        { id: "b2", type: "breaker", poles: 1 },
      ],
    },
  ];
  const obstacles = extractPanelObstacles(mockRails, []);
  const mockWires = [
    { id: "w_neutro", source: "busbar_neutral:0", target: "comp:b1:top:0", color: "blue" },
    { id: "w_terra", source: "busbar_ground:0", target: "comp:b2:bottom:0", color: "green" },
  ];

  const { optimizedWires } = optimizePanelWiring({ wires: mockWires, rails: mockRails, panelHeight: 820 });
  optimizedWires.forEach((w) => {
    assert.ok(isOrthogonalPath(w.route.points), "TESTE 5: Rota ortogonal");
    const excluded = new Set([w.sourceComponentId, w.targetComponentId].filter(Boolean));
    assert.ok(
      !pathIntersectsObstacles(w.route.points, obstacles, 4, excluded),
      "TESTE 5: Cabo não deve atravessar corpos de outros componentes"
    );
  });
  console.log("✓ TESTE 5: Preservação de neutro, terra e desvio de obstáculos: OK");
}

// ─── TESTE 6: Feixe saindo de bornes inferiores paralelos (DPS, IDR L1, IDR N) ─
{
  const mockRails = [
    {
      id: "rail_0",
      components: [
        { id: "dps_a", type: "dps", poles: 1 },
        { id: "idr_geral", type: "dr", poles: 2 },
      ],
    },
    {
      id: "rail_1",
      components: [
        { id: "sp", type: "spacer", poles: 4 },
        { id: "b1", type: "breaker", poles: 1 },
        { id: "b2", type: "breaker", poles: 1 },
      ],
    },
  ];

  const mockWires = [
    { id: "w_dps", source: "comp:dps_a:bottom:0", target: "comp:b1:bottom:0", color: "green" },
    { id: "w_l1", source: "comp:idr_geral:bottom:0", target: "comp:b2:bottom:0", color: "black" },
    { id: "w_n", source: "comp:idr_geral:bottom:1", target: "comp:b1:top:0", color: "blue" },
  ];

  const { optimizedWires } = optimizePanelWiring({
    wires: mockWires,
    rails: mockRails,
    infrastructure: [],
    panelHeight: 820,
    options: { minWireSpacing: 9 },
  });

  assert.equal(optimizedWires.length, 3, "TESTE 6: Todas as 3 conexões devem existir");
  const ptsDPS = optimizedWires[0].route.points;
  const ptsL1 = optimizedWires[1].route.points;
  const ptsN = optimizedWires[2].route.points;

  // Obter o primeiro segmento horizontal de saída de cada condutor
  const yExitDPS = ptsDPS[1]?.y;
  const yExitL1 = ptsL1[1]?.y;
  const yExitN = ptsN[1]?.y;

  assert.ok(yExitDPS && yExitL1 && yExitN, "TESTE 6: Todos devem ter saída ortogonal válida");
  assert.notEqual(yExitDPS, yExitL1, "TESTE 6: Saída do DPS e L1 não podem se sobrepor");
  assert.notEqual(yExitL1, yExitN, "TESTE 6: Saída de L1 e N não podem se sobrepor");

  console.log("✓ TESTE 6: Feixe saindo de bornes inferiores paralelos (DPS, IDR) mantém sutil distância: OK");
}

console.log("\n=======================================================");
console.log("TODOS OS TESTES DO OTIMIZADOR DE FIAÇÃO PASSARAM COM SUCESSO!");
console.log("=======================================================\n");
