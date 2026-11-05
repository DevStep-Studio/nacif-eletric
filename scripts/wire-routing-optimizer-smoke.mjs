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
  computeParallelBusRoutes,
  RouteOccupancyMap,
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

// ─── TESTE 7: Cenário Real Completo (Layout CAD com Cascade Bending e Desvio de Obstáculos) ─
{
  const mockRails = [
    {
      id: "rail_0",
      components: [
        { id: "dps_a", type: "dps", poles: 1 },
        { id: "dps_b", type: "dps", poles: 1 },
        { id: "dps_c", type: "dps", poles: 1 },
        { id: "gen_brk", type: "breaker", poles: 3 },
        { id: "idr_geral", type: "dr", poles: 2 },
      ],
    },
    {
      id: "rail_1",
      components: Array.from({ length: 12 }, (_, i) => ({ id: `b_${i + 1}`, type: "breaker", poles: 1 })),
    },
  ];

  const obstacles = extractPanelObstacles(mockRails, []);
  const panelHeight = 820;

  const mockWires = [
    // Entrada trifásica
    { id: "w_in_l1", source: "terminal_left_top:1", target: "comp:gen_brk:top:0", color: "black" },
    { id: "w_in_l2", source: "terminal_left_top:2", target: "comp:gen_brk:top:1", color: "red" },
    { id: "w_in_l3", source: "terminal_left_top:3", target: "comp:gen_brk:top:2", color: "brown" },
    // Entrada PE principal
    { id: "w_in_pe", source: "terminal_left_top:0", target: "busbar_ground:0", color: "green" },
    // Aterramentos DPS em canaleta esquerda paralela
    { id: "w_dps_a", source: "comp:dps_a:bottom:0", target: "busbar_ground:1", color: "green" },
    { id: "w_dps_b", source: "comp:dps_b:bottom:0", target: "busbar_ground:2", color: "green" },
    { id: "w_dps_c", source: "comp:dps_c:bottom:0", target: "busbar_ground:3", color: "green" },
    // Feixe inter-trilhos (DJ Geral -> Trilho 2)
    { id: "w_inter_l1", source: "comp:gen_brk:bottom:0", target: "comp:b_1:top:0", color: "black" },
    { id: "w_inter_l2", source: "comp:gen_brk:bottom:1", target: "comp:b_2:top:0", color: "red" },
    { id: "w_inter_l3", source: "comp:gen_brk:bottom:2", target: "comp:b_3:top:0", color: "brown" },
  ];

  const { optimizedWires } = optimizePanelWiring({
    wires: mockWires,
    rails: mockRails,
    infrastructure: [],
    panelHeight,
    options: { minWireSpacing: 8 },
  });

  assert.equal(optimizedWires.length, mockWires.length, "TESTE 7: Todos os cabos devem ser otimizados");

  optimizedWires.forEach((w) => {
    assert.ok(isOrthogonalPath(w.route.points), `TESTE 7: Cabo ${w.id} deve ser 100% ortogonal`);
    const excluded = new Set([w.sourceComponentId, w.targetComponentId].filter(Boolean));
    assert.ok(
      !pathIntersectsObstacles(w.route.points, obstacles, 4, excluded),
      `TESTE 7: Cabo ${w.id} não pode colidir com obstáculos do painel`
    );
  });

  // Validação de cascade bending nas fases de entrada
  const l1Y = optimizedWires[0].route.points[1].y;
  const l2Y = optimizedWires[1].route.points[1].y;
  const l3Y = optimizedWires[2].route.points[1].y;
  assert.ok(l1Y !== l2Y && l2Y !== l3Y, "TESTE 7: Fases de entrada devem ter trilhas horizontais distintas");

  // Validação de canaleta esquerda paralela para PE e DPS
  const pePts = optimizedWires.find(w => w.id === "w_in_pe")?.route?.points || [];
  const dpsAPts = optimizedWires.find(w => w.id === "w_dps_a")?.route?.points || [];
  assert.ok(pePts.length >= 4, "TESTE 7: Rota do PE deve navegar via canaleta");
  assert.ok(dpsAPts.length >= 4, "TESTE 7: Rota do DPS deve navegar via canaleta");

  console.log("✓ TESTE 7: Cenário real com entrada trifásica, DPS e inter-trilhos em cascade bending: OK");
}

// ─── TESTE 8: Verificação de Não-Sobreposição de Segmentos Paralelos ───────────
{
  const mockRails = [
    {
      id: "rail_0",
      components: [
        { id: "gen_brk", type: "breaker", poles: 3 },
      ],
    },
  ];

  const mockWires = [
    { id: "p1", source: "terminal_left_top:1", target: "comp:gen_brk:top:0", color: "black" },
    { id: "p2", source: "terminal_left_top:2", target: "comp:gen_brk:top:1", color: "red" },
    { id: "p3", source: "terminal_left_top:3", target: "comp:gen_brk:top:2", color: "brown" },
  ];

  const { optimizedWires } = optimizePanelWiring({
    wires: mockWires,
    rails: mockRails,
    panelHeight: 820,
    options: { minWireSpacing: 8 },
  });

  // Coleta segmentos horizontais
  const horizLines = optimizedWires.map(w => {
    const pts = w.route.points;
    return {
      wireId: w.id,
      y: pts[1].y,
      xStart: Math.min(pts[1].x, pts[2].x),
      xEnd: Math.max(pts[1].x, pts[2].x),
    };
  });

  // Nenhuma linha horizontal com mesmo Y pode se sobrepor
  for (let i = 0; i < horizLines.length; i++) {
    for (let j = i + 1; j < horizLines.length; j++) {
      const a = horizLines[i];
      const b = horizLines[j];
      assert.notEqual(a.y, b.y, `TESTE 8: Fios ${a.wireId} e ${b.wireId} não devem ter o mesmo Y (${a.y})`);
      assert.ok(
        Math.abs(a.y - b.y) >= 6,
        `TESTE 8: Espaçamento entre ${a.wireId} e ${b.wireId} deve ser >= 6px (foi ${Math.abs(a.y - b.y)}px)`
      );
    }
  }

  console.log("✓ TESTE 8: Ausência total de sobreposição e espaçamento >= 6px verificado: OK");
}

// ─── TESTE 9: Função Matemática de Roteamento em Barramento (computeParallelBusRoutes) ───
{
  const connections = [
    { id: "b15", p1: { x: 387, y: 241 }, p2: { x: 387, y: 399 } }, // Colinear vertical direto
    { id: "b16", p1: { x: 415, y: 241 }, p2: { x: 356, y: 399 } }, // Vira para esquerda
    { id: "b17", p1: { x: 443, y: 241 }, p2: { x: 328, y: 399 } }, // Vira para esquerda
    { id: "b18", p1: { x: 471, y: 241 }, p2: { x: 300, y: 399 } }, // Vira para esquerda
  ];

  const routed = computeParallelBusRoutes(connections, { minWireSpacing: 8, baseStubOffset: 24 });
  assert.equal(routed.length, 4, "TESTE 9: Deve retornar 4 rotas");

  // b15 deve ser colinear direto
  const pts15 = routed.find(r => r.id === "b15").points;
  assert.equal(pts15.length, 2, "TESTE 9: Conexão colinear b15 deve ter 2 pontos (linha reta)");
  assert.equal(pts15[0].x, pts15[1].x, "TESTE 9: b15 deve ser perfeitamente vertical");

  // b16, b17, b18 devem ter cascade bending com Ys estritamente distintos
  const pts16 = routed.find(r => r.id === "b16").points;
  const pts17 = routed.find(r => r.id === "b17").points;
  const pts18 = routed.find(r => r.id === "b18").points;

  const y16 = pts16[1].y;
  const y17 = pts17[1].y;
  const y18 = pts18[1].y;

  assert.ok(isOrthogonalPath(pts16), "TESTE 9: Rota b16 deve ser 100% ortogonal");
  assert.ok(isOrthogonalPath(pts17), "TESTE 9: Rota b17 deve ser 100% ortogonal");
  assert.ok(isOrthogonalPath(pts18), "TESTE 9: Rota b18 deve ser 100% ortogonal");

  // Escalonamento em cascata (Cascade Bending): y16 < y17 < y18
  assert.ok(y16 < y17, `TESTE 9: Cascade bending: y16 (${y16}) deve ser menor que y17 (${y17})`);
  assert.ok(y17 < y18, `TESTE 9: Cascade bending: y17 (${y17}) deve ser menor que y18 (${y18})`);
  assert.ok(Math.abs(y17 - y16) >= 8, "TESTE 9: Espaçamento entre b16 e b17 deve ser >= 8px");
  assert.ok(Math.abs(y18 - y17) >= 8, "TESTE 9: Espaçamento entre b17 e b18 deve ser >= 8px");

  console.log("✓ TESTE 9: computeParallelBusRoutes com Cascade Bending e offset paralelo: OK");
}

// ─── TESTE 10: Mapa de Ocupação Espacial (RouteOccupancyMap) e Penalidade de Rota ───
{
  const occ = new RouteOccupancyMap({ spacing: 8 });
  occ.registerRoute([{ x: 100, y: 304 }, { x: 500, y: 304 }], "wire_1");

  // Traçado na mesma linha virtual (y = 304) deve receber alta penalidade
  const penaltyOverlapping = occ.getRoutePenalty([{ x: 150, y: 304 }, { x: 450, y: 304 }], "wire_2");
  assert.ok(penaltyOverlapping >= 50000, "TESTE 10: Rota sobreposta deve receber penalidade de colisão >= 50000");

  // Traçado deslocado em +8px (y = 312) não deve receber penalidade
  const penaltyOffset = occ.getRoutePenalty([{ x: 150, y: 312 }, { x: 450, y: 312 }], "wire_2");
  assert.equal(penaltyOffset, 0, "TESTE 10: Rota em faixa paralela livre deve ter penalidade zero");

  // findNextAvailableHorizontalLane deve retornar a próxima faixa livre (312)
  const nextLane = occ.findNextAvailableHorizontalLane(304, 150, 450, 1);
  assert.equal(nextLane, 312, "TESTE 10: Próxima faixa horizontal livre deve ser y = 312");

  console.log("✓ TESTE 10: RouteOccupancyMap detecta colisão, penaliza rotas sobrepostas e aloca faixas livres: OK");
}

console.log("\n=======================================================");
console.log("TODOS OS 10 TESTES DO OTIMIZADOR DE FIAÇÃO PASSARAM COM SUCESSO!");
console.log("=======================================================\n");
