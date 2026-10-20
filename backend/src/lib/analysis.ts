type AnyRecord = Record<string, any>;

const DEFAULT_ROOMS = [
  { name: "Sala", type: "sala", area_m2: 8.85, center: [70, 42], switchAt: [62, 58], tugs: [[64, 34], [82, 36], [83, 55]], extras: [{ type: "rede", label: "RJ45 sala", x: 80, y: 44, load_w: 0 }] },
  { name: "Cozinha", type: "cozinha", area_m2: 5.45, center: [73, 20], switchAt: [64, 26], tugs: [[64, 18], [70, 18], [77, 18], [82, 25]], extras: [{ type: "tue", label: "TUE forno/coifa", x: 80, y: 18, load_w: 1200 }] },
  { name: "Area de servico", type: "area_molhada", area_m2: 3.3, center: [54, 18], switchAt: [58, 27], tugs: [[50, 18]], extras: [{ type: "tue", label: "TUE maquina lavar", x: 52, y: 24, load_w: 1000 }] },
  { name: "Quarto 1", type: "quarto", area_m2: 7.1, center: [43, 42], switchAt: [51, 57], tugs: [[34, 36], [48, 33], [35, 52]] },
  { name: "Quarto 2", type: "quarto", area_m2: 6.7, center: [42, 82], switchAt: [51, 72], tugs: [[34, 77], [48, 78], [35, 90]] },
  { name: "Quarto 3", type: "quarto", area_m2: 7.7, center: [73, 82], switchAt: [61, 75], tugs: [[65, 78], [82, 78], [81, 91]] },
  { name: "Banho", type: "banheiro", area_m2: 2.4, center: [43, 65], switchAt: [51, 62], tugs: [[40, 62]], extras: [{ type: "chuveiro", label: "Chuveiro 5500W", x: 38, y: 58, load_w: 5500 }] },
  { name: "Circulacao", type: "circulacao", area_m2: 2.75, center: [56, 66], switchAt: [55, 72], tugs: [] },
] as const;

const DEFAULT_INFRASTRUCTURE = [
  { type: "qe", label: "QD-01 Distribuicao", room: "Circulacao", x_pct: 52, y_pct: 70, description: "Quadro acessivel, com DR/DPS e reserva tecnica." },
  { type: "caixa", label: "CX-01 derivacao social", room: "Circulacao", x_pct: 58, y_pct: 58, description: "Caixa de passagem para sala, quartos e circulacao." },
  { type: "caixa", label: "CX-02 areas molhadas", room: "Cozinha/Servico/Banho", x_pct: 57, y_pct: 30, description: "Derivacao dedicada para cozinha, servico e banheiro." },
  { type: "caixa", label: "CX-03 quartos", room: "Quartos", x_pct: 57, y_pct: 78, description: "Derivacao para tomadas e iluminacao dos quartos." },
] as const;

const DEFAULT_ROUTES = [
  { label: "R1 INFRA", circuit_name: "Alimentacao de distribuicao", path: [{ x_pct: 52, y_pct: 70 }, { x_pct: 58, y_pct: 58 }], description: "Eletroduto tronco DN25." },
  { label: "R2 ILU", circuit_name: "C01 Iluminacao", path: [{ x_pct: 58, y_pct: 58 }, { x_pct: 56, y_pct: 66 }, { x_pct: 70, y_pct: 42 }, { x_pct: 43, y_pct: 42 }], description: "Retornos e comandos por caixas de passagem." },
  { label: "R3 TUG MOL", circuit_name: "C03 TUG cozinha/servico", path: [{ x_pct: 52, y_pct: 70 }, { x_pct: 57, y_pct: 30 }, { x_pct: 73, y_pct: 20 }, { x_pct: 54, y_pct: 18 }], description: "Separar circuito de tomadas de bancada e area de servico." },
  { label: "R4 TUG QTS", circuit_name: "C02 TUG quartos", path: [{ x_pct: 52, y_pct: 70 }, { x_pct: 57, y_pct: 78 }, { x_pct: 42, y_pct: 82 }, { x_pct: 73, y_pct: 82 }], description: "Ramal de tomadas dos dormitorios." },
  { label: "R5 CHUV", circuit_name: "C05 Chuveiro", path: [{ x_pct: 52, y_pct: 70 }, { x_pct: 46, y_pct: 65 }, { x_pct: 38, y_pct: 58 }], description: "Circuito dedicado, sem compartilhamento." },
] as const;

const ROOM_TYPE_PATTERNS: Array<[RegExp, string]> = [
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
] as const;

const REQUEST_ITEM_TYPES = [
  { key: "tug", aliases: ["tomada", "tomadas", "tug", "tugs"] },
  { key: "luminaria", aliases: ["luminaria", "luminarias", "luminária", "luminárias", "lampada", "lampadas", "lâmpada", "lâmpadas"] },
  { key: "interruptor", aliases: ["interruptor", "interruptores"] },
  { key: "chuveiro", aliases: ["chuveiro", "chuveiros"] },
  { key: "arcond", aliases: ["ar condicionado", "ar-condicionado", "arcond", "split", "splits"] },
  { key: "rede", aliases: ["rede", "rj45", "dados", "internet"] },
  { key: "camera", aliases: ["camera", "cameras", "câmera", "câmeras", "cftv"] },
  { key: "sensor", aliases: ["sensor", "sensores"] },
] as const;

const TYPE_LOAD_W: Record<string, number> = {
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
  interruptor: 0,
  inter2: 0,
  inter3: 0,
  inter3way: 0,
  qe: 0,
  caixa: 0,
};

const TYPE_CIRCUIT: Record<string, string> = {
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
  tue: "Tomadas de Uso Especifico",
  arcond: "Ar Condicionado",
  chuveiro: "Chuveiro",
  motor: "Motor",
};

const WIRE_TABLE = [
  { gauge: "1.5mm²", area: 1.5, B2: 13, B1: 15, D1: 18, resistance: 12.1 },
  { gauge: "2.5mm²", area: 2.5, B2: 18, B1: 21, D1: 24, resistance: 7.41 },
  { gauge: "4mm²", area: 4, B2: 24, B1: 28, D1: 32, resistance: 4.61 },
  { gauge: "6mm²", area: 6, B2: 31, B1: 36, D1: 41, resistance: 3.08 },
  { gauge: "10mm²", area: 10, B2: 42, B1: 50, D1: 57, resistance: 1.83 },
  { gauge: "16mm²", area: 16, B2: 56, B1: 66, D1: 76, resistance: 1.15 },
  { gauge: "25mm²", area: 25, B2: 73, B1: 84, D1: 96, resistance: 0.727 },
  { gauge: "35mm²", area: 35, B2: 89, B1: 104, D1: 119, resistance: 0.524 },
  { gauge: "50mm²", area: 50, B2: 108, B1: 125, D1: 144, resistance: 0.387 },
  { gauge: "70mm²", area: 70, B2: 136, B1: 160, D1: 184, resistance: 0.268 },
  { gauge: "95mm²", area: 95, B2: 164, B1: 194, D1: 223, resistance: 0.193 },
  { gauge: "120mm²", area: 120, B2: 188, B1: 225, D1: 259, resistance: 0.153 },
] as const;

const TEMP_FACTORS: Record<number, number> = {
  25: 1.06, 30: 1.0, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61, 60: 0.5,
};

const GROUP_FACTORS: Record<number, number> = {
  1: 1.0, 2: 0.8, 3: 0.7, 4: 0.65, 5: 0.6, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.5,
};

const METHOD_COL: Record<string, "B1" | "B2" | "D1"> = {
  "Eletroduto Embutido em Parede": "B2",
  "Eletroduto Aparente": "B1",
  "Cabo Multipolar Fixado": "B1",
  "Bandeja Perfurada": "B1",
  "Enterrado Direto no Solo": "D1",
  "Eletroduto Enterrado": "D1",
};

const defaultSolarConfig = {
  inverter_kw: 5,
  module_wp: 550,
  roof_area_m2: 45,
  roof_utilization_pct: 75,
  module_width_m: 1.13,
  module_height_m: 2.28,
  roof_width_m: 9,
  roof_height_m: 5,
  roof_overlay_x_pct: 52,
  roof_overlay_y_pct: 50,
  roof_overlay_w_pct: 38,
  roof_overlay_h_pct: 28,
  roof_rotation_deg: 0,
  ac_voltage: 220,
  ac_supply_type: "Bifásico",
  layout_note: "",
};

const clampPct = (value: unknown, fallback: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(4, Math.min(96, number));
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

const asNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeRequestText = (text = "") => String(text)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countForAliases = (text: string, aliases: readonly string[] = []) => {
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

const hasAlias = (text: string, aliases: readonly string[] = []) => aliases.some((alias) => {
  const normalizedAlias = normalizeRequestText(alias);
  const aliasPattern = escapeRegex(normalizedAlias).replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${aliasPattern}\\b`).test(text);
});

const point = ({ type, label, room, x, y, load_w = TYPE_LOAD_W[type] || 0, circuit_type }: AnyRecord) => ({
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

const roomPoint = (room: AnyRecord, dx: number, dy: number) => ({
  x: clampPct((room.x_pct || 0) + (room.w_pct || 8) * dx, 50),
  y: clampPct((room.y_pct || 0) + (room.h_pct || 8) * dy, 50),
});

const buildRequestedRooms = (requestText = ""): AnyRecord[] => {
  const text = normalizeRequestText(requestText);
  const rooms: AnyRecord[] = [];

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
  return {
    ...targets,
    total: countForAliases(text, ["item", "itens", "ponto", "pontos"]),
  };
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
] as const;

const createRequestedPoint = (type: string, rooms: AnyRecord[], index: number) => {
  const room = rooms[index % Math.max(rooms.length, 1)] || {
    name: "Casa",
    x_pct: 10,
    y_pct: 10,
    w_pct: 80,
    h_pct: 80,
  };
  const [dx, dy] = pointOffsets[index % pointOffsets.length];
  const position = roomPoint(room, dx, dy);
  const labelByType: Record<string, string> = {
    tug: "TUG",
    luminaria: "Luminaria",
    interruptor: "Interruptor",
    inter3: "Interruptor 3 secoes",
    chuveiro: "Chuveiro",
    arcond: "Ar condicionado",
    rede: "RJ45",
    camera: "Camera",
    sensor: "Sensor",
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

const fitSpecificItemTargets = (points: AnyRecord[], rooms: AnyRecord[], targets: Record<string, number>) => {
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

const fitGenericItemTotal = (points: AnyRecord[], rooms: AnyRecord[], targetTotal: number) => {
  const target = Number(targetTotal) || 0;
  if (target <= 0 || points.length === target) return points;
  if (points.length > target) {
    const priority: Record<string, number> = { tug: 1, rede: 2, camera: 3, sensor: 4, arcond: 5, chuveiro: 6, interruptor: 7, luminaria: 8, tue: 9 };
    return [...points]
      .sort((a, b) => (priority[b.type] || 10) - (priority[a.type] || 10))
      .slice(0, target);
  }

  const cycle = ["tug", "luminaria", "interruptor", "tug", "rede"];
  const extras = Array.from({ length: target - points.length }, (_, index) => createRequestedPoint(cycle[index % cycle.length]!, rooms, points.length + index));
  return [...points, ...extras];
};

export function buildPointsFromMountedRooms(rooms: AnyRecord[] = []) {
  const suggested: AnyRecord[] = [];

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

    const tugCountByType: Record<string, number> = {
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
    ] as const;

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
  const suggested: AnyRecord[] = [];

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

    ((room as AnyRecord).extras || []).forEach((extra: AnyRecord) => {
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

const BREAKING_CAPACITY = (voltage: number) => {
  if (voltage <= 220) return 3;
  if (voltage <= 380) return 6;
  return 10;
};

const NEEDS_DR = (type: string) => [
  "Tomadas de Uso Geral", "Tomadas de Uso Especifico", "Chuveiro", "Ar Condicionado", "Bomba Hidráulica", "Carregador Veicular",
].includes(type);

const BREAKER_CURVE = (type: string) => {
  if (["Motor", "Ar Condicionado", "Bomba Hidráulica"].includes(type)) return "D";
  if (["Servidor", "Nobreak"].includes(type)) return "C";
  return "B";
};

const POLES = (supply: string) => {
  if (supply === "Monofásico") return 1;
  if (supply === "Bifásico") return 2;
  if (supply === "Trifásico") return 3;
  return 1;
};

export function calcNominalCurrent(power_w: number, voltage: number, supply_type: string, power_factor = 0.92) {
  if (!power_w || !voltage) return 0;
  if (supply_type === "Trifásico") return Math.round((power_w / (Math.sqrt(3) * voltage * power_factor)) * 100) / 100;
  return Math.round((power_w / (voltage * power_factor)) * 100) / 100;
}

export function calcCorrectedCurrent(nominal_a: number, temp_ambient = 30, group_count = 1) {
  const ft = TEMP_FACTORS[temp_ambient] || 1.0;
  const fg = GROUP_FACTORS[Math.min(group_count, 9)] || 0.5;
  return Math.round((nominal_a / (ft * fg)) * 100) / 100;
}

export function minimumWireAreaForCircuit(type = "") {
  return String(type).toLowerCase().includes("ilumina") ? 1.5 : 2.5;
}

export function selectWireGauge(corrected_a: number, install_method = "Eletroduto Embutido em Parede", min_area = 1.5) {
  const col = METHOD_COL[install_method] || "B2";
  return WIRE_TABLE.find((wire) => wire[col] >= corrected_a && wire.area >= min_area) || WIRE_TABLE[WIRE_TABLE.length - 1]!;
}

export function selectBreaker(nominal_a: number) {
  const sizes = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400];
  return sizes.find((size) => size >= nominal_a) || 400;
}

export function calcVoltageDrop(power_w: number, voltage: number, supply_type: string, length_m: number, wire_gauge: string, power_factor = 0.92) {
  const wireData = WIRE_TABLE.find((wire) => wire.gauge === wire_gauge) || WIRE_TABLE[1]!;
  const current = calcNominalCurrent(power_w, voltage, supply_type, power_factor);
  const resistance = wireData.resistance / 1000;
  const factor = supply_type === "Trifásico" ? Math.sqrt(3) : 2;
  const deltaU = factor * current * resistance * length_m;
  const pct = (deltaU / voltage) * 100;
  return {
    drop_v: Math.round(deltaU * 100) / 100,
    drop_pct: Math.round(pct * 100) / 100,
    ok: pct <= 4,
  };
}

export function calcCircuit(circuitInput: AnyRecord): AnyRecord {
  const {
    power_w = 0,
    voltage = 220,
    supply_type = "Monofásico",
    type = "Tomadas de Uso Geral",
    install_method = "Eletroduto Embutido em Parede",
    temp_ambient = 30,
    group_count = 1,
    length_m = 15,
    power_factor,
    demand_factor = 1,
    point_count = 1,
  } = circuitInput;

  const fp = power_factor || (type === "Motor" || type === "Ar Condicionado" ? 0.85 : type === "Iluminação" ? 0.92 : 1.0);
  const effectivePower = power_w * demand_factor;
  const nominal_a = calcNominalCurrent(effectivePower, voltage, supply_type, fp);
  const corrected_a = calcCorrectedCurrent(nominal_a, temp_ambient, group_count);
  const minWireArea = minimumWireAreaForCircuit(type);
  const wireData = selectWireGauge(corrected_a, install_method, minWireArea);
  const breaker_a = selectBreaker(nominal_a * 1.25);
  const vd = calcVoltageDrop(effectivePower, voltage, supply_type, length_m, wireData.gauge, fp);
  const poles = POLES(supply_type);

  return {
    ...circuitInput,
    point_count,
    project_current_a: nominal_a,
    corrected_current_a: corrected_a,
    wire_gauge: wireData.gauge,
    wire_area: wireData.area,
    minimum_wire_area: minWireArea,
    breaker_a,
    breaker_curve: BREAKER_CURVE(type),
    breaker_poles: poles,
    breaking_capacity_ka: BREAKING_CAPACITY(voltage),
    needs_dr: NEEDS_DR(type),
    needs_dps: true,
    voltage_drop_v: vd.drop_v,
    voltage_drop_pct: vd.drop_pct,
    voltage_drop_ok: vd.ok,
    temp_factor: TEMP_FACTORS[temp_ambient] || 1.0,
    group_factor: GROUP_FACTORS[Math.min(group_count, 9)] || 0.5,
    install_method,
    din_modules: poles === 3 ? 3 : poles === 2 ? 2 : 1,
  };
}

export function autoBalancePhases(circuits: AnyRecord[]) {
  const phases = { A: 0, B: 0, C: 0 };
  return circuits.map((circuitInput) => {
    const calc = calcCircuit(circuitInput);
    if (calc.supply_type === "Trifásico") {
      phases.A += calc.project_current_a;
      phases.B += calc.project_current_a;
      phases.C += calc.project_current_a;
      return { ...calc, phase: "ABC" };
    }
    if (calc.supply_type === "Bifásico") {
      const allPairs: Array<["A", "B"] | ["B", "C"] | ["A", "C"]> = [["A", "B"], ["B", "C"], ["A", "C"]];
      const pair = allPairs.reduce((best, current) =>
        (phases[current[0]] + phases[current[1]]) < (phases[best[0]] + phases[best[1]]) ? current : best
      );
      phases[pair[0]] += calc.project_current_a;
      phases[pair[1]] += calc.project_current_a;
      return { ...calc, phase: pair[0] + pair[1] };
    }
    const minPhase = (Object.keys(phases) as Array<keyof typeof phases>).reduce((a, b) => phases[a] <= phases[b] ? a : b);
    phases[minPhase] += calc.project_current_a;
    return { ...calc, phase: minPhase };
  });
}

const loadForPoint = (pointInput: AnyRecord) => Number(pointInput.load_w) || TYPE_LOAD_W[pointInput.type] || 0;
const countLoadPoints = (points: AnyRecord[]) => points.filter((item) => loadForPoint(item) > 0 || ["tug", "tue", "arcond", "chuveiro", "motor", "luminaria", "spot", "arandela"].includes(item.type)).length;

const circuit = ({ name, type, points, power_w, supply_type = "Monofásico", voltage = 220, length_m = 18, install_method = "Eletroduto Embutido em Parede", wet_area = false }: AnyRecord) => ({
  name,
  type,
  points: points.map((item: AnyRecord) => item.label || item.type),
  point_count: Math.max(1, countLoadPoints(points)),
  power_w: Math.max(80, Math.round(power_w || points.reduce((total: number, item: AnyRecord) => total + loadForPoint(item), 0))),
  load_w_total: Math.max(80, Math.round(power_w || points.reduce((total: number, item: AnyRecord) => total + loadForPoint(item), 0))),
  supply_type,
  voltage,
  length_m,
  install_method,
  power_factor: type === "Iluminacao" ? 0.92 : type === "Motor" || type === "Ar Condicionado" ? 0.85 : 1,
  wet_area,
});

export function generateProfessionalCircuits(inputPoints: AnyRecord[] = [], infraType = "embutido") {
  if (inputPoints.length === 0) return [];
  const install_method = infraType === "galvanizado" ? "Eletroduto Aparente" : "Eletroduto Embutido em Parede";
  const byType = {
    lighting: inputPoints.filter((item) => ["luminaria", "spot", "arandela", "interruptor", "inter2", "inter3", "inter3way"].includes(item.type)),
    socialTug: inputPoints.filter((item) => item.type === "tug" && !/cozinha|servico|serviço|banho|banheiro|molhada/i.test(`${item.room || ""} ${item.circuit || ""} ${item.circuit_type || ""}`)),
    wetTug: inputPoints.filter((item) => item.type === "tug" && /cozinha|servico|serviço|banho|banheiro|molhada/i.test(`${item.room || ""} ${item.circuit || ""} ${item.circuit_type || ""}`)),
    tue: inputPoints.filter((item) => item.type === "tue"),
    arcond: inputPoints.filter((item) => item.type === "arcond"),
    chuveiro: inputPoints.filter((item) => item.type === "chuveiro"),
    motor: inputPoints.filter((item) => item.type === "motor"),
    tech: inputPoints.filter((item) => ["rede", "sensor", "camera"].includes(item.type)),
  };

  const circuits: AnyRecord[] = [];
  if (byType.lighting.length) {
    circuits.push(circuit({
      name: "C01 - Iluminacao geral",
      type: "Iluminacao",
      points: byType.lighting,
      power_w: Math.max(400, byType.lighting.reduce((sum, item) => sum + loadForPoint(item), 0)),
      length_m: 22,
      install_method,
    }));
  }
  if (byType.socialTug.length || byType.tech.length) {
    circuits.push(circuit({
      name: "C02 - TUG salas e quartos",
      type: "Tomadas de Uso Geral",
      points: [...byType.socialTug, ...byType.tech],
      power_w: Math.max(900, byType.socialTug.reduce((sum, item) => sum + loadForPoint(item), 0) + 100),
      length_m: 26,
      install_method,
    }));
  }
  if (byType.wetTug.length) {
    circuits.push(circuit({
      name: "C03 - TUG cozinha e areas molhadas",
      type: "Tomadas de Uso Geral",
      points: byType.wetTug,
      power_w: Math.max(1800, byType.wetTug.reduce((sum, item) => sum + loadForPoint(item), 0)),
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
      power_w: Math.max(1600, byType.tue.reduce((sum, item) => sum + loadForPoint(item), 0)),
      length_m: 20,
      install_method,
    }));
  }
  byType.chuveiro.forEach((item, index) => circuits.push(circuit({
    name: `C${String(circuits.length + 1).padStart(2, "0")} - Chuveiro ${index + 1}`,
    type: "Chuveiro",
    points: [item],
    power_w: loadForPoint(item) || 5500,
    supply_type: "Bifásico",
    voltage: 220,
    length_m: 18,
    wet_area: true,
    install_method,
  })));
  byType.arcond.forEach((item, index) => circuits.push(circuit({
    name: `C${String(circuits.length + 1).padStart(2, "0")} - Ar condicionado ${index + 1}`,
    type: "Ar Condicionado",
    points: [item],
    power_w: loadForPoint(item) || 1800,
    supply_type: "Bifásico",
    voltage: 220,
    length_m: 24,
    install_method,
  })));
  byType.motor.forEach((item, index) => circuits.push(circuit({
    name: `C${String(circuits.length + 1).padStart(2, "0")} - Motor ${index + 1}`,
    type: "Motor",
    points: [item],
    power_w: loadForPoint(item) || 750,
    voltage: 220,
    length_m: 20,
    install_method,
  })));

  return autoBalancePhases(circuits);
}

export function generateProfessionalInfrastructure(inputPoints: AnyRecord[] = [], infraType = "embutido") {
  if (inputPoints.length === 0) return { infrastructure: [], routes: [] };
  const board = inputPoints.find((item) => item.type === "qe") || { x: 52, y: 70 };
  const qeX = board.x_pct ?? board.x ?? 52;
  const qeY = board.y_pct ?? board.y ?? 70;
  const infrastructure = DEFAULT_INFRASTRUCTURE.map((item) => ({ ...item }));
  const lights = inputPoints.filter((item) => ["luminaria", "spot", "arandela"].includes(item.type));
  const boxes = inputPoints.filter((item) => item.type === "caixa");

  const findClosest = (source: AnyRecord, candidates: AnyRecord[]) => {
    if (candidates.length === 0) return null;
    let closest: AnyRecord | null = null;
    let minDist = Infinity;
    const sx = source.x_pct ?? source.x ?? 50;
    const sy = source.y_pct ?? source.y ?? 50;
    candidates.forEach((candidate) => {
      const cx = candidate.x_pct ?? candidate.x ?? 50;
      const cy = candidate.y_pct ?? candidate.y ?? 50;
      const dist = Math.hypot(cx - sx, cy - sy);
      if (dist < minDist) {
        minDist = dist;
        closest = candidate;
      }
    });
    return closest;
  };

  const routes: AnyRecord[] = [];
  let routeIndex = 1;

  inputPoints.forEach((item) => {
    if (item.type === "qe" || item.type === "text") return;
    const px = item.x_pct ?? item.x ?? 50;
    const py = item.y_pct ?? item.y ?? 50;
    const labelSuffix = infraType === "galvanizado" ? " (GALV)" : "";

    if (["interruptor", "inter2", "inter3", "inter3way"].includes(item.type)) {
      const closestLight = findClosest(item, lights);
      if (closestLight) {
        const clx = (closestLight as AnyRecord).x_pct ?? (closestLight as AnyRecord).x ?? 50;
        const cly = (closestLight as AnyRecord).y_pct ?? (closestLight as AnyRecord).y ?? 50;
        routes.push({
          label: `R${routeIndex++} - Retorno${labelSuffix}`,
          circuit_name: "Retorno de Comando",
          path: [{ x_pct: px, y_pct: py }, { x_pct: clx, y_pct: cly }],
          infraType,
          description: "Retorno do interruptor para ponto de iluminacao.",
        });
      } else {
        routes.push({
          label: `R${routeIndex++} - Retorno${labelSuffix}`,
          circuit_name: "Retorno de Comando",
          path: [{ x_pct: px, y_pct: py }, { x_pct: qeX, y_pct: qeY }],
          infraType,
          description: "Retorno do interruptor para quadro eletrico.",
        });
      }
    } else if (["chuveiro", "arcond", "tue", "motor"].includes(item.type)) {
      routes.push({
        label: `R${routeIndex++} - Dedicado ${item.label || item.type}${labelSuffix}`,
        circuit_name: item.circuit || item.circuit_type || TYPE_CIRCUIT[item.type] || "Circuito dedicado",
        path: [{ x_pct: px, y_pct: py }, ...(infraType === "galvanizado" ? [{ x_pct: px, y_pct: qeY }] : []), { x_pct: qeX, y_pct: qeY }],
        infraType,
        description: "Alimentacao direta do circuito dedicado.",
      });
    } else if (item.type === "tug") {
      const candidates = [...lights, ...boxes];
      const closestNode = findClosest(item, candidates);
      if (closestNode) {
        const cnx = (closestNode as AnyRecord).x_pct ?? (closestNode as AnyRecord).x ?? 50;
        const cny = (closestNode as AnyRecord).y_pct ?? (closestNode as AnyRecord).y ?? 50;
        routes.push({
          label: `R${routeIndex++} - Alim. TUG${labelSuffix}`,
          circuit_name: item.circuit || item.circuit_type || TYPE_CIRCUIT[item.type] || "Circuito TUG",
          path: [{ x_pct: px, y_pct: py }, { x_pct: cnx, y_pct: cny }],
          infraType,
          description: "Conexao de tomada de uso geral.",
        });
      } else {
        routes.push({
          label: `R${routeIndex++} - Alim. TUG${labelSuffix}`,
          circuit_name: item.circuit || item.circuit_type || TYPE_CIRCUIT[item.type] || "Circuito TUG",
          path: [{ x_pct: px, y_pct: py }, ...(infraType === "galvanizado" ? [{ x_pct: px, y_pct: qeY }] : []), { x_pct: qeX, y_pct: qeY }],
          infraType,
          description: "Conexao de tomada de uso geral direto ao quadro.",
        });
      }
    } else if (["luminaria", "spot", "arandela", "caixa"].includes(item.type)) {
      routes.push({
        label: `R${routeIndex++} - Tronco ${item.label || item.type}${labelSuffix}`,
        circuit_name: item.circuit || item.circuit_type || TYPE_CIRCUIT[item.type] || "Tronco alimentador",
        path: [{ x_pct: px, y_pct: py }, ...(infraType === "galvanizado" ? [{ x_pct: px, y_pct: qeY }] : []), { x_pct: qeX, y_pct: qeY }],
        infraType,
        description: "Tronco principal de infraestrutura.",
      });
    }
  });

  return {
    infrastructure,
    routes: routes.length > 0 ? routes : DEFAULT_ROUTES.map((item) => ({ ...item })),
  };
}

export function buildProfessionalPlanAnalysis({
  points = [],
  rooms = [],
  includeSuggestedPoints = true,
  infraType = "embutido",
}: {
  points?: AnyRecord[];
  rooms?: AnyRecord[];
  includeSuggestedPoints?: boolean;
  infraType?: string;
} = {}) {
  const mountedRoomPoints = rooms.length > 0 ? buildPointsFromMountedRooms(rooms) : [];
  const sourcePoints = points.length > 0 ? points : mountedRoomPoints;
  const { infrastructure, routes } = generateProfessionalInfrastructure(sourcePoints, infraType);
  const circuits = generateProfessionalCircuits(sourcePoints, infraType);

  return {
    source: "professional-backend-library",
    fallback: true,
    rooms: rooms.map((room, index) => ({
      name: room.name || `Comodo ${index + 1}`,
      type: inferRoomType(room.name, room.type),
      area_m2: room.area_m2 || 0,
      x_pct: room.x_pct,
      y_pct: room.y_pct,
      w_pct: room.w_pct,
      h_pct: room.h_pct,
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
    notes: "Gerado pelo backend com biblioteca tecnica NBR 5410/NBR 5444 usando pontos e comodos informados.",
  };
}

export function buildAiRequestedPlan(requestText = "", infraType = "embutido") {
  const rooms = buildRequestedRooms(requestText);
  if (rooms.length === 0) {
    return {
      source: "professional-request-backend",
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
  const targetedPoints = fitGenericItemTotal(fitSpecificItemTargets(basePoints, rooms, targets), rooms, Number(targets.total) || 0);
  const circuits = generateProfessionalCircuits(targetedPoints, infraType);
  const { infrastructure, routes } = generateProfessionalInfrastructure(targetedPoints, infraType);

  return {
    source: "professional-request-backend",
    fallback: true,
    request: { text: requestText, item_targets: targets },
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
      "Revise posicoes de portas, janelas e alturas antes de emitir o projeto.",
      "Ajuste circuitos dedicados conforme cargas reais dos equipamentos.",
      "Use Gerar Infraestrutura para lancar quadro, caixas e eletrodutos quando a planta estiver conferida.",
    ],
    notes: "Gerado a partir do pedido digitado pelo usuario no backend.",
  };
}

export function estimateSolarRoof(project: AnyRecord = {}, config: AnyRecord = {}) {
  const merged = { ...defaultSolarConfig, ...(config || {}) };
  const inverterKw = Math.max(0.1, asNumber(merged.inverter_kw, defaultSolarConfig.inverter_kw));
  const moduleWp = Math.max(1, asNumber(merged.module_wp, defaultSolarConfig.module_wp));
  const moduleWidth = Math.max(0.1, asNumber(merged.module_width_m, defaultSolarConfig.module_width_m));
  const moduleHeight = Math.max(0.1, asNumber(merged.module_height_m, defaultSolarConfig.module_height_m));
  const roofWidthBase = Math.max(0.1, asNumber(merged.roof_width_m, defaultSolarConfig.roof_width_m));
  const roofHeightBase = Math.max(0.1, asNumber(merged.roof_height_m, defaultSolarConfig.roof_height_m));
  const targetPanels = Math.max(1, Math.ceil((inverterKw * 1000 * 1.2) / moduleWp));
  const columns = Math.max(1, Math.ceil(Math.sqrt(targetPanels * 1.6)));
  const rows = Math.max(1, Math.ceil(targetPanels / columns));
  const suggestedWidth = round1(Math.max(roofWidthBase, columns * moduleWidth + 1.2));
  const suggestedHeight = round1(Math.max(roofHeightBase, rows * moduleHeight + 1.2));
  const roofUtilization = clamp(asNumber(merged.roof_utilization_pct, defaultSolarConfig.roof_utilization_pct), 40, 90);

  return {
    roof_width_m: suggestedWidth,
    roof_height_m: suggestedHeight,
    roof_area_m2: round1(suggestedWidth * suggestedHeight),
    roof_utilization_pct: Math.max(roofUtilization, 78),
    roof_overlay_x_pct: clamp(asNumber(merged.roof_overlay_x_pct, defaultSolarConfig.roof_overlay_x_pct), 10, 90),
    roof_overlay_y_pct: clamp(asNumber(merged.roof_overlay_y_pct, defaultSolarConfig.roof_overlay_y_pct), 10, 90),
    roof_overlay_w_pct: clamp(asNumber(merged.roof_overlay_w_pct, defaultSolarConfig.roof_overlay_w_pct), 12, 70),
    roof_overlay_h_pct: clamp(asNumber(merged.roof_overlay_h_pct, defaultSolarConfig.roof_overlay_h_pct), 10, 60),
    roof_rotation_deg: clamp(asNumber(merged.roof_rotation_deg, defaultSolarConfig.roof_rotation_deg), -45, 45),
    layout_note: `Estimativa inicial para ${project?.address || "endereço informado"}; ajuste o retangulo sobre o telhado no mapa para refinar a escala.`,
  };
}
