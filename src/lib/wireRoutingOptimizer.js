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
 * 5. Eliminação de Curvas e Desvios Redundantes (colapso de zigue-zagues e degraus desnecessários).
 * 6. Preservação Estrita e Determinística (IDs, bornes, cores, bitolas e regras elétricas 100% intactas).
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
export const DEFAULT_COMPACT_WIRE_SPACING = 9;
export const MIN_COMPACT_WIRE_SPACING = 7;
export const MAX_COMPACT_WIRE_SPACING = 14;

/**
 * Calcula os corredores horizontais e verticais livres disponíveis no quadro.
 */
export function identifyPanelCorridors(rails = [], infrastructure = [], panelHeight = 820) {
  const horizontalCorridors = [];
  const verticalCorridors = [];

  // Corredor superior (entre bloco de entrada/barramentos e o primeiro trilho)
  const firstRailY = rails.length > 0 ? 190 : 250;
  horizontalCorridors.push({
    id: "corr_top",
    name: "Canaleta Superior",
    minY: 96,
    maxY: firstRailY - 55,
    baseY: snapToGrid(Math.round((96 + (firstRailY - 55)) / 2)),
    minX: 60,
    maxX: PANEL_DESIGN_WIDTH - 60,
  });

  // Corredores entre trilhos consecutivos (Inter-Rail Ducts)
  for (let r = 0; r < rails.length - 1; r++) {
    const railCurrentY = 190 + r * 240;
    const railNextY = 190 + (r + 1) * 240;
    const corridorTop = railCurrentY + 60; // abaixo dos bornes inferiores do trilho r
    const corridorBottom = railNextY - 55; // acima dos bornes superiores do trilho r+1
    const midY = snapToGrid(Math.round((corridorTop + corridorBottom) / 2));

    horizontalCorridors.push({
      id: `corr_rail_${r}_${r + 1}`,
      name: `Canaleta Trilho ${r + 1}-${r + 2}`,
      railIndexAbove: r,
      railIndexBelow: r + 1,
      minY: corridorTop,
      maxY: corridorBottom,
      baseY: midY,
      minX: 60,
      maxX: PANEL_DESIGN_WIDTH - 60,
    });
  }

  // Corredor inferior (abaixo do último trilho, acima do barramento de terra)
  if (rails.length > 0) {
    const lastRailY = 190 + (rails.length - 1) * 240;
    const bottomCorridorTop = lastRailY + 60;
    const bottomCorridorBottom = Math.min(panelHeight - 75, bottomCorridorTop + 85);
    horizontalCorridors.push({
      id: "corr_bottom",
      name: "Canaleta Inferior",
      minY: bottomCorridorTop,
      maxY: bottomCorridorBottom,
      baseY: snapToGrid(Math.round((bottomCorridorTop + bottomCorridorBottom) / 2)),
      minX: 60,
      maxX: PANEL_DESIGN_WIDTH - 60,
    });
  }

  // Canaleta vertical esquerda (à esquerda dos disjuntores DIN)
  verticalCorridors.push({
    id: "corr_vert_left",
    name: "Canaleta Vertical Esquerda",
    minX: 60,
    maxX: RAIL_START_X - 25,
    baseX: snapToGrid(Math.round((60 + (RAIL_START_X - 25)) / 2)),
    minY: 70,
    maxY: panelHeight - 60,
  });

  // Canaleta vertical direita (à direita dos disjuntores DIN)
  const maxCompX = rails.reduce((max, rail) => {
    let currX = RAIL_START_X;
    (rail.components || []).forEach((c) => {
      currX += (Number(c.poles || 1) * DIN_MODULE_WIDTH) + 2;
    });
    return Math.max(max, currX);
  }, RAIL_START_X + 260);

  const rightDuctMinX = Math.max(maxCompX + 25, 720);
  verticalCorridors.push({
    id: "corr_vert_right",
    name: "Canaleta Vertical Direita",
    minX: rightDuctMinX,
    maxX: PANEL_DESIGN_WIDTH - 50,
    baseX: snapToGrid(Math.round((rightDuctMinX + (PANEL_DESIGN_WIDTH - 50)) / 2)),
    minY: 70,
    maxY: panelHeight - 60,
  });

  return { horizontalCorridors, verticalCorridors };
}

/**
 * Extrai o ID do componente a partir de uma string de pino (ex: "comp:gen_brk:top:0" -> "gen_brk").
 */
export function extractComponentIdFromPin(pinId) {
  if (!pinId || typeof pinId !== "string") return null;
  if (pinId.startsWith("comp:")) {
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
    // Escolhe o mais próximo do ponto médio
    betweenCorridors.sort((a, b) => Math.abs(a.baseY - midY) - Math.abs(b.baseY - midY));
    return betweenCorridors[0];
  }

  // Fallback: corredor com menor distância absoluta
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

function obeysTerminalDirections(path, srcDir, dstDir) {
  if (!Array.isArray(path) || path.length < 2) return false;
  if (srcDir === "UP" || srcDir === "DOWN") {
    if (Math.abs(path[1].x - path[0].x) > 0.5) return false;
  } else if (srcDir === "LEFT" || srcDir === "RIGHT") {
    if (Math.abs(path[1].y - path[0].y) > 0.5) return false;
  }
  const last = path.length - 1;
  if (dstDir === "UP" || dstDir === "DOWN") {
    if (Math.abs(path[last - 1].x - path[last].x) > 0.5) return false;
  } else if (dstDir === "LEFT" || dstDir === "RIGHT") {
    if (Math.abs(path[last - 1].y - path[last].y) > 0.5) return false;
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
  const obstaclePadding = Math.max(6, Number(options.obstaclePadding) || OBSTACLE_PADDING);
  const portExitOffset = Math.max(14, Number(options.portExitOffset) || PORT_EXIT_OFFSET);

  // 1. Extração da geometria e obstáculos do painel
  const obstacles = extractPanelObstacles(rails, infrastructure, options);
  const { horizontalCorridors, verticalCorridors } = identifyPanelCorridors(rails, infrastructure, panelHeight);

  // Mapeamento de descritores de cada cabo
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
      color: wire.color || "black",
      gauge: wire.gauge || "2.5mm²",
      conductorType: wire.conductorType || "phase",
      excludedIds,
    });
  });

  // 2. Classificação de cabos por corredor e canal de passagem
  const corridorBuckets = new Map();
  horizontalCorridors.forEach((corr) => {
    corridorBuckets.set(corr.id, []);
  });

  const directWires = [];
  const verticalDuctWires = [];

  wireMetaList.forEach((meta) => {
    if (!meta.isRoutable) return;

    // Se origem e destino são no mesmo X (colineares verticais perfeitos)
    if (Math.abs(meta.p1.x - meta.p2.x) <= 4) {
      directWires.push(meta);
      return;
    }

    // Se a distância horizontal for significativa, atribui ao melhor corredor horizontal
    const bestCorr = findBestHorizontalCorridor(meta.p1, meta.p2, horizontalCorridors);
    if (bestCorr) {
      corridorBuckets.get(bestCorr.id).push(meta);
      meta.assignedCorridor = bestCorr;
    } else {
      directWires.push(meta);
    }
  });

  // 3. Ordenação Inteligente dentro de cada corredor para MINIMIZAR CRUZAMENTOS
  // Cabos que descem para bornes à esquerda ficam nas trilhas mais baixas,
  // permitindo que o cabo saia para baixo sem cruzar os cabos que continuam para a direita.
  corridorBuckets.forEach((bucketWires, corrId) => {
    if (bucketWires.length <= 1) return;

    bucketWires.sort((a, b) => {
      // Prioridade 1: Ordem de fase natural (L1, L2, L3, N, PE)
      const phasePriority = { black: 1, red: 2, brown: 3, orange: 4, blue: 5, green: 6 };
      const prioA = phasePriority[a.color] || 9;
      const prioB = phasePriority[b.color] || 9;

      // Se ambos descem na mesma direção, ordena pelo X de saída (planar sorting)
      const exitXA = a.dstDir === "DOWN" ? a.p2.x : a.p1.x;
      const exitXB = b.dstDir === "DOWN" ? b.p2.x : b.p1.x;

      if (Math.abs(exitXA - exitXB) > 10) {
        return exitXA - exitXB;
      }
      return prioA - prioB;
    });
  });

  // 4. Roteamento Compacto com Alocação de Trilhas Paralelas
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

    // Se o cabo está alocado em um corredor com outros cabos
    if (meta.assignedCorridor) {
      const corr = meta.assignedCorridor;
      const bucketWires = corridorBuckets.get(corr.id) || [];
      const trackIndex = bucketWires.indexOf(meta);
      const totalTracks = bucketWires.length;

      // Centraliza o feixe compacto ao redor de baseY com espaçamento consistente
      const bundleCenterY = snapToGrid(corr.baseY);
      const step = Math.max(6, Math.round(minWireSpacing));
      const trackOffset = (trackIndex - Math.floor(totalTracks / 2)) * step + (totalTracks % 2 === 0 ? Math.floor(step / 2) : 0);
      const laneY = bundleCenterY + trackOffset;

      // Constrói rota ortogonal limpa (Z-Route pelo corredor)
      const stub1Y = meta.srcDir === "UP" ? meta.p1.y - portExitOffset : meta.p1.y + portExitOffset;
      const stub2Y = meta.dstDir === "UP" ? meta.p2.y - portExitOffset : meta.p2.y + portExitOffset;

      const candidatePath = [
        meta.p1,
        { x: meta.p1.x, y: laneY },
        { x: meta.p2.x, y: laneY },
        meta.p2,
      ];

      const cleanCandidate = simplifyOrthogonalPoints(candidatePath);

      // Valida se o feixe compacto não colide com obstáculos
      if (
        isOrthogonalPath(cleanCandidate) &&
        !pathIntersectsObstacles(cleanCandidate, obstacles, obstaclePadding, meta.excludedIds)
      ) {
        calculatedPath = cleanCandidate;
      }
    }

    // Fallback 1: Caso não caiba no corredor direto, usa o roteador ortogonal inteligente
    if (!calculatedPath) {
      calculatedPath = calculateOrthogonalRoute(meta.p1, meta.p2, obstacles, {
        sourceSide: meta.srcDir,
        targetSide: meta.dstDir,
        portExitOffset,
        obstaclePadding,
        sourceComponentId: meta.srcCompId || wire.sourceComponentId,
        targetComponentId: meta.dstCompId || wire.targetComponentId,
        sourcePin: wire.source,
        targetPin: wire.target,
        laneIndex: wireIndex,
      });
    }

    // 5. Passo final de polimento geométrico: elimina curvas desnecessárias
    let polishedPath = removeRedundantOrthogonalBends(
      calculatedPath,
      obstacles,
      obstaclePadding,
      meta.excludedIds,
      { srcDir: meta.srcDir, dstDir: meta.dstDir }
    );
    polishedPath = simplifyOrthogonalPoints(polishedPath);

    // Validação estrita de segurança:
    // Se por qualquer motivo a rota otimizada colidir ou for inválida, preserva a anterior
    const isSafe = isOrthogonalPath(polishedPath) &&
      polishedPath.length >= 2 &&
      arePointsEqual(polishedPath[0], meta.p1, 2) &&
      arePointsEqual(polishedPath[polishedPath.length - 1], meta.p2, 2) &&
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
      route_points: waypointsOnly,
    };
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
