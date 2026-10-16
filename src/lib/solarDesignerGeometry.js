export const DEFAULT_SOLAR_MAP_CENTER = { lat: -23.55052, lng: -46.63331 };
export const DEFAULT_SOLAR_MAP_ZOOM = 20;
export const SOLAR_MODULE_WIDTH_M = 1.134;
export const SOLAR_MODULE_HEIGHT_M = 2.278;

/**
 * Paleta de cores oficial para renderização fotovoltaica técnica:
 * - Superfície principal: azul-marinho escuro (#142B46)
 * - Variações discretas das células: #1A3553
 * - Linhas internas: azul-acinzentado (#45617A) com opacidade reduzida
 * - Moldura: cinza-azulado discreto (#8B9CAC)
 * - Seleção ativa: ciano/turquesa (#00d8b8)
 */
export const SOLAR_PANEL_THEME = {
  mainSurface: "#142B46",
  cellVariant: "#1A3553",
  internalLines: "#45617A",
  frame: "#8B9CAC",
  selectionActive: "#00d8b8",
  selectionActiveDark: "#173456",
  // Paleta de Alta Fidelidade Fotovoltaica (Foto de Referência)
  realisticSilicon: "#10233f",
  frameAluminum: "#F8FAFC",
  frameSilver: "#E2E8F0",
  cellGridWhite: "#DCE8F7",
  halfCutWhite: "#FFFFFF",
  busbarSilver: "#C2DCF8",
};

// Micro-variações ópticas sutis no silício fotovoltaico mono-PERC
export const PHOTOVOLTAIC_BASE_COLORS = [
  "#142B46",
  "#162E4A",
  "#132A44",
  "#17304D",
  "#152C47",
  "#1A3553",
];

export const MODULE_CATALOG = [
  {
    id: "jinko-540-72hl4",
    manufacturer: "Jinko Solar",
    model: "JKM540M-72HL4",
    label: "Jinko · JKM540M (540 Wp)",
    fullTitle: "Jinko Solar · JKM540M-72HL4 (540 Wp)",
    technology: "Mono PERC",
    wp: 540,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 40.7,
    vocV: 49.42,
    impA: 13.27,
    iscA: 13.85,
  },
  {
    id: "jinko-575-tiger-neo",
    manufacturer: "Jinko Solar",
    model: "JKM575N-72HL4-V",
    label: "Jinko · Tiger Neo N-Type (575 Wp)",
    fullTitle: "Jinko Solar · Tiger Neo N-Type 575W (575 Wp)",
    technology: "TOPCon N-Type",
    wp: 575,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 42.22,
    vocV: 50.88,
    impA: 13.62,
    iscA: 14.39,
  },
  {
    id: "jinko-610-tiger-neo",
    manufacturer: "Jinko Solar",
    model: "JKM610N-78HL4-V",
    label: "Jinko · Tiger Neo N-Type (610 Wp)",
    fullTitle: "Jinko Solar · Tiger Neo N-Type 610W (610 Wp)",
    technology: "TOPCon N-Type",
    wp: 610,
    widthM: 1.134,
    heightM: 2.465,
    vmpV: 45.98,
    vocV: 55.42,
    impA: 13.27,
    iscA: 14.03,
  },
  {
    id: "canadian-550-hiku6",
    manufacturer: "Canadian Solar",
    model: "CS6W-550MS",
    label: "Canadian · HiKu6 CS6W (550 Wp)",
    fullTitle: "Canadian Solar · CS6W-550MS HiKu6 (550 Wp)",
    technology: "Mono PERC",
    wp: 550,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 41.7,
    vocV: 49.8,
    impA: 13.20,
    iscA: 14.00,
  },
  {
    id: "canadian-665-hiku7",
    manufacturer: "Canadian Solar",
    model: "CS7N-665MS",
    label: "Canadian · HiKu7 CS7N (665 Wp)",
    fullTitle: "Canadian Solar · CS7N-665MS HiKu7 (665 Wp)",
    technology: "Mono PERC Bifacial",
    wp: 665,
    widthM: 1.303,
    heightM: 2.384,
    vmpV: 38.5,
    vocV: 45.6,
    impA: 17.28,
    iscA: 18.51,
  },
  {
    id: "longi-545-hbd",
    manufacturer: "LONGi Solar",
    model: "LR5-72HBD-545M",
    label: "LONGi · Hi-MO 5 (545 Wp)",
    fullTitle: "LONGi Solar · LR5-72HBD-545M (545 Wp)",
    technology: "Mono PERC",
    wp: 545,
    widthM: 1.133,
    heightM: 2.256,
    vmpV: 41.8,
    vocV: 49.65,
    impA: 13.04,
    iscA: 13.92,
  },
  {
    id: "longi-580-himo6",
    manufacturer: "LONGi Solar",
    model: "LR5-72HTH-580M",
    label: "LONGi · Hi-MO 6 Explorer (580 Wp)",
    fullTitle: "LONGi Solar · Hi-MO 6 Explorer HPBC (580 Wp)",
    technology: "HPBC N-Type",
    wp: 580,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 44.06,
    vocV: 52.21,
    impA: 13.17,
    iscA: 14.09,
  },
  {
    id: "longi-600-himox6",
    manufacturer: "LONGi Solar",
    model: "LR5-72HGD-600M",
    label: "LONGi · Hi-MO X6 Max (600 Wp)",
    fullTitle: "LONGi Solar · Hi-MO X6 Max Bifacial (600 Wp)",
    technology: "HPBC N-Type",
    wp: 600,
    widthM: 1.134,
    heightM: 2.382,
    vmpV: 45.10,
    vocV: 53.80,
    impA: 13.31,
    iscA: 14.25,
  },
  {
    id: "trina-670-deg21c",
    manufacturer: "Trina Solar",
    model: "TSM-DEG21C.20",
    label: "Trina · Vertex TSM-670W (670 Wp)",
    fullTitle: "Trina Solar · Vertex TSM-670W (670 Wp)",
    technology: "Mono PERC",
    wp: 670,
    widthM: 1.303,
    heightM: 2.384,
    vmpV: 38.2,
    vocV: 45.9,
    impA: 17.55,
    iscA: 18.62,
  },
  {
    id: "trina-580-vertex",
    manufacturer: "Trina Solar",
    model: "TSM-NEG19RC.20",
    label: "Trina · Vertex N-Type (580 Wp)",
    fullTitle: "Trina Solar · Vertex N-Type NEG19RC (580 Wp)",
    technology: "TOPCon N-Type",
    wp: 580,
    widthM: 1.134,
    heightM: 2.384,
    vmpV: 43.20,
    vocV: 51.80,
    impA: 13.43,
    iscA: 14.28,
  },
  {
    id: "ja-solar-580-deepblue",
    manufacturer: "JA Solar",
    model: "JAM72D40-580/GB",
    label: "JA Solar · DeepBlue 4.0 Pro (580 Wp)",
    fullTitle: "JA Solar · DeepBlue 4.0 Pro Bifacial (580 Wp)",
    technology: "Bycium+ TOPCon",
    wp: 580,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 42.60,
    vocV: 51.10,
    impA: 13.62,
    iscA: 14.36,
  },
  {
    id: "astronergy-580-n5",
    manufacturer: "Astronergy",
    model: "CHSM72N(DG)/F-BH-580",
    label: "Astronergy · Astro N5 (580 Wp)",
    fullTitle: "Astronergy · Astro N5 TOPCon Bifacial (580 Wp)",
    technology: "TOPCon N-Type",
    wp: 580,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 42.45,
    vocV: 51.05,
    impA: 13.67,
    iscA: 14.41,
  },
  {
    id: "deye-580-topcon",
    manufacturer: "Deye",
    model: "DY-580-TOPCON",
    label: "Deye · TopCon N-Type (580 Wp)",
    fullTitle: "Deye · TopCon N-Type High Efficiency (580 Wp)",
    technology: "TOPCon N-Type",
    wp: 580,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 42.50,
    vocV: 51.20,
    impA: 13.65,
    iscA: 14.40,
  },
  {
    id: "generic-550",
    manufacturer: "Padrão Tier-1",
    model: "Mono Half-Cell 550W",
    label: "Módulo FV 550Wp Padrão",
    fullTitle: "Painel Fotovoltaico Monocristalino (550 Wp)",
    technology: "Mono PERC",
    wp: 550,
    widthM: 1.134,
    heightM: 2.278,
    vmpV: 41.5,
    vocV: 49.8,
    impA: 13.25,
    iscA: 14.10,
  },
];

export const PANEL_VISUAL_STYLES = {
  realistic: {
    id: "realistic",
    name: "Ultra Realista",
    description: "Mono-PERC azul marinho com divisórias sutis e elegantes",
    siliconColor: "#0f233d",
    frameColor: "#cbd5e1",
    frameWidth: 1.2,
    cellLineColor: "#6484a4",
    cellLineOpacity: 0.35,
    cellLineWidth: 0.65,
    halfCutColor: "#8baac9",
    halfCutOpacity: 0.50,
    halfCutWidth: 1.0,
    busbarColor: "#93b5d8",
    busbarOpacity: 0.25,
  },
  "full-black": {
    id: "full-black",
    name: "Full Black Premium",
    description: "Estética All-Black moderna, sem reflexos ou linhas brancas",
    siliconColor: "#0b111a",
    frameColor: "#1e293b",
    frameWidth: 1.2,
    cellLineColor: "#1e2c3d",
    cellLineOpacity: 0.22,
    cellLineWidth: 0.5,
    halfCutColor: "#2a3b50",
    halfCutOpacity: 0.35,
    halfCutWidth: 0.8,
    busbarColor: "#1e2c3d",
    busbarOpacity: 0.15,
  },
  "classic-blue": {
    id: "classic-blue",
    name: "Azul Fotovoltaico Clássico",
    description: "Tons de azul elétrico suave com moldura em alumínio",
    siliconColor: "#132d4e",
    frameColor: "#e2e8f0",
    frameWidth: 1.3,
    cellLineColor: "#7ea0c2",
    cellLineOpacity: 0.40,
    cellLineWidth: 0.7,
    halfCutColor: "#b0cce8",
    halfCutOpacity: 0.55,
    halfCutWidth: 1.1,
    busbarColor: "#b0cce8",
    busbarOpacity: 0.30,
  },
  technical: {
    id: "technical",
    name: "Técnico / Alta Visibilidade",
    description: "Linhas bem definidas para verificação de montagem e strings",
    siliconColor: "#10233f",
    frameColor: "#ffffff",
    frameWidth: 1.5,
    cellLineColor: "#dce8f7",
    cellLineOpacity: 0.65,
    cellLineWidth: 0.8,
    halfCutColor: "#ffffff",
    halfCutOpacity: 0.85,
    halfCutWidth: 1.4,
    busbarColor: "#c2dcf8",
    busbarOpacity: 0.45,
  },
};

export const INVERTER_CATALOG = [
  {
    id: "growatt-min-5000tl-x",
    manufacturer: "Growatt",
    model: "MIN 5000TL-X",
    label: "Growatt · MIN 5000TL-X (5 kW)",
    fullTitle: "Growatt · MIN 5000TL-X Monofásico/Bifásico (5.0 kW)",
    kw: 5.0,
    mpptCount: 2,
    minMpptV: 80,
    maxMpptV: 550,
    maxDcVoltageV: 550,
    maxCurrentMpptA: 13.5,
    maxAcCurrentA: 22.7,
  },
  {
    id: "deye-sun-8k-sg01lp1",
    manufacturer: "Deye",
    model: "SUN-8K-SG01LP1",
    label: "Deye · SUN-8K-SG01LP1 (8 kW)",
    fullTitle: "Deye · SUN-8K-SG01LP1 Híbrido (8.0 kW)",
    kw: 8.0,
    mpptCount: 2,
    minMpptV: 125,
    maxMpptV: 500,
    maxDcVoltageV: 500,
    maxCurrentMpptA: 26.0,
    maxAcCurrentA: 36.4,
  },
  {
    id: "sungrow-sg6-0rs",
    manufacturer: "Sungrow",
    model: "SG6.0RS",
    label: "Sungrow · SG6.0RS (6 kW)",
    fullTitle: "Sungrow · SG6.0RS Residencial (6.0 kW)",
    kw: 6.0,
    mpptCount: 2,
    minMpptV: 120,
    maxMpptV: 560,
    maxDcVoltageV: 600,
    maxCurrentMpptA: 16.0,
    maxAcCurrentA: 27.3,
  },
  {
    id: "fronius-primo-5-0-1",
    manufacturer: "Fronius",
    model: "Primo 5.0-1",
    label: "Fronius · Primo 5.0-1 (5 kW)",
    fullTitle: "Fronius · Primo 5.0-1 Premium (5.0 kW)",
    kw: 5.0,
    mpptCount: 2,
    minMpptV: 200,
    maxMpptV: 800,
    maxDcVoltageV: 1000,
    maxCurrentMpptA: 18.0,
    maxAcCurrentA: 21.7,
  },
  {
    id: "solis-s6-gr1p5k",
    manufacturer: "Solis",
    model: "S6-GR1P5K",
    label: "Solis · S6-GR1P5K (5 kW)",
    fullTitle: "Solis · S6-GR1P5K (5.0 kW)",
    kw: 5.0,
    mpptCount: 2,
    minMpptV: 90,
    maxMpptV: 520,
    maxDcVoltageV: 600,
    maxCurrentMpptA: 14.0,
    maxAcCurrentA: 22.7,
  },
  {
    id: "weg-siw500-10k",
    manufacturer: "WEG",
    model: "SIW500 T 10K",
    label: "WEG · SIW500 T (10 kW)",
    fullTitle: "WEG · SIW500 T Trifásico (10.0 kW)",
    kw: 10.0,
    mpptCount: 2,
    minMpptV: 160,
    maxMpptV: 850,
    maxDcVoltageV: 1000,
    maxCurrentMpptA: 15.0,
    maxAcCurrentA: 15.2,
  },
];

export function getInverterPreset(idOrModel) {
  if (!idOrModel) return INVERTER_CATALOG[0];
  const byId = INVERTER_CATALOG.find((inv) => inv.id === idOrModel || inv.model === idOrModel);
  if (byId) return byId;
  const numKw = Number(idOrModel);
  if (Number.isFinite(numKw)) {
    const byKw = INVERTER_CATALOG.find((inv) => inv.kw === numKw);
    if (byKw) return byKw;
  }
  return INVERTER_CATALOG[0];
}

export const CUSTOM_MODULES_STORAGE_KEY = "volta_custom_solar_modules";

export function getStoredCustomModules() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_MODULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function saveStoredCustomModule(moduleData) {
  if (typeof window === "undefined" || !window.localStorage) return moduleData;
  try {
    const existing = getStoredCustomModules();
    const id = moduleData.id || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const fullModule = {
      ...moduleData,
      id,
      isCustom: true,
      label: `${moduleData.manufacturer || "Custom"} · ${moduleData.model || "Módulo"} (${moduleData.wp} Wp)`,
      fullTitle: `${moduleData.manufacturer || "Personalizado"} · ${moduleData.model || "Módulo"} (${moduleData.wp} Wp)`,
      technology: moduleData.technology || "TOPCon N-Type",
      wp: Number(moduleData.wp) || 580,
      widthM: Number(moduleData.widthM) || 1.134,
      heightM: Number(moduleData.heightM) || 2.278,
      vmpV: Number(moduleData.vmpV) || 42.5,
      vocV: Number(moduleData.vocV) || 51.0,
      impA: Number(moduleData.impA) || 13.6,
      iscA: Number(moduleData.iscA) || 14.4,
    };
    const next = [fullModule, ...existing.filter((m) => m.id !== id)];
    window.localStorage.setItem(CUSTOM_MODULES_STORAGE_KEY, JSON.stringify(next));
    return fullModule;
  } catch (err) {
    return moduleData;
  }
}

export function deleteStoredCustomModule(id) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = getStoredCustomModules();
    const next = existing.filter((m) => m.id !== id);
    window.localStorage.setItem(CUSTOM_MODULES_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {}
}

export function getAllModulePresets(customModules = []) {
  const stored = getStoredCustomModules();
  const customs = [...(Array.isArray(customModules) ? customModules : []), ...stored];
  const seen = new Set();
  const uniqueCustoms = [];
  for (const c of customs) {
    if (c && c.id && !seen.has(c.id)) {
      seen.add(c.id);
      uniqueCustoms.push(c);
    }
  }
  return [...uniqueCustoms, ...MODULE_CATALOG];
}

export function getModulePreset(idOrWp, customList = []) {
  if (!idOrWp) return MODULE_CATALOG[0];
  const all = getAllModulePresets(customList);
  const byId = all.find((m) => m.id === idOrWp || m.model === idOrWp);
  if (byId) return byId;
  const numWp = Number(idOrWp);
  if (Number.isFinite(numWp)) {
    const byWp = all.find((m) => m.wp === numWp);
    if (byWp) return byWp;
  }
  return MODULE_CATALOG[0];
}

/**
 * Retorna as dimensões geométricas reais do módulo garantindo a proporção comercial (1:1.8 a 1:2.2).
 * Evita deformações ou módulos quadrados, priorizando medidas reais cadastradas ou o catálogo Tier-1.
 */
export function getModuleDimensions(config = {}) {
  const preset = getModulePreset(
    config.module_preset_id || config.module_model || config.module_wp,
    config.custom_modules || []
  );
  let rawWidth = finiteNumber(config.module_width_m, preset.widthM || SOLAR_MODULE_WIDTH_M);
  let rawHeight = finiteNumber(config.module_height_m, preset.heightM || SOLAR_MODULE_HEIGHT_M);

  let shortDim = Math.min(rawWidth, rawHeight);
  let longDim = Math.max(rawWidth, rawHeight);
  const ratio = longDim / Math.max(0.1, shortDim);

  // Proporção física esperada de painéis solares comerciais: ~1:1.8 a ~1:2.2
  // Se for deformado, quadrado ou inválido, utiliza os valores reais de catálogo Tier-1
  if (ratio < 1.6 || ratio > 2.4 || shortDim < 0.8 || longDim < 1.6) {
    shortDim = preset.widthM || SOLAR_MODULE_WIDTH_M;
    longDim = preset.heightM || SOLAR_MODULE_HEIGHT_M;
  }

  return {
    widthM: round2(shortDim),
    heightM: round2(longDim),
    ratio: round2(longDim / shortDim),
  };
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

/**
 * Interpola coordenadas geográficas entre dois pontos por uma razão linear (0.0 a 1.0).
 */
export function interpolateLatLng(start, end, ratio) {
  return {
    lat: start.lat + (end.lat - start.lat) * ratio,
    lng: start.lng + (end.lng - start.lng) * ratio,
  };
}

/**
 * Gera as divisões internas realistas das células fotovoltaicas (half-cell matrix).
 * Garante fidelidade geométrica aos painéis fotovoltaicos reais (Tier-1):
 * - 6 colunas de células ao longo do eixo menor (largura ~1.13m, ~18.9 cm por coluna)
 * - Linha central divisória de corte (half-cut gap)
 * - Fileiras transversais proporcionais ao longo do eixo maior (comprimento ~2.28m)
 * - Barramentos finos (busbars) em nível de detalhe avançado
 * - Funciona perfeitamente em modo retrato (vertical) ou paisagem (horizontal) e em qualquer azimute
 */
export function buildRealisticPanelCellLines(panel, zoomLevel = 20, highDetail = false) {
  if (!Array.isArray(panel) || panel.length < 4) return { primary: [], halfCut: [], secondary: [] };
  const [p0, p1, p2, p3] = panel;

  // Comprimentos métricos reais dos eixos para determinar com precisão absoluta orientação e proporções
  const len01 = distanceMeters(p0, p1);
  const len12 = distanceMeters(p1, p2);

  const primary = [];
  const halfCut = [];
  const secondary = [];
  const centerLines = [];

  const isLandscape = len01 > len12;
  // Margem de 1.8% para as células não encostarem nem sobreporem a moldura externa de alumínio
  const inset = 0.018;

  const safeLine = (start, end) => [
    interpolateLatLng(start, end, inset),
    interpolateLatLng(start, end, 1 - inset),
  ];

  if (!isLandscape) {
    // =========================================================================
    // ORIENTAÇÃO VERTICAL / RETRATO:
    // Aresta 0-1 (superior) e 3-2 (inferior) = Eixo menor (largura ~1.13m)
    // Aresta 0-3 (esquerda) e 1-2 (direita) = Eixo maior (altura ~2.28m)
    // =========================================================================

    // 1. Linhas de colunas de células (6 colunas = 5 divisórias uniformes)
    const cols = 6;
    for (let c = 1; c < cols; c++) {
      const ratioC = c / cols;
      const topPt = interpolateLatLng(p0, p1, ratioC);
      const btmPt = interpolateLatLng(p3, p2, ratioC);
      const line = safeLine(topPt, btmPt);
      primary.push(line);
      if (c === 3) {
        centerLines.push(line); // Eixo central longitudinal
      }
    }

    // 2. Linha divisória central transversal do Half-Cut (divide a altura em 2 metades simétricas)
    const midLeft = interpolateLatLng(p0, p3, 0.5);
    const midRight = interpolateLatLng(p1, p2, 0.5);
    const cutLine = safeLine(midLeft, midRight);
    halfCut.push(cutLine);
    centerLines.push(cutLine); // Eixo central transversal

    // 3. Divisores transversais de células ao longo do comprimento
    // Em zoom >= 16: 12 fileiras de células (6 por metade)
    // Em zoom < 16: 6 fileiras (3 por metade)
    const rows = zoomLevel >= 16 ? 12 : 6;
    for (let r = 1; r < rows; r++) {
      if (r === rows / 2) continue; // Meio já é a linha de half-cut
      const ratioR = r / rows;
      const leftPt = interpolateLatLng(p0, p3, ratioR);
      const rightPt = interpolateLatLng(p1, p2, ratioR);
      primary.push(safeLine(leftPt, rightPt));
    }

    // 4. Barramentos finos (busbars) para zoom elevado (zoom >= 18)
    if (highDetail && zoomLevel >= 18) {
      const b1Top = interpolateLatLng(p0, p1, 0.25);
      const b1Btm = interpolateLatLng(p3, p2, 0.25);
      const b2Top = interpolateLatLng(p0, p1, 0.75);
      const b2Btm = interpolateLatLng(p3, p2, 0.75);
      secondary.push(safeLine(b1Top, b1Btm));
      secondary.push(safeLine(b2Top, b2Btm));
    }
  } else {
    // =========================================================================
    // ORIENTAÇÃO HORIZONTAL / PAISAGEM:
    // Aresta 0-1 (superior) e 3-2 (inferior) = Eixo maior (comprimento ~2.28m)
    // Aresta 0-3 (esquerda) e 1-2 (direita) = Eixo menor (altura ~1.13m)
    // =========================================================================

    // 1. Linhas de colunas de células (6 faixas uniformes ao longo da largura de ~1.13m)
    const cols = 6;
    for (let c = 1; c < cols; c++) {
      const ratioC = c / cols;
      const leftPt = interpolateLatLng(p0, p3, ratioC);
      const rightPt = interpolateLatLng(p1, p2, ratioC);
      const line = safeLine(leftPt, rightPt);
      primary.push(line);
      if (c === 3) {
        centerLines.push(line); // Eixo central transversal em landscape
      }
    }

    // 2. Linha divisória central de corte Half-Cut (divide o comprimento de 2.28m ao meio)
    const midTop = interpolateLatLng(p0, p1, 0.5);
    const midBtm = interpolateLatLng(p3, p2, 0.5);
    const cutLine = safeLine(midTop, midBtm);
    halfCut.push(cutLine);
    centerLines.push(cutLine); // Eixo central de corte em landscape

    // 3. Divisores transversais de células ao longo do comprimento
    const rows = zoomLevel >= 16 ? 12 : 6;
    for (let r = 1; r < rows; r++) {
      if (r === rows / 2) continue;
      const ratioR = r / rows;
      const topPt = interpolateLatLng(p0, p1, ratioR);
      const btmPt = interpolateLatLng(p3, p2, ratioR);
      primary.push(safeLine(topPt, btmPt));
    }

    // 4. Barramentos finos (busbars) para zoom elevado
    if (highDetail && zoomLevel >= 18) {
      const b1Left = interpolateLatLng(p0, p3, 0.25);
      const b1Right = interpolateLatLng(p1, p2, 0.25);
      const b2Left = interpolateLatLng(p0, p3, 0.75);
      const b2Right = interpolateLatLng(p1, p2, 0.75);
      secondary.push(safeLine(b1Left, b1Right));
      secondary.push(safeLine(b2Left, b2Right));
    }
  }

  return { primary, halfCut, secondary, centerLines };
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
  const pitchDeg = Math.max(0, Math.min(60, finiteNumber(fallback.roof_pitch_deg, 12)));
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const cosPitch = Math.max(0.2, Math.cos(pitchRad));

  if (polygon.length < 3) {
    const projectedArea = round1(fallbackWidth * fallbackHeight);
    const realTiltedArea = round1(projectedArea / cosPitch);
    return {
      center,
      widthM: fallbackWidth,
      heightM: fallbackHeight,
      areaM2: projectedArea,
      projectedAreaM2: projectedArea,
      realTiltedAreaM2: realTiltedArea,
      pitchDeg,
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
  const projectedAreaM2 = round1(getPolygonAreaSquareMeters(polygon));
  const realTiltedAreaM2 = round1(projectedAreaM2 / cosPitch);

  return {
    center,
    widthM: round1(widthM),
    heightM: round1(heightM),
    areaM2: projectedAreaM2,
    projectedAreaM2,
    realTiltedAreaM2,
    pitchDeg,
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
 * Utiliza o algoritmo matemático exato de menor distância ponto-a-caixa (AABB vs Círculo de Segurança)
 */
function panelCollidesWithObstacle(panelCorners, centerPoint, localObstacles) {
  if (!localObstacles || !localObstacles.length) return false;

  for (let o = 0; o < localObstacles.length; o++) {
    const obs = localObstacles[o];
    if (obs.excludeArea === false) continue;
    const obsRadius = Number(obs.radiusM) || Math.max(Number(obs.widthM) || 1, Number(obs.heightM) || 1) / 2 || 0.8;
    // Margem de segurança de 0.30m ao redor do obstáculo (keepout buffer)
    const safeRadius = obsRadius + 0.3;

    // AABB do painel em coordenadas métricas locais
    let minE = Infinity;
    let maxE = -Infinity;
    let minN = Infinity;
    let maxN = -Infinity;

    for (let i = 0; i < panelCorners.length; i++) {
      const pt = panelCorners[i];
      if (pt.east < minE) minE = pt.east;
      if (pt.east > maxE) maxE = pt.east;
      if (pt.north < minN) minN = pt.north;
      if (pt.north > maxN) maxN = pt.north;
    }

    // Ponto mais próximo do retângulo em relação ao centro do obstáculo
    const closestEast = Math.max(minE, Math.min(obs.east, maxE));
    const closestNorth = Math.max(minN, Math.min(obs.north, maxN));
    const dEast = obs.east - closestEast;
    const dNorth = obs.north - closestNorth;

    // Se a distância for menor ou igual ao raio seguro, há colisão garantida
    if (dEast * dEast + dNorth * dNorth <= safeRadius * safeRadius) {
      return true;
    }
  }

  return false;
}

/**
 * Constrói polígonos de módulos considerando obstáculos, afastamentos e a estratégia de simulação
 */
export function buildPanelPolygons(config = {}, sizing = {}, options = {}) {
  // Espaçamento físico garantido em coordenadas métricas (padrão 2 cm = 0.02 m)
  const rawColGap = config.column_gap_cm !== undefined && config.column_gap_cm !== null && config.column_gap_cm !== ""
    ? Number(config.column_gap_cm)
    : 2;
  const rawRowGap = config.row_gap_cm !== undefined && config.row_gap_cm !== null && config.row_gap_cm !== ""
    ? Number(config.row_gap_cm)
    : 2;

  const columnGapM = Math.max(0, finiteNumber(rawColGap, 2) / 100);
  const rowGapM = Math.max(0, finiteNumber(rawRowGap, 2) / 100);
  const strategy = (typeof options === "object" ? options?.strategy : null) || config.layout_strategy || "max_generation";
  const obstacles = Array.isArray(config.obstacles) ? config.obstacles : [];

  const roofPolygon = getRoofPolygonFromConfig(config);
  if (roofPolygon.length < 3) return [];

  const center = getPolygonCentroid(roofPolygon) || getRoofCenterFromConfig(config);
  const metrics = getRoofMetricsFromPolygon(roofPolygon, config);
  const panelCount = Math.max(0, Math.min(1200, Math.round(finiteNumber(sizing.panelCount, 0))));

  // Obtém dimensões com proporção rigorosa de módulo comercial Tier-1 (~1:1.8 a 1:2.2)
  const dims = getModuleDimensions(config);
  const moduleWidth = dims.widthM;
  const moduleHeight = dims.heightM;
  
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
  let bestDistToCenter = Infinity;

  const roofCenterEast = (effectiveMinEast + effectiveMaxEast) / 2;
  const roofCenterNorth = (effectiveMinNorth + effectiveMaxNorth) / 2;

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

      if (localPanels.length > 0) {
        // Baricentro dos painéis para priorizar alinhamento simétrico e centralizado
        let avgEast = 0;
        let avgNorth = 0;
        for (let i = 0; i < localPanels.length; i++) {
          const p = localPanels[i];
          avgEast += (p[0].east + p[1].east + p[2].east + p[3].east) / 4;
          avgNorth += (p[0].north + p[1].north + p[2].north + p[3].north) / 4;
        }
        avgEast /= localPanels.length;
        avgNorth /= localPanels.length;
        const distToCenter = Math.hypot(avgEast - roofCenterEast, avgNorth - roofCenterNorth);

        if (localPanels.length > bestLocalPanels.length) {
          bestLocalPanels = localPanels;
          bestDistToCenter = distToCenter;
        } else if (localPanels.length === bestLocalPanels.length && distToCenter < bestDistToCenter) {
          bestLocalPanels = localPanels;
          bestDistToCenter = distToCenter;
        }
      }
    }
  }

  // Ordena os módulos em fileiras alinhadas e uniformes (Norte para Sul, Oeste para Leste)
  bestLocalPanels.sort((a, b) => {
    const centerAy = (a[0].north + a[2].north) / 2;
    const centerBy = (b[0].north + b[2].north) / 2;
    if (Math.abs(centerAy - centerBy) > rowPitch * 0.4) {
      return centerBy - centerAy; // Superior primeiro
    }
    const centerAx = (a[0].east + a[2].east) / 2;
    const centerBx = (b[0].east + b[2].east) / 2;
    return centerAx - centerBx; // Esquerda para direita
  });

  const excludedIndices = new Set(
    Array.isArray(config.excluded_module_indices)
      ? config.excluded_module_indices
      : (Array.isArray(options?.excludedIndices) ? options.excludedIndices : [])
  );

  const filteredPanels = excludedIndices.size > 0
    ? bestLocalPanels.filter((_, idx) => !excludedIndices.has(idx))
    : bestLocalPanels;

  return filteredPanels.slice(0, panelCount).map((localCorners) => (
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
  minTempC = 10,
  maxCellTempC = 70,
  maxInverterDcVoltageV = 1000,
  minMpptVoltageV = 140,
  maxMpptVoltageV = 800,
} = {}) {
  const totalPanels = Math.max(0, Math.round(Number(panelCount) || 0));
  if (totalPanels <= 0) return [];

  // Coeficientes térmicos típicos mono-PERC (%/°C)
  const betaVocPct = -0.28; // -0.28%/°C
  const gammaVmpPct = -0.35; // -0.35%/°C

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

    // Tensões Nominais STC (25°C)
    const stringVocStc = Math.round(size * vocModuleV * 10) / 10;
    const stringVmpStc = Math.round(size * vmpModuleV * 10) / 10;
    const stringPowerKw = Math.round((size * moduleWp) / 10) / 100;

    // Tensão de circuito aberto na temperatura mínima de projeto (Tmin = 10°C) - NBR 16690
    const vocCold = Math.round(size * vocModuleV * (1 + (betaVocPct / 100) * (minTempC - 25)) * 10) / 10;

    // Tensão MPPT na temperatura máxima de operação da célula (Tcell = 70°C)
    const vmpHot = Math.round(size * vmpModuleV * (1 + (gammaVmpPct / 100) * (maxCellTempC - 25)) * 10) / 10;

    // Verificações técnicas NBR 16690
    const isVocSafe = vocCold <= maxInverterDcVoltageV;
    const isMpptSafe = vmpHot >= minMpptVoltageV && stringVmpStc <= maxMpptVoltageV;
    const isCompatible = isVocSafe && isMpptSafe;

    strings.push({
      id: `string_${i + 1}`,
      name: `String ${String(i + 1).padStart(2, "0")}`,
      label: `String ${String(i + 1).padStart(2, "0")}: Módulos ${currentStart} – ${end}`,
      startModule: currentStart,
      endModule: end,
      moduleCount: size,
      powerKw: stringPowerKw,
      vocV: stringVocStc,
      vmpV: stringVmpStc,
      vocColdV: vocCold,
      vmpHotV: vmpHot,
      impA: impModuleA,
      iscA: iscModuleA,
      isVocSafe,
      isMpptSafe,
      isCompatible,
      statusMessage: !isVocSafe
        ? `Tensão Voc em Tmin (${vocCold}V) excede o limite máximo do inversor (${maxInverterDcVoltageV}V).`
        : !isMpptSafe
        ? `Tensão Vmp em alta temperatura (${vmpHot}V) abaixo da janela MPPT mínima (${minMpptVoltageV}V).`
        : "String compatível com a janela MPPT e limites do inversor.",
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
  const tiltDeg = config.roof_pitch_deg || metrics.pitchDeg || 12; // inclinação padrão 12°

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
    projectedAreaM2: metrics.projectedAreaM2 || metrics.areaM2 || 0,
    realTiltedAreaM2: metrics.realTiltedAreaM2 || metrics.areaM2 || 0,
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
    column_gap_cm: finiteNumber(partial.column_gap_cm, fallbackConfig.column_gap_cm ?? 2),
    row_gap_cm: finiteNumber(partial.row_gap_cm, fallbackConfig.row_gap_cm ?? 2),
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
    obstacles: globalConfig.obstacles || area.obstacles || [],
    roof_polygon: polygon,
    roof_rotation_deg: areaRotation,
    roof_pitch_deg: area.roof_pitch_deg ?? globalConfig.roof_pitch_deg ?? 12,
    structure_type: area.structure_type || globalConfig.structure_type || "triangle",
    module_orientation: area.module_orientation || globalConfig.module_orientation || "horizontal",
    column_gap_cm: area.column_gap_cm ?? globalConfig.column_gap_cm ?? 2,
    row_gap_cm: area.row_gap_cm ?? globalConfig.row_gap_cm ?? 2,
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
    module_orientation: area.module_orientation || layout.orientation || "horizontal",
    effectiveOrientation: layout.orientation || "horizontal",
    structure_type: area.structure_type || globalConfig.structure_type || "triangle",
    column_gap_cm: area.column_gap_cm ?? globalConfig.column_gap_cm ?? 2,
    row_gap_cm: area.row_gap_cm ?? globalConfig.row_gap_cm ?? 2,
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

/**
 * Move a single vertex in a polygon and returns normalized result
 */
export function moveVertex(points, vertexIndex, newLatLng) {
  const polygon = normalizeRoofPolygon(points);
  if (vertexIndex < 0 || vertexIndex >= polygon.length) return polygon;
  const updated = [...polygon];
  updated[vertexIndex] = {
    lat: roundCoordinate(newLatLng.lat),
    lng: roundCoordinate(newLatLng.lng),
  };
  return updated;
}

/**
 * Inserts a new vertex along an edge
 */
export function insertVertexAtEdge(points, edgeIndex, latlng = null) {
  const polygon = normalizeRoofPolygon(points);
  if (edgeIndex < 0 || edgeIndex >= polygon.length) return polygon;
  const updated = [...polygon];
  const newPt = latlng
    ? { lat: roundCoordinate(latlng.lat), lng: roundCoordinate(latlng.lng) }
    : {
        lat: roundCoordinate((polygon[edgeIndex].lat + polygon[(edgeIndex + 1) % polygon.length].lat) / 2),
        lng: roundCoordinate((polygon[edgeIndex].lng + polygon[(edgeIndex + 1) % polygon.length].lng) / 2),
      };
  updated.splice(edgeIndex + 1, 0, newPt);
  return updated;
}

/**
 * Removes a vertex if there are at least 4 vertices (maintaining a valid minimum polygon of 3)
 */
export function deleteVertex(points, vertexIndex) {
  const polygon = normalizeRoofPolygon(points);
  if (polygon.length <= 3) return polygon;
  if (vertexIndex < 0 || vertexIndex >= polygon.length) return polygon;
  const updated = [...polygon];
  updated.splice(vertexIndex, 1);
  return updated;
}

/**
 * Calcula azimute e cardinal a partir de um polígono
 */
export function calculateAzimuth(points) {
  const polygon = normalizeRoofPolygon(points);
  if (polygon.length < 2) {
    return { degrees: 0, cardinal: "N", formatted: "0° (N)" };
  }
  const rotation = getDominantRoofRotation(polygon, 0);
  return getAzimuthWithCardinal(rotation);
}
