import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import {
  AssetRecordType,
  Tldraw,
  createShapeId,
  createShapesForAssets,
  toRichText,
} from "tldraw";
import "tldraw/tldraw.css";
import { RotateCcw } from "lucide-react";

const WALL = 12;
const THIN = "s";
const TEXT_ROTATE = -Math.PI / 2;

const SYMBOL_STYLE = {
  tug: { code: "1", color: "black", circuit: "Tomadas de Uso Geral", height: "2 x 100 VA" },
  tue: { code: "2", color: "black", circuit: "Tomadas de Uso Especifico", height: "600 VA" },
  interruptor: { code: "a", color: "black", circuit: "Comando de iluminacao", height: "1" },
  inter2: { code: "a b", color: "black", circuit: "Comando duplo", height: "2" },
  inter3way: { code: "3w", color: "black", circuit: "Comando paralelo", height: "paralelo" },
  luminaria: { code: "a", color: "black", circuit: "Iluminacao", height: "100 VA" },
  spot: { code: "s", color: "black", circuit: "Iluminacao embutida", height: "100 VA" },
  arandela: { code: "ar", color: "black", circuit: "Iluminacao de parede", height: "100 VA" },
  arcond: { code: "4", color: "black", circuit: "Circuito dedicado", height: "1500 W" },
  chuveiro: { code: "5", color: "black", circuit: "Circuito dedicado", height: "4400 W" },
  motor: { code: "M", color: "black", circuit: "Forca motriz", height: "dedicado" },
  qgbt: { code: "QGBT", color: "black", circuit: "Quadro geral de baixa tensao", height: "h=1,50m" },
  qe: { code: "QD", color: "black", circuit: "Quadro de distribuicao", height: "h=1,50m" },
  caixa: { code: "CX", color: "black", circuit: "Caixa de passagem", height: "conforme rota" },
  sensor: { code: "SE", color: "black", circuit: "Automacao", height: "teto" },
  camera: { code: "CAM", color: "black", circuit: "CFTV", height: "h=2,50m" },
  rede: { code: "RJ", color: "black", circuit: "Dados", height: "h=0,30m" },
};

const ELECTRICAL_PLAN_LEGEND = [
  ["Condutor de retorno no eletroduto", "return"],
  ["Condutor terra no eletroduto", "ground"],
  ["Embutido no teto ou parede", "embedded"],
  ["Embutido no piso", "floor"],
  ["Condutor-fase no eletroduto", "phase"],
  ["Condutor neutro no eletroduto", "neutral"],
  ["Ponto de tomada media (1 300 mm do piso)", "outlet-mid"],
  ["Ponto de tomada alta (2 000 mm do piso)", "outlet-high"],
  ["Ponto de tomada de luz na parede, baixa (300 mm do piso)", "wall-light"],
  ["Interruptor simples", "switch"],
  ["Paralelo ou three-way", "three-way"],
];

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const readFileAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = reject;
  reader.readAsText(file);
});

const getImageSize = (src) => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve({ w: image.naturalWidth || 1200, h: image.naturalHeight || 800 });
  image.onerror = () => resolve({ w: 1200, h: 800 });
  image.src = src;
});

const RENDERABLE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/avif",
]);

const RENDERABLE_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif"]);

const getFileExtension = (file) => {
  const name = file?.name || "";
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  return ext || "arquivo";
};

const getFileFormat = (file) => getFileExtension(file).toUpperCase();

const canRenderAsImage = (file) => (
  RENDERABLE_IMAGE_TYPES.has(file.type) || RENDERABLE_IMAGE_EXTENSIONS.has(getFileExtension(file))
);

const formatFileSize = (size = 0) => {
  if (!size) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
};

const createGeo = ({
  x,
  y,
  w,
  h,
  label = "",
  geo = "rectangle",
  color = "black",
  labelColor = color,
  fill = "none",
  dash = "solid",
  size = "m",
  meta = {},
  rotation = 0,
}) => ({
  id: createShapeId(),
  type: "geo",
  x,
  y,
  rotation,
  meta,
  props: {
    w,
    h,
    geo,
    color,
    labelColor,
    fill,
    dash,
    size,
    font: "sans",
    align: "middle",
    verticalAlign: "middle",
    richText: toRichText(label),
  },
});

const createText = ({ x, y, label, color = "black", size = "m", rotation = 0, meta = {} }) => ({
  id: createShapeId(),
  type: "text",
  x,
  y,
  rotation,
  meta,
  props: {
    color,
    size,
    font: "sans",
    textAlign: "start",
    autoSize: true,
    scale: 1,
    richText: toRichText(label),
  },
});

const createLine = ({
  x,
  y,
  points,
  color = "black",
  dash = "solid",
  size = "s",
  spline = "line",
  meta = {},
  rotation = 0,
}) => ({
  id: createShapeId(),
  type: "line",
  x,
  y,
  rotation,
  meta,
  props: {
    color,
    dash,
    size,
    spline,
    scale: 1,
    points: Object.fromEntries(points.map((point, index) => {
      const id = `a${index + 1}`;
      return [id, { id, index: id, x: point.x, y: point.y }];
    })),
  },
});

const createArrow = ({
  x,
  y,
  x2,
  y2,
  label = "",
  color = "blue",
  dash = "dashed",
  bend = 0,
  size = "m",
  rotation = 0,
}) => ({
  id: createShapeId(),
  type: "arrow",
  x,
  y,
  rotation,
  props: {
    kind: "arc",
    color,
    dash,
    size,
    fill: "none",
    start: { x: 0, y: 0 },
    end: { x: x2 - x, y: y2 - y },
    arrowheadStart: "none",
    arrowheadEnd: "none",
    bend,
    labelPosition: 0.5,
    font: "sans",
    labelColor: color,
    elbowMidPoint: 0.5,
    scale: 1,
    richText: toRichText(label),
  },
});

const createCadSymbolCircle = ({ x, y, r = 18, color, meta }) => createGeo({
  x: x - r,
  y: y - r,
  w: r * 2,
  h: r * 2,
  geo: "ellipse",
  fill: "none",
  color,
  size: "m",
  meta,
});

const createCadSymbolText = ({ x, y, label, color, meta, size = "s" }) => createText({
  x,
  y,
  label,
  color,
  size,
  meta,
});

const createElectricalSymbolShapes = ({ x, y, type, label }) => {
  const style = SYMBOL_STYLE[type] || { code: label || "P", color: "blue", circuit: "Ponto eletrico", height: "" };
  const meta = {
    electricalType: type,
    label: label || style.code,
    circuitType: style.circuit,
    mountingHeight: style.height,
    cadLayer: `ELE-${style.circuit || "PONTOS"}`.toUpperCase(),
  };
  const c = style.color;
  const cx = x + 28;
  const cy = y + 28;
  const r = 18;

  const base = [];
  const addTag = (dx = 18, dy = 18, text = style.code) => {
    base.push(createCadSymbolText({ x: cx + dx, y: cy + dy, label: text, color: c, meta, size: "s" }));
  };

  if (type === "tug" || type === "tue") {
    base.push(
      createCadSymbolCircle({ x: cx, y: cy, r, color: c, meta }),
      createLine({ x: cx - 7, y: cy - 11, points: [{ x: 0, y: 0 }, { x: 0, y: 22 }], color: c, size: "m", meta }),
      createLine({ x: cx + 7, y: cy - 11, points: [{ x: 0, y: 0 }, { x: 0, y: 22 }], color: c, size: "m", meta }),
      createLine({ x: cx, y: cy + 5, points: [{ x: 0, y: 0 }, { x: 0, y: 18 }], color: c, size: "m", meta }),
    );
    if (type === "tue") base.push(createCadSymbolText({ x: cx - 6, y: cy - 11, label: "E", color: c, meta, size: "s" }));
    addTag(20, 14);
  } else if (type === "interruptor" || type === "inter2" || type === "inter3way") {
    base.push(
      createGeo({ x: cx - 5, y: cy - 5, w: 10, h: 10, geo: "ellipse", fill: "solid", color: c, meta }),
      createLine({ x: cx, y: cy, points: [{ x: 0, y: 0 }, { x: 22, y: -16 }], color: c, size: "m", meta }),
      createLine({ x: cx + 21, y: cy - 22, points: [{ x: 0, y: 0 }, { x: 0, y: 24 }], color: c, size: "m", meta }),
    );
    if (type === "inter2") base.push(createLine({ x: cx, y: cy, points: [{ x: 0, y: 0 }, { x: 22, y: 4 }], color: c, size: "m", meta }));
    addTag(18, 13);
  } else if (type === "luminaria") {
    base.push(
      createCadSymbolCircle({ x: cx, y: cy, r, color: c, meta }),
      createLine({ x: cx - r, y: cy, points: [{ x: 0, y: 0 }, { x: r * 2, y: 0 }], color: c, size: "m", meta }),
      createLine({ x: cx, y: cy - r, points: [{ x: 0, y: 0 }, { x: 0, y: r * 2 }], color: c, size: "m", meta }),
      createGeo({ x: cx - 5, y: cy - 5, w: 10, h: 10, geo: "ellipse", fill: "solid", color: c, meta }),
    );
    addTag(20, 14);
  } else if (type === "spot") {
    base.push(
      createCadSymbolCircle({ x: cx, y: cy, r, color: c, meta }),
      createCadSymbolCircle({ x: cx, y: cy, r: 9, color: c, meta }),
      createGeo({ x: cx - 3, y: cy - 3, w: 6, h: 6, geo: "ellipse", fill: "solid", color: c, meta }),
    );
    addTag(20, 14);
  } else if (type === "arandela") {
    base.push(
      createCadSymbolCircle({ x: cx, y: cy, r, color: c, meta }),
      createLine({ x: cx - r, y: cy, points: [{ x: 0, y: 0 }, { x: r * 2, y: 0 }], color: c, size: "m", meta }),
      createGeo({ x: cx - 5, y: cy - 13, w: 10, h: 10, geo: "ellipse", fill: "solid", color: c, meta }),
    );
    addTag(20, 14);
  } else if (type === "qgbt" || type === "qe") {
    base.push(
      createGeo({ x: cx - 16, y: cy - 20, w: 32, h: 40, geo: "rectangle", fill: "none", color: c, size: "m", meta }),
      createLine({ x: cx - 16, y: cy, points: [{ x: 0, y: 0 }, { x: 32, y: 0 }], color: c, size: "s", meta }),
      createCadSymbolText({ x: cx - 14, y: cy - 15, label: type === "qgbt" ? "QGBT" : "QD", color: c, meta, size: "s" }),
      createCadSymbolText({ x: cx - 8, y: cy + 2, label: "EL", color: c, meta, size: "s" }),
    );
  } else if (type === "caixa") {
    base.push(
      createGeo({ x: cx - 16, y: cy - 16, w: 32, h: 32, geo: "rectangle", fill: "none", color: c, dash: "dashed", size: "m", meta }),
      createLine({ x: cx - 16, y: cy - 16, points: [{ x: 0, y: 0 }, { x: 32, y: 32 }], color: c, size: "s", meta }),
      createLine({ x: cx + 16, y: cy - 16, points: [{ x: 0, y: 0 }, { x: -32, y: 32 }], color: c, size: "s", meta }),
    );
    addTag(20, 14);
  } else if (type === "arcond") {
    base.push(
      createGeo({ x: cx - 22, y: cy - 12, w: 44, h: 24, geo: "rectangle", fill: "none", color: c, size: "m", meta }),
      createLine({ x: cx - 12, y: cy + 4, points: [{ x: 0, y: 0 }, { x: 12, y: -5 }, { x: 24, y: 0 }], color: c, size: "s", meta }),
      createCadSymbolText({ x: cx - 11, y: cy - 10, label: "AC", color: c, meta, size: "s" }),
    );
  } else if (type === "chuveiro") {
    base.push(
      createCadSymbolCircle({ x: cx, y: cy - 4, r: 14, color: c, meta }),
      createLine({ x: cx, y: cy - 28, points: [{ x: 0, y: 0 }, { x: 0, y: 10 }], color: c, size: "m", meta }),
      ...[-10, 0, 10].map((dx) => createLine({ x: cx + dx, y: cy + 13, points: [{ x: 0, y: 0 }, { x: -3, y: 9 }], color: c, size: "s", meta })),
    );
    addTag(20, 12);
  } else if (type === "rede") {
    base.push(
      createGeo({ x: cx - 20, y: cy - 14, w: 40, h: 28, geo: "rectangle", fill: "none", color: c, size: "m", meta }),
      createLine({ x: cx - 10, y: cy + 14, points: [{ x: 0, y: 0 }, { x: 20, y: 0 }], color: c, size: "s", meta }),
      createCadSymbolText({ x: cx - 8, y: cy - 9, label: "RJ", color: c, meta, size: "s" }),
    );
  } else {
    base.push(createCadSymbolCircle({ x: cx, y: cy, r, color: c, meta }));
    addTag(20, 14);
  }

  base.push(createCadSymbolText({ x: cx - 20, y: cy + 24, label: style.height || "", color: "grey", meta, size: "s" }));
  return base;
};

const getPanelBoardUsedModules = (board) => (
  (board?.layout?.rails || []).reduce((total, rail) => (
    total + (rail.components || [])
      .filter((component) => component.type !== "spacer")
      .reduce((sum, component) => sum + (Number(component.poles) || 0), 0)
  ), 0)
);

const createPanelBoardShapes = ({ x, y, board, index = 0 }) => {
  const name = board?.name || `QD-${String(index + 1).padStart(2, "0")}`;
  const location = board?.location || "Distribuição";
  const room = board?.room || board?.targetRoom || "";
  const displayLocation = room ? `Cômodo: ${room}` : location;
  const rails = board?.layout?.rails?.length || 0;
  const modules = getPanelBoardUsedModules(board);
  const meta = {
    cadType: "panel-board",
    electricalType: "qe",
    boardId: board?.id,
    label: name,
    location,
    room,
    cadLayer: "ELE-QUADROS",
  };
  const w = 118;
  const h = 82;

  return [
    createGeo({ x, y, w, h, geo: "rectangle", fill: "none", color: "black", size: "m", meta }),
    createLine({ x: x + 12, y: y + 28, points: [{ x: 0, y: 0 }, { x: w - 24, y: 0 }], color: "black", size: "s", meta }),
    createLine({ x: x + 12, y: y + 56, points: [{ x: 0, y: 0 }, { x: w - 24, y: 0 }], color: "grey", size: "s", dash: "dashed", meta }),
    createCadSymbolText({ x: x + 11, y: y + 8, label: name.toUpperCase().slice(0, 18), color: "black", meta, size: "s" }),
    createCadSymbolText({ x: x + 12, y: y + 34, label: displayLocation.slice(0, 24), color: "grey", meta, size: "s" }),
    createCadSymbolText({ x: x + 12, y: y + 60, label: `${rails || "-"} trilhos · ${modules || 0} DIN`, color: "blue", meta, size: "s" }),
    createGeo({ x: x + w - 26, y: y + 8, w: 16, h: 16, geo: "rectangle", fill: "none", color: "blue", size: "s", meta }),
    createLine({ x: x + w - 26, y: y + 16, points: [{ x: 0, y: 0 }, { x: 16, y: 0 }], color: "blue", size: "s", meta }),
    createLine({ x: x + w - 18, y: y + 8, points: [{ x: 0, y: 0 }, { x: 0, y: 16 }], color: "blue", size: "s", meta }),
  ];
};

const createWallSegment = ({ x, y, w, h, meta = {}, rotation = 0 }) => createGeo({
  x,
  y,
  w,
  h,
  rotation,
  fill: "solid",
  color: "black",
  labelColor: "white",
  size: "s",
  meta: { cadType: "wall", ...meta },
});

const createThinRect = ({ x, y, w, h, dash = "solid", color = "black", meta = {} }) => createGeo({
  x,
  y,
  w,
  h,
  fill: "none",
  color,
  dash,
  size: THIN,
  meta,
});

const createDimHorizontal = ({ x1, x2, y, label, offset = 28 }) => [
  createLine({ x: x1, y: y - offset, points: [{ x: 0, y: 0 }, { x: 0, y: offset * 2 }], size: THIN }),
  createLine({ x: x2, y: y - offset, points: [{ x: 0, y: 0 }, { x: 0, y: offset * 2 }], size: THIN }),
  createLine({ x: x1, y, points: [{ x: 0, y: 0 }, { x: x2 - x1, y: 0 }], size: THIN }),
  createText({ x: (x1 + x2) / 2 - 16, y: y - 22, label, size: "s" }),
];

const createDimVertical = ({ x, y1, y2, label, offset = 28 }) => [
  createLine({ x: x - offset, y: y1, points: [{ x: 0, y: 0 }, { x: offset * 2, y: 0 }], size: THIN }),
  createLine({ x: x - offset, y: y2, points: [{ x: 0, y: 0 }, { x: offset * 2, y: 0 }], size: THIN }),
  createLine({ x, y: y1, points: [{ x: 0, y: 0 }, { x: 0, y: y2 - y1 }], size: THIN }),
  createText({ x: x + 10, y: (y1 + y2) / 2 + 16, label, size: "s", rotation: TEXT_ROTATE }),
];

const createCutMarker = ({ x, y, label, rotation = 0 }) => [
  createLine({ x: x - 52, y, points: [{ x: 0, y: 0 }, { x: 104, y: 0 }], dash: "dashed", size: THIN, rotation }),
  createLine({ x, y: y - 18, points: [{ x: 0, y: 0 }, { x: 0, y: 36 }], size: THIN, rotation }),
  createText({ x: x - 7, y: y - 36, label, size: "s", rotation }),
];

const createLevelMarker = ({ x, y, label = "+15" }) => [
  createGeo({ x, y, w: 26, h: 26, geo: "ellipse", fill: "solid", color: "black", labelColor: "white", size: THIN }),
  createLine({ x: x + 26, y: y + 13, points: [{ x: 0, y: 0 }, { x: 26, y: -22 }], size: THIN }),
  createText({ x: x + 34, y: y - 25, label, size: "s" }),
];

const createSectionTriangle = ({ x, y }) => [
  createLine({ x, y, points: [{ x: 0, y: 0 }, { x: 28, y: -30 }, { x: 56, y: 0 }, { x: 0, y: 0 }], size: THIN }),
  createText({ x: x + 23, y: y + 8, label: "2%", size: "s" }),
];

const createWindowHorizontal = ({ x, y, width = 110, label = "J1", labelY = 42 }) => [
  createWallSegment({ x: x - 18, y: y - WALL / 2, w: 18, h: WALL }),
  createWallSegment({ x: x + width, y: y - WALL / 2, w: 18, h: WALL }),
  createLine({ x, y: y - 8, points: [{ x: 0, y: 0 }, { x: width, y: 0 }], size: THIN }),
  createLine({ x, y, points: [{ x: 0, y: 0 }, { x: width, y: 0 }], size: THIN }),
  createLine({ x, y: y + 8, points: [{ x: 0, y: 0 }, { x: width, y: 0 }], size: THIN }),
  createText({ x: x + width / 2 - 7, y: y + labelY, label, size: "s" }),
];

const createWindowVertical = ({ x, y, height = 120, label = "J1", labelX = -28 }) => [
  createWallSegment({ x: x - WALL / 2, y: y - 18, w: WALL, h: 18 }),
  createWallSegment({ x: x - WALL / 2, y: y + height, w: WALL, h: 18 }),
  createLine({ x: x - 8, y, points: [{ x: 0, y: 0 }, { x: 0, y: height }], size: THIN }),
  createLine({ x, y, points: [{ x: 0, y: 0 }, { x: 0, y: height }], size: THIN }),
  createLine({ x: x + 8, y, points: [{ x: 0, y: 0 }, { x: 0, y: height }], size: THIN }),
  createText({ x: x + labelX, y: y + height / 2 + 8, label, size: "s", rotation: TEXT_ROTATE }),
];

const createDoorSymbol = ({ x, y, width = 85, orientation = "right", label = "P1" }) => {
  if (orientation === "right") {
    return [
      createLine({ x, y, points: [{ x: 0, y: width }, { x: width, y: width }], size: THIN }),
      createArrow({ x, y, x2: x + width, y2: y + width, color: "grey", dash: "solid", bend: -54, size: THIN }),
      createText({ x: x + width / 2 - 8, y: y + width + 10, label, size: "s" }),
    ];
  }
  if (orientation === "left") {
    return [
      createLine({ x, y, points: [{ x: width, y: width }, { x: 0, y: width }], size: THIN }),
      createArrow({ x: x + width, y, x2: x, y2: y + width, color: "grey", dash: "solid", bend: 54, size: THIN }),
      createText({ x: x + width / 2 - 8, y: y + width + 10, label, size: "s" }),
    ];
  }
  if (orientation === "down") {
    return [
      createLine({ x, y, points: [{ x: 0, y: 0 }, { x: 0, y: width }], size: THIN }),
      createArrow({ x, y, x2: x + width, y2: y + width, color: "grey", dash: "solid", bend: 54, size: THIN }),
      createText({ x: x + width + 10, y: y + width / 2 - 6, label, size: "s" }),
    ];
  }
  return [
    createLine({ x, y, points: [{ x: width, y: width }, { x: width, y: 0 }], size: THIN }),
    createArrow({ x: x + width, y: y + width, x2: x, y2: y, color: "grey", dash: "solid", bend: 54, size: THIN }),
    createText({ x: x - 26, y: y + width / 2 - 6, label, size: "s" }),
  ];
};

const createCadRoomShapes = ({ x, y, w, h, label }) => {
  const roomName = String(label || "Cômodo").trim();
  const meta = {
    cadType: "room",
    roomName,
    roomBounds: { x, y, w, h },
  };

  return [
    createWallSegment({ x, y, w, h: WALL, meta }),
    createWallSegment({ x, y: y + h - WALL, w, h: WALL, meta }),
    createWallSegment({ x, y, w: WALL, h, meta }),
    createWallSegment({ x: x + w - WALL, y, w: WALL, h, meta }),
    createText({ x: x + 28, y: y + 32, label: roomName, color: "grey", size: "s", meta: { ...meta, cadType: "room-label" } }),
  ];
};

const createCadDoorShapes = ({ x, y, width = 88, swing = "right" }) => {
  const leafX = swing === "right" ? WALL * 2 : width + WALL * 2;
  const openX = swing === "right" ? leafX + width : leafX - width;
  const bend = swing === "right" ? -52 : 52;
  return [
    createWallSegment({ x, y: y + width - WALL / 2, w: WALL * 2, h: WALL }),
    createWallSegment({ x: x + width + WALL * 2, y: y + width - WALL / 2, w: WALL * 2, h: WALL }),
    createLine({
      x: x + leafX,
      y,
      points: [{ x: 0, y: width }, { x: 0, y: 0 }],
      size: "m",
      meta: { cadType: "door-leaf" },
    }),
    createArrow({
      x: x + leafX,
      y,
      x2: x + openX,
      y2: y + width,
      color: "grey",
      dash: "solid",
      bend,
      size: "s",
    }),
  ];
};

const createCadWindowShapes = ({ x, y, width = 116 }) => [
  createWallSegment({ x, y: y + 10, w: WALL * 2, h: WALL }),
  createWallSegment({ x: x + width + WALL * 2, y: y + 10, w: WALL * 2, h: WALL }),
  createLine({
    x: x + WALL * 2,
    y: y + 4,
    points: [{ x: 0, y: 0 }, { x: width, y: 0 }],
    color: "black",
    size: "s",
    meta: { cadType: "window-glass" },
  }),
  createLine({
    x: x + WALL * 2,
    y: y + 16,
    points: [{ x: 0, y: 0 }, { x: width, y: 0 }],
    color: "black",
    size: "s",
    meta: { cadType: "window-glass" },
  }),
  createLine({
    x: x + WALL * 2,
    y: y + 28,
    points: [{ x: 0, y: 0 }, { x: width, y: 0 }],
    color: "black",
    size: "s",
    meta: { cadType: "window-glass" },
  }),
];

const createKitchenFixture = ({ x, y }) => [
  createThinRect({ x, y, w: 245, h: 54 }),
  createLine({ x: x + 58, y, points: [{ x: 0, y: 0 }, { x: 0, y: 54 }], size: THIN }),
  createLine({ x: x + 116, y, points: [{ x: 0, y: 0 }, { x: 0, y: 54 }], size: THIN }),
  createLine({ x: x + 174, y, points: [{ x: 0, y: 0 }, { x: 0, y: 54 }], size: THIN }),
  createGeo({ x: x + 12, y: y + 12, w: 20, h: 20, geo: "ellipse", size: THIN }),
  createGeo({ x: x + 42, y: y + 12, w: 20, h: 20, geo: "ellipse", size: THIN }),
  createGeo({ x: x + 74, y: y + 12, w: 20, h: 20, geo: "ellipse", size: THIN }),
  createGeo({ x: x + 104, y: y + 12, w: 20, h: 20, geo: "ellipse", size: THIN }),
  createText({ x: x + 42, y: y + 56, label: "fogão  lenha", size: "s" }),
];

const createBathroomFixture = ({ x, y }) => [
  createThinRect({ x, y, w: 178, h: 102 }),
  createGeo({ x: x + 18, y: y + 34, w: 42, h: 34, geo: "ellipse", size: THIN }),
  createThinRect({ x: x + 20, y: y + 12, w: 38, h: 26 }),
  createGeo({ x: x + 90, y: y + 30, w: 48, h: 34, geo: "ellipse", size: THIN }),
  createThinRect({ x: x + 84, y: y + 70, w: 60, h: 22 }),
  createText({ x: x + 2, y: y + 110, label: "box", size: "s", rotation: TEXT_ROTATE }),
];

const createServiceFixture = ({ x, y }) => [
  createThinRect({ x, y, w: 70, h: 110 }),
  createGeo({ x: x + 10, y: y + 12, w: 48, h: 48, geo: "ellipse", size: THIN }),
  createThinRect({ x: x + 12, y: y + 62, w: 46, h: 28 }),
  createLine({ x: x + 70, y: y + 14, points: [{ x: 0, y: 0 }, { x: 56, y: 0 }], size: THIN }),
  createText({ x: x + 74, y: y + 22, label: "h=150 cm", size: "s", rotation: TEXT_ROTATE }),
];

const createLegendSample = ({ x, y, kind }) => {
  const common = { color: "black", size: THIN, meta: { cadType: "electrical-legend" } };
  if (kind === "return") {
    return [
      createLine({ x, y, points: [{ x: 0, y: 0 }, { x: 58, y: 0 }], ...common }),
      createLine({ x: x + 29, y: y - 11, points: [{ x: 0, y: 0 }, { x: 0, y: 22 }], ...common }),
    ];
  }
  if (kind === "ground") {
    return [
      createLine({ x, y, points: [{ x: 0, y: 0 }, { x: 58, y: 0 }], ...common }),
      createLine({ x: x + 20, y: y - 7, points: [{ x: 0, y: 0 }, { x: 18, y: 0 }], ...common }),
      createLine({ x: x + 24, y: y + 1, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], ...common }),
    ];
  }
  if (kind === "embedded" || kind === "floor") {
    return [
      createLine({ x, y, points: [{ x: 0, y: 0 }, { x: 58, y: 0 }], dash: kind === "floor" ? "dashed" : "solid", ...common }),
      createCadSymbolText({ x: x + 68, y: y - 10, label: kind === "floor" ? "25mm" : "25mm", color: "black", size: "s", meta: common.meta }),
    ];
  }
  if (kind === "phase" || kind === "neutral") {
    return [
      createLine({ x, y, points: [{ x: 0, y: 0 }, { x: 58, y: 0 }], ...common }),
      createLine({ x: x + 15, y: y - 9, points: [{ x: 0, y: 0 }, { x: 0, y: 18 }], ...common }),
      ...(kind === "phase" ? [createLine({ x: x + 38, y: y - 9, points: [{ x: 0, y: 0 }, { x: 0, y: 18 }], ...common })] : []),
    ];
  }
  if (kind === "switch" || kind === "three-way") {
    return createElectricalSymbolShapes({ x: x - 22, y: y - 29, type: kind === "switch" ? "interruptor" : "inter3way", label: "" });
  }
  return createElectricalSymbolShapes({ x: x - 22, y: y - 29, type: kind === "wall-light" ? "arandela" : kind === "outlet-high" ? "tue" : "tug", label: "" });
};

const createElectricalLegendShapes = ({ x, y }) => {
  const w = 315;
  const shapes = [
    createThinRect({ x, y, w, h: 502, meta: { cadType: "electrical-legend" } }),
    createText({ x: x + 18, y: y + 16, label: "LEGENDA", size: "m", meta: { cadType: "electrical-legend" } }),
  ];

  ELECTRICAL_PLAN_LEGEND.forEach(([label, kind], index) => {
    const rowY = y + 52 + index * 39;
    shapes.push(
      createText({ x: x + 18, y: rowY - 12, label, size: "s", meta: { cadType: "electrical-legend" } }),
      ...createLegendSample({ x: x + 228, y: rowY, kind }),
    );
  });

  shapes.push(
    createText({ x: x + 18, y: y + 456, label: "Obs.: tomadas nao cotadas sao de 100 VA.\nCondutores indicados em mm².", size: "s", meta: { cadType: "electrical-legend" } }),
  );

  return shapes;
};

const createDefaultElectricalOverlayShapes = (px, py) => [
  ...createElectricalSymbolShapes({ x: px + 88, y: py + 74, type: "tug", label: "1" }),
  ...createElectricalSymbolShapes({ x: px + 420, y: py + 80, type: "tue", label: "4" }),
  ...createElectricalSymbolShapes({ x: px + 520, y: py + 120, type: "chuveiro", label: "5" }),
  ...createElectricalSymbolShapes({ x: px + 430, y: py + 330, type: "luminaria", label: "a" }),
  ...createElectricalSymbolShapes({ x: px + 506, y: py + 300, type: "interruptor", label: "a" }),
  ...createElectricalSymbolShapes({ x: px + 116, y: py + 340, type: "luminaria", label: "a" }),
  ...createElectricalSymbolShapes({ x: px + 78, y: py + 520, type: "interruptor", label: "a" }),
  ...createElectricalSymbolShapes({ x: px + 104, y: py + 695, type: "luminaria", label: "a" }),
  ...createElectricalSymbolShapes({ x: px + 468, y: py + 705, type: "luminaria", label: "b" }),
  ...createElectricalSymbolShapes({ x: px + 505, y: py + 776, type: "tug", label: "2" }),
  ...createElectricalSymbolShapes({ x: px + 250, y: py + 590, type: "qe", label: "QD" }),
  createArrow({ x: px + 268, y: py + 608, x2: px + 116, y2: py + 358, label: "1  1,5", color: "black", dash: "solid", bend: -70, size: THIN }),
  createArrow({ x: px + 286, y: py + 608, x2: px + 448, y2: py + 348, label: "1  1,5", color: "black", dash: "solid", bend: 78, size: THIN }),
  createArrow({ x: px + 286, y: py + 628, x2: px + 490, y2: py + 724, label: "2  2,5", color: "black", dash: "solid", bend: 48, size: THIN }),
  createArrow({ x: px + 266, y: py + 624, x2: px + 106, y2: py + 714, label: "2  2,5", color: "black", dash: "solid", bend: -42, size: THIN }),
  createArrow({ x: px + 292, y: py + 594, x2: px + 536, y2: py + 140, label: "5  6", color: "black", dash: "dashed", bend: 112, size: THIN }),
];

const parseDxfEntities = (text) => {
  const raw = text.split(/\r?\n/).map((line) => line.trim());
  const pairs = [];
  for (let index = 0; index < raw.length - 1; index += 2) {
    pairs.push({ code: raw[index], value: raw[index + 1] });
  }

  const entitiesStart = pairs.findIndex((pair, index) => (
    pair.code === "0" &&
    pair.value === "SECTION" &&
    pairs[index + 1]?.code === "2" &&
    pairs[index + 1]?.value === "ENTITIES"
  ));
  if (entitiesStart < 0) return [];

  const entities = [];
  let index = entitiesStart + 2;
  while (index < pairs.length) {
    const pair = pairs[index];
    if (pair.code === "0" && pair.value === "ENDSEC") break;
    if (pair.code !== "0") {
      index += 1;
      continue;
    }
    const type = pair.value;
    const values = [];
    index += 1;
    while (index < pairs.length && pairs[index].code !== "0") {
      values.push(pairs[index]);
      index += 1;
    }
    entities.push({ type, values });
  }

  return entities;
};

const readDxfNumber = (values, code) => {
  const pair = values.find((item) => item.code === code);
  const value = Number(pair?.value);
  return Number.isFinite(value) ? value : null;
};

const parseDxfPolylinePoints = (values) => {
  const points = [];
  let pendingX = null;
  values.forEach((item) => {
    if (item.code === "10") {
      pendingX = Number(item.value);
    } else if (item.code === "20" && pendingX !== null) {
      const y = Number(item.value);
      if (Number.isFinite(pendingX) && Number.isFinite(y)) {
        points.push({ x: pendingX, y });
      }
      pendingX = null;
    }
  });
  return points;
};

const buildDxfImportShapes = (entities, originX, originY) => {
  const primitives = [];
  entities.forEach((entity) => {
    if (entity.type === "LINE") {
      const x1 = readDxfNumber(entity.values, "10");
      const y1 = readDxfNumber(entity.values, "20");
      const x2 = readDxfNumber(entity.values, "11");
      const y2 = readDxfNumber(entity.values, "21");
      if ([x1, y1, x2, y2].every(Number.isFinite)) {
        primitives.push({ type: "line", points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] });
      }
    } else if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
      const points = parseDxfPolylinePoints(entity.values);
      const flags = readDxfNumber(entity.values, "70") || 0;
      if (points.length >= 2) {
        primitives.push({ type: "polyline", points: flags & 1 ? [...points, points[0]] : points });
      }
    } else if (entity.type === "CIRCLE") {
      const x = readDxfNumber(entity.values, "10");
      const y = readDxfNumber(entity.values, "20");
      const r = readDxfNumber(entity.values, "40");
      if ([x, y, r].every(Number.isFinite)) {
        primitives.push({ type: "circle", x, y, r });
      }
    }
  });

  if (primitives.length === 0) return [];

  const xs = [];
  const ys = [];
  primitives.forEach((primitive) => {
    if (primitive.type === "circle") {
      xs.push(primitive.x - primitive.r, primitive.x + primitive.r);
      ys.push(primitive.y - primitive.r, primitive.y + primitive.r);
    } else {
      primitive.points.forEach((point) => {
        xs.push(point.x);
        ys.push(point.y);
      });
    }
  });

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min(1.5, 920 / Math.max(width, height));
  const mapPoint = (point) => ({
    x: originX + (point.x - minX) * scale,
    y: originY + (maxY - point.y) * scale,
  });

  return primitives.slice(0, 2400).map((primitive) => {
    if (primitive.type === "circle") {
      const center = mapPoint({ x: primitive.x, y: primitive.y });
      const radius = primitive.r * scale;
      return createGeo({
        x: center.x - radius,
        y: center.y - radius,
        w: radius * 2,
        h: radius * 2,
        geo: "ellipse",
        color: "black",
        size: THIN,
        meta: { importType: "dxf" },
      });
    }
    const first = mapPoint(primitive.points[0]);
    return createLine({
      x: first.x,
      y: first.y,
      points: primitive.points.map((point) => {
        const mapped = mapPoint(point);
        return { x: mapped.x - first.x, y: mapped.y - first.y };
      }),
      size: THIN,
      meta: { importType: "dxf" },
    });
  });
};

const createImportedFileCard = ({ x, y, file }) => {
  const format = getFileFormat(file);
  return [
    createGeo({
      x,
      y,
      w: 360,
      h: 172,
      color: "grey",
      fill: "semi",
      dash: "dashed",
      size: "m",
      meta: { importType: "file", fileName: file.name, fileType: file.type },
    }),
    createText({ x: x + 24, y: y + 22, label: "ARQUIVO IMPORTADO", color: "black", size: "s" }),
    createText({ x: x + 24, y: y + 58, label: format, color: "blue", size: "xl" }),
    createText({
      x: x + 116,
      y: y + 62,
      label: `${file.name || "sem-nome"}\n${file.type || "tipo não informado"}\n${formatFileSize(file.size)}`,
      color: "black",
      size: "s",
    }),
  ];
};

const createReferenceHouseTemplateShapes = (x, y) => {
  const px = x + 105;
  const py = y + 70;
  const pw = 595;
  const ph = 840;
  const shapes = [
    createThinRect({ x: px - 50, y: py - 50, w: pw + 100, h: ph + 100, dash: "dashed" }),
    createThinRect({ x: px - 38, y: py - 38, w: pw + 76, h: ph + 76 }),
    createLine({ x: px + pw / 2, y: py - 70, points: [{ x: 0, y: 0 }, { x: 0, y: ph + 140 }], dash: "dashed", size: THIN }),
    createLine({ x: px - 70, y: py + ph * 0.62, points: [{ x: 0, y: 0 }, { x: pw + 140, y: 0 }], dash: "dashed", size: THIN }),

    createWallSegment({ x: px, y: py, w: pw, h: WALL }),
    createWallSegment({ x: px, y: py + ph - WALL, w: pw, h: WALL }),
    createWallSegment({ x: px, y: py, w: WALL, h: ph }),
    createWallSegment({ x: px + pw - WALL, y: py, w: WALL, h: ph }),

    createWallSegment({ x: px, y: py + 168, w: 285, h: WALL }),
    createWallSegment({ x: px + 285, y: py + 168, w: WALL, h: 258 }),
    createWallSegment({ x: px + 285, y: py, w: WALL, h: 168 }),
    createWallSegment({ x: px + 380, y: py, w: WALL, h: 245 }),
    createWallSegment({ x: px + 470, y: py, w: WALL, h: 245 }),
    createWallSegment({ x: px + 380, y: py + 245, w: 215, h: WALL }),

    createWallSegment({ x: px, y: py + 426, w: 250, h: WALL }),
    createWallSegment({ x: px + 250, y: py + 426, w: WALL, h: 145 }),
    createWallSegment({ x: px, y: py + 570, w: 250, h: WALL }),
    createWallSegment({ x: px + 250, y: py + 570, w: 100, h: WALL }),
    createWallSegment({ x: px + 350, y: py + 570, w: WALL, h: 270 }),
    createWallSegment({ x: px + 350, y: py + 640, w: 245, h: WALL }),
    createWallSegment({ x: px + 280, y: py + 500, w: WALL, h: 120 }),
    createWallSegment({ x: px + 280, y: py + 620, w: 120, h: WALL }),
    createWallSegment({ x: px + 390, y: py + 245, w: WALL, h: 330 }),

    ...createDoorSymbol({ x: px + 390, y: py + 36, width: 82, orientation: "right", label: "P1" }),
    ...createDoorSymbol({ x: px + 250, y: py + 408, width: 82, orientation: "left", label: "P2" }),
    ...createDoorSymbol({ x: px + 252, y: py + 575, width: 92, orientation: "right", label: "P1" }),
    ...createDoorSymbol({ x: px + 392, y: py + 570, width: 88, orientation: "right", label: "P1" }),
    ...createDoorSymbol({ x: px + 385, y: py + 640, width: 94, orientation: "right", label: "P1" }),
    ...createDoorSymbol({ x: px + 584, y: py + 560, width: 92, orientation: "up", label: "P1" }),

    ...createWindowVertical({ x: px, y: py + 175, height: 170, label: "J1", labelX: -30 }),
    ...createWindowVertical({ x: px, y: py + 615, height: 175, label: "J1", labelX: -30 }),
    ...createWindowVertical({ x: px + pw, y: py + 80, height: 175, label: "J1", labelX: 18 }),
    ...createWindowVertical({ x: px + pw, y: py + 300, height: 180, label: "J1", labelX: 18 }),
    ...createWindowVertical({ x: px + pw, y: py + 700, height: 95, label: "J1", labelX: 18 }),
    ...createWindowHorizontal({ x: px + 430, y: py, width: 125, label: "Pio", labelY: 56 }),
    ...createWindowHorizontal({ x: px + 410, y: py + ph, width: 150, label: "J1", labelY: -42 }),

    ...createKitchenFixture({ x: px + 18, y: py + 74 }),
    ...createServiceFixture({ x: px - 56, y: py + 40 }),
    ...createBathroomFixture({ x: px + 55, y: py + 462 }),

    createText({ x: px + 112, y: py + 314, label: "QUARTO 1", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 130, y: py + 344, label: "7.10m²", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 110, y: py + 675, label: "QUARTO 2", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 128, y: py + 704, label: "6.70m²", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 470, y: py + 684, label: "QUARTO 3", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 488, y: py + 710, label: "7.70m²", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 438, y: py + 340, label: "SALA", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 456, y: py + 356, label: "8.85m²", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 500, y: py + 130, label: "cozinha", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 518, y: py + 154, label: "5.45m²", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 248, y: py + 44, label: "A. SERVIÇO", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 266, y: py + 78, label: "3.30m²", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 72, y: py + 494, label: "BANHO", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 90, y: py + 520, label: "2.40m²", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 305, y: py + 540, label: "CIRCULAÇÃO", size: "s", rotation: TEXT_ROTATE }),
    createText({ x: px + 323, y: py + 578, label: "2.75m²", size: "s", rotation: TEXT_ROTATE }),

    ...createLevelMarker({ x: px + 175, y: py + 350 }),
    ...createLevelMarker({ x: px + 420, y: py + 320 }),
    ...createLevelMarker({ x: px + 480, y: py + 680 }),
    ...createLevelMarker({ x: px + 245, y: py + 65, label: "+13" }),
    ...createLevelMarker({ x: px + 270, y: py + 585 }),
    ...createSectionTriangle({ x: px + 230, y: py + 345 }),
    ...createSectionTriangle({ x: px + 420, y: py + 345 }),
    ...createSectionTriangle({ x: px + 230, y: py + 710 }),
    ...createSectionTriangle({ x: px + 430, y: py + 710 }),

    ...createDimHorizontal({ x1: px, x2: px + 175, y: py + 462, label: "175" }),
    ...createDimHorizontal({ x1: px + 195, x2: px + 280, y: py + 462, label: "85" }),
    ...createDimHorizontal({ x1: px + 390, x2: px + 595, y: py + 462, label: "275" }),
    ...createDimHorizontal({ x1: px, x2: px + 280, y: py + 820, label: "275" }),
    ...createDimHorizontal({ x1: px + 350, x2: px + 595, y: py + 820, label: "275" }),
    ...createDimHorizontal({ x1: px, x2: px + 595, y: py + 870, label: "595" }),
    ...createDimVertical({ x: px - 42, y1: py, y2: py + ph, label: "840" }),
    ...createDimVertical({ x: px + 652, y1: py, y2: py + 300, label: "300" }),
    ...createDimVertical({ x: px + 652, y1: py + 590, y2: py + 840, label: "280" }),
    ...createDimVertical({ x: px + 520, y1: py + 200, y2: py + 245, label: "200" }),

    ...createCutMarker({ x: px + 280, y: py - 42, label: "C’" }),
    ...createCutMarker({ x: px + 380, y: py - 42, label: "B’" }),
    ...createCutMarker({ x: px + 280, y: py + ph + 42, label: "C" }),
    ...createCutMarker({ x: px + 380, y: py + ph + 42, label: "B" }),
    ...createCutMarker({ x: px - 55, y: py + 515, label: "A", rotation: Math.PI / 2 }),
    ...createCutMarker({ x: px + pw + 55, y: py + 515, label: "A’", rotation: Math.PI / 2 }),

    createText({ x: px - 142, y: py + 60, label: "TV embutida na parede DN50mm, ventilar junto do telhado", size: "s", rotation: TEXT_ROTATE }),
    createGeo({ x: px - 125, y: py + 470, w: 115, h: 115, geo: "ellipse", size: THIN }),
    createGeo({ x: px - 80, y: py + 515, w: 26, h: 26, size: THIN }),
    createText({ x: px - 120, y: py + 462, label: "caixa d'água\n500 litros", size: "s", rotation: -0.62 }),
    createText({ x: px - 120, y: py + 650, label: "calçada de\nproteção - 45 cm\n\nprojeção do\ntelhado - 45 cm", size: "s" }),

    createText({ x: px - 135, y: py + ph + 20, label: "ESQUADRIAS\nPorta >P1 - 080 X 210\nPorta >P2 - 060 X 210\nJanelas\n>J1 - 150 X 100 / h=110\n>J2 - 60 X 60 / h=180", size: "s" }),
    createText({ x: px + 250, y: py + ph + 44, label: "00  <Na parte mais alta do terreno>", size: "s" }),
    createText({ x: px + 250, y: py + ph + 76, label: "PLANTA BAIXA / LOCAÇÃO", size: "l" }),
    createText({ x: px + 280, y: py + ph + 116, label: "Esc.: 1 / 50", size: "m" }),

    ...createDefaultElectricalOverlayShapes(px, py),
    ...createElectricalLegendShapes({ x: px + pw + 112, y: py + 28 }),
  ];

  return shapes;
};

const SNAP_THRESHOLD = 16;

const getCornersForSnapping = (shape) => {
  const x = shape.x;
  const y = shape.y;
  const w = shape.props?.w || 0;
  const h = shape.props?.h || 0;
  return [
    { x, y },                         // Top-left
    { x: x + w, y },                 // Top-right
    { x, y: y + h },                 // Bottom-left
    { x: x + w, y: y + h },         // Bottom-right
    { x: x + w / 2, y: y + h / 2 }, // Center
  ];
};

const resolveSnap = (shapeA, otherShapes) => {
  const cornersA = getCornersForSnapping(shapeA);
  let bestSnap = { dx: 0, dy: 0, dist: Infinity, type: "none" };

  for (const shapeB of otherShapes) {
    if (shapeB.id === shapeA.id || shapeB.type !== "geo") continue;

    const cornersB = getCornersForSnapping(shapeB);
    const isWallB = shapeB.meta?.cadType === "wall";
    const wB = shapeB.props?.w || 0;
    const hB = shapeB.props?.h || 0;

    // 1. Corner-to-corner snapping
    for (const pA of cornersA) {
      for (const pB of cornersB) {
        const dx = pB.x - pA.x;
        const dy = pB.y - pA.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= SNAP_THRESHOLD && dist < bestSnap.dist) {
          bestSnap = { dx, dy, dist, type: "corner" };
        }
      }
    }

    // 2. Edge snapping to walls
    if (isWallB && bestSnap.type !== "corner") {
      const isHorizontal = wB > hB;
      if (isHorizontal) {
        for (const pA of cornersA) {
          if (pA.x >= shapeB.x - 10 && pA.x <= shapeB.x + wB + 10) {
            // Top edge
            const dyTop = shapeB.y - pA.y;
            if (Math.abs(dyTop) <= SNAP_THRESHOLD && Math.abs(dyTop) < bestSnap.dist) {
              bestSnap = { dx: 0, dy: dyTop, dist: Math.abs(dyTop), type: "edge" };
            }
            // Bottom edge
            const dyBot = (shapeB.y + hB) - pA.y;
            if (Math.abs(dyBot) <= SNAP_THRESHOLD && Math.abs(dyBot) < bestSnap.dist) {
              bestSnap = { dx: 0, dy: dyBot, dist: Math.abs(dyBot), type: "edge" };
            }
          }
        }
      } else {
        for (const pA of cornersA) {
          if (pA.y >= shapeB.y - 10 && pA.y <= shapeB.y + hB + 10) {
            // Left edge
            const dxLeft = shapeB.x - pA.x;
            if (Math.abs(dxLeft) <= SNAP_THRESHOLD && Math.abs(dxLeft) < bestSnap.dist) {
              bestSnap = { dx: dxLeft, dy: 0, dist: Math.abs(dxLeft), type: "edge" };
            }
            // Right edge
            const dxRight = (shapeB.x + wB) - pA.x;
            if (Math.abs(dxRight) <= SNAP_THRESHOLD && Math.abs(dxRight) < bestSnap.dist) {
              bestSnap = { dx: dxRight, dy: 0, dist: Math.abs(dxRight), type: "edge" };
            }
          }
        }
      }
    }
  }

  return bestSnap;
};

const getEditorCenter = (editor, width = 120, height = 80) => {
  const bounds = editor.getViewportPageBounds();
  return {
    x: bounds.x + bounds.w / 2 - width / 2,
    y: bounds.y + bounds.h / 2 - height / 2,
  };
};

function ProfessionalFloorPlanEditor({ projectKey = "draft", onPointsChange }, ref) {
  const editorRef = useRef(null);
  const pendingEditorActionsRef = useRef([]);
  const planBoundsRef = useRef(null);
  const prevPointsKeyRef = useRef("");
  const [selectedIds, setSelectedIds] = useState([]);

  const rotateSelected = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelectedShapes();
    if (selected.length === 0) return;

    const updates = selected.map(shape => {
      const currentRot = shape.rotation || 0;
      return {
        id: shape.id,
        type: shape.type,
        rotation: (currentRot + Math.PI / 2) % (Math.PI * 2),
      };
    });
    editor.updateShapes(updates);
  };

  const duplicateSelected = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelectedShapeIds();
    if (selected.length === 0) return;
    editor.duplicateShapes(selected);
  };

  const deleteSelected = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelectedShapeIds();
    if (selected.length === 0) return;
    editor.deleteShapes(selected);
  };

  const syncPointsFromCanvas = (editor) => {
    const shapes = editor.getCurrentPageShapes();
    const uniqueSymbols = new Map();
    
    shapes.forEach((shape) => {
      if (shape.meta?.electricalType) {
        const type = shape.meta.electricalType;
        const label = shape.meta.label || type;
        const parentId = shape.parentId;
        
        const isGroupParent = parentId && parentId.startsWith("shape:group");
        const key = isGroupParent ? parentId : shape.id;
        
        const bounds = editor.getShapePageBounds(shape);
        
        if (!uniqueSymbols.has(key)) {
          uniqueSymbols.set(key, {
            id: key,
            type,
            label,
            x: bounds?.x || shape.x,
            y: bounds?.y || shape.y,
            circuit: shape.meta.circuit || null,
            load_w: Number(shape.meta.loadW) || 0,
            room: shape.meta.room || "",
          });
        }
      }
    });
    
    return [...uniqueSymbols.values()];
  };

  const runWhenEditorReady = (action) => {
    const editor = editorRef.current;
    if (!editor) {
      pendingEditorActionsRef.current.push(action);
      return;
    }
    action(editor);
  };

  const flushPendingEditorActions = () => {
    const editor = editorRef.current;
    if (!editor || pendingEditorActionsRef.current.length === 0) return;
    const pending = pendingEditorActionsRef.current;
    pendingEditorActionsRef.current = [];
    pending.forEach((action) => action(editor));
  };

  const selectShapes = (ids) => {
    const editor = editorRef.current;
    if (!editor || ids.length === 0) return;
    editor.setCurrentTool("select");
    editor.setSelectedShapes(ids);
  };

  const createShapes = (shapes, shouldZoom = false) => {
    const editor = editorRef.current;
    if (!editor) return [];
    const ids = shapes.map((shape) => shape.id);
    editor.createShapes(shapes);
    selectShapes(ids);
    if (shouldZoom) {
      requestAnimationFrame(() => editor.zoomToFit());
    }
    return ids;
  };

  const createGroupedShapes = (shapes) => {
    const editor = editorRef.current;
    if (!editor) return [];
    const ids = createShapes(shapes);
    if (ids.length > 1) {
      editor.groupShapes(ids, { select: true });
    }
    return ids;
  };

  const getMountedRooms = () => {
    const editor = editorRef.current;
    if (!editor) return [];

    const collectChildIds = (parentId) => {
      const childIds = editor.getSortedChildIdsForParent(parentId);
      return childIds.flatMap((childId) => [childId, ...collectChildIds(childId)]);
    };

    const roomsByName = new Map();
    collectChildIds(editor.getCurrentPageId()).forEach((id) => {
      const shape = editor.getShape(id);
      const meta = shape?.meta || {};
      const roomName = String(meta.roomName || "").trim();
      if (!roomName) return;

      const current = roomsByName.get(roomName) || {
        name: roomName,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };

      if (meta.cadType === "room") {
        const bounds = editor.getShapePageBounds(shape);
        if (bounds) {
          current.minX = Math.min(current.minX, bounds.x);
          current.minY = Math.min(current.minY, bounds.y);
          current.maxX = Math.max(current.maxX, bounds.x + bounds.w);
          current.maxY = Math.max(current.maxY, bounds.y + bounds.h);
        }
      }

      roomsByName.set(roomName, current);
    });

    const roomBounds = [...roomsByName.values()]
      .filter((room) => Number.isFinite(room.minX) && Number.isFinite(room.minY) && room.maxX > room.minX && room.maxY > room.minY)
      .map((room) => ({
        name: room.name,
        x: room.minX,
        y: room.minY,
        w: room.maxX - room.minX,
        h: room.maxY - room.minY,
      }));

    if (roomBounds.length === 0) return [];

    const commonBounds = roomBounds.reduce((acc, room) => ({
      x: Math.min(acc.x, room.x),
      y: Math.min(acc.y, room.y),
      maxX: Math.max(acc.maxX, room.x + room.w),
      maxY: Math.max(acc.maxY, room.y + room.h),
    }), {
      x: roomBounds[0].x,
      y: roomBounds[0].y,
      maxX: roomBounds[0].x + roomBounds[0].w,
      maxY: roomBounds[0].y + roomBounds[0].h,
    });
    const reference = planBoundsRef.current || {
      x: commonBounds.x,
      y: commonBounds.y,
      w: Math.max(1, commonBounds.maxX - commonBounds.x),
      h: Math.max(1, commonBounds.maxY - commonBounds.y),
    };

    return roomBounds.map((room) => ({
      name: room.name,
      x_pct: ((room.x - reference.x) / reference.w) * 100,
      y_pct: ((room.y - reference.y) / reference.h) * 100,
      w_pct: (room.w / reference.w) * 100,
      h_pct: (room.h / reference.h) * 100,
      area_m2: 0,
    }));
  };

  const insertRoom = (label = "Cômodo") => {
    const editor = editorRef.current;
    if (!editor) return;
    
    const allShapes = editor.getCurrentPageShapes();
    let rightmostX = -Infinity;
    let baselineY = null;
    let roomHeight = 180;
    let roomWidth = 260;
    
    allShapes.forEach(shape => {
      if (shape.meta?.cadType === "room" && shape.meta?.roomBounds) {
        const { x, y, w, h } = shape.meta.roomBounds;
        if (x + w > rightmostX) {
          rightmostX = x + w;
          baselineY = y;
          roomHeight = h;
          roomWidth = w;
        }
      }
    });

    let newX, newY;
    const center = getEditorCenter(editor, roomWidth, roomHeight);
    
    if (rightmostX !== -Infinity && baselineY !== null) {
      newX = rightmostX - WALL;
      newY = baselineY;
    } else {
      newX = center.x;
      newY = center.y;
    }

    createGroupedShapes(createCadRoomShapes({ x: newX, y: newY, w: roomWidth, h: roomHeight, label: label.toUpperCase() }));
  };

  const insertHouseTemplate = () => {
    runWhenEditorReady((editor) => {
      editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
      const { x, y } = getEditorCenter(editor, 1180, 1080);
      planBoundsRef.current = { x: x + 105, y: y + 70, w: 595, h: 840 };
      createShapes(createReferenceHouseTemplateShapes(x, y), true);
    });
  };

  const insertGeneratedRooms = (rooms = []) => {
    if (rooms.length === 0) return;
    runWhenEditorReady((editor) => {
      editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
      const layout = {
        ...getEditorCenter(editor, 900, 640),
        w: 900,
        h: 640,
      };
      planBoundsRef.current = layout;

      const shapes = rooms.flatMap((room, index) => {
        const xPct = Number(room.x_pct);
        const yPct = Number(room.y_pct);
        const wPct = Number(room.w_pct);
        const hPct = Number(room.h_pct);
        const x = layout.x + layout.w * (Number.isFinite(xPct) ? xPct : 10) / 100;
        const y = layout.y + layout.h * (Number.isFinite(yPct) ? yPct : 10) / 100;
        const w = layout.w * (Number.isFinite(wPct) ? wPct : 22) / 100;
        const h = layout.h * (Number.isFinite(hPct) ? hPct : 18) / 100;
        const label = room.name || `Cômodo ${index + 1}`;
        return createCadRoomShapes({ x, y, w, h, label: label.toUpperCase() });
      });

      createShapes(shapes, true);
      requestAnimationFrame(() => editor.setSelectedShapes([]));
    });
  };

  const insertWall = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const { x, y } = getEditorCenter(editor, 260, WALL);
    createShapes([createWallSegment({ x, y, w: 260, h: WALL })]);
  };

  const insertDoor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const { x, y } = getEditorCenter(editor, 136, 96);
    createGroupedShapes(createCadDoorShapes({ x, y, width: 88 }));
  };

  const insertWindow = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const { x, y } = getEditorCenter(editor, 164, 40);
    createGroupedShapes(createCadWindowShapes({ x, y, width: 116 }));
  };

  const insertText = (label = "Anotação técnica") => {
    const editor = editorRef.current;
    if (!editor) return;
    const { x, y } = getEditorCenter(editor, 180, 36);
    createShapes([createText({ x, y, label, color: "black" })]);
  };

  const insertConduit = (label = "Eletroduto") => {
    const editor = editorRef.current;
    if (!editor) return;
    const { x, y } = getEditorCenter(editor, 260, 1);
    createShapes([createArrow({ x, y, x2: x + 260, y2: y, label })]);
  };

  const insertElectricalSymbol = (type, label) => {
    const editor = editorRef.current;
    if (!editor) return;
    const { x, y } = getEditorCenter(editor, 72, 76);
    createGroupedShapes(createElectricalSymbolShapes({ x, y, type, label }));
  };

  const insertPanelBoard = (board, index = 0) => {
    const editor = editorRef.current;
    if (!editor) return;
    const { x, y } = getEditorCenter(editor, 118, 82);
    createGroupedShapes(createPanelBoardShapes({ x: x + index * 22, y: y + index * 18, board, index }));
  };

  const insertPanelBoards = (boards = []) => {
    const editor = editorRef.current;
    if (!editor || boards.length === 0) return;
    const columns = Math.min(3, Math.max(1, boards.length));
    const w = columns * 138;
    const rows = Math.ceil(boards.length / columns);
    const h = rows * 102;
    const origin = getEditorCenter(editor, w, h);
    const shapes = boards.flatMap((board, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      return createPanelBoardShapes({
        x: origin.x + col * 138,
        y: origin.y + row * 102,
        board,
        index,
      });
    });
    createGroupedShapes(shapes);
  };

  const insertSuggestedPoints = (points = []) => {
    if (points.length === 0) return;
    runWhenEditorReady((editor) => {
      const bounds = planBoundsRef.current || editor.getViewportPageBounds();
      const shapes = points.flatMap((point) => {
        const xPct = Number(point.x_pct ?? point.x) || 50;
        const yPct = Number(point.y_pct ?? point.y) || 50;
        const x = bounds.x + bounds.w * xPct / 100 - 28;
        const y = bounds.y + bounds.h * yPct / 100 - 28;
        return createElectricalSymbolShapes({ x, y, type: point.type, label: point.label }).map((shape) => ({
          ...shape,
          meta: {
            ...shape.meta,
            aiGenerated: true,
            room: point.room || "",
            circuit: point.circuit || point.circuit_type || point.circuit_name || "",
            loadW: Number(point.load_w) || 0,
            cadLayer: shape.meta?.cadLayer || "ELE-PONTOS",
          },
        }));
      });
      createShapes(shapes, true);
      requestAnimationFrame(() => editor.setSelectedShapes([]));
    });
  };

  const insertRoutes = (routes = []) => {
    if (routes.length === 0) return;
    runWhenEditorReady((editor) => {
      const bounds = planBoundsRef.current || editor.getViewportPageBounds();
      const shapes = [];
      routes.forEach((route) => {
        const path = route.path || [];
        const isGalv = route.infraType === "galvanizado";
        for (let index = 1; index < path.length; index += 1) {
          const start = path[index - 1];
          const end = path[index];
          const x = bounds.x + bounds.w * start.x / 100;
          const y = bounds.y + bounds.h * start.y / 100;
          const circuitText = String(route.label || route.circuit_name || `C${index}`).slice(0, 12);
          const gauge = route.gauge || route.wire_gauge || route.section || (route.description?.match(/\d+(?:[,.]\d+)?\s*mm/i)?.[0] || "2,5");
          shapes.push(createArrow({
            x,
            y,
            x2: bounds.x + bounds.w * end.x / 100,
            y2: bounds.y + bounds.h * end.y / 100,
            label: index === 1 ? `${circuitText}  ${String(gauge).replace("mm", "")}` : "",
            color: "black",
            dash: isGalv ? "solid" : "dashed",
            bend: isGalv ? 0 : 46,
            size: THIN,
          }));
        }
      });
      createShapes(shapes);
      requestAnimationFrame(() => editor.setSelectedShapes([]));
    });
  };

  const insertImageFile = async (file) => {
    const editor = editorRef.current;
    if (!editor || !file || !canRenderAsImage(file)) return false;
    const dataUrl = await readFileAsDataUrl(file);
    const size = await getImageSize(dataUrl);
    const maxWidth = 920;
    const scale = Math.min(1, maxWidth / size.w);
    const asset = {
      id: AssetRecordType.createId(),
      typeName: "asset",
      type: "image",
      props: {
        name: file.name || "planta-importada",
        src: dataUrl,
        w: Math.round(size.w * scale),
        h: Math.round(size.h * scale),
        mimeType: file.type,
        fileSize: file.size,
        isAnimated: false,
      },
      meta: {},
    };
    const bounds = editor.getViewportPageBounds();
    planBoundsRef.current = {
      x: bounds.center.x - asset.props.w / 2,
      y: bounds.center.y - asset.props.h / 2,
      w: asset.props.w,
      h: asset.props.h,
    };
    await createShapesForAssets(editor, [asset], bounds.center);
    return true;
  };

  const insertDxfFile = async (file) => {
    const editor = editorRef.current;
    if (!editor || !file) return false;
    const text = await readFileAsText(file);
    const entities = parseDxfEntities(text);
    const { x, y } = getEditorCenter(editor, 920, 640);
    const shapes = buildDxfImportShapes(entities, x, y);
    if (shapes.length === 0) return false;
    planBoundsRef.current = null;
    const label = createText({
      x,
      y: y - 42,
      label: `DXF IMPORTADO · ${file.name}`,
      color: "black",
      size: "s",
    });
    createShapes([label, ...shapes], true);
    return true;
  };

  const insertImportedFile = async (file) => {
    const editor = editorRef.current;
    if (!editor || !file) return;

    if (canRenderAsImage(file)) {
      const inserted = await insertImageFile(file);
      if (inserted) return;
    }

    if (getFileExtension(file) === "dxf") {
      const inserted = await insertDxfFile(file);
      if (inserted) return;
    }

    const { x, y } = getEditorCenter(editor, 360, 172);
    planBoundsRef.current = { x, y, w: 360, h: 172 };
    createGroupedShapes(createImportedFileCard({ x, y, file }));
  };

  const clear = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
    planBoundsRef.current = null;
    editor.setCurrentTool("select");
  };

  useImperativeHandle(ref, () => ({
    clear,
    insertConduit,
    insertDoor,
    insertElectricalSymbol,
    insertGeneratedRooms,
    getMountedRooms,
    insertHouseTemplate,
    insertImageFile,
    insertImportedFile,
    insertPanelBoard,
    insertPanelBoards,
    insertRoom,
    insertRoutes,
    insertSuggestedPoints,
    insertText,
    insertWall,
    insertWindow,
    zoomToFit: () => editorRef.current?.zoomToFit(),
  }));

  return (
    <div className="relative h-full w-full overflow-hidden bg-white max-lg:min-h-[620px]">
      <Tldraw
        persistenceKey={`planta-eletrica-cad-v3-${projectKey || "draft"}`}
        autoFocus
        hideUi
        initialState="select"
        onMount={(editor) => {
          let isSnappingNow = false;
          editorRef.current = editor;
          editor.updateInstanceState({ isGridMode: true });
          editor.user.updateUserPreferences({ isSnapMode: true });
          
          editor.store.listen((entry) => {
            const selected = editor.getSelectedShapeIds();
            setSelectedIds((prev) => {
              if (prev.length === selected.length && prev.every(id => selected.includes(id))) return prev;
              return selected;
            });

            if (onPointsChange) {
              const currentPoints = syncPointsFromCanvas(editor);
              const currentKey = currentPoints
                .map(p => `${p.id}:${p.type}:${p.circuit}:${p.load_w}:${p.room}`)
                .sort()
                .join("|");
              
              if (prevPointsKeyRef.current !== currentKey) {
                prevPointsKeyRef.current = currentKey;
                onPointsChange(currentPoints);
              }
            }

            if (isSnappingNow) return;
            const updated = entry.changes.updated;
            if (!updated) return;
            
            const shapeUpdates = Object.values(updated)
              .map(([from, to]) => to)
              .filter(to => to.typeName === "shape" && to.type === "geo");
              
            if (shapeUpdates.length === 0) return;
            
            const shapesToUpdate = [];
            const allShapes = editor.getCurrentPageShapes();
            
            shapeUpdates.forEach(shapeA => {
              const snap = resolveSnap(shapeA, allShapes);
              if (snap.type !== "none" && (snap.dx !== 0 || snap.dy !== 0)) {
                shapesToUpdate.push({
                  id: shapeA.id,
                  type: shapeA.type,
                  x: shapeA.x + snap.dx,
                  y: shapeA.y + snap.dy,
                });
              }
            });
            
            if (shapesToUpdate.length > 0) {
              isSnappingNow = true;
              editor.updateShapes(shapesToUpdate);
              isSnappingNow = false;
            }
          });
          
          requestAnimationFrame(flushPendingEditorActions);
        }}
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-[#CDEFE8] bg-white/90 px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#00d8b8] shadow-sm">
        Editor profissional
      </div>
      {selectedIds.length > 0 && (
        <div className="absolute bottom-10 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-[#CDEFE8] bg-white/95 p-2 shadow-lg backdrop-blur-sm transition-all duration-200">
          <div className="flex items-center gap-1 px-1.5 border-r border-[#E5F3FC]">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#0f4f49]">
              {selectedIds.length} selecionado{selectedIds.length > 1 ? "s" : ""}
            </span>
          </div>
          
          <button
            onClick={rotateSelected}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#E5F3FC] px-3 text-xs font-black text-[#00d8b8] transition hover:bg-[#D6E8F3] hover:text-[#00548D]"
          >
            <RotateCcw className="h-4 w-4" />
            Girar 90°
          </button>

          <button
            onClick={duplicateSelected}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-slate-50 px-3 text-xs font-black text-[#526173] transition hover:bg-slate-100 hover:text-[#0F172A]"
          >
            Duplicar
          </button>

          <button
            onClick={deleteSelected}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-black text-red-600 transition hover:bg-red-100 hover:text-red-700"
          >
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

export default forwardRef(ProfessionalFloorPlanEditor);
