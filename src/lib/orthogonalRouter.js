/**
 * orthogonalRouter.js
 * 
 * Motor centralizado de Roteamento Ortogonal e Persistência Determinística
 * para o Editor de Quadros Elétricos da Nacif Eletric.
 * 
 * Padrões NBR 5410 / NR-10:
 * - Trajetos 100% ortogonais (segmentos horizontais e verticais com curvas de 90°).
 * - Saída e entrada direcionais de bornes/terminais (UP, DOWN, LEFT, RIGHT).
 * - Desvio inteligente de obstáculos (disjuntores, DPS, IDR, barramentos, legendas).
 * - Espaçamento e corredores paralelos para condutores agrupados (L1, L2, L3, N, PE).
 * - Preservação estrita e determinística do estado salvo (Salvar -> Fechar -> Reabrir).
 */

// ─── CONSTANTES GLOBAIS DE ROTEAMENTO E LAYOUT DE PAINEL ─────────────────────
export const ROUTING_GRID_SIZE = 8;
export const PORT_EXIT_OFFSET = 24;
export const OBSTACLE_PADDING = 14;
export const WIRE_SPACING = 12;
export const DEFAULT_CORNER_RADIUS = 8;
export const PANEL_DESIGN_WIDTH = 850;
export const DIN_MODULE_WIDTH = 26;
export const BREAKER_HEIGHT = 110;
export const RAIL_START_X = 160;

export const THREE_PHASE_OUTPUT = {
  x: 54,
  y: 44,
  width: 214,
  height: 38,
  pinStartX: 82,
  pinY: 66,
  pinGap: 34,
};

export const THREE_PHASE_TERMINALS = [
  { index: 0, label: "PE", kind: "ground", fill: "#16a34a" },
  { index: 4, label: "N", kind: "neutral", fill: "#38bdf8" },
  { index: 1, label: "L1", kind: "power", fill: "#111827" },
  { index: 2, label: "L2", kind: "power", fill: "#dc2626" },
  { index: 3, label: "L3", kind: "power", fill: "#7c2d12" },
];

export const NEUTRAL_BUS = {
  x: PANEL_DESIGN_WIDTH - 455,
  y: 62,
  width: 286,
  height: 18,
  pinCount: 12,
  pinGap: 22,
  pinStartX: PANEL_DESIGN_WIDTH - 435,
  pinY: 71,
};

export const GROUND_BUS = {
  x: 240,
  width: 390,
  pinCount: 12,
  pinGap: 30,
  pinStartX: 262,
};

export const getNeutralBusLayout = (infrastructure = []) => {
  const item = (infrastructure || []).find((entry) => entry?.id === "neutral-bus") || {};
  const width = Math.max(180, Math.min(520, Number(item.width) || NEUTRAL_BUS.width));
  const rawX = Number(item.x);
  const rawY = Number(item.y);
  const x = Math.max(20, Math.min(PANEL_DESIGN_WIDTH - width - 20, Number.isFinite(rawX) ? rawX : NEUTRAL_BUS.x));
  const y = Math.max(20, Number.isFinite(rawY) ? rawY : NEUTRAL_BUS.y);
  const pinGap = Math.max(14, Math.min(32, (width - 40) / Math.max(1, NEUTRAL_BUS.pinCount - 1)));

  return {
    x,
    y,
    width,
    height: NEUTRAL_BUS.height,
    pinStartX: x + 20,
    pinY: y + (NEUTRAL_BUS.pinY - NEUTRAL_BUS.y),
    pinGap,
  };
};

export const getGroundBusLayout = (infrastructure = [], panelH = 820) => {
  const item = (infrastructure || []).find((entry) => entry?.id === "ground-bus") || {};
  const width = Math.max(260, Math.min(520, Number(item.width) || GROUND_BUS.width));
  const rawX = Number(item.x ?? item.busX);
  const rawY = Number(item.y);
  const x = Math.max(20, Math.min(PANEL_DESIGN_WIDTH - width - 20, Number.isFinite(rawX) ? rawX : GROUND_BUS.x));
  const y = Math.max(20, Math.min(panelH - 44, Number.isFinite(rawY) ? rawY : (panelH - 68)));
  const pinGap = Math.max(20, Math.min(38, (width - 60) / Math.max(1, GROUND_BUS.pinCount - 1)));

  return {
    x,
    y,
    width,
    pinStartX: x + 22,
    pinY: y + 14,
    pinGap,
  };
};

export const getThreePhaseOutputPin = (terminalIndex = 0) => {
  const index = Number(terminalIndex);
  const terminalSlot = index === 4
    ? 1
    : index > 0
      ? index + 1
      : 0;
  const safeIndex = Math.max(0, Math.min(4, Number.isFinite(terminalSlot) ? terminalSlot : 0));
  return {
    x: THREE_PHASE_OUTPUT.pinStartX + safeIndex * THREE_PHASE_OUTPUT.pinGap,
    y: THREE_PHASE_OUTPUT.pinY,
  };
};

// ─── UTILITÁRIOS GEOMÉTRICOS BÁSICOS ──────────────────────────────────────────

export const snapToGrid = (val, gridSize = ROUTING_GRID_SIZE) => (
  Math.round((Number(val) || 0) / gridSize) * gridSize
);

export const clampCoord = (val, min, max) => Math.max(min, Math.min(max, Number(val) || 0));

export const arePointsEqual = (p1, p2, tolerance = 0.5) => (
  Boolean(p1 && p2)
  && Math.abs((Number(p1.x) || 0) - (Number(p2.x) || 0)) <= tolerance
  && Math.abs((Number(p1.y) || 0) - (Number(p2.y) || 0)) <= tolerance
);

/**
 * Remove pontos duplicados consecutivos e pontos colineares intermediários.
 * Garante que a lista de waypoints contenha apenas os vértices reais de 90°.
 */
export const simplifyOrthogonalPoints = (points = [], epsilon = 0.5) => {
  if (!Array.isArray(points) || points.length < 2) return points || [];

  // Passo 1: Remover duplicados consecutivos e normalizar coordenadas numéricas
  const deduped = [];
  for (let i = 0; i < points.length; i++) {
    const raw = points[i];
    if (!raw || !Number.isFinite(Number(raw.x)) || !Number.isFinite(Number(raw.y))) continue;
    const pt = { x: Math.round(Number(raw.x)), y: Math.round(Number(raw.y)) };
    if (deduped.length === 0) {
      deduped.push(pt);
    } else {
      const prev = deduped[deduped.length - 1];
      if (!arePointsEqual(prev, pt, epsilon)) {
        deduped.push(pt);
      }
    }
  }

  if (deduped.length < 3) return deduped;

  // Passo 2: Eliminar pontos colineares (mesma linha horizontal ou vertical)
  let simplified = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];

    const isCollinearX = Math.abs(prev.x - curr.x) <= epsilon && Math.abs(curr.x - next.x) <= epsilon;
    const isCollinearY = Math.abs(prev.y - curr.y) <= epsilon && Math.abs(curr.y - next.y) <= epsilon;

    if (!isCollinearX && !isCollinearY) {
      simplified.push(curr);
    }
  }
  simplified.push(deduped[deduped.length - 1]);

  // Passo 3: Limpeza de pequenos zig-zags ou retrocessos de 180°
  const cleaned = [];
  for (let i = 0; i < simplified.length; i++) {
    const pt = simplified[i];
    if (cleaned.length >= 2) {
      const pPrev1 = cleaned[cleaned.length - 1];
      const pPrev2 = cleaned[cleaned.length - 2];
      // Se vai e volta no mesmo eixo (ex: (10, 20) -> (50, 20) -> (10, 20))
      if (
        (Math.abs(pPrev2.y - pPrev1.y) <= epsilon && Math.abs(pPrev1.y - pt.y) <= epsilon && Math.sign(pPrev1.x - pPrev2.x) === -Math.sign(pt.x - pPrev1.x))
        || (Math.abs(pPrev2.x - pPrev1.x) <= epsilon && Math.abs(pPrev1.x - pt.x) <= epsilon && Math.sign(pPrev1.y - pPrev2.y) === -Math.sign(pt.y - pPrev1.y))
      ) {
        cleaned.pop(); // remove o ponto do meio redundante
      }
    }
    cleaned.push(pt);
  }

  return cleaned.length >= 2 ? cleaned : deduped;
};

/**
 * Verifica se todos os segmentos entre pontos consecutivos são estritamente ortogonais.
 */
export const isOrthogonalPath = (points = [], epsilon = 0.5) => {
  if (!Array.isArray(points) || points.length < 2) return true;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    if (!p1 || !p2 || !Number.isFinite(p1.x) || !Number.isFinite(p1.y) || !Number.isFinite(p2.x) || !Number.isFinite(p2.y)) return false;
    const isHorizontal = Math.abs(p1.y - p2.y) <= epsilon;
    const isVertical = Math.abs(p1.x - p2.x) <= epsilon;
    if (!isHorizontal && !isVertical) return false;
  }
  return true;
};

// ─── VERIFICAÇÃO DE COLISÃO COM OBSTÁCULOS ────────────────────────────────────

/**
 * Checa se um segmento ortogonal (horizontal ou vertical) intersecta uma caixa de obstáculo.
 */
export const segmentIntersectsBox = (p1, p2, box, padding = 0) => {
  if (!box) return false;
  const minX = (box.x || 0) - padding;
  const maxX = (box.x || 0) + (box.width || 0) + padding;
  const minY = (box.y || 0) - padding;
  const maxY = (box.y || 0) + (box.height || 0) + padding;

  const segMinX = Math.min(p1.x, p2.x);
  const segMaxX = Math.max(p1.x, p2.x);
  const segMinY = Math.min(p1.y, p2.y);
  const segMaxY = Math.max(p1.y, p2.y);

  // Segmento fora do bounding box da caixa
  if (segMaxX < minX || segMinX > maxX || segMaxY < minY || segMinY > maxY) {
    return false;
  }

  // Segmento Horizontal
  if (Math.abs(p1.y - p2.y) <= 0.5) {
    const y = p1.y;
    if (y > minY && y < maxY) {
      return segMaxX > minX && segMinX < maxX;
    }
    return false;
  }

  // Segmento Vertical
  if (Math.abs(p1.x - p2.x) <= 0.5) {
    const x = p1.x;
    if (x > minX && x < maxX) {
      return segMaxY > minY && segMinY < maxY;
    }
    return false;
  }

  return true; // Segmento diagonal intersecta
};

/**
 * Checa se uma rota completa de segmentos ortogonais colide com algum obstáculo.
 */
export const pathIntersectsObstacles = (points = [], obstacles = [], padding = OBSTACLE_PADDING, excludedIds = new Set()) => {
  if (!Array.isArray(points) || points.length < 2) return false;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    for (const obs of obstacles) {
      if (obs?.id && excludedIds.has(String(obs.id))) continue;
      if (segmentIntersectsBox(p1, p2, obs, padding)) return true;
    }
  }
  return false;
};

// ─── EXTRAÇÃO DE OBSTÁCULOS DO QUADRO ──────────────────────────────────────────

/**
 * Extrai bounding boxes de todos os componentes e infraestruturas do quadro.
 */
export const extractPanelObstacles = (rails = [], infrastructure = [], options = {}) => {
  const obstacles = [];

  // Componentes dos trilhos (disjuntores, DPS, IDR, bornes)
  (rails || []).forEach((rail, railIndex) => {
    const railY = 190 + railIndex * 240;
    let currentX = RAIL_START_X;

    (rail.components || []).forEach((comp) => {
      const poles = Number(comp.poles || 1);
      const width = poles * DIN_MODULE_WIDTH;
      if (comp.type !== "spacer") {
        obstacles.push({
          id: comp.id,
          type: comp.type || "component",
          railIndex,
          x: currentX,
          y: railY - 45,
          width,
          height: BREAKER_HEIGHT,
        });
      }
      currentX += width + 2;
    });
  });

  // Infraestruturas relevantes (barramentos, pentes, etc.)
  (infrastructure || []).forEach((item) => {
    if (item && !item.deleted && item.type !== "annotation") {
      obstacles.push({
        id: item.id || `infra_${Math.random()}`,
        type: item.type || "infrastructure",
        x: item.x || 0,
        y: item.y || 0,
        width: item.width || 100,
        height: item.height || 40,
      });
    }
  });

  return obstacles;
};

// ─── INFERÊNCIA DE DIREÇÃO DE SAÍDA DO TERMINAL ────────────────────────────────

/**
 * Determina a direção preferencial de saída do pino/borne.
 */
export const inferTerminalDirection = (pinId = "", point = { x: 0, y: 0 }, rails = [], panelHeight = 820) => {
  const pin = String(pinId || "").toLowerCase();

  // Terminais superiores de disjuntor/componente
  if (pin.includes(":top:") || pin.includes("_top") || pin.endsWith(":top")) {
    return "UP";
  }

  // Terminais inferiores de disjuntor/componente
  if (pin.includes(":bottom:") || pin.includes("_bottom") || pin.endsWith(":bottom")) {
    return "DOWN";
  }

  // Saídas de carga (vai para circuito)
  if (pin.startsWith("load_out:")) {
    return "DOWN";
  }

  // Barramento superior de neutro
  if (pin.startsWith("busbar_neutral:")) {
    return "DOWN";
  }

  // Barramento inferior de aterramento (PE)
  if (pin.startsWith("busbar_ground:")) {
    return "UP";
  }

  // Bloco de entrada trifásica no topo esquerdo
  if (pin.startsWith("terminal_left_top:")) {
    return "DOWN";
  }

  // Fallback baseado na coordenada Y
  if (point.y < 150) return "DOWN";
  if (point.y > panelHeight - 150) return "UP";

  return "DOWN";
};

// ─── ROTEADOR ORTOGONAL AUTOMÁTICO ─────────────────────────────────────────────

/**
 * calculateOrthogonalRoute(source, target, obstacles, options)
 * 
 * Função centralizada para cálculo de caminhos 100% ortogonais,
 * com desvio de obstáculos e suporte a corredores e espaçamento de cabos paralelos.
 */
export const calculateOrthogonalRoute = (source, target, obstacles = [], options = {}) => {
  if (!source || !target || !Number.isFinite(source.x) || !Number.isFinite(source.y) || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    return [];
  }

  const pSrc = { x: Math.round(source.x), y: Math.round(source.y) };
  const pDst = { x: Math.round(target.x), y: Math.round(target.y) };

  // Se origem e destino forem idênticos
  if (arePointsEqual(pSrc, pDst)) {
    return [pSrc, pDst];
  }

  const portExitOffset = Math.max(8, Number(options.portExitOffset) || PORT_EXIT_OFFSET);
  const obstaclePadding = Math.max(4, Number(options.obstaclePadding) || OBSTACLE_PADDING);
  const laneOffset = Number(options.laneOffset) || 0;
  const sourceSide = options.sourceSide || "auto";
  const targetSide = options.targetSide || "auto";

  // Identificadores de componentes de origem e destino a excluir da colisão de saída imediata
  const excludedIds = new Set();
  if (options.sourceComponentId) excludedIds.add(String(options.sourceComponentId));
  if (options.targetComponentId) excludedIds.add(String(options.targetComponentId));
  if (options.sourcePin) {
    const match = String(options.sourcePin).match(/comp:([^:]+)/);
    if (match) excludedIds.add(match[1]);
  }
  if (options.targetPin) {
    const match = String(options.targetPin).match(/comp:([^:]+)/);
    if (match) excludedIds.add(match[1]);
  }

  // Determinação dos vetores de saída
  const getExitVector = (side, src, dst) => {
    if (side === "UP") return { x: 0, y: -1 };
    if (side === "DOWN") return { x: 0, y: 1 };
    if (side === "LEFT") return { x: -1, y: 0 };
    if (side === "RIGHT") return { x: 1, y: 0 };
    // auto
    if (Math.abs(src.y - dst.y) > Math.abs(src.x - dst.x)) {
      return src.y <= dst.y ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
    return src.x <= dst.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
  };

  const srcVec = getExitVector(sourceSide, pSrc, pDst);
  const dstVec = getExitVector(targetSide, pDst, pSrc);

  const startStub = {
    x: pSrc.x + srcVec.x * portExitOffset,
    y: pSrc.y + srcVec.y * portExitOffset,
  };

  const endStub = {
    x: pDst.x + dstVec.x * portExitOffset,
    y: pDst.y + dstVec.y * portExitOffset,
  };

  // Se os stubs forem colineares e sem obstáculos no meio (linha reta direta)
  if (startStub.x === endStub.x || startStub.y === endStub.y) {
    const directCandidate = [pSrc, startStub, endStub, pDst];
    if (!pathIntersectsObstacles([startStub, endStub], obstacles, obstaclePadding, excludedIds)) {
      return simplifyOrthogonalPoints(directCandidate);
    }
  }

  // GERAÇÃO DE CANDIDATOS ORTOGONAIS (H-V, V-H, V-H-V, H-V-H)
  const candidateRoutes = [];

  // Corredores padrão do painel
  const leftCorridorX = snapToGrid(Math.max(48, 80)) + laneOffset;
  const rightCorridorX = snapToGrid(Math.min(PANEL_DESIGN_WIDTH - 48, 760)) + laneOffset;
  const midCorridorY = snapToGrid((startStub.y + endStub.y) / 2) + laneOffset;

  // 1. Rota Z vertical (Vertical -> Horizontal -> Vertical com laneOffset)
  const zVertical = [
    pSrc,
    startStub,
    { x: startStub.x, y: midCorridorY },
    { x: endStub.x, y: midCorridorY },
    endStub,
    pDst,
  ];
  candidateRoutes.push(zVertical);

  // 2. Rota Z horizontal (Horizontal -> Vertical -> Horizontal)
  const midCorridorX = snapToGrid((startStub.x + endStub.x) / 2) + laneOffset;
  const zHorizontal = [
    pSrc,
    startStub,
    { x: midCorridorX, y: startStub.y },
    { x: midCorridorX, y: endStub.y },
    endStub,
    pDst,
  ];
  candidateRoutes.push(zHorizontal);

  // 3. Rota pelo canal esquerdo (Left Duct)
  const viaLeft = [
    pSrc,
    startStub,
    { x: leftCorridorX, y: startStub.y },
    { x: leftCorridorX, y: endStub.y },
    endStub,
    pDst,
  ];
  candidateRoutes.push(viaLeft);

  // 4. Rota pelo canal direito (Right Duct)
  const viaRight = [
    pSrc,
    startStub,
    { x: rightCorridorX, y: startStub.y },
    { x: rightCorridorX, y: endStub.y },
    endStub,
    pDst,
  ];
  candidateRoutes.push(viaRight);

  // 5. Rota L simples (Vertical -> Horizontal)
  const lVerticalFirst = [
    pSrc,
    startStub,
    { x: startStub.x, y: endStub.y },
    endStub,
    pDst,
  ];
  candidateRoutes.push(lVerticalFirst);

  // 6. Rota L simples (Horizontal -> Vertical)
  const lHorizontalFirst = [
    pSrc,
    startStub,
    { x: endStub.x, y: startStub.y },
    endStub,
    pDst,
  ];
  candidateRoutes.push(lHorizontalFirst);

  // 7. Rotas de desvio explícito ao redor de cada obstáculo (Bypass Above / Below / Left / Right)
  obstacles.forEach((obs) => {
    if (obs?.id && excludedIds.has(String(obs.id))) return;
    const pad = obstaclePadding + 8;
    const yAbove = snapToGrid((obs.y || 0) - pad + laneOffset);
    const yBelow = snapToGrid((obs.y || 0) + (obs.height || 0) + pad + laneOffset);
    const xLeft = snapToGrid((obs.x || 0) - pad + laneOffset);
    const xRight = snapToGrid((obs.x || 0) + (obs.width || 0) + pad + laneOffset);

    if (yAbove > 30) {
      candidateRoutes.push([
        pSrc,
        startStub,
        { x: startStub.x, y: yAbove },
        { x: endStub.x, y: yAbove },
        endStub,
        pDst,
      ]);
    }
    if (yBelow < 1200) {
      candidateRoutes.push([
        pSrc,
        startStub,
        { x: startStub.x, y: yBelow },
        { x: endStub.x, y: yBelow },
        endStub,
        pDst,
      ]);
    }
    if (xLeft > 30) {
      candidateRoutes.push([
        pSrc,
        startStub,
        { x: xLeft, y: startStub.y },
        { x: xLeft, y: endStub.y },
        endStub,
        pDst,
      ]);
    }
    if (xRight < PANEL_DESIGN_WIDTH - 30) {
      candidateRoutes.push([
        pSrc,
        startStub,
        { x: xRight, y: startStub.y },
        { x: xRight, y: endStub.y },
        endStub,
        pDst,
      ]);
    }
  });

  // Avalia candidatos por pontuação: sem colisão + menor comprimento + menor número de cantos
  let bestRoute = null;
  let bestScore = Infinity;

  for (const rawCandidate of candidateRoutes) {
    const simplified = simplifyOrthogonalPoints(rawCandidate);
    if (!isOrthogonalPath(simplified) || simplified.length < 2) continue;

    const hasCollision = pathIntersectsObstacles(simplified, obstacles, obstaclePadding, excludedIds);
    let length = 0;
    for (let i = 1; i < simplified.length; i++) {
      length += Math.hypot(simplified[i].x - simplified[i - 1].x, simplified[i].y - simplified[i - 1].y);
    }
    const corners = Math.max(0, simplified.length - 2);
    const score = (hasCollision ? 1000000 : 0) + length + corners * 50;

    if (score < bestScore) {
      bestScore = score;
      bestRoute = simplified;
    }
  }

  // Se nenhum candidato simples desviou de todos os obstáculos, executa A* em Grid Ortogonal
  if (bestScore >= 100000) {
    const aStarRoute = findAStarOrthogonalRoute(pSrc, pDst, startStub, endStub, obstacles, obstaclePadding, excludedIds, laneOffset);
    if (aStarRoute && aStarRoute.length >= 2) {
      return simplifyOrthogonalPoints(aStarRoute);
    }
  }

  return bestRoute || simplifyOrthogonalPoints(zVertical);
};

// ─── ALGORITMO A* EM GRID ORTOGONAL PARA CASOS COMPLEXOS ──────────────────────

function findAStarOrthogonalRoute(pSrc, pDst, startStub, endStub, obstacles, padding, excludedIds, laneOffset) {
  // Constrói conjunto de coordenadas X e Y significativas
  const xCoords = new Set([startStub.x, endStub.x, 80 + laneOffset, 760 + laneOffset]);
  const yCoords = new Set([startStub.y, endStub.y, snapToGrid((startStub.y + endStub.y) / 2 + laneOffset)]);

  // Adiciona bordas dos obstáculos expandidas com padding
  obstacles.forEach((obs) => {
    if (obs?.id && excludedIds.has(String(obs.id))) return;
    const minX = snapToGrid((obs.x || 0) - padding);
    const maxX = snapToGrid((obs.x || 0) + (obs.width || 0) + padding);
    const minY = snapToGrid((obs.y || 0) - padding);
    const maxY = snapToGrid((obs.y || 0) + (obs.height || 0) + padding);

    if (minX > 30 && minX < PANEL_DESIGN_WIDTH - 30) xCoords.add(minX);
    if (maxX > 30 && maxX < PANEL_DESIGN_WIDTH - 30) xCoords.add(maxX);
    if (minY > 30) yCoords.add(minY);
    if (maxY > 30) yCoords.add(maxY);
  });

  const sortedX = Array.from(xCoords).sort((a, b) => a - b);
  const sortedY = Array.from(yCoords).sort((a, b) => a - b);

  // A* Search
  const startKey = `${startStub.x},${startStub.y}`;
  const targetKey = `${endStub.x},${endStub.y}`;

  const openSet = new Set([startKey]);
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(startKey, 0);
  fScore.set(startKey, Math.abs(startStub.x - endStub.x) + Math.abs(startStub.y - endStub.y));

  const pointMap = new Map();
  sortedX.forEach((x) => {
    sortedY.forEach((y) => {
      pointMap.set(`${x},${y}`, { x, y });
    });
  });

  let iterations = 0;
  while (openSet.size > 0 && iterations < 300) {
    iterations++;
    // Pega nó com menor fScore
    let currentKey = null;
    let lowestF = Infinity;
    for (const key of openSet) {
      const f = fScore.get(key) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        currentKey = key;
      }
    }

    if (!currentKey) break;
    if (currentKey === targetKey) {
      // Reconstrói caminho
      const path = [pDst, endStub];
      let curr = targetKey;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr);
        path.unshift(pointMap.get(curr));
      }
      path.unshift(pSrc);
      return path;
    }

    openSet.delete(currentKey);
    const currentPt = pointMap.get(currentKey);
    if (!currentPt) continue;

    // Vizinhos ortogonais ao longo das linhas do grid
    const neighbors = [];
    const currXIdx = sortedX.indexOf(currentPt.x);
    const currYIdx = sortedY.indexOf(currentPt.y);

    if (currXIdx > 0) neighbors.push(pointMap.get(`${sortedX[currXIdx - 1]},${currentPt.y}`));
    if (currXIdx < sortedX.length - 1) neighbors.push(pointMap.get(`${sortedX[currXIdx + 1]},${currentPt.y}`));
    if (currYIdx > 0) neighbors.push(pointMap.get(`${currentPt.x},${sortedY[currYIdx - 1]}`));
    if (currYIdx < sortedY.length - 1) neighbors.push(pointMap.get(`${currentPt.x},${sortedY[currYIdx + 1]}`));

    for (const neighbor of neighbors) {
      if (!neighbor) continue;
      // Checa colisão no segmento do vizinho
      if (pathIntersectsObstacles([currentPt, neighbor], obstacles, padding, excludedIds)) {
        continue;
      }

      const neighborKey = `${neighbor.x},${neighbor.y}`;
      const dist = Math.abs(currentPt.x - neighbor.x) + Math.abs(currentPt.y - neighbor.y);
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + dist;

      if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentativeG);
        const h = Math.abs(neighbor.x - endStub.x) + Math.abs(neighbor.y - endStub.y);
        fScore.set(neighborKey, tentativeG + h);
        openSet.add(neighborKey);
      }
    }
  }

  return null;
}

// ─── NORMALIZAÇÃO E MIGRAÇÃO DE QUADRO SALVO ──────────────────────────────────

/**
 * Normaliza e migra qualquer quadro (legado ou recém-criado) para a estrutura
 * estável determinística. Garante que:
 * - Todos os elementos tenham IDs estáveis e únicos.
 * - Todos os cabos tenham rotas ortogonais computadas e salvas em `route` e `route_points`.
 * - Nenhuma rota válida pré-existente seja sobrescrita sem necessidade.
 */
export const normalizeSavedBoard = (savedBoard = {}, project = null, options = {}) => {
  if (!savedBoard || typeof savedBoard !== "object") return null;

  const boardId = savedBoard.id || `board_${Date.now()}`;
  const boardName = savedBoard.name || "QD-01 Principal";
  const boardType = savedBoard.type || "principal";
  const supplyType = savedBoard.supply_type || project?.supply_type || "Monofásico";

  const rawLayout = savedBoard.layout || {};
  const rails = Array.isArray(rawLayout.rails) ? rawLayout.rails : [];
  const rawWires = Array.isArray(rawLayout.wires) ? rawLayout.wires : [];
  const infrastructure = Array.isArray(rawLayout.infrastructure) ? rawLayout.infrastructure : [];

  // 1. Normalizar componentes em cada trilho com IDs estáveis
  const normalizedRails = rails.map((rail, railIndex) => ({
    id: rail.id || `rail_${railIndex + 1}`,
    name: rail.name || `Trilho DIN ${railIndex + 1}`,
    components: (rail.components || []).map((comp, compIndex) => {
      const poles = Math.max(1, Number(comp.poles || comp.dinSize || comp.moduleWidth || 1));
      const compId = comp.id || (comp.type === "spacer" ? `spacer_${railIndex}_${compIndex}` : `comp_${railIndex}_${compIndex}`);
      return {
        ...comp,
        id: compId,
        type: comp.type || "breaker",
        poles,
        dinSize: poles,
        moduleWidth: poles,
        railId: rail.id || `rail_${railIndex + 1}`,
        status: comp.status || "ON",
      };
    }),
  }));

  const panelHeight = 180 + normalizedRails.length * 240 + 100;
  const obstacles = extractPanelObstacles(normalizedRails, infrastructure);

  // 2. Normalizar fiação com rotas ortogonais preservadas ou geradas deterministamente
  const normalizedWires = rawWires.map((wire, wireIndex) => {
    const wireId = wire.id || `wire_${Date.now()}_${wireIndex}`;
    const source = String(wire.source || "");
    const target = String(wire.target || "");
    const color = wire.color || "black";
    const gauge = wire.gauge || "2.5mm²";
    const conductorType = wire.conductorType || (color === "blue" ? "neutral" : color === "green" ? "ground" : "phase");

    const p1 = resolvePinPosition(source, normalizedRails, panelHeight, infrastructure);
    const p2 = resolvePinPosition(target, normalizedRails, panelHeight, infrastructure);

    // Verifica se já possui rota válida salva e estritamente ortogonal
    const candidateRoute = Array.isArray(wire.route?.points) && wire.route.points.length >= 2
      ? wire.route.points
      : Array.isArray(wire.route_points) && wire.route_points.length > 0 && p1 && p2
        ? [p1, ...wire.route_points, p2]
        : null;

    const hasValidSavedRoute = !options.forceRecalculate
      && candidateRoute
      && candidateRoute.length >= 2
      && isOrthogonalPath(candidateRoute);

    let routePoints = hasValidSavedRoute ? candidateRoute : null;

    // Se não tiver rota válida salva, calcula rota ortogonal padrão
    if ((!routePoints || routePoints.length < 2) && p1 && p2) {
      const sourceSide = inferTerminalDirection(source, p1, normalizedRails, panelHeight);
      const targetSide = inferTerminalDirection(target, p2, normalizedRails, panelHeight);

      // Deslocamento de faixa para fases paralelas (L1, L2, L3)
      const laneOffset = color === "black" ? -WIRE_SPACING : color === "brown" || color === "orange" ? WIRE_SPACING : 0;

      routePoints = calculateOrthogonalRoute(p1, p2, obstacles, {
        sourceSide,
        targetSide,
        laneOffset,
        sourcePin: source,
        targetPin: target,
      });
    }

    const cleanPoints = routePoints && routePoints.length >= 2 ? simplifyOrthogonalPoints(routePoints) : [];
    const waypointsOnly = cleanPoints.length > 2 ? cleanPoints.slice(1, -1) : [];

    return {
      ...wire,
      id: wireId,
      source,
      target,
      sourceComponentId: wire.sourceComponentId || extractComponentIdFromPin(source),
      sourcePortId: wire.sourcePortId || source,
      targetComponentId: wire.targetComponentId || extractComponentIdFromPin(target),
      targetPortId: wire.targetPortId || target,
      conductorType,
      color,
      gauge,
      name: wire.name || wire.label || `Condutor ${wireIndex + 1}`,
      route: {
        mode: "orthogonal",
        points: cleanPoints,
      },
      route_points: waypointsOnly,
      lineStyle: wire.lineStyle || "solid",
      cornerRadius: Number.isFinite(wire.cornerRadius) ? wire.cornerRadius : DEFAULT_CORNER_RADIUS,
      locked: Boolean(wire.locked),
      visible: wire.visible !== false,
    };
  });

  return {
    ...savedBoard,
    id: boardId,
    name: boardName,
    type: boardType,
    supply_type: supplyType,
    layout: {
      ...rawLayout,
      rails: normalizedRails,
      wires: normalizedWires,
      infrastructure,
      meta: {
        ...(rawLayout.meta || {}),
        manualDeviceEdits: true, // Garante que reaberturas futuras não redefinam o layout
        savedAt: new Date().toISOString(),
        version: "2.0-orthogonal",
      },
    },
  };
};

// ─── RESOLUÇÃO DE COORDENADAS DE PINOS ────────────────────────────────────────

export const resolvePinPosition = (pinId = "", rails = [], panelHeight = 820, infrastructure = []) => {
  if (!pinId) return null;
  const pin = String(pinId).trim();

  // Pino solto com coordenadas embutidas
  if (pin.startsWith("loose:")) {
    const parts = pin.split(":");
    return { x: Number(parts[1]) || 0, y: Number(parts[2]) || 0 };
  }

  // Bloco de entrada trifásica no topo esquerdo (PE, N, L1, L2, L3)
  if (pin.startsWith("terminal_left_top:")) {
    const idx = parseInt(pin.split(":")[1], 10) || 0;
    return getThreePhaseOutputPin(idx);
  }

  // Barramento de neutro superior
  if (pin.startsWith("busbar_neutral:")) {
    const idx = parseInt(pin.split(":")[1], 10) || 0;
    const neutralBus = getNeutralBusLayout(infrastructure);
    return {
      x: neutralBus.pinStartX + (Math.abs(idx) % NEUTRAL_BUS.pinCount) * neutralBus.pinGap,
      y: neutralBus.pinY,
    };
  }

  // Barramento de proteção terra inferior
  if (pin.startsWith("busbar_ground:")) {
    const idx = parseInt(pin.split(":")[1], 10) || 0;
    const groundBus = getGroundBusLayout(infrastructure, panelHeight);
    return {
      x: groundBus.pinStartX + (Math.abs(idx) % GROUND_BUS.pinCount) * groundBus.pinGap,
      y: groundBus.pinY,
    };
  }

  if (pin === "backbone_ground:start") {
    return { x: 74, y: THREE_PHASE_OUTPUT.pinY };
  }

  if (pin === "backbone_ground:end") {
    const groundBus = getGroundBusLayout(infrastructure, panelHeight);
    return { x: groundBus.x + groundBus.width - 18, y: groundBus.pinY };
  }

  // Saídas de carga (vai para circuito)
  if (pin.startsWith("load_out:")) {
    const parts = pin.split(":");
    const compId = parts[1];
    const poleToken = parts[2] || "0";
    const circuitMatch = String(compId || "").match(/circuit_(\d+)/i);
    const outputIndex = circuitMatch ? Number(circuitMatch[1]) : 0;

    for (let rIdx = 0; rIdx < rails.length; rIdx++) {
      const rail = rails[rIdx];
      const railY = 190 + rIdx * 240;
      let currentX = RAIL_START_X;

      for (const comp of rail.components || []) {
        const compW = (comp.poles || 1) * DIN_MODULE_WIDTH;
        if (comp.id === compId || comp.circuit_id === compId) {
          const poleIdx = parseInt(poleToken, 10) || 0;
          const terminalX = currentX + poleIdx * DIN_MODULE_WIDTH + DIN_MODULE_WIDTH / 2;

          if (poleToken === "neutral") {
            return { x: terminalX, y: snapToGrid(railY + 136 + (outputIndex % 4) * 6) };
          }
          if (poleToken === "ground") {
            return { x: PANEL_DESIGN_WIDTH - 140, y: snapToGrid(panelHeight - 240 + outputIndex * 16) };
          }
          return { x: terminalX, y: snapToGrid(railY + 132 + (poleIdx % 2) * 8) };
        }
        currentX += compW + 2;
      }
    }

    return { x: PANEL_DESIGN_WIDTH - 94, y: panelHeight - 118 };
  }

  // Bornes de componentes em trilhos (Disjuntores, DPS, IDR, Bornes SAK)
  if (pin.startsWith("comp:")) {
    const parts = pin.split(":");
    const compId = parts[1];
    const termType = parts[2]; // "top" | "bottom"
    const poleIdx = parseInt(parts[3] || "0", 10);

    for (let rIdx = 0; rIdx < rails.length; rIdx++) {
      const rail = rails[rIdx];
      const railY = 190 + rIdx * 240;
      let currentX = RAIL_START_X;

      for (const comp of rail.components || []) {
        const compW = (comp.poles || 1) * DIN_MODULE_WIDTH;
        if (comp.id === compId) {
          // Bornes SAK possuem 14px de largura com centro em x + 7
          if (comp.type === "borne") {
            const x = currentX + 7;
            const y = termType === "top" ? railY - 27 : railY + 47;
            return { x, y };
          }
          // Disjuntores, DPS e IDRs possuem módulos de 26px com centro do polo em px + 13
          const x = currentX + poleIdx * DIN_MODULE_WIDTH + DIN_MODULE_WIDTH / 2;
          const y = termType === "top" ? railY - 31 : railY + 51;
          return { x, y };
        }
        currentX += compW + 2;
      }
    }

    // Fallback gracioso para alimentador geral caso gen_brk / gen_dr não esteja no trilho
    if (compId === "gen_brk" || compId === "gen_dr" || compId?.startsWith("gen_")) {
      return getThreePhaseOutputPin(poleIdx + 1);
    }

    return null;
  }

  // Mapeamentos de compatibilidade para referências legadas
  if (pin === "PE" || pin === "ground" || pin === "terra") {
    return getThreePhaseOutputPin(0);
  }
  if (pin === "N" || pin === "neutral" || pin === "neutro") {
    return getThreePhaseOutputPin(4);
  }
  if (pin === "L1" || pin === "phase_A" || pin === "fase_A") {
    return getThreePhaseOutputPin(1);
  }
  if (pin === "L2" || pin === "phase_B" || pin === "fase_B") {
    return getThreePhaseOutputPin(2);
  }
  if (pin === "L3" || pin === "phase_C" || pin === "fase_C") {
    return getThreePhaseOutputPin(3);
  }

  return null;
};

export const resolveTerminalPosition = resolvePinPosition;

const extractComponentIdFromPin = (pinId = "") => {
  const match = String(pinId).match(/^comp:([^:]+)/);
  if (match) return match[1];
  const loadMatch = String(pinId).match(/^load_out:([^:]+)/);
  if (loadMatch) return loadMatch[1];
  return "";
};
