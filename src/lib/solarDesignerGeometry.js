export const DEFAULT_SOLAR_MAP_CENTER = { lat: -23.55052, lng: -46.63331 };
export const DEFAULT_SOLAR_MAP_ZOOM = 20;
export const SOLAR_MODULE_WIDTH_M = 1.134;
export const SOLAR_MODULE_HEIGHT_M = 2.278;

export const MODULE_CATALOG = [
  {
    id: "jinko-540-72hl4",
    manufacturer: "Jinko Solar",
    model: "JKM540M-72HL4",
    label: "Jinko | JKM540M-72HL4",
    fullTitle: "Jinko Solar · JKM540M-72HL4 (540 Wp)",
    wp: 540,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 40.7,
    vocV: 49.42,
    impA: 13.27,
    iscA: 13.85,
  },
  {
    id: "canadian-550-hiku6",
    manufacturer: "Canadian Solar",
    model: "CS6W-550MS",
    label: "Canadian | CS6W-550MS",
    fullTitle: "Canadian Solar · CS6W-550MS (550 Wp)",
    wp: 550,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 41.7,
    vocV: 49.8,
    impA: 13.20,
    iscA: 14.00,
  },
  {
    id: "longi-545-hbd",
    manufacturer: "LONGi Solar",
    model: "LR5-72HBD-545M",
    label: "LONGi | LR5-72HBD-545M",
    fullTitle: "LONGi Solar · LR5-72HBD-545M (545 Wp)",
    wp: 545,
    widthM: 1.133,
    heightM: 2.256,
    vmpV: 41.8,
    vocV: 49.65,
    impA: 13.04,
    iscA: 13.92,
  },
  {
    id: "trina-670-deg21c",
    manufacturer: "Trina Solar",
    model: "TSM-DEG21C.20",
    label: "Trina | TSM-DEG21C.20",
    fullTitle: "Trina Solar · Vertex TSM-670W (670 Wp)",
    wp: 670,
    widthM: 1.303,
    heightM: 2.384,
    vmpV: 38.2,
    vocV: 45.9,
    impA: 17.55,
    iscA: 18.62,
  },
  {
    id: "generic-550",
    manufacturer: "Padrão Tier-1",
    model: "Mono Half-Cell 550W",
    label: "Módulo FV 550Wp Padrão",
    fullTitle: "Painel Fotovoltaico Monocristalino (550 Wp)",
    wp: 550,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 41.5,
    vocV: 49.8,
    impA: 13.25,
    iscA: 14.10,
  },
];

export function getModulePreset(idOrWp) {
  if (!idOrWp) return MODULE_CATALOG[0];
  const byId = MODULE_CATALOG.find((m) => m.id === idOrWp || m.model === idOrWp);
  if (byId) return byId;
  const numWp = Number(idOrWp);
  if (Number.isFinite(numWp)) {
    const byWp = MODULE_CATALOG.find((m) => m.wp === numWp);
    if (byWp) return byWp;
  }
  return MODULE_CATALOG[0];
}

const METERS_PER_DEGREE_LAT = 111_320;
const COORD_PRECISION = 10_000_000;

export const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const round1 = (value) => Math.round(finiteNumber(value) * 10) / 10;
export const round2 = (value) => Math.round(finiteNumber(value) * 100) / 100;

export const roundCoordinate = (value) => Math.round(Number(value) * COORD_PRECISION) / COORD_PRECISION;

export function normalizeLatLng(point) {
  if (Array.isArray(point) && point.length >= 2) {
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  if (point && typeof point === "object") {
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.lon ?? point.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  return null;
}

export function normalizeRoofPolygon(raw) {
  if (!raw) return [];

  if (raw.type === "Polygon" && Array.isArray(raw.coordinates?.[0])) {
    return raw.coordinates[0]
      .map((coordinate) => normalizeLatLng([coordinate[1], coordinate[0]]))
      .filter(Boolean);
  }

  if (!Array.isArray(raw)) return [];

  return raw.map(normalizeLatLng).filter(Boolean);
}

export function serializeRoofPolygon(points) {
  return normalizeRoofPolygon(points).map((point) => ({
    lat: roundCoordinate(point.lat),
    lng: roundCoordinate(point.lng),
  }));
}

export function getMapCenterFromConfig(config = {}) {
  const lat = Number(config.map_center_lat);
  const lng = Number(config.map_center_lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return DEFAULT_SOLAR_MAP_CENTER;
}

export function getPolygonCentroid(points) {
  const normalized = normalizeRoofPolygon(points);
  if (!normalized.length) return null;

  const sum = normalized.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / normalized.length,
    lng: sum.lng / normalized.length,
  };
}

export function getPolygonAreaSquareMeters(points) {
  const polygon = normalizeRoofPolygon(points);
  if (polygon.length < 3) return 0;

  const origin = getPolygonCentroid(polygon) || DEFAULT_SOLAR_MAP_CENTER;
  const localPoints = polygon.map((point) => latLngToMeters(point, origin));
  const twiceArea = localPoints.reduce((sum, point, index) => {
    const next = localPoints[(index + 1) % localPoints.length];
    return sum + point.east * next.north - next.east * point.north;
  }, 0);

  return Math.abs(twiceArea) / 2;
}

export function getRoofCenterFromConfig(config = {}) {
  return getPolygonCentroid(config.roof_polygon) || getMapCenterFromConfig(config);
}

function longitudeMeterFactor(lat) {
  return Math.max(0.000001, METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
}

export function latLngToMeters(point, origin) {
  return {
    east: (point.lng - origin.lng) * longitudeMeterFactor(origin.lat),
    north: (point.lat - origin.lat) * METERS_PER_DEGREE_LAT,
  };
}

export function metersToLatLng(origin, eastMeters, northMeters) {
  return {
    lat: origin.lat + northMeters / METERS_PER_DEGREE_LAT,
    lng: origin.lng + eastMeters / longitudeMeterFactor(origin.lat),
  };
}

export function rotateMeters(east, north, rotationDeg) {
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    east: east * cos - north * sin,
    north: east * sin + north * cos,
  };
}

export function normalizeRotationDeg(value) {
  let rotation = finiteNumber(value, 0);
  while (rotation > 180) rotation -= 360;
  while (rotation < -180) rotation += 360;
  return rotation;
}

/**
 * Converte rotação/ângulo de azimute para formato com ponto cardeal (ex: "24° NE", "0° N", "180° S")
 */
export function getAzimuthWithCardinal(rotationDeg) {
  let deg = normalizeRotationDeg(rotationDeg);
  if (deg < 0) deg += 360;
  deg = Math.round(deg);

  const directions = [
    { label: "N", min: 337.5, max: 360 },
    { label: "N", min: 0, max: 22.5 },
    { label: "NE", min: 22.5, max: 67.5 },
    { label: "L", min: 67.5, max: 112.5 },
    { label: "SE", min: 112.5, max: 157.5 },
    { label: "S", min: 157.5, max: 202.5 },
    { label: "SO", min: 202.5, max: 247.5 },
    { label: "O", min: 247.5, max: 292.5 },
    { label: "NO", min: 292.5, max: 337.5 },
  ];

  const matched = directions.find((d) => deg >= d.min && deg < d.max) || { label: "N" };
  return {
    degrees: deg,
    cardinal: matched.label,
    formatted: `${deg}° (${matched.label})`,
  };
}

export function buildRoofPolygon(center, widthM, heightM, rotationDeg = 0) {
  const safeCenter = normalizeLatLng(center) || DEFAULT_SOLAR_MAP_CENTER;
  const width = Math.max(0.5, finiteNumber(widthM, 9));
  const height = Math.max(0.5, finiteNumber(heightM, 6));
  const rotation = normalizeRotationDeg(rotationDeg);
  const corners = [
    [-width / 2, height / 2],
    [width / 2, height / 2],
    [width / 2, -height / 2],
    [-width / 2, -height / 2],
  ];

  return corners.map(([east, north]) => {
    const rotated = rotateMeters(east, north, rotation);
    return metersToLatLng(safeCenter, rotated.east, rotated.north);
  });
}

export function getRoofPolygonFromConfig(config = {}) {
  const polygon = normalizeRoofPolygon(config.roof_polygon);
  if (polygon.length >= 3) return polygon;

  if (config.roof_defined === false) return [];

  return buildRoofPolygon(
    getRoofCenterFromConfig(config),
    config.roof_width_m,
    config.roof_height_m,
    config.roof_rotation_deg
  );
}

export function distanceMeters(a, b) {
  const origin = getPolygonCentroid([a, b]) || DEFAULT_SOLAR_MAP_CENTER;
  const start = latLngToMeters(a, origin);
  const end = latLngToMeters(b, origin);
  return Math.hypot(end.east - start.east, end.north - start.north);
}

export function edgeRotationDegrees(a, b) {
  const origin = normalizeLatLng(a) || DEFAULT_SOLAR_MAP_CENTER;
  const start = latLngToMeters(a, origin);
  const end = latLngToMeters(b, origin);
  return normalizeRotationDeg((Math.atan2(end.north - start.north, end.east - start.east) * 180) / Math.PI);
}

/**
 * Retorna as arestas do polígono com ponto médio, comprimento e azimute de alinhamento
 */
export function getPolygonEdges(points) {
  const polygon = normalizeRoofPolygon(points);
  if (polygon.length < 2) return [];

  return polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const length = distanceMeters(point, next);
    const rawRotation = edgeRotationDegrees(point, next);
    // Azimute da aresta normalizado 0..360
    let azimuth = rawRotation < 0 ? rawRotation + 360 : rawRotation;
    let readableRotation = rawRotation > 90 || rawRotation < -90 ? rawRotation + 180 : rawRotation;
    
    const midpoint = {
      lat: (point.lat + next.lat) / 2,
      lng: (point.lng + next.lng) / 2,
    };

    return {
      id: `edge-${index}`,
      index,
      start: point,
      end: next,
      midpoint,
      length,
      rotation: readableRotation,
      azimuth: Math.round(azimuth * 100) / 100,
      label: `${length.toFixed(length >= 10 ? 2 : 1)} m`,
    };
  });
}

export function getDominantRoofRotation(points, fallbackRotation = 0) {
  if (Number.isFinite(Number(fallbackRotation)) && fallbackRotation !== 0) {
    return normalizeRotationDeg(fallbackRotation);
  }
  const polygon = normalizeRoofPolygon(points);
  if (polygon.length < 2) return normalizeRotationDeg(fallbackRotation);

  let longestEdge = null;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const length = distanceMeters(start, end);

    if (!longestEdge || length > longestEdge.length) {
      longestEdge = { start, end, length };
    }
  }

  if (!longestEdge || longestEdge.length < 0.5) return normalizeRotationDeg(fallbackRotation);

  let rotation = edgeRotationDegrees(longestEdge.start, longestEdge.end);
  if (rotation > 90) rotation -= 180;
  if (rotation < -90) rotation += 180;

  return normalizeRotationDeg(rotation);
}

export function getRoofMetricsFromPolygon(points, fallback = {}) {
  const polygon = normalizeRoofPolygon(points);
  const center = getPolygonCentroid(polygon) || getRoofCenterFromConfig(fallback);
  const fallbackWidth = Math.max(0.5, finiteNumber(fallback.roof_width_m, 9));
  const fallbackHeight = Math.max(0.5, finiteNumber(fallback.roof_height_m, 6));

  if (polygon.length < 3) {
    return {
      center,
      widthM: fallbackWidth,
      heightM: fallbackHeight,
      areaM2: fallbackWidth * fallbackHeight,
      rotationDeg: normalizeRotationDeg(fallback.roof_rotation_deg),
    };
  }

  const rotationDeg = getDominantRoofRotation(polygon, fallback.roof_rotation_deg);

  const localPoints = polygon.map((point) => {
    const meters = latLngToMeters(point, center);
    return rotateMeters(meters.east, meters.north, -rotationDeg);
  });

  const eastValues = localPoints.map((point) => point.east);
  const northValues = localPoints.map((point) => point.north);
  const widthM = Math.max(0.5, Math.max(...eastValues) - Math.min(...eastValues));
  const heightM = Math.max(0.5, Math.max(...northValues) - Math.min(...northValues));

  return {
    center,
    widthM,
    heightM,
    areaM2: getPolygonAreaSquareMeters(polygon),
    rotationDeg,
  };
}

function pointInPolygon(point, polygon) {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects = ((currentPoint.north > point.north) !== (previousPoint.north > point.north))
      && (point.east < ((previousPoint.east - currentPoint.east) * (point.north - currentPoint.north)) / (previousPoint.north - currentPoint.north || 1e-9) + currentPoint.east);

    if (intersects) inside = !inside;
  }

  return inside;
}

function distanceToSegment(point, start, end) {
  const segmentEast = end.east - start.east;
  const segmentNorth = end.north - start.north;
  const segmentLengthSq = segmentEast * segmentEast + segmentNorth * segmentNorth;

  if (!segmentLengthSq) return Math.hypot(point.east - start.east, point.north - start.north);

  const t = Math.max(0, Math.min(1, ((point.east - start.east) * segmentEast + (point.north - start.north) * segmentNorth) / segmentLengthSq));
  const projected = {
    east: start.east + t * segmentEast,
    north: start.north + t * segmentNorth,
  };

  return Math.hypot(point.east - projected.east, point.north - projected.north);
}

function pointInPolygonOrBoundary(point, polygon, toleranceM = 0.03) {
  if (pointInPolygon(point, polygon)) return true;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (distanceToSegment(point, start, end) <= toleranceM) return true;
  }

  return false;
}

/**
 * Verifica se um painel (retângulo) colide com algum obstáculo ativo no telhado
 */
function panelCollidesWithObstacle(panelCorners, centerPoint, localObstacles) {
  if (!localObstacles || !localObstacles.length) return false;

  for (const obs of localObstacles) {
    if (!obs.excludeArea) continue;
    const obsRadius = obs.radiusM || Math.max(obs.widthM || 1, obs.heightM || 1) / 2 || 0.8;
    // Margem de segurança de 0.30m ao redor do obstáculo
    const safeRadius = obsRadius + 0.3;

    // Checa distância do centro do painel ao centro do obstáculo
    const distCenter = Math.hypot(centerPoint.east - obs.east, centerPoint.north - obs.north);
    if (distCenter <= safeRadius + 0.8) {
      // Checa se algum dos 4 cantos do painel invade a área de segurança
      for (const corner of panelCorners) {
        if (Math.hypot(corner.east - obs.east, corner.north - obs.north) < safeRadius) {
          return true;
        }
      }
      if (distCenter < safeRadius) return true;
    }
  }

  return false;
}

/**
 * Constrói polígonos de módulos considerando obstáculos, afastamentos e a estratégia de simulação
 */
export function buildPanelPolygons(config = {}, sizing = {}, options = {}) {
  const columnGapM = Math.max(0.01, (finiteNumber(config.column_gap_cm, 2) / 100) || 0.02);
  const rowGapM = Math.max(0.01, (finiteNumber(config.row_gap_cm, 2) / 100) || 0.02);
  const strategy = (typeof options === "object" ? options?.strategy : null) || config.layout_strategy || "max_generation";
  const obstacles = Array.isArray(config.obstacles) ? config.obstacles : [];

  const roofPolygon = getRoofPolygonFromConfig(config);
  if (roofPolygon.length < 3) return [];

  const center = getPolygonCentroid(roofPolygon) || getRoofCenterFromConfig(config);
  const metrics = getRoofMetricsFromPolygon(roofPolygon, config);
  const panelCount = Math.max(0, Math.min(1200, Math.round(finiteNumber(sizing.panelCount, 0))));

  const preset = getModulePreset(config.module_preset_id || config.module_model || config.module_wp);
  const moduleWidth = preset.widthM || SOLAR_MODULE_WIDTH_M;
  const moduleHeight = preset.heightM || SOLAR_MODULE_HEIGHT_M;
  
  const orientation = sizing.orientation || config.module_orientation || "vertical";
  const isLandscape = orientation === "horizontal" || orientation === "landscape";
  const panelWidth = isLandscape ? moduleHeight : moduleWidth;
  const panelHeight = isLandscape ? moduleWidth : moduleHeight;

  // Rotação: usa o azimute configurado ou rotação dominante
  const rotation = Number.isFinite(Number(config.roof_rotation_deg))
    ? normalizeRotationDeg(config.roof_rotation_deg)
    : getDominantRoofRotation(roofPolygon, metrics.rotationDeg);

  const localRoof = roofPolygon.map((point) => {
    const meters = latLngToMeters(point, center);
    return rotateMeters(meters.east, meters.north, -rotation);
  });

  const localObstacles = obstacles.map((obs) => {
    const meters = latLngToMeters(obs, center);
    const rotated = rotateMeters(meters.east, meters.north, -rotation);
    return {
      ...obs,
      east: rotated.east,
      north: rotated.north,
    };
  });

  const eastValues = localRoof.map((point) => point.east);
  const northValues = localRoof.map((point) => point.north);
  const minEast = Math.min(...eastValues);
  const maxEast = Math.max(...eastValues);
  const minNorth = Math.min(...northValues);
  const maxNorth = Math.max(...northValues);

  // Setback perimetral do telhado (margem de segurança das bordas)
  const setbackM = strategy === "best_aesthetic" ? 0.35 : 0.15;
  const effectiveMinEast = minEast + setbackM;
  const effectiveMaxEast = maxEast - setbackM;
  const effectiveMinNorth = minNorth + setbackM;
  const effectiveMaxNorth = maxNorth - setbackM;

  // Fator de espaçamento entre fileiras para estruturas inclinadas (Triângulo/Shed)
  const isTriangleStructure = config.structure_type === "triangle" || config.structure_type === "shed";
  const tiltDeg = finiteNumber(config.roof_pitch_deg, 12);
  const tiltShadingExtra = isTriangleStructure ? Math.sin((tiltDeg * Math.PI) / 180) * panelHeight * 0.9 : 0;

  const columnPitch = panelWidth + columnGapM;
  const rowPitch = panelHeight + rowGapM + tiltShadingExtra;
  const columns = Math.max(1, Math.min(80, Math.ceil((effectiveMaxEast - effectiveMinEast) / columnPitch) + 1));
  const rows = Math.max(1, Math.min(80, Math.ceil((effectiveMaxNorth - effectiveMinNorth) / rowPitch) + 1));

  const panelCorners = [
    [-panelWidth / 2, panelHeight / 2],
    [panelWidth / 2, panelHeight / 2],
    [panelWidth / 2, -panelHeight / 2],
    [-panelWidth / 2, -panelHeight / 2],
  ];

  const offsetSteps = strategy === "max_utilization" ? 12 : 8;
  let bestLocalPanels = [];

  for (let offsetRow = 0; offsetRow < offsetSteps; offsetRow += 1) {
    const offsetNorth = (rowPitch * offsetRow) / offsetSteps;

    for (let offsetColumn = 0; offsetColumn < offsetSteps; offsetColumn += 1) {
      const offsetEast = (columnPitch * offsetColumn) / offsetSteps;
      const localPanels = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const centerEast = effectiveMinEast + panelWidth / 2 - offsetEast + column * columnPitch;
          const centerNorth = effectiveMaxNorth - panelHeight / 2 + offsetNorth - row * rowPitch;
          const centerObj = { east: centerEast, north: centerNorth };

          const localCorners = panelCorners.map(([east, north]) => ({
            east: centerEast + east,
            north: centerNorth + north,
          }));

          const fitsInsideRoof = [
            centerObj,
            ...localCorners,
          ].every((point) => pointInPolygonOrBoundary(point, localRoof));

          const collides = panelCollidesWithObstacle(localCorners, centerObj, localObstacles);

          if (fitsInsideRoof && !collides) {
            localPanels.push(localCorners);
          }
        }
      }

      if (localPanels.length > bestLocalPanels.length) {
        bestLocalPanels = localPanels;
      }
    }
  }

  // Ordena os painéis para agrupar esteticamente
  if (strategy === "best_aesthetic") {
    bestLocalPanels.sort((a, b) => b[0].north - a[0].north || a[0].east - b[0].east);
  }

  return bestLocalPanels.slice(0, panelCount).map((localCorners) => (
    localCorners.map((corner) => {
      const rotated = rotateMeters(corner.east, corner.north, rotation);
      return metersToLatLng(center, rotated.east, rotated.north);
    })
  ));
}

export function getBestPanelLayout(config = {}, panelLimit = 1200, strategy = "max_generation") {
  const safeLimit = Math.max(0, Math.min(1200, Math.round(finiteNumber(panelLimit, 1200))));
  const requestedOrientation = config.module_orientation || "auto";
  const orientations = requestedOrientation === "auto"
    ? ["vertical", "horizontal"]
    : [requestedOrientation];

  const layouts = orientations.map((orientation) => {
    const panels = buildPanelPolygons(config, { panelCount: safeLimit, orientation }, { strategy });
    return { orientation, panels, panelCount: panels.length };
  });

  return layouts.sort((a, b) => b.panelCount - a.panelCount)[0] || {
    orientation: requestedOrientation === "horizontal" ? "horizontal" : "vertical",
    panels: [],
    panelCount: 0,
  };
}

/**
 * Agrupamento inteligente de strings fotovoltaicas
 * Divide os módulos instalados em strings balanceadas (ex: 11 a 14 módulos por string)
 */
export function calculateStringGrouping(panelCount, {
  moduleWp = 550,
  inverterKw = 5,
  vmpModuleV = 41.5,
  vocModuleV = 49.8,
  impModuleA = 13.25,
  iscModuleA = 14.10,
} = {}) {
  const totalPanels = Math.max(0, Math.round(Number(panelCount) || 0));
  if (totalPanels <= 0) return [];

  // Define tamanho ótimo de string (tensão MPPT típica 300V - 600V -> 8 a 15 módulos)
  let stringCount = 1;
  if (totalPanels > 14) stringCount = 2;
  if (totalPanels > 28) stringCount = 3;
  if (totalPanels > 42) stringCount = 4;
  if (totalPanels > 60) stringCount = Math.ceil(totalPanels / 15);

  const baseSize = Math.floor(totalPanels / stringCount);
  const remainder = totalPanels % stringCount;

  const strings = [];
  let currentStart = 1;

  for (let i = 0; i < stringCount; i += 1) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const end = currentStart + size - 1;
    const stringVoc = Math.round(size * vocModuleV * 10) / 10;
    const stringVmp = Math.round(size * vmpModuleV * 10) / 10;
    const stringPowerKw = Math.round((size * moduleWp) / 10) / 100;

    strings.push({
      id: `string_${i + 1}`,
      name: `String ${String(i + 1).padStart(2, "0")}`,
      label: `String ${String(i + 1).padStart(2, "0")}: Módulos ${currentStart} – ${end}`,
      startModule: currentStart,
      endModule: end,
      moduleCount: size,
      powerKw: stringPowerKw,
      vocV: stringVoc,
      vmpV: stringVmp,
      impA: impModuleA,
      iscA: iscModuleA,
    });

    currentStart = end + 1;
  }

  return strings;
}

/**
 * Análise técnica de irradiação solar e perdas da água do telhado
 */
export function computeRoofFaceTechnicalAnalysis(roofPolygon, config = {}) {
  const metrics = getRoofMetricsFromPolygon(roofPolygon, config);
  const azimuth = getAzimuthWithCardinal(metrics.rotationDeg);
  const tiltDeg = config.roof_pitch_deg || 12; // inclinação padrão 12°

  // Fator de orientação azimutal para o hemisfério Sul (Norte = 0° é o ideal)
  const angleFromNorth = Math.min(azimuth.degrees, 360 - azimuth.degrees);
  const azimuthLossPct = Math.round((angleFromNorth / 180) * 8 * 10) / 10;
  const tiltLossPct = Math.abs(tiltDeg - 15) * 0.15;
  const obstacles = Array.isArray(config.obstacles) ? config.obstacles : [];
  const obstacleShadingLossPct = obstacles.length * 1.5;

  const totalLossPct = Math.min(25, Math.round((azimuthLossPct + tiltLossPct + obstacleShadingLossPct + 4) * 10) / 10);
  const baseHsp = 5.1; // HSP médio de referência
  const effectiveHsp = Math.round(baseHsp * (1 - totalLossPct / 100) * 100) / 100;

  return {
    azimuth,
    tiltDeg,
    estimatedLossPct: totalLossPct,
    effectiveHsp,
    annualIrradiationKwhM2: Math.round(effectiveHsp * 365),
  };
}

export function createDefaultSolarArea(partial = {}, index = 1, fallbackConfig = {}) {
  const id = partial.id || `area_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const polygon = serializeRoofPolygon(normalizeRoofPolygon(partial.polygon || partial.roof_polygon || []));
  const metrics = polygon.length >= 3 ? getRoofMetricsFromPolygon(polygon, fallbackConfig) : null;
  const fallbackWidth = finiteNumber(fallbackConfig.roof_width_m, 10);
  const fallbackHeight = finiteNumber(fallbackConfig.roof_height_m, 6);

  const roofRotationDeg = Number.isFinite(Number(partial.roof_rotation_deg))
    ? round2(Number(partial.roof_rotation_deg))
    : (metrics ? round2(metrics.rotationDeg) : round2(finiteNumber(fallbackConfig.roof_rotation_deg, 0)));

  return {
    id,
    name: partial.name || `Área ${index}`,
    polygon,
    roof_width_m: metrics ? round1(metrics.widthM) : finiteNumber(partial.roof_width_m, fallbackWidth),
    roof_height_m: metrics ? round1(metrics.heightM) : finiteNumber(partial.roof_height_m, fallbackHeight),
    roof_area_m2: metrics ? round1(metrics.areaM2) : finiteNumber(partial.roof_area_m2, fallbackWidth * fallbackHeight),
    roof_rotation_deg: roofRotationDeg,
    roof_pitch_deg: round2(finiteNumber(partial.roof_pitch_deg, fallbackConfig.roof_pitch_deg ?? 12)),
    structure_type: ["coplanar", "triangle", "shed"].includes(partial.structure_type)
      ? partial.structure_type
      : (fallbackConfig.structure_type || "triangle"),
    module_orientation: ["horizontal", "vertical", "auto"].includes(partial.module_orientation)
      ? partial.module_orientation
      : (fallbackConfig.module_orientation || "horizontal"),
    auto_fill_surface: partial.auto_fill_surface !== false,
    rows_per_table: Math.max(1, Math.round(finiteNumber(partial.rows_per_table, fallbackConfig.rows_per_table ?? 1))),
    base_height_cm: finiteNumber(partial.base_height_cm, fallbackConfig.base_height_cm ?? 0),
    column_gap_cm: finiteNumber(partial.column_gap_cm, fallbackConfig.column_gap_cm ?? 0),
    row_gap_cm: finiteNumber(partial.row_gap_cm, fallbackConfig.row_gap_cm ?? 0),
    requested_panel_count: Math.max(1, Math.min(1200, Math.round(finiteNumber(partial.requested_panel_count, fallbackConfig.requested_panel_count ?? 14)))),
    layout_strategy: partial.layout_strategy || fallbackConfig.layout_strategy || "max_generation",
    panelCount: 0,
    panelPolygons: [],
  };
}

export function normalizeSolarArea(rawArea = {}, index = 1, fallbackConfig = {}) {
  return createDefaultSolarArea(rawArea, index, fallbackConfig);
}

export function normalizeSolarAreas(rawAreas, fallbackConfig = {}) {
  if (Array.isArray(rawAreas) && rawAreas.length > 0) {
    return rawAreas
      .filter((a) => a && typeof a === "object")
      .map((area, idx) => normalizeSolarArea(area, idx + 1, fallbackConfig));
  }

  const legacyPolygon = serializeRoofPolygon(normalizeRoofPolygon(fallbackConfig.roof_polygon));
  if (legacyPolygon.length >= 3) {
    return [
      normalizeSolarArea(
        {
          id: "area_1",
          name: "Área 1",
          polygon: legacyPolygon,
          ...fallbackConfig,
        },
        1,
        fallbackConfig
      ),
    ];
  }

  return [];
}

export function computeAreaPanels(area = {}, globalConfig = {}) {
  const polygon = normalizeRoofPolygon(area.polygon || area.roof_polygon);
  if (polygon.length < 3) {
    return {
      ...area,
      polygon: [],
      panelPolygons: [],
      panelCount: 0,
      dcPowerKw: 0,
      areaM2: 0,
      metrics: { widthM: 0, heightM: 0, areaM2: 0, rotationDeg: 0, center: null },
    };
  }

  const metrics = getRoofMetricsFromPolygon(polygon, area);
  const areaRotation = Number.isFinite(Number(area.roof_rotation_deg))
    ? area.roof_rotation_deg
    : metrics.rotationDeg;

  const mergedConfig = {
    ...globalConfig,
    ...area,
    roof_polygon: polygon,
    roof_rotation_deg: areaRotation,
    roof_pitch_deg: area.roof_pitch_deg ?? globalConfig.roof_pitch_deg ?? 12,
    structure_type: area.structure_type || globalConfig.structure_type || "triangle",
    module_orientation: area.module_orientation || globalConfig.module_orientation || "horizontal",
    column_gap_cm: area.column_gap_cm ?? globalConfig.column_gap_cm ?? 0,
    row_gap_cm: area.row_gap_cm ?? globalConfig.row_gap_cm ?? 0,
    layout_strategy: area.layout_strategy || globalConfig.layout_strategy || "max_generation",
  };

  const limit = area.auto_fill_surface ? 1200 : Math.max(1, Number(area.requested_panel_count) || 1200);
  const layout = getBestPanelLayout(mergedConfig, limit, mergedConfig.layout_strategy);
  const moduleWp = Number(globalConfig.module_wp) || 540;
  const panelCount = layout.panelCount;
  const dcPowerKw = round2((panelCount * moduleWp) / 1000);

  return {
    ...area,
    polygon,
    roof_width_m: round1(metrics.widthM),
    roof_height_m: round1(metrics.heightM),
    roof_area_m2: round1(metrics.areaM2),
    roof_rotation_deg: round2(areaRotation),
    panelPolygons: layout.panels,
    panelCount,
    dcPowerKw,
    areaM2: round1(metrics.areaM2),
    metrics,
  };
}

export function computeMultiAreaLayouts(config = {}) {
  const normalizedAreas = normalizeSolarAreas(config.areas, config);
  return normalizedAreas.map((area) => computeAreaPanels(area, config));
}

export function getMultiAreaAggregateMetrics(areas = [], globalConfig = {}) {
  const moduleWp = Number(globalConfig.module_wp) || 540;
  const inverterKw = Number(globalConfig.inverter_kw) || 5;
  const computedAreas = areas.map((area) =>
    area.panelPolygons ? area : computeAreaPanels(area, globalConfig)
  );

  const totalPanels = computedAreas.reduce((sum, a) => sum + (a.panelCount || 0), 0);
  const totalAreaM2 = computedAreas.reduce((sum, a) => sum + (a.roof_area_m2 || 0), 0);
  const totalDcPowerKw = round2((totalPanels * moduleWp) / 1000);
  const allPanelPolygons = computedAreas.flatMap((a) => a.panelPolygons || []);

  return {
    areas: computedAreas,
    areasCount: computedAreas.length,
    totalPanels,
    totalAreaM2: round1(totalAreaM2),
    totalDcPowerKw,
    dcAcRatio: inverterKw > 0 ? round2(totalDcPowerKw / inverterKw) : 0,
    allPanelPolygons,
  };
}
