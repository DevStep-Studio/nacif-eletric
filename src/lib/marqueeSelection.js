/**
 * marqueeSelection.js — Motor Matemático de Seleção Retangular (AABB) e Exclusão em Massa
 * Nacif Electric · CAD/Vector Engine para Montagem de Quadros Elétricos
 * 
 * Implementa:
 * - Normalização e Geometria AABB (Axis-Aligned Bounding Box)
 * - Interseção AABB x AABB (Componentes nos trilhos DIN)
 * - Interseção Segmento Ortogonal / Reta x AABB (Fiações e Cabos)
 * - Detecção em Massa de Colisão e Contenção
 * - Operação Atômica de Exclusão em Massa (Batch Delete)
 */

export const MOD = 26; // 1 Módulo DIN = 26px
export const BRK_H = 110; // Altura padrão do disjuntor em px
export const RAIL_COMPONENT_START_X = 160;

/**
 * Normaliza dois pontos para uma caixa delimitadora (AABB).
 * @param {{x: number, y: number}} p1 Ponto inicial
 * @param {{x: number, y: number}} p2 Ponto final
 * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, height: number}}
 */
export function normalizeAABB(p1, p2) {
  const minX = Math.min(Number(p1?.x) || 0, Number(p2?.x) || 0);
  const maxX = Math.max(Number(p1?.x) || 0, Number(p2?.x) || 0);
  const minY = Math.min(Number(p1?.y) || 0, Number(p2?.y) || 0);
  const maxY = Math.max(Number(p1?.y) || 0, Number(p2?.y) || 0);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Verifica se um ponto 2D está contido dentro da AABB.
 */
export function isPointInsideAABB(point, aabb) {
  if (!point || !aabb) return false;
  return (
    point.x >= aabb.minX &&
    point.x <= aabb.maxX &&
    point.y >= aabb.minY &&
    point.y <= aabb.maxY
  );
}

/**
 * Verifica colisão ou sobreposição entre duas caixas delimitadoras (AABB x AABB).
 */
export function doesAABBOverlap(boxA, boxB) {
  if (!boxA || !boxB) return false;
  return !(
    boxA.maxX < boxB.minX ||
    boxA.minX > boxB.maxX ||
    boxA.maxY < boxB.minY ||
    boxA.minY > boxB.maxY
  );
}

/**
 * Verifica se um segmento de linha [p1, p2] intercepta ou está contido na AABB.
 * Otimizado para rotas ortogonais (Manhattan) com fallback generalizado Liang-Barsky.
 */
export function doesSegmentIntersectAABB(p1, p2, aabb) {
  if (!p1 || !p2 || !aabb) return false;

  // 1. Se qualquer das extremidades estiver dentro da AABB
  if (isPointInsideAABB(p1, aabb) || isPointInsideAABB(p2, aabb)) {
    return true;
  }

  const minX = aabb.minX;
  const maxX = aabb.maxX;
  const minY = aabb.minY;
  const maxY = aabb.maxY;

  // 2. Segmento puramente horizontal
  if (Math.abs(p1.y - p2.y) < 0.0001) {
    const y = p1.y;
    if (y < minY || y > maxY) return false;
    const segMinX = Math.min(p1.x, p2.x);
    const segMaxX = Math.max(p1.x, p2.x);
    return !(segMaxX < minX || segMinX > maxX);
  }

  // 3. Segmento puramente vertical
  if (Math.abs(p1.x - p2.x) < 0.0001) {
    const x = p1.x;
    if (x < minX || x > maxX) return false;
    const segMinY = Math.min(p1.y, p2.y);
    const segMaxY = Math.max(p1.y, p2.y);
    return !(segMaxY < minY || segMinY > maxY);
  }

  // 4. Algoritmo Liang-Barsky para segmentos diagonais quaisquer
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let t0 = 0.0;
  let t1 = 1.0;

  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return false; // Linha paralela externa
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }

  return t0 <= t1;
}

/**
 * Verifica se uma polilinha (sequência de pontos de rota de um cabo) intercepta a AABB.
 */
export function doesPolylineIntersectAABB(points, aabb) {
  if (!Array.isArray(points) || points.length === 0 || !aabb) return false;
  if (points.length === 1) return isPointInsideAABB(points[0], aabb);

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (doesSegmentIntersectAABB(p1, p2, aabb)) {
      return true;
    }
  }

  return false;
}

/**
 * Calcula as caixas delimitadoras reais de todos os componentes nos trilhos DIN do quadro.
 */
export function computeRailComponentBoxes(rails, options = {}) {
  const startX = options.startX ?? RAIL_COMPONENT_START_X;
  const modWidth = options.modWidth ?? MOD;
  const breakerHeight = options.breakerHeight ?? BRK_H;
  const railGapY = options.railGapY ?? 240;
  const firstRailY = options.firstRailY ?? 190;

  const boxes = [];

  (rails || []).forEach((rail, railIndex) => {
    const railY = firstRailY + railIndex * railGapY;
    let currentX = startX;

    (rail.components || []).forEach((comp) => {
      const poles = Math.max(1, Number(comp.poles) || 1);
      const compW = comp.type === "spacer"
        ? poles * (modWidth + 2) - 2
        : poles * modWidth;
      const x = currentX;
      currentX += compW + 2;
      const y = railY - 45;

      boxes.push({
        component: comp,
        componentId: String(comp.id),
        railId: rail.id,
        railIndex,
        minX: x,
        minY: y,
        maxX: x + compW,
        maxY: y + breakerHeight,
        width: compW,
        height: breakerHeight,
      });
    });
  });

  return boxes;
}

/**
 * Executa a seleção retangular (Marquee Selection) identificando todos os componentes e fios colidindo.
 */
export function queryMarqueeSelection({
  marqueeBox,
  rails,
  wires,
  resolvePinPositionFn,
  panelHeight,
  infrastructure = [],
  wireRouteMeta = {},
  wirePaths = {},
}) {
  if (!marqueeBox || marqueeBox.width <= 0 || marqueeBox.height <= 0) {
    return { selectedComponentIds: [], selectedWireIds: [] };
  }

  // 1. Identificar componentes colidindo com a AABB
  const compBoxes = computeRailComponentBoxes(rails);
  const selectedComponentIds = compBoxes
    .filter((box) => doesAABBOverlap(box, marqueeBox))
    .map((box) => box.componentId);

  // 2. Identificar fios cujos caminhos interceptam ou estão contidos na AABB
  const selectedWireIds = [];
  const activeWires = (wires || []).filter((w) => !w.deleted && (w.source || w.target));

  activeWires.forEach((wire) => {
    // Buscar waypoints na ordem de precisão
    let points = null;

    if (Array.isArray(wireRouteMeta?.[wire.id]?.routePoints) && wireRouteMeta[wire.id].routePoints.length >= 2) {
      points = wireRouteMeta[wire.id].routePoints;
    } else if (Array.isArray(wirePaths?.[wire.id]) && wirePaths[wire.id].length >= 2) {
      points = wirePaths[wire.id];
    } else if (Array.isArray(wire.route?.points) && wire.route.points.length >= 2) {
      points = wire.route.points;
    } else if (Array.isArray(wire.route_points) && wire.route_points.length >= 2) {
      points = wire.route_points;
    } else if (typeof resolvePinPositionFn === "function") {
      const p1 = resolvePinPositionFn(wire.source, rails, panelHeight, infrastructure);
      const p2 = resolvePinPositionFn(wire.target, rails, panelHeight, infrastructure);
      if (p1 && p2 && Number.isFinite(p1.x) && Number.isFinite(p2.x)) {
        points = [p1, p2];
      }
    }

    if (points && doesPolylineIntersectAABB(points, marqueeBox)) {
      selectedWireIds.push(String(wire.id));
    }
  });

  return {
    selectedComponentIds,
    selectedWireIds,
  };
}

/**
 * Verifica se um fio faz referência direta a um componente através de seus terminais.
 */
export function wireReferencesComponentId(wire, componentId) {
  if (!wire || !componentId) return false;
  const compStr = String(componentId);
  const source = String(wire.source || "");
  const target = String(wire.target || "");
  const pinPrefix = `comp:${compStr}:`;
  const pinPrefixAlt = `comp:${compStr}`;
  return (
    source.startsWith(pinPrefix) ||
    source === pinPrefixAlt ||
    target.startsWith(pinPrefix) ||
    target === pinPrefixAlt ||
    String(wire.componentId || "") === compStr ||
    String(wire.circuitId || "") === compStr
  );
}

/**
 * Executa a exclusão em lote (Batch Delete) de componentes e fios selecionados.
 * Remove os elementos, desconecta os condutores dependentes e mantém integridade referencial.
 */
export function executeBatchDelete({
  rails,
  wires,
  compsToDelete = [],
  wiresToDelete = [],
  circuits = [],
  isProtectedFn,
}) {
  const compIdSet = new Set((compsToDelete || []).map(String));
  const wireIdSet = new Set((wiresToDelete || []).map(String));

  // Filtrar componentes protegidos (ex: disjuntor geral do quadro se protegido)
  if (typeof isProtectedFn === "function") {
    rails.forEach((rail) => {
      (rail.components || []).forEach((c) => {
        if (compIdSet.has(String(c.id)) && isProtectedFn(c)) {
          compIdSet.delete(String(c.id));
        }
      });
    });
  }

  // Identificar automaticamente todos os fios conectados aos componentes sendo deletados
  (wires || []).forEach((wire) => {
    for (const compId of compIdSet) {
      if (wireReferencesComponentId(wire, compId)) {
        wireIdSet.add(String(wire.id));
        break;
      }
    }
  });

  // Atualizar trilhos removendo os componentes deletados
  const nextRails = (rails || []).map((rail) => ({
    ...rail,
    components: (rail.components || []).filter((comp) => !compIdSet.has(String(comp.id))),
  }));

  // Atualizar lista de fios
  const nextWires = (wires || []).filter((wire) => !wireIdSet.has(String(wire.id)));

  // Atualizar circuitos correspondentes
  let nextCircuits = [...(circuits || [])];
  const deletedCircuitIds = [];

  compIdSet.forEach((targetId) => {
    const matchedIdx = nextCircuits.findIndex((circuit, idx) => {
      const cId = String(circuit.id || circuit.circuit_id || circuit.source_point_id || "");
      const cNum = circuit.circuit_number != null ? circuit.circuit_number : (circuit.number != null ? circuit.number : idx + 1);
      return (
        cId === targetId ||
        cId === `circuit_${targetId}` ||
        cId === `c${cNum}` ||
        cId === `C${cNum}`
      );
    });

    if (matchedIdx >= 0) {
      deletedCircuitIds.push(String(nextCircuits[matchedIdx].id || nextCircuits[matchedIdx].circuit_id || targetId));
      nextCircuits.splice(matchedIdx, 1);
    }
  });

  return {
    nextRails,
    nextWires,
    nextCircuits,
    deletedComponentIds: Array.from(compIdSet),
    deletedWireIds: Array.from(wireIdSet),
    deletedCircuitIds,
    totalDeletedCount: compIdSet.size + wireIdSet.size,
  };
}

