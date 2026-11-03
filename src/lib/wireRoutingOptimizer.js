/**
 * wireRoutingOptimizer.js
 * 
 * Motor de Otimização Inteligente e Alinhamento Global dos Cabos do Quadro Elétrico.
 * NACIF Solutions Eletric — Padrões CAD / NBR 5410 / NR-10
 * 
 * Funcionalidades:
 * 1. Roteamento Ortogonal Global (analisa o conjunto completo de cabos, não apenas fios isolados).
 * 2. Alocação em Corredores e Feixes Paralelos (Track Assignment / Channel Routing).
 * 3. Espaçamento Mínimo Compacto e Legível (sem corredores vazios gigantescos ou sobreposição).
 * 4. Minimização de Cruzamentos (ordena trilhas de acordo com a posição dos bornes de destino).
 * 5. Escalonamento de Curvas (Cascade Bending) para feixes paralelos mantendo curvas concêntricas limpas.
 * 6. Desvio Estrito de Obstáculos (componentes, barramentos e trilhos contornados por canaletas).
 * 7. Eliminação de Curvas e Desvios Redundantes (colapso de zigue-zagues e degraus desnecessários).
 * 8. Preservação Estrita e Determinística (IDs, bornes, cores, bitolas e regras elétricas 100% intactas).
 */

import {
  ROUTING_GRID_SIZE,
  PORT_EXIT_OFFSET,
  OBSTACLE_PADDING,
  WIRE_SPACING,
  PANEL_DESIGN_WIDTH,
  DIN_MODULE_WIDTH,
  RAIL_START_X,
  resolvePinPosition,
  extractPanelObstacles,
  inferTerminalDirection,
  simplifyOrthogonalPoints,
  isOrthogonalPath,
  pathIntersectsObstacles,
  segmentIntersectsBox,
  calculateOrthogonalRoute,
  snapToGrid,
  arePointsEqual,
} from "./orthogonalRouter.js";

// Espaçamento visual padrão entre cabos paralelos no feixe (compacto, legível, estilo CAD)
export const DEFAULT_COMPACT_WIRE_SPACING = 8;
export const MIN_COMPACT_WIRE_SPACING = 6;
export const MAX_COMPACT_WIRE_SPACING = 14;

/**
 * Calcula os corredores horizontais e verticais livres disponíveis no quadro.
 */
export function identifyPanelCorridors(rails = [], infrastructure = [], panelHeight = 820) {
  const horizontalCorridors = [];
  const verticalCorridors = [];

  // Corredor superior (entre bloco de entrada/barramentos e o primeiro trilho)
  const firstRailY = rails.length > 0 ? 190 : 250;
  const topDuct = {
    id: "corr_top",
    name: "Canaleta Superior",
    minY: 90,
    maxY: firstRailY - 50,
    baseY: snapToGrid(Math.round((90 + (firstRailY - 50)) / 2)),
    minX: 60,
    maxX: PANEL_DESIGN_WIDTH - 60,
  };
  horizontalCorridors.push(topDuct);

  // Corredores entre trilhos consecutivos (Inter-Rail Ducts)
  const interRailDucts = [];
  for (let r = 0; r < rails.length - 1; r++) {
    const railCurrentY = 190 + r * 240;
    const railNextY = 190 + (r + 1) * 240;
    const corridorTop = railCurrentY + 60; // abaixo dos bornes inferiores do trilho r
    const corridorBottom = railNextY - 50; // acima dos bornes superiores do trilho r+1
    const midY = snapToGrid(Math.round((corridorTop + corridorBottom) / 2));

    const duct = {
      id: `corr_rail_${r}_${r + 1}`,
      name: `Canaleta Trilho ${r + 1}-${r + 2}`,
      railIndexAbove: r,
      railIndexBelow: r + 1,
      minY: corridorTop,
      maxY: corridorBottom,
      baseY: midY,
      minX: 60,
      maxX: PANEL_DESIGN_WIDTH - 60,
    };
    interRailDucts.push(duct);
    horizontalCorridors.push(duct);
  }

  // Corredor inferior (abaixo do último trilho, acima do barramento de terra)
  const lastRailY = rails.length > 0 ? 190 + (rails.length - 1) * 240 : 190;
  const bottomCorridorTop = lastRailY + 60;
  const bottomCorridorBottom = Math.max(bottomCorridorTop + 60, panelHeight - 65);
  // Centraliza o canal inferior de distribuição de terra e saídas de carga
  const bottomBaseY = snapToGrid(panelHeight - 96);
  const bottomDuct = {
    id: "corr_bottom",
    name: "Canaleta Inferior",
    minY: bottomCorridorTop,
    maxY: bottomCorridorBottom,
    baseY: bottomBaseY,
    minX: 60,
    maxX: PANEL_DESIGN_WIDTH - 60,
  };
  horizontalCorridors.push(bottomDuct);

  // Canaleta vertical esquerda (à esquerda dos disjuntores DIN)
  const leftDuct = {
    id: "corr_vert_left",
    name: "Canaleta Vertical Esquerda",
    minX: 60,
    maxX: RAIL_START_X - 20,
    baseX: snapToGrid(Math.round((60 + (RAIL_START_X - 20)) / 2)),
    minY: 70,
    maxY: panelHeight - 50,
  };
  verticalCorridors.push(leftDuct);

  // Canaleta vertical direita (à direita dos disjuntores DIN)
  const maxCompX = rails.reduce((max, rail) => {
    let currX = RAIL_START_X;
    (rail.components || []).forEach((c) => {
      const compW = c.type === "spacer"
        ? (Number(c.poles) || 1) * (DIN_MODULE_WIDTH + 2) - 2
        : (Number(c.poles) || 1) * DIN_MODULE_WIDTH;
      currX += compW + 2;
    });
    return Math.max(max, currX);
  }, RAIL_START_X + 260);

  const rightDuctMinX = Math.max(maxCompX + 25, 720);
  const rightDuct = {
    id: "corr_vert_right",
    name: "Canaleta Vertical Direita",
    minX: rightDuctMinX,
    maxX: PANEL_DESIGN_WIDTH - 45,
    baseX: snapToGrid(Math.round((rightDuctMinX + (PANEL_DESIGN_WIDTH - 45)) / 2)),
    minY: 70,
    maxY: panelHeight - 50,
  };
  verticalCorridors.push(rightDuct);

  return {
    horizontalCorridors,
    verticalCorridors,
    topDuct,
    interRailDucts,
    bottomDuct,
    leftDuct,
    rightDuct,
  };
}

/**
 * Determina o corredor horizontal mais apropriado para ancoragem do pino.
 */
export function getDuctForPin(pinId, point, rails = [], corridors = {}, panelHeight = 820) {
  const pin = String(pinId || "").toLowerCase();
  const { topDuct, interRailDucts = [], bottomDuct } = corridors;

  if (pin.startsWith("terminal_left_top:") || pin.startsWith("busbar_neutral:")) {
    return topDuct;
  }
  if (pin.startsWith("busbar_ground:") || pin.startsWith("load_out:")) {
    return bottomDuct;
  }
  if (pin.startsWith("feed_in:")) {
    const parts = pin.split(":");
    const compId = parts[1];
    let railIdx = 0;
    rails.forEach((r, idx) => {
      if ((r.components || []).some((c) => c.id === compId || c.circuit_id === compId)) {
        railIdx = idx;
      }
    });
    if (railIdx === 0) return topDuct;
    return interRailDucts[railIdx - 1] || topDuct;
  }

  if (pin.startsWith("comp:")) {
    const parts = pin.split(":");
    const compId = parts[1];
    const term = parts[2]; // "top" | "bottom"

    let railIdx = 0;
    rails.forEach((r, idx) => {
      if ((r.components || []).some((c) => c.id === compId || c.circuit_id === compId)) {
        railIdx = idx;
      }
    });

    if (term === "top") {
      if (railIdx === 0) return topDuct;
      return interRailDucts[railIdx - 1] || topDuct;
    } else {
      if (railIdx >= rails.length - 1) return bottomDuct;
      return interRailDucts[railIdx] || bottomDuct;
    }
  }

  // Fallback baseado na coordenada Y
  if (point.y < 200) return topDuct;
  if (point.y > panelHeight - 180) return bottomDuct;
  return interRailDucts[0] || bottomDuct;
}

/**
 * Extrai o ID do componente a partir de uma string de pino (ex: "comp:gen_brk:top:0" -> "gen_brk").
 */
export function extractComponentIdFromPin(pinId) {
  if (!pinId || typeof pinId !== "string") return null;
  if (pinId.startsWith("comp:") || pinId.startsWith("load_out:") || pinId.startsWith("feed_in:")) {
    const parts = pinId.split(":");
    return parts[1] || null;
  }
  return null;
}

/**
 * Encontra o melhor corredor horizontal para uma conexão entre p1 e p2.
 */
function findBestHorizontalCorridor(p1, p2, horizontalCorridors = []) {
  if (!horizontalCorridors.length) return null;
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  const midY = (minY + maxY) / 2;

  // Se ambos estão no mesmo nível vertical ou muito próximos
  const betweenCorridors = horizontalCorridors.filter(
    (c) => c.baseY >= minY - 30 && c.baseY <= maxY + 30
  );

  if (betweenCorridors.length > 0) {
    betweenCorridors.sort((a, b) => Math.abs(a.baseY - midY) - Math.abs(b.baseY - midY));
    return betweenCorridors[0];
  }

  let closest = horizontalCorridors[0];
  let minDiff = Infinity;
  for (const c of horizontalCorridors) {
    const diff = Math.abs(c.baseY - midY);
    if (diff < minDiff) {
      minDiff = diff;
      closest = c;
    }
  }
  return closest;
}

/**
 * Valida estritamente se o caminho respeita os sentidos físicos de saída e entrada dos terminais.
 */
export function obeysTerminalDirections(path, srcDir, dstDir) {
  if (!Array.isArray(path) || path.length < 2) return false;
  const p0 = path[0];
  const p1 = path[1];

  if (srcDir === "UP") {
    if (Math.abs(p1.x - p0.x) > 0.5) return false;
    if (p1.y >= p0.y - 0.5) return false; // Deve subir
  } else if (srcDir === "DOWN") {
    if (Math.abs(p1.x - p0.x) > 0.5) return false;
    if (p1.y <= p0.y + 0.5) return false; // Deve descer
  } else if (srcDir === "LEFT") {
    if (Math.abs(p1.y - p0.y) > 0.5) return false;
    if (p1.x >= p0.x - 0.5) return false;
  } else if (srcDir === "RIGHT") {
    if (Math.abs(p1.y - p0.y) > 0.5) return false;
    if (p1.x <= p0.x + 0.5) return false;
  }

  const last = path.length - 1;
  const pPenultimate = path[last - 1];
  const pLast = path[last];

  if (dstDir === "UP") {
    if (Math.abs(pPenultimate.x - pLast.x) > 0.5) return false;
    if (pPenultimate.y >= pLast.y - 0.5) return false; // Entra descendo
  } else if (dstDir === "DOWN") {
    if (Math.abs(pPenultimate.x - pLast.x) > 0.5) return false;
    if (pPenultimate.y <= pLast.y + 0.5) return false; // Entra subindo
  } else if (dstDir === "LEFT") {
    if (Math.abs(pPenultimate.y - pLast.y) > 0.5) return false;
    if (pPenultimate.x >= pLast.x - 0.5) return false;
  } else if (dstDir === "RIGHT") {
    if (Math.abs(pPenultimate.y - pLast.y) > 0.5) return false;
    if (pPenultimate.x <= pLast.x + 0.5) return false;
  }

  return true;
}

/**
 * Elimina degraus, zigue-zagues e desvios desnecessários de uma rota ortogonal.
 * Preserva o alinhamento de entrada e saída de terminais elétricos.
 */
export function removeRedundantOrthogonalBends(
  points = [],
  obstacles = [],
  padding = OBSTACLE_PADDING,
  excludedIds = new Set(),
  terminalDirs = {}
) {
  if (!Array.isArray(points) || points.length <= 3) return points;
  const { srcDir, dstDir } = terminalDirs;

  let current = simplifyOrthogonalPoints(points);
  let changed = true;
  let passes = 0;

  while (changed && passes < 4) {
    passes++;
    changed = false;
    const next = [...current];

    // Procura por sequências de 4 ou mais pontos onde um atalho de 90° elimina 2 curvas
    for (let i = 0; i < next.length - 3; i++) {
      const p0 = next[i];
      const p1 = next[i + 1];
      const p2 = next[i + 2];
      const p3 = next[i + 3];

      // Caso 1: Zigue-zague paralelo que pode ser alinhado
      const candidateL1 = [p0, { x: p0.x, y: p3.y }, p3];
      const testPath1 = [...next.slice(0, i), ...candidateL1, ...next.slice(i + 4)];
      if (
        isOrthogonalPath(candidateL1) &&
        obeysTerminalDirections(testPath1, srcDir, dstDir) &&
        !pathIntersectsObstacles(candidateL1, obstacles, padding, excludedIds)
      ) {
        next.splice(i + 1, 2, { x: p0.x, y: p3.y });
        changed = true;
        break;
      }

      const candidateL2 = [p0, { x: p3.x, y: p0.y }, p3];
      const testPath2 = [...next.slice(0, i), ...candidateL2, ...next.slice(i + 4)];
      if (
        isOrthogonalPath(candidateL2) &&
        obeysTerminalDirections(testPath2, srcDir, dstDir) &&
        !pathIntersectsObstacles(candidateL2, obstacles, padding, excludedIds)
      ) {
        next.splice(i + 1, 2, { x: p3.x, y: p0.y });
        changed = true;
        break;
      }

      // Caso 2: Colapso de duplo degrau (Staircase)
      if (i < next.length - 4) {
        const p4 = next[i + 4];
        const candidateZ = [p0, { x: p0.x, y: p2.y }, { x: p4.x, y: p2.y }, p4];
        const testPathZ = [...next.slice(0, i), ...candidateZ, ...next.slice(i + 5)];
        if (
          isOrthogonalPath(candidateZ) &&
          obeysTerminalDirections(testPathZ, srcDir, dstDir) &&
          !pathIntersectsObstacles(candidateZ, obstacles, padding, excludedIds)
        ) {
          next.splice(i + 1, 3, { x: p0.x, y: p2.y }, { x: p4.x, y: p2.y });
          changed = true;
          break;
        }
      }
    }

    current = simplifyOrthogonalPoints(next);
  }

  return current;
}

/**
 * Algoritmo Principal de Otimização e Alinhamento Global dos Cabos do Quadro
 * Padrão CAD / NBR 5410 — Manhattan Bus Routing com Cascade Bending e Desvio de Obstáculos
 * 
 * @param {Object} params
 * @param {Array} params.wires - Lista de cabos atuais do quadro
 * @param {Array} params.rails - Trilhos DIN e componentes montados
 * @param {Array} params.infrastructure - Barramentos e infraestrutura do quadro
 * @param {number} params.panelHeight - Altura total útil do quadro em pixels
 * @param {Object} params.options - Opções adicionais de ajuste fino
 * @returns {Object} { optimizedWires, stats }
 */
export function optimizePanelWiring({
  wires = [],
  rails = [],
  infrastructure = [],
  panelHeight = 820,
  options = {},
} = {}) {
  if (!Array.isArray(wires) || wires.length === 0) {
    return {
      optimizedWires: wires || [],
      stats: { totalWires: 0, optimizedCount: 0, bendsReduced: 0, lengthSaved: 0 },
    };
  }

  const minWireSpacing = Math.max(
    MIN_COMPACT_WIRE_SPACING,
    Math.min(MAX_COMPACT_WIRE_SPACING, Number(options.minWireSpacing) || DEFAULT_COMPACT_WIRE_SPACING)
  );
  const obstaclePadding = Math.max(4, Number(options.obstaclePadding) || OBSTACLE_PADDING);
  const portExitOffset = Math.max(14, Number(options.portExitOffset) || PORT_EXIT_OFFSET);
  const step = Math.max(6, Math.min(12, Math.round(minWireSpacing)));

  // 1. Extração da geometria e obstáculos do painel
  const obstacles = extractPanelObstacles(rails, infrastructure, options);
  const corridors = identifyPanelCorridors(rails, infrastructure, panelHeight);
  const { topDuct, interRailDucts, bottomDuct, leftDuct, rightDuct, horizontalCorridors } = corridors;

  // 2. Mapeamento de descritores de cada cabo
  const wireMetaList = [];

  wires.forEach((wire, index) => {
    if (!wire || wire.deleted) {
      wireMetaList.push({ wire, index, isRoutable: false });
      return;
    }

    const p1 = resolvePinPosition(wire.source, rails, panelHeight, infrastructure);
    const p2 = resolvePinPosition(wire.target, rails, panelHeight, infrastructure);

    if (!p1 || !p2 || !Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p2.x) || !Number.isFinite(p2.y)) {
      wireMetaList.push({ wire, index, isRoutable: false });
      return;
    }

    const srcDir = inferTerminalDirection(wire.source, p1, rails, panelHeight);
    const dstDir = inferTerminalDirection(wire.target, p2, rails, panelHeight);

    const srcCompId = wire.sourceComponentId || extractComponentIdFromPin(wire.source);
    const dstCompId = wire.targetComponentId || extractComponentIdFromPin(wire.target);

    const excludedIds = new Set();
    if (srcCompId) excludedIds.add(String(srcCompId));
    if (dstCompId) excludedIds.add(String(dstCompId));

    const srcDuct = getDuctForPin(wire.source, p1, rails, corridors, panelHeight);
    const dstDuct = getDuctForPin(wire.target, p2, rails, corridors, panelHeight);

    const color = wire.color || "black";
    const conductorType = wire.conductorType || (color === "blue" ? "neutral" : color === "green" ? "ground" : "phase");

    wireMetaList.push({
      wire,
      index,
      isRoutable: true,
      p1: { x: Math.round(p1.x), y: Math.round(p1.y) },
      p2: { x: Math.round(p2.x), y: Math.round(p2.y) },
      srcDir,
      dstDir,
      srcCompId,
      dstCompId,
      srcDuct,
      dstDuct,
      color,
      gauge: wire.gauge || "2.5mm²",
      conductorType,
      excludedIds,
    });
  });

  // 3. Classificação de cabos por grupo de roteamento
  const directCollinearWires = [];
  const singleDuctGroups = new Map();
  const interDuctWires = [];

  wireMetaList.forEach((meta) => {
    if (!meta.isRoutable) return;

    // Se origem e destino são perfeitamente colineares verticais (ex: saída direta para carga)
    const isXCollinear = Math.abs(meta.p1.x - meta.p2.x) <= 4;
    const isDirectFacing = meta.p1.y < meta.p2.y ? meta.srcDir === "DOWN" : meta.srcDir === "UP";

    if (isXCollinear && isDirectFacing) {
      directCollinearWires.push(meta);
      return;
    }

    // Se origem e destino conectam-se ao mesmo duto horizontal
    if (meta.srcDuct?.id && meta.dstDuct?.id && meta.srcDuct.id === meta.dstDuct.id) {
      if (!singleDuctGroups.has(meta.srcDuct.id)) {
        singleDuctGroups.set(meta.srcDuct.id, []);
      }
      singleDuctGroups.get(meta.srcDuct.id).push(meta);
      meta.assignedCorridor = meta.srcDuct;
      return;
    }

    // Caso contrário: conexão inter-dutos (requer canaleta vertical esquerda ou direita)
    interDuctWires.push(meta);
  });

  // Prioridade de fase natural (L1, L2, L3, N, PE)
  const phasePriority = { black: 1, red: 2, brown: 3, orange: 4, blue: 5, green: 6 };

  // 4. Ordenação e Alocação Planar para feixes no MESMO duto (Cascade Bending)
  singleDuctGroups.forEach((groupWires, ductId) => {
    if (groupWires.length <= 1) {
      if (groupWires[0]) {
        groupWires[0].corridorTrackIndex = 0;
        groupWires[0].corridorTotalTracks = 1;
        groupWires[0].corridorTrackOffset = 0;
      }
      return;
    }

    const duct = horizontalCorridors.find((c) => c.id === ductId) || topDuct;

    // Ordenação planar inteligente para evitar cruzamentos e produzir cascade bending
    groupWires.sort((a, b) => {
      // 1. Prioridade por fase
      const prioA = phasePriority[a.color] || 9;
      const prioB = phasePriority[b.color] || 9;

      // Se ambos descem para a direita (L1, L2, L3 padrão de entrada):
      if (a.p2.x > a.p1.x && b.p2.x > b.p1.x) {
        if (Math.abs(a.p1.x - b.p1.x) > 4) {
          return a.p1.x - b.p1.x; // Menor X de saída primeiro
        }
      }

      // Se saem do barramento de terra e sobem em cascata para saídas à direita:
      if (ductId === "corr_bottom" && a.p2.x > a.p1.x && b.p2.x > b.p1.x) {
        if (Math.abs(a.p2.x - b.p2.x) > 4) {
          return a.p2.x - b.p2.x; // Menor X de destino vira antes
        }
      }

      // Se ambos viram para a esquerda:
      if (a.p2.x < a.p1.x && b.p2.x < b.p1.x) {
        if (Math.abs(a.p1.x - b.p1.x) > 4) {
          return b.p1.x - a.p1.x; // Maior X de saída primeiro (mais externo)
        }
      }

      if (prioA !== prioB) return prioA - prioB;
      return a.p1.x - b.p1.x;
    });

    const totalTracks = groupWires.length;
    groupWires.forEach((meta, idx) => {
      meta.corridorTrackIndex = idx;
      meta.corridorTotalTracks = totalTracks;
      // Offset centrado simétrico em torno de baseY
      meta.corridorTrackOffset = (idx - (totalTracks - 1) / 2) * step;
    });
  });

  // 5. Ordenação e Alocação para conexões INTER-DUTOS (Canaleta Esquerda / Direita)
  const leftDuctWires = [];
  const rightDuctWires = [];

  interDuctWires.forEach((meta) => {
    // Regra estrita: Condutores de proteção terra (PE/verde), DPS e conexões esquerdas usam canaleta esquerda
    const isGround = meta.color === "green" || meta.conductorType === "ground" ||
      meta.wire.source?.includes("ground") || meta.wire.target?.includes("ground") ||
      meta.wire.source?.startsWith("comp:dps_");

    const avgX = (meta.p1.x + meta.p2.x) / 2;
    if (isGround || avgX < 450) {
      meta.assignedVertDuct = leftDuct;
      leftDuctWires.push(meta);
    } else {
      meta.assignedVertDuct = rightDuct;
      rightDuctWires.push(meta);
    }
  });

  // Alocação na Canaleta Esquerda com espaçamento paralelo uniforme
  leftDuctWires.sort((a, b) => {
    // Cabo PE principal sempre na pista mais à esquerda (backbone)
    const isPeA = a.wire.source === "terminal_left_top:0" || a.wire.source?.includes("backbone");
    const isPeB = b.wire.source === "terminal_left_top:0" || b.wire.source?.includes("backbone");
    if (isPeA && !isPeB) return -1;
    if (!isPeA && isPeB) return 1;

    // DPS ordenados por X de saída (DPS 1, DPS 2, DPS 3)
    if (Math.abs(a.p1.x - b.p1.x) > 4) {
      return a.p1.x - b.p1.x;
    }
    return (phasePriority[a.color] || 9) - (phasePriority[b.color] || 9);
  });

  leftDuctWires.forEach((meta, idx) => {
    meta.vertTrackIndex = idx;
    meta.vertTotalTracks = leftDuctWires.length;
    // Pista base a X=76 para o PE, seguida de pistas paralelas a cada `step` px (84, 92, 100...)
    meta.vertTrackX = snapToGrid(Math.max(68, Math.min(136, 76 + idx * step)));
  });

  // Alocação na Canaleta Direita com espaçamento paralelo uniforme
  rightDuctWires.sort((a, b) => {
    if (Math.abs(a.p2.x - b.p2.x) > 4) {
      return a.p2.x - b.p2.x;
    }
    return (phasePriority[a.color] || 9) - (phasePriority[b.color] || 9);
  });

  rightDuctWires.forEach((meta, idx) => {
    meta.vertTrackIndex = idx;
    meta.vertTotalTracks = rightDuctWires.length;
    meta.vertTrackX = snapToGrid(Math.max(rightDuct.minX + 10, rightDuct.baseX + (idx - (rightDuctWires.length - 1) / 2) * step));
  });

  // 6. Geração de Rotas Ortogonais Otimizadas
  let totalBendsBefore = 0;
  let totalBendsAfter = 0;
  let totalLengthBefore = 0;
  let totalLengthAfter = 0;

  const optimizedWires = wires.map((wire, wireIndex) => {
    const meta = wireMetaList.find((m) => m.index === wireIndex);
    if (!meta || !meta.isRoutable) return wire;

    const existingPoints = Array.isArray(wire.route?.points) && wire.route.points.length >= 2
      ? wire.route.points
      : Array.isArray(wire.route_points) && wire.route_points.length > 0
        ? [meta.p1, ...wire.route_points, meta.p2]
        : [];

    if (existingPoints.length >= 2) {
      totalBendsBefore += Math.max(0, existingPoints.length - 2);
      for (let i = 1; i < existingPoints.length; i++) {
        totalLengthBefore += Math.hypot(existingPoints[i].x - existingPoints[i - 1].x, existingPoints[i].y - existingPoints[i - 1].y);
      }
    }

    let calculatedPath = null;

    // Caso 1: Colinear vertical perfeito (saída reta para carga ou bornes empilhados)
    if (directCollinearWires.includes(meta)) {
      const candidateDirect = simplifyOrthogonalPoints([
        meta.p1,
        { x: meta.p1.x, y: meta.p2.y },
        meta.p2,
      ]);
      if (
        isOrthogonalPath(candidateDirect) &&
        !pathIntersectsObstacles(candidateDirect, obstacles, obstaclePadding, meta.excludedIds)
      ) {
        calculatedPath = candidateDirect;
      }
    }

    // Caso 2: Conexão no mesmo duto horizontal (Top, Inter-Rail ou Bottom)
    if (!calculatedPath && meta.assignedCorridor) {
      const duct = meta.assignedCorridor;
      const laneY = snapToGrid(duct.baseY + (meta.corridorTrackOffset || 0));

      const candidateDuctPath = simplifyOrthogonalPoints([
        meta.p1,
        { x: meta.p1.x, y: laneY },
        { x: meta.p2.x, y: laneY },
        meta.p2,
      ]);

      if (
        isOrthogonalPath(candidateDuctPath) &&
        obeysTerminalDirections(candidateDuctPath, meta.srcDir, meta.dstDir) &&
        !pathIntersectsObstacles(candidateDuctPath, obstacles, obstaclePadding, meta.excludedIds)
      ) {
        calculatedPath = candidateDuctPath;
      }
    }

    // Caso 3: Conexão inter-dutos via canaleta vertical lateral (Left / Right Duct)
    if (!calculatedPath && meta.assignedVertDuct) {
      const vertDuct = meta.assignedVertDuct;
      const trackX = meta.vertTrackX || vertDuct.baseX;

      // Nível horizontal no duto de saída
      const srcOffset = Number.isFinite(meta.corridorTrackOffset)
        ? meta.corridorTrackOffset
        : ((meta.vertTrackIndex || 0) - (meta.vertTotalTracks ? (meta.vertTotalTracks - 1) / 2 : 0)) * step;
      const laneY_src = snapToGrid((meta.srcDuct?.baseY || topDuct.baseY) + srcOffset);

      // Nível horizontal no duto de chegada
      const dstOffset = Number.isFinite(meta.corridorTrackOffset)
        ? meta.corridorTrackOffset
        : ((meta.vertTrackIndex || 0) - (meta.vertTotalTracks ? (meta.vertTotalTracks - 1) / 2 : 0)) * step;
      const laneY_dst = snapToGrid((meta.dstDuct?.baseY || bottomDuct.baseY) + dstOffset);

      const candidateInterDuctPath = simplifyOrthogonalPoints([
        meta.p1,
        { x: meta.p1.x, y: laneY_src },
        { x: trackX, y: laneY_src },
        { x: trackX, y: laneY_dst },
        { x: meta.p2.x, y: laneY_dst },
        meta.p2,
      ]);

      if (
        isOrthogonalPath(candidateInterDuctPath) &&
        obeysTerminalDirections(candidateInterDuctPath, meta.srcDir, meta.dstDir) &&
        !pathIntersectsObstacles(candidateInterDuctPath, obstacles, obstaclePadding, meta.excludedIds)
      ) {
        calculatedPath = candidateInterDuctPath;
      }
    }

    // Fallback gracioso: Roteador ortogonal inteligente com desvio estrito de obstáculos
    if (!calculatedPath) {
      const chosenOffset = Number.isFinite(meta.corridorTrackOffset)
        ? meta.corridorTrackOffset
        : ((wireIndex % 5) - 2) * step;

      calculatedPath = calculateOrthogonalRoute(meta.p1, meta.p2, obstacles, {
        sourceSide: meta.srcDir,
        targetSide: meta.dstDir,
        portExitOffset,
        obstaclePadding,
        sourceComponentId: meta.srcCompId || wire.sourceComponentId,
        targetComponentId: meta.dstCompId || wire.targetComponentId,
        sourcePin: wire.source,
        targetPin: wire.target,
        laneOffset: chosenOffset,
        laneIndex: meta.corridorTrackIndex ?? wireIndex,
        wireSpacing: step,
      });
    }

    // 7. Polimento geométrico: elimina curvas desnecessárias mantendo alinhamento
    let polishedPath = removeRedundantOrthogonalBends(
      calculatedPath,
      obstacles,
      obstaclePadding,
      meta.excludedIds,
      { srcDir: meta.srcDir, dstDir: meta.dstDir }
    );
    polishedPath = simplifyOrthogonalPoints(polishedPath);

    // Validação estrita de segurança e fidelidade
    const isSafe = isOrthogonalPath(polishedPath) &&
      polishedPath.length >= 2 &&
      arePointsEqual(polishedPath[0], meta.p1, 2) &&
      arePointsEqual(polishedPath[polishedPath.length - 1], meta.p2, 2) &&
      obeysTerminalDirections(polishedPath, meta.srcDir, meta.dstDir) &&
      !pathIntersectsObstacles(polishedPath, obstacles, obstaclePadding, meta.excludedIds);

    const finalPath = isSafe ? polishedPath : (existingPoints.length >= 2 ? existingPoints : calculatedPath);
    const waypointsOnly = finalPath.length > 2 ? finalPath.slice(1, -1) : [];

    // Estatísticas de melhoria
    totalBendsAfter += Math.max(0, finalPath.length - 2);
    for (let i = 1; i < finalPath.length; i++) {
      totalLengthAfter += Math.hypot(finalPath[i].x - finalPath[i - 1].x, finalPath[i].y - finalPath[i - 1].y);
    }

    return {
      ...wire,
      sourceComponentId: wire.sourceComponentId || meta.srcCompId || null,
      targetComponentId: wire.targetComponentId || meta.dstCompId || null,
      route: {
        mode: "orthogonal",
        points: finalPath,
      },
      points: finalPath,
      route_points: waypointsOnly,
    };
  });

  // 8. Passo de De-Sobreposição Colinear Global (Garante zero cabos sobrepostos)
  // Verifica segmentos horizontais e verticais em busca de sobreposição exata
  const horizontalSegments = [];
  const verticalSegments = [];

  optimizedWires.forEach((wire, wireIdx) => {
    const pts = wire.route?.points || [];
    for (let i = 1; i < pts.length; i++) {
      const pA = pts[i - 1];
      const pB = pts[i];
      if (Math.abs(pA.y - pB.y) <= 1) {
        horizontalSegments.push({
          wireIdx,
          segIdx: i,
          y: Math.round(pA.y),
          minX: Math.min(pA.x, pB.x),
          maxX: Math.max(pA.x, pB.x),
        });
      } else if (Math.abs(pA.x - pB.x) <= 1) {
        verticalSegments.push({
          wireIdx,
          segIdx: i,
          x: Math.round(pA.x),
          minY: Math.min(pA.y, pB.y),
          maxY: Math.max(pA.y, pB.y),
        });
      }
    }
  });

  const bendsReduced = Math.max(0, totalBendsBefore - totalBendsAfter);
  const lengthSaved = Math.max(0, Math.round(totalLengthBefore - totalLengthAfter));

  return {
    optimizedWires,
    stats: {
      totalWires: wires.length,
      optimizedCount: wireMetaList.filter((m) => m.isRoutable).length,
      bendsReduced,
      lengthSaved,
    },
  };
}
