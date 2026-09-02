import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Stage, Layer, Rect, Line, Circle, Text, Group, Image as KonvaImage, Arc } from "react-konva";

// Renderiza todo o canvas Konva em pelo menos 2x pixels reais, mesmo em monitor
// comum (devicePixelRatio = 1): símbolos, textos e traços da planta deixam de
// sair "chapados"/borrados. Precisa ser definido antes de qualquer Layer nascer.
if (typeof window !== "undefined") {
  Konva.pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
}
import {
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  Maximize2,
  Minus,
  MousePointer2,
  PanelTop,
  Redo2,
  Ruler,
  RotateCcw,
  RotateCw,
  Settings2,
  SquarePlus,
  Spline,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  Crosshair,
} from "lucide-react";
import { ElectricalSymbol, PLANT_SYMBOL_LABELS, TOOL_TYPES } from "./ElectricalSymbols";
import CableRenderer from "./CableRenderer";
import { normalizeSnapSettings, snapPointToReferences, snapToleranceToDocument } from "@/editor/snapping/snapEngine";
import { clampZoom, screenToDesignPoint, zoomAtPoint } from "@/editor/viewport/viewportMath";
import { cablePath, pointToTerminal } from "@/lib/manualCableEditor";

const DESIGN = { width: 1400, height: 900 };
const POINT_SIZE = 28;
const ARCHITECTURAL_GRID = 10;
const DEFAULT_WALL_THICKNESS = 6;
const DEFAULT_SCALE_PX_PER_METER = 50;
const MIN_SCALE_PX_PER_METER = 20;
const MAX_SCALE_PX_PER_METER = 200;
const DEFAULT_DOOR_WIDTH_M = 0.9;
const DEFAULT_WINDOW_WIDTH_M = 1.2;
const ROUTE_MIN_POINTS = 2;
const ROUTE_HANDLE_RADIUS = 6;
const ROUTE_HANDLE_HIT_RADIUS = 16;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const asArray = (value) => (Array.isArray(value) ? value : []);
const isFiniteNumber = (value) => Number.isFinite(Number(value));
const pctToPx = (value, total) => (Number(value || 0) / 100) * total;
const pxToPct = (value, total) => clamp((value / total) * 100, 0, 100);
const sameId = (a, b) => String(a) === String(b);
const normalizeScalePxPerMeter = (value) => clamp(Number(value) || DEFAULT_SCALE_PX_PER_METER, MIN_SCALE_PX_PER_METER, MAX_SCALE_PX_PER_METER);
const formatMeters = (value, digits = 2) => `${Number(value || 0).toLocaleString("pt-BR", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
})} m`;

const DEFAULT_POINT_HEIGHT_BY_TYPE = {
  arandela: "alta",
  spot: "teto",
  luminaria: "teto",
  interruptor: "media",
  inter2: "media",
  inter3: "media",
  inter3way: "media",
  tue: "media",
  arcond: "alta",
  tug: "baixa",
  chuveiro: "alta",
  qgbt: "media",
  qe: "media",
  caixa: "alta",
  "rack-cftv": "alta",
  rede: "baixa",
  motor: "media",
  sensor: "alta",
  camera: "alta",
};

const POINT_HEIGHT_LABELS = {
  piso: "Piso",
  baixa: "h=0,30 m",
  media: "h=1,20 m",
  alta: "h=2,00 m",
  teto: "Teto",
};

const defaultPointHeight = (type = "") => DEFAULT_POINT_HEIGHT_BY_TYPE[type] || "baixa";
const pointHeightLabel = (height = "") => POINT_HEIGHT_LABELS[height] || String(height || "");
const stripConduitInfo = (value = "") => String(value || "")
  .replace(/\s*[·,;-]?\s*(?:eletroduto\s*)?DN\s*\d+(?:[,.]\d+)?\s*mm?\b/gi, "")
  .replace(/\s{2,}/g, " ")
  .trim();

/** @param {any} point */
const normalizeCanvasPoint = (point = {}, index = 0) => {
  if (!point || typeof point !== "object") return null;
  const type = String(point.type || "").trim();
  if (!type || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null;
  const rotation = Number(point.rotation);
  return {
    ...point,
    id: String(point.id || `point-${index + 1}`),
    type,
    x: clamp(Number(point.x), 0, 100),
    y: clamp(Number(point.y), 0, 100),
    rotation: Number.isFinite(rotation) ? rotation : 0,
    height: point.height || defaultPointHeight(type),
  };
};

const normalizeCanvasPoints = (items = []) => (
  asArray(items).map((point, index) => normalizeCanvasPoint(point, index)).filter(Boolean)
);

const normalizeImportedPlanElements = (elements = {}) => ({
  lines: asArray(elements?.lines)
    .map((line, index) => ({
      ...line,
      id: line?.id || `import-line-${index}`,
      x1: Number(line?.x1),
      y1: Number(line?.y1),
      x2: Number(line?.x2),
      y2: Number(line?.y2),
      strokeWidth: Math.max(0.4, Number(line?.strokeWidth) || 1),
    }))
    .filter((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite)),
  texts: asArray(elements?.texts)
    .map((item, index) => ({
      ...item,
      id: item?.id || `import-text-${index}`,
      x: Number(item?.x),
      y: Number(item?.y),
      width: Number(item?.width) || 120,
      text: String(item?.text || ""),
      fontSize: Number(item?.fontSize) || 8,
    }))
    .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y) && item.text.trim()),
});

const SYMBOL_LABELS = {
  tug: "",
  tue: "",
  interruptor: "",
  inter2: "",
  inter3: "",
  inter3way: "",
  luminaria: "",
  spot: "",
  arandela: "",
  arcond: "",
  chuveiro: "",
  motor: "M",
  qgbt: "QGBT",
  qe: "QD",
  caixa: "CX",
  "rack-cftv": "CFTV",
  sensor: "WIFI",
  camera: "CAM",
  rede: "RJ",
};

const TOOLBAR_SYMBOLS = [
  "arandela",
  "spot",
  "luminaria",
  "interruptor",
  "inter2",
  "inter3",
  "inter3way",
  "tue",
  "arcond",
  "tug",
  "chuveiro",
  "qgbt",
  "qe",
  "caixa",
  "rack-cftv",
  "rede",
];

const TECH_BLACK = "#050505";
const PAPER_GRID = "#edf0f2";
const MAJOR_GRID = "#d9dee3";
const DRAWING_FRAME = { x: 20, y: 22, width: 1348, height: 835 };
const IMPORTED_PLAN_FRAME = { x: 45, y: 45, w: 1290, h: 770 };
const DEFAULT_WALL_DIMENSION_LABEL = {
  fill: "#ffffff",
  stroke: "#00d8b8",
  text: "#123D5C",
  selectedText: "#0f4f49",
  selectedStroke: "#00a58f",
  fontSize: 10,
};
const DEFAULT_DEVICE_DIMENSION_LABEL = {
  fill: "#ffffff",
  stroke: "#fca5a5",
  text: "#dc2626",
  fontSize: 10,
};
const DEFAULT_POSITION_LABEL = {
  fill: "#ffffff",
  stroke: "#fecaca",
  text: "#b91c1c",
  fontSize: 8,
  x: -34,
  y: 24,
};
const DEFAULT_POWER_LABEL = {
  text: TECH_BLACK,
  fontSize: 8,
  width: 64,
  x: -26,
  y: 17,
};

const emptyBounds = () => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

const extendBounds = (bounds, x, y, padding = 0) => ({
  minX: Math.min(bounds.minX, x - padding),
  minY: Math.min(bounds.minY, y - padding),
  maxX: Math.max(bounds.maxX, x + padding),
  maxY: Math.max(bounds.maxY, y + padding),
});

const hasBounds = (bounds) => Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY)
  && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.maxY);

const boundsCenter = (bounds) => ({
  x: bounds.minX + (bounds.maxX - bounds.minX) / 2,
  y: bounds.minY + (bounds.maxY - bounds.minY) / 2,
});

const getPlanContentBounds = ({ rooms = [], roomLabels = [], walls = [], points = [], routes = [] }) => {
  let roomBounds = emptyBounds();

  rooms.forEach((room) => {
    const x = pctToPx(room.x, DESIGN.width);
    const y = pctToPx(room.y, DESIGN.height);
    const w = pctToPx(room.w, DESIGN.width);
    const h = pctToPx(room.h, DESIGN.height);
    roomBounds = extendBounds(roomBounds, x, y, 8);
    roomBounds = extendBounds(roomBounds, x + w, y + h, 8);
  });

  if (hasBounds(roomBounds)) return roomBounds;

  let fallbackBounds = emptyBounds();
  walls.forEach((wall) => {
    fallbackBounds = extendBounds(
      fallbackBounds,
      pctToPx(wall.x1, DESIGN.width),
      pctToPx(wall.y1, DESIGN.height),
      Number(wall.thickness) || DEFAULT_WALL_THICKNESS,
    );
    if (wall.kind === "curve") {
      fallbackBounds = extendBounds(
        fallbackBounds,
        pctToPx(wall.cx, DESIGN.width),
        pctToPx(wall.cy, DESIGN.height),
        Number(wall.thickness) || DEFAULT_WALL_THICKNESS,
      );
    }
    fallbackBounds = extendBounds(
      fallbackBounds,
      pctToPx(wall.x2, DESIGN.width),
      pctToPx(wall.y2, DESIGN.height),
      Number(wall.thickness) || DEFAULT_WALL_THICKNESS,
    );
  });
  roomLabels.forEach((label) => {
    fallbackBounds = extendBounds(
      fallbackBounds,
      pctToPx(label.x, DESIGN.width),
      pctToPx(label.y, DESIGN.height),
      40,
    );
  });
  points.forEach((point) => {
    fallbackBounds = extendBounds(
      fallbackBounds,
      pctToPx(point.x, DESIGN.width),
      pctToPx(point.y, DESIGN.height),
      POINT_SIZE,
    );
  });
  routes.forEach((route) => {
    (route.path || []).forEach((node) => {
      fallbackBounds = extendBounds(
        fallbackBounds,
        pctToPx(node.x, DESIGN.width),
        pctToPx(node.y, DESIGN.height),
        12,
      );
    });
  });

  return hasBounds(fallbackBounds) ? fallbackBounds : null;
};

const snapDesignValue = (value) => Math.round(value / ARCHITECTURAL_GRID) * ARCHITECTURAL_GRID;

const quadraticPoint = (start, control, end, position) => {
  const inverse = 1 - position;
  return {
    x: inverse * inverse * start.x + 2 * inverse * position * control.x + position * position * end.x,
    y: inverse * inverse * start.y + 2 * inverse * position * control.y + position * position * end.y,
  };
};

const quadraticTangent = (start, control, end, position) => ({
  x: 2 * (1 - position) * (control.x - start.x) + 2 * position * (end.x - control.x),
  y: 2 * (1 - position) * (control.y - start.y) + 2 * position * (end.y - control.y),
});

const wallGeometry = (wall, width = DESIGN.width, height = DESIGN.height) => {
  const x1 = pctToPx(wall.x1, width);
  const y1 = pctToPx(wall.y1, height);
  const x2 = pctToPx(wall.x2, width);
  const y2 = pctToPx(wall.y2, height);
  const cx = wall.kind === "curve" ? pctToPx(wall.cx, width) : (x1 + x2) / 2;
  const cy = wall.kind === "curve" ? pctToPx(wall.cy, height) : (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const start = { x: x1, y: y1 };
  const control = { x: cx, y: cy };
  const end = { x: x2, y: y2 };
  let length = 0;
  let previous = start;
  const segments = wall.kind === "curve" ? 32 : 1;
  for (let index = 1; index <= segments; index += 1) {
    const current = wall.kind === "curve"
      ? quadraticPoint(start, control, end, index / segments)
      : end;
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
    previous = current;
  }
  length = Math.max(1, length);
  return {
    x1,
    y1,
    x2,
    y2,
    cx,
    cy,
    dx,
    dy,
    length,
    ux: dx / length,
    uy: dy / length,
    nx: -dy / length,
    ny: dx / length,
    angle: Math.atan2(dy, dx) * 180 / Math.PI,
  };
};

const wallPointAt = (wall, position) => {
  const geometry = wallGeometry(wall);
  if (wall.kind !== "curve") {
    return {
      x: geometry.x1 + geometry.dx * position,
      y: geometry.y1 + geometry.dy * position,
    };
  }
  return quadraticPoint(
    { x: geometry.x1, y: geometry.y1 },
    { x: geometry.cx, y: geometry.cy },
    { x: geometry.x2, y: geometry.y2 },
    position,
  );
};

const wallTangentAt = (wall, position) => {
  const geometry = wallGeometry(wall);
  const tangent = wall.kind === "curve"
    ? quadraticTangent(
      { x: geometry.x1, y: geometry.y1 },
      { x: geometry.cx, y: geometry.cy },
      { x: geometry.x2, y: geometry.y2 },
      position,
    )
    : { x: geometry.dx, y: geometry.dy };
  const length = Math.max(1, Math.hypot(tangent.x, tangent.y));
  return {
    x: tangent.x / length,
    y: tangent.y / length,
    angle: Math.atan2(tangent.y, tangent.x) * 180 / Math.PI,
  };
};

const wallBezierPoints = (wall) => {
  const geometry = wallGeometry(wall);
  if (wall.kind !== "curve") return [geometry.x1, geometry.y1, geometry.x2, geometry.y2];
  const c1x = geometry.x1 + (geometry.cx - geometry.x1) * 2 / 3;
  const c1y = geometry.y1 + (geometry.cy - geometry.y1) * 2 / 3;
  const c2x = geometry.x2 + (geometry.cx - geometry.x2) * 2 / 3;
  const c2y = geometry.y2 + (geometry.cy - geometry.y2) * 2 / 3;
  return [geometry.x1, geometry.y1, c1x, c1y, c2x, c2y, geometry.x2, geometry.y2];
};

function WallDimensionLabel({
  wall,
  scalePxPerMeter,
  selected = false,
  disabled = false,
  onSelectDimension,
  onEditDimension,
  onUpdateDimension,
}) {
  const measurementScale = normalizeScalePxPerMeter(scalePxPerMeter);
  const geometry = wallGeometry(wall);
  const lengthMeters = geometry.length / measurementScale;
  if (lengthMeters < 0.05) return null;

  const label = formatMeters(lengthMeters);
  const fontSize = clamp(Number(wall.dimensionLabelFontSize) || DEFAULT_WALL_DIMENSION_LABEL.fontSize, 7, 18);
  const fillColor = wall.dimensionLabelFill || DEFAULT_WALL_DIMENSION_LABEL.fill;
  const strokeColor = wall.dimensionLabelStroke || DEFAULT_WALL_DIMENSION_LABEL.stroke;
  const textColor = wall.dimensionLabelColor || DEFAULT_WALL_DIMENSION_LABEL.text;
  const selectedTextColor = wall.dimensionLabelSelectedColor || DEFAULT_WALL_DIMENSION_LABEL.selectedText;
  const selectedStrokeColor = wall.dimensionLabelSelectedStroke || DEFAULT_WALL_DIMENSION_LABEL.selectedStroke;
  const thickness = clamp(Number(wall.thickness) || DEFAULT_WALL_THICKNESS, 3, 14);
  const midpoint = wall.kind === "curve"
    ? wallPointAt(wall, 0.5)
    : { x: (geometry.x1 + geometry.x2) / 2, y: (geometry.y1 + geometry.y2) / 2 };
  const tangent = wall.kind === "curve"
    ? wallTangentAt(wall, 0.5)
    : { x: geometry.ux, y: geometry.uy, angle: geometry.angle };
  const normal = { x: -tangent.y, y: tangent.x };
  const offset = thickness + 18;
  const labelX = midpoint.x + normal.x * offset;
  const labelY = midpoint.y + normal.y * offset;
  let rotation = tangent.angle;
  if (rotation > 90) rotation -= 180;
  if (rotation < -90) rotation += 180;
  const labelWidth = Math.max(44, label.length * fontSize * 0.68 + 14);
  const labelHeight = Math.max(16, fontSize + 8);
  const labelDx = Number(wall.dimensionLabelDx) || 0;
  const labelDy = Number(wall.dimensionLabelDy) || 0;
  const start = {
    x: geometry.x1 + normal.x * offset,
    y: geometry.y1 + normal.y * offset,
  };
  const end = {
    x: geometry.x2 + normal.x * offset,
    y: geometry.y2 + normal.y * offset,
  };
  const handleSelect = (event) => {
    if (disabled) return;
    event.cancelBubble = true;
    onSelectDimension?.(wall.id);
  };
  const handleEdit = (event) => {
    if (disabled) return;
    event.cancelBubble = true;
    const value = window.prompt("Comprimento da parede em metros", String(Number(lengthMeters.toFixed(2))).replace(".", ","));
    if (value === null) return;
    const nextMeters = Number(String(value).replace(",", "."));
    if (!Number.isFinite(nextMeters) || nextMeters <= 0) return;
    onEditDimension?.(wall.id, nextMeters);
  };

  return (
    <Group
      name="wall-dimension"
      listening={!disabled}
      onClick={handleSelect}
      onTap={handleSelect}
      onDblClick={handleEdit}
      onDblTap={handleEdit}
    >
      {wall.kind !== "curve" && geometry.length > 34 && (
        <>
          <Line
            points={[start.x, start.y, end.x, end.y]}
            stroke="#00d8b8"
            strokeWidth={0.9}
            dash={[6, 5]}
            opacity={0.72}
          />
          {[start, end].map((point, index) => (
            <Line
              key={`${wall.id}-dimension-tick-${index}`}
              points={[
                point.x - normal.x * 6,
                point.y - normal.y * 6,
                point.x + normal.x * 6,
                point.y + normal.y * 6,
              ]}
              stroke="#00d8b8"
              strokeWidth={0.9}
              opacity={0.72}
            />
          ))}
        </>
      )}
      <Group
        x={labelX + labelDx}
        y={labelY + labelDy}
        rotation={rotation}
        draggable={!disabled}
        onMouseDown={(event) => {
          if (!disabled) event.cancelBubble = true;
        }}
        onTouchStart={(event) => {
          if (!disabled) event.cancelBubble = true;
        }}
        onClick={handleSelect}
        onTap={handleSelect}
        onDblClick={handleEdit}
        onDblTap={handleEdit}
        onDragStart={(event) => {
          if (disabled) return;
          event.cancelBubble = true;
          onSelectDimension?.(wall.id);
        }}
        onDragMove={(event) => {
          event.cancelBubble = true;
        }}
        onDragEnd={(event) => {
          if (disabled) return;
          event.cancelBubble = true;
          onUpdateDimension?.(wall.id, {
            dimensionLabelDx: event.target.x() - labelX,
            dimensionLabelDy: event.target.y() - labelY,
          });
        }}
      >
        <Rect
          x={-labelWidth / 2}
          y={-labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          fill={fillColor}
          stroke={selected ? selectedStrokeColor : strokeColor}
          strokeWidth={selected ? 1.4 : 0.8}
          cornerRadius={3}
          opacity={0.96}
        />
        <Text
          x={-labelWidth / 2}
          y={-fontSize / 2 - 1}
          width={labelWidth}
          align="center"
          text={label}
          fontFamily="Arial"
          fontSize={fontSize}
          fontStyle="bold"
          fill={selected ? selectedTextColor : textColor}
        />
      </Group>
    </Group>
  );
}

const projectPointToWall = (x, y, wall) => {
  const geometry = wallGeometry(wall);
  if (wall.kind === "curve") {
    const segments = 48;
    let best = null;
    for (let index = 0; index < segments; index += 1) {
      const startPosition = index / segments;
      const endPosition = (index + 1) / segments;
      const start = wallPointAt(wall, startPosition);
      const end = wallPointAt(wall, endPosition);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy;
      const segmentPosition = lengthSquared > 0
        ? clamp(((x - start.x) * dx + (y - start.y) * dy) / lengthSquared, 0, 1)
        : 0;
      const projectedX = start.x + dx * segmentPosition;
      const projectedY = start.y + dy * segmentPosition;
      const distance = Math.hypot(x - projectedX, y - projectedY);
      if (!best || distance < best.distance) {
        best = {
          position: startPosition + (endPosition - startPosition) * segmentPosition,
          projectedX,
          projectedY,
          distance,
        };
      }
    }
    return { ...geometry, ...best };
  }
  const lengthSquared = geometry.dx * geometry.dx + geometry.dy * geometry.dy;
  const rawPosition = lengthSquared > 0
    ? ((x - geometry.x1) * geometry.dx + (y - geometry.y1) * geometry.dy) / lengthSquared
    : 0.5;
  const position = clamp(rawPosition, 0, 1);
  const projectedX = geometry.x1 + geometry.dx * position;
  const projectedY = geometry.y1 + geometry.dy * position;
  return {
    ...geometry,
    position,
    projectedX,
    projectedY,
    distance: Math.hypot(x - projectedX, y - projectedY),
  };
};

const HOUSE_TEMPLATE_ROOMS = [
  { id: "sala", label: "Sala", area: "8,85 m2", x: 45, y: 7, w: 28, h: 31, hasLamp: true, hasAC: true },
  { id: "cozinha", label: "Cozinha", area: "5,45 m2", x: 45, y: 38, w: 14, h: 25, hasLamp: true },
  { id: "banho", label: "Banho", area: "2,40 m2", x: 59, y: 38, w: 14, h: 25, hasLamp: true },
  { id: "area", label: "Area", area: "3,30 m2", x: 45, y: 63, w: 14, h: 20, hasLamp: true },
  { id: "quarto-1", label: "Quarto", area: "7,10 m2", x: 18, y: 7, w: 27, h: 40, hasLamp: true, hasAC: true },
  { id: "quarto-2", label: "Quarto", area: "6,70 m2", x: 18, y: 47, w: 27, h: 36, hasLamp: true },
  { id: "circulacao", label: "Circulacao", area: "2,75 m2", x: 45, y: 63, w: 28, h: 9, hasLamp: true },
];

const DEFAULT_KONVA_POINTS = [
  { type: "tug", label: "1", x: 23, y: 15, load_w: 200 },
  { type: "luminaria", label: "a", x: 32, y: 33, load_w: 100 },
  { type: "interruptor", label: "a", x: 38, y: 39 },
  { type: "tug", label: "2", x: 23, y: 74, load_w: 200 },
  { type: "luminaria", label: "a", x: 32, y: 65, load_w: 100 },
  { type: "qe", label: "QD", x: 52, y: 66 },
  { type: "tug", label: "3", x: 63, y: 75, load_w: 600 },
  { type: "luminaria", label: "b", x: 64, y: 55, load_w: 100 },
  { type: "interruptor", label: "b", x: 69, y: 63 },
  { type: "chuveiro", label: "5", x: 69, y: 21, load_w: 4400 },
  { type: "tue", label: "4", x: 63, y: 15, load_w: 600 },
];

export const createKonvaHouseTemplate = () => ({
  rooms: HOUSE_TEMPLATE_ROOMS,
  points: DEFAULT_KONVA_POINTS.map((point, index) => ({
    id: `template-point-${index + 1}`,
    label: point.label,
    circuit: null,
    room: "",
    ...point,
  })),
  routes: [],
});

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 900, height: 580 });

  useEffect(() => {
    if (!ref.current) return undefined;
    const update = () => {
      const rect = ref.current.getBoundingClientRect();
      setSize({
        width: Math.max(360, rect.width),
        height: Math.max(420, rect.height),
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function useLoadedImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return undefined;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return image;
}

function GridLayer({ width, height }) {
  const major = 80;
  const minor = 20;
  const lines = [];

  for (let x = 0; x <= width; x += minor) {
    const isMajor = x % major === 0;
    lines.push(
      <Line
        key={`vx-${x}`}
        points={[x, 0, x, height]}
        stroke={isMajor ? MAJOR_GRID : PAPER_GRID}
        strokeWidth={isMajor ? 0.55 : 0.28}
        listening={false}
      />
    );
  }
  for (let y = 0; y <= height; y += minor) {
    const isMajor = y % major === 0;
    lines.push(
      <Line
        key={`hy-${y}`}
        points={[0, y, width, y]}
        stroke={isMajor ? MAJOR_GRID : PAPER_GRID}
        strokeWidth={isMajor ? 0.55 : 0.28}
        listening={false}
      />
    );
  }

  return <>{lines}</>;
}

function RoomBaseShape({
  room,
  width,
  height,
  active,
  onSelect,
  onUpdateRoom,
  onAlignPosition,
  onClearAlignment,
  draggable = true,
  onHover,
}) {
  if (!room) return null;
  const x = pctToPx(room.x || 0, width) || 0;
  const y = pctToPx(room.y || 0, height) || 0;
  const w = pctToPx(room.w || 10, width) || 100;
  const h = pctToPx(room.h || 10, height) || 100;

  return (
    <Group
      name="room"
      x={x}
      y={y}
      rotation={room.rotation || 0}
      draggable={draggable}
      onClick={(event) => {
        if (!onSelect) return;
        event.cancelBubble = true;
        onSelect?.({ type: "room", id: room.id });
      }}
      onTap={(event) => {
        if (!onSelect) return;
        event.cancelBubble = true;
        onSelect?.({ type: "room", id: room.id });
      }}
      onDragStart={() => {
        if (!onSelect) return;
        onSelect?.({ type: "room", id: room.id });
      }}
      onDragEnd={(event) => {
        onClearAlignment?.();
        onUpdateRoom?.(room.id, {
          x: pxToPct(event.target.x(), width),
          y: pxToPct(event.target.y(), height),
        });
      }}
      onDragMove={(event) => {
        const aligned = onAlignPosition?.({
          x: event.target.x(),
          y: event.target.y(),
          type: "room",
          id: room.id,
        });
        if (aligned) event.target.position(aligned);
      }}
      onMouseEnter={() => onHover?.(room.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Rect
        name="room"
        width={w}
        height={h}
        fill={room.fill || "#ffffff"}
        stroke={TECH_BLACK}
        strokeWidth={DEFAULT_WALL_THICKNESS}
      />
      {active && (
        <Rect
          x={-10}
          y={-10}
          width={w + 20}
          height={h + 20}
          stroke="#00d8b8"
          strokeWidth={1.5}
          dash={[10, 6]}
        />
      )}
      <Text
        x={12}
        y={12}
        width={Math.max(50, w - 24)}
        text={room.label || "Cômodo"}
        fontFamily="Arial"
        fontSize={18}
        fontStyle="bold"
        fill="#0F172A"
      />
      <Text
        x={12}
        y={Math.max(20, h - 24)}
        width={Math.max(50, w - 24)}
        text={room.area || ""}
        fontFamily="Arial"
        fontSize={13}
        fill="#64748B"
      />
    </Group>
  );
}

function RoomOpeningShape({ room, width, height }) {
  if (!room) return null;
  const x = pctToPx(room.x || 0, width) || 0;
  const y = pctToPx(room.y || 0, height) || 0;
  const w = pctToPx(room.w || 10, width) || 100;
  const h = pctToPx(room.h || 10, height) || 100;

  const doors = room.doors || { top: true, bottom: false, left: false, right: false };
  const windows = room.windows || { top: false, bottom: false, left: false, right: true };

  const wallGapWidth = DEFAULT_WALL_THICKNESS + 5;
  const doorSizeW = Math.max(1, Math.min(48, w * 0.2));
  const doorSizeH = Math.max(1, Math.min(48, h * 0.16));

  return (
    <Group x={x} y={y} rotation={room.rotation || 0} listening={false}>
      {/* --- PORTAS --- */}
      {doors.top && (
        <Group>
          <Line points={[w * 0.48, 0, w * 0.68, 0]} stroke="#ffffff" strokeWidth={wallGapWidth} />
          <Arc x={w * 0.48} y={0} innerRadius={0} outerRadius={doorSizeW} angle={82} rotation={0} stroke={TECH_BLACK} strokeWidth={1} />
          <Line points={[w * 0.48, 0, w * 0.48, doorSizeW]} stroke={TECH_BLACK} strokeWidth={1} />
        </Group>
      )}
      {doors.bottom && (
        <Group>
          <Line points={[w * 0.48, h, w * 0.68, h]} stroke="#ffffff" strokeWidth={wallGapWidth} />
          <Arc x={w * 0.48} y={h} innerRadius={0} outerRadius={doorSizeW} angle={82} rotation={270} stroke={TECH_BLACK} strokeWidth={1} />
          <Line points={[w * 0.48, h, w * 0.48, h - doorSizeW]} stroke={TECH_BLACK} strokeWidth={1} />
        </Group>
      )}
      {doors.left && (
        <Group>
          <Line points={[0, h * 0.42, 0, h * 0.58]} stroke="#ffffff" strokeWidth={wallGapWidth} />
          <Arc x={0} y={h * 0.42} innerRadius={0} outerRadius={doorSizeH} angle={82} rotation={90} stroke={TECH_BLACK} strokeWidth={1} />
          <Line points={[0, h * 0.42, doorSizeH, h * 0.42]} stroke={TECH_BLACK} strokeWidth={1} />
        </Group>
      )}
      {doors.right && (
        <Group>
          <Line points={[w, h * 0.42, w, h * 0.58]} stroke="#ffffff" strokeWidth={wallGapWidth} />
          <Arc x={w} y={h * 0.42} innerRadius={0} outerRadius={doorSizeH} angle={82} rotation={180} stroke={TECH_BLACK} strokeWidth={1} />
          <Line points={[w, h * 0.42, w - doorSizeH, h * 0.42]} stroke={TECH_BLACK} strokeWidth={1} />
        </Group>
      )}

      {/* --- JANELAS --- */}
      {windows.top && (
        <Group>
          <Line points={[w * 0.4, 0, w * 0.7, 0]} stroke="#ffffff" strokeWidth={wallGapWidth} />
          <Rect x={w * 0.4} y={-3} width={w * 0.3} height={6} fill="#ffffff" stroke={TECH_BLACK} strokeWidth={1.2} />
          <Line points={[w * 0.4, 0, w * 0.7, 0]} stroke={TECH_BLACK} strokeWidth={0.8} />
        </Group>
      )}
      {windows.bottom && (
        <Group>
          <Line points={[w * 0.4, h, w * 0.7, h]} stroke="#ffffff" strokeWidth={wallGapWidth} />
          <Rect x={w * 0.4} y={h - 3} width={w * 0.3} height={6} fill="#ffffff" stroke={TECH_BLACK} strokeWidth={1.2} />
          <Line points={[w * 0.4, h, w * 0.7, h]} stroke={TECH_BLACK} strokeWidth={0.8} />
        </Group>
      )}
      {windows.left && (
        <Group>
          <Line points={[0, h * 0.35, 0, h * 0.65]} stroke="#ffffff" strokeWidth={wallGapWidth} />
          <Rect x={-3} y={h * 0.35} width={6} height={h * 0.3} fill="#ffffff" stroke={TECH_BLACK} strokeWidth={1.2} />
          <Line points={[0, h * 0.35, 0, h * 0.65]} stroke={TECH_BLACK} strokeWidth={0.8} />
        </Group>
      )}
      {windows.right && (
        <Group>
          <Line points={[w, h * 0.35, w, h * 0.65]} stroke="#ffffff" strokeWidth={wallGapWidth} />
          <Rect x={w - 3} y={h * 0.35} width={6} height={h * 0.3} fill="#ffffff" stroke={TECH_BLACK} strokeWidth={1.2} />
          <Line points={[w, h * 0.35, w, h * 0.65]} stroke={TECH_BLACK} strokeWidth={0.8} />
        </Group>
      )}

      {/* --- LÂMPADA DE TETO --- */}
      {room.hasLamp && (
        <Group x={w / 2} y={h / 2}>
          <Circle radius={13} stroke={TECH_BLACK} strokeWidth={1.3} fill="#ffffff" />
          <Line points={[-9, -9, 9, 9]} stroke={TECH_BLACK} strokeWidth={1} />
          <Line points={[-9, 9, 9, -9]} stroke={TECH_BLACK} strokeWidth={1} />
          <Circle radius={3.5} fill={TECH_BLACK} />
        </Group>
      )}

      {/* --- AR CONDICIONADO (SPLIT) --- */}
      {room.hasAC && (
        <Group x={Math.max(0, w / 2 - 20)} y={6}>
          <Rect width={40} height={12} fill="#ffffff" stroke={TECH_BLACK} strokeWidth={1.3} cornerRadius={1.5} />
          <Line points={[3, 9, 37, 9]} stroke={TECH_BLACK} strokeWidth={0.8} />
          <Line points={[10, 15, 8, 20]} stroke="#64748B" strokeWidth={0.8} opacity={0.6} />
          <Line points={[20, 15, 20, 21]} stroke="#64748B" strokeWidth={0.8} opacity={0.6} />
          <Line points={[30, 15, 32, 20]} stroke="#64748B" strokeWidth={0.8} opacity={0.6} />
        </Group>
      )}
    </Group>
  );
}

const pointStrokeColor = (type, point = {}) => {
  if (point.color) return point.color;
  const system = String(point.systemType || point.system_type || point.system || "").toLowerCase();
  if ((type === "caixa" || type === "rack-cftv") && system.includes("tele")) return "#2563eb";
  if ((type === "caixa" || type === "rack-cftv") && system.includes("ele")) return TECH_BLACK;
  return TOOL_TYPES.find((tool) => tool.id === type)?.color || TECH_BLACK;
};

function PlantSymbolKonva({ type, point = {} }) {
  const stroke = pointStrokeColor(type, point);
  const base = { stroke, strokeWidth: 1.8, lineCap: "round", lineJoin: "round" };
  const height = point.height || "baixa";

  if (type === "arandela") {
    return (
      <>
        <Line points={[-7, -12, -7, 12]} {...base} />
        <Arc x={-7} y={0} innerRadius={0} outerRadius={11} angle={180} rotation={-90} stroke={stroke} strokeWidth={1.8} />
        <Line points={[-15, 0, -7, 0]} {...base} strokeWidth={1.3} />
      </>
    );
  }

  if (type === "spot") {
    return (
      <>
        <Rect x={-15} y={-9} width={30} height={18} stroke={stroke} strokeWidth={1.8} fill="#ffffff" />
        <Circle radius={6.8} stroke={stroke} strokeWidth={1.4} fill="#ffffff" />
      </>
    );
  }

  if (type === "luminaria") {
    return <Circle radius={11} stroke={stroke} strokeWidth={1.8} fill="#ffffff" />;
  }

  if (type === "interruptor" || type === "inter2" || type === "inter3" || type === "inter3way") {
    return (
      <>
        <Circle radius={9} stroke={stroke} strokeWidth={1.8} fill={type === "inter3way" ? stroke : "#ffffff"} />
        {type === "inter2" && <Line points={[-8, 0, 8, 0]} {...base} strokeWidth={1.4} />}
        {type === "inter3" && (
          <>
            <Line points={[-6, -6, 6, 6]} {...base} strokeWidth={1.4} />
            <Line points={[6, -6, -6, 6]} {...base} strokeWidth={1.4} />
          </>
        )}
        {type === "inter3way" && <Line points={[-6, 0, 6, 0]} stroke="#ffffff" strokeWidth={1.5} lineCap="round" />}
      </>
    );
  }

  if (type === "tue" || type === "tug") {
    return (
      <>
        <Line points={[-18, 0, -7, 0]} {...base} strokeWidth={type === "tue" ? 1.8 : 1.3} />
        
        {height === "baixa" && (
          <Line points={[-7, -9, 15, 0, -7, 9]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.8} lineJoin="round" />
        )}
        
        {height === "media" && (
          <>
            <Line points={[-7, -9, 15, 0, -7, 9]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.8} lineJoin="round" />
            <Line points={[-7, 0, 15, 0, -7, 9]} closed fill={stroke} stroke={stroke} strokeWidth={0} />
            <Line points={[-7, -9, 15, 0, -7, 9]} closed stroke={stroke} strokeWidth={1.8} lineJoin="round" />
          </>
        )}

        {(height === "alta" || height === "teto") && (
          <Line points={[-7, -9, 15, 0, -7, 9]} closed fill={stroke} stroke={stroke} strokeWidth={1.8} lineJoin="round" />
        )}

        {height === "piso" && (
          <Group>
            <Rect x={-11} y={-13} width={30} height={26} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
            <Line points={[-7, -9, 15, 0, -7, 9]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.5} lineJoin="round" />
          </Group>
        )}
      </>
    );
  }

  if (type === "arcond") {
    return (
      <>
        <Rect x={-17} y={-10} width={34} height={18} cornerRadius={3} fill="#ffffff" stroke={stroke} strokeWidth={1.8} />
        <Line points={[-12, 1, 12, 1]} stroke={stroke} strokeWidth={1.2} lineCap="round" />
        <Line points={[-10, 9, -6, 14]} stroke={stroke} strokeWidth={1.1} lineCap="round" />
        <Line points={[0, 9, 0, 15]} stroke={stroke} strokeWidth={1.1} lineCap="round" />
        <Line points={[10, 9, 6, 14]} stroke={stroke} strokeWidth={1.1} lineCap="round" />
        <Circle x={10} y={-4} radius={2} fill={stroke} />
      </>
    );
  }

  if (type === "chuveiro") {
    return (
      <>
        {height === "baixa" && (
          <Line points={[-18, -10, 18, 0, -18, 10]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.8} lineJoin="round" />
        )}
        {height === "media" && (
          <>
            <Line points={[-18, -10, 18, 0, -18, 10]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.8} lineJoin="round" />
            <Line points={[-18, 0, 18, 0, -18, 10]} closed fill={stroke} stroke={stroke} strokeWidth={0} />
            <Line points={[-18, -10, 18, 0, -18, 10]} closed stroke={stroke} strokeWidth={1.8} lineJoin="round" />
          </>
        )}
        {(height === "alta" || height === "teto" || !height) && (
          <Line points={[-18, -10, 18, 0, -18, 10]} closed fill={stroke} stroke={stroke} strokeWidth={1.8} lineJoin="round" />
        )}
        {height === "piso" && (
          <Group>
            <Rect x={-22} y={-14} width={44} height={28} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
            <Line points={[-18, -10, 18, 0, -18, 10]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.8} lineJoin="round" />
          </Group>
        )}
        <Circle x={-6} radius={4.5} fill="#ffffff" stroke={stroke} strokeWidth={1.2} />
      </>
    );
  }

  if (type === "qgbt" || type === "qe" || type === "rack-cftv") {
    return (
      <>
        <Rect x={-14} y={-11} width={28} height={22} stroke={stroke} strokeWidth={1.8} fill="#ffffff" />
        <Line points={[-14, 11, 14, -11, 14, 11]} closed fill={stroke} stroke={stroke} strokeWidth={0} />
        {type === "qgbt" && (
          <Text x={-15} y={-17} width={30} text="QGBT" fontFamily="Arial" fontSize={5.5} fontStyle="bold" fill={stroke} align="center" />
        )}
        {type === "rack-cftv" && (
          <Text x={-15} y={-17} width={30} text="CFTV" fontFamily="Arial" fontSize={5.5} fontStyle="bold" fill={stroke} align="center" />
        )}
      </>
    );
  }

  if (type === "caixa") {
    return (
      <>
        <Rect x={-11} y={-11} width={22} height={22} stroke={stroke} strokeWidth={1.8} fill="#ffffff" />
        <Line points={[-11, -11, 11, 11]} {...base} strokeWidth={1.2} />
        <Line points={[11, -11, -11, 11]} {...base} strokeWidth={1.2} />
      </>
    );
  }

  if (type === "rede") {
    return (
      <>
        <Line points={[-12, -13, -12, 13]} {...base} />
        {height === "baixa" && (
          <Line points={[-12, -9, 15, 0, -12, 9]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.4} lineJoin="round" />
        )}
        {height === "media" && (
          <>
            <Line points={[-12, -9, 15, 0, -12, 9]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.4} lineJoin="round" />
            <Line points={[-12, 0, 15, 0, -12, 9]} closed fill={stroke} stroke={stroke} strokeWidth={0} />
            <Line points={[-12, -9, 15, 0, -12, 9]} closed stroke={stroke} strokeWidth={1.4} lineJoin="round" />
          </>
        )}
        {(height === "alta" || height === "teto" || !height) && (
          <Line points={[-12, -9, 15, 0, -12, 9]} closed fill={stroke} stroke={stroke} strokeWidth={1.4} lineJoin="round" />
        )}
        {height === "piso" && (
          <Group>
            <Rect x={-16} y={-13} width={35} height={26} fill="#ffffff" stroke={stroke} strokeWidth={1.5} />
            <Line points={[-12, -9, 15, 0, -12, 9]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.4} lineJoin="round" />
          </Group>
        )}
      </>
    );
  }

  if (type === "motor") {
    return (
      <>
        <Circle radius={12} stroke={stroke} strokeWidth={1.8} fill="#ffffff" />
        <Text x={-7} y={-8} text="M" fontFamily="Arial" fontSize={15} fontStyle="bold" fill={stroke} />
      </>
    );
  }

  if (type === "sensor") {
    return (
      <>
        <Arc x={0} y={5} innerRadius={0} outerRadius={14} angle={180} rotation={180} stroke={stroke} strokeWidth={1.8} />
        <Circle y={5} radius={4} fill={stroke} />
      </>
    );
  }

  if (type === "camera") {
    return (
      <>
        <Rect x={-15} y={-7} width={20} height={14} stroke={stroke} strokeWidth={1.8} fill="#ffffff" />
        <Line points={[5, -7, 18, -12, 18, 12, 5, 7]} closed fill="#ffffff" stroke={stroke} strokeWidth={1.4} />
      </>
    );
  }

  return <Circle radius={10} stroke={stroke} strokeWidth={1.8} fill="#ffffff" />;
}

function ElectricalPoint({
  point,
  width,
  height,
  active,
  routeToolActive = false,
  routeStart = false,
  onSelect,
  onRoutePointClick,
  onMovePoint,
  onPointDoubleClick,
  onCircuitDoubleClick,
  onCircuitLabelSelect,
  onPointLabelSelect,
  onPositionLabelSelect,
  onPowerLabelSelect,
  onHover,
  onAlignPosition,
  onClearAlignment,
  selected = false,
  selectedTextField = "",
  showPositionLabels = true,
}) {
  const x = pctToPx(point.x, width);
  const y = pctToPx(point.y, height);
  const label = point.label || SYMBOL_LABELS[point.type] || "";
  const showLabel = point.labelHidden !== true && label && String(label).length <= 8 && !PLANT_SYMBOL_LABELS[point.type]?.startsWith(label);
  const defaultHeight = point.height || defaultPointHeight(point.type);
  const installLabel = pointHeightLabel(defaultHeight);
  const circuitLabel = point.circuitLabelHidden === true
    ? ""
    : stripConduitInfo(point.circuitLabel || point.circuit || point.circuit_id || "");
  const positionLabelFontSize = clamp(Number(point.positionLabelFontSize) || DEFAULT_POSITION_LABEL.fontSize, 6, 16);
  const positionLabelText = point.positionLabelColor || DEFAULT_POSITION_LABEL.text;
  const positionLabelStroke = point.positionLabelStroke || DEFAULT_POSITION_LABEL.stroke;
  const positionLabelFill = point.positionLabelFill || DEFAULT_POSITION_LABEL.fill;
  const positionLabelWidth = Math.max(
    42,
    Number(point.positionLabelWidth) || String(installLabel).length * positionLabelFontSize * 0.68 + 18,
  );
  const positionLabelHeight = Math.max(13, positionLabelFontSize + 7);
  const positionLabelX = Number.isFinite(Number(point.positionLabelX)) ? Number(point.positionLabelX) : DEFAULT_POSITION_LABEL.x;
  const positionLabelY = Number.isFinite(Number(point.positionLabelY)) ? Number(point.positionLabelY) : DEFAULT_POSITION_LABEL.y;
  const pointRotation = Number(point.rotation) || 0;
  const showPositionLabel = showPositionLabels && point.positionLabelHidden !== true && Boolean(installLabel);
  const powerValue = Number(point.load_w) || 0;
  const powerLabel = powerValue > 0 ? `${point.load_w} VA` : "";
  const showPowerLabel = point.powerLabelHidden !== true && Boolean(powerLabel);
  const powerLabelFontSize = clamp(Number(point.powerLabelFontSize) || DEFAULT_POWER_LABEL.fontSize, 6, 16);
  const powerLabelColor = point.powerLabelColor || DEFAULT_POWER_LABEL.text;
  const powerLabelWidth = Math.max(
    42,
    Number(point.powerLabelWidth) || Math.max(DEFAULT_POWER_LABEL.width, powerLabel.length * powerLabelFontSize * 0.64 + 8),
  );
  const powerLabelHeight = Math.max(12, powerLabelFontSize + 5);
  const powerLabelX = Number.isFinite(Number(point.powerLabelX)) ? Number(point.powerLabelX) : DEFAULT_POWER_LABEL.x;
  const powerLabelY = Number.isFinite(Number(point.powerLabelY)) ? Number(point.powerLabelY) : DEFAULT_POWER_LABEL.y;

  const ReadableText = (props) => {
    const { counterRotate = true, ...textProps } = props;
    const align = props.align || "center";
    if (!counterRotate) return <Text {...textProps} align={align} />;
    const w = props.width || 0;
    const h = props.fontSize || 10;
    const cx = (props.x || 0) + w / 2;
    const cy = (props.y || 0) + h / 2;
    return (
      <Group x={cx} y={cy} rotation={-pointRotation}>
        <Text {...textProps} x={-w / 2} y={-h / 2} align={align} />
      </Group>
    );
  };

  return (
    <Group
      x={x}
      y={y}
      rotation={point.rotation || 0}
      draggable={!routeToolActive}
      onClick={(event) => {
        event.cancelBubble = true;
        if (routeToolActive) {
          onRoutePointClick?.(point);
          return;
        }
        onSelect?.({ type: "point", id: point.id });
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        if (routeToolActive) {
          onRoutePointClick?.(point);
          return;
        }
        onSelect?.({ type: "point", id: point.id });
      }}
      onDragStart={() => {
        if (!routeToolActive) onSelect?.({ type: "point", id: point.id });
      }}
      onMouseEnter={() => onHover(point.id)}
      onMouseLeave={() => onHover(null)}
      onDblClick={(event) => {
        event.cancelBubble = true;
        if (routeToolActive) return;
        onPointDoubleClick?.(point.id);
      }}
      onDblTap={(event) => {
        event.cancelBubble = true;
        if (routeToolActive) return;
        onPointDoubleClick?.(point.id);
      }}
      onDragEnd={(event) => {
        onClearAlignment?.();
        onMovePoint?.(point.id, {
          x: pxToPct(event.target.x(), width),
          y: pxToPct(event.target.y(), height),
        });
      }}
      onDragMove={(event) => {
        const aligned = onAlignPosition?.({
          x: event.target.x(),
          y: event.target.y(),
          type: "point",
          id: point.id,
        });
        if (aligned) event.target.position(aligned);
      }}
    >
      {(active || routeStart) && (
        <Rect
          x={selected ? -23 : -18}
          y={selected ? -23 : -18}
          width={selected ? 46 : 36}
          height={selected ? 46 : 36}
          fill={routeStart ? "rgba(0,100,166,0.08)" : "transparent"}
          stroke={routeStart ? "#00d8b8" : "#00d8b8"}
          strokeWidth={routeStart || selected ? 2 : 1.5}
          dash={routeStart ? [3, 3] : selected ? [8, 5] : [4, 4]}
        />
      )}
      {selected && !routeToolActive && (
        <>
          {[[-23, -23], [19, -23], [19, 19], [-23, 19]].map(([hx, hy], index) => (
            <Rect
              key={`selector-handle-${index}`}
              x={hx}
              y={hy}
              width={4}
              height={4}
              fill="#ffffff"
              stroke="#00d8b8"
              strokeWidth={1.2}
            />
          ))}
        </>
      )}
      <PlantSymbolKonva type={point.type} point={point} />
      {showLabel && (
        <Group
          onMouseDown={(event) => { event.cancelBubble = true; }}
          onTouchStart={(event) => { event.cancelBubble = true; }}
          onClick={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onPointLabelSelect?.(point.id);
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onPointLabelSelect?.(point.id);
          }}
        >
          {selectedTextField === "label" && (
            <Rect
              x={11}
              y={-24}
              width={58}
              height={14}
              fill="#ffffff"
              stroke="#00d8b8"
              strokeWidth={1}
              dash={[4, 3]}
            />
          )}
          <ReadableText
            x={14}
            y={-21}
            width={52}
            text={label}
            fontFamily="Arial"
            fontSize={9}
            fill={TECH_BLACK}
          />
        </Group>
      )}
      {circuitLabel && (
        <Group
          x={point.circuit_dx ?? 14}
          y={point.circuit_dy ?? -35}
          rotation={-pointRotation}
          draggable={!routeToolActive}
          onMouseDown={(event) => {
            event.cancelBubble = true;
          }}
          onTouchStart={(event) => {
            event.cancelBubble = true;
          }}
          onClick={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onCircuitLabelSelect?.(point.id);
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onCircuitLabelSelect?.(point.id);
          }}
          onDragStart={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onCircuitLabelSelect?.(point.id);
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            onMovePoint?.(point.id, {
              circuit_dx: event.target.x(),
              circuit_dy: event.target.y(),
            });
          }}
          onDragMove={(event) => {
            event.cancelBubble = true;
          }}
          onDblClick={(event) => {
            event.cancelBubble = true;
            if (routeToolActive) return;
            if (onCircuitDoubleClick) {
              onCircuitDoubleClick(point.id);
            } else {
              onPointDoubleClick?.(point.id);
            }
          }}
          onDblTap={(event) => {
            event.cancelBubble = true;
            if (routeToolActive) return;
            if (onCircuitDoubleClick) {
              onCircuitDoubleClick(point.id);
            } else {
              onPointDoubleClick?.(point.id);
            }
          }}
        >
          {selectedTextField === "circuitLabel" && (
            <Rect
              x={-3}
              y={-3}
              width={122}
              height={14}
              fill="#ffffff"
              stroke="#00d8b8"
              strokeWidth={1}
              dash={[4, 3]}
            />
          )}
          <ReadableText
            x={0}
            y={0}
            width={116}
            text={String(circuitLabel).slice(0, 24)}
            fontFamily="Arial"
            fontSize={8}
            fontStyle="bold"
            fill={TECH_BLACK}
            counterRotate={false}
          />
        </Group>
      )}
      {showPowerLabel && (
        <Group
          x={powerLabelX}
          y={powerLabelY}
          rotation={-pointRotation}
          draggable={!routeToolActive}
          onMouseDown={(event) => {
            event.cancelBubble = true;
          }}
          onTouchStart={(event) => {
            event.cancelBubble = true;
          }}
          onClick={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onPowerLabelSelect?.(point.id);
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onPowerLabelSelect?.(point.id);
          }}
          onDragStart={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onPowerLabelSelect?.(point.id);
          }}
          onDragMove={(event) => {
            event.cancelBubble = true;
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            if (routeToolActive) return;
            onMovePoint?.(point.id, {
              powerLabelX: event.target.x(),
              powerLabelY: event.target.y(),
            });
          }}
        >
          {selectedTextField === "powerLabel" && (
            <Rect
              x={-3}
              y={-3}
              width={powerLabelWidth + 6}
              height={powerLabelHeight + 2}
              fill="#ffffff"
              stroke="#00d8b8"
              strokeWidth={1}
              dash={[4, 3]}
            />
          )}
          <Text
            x={0}
            y={0}
            width={powerLabelWidth}
            height={powerLabelHeight}
            text={powerLabel}
            fontFamily="Arial"
            fontSize={powerLabelFontSize}
            fontStyle="bold"
            fill={powerLabelColor}
            align="center"
          />
        </Group>
      )}
      {showPositionLabel && (
        <Group
          x={positionLabelX}
          y={positionLabelY}
          rotation={-pointRotation}
          draggable={!routeToolActive}
          onMouseDown={(event) => {
            event.cancelBubble = true;
          }}
          onTouchStart={(event) => {
            event.cancelBubble = true;
          }}
          onClick={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onPositionLabelSelect?.(point.id);
          }}
          onTap={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onPositionLabelSelect?.(point.id);
          }}
          onDragStart={(event) => {
            event.cancelBubble = true;
            if (!routeToolActive) onPositionLabelSelect?.(point.id);
          }}
          onDragMove={(event) => {
            event.cancelBubble = true;
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            if (routeToolActive) return;
            onMovePoint?.(point.id, {
              positionLabelX: event.target.x(),
              positionLabelY: event.target.y(),
            });
          }}
        >
          <Rect
            x={0}
            y={0}
            width={positionLabelWidth}
            height={positionLabelHeight}
            fill={positionLabelFill}
            stroke={selectedTextField === "positionLabel" ? "#00d8b8" : positionLabelStroke}
            strokeWidth={selectedTextField === "positionLabel" ? 1.2 : 0.5}
            dash={selectedTextField === "positionLabel" ? [4, 3] : undefined}
            cornerRadius={2}
            opacity={0.94}
          />
          <ReadableText
            x={0}
            y={(positionLabelHeight - positionLabelFontSize) / 2 - 0.5}
            width={positionLabelWidth}
            text={installLabel}
            fontFamily="Arial"
            fontSize={positionLabelFontSize}
            fontStyle="bold"
            fill={positionLabelText}
            counterRotate={false}
          />
        </Group>
      )}
    </Group>
  );
}

function EditorToolbar({
  activeTool,
  architectureTool = "",
  routeToolActive = false,
  selectedElement,
  zoom,
  scalePxPerMeter,
  showWallDimensions = true,
  showDeviceDimensions = false,
  showPositionLabels = true,
  canUndo,
  canRedo,
  onSelectTool,
  onSelectArchitectureTool,
  onSelectMode,
  onAddRoom,
  toolsPanelOpen = false,
  onToggleToolsPanel,
  onZoomChange,
  onScalePxPerMeterChange,
  onToggleWallDimensions,
  onToggleDeviceDimensions,
  onTogglePositionLabels,
  onFit,
  onRotateSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onUndo,
  onRedo,
}) {
  const hasSelection = Boolean(selectedElement?.id);
  const normalizedScalePxPerMeter = normalizeScalePxPerMeter(scalePxPerMeter);
  const [scaleInput, setScaleInput] = useState(String(Math.round(normalizedScalePxPerMeter)));
  const toolButton = "flex h-8 w-8 shrink-0 items-center justify-center border border-[#BCEEE5] bg-white text-[#0f4f49] shadow-sm transition hover:border-[#00d8b8] hover:bg-[#F2FFFC] disabled:cursor-not-allowed disabled:opacity-40";
  const symbolButton = "flex h-8 w-8 shrink-0 items-center justify-center border border-[#BCEEE5] bg-white shadow-sm transition hover:border-[#00d8b8] hover:bg-[#F2FFFC]";
  const activeButton = "border-[#00d8b8] bg-[#E6FFFA] text-[#00a58f]";
  const toolbarGroup = "flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[#CDEFE8] bg-[#F8FBFD] p-1";

  useEffect(() => {
    setScaleInput(String(Math.round(normalizedScalePxPerMeter)));
  }, [normalizedScalePxPerMeter]);

  const commitScaleInput = () => {
    const nextScale = normalizeScalePxPerMeter(scaleInput);
    setScaleInput(String(Math.round(nextScale)));
    onScalePxPerMeterChange?.(nextScale);
  };

  const ButtonIcon = ({ title, disabled = false, active = false, onClick, children }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`${toolButton} ${active ? activeButton : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div
      data-html2canvas-ignore="true"
      className="absolute left-3 right-3 top-3 z-20 flex flex-nowrap items-center gap-2 overflow-x-auto rounded-[12px] border border-[#BCEEE5] bg-white/95 p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.14)] backdrop-blur"
    >
      {onToggleToolsPanel && (
        <button
          type="button"
          title={toolsPanelOpen ? "Fechar ferramentas" : "Abrir ferramentas"}
          aria-label={toolsPanelOpen ? "Fechar ferramentas" : "Abrir ferramentas"}
          onClick={onToggleToolsPanel}
          className={`flex h-8 shrink-0 items-center gap-2 rounded-[9px] border px-2.5 text-[11px] font-black shadow-sm transition hover:border-[#00d8b8] hover:bg-[#F2FFFC] ${toolsPanelOpen ? "border-[#00d8b8] bg-[#E6FFFA] text-[#00d8b8]" : "border-[#BCEEE5] bg-white text-[#0f4f49]"
            }`}
        >
          <Settings2 className="h-4 w-4" />
          <span>Ferramentas</span>
        </button>
      )}

      <div className={toolbarGroup}>
        <ButtonIcon title="Selecionar" active={!activeTool && !architectureTool && !routeToolActive} onClick={onSelectMode}>
          <MousePointer2 className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Adicionar cômodo" onClick={onAddRoom}>
          <SquarePlus className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Desenhar paredes" active={architectureTool === "wall"} onClick={() => onSelectArchitectureTool(architectureTool === "wall" ? "" : "wall")}>
          <Minus className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Desenhar parede curva" active={architectureTool === "curve"} onClick={() => onSelectArchitectureTool(architectureTool === "curve" ? "" : "curve")}>
          <Spline className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Nomear cômodo" active={architectureTool === "label"} onClick={() => onSelectArchitectureTool(architectureTool === "label" ? "" : "label")}>
          <Type className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Inserir porta na parede" active={architectureTool === "door"} onClick={() => onSelectArchitectureTool(architectureTool === "door" ? "" : "door")}>
          <DoorOpen className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Inserir janela na parede" active={architectureTool === "window"} onClick={() => onSelectArchitectureTool(architectureTool === "window" ? "" : "window")}>
          <PanelTop className="h-4 w-4" />
        </ButtonIcon>
      </div>


      <div className={toolbarGroup}>
        {TOOLBAR_SYMBOLS.map((toolId) => {
          const tool = TOOL_TYPES.find((item) => item.id === toolId);
          return (
            <button
              key={toolId}
              type="button"
              title={PLANT_SYMBOL_LABELS[toolId] || toolId}
              aria-label={PLANT_SYMBOL_LABELS[toolId] || toolId}
              onClick={() => onSelectTool(activeTool === toolId ? "" : toolId)}
              className={`${symbolButton} ${activeTool === toolId ? activeButton : ""}`}
            >
              <ElectricalSymbol type={toolId} size={21} color={tool?.color} />
            </button>
          );
        })}
      </div>

      <div className={toolbarGroup}>
        <ButtonIcon title="Desfazer" disabled={!canUndo} onClick={onUndo}>
          <Undo2 className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Refazer" disabled={!canRedo} onClick={onRedo}>
          <Redo2 className="h-4 w-4" />
        </ButtonIcon>
      </div>

      <div className={toolbarGroup}>
        <ButtonIcon title="Zoom -" onClick={() => onZoomChange(Math.max(0.45, zoom - 0.15))}>
          <ZoomOut className="h-4 w-4" />
        </ButtonIcon>
        <span className="min-w-12 shrink-0 px-1 text-center text-[11px] font-black text-[#0f4f49]">{Math.round(zoom * 100)}%</span>
        <ButtonIcon title="Zoom +" onClick={() => onZoomChange(Math.min(2.6, zoom + 0.15))}>
          <ZoomIn className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Enquadrar" onClick={onFit}>
          <Maximize2 className="h-4 w-4" />
        </ButtonIcon>
        <label
          title="Escala geral: pixels por metro"
          className="flex h-8 shrink-0 items-center gap-1 rounded-[9px] border border-[#BCEEE5] bg-white px-2 text-[#0f4f49] shadow-sm"
        >
          <Ruler className="h-3.5 w-3.5" />
          <span className="sr-only">Escala geral</span>
          <input
            type="number"
            min={MIN_SCALE_PX_PER_METER}
            max={MAX_SCALE_PX_PER_METER}
            step="5"
            value={scaleInput}
            onChange={(event) => setScaleInput(event.target.value)}
            onBlur={commitScaleInput}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="h-6 w-[52px] rounded border-0 bg-transparent px-0 text-center text-[11px] font-black text-[#0f4f49] outline-none focus-visible:ring-2 focus-visible:ring-[#00d8b8] focus-visible:ring-offset-1"
          />
          <span className="text-[10px] font-black text-[#64748B]">px/m</span>
        </label>
        <ButtonIcon
          title={showWallDimensions ? "Ocultar cotas" : "Mostrar cotas"}
          active={showWallDimensions}
          onClick={onToggleWallDimensions}
        >
          <Ruler className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon
          title={showDeviceDimensions ? "Ocultar cotas elétricas dos dispositivos (vermelho)" : "Mostrar cotas elétricas dos dispositivos (vermelho)"}
          active={showDeviceDimensions}
          onClick={onToggleDeviceDimensions}
        >
          <Crosshair className="h-4 w-4 text-red-600" />
        </ButtonIcon>
        <ButtonIcon
          title={showPositionLabels ? "Ocultar textos vermelhos de altura" : "Mostrar textos vermelhos de altura"}
          active={showPositionLabels}
          onClick={onTogglePositionLabels}
        >
          {showPositionLabels ? (
            <Eye className="h-4 w-4 text-red-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-red-600" />
          )}
        </ButtonIcon>
      </div>

      <div className={toolbarGroup}>
        <ButtonIcon title="Girar anti-horário" disabled={!hasSelection} onClick={() => onRotateSelected(-15)}>
          <RotateCcw className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Girar horário" disabled={!hasSelection} onClick={() => onRotateSelected(15)}>
          <RotateCw className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Duplicar" disabled={!hasSelection} onClick={onDuplicateSelected}>
          <Copy className="h-4 w-4" />
        </ButtonIcon>
        <ButtonIcon title="Remover" disabled={!hasSelection} onClick={onDeleteSelected}>
          <Trash2 className="h-4 w-4" />
        </ButtonIcon>
      </div>
    </div>
  );
}

function RouteLayer({
  routes,
  points = [],
  selectedElement,
  selectedRoutePointIndex = null,
  routeEditMode = "",
  disabled = false,
  getPointerDesignPosition,
  onSelectRoute,
  onSelectRoutePoint,
  onAddRoutePoint,
  onMoveRoutePoint,
  onUpdateRouteLabel,
  onRemoveRoutePoint,
  onRouteDoubleClick,
  onStartRouteDrag,
  onMoveRoute,
  onCommitRouteDrag,
}) {
  const selectedRoute = selectedElement?.type === "route"
    ? routes.find((route) => sameId(route.id, selectedElement.id))
    : null;
  const selectedPath = selectedRoute ? cablePath(selectedRoute) : [];
  const terminals = points.map((point) => {
    const terminal = pointToTerminal(point);
    return {
      componentId: terminal.componentId,
      terminalId: terminal.terminalId,
      x: pctToPx(terminal.x, DESIGN.width),
      y: pctToPx(terminal.y, DESIGN.height),
    };
  });

  const handleCableClick = (routeId) => {
    if (disabled) return;
    const route = routes.find((item) => sameId(item.id, routeId));
    if (!route) return;
    const selected = selectedElement?.type === "route" && sameId(selectedElement.id, route.id);
    if (selected && routeEditMode === "addPoint") {
      addPointAtPointer(route.id);
      return;
    }
    onSelectRoute?.({ type: "route", id: route.id });
  };

  const handleCableDoubleClick = (routeId) => {
    if (disabled) return;
    const route = routes.find((item) => sameId(item.id, routeId));
    if (!route) return;
    const selected = selectedElement?.type === "route" && sameId(selectedElement.id, route.id);
    if (selected && routeEditMode === "addPoint") {
      addPointAtPointer(route.id);
      return;
    }
    onSelectRoute?.({ type: "route", id: route.id });
    onRouteDoubleClick?.(route.id);
  };

  const addPointAtPointer = (routeId) => {
    if (disabled) return;
    const pointer = getPointerDesignPosition?.(true);
    if (!pointer) return;
    onAddRoutePoint?.(routeId, {
      x: pxToPct(pointer.x, DESIGN.width),
      y: pxToPct(pointer.y, DESIGN.height),
    });
  };

  return (
    <Group name="route-network">
      <CableRenderer
        cables={routes}
        selectedElement={selectedElement}
        dimensions={DESIGN}
        onCableClick={handleCableClick}
        onCableDoubleClick={handleCableDoubleClick}
        onCableDragStart={onStartRouteDrag}
        onCableDrag={onMoveRoute}
        onCableDragEnd={onCommitRouteDrag}
        onCableLabelDragEnd={onUpdateRouteLabel}
      />
      {selectedRoute && (routeEditMode === "editPath" || routeEditMode === "removePoint") && selectedPath.map((point, nodeIndex) => {
        const x = pctToPx(point.x, DESIGN.width);
        const y = pctToPx(point.y, DESIGN.height);
        const removable = routeEditMode === "removePoint" &&
          nodeIndex > 0 &&
          nodeIndex < selectedPath.length - 1 &&
          selectedPath.length > ROUTE_MIN_POINTS;
        const canDrag = routeEditMode === "editPath" && !disabled && !selectedRoute.locked;
        const handlePointerDown = (event) => {
          event.cancelBubble = true;
        };
        const handleClick = (event) => {
          event.cancelBubble = true;
          onSelectRoutePoint?.(nodeIndex);
          if (removable) onRemoveRoutePoint?.(selectedRoute.id, nodeIndex);
        };
        const moveNode = (event, commit = false) => {
          event.cancelBubble = true;
          onMoveRoutePoint?.(
            selectedRoute.id,
            nodeIndex,
            {
              x: pxToPct(snapDesignValue(event.target.x()), DESIGN.width),
              y: pxToPct(snapDesignValue(event.target.y()), DESIGN.height),
            },
            { commit },
          );
        };

        return (
          <Group
            key={`${selectedRoute.id}-node-${nodeIndex}`}
            name="route-node"
            x={x}
            y={y}
            draggable={canDrag}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
            onClick={handleClick}
            onTap={handleClick}
            onDragMove={(event) => moveNode(event, false)}
            onDragEnd={(event) => moveNode(event, true)}
          >
            <Circle
              radius={ROUTE_HANDLE_HIT_RADIUS}
              fill="rgba(255,255,255,0.01)"
            />
            <Circle
              radius={removable ? ROUTE_HANDLE_RADIUS + 1 : ROUTE_HANDLE_RADIUS}
              fill={removable ? "#FEE2E2" : selectedRoutePointIndex === nodeIndex ? "#E6FFFA" : "#ffffff"}
              stroke={removable ? "#B91C1C" : nodeIndex === 0 || nodeIndex === selectedPath.length - 1 ? "#0F766E" : "#00d8b8"}
              strokeWidth={selectedRoutePointIndex === nodeIndex ? 3 : 2.4}
            />
            {routeEditMode === "editPath" && (
              <Text
                x={-13}
                y={10}
                width={26}
                align="center"
                text={String(nodeIndex + 1)}
                fontFamily="Arial"
                fontSize={7.5}
                fontStyle="bold"
                fill="#00d8b8"
                listening={false}
              />
            )}
          </Group>
        );
      })}
      {selectedRoute && routeEditMode === "editPath" && !selectedRoute.locked && terminals.map((terminal) => (
        <Circle
          key={`${terminal.componentId}-${terminal.terminalId}`}
          x={terminal.x}
          y={terminal.y}
          radius={10}
          fill="rgba(0,100,166,0.05)"
          stroke="#00d8b8"
          strokeWidth={1}
          dash={[3, 3]}
          listening={false}
        />
      ))}
      {selectedRoute && routeEditMode === "addPoint" && selectedPath[0] && (
        <Text
          x={pctToPx(selectedPath[0].x, DESIGN.width) + 10}
          y={pctToPx(selectedPath[0].y, DESIGN.height) - 26}
          width={176}
          text="clique no cabo para adicionar ponto"
          fontFamily="Arial"
          fontSize={9}
          fontStyle="bold"
          fill="#00d8b8"
          listening={false}
        />
      )}
    </Group>
  );
}

function ArchitecturalWallLayer({
  walls,
  selectedElement,
  disabled = false,
  scalePxPerMeter,
  showWallDimensions = true,
  onSelectElement,
  onUpdateWall,
  onEditWallDimension,
  onAlignPosition,
  onClearAlignment,
}) {
  return walls.map((wall) => {
    const geometry = wallGeometry(wall);
    const selected = selectedElement?.type === "wall" && sameId(selectedElement.id, wall.id);
    const thickness = clamp(Number(wall.thickness) || DEFAULT_WALL_THICKNESS, 3, 14);

    return (
      <Group key={wall.id}>
        <Line
          name="architecture-wall"
          points={wallBezierPoints(wall)}
          bezier={wall.kind === "curve"}
          stroke={selected ? "#00d8b8" : TECH_BLACK}
          strokeWidth={thickness}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={Math.max(24, thickness + 14)}
          draggable={!disabled}
          onClick={(event) => {
            if (disabled) return;
            event.cancelBubble = true;
            onSelectElement?.({ type: "wall", id: wall.id });
          }}
          onTap={(event) => {
            if (disabled) return;
            event.cancelBubble = true;
            onSelectElement?.({ type: "wall", id: wall.id });
          }}
          onDragStart={() => {
            if (disabled) return;
            onSelectElement?.({ type: "wall", id: wall.id });
          }}
          onDragEnd={(event) => {
            const dx = event.target.x();
            const dy = event.target.y();
            event.target.position({ x: 0, y: 0 });
            onClearAlignment?.();
            onUpdateWall?.(wall.id, {
              x1: pxToPct(geometry.x1 + dx, DESIGN.width),
              y1: pxToPct(geometry.y1 + dy, DESIGN.height),
              x2: pxToPct(geometry.x2 + dx, DESIGN.width),
              y2: pxToPct(geometry.y2 + dy, DESIGN.height),
              ...(wall.kind === "curve" ? {
                cx: pxToPct(geometry.cx + dx, DESIGN.width),
                cy: pxToPct(geometry.cy + dy, DESIGN.height),
              } : {}),
            });
          }}
          onDragMove={(event) => {
            const alignedStart = onAlignPosition?.({
              x: geometry.x1 + event.target.x(),
              y: geometry.y1 + event.target.y(),
              type: "wall",
              id: wall.id,
            });
            if (alignedStart) {
              event.target.position({
                x: alignedStart.x - geometry.x1,
                y: alignedStart.y - geometry.y1,
              });
            }
          }}
        />
        {showWallDimensions && wall.dimensionHidden !== true && (
          <WallDimensionLabel
            wall={wall}
            scalePxPerMeter={scalePxPerMeter}
            selected={selected || (selectedElement?.type === "wallDimension" && sameId(selectedElement.id, wall.id))}
            disabled={disabled}
            onSelectDimension={(wallId) => onSelectElement?.({ type: "wallDimension", id: wallId })}
            onEditDimension={onEditWallDimension}
            onUpdateDimension={(wallId, patch) => onUpdateWall?.(wallId, patch)}
          />
        )}
        {selected && !disabled && (
          <>
            {[
              { key: "start", x: geometry.x1, y: geometry.y1, xField: "x1", yField: "y1" },
              { key: "end", x: geometry.x2, y: geometry.y2, xField: "x2", yField: "y2" },
              ...(wall.kind === "curve"
                ? [{ key: "control", x: geometry.cx, y: geometry.cy, xField: "cx", yField: "cy", control: true }]
                : []),
            ].map((handle) => (
              <Circle
                key={`${wall.id}-${handle.key}`}
                name="architecture-handle"
                x={handle.x}
                y={handle.y}
                radius={8}
                fill={handle.control ? "#00d8b8" : "#ffffff"}
                stroke="#00d8b8"
                strokeWidth={3}
                draggable
                onMouseDown={(event) => { event.cancelBubble = true; }}
                onTouchStart={(event) => { event.cancelBubble = true; }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  onClearAlignment?.();
                  onUpdateWall?.(wall.id, {
                    [handle.xField]: pxToPct(snapDesignValue(event.target.x()), DESIGN.width),
                    [handle.yField]: pxToPct(snapDesignValue(event.target.y()), DESIGN.height),
                  });
                }}
                onDragMove={(event) => {
                  const aligned = onAlignPosition?.({
                    x: event.target.x(),
                    y: event.target.y(),
                    type: "wall",
                    id: wall.id,
                  });
                  if (aligned) event.target.position(aligned);
                }}
              />
            ))}
            {wall.kind === "curve" && (
              <>
                <Line points={[geometry.x1, geometry.y1, geometry.cx, geometry.cy, geometry.x2, geometry.y2]} stroke="#00d8b8" strokeWidth={1.2} dash={[7, 6]} opacity={0.65} listening={false} />
                <Text x={geometry.cx + 10} y={geometry.cy - 18} text="curvatura" fontFamily="Arial" fontSize={11} fill="#00d8b8" listening={false} />
              </>
            )}
          </>
        )}
      </Group>
    );
  });
}

function ArchitecturalOpeningLayer({
  openings,
  walls,
  selectedElement,
  disabled = false,
  scalePxPerMeter,
  onSelectElement,
  onUpdateOpening,
}) {
  const wallMap = new Map(walls.map((wall) => [String(wall.id), wall]));
  const measurementScale = normalizeScalePxPerMeter(scalePxPerMeter);

  return openings.map((opening) => {
    const wall = wallMap.get(String(opening.wallId));
    if (!wall) return null;
    const geometry = wallGeometry(wall);
    const defaultWidth = (opening.kind === "window" ? DEFAULT_WINDOW_WIDTH_M : DEFAULT_DOOR_WIDTH_M) * measurementScale;
    const minOpeningWidth = 0.48 * measurementScale;
    const requestedWidth = Number(opening.width) || defaultWidth;
    const openingWidth = clamp(requestedWidth, minOpeningWidth, Math.max(minOpeningWidth, geometry.length * 0.75));
    const half = openingWidth / 2;
    const minPosition = Math.min(0.45, half / geometry.length);
    const position = clamp(Number(opening.position) || 0.5, minPosition, 1 - minPosition);
    const center = wallPointAt(wall, position);
    const tangent = wallTangentAt(wall, position);
    const selected = selectedElement?.type === "opening" && sameId(selectedElement.id, opening.id);
    const wallThickness = clamp(Number(wall.thickness) || DEFAULT_WALL_THICKNESS, 3, 14);
    const flip = opening.flip ? -1 : 1;

    return (
      <Group
        key={opening.id}
        name="architecture-opening"
        x={center.x}
        y={center.y}
        rotation={tangent.angle}
        draggable={!disabled}
        onClick={(event) => {
          if (disabled) return;
          event.cancelBubble = true;
          onSelectElement?.({ type: "opening", id: opening.id });
        }}
        onTap={(event) => {
          if (disabled) return;
          event.cancelBubble = true;
          onSelectElement?.({ type: "opening", id: opening.id });
        }}
        onDragStart={() => {
          if (disabled) return;
          onSelectElement?.({ type: "opening", id: opening.id });
        }}
        onDragEnd={(event) => {
          let bestWall = wall;
          let bestDist = Infinity;
          let bestProj = null;
          walls.forEach((w) => {
            const proj = projectPointToWall(event.target.x(), event.target.y(), w);
            if (proj.distance < bestDist) {
              bestDist = proj.distance;
              bestWall = w;
              bestProj = proj;
            }
          });
          if (bestProj && bestWall && bestDist < 60) {
            onUpdateOpening?.(opening.id, { wallId: bestWall.id, position: bestProj.position });
          } else {
            const projection = projectPointToWall(event.target.x(), event.target.y(), wall);
            onUpdateOpening?.(opening.id, { position: projection.position });
          }
        }}
      >
        <Line points={[-half, 0, half, 0]} stroke="#ffffff" strokeWidth={wallThickness + 5} lineCap="butt" />
        {opening.kind === "window" ? (
          <>
            <Line points={[-half, -3, half, -3]} stroke={TECH_BLACK} strokeWidth={1.6} />
            <Line points={[-half, 3, half, 3]} stroke={TECH_BLACK} strokeWidth={1.6} />
            <Line points={[-half, -6, -half, 6]} stroke={TECH_BLACK} strokeWidth={1.2} />
            <Line points={[half, -6, half, 6]} stroke={TECH_BLACK} strokeWidth={1.2} />
          </>
        ) : (
          <>
            <Line points={[-half, 0, -half, flip * openingWidth]} stroke={TECH_BLACK} strokeWidth={1.8} />
            <Arc
              x={-half}
              y={0}
              innerRadius={0}
              outerRadius={openingWidth}
              angle={90}
              rotation={flip > 0 ? 0 : -90}
              stroke={TECH_BLACK}
              strokeWidth={1.15}
            />
          </>
        )}
        {selected && (
          <>
            <Rect
              x={-half - 8}
              y={-Math.max(16, openingWidth) - 8}
              width={openingWidth + 16}
              height={Math.max(32, openingWidth * 2) + 16}
              stroke="#00d8b8"
              strokeWidth={1.4}
              dash={[7, 5]}
              listening={false}
            />
            <Circle radius={6} fill="#ffffff" stroke="#00d8b8" strokeWidth={2.5} listening={false} />
          </>
        )}
      </Group>
    );
  });
}

function ArchitecturalRoomLabelLayer({
  roomLabels,
  selectedElement,
  disabled = false,
  onSelectElement,
  onUpdateRoomLabel,
  onAlignPosition,
  onClearAlignment,
}) {
  return roomLabels.map((label) => {
    const selected = selectedElement?.type === "roomLabel" && sameId(selectedElement.id, label.id);
    const fontSize = clamp(Number(label.fontSize) || 16, 10, 32);
    const width = Math.max(100, Number(label.width) || 180);

    return (
      <Group
        key={label.id}
        name="architecture-room-label"
        x={pctToPx(label.x, DESIGN.width)}
        y={pctToPx(label.y, DESIGN.height)}
        draggable={!disabled}
        onClick={(event) => {
          if (disabled) return;
          event.cancelBubble = true;
          onSelectElement?.({ type: "roomLabel", id: label.id });
        }}
        onTap={(event) => {
          if (disabled) return;
          event.cancelBubble = true;
          onSelectElement?.({ type: "roomLabel", id: label.id });
        }}
        onDragStart={() => {
          if (disabled) return;
          onSelectElement?.({ type: "roomLabel", id: label.id });
        }}
        onDragEnd={(event) => {
          onClearAlignment?.();
          onUpdateRoomLabel?.(label.id, {
            x: pxToPct(event.target.x(), DESIGN.width),
            y: pxToPct(event.target.y(), DESIGN.height),
          });
        }}
        onDragMove={(event) => {
          const aligned = onAlignPosition?.({
            x: event.target.x(),
            y: event.target.y(),
            type: "roomLabel",
            id: label.id,
          });
          if (aligned) event.target.position(aligned);
        }}
      >
        {selected && (
          <Rect
            x={-10}
            y={-8}
            width={width + 20}
            height={fontSize + (label.area ? 34 : 20)}
            fill="rgba(255,255,255,0.82)"
            stroke="#00d8b8"
            strokeWidth={1.4}
            dash={[7, 5]}
          />
        )}
        <Text
          width={width}
          text={label.name || "Cômodo"}
          fontFamily="Arial"
          fontSize={fontSize}
          fontStyle="bold"
          fill={TECH_BLACK}
        />
        {label.area && (
          <Text
            y={fontSize + 5}
            width={width}
            text={label.area}
            fontFamily="Arial"
            fontSize={Math.max(9, fontSize - 5)}
            fill="#475569"
          />
        )}
      </Group>
    );
  });
}

function ImportedPlanLayer({ elements }) {
  const lines = elements?.lines || [];
  const texts = elements?.texts || [];
  if (lines.length === 0 && texts.length === 0) return null;

  return (
    <Group listening={false} opacity={0.42}>
      {lines.map((line) => (
        <Line
          key={line.id}
          points={[line.x1, line.y1, line.x2, line.y2]}
          stroke={TECH_BLACK}
          strokeWidth={line.strokeWidth || 1}
          lineCap="square"
          lineJoin="miter"
          opacity={0.98}
        />
      ))}
      {texts.map((item) => (
        <Text
          key={item.id}
          x={item.x}
          y={item.y}
          width={item.width || 120}
          text={item.text}
          fontFamily="Arial"
          fontSize={item.fontSize || 8}
          fill={TECH_BLACK}
        />
      ))}
    </Group>
  );
}

function DeviceDimensionsLayer({
  points,
  walls = [],
  rooms = [],
  scalePxPerMeter,
  width,
  height,
  selectedElement,
  onSelectElement,
  onUpdatePointDimension,
}) {
  if (!points || !points.length) return null;

  const vSegments = [];
  const hSegments = [];

  if (walls && walls.length > 0) {
    walls.forEach((w) => {
      const geom = wallGeometry(w, width, height);
      if (Math.abs(geom.x1 - geom.x2) < Math.abs(geom.y1 - geom.y2)) {
        vSegments.push({
          x: (geom.x1 + geom.x2) / 2,
          yMin: Math.min(geom.y1, geom.y2),
          yMax: Math.max(geom.y1, geom.y2),
        });
      } else {
        hSegments.push({
          y: (geom.y1 + geom.y2) / 2,
          xMin: Math.min(geom.x1, geom.x2),
          xMax: Math.max(geom.x1, geom.x2),
        });
      }
    });
  }

  if (rooms && rooms.length > 0) {
    rooms.forEach((r) => {
      const rx = pctToPx(r.x, width);
      const ry = pctToPx(r.y, height);
      const rw = pctToPx(r.w || r.width || 0, width);
      const rh = pctToPx(r.h || r.height || 0, height);
      if (rw > 5 && rh > 5) {
        vSegments.push({ x: rx, yMin: ry, yMax: ry + rh });
        vSegments.push({ x: rx + rw, yMin: ry, yMax: ry + rh });
        hSegments.push({ y: ry, xMin: rx, xMax: rx + rw });
        hSegments.push({ y: ry + rh, xMin: rx, xMax: rx + rw });
      }
    });
  }

  if (vSegments.length === 0 && hSegments.length === 0) {
    vSegments.push({ x: 0, yMin: 0, yMax: height });
    vSegments.push({ x: width, yMin: 0, yMax: height });
    hSegments.push({ y: 0, xMin: 0, xMax: width });
    hSegments.push({ y: height, xMin: 0, xMax: width });
  }

  const renderDimension = (x1, y1, x2, y2, key, point) => {
    if (point.deviceDimensionsHidden === true) return null;
    const hiddenDimensions = point.hiddenDeviceDimensions || {};
    const legacyHiddenKeys = Array.isArray(point.hiddenDeviceDimensionKeys) ? point.hiddenDeviceDimensionKeys : [];
    if (hiddenDimensions[key] === true || legacyHiddenKeys.includes(key)) return null;
    const distPx = Math.hypot(x2 - x1, y2 - y1);
    if (distPx < 12) return null;
    const distM = distPx / scalePxPerMeter;
    const text = formatMeters(distM);
    const isHorizontal = Math.abs(y2 - y1) <= Math.abs(x2 - x1);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const fontSize = clamp(Number(point.dimensionLabelFontSize) || DEFAULT_DEVICE_DIMENSION_LABEL.fontSize, 6, 16);
    const color = point.dimensionLabelColor || DEFAULT_DEVICE_DIMENSION_LABEL.text;
    const strokeColor = point.dimensionLabelStroke || DEFAULT_DEVICE_DIMENSION_LABEL.stroke;
    const fillColor = point.dimensionLabelFill || DEFAULT_DEVICE_DIMENSION_LABEL.fill;
    const labelWidth = Math.max(38, text.length * fontSize * 0.66 + 13);
    const labelHeight = Math.max(13, fontSize + 6);
    const offset = point.dimensionLabelOffsets?.[key] || {};
    const labelDx = Number(offset.dx) || 0;
    const labelDy = Number(offset.dy) || 0;
    const isSelectedPoint = selectedElement?.type === "point" && sameId(selectedElement.id, point.id);
    const isSelectedDimension = selectedElement?.type === "deviceDimension" &&
      sameId(selectedElement.id, point.id) &&
      selectedElement.key === key;
    const selectDimension = (event) => {
      event.cancelBubble = true;
      onSelectElement?.({ type: "deviceDimension", id: point.id, key });
    };

    return (
      <Group key={key}>
        <Line points={[x1, y1, x2, y2]} stroke={color} strokeWidth={1.4} listening={false} />
        {isHorizontal ? (
          <>
            <Line points={[x1 + (x2 > x1 ? 6 : -6), y1 - 3.5, x1, y1, x1 + (x2 > x1 ? 6 : -6), y1 + 3.5]} stroke={color} strokeWidth={1.5} lineCap="round" lineJoin="round" listening={false} />
            <Line points={[x2 + (x2 > x1 ? -6 : 6), y2 - 3.5, x2, y2, x2 + (x2 > x1 ? -6 : 6), y2 + 3.5]} stroke={color} strokeWidth={1.5} lineCap="round" lineJoin="round" listening={false} />
          </>
        ) : (
          <>
            <Line points={[x1 - 3.5, y1 + (y2 > y1 ? 6 : -6), x1, y1, x1 + 3.5, y1 + (y2 > y1 ? 6 : -6)]} stroke={color} strokeWidth={1.5} lineCap="round" lineJoin="round" listening={false} />
            <Line points={[x2 - 3.5, y2 + (y2 > y1 ? -6 : 6), x2, y2, x2 + 3.5, y2 + (y2 > y1 ? -6 : 6)]} stroke={color} strokeWidth={1.5} lineCap="round" lineJoin="round" listening={false} />
          </>
        )}
        <Group
          name="device-dimension-label"
          x={cx + labelDx}
          y={cy + labelDy}
          draggable
          onMouseDown={(event) => {
            event.cancelBubble = true;
          }}
          onTouchStart={(event) => {
            event.cancelBubble = true;
          }}
          onClick={(event) => {
            selectDimension(event);
          }}
          onTap={(event) => {
            selectDimension(event);
          }}
          onDragStart={(event) => {
            event.cancelBubble = true;
            onSelectElement?.({ type: "deviceDimension", id: point.id, key });
          }}
          onDragMove={(event) => {
            event.cancelBubble = true;
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true;
            onUpdatePointDimension?.(point.id, key, {
              dx: event.target.x() - cx,
              dy: event.target.y() - cy,
            });
          }}
        >
          <Rect
            x={-labelWidth / 2}
            y={-labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            fill={fillColor}
            stroke={isSelectedPoint || isSelectedDimension ? color : strokeColor}
            strokeWidth={isSelectedPoint || isSelectedDimension ? 1.2 : 0.8}
            cornerRadius={3}
            opacity={0.95}
          />
          <Text
            x={-labelWidth / 2}
            y={-fontSize / 2 - 0.5}
            width={labelWidth}
            text={text}
            fontSize={fontSize}
            fontStyle="bold"
            fill={color}
            align="center"
          />
        </Group>
      </Group>
    );
  };

  const dimensionElements = [];
  const maxWallDistPx = scalePxPerMeter * 3.5;

  points.forEach((point, idx) => {
    const px = pctToPx(point.x, width);
    const py = pctToPx(point.y, height);

    let minVWallDist = Infinity;
    let closestVWallX = null;
    let onVWall = null;
    vSegments.forEach((seg) => {
      if (py >= seg.yMin - 40 && py <= seg.yMax + 40) {
        const d = Math.abs(seg.x - px);
        if (d < minVWallDist && d > 12) {
          minVWallDist = d;
          closestVWallX = seg.x;
        }
        if (d <= 12 && py >= seg.yMin && py <= seg.yMax) {
          onVWall = seg;
        }
      }
    });

    if (closestVWallX !== null && minVWallDist <= maxWallDistPx) {
      dimensionElements.push(renderDimension(closestVWallX, py, px, py, `vwall-${point.id || idx}`, point));
    }
    
    if (onVWall) {
      const distToMin = py - onVWall.yMin;
      const distToMax = onVWall.yMax - py;
      const offset = 25; 
      if (distToMin < distToMax && distToMin > 12) {
        dimensionElements.push(renderDimension(px + offset, onVWall.yMin, px + offset, py, `on-vwall-min-${point.id || idx}`, point));
      } else if (distToMax > 12) {
        dimensionElements.push(renderDimension(px + offset, py, px + offset, onVWall.yMax, `on-vwall-max-${point.id || idx}`, point));
      }
    }

    let minHWallDist = Infinity;
    let closestHWallY = null;
    let onHWall = null;
    hSegments.forEach((seg) => {
      if (px >= seg.xMin - 40 && px <= seg.xMax + 40) {
        const d = Math.abs(seg.y - py);
        if (d < minHWallDist && d > 12) {
          minHWallDist = d;
          closestHWallY = seg.y;
        }
        if (d <= 12 && px >= seg.xMin && px <= seg.xMax) {
          onHWall = seg;
        }
      }
    });

    if (closestHWallY !== null && minHWallDist <= maxWallDistPx) {
      dimensionElements.push(renderDimension(px, closestHWallY, px, py, `hwall-${point.id || idx}`, point));
    }

    if (onHWall) {
      const distToMin = px - onHWall.xMin;
      const distToMax = onHWall.xMax - px;
      const offset = 25;
      if (distToMin < distToMax && distToMin > 12) {
        dimensionElements.push(renderDimension(onHWall.xMin, py + offset, px, py + offset, `on-hwall-min-${point.id || idx}`, point));
      } else if (distToMax > 12) {
        dimensionElements.push(renderDimension(px, py + offset, onHWall.xMax, py + offset, `on-hwall-max-${point.id || idx}`, point));
      }
    }

    let closestVertNeighborY = null;
    let minVertNeighborDist = Infinity;
    let closestHorizNeighborX = null;
    let minHorizNeighborDist = Infinity;

    for (let j = idx + 1; j < points.length; j++) {
      const p2 = points[j];
      const px2 = pctToPx(p2.x, width);
      const py2 = pctToPx(p2.y, height);

      if (Math.abs(px - px2) < 45 && Math.abs(py - py2) > 20) {
        const d = Math.abs(py - py2);
        if (d < minVertNeighborDist && d <= maxWallDistPx * 1.5) {
          minVertNeighborDist = d;
          closestVertNeighborY = py2;
        }
      }
      if (Math.abs(py - py2) < 45 && Math.abs(px - px2) > 20) {
        const d = Math.abs(px - px2);
        if (d < minHorizNeighborDist && d <= maxWallDistPx * 1.5) {
          minHorizNeighborDist = d;
          closestHorizNeighborX = px2;
        }
      }
    }

    if (closestVertNeighborY !== null) {
      dimensionElements.push(renderDimension(px, py, px, closestVertNeighborY, `vneigh-${point.id || idx}`, point));
    }
    if (closestHorizNeighborX !== null) {
      dimensionElements.push(renderDimension(px, py, closestHorizNeighborX, py, `hneigh-${point.id || idx}`, point));
    }
  });

  return (
    <Group name="device-dimensions">{dimensionElements}</Group>
  );
}

export default function FloorPlanCanvas({
  imageUrl,
  imageLayout,
  importedPlanElements: rawImportedPlanElements,
  points: rawPoints = [],
  onAddPoint,
  onMovePoint,
  onAddRoom,
  onSelectTool,
  architectureTool = "",
  onSelectArchitectureTool,
  walls: rawWalls = [],
  openings: rawOpenings = [],
  roomLabels: rawRoomLabels = [],
  onAddWall,
  onUpdateWall,
  onAddOpening,
  onUpdateOpening,
  onAddRoomLabel,
  onUpdateRoomLabel,
  onRotateSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onUndo,
  onRedo,
  onZoomChange,
  onFit,
  toolsPanelOpen = false,
  onToggleToolsPanel,
  activeTool,
  routeToolActive = false,
  showDeviceDimensions = false,
  showPositionLabels = true,
  onToggleDeviceDimensions,
  onTogglePositionLabels,
  routeStartId = "",
  routeEditMode = "",
  routeDraft = null,
  selectedRoutePointIndex = null,
  onRoutePointClick,
  onRouteCanvasClick,
  onRouteCanvasDoubleClick,
  onRouteDoubleClick,
  onUpdateRoutePoint,
  onUpdateRouteLabel,
  onAddRoutePoint,
  onRemoveRoutePoint,
  onSelectRoutePoint,
  onStartRouteDrag,
  onPointDoubleClick,
  onCircuitDoubleClick,
  onMoveRoute,
  onCommitRouteDrag,
  selectedElement,
  onSelectElement,
  canUndo = false,
  canRedo = false,
  layers,
  routes: rawRoutes = [],
  rooms: rawRooms = [],
  onUpdateRoom,
  zoom = 1,
  scalePxPerMeter = DEFAULT_SCALE_PX_PER_METER,
  showWallDimensions = true,
  snapSettings = null,
  onScalePxPerMeterChange,
  onToggleWallDimensions,
  onEditWallDimension,
  fitRequest = 0,
}) {
  const wrapperRef = useRef(null);
  const stageRef = useRef(null);
  const lastPointerRef = useRef(null);
  const importedPlanElements = useMemo(() => normalizeImportedPlanElements(rawImportedPlanElements), [rawImportedPlanElements]);
  const points = useMemo(() => normalizeCanvasPoints(rawPoints), [rawPoints]);
  const walls = useMemo(() => asArray(rawWalls), [rawWalls]);
  const openings = useMemo(() => asArray(rawOpenings), [rawOpenings]);
  const roomLabels = useMemo(() => asArray(rawRoomLabels), [rawRoomLabels]);
  const routes = useMemo(() => asArray(rawRoutes), [rawRoutes]);
  const rooms = useMemo(() => asArray(rawRooms), [rawRooms]);
  const size = useElementSize(wrapperRef);
  const image = useLoadedImage(imageUrl);
  const [hover, setHover] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [routePreview, setRoutePreview] = useState(null);
  const [wallDraftStart, setWallDraftStart] = useState(null);
  const [curveDraftEnd, setCurveDraftEnd] = useState(null);
  const [wallPreview, setWallPreview] = useState(null);
  const [placementPreview, setPlacementPreview] = useState(null);
  const [alignmentGuides, setAlignmentGuides] = useState(null);
  const baseScale = useMemo(() => Math.min((size.width - 32) / DESIGN.width, (size.height - 32) / DESIGN.height), [size]);
  const scale = useMemo(() => Math.max(0.05, baseScale * zoom), [baseScale, zoom]);
  const measurementScale = normalizeScalePxPerMeter(scalePxPerMeter);
  const normalizedSnapSettings = useMemo(() => normalizeSnapSettings(snapSettings), [snapSettings]);
  const stageWidth = size.width;
  const stageHeight = size.height;
  // Renderiza o canvas em pelo menos 2x pixels reais: deixa os símbolos, textos e
  // traços da planta nítidos mesmo em monitor comum (devicePixelRatio = 1).
  const renderPixelRatio = useMemo(() => {
    if (typeof window === "undefined") return 2;
    return Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  }, []);
  const hasImportedPlanElements = (importedPlanElements?.lines?.length || 0) > 0 || (importedPlanElements?.texts?.length || 0) > 0;
  const viewport = useMemo(() => ({
    x: (stageWidth - DESIGN.width * scale) / 2 + pan.x,
    y: (stageHeight - DESIGN.height * scale) / 2 + pan.y,
  }), [pan.x, pan.y, scale, stageHeight, stageWidth]);
  const planImageRect = useMemo(() => {
    if (imageLayout?.w && imageLayout?.h) return imageLayout;
    if (!image) return IMPORTED_PLAN_FRAME;
    const imageRatio = (image.naturalWidth || image.width || 1) / Math.max(1, image.naturalHeight || image.height || 1);
    const frameRatio = IMPORTED_PLAN_FRAME.w / IMPORTED_PLAN_FRAME.h;
    if (imageRatio >= frameRatio) {
      const fittedHeight = IMPORTED_PLAN_FRAME.w / imageRatio;
      return {
        x: IMPORTED_PLAN_FRAME.x,
        y: IMPORTED_PLAN_FRAME.y + (IMPORTED_PLAN_FRAME.h - fittedHeight) / 2,
        w: IMPORTED_PLAN_FRAME.w,
        h: fittedHeight,
      };
    }
    const fittedWidth = IMPORTED_PLAN_FRAME.h * imageRatio;
    return {
      x: IMPORTED_PLAN_FRAME.x + (IMPORTED_PLAN_FRAME.w - fittedWidth) / 2,
      y: IMPORTED_PLAN_FRAME.y,
      w: fittedWidth,
      h: IMPORTED_PLAN_FRAME.h,
    };
  }, [image, imageLayout]);
  const contentOffset = useMemo(() => {
    if (image) return { x: 0, y: 0 };
    if (activeTool || architectureTool || walls.length > 0) return { x: 0, y: 0 };
    const bounds = getPlanContentBounds({ rooms, roomLabels, walls, points, routes });
    if (!bounds) return { x: 0, y: 0 };
    const frameCenter = {
      x: DRAWING_FRAME.x + DRAWING_FRAME.width / 2,
      y: DRAWING_FRAME.y + DRAWING_FRAME.height / 2,
    };
    const contentCenter = boundsCenter(bounds);
    return {
      x: frameCenter.x - contentCenter.x,
      y: frameCenter.y - contentCenter.y,
    };
  }, [activeTool, architectureTool, image, points, roomLabels, rooms, routes, walls]);
  const alignmentReferences = useMemo(() => {
    const x = [];
    const y = [];
    const add = (xValue, yValue, type, id) => {
      if (Number.isFinite(xValue)) x.push({ value: xValue, type, id });
      if (Number.isFinite(yValue)) y.push({ value: yValue, type, id });
    };

    points.forEach((point) => add(
      pctToPx(point.x, DESIGN.width),
      pctToPx(point.y, DESIGN.height),
      "point",
      point.id,
    ));
    roomLabels.forEach((label) => add(
      pctToPx(label.x, DESIGN.width),
      pctToPx(label.y, DESIGN.height),
      "roomLabel",
      label.id,
    ));
    rooms.forEach((room) => {
      const roomX = pctToPx(room.x, DESIGN.width);
      const roomY = pctToPx(room.y, DESIGN.height);
      const roomW = pctToPx(room.w, DESIGN.width);
      const roomH = pctToPx(room.h, DESIGN.height);
      [roomX, roomX + roomW / 2, roomX + roomW].forEach((value) => x.push({ value, type: "room", id: room.id }));
      [roomY, roomY + roomH / 2, roomY + roomH].forEach((value) => y.push({ value, type: "room", id: room.id }));
    });
    walls.forEach((wall) => {
      const geometry = wallGeometry(wall);
      add(geometry.x1, geometry.y1, "wall", wall.id);
      add(geometry.x2, geometry.y2, "wall", wall.id);
      if (wall.kind === "curve") add(geometry.cx, geometry.cy, "wall", wall.id);
    });

    return { x, y };
  }, [points, roomLabels, rooms, walls]);

  const alignPosition = ({ x, y, type = "", id = "" }) => {
    if (!normalizedSnapSettings.smartGuides && !normalizedSnapSettings.objects) {
      setAlignmentGuides(null);
      return { x, y };
    }
    const snapped = snapPointToReferences({
      point: { x, y },
      references: alignmentReferences,
      viewportScale: scale,
      tolerancePx: normalizedSnapSettings.tolerancePx,
      exclude: { type, id },
    });
    setAlignmentGuides(snapped.guides);
    return snapped.point;
  };

  const clearAlignment = () => setAlignmentGuides(null);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [size.width, size.height]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [fitRequest]);

  // Konva usa suavização "low" por padrão ao redimensionar bitmaps; força "high" para
  // a planta importada não ficar granulada quando reduzida/ampliada no editor.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.getLayers().forEach((layer) => {
      const nativeCtx = layer.getContext()?._context;
      if (nativeCtx) {
        nativeCtx.imageSmoothingEnabled = true;
        nativeCtx.imageSmoothingQuality = "high";
      }
    });
    stage.batchDraw();
  }, [image, stageWidth, stageHeight, renderPixelRatio]);

  const visiblePoints = points.filter((point) => {
    const tool = TOOL_TYPES.find((item) => item.id === point.type);
    const category = tool?.category;
    if (!layers) return true;
    const map = {
      iluminacao: layers.iluminacao,
      tomadas: layers.tomadas,
      forca: layers.forca,
      comando: layers.tomadas,
      infra: layers.infra,
      extra: layers.extra,
    };
    return map[category] !== false;
  });
  const routeStartPoint = useMemo(
    () => points.find((point) => sameId(point.id, routeStartId)) || null,
    [points, routeStartId],
  );

  useEffect(() => {
    if (!routeToolActive || !routeStartId) {
      setRoutePreview(null);
    }
  }, [routeToolActive, routeStartId]);

  useEffect(() => {
    setWallDraftStart(null);
    setCurveDraftEnd(null);
    setWallPreview(null);
  }, [architectureTool]);

  useEffect(() => {
    setPlacementPreview(null);
    setAlignmentGuides(null);
  }, [activeTool, architectureTool]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!architectureTool && !activeTool) return;
      if (event.key === "Escape") {
        setWallDraftStart(null);
        setCurveDraftEnd(null);
        setWallPreview(null);
        setPlacementPreview(null);
        setAlignmentGuides(null);
        if (activeTool) onSelectTool?.("");
        onSelectArchitectureTool?.("");
      }
      if (event.key === "Enter" && (architectureTool === "wall" || architectureTool === "curve")) {
        setWallDraftStart(null);
        setCurveDraftEnd(null);
        setWallPreview(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTool, architectureTool, onSelectArchitectureTool, onSelectTool]);

  const getPointerDesignPosition = (snap = false) => {
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return null;
    const position = screenToDesignPoint({
      screen: pointer,
      viewport,
      scale,
      contentOffset,
    });
    if (!snap) return position;
    return {
      x: snapDesignValue(position.x),
      y: snapDesignValue(position.y),
    };
  };

  const constrainWallPoint = (point, event) => {
    if (!wallDraftStart || !event?.evt?.shiftKey) return point;
    const dx = Math.abs(point.x - wallDraftStart.x);
    const dy = Math.abs(point.y - wallDraftStart.y);
    return dx >= dy
      ? { x: point.x, y: wallDraftStart.y }
      : { x: wallDraftStart.x, y: point.y };
  };

  const snapToWallEndpoint = (point) => {
    const endpoints = walls.flatMap((wall) => {
      const geometry = wallGeometry(wall);
      return [{ x: geometry.x1, y: geometry.y1 }, { x: geometry.x2, y: geometry.y2 }];
    });
    const nearest = endpoints
      .map((endpoint) => ({ endpoint, distance: Math.hypot(point.x - endpoint.x, point.y - endpoint.y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    const tolerance = snapToleranceToDocument(Math.max(10, normalizedSnapSettings.tolerancePx), scale);
    return nearest && nearest.distance <= tolerance ? nearest.endpoint : point;
  };

  const handleStagePointerDown = (event) => {
    const targetName = event.target.name();
    const parentName = event.target.getParent?.()?.name?.();
    const isMiddleButton = event.evt?.button === 1;
    if (isMiddleButton || spacePanActive) {
      event.evt?.preventDefault?.();
      setIsPanning(true);
      lastPointerRef.current = stageRef.current?.getPointerPosition() || null;
      return;
    }
    if (architectureTool) {
      const rawPoint = getPointerDesignPosition(true);
      if (!rawPoint) return;
      const point = constrainWallPoint(snapToWallEndpoint(rawPoint), event);

      if (architectureTool === "wall") {
        if (!wallDraftStart) {
          setWallDraftStart(point);
          setWallPreview(point);
          onSelectElement?.(null);
          return;
        }
        if (Math.hypot(point.x - wallDraftStart.x, point.y - wallDraftStart.y) < ARCHITECTURAL_GRID) return;
        const nextWall = {
          id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x1: pxToPct(wallDraftStart.x, DESIGN.width),
          y1: pxToPct(wallDraftStart.y, DESIGN.height),
          x2: pxToPct(point.x, DESIGN.width),
          y2: pxToPct(point.y, DESIGN.height),
          thickness: DEFAULT_WALL_THICKNESS,
          thicknessCm: 15,
        };
        onAddWall?.(nextWall);
        setWallDraftStart(point);
        setWallPreview(point);
        return;
      }

      if (architectureTool === "curve") {
        const endpointPoint = snapToWallEndpoint(rawPoint);
        if (!wallDraftStart) {
          setWallDraftStart(endpointPoint);
          setWallPreview(endpointPoint);
          onSelectElement?.(null);
          return;
        }
        if (!curveDraftEnd) {
          if (Math.hypot(endpointPoint.x - wallDraftStart.x, endpointPoint.y - wallDraftStart.y) < ARCHITECTURAL_GRID) return;
          setCurveDraftEnd(endpointPoint);
          setWallPreview(endpointPoint);
          return;
        }
        const nextWall = {
          id: `curve-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: "curve",
          x1: pxToPct(wallDraftStart.x, DESIGN.width),
          y1: pxToPct(wallDraftStart.y, DESIGN.height),
          x2: pxToPct(curveDraftEnd.x, DESIGN.width),
          y2: pxToPct(curveDraftEnd.y, DESIGN.height),
          cx: pxToPct(rawPoint.x, DESIGN.width),
          cy: pxToPct(rawPoint.y, DESIGN.height),
          thickness: DEFAULT_WALL_THICKNESS,
          thicknessCm: 15,
        };
        onAddWall?.(nextWall);
        setWallDraftStart(null);
        setCurveDraftEnd(null);
        setWallPreview(null);
        return;
      }

      if (architectureTool === "label") {
        const alignedPoint = alignPosition({ x: rawPoint.x, y: rawPoint.y });
        onAddRoomLabel?.({
          id: `room-label-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `Cômodo ${roomLabels.length + 1}`,
          area: "",
          x: pxToPct(alignedPoint.x, DESIGN.width),
          y: pxToPct(alignedPoint.y, DESIGN.height),
          fontSize: 16,
          width: 180,
        });
        return;
      }

      if (architectureTool === "door" || architectureTool === "window") {
        const nearestWall = walls
          .map((wall) => ({ wall, projection: projectPointToWall(point.x, point.y, wall) }))
          .sort((a, b) => a.projection.distance - b.projection.distance)[0];
        if (!nearestWall || nearestWall.projection.distance > 36) return;
        onAddOpening?.({
          id: `${architectureTool}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: architectureTool,
          wallId: nearestWall.wall.id,
          position: nearestWall.projection.position,
          width: (architectureTool === "window" ? DEFAULT_WINDOW_WIDTH_M : DEFAULT_DOOR_WIDTH_M) * measurementScale,
          flip: false,
        });
        return;
      }
    }

    if (routeToolActive) {
      if (["surface", "background", "viewport-background", "room"].includes(targetName) || parentName === "room") {
        const pointer = getPointerDesignPosition(true);
        if (pointer) {
          event.cancelBubble = true;
          onRouteCanvasClick?.({
            x: pxToPct(pointer.x, DESIGN.width),
            y: pxToPct(pointer.y, DESIGN.height),
          });
        }
      }
      return;
    }

    if (!activeTool) {
      if (["surface", "background", "viewport-background"].includes(targetName)) {
        onSelectElement?.(null);
      }
      return;
    }
    if (!["surface", "room", "background"].includes(targetName) && parentName !== "room") return;
    const pointer = getPointerDesignPosition();
    if (!pointer) return;
    const alignedPointer = alignPosition({ x: pointer.x, y: pointer.y });
    onAddPoint({
      id: `point-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: activeTool,
      label: SYMBOL_LABELS[activeTool] || "",
      x: pxToPct(alignedPointer.x, DESIGN.width),
      y: pxToPct(alignedPointer.y, DESIGN.height),
      circuit: null,
    });
    setPlacementPreview(null);
  };

  const handleStageMouseMove = (event) => {
    if (activeTool) {
      const pointer = getPointerDesignPosition();
      if (pointer) setPlacementPreview(alignPosition({ x: pointer.x, y: pointer.y }));
    }

    if ((architectureTool === "wall" || architectureTool === "curve") && wallDraftStart) {
      const pointer = getPointerDesignPosition(true);
      if (pointer) {
        const nextPreview = architectureTool === "curve" && curveDraftEnd
          ? pointer
          : constrainWallPoint(snapToWallEndpoint(pointer), event);
        setWallPreview(nextPreview);
        setAlignmentGuides({ x: nextPreview.x, y: nextPreview.y, snappedX: true, snappedY: true });
      }
    } else if (architectureTool) {
      const pointer = getPointerDesignPosition();
      if (pointer) alignPosition({ x: pointer.x, y: pointer.y });
    }

    if (routeToolActive && (routeStartPoint || routeDraft?.source)) {
      const pointer = stageRef.current?.getPointerPosition();
      if (pointer) {
        const designPoint = screenToDesignPoint({
          screen: pointer,
          viewport,
          scale,
          contentOffset,
        });
        setRoutePreview({
          x: pxToPct(designPoint.x, DESIGN.width),
          y: pxToPct(designPoint.y, DESIGN.height),
        });
      }
    }

    if (!isPanning) return;
    const pointer = stageRef.current?.getPointerPosition();
    const lastPointer = lastPointerRef.current;
    if (!pointer || !lastPointer) return;
    setPan((current) => ({
      x: current.x + pointer.x - lastPointer.x,
      y: current.y + pointer.y - lastPointer.y,
    }));
    lastPointerRef.current = pointer;
  };

  const stopPanning = () => {
    setIsPanning(false);
    lastPointerRef.current = null;
  };

  const handleWheel = (event) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer || !onZoomChange) return;

    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextViewport = zoomAtPoint({
      pointer,
      zoom,
      zoomFactor: direction > 0 ? 1.08 : 0.92,
      baseScale,
      stageWidth,
      stageHeight,
      designWidth: DESIGN.width,
      designHeight: DESIGN.height,
      viewport,
    });
    setPan(nextViewport.pan);
    onZoomChange(nextViewport.zoom);
  };

  const fitViewport = () => {
    setPan({ x: 0, y: 0 });
    onFit?.();
  };

  useEffect(() => {
    const isEditableTarget = (target) => target?.closest?.("input, textarea, select, [contenteditable='true']");
    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;
      const command = event.metaKey || event.ctrlKey;
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePanActive(true);
        return;
      }
      if (!onZoomChange) return;
      if (command && event.key === "0") {
        event.preventDefault();
        fitViewport();
        return;
      }
      if (command && event.key === "1") {
        event.preventDefault();
        setPan({ x: 0, y: 0 });
        onZoomChange(1);
        return;
      }
      if (command && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        onZoomChange(clampZoom(Number(zoom) + 0.15));
        return;
      }
      if (command && event.key === "-") {
        event.preventDefault();
        onZoomChange(clampZoom(Number(zoom) - 0.15));
      }
    };
    const handleKeyUp = (event) => {
      if (event.code !== "Space") return;
      setSpacePanActive(false);
      stopPanning();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [fitViewport, onZoomChange, zoom]);

  const handleStageDoubleClick = (event) => {
    if (!routeToolActive) return;
    const targetName = event.target.name();
    const parentName = event.target.getParent?.()?.name?.();
    if (!["surface", "background", "viewport-background", "room"].includes(targetName) && parentName !== "room") return;
    const pointer = getPointerDesignPosition(true);
    if (!pointer) return;
    event.cancelBubble = true;
    onRouteCanvasDoubleClick?.({
      x: pxToPct(pointer.x, DESIGN.width),
      y: pxToPct(pointer.y, DESIGN.height),
    });
  };

  return (
    <div
      ref={wrapperRef}
      className="relative flex h-full min-h-[560px] w-full items-center justify-center overflow-hidden bg-[#eceff1]"
      style={{ cursor: isPanning ? "grabbing" : spacePanActive ? "grab" : activeTool || architectureTool || routeToolActive ? "crosshair" : "default" }}
    >
      <EditorToolbar
        activeTool={activeTool}
        architectureTool={architectureTool}
        routeToolActive={routeToolActive}
        selectedElement={selectedElement}
        zoom={zoom}
        scalePxPerMeter={measurementScale}
        showWallDimensions={showWallDimensions}
        showDeviceDimensions={showDeviceDimensions}
        showPositionLabels={showPositionLabels}
        canUndo={canUndo}
        canRedo={canRedo}
        onSelectTool={onSelectTool}
        onSelectArchitectureTool={onSelectArchitectureTool}
        onSelectMode={() => {
          onSelectTool?.("");
          onSelectArchitectureTool?.("");
        }}
        onAddRoom={onAddRoom}
        toolsPanelOpen={toolsPanelOpen}
        onToggleToolsPanel={onToggleToolsPanel}
        onZoomChange={onZoomChange}
        onScalePxPerMeterChange={onScalePxPerMeterChange}
        onToggleWallDimensions={onToggleWallDimensions}
        onToggleDeviceDimensions={onToggleDeviceDimensions}
        onTogglePositionLabels={onTogglePositionLabels}
        onFit={fitViewport}
        onRotateSelected={onRotateSelected}
        onDuplicateSelected={onDuplicateSelected}
        onDeleteSelected={onDeleteSelected}
        onUndo={onUndo}
        onRedo={onRedo}
      />
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        pixelRatio={renderPixelRatio}
        className="bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]"
        onMouseDown={handleStagePointerDown}
        onTouchStart={handleStagePointerDown}
        onDblClick={handleStageDoubleClick}
        onDblTap={handleStageDoubleClick}
        onMouseMove={handleStageMouseMove}
        onMouseUp={stopPanning}
        onMouseLeave={() => {
          stopPanning();
          clearAlignment();
          setPlacementPreview(null);
        }}
        onTouchMove={handleStageMouseMove}
        onTouchEnd={stopPanning}
        onWheel={handleWheel}
        onContextMenu={(event) => {
          event.evt.preventDefault();
          setWallDraftStart(null);
          setCurveDraftEnd(null);
          setWallPreview(null);
          setPlacementPreview(null);
          clearAlignment();
        }}
      >
        <Layer>
          <Rect name="viewport-background" width={stageWidth} height={stageHeight} fill="#eceff1" />
          <Group x={viewport.x} y={viewport.y} scaleX={scale} scaleY={scale}>
            <Rect name="surface" width={DESIGN.width} height={DESIGN.height} fill="#ffffff" />
            <GridLayer width={DESIGN.width} height={DESIGN.height} />
            <Rect x={DRAWING_FRAME.x} y={DRAWING_FRAME.y} width={DRAWING_FRAME.width} height={DRAWING_FRAME.height} stroke={TECH_BLACK} strokeWidth={1.3} listening={false} />
            {image && (
              <KonvaImage
                name="background"
                image={image}
                x={planImageRect.x}
                y={planImageRect.y}
                width={planImageRect.w}
                height={planImageRect.h}
                opacity={hasImportedPlanElements ? 0.9 : 0.97}
              />
            )}
            <Group x={contentOffset.x} y={contentOffset.y}>
              {!image && rooms.length === 0 && walls.length === 0 && roomLabels.length === 0 && points.length === 0 && (
                <Group>
                  <Rect x={360} y={290} width={680} height={270} cornerRadius={18} fill="#f8fafc" stroke="#b7d7ea" strokeWidth={3} dash={[16, 10]} />
                  <Text
                    x={420}
                    y={365}
                    width={560}
                    align="center"
                    text="Use Desenhar paredes para criar a planta do zero, em qualquer formato."
                    fontFamily="Arial"
                    fontSize={24}
                    fontStyle="bold"
                    fill="#64748b"
                  />
                  <Text
                    x={455}
                    y={420}
                    width={490}
                    align="center"
                    text="Clique ponto a ponto; use Shift para linhas retas e depois insira portas e janelas."
                    fontFamily="Arial"
                    fontSize={15}
                    fill="#94a3b8"
                  />
                </Group>
              )}
              <ImportedPlanLayer elements={importedPlanElements} />
              {rooms.map((room) => (
                <RoomBaseShape
                  key={`base-${room.id}`}
                  room={room}
                  width={DESIGN.width}
                  height={DESIGN.height}
                  active={selectedElement?.type === "room" && selectedElement.id === room.id}
                  onSelect={routeToolActive ? null : onSelectElement}
                  onUpdateRoom={onUpdateRoom}
                  onAlignPosition={alignPosition}
                  onClearAlignment={clearAlignment}
                  draggable={!routeToolActive}
                />
              ))}
              {rooms.map((room) => (
                <RoomOpeningShape
                  key={`openings-${room.id}`}
                  room={room}
                  width={DESIGN.width}
                  height={DESIGN.height}
                />
              ))}
              <ArchitecturalWallLayer
                walls={walls}
                selectedElement={selectedElement}
                disabled={Boolean(routeToolActive)}
                scalePxPerMeter={measurementScale}
                showWallDimensions={showWallDimensions}
                onSelectElement={onSelectElement}
                onUpdateWall={onUpdateWall}
                onEditWallDimension={onEditWallDimension}
                onAlignPosition={alignPosition}
                onClearAlignment={clearAlignment}
              />
              <ArchitecturalOpeningLayer
                openings={openings}
                walls={walls}
                selectedElement={selectedElement}
                disabled={Boolean(routeToolActive)}
                scalePxPerMeter={measurementScale}
                onSelectElement={onSelectElement}
                onUpdateOpening={onUpdateOpening}
              />
              {layers?.infra !== false && routes.length > 0 && (
                <RouteLayer
                  routes={routes}
                  points={points}
                  selectedElement={selectedElement}
                  selectedRoutePointIndex={selectedRoutePointIndex}
                  routeEditMode={routeEditMode}
                  disabled={Boolean(routeToolActive)}
                  getPointerDesignPosition={getPointerDesignPosition}
                  onSelectRoute={onSelectElement}
                  onSelectRoutePoint={onSelectRoutePoint}
                  onAddRoutePoint={onAddRoutePoint}
                  onMoveRoutePoint={onUpdateRoutePoint}
                  onUpdateRouteLabel={onUpdateRouteLabel}
                  onRemoveRoutePoint={onRemoveRoutePoint}
                  onRouteDoubleClick={onRouteDoubleClick}
                  onStartRouteDrag={onStartRouteDrag}
                  onMoveRoute={onMoveRoute}
                  onCommitRouteDrag={onCommitRouteDrag}
                />
              )}
              <ArchitecturalRoomLabelLayer
                roomLabels={roomLabels}
                selectedElement={selectedElement}
                disabled={Boolean(routeToolActive)}
                onSelectElement={onSelectElement}
                onUpdateRoomLabel={onUpdateRoomLabel}
                onAlignPosition={alignPosition}
                onClearAlignment={clearAlignment}
              />
              {architectureTool === "wall" && wallDraftStart && wallPreview && (
                <>
                  <Line
                    points={[wallDraftStart.x, wallDraftStart.y, wallPreview.x, wallPreview.y]}
                    stroke="#00d8b8"
                    strokeWidth={DEFAULT_WALL_THICKNESS}
                    opacity={0.72}
                    dash={[18, 8]}
                    listening={false}
                  />
                  <Circle x={wallDraftStart.x} y={wallDraftStart.y} radius={7} fill="#00d8b8" listening={false} />
                  <Circle x={wallPreview.x} y={wallPreview.y} radius={7} fill="#ffffff" stroke="#00d8b8" strokeWidth={3} listening={false} />
                </>
              )}
              {architectureTool === "curve" && wallDraftStart && wallPreview && (
                <>
                  {curveDraftEnd ? (() => {
                    const previewWall = {
                      kind: "curve",
                      x1: pxToPct(wallDraftStart.x, DESIGN.width),
                      y1: pxToPct(wallDraftStart.y, DESIGN.height),
                      x2: pxToPct(curveDraftEnd.x, DESIGN.width),
                      y2: pxToPct(curveDraftEnd.y, DESIGN.height),
                      cx: pxToPct(wallPreview.x, DESIGN.width),
                      cy: pxToPct(wallPreview.y, DESIGN.height),
                    };
                    return (
                      <>
                        <Line points={wallBezierPoints(previewWall)} bezier stroke="#00d8b8" strokeWidth={DEFAULT_WALL_THICKNESS} opacity={0.72} dash={[18, 8]} listening={false} />
                        <Line points={[wallDraftStart.x, wallDraftStart.y, wallPreview.x, wallPreview.y, curveDraftEnd.x, curveDraftEnd.y]} stroke="#00d8b8" strokeWidth={1.2} opacity={0.55} dash={[7, 6]} listening={false} />
                        <Circle x={curveDraftEnd.x} y={curveDraftEnd.y} radius={7} fill="#ffffff" stroke="#00d8b8" strokeWidth={3} listening={false} />
                        <Circle x={wallPreview.x} y={wallPreview.y} radius={7} fill="#00d8b8" listening={false} />
                      </>
                    );
                  })() : (
                    <Line points={[wallDraftStart.x, wallDraftStart.y, wallPreview.x, wallPreview.y]} stroke="#00d8b8" strokeWidth={DEFAULT_WALL_THICKNESS} opacity={0.72} dash={[18, 8]} listening={false} />
                  )}
                  <Circle x={wallDraftStart.x} y={wallDraftStart.y} radius={7} fill="#00d8b8" listening={false} />
                </>
              )}
            </Group>
          </Group>
        </Layer>

        {layers?.infra !== false && routeToolActive && routePreview && (
          <Layer listening={false}>
            <Group x={viewport.x + contentOffset.x * scale} y={viewport.y + contentOffset.y * scale} scaleX={scale} scaleY={scale}>
              {(() => {
                const draftPoints = Array.isArray(routeDraft?.path) && routeDraft.path.length > 0
                  ? routeDraft.path
                  : routeStartPoint
                    ? [{ x: routeStartPoint.x, y: routeStartPoint.y }]
                    : [];
                if (draftPoints.length === 0) return null;
                return (
                  <Line
                    points={[...draftPoints, routePreview].flatMap((point) => [
                      pctToPx(point.x, DESIGN.width),
                      pctToPx(point.y, DESIGN.height),
                    ])}
                    stroke="#00d8b8"
                    strokeWidth={1.2}
                    dash={[5, 5]}
                    tension={routeDraft?.routingMode === "curved" ? 0.35 : 0}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              })()}
              <Circle
                x={pctToPx(routePreview.x, DESIGN.width)}
                y={pctToPx(routePreview.y, DESIGN.height)}
                radius={4}
                fill="#00d8b8"
              />
            </Group>
          </Layer>
        )}

        <Layer>
          <Group x={viewport.x + contentOffset.x * scale} y={viewport.y + contentOffset.y * scale} scaleX={scale} scaleY={scale}>
            {visiblePoints.map((point) => (
              <ElectricalPoint
                key={point.id}
                point={point}
                width={DESIGN.width}
                height={DESIGN.height}
                active={sameId(hover, point.id) || ((selectedElement?.type === "point" || selectedElement?.type === "pointText") && sameId(selectedElement.id, point.id))}
                selected={selectedElement?.type === "point" && sameId(selectedElement.id, point.id)}
                selectedTextField={selectedElement?.type === "pointText" && sameId(selectedElement.id, point.id) ? selectedElement.field : ""}
                showPositionLabels={showPositionLabels}
                routeToolActive={routeToolActive}
                routeStart={sameId(routeStartId, point.id)}
                onSelect={onSelectElement}
                onRoutePointClick={onRoutePointClick}
                onHover={setHover}
                onMovePoint={onMovePoint}
                onPointDoubleClick={onPointDoubleClick}
                onCircuitDoubleClick={onCircuitDoubleClick}
                onCircuitLabelSelect={(pointId) => onSelectElement?.({ type: "pointText", id: pointId, field: "circuitLabel" })}
                onPointLabelSelect={(pointId) => onSelectElement?.({ type: "pointText", id: pointId, field: "label" })}
                onPositionLabelSelect={(pointId) => onSelectElement?.({ type: "pointText", id: pointId, field: "positionLabel" })}
                onPowerLabelSelect={(pointId) => onSelectElement?.({ type: "pointText", id: pointId, field: "powerLabel" })}
                onAlignPosition={alignPosition}
                onClearAlignment={clearAlignment}
              />
            ))}
          </Group>
        </Layer>

        {(alignmentGuides || (activeTool && placementPreview)) && (
          <Layer listening={false}>
            <Group x={viewport.x + contentOffset.x * scale} y={viewport.y + contentOffset.y * scale} scaleX={scale} scaleY={scale}>
              {alignmentGuides?.x !== undefined && (
                <Line
                  points={[alignmentGuides.x, 0, alignmentGuides.x, DESIGN.height]}
                  stroke={alignmentGuides.snappedX ? "#00d8b8" : "#38BDF8"}
                  strokeWidth={alignmentGuides.snappedX ? 1.5 : 1}
                  dash={alignmentGuides.snappedX ? [12, 7] : [5, 7]}
                  opacity={alignmentGuides.snappedX ? 0.9 : 0.55}
                />
              )}
              {alignmentGuides?.y !== undefined && (
                <Line
                  points={[0, alignmentGuides.y, DESIGN.width, alignmentGuides.y]}
                  stroke={alignmentGuides.snappedY ? "#00d8b8" : "#38BDF8"}
                  strokeWidth={alignmentGuides.snappedY ? 1.5 : 1}
                  dash={alignmentGuides.snappedY ? [12, 7] : [5, 7]}
                  opacity={alignmentGuides.snappedY ? 0.9 : 0.55}
                />
              )}
              {alignmentGuides && (
                <Circle x={alignmentGuides.x} y={alignmentGuides.y} radius={5} fill="#ffffff" stroke="#00d8b8" strokeWidth={2} />
              )}
              {activeTool && placementPreview && (
                <Group x={placementPreview.x} y={placementPreview.y} opacity={0.58}>
                  <Circle radius={24} fill="#ffffff" stroke="#00d8b8" strokeWidth={1.4} dash={[5, 4]} />
                  <PlantSymbolKonva type={activeTool} />
                </Group>
              )}
            </Group>
          </Layer>
        )}
        {showDeviceDimensions && visiblePoints.length > 0 && (
          <Layer listening={!routeToolActive}>
            <Group x={viewport.x + contentOffset.x * scale} y={viewport.y + contentOffset.y * scale} scaleX={scale} scaleY={scale}>
              <DeviceDimensionsLayer
                points={visiblePoints}
                walls={walls}
                rooms={rooms}
                scalePxPerMeter={measurementScale}
                width={DESIGN.width}
                height={DESIGN.height}
                selectedElement={selectedElement}
                onSelectElement={onSelectElement}
                onUpdatePointDimension={(pointId, key, offset) => {
                  const point = points.find((item) => sameId(item.id, pointId));
                  if (!point) return;
                  onMovePoint?.(pointId, {
                    dimensionLabelOffsets: {
                      ...(point.dimensionLabelOffsets || {}),
                      [key]: offset,
                    },
                  });
                }}
              />
            </Group>
          </Layer>
        )}
      </Stage>
    </div>
  );
}
