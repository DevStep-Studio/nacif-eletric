import { autoBalancePhases } from "@/lib/electricalEngine";

const DEFAULT_ROOMS = [
  { name: "Sala", type: "sala", area_m2: 8.85, center: [70, 42], switchAt: [62, 58], tugs: [[64, 34], [82, 36], [83, 55]], extras: [{ type: "rede", label: "RJ45 sala", x: 80, y: 44, load_w: 0 }] },
  { name: "Cozinha", type: "cozinha", area_m2: 5.45, center: [73, 20], switchAt: [64, 26], tugs: [[64, 18], [70, 18], [77, 18], [82, 25]], extras: [{ type: "tue", label: "TUE forno/coifa", x: 80, y: 18, load_w: 1200 }] },
  { name: "Area de servico", type: "area_molhada", area_m2: 3.3, center: [54, 18], switchAt: [58, 27], tugs: [[50, 18]], extras: [{ type: "tue", label: "TUE maquina lavar", x: 52, y: 24, load_w: 1000 }] },
  { name: "Quarto 1", type: "quarto", area_m2: 7.1, center: [43, 42], switchAt: [51, 57], tugs: [[34, 36], [48, 33], [35, 52]] },
  { name: "Quarto 2", type: "quarto", area_m2: 6.7, center: [42, 82], switchAt: [51, 72], tugs: [[34, 77], [48, 78], [35, 90]] },
  { name: "Quarto 3", type: "quarto", area_m2: 7.7, center: [73, 82], switchAt: [61, 75], tugs: [[65, 78], [82, 78], [81, 91]] },
  { name: "Banho", type: "banheiro", area_m2: 2.4, center: [43, 65], switchAt: [51, 62], tugs: [[40, 62]], extras: [{ type: "chuveiro", label: "Chuveiro 5500W", x: 38, y: 58, load_w: 5500 }] },
  { name: "Circulacao", type: "circulacao", area_m2: 2.75, center: [56, 66], switchAt: [55, 72], tugs: [] },
];

const DEFAULT_INFRASTRUCTURE = [
  { type: "qe", label: "QD-01 Distribuicao", room: "Circulacao", x_pct: 52, y_pct: 70, description: "Quadro acessivel, com DR/DPS e reserva tecnica." },
  { type: "caixa", label: "CX-01 derivacao social", room: "Circulacao", x_pct: 58, y_pct: 58, description: "Caixa de passagem para sala, quartos e circulacao." },
  { type: "caixa", label: "CX-02 areas molhadas", room: "Cozinha/Servico/Banho", x_pct: 57, y_pct: 30, description: "Derivacao dedicada para cozinha, servico e banheiro." },
  { type: "caixa", label: "CX-03 quartos", room: "Quartos", x_pct: 57, y_pct: 78, description: "Derivacao para tomadas e iluminacao dos quartos." },
];

const DEFAULT_ROUTES = [
  { label: "R1 INFRA", circuit_name: "Alimentacao de distribuicao", path: [{ x_pct: 52, y_pct: 70 }, { x_pct: 58, y_pct: 58 }], description: "Eletroduto tronco DN25." },
  { label: "R2 ILU", circuit_name: "C01 Iluminacao", path: [{ x_pct: 58, y_pct: 58 }, { x_pct: 56, y_pct: 66 }, { x_pct: 70, y_pct: 42 }, { x_pct: 43, y_pct: 42 }], description: "Retornos e comandos por caixas de passagem." },
  { label: "R3 TUG MOL", circuit_name: "C03 TUG cozinha/servico", path: [{ x_pct: 52, y_pct: 70 }, { x_pct: 57, y_pct: 30 }, { x_pct: 73, y_pct: 20 }, { x_pct: 54, y_pct: 18 }], description: "Separar circuito de tomadas de bancada e area de servico." },
  { label: "R4 TUG QTS", circuit_name: "C02 TUG quartos", path: [{ x_pct: 52, y_pct: 70 }, { x_pct: 57, y_pct: 78 }, { x_pct: 42, y_pct: 82 }, { x_pct: 73, y_pct: 82 }], description: "Ramal de tomadas dos dormitorios." },
  { label: "R5 CHUV", circuit_name: "C05 Chuveiro", path: [{ x_pct: 52, y_pct: 70 }, { x_pct: 46, y_pct: 65 }, { x_pct: 38, y_pct: 58 }], description: "Circuito dedicado, sem compartilhamento." },
];

const ROOM_TYPE_PATTERNS = [
  [/cozinha|copa/i, "cozinha"],
  [/banho|banheiro|wc|lavabo/i, "banheiro"],
  [/servi[cç]o|lavanderia|area molhada|área molhada/i, "area_molhada"],
  [/quarto|dorm|suite|su[ií]te/i, "quarto"],
  [/escrit[oó]rio|office/i, "escritorio"],
  [/sala|estar|jantar/i, "sala"],
  [/circula|hall|corredor/i, "circulacao"],
  [/garagem/i, "garagem"],
  [/varanda|sacada/i, "varanda"],
];

const REQUEST_ROOM_TYPES = [
  { type: "sala", label: "Sala", aliases: ["sala", "salas", "estar", "jantar"] },
  { type: "cozinha", label: "Cozinha", aliases: ["cozinha", "cozinhas", "copa"] },
  { type: "quarto", label: "Quarto", aliases: ["quarto", "quartos", "dormitorio", "dormitorios", "dormitório", "dormitórios"] },
  { type: "quarto", label: "Suite", aliases: ["suite", "suites", "suíte", "suítes"] },
  { type: "banheiro", label: "Banheiro", aliases: ["banheiro", "banheiros", "banho", "lavabo", "lavabos", "wc"] },
  { type: "area_molhada", label: "Area de servico", aliases: ["area de servico", "área de serviço", "areas de servico", "lavanderia", "lavanderias"] },
  { type: "escritorio", label: "Escritorio", aliases: ["escritorio", "escritório", "office", "home office"] },
  { type: "garagem", label: "Garagem", aliases: ["garagem", "garagens"] },
  { type: "varanda", label: "Varanda", aliases: ["varanda", "varandas", "sacada", "sacadas"] },
  { type: "circulacao", label: "Circulacao", aliases: ["circulacao", "circulação", "hall", "corredor"] },
];

const REQUEST_ITEM_TYPES = [
  { key: "tug", aliases: ["tomada", "tomadas", "tug", "tugs"] },
  { key: "luminaria", aliases: ["luminaria", "luminarias", "luminária", "luminárias", "lampada", "lampadas", "lâmpada", "lâmpadas"] },
  { key: "interruptor", aliases: ["interruptor", "interruptores"] },
  { key: "chuveiro", aliases: ["chuveiro", "chuveiros"] },
  { key: "arcond", aliases: ["ar condicionado", "ar-condicionado", "arcond", "split", "splits"] },
  { key: "rede", aliases: ["rede", "rj45", "dados", "internet"] },
  { key: "rack-cftv", aliases: ["rack cftv", "rack de cftv", "rack", "dvr", "nvr"] },
  { key: "camera", aliases: ["camera", "cameras", "câmera", "câmeras", "cftv"] },
  { key: "sensor", aliases: ["sensor", "sensores"] },
];

const TYPE_LOAD_W = {
  luminaria: 100,
  spot: 80,
  arandela: 60,
  tug: 100,
  tue: 1200,
  arcond: 1800,
  chuveiro: 5500,
  motor: 750,
  rede: 0,
  sensor: 0,
  camera: 30,
  "rack-cftv": 0,
  interruptor: 0,
  inter2: 0,
  inter3: 0,
  inter3way: 0,
  qe: 0,
  caixa: 0,
};

const TYPE_CIRCUIT = {
  luminaria: "Iluminacao",
  spot: "Iluminacao",
  arandela: "Iluminacao",
  interruptor: "Iluminacao",
  inter2: "Iluminacao",
  inter3: "Iluminacao",
  inter3way: "Iluminacao",
  tug: "Tomadas de Uso Geral",
  rede: "Tomadas de Uso Geral",
  sensor: "Automacao",
  camera: "Automacao",
  "rack-cftv": "Automacao",
  tue: "Tomadas de Uso Especifico",
  arcond: "Ar Condicionado",
  chuveiro: "Chuveiro",
  motor: "Motor",
};

const LIGHT_POINT_TYPES = new Set(["luminaria", "spot", "arandela"]);
const SWITCH_POINT_TYPES = new Set(["interruptor", "inter2", "inter3", "inter3way"]);
const SERIAL_OUTLET_POINT_TYPES = new Set(["tug"]);
const DIRECT_QD_POINT_TYPES = new Set(["arcond", "chuveiro", "motor", "tue"]);

const clampPct = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(4, Math.min(96, number));
};

const normalizeRequestText = (text = "") => String(text)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countForAliases = (text, aliases = []) => {
  for (const alias of aliases) {
    const normalizedAlias = normalizeRequestText(alias);
    const aliasPattern = escapeRegex(normalizedAlias).replace(/\s+/g, "\\s+");
    const before = text.match(new RegExp(`(?:^|\\D)(\\d{1,3})\\s*(?:${aliasPattern})(?:s|es)?\\b`));
    if (before) return Number(before[1]);
    const after = text.match(new RegExp(`\\b(?:${aliasPattern})(?:s|es)?\\s*(\\d{1,3})(?:\\D|$)`));
    if (after) return Number(after[1]);
  }
  return 0;
};

const hasAlias = (text, aliases = []) => aliases.some((alias) => {
  const normalizedAlias = normalizeRequestText(alias);
  const aliasPattern = escapeRegex(normalizedAlias).replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${aliasPattern}\\b`).test(text);
});

const point = ({ type, label, room, x, y, load_w = TYPE_LOAD_W[type] || 0, circuit_type }) => ({
  type,
  label,
  room,
  load_w,
  circuit_type: circuit_type || TYPE_CIRCUIT[type] || "Ponto eletrico",
  x_pct: clampPct(x, 50),
  y_pct: clampPct(y, 50),
});

const inferRoomType = (name = "", fallback = "ambiente") => {
  const found = ROOM_TYPE_PATTERNS.find(([pattern]) => pattern.test(name));
  return found?.[1] || fallback;
};

const pointX = (point = {}) => point.x_pct ?? point.x ?? 50;
const pointY = (point = {}) => point.y_pct ?? point.y ?? 50;

const pointNode = (point = {}) => ({
  x_pct: pointX(point),
  y_pct: pointY(point),
});

const pointDistance = (a = {}, b = {}) => Math.hypot(pointX(a) - pointX(b), pointY(a) - pointY(b));

const findClosestPoint = (source, candidates = []) => (
  candidates.reduce((closest, candidate) => {
    if (!closest) return candidate;
    return pointDistance(source, candidate) < pointDistance(source, closest) ? candidate : closest;
  }, null)
);

const orderPointsByNearest = (source, candidates = []) => {
  const remaining = [...candidates];
  const ordered = [];
  let current = source;
  while (remaining.length > 0) {
    const next = findClosestPoint(current, remaining);
    ordered.push(next);
    remaining.splice(remaining.indexOf(next), 1);
    current = next;
  }
  return ordered;
};

const pointInsideRoom = (point = {}, room = {}) => {
  const x = pointX(point);
  const y = pointY(point);
  const roomX = room.x_pct ?? room.x ?? 0;
  const roomY = room.y_pct ?? room.y ?? 0;
  const roomW = room.w_pct ?? room.w ?? 0;
  const roomH = room.h_pct ?? room.h ?? 0;
  return x >= roomX && x <= roomX + roomW && y >= roomY && y <= roomY + roomH;
};

const normalizeRoomKey = (value = "") => normalizeRequestText(value || "sem ambiente");

const getPointRoomInfo = (point = {}, rooms = []) => {
  const explicitName = point.room || point.room_name || "";
  const containingRoom = rooms.find((room) => pointInsideRoom(point, room));
  const roomName = explicitName || containingRoom?.name || containingRoom?.label || "";
  const roomType = point.room_type || containingRoom?.type || inferRoomType(roomName, "ambiente");
  return {
    key: normalizeRoomKey(roomName || roomType),
    name: roomName,
    type: inferRoomType(`${roomName} ${roomType}`, roomType),
  };
};

const buildRequestedRooms = (requestText = "") => {
  const text = normalizeRequestText(requestText);
  const rooms = [];

  REQUEST_ROOM_TYPES.forEach((spec) => {
    let count = countForAliases(text, spec.aliases);
    if (count === 0 && hasAlias(text, spec.aliases) && ["sala", "cozinha", "area_molhada", "garagem", "varanda", "circulacao", "escritorio"].includes(spec.type)) {
      count = 1;
    }

    for (let index = 0; index < Math.min(count, 20); index += 1) {
      rooms.push({
        name: count > 1 || ["quarto", "banheiro"].includes(spec.type) ? `${spec.label} ${index + 1}` : spec.label,
        type: spec.type,
      });
    }
  });

  const genericRoomCount = countForAliases(text, ["comodo", "comodos", "cômodo", "cômodos", "ambiente", "ambientes"]);
  const defaultSequence = [
    { name: "Sala", type: "sala" },
    { name: "Cozinha", type: "cozinha" },
    { name: "Banheiro", type: "banheiro" },
    { name: "Quarto 1", type: "quarto" },
    { name: "Quarto 2", type: "quarto" },
    { name: "Area de servico", type: "area_molhada" },
    { name: "Escritorio", type: "escritorio" },
    { name: "Garagem", type: "garagem" },
  ];

  if (rooms.length === 0 && genericRoomCount > 0) {
    for (let index = 0; index < Math.min(genericRoomCount, 20); index += 1) {
      rooms.push(defaultSequence[index] || { name: `Comodo ${index + 1}`, type: "ambiente" });
    }
  } else if (genericRoomCount > rooms.length) {
    for (let index = rooms.length; index < Math.min(genericRoomCount, 20); index += 1) {
      rooms.push(defaultSequence[index] || { name: `Comodo ${index + 1}`, type: "ambiente" });
    }
  }

  if (rooms.length === 0) return [];

  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(rooms.length))));
  const rows = Math.ceil(rooms.length / columns);
  const gap = 0;
  const x0 = 6;
  const y0 = 8;
  const totalW = 88;
  const totalH = 82;
  const roomW = totalW / columns;
  const roomH = totalH / rows;

  return rooms.map((room, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      ...room,
      x_pct: x0 + col * roomW,
      y_pct: y0 + row * roomH,
      w_pct: roomW,
      h_pct: roomH,
      area_m2: 0,
    };
  });
};

const buildItemTargets = (requestText = "") => {
  const text = normalizeRequestText(requestText);
  const targets = Object.fromEntries(REQUEST_ITEM_TYPES.map((item) => [item.key, countForAliases(text, item.aliases)]));
  targets.total = countForAliases(text, ["item", "itens", "ponto", "pontos"]);
  return targets;
};

const pointOffsets = [
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
  [0.5, 0.18],
  [0.5, 0.82],
  [0.18, 0.5],
  [0.82, 0.5],
];

const createRequestedPoint = (type, rooms, index) => {
  const room = rooms[index % Math.max(rooms.length, 1)] || {
    name: "Casa",
    x_pct: 10,
    y_pct: 10,
    w_pct: 80,
    h_pct: 80,
  };
  const [dx, dy] = pointOffsets[index % pointOffsets.length];
  const position = roomPoint(room, dx, dy);
  const labelByType = {
    tug: "TUG",
    luminaria: "Luminaria",
    interruptor: "Interruptor",
    inter3: "Interruptor 3 secoes",
    chuveiro: "Chuveiro",
    arcond: "Ar condicionado",
    rede: "RJ45",
    camera: "Camera",
    "rack-cftv": "Rack CFTV",
    sensor: "WIFI",
  };
  return point({
    type,
    label: `${labelByType[type] || "Ponto"} ${index + 1}`,
    room: room.name,
    x: position.x,
    y: position.y,
    load_w: TYPE_LOAD_W[type] || 0,
    circuit_type: TYPE_CIRCUIT[type],
  });
};

const fitSpecificItemTargets = (points, rooms, targets) => {
  let next = [...points];
  REQUEST_ITEM_TYPES.forEach(({ key }) => {
    const target = Number(targets[key]) || 0;
    if (target <= 0) return;

    const current = next.filter((item) => item.type === key).length;
    if (current > target) {
      let remaining = target;
      next = next.filter((item) => {
        if (item.type !== key) return true;
        remaining -= 1;
        return remaining >= 0;
      });
    } else if (current < target) {
      const extras = Array.from({ length: target - current }, (_, index) => createRequestedPoint(key, rooms, current + index));
      next = [...next, ...extras];
    }
  });
  return next;
};

const fitGenericItemTotal = (points, rooms, targetTotal) => {
  const target = Number(targetTotal) || 0;
  if (target <= 0) return points;
  if (points.length === target) return points;
  if (points.length > target) {
    const priority = { tug: 1, rede: 2, camera: 3, "rack-cftv": 4, sensor: 5, arcond: 6, chuveiro: 7, interruptor: 8, luminaria: 9, tue: 10 };
    return [...points]
      .sort((a, b) => (priority[b.type] || 10) - (priority[a.type] || 10))
      .slice(0, target);
  }

  const cycle = ["tug", "luminaria", "interruptor", "tug", "rede"];
  const extras = Array.from({ length: target - points.length }, (_, index) => (
    createRequestedPoint(cycle[index % cycle.length], rooms, points.length + index)
  ));
  return [...points, ...extras];
};

const roomPoint = (room, dx, dy) => ({
  x: clampPct((room.x_pct || 0) + (room.w_pct || 8) * dx, 50),
  y: clampPct((room.y_pct || 0) + (room.h_pct || 8) * dy, 50),
});

export function buildPointsFromMountedRooms(rooms = []) {
  const suggested = [];
  rooms.forEach((rawRoom, roomIndex) => {
    const room = {
      ...rawRoom,
      name: rawRoom.name || `Comodo ${roomIndex + 1}`,
      type: inferRoomType(rawRoom.name, rawRoom.type),
      x_pct: clampPct(rawRoom.x_pct, 40),
      y_pct: clampPct(rawRoom.y_pct, 40),
      w_pct: Math.max(4, Math.min(90, Number(rawRoom.w_pct) || 12)),
      h_pct: Math.max(4, Math.min(90, Number(rawRoom.h_pct) || 10)),
    };
    const center = roomPoint(room, 0.5, 0.5);
    const switchAt = roomPoint(room, 0.16, 0.82);

    suggested.push(point({
      type: "luminaria",
      label: `Luminaria ${room.name}`,
      room: room.name,
      x: center.x,
      y: center.y,
      load_w: room.type === "cozinha" ? 160 : 100,
      circuit_type: "Iluminacao",
    }));

    suggested.push(point({
      type: "interruptor",
      label: `Interruptor ${room.name}`,
      room: room.name,
      x: switchAt.x,
      y: switchAt.y,
      circuit_type: "Iluminacao",
    }));

    const tugCountByType = {
      banheiro: 1,
      area_molhada: 2,
      cozinha: 4,
      quarto: 3,
      sala: 3,
      garagem: 2,
      circulacao: 1,
      ambiente: 2,
    };
    const tugCount = tugCountByType[room.type] || 2;
    const tugPositions = [
      [0.18, 0.22],
      [0.82, 0.22],
      [0.18, 0.78],
      [0.82, 0.78],
      [0.5, 0.14],
      [0.5, 0.86],
    ];

    tugPositions.slice(0, tugCount).forEach(([dx, dy], index) => {
      const p = roomPoint(room, dx, dy);
      const wetOrKitchen = ["cozinha", "area_molhada", "banheiro"].includes(room.type);
      suggested.push(point({
        type: "tug",
        label: `TUG ${room.name} ${index + 1}`,
        room: room.name,
        x: p.x,
        y: p.y,
        load_w: wetOrKitchen ? 600 : 100,
        circuit_type: wetOrKitchen ? "Tomadas de Uso Geral - Areas molhadas" : "Tomadas de Uso Geral",
      }));
    });

    if (room.type === "cozinha") {
      const p = roomPoint(room, 0.78, 0.5);
      suggested.push(point({ type: "tue", label: `TUE bancada ${room.name}`, room: room.name, x: p.x, y: p.y, load_w: 1200 }));
    }
    if (room.type === "area_molhada") {
      const p = roomPoint(room, 0.7, 0.5);
      suggested.push(point({ type: "tue", label: `TUE maquina ${room.name}`, room: room.name, x: p.x, y: p.y, load_w: 1000 }));
    }
    if (room.type === "banheiro") {
      const p = roomPoint(room, 0.78, 0.28);
      suggested.push(point({ type: "chuveiro", label: `Chuveiro ${room.name}`, room: room.name, x: p.x, y: p.y, load_w: 5500 }));
    }
    if (room.type === "sala") {
      const p = roomPoint(room, 0.72, 0.58);
      suggested.push(point({ type: "rede", label: `RJ45 ${room.name}`, room: room.name, x: p.x, y: p.y, load_w: 0 }));
    }
  });

  return suggested;
}

export function buildResidentialPointLibrary() {
  const suggested = [];

  DEFAULT_ROOMS.forEach((room) => {
    suggested.push(point({
      type: "luminaria",
      label: `Luminaria ${room.name}`,
      room: room.name,
      x: room.center[0],
      y: room.center[1],
      load_w: room.type === "cozinha" ? 160 : 100,
      circuit_type: "Iluminacao",
    }));

    suggested.push(point({
      type: "interruptor",
      label: `Interruptor ${room.name}`,
      room: room.name,
      x: room.switchAt[0],
      y: room.switchAt[1],
      circuit_type: "Iluminacao",
    }));

    room.tugs.forEach(([x, y], index) => {
      suggested.push(point({
        type: "tug",
        label: `TUG ${room.name} ${index + 1}`,
        room: room.name,
        x,
        y,
        load_w: room.type === "cozinha" || room.type === "area_molhada" ? 600 : 100,
        circuit_type: room.type === "cozinha" || room.type === "area_molhada"
          ? "Tomadas de Uso Geral - Areas molhadas"
          : "Tomadas de Uso Geral",
      }));
    });

    (room.extras || []).forEach((extra) => {
      suggested.push(point({
        ...extra,
        room: room.name,
        x: extra.x,
        y: extra.y,
        circuit_type: extra.circuit_type || TYPE_CIRCUIT[extra.type],
      }));
    });
  });

  return suggested;
}

const loadForPoint = (p) => Number(p.load_w) || TYPE_LOAD_W[p.type] || 0;

const countLoadPoints = (points) => points.filter((p) => loadForPoint(p) > 0 || ["tug", "tue", "arcond", "chuveiro", "motor", "luminaria", "spot", "arandela"].includes(p.type)).length;

const circuit = ({ name, type, points, power_w, supply_type = "Monofásico", voltage = 220, length_m = 18, install_method = "Eletroduto Embutido em Parede", wet_area = false }) => ({
  name,
  type,
  points: points.map((p) => p.label || p.type),
  point_count: Math.max(1, countLoadPoints(points)),
  power_w: Math.max(80, Math.round(power_w || points.reduce((total, p) => total + loadForPoint(p), 0))),
  load_w_total: Math.max(80, Math.round(power_w || points.reduce((total, p) => total + loadForPoint(p), 0))),
  supply_type,
  voltage,
  length_m,
  install_method,
  power_factor: type === "Iluminacao" ? 0.92 : type === "Motor" || type === "Ar Condicionado" ? 0.85 : 1,
  wet_area,
});

export function generateProfessionalCircuits(inputPoints = [], infraType = "embutido") {
  const points = inputPoints;
  if (points.length === 0) return [];
  const install_method = infraType === "galvanizado" ? "Eletroduto Aparente" : "Eletroduto Embutido em Parede";
  const byType = {
    lighting: points.filter((p) => ["luminaria", "spot", "arandela", "interruptor", "inter2", "inter3", "inter3way"].includes(p.type)),
    socialTug: points.filter((p) => p.type === "tug" && !/cozinha|servico|serviço|banho|banheiro|molhada/i.test(`${p.room || ""} ${p.circuit || ""} ${p.circuit_type || ""}`)),
    wetTug: points.filter((p) => p.type === "tug" && /cozinha|servico|serviço|banho|banheiro|molhada/i.test(`${p.room || ""} ${p.circuit || ""} ${p.circuit_type || ""}`)),
    tue: points.filter((p) => p.type === "tue"),
    arcond: points.filter((p) => p.type === "arcond"),
    chuveiro: points.filter((p) => p.type === "chuveiro"),
    motor: points.filter((p) => p.type === "motor"),
    tech: points.filter((p) => ["rede", "sensor", "camera", "rack-cftv"].includes(p.type)),
  };

  const circuits = [];
  if (byType.lighting.length) {
    circuits.push(circuit({
      name: "C01 - Iluminacao geral",
      type: "Iluminacao",
      points: byType.lighting,
      power_w: Math.max(400, byType.lighting.reduce((sum, p) => sum + loadForPoint(p), 0)),
      length_m: 22,
      install_method,
    }));
  }
  if (byType.socialTug.length || byType.tech.length) {
    circuits.push(circuit({
      name: "C02 - TUG salas e quartos",
      type: "Tomadas de Uso Geral",
      points: [...byType.socialTug, ...byType.tech],
      power_w: Math.max(900, byType.socialTug.reduce((sum, p) => sum + loadForPoint(p), 0) + 100),
      length_m: 26,
      install_method,
    }));
  }
  if (byType.wetTug.length) {
    circuits.push(circuit({
      name: "C03 - TUG cozinha e areas molhadas",
      type: "Tomadas de Uso Geral",
      points: byType.wetTug,
      power_w: Math.max(1800, byType.wetTug.reduce((sum, p) => sum + loadForPoint(p), 0)),
      length_m: 24,
      wet_area: true,
      install_method,
    }));
  }
  if (byType.tue.length) {
    circuits.push(circuit({
      name: "C04 - TUE equipamentos dedicados",
      type: "Tomadas de Uso Especifico",
      points: byType.tue,
      power_w: Math.max(1600, byType.tue.reduce((sum, p) => sum + loadForPoint(p), 0)),
      length_m: 20,
      install_method,
    }));
  }
  byType.chuveiro.forEach((p, index) => circuits.push(circuit({
    name: `C${String(circuits.length + 1).padStart(2, "0")} - Chuveiro ${index + 1}`,
    type: "Chuveiro",
    points: [p],
    power_w: loadForPoint(p) || 5500,
    supply_type: "Bifásico",
    voltage: 220,
    length_m: 18,
    wet_area: true,
    install_method,
  })));
  byType.arcond.forEach((p, index) => circuits.push(circuit({
    name: `C${String(circuits.length + 1).padStart(2, "0")} - Ar condicionado ${index + 1}`,
    type: "Ar Condicionado",
    points: [p],
    power_w: loadForPoint(p) || 1800,
    supply_type: "Bifásico",
    voltage: 220,
    length_m: 24,
    install_method,
  })));
  byType.motor.forEach((p, index) => circuits.push(circuit({
    name: `C${String(circuits.length + 1).padStart(2, "0")} - Motor ${index + 1}`,
    type: "Motor",
    points: [p],
    power_w: loadForPoint(p) || 750,
    voltage: 220,
    length_m: 20,
    install_method,
  })));

  return autoBalancePhases(circuits);
}

export function generateProfessionalInfrastructure(inputPoints = [], infraType = "embutido", options = {}) {
  const points = inputPoints;
  if (points.length === 0) return { infrastructure: [], routes: [] };
  const board = points.find((p) => p.type === "qe") || { x: 52, y: 70 };
  const qeX = pointX(board);
  const qeY = pointY(board);
  const rooms = Array.isArray(options.rooms) ? options.rooms : [];

  const infrastructure = DEFAULT_INFRASTRUCTURE;

  const lights = points.filter(p => LIGHT_POINT_TYPES.has(p.type));
  const switches = points.filter(p => SWITCH_POINT_TYPES.has(p.type));
  const findClosest = (src, candidates) => {
    if (candidates.length === 0) return null;
    let closest = null;
    let minDist = Infinity;
    const sx = pointX(src);
    const sy = pointY(src);
    candidates.forEach(c => {
      const cx = pointX(c);
      const cy = pointY(c);
      const dist = Math.hypot(cx - sx, cy - sy);
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    });
    return closest;
  };

  const routes = [];
  let routeIndex = 1;
  const consumedIds = new Set();
  const pointId = (point, fallback) => String(point.id || point.label || `${point.type}-${fallback}`);
  const labelSuffix = infraType === "galvanizado" ? " (GALV)" : "";

  const pushRoute = ({ label, circuitName, path, description }) => {
    routes.push({
      label: `R${routeIndex++} - ${label}${labelSuffix}`,
      circuit_name: circuitName,
      path,
      infraType,
      description,
    });
  };

  switches.forEach((switchPoint, index) => {
    const switchId = pointId(switchPoint, index);
    const switchRoom = getPointRoomInfo(switchPoint, rooms);
    const availableLights = lights.filter((light, lightIndex) => !consumedIds.has(pointId(light, lightIndex)));
    const sameRoomLights = availableLights.filter((light) => {
      const lightRoom = getPointRoomInfo(light, rooms);
      return lightRoom.key && lightRoom.key === switchRoom.key;
    });
    const assignedLights = sameRoomLights.length > 0
      ? orderPointsByNearest(switchPoint, sameRoomLights)
      : (availableLights.length > 0 ? [findClosest(switchPoint, availableLights)] : []);

    pushRoute({
      label: `Comando ${switchPoint.label || switchPoint.type}`,
      circuitName: switchPoint.circuit || switchPoint.circuit_type || TYPE_CIRCUIT[switchPoint.type] || "Iluminacao",
      path: [
        { x_pct: qeX, y_pct: qeY },
        pointNode(switchPoint),
      ],
      description: "Alimentação de iluminação sai do quadro para o interruptor.",
    });
    consumedIds.add(switchId);

    let previous = switchPoint;
    assignedLights.filter(Boolean).forEach((light, lightIndex) => {
      pushRoute({
        label: `Ilum. ${light.label || light.type}`,
        circuitName: light.circuit || light.circuit_type || TYPE_CIRCUIT[light.type] || "Iluminacao",
        path: [
          pointNode(previous),
          pointNode(light),
        ],
        description: lightIndex === 0
          ? "Luminária ligada a partir do interruptor do ambiente."
          : "Luminárias ligadas em série no mesmo comando.",
      });
      consumedIds.add(pointId(light, points.indexOf(light)));
      previous = light;
    });
  });

  lights.forEach((light, index) => {
    const lightId = pointId(light, index);
    if (consumedIds.has(lightId)) return;
    pushRoute({
      label: `Ilum. ${light.label || light.type}`,
      circuitName: light.circuit || light.circuit_type || TYPE_CIRCUIT[light.type] || "Iluminacao",
      path: [
        { x_pct: qeX, y_pct: qeY },
        pointNode(light),
      ],
      description: "Alimentação direta por falta de interruptor associado.",
    });
    consumedIds.add(lightId);
  });

  const serialOutletsByGroup = new Map();
  points.forEach((pointItem, index) => {
    if (!SERIAL_OUTLET_POINT_TYPES.has(pointItem.type)) return;
    const roomInfo = getPointRoomInfo(pointItem, rooms);
    const circuitKey = pointItem.circuit_id || pointItem.circuit || pointItem.circuit_type || "tomadas";
    const roomKey = roomInfo.key || "sem-ambiente";
    const key = `${circuitKey}:${roomKey}`;
    serialOutletsByGroup.set(key, [...(serialOutletsByGroup.get(key) || []), pointItem]);
  });

  serialOutletsByGroup.forEach((outlets) => {
    let previous = board;
    orderPointsByNearest(board, outlets).forEach((tug, index) => {
      pushRoute({
        label: "TUG serie",
        circuitName: tug.circuit || tug.circuit_type || TYPE_CIRCUIT[tug.type] || "Circuito TUG",
        path: [
          pointNode(previous),
          pointNode(tug),
        ],
        description: index === 0
          ? "Alimentação entra na primeira tomada da série."
          : "Tomadas ligadas em série no mesmo ramal.",
      });
      consumedIds.add(pointId(tug, points.indexOf(tug)));
      previous = tug;
    });
  });

  points.forEach((p) => {
    if (p.type === "qe" || p.type === "text") return;
    if (LIGHT_POINT_TYPES.has(p.type) || SWITCH_POINT_TYPES.has(p.type)) return;
    if (consumedIds.has(pointId(p, points.indexOf(p)))) return;

    const px = pointX(p);
    const py = pointY(p);

    // Dedicated loads route directly to QE.
    if (DIRECT_QD_POINT_TYPES.has(p.type)) {
      routes.push({
        label: `R${routeIndex++} - Dedicado ${p.label || p.type}${labelSuffix}`,
        circuit_name: p.circuit || p.circuit_type || TYPE_CIRCUIT[p.type] || "Circuito dedicado",
        path: [
          { x_pct: px, y_pct: py },
          ...(infraType === "galvanizado" ? [{ x_pct: px, y_pct: qeY }] : []),
          { x_pct: qeX, y_pct: qeY }
        ],
        infraType,
        description: "Alimentação direta do circuito dedicado."
      });
    }
    // Passage boxes route to QE.
    else if (p.type === "caixa") {
      routes.push({
        label: `R${routeIndex++} - Tronco ${p.label || p.type}${labelSuffix}`,
        circuit_name: p.circuit || p.circuit_type || TYPE_CIRCUIT[p.type] || "Tronco alimentador",
        path: [
          { x_pct: px, y_pct: py },
          ...(infraType === "galvanizado" ? [{ x_pct: px, y_pct: qeY }] : []),
          { x_pct: qeX, y_pct: qeY }
        ],
        infraType,
        description: "Tronco principal de infraestrutura."
      });
    }
  });

  return {
    infrastructure,
    routes: routes.length > 0 ? routes : DEFAULT_ROUTES,
  };
}

export function buildProfessionalPlanAnalysis({ points = [], rooms = [], includeSuggestedPoints = true, infraType = "embutido" } = {}) {
  const mountedRoomPoints = rooms.length > 0 ? buildPointsFromMountedRooms(rooms) : [];
  const sourcePoints = points.length > 0 ? points : mountedRoomPoints;
  const { infrastructure, routes } = generateProfessionalInfrastructure(sourcePoints, infraType, { rooms });
  const circuits = generateProfessionalCircuits(sourcePoints, infraType);

  return {
    source: "professional-local-library",
    fallback: true,
    rooms: rooms.map((room, index) => ({
      name: room.name || `Comodo ${index + 1}`,
      type: inferRoomType(room.name, room.type),
      area_m2: room.area_m2 || 0,
    })),
    suggested_points: includeSuggestedPoints ? sourcePoints : [],
    circuits,
    infrastructure,
    routes,
    recommendations: [
      "Separar iluminacao, TUG, areas molhadas e TUE em circuitos distintos.",
      "Prever DR 30mA para tomadas e areas molhadas, DPS no quadro e reserva de modulos DIN.",
      "Ajustar rotas no editor conforme paredes, vigas e interferencias da arquitetura.",
    ],
    notes: "Gerado pela biblioteca profissional local NBR 5410/NBR 5444 usando somente pontos e comodos montados no quadro.",
  };
}

export function buildAiRequestedPlan(requestText = "", infraType = "embutido") {
  const rooms = buildRequestedRooms(requestText);
  if (rooms.length === 0) {
    return {
      source: "professional-request-library",
      fallback: true,
      rooms: [],
      suggested_points: [],
      circuits: [],
      infrastructure: [],
      routes: [],
      recommendations: [],
      notes: "Informe pelo menos a quantidade ou os nomes dos comodos para gerar a planta.",
    };
  }

  const targets = buildItemTargets(requestText);
  const basePoints = buildPointsFromMountedRooms(rooms);
  const targetedPoints = fitGenericItemTotal(
    fitSpecificItemTargets(basePoints, rooms, targets),
    rooms,
    targets.total
  );
  const circuits = generateProfessionalCircuits(targetedPoints, infraType);
  const { infrastructure, routes } = generateProfessionalInfrastructure(targetedPoints, infraType, { rooms });

  return {
    source: "professional-request-library",
    fallback: true,
    request: {
      text: requestText,
      item_targets: targets,
    },
    rooms: rooms.map((room) => ({
      name: room.name,
      type: room.type,
      area_m2: room.area_m2 || 0,
      x_pct: room.x_pct,
      y_pct: room.y_pct,
      w_pct: room.w_pct,
      h_pct: room.h_pct,
    })),
    suggested_points: targetedPoints,
    circuits,
    infrastructure,
    routes,
    recommendations: [
      "Revise posições de portas, janelas e alturas antes de emitir o projeto.",
      "Ajuste circuitos dedicados conforme cargas reais dos equipamentos.",
      "Use Gerar Infraestrutura para lançar quadro, caixas e eletrodutos quando a planta estiver conferida.",
    ],
    notes: "Gerado a partir do pedido digitado, com comodos e pontos editaveis no quadro.",
  };
}
