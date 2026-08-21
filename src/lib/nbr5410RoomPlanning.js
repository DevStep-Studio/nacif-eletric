const DESIGN_WIDTH_PX = 1400;
const DESIGN_HEIGHT_PX = 900;
const DEFAULT_PIXELS_PER_METER = 50;

const LIGHTING_TYPES = new Set(["luminaria", "spot", "arandela"]);
const SWITCH_TYPES = new Set(["interruptor", "inter2", "inter3", "inter3way"]);

const WET_TYPES = new Set(["banheiro", "cozinha", "area_servico", "lavanderia"]);
const KITCHEN_SERVICE_TYPES = new Set(["cozinha", "area_servico", "lavanderia"]);

const normalizeText = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const normalizePixelsPerMeter = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_PIXELS_PER_METER;
};

export const roomMetersFromPercent = (value, axis = "x", pixelsPerMeter = DEFAULT_PIXELS_PER_METER) => {
  const designSize = axis === "y" ? DESIGN_HEIGHT_PX : DESIGN_WIDTH_PX;
  const pixels = (Math.max(0, Number(value) || 0) / 100) * designSize;
  return pixels / normalizePixelsPerMeter(pixelsPerMeter);
};

export const formatPtNumber = (value, digits = 1) => (
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
);

export function inferNBRRoomType(label = "", rawType = "") {
  const text = normalizeText(`${label} ${rawType}`);
  if (/banh|lavabo|wc/.test(text)) return "banheiro";
  if (/cozinha|copa/.test(text)) return "cozinha";
  if (/area.*serv|servico|lavander|laundry/.test(text)) return "area_servico";
  if (/varanda|sacada|terraco|extern/.test(text)) return "varanda";
  if (/quarto|dorm|suite|su[ií]te/.test(text)) return "quarto";
  if (/sala|estar|jantar|living/.test(text)) return "sala";
  if (/corredor|circulacao|hall/.test(text)) return "circulacao";
  if (/garagem|vaga/.test(text)) return "garagem";
  if (/escrit|office/.test(text)) return "escritorio";
  return "ambiente";
}

export function parseAreaM2(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export function getRoomMetrics(room = {}, pixelsPerMeter = DEFAULT_PIXELS_PER_METER) {
  const widthM = Number(room.width_m || room.widthM) || roomMetersFromPercent(room.w, "x", pixelsPerMeter);
  const lengthM = Number(room.length_m || room.lengthM) || roomMetersFromPercent(room.h, "y", pixelsPerMeter);
  const drawnArea = widthM * lengthM;
  const declaredArea = parseAreaM2(room.area_m2 || room.area);
  const areaM2 = declaredArea || drawnArea;
  const perimeterM = widthM > 0 && lengthM > 0 ? (widthM + lengthM) * 2 : 0;

  return {
    widthM,
    lengthM,
    areaM2,
    perimeterM,
  };
}

export function minimumLightingPowerVA(areaM2 = 0) {
  const area = Math.max(0, Number(areaM2) || 0);
  if (area <= 6) return 100;
  return 100 + Math.floor((area - 6) / 4) * 60;
}

export function minimumTugCount(roomType, areaM2 = 0, perimeterM = 0) {
  const perimeter = Math.max(0, Number(perimeterM) || 0);
  if (roomType === "banheiro") return 1;
  if (KITCHEN_SERVICE_TYPES.has(roomType)) return Math.max(1, Math.ceil(perimeter / 3.5));
  if (roomType === "varanda") return 1;
  if (Number(areaM2) <= 6) return 1;
  return Math.max(1, Math.ceil(perimeter / 5));
}

export function tugPowerVAAtIndex(roomType, index) {
  if (WET_TYPES.has(roomType)) return index < 3 ? 600 : 100;
  return 100;
}

export function isPointInsideRoom(point = {}, room = {}, margin = 0.2) {
  const x = Number(point.x);
  const y = Number(point.y);
  const roomX = Number(room.x);
  const roomY = Number(room.y);
  const roomW = Number(room.w);
  const roomH = Number(room.h);
  if (![x, y, roomX, roomY, roomW, roomH].every(Number.isFinite)) return false;
  return x >= roomX - margin &&
    x <= roomX + roomW + margin &&
    y >= roomY - margin &&
    y <= roomY + roomH + margin;
}

const countRoomPoints = (room, points) => {
  const inside = points.filter((point) => (
    isPointInsideRoom(point, room) ||
    normalizeText(point.room) === normalizeText(room.label || room.name)
  ));

  return {
    lighting: inside.filter((point) => LIGHTING_TYPES.has(point.type)).length,
    switches: inside.filter((point) => SWITCH_TYPES.has(point.type)).length,
    tugs: inside.filter((point) => point.type === "tug").length,
  };
};

const roomPoint = (room, dx, dy) => ({
  x: Math.max(4, Math.min(96, Number(room.x || 0) + Number(room.w || 0) * dx)),
  y: Math.max(4, Math.min(96, Number(room.y || 0) + Number(room.h || 0) * dy)),
});

const distributeInteriorPositions = (count) => {
  if (count <= 1) return [[0.5, 0.5]];
  if (count === 2) return [[0.34, 0.5], [0.66, 0.5]];
  if (count === 3) return [[0.3, 0.38], [0.7, 0.38], [0.5, 0.68]];
  if (count === 4) return [[0.3, 0.34], [0.7, 0.34], [0.3, 0.68], [0.7, 0.68]];

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return Array.from({ length: count }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return [
      (col + 1) / (cols + 1),
      (row + 1) / (rows + 1),
    ];
  });
};

const distributeWallPositions = (count) => {
  const base = [
    [0.18, 0.16],
    [0.5, 0.16],
    [0.82, 0.16],
    [0.88, 0.36],
    [0.88, 0.66],
    [0.82, 0.84],
    [0.5, 0.84],
    [0.18, 0.84],
    [0.12, 0.66],
    [0.12, 0.36],
  ];
  if (count <= base.length) return base.slice(0, count);

  return Array.from({ length: count }, (_, index) => {
    const position = (index + 0.5) / count;
    if (position < 0.25) return [0.12 + position * 3.04, 0.16];
    if (position < 0.5) return [0.88, 0.16 + (position - 0.25) * 2.72];
    if (position < 0.75) return [0.88 - (position - 0.5) * 3.04, 0.84];
    return [0.12, 0.84 - (position - 0.75) * 2.72];
  });
};

export function buildRoomRequirement(room = {}, points = [], pixelsPerMeter = DEFAULT_PIXELS_PER_METER) {
  const metrics = getRoomMetrics(room, pixelsPerMeter);
  const type = inferNBRRoomType(room.label || room.name, room.type);
  const lightingPowerVa = minimumLightingPowerVA(metrics.areaM2);
  const lightingPointCount = Math.max(1, Math.ceil(lightingPowerVa / 100));
  const tugCount = minimumTugCount(type, metrics.areaM2, metrics.perimeterM);
  const tugPowerVa = Array.from({ length: tugCount }, (_, index) => tugPowerVAAtIndex(type, index))
    .reduce((sum, value) => sum + value, 0);
  const existing = countRoomPoints(room, points);

  const missing = {
    lighting: Math.max(0, lightingPointCount - existing.lighting),
    switches: Math.max(0, 1 - existing.switches),
    tugs: Math.max(0, tugCount - existing.tugs),
  };

  const roomName = room.label || room.name || "Comodo";
  const lightingPositions = distributeInteriorPositions(lightingPointCount);
  const tugPositions = distributeWallPositions(tugCount);
  const lightingUnitPower = Math.max(60, Math.ceil(lightingPowerVa / lightingPointCount));

  const suggestedPoints = [
    ...lightingPositions.slice(existing.lighting).map(([dx, dy], index) => ({
      ...roomPoint(room, dx, dy),
      type: "luminaria",
      label: `Luminaria ${roomName} ${existing.lighting + index + 1}`,
      room: roomName,
      room_type: type,
      load_w: lightingUnitPower,
      circuit_type: "Iluminacao",
      circuit_key: "lighting",
      source: "nbr5410",
    })),
    ...Array.from({ length: missing.switches }, (_, index) => ({
      ...roomPoint(room, 0.14 + index * 0.06, 0.82),
      type: "interruptor",
      label: `Interruptor ${roomName}`,
      room: roomName,
      room_type: type,
      load_w: 0,
      circuit_type: "Iluminacao",
      circuit_key: "lighting",
      source: "nbr5410",
    })),
    ...tugPositions.slice(existing.tugs).map(([dx, dy], index) => {
      const tugIndex = existing.tugs + index;
      return {
        ...roomPoint(room, dx, dy),
        type: "tug",
        label: `TUG ${roomName} ${tugIndex + 1}`,
        room: roomName,
        room_type: type,
        load_w: tugPowerVAAtIndex(type, tugIndex),
        circuit_type: WET_TYPES.has(type) ? "Tomadas de Uso Geral - Areas molhadas" : "Tomadas de Uso Geral",
        circuit_key: WET_TYPES.has(type) ? "tugWet" : "tugGeneral",
        source: "nbr5410",
      };
    }),
  ];

  return {
    roomId: room.id,
    roomName,
    type,
    metrics,
    lightingPowerVa,
    lightingPointCount,
    tugCount,
    tugPowerVa,
    existing,
    missing,
    suggestedPoints,
    status: missing.lighting || missing.switches || missing.tugs ? "warn" : "pass",
  };
}

export function buildNBRRoomAnalysis(rooms = [], points = [], pixelsPerMeter = DEFAULT_PIXELS_PER_METER) {
  return rooms.map((room) => buildRoomRequirement(room, points, pixelsPerMeter));
}

export function summarizeNBRRoomAnalysis(analysis = []) {
  return analysis.reduce((acc, item) => {
    acc.rooms += 1;
    acc.lighting += item.lightingPointCount;
    acc.tugs += item.tugCount;
    acc.switches += 1;
    acc.missingLighting += item.missing.lighting;
    acc.missingTugs += item.missing.tugs;
    acc.missingSwitches += item.missing.switches;
    acc.lightingPowerVa += item.lightingPowerVa;
    acc.tugPowerVa += item.tugPowerVa;
    return acc;
  }, {
    rooms: 0,
    lighting: 0,
    tugs: 0,
    switches: 0,
    missingLighting: 0,
    missingTugs: 0,
    missingSwitches: 0,
    lightingPowerVa: 0,
    tugPowerVa: 0,
  });
}

export function buildNBRCircuitDrafts(analysis = [], project = {}) {
  const totals = summarizeNBRRoomAnalysis(analysis);
  const voltage = Number(project?.voltage) || 127;
  const drafts = [];

  if (totals.lightingPowerVa > 0) {
    drafts.push({
      id: "plant-nbr-lighting",
      circuit_id: "plant-nbr-lighting",
      source: "planta_nbr",
      name: "C01 Iluminacao NBR",
      type: "Iluminação",
      description: "Gerado pela planta conforme criterios residenciais NBR 5410.",
      power_w: totals.lightingPowerVa,
      load_w_total: totals.lightingPowerVa,
      voltage,
      supply_type: "Monofásico",
      power_factor: 0.92,
      length_m: 15,
      point_count: totals.lighting,
      demand_factor: 1,
    });
  }

  const generalTugPower = analysis
    .filter((item) => !WET_TYPES.has(item.type))
    .reduce((sum, item) => sum + item.tugPowerVa, 0);
  const generalTugCount = analysis
    .filter((item) => !WET_TYPES.has(item.type))
    .reduce((sum, item) => sum + item.tugCount, 0);

  if (generalTugPower > 0) {
    drafts.push({
      id: "plant-nbr-tug-general",
      circuit_id: "plant-nbr-tug-general",
      source: "planta_nbr",
      name: "C02 TUG Ambientes",
      type: "Tomadas de Uso Geral",
      description: "Tomadas de uso geral em salas, quartos, circulacoes e ambientes secos.",
      power_w: generalTugPower,
      load_w_total: generalTugPower,
      voltage,
      supply_type: "Monofásico",
      power_factor: 1,
      length_m: 20,
      point_count: generalTugCount,
      demand_factor: 1,
    });
  }

  const wetTugPower = analysis
    .filter((item) => WET_TYPES.has(item.type))
    .reduce((sum, item) => sum + item.tugPowerVa, 0);
  const wetTugCount = analysis
    .filter((item) => WET_TYPES.has(item.type))
    .reduce((sum, item) => sum + item.tugCount, 0);

  if (wetTugPower > 0) {
    drafts.push({
      id: "plant-nbr-tug-wet",
      circuit_id: "plant-nbr-tug-wet",
      source: "planta_nbr",
      name: "C03 TUG Areas Molhadas",
      type: "Tomadas de Uso Geral",
      description: "Tomadas de cozinha, banheiro, lavanderia e areas de servico.",
      power_w: wetTugPower,
      load_w_total: wetTugPower,
      voltage,
      supply_type: "Monofásico",
      power_factor: 1,
      length_m: 20,
      point_count: wetTugCount,
      demand_factor: 1,
      wet_area: true,
    });
  }

  return drafts;
}

export function circuitKeyForPoint(point = {}, roomType = "") {
  if (LIGHTING_TYPES.has(point.type) || SWITCH_TYPES.has(point.type)) return "lighting";
  if (point.type === "tug") return WET_TYPES.has(roomType || point.room_type) ? "tugWet" : "tugGeneral";
  return "";
}

export { DEFAULT_PIXELS_PER_METER };
