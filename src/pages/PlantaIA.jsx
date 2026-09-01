import { Component, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { backend } from "@/api/backendClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Upload,
  Cpu, GitBranch, ChevronRight, Copy, FileText,
  Trash2, Settings2, Download, House, SquarePlus, Minus, RotateCcw,
  DoorOpen, PanelTop, Cable, MousePointer2, Spline, Type,
  Zap, Lightbulb, Network, ShieldCheck,
  AlertCircle, CheckCircle2, Coins, Calculator, ScanLine, Loader2, Save
} from "lucide-react";
import FloorPlanCanvas, { createKonvaHouseTemplate } from "@/components/planta/FloorPlanCanvas";
import { createDefaultLayerState, layerVisibilityForLegacyCanvas, normalizeLayerState } from "@/editor/layers/defaultLayers";
import { normalizePlantDocument } from "@/editor/schemas/plantDocument";
import { normalizeSnapSettings } from "@/editor/snapping/snapEngine";
import { normalizeUnitSettings } from "@/editor/units/unitSystem";
import { autoBalancePhases, buildProjectElectricalSyncPayload, calcCircuit } from "@/lib/electricalEngine";
import {
  BUDGET_MATERIAL_PRICES,
  buildConduitBudgetItems,
  estimateBudgetAccessoryQuantities,
  getBudgetDrMaterial,
} from "@/lib/budgetElectricalMaterials";
import { drawSheetFrame, drawTitleBlock } from "@/lib/professionalElectricalSheet";
import {
  addCableNode,
  cablePath,
  cableTypeForRouteSystem,
  colorForRouteSystem,
  CONDUIT_DIAMETER_OPTIONS,
  createCablePointId,
  createManualCable,
  DEFAULT_CONDUIT_DIAMETER,
  duplicateCable,
  findNearestTerminal,
  moveCable,
  normalizeCableInstallationMode,
  normalizeConduitDiameter,
  normalizeCableRoute,
  normalizeCableRoutes,
  normalizeRouteSystem,
  pointToTerminal,
  removeCableNode,
  syncCableFromPath,
  updateCableNode,
  updateCablesForMovedComponent,
  validateCableConnections,
  VALID_ROUTING_MODES,
} from "@/lib/manualCableEditor";
import {
  buildNBRCircuitDrafts,
  buildNBRRoomAnalysis,
  circuitKeyForPoint,
  formatPtNumber,
  inferNBRRoomType,
  isPointInsideRoom,
  summarizeNBRRoomAnalysis,
} from "@/lib/nbr5410RoomPlanning";
import AIAnalysisPanel from "@/components/planta/AIAnalysisPanel";
import { ElectricalSymbol, TOOL_TYPES, CATEGORY_LABELS, CATEGORY_STYLES, PLANT_SYMBOL_LABELS, CONDUIT_SYMBOLS } from "@/components/planta/ElectricalSymbols";
import PageHeader from "@/components/PageHeader";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const clampPct = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(4, Math.min(96, numeric));
};

const isFiniteCoord = (value) => Number.isFinite(Number(value));

const IMPORTABLE_PLAN_TYPES = ".png,.jpg,.jpeg,.webp,.svg,.bmp,.pdf,.dxf,.dwg";
const RENDERABLE_PLAN_TYPES = new Set(["png", "jpg", "jpeg", "webp", "svg", "bmp"]);
const TECHNICAL_PLAN_TYPES = new Set(["dxf", "dwg"]);
const EDITOR_PLAN_FRAME = { x: 45, y: 45, w: 1290, h: 770 };
const EDITOR_DESIGN_SIZE = { w: 1400, h: 900 };
const DEFAULT_SCALE_PX_PER_METER = 50;
const MIN_SCALE_PX_PER_METER = 20;
const MAX_SCALE_PX_PER_METER = 200;
const DEFAULT_DOOR_WIDTH_M = 0.9;
const DEFAULT_WINDOW_WIDTH_M = 1.2;
const LIGHT_POINT_TYPES = new Set(["luminaria", "spot", "arandela"]);
const SWITCH_POINT_TYPES = new Set(["interruptor", "inter2", "inter3", "inter3way"]);
const INFRA_POINT_TYPES = new Set(["qgbt", "qe", "caixa", "rack-cftv"]);
const SERIAL_OUTLET_POINT_TYPES = new Set(["tug"]);
const DIRECT_QD_POINT_TYPES = new Set(["arcond", "chuveiro", "motor", "tue"]);
const HEADER_ACTION_GROUP_CLASS = "flex min-w-0 flex-wrap items-center gap-1.5 rounded-[12px] border border-[#CDEFE8] bg-[#F8FBFD] px-2 py-1 shadow-[0_1px_0_rgba(15,23,42,0.04)]";
const HEADER_ACTION_LABEL_CLASS = "mr-1 hidden shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-[#64748B] xl:inline-flex";
const POINT_TOOL_IDS = new Set(TOOL_TYPES.map((tool) => tool.id));
const TOOL_DEFINITIONS_BY_ID = Object.freeze(Object.fromEntries(TOOL_TYPES.map((tool) => [String(tool.id), tool])));
const ROUTE_INSTALLATION_OPTIONS = Object.freeze([
  { id: "embutido", label: "Teto/Parede" },
  { id: "piso", label: "Piso" },
  { id: "externa", label: "Externo/Aparente" },
  { id: "sobe", label: "Sobe" },
  { id: "desce", label: "Desce" },
]);
const ROUTE_INSTALLATION_LABELS = Object.freeze(Object.fromEntries(
  ROUTE_INSTALLATION_OPTIONS.map((option) => [option.id, option.label])
));
const POINT_TEXT_HIDDEN_FIELD_BY_SELECTION = Object.freeze({
  label: "labelHidden",
  circuitLabel: "circuitLabelHidden",
  positionLabel: "positionLabelHidden",
  powerLabel: "powerLabelHidden",
});
const POINT_TEXT_SELECTION_LABELS = Object.freeze({
  label: "Texto do símbolo",
  circuitLabel: "Texto do circuito",
  positionLabel: "Texto de altura",
  powerLabel: "Texto de potência",
});

const pointTextHiddenPatch = (field, hidden = true) => {
  const property = POINT_TEXT_HIDDEN_FIELD_BY_SELECTION[field] || "circuitLabelHidden";
  return { [property]: hidden };
};

const hasHiddenPointText = (point = {}) => (
  Object.values(POINT_TEXT_HIDDEN_FIELD_BY_SELECTION).some((field) => point?.[field] === true)
);

const firstTextValue = (...values) => (
  values
    .map((value) => String(value ?? "").trim())
    .find(Boolean) || ""
);

const pointToolIdCandidates = (point = {}) => {
  if (!point || typeof point !== "object") return [];
  return [
    point.toolId,
    point.tool_id,
    point.type,
    point.itemType,
    point.item_type,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
};

const resolvePlantToolId = (point = {}) => (
  pointToolIdCandidates(point).find((candidate) => POINT_TOOL_IDS.has(candidate)) || ""
);

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
  baixa: "Baixa (0,30 m)",
  media: "Média (1,20 m)",
  alta: "Alta (2,00 m)",
  teto: "Teto",
};

const defaultPointHeight = (type = "") => DEFAULT_POINT_HEIGHT_BY_TYPE[type] || "baixa";
const normalizeLegacySensorLabel = (label = "") => (
  String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
);

/** @param {any} point */
const normalizePlantPointForEditor = (point = {}, index = 0) => {
  if (!point || typeof point !== "object") return null;
  const rawType = String(point.type || "").trim();
  const type = POINT_TOOL_IDS.has(rawType) ? rawType : "";
  if (!type) return null;

  const xValue = point.x_pct ?? point.x;
  const yValue = point.y_pct ?? point.y;
  if (!isFiniteCoord(xValue) || !isFiniteCoord(yValue)) return null;

  const tool = TOOL_TYPES.find((item) => item.id === type);
  const incomingLabel = String(point.label || "").trim();
  const normalizedLabel = normalizeLegacySensorLabel(incomingLabel);
  const displayLabel = type === "sensor" && (!incomingLabel || normalizedLabel.includes("sensor") || normalizedLabel.includes("presenca"))
    ? "WIFI"
    : incomingLabel || tool?.label || type;
  const rotation = Number(point.rotation);
  const loadW = Number(point.load_w);

  return {
    ...point,
    id: String(point.id || `point-${index + 1}`),
    type,
    label: displayLabel,
    x: clampPct(xValue, 50),
    y: clampPct(yValue, 50),
    rotation: Number.isFinite(rotation) ? rotation : 0,
    load_w: Number.isFinite(loadW) ? loadW : 0,
    height: point.height || point.height_type || defaultPointHeight(type),
  };
};

const normalizePlantPointsForEditor = (items = []) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((point, index) => normalizePlantPointForEditor(point, index))
    .filter((point) => {
      if (!point) return false;
      if (seen.has(point.id)) {
        point.id = `${point.id}-${seen.size + 1}`;
      }
      seen.add(point.id);
      return true;
    });
};

class PlantaCanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Erro ao renderizar a planta:", error, errorInfo);
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleRetry() {
    this.setState({ hasError: false });
    this.props.onReset?.();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-[#F2FFFC] p-6">
        <div className="max-w-md rounded-md border border-[#CDEFE8] bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-black text-[#0F172A]">Não foi possível renderizar uma parte da planta.</p>
          <p className="mt-2 text-xs font-bold text-[#64748B]">
            Seus dados foram preservados.
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-[#00d8b8] px-4 py-2 text-sm font-black text-white hover:bg-[#00a98e]"
            onClick={this.handleRetry}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
}

const getFileExtension = (file) => {
  const name = file?.name || "";
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
};

const formatFileSize = (size = 0) => {
  if (!size) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const normalizeScalePxPerMeter = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SCALE_PX_PER_METER;
  return Math.max(MIN_SCALE_PX_PER_METER, Math.min(MAX_SCALE_PX_PER_METER, numeric));
};

const clampWallPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));

const normalizeRoomKey = (value = "") => String(value || "sem ambiente")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const readFileAsArrayBuffer = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsArrayBuffer(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const fitPlanToEditorFrame = (width, height) => {
  const sourceRatio = width / Math.max(1, height);
  const frameRatio = EDITOR_PLAN_FRAME.w / EDITOR_PLAN_FRAME.h;
  if (sourceRatio >= frameRatio) {
    const fittedHeight = EDITOR_PLAN_FRAME.w / sourceRatio;
    return {
      x: EDITOR_PLAN_FRAME.x,
      y: EDITOR_PLAN_FRAME.y + (EDITOR_PLAN_FRAME.h - fittedHeight) / 2,
      w: EDITOR_PLAN_FRAME.w,
      h: fittedHeight,
    };
  }
  const fittedWidth = EDITOR_PLAN_FRAME.h * sourceRatio;
  return {
    x: EDITOR_PLAN_FRAME.x + (EDITOR_PLAN_FRAME.w - fittedWidth) / 2,
    y: EDITOR_PLAN_FRAME.y,
    w: fittedWidth,
    h: EDITOR_PLAN_FRAME.h,
  };
};

const isDarkPlanPixel = (data, index) => {
  if (data[index + 3] < 24) return false;
  const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  return luminance < 232;
};

const rangesOverlap = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

const mergeAxisRuns = (runs, axis, width, height) => {
  const groups = [];
  const maxDistance = Math.max(2, Math.round((axis === "h" ? height : width) * 0.004));

  runs.forEach((run) => {
    const match = groups.find((group) => (
      run.p - group.lastP <= maxDistance &&
      rangesOverlap(run.a1, run.a2, group.a1, group.a2) >= Math.min(run.a2 - run.a1, group.a2 - group.a1) * 0.42
    ));

    if (!match) {
      groups.push({ ...run, p1: run.p, p2: run.p, lastP: run.p, count: 1 });
      return;
    }

    match.a1 = Math.min(match.a1, run.a1);
    match.a2 = Math.max(match.a2, run.a2);
    match.p1 = Math.min(match.p1, run.p);
    match.p2 = Math.max(match.p2, run.p);
    match.lastP = run.p;
    match.count += 1;
  });

  const minLength = Math.max(36, (axis === "h" ? width : height) * 0.035);
  return groups
    .filter((group) => group.a2 - group.a1 >= minLength)
    .map((group) => {
      const thickness = Math.max(1, group.p2 - group.p1 + 1);
      if (axis === "h") {
        return {
          x1: group.a1,
          y1: (group.p1 + group.p2) / 2,
          x2: group.a2,
          y2: (group.p1 + group.p2) / 2,
          thickness,
        };
      }
      return {
        x1: (group.p1 + group.p2) / 2,
        y1: group.a1,
        x2: (group.p1 + group.p2) / 2,
        y2: group.a2,
        thickness,
      };
    });
};

const extractAxisPlanLines = (imageData, width, height, axis) => {
  const data = imageData.data;
  const primary = axis === "h" ? height : width;
  const secondary = axis === "h" ? width : height;
  const maxGap = Math.max(2, Math.round(secondary * 0.003));
  const minLength = Math.max(34, secondary * 0.03);
  const minDensity = 0.58;
  const runs = [];

  for (let p = 0; p < primary; p += 1) {
    let start = -1;
    let darkCount = 0;
    let gap = 0;

    const closeRun = (end) => {
      if (start < 0) return;
      const length = end - start + 1;
      if (length >= minLength && darkCount / length >= minDensity) {
        runs.push({ p, a1: start, a2: end });
      }
      start = -1;
      darkCount = 0;
      gap = 0;
    };

    for (let s = 0; s < secondary; s += 1) {
      const x = axis === "h" ? s : p;
      const y = axis === "h" ? p : s;
      const dark = isDarkPlanPixel(data, (y * width + x) * 4);
      if (dark) {
        if (start < 0) start = s;
        darkCount += 1;
        gap = 0;
      } else if (start >= 0) {
        gap += 1;
        if (gap > maxGap) closeRun(s - gap);
      }
    }
    closeRun(secondary - 1 - gap);
  }

  return mergeAxisRuns(runs, axis, width, height);
};

const extractPlanLineSegments = (imageData, width, height) => {
  const horizontal = extractAxisPlanLines(imageData, width, height, "h");
  const vertical = extractAxisPlanLines(imageData, width, height, "v");
  return [...horizontal, ...vertical]
    .sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))
    .slice(0, 900);
};

const buildImportedPlanElements = ({ width, height, lines = [], texts = [] }) => {
  const layout = fitPlanToEditorFrame(width, height);
  const mapX = (x) => layout.x + (x / Math.max(1, width)) * layout.w;
  const mapY = (y) => layout.y + (y / Math.max(1, height)) * layout.h;
  const scale = Math.min(layout.w / Math.max(1, width), layout.h / Math.max(1, height));

  return {
    imageLayout: layout,
    importedPlanElements: {
      lines: lines.map((line, index) => ({
        id: `import-line-${index}`,
        x1: mapX(line.x1),
        y1: mapY(line.y1),
        x2: mapX(line.x2),
        y2: mapY(line.y2),
        strokeWidth: Math.max(0.7, Math.min(3.8, (line.thickness || 1) * scale * 0.65)),
      })),
      texts: texts
        .filter((text) => text.text && text.text.length > 1)
        .slice(0, 260)
        .map((text, index) => ({
          id: `import-text-${index}`,
          x: mapX(text.x),
          y: mapY(text.y),
          width: Math.max(28, Math.min(360, (text.w || 80) * scale + 12)),
          text: text.text,
          fontSize: Math.max(5, Math.min(18, (text.fontSize || 9) * scale * 1.8)),
        })),
    },
  };
};

const normalizePlantDesign = (design) => normalizePlantDocument(design, {
  defaultScalePxPerMeter: DEFAULT_SCALE_PX_PER_METER,
});

const sameId = (a, b) => String(a) === String(b);
const pctToPx = (value, total) => (Number(value || 0) / 100) * total;
const pxToPct = (value, total) => Math.max(0, Math.min(100, (Number(value || 0) / total) * 100));
const WALL_CONNECTION_TOLERANCE_PX = 2;
const wallPxGeometry = (wall = {}) => {
  const x1 = pctToPx(wall.x1, EDITOR_DESIGN_SIZE.w);
  const y1 = pctToPx(wall.y1, EDITOR_DESIGN_SIZE.h);
  const x2 = pctToPx(wall.x2, EDITOR_DESIGN_SIZE.w);
  const y2 = pctToPx(wall.y2, EDITOR_DESIGN_SIZE.h);
  const cx = pctToPx(wall.cx ?? (Number(wall.x1 || 0) + Number(wall.x2 || 0)) / 2, EDITOR_DESIGN_SIZE.w);
  const cy = pctToPx(wall.cy ?? (Number(wall.y1 || 0) + Number(wall.y2 || 0)) / 2, EDITOR_DESIGN_SIZE.h);
  return { x1, y1, x2, y2, cx, cy, length: Math.hypot(x2 - x1, y2 - y1) };
};

const refineDarkBounds = (imageData, width, height, bounds) => {
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const startX = Math.max(0, bounds.x);
  const startY = Math.max(0, bounds.y);
  const endX = Math.min(width, bounds.x + bounds.w);
  const endY = Math.min(height, bounds.y + bounds.h);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * width + x) * 4;
      if (!isDarkPlanPixel(data, index)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  const padding = Math.round(Math.max(28, Math.min(width, height) * 0.025));
  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    w: Math.min(width, maxX + padding) - Math.max(0, minX - padding),
    h: Math.min(height, maxY + padding) - Math.max(0, minY - padding),
  };
};

const findPlanCropBounds = (imageData, width, height) => {
  const block = Math.max(6, Math.round(Math.max(width, height) / 280));
  const cols = Math.ceil(width / block);
  const rows = Math.ceil(height / block);
  const darkCounts = new Uint16Array(cols * rows);
  const active = new Uint8Array(cols * rows);
  const data = imageData.data;

  for (let y = 0; y < height; y += 1) {
    const cellY = Math.floor(y / block);
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (!isDarkPlanPixel(data, index)) continue;
      darkCounts[cellY * cols + Math.floor(x / block)] += 1;
    }
  }

  const marginX = Math.max(1, Math.round(cols * 0.025));
  const marginY = Math.max(1, Math.round(rows * 0.025));
  const minDarkPixels = Math.max(2, Math.round(block * block * 0.018));
  for (let row = marginY; row < rows - marginY; row += 1) {
    for (let col = marginX; col < cols - marginX; col += 1) {
      const index = row * cols + col;
      if (darkCounts[index] >= minDarkPixels) active[index] = 1;
    }
  }

  for (let row = 0; row < rows; row += 1) {
    let count = 0;
    for (let col = 0; col < cols; col += 1) count += active[row * cols + col];
    if (count > cols * 0.62) {
      for (let col = 0; col < cols; col += 1) active[row * cols + col] = 0;
    }
  }

  for (let col = 0; col < cols; col += 1) {
    let count = 0;
    for (let row = 0; row < rows; row += 1) count += active[row * cols + col];
    if (count > rows * 0.62) {
      for (let row = 0; row < rows; row += 1) active[row * cols + col] = 0;
    }
  }

  const dilated = new Uint8Array(cols * rows);
  const radius = 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!active[row * cols + col]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nextCol = col + dx;
          const nextRow = row + dy;
          if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= rows) continue;
          dilated[nextRow * cols + nextCol] = 1;
        }
      }
    }
  }

  const visited = new Uint8Array(cols * rows);
  const queue = [];
  let best = null;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const start = row * cols + col;
      if (!dilated[start] || visited[start]) continue;
      let minCol = col;
      let maxCol = col;
      let minRow = row;
      let maxRow = row;
      let cells = 0;
      let originalHits = 0;
      queue.length = 0;
      queue.push(start);
      visited[start] = 1;

      for (let pointer = 0; pointer < queue.length; pointer += 1) {
        const current = queue[pointer];
        const currentCol = current % cols;
        const currentRow = Math.floor(current / cols);
        minCol = Math.min(minCol, currentCol);
        maxCol = Math.max(maxCol, currentCol);
        minRow = Math.min(minRow, currentRow);
        maxRow = Math.max(maxRow, currentRow);
        cells += 1;
        if (active[current]) originalHits += 1;

        const neighbors = [current - 1, current + 1, current - cols, current + cols];
        neighbors.forEach((neighbor) => {
          if (neighbor < 0 || neighbor >= dilated.length || visited[neighbor] || !dilated[neighbor]) return;
          const neighborCol = neighbor % cols;
          if (Math.abs(neighborCol - currentCol) > 1) return;
          visited[neighbor] = 1;
          queue.push(neighbor);
        });
      }

      const cropW = (maxCol - minCol + 1) * block;
      const cropH = (maxRow - minRow + 1) * block;
      const relativeW = cropW / width;
      const relativeH = cropH / height;
      if (relativeW < 0.12 || relativeH < 0.12) continue;
      const aspect = cropW / Math.max(1, cropH);
      const thinPenalty = aspect > 4.2 || aspect < 0.24 ? 0.22 : 1;
      const score = originalHits * Math.sqrt(cells) * thinPenalty;
      if (!best || score > best.score) {
        best = {
          score,
          x: Math.max(0, minCol * block),
          y: Math.max(0, minRow * block),
          w: Math.min(width, (maxCol + 1) * block) - Math.max(0, minCol * block),
          h: Math.min(height, (maxRow + 1) * block) - Math.max(0, minRow * block),
        };
      }
    }
  }

  if (!best) return null;
  const refined = refineDarkBounds(imageData, width, height, best);
  if (!refined) return null;
  const areaRatio = (refined.w * refined.h) / (width * height);
  return areaRatio > 0.9 ? null : refined;
};

const renderPdfFirstPage = async (file) => {
  const data = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const targetWidth = 2200;
  const scale = Math.min(3, Math.max(1.2, targetWidth / Math.max(1, baseViewport.width)));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport }).promise;
  const textContent = await page.getTextContent();
  const texts = textContent.items
    .map((item, index) => {
      const rawText = String(item.str || "").replace(/\s+/g, " ").trim();
      if (!rawText) return null;
      const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontSize = Math.max(6, Math.hypot(transform[2], transform[3]));
      const width = Math.max(fontSize * rawText.length * 0.45, (Number(item.width) || rawText.length * 4) * scale);
      return {
        id: `pdf-text-${index}`,
        text: rawText,
        x: transform[4],
        y: transform[5] - fontSize,
        w: width,
        h: fontSize * 1.25,
        fontSize,
      };
    })
    .filter(Boolean);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
    width: canvas.width,
    height: canvas.height,
    texts,
  };
};

const enhancePlanImage = async (src, options = {}) => {
  const image = await loadImage(src);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  let width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  let height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  let extractedTexts = (options.texts || []).map((text) => ({
    ...text,
    x: Number(text.x || 0) * scale,
    y: Number(text.y || 0) * scale,
    w: Number(text.w || 0) * scale,
    h: Number(text.h || text.fontSize || 8) * scale,
    fontSize: Number(text.fontSize || 8) * scale,
  }));
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  let imageData = ctx.getImageData(0, 0, width, height);
  let cropped = false;
  const cropBounds = findPlanCropBounds(imageData, width, height);
  if (cropBounds) {
    const croppedCanvas = document.createElement("canvas");
    const croppedCtx = croppedCanvas.getContext("2d", { willReadFrequently: true });
    croppedCanvas.width = cropBounds.w;
    croppedCanvas.height = cropBounds.h;
    croppedCtx.fillStyle = "#ffffff";
    croppedCtx.fillRect(0, 0, cropBounds.w, cropBounds.h);
    croppedCtx.drawImage(
      canvas,
      cropBounds.x,
      cropBounds.y,
      cropBounds.w,
      cropBounds.h,
      0,
      0,
      cropBounds.w,
      cropBounds.h,
    );
    canvas = croppedCanvas;
    ctx = croppedCtx;
    width = cropBounds.w;
    height = cropBounds.h;
    extractedTexts = extractedTexts
      .filter((text) => {
        const centerX = text.x + (text.w || 0) / 2;
        const centerY = text.y + (text.h || 0) / 2;
        return centerX >= cropBounds.x && centerX <= cropBounds.x + cropBounds.w
          && centerY >= cropBounds.y && centerY <= cropBounds.y + cropBounds.h;
      })
      .map((text) => ({
        ...text,
        x: text.x - cropBounds.x,
        y: text.y - cropBounds.y,
      }));
    imageData = ctx.getImageData(0, 0, width, height);
    cropped = true;
  }

  const lines = extractPlanLineSegments(imageData, width, height);
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const boosted = luminance < 210 ? Math.max(0, (luminance - 128) * 1.55 + 96) : Math.min(255, luminance + 22);
    const value = boosted < 232 ? Math.max(0, boosted - 18) : 255;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
    cropped,
    width,
    height,
    lines,
    texts: extractedTexts,
  };
};

const prepareImportedPlanFromFile = async (file, extension, metadata) => {
  let localUrl = "";
  let imageLayoutNext = null;
  let importedPlanElementsNext = { lines: [], texts: [] };
  let status = `${metadata} importado com realce de linhas e contraste.`;

  try {
    const rendered = extension === "pdf"
      ? await renderPdfFirstPage(file)
      : { dataUrl: await readFileAsDataUrl(file), texts: [] };
    const enhanced = extension === "svg"
      ? { dataUrl: rendered.dataUrl, cropped: false, width: rendered.width || 1200, height: rendered.height || 800, lines: [], texts: rendered.texts || [] }
      : await enhancePlanImage(rendered.dataUrl, { texts: rendered.texts || [] });
    const importedPlan = buildImportedPlanElements(enhanced);
    localUrl = enhanced.dataUrl;
    imageLayoutNext = importedPlan.imageLayout;
    importedPlanElementsNext = importedPlan.importedPlanElements;
    const lineCount = importedPlanElementsNext.lines.length;
    const textCount = importedPlanElementsNext.texts.length;
    if (enhanced.cropped) {
      status = `${metadata} convertido para o editor: ${lineCount} linhas e ${textCount} textos da planta.`;
    } else if (extension === "pdf") {
      status = `${metadata} convertido para o editor: ${lineCount} linhas e ${textCount} textos da pagina 1.`;
    }
  } catch {
    localUrl = URL.createObjectURL(file);
    imageLayoutNext = null;
    importedPlanElementsNext = { lines: [], texts: [] };
    status = `${metadata} importado sem realce automático.`;
  }

  return {
    imageUrl: localUrl,
    imageLayout: imageLayoutNext,
    importedPlanElements: importedPlanElementsNext,
    importStatus: status,
  };
};

const normalizeAiToolType = (type = "", label = "") => {
  const source = `${type} ${label}`.toLowerCase();
  if (source.includes("qgbt") || source.includes("quadro geral")) return "qgbt";
  if (source.includes("rack") || source.includes("dvr") || source.includes("nvr")) return "rack-cftv";
  if (source.includes("quadro") || source.includes("qd") || source.includes("qe")) return "qe";
  if (source.includes("caixa") || source.includes("passagem") || source.includes("deriv")) return "caixa";
  if (source.includes("lumin") || source.includes("lamp") || source.includes("ilumina")) return "luminaria";
  if (source.includes("spot")) return "spot";
  if (source.includes("arandela")) return "arandela";
  if (source.includes("três seções") || source.includes("tres secoes") || source.includes("3 seções") || source.includes("3 secoes")) return "inter3";
  if (source.includes("duas seções") || source.includes("duas secoes") || source.includes("2 seções") || source.includes("2 secoes")) return "inter2";
  if (source.includes("three-way") || source.includes("paralelo")) return "inter3way";
  if (source.includes("interruptor") || source.includes("comando")) return "interruptor";
  if (source.includes("chuveiro")) return "chuveiro";
  if (source.includes("condicionado") || source.includes("split")) return "arcond";
  if (source.includes("motor") || source.includes("bomba")) return "motor";
  if (source.includes("tue") || source.includes("uso específico") || source.includes("força") || source.includes("forca")) return "tue";
  if (source.includes("tomada") || source.includes("tug")) return "tug";
  if (source.includes("sensor")) return "sensor";
  if (source.includes("camera") || source.includes("câmera") || source.includes("cftv")) return "camera";
  if (source.includes("rede") || source.includes("dados")) return "rede";
  return "caixa";
};

const normalizeCircuitType = (type = "") => {
  const source = String(type).toLowerCase();
  if (source.includes("ilumina")) return "Iluminação";
  if (source.includes("tue") || source.includes("espec")) return "Tomadas de Uso Específico";
  if (source.includes("força") || source.includes("forca")) return "Tomadas de Uso Específico";
  if (source.includes("ar")) return "Ar Condicionado";
  if (source.includes("chuveiro")) return "Chuveiro";
  if (source.includes("motor")) return "Motor";
  if (source.includes("bomba")) return "Bomba Hidráulica";
  if (source.includes("cftv")) return "CFTV";
  if (source.includes("nobreak")) return "Nobreak";
  if (source.includes("servidor")) return "Servidor";
  return "Tomadas de Uso Geral";
};

const CIRCUIT_CONFIG_POINT_TYPES = new Set(["tug", "tue", "arcond", "chuveiro", "motor", ...LIGHT_POINT_TYPES]);

const POINT_CIRCUIT_DEFAULTS = {
  luminaria: {
    type: "Iluminação",
    name: "Iluminação",
    power_w: 100,
    voltage: 127,
    supply_type: "Monofásico",
    power_factor: 0.92,
  },
  spot: {
    type: "Iluminação",
    name: "Circuito de spots",
    power_w: 50,
    voltage: 127,
    supply_type: "Monofásico",
    power_factor: 0.92,
  },
  arandela: {
    type: "Iluminação",
    name: "Circuito de arandelas",
    power_w: 60,
    voltage: 127,
    supply_type: "Monofásico",
    power_factor: 0.92,
  },
  tug: {
    type: "Tomadas de Uso Geral",
    name: "Tomadas de Uso Geral",
    power_w: 100,
    voltage: 127,
    supply_type: "Monofásico",
    power_factor: 1,
  },
  tue: {
    type: "Tomadas de Uso Específico",
    name: "Tomada de Uso Específico",
    power_w: 2000,
    voltage: 220,
    supply_type: "Monofásico",
    power_factor: 1,
  },
  arcond: {
    type: "Ar Condicionado",
    name: "Ar condicionado",
    power_w: 1500,
    voltage: 220,
    supply_type: "Bifásico",
    power_factor: 0.92,
  },
  chuveiro: {
    type: "Chuveiro",
    name: "Chuveiro",
    power_w: 5500,
    voltage: 220,
    supply_type: "Monofásico",
    power_factor: 1,
  },
  motor: {
    type: "Motor",
    name: "Motor",
    power_w: 1500,
    voltage: 220,
    supply_type: "Trifásico",
    power_factor: 0.85,
  },
};

const CIRCUIT_FORM_EMPTY = {
  circuit_id: "",
  name: "",
  description: "",
  type: "Tomadas de Uso Geral",
  power_w: "",
  voltage: "127",
  supply_type: "Monofásico",
  power_factor: "1",
  length_m: "15",
  install_method: "Eletroduto Embutido em Parede",
  temp_ambient: "30",
  group_count: "1",
  point_count: "1",
  demand_factor: "1",
};

const CIRCUIT_SUPPLY_TYPES = ["Monofásico", "Bifásico", "Trifásico"];
const CIRCUIT_VOLTAGES = [127, 220, 380, 440, 480];
const CIRCUIT_INSTALL_METHODS = [
  "Eletroduto Embutido em Parede",
  "Eletroduto Aparente",
  "Cabo Multipolar Fixado",
  "Bandeja Perfurada",
  "Enterrado Direto no Solo",
  "Eletroduto Enterrado",
];

const circuitIdentifier = (circuit, index = 0) => String(circuit?.id || circuit?.circuit_id || circuit?.name || `circuit-${index}`);

const isCircuitConfigurablePoint = (point) => CIRCUIT_CONFIG_POINT_TYPES.has(String(point?.type || ""));

const getPointCircuitDefaults = (point = {}, project = {}) => {
  const defaults = POINT_CIRCUIT_DEFAULTS[point.type] || POINT_CIRCUIT_DEFAULTS.tug;
  const pointLabel = String(point.label || "").trim();
  const baseName = pointLabel && pointLabel !== point.type ? pointLabel : defaults.name;
  return {
    ...defaults,
    name: point.circuit || `${baseName} - planta`,
    power_w: Number(point.load_w) || defaults.power_w,
    voltage: Number(point.voltage) || defaults.voltage || project?.voltage || 127,
    supply_type: point.supply_type || defaults.supply_type || project?.supply_type || "Monofásico",
    length_m: Number(point.length_m) || 15,
  };
};

const conductorCountForCircuit = (circuit = {}) => {
  if (circuit.supply_type === "Trifásico" || circuit.phase === "ABC") return 5;
  if (circuit.supply_type === "Bifásico" || String(circuit.phase || "").length === 2 || Number(circuit.breaker_poles) === 2) return 3;
  return 3;
};

const wireAreaFromCircuit = (circuit = {}) => {
  if (Number(circuit.wire_area)) return Number(circuit.wire_area);
  const match = String(circuit.wire_gauge || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 2.5;
};

const estimateConduitDiameter = (circuit = {}) => {
  const area = wireAreaFromCircuit(circuit);
  const conductors = conductorCountForCircuit(circuit);
  if (area <= 2.5 && conductors <= 3) return '3/4"';
  if (area <= 4 && conductors <= 3) return '3/4"';
  if (area <= 6 && conductors <= 4) return '1"';
  if (area <= 10 || conductors >= 5) return '1 1/4"';
  return '1 1/2"';
};

const enrichCircuitInstallation = (circuit = {}) => {
  const conductorCount = conductorCountForCircuit(circuit);
  const conduitDiameter = circuit.conduit_diameter || estimateConduitDiameter(circuit);
  return {
    ...circuit,
    conductor_count: conductorCount,
    conduit_diameter: conduitDiameter,
    cable_description: `${conductorCount} condutores ${circuit.wire_gauge || "2.5mm²"}`,
  };
};

const fallbackPosition = (index, copy = 0) => ({
  x: 18 + (index % 4) * 20 + copy * 2,
  y: 18 + Math.floor(index / 4) * 14 + copy * 2,
});

const TOOL_DETAIL = {
  arandela: "parede",
  spot: "fluorescente no teto",
  luminaria: "incandescente no teto",
  interruptor: "uma seção",
  inter2: "duas seções",
  inter3: "três seções",
  inter3way: "paralelo / three-way",
  tue: "tomada 130 cm",
  arcond: "equipamento split",
  tug: "tomada baixa 30 cm",
  chuveiro: "tomada chuveiro",
  qgbt: "quadro geral baixa tensão",
  qe: "distribuição",
  caixa: "passagem 4x4",
  "rack-cftv": "rack CFTV",
  rede: "telefone/dados 300 mm",
  motor: "força motriz",
  sensor: "WIFI",
  camera: "CFTV",
};

const CAD_TOOL_GROUPS = [
  {
    id: "tomadas",
    title: "Tomadas",
    icon: Zap,
    tools: ["tue", "arcond", "tug", "chuveiro", "motor"],
  },
  {
    id: "iluminacao",
    title: "Iluminacao",
    icon: Lightbulb,
    tools: ["arandela", "spot", "luminaria", "interruptor", "inter2", "inter3", "inter3way"],
  },
  {
    id: "infra",
    title: "Infraestrutura e dados",
    icon: Network,
    tools: ["qgbt", "qe", "caixa", "rack-cftv", "rede", "sensor", "camera"],
  },
];

const normalizePanelBoards = (project) => {
  const rawBoards = project?.panel_boards;
  if (Array.isArray(rawBoards) && rawBoards.length > 0) {
    return rawBoards.map((board, index) => ({
      id: board.id || `board_${index + 1}`,
      name: board.name || (index === 0 ? "QD-01 Principal" : `QD-${String(index + 1).padStart(2, "0")}`),
      location: board.location || (index === 0 ? "Entrada / Distribuição" : "Distribuição"),
      type: board.type || (index === 0 ? "principal" : "secundario"),
      layout: board.layout || { rails: [], wires: [] },
    }));
  }

  if (project?.panel_layout) {
    return [{
      id: "board_1",
      name: "QD-01 Principal",
      location: "Entrada / Distribuição",
      type: "principal",
      layout: typeof project.panel_layout === "object" ? project.panel_layout : { rails: [], wires: [] },
    }];
  }

  return [];
};

const isDistributionPanelBoard = (board = {}) => (
  !["qgbt", "solar_ac"].includes(String(board.type || "").toLowerCase())
);

const applyPlantBoardMetadata = (boards = [], {
  boardPoint = null,
  panelLayout,
  infraType,
  fallbackLocation = "Entrada / Distribuição",
  targetRoomName = "",
} = {}) => {
  const targetIndex = boards.findIndex(isDistributionPanelBoard);
  if (targetIndex < 0) return boards;

  return boards.map((board, index) => (
    index === targetIndex
      ? {
          ...board,
          name: boardPoint?.label || board.name || (boardPoint?.type === "qgbt" ? "QGBT Geral" : "QD-01 Principal"),
          location: boardPoint?.room || targetRoomName.trim() || board.location || fallbackLocation,
          type: boardPoint?.type === "qgbt" ? "geral" : board.type || "principal",
          x_pct: boardPoint?.x ?? board.x_pct,
          y_pct: boardPoint?.y ?? board.y_pct,
          infra_type: infraType ?? board.infra_type,
          layout: panelLayout,
        }
      : board
  ));
};

const getBoardUsedModules = (board) => (
  (board?.layout?.rails || []).reduce((total, rail) => (
    total + (rail.components || [])
      .filter((component) => component.type !== "spacer")
      .reduce((sum, component) => sum + (Number(component.poles) || 0), 0)
  ), 0)
);

const normalizeSuggestedPoints = (suggestions = [], baseIndex = 0) => {
  const normalized = [];
  suggestions.forEach((item, index) => {
    const qty = Math.max(1, Math.min(12, Number(item.quantity) || 1));
    for (let copy = 0; copy < qty; copy++) {
      const fallback = fallbackPosition(baseIndex + index, copy);
      const type = normalizeAiToolType(item.type, item.label);
      const tool = TOOL_TYPES.find(t => t.id === type);
      normalized.push({
        id: Date.now() + normalized.length + copy,
        type,
        label: item.label || tool?.label || type,
        x: clampPct(item.x_pct ?? item.x, fallback.x),
        y: clampPct(item.y_pct ?? item.y, fallback.y),
        circuit: item.circuit_type || item.circuit_name || null,
        load_w: Number(item.load_w) || 0,
        room: item.room || "",
      });
    }
  });
  return normalized;
};

const normalizeRoutes = (routes = []) => routes
  .map((route, index) => {
    const path = Array.isArray(route.path) ? route.path : Array.isArray(route.points) ? route.points : [];
    const normalizedPath = path
      .map((point) => ({
        x: clampPct(point.x_pct ?? point.x, null),
        y: clampPct(point.y_pct ?? point.y, null),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    return normalizeCableRoute({
      id: `route-${Date.now()}-${index}`,
      name: route.name || route.label || route.circuit_name || `Cabo ${index + 1}`,
      label: route.label || route.circuit_name || `Cabo ${index + 1}`,
      description: route.description || "",
      path: normalizedPath,
      mode: route.mode || (route.infraType === "galvanizado" ? "externa" : "embutido"),
      routingMode: route.routingMode || (route.infraType === "galvanizado" ? "orthogonal" : "curved"),
      ...(() => {
        const systemType = normalizeRouteSystem(route.systemType || route.system_type || route.system || route.type || route.label || route.description);
        return {
          systemType,
          type: cableTypeForRouteSystem(systemType),
          color: route.color || colorForRouteSystem(systemType),
        };
      })(),
      gauge: route.gauge || route.wire_gauge || "",
      conduit_diameter: normalizeConduitDiameter(
        route.conduit_diameter || route.conduitDiameter || route.eletroduto || route.diameter || route.description,
        DEFAULT_CONDUIT_DIAMETER,
      ),
      thickness: route.thickness,
    }, index);
  })
  .filter((route) => route.path.length >= 2);

const normalizeProjectCircuits = (circuits = []) => (
  (Array.isArray(circuits) ? circuits : []).map((circuit, index) => enrichCircuitInstallation({
    ...circuit,
    id: circuit.id || circuit.circuit_id || `circuit-${index + 1}`,
    name: circuit.name || `Circuito ${index + 1}`,
    type: normalizeCircuitType(circuit.type),
    power_w: circuit.power_w || circuit.load_w_total || 1000,
    load_w_total: circuit.load_w_total || circuit.power_w || 1000,
    supply_type: circuit.supply_type || "Monofásico",
    voltage: circuit.voltage || 220,
    phase: circuit.phase || "A",
    length_m: circuit.length_m || 20,
  }))
);

const normalizeScannerBudgetItems = (items = [], stamp = Date.now()) => (
  (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const qty = Math.max(0, Number(item.qty ?? item.quantity) || 0);
      const price = Math.max(0, Number(item.unit_price ?? item.pricePerUnit ?? item.price) || 0);
      if (!item.name || qty <= 0) return null;
      return {
        id: `scanner-${stamp}-${index}`,
        name: String(item.name),
        qty,
        price: Math.round(price * 100) / 100,
        unit: item.unit || "un",
        category: item.category || "scanner",
        note: item.note || "",
        source: "scanner-planta-ia",
      };
    })
    .filter(Boolean)
);

const countPlantPointTypes = (plantPoints = []) => {
  const counts = {
    tug: 0,
    tue: 0,
    arcond: 0,
    chuveiro: 0,
    motor: 0,
    luminaria: 0,
    spot: 0,
    arandela: 0,
    interruptor: 0,
    inter2: 0,
    inter3: 0,
    inter3way: 0,
    qgbt: 0,
    qe: 0,
    caixa: 0,
    "rack-cftv": 0,
    sensor: 0,
    camera: 0,
    rede: 0,
  };
  plantPoints.forEach((point) => {
    if (counts[point.type] !== undefined) counts[point.type] += 1;
  });
  return counts;
};

const buildPlantBudgetItems = ({ plantPoints = [], plantRoutes = [], circuits = [], infraType = "embutido", projectSupplyType = "", scalePxPerMeter = DEFAULT_SCALE_PX_PER_METER } = {}) => {
  const counts = countPlantPointTypes(plantPoints);
  const fallbackConduitMeters = (counts.tug + counts.tue + counts.chuveiro + counts.arcond) * 4 + (counts.luminaria + counts.spot) * 3;
  const conduitItems = buildConduitBudgetItems({
    plantRoutes,
    infraType,
    scalePxPerMeter,
    fallbackMeters: Math.max(10, fallbackConduitMeters),
  });
  const conduitCalculated = Math.max(10, conduitItems.reduce((sum, item) => sum + item.qty, 0));
  const cableFactor = 3.2;
  const wire1_5 = Math.round((conduitCalculated * 0.35) * cableFactor);
  const wire2_5 = Math.round((conduitCalculated * 0.50) * cableFactor);
  const wire6_0 = Math.round((conduitCalculated * 0.15) * cableFactor);
  const accessoryQty = estimateBudgetAccessoryQuantities({
    circuits,
    pointCount: plantPoints.length,
    routeCount: plantRoutes.length,
  });
  const drMaterial = getBudgetDrMaterial({
    projectSupplyType,
    circuits,
    required: circuits.some((circuit) => circuit.needs_dr)
      || counts.tug + counts.tue + counts.arcond + counts.chuveiro > 0,
  });
  const prices = {
    wire1_5: 1.45,
    wire2_5: 2.30,
    wire6_0: 5.90,
    tug: 12.00,
    tue: 15.00,
    switch: 14.00,
    box: infraType === "galvanizado" ? 22.00 : 4.50,
    qgbt: 420.00,
    qe: 180.00,
    breaker_single: 15.00,
    connector: BUDGET_MATERIAL_PRICES["Conector de emenda compacto 3 vias"],
    terminal_tubular: BUDGET_MATERIAL_PRICES["Terminal tubular isolado sortido"],
    terminal_board: BUDGET_MATERIAL_PRICES["Terminal olhal/garfo isolado para quadro"],
  };

  return [
    ...conduitItems,
    {
      name: "Cabo Flexível Isolado 1.5mm² (Iluminação)",
      qty: Math.max(50, wire1_5),
      unit: "m",
      pricePerUnit: prices.wire1_5,
      total: Math.max(50, wire1_5) * prices.wire1_5,
      category: "cabos",
    },
    {
      name: "Cabo Flexível Isolado 2.5mm² (Força / TUG)",
      qty: Math.max(100, wire2_5),
      unit: "m",
      pricePerUnit: prices.wire2_5,
      total: Math.max(100, wire2_5) * prices.wire2_5,
      category: "cabos",
    },
    {
      name: "Cabo Flexível Isolado 6.0mm² (Potência / TUE)",
      qty: Math.max(30, wire6_0),
      unit: "m",
      pricePerUnit: prices.wire6_0,
      total: Math.max(30, wire6_0) * prices.wire6_0,
      category: "cabos",
    },
    {
      name: "Caixa de Passagem 4x2" + (infraType === "galvanizado" ? " Alumínio Condulete" : " Embutir PVC"),
      qty: Math.max(5, counts.tug + counts.interruptor + counts.inter2 + counts.inter3 + counts.inter3way),
      unit: "un",
      pricePerUnit: prices.box,
      total: Math.max(5, counts.tug + counts.interruptor + counts.inter2 + counts.inter3 + counts.inter3way) * prices.box,
      category: "caixas",
    },
    {
      name: "Módulo de Tomada Simples 2P+T 10A (TUG)",
      qty: Math.max(1, counts.tug),
      unit: "un",
      pricePerUnit: prices.tug,
      total: Math.max(1, counts.tug) * prices.tug,
      category: "tomadas",
    },
    {
      name: "Módulo de Tomada Simples 2P+T 20A (TUE)",
      qty: counts.tue + counts.arcond,
      unit: "un",
      pricePerUnit: prices.tue,
      total: (counts.tue + counts.arcond) * prices.tue,
      category: "tomadas",
    },
    {
      name: "Interruptor Simples 1 Tecla",
      qty: counts.interruptor + counts.inter2 * 2 + counts.inter3 * 3 + counts.inter3way,
      unit: "un",
      pricePerUnit: prices.switch,
      total: (counts.interruptor + counts.inter2 * 2 + counts.inter3 * 3 + counts.inter3way) * prices.switch,
      category: "comandos",
    },
    {
      name: counts.qgbt > 0 ? "Quadro Geral QGBT / Quadro de Distribuição" : "Quadro de Distribuição de Embutir 24 DIN",
      qty: Math.max(1, counts.qe + counts.qgbt),
      unit: "un",
      pricePerUnit: prices.qe,
      total: (counts.qe * prices.qe) + (counts.qgbt * prices.qgbt) || prices.qe,
      category: "quadros",
    },
    {
      name: "Disjuntor Termomagnético Monopolar DIN",
      qty: Math.max(4, circuits.filter((circuit) => circuit.supply_type !== "Bifásico").length),
      unit: "un",
      pricePerUnit: prices.breaker_single,
      total: Math.max(4, circuits.filter((circuit) => circuit.supply_type !== "Bifásico").length) * prices.breaker_single,
      category: "proteção",
    },
    drMaterial && {
      name: drMaterial.name,
      qty: drMaterial.qty,
      unit: "un",
      pricePerUnit: drMaterial.price,
      total: drMaterial.qty * drMaterial.price,
      category: "proteção",
    },
    {
      name: "Conector de emenda compacto 3 vias",
      qty: accessoryQty.connectors,
      unit: "un",
      pricePerUnit: prices.connector,
      total: accessoryQty.connectors * prices.connector,
      category: "conectores",
    },
    {
      name: "Terminal tubular isolado sortido",
      qty: accessoryQty.tubularTerminals,
      unit: "un",
      pricePerUnit: prices.terminal_tubular,
      total: accessoryQty.tubularTerminals * prices.terminal_tubular,
      category: "terminais",
    },
    {
      name: "Terminal olhal/garfo isolado para quadro",
      qty: accessoryQty.boardTerminals,
      unit: "un",
      pricePerUnit: prices.terminal_board,
      total: accessoryQty.boardTerminals * prices.terminal_board,
      category: "terminais",
    },
  ].filter((item) => item && item.qty > 0);
};

const buildPlantDeliveryReport = ({ plantPoints = [], plantRooms: _plantRooms = [], plantRoutes = [], circuits = [], infraType = "embutido", projectSupplyType = "", scalePxPerMeter = DEFAULT_SCALE_PX_PER_METER } = {}) => {
  const stamp = Date.now();
  const counts = countPlantPointTypes(plantPoints);
  const budgetItems = buildPlantBudgetItems({ plantPoints, plantRoutes, circuits, infraType, projectSupplyType, scalePxPerMeter })
    .map((item, index) => ({
      id: `planta-completa-${stamp}-${index}`,
      name: item.name,
      qty: item.qty,
      price: Math.round(item.pricePerUnit * 100) / 100,
      unit: item.unit,
      category: item.category || "planta-ia",
      note: "Gerado pelo Projeto Completo do Planta IA",
      source: "planta-ia-completa",
    }));

  return {
    source: "planta-ia-completa",
    counts: {
      pontos: plantPoints.length,
      rotas: plantRoutes.length,
      tomadas: counts.tug + counts.tue,
      forca: counts.arcond + counts.chuveiro + counts.motor,
      iluminacao: counts.luminaria + counts.spot + counts.arandela,
      circuitos: circuits.length,
    },
    budget_items: budgetItems,
    budget_total: budgetItems.reduce((sum, item) => sum + item.qty * item.price, 0),
    notes: "Projeto completo gerado com planta baixa, NBR 5410, circuitos, infraestrutura, materiais e entrega em PDF.",
  };
};

const formatCurrencyBR = (value = 0) => (
  Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
);


const cropCanvasToContent = (sourceCanvas, padding = 18) => {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || width <= 0 || height <= 0) return sourceCanvas;

  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 24) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);
      if (luminance >= 225 && colorSpread <= 36) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      hits += 1;
    }
  }

  if (hits < 80 || minX >= maxX || minY >= maxY) return sourceCanvas;

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width, maxX + padding);
  maxY = Math.min(height, maxY + padding);

  const cropW = maxX - minX;
  const cropH = maxY - minY;
  if (cropW < width * 0.1 || cropH < height * 0.1) return sourceCanvas;

  const cropped = document.createElement("canvas");
  cropped.width = cropW;
  cropped.height = cropH;
  const croppedCtx = cropped.getContext("2d");
  croppedCtx.fillStyle = "#ffffff";
  croppedCtx.fillRect(0, 0, cropW, cropH);
  croppedCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  return cropped;
};

function drawPlantLegend(doc, points, routes, stats = {}) {
  const x = 910;
  const w = 273;
  const top = 55;
  const bottom = 535;
  const legendHeight = bottom - top;
  const rowX = x + 16;
  const valueX = x + w - 18;
  const labelMaxWidth = valueX - rowX - 38;
  let y = top;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.65);
  doc.rect(x, top, w, legendHeight);
  doc.setFillColor(241, 245, 249);
  doc.rect(x, y, w, 26, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("LEGENDA / SIMBOLOGIA DA PLANTA", x + w / 2, y + 17, { align: "center" });
  y += 34;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(x + 10, y, x + w - 10, y);
  y += 12;

  const pointCounts = points.reduce((acc, point) => {
    const type = resolvePlantToolId(point);
    if (!type) return acc;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const categoryOrder = ["iluminacao", "comando", "tomadas", "forca", "infra", "extra"];
  const categoryTitles = {
    iluminacao: "ILUMINACAO",
    comando: "COMANDO",
    tomadas: "TOMADAS",
    forca: "FORCA / TUE",
    infra: "INFRAESTRUTURA",
    extra: "SISTEMAS AUXILIARES",
  };
  const items = TOOL_TYPES
    .filter((tool) => pointCounts[tool.id])
    .sort((a, b) => {
      const catA = categoryOrder.indexOf(a.category);
      const catB = categoryOrder.indexOf(b.category);
      return (catA === -1 ? 99 : catA) - (catB === -1 ? 99 : catB)
        || String(a.label).localeCompare(String(b.label), "pt-BR");
    });

  const drawRightTrianglePoint = (sx, sy, fillMode = "outline", scale = 1) => {
    const left = sx - 6 * scale;
    const right = sx + 8 * scale;
    const topY = sy - 5 * scale;
    const bottomY = sy + 5 * scale;
    doc.line(sx - 15 * scale, sy, left, sy);
    if (fillMode === "full") {
      doc.triangle(left, topY, right, sy, left, bottomY, "FD");
      return;
    }
    doc.triangle(left, topY, right, sy, left, bottomY, "S");
    if (fillMode === "half") {
      doc.triangle(left, sy, right, sy, left, bottomY, "F");
      doc.triangle(left, topY, right, sy, left, bottomY, "S");
    }
  };

  const drawSymbol = (item, sx, sy) => {
    doc.setDrawColor(item.color);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.95);

    if (item.category === "iluminacao") {
      if (item.id === "arandela") {
        doc.line(sx - 7, sy - 7, sx - 7, sy + 7);
        doc.line(sx - 11, sy, sx - 7, sy);
        doc.ellipse(sx - 7, sy, 6, 4.5, "S");
      } else if (item.id === "spot") {
        doc.rect(sx - 8, sy - 5, 16, 10, "S");
        doc.circle(sx, sy, 3.5, "S");
      } else {
        doc.circle(sx, sy, 5.3, "S");
      }
    } else if (item.category === "tomadas") {
      drawRightTrianglePoint(sx, sy, item.id === "tue" ? "half" : "outline");
    } else if (item.category === "comando") {
      doc.circle(sx, sy, 5, item.id === "inter3way" ? "FD" : "S");
      if (item.id === "inter2") doc.line(sx - 5, sy, sx + 5, sy);
      if (item.id === "inter3") {
        doc.line(sx - 4, sy - 4, sx + 4, sy + 4);
        doc.line(sx + 4, sy - 4, sx - 4, sy + 4);
      }
      if (item.id === "inter3way") {
        doc.setDrawColor(255, 255, 255);
        doc.line(sx - 4, sy, sx + 4, sy);
        doc.setDrawColor(item.color);
      }
    } else if (item.category === "infra") {
      doc.rect(sx - 7, sy - 6, 14, 12, "S");
      if (item.id === "caixa") {
        doc.line(sx - 7, sy - 6, sx + 7, sy + 6);
        doc.line(sx + 7, sy - 6, sx - 7, sy + 6);
      } else {
        doc.triangle(sx - 7, sy + 6, sx + 7, sy - 6, sx + 7, sy + 6, "F");
        if (item.id === "qgbt") {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(4.8);
          doc.text("QGBT", sx, sy - 8, { align: "center" });
        }
      }
    } else if (item.category === "forca") {
      if (item.id === "arcond") {
        doc.roundedRect(sx - 9, sy - 5, 18, 10, 2, 2, "S");
        doc.line(sx - 6, sy + 1, sx + 6, sy + 1);
        doc.circle(sx + 5, sy - 2.2, 1.2, "F");
      } else if (item.id === "chuveiro") {
        drawRightTrianglePoint(sx, sy, "full", 1.08);
        doc.setFillColor(255, 255, 255);
        doc.circle(sx - 2, sy, 2.3, "FD");
        doc.setFillColor(255, 255, 255);
      } else {
        drawRightTrianglePoint(sx, sy, "full");
      }
    } else if (item.id === "rack-cftv") {
      doc.rect(sx - 8, sy - 6, 16, 12, "S");
      doc.triangle(sx - 8, sy + 6, sx + 8, sy - 6, sx + 8, sy + 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.8);
      doc.text("CFTV", sx, sy - 8, { align: "center" });
    } else if (item.id === "rede") {
      drawRightTrianglePoint(sx, sy, "full", 0.88);
    } else if (item.id === "camera") {
      doc.rect(sx - 9, sy - 4, 12, 8, "S");
      doc.triangle(sx + 3, sy - 4, sx + 12, sy - 7, sx + 12, sy + 7, "S");
    } else if (item.id === "sensor") {
      doc.circle(sx, sy + 3, 2.1, "F");
      doc.ellipse(sx, sy + 3, 7, 5, "S");
      doc.ellipse(sx, sy + 3, 11, 8, "S");
      doc.setDrawColor(255, 255, 255);
      doc.line(sx - 12, sy + 4, sx + 12, sy + 4);
      doc.setDrawColor(item.color);
    } else {
      doc.circle(sx, sy, 5, "S");
    }
  };

  const writeLegendLabel = (label, count, tx, ty) => {
    const lines = doc.splitTextToSize(String(label).toUpperCase(), labelMaxWidth).slice(0, 2);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.4);
    doc.text(lines, tx, ty + 1);
    doc.setFontSize(10.2);
    doc.text(String(count), valueX, ty + 1, { align: "right" });
    return Math.max(16, lines.length * 5.6 + 7);
  };

  let currentCategory = "";
  if (items.length === 0) {
    doc.setTextColor(82, 97, 115);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhum dispositivo eletrico inserido na planta.", rowX, y);
    y += 18;
  }

  items.forEach((item) => {
    if (y > bottom - 78) return;
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      doc.setFillColor(248, 250, 252);
      doc.rect(x + 10, y - 7, w - 20, 13, "F");
      doc.setTextColor(0, 100, 166);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(categoryTitles[item.category] || String(item.category || "GERAL").toUpperCase(), rowX, y + 2);
      y += 16;
    }

    const legendColor = points.find((point) => resolvePlantToolId(point) === item.id && point.color)?.color || item.color;
    const legendItem = { ...item, color: legendColor };
    drawSymbol(legendItem, rowX + 8, y - 2);
    const rowHeight = writeLegendLabel(PLANT_SYMBOL_LABELS[item.id] || item.label, pointCounts[item.id] || 0, rowX + 25, y);
    y += rowHeight;
  });

  const usedRoutes = new Set(routes.map((route) => normalizeCableInstallationMode(route.mode, "embutido")));
  const routeItems = CONDUIT_SYMBOLS.filter((tool) => usedRoutes.has(tool.id));
  if (routeItems.length > 0 && y <= bottom - 62) {
    y += 4;
    doc.setFillColor(248, 250, 252);
    doc.rect(x + 10, y - 7, w - 20, 13, "F");
    doc.setTextColor(0, 100, 166);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("CONDUTORES / ELETRODUTOS", rowX, y + 2);
    y += 16;
  }
  routeItems.forEach((item) => {
    if (y > bottom - 44) return;
    const count = routes.filter((route) => normalizeCableInstallationMode(route.mode, "embutido") === item.id).length;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.95);
    
    if (item.id === "sobe" || item.id === "desce") {
      const centerX = rowX + 8;
      const centerY = y - 1;
      doc.circle(centerX, centerY, 4.8, "S");
      if (item.id === "desce") {
        doc.line(centerX - 3.2, centerY - 3.2, centerX + 3.2, centerY + 3.2);
        doc.line(centerX + 3.2, centerY - 3.2, centerX - 3.2, centerY + 3.2);
        doc.line(centerX + 4, centerY + 4, rowX + 18, y + 9);
      } else {
        doc.circle(centerX, centerY, 1.4, "F");
        doc.line(centerX + 4, centerY - 4, rowX + 18, y - 11);
      }
    } else if (item.dash === "dashed") {
      doc.setLineDash([3, 2.5], 0);
      doc.line(rowX, y - 1, rowX + 17, y - 1);
    } else if (item.dash === "dashdot") {
      doc.setLineDash([5, 2.5, 1.2, 2.5], 0);
      doc.line(rowX, y - 1, rowX + 17, y - 1);
    } else {
      doc.setLineDash([]);
      doc.line(rowX, y - 1, rowX + 17, y - 1);
    }
    doc.setLineDash([]);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.4);
    const rowHeight = writeLegendLabel(item.label, count, rowX + 24, y);
    y += rowHeight;
  });

  if (y <= bottom - 128) {
    y += 8;
    doc.setDrawColor(188, 213, 229);
    doc.line(x + 10, y, x + w - 10, y);
    y += 12;

    doc.setTextColor(0, 100, 166);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("RESUMO DA PRANCHA", rowX, y + 2);
    y += 14;

    const summaryRows = [
      ["Ambientes", stats.roomsCount || 0],
      ["Pontos", stats.pointsCount || 0],
      ["Eletrodutos", stats.routesCount || 0],
      ["Circuitos", stats.circuitsCount || 0],
      ["Escala", `${Math.round(normalizeScalePxPerMeter(stats.scalePxPerMeter))} px/m`],
    ];
    doc.setFontSize(9.8);
    summaryRows.forEach(([label, value], index) => {
      if (index % 2 === 0) {
        doc.setFillColor(248, 251, 253);
        doc.rect(rowX - 4, y - 8, w - 28, 14, "F");
      }
      doc.setTextColor(82, 97, 115);
      doc.setFont("helvetica", "bold");
      doc.text(label, rowX, y + 2);
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), valueX, y + 2, { align: "right" });
      y += 14;
    });
  }

  const scanner = stats.scannerReport || null;
  if (scanner?.counts && y < bottom - 88) {
    y += 6;
    doc.setDrawColor(188, 213, 229);
    doc.line(x + 10, y, x + w - 10, y);
    y += 12;

    doc.setTextColor(0, 100, 166);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.2);
    doc.text("SCANNER IA / ORCAMENTO", rowX, y + 2);
    y += 14;

    const countRows = [
      ["Tomadas", scanner.counts.tomadas || 0],
      ["Iluminacao", scanner.counts.iluminacao || 0],
      ["Interruptores", scanner.counts.interruptores || 0],
      ["Forca / TUE", scanner.counts.forca || 0],
      ["Custo estimado", `R$ ${formatCurrencyBR(scanner.budget_total || 0)}`],
    ];
    doc.setFontSize(9.4);
    countRows.forEach(([label, value], index) => {
      if (y > bottom - 32) return;
      if (index % 2 === 0) {
        doc.setFillColor(248, 251, 253);
        doc.rect(rowX - 4, y - 8, w - 28, 14, "F");
      }
      doc.setTextColor(82, 97, 115);
      doc.setFont("helvetica", "bold");
      doc.text(label, rowX, y + 2);
      doc.setTextColor(15, 23, 42);
      doc.text(String(value), valueX, y + 2, { align: "right" });
      y += 14;
    });
  }

  if (y <= bottom - 52) {
    y += 6;
    doc.setDrawColor(188, 213, 229);
    doc.line(x + 10, y, x + w - 10, y);
    y += 10;

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.6);
    const notes = stats.scannerReport ? [
      "1. Conferir medidas e posicoes em obra.",
      "2. Orcamento do scanner e estimativo para construtora.",
      "3. Documento gerado automaticamente; validar por profissional.",
    ] : [
      "1. Conferir medidas e posicoes em obra.",
      "2. Eletrodutos devem respeitar ocupacao.",
      "3. Circuitos de iluminacao: minimo 1.5 mm2.",
      "4. Tomadas e forca: minimo 2.5 mm2.",
    ];
    notes.forEach((note) => {
      if (y > bottom - 8) return;
      const lines = doc.splitTextToSize(note, w - 32);
      doc.text(lines, rowX, y);
      y += lines.length * 5.7 + 2.5;
    });
  }
  
  return doc;
}

export default function PlantaIA() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectFromUrl = searchParams.get("project") || "";
  const fileInputRef = useRef(null);
  const canvasExportRef = useRef(null);
  const [imageUrl, setImageUrl]     = useState(null);
  const [imageLayout, setImageLayout] = useState(null);
  const [importedFileName, setImportedFileName] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importedPlanElements, setImportedPlanElements] = useState({ lines: [], texts: [] });
  const [points, setPoints]         = useState([]);
  const [rooms, setRooms]           = useState([]);
  const [walls, setWalls]           = useState([]);
  const [openings, setOpenings]     = useState([]);
  const [roomLabels, setRoomLabels] = useState([]);
  const [sidebar, setSidebar]       = useState("tools");
  const [generatedCircuits, setGeneratedCircuits] = useState([]);
  const [routes, setRoutes]         = useState([]);
  const [projects, setProjects]     = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedProjectData, setSelectedProjectData] = useState(null);
  const [selectedPanelBoardId, setSelectedPanelBoardId] = useState("");
  const [targetRoomName, setTargetRoomName] = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [infraType, setInfraType]   = useState("embutido");
  const [infraPromptAction, setInfraPromptAction] = useState("");
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState("circuits");
  const [scannerReport, setScannerReport] = useState(null);
  const [activeTool, setActiveTool] = useState("");
  const [architectureTool, setArchitectureTool] = useState("");
  const [zoom, setZoom] = useState(1);
  const [scalePxPerMeter, setScalePxPerMeter] = useState(DEFAULT_SCALE_PX_PER_METER);
  const [showWallDimensions, setShowWallDimensions] = useState(true);
  const [showDeviceDimensions, setShowDeviceDimensions] = useState(false);
  const [showPositionLabels, setShowPositionLabels] = useState(true);
  const [unitSettings, setUnitSettings] = useState(() => normalizeUnitSettings());
  const [editorLayers, setEditorLayers] = useState(() => createDefaultLayerState());
  const [snapSettings, setSnapSettings] = useState(() => normalizeSnapSettings());
  const [fitRequest, setFitRequest] = useState(0);
  const [selectedElement, setSelectedElement] = useState(null);
  const [routeToolActive, setRouteToolActive] = useState(false);
  const [routeStartId, setRouteStartId] = useState("");
  const [routeCircuitId, setRouteCircuitId] = useState("auto");
  const [routeMode, setRouteMode] = useState("embutido");
  const [routeSystem, setRouteSystem] = useState("eletrica");
  const [routeConduitDiameter, setRouteConduitDiameter] = useState(DEFAULT_CONDUIT_DIAMETER);
  const [routeEditMode, setRouteEditMode] = useState("");
  const [routeDraft, setRouteDraft] = useState(null);
  const [selectedRoutePointIndex, setSelectedRoutePointIndex] = useState(null);
  const [cableValidationIssues, setCableValidationIssues] = useState([]);
  const [circuitModalPointId, setCircuitModalPointId] = useState("");
  const [pointHeightModalId, setPointHeightModalId] = useState("");
  const [routeGaugeModalId, setRouteGaugeModalId] = useState("");
  const [pointCircuitMode, setPointCircuitMode] = useState("existing");
  const [pointCircuitForm, setPointCircuitForm] = useState(CIRCUIT_FORM_EMPTY);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const hydratedProjectRef = useRef("");
  const autosaveTimerRef = useRef(null);
  const saveFeedbackTimerRef = useRef(null);
  const latestPlantSnapshotRef = useRef(null);
  const latestScannerReportRef = useRef(null);
  const latestRoutesRef = useRef([]);
  const lastCircuitPromptRef = useRef("");
  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });
  const layers = useMemo(() => layerVisibilityForLegacyCanvas(editorLayers), [editorLayers]);

  useEffect(() => {
    latestRoutesRef.current = routes;
  }, [routes]);

  useEffect(() => {
    latestScannerReportRef.current = scannerReport;
  }, [scannerReport]);

  const syncHistoryMeta = () => {
    const index = historyIndexRef.current;
    const total = historyRef.current.length;
    setHistoryMeta({
      canUndo: index > 0,
      canRedo: index >= 0 && index < total - 1,
    });
  };

  const currentDesignSnapshot = (overrides = {}) => {
    const snapshotRoutes = Object.prototype.hasOwnProperty.call(overrides, "routes") ? overrides.routes : routes;
    return {
      imageUrl: Object.prototype.hasOwnProperty.call(overrides, "imageUrl") ? overrides.imageUrl : imageUrl,
      imageLayout: Object.prototype.hasOwnProperty.call(overrides, "imageLayout") ? overrides.imageLayout : imageLayout,
      importedFileName: Object.prototype.hasOwnProperty.call(overrides, "importedFileName") ? overrides.importedFileName : importedFileName,
      importStatus: Object.prototype.hasOwnProperty.call(overrides, "importStatus") ? overrides.importStatus : importStatus,
      importedPlanElements: Object.prototype.hasOwnProperty.call(overrides, "importedPlanElements") ? overrides.importedPlanElements : importedPlanElements,
      points: normalizePlantPointsForEditor(Object.prototype.hasOwnProperty.call(overrides, "points") ? overrides.points : points),
      rooms: Object.prototype.hasOwnProperty.call(overrides, "rooms") ? overrides.rooms : rooms,
      walls: Object.prototype.hasOwnProperty.call(overrides, "walls") ? overrides.walls : walls,
      openings: Object.prototype.hasOwnProperty.call(overrides, "openings") ? overrides.openings : openings,
      roomLabels: Object.prototype.hasOwnProperty.call(overrides, "roomLabels") ? overrides.roomLabels : roomLabels,
      routes: normalizeCableRoutes(snapshotRoutes),
      scalePxPerMeter: normalizeScalePxPerMeter(Object.prototype.hasOwnProperty.call(overrides, "scalePxPerMeter") ? overrides.scalePxPerMeter : scalePxPerMeter),
      showWallDimensions: Object.prototype.hasOwnProperty.call(overrides, "showWallDimensions") ? overrides.showWallDimensions !== false : showWallDimensions !== false,
      showDeviceDimensions: Object.prototype.hasOwnProperty.call(overrides, "showDeviceDimensions") ? overrides.showDeviceDimensions === true : showDeviceDimensions === true,
      showPositionLabels: Object.prototype.hasOwnProperty.call(overrides, "showPositionLabels") ? overrides.showPositionLabels !== false : showPositionLabels !== false,
      unitSettings: normalizeUnitSettings(Object.prototype.hasOwnProperty.call(overrides, "unitSettings") ? overrides.unitSettings : unitSettings),
      layers: normalizeLayerState(Object.prototype.hasOwnProperty.call(overrides, "layers") ? overrides.layers : editorLayers),
      snapSettings: normalizeSnapSettings(Object.prototype.hasOwnProperty.call(overrides, "snapSettings") ? overrides.snapSettings : snapSettings),
      viewport: Object.prototype.hasOwnProperty.call(overrides, "viewport") ? overrides.viewport : { zoom },
    };
  };

  const applyDesignSnapshot = (snapshot) => {
    latestPlantSnapshotRef.current = snapshot;
    setImageUrl(snapshot.imageUrl || null);
    setImageLayout(snapshot.imageLayout || null);
    setImportedFileName(snapshot.importedFileName || "");
    setImportStatus(snapshot.importStatus || "");
    setImportedPlanElements(snapshot.importedPlanElements || { lines: [], texts: [] });
    setPoints(normalizePlantPointsForEditor(snapshot.points || []));
    setRooms(snapshot.rooms || []);
    setWalls(snapshot.walls || []);
    setOpenings(snapshot.openings || []);
    setRoomLabels(snapshot.roomLabels || []);
    setRoutes(normalizeCableRoutes(snapshot.routes || []));
    setScalePxPerMeter(normalizeScalePxPerMeter(snapshot.scalePxPerMeter));
    setShowWallDimensions(snapshot.showWallDimensions !== false);
    setShowDeviceDimensions(snapshot.showDeviceDimensions === true);
    setShowPositionLabels(snapshot.showPositionLabels !== false);
    setUnitSettings(normalizeUnitSettings(snapshot.unitSettings));
    setEditorLayers(normalizeLayerState(snapshot.layers));
    setSnapSettings(normalizeSnapSettings(snapshot.snapSettings));
    if (snapshot.viewport?.zoom) setZoom(Math.max(0.35, Math.min(3.6, Number(snapshot.viewport.zoom) || 1)));
  };

  const resetDesignHistory = (snapshot) => {
    historyRef.current = [snapshot];
    historyIndexRef.current = 0;
    syncHistoryMeta();
  };

  const commitDesign = (overrides = {}, options = {}) => {
    const baseSnapshot = currentDesignSnapshot();
    const nextSnapshot = currentDesignSnapshot(overrides);
    let history = historyRef.current;
    let index = historyIndexRef.current;

    if (index < 0) {
      history = [baseSnapshot];
      index = 0;
    } else {
      history = history.slice(0, index + 1);
    }

    history = [...history, nextSnapshot].slice(-60);
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
    applyDesignSnapshot(nextSnapshot);
    latestPlantSnapshotRef.current = nextSnapshot;
    if (options.clearSelection) setSelectedElement(null);
    syncHistoryMeta();
  };

  const undoDesign = () => {
    const index = historyIndexRef.current;
    if (index <= 0) return;
    const nextIndex = index - 1;
    historyIndexRef.current = nextIndex;
    applyDesignSnapshot(historyRef.current[nextIndex]);
    setSelectedElement(null);
    syncHistoryMeta();
  };

  const redoDesign = () => {
    const index = historyIndexRef.current;
    if (index < 0 || index >= historyRef.current.length - 1) return;
    const nextIndex = index + 1;
    historyIndexRef.current = nextIndex;
    applyDesignSnapshot(historyRef.current[nextIndex]);
    setSelectedElement(null);
    syncHistoryMeta();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScannerReport(null);
    const extension = getFileExtension(file);
    const displayName = file.name || "arquivo importado";
    const metadata = `${extension ? extension.toUpperCase() : "ARQUIVO"} · ${formatFileSize(file.size)}`;

    if (TECHNICAL_PLAN_TYPES.has(extension)) {
      commitDesign({
        imageUrl: null,
        imageLayout: null,
        importedFileName: displayName,
        importStatus: `${metadata} reconhecido. Para leitura editável detalhada, importe imagens rasterizadas aqui ou abra no editor CAD profissional.`,
        importedPlanElements: { lines: [], texts: [] },
      }, { clearSelection: true });
      e.target.value = "";
      return;
    }

    if (extension !== "pdf" && !RENDERABLE_PLAN_TYPES.has(extension) && !file.type.startsWith("image/")) {
      commitDesign({
        imageUrl: null,
        imageLayout: null,
        importedFileName: displayName,
        importStatus: `${metadata} não é um formato de planta suportado para visualização.`,
        importedPlanElements: { lines: [], texts: [] },
      }, { clearSelection: true });
      e.target.value = "";
      return;
    }

    const prepared = await prepareImportedPlanFromFile(file, extension, metadata);

    commitDesign({
      imageUrl: prepared.imageUrl,
      imageLayout: prepared.imageLayout,
      importedFileName: displayName,
      importStatus: prepared.importStatus,
      importedPlanElements: prepared.importedPlanElements,
      rooms: [],
      walls: [],
      openings: [],
      roomLabels: [],
    }, { clearSelection: true });

    try {
      const { file_url } = await backend.integrations.Core.UploadFile({ file });
      if (file_url && !prepared.imageUrl.startsWith("data:")) setImageUrl(file_url);
    } catch {
      setImageUrl(prepared.imageUrl);
    } finally {
      e.target.value = "";
    }
  };

  const handlePointsSuggested = (suggestions) => {
    const normalized = normalizeSuggestedPoints(suggestions, points.length);
    const hasBoard = points.some((point) => point.type === "qgbt" || point.type === "qe");
    const filtered = normalized.filter((point) => !(hasBoard && (point.type === "qgbt" || point.type === "qe")));
    if (filtered.length === 0) return;
    commitDesign({ points: [...points, ...filtered] });
  };

  const handleInfrastructureGenerated = ({ routes: nextRoutes = [] }) => {
    const normalized = normalizeRoutes(nextRoutes);
    if (normalized.length === 0) return;
    commitDesign({ routes: [...routes, ...normalized] });
  };

  const handleRequestedPlanGenerated = (plan) => {
    const normalizedPoints = normalizeSuggestedPoints(plan?.suggested_points || [], 0);
    const nextRooms = (plan?.rooms || []).map((room, index) => ({
      id: `ai-room-${Date.now()}-${index}`,
      label: room.name || `Comodo ${index + 1}`,
      x: clampPct(room.x_pct ?? room.x, 14 + (index % 3) * 23),
      y: clampPct(room.y_pct ?? room.y, 10 + Math.floor(index / 3) * 24),
      w: Math.max(10, Math.min(32, Number(room.w_pct ?? room.w) || 20)),
      h: Math.max(10, Math.min(32, Number(room.h_pct ?? room.h) || 18)),
      area: room.area_m2 ? `${room.area_m2} m2` : "",
    }));
    commitDesign({
      imageUrl: null,
      imageLayout: null,
      importedFileName: "",
      importStatus: "",
      importedPlanElements: { lines: [], texts: [] },
      routes: [],
      points: normalizedPoints,
      rooms: nextRooms,
      walls: [],
      openings: [],
      roomLabels: [],
    }, { clearSelection: true });
  };

  const loadProjects = async () => {
    const ps = await backend.entities.Project.list();
    setProjects(ps);
    if (selectedProject) {
      const currentProject = ps.find((project) => project.id === selectedProject);
      if (currentProject?.panel_boards || currentProject?.panel_layout) {
        setSelectedProjectData(currentProject);
      }
      if (currentProject) {
        setGeneratedCircuits(normalizeProjectCircuits(currentProject.circuits || []));
        setScannerReport(currentProject.plant_scanner_report || null);
        setRouteCircuitId("auto");
      }
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!projectFromUrl) return;
    setSelectedProject(projectFromUrl);
  }, [projectFromUrl]);

  useEffect(() => {
    if (!selectedProject) {
      setSelectedProjectData(null);
      setGeneratedCircuits([]);
      setScannerReport(null);
      latestScannerReportRef.current = null;
      latestPlantSnapshotRef.current = null;
      setRouteCircuitId("auto");
      hydratedProjectRef.current = "";
      return;
    }
    let cancelled = false;
    backend.entities.Project.get(selectedProject)
      .then((project) => {
        if (!cancelled) {
          setSelectedProjectData(project);
          setGeneratedCircuits(normalizeProjectCircuits(project.circuits || []));
          setScannerReport(project.plant_scanner_report || null);
          latestScannerReportRef.current = project.plant_scanner_report || null;
          setRouteCircuitId("auto");
          const design = normalizePlantDesign(project.plant_design || project.plantDesign);
          applyDesignSnapshot(design);
          resetDesignHistory(design);
          setActiveTool("");
          setArchitectureTool("");
          setSelectedElement(null);
          hydratedProjectRef.current = selectedProject;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedProjectData(null);
          setGeneratedCircuits([]);
          setScannerReport(null);
          latestScannerReportRef.current = null;
          latestPlantSnapshotRef.current = null;
          setRouteCircuitId("auto");
          hydratedProjectRef.current = "";
        }
      });
    return () => { cancelled = true; };
  }, [selectedProject]);

  const markPlantDesignSaved = () => {
    setSaved(true);
    if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
    saveFeedbackTimerRef.current = setTimeout(() => setSaved(false), 1400);
  };

  const persistPlantDesignSnapshot = async (snapshot, { silent = false } = {}) => {
    if (!selectedProject || !snapshot) return false;
    if (!silent) setSaving(true);

    const report = latestScannerReportRef.current;
    const payload = {
      plant_design: snapshot,
      plant_points_count: snapshot.points.length,
      plant_routes_count: snapshot.routes.length,
      plant_scanner_report: report,
      plant_scan_counts: report?.counts || {},
    };

    try {
      const updatedProject = await backend.entities.Project.update(selectedProject, payload);
      setSelectedProjectData((current) => current ? { ...current, ...payload, ...(updatedProject || {}) } : updatedProject);
      setProjects((current) => current.map((item) => (
        item.id === selectedProject ? { ...item, ...payload, ...(updatedProject || {}) } : item
      )));
      markPlantDesignSaved();
      return true;
    } catch (error) {
      console.error("Erro ao salvar planta:", error);
      return false;
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleSavePlantDesign = async () => {
    const snapshot = currentDesignSnapshot();
    latestPlantSnapshotRef.current = snapshot;
    await persistPlantDesignSnapshot(snapshot);
  };

  useEffect(() => {
    if (!selectedProject || hydratedProjectRef.current !== selectedProject) return undefined;
    const snapshot = currentDesignSnapshot();
    latestPlantSnapshotRef.current = snapshot;
    autosaveTimerRef.current = setTimeout(() => {
      persistPlantDesignSnapshot(snapshot, { silent: true });
    }, 900);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [selectedProject, imageUrl, imageLayout, importedFileName, importStatus, importedPlanElements, points, rooms, walls, openings, roomLabels, routes, scalePxPerMeter, showWallDimensions, showDeviceDimensions, showPositionLabels, unitSettings, editorLayers, snapSettings, scannerReport]);

  useEffect(() => {
    if (!selectedProject || hydratedProjectRef.current !== selectedProject) return undefined;

    const flushPendingPlantSave = () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      const snapshot = latestPlantSnapshotRef.current || currentDesignSnapshot();
      persistPlantDesignSnapshot(snapshot, { silent: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushPendingPlantSave();
    };

    window.addEventListener("pagehide", flushPendingPlantSave);
    window.addEventListener("beforeunload", flushPendingPlantSave);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushPendingPlantSave);
      window.removeEventListener("beforeunload", flushPendingPlantSave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedProject]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
  }, []);

  const loadHouseTemplate = () => {
    const template = createKonvaHouseTemplate();
    commitDesign({
      imageUrl: null,
      imageLayout: null,
      importedFileName: "",
      importStatus: "",
      importedPlanElements: { lines: [], texts: [] },
      rooms: template.rooms,
      walls: [],
      openings: [],
      roomLabels: [],
      points: template.points,
      routes: template.routes,
    }, { clearSelection: true });
    setActiveTool("");
    setArchitectureTool("");
    setRouteToolActive(false);
    setRouteStartId("");
    setRouteEditMode("");
    setRouteDraft(null);
    setScannerReport(null);
  };

  const addRoom = () => {
    const nextRoom = {
      id: `room-${Date.now()}`,
      label: `Comodo ${rooms.length + 1}`,
      x: 22 + (rooms.length % 3) * 18,
      y: 14 + Math.floor(rooms.length / 3) * 18,
      w: 18,
      h: 18,
      area: "",
      rotation: 0,
    };
    commitDesign({ rooms: [...rooms, nextRoom] });
    setSelectedElement({ type: "room", id: nextRoom.id });
    setArchitectureTool("");
  };

  const selectArchitectureTool = useCallback((tool) => {
    setActiveTool("");
    setRouteEditMode("");
    setRouteToolActive(false);
    setRouteStartId("");
    setRouteDraft(null);
    setSelectedElement(null);
    setArchitectureTool(tool);
  }, []);

  const startBlankArchitecturalPlan = () => {
    const hasDesign = Boolean(imageUrl || rooms.length || walls.length || openings.length || roomLabels.length || points.length || routes.length);
    if (hasDesign && !window.confirm("Iniciar uma planta do zero? O desenho atual será substituído e poderá ser recuperado com Desfazer.")) return;
    commitDesign({
      imageUrl: null,
      imageLayout: null,
      importedFileName: "",
      importStatus: "",
      importedPlanElements: { lines: [], texts: [] },
      points: [],
      routes: [],
      rooms: [],
      walls: [],
      openings: [],
      roomLabels: [],
    }, { clearSelection: true });
    setSidebar("tools");
    selectArchitectureTool("wall");
  };

  const addArchitecturalWall = (wall) => {
    commitDesign({ walls: [...walls, wall] });
  };

  const updateArchitecturalWall = (id, next) => {
    commitDesign({ walls: walls.map((wall) => sameId(wall.id, id) ? { ...wall, ...next } : wall) });
  };

  const resizeArchitecturalWallToLength = (id, nextLengthMeters) => {
    const wall = walls.find((item) => sameId(item.id, id));
    const nextMeters = Number(nextLengthMeters);
    if (!wall || !Number.isFinite(nextMeters) || nextMeters <= 0) return;

    const geometry = wallPxGeometry(wall);
    if (geometry.length < 1) return;

    const targetLengthPx = Math.max(4, nextMeters * normalizeScalePxPerMeter(scalePxPerMeter));
    const unit = {
      x: (geometry.x2 - geometry.x1) / geometry.length,
      y: (geometry.y2 - geometry.y1) / geometry.length,
    };
    const oldEnd = { x: geometry.x2, y: geometry.y2 };
    const nextEnd = {
      x: Math.max(0, Math.min(EDITOR_DESIGN_SIZE.w, geometry.x1 + unit.x * targetLengthPx)),
      y: Math.max(0, Math.min(EDITOR_DESIGN_SIZE.h, geometry.y1 + unit.y * targetLengthPx)),
    };
    const ratio = targetLengthPx / geometry.length;
    const nextControl = wall.kind === "curve"
      ? {
          cx: pxToPct(geometry.x1 + (geometry.cx - geometry.x1) * ratio, EDITOR_DESIGN_SIZE.w),
          cy: pxToPct(geometry.y1 + (geometry.cy - geometry.y1) * ratio, EDITOR_DESIGN_SIZE.h),
        }
      : {};
    const nearOldEnd = (point) => Math.hypot(point.x - oldEnd.x, point.y - oldEnd.y) <= WALL_CONNECTION_TOLERANCE_PX;
    const nextEndPct = {
      x: pxToPct(nextEnd.x, EDITOR_DESIGN_SIZE.w),
      y: pxToPct(nextEnd.y, EDITOR_DESIGN_SIZE.h),
    };

    const nextWalls = walls.map((item) => {
      const itemGeometry = wallPxGeometry(item);
      const isEditedWall = sameId(item.id, id);
      let nextWall = item;

      if (isEditedWall) {
        nextWall = {
          ...nextWall,
          x2: nextEndPct.x,
          y2: nextEndPct.y,
          ...nextControl,
        };
      } else {
        const startConnected = nearOldEnd({ x: itemGeometry.x1, y: itemGeometry.y1 });
        const endConnected = nearOldEnd({ x: itemGeometry.x2, y: itemGeometry.y2 });
        if (startConnected || endConnected) {
          nextWall = {
            ...nextWall,
            ...(startConnected ? { x1: nextEndPct.x, y1: nextEndPct.y } : {}),
            ...(endConnected ? { x2: nextEndPct.x, y2: nextEndPct.y } : {}),
          };
        }
      }

      return nextWall;
    });

    commitDesign({ walls: nextWalls });
    setSelectedElement({ type: "wall", id });
    setArchitectureTool("");
  };

  const addArchitecturalOpening = (opening) => {
    commitDesign({ openings: [...openings, opening] });
    setSelectedElement({ type: "opening", id: opening.id });
    setArchitectureTool("");
  };

  const updateArchitecturalOpening = (id, next) => {
    commitDesign({ openings: openings.map((opening) => sameId(opening.id, id) ? { ...opening, ...next } : opening) });
  };

  const addArchitecturalRoomLabel = (label) => {
    commitDesign({ roomLabels: [...roomLabels, label] });
    setSelectedElement({ type: "roomLabel", id: label.id });
    setArchitectureTool("");
  };

  const updateArchitecturalRoomLabel = (id, next) => {
    commitDesign({ roomLabels: roomLabels.map((label) => sameId(label.id, id) ? { ...label, ...next } : label) });
  };

  const pullProjectCircuitsFromEditor = async () => {
    if (!selectedProject) return 0;
    setSaving(true);
    try {
      const project = await backend.entities.Project.get(selectedProject);
      const editorCircuits = normalizeProjectCircuits(project.circuits || []);
      setSelectedProjectData(project);
      setGeneratedCircuits(editorCircuits);
      setRouteCircuitId("auto");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      return editorCircuits.length;
    } catch (e) {
      console.error(e);
      return 0;
    } finally {
      setSaving(false);
    }
  };

  const _saveCircuitsToProject = async () => {
    if (!selectedProject || generatedCircuits.length === 0) return;
    setSaving(true);
    try {
      const project = await backend.entities.Project.get(selectedProject);
      const updatedCircuits = normalizeProjectCircuits(
        generatedCircuits.length > 0 ? generatedCircuits : (project.circuits || [])
      );
      if (updatedCircuits.length === 0) return;

      await backend.entities.Project.update(selectedProject, {
        ...buildProjectElectricalSyncPayload(project, updatedCircuits),
      });

      const refreshedProject = await backend.entities.Project.get(selectedProject);
      setSelectedProjectData(refreshedProject);
      setGeneratedCircuits(normalizeProjectCircuits(refreshedProject.circuits || []));
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const generatePanelBoardFromPlant = async (nextInfraType = infraType) => {
    if (!selectedProject || generatedCircuits.length === 0) return;
    setSaving(true);
    try {
      const project = await backend.entities.Project.get(selectedProject);
      const updatedCircuits = normalizeProjectCircuits(
        generatedCircuits.length > 0 ? generatedCircuits : (project.circuits || [])
      );
      if (updatedCircuits.length === 0) return;

      const boardPoint = points.find((point) => point.type === "qgbt") || points.find((point) => point.type === "qe");
      const syncPayload = buildProjectElectricalSyncPayload(project, updatedCircuits);
      const updatedBoards = applyPlantBoardMetadata(
        syncPayload.panel_boards,
        {
          boardPoint,
          panelLayout: syncPayload.panel_layout,
          infraType: nextInfraType,
          fallbackLocation: "Posicionado na planta",
          targetRoomName,
        }
      );

      await backend.entities.Project.update(selectedProject, {
        ...syncPayload,
        panel_boards: updatedBoards,
        plant_infra_type: nextInfraType,
        plant_points_count: points.length,
        plant_routes_count: routes.length,
      });

      const refreshedProject = await backend.entities.Project.get(selectedProject);
      setSelectedProjectData(refreshedProject);
      setGeneratedCircuits(normalizeProjectCircuits(refreshedProject.circuits || []));
      setRouteCircuitId("auto");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const countByCategory = (cat) => {
    const catTypes = TOOL_TYPES.filter(t => t.category === cat).map(t => t.id);
    return points.filter(p => catTypes.includes(p.type)).length;
  };

  const insertElectricalTool = (tool) => {
    setRouteToolActive(false);
    setRouteStartId("");
    setArchitectureTool("");
    setActiveTool(current => current === tool.id ? "" : tool.id);
  };

  const roomNBRAnalysis = useMemo(() => buildNBRRoomAnalysis(rooms, points, scalePxPerMeter), [rooms, points, scalePxPerMeter]);
  const roomNBRSummary = useMemo(() => summarizeNBRRoomAnalysis(roomNBRAnalysis), [roomNBRAnalysis]);
  const roomNBRMissingTotal = roomNBRSummary.missingLighting + roomNBRSummary.missingTugs + roomNBRSummary.missingSwitches;

  const telemetry = useMemo(() => {
    const counts = {
      tug: 0,
      tue: 0,
      arcond: 0,
      chuveiro: 0,
      motor: 0,
      luminaria: 0,
      spot: 0,
      arandela: 0,
      interruptor: 0,
      inter2: 0,
      inter3: 0,
      inter3way: 0,
      qgbt: 0,
      qe: 0,
      caixa: 0,
      "rack-cftv": 0,
      sensor: 0,
      camera: 0,
      rede: 0,
    };
    
    const defaultPower = {
      chuveiro: 5500,
      arcond: 1500,
      tue: 2000,
      motor: 1500,
      tug: 100,
      luminaria: 100,
      spot: 50,
      arandela: 60,
    };

    let totalLoadW = 0;
    points.forEach((p) => {
      if (counts[p.type] !== undefined) {
        counts[p.type]++;
      }
      const pointPower = p.load_w || defaultPower[p.type] || 0;
      totalLoadW += pointPower;
    });

    const circuitLoadW = generatedCircuits.reduce((acc, c) => acc + (c.power_w || c.load_w_total || 0), 0);
    const totalPower = circuitLoadW || totalLoadW;

    let phaseALoad = 0;
    let phaseBLoad = 0;
    let phaseCLoad = 0;
    
    generatedCircuits.forEach((c) => {
      const p = c.power_w || c.load_w_total || 0;
      const phase = String(c.phase || "A").toUpperCase();
      if (phase.includes("A")) phaseALoad += p;
      else if (phase.includes("B")) phaseBLoad += p;
      else if (phase.includes("C")) phaseCLoad += p;
    });

    if (generatedCircuits.length === 0 && points.length > 0) {
      points.forEach((p, idx) => {
        const power = p.load_w || defaultPower[p.type] || 0;
        if (idx % 3 === 0) phaseALoad += power;
        else if (idx % 3 === 1) phaseBLoad += power;
        else phaseCLoad += power;
      });
    }

    const totalPhaseLoad = phaseALoad + phaseBLoad + phaseCLoad;
    const maxPhase = Math.max(phaseALoad, phaseBLoad, phaseCLoad);
    const minPhase = Math.min(phaseALoad, phaseBLoad, phaseCLoad);
    
    const phaseDeviation = totalPhaseLoad > 0 
      ? Math.round(((maxPhase - minPhase) / Math.max(1, maxPhase)) * 100) 
      : 0;

    let balanceStatus = "Pendente";
    let balanceColor = "text-muted-foreground";
    if (totalPhaseLoad > 0) {
      if (phaseDeviation <= 15) {
        balanceStatus = "Ideal (<15%)";
        balanceColor = "text-[#10B981]";
      } else if (phaseDeviation <= 30) {
        balanceStatus = "Aceitável (15-30%)";
        balanceColor = "text-[#F59E0B]";
      } else {
        balanceStatus = "Desbalanceado (>30%)";
        balanceColor = "text-[#EF4444]";
      }
    }

    const auditChecks = [];
    
    const hasLighting = generatedCircuits.some(c => c.type === "Iluminação") || counts.luminaria > 0 || counts.spot > 0;
    const hasTugs = generatedCircuits.some(c => c.type === "Tomadas de Uso Geral") || counts.tug > 0;
    const isSeparated = generatedCircuits.length > 0
      ? !generatedCircuits.some(c => {
          const name = String(c.name).toLowerCase();
          const type = String(c.type).toLowerCase();
          return (type.includes("ilum") && type.includes("tug")) || (name.includes("ilum") && name.includes("tomada"));
        })
      : true;
    auditChecks.push({
      id: "separation",
      title: "Divisão de Circuitos (Luz e Tomadas)",
      status: (hasLighting && hasTugs && isSeparated) ? "pass" : (points.length > 0 ? "warn" : "pending"),
      desc: "Circuitos de iluminação e tomadas devem ser independentes (NBR 5410 item 4.2.5).",
    });

    const tempPanelBoards = normalizePanelBoards(selectedProjectData);
    const hasDRInBoard = tempPanelBoards.some(board => 
      (board.layout?.rails || []).some(rail => 
        (rail.components || []).some(comp => comp.type === "dr" || comp.id?.includes("dr"))
      )
    );
    auditChecks.push({
      id: "dr_protection",
      title: "Dispositivo DR (Diferencial Residual)",
      status: hasDRInBoard ? "pass" : (points.length > 0 ? "warn" : "pending"),
      desc: "Mandatório para áreas molhadas/externas como cozinha e banheiro (NBR 5410 item 5.1.3.2).",
    });

    auditChecks.push({
      id: "min_wire_gauge",
      title: "Seção Mínima dos Condutores de Cobre",
      status: points.length > 0 ? "pass" : "pending",
      desc: "Mínimo de 1.5mm² para iluminação e 2.5mm² para circuitos de força (NBR 5410 item 6.2.6).",
    });

    auditChecks.push({
      id: "room_minimum_points",
      title: "Pontos Mínimos por Cômodo",
      status: roomNBRAnalysis.length === 0 ? "pending" : roomNBRMissingTotal === 0 ? "pass" : "warn",
      desc: roomNBRAnalysis.length === 0
        ? "Desenhe cômodos com dimensões para calcular iluminação e tomadas mínimas."
        : `${roomNBRSummary.missingLighting} luz, ${roomNBRSummary.missingTugs} TUG e ${roomNBRSummary.missingSwitches} interruptor ainda pendentes pela análise dos cômodos.`,
    });

    const tuesList = points.filter(p => ["chuveiro", "arcond", "motor", "tue"].includes(p.type));
    let tuesDedicated = true;
    if (generatedCircuits.length > 0) {
      generatedCircuits.forEach(c => {
        const type = String(c.type).toLowerCase();
        if ((type.includes("espec") || type.includes("chuveiro") || type.includes("ar")) && c.point_count > 1) {
          tuesDedicated = false;
        }
      });
    }
    auditChecks.push({
      id: "tue_dedication",
      title: "Circuitos Exclusivos para Cargas Pesadas (>10A)",
      status: (tuesList.length > 0 && tuesDedicated) ? "pass" : (tuesList.length > 0 ? "warn" : "pending"),
      desc: "Cargas dedicadas de alta potência (chuveiros, arcond) exigem circuitos exclusivos (NBR 5410 item 9.5.3).",
    });

    const boardOccupancyOk = tempPanelBoards.every(board => {
      const used = (board?.layout?.rails || []).reduce((total, rail) => (
        total + (rail.components || [])
          .filter((component) => component.type !== "spacer")
          .reduce((sum, component) => sum + (Number(component.poles) || 0), 0)
      ), 0);
      return used > 0 && used <= 24;
    });
    auditChecks.push({
      id: "board_modules",
      title: "Espaço de Reserva no Quadro Elétrico",
      status: boardOccupancyOk ? "pass" : (points.length > 0 ? "warn" : "pending"),
      desc: "Quadro deve possuir de 15% a 30% de espaço livre para ampliações (NBR 5410 item 6.5.4.7).",
    });

    const nonPending = auditChecks.filter(c => c.status !== "pending");
    const passedChecks = auditChecks.filter(c => c.status === "pass");
    const nbrScore = nonPending.length > 0
      ? Math.round((passedChecks.length / auditChecks.length) * 100)
      : 80;

    const bomItems = buildPlantBudgetItems({
      plantPoints: points,
      plantRoutes: routes,
      circuits: generatedCircuits,
      infraType,
      projectSupplyType: selectedProjectData?.supply_type || "",
      scalePxPerMeter,
    });

    const totalMaterialsCost = bomItems.reduce((acc, item) => acc + item.total, 0);

    return {
      counts,
      totalPower,
      phases: {
        A: phaseALoad,
        B: phaseBLoad,
        C: phaseCLoad,
        total: totalPhaseLoad,
        deviation: phaseDeviation,
        status: balanceStatus,
        color: balanceColor,
      },
      audit: {
        score: nbrScore,
        checks: auditChecks,
      },
      bom: {
        items: bomItems.filter(item => item.qty > 0),
        totalCost: totalMaterialsCost,
      }
    };
  }, [points, generatedCircuits, routes, selectedProjectData, infraType, roomNBRAnalysis, roomNBRMissingTotal, roomNBRSummary]);

  const panelBoards = useMemo(() => normalizePanelBoards(selectedProjectData), [selectedProjectData]);
  const selectedPanelBoard = panelBoards.find((board) => board.id === selectedPanelBoardId) || panelBoards[0] || null;
  const selectedProjectName = selectedProject ? projects.find((project) => project.id === selectedProject)?.name : "";
  const hasProjectCircuits = generatedCircuits.length > 0;
  const hasPositionedBoard = points.some((point) => point.type === "qgbt" || point.type === "qe");
  const canRouteToBoard = hasProjectCircuits && hasPositionedBoard;

  const handleFullScanCompleted = async ({ report }) => {
    if (!report) return;
    const stamp = Date.now();
    const budgetItems = normalizeScannerBudgetItems(report.budget_items, stamp);
    const normalizedReport = {
      ...report,
      budget_items: budgetItems,
      budget_total: budgetItems.reduce((sum, item) => sum + item.qty * item.price, 0),
    };

    setScannerReport(normalizedReport);
    setActiveRightTab("bom");
    setRightPanelOpen(true);

    if (!selectedProject) return;

    try {
      const project = await backend.entities.Project.get(selectedProject);
      const preservedManualItems = Array.isArray(project.manual_budget_items)
        ? project.manual_budget_items.filter((item) => item.source !== "scanner-planta-ia")
        : [];
      const updatedProject = await backend.entities.Project.update(selectedProject, {
        plant_scanner_report: normalizedReport,
        plant_scan_counts: normalizedReport.counts || {},
        manual_budget_items: [...preservedManualItems, ...budgetItems],
      });
      setSelectedProjectData(updatedProject);
      setProjects((current) => current.map((item) => item.id === selectedProject ? updatedProject : item));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      console.error(error);
      alert("O scanner foi gerado, mas não consegui salvar o orçamento no projeto.");
    }
  };

  useEffect(() => {
    setSelectedPanelBoardId((current) => {
      if (panelBoards.some((board) => board.id === current)) return current;
      return panelBoards[0]?.id || "";
    });
  }, [panelBoards]);

  const insertPanelBoard = (board, index = 0, roomName = "") => {
    const targetRoom = roomName.trim();
    const nextPoint = {
      id: `board-${board?.id || Date.now()}-${index}`,
      type: board?.type === "geral" || board?.type === "qgbt" ? "qgbt" : "qe",
      label: board?.name || "QD",
      x: 50 + index * 4,
      y: 66 + index * 3,
      circuit: null,
      load_w: 0,
      room: targetRoom,
      rotation: 0,
    };
    commitDesign({ points: [...points, nextPoint] });
    setSelectedElement(null);
  };

  const insertSelectedPanelBoard = () => {
    if (!selectedPanelBoard) return;
    const index = Math.max(0, panelBoards.findIndex((board) => board.id === selectedPanelBoard.id));
    insertPanelBoard(selectedPanelBoard, index, targetRoomName);
  };

  const insertAllPanelBoards = () => {
    if (panelBoards.length === 0) return;
    const targetRoom = targetRoomName.trim();
    const nextPoints = panelBoards.map((board, index) => ({
      id: `board-${board?.id || Date.now()}-${index}`,
      type: board?.type === "geral" || board?.type === "qgbt" ? "qgbt" : "qe",
      label: board?.name || "QD",
      x: 50 + index * 4,
      y: 66 + index * 3,
      circuit: null,
      load_w: 0,
      room: targetRoom,
      rotation: 0,
    }));
    commitDesign({ points: [...points, ...nextPoints] });
  };

  const clearAll = () => {
    commitDesign({
      imageUrl: null,
      imageLayout: null,
      importedFileName: "",
      importStatus: "",
      importedPlanElements: { lines: [], texts: [] },
      points: [],
      routes: [],
      rooms: [],
      walls: [],
      openings: [],
      roomLabels: [],
    }, { clearSelection: true });
    setActiveTool("");
    setArchitectureTool("");
    setRouteToolActive(false);
    setRouteStartId("");
    setRouteEditMode("");
    setRouteDraft(null);
  };

  const exportFloorPlanPdf = async () => {
    if (!canvasExportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(canvasExportRef.current, {
        backgroundColor: "#ffffff",
        scale: 3,
        useCORS: true,
      });
      const cropPadding = Math.max(160, Math.round(Math.max(canvas.width, canvas.height) * 0.07));
      const exportCanvas = cropCanvasToContent(canvas, cropPadding);
      const img = exportCanvas.toDataURL("image/png");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [1189, 841], compress: true });
      const projectForSheet = selectedProject ? projects.find(p => p.id === selectedProject) || selectedProjectData || {} : selectedProjectData || {};
      doc.setProperties({
        title: `${projectForSheet.name || "Projeto"} - Planta baixa executiva`,
        subject: "Prancha executiva de planta baixa eletrica",
        creator: "Volt AI",
      });
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 1189, 841, "F");
      drawSheetFrame(doc, "planta");
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.45);
      doc.line(910, 55, 910, 824);
      doc.line(910, 535, 1183, 535);
      const area = { x: 18, y: 65, w: 875, h: 748 };
      const ratio = Math.min(area.w / exportCanvas.width, area.h / exportCanvas.height);
      const imageW = exportCanvas.width * ratio;
      const imageH = exportCanvas.height * ratio;
      doc.addImage(img, "PNG", area.x + (area.w - imageW) / 2, area.y + (area.h - imageH) / 2, imageW, imageH);
      drawPlantLegend(doc, points, routes, {
        pointsCount: points.length,
        roomsCount: rooms.length + roomLabels.length,
        routesCount: routes.length,
        circuitsCount: generatedCircuits.length,
        scalePxPerMeter,
        scannerReport,
      });
      drawTitleBlock(doc, projectForSheet, "PROJETO EXECUTIVO - PLANTA BAIXA");
      doc.save("projeto_executivo_planta_baixa_A0.pdf");
    } finally {
      setExporting(false);
    }
  };

  const architectureTools = [
    { label: "Modelo casa", detail: "base 1:50", icon: House, onClick: loadHouseTemplate },
    { label: "Planta do zero", detail: "desenho livre", icon: Minus, onClick: startBlankArchitecturalPlan },
    { label: "Comodo", detail: "bloco rápido", icon: SquarePlus, onClick: addRoom },
    { label: "Parede", detail: "ponto a ponto", icon: Minus, onClick: () => selectArchitectureTool(architectureTool === "wall" ? "" : "wall"), tool: "wall" },
    { label: "Curva", detail: "3 pontos", icon: Spline, onClick: () => selectArchitectureTool(architectureTool === "curve" ? "" : "curve"), tool: "curve" },
    { label: "Nomear", detail: "nome do cômodo", icon: Type, onClick: () => selectArchitectureTool(architectureTool === "label" ? "" : "label"), tool: "label" },
    { label: "Porta", detail: "clique na parede", icon: DoorOpen, onClick: () => selectArchitectureTool(architectureTool === "door" ? "" : "door"), tool: "door" },
    { label: "Janela", detail: "clique na parede", icon: PanelTop, onClick: () => selectArchitectureTool(architectureTool === "window" ? "" : "window"), tool: "window" },
  ];

  const circuitOptions = useMemo(() => generatedCircuits.map((circuit, index) => ({
    ...circuit,
    id: circuitIdentifier(circuit, index),
    name: circuit.name || `Circuito ${index + 1}`,
    type: normalizeCircuitType(circuit.type),
    phase: circuit.phase || "",
  })), [generatedCircuits]);

  const getCircuitForRoute = (point = null) => {
    if (point?.circuit_id) {
      const linked = circuitOptions.find((circuit) => sameId(circuit.id, point.circuit_id));
      if (linked) return linked;
    }
    if (point?.circuit) {
      const linked = circuitOptions.find((circuit) => String(circuit.name || "").toLowerCase() === String(point.circuit || "").toLowerCase());
      if (linked) return linked;
    }
    if (routeCircuitId !== "auto") {
      return circuitOptions.find((circuit) => circuit.id === routeCircuitId) || null;
    }
    const pointType = String(point?.type || "").toLowerCase();
    const findCircuit = (matcher) => circuitOptions.find((circuit) => {
      const source = `${circuit.name || ""} ${circuit.type || ""}`.toLowerCase();
      return matcher(source);
    });
    if (["luminaria", "spot", "arandela", "interruptor", "inter2", "inter3", "inter3way"].includes(pointType)) {
      return findCircuit((source) => source.includes("ilum")) || circuitOptions[0] || { name: "Iluminação", type: "Iluminação" };
    }
    if (pointType.includes("chuveiro")) return findCircuit((source) => source.includes("chuveiro")) || circuitOptions[0] || { name: "Chuveiro", type: "Chuveiro" };
    if (pointType.includes("arcond")) return findCircuit((source) => source.includes("ar condicionado") || source.includes("arcond")) || circuitOptions[0] || { name: "Ar Condicionado", type: "Ar Condicionado" };
    if (["tue", "motor"].includes(pointType)) return findCircuit((source) => source.includes("espec") || source.includes("força") || source.includes("forca") || source.includes("tue")) || circuitOptions[0] || { name: "TUE / Força", type: "Tomadas de Uso Específico" };
    return findCircuit((source) => source.includes("tomada") || source.includes("tug")) || circuitOptions[0] || { name: "Tomadas", type: "Tomadas de Uso Geral" };
  };

  const getWireGaugeForRoute = (point = null) => {
    const circuit = getCircuitForRoute(point);
    const configuredGauge = point?.wire_gauge || circuit?.wire_gauge;
    if (configuredGauge) return String(configuredGauge).replace("mm²", "").replace(".", ",");
    const source = `${circuit?.type || ""} ${point?.type || ""}`.toLowerCase();
    if (source.includes("chuveiro")) return "6";
    if (source.includes("ar condicionado") || source.includes("arcond")) return "4";
    if (source.includes("ilum")) return "1,5";
    return "2,5";
  };

  const routeVisualPatch = (system = routeSystem) => {
    const systemType = normalizeRouteSystem(system);
    return {
      systemType,
      type: cableTypeForRouteSystem(systemType),
      color: colorForRouteSystem(systemType),
    };
  };

  const resolveRouteConduitDiameter = (...values) => {
    for (const value of values) {
      const normalized = normalizeConduitDiameter(value, "");
      if (normalized) return normalized;
    }
    return normalizeConduitDiameter(routeConduitDiameter, DEFAULT_CONDUIT_DIAMETER);
  };

  const getRouteDash = (mode = routeMode) => {
    const installationMode = normalizeCableInstallationMode(mode, "embutido");
    if (installationMode === "piso") return [12, 10];
    if (installationMode === "externa") return [18, 8, 4, 8];
    return [];
  };

  const clampRoutePct = (value, fallback = 50) => {
    const numeric = Number(value);
    return Math.max(4, Math.min(96, Number.isFinite(numeric) ? numeric : fallback));
  };

  const roundRoutePct = (value) => Math.round(clampRoutePct(value) * 10) / 10;

  const compactRoutePath = (path = []) => {
    const compacted = [];
    path.forEach((node) => {
      const nextNode = {
        x: roundRoutePct(node.x),
        y: roundRoutePct(node.y),
      };
      const previous = compacted[compacted.length - 1];
      if (previous && Math.hypot(nextNode.x - previous.x, nextNode.y - previous.y) < 0.35) return;
      compacted.push(nextNode);
    });
    return compacted;
  };

  const buildCleanRoutePath = (startPoint, endPoint, index = 0) => {
    const start = {
      x: roundRoutePct(startPoint.x),
      y: roundRoutePct(startPoint.y),
    };
    const end = {
      x: roundRoutePct(endPoint.x),
      y: roundRoutePct(endPoint.y),
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.hypot(dx, dy) < 0.8) return [start, end];

    const laneOffset = ((index % 7) - 3) * 0.9;
    const path = Math.abs(dx) >= Math.abs(dy)
      ? [
          start,
          { x: start.x, y: roundRoutePct((start.y + end.y) / 2 + laneOffset) },
          { x: end.x, y: roundRoutePct((start.y + end.y) / 2 + laneOffset) },
          end,
        ]
      : [
          start,
          { x: roundRoutePct((start.x + end.x) / 2 + laneOffset), y: start.y },
          { x: roundRoutePct((start.x + end.x) / 2 + laneOffset), y: end.y },
          end,
        ];

    return compactRoutePath(path);
  };

  const toolsById = TOOL_DEFINITIONS_BY_ID;

  const routePointLabel = (point = {}) => {
    if (!point || typeof point !== "object") return "Ponto sem identificação";
    const toolIds = pointToolIdCandidates(point);
    const toolId = toolIds.find((candidate) => toolsById[candidate]) || toolIds[0] || "";
    const tool = toolId ? toolsById[toolId] : null;
    const fallback = toolId ? `Item não identificado (${toolId})` : "Item sem identificação";
    return firstTextValue(
      point.label,
      point.name,
      tool?.label,
      tool?.name,
      fallback
    );
  };

  const componentTerminals = points.map((point) => ({
    ...pointToTerminal(point),
    label: routePointLabel(point),
    type: point.type,
  }));

  const roomTypeForPoint = (point = {}) => {
    if (point.room_type) return point.room_type;
    const containingRoom = rooms.find((room) => (
      isPointInsideRoom(point, room) ||
      String(point.room || "").trim().toLowerCase() === String(room.label || room.name || "").trim().toLowerCase()
    ));
    return containingRoom ? inferNBRRoomType(containingRoom.label || containingRoom.name, containingRoom.type) : "";
  };

  const roomInfoForPoint = (point = {}) => {
    const containingRoom = rooms.find((room) => (
      isPointInsideRoom(point, room) ||
      String(point.room || "").trim().toLowerCase() === String(room.label || room.name || "").trim().toLowerCase()
    ));
    const roomName = point.room || containingRoom?.label || containingRoom?.name || "";
    const roomType = point.room_type || containingRoom?.type || roomTypeForPoint(point);
    const inferredType = inferNBRRoomType(`${roomName} ${roomType}`, roomType);
    return {
      key: normalizeRoomKey(roomName || inferredType),
      name: roomName,
      type: inferredType,
    };
  };

  const closestPointTo = (source, candidates = []) => (
    candidates.reduce((closest, candidate) => {
      if (!closest) return candidate;
      const candidateDistance = Math.hypot(Number(candidate.x) - Number(source.x), Number(candidate.y) - Number(source.y));
      const closestDistance = Math.hypot(Number(closest.x) - Number(source.x), Number(closest.y) - Number(source.y));
      return candidateDistance < closestDistance ? candidate : closest;
    }, null)
  );

  const orderPointsByNearest = (source, candidates = []) => {
    const remaining = [...candidates];
    const ordered = [];
    let current = source;
    while (remaining.length > 0) {
      const next = closestPointTo(current, remaining);
      ordered.push(next);
      remaining.splice(remaining.indexOf(next), 1);
      current = next;
    }
    return ordered;
  };

  const applyCircuitDataToPlantPoint = (point, circuitByKey) => {
    const roomType = roomTypeForPoint(point);
    const key = circuitKeyForPoint(point, roomType);
    const circuit = circuitByKey[key];
    if (!circuit) return point;
    const preparedCircuit = enrichCircuitInstallation(circuit);
    const circuitId = circuitIdentifier(preparedCircuit);
    const pointLoad = Number(point.load_w);
    return {
      ...point,
      room_type: roomType || point.room_type || "",
      circuit_key: key,
      circuit_id: circuitId,
      circuit: preparedCircuit.name || point.circuit || "Circuito",
      circuit_type: preparedCircuit.type || point.circuit_type || "Circuito",
      load_w: Number.isFinite(pointLoad) ? pointLoad : Number(preparedCircuit.power_w) || 0,
      voltage: Number(preparedCircuit.voltage) || 127,
      supply_type: preparedCircuit.supply_type || "Monofásico",
      power_factor: preparedCircuit.power_factor || "",
      length_m: preparedCircuit.length_m || 15,
      install_method: preparedCircuit.install_method || "Eletroduto Embutido em Parede",
      wire_gauge: preparedCircuit.wire_gauge || "",
      wire_area: preparedCircuit.wire_area || "",
      breaker_a: preparedCircuit.breaker_a || "",
      breaker_poles: preparedCircuit.breaker_poles || "",
      breaker_curve: preparedCircuit.breaker_curve || "",
      project_current_a: preparedCircuit.project_current_a || "",
      corrected_current_a: preparedCircuit.corrected_current_a || "",
      conduit_diameter: preparedCircuit.conduit_diameter || "",
      cable_description: preparedCircuit.cable_description || "",
      conductor_count: preparedCircuit.conductor_count || "",
      electrical_config_mode: point.electrical_config_mode || "nbr5410",
    };
  };

  const syncRoutesForMovedPoint = (currentRoutes, pointId, nextPoint) => (
    updateCablesForMovedComponent(currentRoutes, pointId, pointToTerminal(nextPoint))
  );

  const createRouteBetweenPoints = (startPoint, endPoint, index = 0, mode = routeMode, overrides = {}) => {
    const circuit = getCircuitForRoute(endPoint);
    const preparedCircuit = circuit ? enrichCircuitInstallation(circuit) : null;
    const conduitDiameter = resolveRouteConduitDiameter(
      overrides.conduit_diameter,
      preparedCircuit?.conduit_diameter,
      endPoint.conduit_diameter,
    );
    const wireGauge = preparedCircuit?.wire_gauge || endPoint.wire_gauge || `${getWireGaugeForRoute(endPoint)}mm²`;
    const routeVisual = routeVisualPatch(overrides.systemType || overrides.system_type || routeSystem);
    const nextCable = createManualCable({
      source: pointToTerminal(startPoint),
      target: pointToTerminal(endPoint),
      name: overrides.name || overrides.label || preparedCircuit?.name || `Cabo ${index + 1}`,
      type: routeVisual.type,
      systemType: routeVisual.systemType,
      color: overrides.color || routeVisual.color,
      thickness: overrides.thickness || 1.4,
      routingMode: overrides.routingMode || (mode === "externa" ? "orthogonal" : "curved"),
      mode,
      gauge: wireGauge,
      wire_gauge: wireGauge,
      conduit_diameter: conduitDiameter,
      circuit_name: preparedCircuit?.name || "",
      circuit: preparedCircuit?.name || "",
      zIndex: routes.length + index,
    });

    return normalizeCableRoute({
      ...nextCable,
      label: nextCable.name,
      circuit_id: preparedCircuit?.id || "",
      circuit_name: preparedCircuit?.name || "",
      description: overrides.description || `${routePointLabel(startPoint)} -> ${routePointLabel(endPoint)}`,
      mode,
      start_id: startPoint.id || "",
      end_id: endPoint.id || "",
      ...(overrides.extra || {}),
    }, index);
  };

  const findCircuitForProfessionalRoute = (point = {}, circuits = []) => {
    const normalizedCircuits = normalizeProjectCircuits(circuits);
    if (point.circuit_id) {
      const linked = normalizedCircuits.find((circuit, index) => sameId(circuitIdentifier(circuit, index), point.circuit_id));
      if (linked) return linked;
    }
    if (point.circuit) {
      const linked = normalizedCircuits.find((circuit) => String(circuit.name || "").toLowerCase() === String(point.circuit || "").toLowerCase());
      if (linked) return linked;
    }

    const pointType = String(point.type || "").toLowerCase();
    const findCircuit = (matcher) => normalizedCircuits.find((circuit) => {
      const source = `${circuit.name || ""} ${circuit.type || ""}`.toLowerCase();
      return matcher(source);
    });
    if (["luminaria", "spot", "arandela", "interruptor", "inter2", "inter3", "inter3way"].includes(pointType)) {
      return findCircuit((source) => source.includes("ilum")) || normalizedCircuits[0] || { name: "Iluminação", type: "Iluminação", wire_gauge: "1.5mm²" };
    }
    if (pointType.includes("chuveiro")) return findCircuit((source) => source.includes("chuveiro")) || normalizedCircuits[0] || { name: "Chuveiro", type: "Chuveiro", wire_gauge: "6mm²" };
    if (pointType.includes("arcond")) return findCircuit((source) => source.includes("ar condicionado") || source.includes("arcond")) || normalizedCircuits[0] || { name: "Ar Condicionado", type: "Ar Condicionado", wire_gauge: "4mm²" };
    if (["tue", "motor"].includes(pointType)) return findCircuit((source) => source.includes("espec") || source.includes("força") || source.includes("forca") || source.includes("tue")) || normalizedCircuits[0] || { name: "TUE / Força", type: "Tomadas de Uso Específico", wire_gauge: "2.5mm²" };
    return findCircuit((source) => source.includes("tomada") || source.includes("tug")) || normalizedCircuits[0] || { name: "Tomadas", type: "Tomadas de Uso Geral", wire_gauge: "2.5mm²" };
  };

  const wireGaugeForProfessionalRoute = (point = {}, circuit = {}) => {
    const configuredGauge = point.wire_gauge || circuit.wire_gauge;
    if (configuredGauge) return String(configuredGauge).replace("mm²", "").replace(".", ",");
    const source = `${circuit.type || ""} ${point.type || ""}`.toLowerCase();
    if (source.includes("chuveiro")) return "6";
    if (source.includes("ar condicionado") || source.includes("arcond")) return "4";
    if (source.includes("ilum")) return "1,5";
    return "2,5";
  };

  const createProfessionalRouteBetweenPoints = (startPoint, endPoint, index = 0, mode = routeMode, circuits = [], overrides = {}) => {
    const circuit = findCircuitForProfessionalRoute(endPoint, circuits);
    const preparedCircuit = enrichCircuitInstallation(circuit || {});
    const gauge = wireGaugeForProfessionalRoute(endPoint, circuit);
    const conduitDiameter = resolveRouteConduitDiameter(
      overrides.conduit_diameter,
      preparedCircuit.conduit_diameter,
      endPoint.conduit_diameter,
    );
    const routeVisual = routeVisualPatch(overrides.systemType || overrides.system_type || "eletrica");
    const startTerminal = pointToTerminal(startPoint);
    const endTerminal = pointToTerminal(endPoint);
    const path = buildCleanRoutePath(startTerminal, endTerminal, index);

    return {
      id: `route-completo-${Date.now()}-${startPoint.id}-${endPoint.id}-${index}`,
      label: overrides.label || `${String(circuit?.name || "CIR").slice(0, 12)}  ${gauge}`,
      circuit_id: circuit?.id || endPoint.circuit_id || "",
      circuit_name: overrides.circuit_name || circuit?.name || "Circuito",
      type: routeVisual.type,
      systemType: routeVisual.systemType,
      color: overrides.color || routeVisual.color,
      wire_gauge: preparedCircuit.wire_gauge || endPoint.wire_gauge || `${gauge}mm²`,
      gauge: preparedCircuit.wire_gauge || endPoint.wire_gauge || `${gauge}mm²`,
      conduit_diameter: conduitDiameter,
      description: overrides.description || `${routePointLabel(startPoint)} -> ${routePointLabel(endPoint)} (${mode})`,
      path,
      source: startTerminal,
      target: endTerminal,
      dash: getRouteDash(mode),
      mode,
      routingMode: overrides.routingMode || (mode === "externa" ? "orthogonal" : "curved"),
      start_id: startPoint.id,
      end_id: endPoint.id,
      auto_generated: true,
      generated_source: "planta-ia-completa",
    };
  };

  const buildProfessionalRoutesFromBoard = ({ plantPoints = [], plantRoutes = [], circuits = [], mode = routeMode, includeInfrastructurePoints = false } = {}) => {
    const boardPoints = plantPoints.filter((point) => point.type === "qgbt" || point.type === "qe" || point.type === "caixa");
    if (boardPoints.length === 0) return plantRoutes;
    const getClosestBoard = (targetPoint) => closestPointTo(targetPoint, boardPoints) || boardPoints[0];
    const existingPairs = new Set(plantRoutes.map((route) => `${route.start_id || ""}->${route.end_id || ""}`));
    const consumedIds = new Set();
    const nextRoutes = [];
    const targetPoints = plantPoints.filter((point) => (
      !boardPoints.some(b => b.id === point.id) &&
      (includeInfrastructurePoints || !INFRA_POINT_TYPES.has(point.type))
    ));
    const addAutoRoute = (startPoint, endPoint, overrides = {}) => {
      if (!startPoint?.id || !endPoint?.id || sameId(startPoint.id, endPoint.id)) return;
      const pairKey = `${startPoint.id}->${endPoint.id}`;
      if (existingPairs.has(pairKey)) return;
      existingPairs.add(pairKey);
      nextRoutes.push(createProfessionalRouteBetweenPoints(
        startPoint,
        endPoint,
        plantRoutes.length + nextRoutes.length,
        mode,
        circuits,
        overrides,
      ));
    };

    const lights = targetPoints.filter((point) => LIGHT_POINT_TYPES.has(point.type));
    const switches = targetPoints.filter((point) => SWITCH_POINT_TYPES.has(point.type));

    switches.forEach((switchPoint) => {
      const switchRoom = roomInfoForPoint(switchPoint);
      const availableLights = lights.filter((lightPoint) => !consumedIds.has(lightPoint.id));
      const sameRoomLights = availableLights.filter((lightPoint) => {
        const lightRoom = roomInfoForPoint(lightPoint);
        return lightRoom.key && lightRoom.key === switchRoom.key;
      });
      const assignedLights = sameRoomLights.length > 0
        ? orderPointsByNearest(switchPoint, sameRoomLights)
        : (availableLights.length > 0 ? [closestPointTo(switchPoint, availableLights)] : []);

      addAutoRoute(getClosestBoard(switchPoint), switchPoint, {
        label: `Ilum. ${wireGaugeForProfessionalRoute(switchPoint, findCircuitForProfessionalRoute(switchPoint, circuits))}`,
        circuit_name: "Comando de Iluminação",
        description: `QD -> ${routePointLabel(switchPoint)} para comando das luminárias (${mode})`,
      });
      consumedIds.add(switchPoint.id);

      let previousPoint = switchPoint;
      assignedLights.filter(Boolean).forEach((lightPoint, index) => {
        addAutoRoute(previousPoint, lightPoint, {
          label: `Ilum. ${wireGaugeForProfessionalRoute(lightPoint, findCircuitForProfessionalRoute(lightPoint, circuits))}`,
          description: index === 0
            ? `${routePointLabel(switchPoint)} -> ${routePointLabel(lightPoint)} (${mode})`
            : `${routePointLabel(previousPoint)} -> ${routePointLabel(lightPoint)} em série (${mode})`,
        });
        consumedIds.add(lightPoint.id);
        previousPoint = lightPoint;
      });
    });

    lights
      .filter((lightPoint) => !consumedIds.has(lightPoint.id))
      .forEach((lightPoint) => {
        addAutoRoute(getClosestBoard(lightPoint), lightPoint, {
          label: `Ilum. ${wireGaugeForProfessionalRoute(lightPoint, findCircuitForProfessionalRoute(lightPoint, circuits))}`,
          description: `QD -> ${routePointLabel(lightPoint)} sem interruptor associado (${mode})`,
        });
        consumedIds.add(lightPoint.id);
      });

    targetPoints
      .filter((point) => DIRECT_QD_POINT_TYPES.has(point.type))
      .forEach((point) => {
        addAutoRoute(getClosestBoard(point), point, {
          label: `${routePointLabel(point).slice(0, 12)} ${wireGaugeForProfessionalRoute(point, findCircuitForProfessionalRoute(point, circuits))}`,
          description: `QD direto -> ${routePointLabel(point)} (${mode})`,
        });
        consumedIds.add(point.id);
      });

    const serialOutletsByGroup = new Map();
    targetPoints
      .filter((point) => SERIAL_OUTLET_POINT_TYPES.has(point.type))
      .forEach((point) => {
        const roomInfo = roomInfoForPoint(point);
        const circuitKey = point.circuit_id || point.circuit || point.circuit_name || point.circuit_key || "tomadas";
        const roomKey = roomInfo.key || "sem-ambiente";
        const groupKey = `${circuitKey}:${roomKey}`;
        serialOutletsByGroup.set(groupKey, [...(serialOutletsByGroup.get(groupKey) || []), point]);
      });

    serialOutletsByGroup.forEach((outletGroup) => {
      const closestBoard = getClosestBoard(outletGroup[0]);
      let previousPoint = closestBoard;
      orderPointsByNearest(closestBoard, outletGroup).forEach((outletPoint, index) => {
        addAutoRoute(previousPoint, outletPoint, {
          label: `TUG série ${wireGaugeForProfessionalRoute(outletPoint, findCircuitForProfessionalRoute(outletPoint, circuits))}`,
          description: index === 0
            ? `QD -> ${routePointLabel(outletPoint)} iniciando tomadas em série (${mode})`
            : `${routePointLabel(previousPoint)} -> ${routePointLabel(outletPoint)} em série (${mode})`,
        });
        consumedIds.add(outletPoint.id);
        previousPoint = outletPoint;
      });
    });

    targetPoints
      .filter((point) => !consumedIds.has(point.id))
      .forEach((point) => addAutoRoute(getClosestBoard(point), point));

    return [...plantRoutes, ...nextRoutes];
  };

  const routeNodesAreClose = (a, b, tolerance = 0.25) => (
    Boolean(a && b) &&
    Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0)) <= tolerance
  );

  const startCableDraft = (source) => {
    setRouteDraft({
      source,
      path: [{ x: Number(source.x), y: Number(source.y) }],
      routingMode: "curved",
    });
    setRouteStartId(source.componentId || "free");
  };

  const finishCableDraft = (target) => {
    if (!routeDraft?.source) {
      startCableDraft(target);
      return;
    }
    const draftPath = Array.isArray(routeDraft.path) ? routeDraft.path : [];
    const middleSource = routeNodesAreClose(draftPath[draftPath.length - 1], target, 0.3)
      ? draftPath.slice(1, -1)
      : draftPath.slice(1);
    const middlePoints = middleSource.map((point) => ({
      id: point.id || createCablePointId("node"),
      x: Number(point.x),
      y: Number(point.y),
    }));
    const sourceData = routeDraft.source || {};
    const targetData = target || {};
    const wireGauge = sourceData.wire_gauge || targetData.wire_gauge || "";
    const conduit_diameter = resolveRouteConduitDiameter(
      routeConduitDiameter,
      sourceData.conduit_diameter,
      targetData.conduit_diameter,
      sourceData.gauge,
      targetData.gauge,
    );
    const circuit_name = sourceData.circuit_name || sourceData.circuit || targetData.circuit_name || targetData.circuit || "";
    const routeVisual = routeVisualPatch(routeSystem);

    const nextCable = createManualCable({
      source: routeDraft.source,
      target,
      points: middlePoints,
      routingMode: routeDraft.routingMode || "curved",
      mode: routeMode,
      type: routeVisual.type,
      systemType: routeVisual.systemType,
      color: routeVisual.color,
      gauge: wireGauge,
      wire_gauge: wireGauge,
      conduit_diameter,
      circuit_name,
      zIndex: routes.length,
    });
    commitDesign({ routes: [...routes, normalizeCableRoute(nextCable, routes.length)] });
    setSelectedElement({ type: "route", id: nextCable.id });
    setRouteDraft(null);
    setRouteStartId("");
    setRouteToolActive(false);
    setRouteEditMode("editPath");
  };

  const handleRoutePointClick = (point) => {
    if (!routeToolActive || !point?.id) return;
    const terminal = pointToTerminal(point);

    if (routeMode === "sobe" || routeMode === "desce") {
      const conduit_diameter = resolveRouteConduitDiameter(routeConduitDiameter, terminal.conduit_diameter, terminal.gauge);
      const circuit_name = terminal.circuit_name || terminal.circuit || "";
      const tagText = `${conduit_diameter} · ${routeMode === "sobe" ? "Sobe" : "Desce"}`;
      const routeVisual = routeVisualPatch(routeSystem);

      const nextCable = createManualCable({
        source: terminal,
        target: terminal,
        points: [],
        routingMode: "curved",
        mode: routeMode,
        gauge: tagText,
        conduit_diameter,
        circuit_name,
        type: routeVisual.type,
        systemType: routeVisual.systemType,
        color: routeVisual.color,
        zIndex: routes.length,
      });
      commitDesign({ routes: [...routes, normalizeCableRoute(nextCable, routes.length)] });
      setSelectedElement({ type: "route", id: nextCable.id });
      setRouteStartId("");
      setRouteToolActive(false);
      return;
    }

    if (!routeDraft?.source) {
      startCableDraft(terminal);
      setSelectedElement({ type: "point", id: point.id });
      return;
    }
    finishCableDraft(terminal);
  };

  const handleRouteCanvasClick = (node) => {
    if (!routeToolActive || !node) return;
    const freePoint = { x: Number(node.x), y: Number(node.y) };

    if (routeMode === "sobe" || routeMode === "desce") {
      const conduit_diameter = resolveRouteConduitDiameter(routeConduitDiameter);
      const routeVisual = routeVisualPatch(routeSystem);
      const nextCable = createManualCable({
        source: freePoint,
        target: freePoint,
        points: [],
        routingMode: "curved",
        mode: routeMode,
        gauge: `${conduit_diameter} · ${routeMode === "sobe" ? "Sobe" : "Desce"}`,
        conduit_diameter,
        type: routeVisual.type,
        systemType: routeVisual.systemType,
        color: routeVisual.color,
        zIndex: routes.length,
      });
      commitDesign({ routes: [...routes, normalizeCableRoute(nextCable, routes.length)] });
      setSelectedElement({ type: "route", id: nextCable.id });
      setRouteToolActive(false);
      return;
    }

    if (!routeDraft?.source) {
      startCableDraft(freePoint);
      return;
    }
    setRouteDraft((current) => ({
      ...current,
      path: routeNodesAreClose((current?.path || [])[(current?.path || []).length - 1], freePoint, 0.25)
        ? (current?.path || [])
        : [...(current?.path || []), freePoint],
    }));
  };

  const handleRouteCanvasDoubleClick = (node) => {
    if (!routeToolActive || !node) return;
    const freePoint = { x: Number(node.x), y: Number(node.y) };
    if (routeMode === "sobe" || routeMode === "desce") return;

    if (!routeDraft?.source) {
      startCableDraft(freePoint);
      return;
    }
    finishCableDraft(freePoint);
  };

  const finishDraftWithLastPoint = () => {
    const path = routeDraft?.path || [];
    if (!routeDraft?.source || path.length < 2) return;
    const last = path[path.length - 1];
    finishCableDraft({ x: last.x, y: last.y });
  };

  const addConduitRoute = () => {
    setActiveTool("");
    setArchitectureTool("");
    setRouteToolActive((current) => {
      const next = !current;
      if (!next) {
        setRouteStartId("");
        setRouteDraft(null);
      }
      return next;
    });
  };

  const autoConnectFromBoard = (mode = routeMode, includeInfrastructurePoints = false) => {
    if (!canRouteToBoard) return;
    const boardPoints = points.filter((point) => point.type === "qgbt" || point.type === "qe" || point.type === "caixa");
    if (boardPoints.length === 0) return;
    const getClosestBoard = (targetPoint) => closestPointTo(targetPoint, boardPoints) || boardPoints[0];
    const baseRoutes = routes.filter((route) => !route.auto_generated && route.source !== "planta-ia-completa" && route.generated_source !== "planta-ia-completa");
    const targetPoints = points.filter((point) => (
      !boardPoints.some(b => b.id === point.id) &&
      (includeInfrastructurePoints || !INFRA_POINT_TYPES.has(point.type))
    ));
    const existingPairs = new Set(baseRoutes.map((route) => `${route.start_id || ""}->${route.end_id || ""}`));
    const consumedIds = new Set();
    const nextRoutes = [];
    const addAutoRoute = (startPoint, endPoint, overrides = {}) => {
      if (!startPoint?.id || !endPoint?.id || sameId(startPoint.id, endPoint.id)) return;
      const pairKey = `${startPoint.id}->${endPoint.id}`;
      if (existingPairs.has(pairKey)) return;
      existingPairs.add(pairKey);
      nextRoutes.push(createRouteBetweenPoints(
        startPoint,
        endPoint,
        routes.length + nextRoutes.length,
        mode,
        {
          ...overrides,
          extra: { auto_generated: true, ...(overrides.extra || {}) },
        },
      ));
    };

    const lights = targetPoints.filter((point) => LIGHT_POINT_TYPES.has(point.type));
    const switches = targetPoints.filter((point) => SWITCH_POINT_TYPES.has(point.type));

    switches.forEach((switchPoint) => {
      const switchRoom = roomInfoForPoint(switchPoint);
      const availableLights = lights.filter((lightPoint) => !consumedIds.has(lightPoint.id));
      const sameRoomLights = availableLights.filter((lightPoint) => {
        const lightRoom = roomInfoForPoint(lightPoint);
        return lightRoom.key && lightRoom.key === switchRoom.key;
      });
      const assignedLights = sameRoomLights.length > 0
        ? orderPointsByNearest(switchPoint, sameRoomLights)
        : (availableLights.length > 0 ? [closestPointTo(switchPoint, availableLights)] : []);

      addAutoRoute(getClosestBoard(switchPoint), switchPoint, {
        label: `Ilum. ${getWireGaugeForRoute(switchPoint)}`,
        circuit_name: "Comando de Iluminação",
        description: `QD -> ${routePointLabel(switchPoint)} para comando das luminárias (${mode})`,
      });
      consumedIds.add(switchPoint.id);

      let previousPoint = switchPoint;
      assignedLights.filter(Boolean).forEach((lightPoint, index) => {
        addAutoRoute(previousPoint, lightPoint, {
          label: `Ilum. ${getWireGaugeForRoute(lightPoint)}`,
          description: index === 0
            ? `${routePointLabel(switchPoint)} -> ${routePointLabel(lightPoint)} (${mode})`
            : `${routePointLabel(previousPoint)} -> ${routePointLabel(lightPoint)} em série (${mode})`,
        });
        consumedIds.add(lightPoint.id);
        previousPoint = lightPoint;
      });
    });

    lights
      .filter((lightPoint) => !consumedIds.has(lightPoint.id))
      .forEach((lightPoint) => {
        addAutoRoute(getClosestBoard(lightPoint), lightPoint, {
          label: `Ilum. ${getWireGaugeForRoute(lightPoint)}`,
          description: `QD -> ${routePointLabel(lightPoint)} sem interruptor associado (${mode})`,
        });
        consumedIds.add(lightPoint.id);
      });

    targetPoints
      .filter((point) => DIRECT_QD_POINT_TYPES.has(point.type))
      .forEach((point) => {
        addAutoRoute(getClosestBoard(point), point, {
          label: `${routePointLabel(point).slice(0, 12)} ${getWireGaugeForRoute(point)}`,
          description: `QD direto -> ${routePointLabel(point)} (${mode})`,
        });
        consumedIds.add(point.id);
      });

    const serialOutletsByGroup = new Map();
    targetPoints
      .filter((point) => SERIAL_OUTLET_POINT_TYPES.has(point.type))
      .forEach((point) => {
        const roomInfo = roomInfoForPoint(point);
        const circuitKey = point.circuit_id || point.circuit || point.circuit_name || point.circuit_key || "tomadas";
        const roomKey = roomInfo.key || "sem-ambiente";
        const groupKey = `${circuitKey}:${roomKey}`;
        serialOutletsByGroup.set(groupKey, [...(serialOutletsByGroup.get(groupKey) || []), point]);
      });

    serialOutletsByGroup.forEach((outletGroup) => {
      const closestBoard = getClosestBoard(outletGroup[0]);
      let previousPoint = closestBoard;
      orderPointsByNearest(closestBoard, outletGroup).forEach((outletPoint, index) => {
        addAutoRoute(previousPoint, outletPoint, {
          label: `TUG série ${getWireGaugeForRoute(outletPoint)}`,
          description: index === 0
            ? `QD -> ${routePointLabel(outletPoint)} iniciando tomadas em série (${mode})`
            : `${routePointLabel(previousPoint)} -> ${routePointLabel(outletPoint)} em série (${mode})`,
        });
        consumedIds.add(outletPoint.id);
        previousPoint = outletPoint;
      });
    });

    targetPoints
      .filter((point) => !consumedIds.has(point.id))
      .forEach((point) => {
        addAutoRoute(getClosestBoard(point), point);
      });

    if (nextRoutes.length === 0) {
      if (baseRoutes.length !== routes.length) commitDesign({ routes: baseRoutes });
      return;
    }
    commitDesign({ routes: [...baseRoutes, ...nextRoutes] });
    setSelectedElement({ type: "point", id: boardPoints[0].id });
  };

  const mountFullInfrastructureToBoard = (nextInfraType = infraType) => {
    const nextRouteMode = nextInfraType === "galvanizado" ? "externa" : "embutido";
    setInfraType(nextInfraType);
    setRouteMode(nextRouteMode);
    autoConnectFromBoard(nextRouteMode, true);
  };

  const handleInfraMethodChoice = (nextInfraType) => {
    const action = infraPromptAction;
    setInfraPromptAction("");
    if (!action) return;
    setInfraType(nextInfraType);
    if (action === "panel") {
      generatePanelBoardFromPlant(nextInfraType);
      return;
    }
    if (action === "routes") {
      mountFullInfrastructureToBoard(nextInfraType);
      return;
    }
    if (action === "panel-routes") {
      generatePanelBoardFromPlant(nextInfraType);
      mountFullInfrastructureToBoard(nextInfraType);
    }
  };

  const clearRoutes = () => {
    if (routes.length === 0) return;
    commitDesign({ routes: [] });
    setRouteStartId("");
    setRouteEditMode("");
    setRouteDraft(null);
    if (selectedElement?.type === "route") setSelectedElement(null);
  };

  const removeRoute = (routeId) => {
    commitDesign({ routes: routes.filter((route) => !sameId(route.id, routeId)) }, selectedElement?.type === "route" && sameId(selectedElement.id, routeId) ? { clearSelection: true } : {});
    if (selectedElement?.type === "route" && sameId(selectedElement.id, routeId)) setRouteEditMode("");
  };

  const updateRouteProperties = (routeId, patch) => {
    commitDesign({
      routes: routes.map((route) => sameId(route.id, routeId)
        ? normalizeCableRoute({ ...route, ...patch }, routes.findIndex((item) => sameId(item.id, routeId)))
        : route),
    });
  };

  const disconnectRouteEndpoint = (routeId, side) => {
    const route = routes.find((item) => sameId(item.id, routeId));
    if (!route || !["source", "target"].includes(side)) return;
    updateRouteProperties(routeId, {
      [side]: {
        x: Number(route[side]?.x) || cablePath(route)[side === "source" ? 0 : cablePath(route).length - 1]?.x || 50,
        y: Number(route[side]?.y) || cablePath(route)[side === "source" ? 0 : cablePath(route).length - 1]?.y || 50,
      },
    });
  };

  const bringRouteForward = (routeId) => {
    const maxZ = routes.reduce((max, route) => Math.max(max, Number(route.zIndex) || 0), 0);
    updateRouteProperties(routeId, { zIndex: maxZ + 1 });
  };

  const sendRouteBackward = (routeId) => {
    const minZ = routes.reduce((min, route) => Math.min(min, Number(route.zIndex) || 0), 0);
    updateRouteProperties(routeId, { zIndex: minZ - 1 });
  };

  const verifyCableConnections = () => {
    const issues = validateCableConnections(routes, componentTerminals);
    setCableValidationIssues(issues);
    if (issues[0]?.cableId) {
      setSelectedElement({ type: "route", id: issues[0].cableId });
      setRouteEditMode("editPath");
    }
  };

  const updateRoutePoint = (routeId, nodeIndex, nextNode, options = {}) => {
    const route = routes.find((item) => sameId(item.id, routeId));
    if (!route) return;
    const path = cablePath(route);
    if (!path[nodeIndex]) return;
    const isEndpoint = nodeIndex === 0 || nodeIndex === path.length - 1;
    const snappedTerminal = options.commit && isEndpoint
      ? findNearestTerminal(componentTerminals, nextNode)
      : null;
    const finalNode = snappedTerminal || nextNode;
    const connection = snappedTerminal
      ? { componentId: snappedTerminal.componentId, terminalId: snappedTerminal.terminalId }
      : null;
    const updatedRoute = updateCableNode(route, nodeIndex, finalNode, connection);
    const nextRoutes = routes.map((item) => sameId(item.id, routeId) ? updatedRoute : item);
    if (options.commit === false) {
      latestRoutesRef.current = nextRoutes;
      setRoutes(nextRoutes);
      return;
    }
    commitDesign({ routes: nextRoutes });
  };

  const routePointToCanvas = (node) => ({
    x: (Number(node.x) || 0) / 100 * EDITOR_DESIGN_SIZE.w,
    y: (Number(node.y) || 0) / 100 * EDITOR_DESIGN_SIZE.h,
  });

  const routeProjectionDistance = (point, start, end) => {
    const p = routePointToCanvas(point);
    const a = routePointToCanvas(start);
    const b = routePointToCanvas(end);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
      : 0;
    const projected = { x: a.x + dx * t, y: a.y + dy * t };
    return {
      distance: Math.hypot(p.x - projected.x, p.y - projected.y),
      t,
    };
  };

  const addRoutePoint = (routeId, node) => {
    const route = routes.find((item) => sameId(item.id, routeId));
    const path = route ? cablePath(route) : [];
    if (path.length < 2) return;
    const nextNode = { x: roundRoutePct(node.x), y: roundRoutePct(node.y) };
    const duplicate = path.some((item) => Math.hypot(Number(item.x) - nextNode.x, Number(item.y) - nextNode.y) < 0.45);
    if (duplicate) return;

    let insertIndex = 1;
    let best = null;
    for (let index = 0; index < path.length - 1; index += 1) {
      const projection = routeProjectionDistance(nextNode, path[index], path[index + 1]);
      if (!best || projection.distance < best.distance) {
        best = projection;
        insertIndex = index + 1;
      }
    }

    const updatedRoute = addCableNode(route, nextNode, insertIndex);
    commitDesign({ routes: routes.map((item) => sameId(item.id, routeId) ? updatedRoute : item) });
    setRouteEditMode("editPath");
  };

  const removeRoutePoint = (routeId, nodeIndex) => {
    const route = routes.find((item) => sameId(item.id, routeId));
    const path = route ? cablePath(route) : [];
    if (path.length <= 2 || nodeIndex <= 0 || nodeIndex >= path.length - 1) return;
    const updatedRoute = removeCableNode(route, nodeIndex);
    commitDesign({ routes: routes.map((item) => sameId(item.id, routeId) ? updatedRoute : item) });
    setRouteEditMode("editPath");
  };

  const moveRoute = (routeId, dx, dy, options = {}) => {
    const baseRoutes = options.commit === false && latestRoutesRef.current.length
      ? latestRoutesRef.current
      : routes;
    const nextRoutes = baseRoutes.map((route) => (
      sameId(route.id, routeId) ? moveCable(route, dx, dy) : route
    ));
    latestRoutesRef.current = nextRoutes;
    if (options.commit === false) {
      setRoutes(nextRoutes);
      return;
    }
    commitDesign({ routes: nextRoutes });
  };

  const commitRouteDrag = () => {
    commitDesign({ routes: latestRoutesRef.current.length ? latestRoutesRef.current : routes });
  };

  const resetRoutePath = (routeId) => {
    const route = routes.find((item) => sameId(item.id, routeId));
    const path = route ? cablePath(route) : [];
    if (path.length < 2) return;
    const resetRoute = syncCableFromPath(route, [path[0], path[path.length - 1]]);
    const nextRoutes = routes.map((route) => (
      sameId(route.id, routeId)
        ? resetRoute
        : route
    ));
    commitDesign({ routes: nextRoutes });
    setSelectedRoutePointIndex(null);
    setRouteEditMode("editPath");
  };

  const selectCanvasElement = (element) => {
    setSelectedElement(element);
    setSelectedRoutePointIndex(null);
    if (element?.type === "route") {
      setActiveTool("");
      setArchitectureTool("");
      setRouteToolActive(false);
      setRouteStartId("");
      setSidebar("tools");
      setLeftPanelOpen(true);
      return;
    }
    if (element?.type === "wallDimension" || element?.type === "deviceDimension" || element?.type === "pointText") {
      setActiveTool("");
      setArchitectureTool("");
      setRouteToolActive(false);
      setRouteStartId("");
      setSidebar("tools");
      setLeftPanelOpen(true);
    }
    setRouteEditMode("");
  };

  const routeModeLabel = (mode) => ROUTE_INSTALLATION_LABELS[normalizeCableInstallationMode(mode, "embutido")] || "Teto/Parede";

  const mountedRoomsForAi = () => rooms.map((room) => ({
    name: room.label,
    x_pct: room.x,
    y_pct: room.y,
    w_pct: room.w,
    h_pct: room.h,
    area_m2: Number.parseFloat(String(room.area || "").replace(",", ".")) || 0,
  }));

  const selectedPoint = selectedElement?.type === "point"
    ? points.find((point) => sameId(point.id, selectedElement.id)) || null
    : null;
  const selectedRoute = selectedElement?.type === "route"
    ? routes.find((route) => sameId(route.id, selectedElement.id)) || null
    : null;
  const selectedRouteSystem = selectedRoute
    ? normalizeRouteSystem(selectedRoute.systemType || selectedRoute.system_type || selectedRoute.system || selectedRoute.type)
    : "eletrica";
  const selectedRouteConduitDiameter = selectedRoute
    ? normalizeConduitDiameter(selectedRoute.conduit_diameter || selectedRoute.conduitDiameter || selectedRoute.gauge, DEFAULT_CONDUIT_DIAMETER)
    : DEFAULT_CONDUIT_DIAMETER;
  const selectedWallDimension = selectedElement?.type === "wallDimension"
    ? walls.find((wall) => sameId(wall.id, selectedElement.id)) || null
    : null;
  const selectedDeviceDimensionPoint = selectedElement?.type === "deviceDimension"
    ? points.find((point) => sameId(point.id, selectedElement.id)) || null
    : null;
  const selectedPointTextPoint = selectedElement?.type === "pointText"
    ? points.find((point) => sameId(point.id, selectedElement.id)) || null
    : null;

  useEffect(() => {
    if (selectedElement?.type !== "route") {
      setRouteEditMode("");
      setSelectedRoutePointIndex(null);
    }
  }, [selectedElement?.id, selectedElement?.type]);
  const circuitModalPoint = circuitModalPointId
    ? points.find((point) => sameId(point.id, circuitModalPointId)) || null
    : null;

  const pointCircuitPreview = useMemo(() => {
    if (!pointCircuitForm.power_w || !pointCircuitForm.voltage || !pointCircuitForm.supply_type) return null;
    return enrichCircuitInstallation(calcCircuit({
      ...pointCircuitForm,
      power_w: Number(pointCircuitForm.power_w) || 0,
      voltage: Number(pointCircuitForm.voltage) || 127,
      power_factor: Number(pointCircuitForm.power_factor) || undefined,
      length_m: Number(pointCircuitForm.length_m) || 15,
      temp_ambient: Number(pointCircuitForm.temp_ambient) || 30,
      group_count: Number(pointCircuitForm.group_count) || 1,
      point_count: Number(pointCircuitForm.point_count) || 1,
      demand_factor: Number(pointCircuitForm.demand_factor) || 1,
    }));
  }, [pointCircuitForm]);

  const updatePointCircuitForm = (key, value) => {
    setPointCircuitForm((current) => ({ ...current, [key]: value }));
  };

  const openCircuitConfigForPoint = useCallback((point, preferredMode = "") => {
    if (!point || !isCircuitConfigurablePoint(point)) return;
    const defaults = getPointCircuitDefaults(point, selectedProjectData || {});
    const linkedCircuit = circuitOptions.find((circuit) => (
      sameId(circuit.id, point.circuit_id) ||
      String(circuit.name || "").toLowerCase() === String(point.circuit || "").toLowerCase()
    ));
    const initialMode = preferredMode || (linkedCircuit || circuitOptions.length > 0 ? "existing" : "custom");
    setPointCircuitMode(initialMode === "existing" && circuitOptions.length > 0 ? "existing" : "custom");
    setPointCircuitForm({
      ...CIRCUIT_FORM_EMPTY,
      circuit_id: linkedCircuit?.id || circuitOptions[0]?.id || "",
      name: point.circuit || defaults.name,
      type: normalizeCircuitType(point.circuit_type || defaults.type),
      power_w: String(point.load_w || defaults.power_w || ""),
      voltage: String(point.voltage || defaults.voltage || selectedProjectData?.voltage || 127),
      supply_type: point.supply_type || defaults.supply_type || selectedProjectData?.supply_type || "Monofásico",
      power_factor: String(point.power_factor || defaults.power_factor || 1),
      length_m: String(point.length_m || defaults.length_m || 15),
      install_method: point.install_method || defaults.install_method || "Eletroduto Embutido em Parede",
      temp_ambient: String(point.temp_ambient || 30),
      group_count: String(point.group_count || 1),
      point_count: String(point.point_count || 1),
      demand_factor: String(point.demand_factor || 1),
    });
    setCircuitModalPointId(String(point.id));
  }, [circuitOptions, selectedProjectData]);

  useEffect(() => {
    if (!selectedPoint || !isCircuitConfigurablePoint(selectedPoint)) {
      lastCircuitPromptRef.current = "";
      return;
    }
    const key = String(selectedPoint.id);
    if (lastCircuitPromptRef.current === key) return;
    lastCircuitPromptRef.current = key;
    try {
      openCircuitConfigForPoint(selectedPoint);
    } catch (error) {
      console.error("Erro ao abrir configuração do ponto:", error);
      setCircuitModalPointId("");
    }
  }, [openCircuitConfigForPoint, selectedPoint]);

  const applyCircuitMetadataToPoint = (point, circuit, mode = "existing") => {
    const preparedCircuit = enrichCircuitInstallation(circuit);
    const circuitId = circuitIdentifier(preparedCircuit);
    const pointPatch = {
      circuit_id: circuitId,
      circuit: preparedCircuit.name || "Circuito",
      circuit_type: preparedCircuit.type || "Circuito",
      load_w: Number(preparedCircuit.power_w) || 0,
      voltage: Number(preparedCircuit.voltage) || 127,
      supply_type: preparedCircuit.supply_type || "Monofásico",
      power_factor: preparedCircuit.power_factor || "",
      length_m: preparedCircuit.length_m || 15,
      install_method: preparedCircuit.install_method || "Eletroduto Embutido em Parede",
      wire_gauge: preparedCircuit.wire_gauge || "",
      wire_area: preparedCircuit.wire_area || "",
      breaker_a: preparedCircuit.breaker_a || "",
      breaker_poles: preparedCircuit.breaker_poles || "",
      breaker_curve: preparedCircuit.breaker_curve || "",
      project_current_a: preparedCircuit.project_current_a || "",
      corrected_current_a: preparedCircuit.corrected_current_a || "",
      conduit_diameter: preparedCircuit.conduit_diameter || "",
      cable_description: preparedCircuit.cable_description || "",
      conductor_count: preparedCircuit.conductor_count || "",
      electrical_config_mode: mode,
    };
    const nextPoints = points.map((item) => sameId(item.id, point.id) ? { ...item, ...pointPatch } : item);
    const routeConduit = resolveRouteConduitDiameter(preparedCircuit.conduit_diameter);
    const nextRoutes = routes.map((route) => {
      if (!sameId(route.start_id, point.id) && !sameId(route.end_id, point.id)) return route;
      return {
        ...route,
        circuit_id: circuitId,
        circuit_name: preparedCircuit.name || route.circuit_name,
        wire_gauge: preparedCircuit.wire_gauge || route.wire_gauge,
        conduit_diameter: routeConduit || route.conduit_diameter,
        label: `${String(preparedCircuit.name || "CIR").slice(0, 12)}  ${routeConduit}`,
      };
    });
    const snapshot = currentDesignSnapshot({ points: nextPoints, routes: nextRoutes });
    commitDesign({ points: nextPoints, routes: nextRoutes });
    return { nextPoints, nextRoutes, snapshot, circuit: preparedCircuit };
  };

  const handleApplyExistingCircuitToPoint = async () => {
    if (!circuitModalPoint || !pointCircuitForm.circuit_id) return;
    const selectedCircuit = generatedCircuits.find((circuit, index) => sameId(circuitIdentifier(circuit, index), pointCircuitForm.circuit_id));
    if (!selectedCircuit) return;
    setSaving(true);
    try {
      const normalizedCircuit = enrichCircuitInstallation(calcCircuit({
        ...selectedCircuit,
        id: pointCircuitForm.circuit_id,
        power_w: Number(selectedCircuit.power_w || selectedCircuit.load_w_total) || 0,
        voltage: Number(selectedCircuit.voltage) || 127,
        length_m: Number(selectedCircuit.length_m) || 15,
        group_count: Number(selectedCircuit.group_count) || 1,
        point_count: Number(selectedCircuit.point_count) || 1,
        temp_ambient: Number(selectedCircuit.temp_ambient) || 30,
      }));
      const { snapshot } = applyCircuitMetadataToPoint(circuitModalPoint, normalizedCircuit, "existing");
      await persistPlantDesignSnapshot(snapshot);
      setCircuitModalPointId("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePointCircuit = async () => {
    if (!circuitModalPoint || !pointCircuitPreview) return;
    setSaving(true);
    try {
      const project = selectedProject ? await backend.entities.Project.get(selectedProject) : selectedProjectData;
      const existingCircuits = normalizeProjectCircuits(
        generatedCircuits.length > 0 ? generatedCircuits : (project?.circuits || [])
      );
      const circuitId = circuitModalPoint.circuit_id && String(circuitModalPoint.circuit_id).startsWith("plant-circuit-")
        ? circuitModalPoint.circuit_id
        : `plant-circuit-${circuitModalPoint.id}`;
      const draftCircuit = enrichCircuitInstallation({
        ...pointCircuitPreview,
        id: circuitId,
        circuit_id: circuitId,
        source: "planta",
        source_point_id: String(circuitModalPoint.id),
        name: pointCircuitForm.name.trim() || pointCircuitPreview.name || "Circuito da planta",
        description: pointCircuitForm.description || `Criado na planta a partir de ${routePointLabel(circuitModalPoint)}`,
        type: normalizeCircuitType(pointCircuitForm.type),
        load_w_total: Number(pointCircuitPreview.power_w) || 0,
      });
      const withoutCurrentPoint = existingCircuits.filter((circuit) => (
        !sameId(circuit.id, circuitId) && !sameId(circuit.source_point_id, circuitModalPoint.id)
      ));
      const balancedCircuits = autoBalancePhases([...withoutCurrentPoint, draftCircuit]).map(enrichCircuitInstallation);
      const savedCircuit = balancedCircuits.find((circuit) => sameId(circuit.id, circuitId)) || draftCircuit;
      const { snapshot } = applyCircuitMetadataToPoint(circuitModalPoint, savedCircuit, "plant");

      setGeneratedCircuits(normalizeProjectCircuits(balancedCircuits));

      if (selectedProject && project) {
        await backend.entities.Project.update(selectedProject, {
          ...buildProjectElectricalSyncPayload(project, balancedCircuits),
          plant_design: snapshot,
          plant_points_count: snapshot.points.length,
          plant_routes_count: snapshot.routes.length,
        });

        const refreshedProject = await backend.entities.Project.get(selectedProject);
        setSelectedProjectData(refreshedProject);
        setGeneratedCircuits(normalizeProjectCircuits(refreshedProject.circuits || []));
      }

      setCircuitModalPointId("");
      setActiveRightTab("circuits");
      setRightPanelOpen(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const createLightingCircuitFromPlant = async () => {
    setSaving(true);
    try {
      const project = selectedProject ? await backend.entities.Project.get(selectedProject) : selectedProjectData;
      const existingLightingPoints = points.filter((point) => LIGHT_POINT_TYPES.has(String(point.type || "")));
      const firstRoom = rooms[0];
      const fallbackLightingPoint = existingLightingPoints.length > 0 ? null : normalizePlantPointForEditor({
        id: `point-lighting-${Date.now()}`,
        type: "luminaria",
        label: "Luminária inicial",
        x: clampPct(Number(firstRoom?.x || 0) + Number(firstRoom?.w || 0) / 2, 50),
        y: clampPct(Number(firstRoom?.y || 0) + Number(firstRoom?.h || 0) / 2, 50),
        load_w: 100,
        height: "teto",
        room: firstRoom?.label || firstRoom?.name || "",
        circuit_type: "Iluminação",
      }, points.length);
      const basePoints = fallbackLightingPoint ? [...points, fallbackLightingPoint] : points;
      const lightingPoints = fallbackLightingPoint ? [fallbackLightingPoint] : existingLightingPoints;
      const pointCount = Math.max(1, lightingPoints.length);
      const totalPower = Math.max(100, lightingPoints.reduce((total, point) => {
        const fallbackPower = point.type === "spot" ? 50 : point.type === "arandela" ? 60 : 100;
        return total + (Number(point.load_w) || fallbackPower);
      }, 0));
      const existingCircuits = normalizeProjectCircuits(
        generatedCircuits.length > 0 ? generatedCircuits : (project?.circuits || [])
      );
      const existingLighting = existingCircuits.find((circuit) => {
        const source = `${circuit.name || ""} ${circuit.type || ""}`.toLowerCase();
        return source.includes("ilumina") || source.includes("luz");
      });
      const circuitId = existingLighting?.id || "plant-circuit-iluminacao";
      const draftCircuit = enrichCircuitInstallation(calcCircuit({
        ...(existingLighting || {}),
        id: circuitId,
        circuit_id: circuitId,
        source: "planta",
        name: existingLighting?.name || "C01 Iluminação",
        description: "Circuito de iluminação criado pela planta baixa.",
        type: "Iluminação",
        power_w: totalPower,
        load_w_total: totalPower,
        voltage: Number(existingLighting?.voltage || project?.voltage || selectedProjectData?.voltage) || 127,
        supply_type: existingLighting?.supply_type || project?.supply_type || selectedProjectData?.supply_type || "Monofásico",
        power_factor: Number(existingLighting?.power_factor) || 0.92,
        length_m: Number(existingLighting?.length_m) || 15,
        install_method: existingLighting?.install_method || "Eletroduto Embutido em Parede",
        temp_ambient: Number(existingLighting?.temp_ambient) || 30,
        group_count: Number(existingLighting?.group_count) || 1,
        point_count: pointCount,
        demand_factor: 1,
      }));
      const balancedCircuits = autoBalancePhases([
        ...existingCircuits.filter((circuit) => !sameId(circuit.id, circuitId)),
        draftCircuit,
      ]).map(enrichCircuitInstallation);
      const savedCircuit = balancedCircuits.find((circuit) => sameId(circuit.id, circuitId)) || draftCircuit;
      const routeConduit = resolveRouteConduitDiameter(savedCircuit.conduit_diameter);
      const pointPatch = {
        circuit_id: circuitId,
        circuit: savedCircuit.name || "C01 Iluminação",
        circuit_type: "Iluminação",
        voltage: Number(savedCircuit.voltage) || 127,
        supply_type: savedCircuit.supply_type || "Monofásico",
        power_factor: savedCircuit.power_factor || 0.92,
        length_m: savedCircuit.length_m || 15,
        install_method: savedCircuit.install_method || "Eletroduto Embutido em Parede",
        wire_gauge: savedCircuit.wire_gauge || "1.5mm²",
        wire_area: savedCircuit.wire_area || 1.5,
        breaker_a: savedCircuit.breaker_a || "",
        breaker_poles: savedCircuit.breaker_poles || "",
        breaker_curve: savedCircuit.breaker_curve || "",
        project_current_a: savedCircuit.project_current_a || "",
        corrected_current_a: savedCircuit.corrected_current_a || "",
        conduit_diameter: routeConduit || savedCircuit.conduit_diameter || "",
        cable_description: savedCircuit.cable_description || "",
        conductor_count: savedCircuit.conductor_count || "",
        electrical_config_mode: "plant-lighting",
      };
      const nextPoints = basePoints.map((point) => (
        LIGHT_POINT_TYPES.has(String(point.type || ""))
          ? {
              ...point,
              ...pointPatch,
              load_w: Number(point.load_w) || (point.type === "spot" ? 50 : point.type === "arandela" ? 60 : 100),
            }
          : point
      ));
      const lightingPointIds = new Set(lightingPoints.map((point) => String(point.id)));
      const nextRoutes = routes.map((route) => {
        if (!lightingPointIds.has(String(route.start_id)) && !lightingPointIds.has(String(route.end_id))) return route;
        return {
          ...route,
          circuit_id: circuitId,
          circuit_name: savedCircuit.name || route.circuit_name,
          wire_gauge: savedCircuit.wire_gauge || route.wire_gauge,
          conduit_diameter: routeConduit || route.conduit_diameter,
          label: `${String(savedCircuit.name || "ILU").slice(0, 12)}  ${routeConduit}`,
        };
      });
      const snapshot = currentDesignSnapshot({ points: nextPoints, routes: nextRoutes });

      commitDesign({ points: normalizePlantPointsForEditor(nextPoints), routes: nextRoutes });
      if (fallbackLightingPoint) {
        setSelectedElement({ type: "point", id: fallbackLightingPoint.id });
      }
      setGeneratedCircuits(normalizeProjectCircuits(balancedCircuits));

      if (selectedProject && project) {
        await backend.entities.Project.update(selectedProject, {
          ...buildProjectElectricalSyncPayload(project, balancedCircuits),
          plant_design: snapshot,
          plant_points_count: snapshot.points.length,
          plant_routes_count: snapshot.routes.length,
        });
        const refreshedProject = await backend.entities.Project.get(selectedProject);
        setSelectedProjectData(refreshedProject);
        setGeneratedCircuits(normalizeProjectCircuits(refreshedProject.circuits || []));
      }

      setActiveRightTab("circuits");
      setRightPanelOpen(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      console.error(error);
      alert("Não foi possível criar o circuito de iluminação pela planta.");
    } finally {
      setSaving(false);
    }
  };

  const applyNBRRequirementsToPlant = async () => {
    if (roomNBRAnalysis.length === 0) {
      alert("Adicione cômodos com dimensões na planta antes de aplicar a NBR 5410.");
      return;
    }

    setSaving(true);
    try {
      const project = selectedProject ? await backend.entities.Project.get(selectedProject) : selectedProjectData;
      const existingCircuits = normalizeProjectCircuits(
        generatedCircuits.length > 0 ? generatedCircuits : (project?.circuits || [])
      );
      const circuitDrafts = buildNBRCircuitDrafts(roomNBRAnalysis, project || selectedProjectData || {});
      const preservedCircuits = existingCircuits.filter((circuit) => (
        circuit.source !== "planta_nbr" &&
        !String(circuit.id || circuit.circuit_id || "").startsWith("plant-nbr-")
      ));
      const balancedCircuits = autoBalancePhases([...preservedCircuits, ...circuitDrafts]).map(enrichCircuitInstallation);
      const circuitByKey = {
        lighting: balancedCircuits.find((circuit) => sameId(circuit.id, "plant-nbr-lighting")),
        tugGeneral: balancedCircuits.find((circuit) => sameId(circuit.id, "plant-nbr-tug-general")),
        tugWet: balancedCircuits.find((circuit) => sameId(circuit.id, "plant-nbr-tug-wet")),
      };

      let serial = 0;
      const stamp = Date.now();
      const addedPoints = roomNBRAnalysis.flatMap((roomRequirement) => (
        roomRequirement.suggestedPoints.map((point) => ({
          id: `nbr-${stamp}-${serial += 1}`,
          ...point,
        }))
      ));

      const nextPoints = [...points, ...addedPoints].map((point) => applyCircuitDataToPlantPoint(point, circuitByKey));
      const nextRooms = rooms.map((room) => {
        const requirement = roomNBRAnalysis.find((item) => sameId(item.roomId, room.id));
        if (!requirement) return room;
        return {
          ...room,
          area: `${formatPtNumber(requirement.metrics.areaM2, 2)} m²`,
          nbr5410: {
            room_type: requirement.type,
            area_m2: requirement.metrics.areaM2,
            perimeter_m: requirement.metrics.perimeterM,
            lighting_points: requirement.lightingPointCount,
            lighting_power_va: requirement.lightingPowerVa,
            tug_points: requirement.tugCount,
            tug_power_va: requirement.tugPowerVa,
          },
        };
      });

      const snapshot = currentDesignSnapshot({ points: nextPoints, rooms: nextRooms });
      commitDesign({ points: nextPoints, rooms: nextRooms });
      setGeneratedCircuits(normalizeProjectCircuits(balancedCircuits));

      if (selectedProject && project) {
        await backend.entities.Project.update(selectedProject, {
          ...buildProjectElectricalSyncPayload(project, balancedCircuits),
          plant_design: snapshot,
          plant_points_count: snapshot.points.length,
          plant_routes_count: snapshot.routes.length,
        });

        const refreshedProject = await backend.entities.Project.get(selectedProject);
        setSelectedProjectData(refreshedProject);
        setGeneratedCircuits(normalizeProjectCircuits(refreshedProject.circuits || []));
      }

      setActiveRightTab("nbr");
      setRightPanelOpen(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (error) {
      console.error(error);
      alert("Não foi possível aplicar automaticamente a NBR 5410 nesta planta.");
    } finally {
      setSaving(false);
    }
  };

  const buildCompleteProfessionalProject = async () => {
    if (roomNBRAnalysis.length === 0) {
      alert("Desenhe ou importe cômodos com medidas antes de gerar o projeto completo.");
      return;
    }

    setSaving(true);
    try {
      const project = selectedProject ? await backend.entities.Project.get(selectedProject) : selectedProjectData;
      const existingCircuits = normalizeProjectCircuits(
        generatedCircuits.length > 0 ? generatedCircuits : (project?.circuits || [])
      );
      const circuitDrafts = buildNBRCircuitDrafts(roomNBRAnalysis, project || selectedProjectData || {});
      const preservedCircuits = existingCircuits.filter((circuit) => (
        circuit.source !== "planta_nbr" &&
        !String(circuit.id || circuit.circuit_id || "").startsWith("plant-nbr-")
      ));
      const balancedCircuits = autoBalancePhases([...preservedCircuits, ...circuitDrafts]).map(enrichCircuitInstallation);
      const circuitByKey = {
        lighting: balancedCircuits.find((circuit) => sameId(circuit.id, "plant-nbr-lighting")),
        tugGeneral: balancedCircuits.find((circuit) => sameId(circuit.id, "plant-nbr-tug-general")),
        tugWet: balancedCircuits.find((circuit) => sameId(circuit.id, "plant-nbr-tug-wet")),
      };

      let serial = 0;
      const stamp = Date.now();
      const addedPoints = roomNBRAnalysis.flatMap((roomRequirement) => (
        roomRequirement.suggestedPoints.map((point) => ({
          id: `nbr-full-${stamp}-${serial += 1}`,
          ...point,
        }))
      ));

      const nextRooms = rooms.map((room) => {
        const requirement = roomNBRAnalysis.find((item) => sameId(item.roomId, room.id));
        if (!requirement) return room;
        return {
          ...room,
          area: `${formatPtNumber(requirement.metrics.areaM2, 2)} m²`,
          nbr5410: {
            room_type: requirement.type,
            area_m2: requirement.metrics.areaM2,
            perimeter_m: requirement.metrics.perimeterM,
            lighting_points: requirement.lightingPointCount,
            lighting_power_va: requirement.lightingPowerVa,
            tug_points: requirement.tugCount,
            tug_power_va: requirement.tugPowerVa,
          },
        };
      });

      let nextPoints = [...points, ...addedPoints].map((point) => applyCircuitDataToPlantPoint(point, circuitByKey));
      if (!nextPoints.some((point) => point.type === "qgbt" || point.type === "qe")) {
        const firstRoom = nextRooms[0];
        nextPoints = [
          ...nextPoints,
          {
            id: `board-completo-${stamp}`,
            type: "qe",
            label: selectedPanelBoard?.name || "QD-01 Principal",
            x: firstRoom ? clampPct(Number(firstRoom.x) + 2, 48) : 50,
            y: firstRoom ? clampPct(Number(firstRoom.y) + 8, 66) : 66,
            circuit: null,
            load_w: 0,
            room: firstRoom?.label || "Entrada / Distribuição",
            rotation: 0,
            source: "planta-ia-completa",
          },
        ];
      }

      const nextInfraType = infraType || "embutido";
      const nextRouteMode = nextInfraType === "galvanizado" ? "externa" : "embutido";
      const nextRoutes = buildProfessionalRoutesFromBoard({
        plantPoints: nextPoints,
        plantRoutes: routes.filter((route) => route.source !== "planta-ia-completa" && route.generated_source !== "planta-ia-completa"),
        circuits: balancedCircuits,
        mode: nextRouteMode,
        includeInfrastructurePoints: true,
      });
      const deliveryReport = buildPlantDeliveryReport({
        plantPoints: nextPoints,
        plantRooms: nextRooms,
        plantRoutes: nextRoutes,
        circuits: balancedCircuits,
        infraType: nextInfraType,
        projectSupplyType: selectedProjectData?.supply_type || project?.supply_type || "",
        scalePxPerMeter,
      });
      const snapshot = currentDesignSnapshot({
        points: nextPoints,
        rooms: nextRooms,
        routes: nextRoutes,
        scalePxPerMeter,
      });

      commitDesign({
        points: nextPoints,
        rooms: nextRooms,
        routes: nextRoutes,
        scalePxPerMeter,
      }, { clearSelection: true });
      setGeneratedCircuits(normalizeProjectCircuits(balancedCircuits));
      setScannerReport(deliveryReport);
      setInfraType(nextInfraType);
      setRouteMode(nextRouteMode);
      setActiveRightTab("bom");
      setRightPanelOpen(true);
      setLeftPanelOpen(false);

      if (selectedProject && project) {
        const syncPayload = buildProjectElectricalSyncPayload(project, balancedCircuits);
        const boardPoint = nextPoints.find((point) => point.type === "qgbt") || nextPoints.find((point) => point.type === "qe");
        const updatedBoards = applyPlantBoardMetadata(syncPayload.panel_boards, {
          boardPoint,
          panelLayout: syncPayload.panel_layout,
          infraType: nextInfraType,
          fallbackLocation: "Posicionado na planta",
          targetRoomName,
        });
        const preservedManualItems = Array.isArray(project.manual_budget_items)
          ? project.manual_budget_items.filter((item) => item.source !== "planta-ia-completa")
          : [];
        await backend.entities.Project.update(selectedProject, {
          ...syncPayload,
          panel_boards: updatedBoards,
          plant_design: snapshot,
          plant_points_count: snapshot.points.length,
          plant_routes_count: snapshot.routes.length,
          plant_scanner_report: deliveryReport,
          plant_scan_counts: deliveryReport.counts,
          manual_budget_items: [...preservedManualItems, ...deliveryReport.budget_items],
        });

        const refreshedProject = await backend.entities.Project.get(selectedProject);
        setSelectedProjectData(refreshedProject);
        setProjects((current) => current.map((item) => item.id === selectedProject ? refreshedProject : item));
        setGeneratedCircuits(normalizeProjectCircuits(refreshedProject.circuits || balancedCircuits));
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar o projeto completo automaticamente.");
    } finally {
      setSaving(false);
    }
  };

  const saveCurrentBomToProject = async () => {
    if (!selectedProject || telemetry.bom.items.length === 0) return;
    setSaving(true);
    try {
      const project = await backend.entities.Project.get(selectedProject);
      const stamp = Date.now();
      const budgetItems = telemetry.bom.items.map((item, index) => ({
        id: `planta-bom-${stamp}-${index}`,
        name: item.name,
        qty: item.qty,
        price: Math.round(Number(item.pricePerUnit || 0) * 100) / 100,
        unit: item.unit || "un",
        category: item.category || "planta-ia",
        note: "Gerado pela lista de materiais do Planta IA",
        source: "planta-ia-bom",
      }));
      const preservedManualItems = Array.isArray(project.manual_budget_items)
        ? project.manual_budget_items.filter((item) => item.source !== "planta-ia-bom")
        : [];
      const updatedProject = await backend.entities.Project.update(selectedProject, {
        manual_budget_items: [...preservedManualItems, ...budgetItems],
      });
      setSelectedProjectData(updatedProject);
      setProjects((current) => current.map((item) => item.id === selectedProject ? updatedProject : item));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      navigate(`/budget?project=${selectedProject}`);
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar o orçamento da planta no projeto.");
    } finally {
      setSaving(false);
    }
  };

  const movePoint = (id, next) => {
    const movedPoint = points.find((point) => sameId(point.id, id));
    const nextPoint = { ...(movedPoint || {}), ...next };
    commitDesign({
      points: points.map(point => sameId(point.id, id) ? { ...point, ...next } : point),
      routes: syncRoutesForMovedPoint(routes, id, nextPoint),
    });
  };

  const hideDeviceDimension = (pointId, dimensionKey) => {
    if (!dimensionKey) return;
    commitDesign({
      points: points.map(point => sameId(point.id, pointId)
        ? {
            ...point,
            hiddenDeviceDimensions: {
              ...(point.hiddenDeviceDimensions || {}),
              [dimensionKey]: true,
            },
          }
        : point),
    }, { clearSelection: true });
  };

  const restoreDeviceDimensionsForPoint = (pointId) => {
    commitDesign({
      points: points.map((point) => {
        if (!sameId(point.id, pointId)) return point;
        const {
          deviceDimensionsHidden: _deviceDimensionsHidden,
          hiddenDeviceDimensions: _hiddenDeviceDimensions,
          hiddenDeviceDimensionKeys: _hiddenDeviceDimensionKeys,
          ...rest
        } = point;
        return rest;
      }),
    });
  };

  const removePoint = (id) => {
    commitDesign({
      points: points.filter(point => !sameId(point.id, id)),
      routes: routes.filter((route) => (
        !sameId(route.start_id, id) &&
        !sameId(route.end_id, id) &&
        !sameId(route.source?.componentId, id) &&
        !sameId(route.target?.componentId, id)
      )),
    }, { clearSelection: true });
    if (sameId(routeStartId, id)) setRouteStartId("");
  };

  const updateRoom = (id, next) => {
    commitDesign({ rooms: rooms.map(room => room.id === id ? { ...room, ...next } : room) });
  };

  const addPointToCanvas = (point) => {
    const normalizedIncomingPoint = normalizePlantPointForEditor(point, points.length);
    if (!normalizedIncomingPoint) return;
    const existingIds = new Set(points.map((item) => String(item.id)));
    const proposedId = normalizedIncomingPoint.id ? String(normalizedIncomingPoint.id) : "";
    const safeId = proposedId && !existingIds.has(proposedId)
      ? proposedId
      : `point-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextPoint = {
      ...normalizedIncomingPoint,
      id: safeId,
      label: routePointLabel(normalizedIncomingPoint),
    };
    commitDesign({ points: normalizePlantPointsForEditor([...points, nextPoint]) });
    setSelectedElement({ type: "point", id: nextPoint.id });
  };

  const rotateSelected = (delta) => {
    if (!selectedElement?.id) return;
    if (selectedElement.type === "point") {
      commitDesign({
        points: points.map(point => point.id === selectedElement.id
          ? { ...point, rotation: ((Number(point.rotation) || 0) + delta + 360) % 360 }
          : point),
      });
    }
    if (selectedElement.type === "room") {
      commitDesign({
        rooms: rooms.map(room => room.id === selectedElement.id
          ? { ...room, rotation: ((Number(room.rotation) || 0) + delta + 360) % 360 }
          : room),
      });
    }
    if (selectedElement.type === "wall") {
      const wall = walls.find((item) => sameId(item.id, selectedElement.id));
      if (!wall) return;
      const x1 = Number(wall.x1) / 100 * EDITOR_DESIGN_SIZE.w;
      const y1 = Number(wall.y1) / 100 * EDITOR_DESIGN_SIZE.h;
      const x2 = Number(wall.x2) / 100 * EDITOR_DESIGN_SIZE.w;
      const y2 = Number(wall.y2) / 100 * EDITOR_DESIGN_SIZE.h;
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const radians = delta * Math.PI / 180;
      const rotatePoint = (x, y) => ({
        x: centerX + (x - centerX) * Math.cos(radians) - (y - centerY) * Math.sin(radians),
        y: centerY + (x - centerX) * Math.sin(radians) + (y - centerY) * Math.cos(radians),
      });
      const start = rotatePoint(x1, y1);
      const end = rotatePoint(x2, y2);
      const control = wall.kind === "curve"
        ? rotatePoint(Number(wall.cx) / 100 * EDITOR_DESIGN_SIZE.w, Number(wall.cy) / 100 * EDITOR_DESIGN_SIZE.h)
        : null;
      updateArchitecturalWall(wall.id, {
        x1: start.x / EDITOR_DESIGN_SIZE.w * 100,
        y1: start.y / EDITOR_DESIGN_SIZE.h * 100,
        x2: end.x / EDITOR_DESIGN_SIZE.w * 100,
        y2: end.y / EDITOR_DESIGN_SIZE.h * 100,
        ...(control ? {
          cx: control.x / EDITOR_DESIGN_SIZE.w * 100,
          cy: control.y / EDITOR_DESIGN_SIZE.h * 100,
        } : {}),
      });
    }
    if (selectedElement.type === "opening") {
      const opening = openings.find((item) => sameId(item.id, selectedElement.id));
      if (!opening) return;
      updateArchitecturalOpening(opening.id, { flip: !opening.flip });
    }
  };

  const duplicateSelected = () => {
    if (!selectedElement?.id) return;
    if (selectedElement.type === "point") {
      const point = points.find(item => item.id === selectedElement.id);
      if (!point) return;
      const copy = {
        ...point,
        id: `point-${Date.now()}`,
        x: clampPct(Number(point.x) + 2, Number(point.x) + 2),
        y: clampPct(Number(point.y) + 2, Number(point.y) + 2),
      };
      commitDesign({ points: [...points, copy] });
      setSelectedElement({ type: "point", id: copy.id });
    }
    if (selectedElement.type === "room") {
      const room = rooms.find(item => item.id === selectedElement.id);
      if (!room) return;
      const copy = {
        ...room,
        id: `room-${Date.now()}`,
        label: `${room.label || "Comodo"} copia`,
        x: clampPct(Number(room.x) + 3, Number(room.x) + 3),
        y: clampPct(Number(room.y) + 3, Number(room.y) + 3),
      };
      commitDesign({ rooms: [...rooms, copy] });
      setSelectedElement({ type: "room", id: copy.id });
    }
    if (selectedElement.type === "wall") {
      const wall = walls.find((item) => sameId(item.id, selectedElement.id));
      if (!wall) return;
      const copyId = `wall-${Date.now()}`;
      const copy = {
        ...wall,
        id: copyId,
        x1: clampPct(Number(wall.x1) + 2, Number(wall.x1) + 2),
        y1: clampPct(Number(wall.y1) + 2, Number(wall.y1) + 2),
        x2: clampPct(Number(wall.x2) + 2, Number(wall.x2) + 2),
        y2: clampPct(Number(wall.y2) + 2, Number(wall.y2) + 2),
        ...(wall.kind === "curve" ? {
          cx: clampPct(Number(wall.cx) + 2, Number(wall.cx) + 2),
          cy: clampPct(Number(wall.cy) + 2, Number(wall.cy) + 2),
        } : {}),
      };
      const copiedOpenings = openings
        .filter((opening) => sameId(opening.wallId, wall.id))
        .map((opening, index) => ({ ...opening, id: `${opening.kind || "opening"}-${Date.now()}-${index}`, wallId: copyId }));
      commitDesign({ walls: [...walls, copy], openings: [...openings, ...copiedOpenings] });
      setSelectedElement({ type: "wall", id: copy.id });
    }
    if (selectedElement.type === "opening") {
      const opening = openings.find((item) => sameId(item.id, selectedElement.id));
      if (!opening) return;
      const copy = {
        ...opening,
        id: `${opening.kind || "opening"}-${Date.now()}`,
        position: Math.max(0.05, Math.min(0.95, Number(opening.position || 0.5) + 0.08)),
      };
      commitDesign({ openings: [...openings, copy] });
      setSelectedElement({ type: "opening", id: copy.id });
    }
    if (selectedElement.type === "roomLabel") {
      const label = roomLabels.find((item) => sameId(item.id, selectedElement.id));
      if (!label) return;
      const copy = {
        ...label,
        id: `room-label-${Date.now()}`,
        name: `${label.name || "Cômodo"} cópia`,
        x: clampPct(Number(label.x) + 2, Number(label.x) + 2),
        y: clampPct(Number(label.y) + 2, Number(label.y) + 2),
      };
      commitDesign({ roomLabels: [...roomLabels, copy] });
      setSelectedElement({ type: "roomLabel", id: copy.id });
    }
    if (selectedElement.type === "route") {
      const route = routes.find((item) => sameId(item.id, selectedElement.id));
      if (!route) return;
      const copy = duplicateCable(route, routes.length);
      commitDesign({ routes: [...routes, copy] });
      setSelectedElement({ type: "route", id: copy.id });
      setRouteEditMode("editPath");
    }
  };

  const deleteSelected = () => {
    if (!selectedElement?.id) return;
    if (selectedElement.type === "pointText") {
      movePoint(selectedElement.id, pointTextHiddenPatch(selectedElement.field, true));
      setSelectedElement(null);
      return;
    }
    if (selectedElement.type === "wallDimension") {
      updateArchitecturalWall(selectedElement.id, { dimensionHidden: true });
      setSelectedElement(null);
      return;
    }
    if (selectedElement.type === "deviceDimension") {
      hideDeviceDimension(selectedElement.id, selectedElement.key);
      return;
    }
    if (selectedElement.type === "point") {
      removePoint(selectedElement.id);
    }
    if (selectedElement.type === "room") {
      commitDesign({ rooms: rooms.filter(room => !sameId(room.id, selectedElement.id)) }, { clearSelection: true });
    }
    if (selectedElement.type === "wall") {
      commitDesign({
        walls: walls.filter((wall) => !sameId(wall.id, selectedElement.id)),
        openings: openings.filter((opening) => !sameId(opening.wallId, selectedElement.id)),
      }, { clearSelection: true });
    }
    if (selectedElement.type === "opening") {
      commitDesign({ openings: openings.filter((opening) => !sameId(opening.id, selectedElement.id)) }, { clearSelection: true });
    }
    if (selectedElement.type === "roomLabel") {
      commitDesign({ roomLabels: roomLabels.filter((label) => !sameId(label.id, selectedElement.id)) }, { clearSelection: true });
    }
    if (selectedElement.type === "route") {
      removeRoute(selectedElement.id);
    }
  };

  useEffect(() => {
    const handleCableShortcuts = (event) => {
      const target = event.target;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const command = isMac ? event.metaKey : event.ctrlKey;

      if (command && event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redoDesign();
        return;
      }
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoDesign();
        return;
      }
      if (command && event.key.toLowerCase() === "d" && selectedElement?.type === "route") {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (event.key === "Escape") {
        if (routeToolActive || routeDraft) {
          event.preventDefault();
          setRouteToolActive(false);
          setRouteDraft(null);
          setRouteStartId("");
          return;
        }
        setRouteEditMode("");
        setSelectedRoutePointIndex(null);
        return;
      }
      if (event.key === "Enter" && routeToolActive && routeDraft) {
        event.preventDefault();
        finishDraftWithLastPoint();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedElement?.type === "route") {
        event.preventDefault();
        if (selectedRoutePointIndex !== null && selectedRoutePointIndex !== undefined) {
          removeRoutePoint(selectedElement.id, selectedRoutePointIndex);
          setSelectedRoutePointIndex(null);
          return;
        }
        removeRoute(selectedElement.id);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedElement?.id) {
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && selectedElement?.type === "route" && selectedRoutePointIndex !== null && selectedRoute) {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 0.25;
        const path = cablePath(selectedRoute);
        const point = path[selectedRoutePointIndex];
        if (!point) return;
        const delta = {
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
        }[event.key];
        updateRoutePoint(selectedRoute.id, selectedRoutePointIndex, {
          x: Number(point.x) + delta.x,
          y: Number(point.y) + delta.y,
        }, { commit: true });
      }
    };

    window.addEventListener("keydown", handleCableShortcuts);
    return () => window.removeEventListener("keydown", handleCableShortcuts);
  }, [routeToolActive, routeDraft, selectedElement, selectedRoute, selectedRoutePointIndex, undoDesign, redoDesign, deleteSelected]);

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-[#F2FFFC] pt-3">
      {/* ── Topbar ── */}
      <div className="shrink-0 border-b border-[#CDEFE8] bg-white px-3 py-2">
        <PageHeader
          icon={Cpu}
          title="Planta Elétrica IA"
          subtitle="Desenho arquitetônico livre + projeto elétrico · paredes retas/curvas, aberturas e simbologia ABNT."
          actions={
            <div className="col-span-full grid w-full min-w-0 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[auto_auto_minmax(0,1fr)]">
              <div className={HEADER_ACTION_GROUP_CLASS}>
                <span className={HEADER_ACTION_LABEL_CLASS}>Projeto</span>
                <Button variant="outline" className="h-11 rounded-[12px] font-extrabold" onClick={() => navigate("/")}>
                  <ArrowLeft className="h-4 w-4" />
                  Home
                </Button>
                <Button variant="outline" className="h-11 rounded-[12px] font-extrabold" onClick={loadHouseTemplate}>
                  <House className="h-4 w-4" />
                  Modelo Casa
                </Button>
                <Button className="h-11 rounded-[12px] bg-[#00d8b8] font-extrabold hover:bg-[#00558D]" onClick={startBlankArchitecturalPlan}>
                  <Minus className="h-4 w-4" />
                  Desenhar do zero
                </Button>
              </div>

              <div className={HEADER_ACTION_GROUP_CLASS}>
                <span className={HEADER_ACTION_LABEL_CLASS}>Criar</span>
                <Button variant="outline" className="h-11 rounded-[12px] font-extrabold" onClick={addRoom}>
                  <SquarePlus className="h-4 w-4" />
                  Cômodo
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-[12px] border-[#BCEEE5] font-extrabold text-[#0f4f49]"
                  onClick={applyNBRRequirementsToPlant}
                  disabled={rooms.length === 0 || saving}
                >
                  <Calculator className="h-4 w-4 text-[#00d8b8]" />
                  Aplicar NBR
                  {roomNBRMissingTotal > 0 && (
                    <span className="ml-1 rounded-md bg-[#E5F3FC] px-1.5 py-0.5 text-[10px] font-black text-[#00d8b8]">
                      {roomNBRMissingTotal}
                    </span>
                  )}
                </Button>
                <Button
                  className="h-11 rounded-[12px] bg-[#0F172A] font-extrabold text-white hover:bg-[#1E293B]"
                  onClick={buildCompleteProfessionalProject}
                  disabled={rooms.length === 0 || saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Projeto completo
                </Button>
                <Button variant="outline" className="h-11 rounded-[12px] font-extrabold" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {importedFileName ? "Trocar Planta" : "Importar Planta"}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-[12px] border-[#0F172A] font-extrabold text-[#0F172A]"
                  onClick={() => { setSidebar("ai"); setLeftPanelOpen(true); }}
                >
                  <ScanLine className="h-4 w-4" />
                  Scanner IA
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" accept={IMPORTABLE_PLAN_TYPES} onChange={handleFileUpload} />
                {importedFileName && (
                  <div className="hidden max-w-[320px] items-center gap-2 rounded-[12px] border border-[#CDEFE8] bg-white px-3 py-2 text-left xl:flex">
                    {imageUrl ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />}
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black text-[#0F172A]">{importedFileName}</p>
                      <p className="truncate text-[10px] font-bold text-[#64748B]">{importStatus || "Planta importada."}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className={HEADER_ACTION_GROUP_CLASS}>
                <span className={HEADER_ACTION_LABEL_CLASS}>Saída</span>
                <Button
                  variant="outline"
                  className="h-11 rounded-[12px] border-[#00d8b8] font-extrabold text-[#0f4f49]"
                  onClick={handleSavePlantDesign}
                  disabled={!selectedProject || saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Save className="h-4 w-4" />}
                  {saving ? "Salvando..." : saved ? "Salvo" : "Salvar"}
                </Button>
                <Button variant="outline" className="h-11 rounded-[12px] font-extrabold" onClick={() => { setZoom(1); setSelectedElement(null); setFitRequest(value => value + 1); }}>
                  <MousePointer2 className="h-4 w-4" />
                  Enquadrar
                </Button>
                <Button variant="ghost" className="h-11 rounded-[12px] font-extrabold text-destructive hover:text-destructive" onClick={clearAll}>
                  <Trash2 className="h-4 w-4" />
                  Limpar
                </Button>
                {generatedCircuits.length > 0 && (
                  <Button className="h-11 rounded-[12px] font-extrabold" onClick={() => navigate(selectedProject ? `/unifilar?project=${selectedProject}` : "/unifilar")}>
                    <GitBranch className="h-4 w-4" />
                    Ver Diagrama
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" className="h-11 rounded-[12px] font-extrabold" onClick={exportFloorPlanPdf} disabled={exporting}>
                  <Download className="h-4 w-4" />
                  {exporting ? "Gerando..." : "Baixar A0"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="grid w-full min-w-0 gap-2 lg:grid-cols-[minmax(260px,420px)_minmax(0,1fr)]">
            <Select value={selectedProject} onValueChange={setSelectedProject} onOpenChange={open => { if (open) loadProjects(); }}>
              <SelectTrigger className="h-10 min-w-0 rounded-[12px] border-[#BCEEE5] bg-white text-sm font-bold shadow-none">
                <SelectValue placeholder="Selecionar projeto para sincronizar..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex min-h-10 min-w-0 flex-wrap items-center gap-2 rounded-[12px] border border-[#CDEFE8] bg-[#F8FBFD] px-3 text-xs font-bold text-[#526173]">
              <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Projeto ativo</span>
              <span className="min-w-0 truncate text-[#0F172A]">{selectedProjectName || "Nenhum projeto selecionado"}</span>
              <span className="ml-auto rounded-md bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#0f4f49]">
                {panelBoards.length} quadro{panelBoards.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </PageHeader>
      </div>

      {/* ── Main layout ── */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">

        {/* Left sidebar — tools / AI */}
        <div
          data-html2canvas-ignore="true"
          className={`absolute bottom-3 left-3 top-3 z-40 flex w-[340px] max-w-[calc(100%-24px)] flex-col overflow-hidden rounded-md border border-[#CDEFE8] bg-[#F8FBFD] shadow-[18px_0_45px_rgba(15,23,42,0.16)] transition-transform duration-200 ease-out max-lg:w-[min(92vw,380px)] ${
            leftPanelOpen ? "translate-x-0" : "pointer-events-none -translate-x-[calc(100%+28px)]"
          }`}
        >
          {/* Sidebar tabs */}
          <div className="flex items-stretch border-b border-[#CDEFE8] bg-white">
            <div className="flex min-w-0 flex-1">
              {[
                { id: "tools",  icon: Settings2, label: "Criar" },
                { id: "ai",     icon: Cpu,       label: "IA" },
              ].map(tab => (
                <button key={tab.id} onClick={() => setSidebar(tab.id)}
                  className={`flex-1 py-3 text-[11px] font-black flex flex-col items-center gap-1 transition-colors
                    ${sidebar === tab.id ? "text-[#00d8b8] border-b-[3px] border-[#00d8b8]" : "text-[#64748B] hover:text-[#0F172A]"}`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLeftPanelOpen(false)}
              className="flex w-12 items-center justify-center border-l border-[#CDEFE8] text-[#0f4f49] transition hover:bg-[#E6FFFA]"
              aria-label="Fechar ferramentas"
              title="Fechar ferramentas"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {sidebar === "tools" && (
              <div className="space-y-4">
                <div className="rounded-md border border-[#CDEFE8] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00d8b8]">Entrega completa</p>
                      <h3 className="mt-1 text-sm font-black leading-tight text-[#0F172A]">Planta, elétrica, impressão e orçamento</h3>
                    </div>
                    <Badge variant="outline" className="rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-[9px] font-black text-[#0f4f49]">
                      Pro
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-1.5 text-[10px] font-bold leading-snug text-[#526173]">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-[#10B981]" />Cômodos com medidas reais, portas e janelas</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-[#10B981]" />Pontos, circuitos, disjuntores e cabos pela NBR 5410</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-[#10B981]" />Rotas de infraestrutura, materiais e orçamento</span>
                  </div>
                  <Button
                    type="button"
                    className="mt-3 h-9 w-full rounded-md bg-[#0F172A] text-xs font-black text-white hover:bg-[#1E293B]"
                    onClick={buildCompleteProfessionalProject}
                    disabled={rooms.length === 0 || saving}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    Gerar projeto completo
                  </Button>
                </div>

                {selectedWallDimension && (
                  <div className="space-y-3 rounded-md border border-[#FECACA] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between border-b border-[#FEE2E2] pb-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B91C1C]">Cota da parede</p>
                        <p className="mt-1 text-[10px] font-bold text-[#64748B]">A parede permanece no desenho.</p>
                      </div>
                      <button type="button" onClick={deleteSelected} className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#B91C1C]">Excluir cota</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => updateArchitecturalWall(selectedWallDimension.id, { dimensionLabelDx: 0, dimensionLabelDy: 0 })}
                      >
                        Recentrar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => setSelectedElement({ type: "wall", id: selectedWallDimension.id })}
                      >
                        Editar parede
                      </Button>
                    </div>
                  </div>
                )}

                {selectedDeviceDimensionPoint && (
                  <div className="space-y-3 rounded-md border border-[#FECACA] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between border-b border-[#FEE2E2] pb-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-[#B91C1C]">Cota de posição</p>
                        <p className="mt-1 truncate text-[10px] font-bold text-[#64748B]">{routePointLabel(selectedDeviceDimensionPoint)}</p>
                      </div>
                      <button type="button" onClick={deleteSelected} className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#B91C1C]">Excluir cota</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => {
                          const key = selectedElement.key;
                          commitDesign({
                            points: points.map((point) => {
                              if (!sameId(point.id, selectedDeviceDimensionPoint.id)) return point;
                              const offsets = { ...(point.dimensionLabelOffsets || {}) };
                              delete offsets[key];
                              return { ...point, dimensionLabelOffsets: offsets };
                            }),
                          });
                        }}
                      >
                        Recentrar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => setSelectedElement({ type: "point", id: selectedDeviceDimensionPoint.id })}
                      >
                        Editar ponto
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                      onClick={() => restoreDeviceDimensionsForPoint(selectedDeviceDimensionPoint.id)}
                    >
                      Restaurar cotas do ponto
                    </Button>
                  </div>
                )}

                {selectedPointTextPoint && (
                  <div className="space-y-3 rounded-md border border-[#FECACA] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between border-b border-[#FEE2E2] pb-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-[#B91C1C]">
                          {POINT_TEXT_SELECTION_LABELS[selectedElement?.field] || "Texto selecionado"}
                        </p>
                        <p className="mt-1 truncate text-[10px] font-bold text-[#64748B]">{routePointLabel(selectedPointTextPoint)}</p>
                      </div>
                      <button type="button" onClick={deleteSelected} className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#B91C1C]">Excluir texto</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => setSelectedElement({ type: "point", id: selectedPointTextPoint.id })}
                      >
                        Editar ponto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => {
                          movePoint(selectedPointTextPoint.id, pointTextHiddenPatch(selectedElement?.field, false));
                        }}
                      >
                        Restaurar
                      </Button>
                    </div>
                  </div>
                )}

                {selectedElement?.type === "roomLabel" && (() => {
                  const label = roomLabels.find((item) => sameId(item.id, selectedElement.id));
                  if (!label) return null;
                  return (
                    <div className="space-y-3 rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                      <div className="flex items-center justify-between border-b border-[#E2EEF6] pb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00d8b8]">Nome do cômodo</p>
                        <button type="button" onClick={deleteSelected} className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#B91C1C]">Excluir</button>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Ambiente</span>
                        <Input
                          autoFocus
                          value={label.name || ""}
                          onChange={(event) => updateArchitecturalRoomLabel(label.id, { name: event.target.value })}
                          placeholder="Ex: Sala, Cozinha, Suíte..."
                          className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Área opcional</span>
                          <Input
                            value={label.area || ""}
                            onChange={(event) => updateArchitecturalRoomLabel(label.id, { area: event.target.value })}
                            placeholder="12,50 m²"
                            className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Texto</span>
                          <Input
                            type="number"
                            min="10"
                            max="32"
                            value={Number(label.fontSize) || 16}
                            onChange={(event) => updateArchitecturalRoomLabel(label.id, { fontSize: Math.max(10, Math.min(32, Number(event.target.value) || 16)) })}
                            className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
                          />
                        </label>
                      </div>
                      <p className="text-[9px] font-bold leading-relaxed text-[#64748B]">Arraste o texto para posicioná-lo dentro do ambiente.</p>
                    </div>
                  );
                })()}

                {selectedElement?.type === "wall" && (() => {
                  const wall = walls.find((item) => sameId(item.id, selectedElement.id));
                  if (!wall) return null;
                  const start = { x: Number(wall.x1) / 100 * EDITOR_DESIGN_SIZE.w, y: Number(wall.y1) / 100 * EDITOR_DESIGN_SIZE.h };
                  const end = { x: Number(wall.x2) / 100 * EDITOR_DESIGN_SIZE.w, y: Number(wall.y2) / 100 * EDITOR_DESIGN_SIZE.h };
                  const control = { x: Number(wall.cx) / 100 * EDITOR_DESIGN_SIZE.w, y: Number(wall.cy) / 100 * EDITOR_DESIGN_SIZE.h };
                  let lengthPx = 0;
                  let previous = start;
                  const segments = wall.kind === "curve" ? 32 : 1;
                  for (let index = 1; index <= segments; index += 1) {
                    const position = index / segments;
                    const inverse = 1 - position;
                    const current = wall.kind === "curve"
                      ? {
                          x: inverse * inverse * start.x + 2 * inverse * position * control.x + position * position * end.x,
                          y: inverse * inverse * start.y + 2 * inverse * position * control.y + position * position * end.y,
                        }
                      : end;
                    lengthPx += Math.hypot(current.x - previous.x, current.y - previous.y);
                    previous = current;
	                  }
	                  const lengthMeters = lengthPx / normalizeScalePxPerMeter(scalePxPerMeter);
	                  const updateWallLengthMeters = (rawValue) => {
	                    const nextMeters = Math.max(0.1, Math.min(100, Number(rawValue) || lengthMeters));
	                    const targetLengthPx = nextMeters * normalizeScalePxPerMeter(scalePxPerMeter);
	                    if (wall.kind === "curve") {
	                      const factor = targetLengthPx / Math.max(1, lengthPx);
	                      const nextEnd = {
	                        x: start.x + (end.x - start.x) * factor,
	                        y: start.y + (end.y - start.y) * factor,
	                      };
	                      const nextControl = {
	                        x: start.x + (control.x - start.x) * factor,
	                        y: start.y + (control.y - start.y) * factor,
	                      };
	                      updateArchitecturalWall(wall.id, {
	                        x2: clampWallPercent(nextEnd.x / EDITOR_DESIGN_SIZE.w * 100),
	                        y2: clampWallPercent(nextEnd.y / EDITOR_DESIGN_SIZE.h * 100),
	                        cx: clampWallPercent(nextControl.x / EDITOR_DESIGN_SIZE.w * 100),
	                        cy: clampWallPercent(nextControl.y / EDITOR_DESIGN_SIZE.h * 100),
	                      });
	                      return;
	                    }
	                    const dx = end.x - start.x;
	                    const dy = end.y - start.y;
	                    const currentLength = Math.hypot(dx, dy);
	                    const unit = currentLength > 0
	                      ? { x: dx / currentLength, y: dy / currentLength }
	                      : { x: 1, y: 0 };
	                    const nextEnd = {
	                      x: start.x + unit.x * targetLengthPx,
	                      y: start.y + unit.y * targetLengthPx,
	                    };
	                    updateArchitecturalWall(wall.id, {
	                      x2: clampWallPercent(nextEnd.x / EDITOR_DESIGN_SIZE.w * 100),
	                      y2: clampWallPercent(nextEnd.y / EDITOR_DESIGN_SIZE.h * 100),
	                    });
	                  };
	                  return (
                    <div className="space-y-3 rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                      <div className="flex items-center justify-between border-b border-[#E2EEF6] pb-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00d8b8]">{wall.kind === "curve" ? "Parede curva" : "Parede"} selecionada</p>
                          <p className="mt-1 text-[10px] font-bold text-[#64748B]">Comprimento aproximado: {lengthMeters.toFixed(2).replace(".", ",")} m</p>
                        </div>
                        <button type="button" onClick={deleteSelected} className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#B91C1C]">Excluir</button>
                      </div>
	                      <div className="grid grid-cols-2 gap-2">
	                        <label className="block space-y-1">
	                          <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Comprimento (m)</span>
	                          <Input
	                            type="number"
	                            min="0.1"
	                            max="100"
	                            step="0.05"
	                            value={lengthMeters.toFixed(2)}
	                            onChange={(event) => updateWallLengthMeters(event.target.value)}
	                            className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
	                          />
	                        </label>
	                        <label className="block space-y-1">
	                          <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Espessura (cm)</span>
	                          <Input
	                            type="number"
	                            min="8"
	                            max="35"
	                            step="1"
	                            value={Number(wall.thicknessCm) || 15}
	                            onChange={(event) => {
	                              const thicknessCm = Math.max(8, Math.min(35, Number(event.target.value) || 15));
	                              updateArchitecturalWall(wall.id, { thicknessCm, thickness: Math.max(3, Math.min(14, thicknessCm * 0.4)) });
	                            }}
	                            className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
	                          />
	                        </label>
	                      </div>
                      <div className="space-y-2 rounded-md border border-[#E2EEF6] bg-[#F8FBFD] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#64748B]">Caixa da cota</span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-md border-[#CDEFE8] px-2 text-[9px] font-extrabold text-[#0f4f49]"
                              onClick={() => updateArchitecturalWall(wall.id, { dimensionLabelDx: 0, dimensionLabelDy: 0 })}
                            >
                              Recentrar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={`h-7 rounded-md px-2 text-[9px] font-extrabold ${wall.dimensionHidden ? "border-[#00d8b8] bg-[#E6FFFA] text-[#0f4f49]" : "border-[#FECACA] text-[#B91C1C]"}`}
                              onClick={() => updateArchitecturalWall(wall.id, { dimensionHidden: !wall.dimensionHidden })}
                            >
                              {wall.dimensionHidden ? "Mostrar cota" : "Excluir cota"}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Texto</span>
                            <input
                              type="color"
                              value={wall.dimensionLabelColor || "#123D5C"}
                              onChange={(event) => updateArchitecturalWall(wall.id, { dimensionLabelColor: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Borda</span>
                            <input
                              type="color"
                              value={wall.dimensionLabelStroke || "#00d8b8"}
                              onChange={(event) => updateArchitecturalWall(wall.id, { dimensionLabelStroke: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Fundo</span>
                            <input
                              type="color"
                              value={wall.dimensionLabelFill || "#ffffff"}
                              onChange={(event) => updateArchitecturalWall(wall.id, { dimensionLabelFill: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Fonte</span>
                            <Input
                              type="number"
                              min="7"
                              max="18"
                              step="1"
                              value={Number(wall.dimensionLabelFontSize) || 10}
                              onChange={(event) => updateArchitecturalWall(wall.id, { dimensionLabelFontSize: Math.max(7, Math.min(18, Number(event.target.value) || 10)) })}
                              className="h-8 rounded-md border-[#CDEFE8] bg-white px-1 text-center text-[11px] font-bold"
                            />
                          </label>
                        </div>
                      </div>
                      <p className="text-[9px] font-bold leading-relaxed text-[#64748B]">Arraste a parede ou os círculos de controle. Na curva, o ponto azul central define o arco.</p>
                    </div>
                  );
                })()}

                {selectedElement?.type === "opening" && (() => {
                  const opening = openings.find((item) => sameId(item.id, selectedElement.id));
                  if (!opening) return null;
                  const isWindow = opening.kind === "window";
                  const selectedScalePxPerMeter = normalizeScalePxPerMeter(scalePxPerMeter);
                  const defaultOpeningWidthM = isWindow ? DEFAULT_WINDOW_WIDTH_M : DEFAULT_DOOR_WIDTH_M;
                  const openingWidthM = Number(opening.width || defaultOpeningWidthM * selectedScalePxPerMeter) / selectedScalePxPerMeter;
                  return (
                    <div className="space-y-3 rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                      <div className="flex items-center justify-between border-b border-[#E2EEF6] pb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00d8b8]">{isWindow ? "Janela" : "Porta"} selecionada</p>
                        <button type="button" onClick={deleteSelected} className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#B91C1C]">Excluir</button>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Largura (m)</span>
                        <Input
                          type="number"
                          min="0.5"
                          max="4"
                          step="0.1"
                          value={openingWidthM.toFixed(1)}
                          onChange={(event) => {
                            const widthMeters = Number(event.target.value) || defaultOpeningWidthM;
                            updateArchitecturalOpening(opening.id, {
                              width: Math.max(
                                0.48 * selectedScalePxPerMeter,
                                Math.min(4 * selectedScalePxPerMeter, widthMeters * selectedScalePxPerMeter),
                              ),
                            });
                          }}
	                          className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
	                        />
                      </label>
                      {!isWindow && (
                        <Button type="button" variant="outline" size="sm" className="h-8 w-full rounded-md border-[#CDEFE8] text-[10px] font-extrabold" onClick={() => updateArchitecturalOpening(opening.id, { flip: !opening.flip })}>
                          Inverter lado de abertura
                        </Button>
                      )}
                      <p className="text-[9px] font-bold leading-relaxed text-[#64748B]">Arraste sobre a parede para reposicionar.</p>
                    </div>
                  );
                })()}

                {/* ── PAINEL DE PROPRIEDADES DO CÔMODO SELECIONADO ── */}
                {selectedElement?.type === "room" && (
                  <div className="rounded-md border border-[#C9E0EF] bg-white p-3 space-y-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between border-b border-[#E2EEF6] pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#00d8b8]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00d8b8]">Cômodo Selecionado</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={deleteSelected} 
                        className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#B91C1C] transition hover:bg-[#FEE2E2]"
                      >
                        Excluir
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-[#64748B] block">Nome do Ambiente</label>
                      <Input
                        value={rooms.find(r => r.id === selectedElement.id)?.label || ""}
                        onChange={(e) => {
                          const newLabel = e.target.value;
                          commitDesign({
                            rooms: rooms.map(r => r.id === selectedElement.id ? { ...r, label: newLabel } : r)
                          });
                        }}
                        placeholder="Ex: Sala, Quarto, Cozinha..."
                        className="h-8 rounded-md border-[#CDEFE8] bg-white text-[11px] font-bold"
                      />
                    </div>

                    {/* Dimensões */}
                    <div className="space-y-1 border-t border-[#E2EEF6] pt-2.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-[#64748B] block">Dimensões do Cômodo</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">Largura (m)</span>
                          <Input
                            type="number"
                            step="0.1"
                            min="1"
                            max="30"
                            value={(() => {
                              const room = rooms.find(r => r.id === selectedElement.id);
                              return room ? Math.round((room.w / 4) * 10) / 10 : 4.5;
                            })()}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val) || val <= 0) return;
                              const room = rooms.find(r => r.id === selectedElement.id);
                              if (!room) return;
                              const newW = val * 4;
                              const hMeters = room.h / 4;
                              const newArea = `${(val * hMeters).toFixed(2).replace('.', ',')} m²`;
                              commitDesign({
                                rooms: rooms.map(r => r.id === selectedElement.id ? { ...r, w: newW, area: newArea } : r)
                              });
                            }}
                            className="h-8 rounded-md border-[#CDEFE8] bg-white text-[11px] font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase">Comprimento (m)</span>
                          <Input
                            type="number"
                            step="0.1"
                            min="1"
                            max="30"
                            value={(() => {
                              const room = rooms.find(r => r.id === selectedElement.id);
                              return room ? Math.round((room.h / 4) * 10) / 10 : 4.5;
                            })()}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (isNaN(val) || val <= 0) return;
                              const room = rooms.find(r => r.id === selectedElement.id);
                              if (!room) return;
                              const newH = val * 4;
                              const wMeters = room.w / 4;
                              const newArea = `${(wMeters * val).toFixed(2).replace('.', ',')} m²`;
                              commitDesign({
                                rooms: rooms.map(r => r.id === selectedElement.id ? { ...r, h: newH, area: newArea } : r)
                              });
                            }}
                            className="h-8 rounded-md border-[#CDEFE8] bg-white text-[11px] font-bold"
                          />
                        </div>
                      </div>
                    </div>


                    {/* Portas */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-[#64748B] block">Portas (Adicionar / Remover)</label>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { id: "top", label: "Superior" },
                          { id: "bottom", label: "Inferior" },
                          { id: "left", label: "Esquerda" },
                          { id: "right", label: "Direita" },
                        ].map((dir) => {
                          const room = rooms.find(r => r.id === selectedElement.id);
                          const roomDoors = room?.doors || { top: true, bottom: false, left: false, right: false };
                          const isActive = roomDoors[dir.id];

                          return (
                            <button
                              key={`door-${dir.id}`}
                              type="button"
                              onClick={() => {
                                const updatedDoors = { ...roomDoors, [dir.id]: !isActive };
                                commitDesign({
                                  rooms: rooms.map(r => r.id === selectedElement.id ? { ...r, doors: updatedDoors } : r)
                                });
                              }}
                              className={`h-7 rounded-md border text-[9px] font-extrabold transition text-center ${
                                isActive
                                  ? "border-[#00d8b8] bg-[#E6FFFA] text-[#00d8b8]"
                                  : "border-[#CDEFE8] bg-white text-[#526173] hover:border-[#00d8b8]"
                              }`}
                            >
                              🚪 {dir.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Janelas */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-[#64748B] block">Janelas (Adicionar / Remover)</label>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { id: "top", label: "Superior" },
                          { id: "bottom", label: "Inferior" },
                          { id: "left", label: "Esquerda" },
                          { id: "right", label: "Direita" },
                        ].map((dir) => {
                          const room = rooms.find(r => r.id === selectedElement.id);
                          const roomWindows = room?.windows || { top: false, bottom: false, left: false, right: true };
                          const isActive = roomWindows[dir.id];

                          return (
                            <button
                              key={`window-${dir.id}`}
                              type="button"
                              onClick={() => {
                                const updatedWindows = { ...roomWindows, [dir.id]: !isActive };
                                commitDesign({
                                  rooms: rooms.map(r => r.id === selectedElement.id ? { ...r, windows: updatedWindows } : r)
                                });
                              }}
                              className={`h-7 rounded-md border text-[9px] font-extrabold transition text-center ${
                                isActive
                                  ? "border-[#00d8b8] bg-[#E6FFFA] text-[#00d8b8]"
                                  : "border-[#CDEFE8] bg-white text-[#526173] hover:border-[#00d8b8]"
                              }`}
                            >
                              🪟 {dir.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Equipamentos e Iluminação */}
                    <div className="space-y-1.5 border-t border-[#E2EEF6] pt-2.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-[#64748B] block">Equipamentos e Iluminação</label>
                      <div className="grid grid-cols-2 gap-1">
                        {(() => {
                          const room = rooms.find(r => r.id === selectedElement.id);
                          const hasLamp = room?.hasLamp || false;
                          const hasAC = room?.hasAC || false;

                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  commitDesign({
                                    rooms: rooms.map(r => r.id === selectedElement.id ? { ...r, hasLamp: !hasLamp } : r)
                                  });
                                }}
                                className={`h-7 rounded-md border text-[9px] font-extrabold transition text-center ${
                                  hasLamp
                                    ? "border-[#00d8b8] bg-[#E6FFFA] text-[#00d8b8]"
                                    : "border-[#CDEFE8] bg-white text-[#526173] hover:border-[#00d8b8]"
                                }`}
                              >
                                💡 Lâmpada
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  commitDesign({
                                    rooms: rooms.map(r => r.id === selectedElement.id ? { ...r, hasAC: !hasAC } : r)
                                  });
                                }}
                                className={`h-7 rounded-md border text-[9px] font-extrabold transition text-center ${
                                  hasAC
                                    ? "border-[#00d8b8] bg-[#E6FFFA] text-[#00d8b8]"
                                    : "border-[#CDEFE8] bg-white text-[#526173] hover:border-[#00d8b8]"
                                }`}
                              >
                                ❄️ Ar Condic.
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {selectedRoute && (
                  <div className="space-y-3 rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between border-b border-[#E2EEF6] pb-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-[#00d8b8]">
                          Cabo selecionado
                        </p>
                        <p className="mt-1 truncate text-[10px] font-bold text-[#64748B]">
                          {selectedRoute.name || selectedRoute.label || "Cabo manual"}
                        </p>
                      </div>
                      <button type="button" onClick={() => removeRoute(selectedRoute.id)} className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#B91C1C]">Excluir</button>
                    </div>

                    <div className="space-y-2">
                      <label className="block space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Nome</span>
                        <Input
                          value={selectedRoute.name || ""}
                          onChange={(event) => updateRouteProperties(selectedRoute.id, { name: event.target.value, label: event.target.value })}
                          className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
                        />
                      </label>
                      <div className="grid grid-cols-[1fr_72px] gap-2">
                        <label className="block space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Sistema (Infraestrutura)</span>
                          <Select
                            value={selectedRouteSystem}
                            onValueChange={(value) => {
                              updateRouteProperties(selectedRoute.id, routeVisualPatch(value));
                            }}
                          >
                            <SelectTrigger className="h-8 rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-[11px] font-extrabold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="eletrica" className="text-xs font-bold text-black">Elétrica (preta)</SelectItem>
                              <SelectItem value="telecom" className="text-xs font-bold text-blue-600">Telecom (azul)</SelectItem>
                            </SelectContent>
                          </Select>
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Cor</span>
                          <input
                            type="color"
                            value={selectedRoute.color || colorForRouteSystem(selectedRouteSystem)}
                            onChange={(event) => updateRouteProperties(selectedRoute.id, { color: event.target.value })}
                            className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Espessura</span>
                          <Input
                            type="number"
                            min="0.8"
                            max="8"
                            step="0.2"
                            value={Number(selectedRoute.thickness) || 1.4}
                            onChange={(event) => updateRouteProperties(selectedRoute.id, { thickness: Math.max(0.8, Math.min(8, Number(event.target.value) || 1.4)) })}
                            className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Camada</span>
                          <Input
                            type="number"
                            value={Number(selectedRoute.zIndex) || 0}
                            onChange={(event) => updateRouteProperties(selectedRoute.id, { zIndex: Number(event.target.value) || 0 })}
                            className="h-8 rounded-md border-[#CDEFE8] text-[11px] font-bold"
                          />
                        </label>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Modo de trajeto</span>
                        <Select value={selectedRoute.routingMode || "free"} onValueChange={(value) => updateRouteProperties(selectedRoute.id, { routingMode: value })}>
                          <SelectTrigger className="h-8 rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-[11px] font-extrabold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[...VALID_ROUTING_MODES].map((mode) => (
                              <SelectItem key={mode} value={mode} className="text-xs">
                                {mode === "free" ? "Livre" : mode === "orthogonal" ? "Ortogonal" : "Curvo"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Instalação na planta</span>
                        <Select
                          value={normalizeCableInstallationMode(selectedRoute.mode, "embutido")}
                          onValueChange={(value) => {
                            const installationMode = normalizeCableInstallationMode(value, "embutido");
                            const patch = {
                              mode: installationMode,
                              dash: getRouteDash(installationMode),
                            };
                            if (installationMode === "externa") patch.routingMode = "orthogonal";
                            updateRouteProperties(selectedRoute.id, patch);
                          }}
                        >
                          <SelectTrigger className="h-8 rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-[11px] font-extrabold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROUTE_INSTALLATION_OPTIONS.map((option) => (
                              <SelectItem key={option.id} value={option.id} className="text-xs font-bold">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Bitola da Infraestrutura</span>
                        <Select
                          value={selectedRouteConduitDiameter}
                          onValueChange={(value) => {
                            const conduitDiameter = normalizeConduitDiameter(value, DEFAULT_CONDUIT_DIAMETER);
                            updateRouteProperties(selectedRoute.id, { conduit_diameter: conduitDiameter });
                          }}
                        >
                          <SelectTrigger className="h-8 rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-[11px] font-extrabold">
                            <SelectValue placeholder="Selecione a bitola" />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDUIT_DIAMETER_OPTIONS.map((gauge) => (
                              <SelectItem key={gauge} value={gauge} className="text-xs font-bold">{gauge}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full justify-center rounded-md border-[#00d8b8] bg-[#E6FFFA] text-[10px] font-black text-[#0f4f49] hover:bg-[#d7fff7]"
                        onClick={() => setRouteGaugeModalId(String(selectedRoute.id))}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Alterar bitola da infraestrutura
                      </Button>
                      <div className="space-y-2 rounded-md border border-[#E2EEF6] bg-[#F8FBFD] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#64748B]">Etiqueta da infraestrutura</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-md border-[#CDEFE8] px-2 text-[9px] font-extrabold text-[#0f4f49]"
                            onClick={() => updateRouteProperties(selectedRoute.id, { labelDx: 0, labelDy: 0 })}
                          >
                            Recentrar
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Texto</span>
                            <input
                              type="color"
                              value={selectedRoute.labelColor || selectedRoute.color || colorForRouteSystem(selectedRouteSystem)}
                              onChange={(event) => updateRouteProperties(selectedRoute.id, { labelColor: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Fonte</span>
                            <Input
                              type="number"
                              min="6"
                              max="14"
                              step="1"
                              value={Number(selectedRoute.labelFontSize) || 8}
                              onChange={(event) => updateRouteProperties(selectedRoute.id, { labelFontSize: Math.max(6, Math.min(14, Number(event.target.value) || 8)) })}
                              className="h-8 rounded-md border-[#CDEFE8] bg-white px-1 text-center text-[11px] font-bold"
                            />
                          </label>
                        </div>
                        <p className="text-[9px] font-bold leading-snug text-[#64748B]">
                          Selecione o cabo e arraste a bitola diretamente sobre a infraestrutura.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`h-9 rounded-md border-[#CDEFE8] text-[10px] font-extrabold ${routeEditMode === "editPath" ? "bg-[#E6FFFA] text-[#00d8b8]" : "text-[#0f4f49]"}`}
                        onClick={() => setRouteEditMode(routeEditMode === "editPath" ? "" : "editPath")}
                      >
                        <Spline className="h-3.5 w-3.5" />
                        Editar caminho
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`h-9 rounded-md border-[#CDEFE8] text-[10px] font-extrabold ${routeEditMode === "addPoint" ? "bg-[#E6FFFA] text-[#00d8b8]" : "text-[#0f4f49]"}`}
                        onClick={() => setRouteEditMode(routeEditMode === "addPoint" ? "" : "addPoint")}
                      >
                        <SquarePlus className="h-3.5 w-3.5" />
                        Adicionar ponto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`h-9 rounded-md border-[#CDEFE8] text-[10px] font-extrabold ${routeEditMode === "removePoint" ? "bg-[#E6FFFA] text-[#00d8b8]" : "text-[#0f4f49]"}`}
                        onClick={() => setRouteEditMode(routeEditMode === "removePoint" ? "" : "removePoint")}
                        disabled={cablePath(selectedRoute).length <= 2}
                      >
                        <Minus className="h-3.5 w-3.5" />
                        Remover ponto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => resetRoutePath(selectedRoute.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Resetar caminho
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => duplicateSelected()}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicar
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]" onClick={() => disconnectRouteEndpoint(selectedRoute.id, "source")}>
                        Desconectar origem
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]" onClick={() => disconnectRouteEndpoint(selectedRoute.id, "target")}>
                        Desconectar destino
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]" onClick={() => bringRouteForward(selectedRoute.id)}>
                        Trazer para frente
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]" onClick={() => sendRouteBackward(selectedRoute.id)}>
                        Enviar para trás
                      </Button>
                      <Button type="button" variant="outline" size="sm" className={`h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold ${selectedRoute.locked ? "bg-[#E6FFFA] text-[#00d8b8]" : "text-[#0f4f49]"}`} onClick={() => updateRouteProperties(selectedRoute.id, { locked: !selectedRoute.locked })}>
                        {selectedRoute.locked ? "Desbloquear" : "Bloquear"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className={`h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold ${selectedRoute.visible === false ? "bg-[#F8FBFD] text-[#64748B]" : "text-[#0f4f49]"}`} onClick={() => updateRouteProperties(selectedRoute.id, { visible: selectedRoute.visible === false })}>
                        {selectedRoute.visible === false ? "Mostrar" : "Ocultar"}
                      </Button>
                    </div>

                    <div className="grid gap-1.5 text-[9px] font-bold text-[#526173]">
                      <span className="rounded-md border border-[#E2EEF6] bg-[#F8FBFD] px-2 py-1.5">
                        Origem: <strong className="text-[#0F172A]">{selectedRoute.source?.componentId ? `${selectedRoute.source.componentId} / ${selectedRoute.source.terminalId || "-"}` : "Livre"}</strong>
                      </span>
                      <span className="rounded-md border border-[#E2EEF6] bg-[#F8FBFD] px-2 py-1.5">
                        Destino: <strong className="text-[#0F172A]">{selectedRoute.target?.componentId ? `${selectedRoute.target.componentId} / ${selectedRoute.target.terminalId || "-"}` : "Livre"}</strong>
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-full rounded-md border-[#FECACA] text-[10px] font-extrabold text-[#B91C1C]"
                      onClick={() => removeRoute(selectedRoute.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir cabo
                    </Button>

                    <p className="text-[9px] font-bold leading-relaxed text-[#64748B]">
                      {!routeEditMode && "Clique no cabo apenas seleciona. Ative uma ação acima para alterar os nós."}
                      {routeEditMode === "editPath" && "Arraste os círculos do cabo para reposicionar cada nó individualmente."}
                      {routeEditMode === "addPoint" && "Clique sobre o cabo para inserir um novo nó no trecho mais próximo."}
                      {routeEditMode === "removePoint" && "Clique em um nó intermediário para removê-lo sem quebrar a ligação."}
                    </p>
                  </div>
                )}

                {selectedPoint && (
                  <div className="space-y-3 rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between border-b border-[#E2EEF6] pb-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-[#00d8b8]">
                          {routePointLabel(selectedPoint)}
                        </p>
                        <p className="mt-1 truncate text-[10px] font-bold text-[#64748B]">
                          {selectedPoint.circuit || "Sem circuito vinculado"}
                        </p>
                      </div>
                      <button type="button" onClick={deleteSelected} className="rounded border border-[#FECACA] bg-[#FEF2F2] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#B91C1C]">Excluir</button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-[#526173]">
                      {isCircuitConfigurablePoint(selectedPoint) && (
                        <>
                          <span className="rounded-md border border-[#E2EEF6] bg-[#F8FBFD] px-2 py-1.5">
                            Potência: <strong className="text-[#0F172A]">{selectedPoint.load_w || 0} W</strong>
                          </span>
                          <span className="rounded-md border border-[#E2EEF6] bg-[#F8FBFD] px-2 py-1.5">
                            Cabo: <strong className="text-[#0F172A]">{selectedPoint.wire_gauge || "-"}</strong>
                          </span>
                          <span className="rounded-md border border-[#E2EEF6] bg-[#F8FBFD] px-2 py-1.5">
                            Disj.: <strong className="text-[#0F172A]">{selectedPoint.breaker_a ? `${selectedPoint.breaker_a}A` : "-"}</strong>
                          </span>
                        </>
                      )}
                      <span className="rounded-md border border-[#CDEFE8] bg-[#E8F8F5] px-2 py-1.5 text-[#0f4f49] col-span-2 flex items-center justify-between">
                        <span>Altura do Ponto:</span>
                        <strong className="text-[#00a98e] uppercase font-black">{POINT_HEIGHT_LABELS[selectedPoint.height || defaultPointHeight(selectedPoint.type)] || POINT_HEIGHT_LABELS.baixa}</strong>
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      {(selectedPoint.type === "caixa" || selectedPoint.type === "rack-cftv") && (() => {
                        const currentPointSystem = selectedPoint.type === "rack-cftv" && !selectedPoint.systemType && !selectedPoint.system_type && !selectedPoint.system
                          ? "telecom"
                          : normalizeRouteSystem(selectedPoint.systemType || selectedPoint.system_type || selectedPoint.system);
                        return (
                          <label className="block space-y-1 rounded-md border border-[#E2EEF6] bg-[#F8FBFD] p-2">
                            <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">{selectedPoint.type === "rack-cftv" ? "Sistema do rack" : "Sistema da caixa"}</span>
                            <Select
                              value={currentPointSystem}
                              onValueChange={(value) => {
                                const systemType = normalizeRouteSystem(value);
                                movePoint(selectedPoint.id, {
                                  systemType,
                                  color: colorForRouteSystem(systemType),
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 rounded-md border-[#CDEFE8] bg-white text-[11px] font-extrabold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="eletrica" className="text-xs font-bold text-black">Elétrica (preto)</SelectItem>
                                <SelectItem value="telecom" className="text-xs font-bold text-blue-600">Telecom / CFTV (azul)</SelectItem>
                              </SelectContent>
                            </Select>
                          </label>
                        );
                      })()}
                      {hasHiddenPointText(selectedPoint) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 w-full rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                          onClick={() => movePoint(selectedPoint.id, {
                            labelHidden: false,
                            circuitLabelHidden: false,
                            positionLabelHidden: false,
                            powerLabelHidden: false,
                          })}
                        >
                          Restaurar textos ocultos
                        </Button>
                      )}
                      {isCircuitConfigurablePoint(selectedPoint) ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 w-full rounded-md bg-[#00d8b8] text-xs font-black hover:bg-[#00a98e]"
                          onClick={() => openCircuitConfigForPoint(selectedPoint)}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Configurar circuito do ponto
                        </Button>
                      ) : (
                        <p className="text-[10px] font-bold leading-snug text-[#64748B]">
                          Este ponto não exige dimensionamento dedicado. Use circuitos e eletrodutos pela seção de infraestrutura.
                        </p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 w-full rounded-md border-[#00d8b8] bg-[#F8FBFD] text-xs font-bold text-[#0f4f49] hover:bg-[#E8F8F5]"
                        onClick={() => setPointHeightModalId(String(selectedPoint.id))}
                      >
                        <Settings2 className="h-3.5 w-3.5 mr-1.5 text-[#00d8b8]" />
                        Alterar Altura do Ponto
                      </Button>
                      <div className="space-y-2 rounded-md border border-[#E2EEF6] bg-[#F8FBFD] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#64748B]">Texto de altura</span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-md border-[#CDEFE8] px-2 text-[9px] font-extrabold text-[#0f4f49]"
                              onClick={() => movePoint(selectedPoint.id, { positionLabelX: -34, positionLabelY: 24 })}
                            >
                              Recentrar
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-md border-[#FECACA] px-2 text-[9px] font-extrabold text-[#B91C1C]"
                              onClick={() => movePoint(selectedPoint.id, { positionLabelHidden: selectedPoint.positionLabelHidden !== true })}
                            >
                              {selectedPoint.positionLabelHidden === true ? "Restaurar" : "Excluir texto"}
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Texto</span>
                            <input
                              type="color"
                              value={selectedPoint.positionLabelColor || "#b91c1c"}
                              onChange={(event) => movePoint(selectedPoint.id, { positionLabelColor: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Borda</span>
                            <input
                              type="color"
                              value={selectedPoint.positionLabelStroke || "#fecaca"}
                              onChange={(event) => movePoint(selectedPoint.id, { positionLabelStroke: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Fundo</span>
                            <input
                              type="color"
                              value={selectedPoint.positionLabelFill || "#ffffff"}
                              onChange={(event) => movePoint(selectedPoint.id, { positionLabelFill: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Fonte</span>
                            <Input
                              type="number"
                              min="6"
                              max="16"
                              step="1"
                              value={Number(selectedPoint.positionLabelFontSize) || 8}
                              onChange={(event) => movePoint(selectedPoint.id, { positionLabelFontSize: Math.max(6, Math.min(16, Number(event.target.value) || 8)) })}
                              className="h-8 rounded-md border-[#CDEFE8] bg-white px-1 text-center text-[11px] font-bold"
                            />
                          </label>
                        </div>
                        <label className="block space-y-1">
                          <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Largura da caixa</span>
                          <Input
                            type="number"
                            min="42"
                            max="150"
                            step="2"
                            value={Number(selectedPoint.positionLabelWidth) || 76}
                            onChange={(event) => movePoint(selectedPoint.id, { positionLabelWidth: Math.max(42, Math.min(150, Number(event.target.value) || 76)) })}
                            className="h-8 rounded-md border-[#CDEFE8] bg-white text-[11px] font-bold"
                          />
                        </label>
                        <p className="text-[9px] font-bold leading-snug text-[#64748B]">
                          Arraste essa caixa diretamente na planta para não cobrir símbolos ou cotas.
                        </p>
                      </div>
                      {Number(selectedPoint.load_w) > 0 && (
                        <div className="space-y-2 rounded-md border border-[#E2EEF6] bg-[#F8FBFD] p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#64748B]">Texto de potência</span>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-md border-[#CDEFE8] px-2 text-[9px] font-extrabold text-[#0f4f49]"
                                onClick={() => movePoint(selectedPoint.id, { powerLabelX: -26, powerLabelY: 17 })}
                              >
                                Recentrar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-md border-[#FECACA] px-2 text-[9px] font-extrabold text-[#B91C1C]"
                                onClick={() => movePoint(selectedPoint.id, { powerLabelHidden: selectedPoint.powerLabelHidden !== true })}
                              >
                                {selectedPoint.powerLabelHidden === true ? "Restaurar" : "Excluir texto"}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="block space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Texto</span>
                              <input
                                type="color"
                                value={selectedPoint.powerLabelColor || "#050505"}
                                onChange={(event) => movePoint(selectedPoint.id, { powerLabelColor: event.target.value })}
                                className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Fonte</span>
                              <Input
                                type="number"
                                min="6"
                                max="16"
                                step="1"
                                value={Number(selectedPoint.powerLabelFontSize) || 8}
                                onChange={(event) => movePoint(selectedPoint.id, { powerLabelFontSize: Math.max(6, Math.min(16, Number(event.target.value) || 8)) })}
                                className="h-8 rounded-md border-[#CDEFE8] bg-white px-1 text-center text-[11px] font-bold"
                              />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Largura</span>
                              <Input
                                type="number"
                                min="42"
                                max="150"
                                step="2"
                                value={Number(selectedPoint.powerLabelWidth) || 64}
                                onChange={(event) => movePoint(selectedPoint.id, { powerLabelWidth: Math.max(42, Math.min(150, Number(event.target.value) || 64)) })}
                                className="h-8 rounded-md border-[#CDEFE8] bg-white px-1 text-center text-[11px] font-bold"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2 rounded-md border border-[#E2EEF6] bg-[#F8FBFD] p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#64748B]">Cotas de posição</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 rounded-md border-[#CDEFE8] px-2 text-[9px] font-extrabold text-[#0f4f49]"
                            onClick={() => {
                              const { dimensionLabelOffsets: _removed, ...rest } = selectedPoint;
                              commitDesign({ points: points.map((point) => sameId(point.id, selectedPoint.id) ? rest : point) });
                            }}
                          >
                            Limpar
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Texto</span>
                            <input
                              type="color"
                              value={selectedPoint.dimensionLabelColor || "#dc2626"}
                              onChange={(event) => movePoint(selectedPoint.id, { dimensionLabelColor: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Borda</span>
                            <input
                              type="color"
                              value={selectedPoint.dimensionLabelStroke || "#fca5a5"}
                              onChange={(event) => movePoint(selectedPoint.id, { dimensionLabelStroke: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Fundo</span>
                            <input
                              type="color"
                              value={selectedPoint.dimensionLabelFill || "#ffffff"}
                              onChange={(event) => movePoint(selectedPoint.id, { dimensionLabelFill: event.target.value })}
                              className="h-8 w-full rounded-md border border-[#CDEFE8] bg-white p-1"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#64748B]">Fonte</span>
                            <Input
                              type="number"
                              min="6"
                              max="16"
                              step="1"
                              value={Number(selectedPoint.dimensionLabelFontSize) || 10}
                              onChange={(event) => movePoint(selectedPoint.id, { dimensionLabelFontSize: Math.max(6, Math.min(16, Number(event.target.value) || 10)) })}
                              className="h-8 rounded-md border-[#CDEFE8] bg-white px-1 text-center text-[11px] font-bold"
                            />
                          </label>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                          onClick={() => commitDesign({ showDeviceDimensions: !showDeviceDimensions })}
                        >
                          {showDeviceDimensions ? "Ocultar cotas de posição" : "Mostrar cotas de posição"}
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-md border-[#FECACA] text-[10px] font-extrabold text-[#B91C1C]"
                            onClick={() => {
                              commitDesign({
                                points: points.map((point) => sameId(point.id, selectedPoint.id)
                                  ? { ...point, deviceDimensionsHidden: true }
                                  : point),
                              });
                            }}
                          >
                            Excluir cotas
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                            onClick={() => restoreDeviceDimensionsForPoint(selectedPoint.id)}
                          >
                            Restaurar
                          </Button>
                        </div>
                      </div>
                    </div>
	                  </div>
	                )}

                <div className="space-y-2 rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                  <div className="flex items-start justify-between gap-2 border-b border-[#E2EEF6] pb-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00d8b8]">NBR por cômodo</p>
                      <p className="mt-1 text-[10px] font-bold leading-snug text-[#64748B]">
                        Iluminação, tomadas e carga mínima pela escala do ambiente.
                      </p>
                    </div>
                    <Badge variant="outline" className={`h-6 shrink-0 rounded-md px-2 text-[9px] font-black ${
                      roomNBRMissingTotal > 0
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}>
                      {rooms.length === 0 ? "Sem cômodo" : roomNBRMissingTotal > 0 ? `${roomNBRMissingTotal} faltam` : "OK"}
                    </Badge>
                  </div>

                  {rooms.length === 0 ? (
                    <p className="text-[10px] font-bold leading-snug text-[#64748B]">
                      Desenhe ou insira cômodos para calcular os mínimos residenciais da NBR 5410.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <span className="rounded-md bg-[#F8FBFD] px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-[#0f4f49]">
                          {roomNBRSummary.lighting} luz
                        </span>
                        <span className="rounded-md bg-[#F8FBFD] px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-[#0f4f49]">
                          {roomNBRSummary.tugs} TUG
                        </span>
                        <span className="rounded-md bg-[#F8FBFD] px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-[#0f4f49]">
                          {formatPtNumber(roomNBRSummary.lightingPowerVa + roomNBRSummary.tugPowerVa, 0)} VA
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full rounded-md bg-[#00d8b8] text-xs font-black hover:bg-[#00a98e]"
                        onClick={applyNBRRequirementsToPlant}
                        disabled={saving}
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        {roomNBRMissingTotal > 0 ? "Inserir pontos faltantes" : "Atualizar circuitos NBR"}
                      </Button>

                      <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                        {roomNBRAnalysis.map((item) => (
                          <div key={item.roomId || item.roomName} className="rounded-md border border-[#E2EEF6] bg-[#F8FBFD] p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-black text-[#0F172A]">{item.roomName}</p>
                                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-[#64748B]">
                                  {formatPtNumber(item.metrics.areaM2, 2)} m² · {formatPtNumber(item.metrics.perimeterM, 1)} m
                                </p>
                              </div>
                              {item.status === "pass" ? (
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                              ) : (
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                              )}
                            </div>
                            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9px] font-bold text-[#526173]">
                              <span>Luz: <strong className="text-[#0F172A]">{item.lightingPointCount}</strong> / {item.lightingPowerVa} VA</span>
                              <span>TUG: <strong className="text-[#0F172A]">{item.tugCount}</strong> / {item.tugPowerVa} VA</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F6B7A]">Arquitetura</p>
                    <Badge variant="outline" className="h-5 rounded-md border-[#CDEFE8] px-1.5 text-[9px] font-bold text-[#0f4f49]">CAD</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {architectureTools.map((tool) => (
                      <button
                        key={tool.label}
                        onClick={tool.onClick}
                        className={`flex min-h-[74px] flex-col items-start justify-between rounded-md border p-2.5 text-left shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:border-[#00d8b8] hover:bg-[#F2FFFC] ${
                          tool.tool && architectureTool === tool.tool
                            ? "border-[#00d8b8] bg-[#E6FFFA] ring-1 ring-[#00d8b8]/20"
                            : "border-[#C9E0EF] bg-white"
                        }`}
                      >
                        <tool.icon className="h-4 w-4 text-[#00d8b8]" />
                        <span className="text-[12px] font-black leading-tight text-[#111827]">{tool.label}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-[#64748B]">{tool.detail}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F6B7A]">Infraestrutura</p>
                    <Badge variant="outline" className="h-5 rounded-md border-[#CDEFE8] px-1.5 text-[9px] font-black text-[#0f4f49]">
                      {routes.length} rota{routes.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 rounded-md border border-[#C9E0EF] bg-white p-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Circuito ativo</p>
                        <p className="mt-0.5 truncate text-[10px] font-bold text-[#64748B]">Opcional para cabos criados manualmente.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#CDEFE8] px-2 text-[10px] font-black text-[#0f4f49]"
                        onClick={() => {
                          setRouteCircuitId("auto");
                          setRouteStartId("");
                        }}
                      >
                        Auto
                      </Button>
                    </div>

                    <Select value={routeCircuitId} onValueChange={setRouteCircuitId}>
                      <SelectTrigger disabled={!hasProjectCircuits} className="h-9 rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-xs font-extrabold">
                        <SelectValue placeholder="Escolher circuito" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto" className="text-xs">Automático por tipo do ponto</SelectItem>
                        {circuitOptions.map((circuit) => (
                          <SelectItem key={circuit.id} value={circuit.id} className="text-xs">
                            {circuit.name}{circuit.phase ? ` · Fase ${circuit.phase}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {!canRouteToBoard && (
                      <div className="rounded-md border border-[#CDEFE8] bg-[#F8FBFD] p-2 text-[10px] font-bold leading-snug text-[#526173]">
                        O cabeamento manual não exige quadro ou circuito. As opções automáticas de QD ficam disponíveis quando houver circuitos e quadro posicionados.
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Sistema</span>
                        <Select value={routeSystem} onValueChange={setRouteSystem}>
                          <SelectTrigger className="h-8 rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-[11px] font-extrabold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eletrica" className="text-xs font-bold text-black">Elétrica</SelectItem>
                            <SelectItem value="telecom" className="text-xs font-bold text-blue-600">Telecom</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[#64748B]">Eletroduto</span>
                        <Select
                          value={normalizeConduitDiameter(routeConduitDiameter, DEFAULT_CONDUIT_DIAMETER)}
                          onValueChange={(value) => setRouteConduitDiameter(normalizeConduitDiameter(value, DEFAULT_CONDUIT_DIAMETER))}
                        >
                          <SelectTrigger className="h-8 rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-[11px] font-extrabold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONDUIT_DIAMETER_OPTIONS.map((diameter) => (
                              <SelectItem key={diameter} value={diameter} className="text-xs font-bold">{diameter}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                      {ROUTE_INSTALLATION_OPTIONS.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setRouteMode(mode.id)}
                          className={`h-8 rounded-md border px-1 text-[9px] font-black uppercase tracking-wide transition ${
                            routeMode === mode.id
                              ? "border-[#00d8b8] bg-[#E6FFFA] text-[#00d8b8]"
                              : "border-[#CDEFE8] bg-[#F8FBFD] text-[#526173] hover:border-[#00d8b8]"
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className={`h-10 rounded-md text-xs font-extrabold ${
                          routeToolActive
                            ? "bg-[#0F172A] hover:bg-[#111827]"
                            : "bg-[#00d8b8] hover:bg-[#00a98e]"
                        }`}
                        onClick={addConduitRoute}
                      >
                        <Cable className="h-3.5 w-3.5" />
                        {routeToolActive ? "Criando..." : "Adicionar cabo"}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`h-10 rounded-md border-[#CDEFE8] text-xs font-extrabold text-[#0f4f49] ${(!canRouteToBoard || points.length < 2) ? 'opacity-50' : ''}`}
                        onClick={() => {
                          if (points.length < 2) {
                            alert("Adicione pelo menos 2 pontos na planta para conectar.");
                            return;
                          }
                          if (!hasProjectCircuits) {
                            alert("Por favor, gere os circuitos primeiro na aba lateral de Circuitos (ícone de raio) antes de conectar a infraestrutura.");
                            return;
                          }
                          if (!hasPositionedBoard) {
                            alert("Por favor, adicione um Quadro (QE ou QGBT) na planta para que a infraestrutura possa ser conectada a ele.");
                            return;
                          }
                          autoConnectFromBoard();
                        }}
                        disabled={saving}
                      >
                        <Network className="h-3.5 w-3.5" />
                        Auto QD
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`h-10 w-full rounded-md border-[#CDEFE8] text-xs font-extrabold text-[#0f4f49] ${!canRouteToBoard ? 'opacity-50' : ''}`}
                      onClick={() => {
                        if (!hasProjectCircuits) {
                          alert("Por favor, gere os circuitos primeiro na aba lateral de Circuitos (ícone de raio) antes de gerar o quadro e a infraestrutura.");
                          return;
                        }
                        if (!hasPositionedBoard) {
                          alert("Por favor, adicione um Quadro (QE ou QGBT) na planta para usar como referência.");
                          return;
                        }
                        setInfraPromptAction("panel-routes");
                      }}
                      disabled={saving}
                    >
                      <PanelTop className="h-3.5 w-3.5" />
                      Gerar quadro e infraestrutura da planta
                    </Button>

                    {routeToolActive && (
                      <div className="rounded-md border border-[#CDEFE8] bg-[#F8FBFD] p-2 text-[10px] font-bold leading-snug text-[#0f4f49]">
                        {routeDraft?.source ? (
                          <>
                            Origem definida. Clique no canvas para pontos intermediários, clique em um terminal para destino ou pressione Enter para finalizar.
                          </>
                        ) : (
                          "Clique em um terminal ou em qualquer ponto livre do canvas para definir a origem."
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => {
                          setRouteToolActive(false);
                          setRouteStartId("");
                          setRouteDraft(null);
                        }}
                        disabled={!routeToolActive && !routeStartId}
                      >
                        Cancelar ligação
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-[#FECACA] text-[10px] font-extrabold text-[#B91C1C]"
                        onClick={clearRoutes}
                        disabled={routes.length === 0}
                      >
                        Limpar cabos
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-full rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                      onClick={verifyCableConnections}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verificar ligações
                    </Button>

                    {cableValidationIssues.length > 0 && (
                      <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-2">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-800">Avisos de ligação</p>
                        {cableValidationIssues.slice(0, 6).map((issue, index) => (
                          <button
                            key={`${issue.type}-${issue.cableId}-${index}`}
                            type="button"
                            onClick={() => {
                              if (issue.cableId) {
                                setSelectedElement({ type: "route", id: issue.cableId });
                                setRouteEditMode("editPath");
                              }
                            }}
                            className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-left text-[9px] font-bold leading-snug text-amber-900 transition hover:border-amber-400"
                          >
                            <span className="block font-black">{issue.type}</span>
                            <span>{issue.description}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedElement?.type === "point" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                        onClick={() => {
                          setActiveTool("");
                          setRouteToolActive(true);
                          const point = points.find((item) => sameId(item.id, selectedElement.id));
                          if (point) startCableDraft(pointToTerminal(point));
                        }}
                      >
                        Usar selecionado como origem
                      </Button>
                    )}

                    {routes.length > 0 && (
                      <div className="space-y-1.5 border-t border-[#E2EEF6] pt-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#64748B]">Cabos criados</p>
                          <span className="text-[9px] font-black text-[#00d8b8]">{routes.length}</span>
                        </div>
                        <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                          {routes.slice().reverse().map((route) => (
                            <div
                              key={route.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => selectCanvasElement({ type: "route", id: route.id })}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") selectCanvasElement({ type: "route", id: route.id });
                              }}
                              className={`grid cursor-pointer grid-cols-[1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5 transition hover:border-[#00d8b8] hover:bg-[#F2FFFC] ${
                                selectedElement?.type === "route" && sameId(selectedElement.id, route.id)
                                  ? "border-[#00d8b8] bg-[#E6FFFA]"
                                  : "border-[#E2EEF6] bg-[#F8FBFD]"
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-black text-[#0F172A]">{route.description || route.label || "Eletroduto"}</p>
                                <p className="truncate text-[9px] font-bold uppercase tracking-wide text-[#64748B]">
                                  {routeModeLabel(route.mode)} · {normalizeRouteSystem(route.systemType || route.type) === "telecom" ? "Telecom" : "Elétrica"} · {normalizeConduitDiameter(route.conduit_diameter || route.gauge, DEFAULT_CONDUIT_DIAMETER)}
                                </p>
                              </div>
                              <button
                                type="button"
                                title="Remover cabo"
                                aria-label="Remover cabo"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeRoute(route.id);
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#FECACA] bg-white text-[#B91C1C] transition hover:bg-[#FEF2F2]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <PanelTop className="h-3.5 w-3.5 text-[#00d8b8]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F6B7A]">Quadros do projeto</p>
                    <div className="h-px flex-1 bg-[#D6E8F3]" />
                  </div>

                  {!selectedProject ? (
                    <div className="rounded-md border border-dashed border-[#C9E0EF] bg-white p-3 text-[11px] font-bold text-[#64748B]">
                      Selecione um projeto no topo para carregar os quadros elétricos.
                    </div>
                  ) : panelBoards.length === 0 ? (
                    <div className="space-y-2 rounded-md border border-dashed border-[#C9E0EF] bg-white p-3">
                      <p className="text-[11px] font-bold text-[#64748B]">Nenhum quadro criado para este projeto.</p>
	                      <Button
	                        type="button"
	                        size="sm"
	                        className="h-9 w-full rounded-md bg-[#00d8b8] text-xs font-extrabold hover:bg-[#00a98e]"
	                        onClick={() => setInfraPromptAction("panel")}
		                        disabled={!hasProjectCircuits || !hasPositionedBoard || saving}
	                      >
	                        <PanelTop className="h-3.5 w-3.5" />
	                        Gerar quadro pela planta
	                      </Button>
		                      {(!hasProjectCircuits || !hasPositionedBoard) && (
		                        <p className="text-[10px] font-bold leading-snug text-amber-700">
		                          {!hasProjectCircuits
		                            ? "Puxe os circuitos do editor antes de gerar o quadro pela planta."
		                            : "Insira e posicione um QD na planta antes de gerar o quadro."}
		                        </p>
	                      )}
	                    </div>
                  ) : (
                    <div className="space-y-2 rounded-md border border-[#C9E0EF] bg-white p-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Inserir quadro</span>
                        <Badge variant="outline" className="h-5 rounded-md border-[#CDEFE8] px-1.5 text-[9px] font-black text-[#0f4f49]">
                          {panelBoards.length}
                        </Badge>
                      </div>

                      <Select value={selectedPanelBoard?.id || ""} onValueChange={setSelectedPanelBoardId}>
                        <SelectTrigger className="h-9 rounded-md border-[#CDEFE8] bg-[#F8FBFD] text-xs font-extrabold">
                          <SelectValue placeholder="Escolher quadro" />
                        </SelectTrigger>
                        <SelectContent>
                          {panelBoards.map((board) => (
                            <SelectItem key={board.id} value={board.id} className="text-xs">
                              {board.name} · {board.location || "Distribuição"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        value={targetRoomName}
                        onChange={(event) => setTargetRoomName(event.target.value)}
                        placeholder="Cômodo ou local: cozinha, sala..."
                        className="h-9 rounded-md border-[#CDEFE8] bg-white text-xs font-bold"
                      />

                      {selectedPanelBoard && (
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-black uppercase tracking-wide text-[#526173]">
                          <span className="rounded bg-[#F8FBFD] px-2 py-1.5">
                            {selectedPanelBoard.layout?.rails?.length || 0} trilhos
                          </span>
                          <span className="rounded bg-[#F8FBFD] px-2 py-1.5">
                            {getBoardUsedModules(selectedPanelBoard)} DIN
                          </span>
                        </div>
                      )}

                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full rounded-md bg-[#00d8b8] text-xs font-extrabold hover:bg-[#00a98e]"
                        onClick={insertSelectedPanelBoard}
                        disabled={!selectedPanelBoard}
                      >
                        <PanelTop className="h-3.5 w-3.5" />
                        Inserir no cômodo
                      </Button>

	                      <Button
	                        type="button"
	                        variant="outline"
	                        size="sm"
	                        className="h-8 w-full rounded-md border-[#CDEFE8] text-xs font-extrabold text-[#0f4f49]"
	                        onClick={insertAllPanelBoards}
	                      >
	                        Inserir todos os quadros
	                      </Button>

	                      <Button
	                        type="button"
	                        variant="outline"
	                        size="sm"
	                        className="h-8 w-full rounded-md border-[#CDEFE8] text-xs font-extrabold text-[#0f4f49]"
	                        onClick={() => setInfraPromptAction("panel")}
		                        disabled={!hasProjectCircuits || !hasPositionedBoard || saving}
	                      >
	                        Gerar quadro pela planta
	                      </Button>
	                    </div>
                  )}
                </div>

                {CAD_TOOL_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  const groupStyle = CATEGORY_STYLES[group.id] || CATEGORY_STYLES.extra || {};
                  return (
                    <div key={group.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <GroupIcon className="h-3.5 w-3.5" style={{ color: groupStyle.color }} />
                        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: groupStyle.text }}>{group.title}</p>
                        <div className="h-px flex-1" style={{ backgroundColor: groupStyle.border }} />
                      </div>
                      <div className="space-y-1.5">
                        {group.tools.map((toolId) => {
                          const tool = toolsById[toolId];
                          if (!tool) return null;
                          const categoryStyle = CATEGORY_STYLES[tool.category] || {};
                          const active = activeTool === tool.id;
                          return (
                            <button
                              key={tool.id}
                              onClick={() => insertElectricalTool(tool)}
                              className="group flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left shadow-[0_1px_0_rgba(15,23,42,0.04)] transition"
                              style={{
                                borderColor: active ? categoryStyle.color : categoryStyle.border,
                                backgroundColor: active ? categoryStyle.surface : "#ffffff",
                              }}
                              onMouseEnter={(event) => {
                                if (active) return;
                                event.currentTarget.style.borderColor = categoryStyle.color || "#00d8b8";
                                event.currentTarget.style.backgroundColor = categoryStyle.surface || "#F4F9FD";
                              }}
                              onMouseLeave={(event) => {
                                if (active) return;
                                event.currentTarget.style.borderColor = categoryStyle.border || "#D6E8F3";
                                event.currentTarget.style.backgroundColor = "#ffffff";
                              }}
                            >
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                                style={{
                                  borderColor: active ? categoryStyle.color : categoryStyle.border,
                                  backgroundColor: active ? "#ffffff" : categoryStyle.surface,
                                }}
                              >
                                <ElectricalSymbol type={tool.id} size={25} color={tool.color} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-black leading-tight text-[#0F172A]">{tool.label}</span>
                                <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-[#64748B]">{TOOL_DETAIL[tool.id]}</span>
                              </span>
                              <Badge
                                variant="secondary"
                                className="h-6 shrink-0 rounded-md px-2 text-[9px] font-black"
                                style={{
                                  backgroundColor: categoryStyle.soft,
                                  color: categoryStyle.text,
                                }}
                              >
                                {CATEGORY_LABELS[tool.category]}
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-md border border-[#CDEFE8] bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#00d8b8]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F6B7A]">Padrao</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] font-black uppercase tracking-wide text-[#0f4f49]">
                    <span className="rounded bg-[#EEF7FC] px-1.5 py-1">NBR 5410</span>
                    <span className="rounded bg-[#EEF7FC] px-1.5 py-1">NBR 5444</span>
                    <span className="rounded bg-[#EEF7FC] px-1.5 py-1">Layers</span>
                  </div>
                </div>
              </div>
            )}

            {sidebar === "ai" && (
              <AIAnalysisPanel
                imageUrl={imageUrl}
                points={points}
                onRequestedPlanGenerated={handleRequestedPlanGenerated}
                onMountedRoomsRequested={mountedRoomsForAi}
                onPointsSuggested={handlePointsSuggested}
                onInfrastructureGenerated={handleInfrastructureGenerated}
                onProjectCircuitsRequested={pullProjectCircuitsFromEditor}
                onFullScanCompleted={handleFullScanCompleted}
                projectCircuits={generatedCircuits}
                hasPositionedBoard={hasPositionedBoard}
                selectedProjectId={selectedProject}
                infraType={infraType}
                setInfraType={setInfraType}
              />
            )}
          </div>

          {/* Points counter */}
          {(points.length > 0 || routes.length > 0) && (
            <div className="border-t border-border p-2">
              <p className="text-[10px] text-muted-foreground mb-1">Pontos inseridos</p>
              <div className="flex flex-wrap gap-1">
                {["iluminacao", "tomadas", "forca", "infra", "extra"].map(cat => {
                  const count = countByCategory(cat);
                  if (!count) return null;
                  return (
                    <Badge key={cat} variant="secondary" className="text-[9px] px-1.5 py-0">
                      {count} {CATEGORY_LABELS[cat]?.split(" ")[0]}
                    </Badge>
                  );
                })}
                {routes.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {routes.length} Cabos
                  </Badge>
                )}
              </div>
              <p className="text-xs font-bold mt-1 text-primary">{points.length} total</p>
            </div>
          )}
        </div>

        {/* Canvas area */}
        <div ref={canvasExportRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#F2FFFC]">
          <PlantaCanvasBoundary
            resetKey={`${selectedProject || "blank"}-${points.length}-${routes.length}-${rooms.length}-${walls.length}-${fitRequest}`}
            onReset={() => {
              setSelectedElement(null);
              setActiveTool("");
              setArchitectureTool("");
              setRouteToolActive(false);
              setRouteDraft(null);
              setFitRequest(value => value + 1);
            }}
          >
            <FloorPlanCanvas
              imageUrl={imageUrl}
              imageLayout={imageLayout}
              importedPlanElements={importedPlanElements}
              points={points}
              onAddPoint={addPointToCanvas}
              onMovePoint={movePoint}
              onRemovePoint={removePoint}
              onAddRoom={addRoom}
              onSelectTool={(tool) => {
                setActiveTool(tool);
                if (tool) setArchitectureTool("");
                if (tool) setRouteEditMode("");
              }}
              architectureTool={architectureTool}
              onSelectArchitectureTool={selectArchitectureTool}
              walls={walls}
              openings={openings}
              roomLabels={roomLabels}
              onAddWall={addArchitecturalWall}
              onUpdateWall={updateArchitecturalWall}
              onAddOpening={addArchitecturalOpening}
              onUpdateOpening={updateArchitecturalOpening}
              onAddRoomLabel={addArchitecturalRoomLabel}
              onUpdateRoomLabel={updateArchitecturalRoomLabel}
              onRotateSelected={rotateSelected}
              onDuplicateSelected={duplicateSelected}
              onDeleteSelected={deleteSelected}
              onUndo={undoDesign}
              onRedo={redoDesign}
              onZoomChange={setZoom}
              onFit={() => { setZoom(1); setSelectedElement(null); setFitRequest(value => value + 1); }}
              toolsPanelOpen={leftPanelOpen}
              onToggleToolsPanel={() => setLeftPanelOpen(value => !value)}
              activeTool={activeTool}
              routeToolActive={routeToolActive}
              routeStyle={routeMode}
              onSelectRouteTool={(mode) => {
                if (routeToolActive && routeMode === mode) {
                  setRouteToolActive(false);
                  setRouteDraft(null);
                  setRouteStartId("");
                } else {
                  setRouteToolActive(true);
                  setRouteMode(mode);
                  setActiveTool("");
                  setArchitectureTool("");
                }
              }}
              routeStartId={routeStartId}
              routeEditMode={routeEditMode}
              routeDraft={routeDraft}
              selectedRoutePointIndex={selectedRoutePointIndex}
              onRoutePointClick={handleRoutePointClick}
              onRouteCanvasClick={handleRouteCanvasClick}
              onRouteCanvasDoubleClick={handleRouteCanvasDoubleClick}
              onRouteDoubleClick={(id) => setRouteGaugeModalId(String(id))}
              onUpdateRoutePoint={updateRoutePoint}
              onUpdateRouteLabel={(routeId, patch) => updateRouteProperties(routeId, patch)}
              onAddRoutePoint={addRoutePoint}
              onRemoveRoutePoint={removeRoutePoint}
              onSelectRoutePoint={setSelectedRoutePointIndex}
              onPointDoubleClick={(id) => setPointHeightModalId(String(id))}
              onCircuitDoubleClick={(id) => {
                const point = points.find(p => String(p.id) === String(id));
                if (point && isCircuitConfigurablePoint(point)) {
                  setCircuitModalPointId(String(id));
                }
              }}
              onMoveRoute={moveRoute}
              onCommitRouteDrag={commitRouteDrag}
              selectedElement={selectedElement}
              onSelectElement={selectCanvasElement}
              canUndo={historyMeta.canUndo}
              canRedo={historyMeta.canRedo}
              layers={layers}
              routes={routes}
              rooms={rooms}
              onUpdateRoom={updateRoom}
              zoom={zoom}
              scalePxPerMeter={scalePxPerMeter}
              showWallDimensions={showWallDimensions}
              showDeviceDimensions={showDeviceDimensions}
              showPositionLabels={showPositionLabels}
              snapSettings={snapSettings}
              onScalePxPerMeterChange={(nextScale) => commitDesign({ scalePxPerMeter: normalizeScalePxPerMeter(nextScale) })}
              onToggleWallDimensions={() => commitDesign({ showWallDimensions: !showWallDimensions })}
              onToggleDeviceDimensions={() => commitDesign({ showDeviceDimensions: !showDeviceDimensions })}
              onTogglePositionLabels={() => commitDesign({ showPositionLabels: !showPositionLabels })}
              onEditWallDimension={resizeArchitecturalWallToLength}
              fitRequest={fitRequest}
            />
          </PlantaCanvasBoundary>
          {activeTool && (
            <div data-html2canvas-ignore="true" className="pointer-events-none absolute left-4 top-16 rounded-md border border-black bg-white px-3 py-2 text-xs font-black text-black shadow-sm">
              {toolsById[activeTool]?.label || activeTool}: clique onde quiser para inserir. A ferramenta permanece ativa; pressione Esc para sair.
            </div>
          )}
          {architectureTool && (
            <div data-html2canvas-ignore="true" className="pointer-events-none absolute left-4 top-16 max-w-[430px] rounded-md border border-[#00d8b8] bg-white px-3 py-2 text-xs font-black text-[#0f4f49] shadow-sm">
              {architectureTool === "wall" && "Parede: clique ponto a ponto. Shift mantém horizontal/vertical; Enter termina a sequência; Esc sai."}
              {architectureTool === "curve" && "Curva: clique no início, no fim e depois no ponto que define a curvatura. Esc cancela."}
              {architectureTool === "label" && "Nomear cômodo: clique dentro do ambiente e digite o nome no painel lateral. O texto pode ser arrastado."}
              {architectureTool === "door" && "Porta: clique em qualquer posição de uma parede. Depois selecione e arraste para ajustar."}
              {architectureTool === "window" && "Janela: clique em qualquer posição de uma parede. Depois selecione e arraste para ajustar."}
            </div>
          )}
          {routeToolActive && (
            <div data-html2canvas-ignore="true" className="pointer-events-none absolute left-4 top-16 max-w-[360px] rounded-md border border-[#00d8b8] bg-white px-3 py-2 text-xs font-black text-[#0f4f49] shadow-sm">
              {routeDraft?.source
                ? "Cabo manual: clique para adicionar pontos, clique em um terminal para concluir ou pressione Enter."
                : "Adicionar cabo: clique em um terminal ou ponto livre para definir a origem."}
            </div>
          )}
        </div>

        <button
          type="button"
          data-html2canvas-ignore="true"
          onClick={() => setRightPanelOpen(true)}
          className={`absolute right-4 top-[76px] z-30 flex h-11 items-center gap-2 rounded-md border border-[#BCEEE5] bg-white px-3 text-xs font-black text-[#0f4f49] shadow-[0_10px_30px_rgba(15,23,42,0.14)] transition hover:border-[#00d8b8] hover:bg-[#F2FFFC] max-lg:top-[92px] ${
            rightPanelOpen ? "pointer-events-none translate-x-3 opacity-0" : "translate-x-0 opacity-100"
          }`}
        >
          <GitBranch className="h-4 w-4 text-[#00d8b8]" />
          Painel técnico
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E5F3FC] px-1.5 text-[10px] text-[#1B3556]">
            {generatedCircuits.length}
          </span>
        </button>

        {/* Right sidebar — telemetry / circuits / compliance / BOM */}
        <div
          data-html2canvas-ignore="true"
          className={`absolute bottom-0 right-0 top-[68px] z-40 flex w-[360px] max-w-[calc(100%-16px)] flex-col border-l border-t border-[#CDEFE8] bg-[#F8FBFD] shadow-[-18px_0_45px_rgba(15,23,42,0.16)] transition-transform duration-200 ease-out max-lg:top-[84px] max-lg:w-[min(92vw,380px)] ${
            rightPanelOpen ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+20px)]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#CDEFE8] bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00d8b8]">Painel técnico</p>
              <p className="truncate text-[11px] font-bold text-[#64748B]">Circuitos, norma e materiais</p>
            </div>
            <button
              type="button"
              onClick={() => setRightPanelOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CDEFE8] bg-[#F8FBFD] text-[#0f4f49] transition hover:border-[#00d8b8] hover:bg-[#E6FFFA]"
              aria-label="Fechar painel técnico"
              title="Fechar painel"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs header */}
          <div className="flex border-b border-[#CDEFE8] bg-white">
            {[
              { id: "circuits", icon: GitBranch, label: "Circuitos" },
              { id: "nbr",      icon: ShieldCheck, label: "NBR 5410" },
              { id: "bom",      icon: FileText,   label: "Materiais" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveRightTab(tab.id)}
                className={`flex-1 py-3 text-[11px] font-black flex flex-col items-center gap-1 transition-colors
                  ${activeRightTab === tab.id ? "text-[#00d8b8] border-b-[3px] border-[#00d8b8]" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {activeRightTab === "circuits" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Circuitos do Projeto</span>
                  <Badge variant="outline" className="h-5 rounded-md border-[#CDEFE8] px-1.5 text-[9px] font-black text-[#0f4f49]">
                    {generatedCircuits.length}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                    onClick={() => navigate(selectedProject ? `/circuit-editor?project=${selectedProject}` : "/circuit-editor")}
                  >
                    Editor
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-md border-[#CDEFE8] text-[10px] font-extrabold text-[#0f4f49]"
                    onClick={createLightingCircuitFromPlant}
                    disabled={saving}
                  >
                    <Lightbulb className="h-3.5 w-3.5 text-[#D97706]" />
                    Iluminação
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 rounded-md bg-[#00d8b8] text-[10px] font-extrabold hover:bg-[#00a98e]"
                    onClick={pullProjectCircuitsFromEditor}
                    disabled={!selectedProject || saving}
                  >
                    Puxar circuitos
                  </Button>
                </div>

                {generatedCircuits.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#C9E0EF] bg-white p-4 text-center">
                    <p className="text-xs font-bold text-[#64748B]">Nenhum circuito importado.</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Use Iluminação para começar pela planta ou puxe circuitos do editor.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {generatedCircuits.map((c, i) => (
                      <div key={i} className="bg-white rounded-md p-2.5 border border-[#C9E0EF] shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-[#0F172A] truncate">{c.name}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wide text-[#64748B] truncate">{c.type}</p>
                          </div>
                          {c.phase && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${
                              c.phase === "A" ? "bg-red-100 text-red-700" :
                              c.phase === "B" ? "bg-slate-100 text-slate-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              Fase {c.phase}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-[9px] bg-[#E5F3FC] text-[#1B3556] px-1.5 py-0">
                            {c.supply_type || "Monofásico"}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] bg-[#E5F3FC] text-[#1B3556] px-1.5 py-0">
                            {c.load_w_total || c.power_w || 0}W
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] bg-[#E5F3FC] text-[#1B3556] px-1.5 py-0">
                            {c.voltage || 220}V
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeRightTab === "nbr" && (
              <div className="space-y-4">
                {/* NBR 5410 score circular badge */}
                <div className="rounded-md border border-[#C9E0EF] bg-white p-3.5 text-center shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Score NBR 5410</span>
                    <span className={`text-xs font-black ${
                      telemetry.audit.score >= 80 ? "text-[#10B981]" :
                      telemetry.audit.score >= 50 ? "text-[#F59E0B]" :
                      "text-[#EF4444]"
                    }`}>
                      {telemetry.audit.score >= 80 ? "CONFORME" : "REVISÃO RECOMENDADA"}
                    </span>
                  </div>
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-2xl font-black text-[#0F172A]">{telemetry.audit.score}%</span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2.5 text-xs flex rounded bg-slate-100">
                      <div
                        style={{ width: `${telemetry.audit.score}%` }}
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                          telemetry.audit.score >= 80 ? "bg-[#10B981]" :
                          telemetry.audit.score >= 50 ? "bg-[#F59E0B]" :
                          "bg-[#EF4444]"
                        }`}
                      />
                    </div>
                  </div>
	                </div>

                <div className="space-y-2 rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Dimensionamento mínimo por ambiente</p>
                      <p className="mt-1 text-[10px] font-bold leading-snug text-[#64748B]">
                        Baseado em área e perímetro dos cômodos desenhados na escala da planta.
                      </p>
                    </div>
                    <Badge variant="outline" className={`h-6 shrink-0 rounded-md px-2 text-[9px] font-black ${
                      roomNBRMissingTotal > 0
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}>
                      {roomNBRMissingTotal > 0 ? `${roomNBRMissingTotal} pend.` : "OK"}
                    </Badge>
                  </div>

                  {roomNBRAnalysis.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[#C9E0EF] bg-[#F8FBFD] p-3 text-[10px] font-bold leading-snug text-[#64748B]">
                      Nenhum cômodo desenhado. Insira cômodos para calcular luminárias, interruptores e tomadas mínimas.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <span className="rounded-md bg-[#F8FBFD] px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-[#0f4f49]">
                          {roomNBRSummary.rooms} cômodos
                        </span>
                        <span className="rounded-md bg-[#F8FBFD] px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-[#0f4f49]">
                          {formatPtNumber(roomNBRSummary.lightingPowerVa, 0)} VA luz
                        </span>
                        <span className="rounded-md bg-[#F8FBFD] px-1.5 py-2 text-[9px] font-black uppercase tracking-wide text-[#0f4f49]">
                          {formatPtNumber(roomNBRSummary.tugPowerVa, 0)} VA TUG
                        </span>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full rounded-md bg-[#00d8b8] text-xs font-black hover:bg-[#00a98e]"
                        onClick={applyNBRRequirementsToPlant}
                        disabled={saving}
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        Aplicar na planta e circuitos
                      </Button>

                      <div className="space-y-1.5">
                        {roomNBRAnalysis.map((item) => (
                          <div key={`right-${item.roomId || item.roomName}`} className="rounded-md border border-[#E2EEF6] bg-[#F8FBFD] p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black text-[#0F172A]">{item.roomName}</p>
                                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-[#64748B]">
                                  {formatPtNumber(item.metrics.widthM, 1)} x {formatPtNumber(item.metrics.lengthM, 1)} m · {formatPtNumber(item.metrics.areaM2, 2)} m²
                                </p>
                              </div>
                              {item.status === "pass" ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              ) : (
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                              )}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px] font-bold text-[#526173]">
                              <span className="rounded bg-white px-1.5 py-1">Luminárias: <strong className="text-[#0F172A]">{item.lightingPointCount}</strong></span>
                              <span className="rounded bg-white px-1.5 py-1">Tomadas: <strong className="text-[#0F172A]">{item.tugCount}</strong></span>
                              <span className="rounded bg-white px-1.5 py-1">Ilum.: <strong className="text-[#0F172A]">{item.lightingPowerVa} VA</strong></span>
                              <span className="rounded bg-white px-1.5 py-1">TUG: <strong className="text-[#0F172A]">{item.tugPowerVa} VA</strong></span>
                            </div>
                            {(item.missing.lighting || item.missing.tugs || item.missing.switches) > 0 && (
                              <p className="mt-1.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                                Faltam: {item.missing.lighting} luz, {item.missing.tugs} TUG, {item.missing.switches} interruptor
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

	                {/* Phase Balancing */}
	                <div className="rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Equilíbrio de Fases</span>
                    <span className={`text-[10px] font-black ${telemetry.phases.color}`}>
                      {telemetry.phases.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* Phase A */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-[#526173]">
                        <span>Fase A (R)</span>
                        <span>{telemetry.phases.A}W ({telemetry.phases.total > 0 ? Math.round((telemetry.phases.A / telemetry.phases.total) * 100) : 0}%)</span>
                      </div>
                      <div className="overflow-hidden h-2 flex rounded bg-slate-100">
                        <div
                          style={{ width: `${telemetry.phases.total > 0 ? (telemetry.phases.A / telemetry.phases.total) * 100 : 0}%` }}
                          className="bg-[#EF4444] rounded transition-all duration-500"
                        />
                      </div>
                    </div>

                    {/* Phase B */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-[#526173]">
                        <span>Fase B (S)</span>
                        <span>{telemetry.phases.B}W ({telemetry.phases.total > 0 ? Math.round((telemetry.phases.B / telemetry.phases.total) * 100) : 0}%)</span>
                      </div>
                      <div className="overflow-hidden h-2 flex rounded bg-slate-100">
                        <div
                          style={{ width: `${telemetry.phases.total > 0 ? (telemetry.phases.B / telemetry.phases.total) * 100 : 0}%` }}
                          className="bg-[#1E293B] rounded transition-all duration-500"
                        />
                      </div>
                    </div>

                    {/* Phase C */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-[#526173]">
                        <span>Fase C (T)</span>
                        <span>{telemetry.phases.C}W ({telemetry.phases.total > 0 ? Math.round((telemetry.phases.C / telemetry.phases.total) * 100) : 0}%)</span>
                      </div>
                      <div className="overflow-hidden h-2 flex rounded bg-slate-100">
                        <div
                          style={{ width: `${telemetry.phases.total > 0 ? (telemetry.phases.C / telemetry.phases.total) * 100 : 0}%` }}
                          className="bg-[#F59E0B] rounded transition-all duration-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-bold text-[#64748B] bg-[#F8FBFD] p-1.5 rounded border border-[#E5F3FC]">
                    <span>Desbalanceamento:</span>
                    <span className={`font-black ${telemetry.phases.deviation > 30 ? "text-red-600" : "text-[#10B981]"}`}>
                      {telemetry.phases.deviation}%
                    </span>
                  </div>
                </div>

                {/* Compliance Checklist */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Auditoria de Requisitos</p>
                  <div className="space-y-1.5">
                    {telemetry.audit.checks.map((check) => (
                      <div key={check.id} className="bg-white rounded-md p-2.5 border border-[#C9E0EF] flex gap-2.5 items-start">
                        {check.status === "pass" && <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />}
                        {check.status === "warn" && <AlertCircle className="h-4 w-4 text-[#F59E0B] shrink-0 mt-0.5" />}
                        {check.status === "fail" && <AlertCircle className="h-4 w-4 text-[#EF4444] shrink-0 mt-0.5" />}
                        {check.status === "pending" && <span className="h-4 w-4 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />}
                        
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-[#0F172A] leading-tight">{check.title}</p>
                          <p className="text-[9px] font-bold text-[#64748B] mt-0.5 leading-snug">{check.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeRightTab === "bom" && (
              <div className="space-y-4">
                {/* Estimated Pricing Card */}
                <div className="rounded-md border border-[#C9E0EF] bg-gradient-to-br from-[#00d8b8] to-[#004270] p-4 text-white shadow-[0_4px_12px_rgba(0,100,166,0.15)]">
                  <div className="flex items-center justify-between mb-1 opacity-90">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Custo Est. Materiais</span>
                    <Coins className="h-4 w-4" />
                  </div>
                  <p className="text-xl font-black">
                    R$ {telemetry.bom.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="mt-2 flex justify-between items-center text-[9px] font-bold bg-white/10 px-2 py-1 rounded">
                    <span>Instalação:</span>
                    <span className="font-black uppercase">{infraType}</span>
                  </div>
                </div>

                {scannerReport && (
                  <div className="rounded-md border border-[#C9E0EF] bg-white p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ScanLine className="h-4 w-4 text-[#00d8b8]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Scanner IA</p>
                      </div>
                      <Badge variant="outline" className="border-[#CDEFE8] text-[9px] font-black text-[#0f4f49]">
                        Construtora
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold text-[#526173]">
                      <span className="rounded bg-[#F8FBFD] px-2 py-1">Pontos: {scannerReport.counts?.pontos || 0}</span>
                      <span className="rounded bg-[#F8FBFD] px-2 py-1">Rotas: {scannerReport.counts?.rotas || 0}</span>
                      <span className="rounded bg-[#F8FBFD] px-2 py-1">Tomadas: {scannerReport.counts?.tomadas || 0}</span>
                      <span className="rounded bg-[#F8FBFD] px-2 py-1">Força: {scannerReport.counts?.forca || 0}</span>
                    </div>
                    <div className="mt-2 rounded bg-[#E6FFFA] px-2 py-1.5 text-xs font-black text-[#00d8b8]">
                      Orçamento scanner: R$ {formatCurrencyBR(scannerReport.budget_total || 0)}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 w-full rounded-md border-[#CDEFE8] text-xs font-black text-[#00d8b8]"
                      onClick={() => selectedProject && navigate(`/budget?project=${selectedProject}`)}
                      disabled={!selectedProject}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Abrir orçamento do projeto
                    </Button>
                  </div>
                )}

                {/* Material list */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00d8b8]">Lista de Materiais</p>
                    <Badge variant="outline" className="text-[9px] font-bold border-[#CDEFE8] text-[#0f4f49]">
                      {telemetry.bom.items.length} itens
                    </Badge>
                  </div>

                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                    {telemetry.bom.items.map((item, i) => (
                      <div key={i} className="bg-white rounded-md p-2 border border-[#C9E0EF] flex justify-between items-center text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-[11px] font-black text-[#0F172A] truncate" title={item.name}>{item.name}</p>
                          <p className="text-[9px] font-bold text-[#64748B] mt-0.5">
                            {item.qty} {item.unit} x R$ {item.pricePerUnit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <span className="text-[11px] font-black text-[#00d8b8] shrink-0">
                          R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export actions */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full rounded-md border-[#CDEFE8] text-xs font-black text-[#00d8b8] hover:bg-[#F2FFFC]"
                  onClick={saveCurrentBomToProject}
                  disabled={!selectedProject || telemetry.bom.items.length === 0 || saving}
                >
                  <Coins className="h-3.5 w-3.5" />
                  Salvar e abrir orçamento
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full rounded-md border-[#CDEFE8] text-xs font-black text-[#00d8b8] hover:bg-[#F2FFFC]"
                  onClick={() => {
                    const text = telemetry.bom.items
                      .map(item => `${item.name}: ${item.qty} ${item.unit} - Total: R$ ${item.total.toFixed(2)}`)
                      .join("\n");
                    navigator.clipboard.writeText(text);
                    alert("Lista de materiais copiada!");
                  }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Copiar Lista de Materiais
                </Button>
              </div>
            )}
          </div>

          {/* Save to project (Sticky Footer) */}
          <div className="p-3 border-t border-[#CDEFE8] bg-white space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#526173]">
              <span className="uppercase tracking-wide">Projeto Selecionado</span>
              <span className="font-black text-[#0F172A] truncate max-w-[150px]" title={selectedProjectName}>{selectedProjectName || "Nenhum"}</span>
            </div>
            
            {selectedProject ? (
              <>
                <Button size="sm" className="h-9 w-full gap-1.5 text-xs font-black bg-[#00d8b8] hover:bg-[#00a98e]"
                  onClick={() => {
                    if (generatedCircuits.length === 0) {
                      navigate(`/circuit-editor?project=${selectedProject}`);
                      return;
                    }
                    setInfraPromptAction("panel");
                  }}
                  disabled={saving || (generatedCircuits.length > 0 && !hasPositionedBoard)}
                >
                  {saving ? "Atualizando..." : saved ? "✓ Atualizado!" : generatedCircuits.length === 0 ? (
                    <><FileText className="w-3.5 h-3.5" />Editar Circuitos Primeiro</>
                  ) : !hasPositionedBoard ? (
                    <><PanelTop className="w-3.5 h-3.5" />Posicione o QD Primeiro</>
                  ) : (
                    <><FileText className="w-3.5 h-3.5" />Gerar Quadro pela Planta</>
                  )}
                </Button>
                
                {generatedCircuits.length > 0 && (
                  <Button size="sm" variant="outline" className="h-9 w-full gap-1.5 text-xs font-black border-[#CDEFE8] text-[#0f4f49]" 
                    onClick={() => navigate(`/unifilar?project=${selectedProject}`)}
                  >
                    <GitBranch className="w-3.5 h-3.5 text-[#00d8b8]" />Ver Diagrama Unifilar
                  </Button>
                )}
              </>
            ) : (
              <p className="text-[10px] text-center font-bold text-[#64748B] italic">
                Selecione um projeto no topo para salvar os dados.
              </p>
            )}
          </div>
        </div>

        <Dialog open={Boolean(pointHeightModalId)} onOpenChange={(open) => { if (!open) setPointHeightModalId(""); }}>
          <DialogContent className="max-w-xs border border-[#CDEFE8] bg-white p-5 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase text-[#0f4f49]">Altura do Ponto</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              {["piso", "baixa", "media", "alta", "teto"].map((height) => {
                const currentHeight = points.find(p => p.id === pointHeightModalId)?.height || "baixa";
                return (
                  <Button
                    key={height}
                    variant={currentHeight === height ? "default" : "outline"}
                    className={currentHeight === height ? "bg-[#00d8b8] text-white hover:bg-[#00c0a3]" : ""}
                    onClick={() => {
                      const newPoints = points.map((p) => p.id === pointHeightModalId ? { ...p, height } : p);
                      setPoints(newPoints);
                      commitDesign({ points: newPoints });
                      setPointHeightModalId("");
                    }}
                  >
                    {POINT_HEIGHT_LABELS[height]}
                  </Button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(routeGaugeModalId)} onOpenChange={(open) => { if (!open) setRouteGaugeModalId(""); }}>
          <DialogContent className="max-w-xs border border-[#CDEFE8] bg-white p-5 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase text-[#0f4f49]">Infraestrutura</DialogTitle>
            </DialogHeader>
            {(() => {
              const currentRoute = routes.find(r => String(r.id) === routeGaugeModalId);
              const currentRouteSystem = normalizeRouteSystem(currentRoute?.systemType || currentRoute?.system_type || currentRoute?.system || currentRoute?.type);
              const currentRouteConduitDiameter = normalizeConduitDiameter(currentRoute?.conduit_diameter || currentRoute?.conduitDiameter || currentRoute?.gauge, DEFAULT_CONDUIT_DIAMETER);
              return (
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#64748B] uppercase">Sistema</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={currentRouteSystem === "eletrica" ? "default" : "outline"}
                        className={currentRouteSystem === "eletrica" ? "bg-black text-white hover:bg-gray-800" : ""}
                        onClick={() => updateRouteProperties(routeGaugeModalId, routeVisualPatch("eletrica"))}
                      >
                        Elétrica
                      </Button>
                      <Button
                        variant={currentRouteSystem === "telecom" ? "default" : "outline"}
                        className={currentRouteSystem === "telecom" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                        onClick={() => updateRouteProperties(routeGaugeModalId, routeVisualPatch("telecom"))}
                      >
                        Telecom
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#64748B] uppercase">Bitola (Eletroduto)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {CONDUIT_DIAMETER_OPTIONS.map((gauge) => (
                        <Button
                          key={gauge}
                          variant="outline"
                          onClick={() => {
                            const conduitDiameter = normalizeConduitDiameter(gauge, DEFAULT_CONDUIT_DIAMETER);
                            updateRouteProperties(routeGaugeModalId, { conduit_diameter: conduitDiameter });
                          }}
                          className={`w-full justify-center ${currentRouteConduitDiameter === gauge ? "bg-[#e5fffa] border-[#00d8b8] text-[#0f4f49]" : ""}`}
                        >
                          {gauge}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="ghost"
                      onClick={() => updateRouteProperties(routeGaugeModalId, { conduit_diameter: DEFAULT_CONDUIT_DIAMETER })}
                      className="w-full text-[#0f4f49] hover:bg-[#E6FFFA]"
                    >
                      Usar 3/4"
                    </Button>
                    <Button
                      className="w-full bg-[#00d8b8] text-white hover:bg-[#00c0a3]"
                      onClick={() => setRouteGaugeModalId("")}
                    >
                      Concluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(circuitModalPoint)} onOpenChange={(open) => { if (!open) setCircuitModalPointId(""); }}>
          <DialogContent data-html2canvas-ignore="true" className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#0F172A]">
                <Zap className="h-5 w-5 text-[#00d8b8]" />
                Configurar circuito da tomada
              </DialogTitle>
            </DialogHeader>

            {circuitModalPoint && (
              <div className="space-y-4">
                <div className="rounded-md border border-[#CDEFE8] bg-[#F8FBFD] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00d8b8]">Ponto selecionado</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-[#526173]">
                    <Badge variant="secondary" className="rounded-md bg-white text-[#0f4f49]">
                      {routePointLabel(circuitModalPoint)}
                    </Badge>
                    <span>{selectedProjectName || "Projeto não selecionado"}</span>
                    {circuitModalPoint.circuit && <span className="text-[#0F172A]">Atual: {circuitModalPoint.circuit}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-md border border-[#CDEFE8] bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setPointCircuitMode("existing")}
                    disabled={circuitOptions.length === 0}
                    className={`h-10 rounded-md text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${
                      pointCircuitMode === "existing"
                        ? "bg-[#00d8b8] text-white"
                        : "bg-[#F8FBFD] text-[#0f4f49] hover:bg-[#E6FFFA]"
                    }`}
                  >
                    Usar circuito existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setPointCircuitMode("custom")}
                    className={`h-10 rounded-md text-xs font-black transition ${
                      pointCircuitMode === "custom"
                        ? "bg-[#00d8b8] text-white"
                        : "bg-[#F8FBFD] text-[#0f4f49] hover:bg-[#E6FFFA]"
                    }`}
                  >
                    Dimensionar pela planta
                  </button>
                </div>

                {pointCircuitMode === "existing" ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Circuito cadastrado na aba Circuitos</Label>
                      <Select value={pointCircuitForm.circuit_id} onValueChange={(value) => updatePointCircuitForm("circuit_id", value)}>
                        <SelectTrigger className="h-10 rounded-md border-[#CDEFE8] bg-white text-sm font-bold">
                          <SelectValue placeholder="Selecione um circuito" />
                        </SelectTrigger>
                        <SelectContent>
                          {circuitOptions.map((circuit) => (
                            <SelectItem key={circuit.id} value={circuit.id}>
                              {circuit.name} · {circuit.power_w || 0}W · {circuit.wire_gauge || "sem bitola"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {circuitOptions.length === 0 && (
                        <p className="text-xs font-bold text-amber-700">
                          Nenhum circuito cadastrado. Use "Dimensionar pela planta" para criar um circuito a partir deste ponto.
                        </p>
                      )}
                    </div>

                    {(() => {
                      const selectedCircuit = circuitOptions.find((circuit) => sameId(circuit.id, pointCircuitForm.circuit_id));
                      if (!selectedCircuit) return null;
                      return (
                        <div className="grid gap-2 rounded-md border border-[#CDEFE8] bg-[#F8FBFD] p-3 text-xs font-bold text-[#526173] sm:grid-cols-4">
                          <span>Potência <strong className="block text-[#0F172A]">{selectedCircuit.power_w || 0} W</strong></span>
                          <span>Condutor <strong className="block text-[#0F172A]">{selectedCircuit.wire_gauge || "-"}</strong></span>
                          <span>Proteção <strong className="block text-[#0F172A]">{selectedCircuit.breaker_a ? `${selectedCircuit.breaker_a}A` : "-"}</strong></span>
                          <span>Eletroduto <strong className="block text-[#0F172A]">{selectedCircuit.conduit_diameter || estimateConduitDiameter(selectedCircuit)}</strong></span>
                        </div>
                      );
                    })()}

                    <div className="flex justify-end gap-2 border-t border-[#E2EEF6] pt-3">
                      <Button type="button" variant="outline" className="font-bold" onClick={() => setCircuitModalPointId("")}>Cancelar</Button>
                      <Button
                        type="button"
                        className="bg-[#00d8b8] font-black hover:bg-[#00a98e]"
                        disabled={saving || !pointCircuitForm.circuit_id}
                        onClick={handleApplyExistingCircuitToPoint}
                      >
                        Aplicar ao ponto
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Nome do circuito</Label>
                        <Input value={pointCircuitForm.name} onChange={(event) => updatePointCircuitForm("name", event.target.value)} placeholder="Ex: Tomadas sala" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tipo</Label>
                        <Select value={pointCircuitForm.type} onValueChange={(value) => updatePointCircuitForm("type", value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Iluminação", "Tomadas de Uso Geral", "Tomadas de Uso Específico", "Ar Condicionado", "Chuveiro", "Motor"].map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Potência do circuito (W)</Label>
                        <Input type="number" min="0" value={pointCircuitForm.power_w} onChange={(event) => updatePointCircuitForm("power_w", event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Alimentação</Label>
                        <Select value={pointCircuitForm.supply_type} onValueChange={(value) => updatePointCircuitForm("supply_type", value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CIRCUIT_SUPPLY_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tensão</Label>
                        <Select value={String(pointCircuitForm.voltage)} onValueChange={(value) => updatePointCircuitForm("voltage", value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CIRCUIT_VOLTAGES.map((voltage) => <SelectItem key={voltage} value={String(voltage)}>{voltage}V</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Comprimento (m)</Label>
                        <Input type="number" min="1" value={pointCircuitForm.length_m} onChange={(event) => updatePointCircuitForm("length_m", event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>fp</Label>
                        <Input type="number" step="0.01" min="0.5" max="1" value={pointCircuitForm.power_factor} onChange={(event) => updatePointCircuitForm("power_factor", event.target.value)} />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Método de instalação</Label>
                        <Select value={pointCircuitForm.install_method} onValueChange={(value) => updatePointCircuitForm("install_method", value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CIRCUIT_INSTALL_METHODS.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {pointCircuitPreview && (
                      <div className="grid gap-2 rounded-md border border-[#CDEFE8] bg-[#F8FBFD] p-3 text-xs font-bold text-[#526173] sm:grid-cols-4">
                        <span>Corrente <strong className="block text-[#0F172A]">{pointCircuitPreview.project_current_a} A</strong></span>
                        <span>Condutor <strong className="block text-[#0F172A]">{pointCircuitPreview.wire_gauge}</strong></span>
                        <span>Proteção <strong className="block text-[#0F172A]">{pointCircuitPreview.breaker_a}A {pointCircuitPreview.breaker_poles}P/{pointCircuitPreview.breaker_curve}</strong></span>
                        <span>Eletroduto <strong className="block text-[#0F172A]">{pointCircuitPreview.conduit_diameter}</strong></span>
                        <span>Cabos <strong className="block text-[#0F172A]">{pointCircuitPreview.cable_description}</strong></span>
                        <span>Queda <strong className={pointCircuitPreview.voltage_drop_ok ? "block text-[#0F172A]" : "block text-red-600"}>{pointCircuitPreview.voltage_drop_pct}%</strong></span>
                      </div>
                    )}

                    {!selectedProject && (
                      <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs font-bold leading-snug text-amber-800">
                        Sem projeto selecionado, o circuito fica nesta sessão da planta. Selecione um projeto para gravar e aparecer nas abas Circuitos, Quadro e Diagrama.
                      </p>
                    )}

                    <div className="flex justify-end gap-2 border-t border-[#E2EEF6] pt-3">
                      <Button type="button" variant="outline" className="font-bold" onClick={() => setCircuitModalPointId("")}>Cancelar</Button>
                      <Button
                        type="button"
                        className="bg-[#00d8b8] font-black hover:bg-[#00a98e]"
                        disabled={saving || !pointCircuitForm.name.trim() || !pointCircuitPreview}
                        onClick={handleSavePointCircuit}
                      >
                        {saving ? "Salvando..." : "Dimensionar e salvar"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {infraPromptAction && (
          <div
            data-html2canvas-ignore="true"
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/20 px-4 backdrop-blur-[1px]"
          >
            <div className="w-full max-w-[420px] rounded-md border border-[#CDEFE8] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00d8b8]">Método de infraestrutura</p>
                  <h3 className="mt-1 text-base font-black text-[#0F172A]">
                    Como deseja executar a planta?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInfraPromptAction("")}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#CDEFE8] text-[#526173] hover:border-[#00d8b8] hover:text-[#00d8b8]"
                  aria-label="Fechar escolha de infraestrutura"
                >
                  X
                </button>
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => handleInfraMethodChoice("embutido")}
                  className="rounded-md border border-[#CDEFE8] bg-[#F8FBFD] p-3 text-left transition hover:border-[#00d8b8] hover:bg-[#E6FFFA]"
                >
                  <span className="block text-sm font-black text-[#0F172A]">Eletroduto embutido</span>
                  <span className="mt-1 block text-[11px] font-bold leading-snug text-[#64748B]">
                    Rotas no teto/parede com eletroduto flexível, caixas embutidas e distribuição técnica até o QD.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleInfraMethodChoice("galvanizado")}
                  className="rounded-md border border-[#CDEFE8] bg-[#F8FBFD] p-3 text-left transition hover:border-[#00d8b8] hover:bg-[#E6FFFA]"
                >
                  <span className="block text-sm font-black text-[#0F172A]">Sobrepor com estrutura galvanizada</span>
                  <span className="mt-1 block text-[11px] font-bold leading-snug text-[#64748B]">
                    Rotas aparentes com eletroduto galvanizado/condulete e traçado mais ortogonal até o quadro elétrico.
                  </span>
                </button>
              </div>

              <p className="mt-3 text-[10px] font-bold leading-snug text-[#64748B]">
                A escolha será aplicada ao quadro, materiais e rotas de infraestrutura da planta.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
