/**
 * PanelGenerator.jsx — Editor e Construtor de Quadro Elétrico Tridimensional e Interativo
 * Visual: Alta Fidelidade Realista (baseado na referência fornecida)
 * NBR 5410:2004 · NR10 · IEC 60715 (DIN 35mm)
 */
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { buildPanelBoardsWithLayout, calcProjectMetrics, generateDefaultPanelLayout } from "@/lib/electricalEngine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  Plus,
  Trash2,
  Cable,
  RefreshCw,
  X,
  PanelTop,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

// ─── CONSTANTES DE DIMENSIONAMENTO DO PAINEL ───────────────────────────────────
const PANEL_W = 850;
const MOD = 26;          // 1 Módulo DIN = 26px
const BRK_H = 110;        // Altura padrão do disjuntor em px
const ROW_MAX = 18;       // Limite de módulos DIN por trilho
const RAIL_COMPONENT_START_X = 160;
const RAIL_COMPONENT_GAP = 2;
const MIN_PANEL_SCALE = 0.35;
const MAX_PANEL_SCALE = 1.8;
const DEFAULT_PANEL_SCALE = 0.85;
const COMB_BUSBAR_PREFIX = "comb-bus";
const FREE_COMB_BUSBAR_PREFIX = "free-comb-bus";
const COMB_TOOTH_WIDTH = 4;

const clampPanelScale = (value, fallback = DEFAULT_PANEL_SCALE) => {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  return Math.max(MIN_PANEL_SCALE, Math.min(MAX_PANEL_SCALE, safeValue));
};

const THREE_PHASE_BUSBAR_PREFIX = "three-phase-busbar";
const FREE_DIN_RAIL_PREFIX = "free-din-rail";

const makeThreePhaseBusbarId = () => `${THREE_PHASE_BUSBAR_PREFIX}:${Date.now()}`;
const isThreePhaseBusbarId = (value = "") => String(value || "").startsWith(`${THREE_PHASE_BUSBAR_PREFIX}:`);

const makeFreeDinRailId = () => `${FREE_DIN_RAIL_PREFIX}:${Date.now()}`;
const isFreeDinRailId = (value = "") => String(value || "").startsWith(`${FREE_DIN_RAIL_PREFIX}:`);

const makeCombBusbarId = (railId, groupIndex) => `${COMB_BUSBAR_PREFIX}:${railId}:${groupIndex}`;
const makeFreeCombBusbarId = () => `${FREE_COMB_BUSBAR_PREFIX}:${Date.now()}`;
const isFreeCombBusbarId = (value = "") => String(value || "").startsWith(`${FREE_COMB_BUSBAR_PREFIX}:`);
const isCombBusbarId = (value = "") => {
  const id = String(value || "");
  return id.startsWith(`${COMB_BUSBAR_PREFIX}:`) || id.startsWith(`${FREE_COMB_BUSBAR_PREFIX}:`);
};
const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(min, Math.min(max, safeValue));
};

const getRotationFromPoint = (point, center, snap = 1) => {
  if (!point || !center) return 0;
  const rawAngle = Math.atan2(point.y - center.y, point.x - center.x) * (180 / Math.PI) + 90;
  const normalized = ((rawAngle % 360) + 360) % 360;
  const step = Number.isFinite(Number(snap)) && Number(snap) > 0 ? Number(snap) : 1;
  return Math.round(normalized / step) * step;
};

const isCombToothVisible = (toothX, busX, busWidth) => {
  const width = Number(busWidth);
  if (!Number.isFinite(width) || width < MOD) return false;
  return toothX >= busX && toothX + COMB_TOOTH_WIDTH <= busX + width;
};

const THREE_PHASE_OUTPUT = {
  x: 54,
  y: 44,
  width: 214,
  height: 38,
  pinStartX: 82,
  pinY: 66,
  pinGap: 34,
};

const THREE_PHASE_TERMINALS = [
  { index: 0, label: "PE", kind: "ground", fill: "#16a34a" },
  { index: 4, label: "N", kind: "neutral", fill: "#38bdf8" },
  { index: 1, label: "L1", kind: "power", fill: "#111827" },
  { index: 2, label: "L2", kind: "power", fill: "#dc2626" },
  { index: 3, label: "L3", kind: "power", fill: "#7c2d12" },
];

// Paleta visual realista do quadro
const COLORS = {
  neutral: "#38bdf8",       // Azul claro (N)
  neutralLight: "#bae6fd",
  phaseA: "#111827",        // Preto (Fase)
  phaseB: "#dc2626",        // Vermelho (Fase)
  phaseC: "#7c2d12",        // Marrom (Fase)
  ground: "#16a34a",        // Verde
  groundYellow: "#eab308",  // Amarelo
  returnWire: "#eab308",    // Retorno simples
  parallel: "#9ca3af",      // Paralelo
  dpsRed: "#b91c1c",        // Vermelho DPS escuro
  dpsGreen: "#22c55e",      // DPS Status OK
  railMetal: ["#94a3b8", "#cbd5e1", "#475569"],
  yellowComb: "#fbbf24",    // Canaleta pente/passa-fios amarela
};

const WIRE_COLOR_OPTIONS = [
  { value: "black", label: "Preto (Fase L1)", hex: COLORS.phaseA },
  { value: "red", label: "Vermelho (Fase L2)", hex: COLORS.phaseB },
  { value: "brown", label: "Marrom (Fase L3)", hex: COLORS.phaseC },
  { value: "orange", label: "Laranja", hex: "#f97316" },
  { value: "blue", label: "Azul claro (Neutro N)", hex: COLORS.neutral },
  { value: "green", label: "Verde/Amarelo (Terra)", hex: COLORS.ground },
  { value: "yellow", label: "Amarelo (Retorno)", hex: COLORS.returnWire },
  { value: "gray", label: "Cinza (Paralelo)", hex: COLORS.parallel },
  { value: "white", label: "Branco", hex: "#f8fafc" },
  { value: "purple", label: "Roxo", hex: "#7c3aed" },
  { value: "pink", label: "Rosa", hex: "#db2777" },
];

const WIRE_COLOR_VALUES = WIRE_COLOR_OPTIONS.map((option) => option.value);
const WIRE_COLOR_HEX = WIRE_COLOR_OPTIONS.reduce((acc, option) => ({ ...acc, [option.value]: option.hex }), {});

const WIRE_THICKNESS_OPTIONS = [
  { value: "auto", label: "Automática" },
  { value: "1.2", label: "Muito fino" },
  { value: "1.6", label: "Fino" },
  { value: "2", label: "Médio" },
  { value: "2.6", label: "Reforçado" },
  { value: "3.2", label: "Grosso" },
  { value: "4", label: "Muito grosso" },
  { value: "5", label: "Extra grosso" },
];

const WIRE_HANDLE_HIT_RADIUS = 11;
const WIRE_ENDPOINT_HANDLE_RADIUS = { outer: 6, inner: 3.2, dot: 1.05 };
const WIRE_ROUTE_HANDLE_RADIUS = { outer: 5.8, inner: 3, dot: 1 };
const CABLE_MIN_SEGMENT_LENGTH = 4;
const CABLE_AXIS_EPSILON = 2;
const DEFAULT_CABLE_CORNER_RADIUS = 3;
const CABLE_LINE_STYLES = [
  { value: "solid", label: "Continuo" },
  { value: "dashed", label: "Tracejado" },
];
const CABLE_ROUTING_MODES = [
  { value: "automatic", label: "Automatico" },
  { value: "orthogonal", label: "Ortogonal" },
  { value: "manual", label: "Manual" },
];

const ANNOTATION_PRESETS = {
  observacao: {
    label: "Observação",
    text: "Observação: revisar identificação dos circuitos.",
    color: "#0f172a",
    background: "#ffffff",
    borderColor: "#cbd5e1",
    fontSize: 9,
    fontWeight: "800",
    width: 214,
  },
  tecnica: {
    label: "Nota técnica",
    text: "Nota técnica: conferir aperto dos bornes antes da energização.",
    color: "#064e3b",
    background: "#ecfdf5",
    borderColor: "#22c55e",
    fontSize: 8.5,
    fontWeight: "800",
    width: 228,
  },
  alerta: {
    label: "Alerta",
    text: "ATENÇÃO: validar seletividade e curva dos disjuntores.",
    color: "#9a3412",
    background: "#fff7ed",
    borderColor: "#fb923c",
    fontSize: 9,
    fontWeight: "900",
    width: 220,
  },
  revisao: {
    label: "Revisão",
    text: "Revisão: atualizar após conferência em campo.",
    color: "#00d8b8",
    background: "#eff6ff",
    borderColor: "#60a5fa",
    fontSize: 8.5,
    fontWeight: "800",
    width: 210,
  },
};

const isSolarProject = (project) => (
  project?.project_type === "Solar" || Boolean(project?.solar_config)
);

const parsePanelLayout = (layout, project = null, options = {}) => {
  if (layout && typeof layout === "object") {
    return {
      rails: Array.isArray(layout.rails) ? layout.rails : [],
      wires: Array.isArray(layout.wires) ? layout.wires : [],
      infrastructure: Array.isArray(layout.infrastructure) ? layout.infrastructure : [],
    };
  }

  if (layout && typeof layout === "string") {
    try {
      return parsePanelLayout(JSON.parse(layout), project, options);
    } catch {
      return generateDefaultPanelLayout(project, options);
    }
  }

  return generateDefaultPanelLayout(project, options);
};

const solarPhaseCount = (supply = "Bifásico") => (
  supply === "Trifásico" ? 3 : supply === "Monofásico" ? 1 : 2
);

const solarBreakerPoles = (supply = "Bifásico") => (
  supply === "Trifásico" ? 3 : 2
);

const SOLAR_REFERENCE_SUPPLY = "Trifásico";

const withSolarReserve = (components, id, label = "RESERVA TÉCNICA") => {
  const usedModules = components.reduce((sum, component) => sum + (Number(component.poles) || 0), 0);
  if (usedModules >= ROW_MAX) return components;
  return [
    ...components,
    { id, type: "spacer", poles: ROW_MAX - usedModules, label },
  ];
};

const normalizeSolarPanelLayout = (project, boardType, boardSupply, layout) => {
  if (!isSolarProject(project) || boardType !== "solar_ac") return {
    rails: Array.isArray(layout?.rails) ? layout.rails : [],
    wires: Array.isArray(layout?.wires) ? layout.wires : [],
    infrastructure: Array.isArray(layout?.infrastructure) ? layout.infrastructure : [],
  };

  const layoutMeta = getPanelLayoutMeta(layout);
  const deletedComponentIds = new Set((layoutMeta.deletedComponentIds || []).map(String));
  const deletedWireIds = new Set((layoutMeta.deletedWireIds || []).map(String));
  const supply = SOLAR_REFERENCE_SUPPLY;
  const phaseCount = solarPhaseCount(supply);
  const activeComponents = (layout?.rails || []).flatMap((rail) => (
    (rail.components || []).filter((component) => component.type !== "spacer")
  )).filter((component) => !deletedComponentIds.has(String(component.id || "")));
  const existingDps = activeComponents.filter((component) => component.type === "dps");
  const dpsComponents = Array.from({ length: phaseCount }, (_, index) => {
    const defaultId = `solar_dps_${index}`;
    if (deletedComponentIds.has(defaultId)) return null;
    const phase = String.fromCharCode(65 + index);
    const existing = existingDps[index] || {};
    return {
      ...existing,
      id: existing.id || defaultId,
      type: "dps",
      label: `DPS CA ${phase}`,
      poles: 1,
      phase,
      status: existing.status || "ON",
      dpsStatus: existing.dpsStatus || "OK",
    };
  }).filter(Boolean);
  const existingFeederBreaker = activeComponents.find((component) => (
    component.type === "breaker" &&
    (/solar_feeder_breaker/i.test(String(component.id || "")) || /alimentador|padr[aã]o/i.test(String(component.label || "")))
  ));
  const existingServiceBreaker = activeComponents.find((component) => (
    component.type === "breaker" &&
    (/solar_service_breaker/i.test(String(component.id || "")) || /sa[ií]da|seccionador|prote[cç][aã]o ca/i.test(String(component.label || "")))
  ));

  const solarCircuit = (project?.circuits || []).find((circuit) => (
    /inversor|solar fotovoltaico/i.test(`${circuit?.name || ""} ${circuit?.type || ""}`)
    && !/dps/i.test(`${circuit?.name || ""} ${circuit?.type || ""}`)
  ));
  const inverterBreaker = activeComponents.find((component) => (
    component.type === "breaker"
    && (/solar_main_breaker/i.test(String(component.id || "")) || /inversor/i.test(String(component.label || "")))
  )) || activeComponents.find((component) => (
    component.type === "breaker"
    && !component.isGeneral
    && !component.isSolarFeeder
    && !component.isSolarServiceDisconnect
    && !/alimentador|entrada|sa[ií]da|seccionador|prote[cç][aã]o ca/i.test(String(component.label || ""))
  )) || {
    id: "solar_main_breaker",
    type: "breaker",
    label: "DJ INVERSOR CA",
    current: Number(solarCircuit?.breaker_a) || 32,
    curve: solarCircuit?.breaker_curve || "C",
    poles: solarBreakerPoles(supply),
    isGeneral: true,
    phase: supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A",
    supply_type: supply,
    status: "ON",
  };
  const feederBreakerBase = existingFeederBreaker || {
    id: "solar_feeder_breaker",
    type: "breaker",
    label: "DJ ENTRADA CA",
    current: Number(solarCircuit?.breaker_a) || 32,
    curve: solarCircuit?.breaker_curve || "C",
    isSolarFeeder: true,
    status: "ON",
  };
  const feederBreaker = {
    ...feederBreakerBase,
    id: feederBreakerBase.id || "solar_feeder_breaker",
    type: "breaker",
    label: /entrada|alimentador/i.test(String(feederBreakerBase.label || "")) ? "DJ ENTRADA CA" : feederBreakerBase.label || "DJ ENTRADA CA",
    current: Number(feederBreakerBase.current || feederBreakerBase.breaker_a || solarCircuit?.breaker_a) || 32,
    curve: feederBreakerBase.curve || solarCircuit?.breaker_curve || "C",
    poles: solarBreakerPoles(supply),
    isSolarFeeder: true,
    phase: "ABC",
    supply_type: supply,
    status: feederBreakerBase.status || "ON",
  };
  const serviceBreakerBase = existingServiceBreaker || {
    id: "solar_service_breaker",
    type: "breaker",
    label: "DJ SAÍDA CA",
    current: Number(solarCircuit?.breaker_a) || 32,
    curve: solarCircuit?.breaker_curve || "C",
    status: "ON",
  };
  const serviceBreaker = {
    ...serviceBreakerBase,
    id: serviceBreakerBase.id || "solar_service_breaker",
    type: "breaker",
    label: "DJ SAÍDA CA",
    current: Number(serviceBreakerBase.current || serviceBreakerBase.breaker_a || solarCircuit?.breaker_a) || 32,
    curve: serviceBreakerBase.curve || solarCircuit?.breaker_curve || "C",
    poles: solarBreakerPoles(supply),
    isSolarServiceDisconnect: true,
    phase: "ABC",
    supply_type: supply,
    status: serviceBreakerBase.status || "ON",
  };
  const breaker = {
    ...inverterBreaker,
    id: inverterBreaker.id || "solar_main_breaker",
    type: "breaker",
    label: /inversor/i.test(String(inverterBreaker.label || "")) ? inverterBreaker.label : "DJ INVERSOR CA",
    isGeneral: false,
    current: Number(inverterBreaker.current || inverterBreaker.breaker_a || solarCircuit?.breaker_a) || 32,
    curve: inverterBreaker.curve || solarCircuit?.breaker_curve || "C",
    poles: solarBreakerPoles(supply),
    phase: "ABC",
    supply_type: supply,
    status: inverterBreaker.status || "ON",
  };
  const feederGauge = Number(breaker.current) > 63
    ? "16mm²"
    : Number(breaker.current) > 40
      ? "10mm²"
      : Number(breaker.current) > 25
        ? "6mm²"
        : "4mm²";
  const wires = [{
    id: "solar_ground_feed",
    color: "green",
    gauge: "10mm²",
    source: "terminal_left_top:0",
    target: "busbar_ground:0",
    label: "",
  }];

  dpsComponents.forEach((component, index) => {
    wires.push({
      id: `solar_dps_phase_${index}`,
      color: phaseWireColor(index),
      gauge: "6mm²",
      source: `terminal_left_top:${index + 1}`,
      target: `comp:${component.id}:top:0`,
      label: "",
    });
    wires.push({
      id: `solar_dps_ground_${index}`,
      color: "green",
      gauge: "6mm²",
      source: `comp:${component.id}:bottom:0`,
      target: `busbar_ground:${1 + index}`,
      label: "",
    });
  });

  if (supply === "Monofásico") {
    wires.push({
      id: "solar_neutral_feed",
      color: "blue",
      gauge: feederGauge,
      source: "busbar_neutral:11",
      target: `comp:${feederBreaker.id}:top:1`,
      label: "",
    });
    wires.push({
      id: "solar_neutral_feeder_to_inverter",
      color: "blue",
      gauge: feederGauge,
      source: `comp:${feederBreaker.id}:bottom:1`,
      target: `comp:${breaker.id}:top:1`,
      label: "",
    });
    wires.push({
      id: "solar_neutral_load",
      color: "blue",
      gauge: feederGauge,
      source: `comp:${breaker.id}:bottom:1`,
      target: "load_out:solar_inverter:neutral",
      label: "",
    });
  }

  for (let index = 0; index < phaseCount; index += 1) {
    wires.push({
      id: `solar_phase_feed_${index}`,
      color: phaseWireColor(index),
      gauge: feederGauge,
      source: `terminal_left_top:${index + 1}`,
      target: `comp:${feederBreaker.id}:top:${index}`,
      label: "",
    });
    wires.push({
      id: `solar_phase_feeder_to_service_${index}`,
      color: phaseWireColor(index),
      gauge: feederGauge,
      source: `comp:${feederBreaker.id}:bottom:${index}`,
      target: `comp:${serviceBreaker.id}:top:${index}`,
      label: "",
    });
    wires.push({
      id: `solar_phase_service_to_inverter_${index}`,
      color: phaseWireColor(index),
      gauge: feederGauge,
      source: `comp:${serviceBreaker.id}:bottom:${index}`,
      target: `comp:${breaker.id}:top:${index}`,
      label: "",
    });
    wires.push({
      id: `solar_phase_load_${index}`,
      color: phaseWireColor(index),
      gauge: feederGauge,
      source: `comp:${breaker.id}:bottom:${index}`,
      target: `load_out:solar_inverter:${index}`,
      label: "",
    });
  }

  const normalizedWires = wires.filter((wire) => (
    !deletedWireIds.has(String(wire.id || "")) &&
    ![wire.source, wire.target].some((pinId) => {
      const pin = String(pinId || "");
      return Array.from(deletedComponentIds).some((componentId) => pinReferencesComponent(pin, componentId));
    })
  ));

  return {
    rails: [
      {
        id: "rail_1",
        name: "Trilho DIN Superior (Entrada e Proteção CA)",
        components: withSolarReserve([feederBreaker, ...dpsComponents, serviceBreaker], "spacer_solar_protection"),
      },
      {
        id: "rail_2",
        name: "Trilho DIN Inferior (Disjuntor do Inversor)",
        components: withSolarReserve([breaker], "spacer_solar_inverter", "RESERVA"),
      },
    ],
    wires: normalizedWires,
    infrastructure: Array.isArray(layout?.infrastructure) ? layout.infrastructure : [],
  };
};

const createPanelBoard = (project, index = 1, layout = null) => {
  const isPrimarySolarBoard = isSolarProject(project) && index === 1;
  const type = isPrimarySolarBoard ? "solar_ac" : index === 1 ? "principal" : "secundario";
  const parsedLayout = parsePanelLayout(layout, project, { forceDistribution: type !== "solar_ac" });
  const supply = type === "solar_ac" ? SOLAR_REFERENCE_SUPPLY : project?.supply_type || "Monofásico";

  return {
    id: `board_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: isPrimarySolarBoard ? "QD Solar CA" : index === 1 ? "QD-01 Principal" : `QD-${String(index).padStart(2, "0")}`,
    location: isPrimarySolarBoard ? "Saída CA do inversor" : index === 1 ? "Entrada / Distribuição" : "Distribuição",
    type,
    supply_type: supply,
    layout: normalizeSolarPanelLayout(project, type, supply, parsedLayout),
  };
};

const normalizePanelBoards = (project) => {
  const rawBoards = project?.panel_boards;
  if (Array.isArray(rawBoards) && rawBoards.length > 0) {
    return rawBoards.map((board, index) => {
      const type = board.type || (isSolarProject(project) && index === 0 ? "solar_ac" : index === 0 ? "principal" : "secundario");
      const parsedLayout = parsePanelLayout(board.layout, project, { forceDistribution: type !== "solar_ac" });
      const supply = type === "solar_ac" ? SOLAR_REFERENCE_SUPPLY : board.supply_type || project?.supply_type || "Monofásico";
      return {
        id: board.id || `board_${index + 1}`,
        name: board.name || (type === "solar_ac" ? "QD Solar CA" : index === 0 ? "QD-01 Principal" : `QD-${String(index + 1).padStart(2, "0")}`),
        location: board.location || (type === "solar_ac" ? "Saída CA do inversor" : index === 0 ? "Entrada / Distribuição" : "Distribuição"),
        type,
        supply_type: supply,
        layout: normalizeSolarPanelLayout(project, type, supply, parsedLayout),
      };
    });
  }

  return [createPanelBoard(project, 1, project?.panel_layout)];
};

const getPrimaryCircuitBoard = (boards = []) => (
  boards.find((board) => !["qgbt", "solar_ac"].includes(String(board?.type || "").toLowerCase())) || null
);

const getDistributionBreakers = (layout = {}) => (
  (layout?.rails || [])
    .flatMap((rail) => rail.components || [])
    .filter((component) => (
      component.type === "breaker" &&
      !component.isGeneral &&
      !component.isQgbtFeeder &&
      !String(component.id || "").startsWith("qgbt_feed")
    ))
);

const PANEL_LAYOUT_META_ID = "__panel_layout_meta__";
const PROTECTED_COMPONENT_IDS = new Set(["gen_brk", "solar_feeder_breaker"]);

const getLayoutInfrastructure = (layoutOrInfrastructure = {}) => (
  Array.isArray(layoutOrInfrastructure)
    ? layoutOrInfrastructure
    : Array.isArray(layoutOrInfrastructure?.infrastructure)
      ? layoutOrInfrastructure.infrastructure
      : []
);

const getPanelLayoutMeta = (layoutOrInfrastructure = {}) => (
  getLayoutInfrastructure(layoutOrInfrastructure).find((item) => item?.id === PANEL_LAYOUT_META_ID) || {}
);

const uniqueStrings = (items = []) => Array.from(new Set(items.filter(Boolean).map(String)));

const upsertPanelLayoutMeta = (infrastructure = [], updates = {}) => {
  const currentMeta = getPanelLayoutMeta(infrastructure);
  const nextMeta = {
    ...currentMeta,
    ...updates,
    id: PANEL_LAYOUT_META_ID,
    type: "layout-meta",
    hidden: true,
    manualDeviceEdits: updates.manualDeviceEdits ?? currentMeta.manualDeviceEdits ?? true,
    deletedComponentIds: uniqueStrings([
      ...(currentMeta.deletedComponentIds || []),
      ...(updates.deletedComponentIds || []),
    ]),
    deletedCircuitRefs: uniqueStrings([
      ...(currentMeta.deletedCircuitRefs || []),
      ...(updates.deletedCircuitRefs || []),
    ]),
    deletedWireIds: uniqueStrings([
      ...(currentMeta.deletedWireIds || []),
      ...(updates.deletedWireIds || []),
    ]),
    updatedAt: new Date().toISOString(),
  };

  return [
    ...infrastructure.filter((item) => item?.id !== PANEL_LAYOUT_META_ID),
    nextMeta,
  ];
};

const circuitRefForSync = (circuit = {}, index = null) => String(
  circuit.id || circuit.circuit_id || circuit.source_point_id || (Number.isFinite(Number(index)) ? `circuit_${index}` : "")
);

const componentCircuitRefs = (component = {}) => uniqueStrings([
  component.circuit_id,
  component.source_point_id,
  component.source,
  component.id,
]);

const pinReferencesComponent = (pinId = "", componentId = "") => {
  const pin = String(pinId || "");
  const id = String(componentId || "");
  if (!pin || !id) return false;
  return pin.startsWith(`comp:${id}:`) || pin.startsWith(`load_out:${id}:`);
};

const wireReferencesComponent = (wire = {}, componentId = "") => (
  pinReferencesComponent(wire.source, componentId)
  || pinReferencesComponent(wire.target, componentId)
  || String(wire.componentId || wire.component_id || "") === String(componentId)
);

const infrastructureReferencesComponent = (item = {}, componentId = "") => (
  item?.id !== PANEL_LAYOUT_META_ID &&
  [
    item.componentId,
    item.component_id,
    item.componentRef,
    item.forComponentId,
    item.targetComponentId,
  ].filter(Boolean).some((value) => String(value) === String(componentId))
);

const isProtectedPanelComponent = (component = {}) => (
  !component
  || component.type === "spacer"
  || component.isGeneral
  || component.required
  || component.protected
  || component.locked
  || PROTECTED_COMPONENT_IDS.has(String(component.id || ""))
);

const isSolarCircuit = (circuit = {}) => (
  /solar|fotovoltaico|inversor|dps ca/i.test(`${circuit.id || ""} ${circuit.name || ""} ${circuit.type || ""}`)
);

const getDistributionCircuits = (circuits = []) => (
  circuits.filter((circuit) => !isSolarCircuit(circuit))
);

const panelLayoutNeedsCircuitSync = (project, boards, calculatedCircuits = null) => {
  const circuits = getDistributionCircuits(
    Array.isArray(calculatedCircuits)
      ? calculatedCircuits
      : calcProjectMetrics(project).circuits
  );
  if (circuits.length === 0) return false;

  const primaryBoard = getPrimaryCircuitBoard(boards);
  const layout = primaryBoard?.layout || project?.panel_layout || {};
  const layoutMeta = getPanelLayoutMeta(layout);
  if (layoutMeta.manualDeviceEdits) return false;

  const deletedCircuitRefs = new Set((layoutMeta.deletedCircuitRefs || []).map(String));
  const activeCircuits = circuits.filter((circuit, index) => !deletedCircuitRefs.has(circuitRefForSync(circuit, index)));
  const breakers = getDistributionBreakers(layout).filter((breaker) => (
    !componentCircuitRefs(breaker).some((ref) => deletedCircuitRefs.has(ref))
  ));
  if (breakers.length !== activeCircuits.length) return true;

  return activeCircuits.some((circuit, index) => {
    const breaker = breakers[index];
    const expectedRef = circuitRefForSync(circuit, index);
    const breakerRef = breaker.circuit_id || breaker.source_point_id;
    if (breakerRef && String(breakerRef) !== expectedRef) return true;

    return (
      Number(breaker.current || breaker.breaker_a || 0) !== Number(circuit.breaker_a || 16) ||
      Number(breaker.poles || 0) !== Number(circuit.breaker_poles || 1) ||
      String(breaker.curve || "B") !== String(circuit.breaker_curve || "B") ||
      String(breaker.phase || "A") !== String(circuit.phase || "A") ||
      String(breaker.supply_type || "Monofásico") !== String(circuit.supply_type || "Monofásico")
    );
  });
};

const getBoardUsedModules = (board) => (
  (board?.layout?.rails || []).reduce((total, rail) => (
    total + (rail.components || []).filter((component) => component.type !== "spacer").reduce((sum, component) => sum + (Number(component.poles) || 0), 0)
  ), 0)
);

const phaseTypeConfig = {
  "Monofásico": { poles: 1, phase: "A", label: "Monofásico - fase preta + neutro azul claro" },
  "Bifásico": { poles: 2, phase: "AB", label: "Bifásico - preto + vermelho" },
  "Trifásico": { poles: 3, phase: "ABC", label: "Trifásico - preto + vermelho + marrom" },
};

const phaseWireColor = (poleIndex = 0) => ["black", "red", "brown"][poleIndex] || "black";

const supplyTypeFromBreaker = (component = {}) => {
  if (component.supply_type) return component.supply_type;
  if (component.phase === "ABC" || Number(component.poles) >= 3) return "Trifásico";
  if (component.phase === "AB" || Number(component.poles) === 2) return "Bifásico";
  return "Monofásico";
};

const cleanDisplayText = (value = "") => String(value ?? "").replace(/\s+/g, " ").trim();

const isTechnicalDisplayText = (value = "") => {
  const text = cleanDisplayText(value);
  if (!text) return true;
  return /^(retorno|conex[aã]o|fase|sa[ií]da)$/i.test(text)
    || /^(circuit|circuit_group|breaker|busbar|load_out|comp|wire)[_: -]?\w*$/i.test(text);
};

const getCircuitNumber = (circuit = {}, index = null) => {
  const explicit = cleanDisplayText(
    circuit.circuitNumber
    ?? circuit.circuit_number
    ?? circuit.number
    ?? circuit.circuit_no
    ?? circuit.ref
    ?? "",
  );
  if (explicit) return explicit;
  if (Number.isFinite(Number(index))) return `C${Number(index) + 1}`;
  return "";
};

const getCircuitDisplayLabel = (circuit = {}, index = null) => {
  const customLabel = cleanDisplayText(circuit.label ?? circuit.circuit_label ?? "");
  if (customLabel && !isTechnicalDisplayText(customLabel)) return customLabel;

  const number = getCircuitNumber(circuit, index);
  const name = cleanDisplayText(circuit.name ?? circuit.circuit_name ?? circuit.description ?? "");
  if (number && name && !isTechnicalDisplayText(name)) return `${number} - ${name}`;
  if (name && !isTechnicalDisplayText(name)) return name;
  if (number) return number;
  return "Circuito sem identificação";
};

const getCircuitShortLabel = (circuit = {}, index = null) => {
  const number = getCircuitNumber(circuit, index);
  if (number) return number;
  const label = getCircuitDisplayLabel(circuit, index);
  return label === "Circuito sem identificação" ? "" : label;
};

const conductorTypeFromWire = (wire = {}) => {
  const text = `${wire.conductorType || ""} ${wire.source || ""} ${wire.target || ""} ${wire.color || ""}`.toLowerCase();
  if (text.includes("neutral") || text.includes("neutro") || text.includes("busbar_neutral") || text.includes("blue")) return "neutral";
  if (text.includes("ground") || text.includes("terra") || text.includes("busbar_ground") || text.includes("green")) return "ground";
  if (text.includes("return") || text.includes("retorno") || text.includes("yellow")) return "return";
  return "phase";
};

const getConductorDisplayLabel = (wire = {}) => {
  const type = conductorTypeFromWire(wire);
  if (type === "neutral") return "Neutro";
  if (type === "ground") return "Terra";
  if (type === "return") return "Retorno";
  const color = normalizedWireColor(wire);
  if (color === "red") return "Fase L2";
  if (color === "brown" || color === "orange") return "Fase L3";
  return "Fase L1";
};

const isTypingTarget = (target) => {
  if (!target) return false;
  const tagName = String(target.tagName || "").toLowerCase();
  return ["input", "textarea", "select"].includes(tagName)
    || Boolean(target.isContentEditable)
    || Boolean(target.closest?.("[contenteditable='true']"));
};

const cloneLayoutSnapshot = (snapshot = {}) => ({
  rails: JSON.parse(JSON.stringify(snapshot.rails || [])),
  wires: JSON.parse(JSON.stringify(snapshot.wires || [])),
  infrastructure: JSON.parse(JSON.stringify(snapshot.infrastructure || [])),
});

const layoutSnapshotsEqual = (a = {}, b = {}) => (
  JSON.stringify(a.rails || []) === JSON.stringify(b.rails || [])
  && JSON.stringify(a.wires || []) === JSON.stringify(b.wires || [])
  && JSON.stringify(a.infrastructure || []) === JSON.stringify(b.infrastructure || [])
);

const polePhaseLabel = (component = {}, poleIndex = 0) => {
  if (component.isGeneral) return `L${poleIndex + 1}`;
  if (component.phase === "ABC" || component.supply_type === "Trifásico") return ["A", "B", "C"][poleIndex] || "C";
  if (component.phase === "AB" || component.supply_type === "Bifásico") return ["A", "B"][poleIndex] || "B";
  return poleIndex === 0 ? "A" : "N";
};

const drPoleLabel = (component = {}, poleIndex = 0) => {
  const supply = component.supply_type || (component.phase === "AB" ? "Bifásico" : component.phase === "ABCN" ? "Trifásico" : "Monofásico");
  const lastPole = poleIndex === Number(component.poles || 0) - 1;
  if ((supply === "Monofásico" || supply === "Trifásico") && lastPole) return "N";
  return `L${poleIndex + 1}`;
};

const pinPoleIndex = (pinId = "") => {
  const match = String(pinId).match(/^comp:[^:]+:(?:top|bottom):(\d+)$/);
  return match ? Number(match[1]) : null;
};

const normalizedWireColor = (wire = {}) => {
  const id = String(wire.id || "").toLowerCase();
  const source = String(wire.source || "");
  const target = String(wire.target || "");
  const lowerTarget = target.toLowerCase();
  const explicitColor = String(wire.color || "").toLowerCase();

  if (WIRE_COLOR_VALUES.includes(explicitColor)) return explicitColor;

  if (
    id.includes("neutral") ||
    id.includes("_n_") ||
    source.startsWith("busbar_neutral:") ||
    target.startsWith("busbar_neutral:") ||
    lowerTarget.endsWith(":neutral")
  ) {
    return "blue";
  }

  if (
    id.includes("ground") ||
    id.includes("_g_") ||
    source.startsWith("busbar_ground:") ||
    target.startsWith("busbar_ground:") ||
    lowerTarget.endsWith(":ground")
  ) {
    return "green";
  }

  const idPhase = id.match(/(?:solar_dps_phase|solar_phase_feed|solar_phase_feeder_to_service|solar_phase_service_to_inverter|solar_phase_load|phase_feed|phase_to_dps|phase_gen_to_dr|qgbt_phase_to_dps)_(\d+)/);
  if (idPhase) return phaseWireColor(Number(idPhase[1]));

  const pole = pinPoleIndex(target) ?? pinPoleIndex(source);
  if (pole !== null && pole !== undefined) return phaseWireColor(pole);

  return phaseWireColor(0);
};

const getBoardGeneralBreaker = (board) => {
  const components = (board?.layout?.rails || []).flatMap((rail) => rail.components || []);
  const general = components.find((component) => component.type === "breaker" && component.isGeneral)
    || components.find((component) => component.type === "breaker");
  return {
    current: Number(general?.current || general?.breaker_a) || 32,
    poles: Number(general?.poles) || (board?.supply_type === "Trifásico" ? 3 : board?.supply_type === "Bifásico" ? 2 : 2),
    curve: general?.curve || "C",
    phase: general?.phase || (board?.supply_type === "Trifásico" ? "ABC" : board?.supply_type === "Bifásico" ? "AB" : "A"),
  };
};

const fillRailReserve = (components, railId) => {
  const usedPoles = components.reduce((sum, component) => sum + (Number(component.poles) || 0), 0);
  if (usedPoles >= ROW_MAX) return components;
  return [
    ...components,
    {
      id: `spacer_qgbt_${railId}`,
      type: "spacer",
      poles: ROW_MAX - usedPoles,
      label: "RESERVA TÉCNICA",
    },
  ];
};

const splitQgbtRails = (components) => {
  const rails = [];
  let current = [];
  let used = 0;

  components.forEach((component) => {
    const poles = Number(component.poles) || 1;
    if (current.length > 0 && used + poles > ROW_MAX) {
      rails.push(current);
      current = [];
      used = 0;
    }
    current.push(component);
    used += poles;
  });

  if (current.length > 0) rails.push(current);

  return rails.map((railComponents, index) => ({
    id: `rail_${index + 1}`,
    name: index === 0 ? "Trilho DIN Superior (QGBT)" : `Trilho DIN QGBT ${index + 1}`,
    components: fillRailReserve(railComponents, index + 1),
  }));
};

const buildQgbtLayout = (project, sourceBoards) => {
  const supply = project?.supply_type || "Trifásico";
  const dpsCount = supply === "Trifásico" ? 3 : supply === "Bifásico" ? 2 : 1;
  const dpsComponents = Array.from({ length: dpsCount }).map((_, index) => ({
    id: `qgbt_dps_${index}`,
    type: "dps",
    label: `DPS F${String.fromCharCode(65 + index)}`,
    poles: 1,
    phase: String.fromCharCode(65 + index),
    status: "ON",
    dpsStatus: "OK",
  }));

  const feederComponents = sourceBoards.map((board, index) => {
    const breaker = getBoardGeneralBreaker(board);
    const boardName = board.name || `QD-${String(index + 1).padStart(2, "0")}`;
    return {
      id: `qgbt_feed_${board.id || index}`,
      type: "breaker",
      label: boardName,
      current: breaker.current,
      curve: breaker.curve,
      poles: breaker.poles,
      phase: breaker.phase,
      status: "ON",
      isQgbtFeeder: true,
      sourceBoardId: board.id,
      sourceBoardName: boardName,
    };
  });

  const rails = splitQgbtRails([...dpsComponents, ...feederComponents]);
  const wires = [
    {
      id: "qgbt_ground_feed",
      color: "green",
      gauge: "10mm²",
      source: "terminal_left_top:0",
      target: "busbar_ground:0",
      label: "10 mm²",
    },
  ];

  dpsComponents.forEach((dps, index) => {
    wires.push({
      id: `qgbt_phase_to_dps_${index}`,
      color: "red",
      gauge: "6mm²",
      source: "terminal_left_top:1",
      target: `comp:${dps.id}:top:0`,
      label: "6 mm²",
    });
    wires.push({
      id: `qgbt_dps_ground_${index}`,
      color: "green",
      gauge: "6mm²",
      source: `comp:${dps.id}:bottom:0`,
      target: `busbar_ground:${index + 2}`,
      label: "6 mm²",
    });
  });

  feederComponents.forEach((feeder, feederIndex) => {
    const board = sourceBoards[feederIndex];
    const boardSupply = board?.supply_type || project?.supply_type || "Monofásico";
    Array.from({ length: feeder.poles }).forEach((_, poleIndex) => {
      const isMonophaseNeutral = boardSupply === "Monofásico" && poleIndex === feeder.poles - 1;
      const wireColor = isMonophaseNeutral ? "blue" : phaseWireColor(poleIndex);
      const gauge = feeder.current >= 63 ? "16mm²" : feeder.current >= 40 ? "10mm²" : "6mm²";
      const label = feeder.current >= 63 ? "16 mm²" : feeder.current >= 40 ? "10 mm²" : "6 mm²";
      wires.push({
        id: `qgbt_feed_in_${feederIndex}_${poleIndex}`,
        color: wireColor,
        gauge,
        source: isMonophaseNeutral ? "busbar_neutral:0" : "terminal_left_top:1",
        target: `comp:${feeder.id}:top:${poleIndex}`,
        label,
      });
      wires.push({
        id: `qgbt_feed_out_${feederIndex}_${poleIndex}`,
        color: wireColor,
        gauge,
        source: `comp:${feeder.id}:bottom:${poleIndex}`,
        target: `load_out:${feeder.id}:${isMonophaseNeutral ? "neutral" : poleIndex}`,
        label,
      });
    });
  });

  return { rails, wires, infrastructure: Array.isArray(project?.panel_layout?.infrastructure) ? project.panel_layout.infrastructure : [] };
};

const buildQgbtBoard = (project, boards) => {
  const sourceBoards = boards.filter((board) => board.type !== "qgbt");
  const layout = buildQgbtLayout(project, sourceBoards);

  return {
    id: `qgbt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: "QGBT - Quadro Geral",
    location: "Entrada geral",
    type: "qgbt",
    supply_type: project?.supply_type || "Trifásico",
    source_board_count: sourceBoards.length,
    feeder_breaker_count: sourceBoards.length,
    layout,
  };
};

// ─── FUNÇÃO DE ROTA DE FIOS COM CANTOS ARREDONDADOS (ALGORITMO BEZIER) ───────────
function getRoundedPath(points, radius = 16) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    const d1x = prev.x - curr.x;
    const d1y = prev.y - curr.y;
    const len1 = Math.hypot(d1x, d1y);
    
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;
    const len2 = Math.hypot(d2x, d2y);
    
    const r = Math.min(radius, len1 / 2, len2 / 2);
    
    if (r <= 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }
    
    const pStart = {
      x: curr.x + (d1x / len1) * r,
      y: curr.y + (d1y / len1) * r
    };
    
    const pEnd = {
      x: curr.x + (d2x / len2) * r,
      y: curr.y + (d2y / len2) * r
    };
    
    d += ` L ${pStart.x} ${pStart.y} Q ${curr.x} ${curr.y} ${pEnd.x} ${pEnd.y}`;
  }
  
  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

const WIRE_GRID = 8;
const VIRTUAL_DUCTS = {
  topY: 112,
  leftX: 96,
  rightX: PANEL_W - 118,
  neutralX: PANEL_W - 128,
  groundX: 74,
  railTopOffset: -82,
  railBottomOffset: 88,
};

const PROFESSIONAL_BUS = {
  neutralTopY: 48,
  neutralLeftX: 34,
  neutralColumnX: PANEL_W - 128,
  neutralBranchStub: 36,
  groundLeftX: 74,
  groundRightPadding: 46,
  branchRadius: 3,
};

const NEUTRAL_BUS = {
  x: PANEL_W - 455,
  y: 62,
  width: 286,
  height: 18,
  pinCount: 12,
  pinGap: 22,
  pinStartX: PANEL_W - 435,
  pinY: 71,
};

const GROUND_BUS = {
  x: 240,
  width: 390,
  pinCount: 12,
  pinGap: 30,
  pinStartX: 262,
};

const getNeutralBusLayout = (infrastructure = []) => {
  const item = (infrastructure || []).find((entry) => entry?.id === "neutral-bus") || {};
  const width = Math.max(180, Math.min(520, Number(item.width) || NEUTRAL_BUS.width));
  const rawX = Number(item.x);
  const rawY = Number(item.y);
  const x = Math.max(20, Math.min(PANEL_W - width - 20, Number.isFinite(rawX) ? rawX : NEUTRAL_BUS.x));
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

const getGroundBusLayout = (infrastructure = [], panelH = 820) => {
  const item = (infrastructure || []).find((entry) => entry?.id === "ground-bus") || {};
  const width = Math.max(260, Math.min(520, Number(item.width) || GROUND_BUS.width));
  const rawX = Number(item.x ?? item.busX);
  const rawY = Number(item.y);
  const x = Math.max(20, Math.min(PANEL_W - width - 20, Number.isFinite(rawX) ? rawX : GROUND_BUS.x));
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

const getThreePhaseOutputPin = (terminalIndex = 0) => {
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

const SHOW_WIRE_GAUGE_TAGS = false;

const snapWireGrid = (value) => Math.round(Number(value || 0) / WIRE_GRID) * WIRE_GRID;

const clampWireThickness = (value) => Math.max(0.85, Math.min(7, value));

const getExplicitWireThickness = (wire = {}) => {
  const customThickness = Number(wire.visual_thickness ?? wire.thickness ?? wire.stroke_width);
  if (Number.isFinite(customThickness) && customThickness > 0) {
    return customThickness;
  }

  return null;
};

const getWireThickness = (wire = {}) => {
  const explicitThickness = getExplicitWireThickness(wire);
  if (explicitThickness !== null) {
    return clampWireThickness(explicitThickness);
  }

  const gaugeValue = Number(String(wire.gauge || "").replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0]);
  if (Number.isFinite(gaugeValue)) {
    if (gaugeValue >= 16) return 5.4;
    if (gaugeValue >= 10) return 4.6;
    if (gaugeValue >= 6) return 3.7;
    if (gaugeValue >= 4) return 3.0;
    if (gaugeValue >= 2.5) return 2.2;
    if (gaugeValue >= 1.5) return 1.6;
  }

  return 1.4;
};

const getEffectiveWireThickness = (wire = {}, fallback = 1.4) => {
  if (getExplicitWireThickness(wire) !== null || wire.gauge) {
    return getWireThickness(wire);
  }

  return clampWireThickness(Number(fallback) || 1.4);
};

const isNeutralBusPin = (pinId = "") => String(pinId || "").startsWith("busbar_neutral:");
const isGroundBusPin = (pinId = "") => String(pinId || "").startsWith("busbar_ground:");

const getWireKind = (color) => {
  if (color === "blue") return "neutral";
  if (color === "green") return "ground";
  return "power";
};

const getWireCorridor = (color, p1, p2) => {
  if (color === "green") return "left-ground";
  if (color === "blue") return "right-neutral";
  if (p1.x > PANEL_W - 170 || p2.x > PANEL_W - 170) return "right-power";
  return ((p1.x + p2.x) / 2 < PANEL_W / 2) ? "left-power" : "right-power";
};

const getNeutralBackboneX = () => VIRTUAL_DUCTS.neutralX;
const getNeutralBackboneTopY = () => PROFESSIONAL_BUS.neutralTopY;
const getGroundBackboneY = (panelH) => panelH - 92;
const getGroundBackboneLeftX = () => VIRTUAL_DUCTS.groundX;

const componentMatchesLoadTarget = (compId = "", component = {}) => {
  const loadId = String(compId || "").toLowerCase();
  const componentId = String(component?.id || "").toLowerCase();
  const label = String(component?.label || "");

  if (componentId === loadId) return true;

  if (["solar_inverter", "inverter"].includes(loadId)) {
    return componentId === "solar_main_breaker" || /inversor/i.test(label);
  }

  return false;
};

const findLoadComponentPlacement = (compId = "", rails = []) => {
  for (let railIndex = 0; railIndex < rails.length; railIndex += 1) {
    const rail = rails[railIndex];
    const railY = 190 + railIndex * 240;
    let currentX = 160;

    for (const component of rail.components || []) {
      const componentWidth = Number(component.poles || 1) * MOD;
      if (componentMatchesLoadTarget(compId, component)) {
        return {
          component,
          railIndex,
          railY,
          x: currentX,
          width: componentWidth,
        };
      }
      currentX += componentWidth + 2;
    }
  }

  return null;
};

const getFallbackLoadPoint = (poleToken = "0", rails = [], panelH = 620) => {
  const railIndex = Math.max(0, (rails?.length || 1) - 1);
  const railY = 190 + railIndex * 240;
  const outputLane = Math.min(panelH - 118, snapWireGrid(railY + 132));

  if (poleToken === "neutral") {
    return {
      x: getNeutralBackboneX() - PROFESSIONAL_BUS.neutralBranchStub,
      y: outputLane,
    };
  }

  if (poleToken === "ground") {
    return {
      x: PANEL_W - 94,
      y: getGroundBackboneY(panelH) - 22,
    };
  }

  return {
    x: PANEL_W - 94,
    y: outputLane,
  };
};

const toCablePoint = (point = {}, type = "control", index = 0) => {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    ...point,
    id: point.id || `${type}_${index}_${Math.round(x)}_${Math.round(y)}`,
    type: point.type || type,
    x: Math.round(x),
    y: Math.round(y),
  };
};

const areSameCablePoint = (a, b, tolerance = 0) => (
  Boolean(a && b)
  && Math.abs(Number(a.x) - Number(b.x)) <= tolerance
  && Math.abs(Number(a.y) - Number(b.y)) <= tolerance
);

const isCollinearCablePoint = (prev, point, next, tolerance = CABLE_AXIS_EPSILON) => {
  if (!prev || !point || !next) return false;
  const sameX = Math.abs(prev.x - point.x) <= tolerance && Math.abs(point.x - next.x) <= tolerance;
  const sameY = Math.abs(prev.y - point.y) <= tolerance && Math.abs(point.y - next.y) <= tolerance;
  return sameX || sameY;
};

const normalizeCablePoints = (points = [], options = {}) => {
  const source = Array.isArray(points) ? points : [];
  const minSegmentLength = Number.isFinite(options.minSegmentLength)
    ? options.minSegmentLength
    : CABLE_MIN_SEGMENT_LENGTH;
  const axisEpsilon = Number.isFinite(options.axisEpsilon)
    ? options.axisEpsilon
    : CABLE_AXIS_EPSILON;
  const collapseCollinear = options.collapseCollinear !== false;
  const normalized = [];

  source.forEach((rawPoint, index) => {
    const defaultType = index === 0
      ? "source"
      : index === source.length - 1
        ? "target"
        : "control";
    const point = toCablePoint(rawPoint, defaultType, index);
    if (!point) return;

    const previous = normalized[normalized.length - 1];
    if (previous) {
      if (Math.abs(point.x - previous.x) <= axisEpsilon) point.x = previous.x;
      if (Math.abs(point.y - previous.y) <= axisEpsilon) point.y = previous.y;

      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      if (distance <= minSegmentLength || areSameCablePoint(point, previous)) {
        if (index === source.length - 1) {
          normalized[normalized.length - 1] = {
            ...previous,
            ...point,
            type: point.type || previous.type,
          };
        }
        return;
      }
    }

    normalized.push(point);
  });

  if (!collapseCollinear || normalized.length < 3) return normalized;

  return normalized.reduce((acc, point, index, list) => {
    if (index === 0 || index === list.length - 1) {
      acc.push(point);
      return acc;
    }
    const prev = acc[acc.length - 1];
    const next = list[index + 1];
    if (!isCollinearCablePoint(prev, point, next)) acc.push(point);
    return acc;
  }, []);
};

const cleanRoutePoints = (points = []) => (
  normalizeCablePoints(points, { minSegmentLength: 0, collapseCollinear: false })
);

const getCableControlPoints = (wire = {}) => {
  const points = Array.isArray(wire.points) ? wire.points : [];
  if (!points.length) return [];
  const controls = points.filter((point) => point?.type === "control");
  return controls.length ? controls : points.slice(1, -1);
};

const normalizeWireRoutePoints = (points = []) => (
  normalizeCablePoints(points, { collapseCollinear: false })
    .map((point) => ({ x: point.x, y: point.y }))
);

const getCableRoutingMode = (wire = {}, routePoints = []) => {
  const rawMode = String(wire.routingMode || wire.routeMode || "").toLowerCase();
  if (CABLE_ROUTING_MODES.some((option) => option.value === rawMode)) return rawMode;
  return routePoints.length ? "manual" : "automatic";
};

const getCableLineStyle = (wire = {}) => (
  wire.lineStyle === "dashed" ? "dashed" : "solid"
);

const getCableCornerRadius = (wire = {}, fallback = DEFAULT_CABLE_CORNER_RADIUS) => (
  clampNumber(wire.cornerRadius, 0, 24, fallback)
);

const isCableVisible = (wire = {}) => wire.visible !== false;
const isCableLocked = (wire = {}) => Boolean(wire.locked);

const getCableComponentId = (pinId = "") => {
  const parts = String(pinId || "").split(":");
  if (parts[0] === "comp") return parts[1] || "";
  if (parts[0]?.startsWith("backbone")) return parts[0];
  if (parts[0]?.startsWith("terminal")) return parts[0];
  if (parts[0]?.startsWith("load_out")) return parts[1] || parts[0];
  return "";
};

const buildCablePointList = (fullRoutePoints = [], existingPoints = []) => (
  normalizeCablePoints(fullRoutePoints, { minSegmentLength: 0, collapseCollinear: false })
    .map((point, index, list) => {
      const type = index === 0 ? "source" : index === list.length - 1 ? "target" : "control";
      const previousPoint = existingPoints[index] || {};
      return {
        id: previousPoint.id || point.id || `${type}_${index}_${point.x}_${point.y}`,
        x: point.x,
        y: point.y,
        type,
      };
    })
);

const wrapAnnotationText = (value = "", maxChars = 34, maxLines = 5) => {
  const explicitLines = String(value || "").split(/\n/);
  const lines = [];

  explicitLines.forEach((rawLine) => {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    words.forEach((word) => {
      if (lines.length === 0 || lines[lines.length - 1] === undefined) {
        lines.push(word);
        return;
      }
      const current = lines[lines.length - 1] || "";
      const next = current ? `${current} ${word}` : word;
      if (!current || next.length <= maxChars) {
        lines[lines.length - 1] = next;
      } else {
        lines.push(word);
      }
    });
  });

  if (lines.length <= maxLines) return lines;
  return [
    ...lines.slice(0, maxLines - 1),
    `${lines[maxLines - 1].slice(0, Math.max(0, maxChars - 1))}...`,
  ];
};

const getWireRouteBends = (wire = {}) => {
  const directRoute = Array.isArray(wire.route_points)
    ? wire.route_points
    : wire.routePoints || wire.customRoute;
  const controlPoints = getCableControlPoints(wire);
  return normalizeWireRoutePoints(directRoute?.length ? directRoute : controlPoints);
};

const getEditableWireRoutePoints = (wire = {}, routePoints = []) => {
  const fallback = normalizeCablePoints(routePoints || []);
  const bends = getWireRouteBends(wire);
  const routingMode = getCableRoutingMode(wire, bends);
  if (!bends.length || fallback.length < 2) return fallback;

  const editablePoints = normalizeCablePoints([
    fallback[0],
    ...bends,
    fallback[fallback.length - 1],
  ]);

  if (routingMode !== "orthogonal") return editablePoints;

  return normalizeCablePoints(editablePoints.map((point, index, list) => {
    if (index === 0 || index === list.length - 1) return point;
    const prev = list[index - 1];
    const next = list[index + 1];
    if (Math.abs(point.x - prev.x) <= Math.abs(point.y - prev.y)) {
      return { ...point, x: prev.x };
    }
    if (Math.abs(point.y - next.y) <= Math.abs(point.x - next.x)) {
      return { ...point, y: next.y };
    }
    return point;
  }));
};

const getRouteMidpoint = (routePoints = []) => {
  const cleanPoints = cleanRoutePoints(routePoints);
  if (cleanPoints.length < 2) return null;

  const segments = [];
  let total = 0;
  for (let index = 1; index < cleanPoints.length; index += 1) {
    const start = cleanPoints[index - 1];
    const end = cleanPoints[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    total += length;
  }

  let covered = 0;
  const half = total / 2;
  for (const segment of segments) {
    if (covered + segment.length >= half) {
      const ratio = segment.length === 0 ? 0 : (half - covered) / segment.length;
      return {
        x: snapWireGrid(segment.start.x + (segment.end.x - segment.start.x) * ratio),
        y: snapWireGrid(segment.start.y + (segment.end.y - segment.start.y) * ratio),
      };
    }
    covered += segment.length;
  }

  const last = cleanPoints[cleanPoints.length - 1];
  return { x: snapWireGrid(last.x), y: snapWireGrid(last.y) };
};

const getRailDuctY = (railIndex, side = "top", laneOffset = 0) => {
  const railY = 190 + Math.max(0, Number(railIndex) || 0) * 240;
  const baseOffset = side === "bottom" ? VIRTUAL_DUCTS.railBottomOffset : VIRTUAL_DUCTS.railTopOffset;
  return snapWireGrid(railY + baseOffset + laneOffset);
};

const parsePinMeta = (pinId = "", point = { x: 0, y: 0 }, rails = []) => {
  const pin = String(pinId || "");

  if (pin.startsWith("terminal_left_top:")) {
    return { type: "incoming", term: "top", railIndex: -1, railY: null, point };
  }

  if (isNeutralBusPin(pin)) {
    return { type: "neutral-bus", term: "bus", railIndex: -1, railY: null, point };
  }

  if (isGroundBusPin(pin)) {
    return { type: "ground-bus", term: "bus", railIndex: rails.length, railY: null, point };
  }

  if (pin.startsWith("load_out:")) {
    const [, compId, poleToken = "0"] = pin.split(":");
    const placement = findLoadComponentPlacement(compId, rails);
    if (placement) {
      return {
        type: "load",
        term: poleToken === "neutral" ? "neutral" : poleToken === "ground" ? "ground" : "bottom",
        railIndex: placement.railIndex,
        railY: placement.railY,
        point,
      };
    }
    return {
      type: "load",
      term: poleToken === "neutral" ? "neutral" : poleToken === "ground" ? "ground" : "bottom",
      railIndex: Math.max(0, rails.length - 1),
      railY: null,
      point,
    };
  }

  if (pin.startsWith("comp:")) {
    const [, compId, term = "top", poleToken = "0"] = pin.split(":");
    for (let railIndex = 0; railIndex < rails.length; railIndex += 1) {
      const rail = rails[railIndex];
      const found = (rail.components || []).some((component) => component.id === compId);
      if (found) {
        return {
          type: "component",
          term,
          poleIndex: Number(poleToken) || 0,
          railIndex,
          railY: 190 + railIndex * 240,
          point,
        };
      }
    }
  }

  return { type: "unknown", term: "top", railIndex: 0, railY: null, point };
};

const getBusbarBranchEndpoints = (descriptor) => {
  const { kind, wire, p1, p2, sourceMeta, targetMeta } = descriptor;
  const source = String(wire.source || "");
  const target = String(wire.target || "");
  const sourceIsBus = kind === "neutral" ? isNeutralBusPin(source) : isGroundBusPin(source);
  const targetIsBus = kind === "neutral" ? isNeutralBusPin(target) : isGroundBusPin(target);

  if (sourceIsBus && !targetIsBus) return [{ point: p2, pin: target, meta: targetMeta }];
  if (targetIsBus && !sourceIsBus) return [{ point: p1, pin: source, meta: sourceMeta }];
  if (!sourceIsBus && !targetIsBus) {
    return [
      { point: p1, pin: source, meta: sourceMeta },
      { point: p2, pin: target, meta: targetMeta },
    ];
  }
  return [];
};

const getNeutralBusPoint = (descriptor = {}) => {
  const source = String(descriptor.wire?.source || "");
  const target = String(descriptor.wire?.target || "");
  if (isNeutralBusPin(source)) return descriptor.p1;
  if (isNeutralBusPin(target)) return descriptor.p2;
  return null;
};

const getNeutralBackboneRoute = (panelH, bottomY = panelH - 120) => {
  const startX = PROFESSIONAL_BUS.neutralLeftX;
  return cleanRoutePoints([
    { x: startX, y: getNeutralBackboneTopY() },
    { x: getNeutralBackboneX(), y: getNeutralBackboneTopY() },
    { x: getNeutralBackboneX(), y: bottomY },
  ]);
};

const getNeutralBusTieRoute = (infrastructure = []) => {
  const neutralBus = getNeutralBusLayout(infrastructure);
  const tieX = neutralBus.pinStartX;
  return cleanRoutePoints([
    { x: tieX, y: getNeutralBackboneTopY() },
    { x: tieX, y: neutralBus.pinY },
  ]);
};

const getGroundBackboneRoute = (panelH, infrastructure = []) => {
  const groundBus = getGroundBusLayout(infrastructure, panelH);
  return cleanRoutePoints([
    { x: 73, y: 78 },
    { x: getGroundBackboneLeftX(), y: 78 },
    { x: getGroundBackboneLeftX(), y: getGroundBackboneY(panelH) },
    { x: groundBus.x + groundBus.width - 18, y: getGroundBackboneY(panelH) },
  ]);
};

const getGroundBusTieRoute = (panelH, infrastructure = []) => {
  const groundBus = getGroundBusLayout(infrastructure, panelH);
  const tieX = groundBus.x + groundBus.width - 18;
  return cleanRoutePoints([
    { x: tieX, y: getGroundBackboneY(panelH) },
    { x: tieX, y: groundBus.pinY },
  ]);
};

const getDescriptorCircuitIndex = (descriptor = {}) => {
  const raw = `${descriptor.wire?.source || ""}:${descriptor.wire?.target || ""}`;
  const match = raw.match(/circuit_(\d+)/i);
  if (match) return Number(match[1]);
  return Number.MAX_SAFE_INTEGER;
};

const hasLoadEndpoint = (descriptor = {}) => (
  descriptor.sourceMeta?.type === "load" || descriptor.targetMeta?.type === "load"
);

const getLoadEndpoint = (descriptor = {}) => {
  if (descriptor.sourceMeta?.type === "load") return { point: descriptor.p1, pin: descriptor.wire?.source || "" };
  if (descriptor.targetMeta?.type === "load") return { point: descriptor.p2, pin: descriptor.wire?.target || "" };
  return null;
};

const isTerminalFeedWire = (descriptor = {}) => (
  String(descriptor.wire?.source || "").startsWith("terminal_left_top:")
  || String(descriptor.wire?.target || "").startsWith("terminal_left_top:")
);

const isSolarIncomingPhaseWire = (descriptor = {}) => (
  descriptor.kind === "power"
  && isTerminalFeedWire(descriptor)
  && /^solar_(phase_feed|dps_phase)_/i.test(String(descriptor.wire?.id || ""))
  && (descriptor.sourceMeta?.type === "component" || descriptor.targetMeta?.type === "component")
);

const isDistributionInputWire = (descriptor = {}) => (
  descriptor.kind === "power"
  && descriptor.targetMeta?.type === "component"
  && descriptor.targetMeta?.term === "top"
  && descriptor.sourceMeta?.type === "component"
  && descriptor.sourceMeta?.term === "bottom"
  && /comp:circuit_/i.test(String(descriptor.wire?.target || ""))
);

const isSolarProtectionDistributionWire = (descriptor = {}) => (
  descriptor.kind === "power"
  && descriptor.sourceMeta?.type === "component"
  && descriptor.sourceMeta?.term === "bottom"
  && descriptor.targetMeta?.type === "component"
  && descriptor.targetMeta?.term === "top"
  && /^solar_phase_feeder_to_service_/i.test(String(descriptor.wire?.id || ""))
);

const isSolarServiceToInverterWire = (descriptor = {}) => (
  descriptor.kind === "power"
  && descriptor.sourceMeta?.type === "component"
  && descriptor.sourceMeta?.term === "bottom"
  && descriptor.targetMeta?.type === "component"
  && descriptor.targetMeta?.term === "top"
  && /^solar_phase_service_to_inverter_/i.test(String(descriptor.wire?.id || ""))
);

const isPowerLoadOutputWire = (descriptor = {}) => (
  descriptor.kind === "power" && hasLoadEndpoint(descriptor)
);

const PHASE_LANE_SPACING = 22;

const phaseLaneOffset = (color = "") => {
  if (color === "black") return -PHASE_LANE_SPACING;
  if (color === "red") return 0;
  if (color === "brown" || color === "orange") return PHASE_LANE_SPACING;
  return 0;
};

const referenceFeedLaneY = (descriptor = {}) => {
  if (descriptor.kind === "ground") return 70;
  if (descriptor.kind === "neutral") return 92;
  if (descriptor.color === "red") return 114;
  if (descriptor.color === "brown" || descriptor.color === "orange") return 138;
  return 90;
};

const compareCircuitDescriptors = (a, b) => (
  getDescriptorCircuitIndex(a) - getDescriptorCircuitIndex(b)
  || a.p1.x - b.p1.x
  || a.p2.x - b.p2.x
  || String(a.wire?.id || "").localeCompare(String(b.wire?.id || ""))
);

// ─── LOCALIZADOR DE COORDENADAS DE PINO DE CONEXÃO ─────────────────────────────
const getPinCoords = (pinId, rails, panelH, infrastructure = []) => {
  if (!pinId) return { x: 0, y: 0 };

  if (pinId.startsWith("loose:")) {
    const parts = pinId.split(":");
    return {
      x: Number(parts[1]) || 0,
      y: Number(parts[2]) || 0,
    };
  }
  
  if (pinId.startsWith("busbar_neutral:")) {
    const idx = parseInt(pinId.split(":")[1], 10);
    const neutralBus = getNeutralBusLayout(infrastructure);
    return {
      x: neutralBus.pinStartX + (Math.abs(Number(idx) || 0) % NEUTRAL_BUS.pinCount) * neutralBus.pinGap,
      y: neutralBus.pinY,
    };
  }
  
  if (pinId === "backbone_ground:start") return { x: getGroundBackboneLeftX(), y: 78 };
  if (pinId === "backbone_ground:end") {
    const groundBus = getGroundBusLayout(infrastructure, panelH);
    return { x: groundBus.x + groundBus.width - 18, y: groundBus.pinY };
  }

  if (pinId.startsWith("busbar_ground:")) {
    const idx = parseInt(pinId.split(":")[1], 10);
    const groundBus = getGroundBusLayout(infrastructure, panelH);
    return {
      x: groundBus.pinStartX + (Math.abs(Number(idx) || 0) % GROUND_BUS.pinCount) * groundBus.pinGap,
      y: groundBus.pinY,
    };
  }
  
  if (pinId.startsWith("terminal_left_top:")) {
    return getThreePhaseOutputPin(parseInt(pinId.split(":")[1], 10), infrastructure);
  }

  if (pinId.startsWith("load_out:")) {
    const parts = pinId.split(":");
    const compId = parts[1];
    const poleToken = parts[2] || "0";
    const poleIdx = poleToken === "neutral" ? 3 : poleToken === "ground" ? 4 : parseInt(poleToken || "0", 10);
    const circuitMatch = String(compId || "").match(/circuit_(\d+)/i);
    const outputIndex = circuitMatch ? Number(circuitMatch[1]) : 0;

    for (let rIdx = 0; rIdx < rails.length; rIdx++) {
      const rail = rails[rIdx];
      const railY = 190 + rIdx * 240;
      let currentX = 160;

      for (const comp of rail.components || []) {
        const compW = comp.poles * MOD;
        if (componentMatchesLoadTarget(compId, comp)) {
          const terminalPole = Number.isFinite(poleIdx) ? Math.max(0, Math.min(Number(poleIdx) || 0, comp.poles - 1)) : 0;
          const terminalX = currentX + terminalPole * MOD + MOD / 2;

          if (poleToken === "neutral") {
            return {
              x: terminalX,
              y: snapWireGrid(railY + 136 + (outputIndex % 4) * 6),
            };
          }

          if (poleToken === "ground") {
            const baseX = PANEL_W - 140; // Direita do barramento (combed layout default invertido)
            const baseY = panelH - 240; // Inicia mais alto para empilhar para baixo
            return {
              x: baseX,
              y: snapWireGrid(baseY + outputIndex * 16),
            };
          }

          return {
            x: terminalX,
            y: snapWireGrid(railY + 132 + (terminalPole % 2) * 8),
          };
        }
        currentX += compW + 2;
      }
    }

    return getFallbackLoadPoint(poleToken, rails, panelH);
  }
  
  if (pinId.startsWith("comp:")) {
    const parts = pinId.split(":");
    const compId = parts[1];
    const termType = parts[2]; // "top" | "bottom"
    const poleIdx = parseInt(parts[3] || "0", 10);
    
    for (let rIdx = 0; rIdx < rails.length; rIdx++) {
      const rail = rails[rIdx];
      const railY = 190 + rIdx * 240;
      let currentX = 160;
      
      for (const comp of rail.components) {
        const compW = comp.poles * MOD;
        if (comp.id === compId) {
          const x = currentX + poleIdx * MOD + MOD / 2;
          const y = termType === "top" ? railY - 37 : railY + 57;
          return { x, y };
        }
        currentX += compW + 2;
      }
    }
  }
  
  return { x: 0, y: 0 };
};

export default function PanelGenerator() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("project") || "");
  const [project, setProject] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [panelBoards, setPanelBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState("");
  const [scale, setScale] = useState(null);
  const [fitScale, setFitScale] = useState(0.85);
  const [showLegend, setShowLegend] = useState(true);
  const [legendPosition, setLegendPosition] = useState(() => ({ x: PANEL_W - 230, y: 38 }));
  const [legendDrag, setLegendDrag] = useState(null);
  
  // ESTADOS DO EDITOR INTERATIVO
  const [rails, setRails] = useState([]);
  const [wires, setWires] = useState([]);
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [activeTab, setActiveTab] = useState("components"); // components | wiring | settings
  
  // WIRING INTERATIVO
  const [wiringMode, setWiringMode] = useState(false);
  const [wiringStart, setWiringStart] = useState("");
  const [selectedWireId, setSelectedWireId] = useState("");
  const [wireName, setWireName] = useState("");
  const [wireDisplayText, setWireDisplayText] = useState("");
  const [wireColor, setWireColor] = useState("black");
  const [wireGauge, setWireGauge] = useState("2.5mm²");
  const [wireMoveMode, setWireMoveMode] = useState(""); // "" | "source" | "target"
  const [hoveredWireId, setHoveredWireId] = useState("");
  const [wireEndpointDrag, setWireEndpointDrag] = useState(null); // { wireId, endpoint }
  const [endpointDragCoords, setEndpointDragCoords] = useState(null); // { x, y } - live cursor position during endpoint drag
  const [wireRoutePointDrag, setWireRoutePointDrag] = useState(null); // { wireId, index }
  const [wireSegmentDrag, setWireSegmentDrag] = useState(null); // { wireId, segmentIndex, startPoint, startPoints }
  const [infraResizeDrag, setInfraResizeDrag] = useState(null); // { infraId, edge, startPoint, startItem }
  const [selectedTextWireId, setSelectedTextWireId] = useState("");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState("");
  const [selectedRoutePoint, setSelectedRoutePoint] = useState(null);
  const [annotationPreset, setAnnotationPreset] = useState("observacao");
  const [newAnnotationText, setNewAnnotationText] = useState(ANNOTATION_PRESETS.observacao.text);
  const [textDrag, setTextDrag] = useState(null);
  const [rotationDrag, setRotationDrag] = useState(null);
  const [hoveredPinId, setHoveredPinId] = useState("");
  const [componentDrag, setComponentDrag] = useState(null); // { componentId, startX, startY, active, x, y }
  const [hoveredItem, setHoveredItem] = useState(null);
  
  // ADD COMPONENT FORM
  const [newCompType, setNewCompType] = useState("breaker");
  const [newCompLabel, setNewCompLabel] = useState("DISJUNTOR C1");
  const [newCompCurrent, setNewCompCurrent] = useState("16");
  const [newCompCurve, setNewCompCurve] = useState("B");
  const [newCompPoles, setNewCompPoles] = useState(1);
  const [newCompPhase, setNewCompPhase] = useState("A");
  const [newCompSupplyType, setNewCompSupplyType] = useState("Monofásico");
  const [newCompRail, setNewCompRail] = useState("rail_2");

  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const panelViewportRef = useRef(null);
  const activeBoard = panelBoards.find((board) => board.id === activeBoardId) || panelBoards[0];
  const activeSupplyType = activeBoard?.type === "solar_ac"
    ? SOLAR_REFERENCE_SUPPLY
    : activeBoard?.supply_type || project?.supply_type || "Monofásico";
  const isSolarReferenceBoard = activeBoard?.type === "solar_ac";
  const visibleWires = useMemo(() => {
    const allWires = [...wires];
    const backbones = [
      { id: "ground-main", name: "Aterramento Principal", color: "green", gauge: "16mm²" },
      { id: "ground-bus-tie", name: "Interligação PE", color: "green", gauge: "10mm²" }
    ];
    for (const bb of backbones) {
      if (!allWires.some(w => w.id === bb.id)) {
        allWires.push({
          id: bb.id,
          name: bb.name,
          color: bb.color,
          gauge: bb.gauge,
          source: `backbone_${bb.id.split("-")[0]}:start`,
          target: `backbone_${bb.id.split("-")[0]}:end`,
        });
      }
    }
    return allWires.filter((w) => !w.deleted && isCableVisible(w) && !w.visual_only && w.source && w.target && !w.id.includes("-ground-") && !w.id.includes("-neutral-"));
  }, [wires]);
  const qgbtSourceCount = panelBoards.filter((board) => board.type !== "qgbt").length;

  const [infrastructure, setInfrastructure] = useState([]);
  const [selectedInfrastructureId, setSelectedInfrastructureId] = useState("");
  const wirePathsRef = useRef({});
  const wireRouteMetaRef = useRef({});
  const layoutHistoryRef = useRef([]);
  const layoutRedoRef = useRef([]);
  const pendingEditHistoryRef = useRef(null);
  const restoringLayoutRef = useRef(false);
  const textAnnotations = useMemo(
    () => infrastructure.filter((item) => item?.type === "annotation" && !item.deleted),
    [infrastructure]
  );
  const circuitLookup = useMemo(() => {
    const map = new Map();
    (project?.circuits || []).forEach((circuit, index) => {
      const enriched = {
        ...circuit,
        circuitNumber: getCircuitNumber(circuit, index),
        label: circuit.label || getCircuitDisplayLabel(circuit, index),
        __index: index,
      };
      [
        circuit.id,
        circuit.circuit_id,
        circuit.source_point_id,
        circuit.source,
        `circuit_${index}`,
        `circuit_${index + 1}`,
      ].filter(Boolean).forEach((key) => map.set(String(key), enriched));
    });
    return map;
  }, [project?.circuits]);

  const findComponentById = useCallback((componentId) => {
    for (const rail of rails) {
      const found = (rail.components || []).find((component) => component.id === componentId);
      if (found) return found;
    }
    return null;
  }, [rails]);

  const getComponentCircuit = useCallback((component = {}) => {
    if (!component) return null;
    const keys = [
      component.circuit_id,
      component.source_point_id,
      component.source,
      component.id,
    ].filter(Boolean).map(String);
    const fromLookup = keys.map((key) => circuitLookup.get(key)).find(Boolean);
    if (fromLookup) return fromLookup;
    if (component.type === "breaker" && !component.isGeneral) {
      return {
        id: component.circuit_id || component.id,
        name: component.name || component.circuitName || component.label,
        circuitNumber: component.circuitNumber,
        label: component.circuitLabel || component.label,
        description: component.description || "",
        phase: component.phase,
        conductorSection: component.conductorSection || component.wire_gauge,
      };
    }
    return null;
  }, [circuitLookup]);

  const getComponentDisplayLabel = useCallback((component = {}) => {
    const circuit = getComponentCircuit(component);
    if (circuit) return getCircuitDisplayLabel(circuit, circuit.__index);
    const label = cleanDisplayText(component.label || component.name || "");
    return label || "Dispositivo sem identificação";
  }, [getComponentCircuit]);

  const getWireCircuit = useCallback((wire = {}) => {
    const directKeys = [
      wire.circuit_id,
      wire.source_point_id,
      wire.circuitId,
    ].filter(Boolean).map(String);
    const direct = directKeys.map((key) => circuitLookup.get(key)).find(Boolean);
    if (direct) return direct;

    const pins = [wire.source, wire.target].map((pin) => String(pin || ""));
    for (const pin of pins) {
      const [, componentId = ""] = pin.match(/(?:comp|load_out):([^:]+)/) || [];
      if (!componentId) continue;
      const component = findComponentById(componentId);
      const circuit = getComponentCircuit(component || { id: componentId });
      if (circuit) return circuit;
    }

    if (wire.circuitLabel || wire.circuitName || wire.circuitNumber) {
      return {
        id: wire.circuit_id || wire.id,
        name: wire.circuitName,
        circuitNumber: wire.circuitNumber,
        label: wire.circuitLabel,
      };
    }
    return null;
  }, [circuitLookup, findComponentById, getComponentCircuit]);

  const describePin = useCallback((pinId = "") => {
    const pin = String(pinId || "");
    if (!pin) return "Sem conexão";
    if (pin.startsWith("terminal_left_top:")) {
      const index = Number(pin.split(":")[1]);
      const terminal = THREE_PHASE_TERMINALS.find((item) => Number(item.index) === index);
      return terminal ? `Entrada ${terminal.label}` : "Entrada";
    }
    if (pin.startsWith("busbar_neutral:")) return "Barramento N";
    if (pin.startsWith("busbar_ground:")) return "Barramento PE";
    if (pin.startsWith("backbone_ground:")) return "Barramento PE";
    if (pin.startsWith("backbone_neutral:")) return "Barramento N";
    if (pin.startsWith("loose:")) return "Ponto livre";
    if (pin.startsWith("comp:")) {
      const [, componentId = "", side = "", pole = ""] = pin.split(":");
      const component = findComponentById(componentId);
      const componentLabel = component ? getComponentDisplayLabel(component) : componentId;
      return `${componentLabel} ${side === "top" ? "entrada" : "saída"} ${pole !== "" ? `P${Number(pole) + 1}` : ""}`.trim();
    }
    if (pin.startsWith("load_out:")) {
      const [, componentId = "", pole = ""] = pin.split(":");
      const component = findComponentById(componentId);
      const componentLabel = component ? getComponentDisplayLabel(component) : componentId;
      if (pole === "neutral") return `Neutro — ${componentLabel}`;
      if (pole === "ground") return `Terra — ${componentLabel}`;
      return `Carga — ${componentLabel}`;
    }
    return pin.replace(/_/g, " ");
  }, [findComponentById, getComponentDisplayLabel]);

  const getWireDisplayInfo = useCallback((wire = {}) => {
    const circuit = getWireCircuit(wire);
    const conductor = getConductorDisplayLabel(wire);
    const circuitLabel = circuit ? getCircuitDisplayLabel(circuit, circuit.__index) : "";
    const explicitName = cleanDisplayText(wire.name || "");
    const explicitLabel = cleanDisplayText(wire.label || "");
    const main = explicitName && !isTechnicalDisplayText(explicitName)
      ? explicitName
      : circuitLabel || (explicitLabel && !/^\d+(\,\d+|\.\d+)?\s*mm/i.test(explicitLabel) ? explicitLabel : "") || `${conductor} — conexão`;
    const gauge = cleanDisplayText(wire.gauge || wire.section || wire.conductorSection || explicitLabel);
    return {
      main,
      subtitle: [conductor, gauge].filter(Boolean).join(" • "),
      origin: describePin(wire.source),
      destination: describePin(wire.target),
      circuit,
      conductor,
    };
  }, [describePin, getWireCircuit]);

  const clearWireSelection = useCallback(({ exitWiringMode = true } = {}) => {
    setSelectedWireId("");
    setSelectedTextWireId("");
    setSelectedComponentId("");
    setSelectedInfrastructureId("");
    setSelectedAnnotationId("");
    setWireMoveMode("");
    setWireEndpointDrag(null);
    setEndpointDragCoords(null);
    setWireRoutePointDrag(null);
    setSelectedRoutePoint(null);
    setComponentDrag(null);
    setTextDrag(null);
    setLegendDrag(null);
    setHoveredPinId("");
    setHoveredWireId("");
    setWiringStart("");
    if (exitWiringMode) setWiringMode(false);
  }, []);

  // Carregar projetos
  useEffect(() => {
    backend.entities.Project.list().then(setProjects);
  }, []);

  // Carregar projeto selecionado e decodificar layout do banco local
  useEffect(() => {
    if (!selectedId) {
      setProject(null);
      setMetrics(null);
      setPanelBoards([]);
      setActiveBoardId("");
      setRails([]);
      setWires([]);
      setInfrastructure([]);
      return;
    }
    
    backend.entities.Project.get(selectedId).then(p => {
      const calculatedMetrics = calcProjectMetrics(p);
      const distributionCircuits = getDistributionCircuits(calculatedMetrics.circuits);
      let projectForPanel = { ...p, circuits: calculatedMetrics.circuits };
      let boards = normalizePanelBoards(projectForPanel);
      let shouldPersistPanelSync = false;

      if (panelLayoutNeedsCircuitSync(projectForPanel, boards, calculatedMetrics.circuits)) {
        const syncedLayout = generateDefaultPanelLayout({ ...projectForPanel, circuits: distributionCircuits }, { forceDistribution: true });
        boards = buildPanelBoardsWithLayout({ ...projectForPanel, circuits: distributionCircuits, panel_boards: boards }, syncedLayout);
        projectForPanel = {
          ...projectForPanel,
          panel_boards: boards,
          panel_layout: getPrimaryCircuitBoard(boards)?.layout || syncedLayout,
        };
        shouldPersistPanelSync = true;
      }

      setMetrics(calculatedMetrics);

      const preferredDistributionBoard = distributionCircuits.length > 0 ? getPrimaryCircuitBoard(boards) : null;
      const nextActiveId = shouldPersistPanelSync && preferredDistributionBoard
        ? preferredDistributionBoard.id
        : boards.some((board) => board.id === activeBoardId)
          ? activeBoardId
          : preferredDistributionBoard?.id || boards[0]?.id;
      const activeBoard = boards.find((board) => board.id === nextActiveId) || boards[0];
      const primaryLayout = getPrimaryCircuitBoard(boards)?.layout || activeBoard?.layout || { rails: [], wires: [], infrastructure: [] };
      const normalizedProject = isSolarProject(projectForPanel)
        ? { ...projectForPanel, panel_boards: boards, panel_layout: activeBoard?.layout || { rails: [], wires: [], infrastructure: [] } }
        : { ...projectForPanel, panel_boards: boards, panel_layout: primaryLayout };
      setProject(normalizedProject);
      setPanelBoards(boards);
      setActiveBoardId(activeBoard?.id || "");
      setRails(activeBoard?.layout?.rails || []);
      setWires(activeBoard?.layout?.wires || []);
      setInfrastructure(activeBoard?.layout?.infrastructure || []);

      const shouldPersistSolarLayout = isSolarProject(projectForPanel) && (
        JSON.stringify(p.panel_boards || []) !== JSON.stringify(boards)
        || JSON.stringify(p.panel_layout || {}) !== JSON.stringify(activeBoard?.layout || {})
      );

      if (shouldPersistPanelSync || shouldPersistSolarLayout) {
        const payload = shouldPersistPanelSync
          ? {
              circuits: calculatedMetrics.circuits,
              panel_boards: boards,
              panel_layout: primaryLayout,
              diagram_layout: null,
            }
          : {
              panel_boards: boards,
              panel_layout: activeBoard?.layout || { rails: [], wires: [], infrastructure: [] },
            };
        backend.entities.Project.update(selectedId, payload).catch((error) => console.error("Erro ao normalizar quadro:", error));
      }
    });
  }, [selectedId]);

  useEffect(() => {
    if (rails.length === 0 || rails.some((rail) => rail.id === newCompRail)) return;
    setNewCompRail(rails[0].id);
  }, [newCompRail, rails]);

  const persistPanelBoards = async (nextBoards, activeId = activeBoardId) => {
    if (!selectedId) return;
    const activeBoard = nextBoards.find((board) => board.id === activeId) || nextBoards[0];
    const activeLayout = activeBoard?.layout || { rails: [], wires: [], infrastructure: [] };
    setPanelBoards(nextBoards);
    setProject((current) => current ? { ...current, panel_boards: nextBoards, panel_layout: activeLayout } : current);
    try {
      await backend.entities.Project.update(selectedId, {
        panel_boards: nextBoards,
        panel_layout: activeLayout,
      });
    } catch (err) {
      console.error("Erro ao salvar quadros:", err);
    }
  };

  const makeLayoutSnapshot = (layout = {}) => cloneLayoutSnapshot({
    rails: layout.rails ?? rails,
    wires: layout.wires ?? wires,
    infrastructure: layout.infrastructure ?? infrastructure,
  });

  const pushLayoutHistory = (snapshot) => {
    if (!snapshot) return;
    const currentStack = layoutHistoryRef.current;
    const last = currentStack[currentStack.length - 1];
    if (last && layoutSnapshotsEqual(last, snapshot)) return;
    layoutHistoryRef.current = [...currentStack.slice(-49), cloneLayoutSnapshot(snapshot)];
  };

  const captureEditHistoryStart = (key) => {
    if (!key) return;
    const pending = pendingEditHistoryRef.current;
    if (pending?.key === key) return;
    pendingEditHistoryRef.current = { key, snapshot: makeLayoutSnapshot() };
  };

  const commitEditHistory = (key) => {
    const pending = pendingEditHistoryRef.current;
    if (!pending || (key && pending.key !== key)) return;
    const current = makeLayoutSnapshot();
    if (!layoutSnapshotsEqual(pending.snapshot, current)) {
      pushLayoutHistory(pending.snapshot);
      layoutRedoRef.current = [];
    }
    pendingEditHistoryRef.current = null;
  };

  // Salvar automaticamente no banco de dados local ao alterar trilhos/fiação
  const saveLayoutToDb = async (updatedRails, updatedWires, updatedInfra = infrastructure, options = {}) => {
    if (!selectedId) return;
    const layoutObj = { rails: updatedRails, wires: updatedWires, infrastructure: updatedInfra };
    if (options.history !== false && !restoringLayoutRef.current) {
      const before = makeLayoutSnapshot();
      const after = makeLayoutSnapshot(layoutObj);
      if (!layoutSnapshotsEqual(before, after)) {
        pushLayoutHistory(before);
        layoutRedoRef.current = [];
      }
    }
    const currentBoards = panelBoards.length > 0 ? panelBoards : normalizePanelBoards(project);
    const nextBoards = currentBoards.map((board) => (
      board.id === activeBoardId ? { ...board, layout: layoutObj } : board
    ));
    await persistPanelBoards(nextBoards, activeBoardId);
  };

  const restoreLayoutSnapshot = (snapshot) => {
    if (!snapshot) return;
    const restored = cloneLayoutSnapshot(snapshot);
    restoringLayoutRef.current = true;
    setRails(restored.rails);
    setWires(restored.wires);
    setInfrastructure(restored.infrastructure);
    clearWireSelection();
    Promise.resolve(saveLayoutToDb(restored.rails, restored.wires, restored.infrastructure, { history: false }))
      .finally(() => {
        restoringLayoutRef.current = false;
      });
  };

  const undoLayout = () => {
    const previous = layoutHistoryRef.current.pop();
    if (!previous) return false;
    layoutRedoRef.current = [...layoutRedoRef.current.slice(-49), makeLayoutSnapshot()];
    restoreLayoutSnapshot(previous);
    return true;
  };

  const redoLayout = () => {
    const next = layoutRedoRef.current.pop();
    if (!next) return false;
    pushLayoutHistory(makeLayoutSnapshot());
    restoreLayoutSnapshot(next);
    return true;
  };

  const normalizeRailsLayout = (currentRails) => {
    let normalized = currentRails.map(r => ({
      ...r,
      // Remove spacers so we can redistribute active components cleanly
      components: (r.components || []).filter(c => c.type !== "spacer")
    }));

    for (let i = 0; i < normalized.length; i++) {
      const rail = normalized[i];
      let currentPoles = 0;
      const fitComponents = [];
      const overflowComponents = [];

      for (const comp of rail.components) {
        if (currentPoles + comp.poles <= ROW_MAX) {
          fitComponents.push(comp);
          currentPoles += comp.poles;
        } else {
          overflowComponents.push(comp);
        }
      }

      normalized[i].components = fitComponents;

      if (overflowComponents.length > 0) {
        if (i + 1 < normalized.length) {
          // Push overflow components to the start of the next rail
          normalized[i + 1].components = [...overflowComponents, ...normalized[i + 1].components];
        } else {
          // Create a new rail dynamically at the bottom
          normalized.push({
            id: `rail_${normalized.length + 1}`,
            name: `Trilho DIN T${normalized.length + 1} (Expansão)`,
            components: overflowComponents
          });
        }
      }
    }

    // Add technical reserve spacers to fill each rail up to ROW_MAX.
    // Components may carry dinPosition/startDin, which lets the editor keep
    // intentional empty DIN slots when the user drops an item anywhere on a rail.
    normalized = normalized.map(r => {
      const activeComponents = [...(r.components || [])].sort((a, b) => {
        const aPos = Number(a.dinPosition ?? a.startDin ?? a.slot);
        const bPos = Number(b.dinPosition ?? b.startDin ?? b.slot);
        const aHasPosition = Number.isFinite(aPos);
        const bHasPosition = Number.isFinite(bPos);
        if (aHasPosition && bHasPosition && aPos !== bPos) return aPos - bPos;
        if (aHasPosition !== bHasPosition) return aHasPosition ? -1 : 1;
        return (r.components || []).indexOf(a) - (r.components || []).indexOf(b);
      });

      let nextDinPosition = 1;
      const positionedComponents = [];
      const addSpacer = (start, size) => {
        if (size <= 0) return;
        positionedComponents.push({
          id: `spacer_auto_${r.id}_${start}`,
          type: "spacer",
          poles: size,
          label: "RESERVA TÉCNICA",
          railId: r.id,
          dinPosition: start,
          startDin: start,
          slot: start,
          moduleWidth: size,
          dinSize: size,
        });
      };

      activeComponents.forEach((component, index) => {
        const dinSize = Math.max(1, Number(component.poles) || 1);
        const remainingDinSize = activeComponents
          .slice(index)
          .reduce((sum, item) => sum + Math.max(1, Number(item.poles) || 1), 0);
        const maxStartForRemaining = Math.max(nextDinPosition, ROW_MAX - remainingDinSize + 1);
        const rawPosition = Number(component.dinPosition ?? component.startDin ?? component.slot);
        const wantedPosition = Number.isFinite(rawPosition)
          ? clampNumber(Math.round(rawPosition), 1, maxStartForRemaining, nextDinPosition)
          : nextDinPosition;
        const startPosition = Math.max(nextDinPosition, wantedPosition);

        addSpacer(nextDinPosition, startPosition - nextDinPosition);

        const positioned = {
          ...component,
          railId: r.id,
          dinPosition: startPosition,
          startDin: startPosition,
          slot: startPosition,
          moduleWidth: dinSize,
          dinSize,
          poles: dinSize,
        };
        positionedComponents.push(positioned);
        nextDinPosition = startPosition + dinSize;
      });

      addSpacer(nextDinPosition, ROW_MAX - nextDinPosition + 1);
      return { ...r, components: positionedComponents };
    });

    return normalized;
  };

  const updateRails = (newRails, options = {}) => {
    const normalized = normalizeRailsLayout(newRails);
    setRails(normalized);
    saveLayoutToDb(normalized, wires, infrastructure, options);
  };

  const updateWires = (newWires, options = {}) => {
    setWires(newWires);
    saveLayoutToDb(rails, newWires, infrastructure, options);
  };

  const handleSelectBoard = (boardId) => {
    if (boardId === activeBoardId) return;
    const currentLayout = { rails, wires, infrastructure };
    const nextBoards = panelBoards.map((board) => (
      board.id === activeBoardId ? { ...board, layout: currentLayout } : board
    ));
    const nextBoard = nextBoards.find((board) => board.id === boardId);
    if (!nextBoard) return;
    setPanelBoards(nextBoards);
    setActiveBoardId(boardId);
    setRails(nextBoard.layout?.rails || []);
    setWires(nextBoard.layout?.wires || []);
    setInfrastructure(nextBoard.layout?.infrastructure || []);
    setSelectedComponentId("");
    setSelectedWireId("");
    setSelectedInfrastructureId("");
    setSelectedAnnotationId("");
    setSelectedTextWireId("");
    persistPanelBoards(nextBoards, boardId);
  };

  const handleAddBoard = () => {
    if (!project) return;
    const currentLayout = { rails, wires, infrastructure };
    const savedBoards = panelBoards.map((board) => (
      board.id === activeBoardId ? { ...board, layout: currentLayout } : board
    ));
    const emptyLayout = { rails: [{ id: "rail_1", name: "Trilho DIN 1", components: [] }], wires: [], infrastructure: [] };
    const nextBoard = createPanelBoard(project, savedBoards.filter((board) => board.type !== "qgbt").length + 1, emptyLayout);
    const nextBoards = [...savedBoards, nextBoard];
    setPanelBoards(nextBoards);
    setActiveBoardId(nextBoard.id);
    setRails(nextBoard.layout.rails || []);
    setWires(nextBoard.layout.wires || []);
    setInfrastructure(nextBoard.layout.infrastructure || []);
    setSelectedComponentId("");
    setSelectedWireId("");
    setSelectedInfrastructureId("");
    setSelectedAnnotationId("");
    setSelectedTextWireId("");
    persistPanelBoards(nextBoards, nextBoard.id);
  };

  const handleGenerateQgbt = () => {
    if (!project || panelBoards.length === 0) return;
    const currentLayout = { rails, wires, infrastructure };
    const savedBoards = panelBoards.map((board) => (
      board.id === activeBoardId ? { ...board, layout: currentLayout } : board
    ));
    const qgbtBoard = buildQgbtBoard(project, savedBoards);
    const nextBoards = [
      qgbtBoard,
      ...savedBoards.filter((board) => board.type !== "qgbt"),
    ];
    setPanelBoards(nextBoards);
    setActiveBoardId(qgbtBoard.id);
    setRails(qgbtBoard.layout.rails || []);
    setWires(qgbtBoard.layout.wires || []);
    setInfrastructure(qgbtBoard.layout.infrastructure || []);
    setSelectedComponentId("");
    setSelectedWireId("");
    setSelectedInfrastructureId("");
    setSelectedAnnotationId("");
    setSelectedTextWireId("");
    persistPanelBoards(nextBoards, qgbtBoard.id);
  };

  const handleDeleteActiveBoard = () => {
    if (panelBoards.length <= 1) return;
    const activeBoard = panelBoards.find((board) => board.id === activeBoardId);
    if (!window.confirm(`Excluir o quadro "${activeBoard?.name || "selecionado"}"?`)) return;
    const nextBoards = panelBoards.filter((board) => board.id !== activeBoardId);
    const nextBoard = nextBoards[0];
    setPanelBoards(nextBoards);
    setActiveBoardId(nextBoard.id);
    setRails(nextBoard.layout?.rails || []);
    setWires(nextBoard.layout?.wires || []);
    setInfrastructure(nextBoard.layout?.infrastructure || []);
    setSelectedComponentId("");
    setSelectedWireId("");
    setSelectedInfrastructureId("");
    setSelectedAnnotationId("");
    setSelectedTextWireId("");
    persistPanelBoards(nextBoards, nextBoard.id);
  };

  const handleUpdateActiveBoard = (field, value) => {
    const nextBoards = panelBoards.map((board) => (
      board.id === activeBoardId ? { ...board, [field]: value } : board
    ));
    setPanelBoards(nextBoards);
    setProject((current) => current ? { ...current, panel_boards: nextBoards } : current);
    persistPanelBoards(nextBoards, activeBoardId);
  };

  const handleUpdateBoardSupply = (value) => {
    if (!project || !activeBoard) return;
    const nextSupply = activeBoard.type === "solar_ac" ? SOLAR_REFERENCE_SUPPLY : value;
    const rawLayout = generateDefaultPanelLayout(
      { ...project, supply_type: nextSupply },
      { forceDistribution: activeBoard?.type !== "solar_ac" }
    );
    const regenerated = normalizeSolarPanelLayout(
      { ...project, supply_type: nextSupply },
      activeBoard?.type,
      nextSupply,
      { ...rawLayout, infrastructure }
    );
    const nextBoards = panelBoards.map((board) => (
      board.id === activeBoardId
        ? { ...board, supply_type: nextSupply, layout: regenerated }
        : board
    ));
    setPanelBoards(nextBoards);
    setRails(regenerated.rails || []);
    setWires(regenerated.wires || []);
    setInfrastructure(regenerated.infrastructure || []);
    setSelectedComponentId("");
    setSelectedWireId("");
    setProject((current) => current ? { ...current, panel_boards: nextBoards } : current);
    persistPanelBoards(nextBoards, activeBoardId);
  };

  // Redimensionamento do canvas
  const panelHeight = 180 + rails.length * 240 + 100;
  const routedWires = useMemo(() => {
    const descriptors = visibleWires.map((wire, originalIndex) => {
      const p1 = getPinCoords(wire.source, rails, panelHeight, infrastructure);
      const p2 = getPinCoords(wire.target, rails, panelHeight, infrastructure);
      const color = normalizedWireColor(wire);
      const kind = getWireKind(color);
      const sourceMeta = parsePinMeta(wire.source, p1, rails);
      const targetMeta = parsePinMeta(wire.target, p2, rails);
      return {
        wire,
        originalIndex,
        p1,
        p2,
        color,
        kind,
        sourceMeta,
        targetMeta,
        thickness: getWireThickness(wire),
        corridor: getWireCorridor(color, p1, p2),
        routing: null,
      };
    });
    return descriptors.sort((a, b) => a.originalIndex - b.originalIndex);
  }, [infrastructure, panelHeight, rails, visibleWires]);

  const connectionPins = useMemo(() => {
    const pins = [];
    const addPin = (pin) => {
      if (!pin?.id || !Number.isFinite(pin.x) || !Number.isFinite(pin.y)) return;
      pins.push(pin);
    };

    THREE_PHASE_TERMINALS.forEach((terminal) => {
      const id = `terminal_left_top:${terminal.index}`;
      const point = getPinCoords(id, rails, panelHeight, infrastructure);
      addPin({ id, ...point, label: terminal.label, kind: terminal.kind, group: "Entrada" });
    });

    Array.from({ length: NEUTRAL_BUS.pinCount }).forEach((_, index) => {
      const id = `busbar_neutral:${index}`;
      const point = getPinCoords(id, rails, panelHeight, infrastructure);
      addPin({ id, ...point, label: `N${index + 1}`, kind: "neutral", group: "Barramento N" });
    });

    Array.from({ length: GROUND_BUS.pinCount }).forEach((_, index) => {
      const id = `busbar_ground:${index}`;
      const point = getPinCoords(id, rails, panelHeight, infrastructure);
      addPin({ id, ...point, label: `PE${index + 1}`, kind: "ground", group: "Barramento PE" });
    });

    const loadPinIds = new Set();
    visibleWires.forEach((wire) => {
      [wire.source, wire.target].forEach((pinId) => {
        if (String(pinId || "").startsWith("load_out:")) loadPinIds.add(pinId);
      });
    });
    loadPinIds.forEach((id) => {
      const point = getPinCoords(id, rails, panelHeight, infrastructure);
      const parts = String(id).split(":");
      const pole = parts[2] || "0";
      const kind = pole === "neutral" ? "neutral" : pole === "ground" ? "ground" : normalizedWireColor({ id, color: "" });
      addPin({
        id,
        ...point,
        label: pole === "neutral" ? "Saida N" : pole === "ground" ? "Saida PE" : `Saida ${Number(pole) + 1 || pole}`,
        kind,
        group: "Saida",
      });
    });

    rails.forEach((rail, railIndex) => {
      const railY = 190 + railIndex * 240;
      let currentX = 160;
      (rail.components || []).forEach((component) => {
        const poles = Number(component.poles || 1);
        const width = poles * MOD;
        if (component.type !== "spacer") {
          Array.from({ length: poles }).forEach((_, poleIndex) => {
            const x = currentX + poleIndex * MOD + MOD / 2;
            const topId = `comp:${component.id}:top:${poleIndex}`;
            const bottomId = `comp:${component.id}:bottom:${poleIndex}`;
            const displayLabel = getComponentDisplayLabel(component);
            const labelBase = `${displayLabel} P${poleIndex + 1}`;
            addPin({ id: topId, x, y: railY - 37, label: `${labelBase} sup.`, kind: normalizedWireColor({ id: topId, color: component.phase === "N" ? "blue" : "" }), group: displayLabel || "Dispositivo" });
            addPin({ id: bottomId, x, y: railY + 57, label: `${labelBase} inf.`, kind: normalizedWireColor({ id: bottomId, color: component.phase === "N" ? "blue" : "" }), group: displayLabel || "Dispositivo" });
          });
        }
        currentX += width + 2;
      });
    });

    return pins;
  }, [getComponentDisplayLabel, infrastructure, panelHeight, rails, visibleWires]);

  const selectedWireDescriptor = useMemo(
    () => routedWires.find((descriptor) => descriptor.wire?.id === selectedWireId) || null,
    [routedWires, selectedWireId]
  );

  const showConnectionEditor = wiringMode || Boolean(wireMoveMode || selectedWireId || wireEndpointDrag);

  const getSvgCursorPoint = (event) => {
    if (!svgRef.current) return null;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const matrix = svgRef.current.getScreenCTM();
    if (!matrix) return null;
    return svgPoint.matrixTransform(matrix.inverse());
  };

  const findNearestConnectionPin = (point, maxDistance = 34) => {
    if (!point) return null;
    return connectionPins.reduce((closest, pin) => {
      const distance = Math.hypot(pin.x - point.x, pin.y - point.y);
      if (distance > maxDistance) return closest;
      if (!closest || distance < closest.distance) return { ...pin, distance };
      return closest;
    }, null);
  };

  const loosePinFromPoint = (point) => (
    point && Number.isFinite(point.x) && Number.isFinite(point.y)
      ? `loose:${Math.round(point.x)}:${Math.round(point.y)}`
      : ""
  );

  const getStoredWire = (wireId) => wires.find((wire) => wire.id === wireId) || null;

  const getWireDescriptor = (wireId) => (
    routedWires.find((descriptor) => descriptor.wire?.id === wireId) || null
  );

  const inferRouteEndpointPins = (descriptor, routePoints = []) => {
    const points = cleanRoutePoints(routePoints);
    if (!descriptor || points.length < 2) {
      return {
        source: loosePinFromPoint(points[0]),
        target: loosePinFromPoint(points[points.length - 1]),
      };
    }

    const start = points[0];
    const end = points[points.length - 1];
    const sourceDistanceStart = Math.hypot(start.x - descriptor.p1.x, start.y - descriptor.p1.y);
    const targetDistanceStart = Math.hypot(start.x - descriptor.p2.x, start.y - descriptor.p2.y);
    const sourceDistanceEnd = Math.hypot(end.x - descriptor.p1.x, end.y - descriptor.p1.y);
    const targetDistanceEnd = Math.hypot(end.x - descriptor.p2.x, end.y - descriptor.p2.y);
    const closeEnough = 18;

    return {
      source: sourceDistanceStart <= closeEnough
        ? descriptor.wire.source
        : targetDistanceStart <= closeEnough
          ? descriptor.wire.target
          : loosePinFromPoint(start),
      target: targetDistanceEnd <= closeEnough
        ? descriptor.wire.target
        : sourceDistanceEnd <= closeEnough
          ? descriptor.wire.source
          : loosePinFromPoint(end),
    };
  };

  const registerWireRoute = (wireOrId, routePoints, options = {}) => {
    const wireId = typeof wireOrId === "string" ? wireOrId : wireOrId?.id;
    const points = cleanRoutePoints(routePoints);
    if (!wireId || points.length < 2) return points;

    const descriptor = options.descriptor || getWireDescriptor(wireId);
    const storedWire = getStoredWire(wireId);
    const inputWire = typeof wireOrId === "object" ? wireOrId : {};
    const endpointPins = inferRouteEndpointPins(descriptor, points);
    const baseWire = {
      ...(descriptor?.wire || {}),
      ...inputWire,
      ...(storedWire || {}),
      id: wireId,
    };

    const routeBends = getWireRouteBends(baseWire);
    const routeMode = getCableRoutingMode(baseWire, routeBends);
    const routeWire = {
      ...baseWire,
      source: baseWire.source || options.source || endpointPins.source || loosePinFromPoint(points[0]),
      target: baseWire.target || options.target || endpointPins.target || loosePinFromPoint(points[points.length - 1]),
      sourceComponentId: baseWire.sourceComponentId || getCableComponentId(baseWire.source || options.source || endpointPins.source),
      sourcePortId: baseWire.sourcePortId || baseWire.source || options.source || endpointPins.source || "",
      targetComponentId: baseWire.targetComponentId || getCableComponentId(baseWire.target || options.target || endpointPins.target),
      targetPortId: baseWire.targetPortId || baseWire.target || options.target || endpointPins.target || "",
      points: buildCablePointList(points, baseWire.points),
      route_points: routeBends,
      routingMode: routeMode,
      routeMode,
      lineStyle: getCableLineStyle(baseWire),
      cornerRadius: getCableCornerRadius(baseWire),
      locked: isCableLocked(baseWire),
      visible: isCableVisible(baseWire),
      color: baseWire.color || options.colorName || descriptor?.color || normalizedWireColor(baseWire),
      gauge: baseWire.gauge || options.gauge || descriptor?.wire?.gauge || "2.5mm²",
      name: baseWire.name || options.name || descriptor?.wire?.name || descriptor?.wire?.label || "Cabo editável",
      visual_only: Boolean(baseWire.visual_only || options.visualOnly),
    };

    wirePathsRef.current[wireId] = points;
    wireRouteMetaRef.current[wireId] = {
      wire: routeWire,
      routePoints: points,
      sourcePoint: points[0],
      targetPoint: points[points.length - 1],
      visualOnly: routeWire.visual_only,
      color: options.color || wireDisplayColor(routeWire.color || normalizedWireColor(routeWire)),
      thickness: options.thickness || getWireThickness(routeWire),
    };

    return points;
  };

  const getEditableWire = (wireId) => (
    getStoredWire(wireId)
    || wireRouteMetaRef.current[wireId]?.wire
    || getWireDescriptor(wireId)?.wire
    || { id: wireId, source: "", target: "", route_points: [] }
  );

  const getCurrentVisualWireRoute = (wireId) => {
    if (!wireId) return [];
    const visualRoute = wireRouteMetaRef.current[wireId]?.routePoints || wirePathsRef.current[wireId];
    if (visualRoute?.length >= 2) return cleanRoutePoints(visualRoute);

    const descriptor = getWireDescriptor(wireId);
    if (!descriptor) return [];

    const wire = getEditableWire(wireId);
    return cleanRoutePoints([descriptor.p1, ...getWireRouteBends(wire), descriptor.p2]);
  };

  const buildWireRecordFromVisual = (wireId, updates = {}) => {
    const { __captureVisualRoute, ...wireUpdates } = updates;
    const meta = wireRouteMetaRef.current[wireId] || {};
    const descriptor = getWireDescriptor(wireId);
    const points = meta.routePoints || wirePathsRef.current[wireId] || (
      descriptor ? cleanRoutePoints([descriptor.p1, descriptor.p2]) : []
    );
    const endpointPins = inferRouteEndpointPins(descriptor, points);
    const base = meta.wire || descriptor?.wire || {};
    const currentRouteBends = getWireRouteBends(base);
    const visualRouteBends = points.length > 2 ? points.slice(1, -1) : [];
    const routePoints = normalizeWireRoutePoints(
      wireUpdates.route_points
      ?? (currentRouteBends.length ? currentRouteBends : (__captureVisualRoute ? visualRouteBends : []))
    );
    const sourcePin = wireUpdates.source || base.source || endpointPins.source || loosePinFromPoint(points[0]);
    const targetPin = wireUpdates.target || base.target || endpointPins.target || loosePinFromPoint(points[points.length - 1]);
    const fullRoutePoints = points.length >= 2
      ? normalizeCablePoints([points[0], ...routePoints, points[points.length - 1]])
      : [];
    const routingMode = getCableRoutingMode({ ...base, ...wireUpdates }, routePoints);

    return {
      ...base,
      id: wireId,
      source: sourcePin,
      target: targetPin,
      sourceComponentId: wireUpdates.sourceComponentId || base.sourceComponentId || getCableComponentId(sourcePin),
      sourcePortId: wireUpdates.sourcePortId || base.sourcePortId || sourcePin,
      targetComponentId: wireUpdates.targetComponentId || base.targetComponentId || getCableComponentId(targetPin),
      targetPortId: wireUpdates.targetPortId || base.targetPortId || targetPin,
      points: wireUpdates.points || buildCablePointList(fullRoutePoints, base.points),
      color: wireUpdates.color || base.color || descriptor?.color || normalizedWireColor(base),
      gauge: wireUpdates.gauge || base.gauge || descriptor?.wire?.gauge || "2.5mm²",
      name: wireUpdates.name || base.name || base.label || descriptor?.wire?.label || "Cabo editável",
      route_points: routePoints,
      routeMode: routingMode,
      routingMode,
      lineStyle: getCableLineStyle({ ...base, ...wireUpdates }),
      cornerRadius: getCableCornerRadius({ ...base, ...wireUpdates }),
      locked: Boolean(wireUpdates.locked ?? base.locked ?? false),
      visible: wireUpdates.visible ?? base.visible ?? true,
      visual_only: Boolean(wireUpdates.visual_only ?? base.visual_only ?? meta.visualOnly),
      ...wireUpdates,
    };
  };

  const ensureWireRecord = (wireId, updates = {}, options = {}) => {
    if (!wireId) return null;
    let changed = false;
    let ensuredWire = null;
    const nextWires = wires.map((wire) => {
      if (wire.id !== wireId) return wire;
      const enriched = buildWireRecordFromVisual(wireId, { ...updates, ...wire });
      changed = (
        JSON.stringify(wire) !== JSON.stringify(enriched)
      );
      ensuredWire = enriched;
      return enriched;
    });

    if (!ensuredWire) {
      ensuredWire = buildWireRecordFromVisual(wireId, updates);
      nextWires.push(ensuredWire);
      changed = true;
    }

    if (changed) {
      setWires(nextWires);
      if (options.persist) saveLayoutToDb(rails, nextWires, infrastructure, options);
    }

    return ensuredWire;
  };

  const selectEditableWire = (wireId) => {
    if (!wireId) return;
    ensureWireRecord(wireId, {
      __captureVisualRoute: true,
      routeMode: "manual",
      routingMode: "manual",
    });
    setSelectedWireId(wireId);
    setSelectedRoutePoint(null);
    setSelectedComponentId("");
    setSelectedInfrastructureId("");
    setSelectedAnnotationId("");
    setSelectedTextWireId("");
    setActiveTab("wiring");
  };

  const commitWireEndpointMove = (wireId, endpoint, pinId) => {
    if (!wireId || !endpoint || !pinId) return;
    if (isCableLocked(getEditableWire(wireId))) return;
    const endpointPoint = getPinCoords(pinId, rails, panelHeight, infrastructure);
    const currentRoute = getCurrentVisualWireRoute(wireId);
    const routeWithEndpoint = currentRoute.length >= 2 && isValidWirePoint(endpointPoint)
      ? currentRoute.map((point, index, list) => (
          (endpoint === "source" && index === 0) || (endpoint === "target" && index === list.length - 1)
            ? endpointPoint
            : point
        ))
      : currentRoute;
    let found = false;
    const nextWires = wires.map((wire) => {
      if (wire.id === wireId) {
        found = true;
        return buildWireRecordFromVisual(wireId, {
          ...wire,
          [endpoint]: pinId,
          [`${endpoint}PortId`]: pinId,
          [`${endpoint}ComponentId`]: getCableComponentId(pinId),
          points: buildCablePointList(routeWithEndpoint, wire.points),
        });
      }
      return wire;
    });
    if (!found) {
       nextWires.push(buildWireRecordFromVisual(wireId, {
         [endpoint]: pinId,
         [`${endpoint}PortId`]: pinId,
         [`${endpoint}ComponentId`]: getCableComponentId(pinId),
         points: buildCablePointList(routeWithEndpoint),
       }));
    }
    updateWires(nextWires);
    setSelectedWireId(wireId);
    setWireMoveMode("");
    setWireEndpointDrag(null);
    setHoveredPinId("");
  };

  const startWireEndpointDrag = (event, endpoint) => {
    if (!selectedWireId) return;
    if (isCableLocked(getEditableWire(selectedWireId))) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    ensureWireRecord(selectedWireId);
    setActiveTab("wiring");
    setWireMoveMode(endpoint);
    setWireEndpointDrag({ wireId: selectedWireId, endpoint });
    const point = getSvgCursorPoint(event);
    setHoveredPinId(findNearestConnectionPin(point)?.id || "");
    if (point) setEndpointDragCoords({ x: point.x, y: point.y });
  };

  const setWireRoutePoints = (wireId, routePoints, options = {}) => {
    if (!options.force && isCableLocked(getEditableWire(wireId))) return;
    const cleanedPoints = normalizeWireRoutePoints(routePoints);
    const nextRouteMode = options.routeMode || (cleanedPoints.length ? "manual" : "automatic");
    const currentRoute = getCurrentVisualWireRoute(wireId);
    const nextFullRoute = currentRoute.length >= 2
      ? normalizeCablePoints([currentRoute[0], ...cleanedPoints, currentRoute[currentRoute.length - 1]])
      : cleanedPoints;
    let found = false;
    const nextWires = wires.map((wire) => {
      if (wire.id === wireId) {
        found = true;
        return buildWireRecordFromVisual(wireId, {
          ...wire,
          route_points: cleanedPoints,
          points: buildCablePointList(nextFullRoute, wire.points),
          routeMode: nextRouteMode,
          routingMode: nextRouteMode,
        });
      }
      return wire;
    });

    if (!found) {
      nextWires.push(buildWireRecordFromVisual(wireId, {
        route_points: cleanedPoints,
        points: buildCablePointList(nextFullRoute),
        routeMode: nextRouteMode,
        routingMode: nextRouteMode,
      }));
    }

    if (wireRouteMetaRef.current[wireId]) {
      wireRouteMetaRef.current[wireId] = {
        ...wireRouteMetaRef.current[wireId],
        routePoints: nextFullRoute.length >= 2 ? nextFullRoute : wireRouteMetaRef.current[wireId].routePoints,
      };
    }
    setWires(nextWires);
    if (options.persist !== false) saveLayoutToDb(rails, nextWires, infrastructure, options);
  };

  const materializeWireManualRoute = (wireId, options = {}) => {
    const routePoints = getCurrentVisualWireRoute(wireId);
    if (routePoints.length < 2) return;

    let editableBends = routePoints.slice(1, -1);
    if (!editableBends.length) {
      const midpoint = getRouteMidpoint(routePoints);
      editableBends = midpoint ? [midpoint] : [];
    }

    setWireRoutePoints(wireId, editableBends, options);
    setSelectedWireId(wireId);
    setActiveTab("wiring");
  };

  const updateWireRoutePoint = (wireId, routeIndex, point, options = {}) => {
    if (!wireId || !point) return;
    let wire = wires.find((item) => item.id === wireId);
    if (!wire) {
      if (
        String(wireId).includes("main")
        || String(wireId).includes("tie")
        || String(wireId).includes("-ground-")
        || String(wireId).includes("-neutral-")
        || wirePathsRef.current[wireId]
        || wireRouteMetaRef.current[wireId]
      ) {
        wire = buildWireRecordFromVisual(wireId);
      } else {
          return;
      }
    }
    if (isCableLocked(wire)) return;

    const currentPoints = getWireRouteBends(wire);
    const nextPoints = currentPoints.length ? [...currentPoints] : [point];
    nextPoints[routeIndex] = {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };
    setWireRoutePoints(wireId, nextPoints, options);
  };

  const updateWireLabelMeta = (wireId, metaUpdates, options = {}) => {
    if (!wireId) return;
    let found = false;
    const nextWires = wires.map((w) => {
      if (w.id === wireId) {
        found = true;
        const nextMeta = {
          ...(w.labelMeta || {}),
          ...metaUpdates,
          ...(Object.prototype.hasOwnProperty.call(metaUpdates, "text") ? { hidden: false } : {}),
        };
        const nextWire = { ...w, labelMeta: nextMeta };
        if (Object.prototype.hasOwnProperty.call(metaUpdates, "x") || Object.prototype.hasOwnProperty.call(metaUpdates, "y")) {
          nextWire.labelPosition = {
            x: Number(nextMeta.x ?? w.labelPosition?.x ?? 0),
            y: Number(nextMeta.y ?? w.labelPosition?.y ?? 0),
          };
        }
        return nextWire;
      }
      return w;
    });
    if (!found) {
      const nextMeta = {
        ...metaUpdates,
        ...(Object.prototype.hasOwnProperty.call(metaUpdates, "text") ? { hidden: false } : {}),
      };
      const nextWire = buildWireRecordFromVisual(wireId, {
        labelMeta: nextMeta,
        labelPosition: Object.prototype.hasOwnProperty.call(metaUpdates, "x") || Object.prototype.hasOwnProperty.call(metaUpdates, "y")
          ? { x: Number(nextMeta.x || 0), y: Number(nextMeta.y || 0) }
          : undefined,
      });
      nextWires.push(nextWire);
    }
    setWires(nextWires);
    if (options.persist !== false) saveLayoutToDb(rails, nextWires, infrastructure, options);
  };

  const normalizeInfrastructureItem = (infraId, item = {}) => {
    if (infraId === "neutral-bus") {
      const width = Math.max(180, Math.min(520, Number(item.width) || NEUTRAL_BUS.width));
      const rawX = Number(item.x);
      const rawY = Number(item.y);
      return {
        ...item,
        width,
        x: Math.max(20, Math.min(PANEL_W - width - 20, Number.isFinite(rawX) ? rawX : NEUTRAL_BUS.x)),
        y: Math.max(20, Math.min(panelHeight - 44, Number.isFinite(rawY) ? rawY : NEUTRAL_BUS.y)),
      };
    }

    if (infraId === "ground-bus") {
      const width = Math.max(260, Math.min(520, Number(item.width) || GROUND_BUS.width));
      const rawX = Number(item.x ?? item.busX);
      const rawY = Number(item.y);
      return {
        ...item,
        width,
        x: Math.max(20, Math.min(PANEL_W - width - 20, Number.isFinite(rawX) ? rawX : GROUND_BUS.x)),
        y: Math.max(20, Math.min(panelHeight - 44, Number.isFinite(rawY) ? rawY : (panelHeight - 68))),
      };
    }

    if (isCombBusbarId(infraId)) {
      const rawX = Number(item.x);
      const rawY = Number(item.y);
      const rawWidth = Number(item.width);
      const rawHeight = Number(item.height);
      const rawToothHeight = Number(item.toothHeight);
      const rawToothGap = Number(item.toothGap);
      const rawRotation = Number(item.rotation);
      const nextItem = {
        ...item,
        type: "comb-busbar",
        color: item.color || COLORS.yellowComb,
        conductorColor: item.conductorColor || "#ca8a04",
        strokeColor: item.strokeColor || "#ca8a04",
        height: clampNumber(rawHeight, 4, 18, 8),
        toothHeight: clampNumber(rawToothHeight, 4, 22, 10),
        toothGap: clampNumber(rawToothGap, 8, 60, MOD),
        rotation: Number.isFinite(rawRotation) ? rawRotation : 0,
      };
      if (Number.isFinite(rawWidth)) {
        nextItem.width = clampNumber(rawWidth, 18, PANEL_W - 40, 120);
      }
      if (Number.isFinite(rawX)) {
        const width = Number(nextItem.width) || 120;
        nextItem.x = clampNumber(rawX, 20, PANEL_W - width - 20, 160);
      }
      if (Number.isFinite(rawY)) {
        nextItem.y = clampNumber(rawY, 20, panelHeight - 44, 140);
      }
      return nextItem;
    }

    return item;
  };

  const updateInfrastructure = (infraId, updates = {}, options = {}) => {
    if (!infraId) return;
    let found = false;
    const nextInfrastructure = infrastructure.map((item) => {
      if (item.id !== infraId) return item;
      found = true;
      return normalizeInfrastructureItem(infraId, { ...item, ...updates });
    });

    if (!found) {
      nextInfrastructure.push(normalizeInfrastructureItem(infraId, { id: infraId, ...updates }));
    }

    setInfrastructure(nextInfrastructure);
    if (options.persist !== false) saveLayoutToDb(rails, wires, nextInfrastructure);
  };

  const selectInfrastructure = (infraId) => {
    if (!infraId) return;
    setSelectedInfrastructureId(infraId);
    setSelectedComponentId("");
    setSelectedWireId("");
    setSelectedTextWireId("");
    setSelectedAnnotationId("");
    setSelectedRoutePoint(null);
    setWireMoveMode("");
    setWiringMode(false);
    setWiringStart("");
    setActiveTab("infra");
  };

  const resetInfrastructureItem = (infraId) => {
    if (!infraId) return;
    const nextInfrastructure = infrastructure.filter((item) => item.id !== infraId);
    setInfrastructure(nextInfrastructure);
    saveLayoutToDb(rails, wires, nextInfrastructure);
    if (isFreeCombBusbarId(infraId) || isThreePhaseBusbarId(infraId) || isFreeDinRailId(infraId)) {
      setSelectedInfrastructureId("");
      return;
    }
    setSelectedInfrastructureId(infraId);
  };

  const addThreePhaseBusbar = () => {
    const busbarId = makeThreePhaseBusbarId();
    const nextItem = normalizeInfrastructureItem(busbarId, {
      id: busbarId,
      type: "three-phase-busbar",
      label: "BARRAMENTO TRIFÁSICO",
      x: Math.round(PANEL_W / 2 - 20),
      y: Math.round(200),
      width: 40,
      height: 300,
      rotation: 0,
      color: "#b87333",
      labelColor: "#0f172a",
      free: true,
    });
    const nextInfrastructure = [...infrastructure, nextItem];
    setInfrastructure(nextInfrastructure);
    saveLayoutToDb(rails, wires, nextInfrastructure);
    selectInfrastructure(busbarId);
  };

  const addFreeDinRail = () => {
    const railId = makeFreeDinRailId();
    const nextItem = normalizeInfrastructureItem(railId, {
      id: railId,
      type: "free-din-rail",
      label: "TRILHO DIN LIVRE",
      x: Math.round(PANEL_W / 2 - 90),
      y: Math.round(200),
      width: 180,
      height: 24,
      rotation: 0,
      free: true,
    });
    const nextInfrastructure = [...infrastructure, nextItem];
    setInfrastructure(nextInfrastructure);
    saveLayoutToDb(rails, wires, nextInfrastructure);
    selectInfrastructure(railId);
  };

  const addFreeCombBusbar = () => {
    const busbarId = makeFreeCombBusbarId();
    const nextItem = normalizeInfrastructureItem(busbarId, {
      id: busbarId,
      type: "comb-busbar",
      label: "BARRAMENTO PENTE",
      x: Math.round(PANEL_W / 2 - 90),
      y: Math.round(190 + Math.max(0, rails.length - 1) * 120),
      width: 180,
      height: 8,
      toothHeight: 10,
      toothGap: MOD,
      color: COLORS.yellowComb,
      conductorColor: "#ca8a04",
      strokeColor: "#ca8a04",
      labelColor: "#854d0e",
      free: true,
    });
    const nextInfrastructure = [...infrastructure, nextItem];
    setInfrastructure(nextInfrastructure);
    saveLayoutToDb(rails, wires, nextInfrastructure);
    selectInfrastructure(busbarId);
  };

  const deleteSelectedElement = () => {
    if (selectedTextWireId) {
      updateWireLabelMeta(selectedTextWireId, { hidden: true, text: "" });
      setSelectedTextWireId("");
      return true;
    }

    if (selectedAnnotationId) {
      const nextInfrastructure = infrastructure.filter((item) => item.id !== selectedAnnotationId);
      setInfrastructure(nextInfrastructure);
      saveLayoutToDb(rails, wires, nextInfrastructure);
      setSelectedAnnotationId("");
      return true;
    }

    const routePointToDelete = wireRoutePointDrag || selectedRoutePoint;
    if (routePointToDelete?.wireId && Number.isInteger(routePointToDelete.index)) {
      const routeWire = getEditableWire(routePointToDelete.wireId);
      if (isCableLocked(routeWire)) return true;
      const nextBends = getWireRouteBends(routeWire).filter((_, index) => index !== routePointToDelete.index);
      setWireRoutePoints(routePointToDelete.wireId, nextBends);
      setWireRoutePointDrag(null);
      setSelectedRoutePoint(null);
      return true;
    }

    if (selectedWireId) {
      if (isCableLocked(getEditableWire(selectedWireId))) return true;
      const nextWires = wires.filter((wire) => wire.id !== selectedWireId);
      nextWires.push({ id: selectedWireId, deleted: true });
      updateWires(nextWires);
      clearWireSelection();
      return true;
    }

    if (selectedComponentId) {
      return handleDeleteComponent(selectedComponentId);
    }

    if (selectedInfrastructureId) {
      if (["neutral-bus", "ground-bus"].includes(selectedInfrastructureId)) {
        setSelectedInfrastructureId("");
        return true;
      }
      const nextInfrastructure = infrastructure.filter((item) => item.id !== selectedInfrastructureId);
      setInfrastructure(nextInfrastructure);
      saveLayoutToDb(rails, wires, nextInfrastructure);
      setSelectedInfrastructureId("");
      return true;
    }

    return false;
  };

  useEffect(() => {
    const handleEditorKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;

      const key = String(event.key || "");
      const lowerKey = key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && (lowerKey === "z" || lowerKey === "y")) {
        const handled = lowerKey === "y" || event.shiftKey ? redoLayout() : undoLayout();
        if (!handled) return;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const isPlainXDelete = lowerKey === "x" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (key === "Delete" || key === "Backspace" || isPlainXDelete) {
        const handled = deleteSelectedElement();
        if (!handled) return;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (key !== "Escape") return;

      const hasActiveEdit = wiringMode
        || wiringStart
        || selectedWireId
        || selectedTextWireId
        || selectedComponentId
        || selectedInfrastructureId
        || selectedAnnotationId
        || wireMoveMode
        || wireEndpointDrag
        || wireRoutePointDrag
        || wireSegmentDrag
        || infraResizeDrag
        || componentDrag
        || textDrag
        || rotationDrag
        || legendDrag;

      if (!hasActiveEdit) return;
      event.preventDefault();
      event.stopPropagation();

      if (textDrag?.annotationId) {
        updateInfrastructure(textDrag.annotationId, {}, { persist: true });
        commitEditHistory(`annotation:${textDrag.annotationId}`);
      } else if (textDrag?.infraId) {
        updateInfrastructure(textDrag.infraId, {}, { persist: true });
        commitEditHistory(`infra:${textDrag.infraId}`);
      } else if (textDrag?.wireId) {
        updateWireLabelMeta(textDrag.wireId, {}, { persist: true });
        commitEditHistory(`wire-label:${textDrag.wireId}`);
      } else if (wireRoutePointDrag) {
        saveLayoutToDb(rails, wires);
        commitEditHistory(`wire-route:${wireRoutePointDrag.wireId}`);
      } else if (wireSegmentDrag) {
        saveLayoutToDb(rails, wires);
        commitEditHistory(`wire-route:${wireSegmentDrag.wireId}`);
      } else if (infraResizeDrag) {
        updateInfrastructure(infraResizeDrag.infraId, {}, { persist: true });
        commitEditHistory(`infra:${infraResizeDrag.infraId}`);
      } else if (rotationDrag) {
        updateInfrastructure(rotationDrag.infraId, {}, { persist: true });
        commitEditHistory(rotationDrag.historyKey || `infra:${rotationDrag.infraId}`);
      }

      setWireSegmentDrag(null);
      setInfraResizeDrag(null);
      setRotationDrag(null);
      clearWireSelection();
    };

    window.addEventListener("keydown", handleEditorKeyDown, true);
    return () => window.removeEventListener("keydown", handleEditorKeyDown, true);
  }, [
    clearWireSelection,
    componentDrag,
    infraResizeDrag,
    legendDrag,
    rails,
    rotationDrag,
    selectedAnnotationId,
    selectedComponentId,
    selectedInfrastructureId,
    selectedRoutePoint,
    selectedTextWireId,
    selectedWireId,
    textDrag,
    updateInfrastructure,
    updateWireLabelMeta,
    wireEndpointDrag,
    wireMoveMode,
    wireRoutePointDrag,
    wireSegmentDrag,
    wires,
    wiringMode,
    wiringStart,
  ]);

  const handleCreateAnnotation = (presetKey = annotationPreset) => {
    const preset = ANNOTATION_PRESETS[presetKey] || ANNOTATION_PRESETS.observacao;
    const text = String(newAnnotationText || preset.text).trim();
    if (!text) return;

    const annotation = {
      id: `annotation_${Date.now()}`,
      type: "annotation",
      text,
      label: preset.label,
      x: Math.min(PANEL_W - 260, 120 + textAnnotations.length * 18),
      y: Math.min(panelHeight - 160, 112 + textAnnotations.length * 22),
      color: preset.color,
      background: preset.background,
      borderColor: preset.borderColor,
      fontSize: preset.fontSize,
      fontWeight: preset.fontWeight,
      width: preset.width,
      rotation: 0,
      align: "start",
      showBox: true,
    };
    const nextInfrastructure = [...infrastructure, annotation];
    setInfrastructure(nextInfrastructure);
    saveLayoutToDb(rails, wires, nextInfrastructure);
    setSelectedAnnotationId(annotation.id);
    setSelectedTextWireId("");
    setSelectedInfrastructureId("");
    setActiveTab("text");
  };

  const handleDeleteAnnotation = (annotationId) => {
    if (!annotationId) return;
    const nextInfrastructure = infrastructure.filter((item) => item.id !== annotationId);
    setInfrastructure(nextInfrastructure);
    saveLayoutToDb(rails, wires, nextInfrastructure);
    setSelectedAnnotationId("");
  };

  const startWireRoutePointDrag = (event, wireId, routeIndex, initialPoint, isVirtual) => {
    if (!wireId) return;
    const wire = getEditableWire(wireId);
    if (isCableLocked(wire)) return;
    event.stopPropagation();
    event.preventDefault();
    if (event.button === 2 && !isVirtual) {
      const nextBends = getWireRouteBends(wire).filter((_, index) => index !== routeIndex);
      setWireRoutePoints(wireId, nextBends);
      setSelectedRoutePoint(null);
      return;
    }
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    captureEditHistoryStart(`wire-route:${wireId}`);
    setSelectedWireId(wireId);
    setSelectedComponentId("");
    setActiveTab("wiring");
    setWiringMode(false);
    setWireMoveMode("");
    setWireEndpointDrag(null);
    setHoveredPinId("");

    if (isVirtual && initialPoint) {
      const basePoints = wirePathsRef.current[wireId] || wireRouteMetaRef.current[wireId]?.routePoints || [];
      const bends = getWireRouteBends(wire).length
        ? getWireRouteBends(wire)
        : basePoints.length > 2
          ? basePoints.slice(1, -1)
          : [];
      const nextBends = [...bends];
      nextBends.splice(routeIndex, 0, initialPoint);
      setWireRoutePoints(wireId, nextBends, { persist: false });
    } else if (!getWireRouteBends(wire).length && initialPoint) {
      setWireRoutePoints(wireId, [initialPoint], { persist: false });
    }
    const startPoint = initialPoint ? { x: Math.round(initialPoint.x), y: Math.round(initialPoint.y) } : null;
    setWireRoutePointDrag({ wireId, index: routeIndex, startPoint });
    setSelectedRoutePoint({ wireId, index: routeIndex });
  };

  const startWireSegmentDrag = (event, wireId, segmentIndex, routePoints = []) => {
    if (!wireId || segmentIndex < 0) return;
    const wire = getEditableWire(wireId);
    if (isCableLocked(wire)) return;
    const startPoints = cleanRoutePoints(routePoints);
    if (startPoints.length < 2 || segmentIndex >= startPoints.length - 1) return;
    const startPoint = getSvgCursorPoint(event);
    if (!startPoint) return;

    event.stopPropagation();
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    captureEditHistoryStart(`wire-route:${wireId}`);
    selectEditableWire(wireId);
    setWireRoutePointDrag(null);
    setSelectedRoutePoint(null);
    setWireSegmentDrag({
      wireId,
      segmentIndex,
      startPoint: { x: startPoint.x, y: startPoint.y },
      startPoints,
    });
  };

  const updateWireSegmentDrag = (dragState, point, options = {}) => {
    if (!dragState?.wireId || !point) return;
    const startPoints = cleanRoutePoints(dragState.startPoints || []);
    const segmentIndex = Number(dragState.segmentIndex);
    if (startPoints.length < 2 || segmentIndex < 0 || segmentIndex >= startPoints.length - 1) return;

    const start = startPoints[segmentIndex];
    const end = startPoints[segmentIndex + 1];
    const dx = point.x - dragState.startPoint.x;
    const dy = point.y - dragState.startPoint.y;
    const segmentDx = end.x - start.x;
    const segmentDy = end.y - start.y;
    const moveVertical = Math.abs(segmentDy) >= Math.abs(segmentDx);
    const nextPoints = startPoints.map((item) => ({ ...item }));

    if (moveVertical) {
      const nextX = Math.round(start.x + dx);
      if (segmentIndex > 0) {
        nextPoints[segmentIndex].x = nextX;
      } else {
        nextPoints.splice(1, 0, { x: nextX, y: start.y });
      }

      const adjustedEndIndex = segmentIndex === 0 ? segmentIndex + 2 : segmentIndex + 1;
      if (adjustedEndIndex < nextPoints.length - 1) {
        nextPoints[adjustedEndIndex].x = nextX;
      } else {
        nextPoints.splice(nextPoints.length - 1, 0, { x: nextX, y: end.y });
      }
    } else {
      const nextY = Math.round(start.y + dy);
      if (segmentIndex > 0) {
        nextPoints[segmentIndex].y = nextY;
      } else {
        nextPoints.splice(1, 0, { x: start.x, y: nextY });
      }

      const adjustedEndIndex = segmentIndex === 0 ? segmentIndex + 2 : segmentIndex + 1;
      if (adjustedEndIndex < nextPoints.length - 1) {
        nextPoints[adjustedEndIndex].y = nextY;
      } else {
        nextPoints.splice(nextPoints.length - 1, 0, { x: end.x, y: nextY });
      }
    }

    setWireRoutePoints(dragState.wireId, nextPoints.slice(1, -1), {
      persist: options.persist,
      routeMode: "manual",
    });
  };

  const startInfraTextDrag = (event, infraId, defaultX, defaultY) => {
    if (!infraId) return;
    if (wiringMode || wireMoveMode) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    captureEditHistoryStart(`infra:${infraId}`);
    selectInfrastructure(infraId);
    const pt = getSvgCursorPoint(event);
    if (!pt) return;
    const item = infrastructure.find(i => i.id === infraId) || {};
    const startX = item.x ?? defaultX ?? pt.x;
    const startY = item.y ?? defaultY ?? pt.y;
    setTextDrag({ infraId, offsetX: pt.x - startX, offsetY: pt.y - startY });
  };

  const startInfrastructureResizeDrag = (event, infraId, edge, startItem = {}) => {
    if (!infraId || !edge) return;
    if (wiringMode || wireMoveMode) return;
    event.stopPropagation();
    event.preventDefault();
    const pt = getSvgCursorPoint(event);
    if (!pt) return;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    captureEditHistoryStart(`infra:${infraId}`);
    selectInfrastructure(infraId);
    setTextDrag(null);
    setInfraResizeDrag({
      infraId,
      edge,
      startPoint: { x: pt.x, y: pt.y },
      startItem,
    });
  };

  const updateInfrastructureResizeDrag = (dragState, point, options = {}) => {
    if (!dragState?.infraId || !point) return;
    const startItem = dragState.startItem || {};
    const startX = Number(startItem.x) || 0;
    const startWidth = Math.max(18, Number(startItem.width) || 120);
    const dx = point.x - dragState.startPoint.x;
    const maxWidth = PANEL_W - 40;
    let nextX = startX;
    let nextWidth = startWidth;

    if (dragState.edge === "left") {
      const rawWidth = startWidth - dx;
      nextWidth = clampNumber(rawWidth, 18, maxWidth, startWidth);
      nextX = startX + (startWidth - nextWidth);
    } else {
      nextWidth = clampNumber(startWidth + dx, 18, maxWidth, startWidth);
    }

    updateInfrastructure(dragState.infraId, {
      x: Math.round(nextX),
      width: Math.round(nextWidth),
    }, options);
  };

  const startTextDrag = (event, wireId, defaultX, defaultY) => {
    if (!wireId) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    captureEditHistoryStart(`wire-label:${wireId}`);
    setSelectedTextWireId(wireId);
    setSelectedAnnotationId("");
    setSelectedWireId("");
    setSelectedComponentId("");
    setSelectedInfrastructureId("");
    setSelectedRoutePoint(null);
    setActiveTab("text");
    const pt = getSvgCursorPoint(event);
    if (!pt) return;
    const wire = wires.find(w => w.id === wireId) || {};
    const meta = wire.labelMeta || {};
    const startX = meta.x ?? wire.labelPosition?.x ?? defaultX ?? pt.x;
    const startY = meta.y ?? wire.labelPosition?.y ?? defaultY ?? pt.y;
    setTextDrag({ wireId, offsetX: pt.x - startX, offsetY: pt.y - startY });
  };

  const startAnnotationDrag = (event, annotationId) => {
    if (!annotationId) return;
    if (wiringMode || wireMoveMode) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    captureEditHistoryStart(`annotation:${annotationId}`);
    setSelectedAnnotationId(annotationId);
    setSelectedTextWireId("");
    setSelectedInfrastructureId("");
    setSelectedWireId("");
    setSelectedComponentId("");
    setSelectedRoutePoint(null);
    setActiveTab("text");
    const pt = getSvgCursorPoint(event);
    if (!pt) return;
    const annotation = infrastructure.find((item) => item.id === annotationId) || {};
    setTextDrag({
      annotationId,
      offsetX: pt.x - (annotation.x ?? pt.x),
      offsetY: pt.y - (annotation.y ?? pt.y),
    });
  };

  const startRotationDrag = (event, options = {}) => {
    const { infraId, centerX, centerY, historyKey = `infra:${infraId}`, onSelect } = options;
    if (!infraId || !Number.isFinite(centerX) || !Number.isFinite(centerY)) return;
    if (wiringMode || wireMoveMode) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    captureEditHistoryStart(historyKey);
    onSelect?.();
    const point = getSvgCursorPoint(event);
    const dragState = { infraId, centerX, centerY, historyKey };
    setTextDrag(null);
    setRotationDrag(dragState);
    if (point) {
      updateInfrastructure(
        infraId,
        { rotation: getRotationFromPoint(point, { x: centerX, y: centerY }, event.shiftKey ? 15 : 1) },
        { persist: false }
      );
    }
  };

  const updateRotationDrag = (dragState, point, options = {}) => {
    if (!dragState?.infraId || !point) return;
    updateInfrastructure(
      dragState.infraId,
      {
        rotation: getRotationFromPoint(
          point,
          { x: dragState.centerX, y: dragState.centerY },
          options.snap || 1
        ),
      },
      { persist: options.persist }
    );
  };

  const addWireRoutePoint = (wireId) => {
    const wire = getEditableWire(wireId);
    if (!wire) return;
    if (isCableLocked(wire)) return;

    let basePoints = [];
    const descriptor = routedWires.find((item) => item.wire?.id === wireId);
    const visualRoute = wirePathsRef.current[wireId] || wireRouteMetaRef.current[wireId]?.routePoints;
    if (visualRoute?.length >= 2) {
      basePoints = visualRoute;
    } else if (descriptor) {
      basePoints = cleanRoutePoints([descriptor.p1, ...getWireRouteBends(wire), descriptor.p2]);
    } else {
      basePoints = wirePathsRef.current[wireId] || [];
    }

    if (basePoints.length < 2) return;

    let bends = getWireRouteBends(wire);
    if (bends.length === 0 && basePoints.length > 2) {
      // O usuário está tentando editar um fio automático.
      // Primeiro, convertemos as curvas matemáticas perfeitas em pontos de controle editáveis!
      bends = basePoints.slice(1, -1);
      setWireRoutePoints(wireId, bends);
      setSelectedWireId(wireId);
      setActiveTab("wiring");
      return; // Retornamos para que ele possa arrastar os cantos existentes antes de criar mais pontos.
    }

    // Achar o maior segmento para inserir o ponto no meio (evita zig-zag)
    let maxDist = -1;
    let insertIndex = 1;
    let midpoint = null;

    for (let i = 0; i < basePoints.length - 1; i++) {
      const p1 = basePoints[i];
      const p2 = basePoints[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist > maxDist) {
        maxDist = dist;
        insertIndex = i; // The new point will be after p1, so it corresponds to bends index i
        midpoint = { x: Math.round((p1.x + p2.x) / 2), y: Math.round((p1.y + p2.y) / 2) };
      }
    }

    if (!midpoint) return;
    
    const nextBends = [...bends];
    nextBends.splice(insertIndex, 0, midpoint);

    setWireRoutePoints(wireId, nextBends);
    setSelectedWireId(wireId);
    setActiveTab("wiring");
  };

  const clearWireRoutePoints = (wireId) => {
    setWireRoutePoints(wireId, [], { routeMode: "automatic" });
    setWireRoutePointDrag(null);
  };

  const setWireRoutingMode = (wireId, routeMode) => {
    const wire = getEditableWire(wireId);
    if (!wire || isCableLocked(wire)) return;
    if (routeMode === "automatic") {
      clearWireRoutePoints(wireId);
      return;
    }
    const bends = getWireRouteBends(wire);
    if (bends.length) {
      setWireRoutePoints(wireId, bends, { routeMode });
      return;
    }
    materializeWireManualRoute(wireId, { routeMode });
  };

  const removeLastWireRoutePoint = (wireId) => {
    const wire = getEditableWire(wireId);
    if (!wire || isCableLocked(wire)) return;
    const bends = getWireRouteBends(wire);
    setWireRoutePoints(wireId, bends.slice(0, -1));
    setSelectedRoutePoint(null);
  };

  const duplicateWireRoutePoint = (wireId) => {
    const wire = getEditableWire(wireId);
    if (!wire || isCableLocked(wire)) return;
    const bends = getWireRouteBends(wire);
    const baseRoute = getCurrentVisualWireRoute(wireId);
    const fallbackPoint = getRouteMidpoint(baseRoute);
    const index = selectedRoutePoint?.wireId === wireId && Number.isInteger(selectedRoutePoint.index)
      ? Math.max(0, Math.min(bends.length - 1, selectedRoutePoint.index))
      : bends.length - 1;
    const sourcePoint = bends[index] || fallbackPoint;
    if (!sourcePoint) return;
    const nextPoint = {
      x: snapWireGrid(sourcePoint.x + WIRE_GRID * 2),
      y: snapWireGrid(sourcePoint.y + WIRE_GRID * 2),
    };
    const nextBends = [...bends];
    nextBends.splice(Math.max(0, index + 1), 0, nextPoint);
    setWireRoutePoints(wireId, nextBends);
    setSelectedRoutePoint({ wireId, index: Math.max(0, index + 1) });
  };

  const reverseWireDirection = (wireId) => {
    const wire = getEditableWire(wireId);
    if (!wire || isCableLocked(wire)) return;
    const reversedBends = [...getWireRouteBends(wire)].reverse();
    const nextWires = wires.map((item) => (
      item.id === wireId
        ? buildWireRecordFromVisual(wireId, {
            ...item,
            source: item.target,
            target: item.source,
            sourcePortId: item.targetPortId || item.target,
            targetPortId: item.sourcePortId || item.source,
            sourceComponentId: item.targetComponentId || getCableComponentId(item.target),
            targetComponentId: item.sourceComponentId || getCableComponentId(item.source),
            route_points: reversedBends,
            routeMode: "manual",
            routingMode: "manual",
          })
        : item
    ));
    updateWires(nextWires);
  };

  const disconnectWireEndpoint = (wireId, endpoint) => {
    const wire = getEditableWire(wireId);
    if (!wire || isCableLocked(wire)) return;
    const route = getCurrentVisualWireRoute(wireId);
    const point = endpoint === "source" ? route[0] : route[route.length - 1];
    const pinId = loosePinFromPoint(point);
    if (!pinId) return;
    commitWireEndpointMove(wireId, endpoint, pinId);
  };

  const moveComponentToPoint = (componentId, point) => {
    if (!componentId || !point) return;
    let movedComponent = null;
    const withoutComponent = rails.map((rail) => {
      const components = (rail.components || []).filter((component) => {
        if (component.id === componentId) {
          movedComponent = component;
          return false;
        }
        return true;
      });
      return { ...rail, components };
    });

    if (!movedComponent || movedComponent.type === "spacer") return;

    const targetRailIndex = Math.max(0, Math.min(rails.length - 1, Math.round((point.y - 190) / 240)));
    const targetRail = withoutComponent[targetRailIndex];
    const activeComponents = (targetRail.components || []).filter((component) => component.type !== "spacer");
    const movedWidth = Math.max(1, Number(movedComponent.poles) || 1);
    const targetSlot = clampNumber(
      Math.round((point.x - RAIL_COMPONENT_START_X) / (MOD + RAIL_COMPONENT_GAP)) + 1,
      1,
      ROW_MAX - movedWidth + 1,
      1
    );
    let insertIndex = activeComponents.length;

    for (let index = 0; index < activeComponents.length; index += 1) {
      const component = activeComponents[index];
      const componentStart = Number(component.dinPosition ?? component.startDin ?? component.slot) || (index + 1);
      if (targetSlot < componentStart) {
        insertIndex = index;
        break;
      }
    }

    const nextComponents = [...activeComponents];
    nextComponents.splice(insertIndex, 0, {
      ...movedComponent,
      railId: targetRail.id,
      dinPosition: targetSlot,
      startDin: targetSlot,
      slot: targetSlot,
      moduleWidth: movedWidth,
      dinSize: movedWidth,
      poles: movedWidth,
    });
    const nextRails = withoutComponent.map((rail, index) => (
      index === targetRailIndex ? { ...rail, components: nextComponents } : rail
    ));

    updateRails(nextRails);
    setSelectedComponentId(componentId);
    setSelectedWireId("");
    setActiveTab("components");
  };

  const startComponentDrag = (event, componentId) => {
    if (event.button !== 0 || wiringMode || wireMoveMode || wireEndpointDrag || wireRoutePointDrag || wireSegmentDrag || infraResizeDrag) return;
    const point = getSvgCursorPoint(event);
    if (!point) return;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    captureEditHistoryStart(`component:${componentId}:move`);
    setComponentDrag({
      componentId,
      startX: point.x,
      startY: point.y,
      active: false,
      x: point.x,
      y: point.y,
    });
  };

  const startLegendDrag = (event) => {
    event.stopPropagation();
    event.preventDefault();
    const point = getSvgCursorPoint(event);
    if (!point) return;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    setLegendDrag({
      offsetX: point.x - legendPosition.x,
      offsetY: point.y - legendPosition.y,
    });
  };

  const handleSvgPointerMove = (event) => {
    const point = getSvgCursorPoint(event);

    if (legendDrag && point) {
      setLegendPosition({
        x: Math.max(30, Math.min(PANEL_W - 214, snapWireGrid(point.x - legendDrag.offsetX))),
        y: Math.max(30, Math.min(panelHeight - 148, snapWireGrid(point.y - legendDrag.offsetY))),
      });
      return;
    }

    if (rotationDrag && point) {
      updateRotationDrag(rotationDrag, point, { persist: false, snap: event.shiftKey ? 15 : 1 });
      return;
    }

    if (infraResizeDrag && point) {
      updateInfrastructureResizeDrag(infraResizeDrag, point, { persist: false });
      return;
    }

    if (wireSegmentDrag && point) {
      updateWireSegmentDrag(wireSegmentDrag, point, { persist: false });
      return;
    }

    if (wireRoutePointDrag && point) {
      let nextPoint = { x: Math.round(point.x), y: Math.round(point.y) };
      if (event.shiftKey && wireRoutePointDrag.startPoint) {
        const dx = Math.abs(nextPoint.x - wireRoutePointDrag.startPoint.x);
        const dy = Math.abs(nextPoint.y - wireRoutePointDrag.startPoint.y);
        nextPoint = dx >= dy
          ? { ...nextPoint, y: wireRoutePointDrag.startPoint.y }
          : { ...nextPoint, x: wireRoutePointDrag.startPoint.x };
      }
      updateWireRoutePoint(wireRoutePointDrag.wireId, wireRoutePointDrag.index, nextPoint, { persist: false });
      return;
    }

    if (textDrag && point) {
      if (textDrag.annotationId) {
        updateInfrastructure(textDrag.annotationId, { x: snapWireGrid(point.x - textDrag.offsetX), y: snapWireGrid(point.y - textDrag.offsetY) }, { persist: false });
      } else if (textDrag.infraId) {
        updateInfrastructure(textDrag.infraId, { x: Math.round(point.x - textDrag.offsetX), y: Math.round(point.y - textDrag.offsetY) }, { persist: false });
      } else {
        updateWireLabelMeta(textDrag.wireId, { x: snapWireGrid(point.x - textDrag.offsetX), y: snapWireGrid(point.y - textDrag.offsetY) }, { persist: false });
      }
      return;
    }

    if (wireEndpointDrag) {
      setHoveredPinId(findNearestConnectionPin(point)?.id || "");
      if (point) setEndpointDragCoords({ x: Math.round(point.x), y: Math.round(point.y) });
      return;
    }

    if (componentDrag && point) {
      setComponentDrag((current) => {
        if (!current) return current;
        const active = current.active || Math.hypot(point.x - current.startX, point.y - current.startY) > 8;
        return { ...current, active, x: snapWireGrid(point.x), y: snapWireGrid(point.y) };
      });
    }
  };

  const handleSvgPointerUp = (event) => {
    const point = getSvgCursorPoint(event);

    if (legendDrag) {
      setLegendDrag(null);
      return;
    }

    if (rotationDrag) {
      if (point) updateRotationDrag(rotationDrag, point, { persist: true, snap: event.shiftKey ? 15 : 1 });
      commitEditHistory(rotationDrag.historyKey || `infra:${rotationDrag.infraId}`);
      setRotationDrag(null);
      return;
    }

    if (infraResizeDrag) {
      if (point) updateInfrastructureResizeDrag(infraResizeDrag, point, { persist: true });
      commitEditHistory(`infra:${infraResizeDrag.infraId}`);
      setInfraResizeDrag(null);
      return;
    }

    if (wiringMode && !hoveredPinId && !wireRoutePointDrag && !wireEndpointDrag && !componentDrag && !textDrag) {
      if (point) {
        const pinId = `loose:${Math.round(point.x)}:${Math.round(point.y)}`;
        handlePinClick(pinId);
      }
      return;
    }

    if (wireMoveMode && selectedWireId && point && !wireRoutePointDrag && !wireEndpointDrag && !componentDrag && !textDrag) {
      const nearestPin = findNearestConnectionPin(point);
      commitWireEndpointMove(
        selectedWireId,
        wireMoveMode,
        nearestPin?.id || `loose:${Math.round(point.x)}:${Math.round(point.y)}`
      );
      return;
    }

    if (wireSegmentDrag) {
      const dragKey = `wire-route:${wireSegmentDrag.wireId}`;
      if (point) updateWireSegmentDrag(wireSegmentDrag, point, { persist: true });
      commitEditHistory(dragKey);
      setWireSegmentDrag(null);
      return;
    }

    if (wireRoutePointDrag) {
      const dragKey = `wire-route:${wireRoutePointDrag.wireId}`;
      if (point) {
        let nextPoint = { x: Math.round(point.x), y: Math.round(point.y) };
        if (event.shiftKey && wireRoutePointDrag.startPoint) {
          const dx = Math.abs(nextPoint.x - wireRoutePointDrag.startPoint.x);
          const dy = Math.abs(nextPoint.y - wireRoutePointDrag.startPoint.y);
          nextPoint = dx >= dy
            ? { ...nextPoint, y: wireRoutePointDrag.startPoint.y }
            : { ...nextPoint, x: wireRoutePointDrag.startPoint.x };
        }
        updateWireRoutePoint(wireRoutePointDrag.wireId, wireRoutePointDrag.index, nextPoint);
      }
      commitEditHistory(dragKey);
      setWireRoutePointDrag(null);
      return;
    }

    if (textDrag) {
      if (textDrag.annotationId) {
        updateInfrastructure(textDrag.annotationId, {}, { persist: true });
        commitEditHistory(`annotation:${textDrag.annotationId}`);
      } else if (textDrag.infraId) {
        updateInfrastructure(textDrag.infraId, {}, { persist: true });
        commitEditHistory(`infra:${textDrag.infraId}`);
      } else {
        updateWireLabelMeta(textDrag.wireId, {}, { persist: true });
        commitEditHistory(`wire-label:${textDrag.wireId}`);
      }
      setTextDrag(null);
      return;
    }

    if (wireEndpointDrag) {
      setEndpointDragCoords(null);
      const nearestPin = findNearestConnectionPin(point);
      if (nearestPin) {
        commitWireEndpointMove(wireEndpointDrag.wireId, wireEndpointDrag.endpoint, nearestPin.id);
        return;
      }
      if (point) {
        commitWireEndpointMove(wireEndpointDrag.wireId, wireEndpointDrag.endpoint, `loose:${Math.round(point.x)}:${Math.round(point.y)}`);
      }
      return;
    }

    if (componentDrag) {
      const dragKey = `component:${componentDrag.componentId}:move`;
      if (componentDrag.active && point) {
        moveComponentToPoint(componentDrag.componentId, point);
      }
      commitEditHistory(dragKey);
      setComponentDrag(null);
    }
  };

  const handleConnectionPinClick = (event, pinId) => {
    event.stopPropagation();
    if (wireEndpointDrag) {
      commitWireEndpointMove(wireEndpointDrag.wireId, wireEndpointDrag.endpoint, pinId);
      return;
    }
    handlePinClick(pinId);
  };

  const ductedWiringPlan = useMemo(() => {
    const solarIncomingGroups = new Map();
    const distributionGroups = new Map();
    const solarProtectionGroups = new Map();
    const solarServiceToInverterGroups = new Map();
    const plan = {
      solarIncomingPhaseGroups: [],
      servicePower: [],
      phaseOutputs: [],
      neutralBranches: [],
      groundBranches: [],
      solarProtectionPhaseGroups: [],
      solarServiceToInverterGroups: [],
      phaseDistributionGroups: [],
    };

    routedWires.forEach((descriptor) => {
      if (isSolarIncomingPhaseWire(descriptor)) {
        const terminalPin = descriptor.sourceMeta?.type === "incoming"
          ? descriptor.wire?.source
          : descriptor.wire?.target;
        const key = [descriptor.color, terminalPin].join(":");
        const group = solarIncomingGroups.get(key) || [];
        group.push(descriptor);
        solarIncomingGroups.set(key, group);
        return;
      }

      if (isSolarServiceToInverterWire(descriptor)) {
        const key = [
          descriptor.sourceMeta?.railIndex,
          descriptor.targetMeta?.railIndex,
          String(descriptor.wire?.source || "").replace(/:bottom:\d+$/, ""),
          String(descriptor.wire?.target || "").replace(/:top:\d+$/, ""),
        ].join(":");
        const group = solarServiceToInverterGroups.get(key) || [];
        group.push(descriptor);
        solarServiceToInverterGroups.set(key, group);
        return;
      }

      if (isSolarProtectionDistributionWire(descriptor)) {
        const key = [
          descriptor.color,
          descriptor.sourceMeta?.railIndex,
          descriptor.sourceMeta?.poleIndex,
        ].join(":");
        const group = solarProtectionGroups.get(key) || [];
        group.push(descriptor);
        solarProtectionGroups.set(key, group);
        return;
      }

      if (isDistributionInputWire(descriptor)) {
        const key = [
          descriptor.color,
          descriptor.sourceMeta?.railIndex,
          descriptor.sourceMeta?.poleIndex,
          descriptor.targetMeta?.railIndex,
        ].join(":");
        const group = distributionGroups.get(key) || [];
        group.push(descriptor);
        distributionGroups.set(key, group);
        return;
      }

      if (isPowerLoadOutputWire(descriptor)) {
        plan.phaseOutputs.push(descriptor);
        return;
      }

      if (isTerminalFeedWire(descriptor)) {
        plan.servicePower.push(descriptor);
        return;
      }

      if (descriptor.kind === "neutral") {
        plan.neutralBranches.push(descriptor);
        return;
      }

      if (descriptor.kind === "ground") {
        plan.groundBranches.push(descriptor);
        return;
      }

      plan.servicePower.push(descriptor);
    });

    plan.solarIncomingPhaseGroups = Array.from(solarIncomingGroups.entries()).map(([key, descriptors]) => ({
      key,
      color: descriptors[0]?.color || "black",
      descriptors: [...descriptors].sort((a, b) => {
        const aDevice = a.sourceMeta?.type === "component" ? a.p1 : a.p2;
        const bDevice = b.sourceMeta?.type === "component" ? b.p1 : b.p2;
        return aDevice.x - bDevice.x || String(a.wire?.id || "").localeCompare(String(b.wire?.id || ""));
      }),
    })).sort((a, b) => (
      phaseLaneOffset(a.color) - phaseLaneOffset(b.color)
      || String(a.key).localeCompare(String(b.key))
    ));

    plan.solarProtectionPhaseGroups = Array.from(solarProtectionGroups.entries()).map(([key, descriptors]) => ({
      key,
      color: descriptors[0]?.color || "black",
      descriptors: [...descriptors].sort((a, b) => (
        a.p2.x - b.p2.x
        || String(a.wire?.id || "").localeCompare(String(b.wire?.id || ""))
      )),
    })).sort((a, b) => (
      phaseLaneOffset(a.color) - phaseLaneOffset(b.color)
      || String(a.key).localeCompare(String(b.key))
    ));

    plan.solarServiceToInverterGroups = Array.from(solarServiceToInverterGroups.entries()).map(([key, descriptors]) => ({
      key,
      descriptors: [...descriptors].sort((a, b) => (
        (a.sourceMeta?.poleIndex ?? 0) - (b.sourceMeta?.poleIndex ?? 0)
        || a.p1.x - b.p1.x
        || String(a.wire?.id || "").localeCompare(String(b.wire?.id || ""))
      )),
    })).sort((a, b) => String(a.key).localeCompare(String(b.key)));

    plan.phaseDistributionGroups = Array.from(distributionGroups.entries()).map(([key, descriptors]) => ({
      key,
      color: descriptors[0]?.color || "black",
      descriptors: [...descriptors].sort(compareCircuitDescriptors),
    })).sort((a, b) => (
      (a.descriptors[0]?.targetMeta?.railIndex ?? 0) - (b.descriptors[0]?.targetMeta?.railIndex ?? 0)
      || phaseLaneOffset(a.color) - phaseLaneOffset(b.color)
      || String(a.key).localeCompare(String(b.key))
    ));

    plan.phaseOutputs.sort(compareCircuitDescriptors);
    plan.neutralBranches.sort(compareCircuitDescriptors);
    plan.groundBranches.sort(compareCircuitDescriptors);
    plan.servicePower.sort((a, b) => a.originalIndex - b.originalIndex);

    return plan;
  }, [routedWires]);

  const neutralBackboneEndY = useMemo(() => {
    const endpoints = ductedWiringPlan.neutralBranches.flatMap((descriptor) => (
      getBusbarBranchEndpoints(descriptor).map(({ point }) => point.y)
    ));
    if (!endpoints.length) return getNeutralBackboneTopY();
    return Math.max(
      getNeutralBackboneTopY() + 22,
      Math.min(panelHeight - 120, snapWireGrid(Math.max(...endpoints)))
    );
  }, [ductedWiringPlan.neutralBranches, panelHeight]);
  const showNeutralBackbone = false;

  const activeScale = clampPanelScale(scale ?? fitScale);
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !project) return;

    const updateFitScale = () => {
      const availableWidth = Math.max(300, node.clientWidth - 32);
      setFitScale(clampPanelScale(availableWidth / PANEL_W));
    };

    updateFitScale();
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [project, rails.length]);

  const handleFitViewport = () => {
    setScale(null);
    requestAnimationFrame(() => {
      const node = panelViewportRef.current;
      if (!node) return;
      const left = Math.max(0, (node.scrollWidth - node.clientWidth) / 2);
      const top = Math.max(0, (node.scrollHeight - node.clientHeight) / 2);
      node.scrollTo({ left, top, behavior: "smooth" });
    });
  };

  // AÇÕES DO COMPONENTE SELECIONADO
  const findComponentPlacement = (componentId, sourceRails = rails) => {
    const id = String(componentId || "");
    if (!id) return null;
    for (let railIndex = 0; railIndex < sourceRails.length; railIndex += 1) {
      const rail = sourceRails[railIndex];
      const componentIndex = (rail.components || []).findIndex((item) => String(item.id) === id);
      if (componentIndex >= 0) {
        return {
          component: rail.components[componentIndex],
          rail,
          railId: rail.id,
          railIndex,
          componentIndex,
        };
      }
    }
    return null;
  };

  const getSelectedComponent = () => findComponentPlacement(selectedComponentId);

  const handleUpdateComponent = (field, value, options = {}) => {
    const updated = rails.map(r => ({
      ...r,
      components: r.components.map(c => {
        if (c.id === selectedComponentId) {
          return { ...c, [field]: value };
        }
        return c;
      })
    }));
    updateRails(updated, options);
  };

  const handleUpdateComponentFields = (updates, options = {}) => {
    const selected = getSelectedComponent()?.component;
    const updated = rails.map(r => ({
      ...r,
      components: r.components.map(c => {
        if (c.id === selectedComponentId) {
          return { ...c, ...updates };
        }
        return c;
      })
    }));
    updateRails(updated, options);

    const circuitRef = selected?.circuit_id || selected?.source_point_id;
    const circuitUpdates = {};
    if (Object.prototype.hasOwnProperty.call(updates, "name")) circuitUpdates.name = updates.name;
    if (Object.prototype.hasOwnProperty.call(updates, "label")) circuitUpdates.label = updates.label;
    if (Object.prototype.hasOwnProperty.call(updates, "circuitLabel")) circuitUpdates.label = updates.circuitLabel;
    if (Object.prototype.hasOwnProperty.call(updates, "circuitNumber")) circuitUpdates.circuitNumber = updates.circuitNumber;
    if (Object.prototype.hasOwnProperty.call(updates, "description")) circuitUpdates.description = updates.description;
    if (Object.prototype.hasOwnProperty.call(updates, "phase")) circuitUpdates.phase = updates.phase;
    if (Object.prototype.hasOwnProperty.call(updates, "conductorSection")) circuitUpdates.conductorSection = updates.conductorSection;

    if (selectedId && project && circuitRef && Object.keys(circuitUpdates).length > 0) {
      const nextCircuits = (project.circuits || []).map((circuit) => {
        const matches = [circuit.id, circuit.circuit_id, circuit.source_point_id, circuit.source]
          .filter(Boolean)
          .some((key) => String(key) === String(circuitRef));
        return matches ? { ...circuit, ...circuitUpdates } : circuit;
      });
      setProject((current) => current ? { ...current, circuits: nextCircuits } : current);
      backend.entities.Project.update(selectedId, { circuits: nextCircuits }).catch((error) => {
        console.error("Erro ao salvar identificação do circuito:", error);
      });
    }
  };

  const handleDeleteComponent = (componentId = selectedComponentId) => {
    const targetId = String(componentId || "");
    if (!targetId) return false;
    const placement = findComponentPlacement(targetId);
    if (!placement?.component) {
      setSelectedComponentId("");
      return false;
    }

    const { component } = placement;
    if (isProtectedPanelComponent(component)) {
      window.alert("Este elemento faz parte da estrutura obrigatória do quadro e não pode ser excluído.");
      setSelectedComponentId("");
      return true;
    }

    const linkedWires = wires.filter((wire) => wireReferencesComponent(wire, targetId));
    const linkedRouteWireIds = Object.entries(wireRouteMetaRef.current || {})
      .filter(([, meta]) => wireReferencesComponent(meta?.wire, targetId))
      .map(([wireId]) => wireId);
    const linkedWireIds = uniqueStrings([
      ...linkedWires.map((wire) => wire.id),
      ...linkedRouteWireIds,
    ].filter(Boolean));
    const updatedRails = rails.map((rail) => ({
      ...rail,
      components: (rail.components || []).filter((item) => String(item.id) !== targetId),
    }));
    const nextWires = wires.filter((wire) => (
      !wireReferencesComponent(wire, targetId) &&
      !linkedWireIds.includes(String(wire.id || ""))
    ));
    const removedWireIds = linkedWireIds;
    removedWireIds.forEach((wireId) => {
      delete wirePathsRef.current[wireId];
      delete wireRouteMetaRef.current[wireId];
    });
    const nextInfrastructureBase = infrastructure.filter((item) => !infrastructureReferencesComponent(item, targetId));
    const nextInfrastructure = upsertPanelLayoutMeta(nextInfrastructureBase, {
      manualDeviceEdits: true,
      lastAction: "delete-component",
      deletedComponentIds: [targetId],
      deletedCircuitRefs: componentCircuitRefs(component),
      deletedWireIds: removedWireIds,
    });
    const normalizedRails = normalizeRailsLayout(updatedRails);

    setRails(normalizedRails);
    setWires(nextWires);
    setInfrastructure(nextInfrastructure);
    saveLayoutToDb(normalizedRails, nextWires, nextInfrastructure);
    setSelectedComponentId("");
    setSelectedWireId("");
    setSelectedTextWireId("");
    setSelectedAnnotationId("");
    setSelectedInfrastructureId("");
    setSelectedRoutePoint(null);
    setWireMoveMode("");
    setWireEndpointDrag(null);
    setWireRoutePointDrag(null);
    setWiringStart("");
    return true;
  };

  const handleMoveComponent = (direction) => {
    const sel = getSelectedComponent();
    if (!sel) return;
    const { component, railId } = sel;
    
    const updated = rails.map(r => {
      if (r.id !== railId) return r;
      const index = r.components.findIndex(c => c.id === component.id);
      const nextComponents = [...r.components];
      
      if (direction === "left" && index > 0) {
        // Swap left
        const temp = nextComponents[index - 1];
        nextComponents[index - 1] = nextComponents[index];
        nextComponents[index] = temp;
      } else if (direction === "right" && index < nextComponents.length - 1) {
        // Swap right
        const temp = nextComponents[index + 1];
        nextComponents[index + 1] = nextComponents[index];
        nextComponents[index] = temp;
      }

      let nextDinPosition = 1;
      const compactedComponents = nextComponents.map((item) => {
        if (item.type === "spacer") return item;
        const dinSize = Math.max(1, Number(item.poles) || 1);
        const compacted = {
          ...item,
          dinPosition: nextDinPosition,
          startDin: nextDinPosition,
          slot: nextDinPosition,
          moduleWidth: dinSize,
          dinSize,
          poles: dinSize,
        };
        nextDinPosition += dinSize;
        return compacted;
      });
      
      return { ...r, components: compactedComponents };
    });
    updateRails(updated);
  };

  const handleMoveToRail = (targetRailId) => {
    const sel = getSelectedComponent();
    if (!sel) return;
    const { component, railId } = sel;
    if (railId === targetRailId) return;

    const updated = rails.map(r => {
      if (r.id === railId) {
        return { ...r, components: r.components.filter(c => c.id !== component.id) };
      }
      if (r.id === targetRailId) {
        // Remove reserva se for o único spacer
        const hasComponents = r.components.some(c => c.type !== "spacer");
        const list = hasComponents ? r.components : [];
        return { ...r, components: [...list, component] };
      }
      return r;
    });
    updateRails(updated);
  };

  const handleToggleRail = (cId) => {
    let currentRailIdx = -1;
    for (let i = 0; i < rails.length; i++) {
      if (rails[i].components.some(item => item.id === cId)) {
        currentRailIdx = i;
        break;
      }
    }
    if (currentRailIdx === -1) return;
    const nextRailIdx = (currentRailIdx + 1) % rails.length;
    const targetRailId = rails[nextRailIdx].id;
    handleMoveToRail(targetRailId);
  };

  // ADICIONAR COMPONENTE
  const handleAddComponent = (e) => {
    e.preventDefault();
    const newId = `comp_${Date.now()}`;
    const phaseConfig = phaseTypeConfig[newCompSupplyType] || phaseTypeConfig.Monofásico;
    const normalizedLabel = cleanDisplayText(newCompLabel) || "Circuito sem identificação";
    const comp = {
      id: newId,
      type: newCompType,
      label: normalizedLabel,
      name: normalizedLabel,
      circuitLabel: normalizedLabel,
      circuitNumber: "",
      description: "",
      current: parseInt(newCompCurrent, 10) || 16,
      curve: newCompCurve,
      poles: newCompType === "breaker" ? phaseConfig.poles : parseInt(newCompPoles, 10) || 1,
      phase: newCompType === "breaker" ? phaseConfig.phase : newCompPhase,
      supply_type: newCompType === "breaker" ? newCompSupplyType : undefined,
      conductorSection: parseInt(newCompCurrent, 10) >= 40 ? "10mm²" : "6mm²",
      status: "ON"
    };

    if (newCompType === "dps") {
      comp.dpsStatus = "OK";
    }

    const updated = rails.map(r => {
      if (r.id !== newCompRail) return r;
      // Adiciona limpando o spacer padrão se necessário
      const cleanList = r.components.filter(c => c.type !== "spacer");
      return { ...r, components: [...cleanList, comp] };
    });
    const normalizedRails = normalizeRailsLayout(updated);
    let nextWires = wires;
    if (newCompType === "breaker") {
      const sourceCompId = rails.some((rail) => rail.components?.some((item) => item.id === "gen_dr")) ? "gen_dr" : "gen_brk";
      const gauge = parseInt(newCompCurrent, 10) >= 40 ? "10mm²" : "6mm²";
      const label = parseInt(newCompCurrent, 10) >= 40 ? "10 mm²" : "6 mm²";
      const phaseWires = Array.from({ length: phaseConfig.poles }).flatMap((_, poleIndex) => {
        const color = phaseWireColor(poleIndex);
        return [
          {
            id: `wire_${newId}_phase_in_${poleIndex}`,
            color,
            gauge,
            name: `${getConductorDisplayLabel({ color })} — ${normalizedLabel}`,
            circuit_id: newId,
            circuitName: normalizedLabel,
            circuitLabel: normalizedLabel,
            conductorType: "phase",
            phase: `L${poleIndex + 1}`,
            source: `comp:${sourceCompId}:bottom:${poleIndex}`,
            target: `comp:${newId}:top:${poleIndex}`,
            label,
          },
          {
            id: `wire_${newId}_phase_out_${poleIndex}`,
            color,
            gauge,
            name: `${getConductorDisplayLabel({ color })} — ${normalizedLabel}`,
            circuit_id: newId,
            circuitName: normalizedLabel,
            circuitLabel: normalizedLabel,
            conductorType: "phase",
            phase: `L${poleIndex + 1}`,
            source: `comp:${newId}:bottom:${poleIndex}`,
            target: `load_out:${newId}:${poleIndex}`,
            label,
          },
        ];
      });
      const neutralWire = newCompSupplyType === "Monofásico"
        ? [{
            id: `wire_${newId}_neutral`,
            color: "blue",
            gauge: "2.5mm²",
            name: `Neutro — ${normalizedLabel}`,
            circuit_id: newId,
            circuitName: normalizedLabel,
            circuitLabel: normalizedLabel,
            conductorType: "neutral",
            source: "busbar_neutral:1",
            target: `load_out:${newId}:neutral`,
            label: "2.5 mm²",
          }]
        : [];
      const groundWire = [{
        id: `wire_${newId}_ground`,
        color: "green",
        gauge: "2.5mm²",
        name: `Terra — ${normalizedLabel}`,
        circuit_id: newId,
        circuitName: normalizedLabel,
        circuitLabel: normalizedLabel,
        conductorType: "ground",
        source: "busbar_ground:1",
        target: `load_out:${newId}:ground`,
        label: "2.5 mm²",
      }];
      nextWires = [...wires, ...phaseWires, ...neutralWire, ...groundWire];
    }
    const nextInfrastructure = upsertPanelLayoutMeta(infrastructure, {
      manualDeviceEdits: true,
      lastAction: "add-component",
      addedComponentIds: [newId],
    });
    setRails(normalizedRails);
    setWires(nextWires);
    setInfrastructure(nextInfrastructure);
    saveLayoutToDb(normalizedRails, nextWires, nextInfrastructure);
    setSelectedComponentId(newId);
  };

  // EXPORTAR SVG
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgStr = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quadro_${activeBoard?.name || project?.name || "eletrico"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // WIRING INTERATIVO
  const handlePinClick = (pinId) => {
    if (wireMoveMode === "source" && selectedWireId) {
      if (isCableLocked(getEditableWire(selectedWireId))) return;
      commitWireEndpointMove(selectedWireId, "source", pinId);
      return;
    }
    if (wireMoveMode === "target" && selectedWireId) {
      if (isCableLocked(getEditableWire(selectedWireId))) return;
      commitWireEndpointMove(selectedWireId, "target", pinId);
      return;
    }

    if (!wiringMode) return;
    if (!wiringStart) {
      setWiringStart(pinId);
    } else {
      if (wiringStart === pinId) {
        setWiringStart("");
        return;
	      }
	      // Conectar
	      const manualName = cleanDisplayText(wireName);
	      const manualDisplayText = cleanDisplayText(wireDisplayText);
	      const newWire = {
	        id: `wire_${Date.now()}`,
	        name: manualName || `${getConductorDisplayLabel({ color: wireColor })} manual`,
        color: wireColor,
        gauge: wireGauge,
        section: wireGauge,
        conductorType: conductorTypeFromWire({ color: wireColor }),
        routeMode: "manual",
        routingMode: "manual",
        lineStyle: "solid",
        cornerRadius: DEFAULT_CABLE_CORNER_RADIUS,
        locked: false,
        visible: true,
        source: wiringStart,
        target: pinId,
        sourceComponentId: getCableComponentId(wiringStart),
        sourcePortId: wiringStart,
        targetComponentId: getCableComponentId(pinId),
        targetPortId: pinId,
	        points: [],
	        originId: wiringStart,
	        destinationId: pinId,
	        label: wireGauge,
	        labelMeta: manualDisplayText
	          ? {
	              text: manualDisplayText,
	              hidden: false,
	              fontSize: 7,
	              rotation: wireColor === "green" || wireColor === "blue" ? 0 : -90,
	            }
	          : undefined,
	      };
	      const nextWires = [...wires, newWire];
      updateWires(nextWires);
      setSelectedWireId(newWire.id);
      setSelectedComponentId("");
      setActiveTab("wiring");
      setWiringStart("");
	      setWiringMode(false);
	      setHoveredPinId("");
	      setWireName("");
	      setWireDisplayText("");
	    }
	  };

  const handleResetLayout = () => {
    if (!window.confirm("Deseja realmente redefinir o quadro elétrico? Isso apagará todas as customizações.")) return;
    const rawLayout = generateDefaultPanelLayout(project, { forceDistribution: activeBoard?.type !== "solar_ac" });
    const def = normalizeSolarPanelLayout(project, activeBoard?.type, activeSupplyType, rawLayout);
    setRails(def.rails || []);
    setWires(def.wires || []);
    setInfrastructure(def.infrastructure || []);
    saveLayoutToDb(def.rails || [], def.wires || [], def.infrastructure || []);
    setSelectedComponentId("");
    setSelectedWireId("");
  };

  const handleClearWires = () => {
    if (window.confirm("Excluir toda a fiação?")) {
      updateWires([]);
    }
  };

  // Helper para atualizar propriedades do fio selecionado
  const handleUpdateWire = (wireId, field, value, options = {}) => {
    const shouldRemoveField = value === undefined || value === null || value === "";
    const buildFieldUpdates = (base = {}) => {
      if (shouldRemoveField) return {};
      const updates = { [field]: value };
      if (field === "color") {
        updates.conductorType = conductorTypeFromWire({ color: value });
      }
      if (field === "routeMode" || field === "routingMode") {
        updates.routeMode = value;
        updates.routingMode = value;
      }
      if (field === "source" || field === "target") {
        updates[`${field}PortId`] = value;
        updates[`${field}ComponentId`] = getCableComponentId(value);
      }
      if (field === "cornerRadius") {
        updates.cornerRadius = clampNumber(value, 0, 24, DEFAULT_CABLE_CORNER_RADIUS);
      }
      if (field === "locked") {
        updates.locked = Boolean(value);
      }
      if (field === "visible") {
        updates.visible = value !== false;
      }
      return buildWireRecordFromVisual(wireId, { ...base, ...updates });
    };
    let found = false;
    let updatedWire = null;
    const nextWires = wires.map((wire) => {
      if (wire.id !== wireId) return wire;
      found = true;
      if (!shouldRemoveField) {
        updatedWire = buildFieldUpdates(wire);
        return updatedWire;
      }
      const { [field]: removed, ...rest } = wire;
      void removed;
      updatedWire = rest;
      return rest;
    });
    
    if (!found && !shouldRemoveField) {
      // Allow editing of dynamically generated branch wires
      updatedWire = buildFieldUpdates();
      nextWires.push(updatedWire);
    }

    const cachedRoute = wireRouteMetaRef.current[wireId];
    if (cachedRoute) {
      let cachedWire = { ...(cachedRoute.wire || {}) };
      if (shouldRemoveField) {
        const { [field]: removed, ...rest } = cachedWire;
        void removed;
        cachedWire = rest;
      } else {
        cachedWire = { ...cachedWire, [field]: value };
        if (field === "color") {
          cachedWire.conductorType = conductorTypeFromWire({ color: value });
        }
      }

      const nextCachedWire = updatedWire || cachedWire;
      wireRouteMetaRef.current[wireId] = {
        ...cachedRoute,
        wire: nextCachedWire,
        color: nextCachedWire.color
          ? wireDisplayColor(normalizedWireColor(nextCachedWire))
          : cachedRoute.color,
        thickness: getEffectiveWireThickness(nextCachedWire, cachedRoute.thickness),
      };
    }
    
    updateWires(nextWires, options);
  };

  const selectComponent = (componentId) => {
    setSelectedComponentId(componentId);
    setSelectedWireId("");
    setSelectedTextWireId("");
    setSelectedAnnotationId("");
    setSelectedInfrastructureId("");
    setSelectedRoutePoint(null);
    setActiveTab("components");
  };

  // Helper para renderizar controles flutuantes acima dos componentes selecionados
  const renderFloatingControls = (c, x, y, W) => {
    const cx = x + W / 2;
    const bx = cx - 48;
    const by = y - 24;
    
    return (
      <g key={`controls-${c.id}`} className="no-select select-none" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        {/* Outline pontilhado ao redor do componente para indicar seleção */}
        <rect x={x - 2} y={y - 2} width={W + 4} height={BRK_H + 4} rx="6" fill="none" stroke="#00d8b8" strokeWidth="2" strokeDasharray="4,3" />
        
        {/* Fundo da barra de ferramentas flutuante */}
        <rect x={bx} y={by} width="96" height="18" rx="5" fill="#1e293b" stroke="#334155" strokeWidth="1" filter="url(#shadow)" />
        
        {/* Botão Mover Esquerda */}
        <g className="cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); handleMoveComponent("left"); }}>
          <rect x={bx + 2} y={by + 2} width="20" height="14" rx="3" fill="#334155" />
          <text x={bx + 12} y={by + 11} fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">←</text>
        </g>
        
        {/* Botão Mover Direita */}
        <g className="cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); handleMoveComponent("right"); }}>
          <rect x={bx + 24} y={by + 2} width="20" height="14" rx="3" fill="#334155" />
          <text x={bx + 34} y={by + 11} fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">→</text>
        </g>
        
        {/* Botão Alternar Trilho */}
        <g className="cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); handleToggleRail(c.id); }}>
          <rect x={bx + 46} y={by + 2} width="24" height="14" rx="3" fill="#00d8b8" />
          <text x={bx + 58} y={by + 11} fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">Trilho</text>
        </g>
        
        {/* Botão Excluir */}
        <g className="cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); handleDeleteComponent(c.id); }}>
          <rect x={bx + 72} y={by + 2} width="22" height="14" rx="3" fill="#ef4444" />
          <text x={bx + 83} y={by + 11} fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">×</text>
        </g>
      </g>
    );
  };

  const getCombBusbarGroups = (rail = {}) => {
    const groups = [];
    let currentGroup = [];
    let currentX = 160;

    for (const c of rail.components || []) {
      const compW = c.poles * MOD;
      const x = currentX;
      currentX += compW + 2;

      if (c.type === "breaker" || c.type === "dps" || c.type === "dr") {
        currentGroup.push({ c, x, width: compW });
      } else {
        if (currentGroup.length >= 2) {
          groups.push([...currentGroup]);
        }
        currentGroup = [];
      }
    }
    if (currentGroup.length >= 2) groups.push(currentGroup);
    return groups;
  };

  const renderRotationHandle = ({ key, centerX, centerY, handleX, handleY, onPointerDown, label = "Girar" }) => (
    <g key={key} className="cursor-grab active:cursor-grabbing" onPointerDown={onPointerDown}>
      <title>{label}</title>
      <line
        x1={centerX}
        y1={centerY}
        x2={handleX}
        y2={handleY}
        stroke="#00d8b8"
        strokeWidth="1.1"
        strokeDasharray="3,2"
        pointerEvents="none"
      />
      <circle cx={handleX} cy={handleY} r="8" fill="#ffffff" stroke="#00d8b8" strokeWidth="1.8" filter="url(#shadow)" />
      <path
        d={`M ${handleX - 3.5} ${handleY - 0.5}a3.8 3.8 0 1 1 2.3 3.5`}
        fill="none"
        stroke="#0f766e"
        strokeWidth="1.2"
        strokeLinecap="round"
        pointerEvents="none"
      />
      <path d={`M ${handleX + 0.3} ${handleY + 3.6}l3.2 0.3l-1.3 -2.8z`} fill="#0f766e" pointerEvents="none" />
    </g>
  );

  // Helper para renderizar barramentos pentes (comb busbars) sobre os componentes adjacentes
  const renderCombBusbars = () => {
    const freeCombBusbars = infrastructure.filter((item) => isFreeCombBusbarId(item?.id) && !item.deleted);
    return (
      <g id="comb-busbars">
        {rails.map((r, rIdx) => {
      const railY = 190 + rIdx * 240;
      const y = railY - 45;
      const groups = getCombBusbarGroups(r);

      return (
        <g key={`comb-rail-${r.id}`}>
          {groups.map((group, gIdx) => {
            const first = group[0];
            const last = group[group.length - 1];
            const defaultX = first.x + 4;
            const defaultWidth = (last.x + last.width) - first.x - 8;
            const defaultY = y - 4; // Logo acima do parafuso
            const combId = makeCombBusbarId(r.id, gIdx);
            const combSettings = infrastructure.find((item) => item.id === combId) || {};

            const rawX = Number(combSettings.x);
            const rawY = Number(combSettings.y);
            const rawWidth = Number(combSettings.width);
            const bx = Number.isFinite(rawX) ? rawX : defaultX;
            const by = Number.isFinite(rawY) ? rawY : defaultY;
            const bw = clampNumber(rawWidth, 18, PANEL_W - 40, defaultWidth);
            const barHeight = clampNumber(combSettings.height, 4, 18, 8);
            const toothHeight = clampNumber(combSettings.toothHeight, 4, 22, 10);
            const conductorColor = combSettings.conductorColor || "#ca8a04";
            const strokeColor = combSettings.strokeColor || "#ca8a04";
            const fillColor = combSettings.color || "url(#combBusbar)";
            const xOffset = bx - defaultX;
            const isSelected = selectedInfrastructureId === combId;
            const label = String(combSettings.label || "").trim();
            const combRotation = Number(combSettings.rotation) || 0;
            const combCenterX = bx + bw / 2;
            const combCenterY = by + (barHeight + toothHeight) / 2;
            const combTransform = combRotation ? `rotate(${combRotation} ${combCenterX} ${combCenterY})` : undefined;

            return (
              <g
                key={combId}
                id={combId}
                transform={combTransform}
                opacity="0.95"
                className="cursor-move"
                onPointerDown={(event) => startInfraTextDrag(event, combId, bx, by)}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!wiringMode && !wireMoveMode) selectInfrastructure(combId);
                }}
              >
                <title>Editar barramento pente</title>
                {isSelected && (
                  <rect
                    x={bx - 8}
                    y={by - 8}
                    width={bw + 16}
                    height={barHeight + toothHeight + 18}
                    rx="6"
                    fill="none"
                    stroke="#00d8b8"
                    strokeWidth="1.5"
                    strokeDasharray="4,3"
                    pointerEvents="none"
                  />
                )}
                {/* Barra de isolamento amarela (plástico do pente) */}
                <rect x={bx} y={by} width={bw} height={barHeight} rx="2" fill={fillColor} stroke={isSelected ? "#00d8b8" : strokeColor} strokeWidth={isSelected ? 1.3 : 0.8} filter="url(#shadow)" />
                <rect x={bx + 2} y={by + 2} width={Math.max(0, bw - 4)} height="2" fill="#ffffff" fillOpacity="0.4" pointerEvents="none" />
                
                {/* Dentes de cobre exatamente em cada polo de cada componente do grupo */}
	                {group.map((item) => {
	                  return Array.from({ length: item.c.poles }).map((_, pi) => {
	                    const px = item.x + xOffset + pi * MOD + MOD / 2 - 2;
	                    if (!isCombToothVisible(px, bx, bw)) return null;
	                    return (
	                      <rect
	                        key={`${item.c.id}-${pi}`}
	                        x={px}
	                        y={by + barHeight}
	                        width={COMB_TOOTH_WIDTH}
	                        height={toothHeight}
	                        fill={conductorColor}
	                        stroke="#854d0e"
                        strokeWidth="0.5"
                        pointerEvents="none"
                      />
                    );
                  });
                })}
                {isSelected && (
                  <g>
                    <rect x={bx + Math.max(0, bw - 76)} y={by - 21} width="76" height="16" rx="4" fill="#0f172a" opacity="0.92" />
                    <text x={bx + Math.max(0, bw - 38)} y={by - 10} fill="#ffffff" fontSize="6.4" fontWeight="950" textAnchor="middle">
                      Editar barramento
                    </text>
                    <rect
                      x={bx - 7}
                      y={by + barHeight / 2 - 7}
                      width="10"
                      height={barHeight + toothHeight + 10}
                      rx="4"
                      fill="#ffffff"
                      stroke="#00d8b8"
                      strokeWidth="1.4"
                      className="cursor-ew-resize"
                      onPointerDown={(event) => startInfrastructureResizeDrag(event, combId, "left", { x: bx, y: by, width: bw })}
                    />
                    <rect
                      x={bx + bw - 3}
                      y={by + barHeight / 2 - 7}
                      width="10"
                      height={barHeight + toothHeight + 10}
                      rx="4"
                      fill="#ffffff"
                      stroke="#00d8b8"
                      strokeWidth="1.4"
	                      className="cursor-ew-resize"
	                      onPointerDown={(event) => startInfrastructureResizeDrag(event, combId, "right", { x: bx, y: by, width: bw })}
	                    />
                    {renderRotationHandle({
                      key: `${combId}-rotate`,
                      centerX: combCenterX,
                      centerY: combCenterY,
                      handleX: combCenterX,
                      handleY: by - 31,
                      label: "Girar barramento",
                      onPointerDown: (event) => startRotationDrag(event, {
                        infraId: combId,
                        centerX: combCenterX,
                        centerY: combCenterY,
                        historyKey: `infra:${combId}`,
                        onSelect: () => selectInfrastructure(combId),
                      }),
                    })}
	                  </g>
	                )}
                {label && (
                  <text
                    x={combSettings.labelX ?? (bx + bw / 2)}
                    y={combSettings.labelY ?? (by - 7)}
                    fill={combSettings.labelColor || "#854d0e"}
                    fontSize={combSettings.fontSize || 6.4}
                    fontWeight="950"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      );
        })}
        {freeCombBusbars.map((combSettings) => {
          const combId = combSettings.id;
          const rawX = Number(combSettings.x);
          const rawY = Number(combSettings.y);
          const rawWidth = Number(combSettings.width);
          const bx = Number.isFinite(rawX) ? rawX : 220;
          const by = Number.isFinite(rawY) ? rawY : 360;
          const bw = clampNumber(rawWidth, 18, PANEL_W - 40, 180);
          const barHeight = clampNumber(combSettings.height, 4, 18, 8);
          const toothHeight = clampNumber(combSettings.toothHeight, 4, 22, 10);
          const toothGap = clampNumber(combSettings.toothGap, 8, 60, MOD);
          const conductorColor = combSettings.conductorColor || "#ca8a04";
          const strokeColor = combSettings.strokeColor || "#ca8a04";
          const fillColor = combSettings.color || "url(#combBusbar)";
          const isSelected = selectedInfrastructureId === combId;
          const label = String(combSettings.label || "").trim();
          const combRotation = Number(combSettings.rotation) || 0;
          const combCenterX = bx + bw / 2;
          const combCenterY = by + (barHeight + toothHeight) / 2;
          const combTransform = combRotation ? `rotate(${combRotation} ${combCenterX} ${combCenterY})` : undefined;
          const toothXs = [];
		          for (let px = bx + Math.max(6, toothGap / 2 - COMB_TOOTH_WIDTH / 2); px <= bx + bw; px += toothGap) {
		            if (isCombToothVisible(px, bx, bw)) toothXs.push(px);
		          }

          return (
            <g
	              key={combId}
	              id={combId}
              transform={combTransform}
	              opacity="0.95"
	              className="cursor-move"
	              onPointerDown={(event) => startInfraTextDrag(event, combId, bx, by)}
              onClick={(event) => {
                event.stopPropagation();
                if (!wiringMode && !wireMoveMode) selectInfrastructure(combId);
              }}
            >
              <title>Barramento pente livre</title>
              {isSelected && (
                <rect
                  x={bx - 8}
                  y={by - 8}
                  width={bw + 16}
                  height={barHeight + toothHeight + 18}
                  rx="6"
                  fill="none"
                  stroke="#00d8b8"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  pointerEvents="none"
                />
              )}
              <rect x={bx} y={by} width={bw} height={barHeight} rx="2" fill={fillColor} stroke={isSelected ? "#00d8b8" : strokeColor} strokeWidth={isSelected ? 1.3 : 0.8} filter="url(#shadow)" />
              <rect x={bx + 2} y={by + 2} width={Math.max(0, bw - 4)} height="2" fill="#ffffff" fillOpacity="0.4" pointerEvents="none" />
              {toothXs.map((px, index) => (
                <rect
                  key={`${combId}-tooth-${index}`}
	                  x={px}
	                  y={by + barHeight}
	                  width={COMB_TOOTH_WIDTH}
                  height={toothHeight}
                  fill={conductorColor}
                  stroke="#854d0e"
                  strokeWidth="0.5"
                  pointerEvents="none"
                />
              ))}
              {isSelected && (
                <g>
                  <rect x={bx + Math.max(0, bw - 84)} y={by - 21} width="84" height="16" rx="4" fill="#0f172a" opacity="0.92" />
                  <text x={bx + Math.max(0, bw - 42)} y={by - 10} fill="#ffffff" fontSize="6.4" fontWeight="950" textAnchor="middle">
                    Pente livre
                  </text>
                  <rect
                    x={bx - 7}
                    y={by + barHeight / 2 - 7}
                    width="10"
                    height={barHeight + toothHeight + 10}
                    rx="4"
                    fill="#ffffff"
                    stroke="#00d8b8"
                    strokeWidth="1.4"
                    className="cursor-ew-resize"
                    onPointerDown={(event) => startInfrastructureResizeDrag(event, combId, "left", { x: bx, y: by, width: bw })}
                  />
                  <rect
                    x={bx + bw - 3}
                    y={by + barHeight / 2 - 7}
                    width="10"
                    height={barHeight + toothHeight + 10}
                    rx="4"
                    fill="#ffffff"
                    stroke="#00d8b8"
                    strokeWidth="1.4"
	                    className="cursor-ew-resize"
	                    onPointerDown={(event) => startInfrastructureResizeDrag(event, combId, "right", { x: bx, y: by, width: bw })}
	                  />
                  {renderRotationHandle({
                    key: `${combId}-rotate`,
                    centerX: combCenterX,
                    centerY: combCenterY,
                    handleX: combCenterX,
                    handleY: by - 31,
                    label: "Girar barramento",
                    onPointerDown: (event) => startRotationDrag(event, {
                      infraId: combId,
                      centerX: combCenterX,
                      centerY: combCenterY,
                      historyKey: `infra:${combId}`,
                      onSelect: () => selectInfrastructure(combId),
                    }),
                  })}
	                </g>
	              )}
              {label && (
                <text
                  x={combSettings.labelX ?? (bx + bw / 2)}
                  y={combSettings.labelY ?? (by - 7)}
                  fill={combSettings.labelColor || "#854d0e"}
                  fontSize={combSettings.fontSize || 6.4}
                  fontWeight="950"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  const renderThreePhaseBusbars = () => {
    const bars = infrastructure.filter((item) => isThreePhaseBusbarId(item?.id) && !item.deleted);
    return (
      <g id="three-phase-busbars">
        {bars.map((item) => {
          const id = item.id;
          const bx = Number.isFinite(Number(item.x)) ? Number(item.x) : 220;
          const by = Number.isFinite(Number(item.y)) ? Number(item.y) : 360;
          const bw = clampNumber(item.width, 18, PANEL_W - 40, 40);
          const bh = clampNumber(item.height, 18, panelHeight - 100, 300);
          const rotation = Number(item.rotation) || 0;
          const cx = bx + bw / 2;
          const cy = by + bh / 2;
          const isSelected = selectedInfrastructureId === id;
          const transform = rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined;
          
          return (
            <g
              key={id}
              id={id}
              transform={transform}
              className="cursor-move"
              onPointerDown={(event) => startInfraTextDrag(event, id, bx, by)}
              onClick={(event) => {
                event.stopPropagation();
                if (!wiringMode && !wireMoveMode) selectInfrastructure(id);
              }}
            >
              <title>Barramento Trifásico</title>
              {isSelected && (
                <rect x={bx - 6} y={by - 6} width={bw + 12} height={bh + 12} rx="4" fill="none" stroke="#00d8b8" strokeWidth="1.5" strokeDasharray="4,3" pointerEvents="none" />
              )}
              {/* Backplate */}
              <rect x={bx} y={by} width={bw} height={bh} rx="2" fill="#1e293b" opacity="0.4" />
              {/* 3 Copper Bars */}
              <rect x={bx + bw*0.1} y={by + 4} width={bw*0.2} height={bh - 8} rx="1" fill="#b87333" stroke="#854d0e" strokeWidth="0.5" />
              <rect x={bx + bw*0.4} y={by + 4} width={bw*0.2} height={bh - 8} rx="1" fill="#b87333" stroke="#854d0e" strokeWidth="0.5" />
              <rect x={bx + bw*0.7} y={by + 4} width={bw*0.2} height={bh - 8} rx="1" fill="#b87333" stroke="#854d0e" strokeWidth="0.5" />
              
              {isSelected && (
                <g>
                  {renderRotationHandle({
                    key: `${id}-rotate`,
                    centerX: cx,
                    centerY: cy,
                    handleX: cx,
                    handleY: by - 20,
                    label: "Girar",
                    onPointerDown: (event) => startRotationDrag(event, { infraId: id, centerX: cx, centerY: cy, historyKey: `infra:${id}`, onSelect: () => selectInfrastructure(id) })
                  })}
                </g>
              )}
              {item.label && (
                <text x={cx} y={by - 5} fill={item.labelColor || "#0f172a"} fontSize="7" fontWeight="950" textAnchor="middle" pointerEvents="none">
                  {item.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  const renderFreeDinRails = () => {
    const freeRails = infrastructure.filter((item) => isFreeDinRailId(item?.id) && !item.deleted);
    return (
      <g id="free-din-rails">
        {freeRails.map((item) => {
          const id = item.id;
          const bx = Number.isFinite(Number(item.x)) ? Number(item.x) : 220;
          const by = Number.isFinite(Number(item.y)) ? Number(item.y) : 360;
          const bw = clampNumber(item.width, 18, PANEL_W - 40, 180);
          const bh = clampNumber(item.height, 10, 40, 24);
          const rotation = Number(item.rotation) || 0;
          const cx = bx + bw / 2;
          const cy = by + bh / 2;
          const isSelected = selectedInfrastructureId === id;
          const transform = rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined;
          
          return (
            <g
              key={id}
              id={id}
              transform={transform}
              className="cursor-move"
              onPointerDown={(event) => startInfraTextDrag(event, id, bx, by)}
              onClick={(event) => {
                event.stopPropagation();
                if (!wiringMode && !wireMoveMode) selectInfrastructure(id);
              }}
            >
              <title>Trilho DIN Livre</title>
              {isSelected && (
                <rect x={bx - 4} y={by - 4} width={bw + 8} height={bh + 8} rx="2" fill="none" stroke="#00d8b8" strokeWidth="1.5" strokeDasharray="4,3" pointerEvents="none" />
              )}
              {/* Rail drawing */}
              <rect x={bx} y={by} width={bw} height={bh} rx="2" fill="url(#railGrad)" stroke="#475569" strokeWidth="0.8" filter="url(#shadow)" />
              <rect x={bx + 2} y={by + 2} width={Math.max(0, bw - 4)} height="4" fill="#ffffff" fillOpacity="0.25" pointerEvents="none" />
              <circle cx={bx + 10} cy={by + bh/2} r="3" fill="#334155" pointerEvents="none" />
              <circle cx={bx + bw - 10} cy={by + bh/2} r="3" fill="#334155" pointerEvents="none" />
              
              {isSelected && (
                <g>
                  <rect x={bx - 6} y={cy - 6} width="8" height="12" rx="2" fill="#fff" stroke="#00d8b8" className="cursor-ew-resize" onPointerDown={(e) => startInfrastructureResizeDrag(e, id, "left", { x: bx, y: by, width: bw })} />
                  <rect x={bx + bw - 2} y={cy - 6} width="8" height="12" rx="2" fill="#fff" stroke="#00d8b8" className="cursor-ew-resize" onPointerDown={(e) => startInfrastructureResizeDrag(e, id, "right", { x: bx, y: by, width: bw })} />
                  {renderRotationHandle({
                    key: `${id}-rotate`,
                    centerX: cx,
                    centerY: cy,
                    handleX: cx,
                    handleY: by - 20,
                    label: "Girar",
                    onPointerDown: (event) => startRotationDrag(event, { infraId: id, centerX: cx, centerY: cy, historyKey: `infra:${id}`, onSelect: () => selectInfrastructure(id) })
                  })}
                </g>
              )}
              {item.label && (
                <text x={cx} y={by - 5} fill={item.labelColor || "#475569"} fontSize="7" fontWeight="950" textAnchor="middle" pointerEvents="none">
                  {item.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  // Renders de componentes no SVG
  const renderBreaker = (c, x, y, isSelected) => {
    const W = c.poles * MOD;
    const isGen = c.isGeneral;
    const col = isGen ? "#ef4444" : (c.phase === "A" ? COLORS.phaseA : c.phase === "B" ? COLORS.phaseB : COLORS.phaseC);
    const displayLabel = getComponentDisplayLabel(c);
    const shortLabel = getCircuitShortLabel(getComponentCircuit(c) || c);
    
    // Clique para alternar alavanca
    const toggleBreaker = (e) => {
      e.stopPropagation();
      handleUpdateComponent("status", c.status === "ON" ? "OFF" : "ON");
    };

    return (
      <g
        key={c.id}
        className="cursor-pointer"
        onPointerDown={(event) => startComponentDrag(event, c.id)}
        onClick={() => selectComponent(c.id)}
        onMouseEnter={() => setHoveredItem({
          type: "component",
          label: displayLabel,
          current: c.current,
          curve: c.curve,
          poles: c.poles,
          deviceType: c.type,
          phase: c.phase,
          status: c.status,
          dpsStatus: c.dpsStatus
        })}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {/* Sombra de projeção 3D */}
        <rect x={x+1} y={y+2} width={W-2} height={BRK_H} rx="5" fill="#000000" fillOpacity="0.12" />

        {/* Corpo externo com gradiente metálico industrial */}
        <rect x={x} y={y} width={W} height={BRK_H} rx="5" fill="url(#breakerBody)" stroke={isSelected ? "#00d8b8" : "#475569"} strokeWidth={isSelected ? "2.5" : "1.2"} />
        
        {/* Bevel interno de iluminação */}
        <rect x={x+1} y={y+1} width={W-2} height={BRK_H-2} rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.8" />
        
        {/* Trilho guia de fixação lateral */}
        <path d={`M ${x} ${y+15} L ${x+4} ${y+15} M ${x+W-4} ${y+15} L ${x+W} ${y+15}`} stroke="#475569" strokeWidth="2.5" />
        <path d={`M ${x} ${y+BRK_H-15} L ${x+4} ${y+BRK_H-15} M ${x+W-4} ${y+BRK_H-15} L ${x+W} ${y+BRK_H-15}`} stroke="#475569" strokeWidth="2.5" />

        {/* Polos e parafusos de terminais */}
        {Array.from({ length: c.poles }).map((_, pi) => {
          const px = x + pi * MOD;
          const pinTopId = `comp:${c.id}:top:${pi}`;
          const pinBottomId = `comp:${c.id}:bottom:${pi}`;
          
          return (
            <g key={pi}>
              {/* Parafuso Topo */}
              <rect x={px+2} y={y+4} width={MOD-4} height="20" rx="3" fill="url(#screwCageGrad)" stroke="#334155" strokeWidth="0.8" />
              <circle cx={px+MOD/2} cy={y+14} r="6" fill="#0f172a" />
              <circle cx={px+MOD/2} cy={y+14} r="4.5" fill="url(#metallicScrew)" stroke="#0f172a" strokeWidth="0.3" />
              {/* Fenda cruzada */}
              <line x1={px+MOD/2-3} y1={y+14} x2={px+MOD/2+3} y2={y+14} stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1={px+MOD/2} y1={y+14-3} x2={px+MOD/2} y2={y+14+3} stroke="#cbd5e1" strokeWidth="1.2" />

              {/* Parafuso Base */}
              <rect x={px+2} y={y+BRK_H-24} width={MOD-4} height="20" rx="3" fill="url(#screwCageGrad)" stroke="#334155" strokeWidth="0.8" />
              <circle cx={px+MOD/2} cy={y+BRK_H-14} r="6" fill="#0f172a" />
              <circle cx={px+MOD/2} cy={y+BRK_H-14} r="4.5" fill="url(#metallicScrew)" stroke="#0f172a" strokeWidth="0.3" />
              <line x1={px+MOD/2-3} y1={y+BRK_H-14} x2={px+MOD/2+3} y2={y+BRK_H-14} stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1={px+MOD/2} y1={y+BRK_H-14-3} x2={px+MOD/2} y2={y+BRK_H-14+3} stroke="#cbd5e1" strokeWidth="1.2" />

              {/* Indicador de fase */}
              <text x={px+MOD/2} y={y+31} fill="#64748b" fontSize="6.2" textAnchor="middle" fontWeight="bold">
                {polePhaseLabel(c, pi)}
              </text>

              {/* Pinos interativos de fiação */}
              {(wiringMode || !!wireMoveMode) && (
                <>
                  <circle cx={px+MOD/2} cy={y+14} r="9" fill={wiringStart === pinTopId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse" onClick={(e) => { e.stopPropagation(); handlePinClick(pinTopId); }} />
                  <circle cx={px+MOD/2} cy={y+BRK_H-14} r="9" fill={wiringStart === pinBottomId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse" onClick={(e) => { e.stopPropagation(); handlePinClick(pinBottomId); }} />
                </>
              )}
            </g>
          );
        })}

        {/* Linha divisória interna */}
        <line x1={x+3} y1={y+36} x2={x+W-3} y2={y+36} stroke="#cbd5e1" strokeWidth="1" />

        {/* Cavidade da alavanca */}
        <rect x={x + W/2 - 7} y={y + 39} width="14" height="28" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="0.5" />
        {/* Alavanca de controle */}
        <rect
          x={x + W/2 - 5}
          y={c.status === "ON" ? y + 41 : y + 51}
          width="10"
          height="14"
          rx="1.5"
          fill={col}
          stroke="#450a0a"
          strokeWidth="0.5"
          className="transition-all duration-150 cursor-pointer"
          onClick={toggleBreaker}
        />
        <rect
          x={x + W/2 - 5}
          y={c.status === "ON" ? y + 41 : y + 51}
          width="10"
          height="14"
          rx="1.5"
          fill="url(#toggleGlow)"
          className="transition-all duration-150 pointer-events-none"
        />
        
        {/* Marcações técnicas liga/desliga integradas */}
        <text x={x+W/2} y={y+37} fill="#64748b" fontSize="5.5" textAnchor="middle" fontWeight="bold">I</text>
        <text x={x+W/2} y={y+73} fill="#64748b" fontSize="5.5" textAnchor="middle" fontWeight="bold">O</text>
        
        {/* Indicador visual de estado de cor (Vermelho = Ligado, Verde = Desligado) */}
        <rect x={x + W/2 - (W > MOD ? 16 : 11)} y={y+48} width="4" height="6" rx="0.5" fill={c.status === "ON" ? "#ef4444" : "#22c55e"} stroke="#475569" strokeWidth="0.3" />

        {/* Cartão de etiqueta de identificação embutido na face */}
        <rect x={x+4} y={y+71} width={W-8} height="13" fill="#ffffff" rx="1.5" stroke="#cbd5e1" strokeWidth="0.8" />
        {c.poles === 1 ? (
          <text x={x+W/2} y={y+79} fill="#1e293b" fontSize="5.5" fontWeight="bold" textAnchor="middle">
            {(shortLabel || displayLabel).slice(0, 8)} · {c.current}A
          </text>
        ) : (
          <g>
            <text x={x+W/2} y={y+77} fill="#1e293b" fontSize="5" fontWeight="bold" textAnchor="middle">
              {displayLabel.slice(0, 18)}
            </text>
            <text x={x+W/2} y={y+82} fill="#ef4444" fontSize="4.5" fontWeight="extrabold" textAnchor="middle">
              {c.current}A/{c.curve} - {c.poles}P
            </text>
          </g>
        )}
        
        {/* Norma técnica nos multipolos */}
        <text x={x+W/2} y={y+28} fill="#94a3b8" fontSize="4.5" fontWeight="black" textAnchor="middle">NBR</text>
        {c.poles > 1 && (
          <text x={x+W/2} y={y+34} fill="#cbd5e1" fontSize="3" fontWeight="bold" textAnchor="middle">IEC 60898-1</text>
        )}

        {/* Controles Flutuantes se Selecionado */}
        {isSelected && renderFloatingControls(c, x, y, W)}
      </g>
    );
  };

  const renderDPS = (c, x, y, isSelected) => {
    const W = MOD;
    const pinTopId = `comp:${c.id}:top:0`;
    const pinBottomId = `comp:${c.id}:bottom:0`;
    
    const toggleStatus = (e) => {
      e.stopPropagation();
      handleUpdateComponent("dpsStatus", c.dpsStatus === "OK" ? "REPLACE" : "OK");
    };

    return (
      <g
        key={c.id}
        className="cursor-pointer"
        onPointerDown={(event) => startComponentDrag(event, c.id)}
        onClick={() => selectComponent(c.id)}
      >
        {/* Sombra */}
        <rect x={x+1} y={y+2} width={W-2} height={BRK_H} rx="5" fill="#000000" fillOpacity="0.12" />

        {/* Corpo vermelho característico de DPS com gradiente */}
        <rect x={x} y={y} width={W} height={BRK_H} rx="5" fill="url(#dpsBody)" stroke={isSelected ? "#00d8b8" : "#7f1d1d"} strokeWidth={isSelected ? "2.5" : "1.2"} />
        <rect x={x+1} y={y+1} width={W-2} height={BRK_H-2} rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.8" />

        {/* Parafuso Topo */}
        <rect x={x+2} y={y+4} width={W-4} height="20" rx="3" fill="#7f1d1d" stroke="#520707" strokeWidth="0.8" />
        <circle cx={x+W/2} cy={y+14} r="6" fill="#1e293b" />
        <circle cx={x+W/2} cy={y+14} r="4.5" fill="url(#metallicScrew)" stroke="#0f172a" strokeWidth="0.3" />
        <line x1={x+W/2-3} y1={y+14} x2={x+W/2+3} y2={y+14} stroke="#fecaca" strokeWidth="1.2" />

        {/* Parafuso Base */}
        <rect x={x+2} y={y+BRK_H-24} width={W-4} height="20" rx="3" fill="#7f1d1d" stroke="#520707" strokeWidth="0.8" />
        <circle cx={x+W/2} cy={y+BRK_H-14} r="6" fill="#1e293b" />
        <circle cx={x+W/2} cy={y+BRK_H-14} r="4.5" fill="url(#metallicScrew)" stroke="#0f172a" strokeWidth="0.3" />
        <line x1={x+W/2-3} y1={y+BRK_H-14} x2={x+W/2+3} y2={y+BRK_H-14} stroke="#fecaca" strokeWidth="1.2" />

        {/* Janela de Status activa (verde/vermelha) */}
        <rect x={x+4} y={y+26} width={W-8} height="11" rx="1.5" fill="#0f172a" />
        <rect
          x={x+5}
          y={y+27}
          width={W-10}
          height="9"
          rx="1"
          fill={c.dpsStatus === "OK" ? COLORS.dpsGreen : "#ef4444"}
          onClick={toggleStatus}
          className="transition-colors duration-150"
        />
        <text x={x+W/2} y={y+33} fill="#ffffff" fontSize="5.2" fontWeight="black" textAnchor="middle" pointerEvents="none">
          {c.dpsStatus}
        </text>

        {/* Raio indicador */}
        <polygon
          points={`${x+W/2},${y+42} ${x+W/2+4},${y+50} ${x+W/2+1.5},${y+50} ${x+W/2+3},${y+60} ${x+W/2-4},${y+51} ${x+W/2-1.5},${y+51}`}
          fill="#fbbf24"
          stroke="#d97706"
          strokeWidth="0.5"
        />

        {/* Cartão de etiqueta embutido */}
        <rect x={x+3} y={y+68} width={W-6} height="15" fill="#ffffff" rx="1.5" stroke="#7f1d1d" strokeWidth="0.8" />
        <text x={x+W/2} y={y+74} fill="#1e293b" fontSize="5" fontWeight="bold" textAnchor="middle">DPS-{c.phase}</text>
        <text x={x+W/2} y={y+80} fill="#b91c1c" fontSize="4.5" fontWeight="extrabold" textAnchor="middle">Uc 275V</text>

        {/* Pinos interativos de fiação */}
        {(wiringMode || !!wireMoveMode) && (
          <>
            <circle cx={x+W/2} cy={y+14} r="9" fill={wiringStart === pinTopId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse" onClick={(e) => { e.stopPropagation(); handlePinClick(pinTopId); }} />
            <circle cx={x+W/2} cy={y+BRK_H-14} r="9" fill={wiringStart === pinBottomId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse" onClick={(e) => { e.stopPropagation(); handlePinClick(pinBottomId); }} />
          </>
        )}

        {/* Controles Flutuantes se Selecionado */}
        {isSelected && renderFloatingControls(c, x, y, W)}
      </g>
    );
  };

  const renderDR = (c, x, y, isSelected) => {
    const W = c.poles * MOD;
    
    const toggleDR = (e) => {
      e.stopPropagation();
      handleUpdateComponent("status", c.status === "ON" ? "OFF" : "ON");
    };

    return (
      <g
        key={c.id}
        className="cursor-pointer"
        onPointerDown={(event) => startComponentDrag(event, c.id)}
        onClick={() => selectComponent(c.id)}
      >
        {/* Sombra */}
        <rect x={x+1} y={y+2} width={W-2} height={BRK_H} rx="5" fill="#000000" fillOpacity="0.12" />

        {/* Corpo cinza robusto com gradiente */}
        <rect x={x} y={y} width={W} height={BRK_H} rx="5" fill="url(#drBody)" stroke={isSelected ? "#00d8b8" : "#475569"} strokeWidth={isSelected ? "2.5" : "1.2"} />
        <rect x={x+1} y={y+1} width={W-2} height={BRK_H-2} rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.8" />

        {/* Parafusos de terminais */}
        {Array.from({ length: c.poles }).map((_, pi) => {
          const px = x + pi * MOD;
          const pinTopId = `comp:${c.id}:top:${pi}`;
          const pinBottomId = `comp:${c.id}:bottom:${pi}`;
          
          return (
            <g key={pi}>
              <rect x={px+2} y={y+4} width={MOD-4} height="20" rx="3" fill="url(#screwCageGrad)" stroke="#334155" strokeWidth="0.8" />
              <circle cx={px+MOD/2} cy={y+14} r="6" fill="#0f172a" />
              <circle cx={px+MOD/2} cy={y+14} r="4.5" fill="url(#metallicScrew)" stroke="#0f172a" strokeWidth="0.3" />
              <line x1={px+MOD/2-3} y1={y+14} x2={px+MOD/2+3} y2={y+14} stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1={px+MOD/2} y1={y+14-3} x2={px+MOD/2} y2={y+14+3} stroke="#cbd5e1" strokeWidth="1.2" />

              <rect x={px+2} y={y+BRK_H-24} width={MOD-4} height="20" rx="3" fill="url(#screwCageGrad)" stroke="#334155" strokeWidth="0.8" />
              <circle cx={px+MOD/2} cy={y+BRK_H-14} r="6" fill="#0f172a" />
              <circle cx={px+MOD/2} cy={y+BRK_H-14} r="4.5" fill="url(#metallicScrew)" stroke="#0f172a" strokeWidth="0.3" />
              <line x1={px+MOD/2-3} y1={y+BRK_H-14} x2={px+MOD/2+3} y2={y+BRK_H-14} stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1={px+MOD/2} y1={y+BRK_H-14-3} x2={px+MOD/2} y2={y+BRK_H-14+3} stroke="#cbd5e1" strokeWidth="1.2" />

              <text x={px+MOD/2} y={y+31} fill="#64748b" fontSize="6.5" textAnchor="middle" fontWeight="bold">
                {drPoleLabel(c, pi)}
              </text>

              {/* Pinos interativos de fiação */}
              {(wiringMode || !!wireMoveMode) && (
                <>
                  <circle cx={px+MOD/2} cy={y+14} r="9" fill={wiringStart === pinTopId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse" onClick={(e) => { e.stopPropagation(); handlePinClick(pinTopId); }} />
                  <circle cx={px+MOD/2} cy={y+BRK_H-14} r="9" fill={wiringStart === pinBottomId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse" onClick={(e) => { e.stopPropagation(); handlePinClick(pinBottomId); }} />
                </>
              )}
            </g>
          );
        })}

        {/* Botão de Teste azul brilhante (com posição corrigida para não sobrepor fiação) */}
        <rect x={x+6} y={y+36} width="14" height="11" rx="2.5" fill="#00d8b8" stroke="#00d8b8" strokeWidth="0.8" filter="url(#shadow)" />
        <text x={x+13} y={y+44} fill="#ffffff" fontSize="6.5" fontWeight="black" textAnchor="middle" pointerEvents="none">T</text>

        {/* Cavidade da alavanca */}
        <rect x={x + W/2 - 7} y={y + 39} width="14" height="28" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="0.5" />
        <rect
          x={x + W/2 - 5}
          y={c.status === "ON" ? y + 41 : y + 51}
          width="10"
          height="14"
          rx="1.5"
          fill="#00d8b8"
          stroke="#00d8b8"
          strokeWidth="0.5"
          className="transition-all duration-150 cursor-pointer"
          onClick={toggleDR}
        />
        <rect
          x={x + W/2 - 5}
          y={c.status === "ON" ? y + 41 : y + 51}
          width="10"
          height="14"
          rx="1.5"
          fill="url(#toggleGlow)"
          className="transition-all duration-150 pointer-events-none"
        />
        
        {/* Indicadores de liga/desliga da alavanca */}
        <text x={x+W/2} y={y+37} fill="#64748b" fontSize="5.5" textAnchor="middle" fontWeight="bold">I</text>
        <text x={x+W/2} y={y+73} fill="#64748b" fontSize="5.5" textAnchor="middle" fontWeight="bold">O</text>

        {/* Cartão de etiqueta de identificação embutido na face */}
        <rect x={x+4} y={y+71} width={W-8} height="13" fill="#ffffff" rx="1.5" stroke="#cbd5e1" strokeWidth="0.8" />
        <text x={x+W/2} y={y+77} fill="#1e293b" fontSize="5.5" fontWeight="bold" textAnchor="middle">
          {c.label.slice(0, 12)}
        </text>
        <text x={x+W/2} y={y+82} fill="#0284c7" fontSize="4.5" fontWeight="extrabold" textAnchor="middle">
          {c.current}A / IΔn 30mA
        </text>

        {/* Controles Flutuantes se Selecionado */}
        {isSelected && renderFloatingControls(c, x, y, W)}
      </g>
    );
  };

  const renderSpacer = (c, x, y) => {
    const W = c.poles * MOD;
    return (
      <g key={c.id}>
        <rect x={x+1} y={y} width={W-2} height={BRK_H} rx="4" fill="#f8fafc" fillOpacity="0.08" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="6,4" pointerEvents="none" />
        <text x={x+W/2} y={y+BRK_H/2-6} fill="#64748b" fontSize="7" fontWeight="bold" textAnchor="middle">
          {c.label}
        </text>
        <text x={x+W/2} y={y+BRK_H/2+8} fill="#94a3b8" fontSize="6.5" textAnchor="middle">
          {c.poles} Módulos DIN
        </text>
      </g>
    );
  };

  const renderBorne = (c, x, y, isSelected) => {
    const W = 14;
    const pinTopId = `comp:${c.id}:top:0`;
    const pinBottomId = `comp:${c.id}:bottom:0`;
    
    // Cor-código técnica para Bornes baseados em função (Neutro = Azul, Terra = Verde/Amarelo, Fase = Cinza/Marrom)
    let bodyColor = "#78350f"; // Padrão marrom
    let centerColor = "#b45309";
    let textColor = "#ffffff";
    
    const labelUpper = c.label.toUpperCase();
    if (labelUpper.includes("N")) {
      bodyColor = "#1e3a8a"; // Azul Neutro escuro
      centerColor = "#00d8b8";
    } else if (labelUpper.includes("PE") || labelUpper.includes("TERRA") || labelUpper.includes("G")) {
      bodyColor = "#14532d"; // Verde Terra escuro
      centerColor = "#16a34a";
    } else {
      bodyColor = "#475569"; // Cinza Fase
      centerColor = "#64748b";
    }

    return (
      <g
        key={c.id}
        className="cursor-pointer"
        onPointerDown={(event) => startComponentDrag(event, c.id)}
        onClick={() => selectComponent(c.id)}
      >
        {/* Sombra */}
        <rect x={x+0.5} y={y+2} width={W-1} height={BRK_H} rx="2" fill="#000000" fillOpacity="0.12" />

        {/* Corpo do Borne com gradiente */}
        <rect x={x} y={y} width={W} height={BRK_H} rx="2" fill={bodyColor} stroke={isSelected ? "#00d8b8" : "#1e293b"} strokeWidth={isSelected ? "2.5" : "0.8"} />
        <rect x={x+2} y={y+4} width={W-4} height={BRK_H-8} fill={centerColor} rx="1" />
        
        {/* Bevel metálico clamp interno */}
        <rect x={x+3} y={y+12} width={W-6} height="12" fill="url(#metallicScrew)" stroke="#0f172a" strokeWidth="0.3" rx="1" />
        <circle cx={x+W/2} cy={y+18} r="2.5" fill="#1e293b" />
        <rect x={x+3} y={y+BRK_H-24} width={W-6} height="12" fill="url(#metallicScrew)" stroke="#0f172a" strokeWidth="0.3" rx="1" />
        <circle cx={x+W/2} cy={y+BRK_H-18} r="2.5" fill="#1e293b" />

        <text x={x+W/2} y={y+BRK_H/2+3} fill={textColor} fontSize="6" fontWeight="black" textAnchor="middle" transform={`rotate(-90 ${x+W/2} ${y+BRK_H/2})`}>
          {c.label}
        </text>

        {/* Pinos interativos de fiação */}
        {(wiringMode || !!wireMoveMode) && (
          <>
            <circle cx={x+W/2} cy={y+14} r="8" fill={wiringStart === pinTopId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse" onClick={(e) => { e.stopPropagation(); handlePinClick(pinTopId); }} />
            <circle cx={x+W/2} cy={y+BRK_H-14} r="8" fill={wiringStart === pinBottomId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse" onClick={(e) => { e.stopPropagation(); handlePinClick(pinBottomId); }} />
          </>
        )}

        {/* Controles Flutuantes se Selecionado */}
        {isSelected && renderFloatingControls(c, x, y, W)}
      </g>
    );
  };

  const wireDisplayColor = (displayColor) => (
    displayColor === "black" ? COLORS.phaseA :
    displayColor === "red" ? COLORS.phaseB :
    displayColor === "brown" ? COLORS.phaseC :
    displayColor === "orange" ? WIRE_COLOR_HEX.orange :
    displayColor === "blue" ? COLORS.neutral :
    displayColor === "yellow" ? COLORS.returnWire :
    displayColor === "gray" ? COLORS.parallel :
    displayColor === "white" ? WIRE_COLOR_HEX.white :
    displayColor === "purple" ? WIRE_COLOR_HEX.purple :
    displayColor === "pink" ? WIRE_COLOR_HEX.pink :
    COLORS.ground
  );

  const cableEdgeColor = (baseColor) => {
    if (baseColor === COLORS.neutral) return "#075985";
    if (baseColor === COLORS.ground) return "#166534";
    if (baseColor === COLORS.phaseB) return "#7f1d1d";
    if (baseColor === COLORS.phaseC) return "#431407";
    if (baseColor === WIRE_COLOR_HEX.orange) return "#9a3412";
    if (baseColor === COLORS.returnWire) return "#854d0e";
    if (baseColor === COLORS.parallel) return "#475569";
    if (baseColor === WIRE_COLOR_HEX.white) return "#64748b";
    if (baseColor === WIRE_COLOR_HEX.purple) return "#4c1d95";
    if (baseColor === WIRE_COLOR_HEX.pink) return "#831843";
    return "#020617";
  };

  const cableHighlightColor = (baseColor) => (
    baseColor === COLORS.phaseA || baseColor === COLORS.phaseC ? "#ffffff" : "#f8fafc"
  );

  const getCableLabelAnchor = (routePoints = []) => {
    if (!routePoints || routePoints.length < 2) return null;

    let best = null;
    for (let index = 1; index < routePoints.length; index += 1) {
      const prev = routePoints[index - 1];
      const curr = routePoints[index];
      const length = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const horizontal = Math.abs(curr.y - prev.y) < 0.1;
      const score = length + (horizontal ? 1000 : 0);
      if (!best || score > best.score) {
        best = {
          score,
          length,
          horizontal,
          x: (prev.x + curr.x) / 2,
          y: (prev.y + curr.y) / 2,
        };
      }
    }

    return best;
  };

  const renderCableGaugeTag = (routePoints, label, baseColor, key) => {
    if (!SHOW_WIRE_GAUGE_TAGS) return null;

    const cleanLabel = String(label || "").replace("mm²", " mm²").replace(/\s+/g, " ").trim();
    if (!cleanLabel || !routePoints || routePoints.length < 2) return null;

    const anchor = getCableLabelAnchor(routePoints);
    if (!anchor) return null;
    if (anchor.length < 58) return null;

    const width = Math.max(36, cleanLabel.length * 4.6 + 10);
    const height = 13;
    const x = anchor.x - width / 2;
    const y = anchor.y - height / 2;
    const rotation = anchor.horizontal ? undefined : `rotate(-90 ${anchor.x} ${anchor.y})`;

    return (
      <g key={key} transform={rotation} pointerEvents="none">
        <rect x={x} y={y} width={width} height={height} rx="5" fill="#ffffff" stroke={cableEdgeColor(baseColor)} strokeWidth="0.7" />
        <text x={anchor.x} y={anchor.y + 3.2} fill="#0f172a" fontSize="6.2" fontWeight="950" textAnchor="middle">
          {cleanLabel}
        </text>
      </g>
    );
  };

  const renderCableTextTag = (point, label, baseColor, key, options = {}) => {
    if (!point || !label) return null;
    const text = String(label).trim();
    const width = Math.max(20, text.length * 4.6 + 10);
    const height = 12;
    const x = point.x - width / 2;
    const y = point.y - height / 2;
    const rotation = options.rotate ? `rotate(${options.rotate} ${point.x} ${point.y})` : undefined;

    return (
      <g key={key} transform={rotation} pointerEvents="none">
        <rect x={x} y={y} width={width} height={height} rx="4" fill="#ffffff" stroke={cableEdgeColor(baseColor)} strokeWidth="0.75" />
        <text x={point.x} y={point.y + 3.1} fill="#0f172a" fontSize="6" fontWeight="950" textAnchor="middle">
          {text}
        </text>
      </g>
    );
  };

  const renderCablePath = (pathStr, baseColor, thickness, key, isHighlighted = false, options = {}) => {
    const visibleThickness = Math.max(0.85, Math.min(7, Number(thickness) || 1.4));
    const strokeDasharray = options.lineStyle === "dashed" ? "8 5" : undefined;
    // Proporções padronizadas: sombra e borda escalam com a espessura
    const shadowOffset = Math.max(1.8, visibleThickness * 0.65);
    const edgeWidth = Math.max(1, visibleThickness * 0.32);
    const highlightWidth = Math.max(0.4, visibleThickness * 0.18);

    return (
      <g key={key}>
        <path d={pathStr} fill="none" stroke="rgba(0,0,0,0)" strokeWidth={Math.max(18, visibleThickness + 15)} pointerEvents="stroke" />
        <path d={pathStr} fill="none" stroke="rgba(2,6,23,0.16)" strokeWidth={visibleThickness + shadowOffset} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} transform="translate(0.8, 1.0)" />
        <path d={pathStr} fill="none" stroke={cableEdgeColor(baseColor)} strokeWidth={visibleThickness + edgeWidth} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} />
        <path data-wire-conductor="true" d={pathStr} fill="none" stroke={baseColor} strokeWidth={visibleThickness} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} />
        <path d={pathStr} fill="none" stroke={cableHighlightColor(baseColor)} strokeWidth={highlightWidth} strokeOpacity="0.48" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={strokeDasharray} transform="translate(-0.4, -0.4)" />
        {isHighlighted && (
          <path d={pathStr} fill="none" stroke="#00d8b8" strokeWidth={visibleThickness + 5.8} strokeOpacity="0.38" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </g>
    );
  };

  const renderCableTerminal = (point, adjacentPoint, baseColor, thickness, key, pinId, requestedType) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

    if (requestedType === "nenhum") return null;

    const pin = String(pinId || "");

    let angle = 90;
    if (adjacentPoint && (adjacentPoint.x !== point.x || adjacentPoint.y !== point.y)) {
      angle = Math.atan2(point.y - adjacentPoint.y, point.x - adjacentPoint.x) * (180 / Math.PI);
    }

    let isDouble = false;
    if (pin && pin.includes("comp:")) {
      let count = 0;
      for (const w of visibleWires) {
        if (w.source === pin || w.target === pin) count++;
      }
      isDouble = count > 1;
    }

    if (isDouble && pin.includes("comp:")) {
      angle = pin.includes(":top:") ? -90 : 90;
    }

    const type = requestedType || (isDouble ? "duplo" : "agulha");

    const pinLength = Math.max(5, thickness * 1.6);
    const collarLength = Math.max(8, thickness * 2.5);
    const pinHeight = Math.max(2, thickness * 0.7);
    const collarHeight = Math.max(3.5, thickness * 1.2 + (type === "duplo" ? 3.5 : 1.5));
    
    const getFerruleColor = (th) => {
      if (th <= 2.5) return "#ef4444";
      if (th <= 4) return "#00d8b8";
      if (th <= 6) return "#64748b";
      if (th <= 10) return "#eab308";
      return "#ef4444"; 
    };
    const ferruleColor = getFerruleColor(thickness);

    let graphic = null;

    if (type === "agulha" || type === "duplo") {
      graphic = (
        <g>
          <path d={`M ${-pinLength} ${-pinHeight/2} L 0 ${-pinHeight/2 + 0.4} L 0 ${pinHeight/2 - 0.4} L ${-pinLength} ${pinHeight/2} Z`} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
          <rect x={-pinLength - collarLength} y={-collarHeight/2} width={collarLength} height={collarHeight} rx="1.5" fill={ferruleColor} stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
          <rect x={-pinLength - collarLength} y={-collarHeight/2 + 0.5} width={collarLength} height={collarHeight/3} fill="#ffffff" fillOpacity="0.3" rx="1" />
        </g>
      );
    } else if (type === "ilhais") {
      const ringRadius = Math.max(3.5, thickness * 1.2);
      graphic = (
        <g>
          <circle cx={-ringRadius} cy={0} r={ringRadius} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
          <circle cx={-ringRadius} cy={0} r={ringRadius * 0.45} fill="#ffffff" stroke="#94a3b8" strokeWidth="0.4" />
          <rect x={-ringRadius * 1.8 - collarLength} y={-collarHeight/2} width={collarLength} height={collarHeight} rx="1.5" fill={ferruleColor} stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
          <rect x={-ringRadius * 1.8 - collarLength} y={-collarHeight/2 + 0.5} width={collarLength} height={collarHeight/3} fill="#ffffff" fillOpacity="0.3" rx="1" />
        </g>
      );
    } else if (type === "compressao") {
      const barrelLength = Math.max(8, thickness * 2.0);
      const ringRadius = Math.max(4, thickness * 1.3);
      graphic = (
        <g>
          <path d={`M ${-ringRadius * 2} ${-pinHeight*0.8} L ${-ringRadius*2 - barrelLength} ${-pinHeight*1.1} L ${-ringRadius*2 - barrelLength} ${pinHeight*1.1} L ${-ringRadius * 2} ${pinHeight*0.8} Z`} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.6" />
          <circle cx={-ringRadius} cy={0} r={ringRadius} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.8" />
          <circle cx={-ringRadius} cy={0} r={ringRadius * 0.4} fill="#ffffff" stroke="#94a3b8" strokeWidth="0.4" />
        </g>
      );
    }

    return (
      <g key={key} pointerEvents="none" transform={`translate(${point.x}, ${point.y}) rotate(${angle})`}>
        {graphic}
      </g>
    );
  };

  const destinationCircuitLabel = (wire = {}) => {
    const raw = `${wire.source || ""}:${wire.target || ""}`;
    const circuit = getWireCircuit(wire);
    if (circuit) {
      const circuitLabel = getCircuitDisplayLabel(circuit, circuit.__index);
      const conductor = getConductorDisplayLabel(wire);
      if (conductor === "Terra") return `PE - ${circuitLabel}`;
      if (conductor === "Neutro") return `N - ${circuitLabel}`;
      return `${conductor} - ${circuitLabel}`;
    }
    if (!raw.includes("load_out:")) return "";
    const match = raw.match(/(?:load_out:|comp:)?circuit_(\d+)/i);
    if (match) return `Circuito ${Number(match[1]) + 1}`;
    const inverterPhase = raw.match(/load_out:solar_inverter:(\d+)/i);
    if (inverterPhase) return `Inversor L${Number(inverterPhase[1]) + 1}`;
    if (/load_out:solar_inverter:neutral/i.test(raw)) return "N INVERSOR";
    if (/solar_inverter/i.test(raw)) return "Inversor";
    if (/qgbt_feed/i.test(raw)) return "Quadro";
    return "";
  };

  const renderDestinationLabel = (descriptor, routePoints, key, options = {}) => {
    const wireId = descriptor?.wire?.id;
    const wire = (wireId ? getEditableWire(wireId) : null) || descriptor?.wire || {};
    const meta = wire.labelMeta || {};
    if (meta.hidden) return null;
    const explicitLabel = cleanDisplayText(meta.text || "");
    const fallbackLabel = options.includeDefault === false ? "" : destinationCircuitLabel(wire);
    const label = cleanDisplayText(explicitLabel || fallbackLabel);
    if (!label || !routePoints || routePoints.length < 2) return null;

    const wireKind = descriptor?.kind || getWireKind(normalizedWireColor(wire));
    const isNeutral = wireKind === "neutral";
    const isGround = wireKind === "ground";
    const endpoint = routePoints[routePoints.length - 1];
    const isPower = wireKind === "power";
    const defaultLabelX = isNeutral
      ? Math.min(PANEL_W - 74, endpoint.x + 12)
      : isGround
        ? (endpoint.x < PANEL_W / 2 ? endpoint.x - 65 : endpoint.x + 4)
        : endpoint.x + 4;
    const defaultLabelY = isGround
      ? endpoint.y - 12
      : isNeutral
        ? endpoint.y - 3
        : endpoint.y + 56;
    
    const labelX = meta.x ?? wire.labelPosition?.x ?? defaultLabelX;
    const labelY = meta.y ?? wire.labelPosition?.y ?? defaultLabelY;
    const rotationVal = meta.rotation ?? (isPower ? -90 : 0);
    const rotation = rotationVal ? `rotate(${rotationVal} ${labelX} ${labelY})` : undefined;
    const isMiddleAnchor = isPower && !meta.x && !meta.rotation;

    return (
      <g
        key={key}
        transform={rotation}
        className={`cursor-move ${selectedTextWireId === wire.id ? "stroke-emerald-500 stroke-[0.3]" : ""}`}
        onPointerDown={(e) => startTextDrag(e, wire.id, defaultLabelX, defaultLabelY)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedTextWireId(wire.id);
          setActiveTab("text");
        }}
      >
        <rect
          x={isMiddleAnchor ? labelX - 25 : labelX - 4}
          y={labelY - 10}
          width={Math.max(50, label.length * 4.5 + 8)}
          height={16}
          fill="transparent"
          pointerEvents="all"
        />
        <text
          x={labelX}
          y={labelY}
          fill={meta.color || "#0f172a"}
          fontSize={meta.fontSize || 7}
          fontFamily={meta.fontFamily || "'Inter', 'Arial', sans-serif"}
          fontWeight="900"
          textAnchor={isMiddleAnchor ? "middle" : "start"}
          pointerEvents="none"
        >
          {label}
        </text>
      </g>
    );
  };

  const renderTextAnnotations = () => {
    if (!textAnnotations.length) return null;

    return (
      <g id="panel-text-annotations">
        {textAnnotations.map((annotation) => {
          const fontSize = Number(annotation.fontSize) || 8.5;
          const width = Math.max(88, Math.min(280, Number(annotation.width) || 210));
          const paddingX = 8;
          const paddingY = 7;
          const lineHeight = Math.max(9, fontSize * 1.32);
          const lines = wrapAnnotationText(annotation.text || annotation.label || "Observação", Math.max(12, Math.floor(width / (fontSize * 0.58))), 6);
          const height = Math.max(24, paddingY * 2 + lines.length * lineHeight);
          const x = Number(annotation.x ?? 110);
          const y = Number(annotation.y ?? 110);
          const rotation = Number(annotation.rotation) || 0;
          const transform = rotation ? `rotate(${rotation} ${x + width / 2} ${y + height / 2})` : undefined;
          const align = annotation.align || "start";
          const textAnchor = align === "center" ? "middle" : align === "end" ? "end" : "start";
          const textX = align === "center" ? x + width / 2 : align === "end" ? x + width - paddingX : x + paddingX;
          const selected = selectedAnnotationId === annotation.id;
          const showBox = annotation.showBox !== false;
          const centerX = x + width / 2;
          const centerY = y + height / 2;

          return (
            <g
              key={annotation.id}
              transform={transform}
              className="cursor-move"
              onPointerDown={(event) => startAnnotationDrag(event, annotation.id)}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedAnnotationId(annotation.id);
                setSelectedTextWireId("");
                setActiveTab("text");
              }}
            >
              <rect
                x={x - 6}
                y={y - 6}
                width={width + 12}
                height={height + 12}
                rx="7"
                fill="transparent"
                pointerEvents="all"
              />
              {showBox && (
                <>
                  <rect x={x + 1.8} y={y + 2.4} width={width} height={height} rx="5" fill="#0f172a" fillOpacity="0.12" pointerEvents="none" />
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="5"
                    fill={annotation.background || "#ffffff"}
                    fillOpacity={Number(annotation.backgroundOpacity ?? 0.94)}
                    stroke={selected ? "#00d8b8" : annotation.borderColor || "#cbd5e1"}
                    strokeWidth={selected ? 1.6 : 0.85}
                    pointerEvents="none"
                  />
                </>
              )}
              {!showBox && selected && (
                <rect x={x - 4} y={y - 4} width={width + 8} height={height + 8} rx="5" fill="none" stroke="#00d8b8" strokeWidth="1.3" strokeDasharray="4,3" pointerEvents="none" />
              )}
              {lines.map((lineText, index) => (
                <text
                  key={`${annotation.id}-${index}`}
                  x={textX}
                  y={y + paddingY + fontSize + index * lineHeight}
                  fill={annotation.color || "#0f172a"}
                  fontSize={fontSize}
                  fontWeight={annotation.fontWeight || "800"}
                  fontFamily={annotation.fontFamily || "'Inter', 'Arial', sans-serif"}
                  textAnchor={textAnchor}
                  pointerEvents="none"
                >
                  {lineText}
                </text>
              ))}
              {selected && renderRotationHandle({
                key: `${annotation.id}-rotate`,
                centerX,
                centerY,
                handleX: centerX,
                handleY: y - 22,
                label: "Girar texto",
                onPointerDown: (event) => startRotationDrag(event, {
                  infraId: annotation.id,
                  centerX,
                  centerY,
                  historyKey: `annotation:${annotation.id}`,
                  onSelect: () => {
                    setSelectedAnnotationId(annotation.id);
                    setSelectedTextWireId("");
                    setActiveTab("text");
                  },
                }),
              })}
            </g>
          );
        })}
      </g>
    );
  };

  const renderBackbonePath = (id, routePoints, baseColor, defaultThickness, label = "") => {
    const wire = wires.find((w) => w.id === id);
    if (wire?.deleted || !isCableVisible(wire)) return null;

    const activeWire = wire || { id, route_points: [] };
    const isSelected = selectedWireId === id;
    
    // Ler personalizações
    const activeColor = activeWire.color ? wireDisplayColor(normalizedWireColor(activeWire)) : baseColor;
    const activeThickness = wire ? getEffectiveWireThickness(activeWire, defaultThickness) : defaultThickness;
    
    // Atualizar origem e destino se alterados pelo usuário
    const p1 = activeWire.source ? getPinCoords(activeWire.source, rails, panelHeight, infrastructure) : routePoints[0];
    const p2 = activeWire.target ? getPinCoords(activeWire.target, rails, panelHeight, infrastructure) : routePoints[routePoints.length - 1];

    let activeRoute = [...routePoints];
    if (activeWire.route_points?.length) {
      activeRoute = [p1, ...activeWire.route_points, p2];
    } else {
      activeRoute[0] = p1;
      activeRoute[activeRoute.length - 1] = p2;
    }

    registerWireRoute(activeWire, activeRoute, {
      color: activeColor,
      colorName: activeWire.color || (baseColor === COLORS.ground ? "green" : "blue"),
      gauge: activeWire.gauge || label || "16mm²",
      name: label || activeWire.name || "Barramento editável",
    });

    const pathStr = getRoundedPath(activeRoute, getCableCornerRadius(activeWire, DEFAULT_CABLE_CORNER_RADIUS));
    const showCaps = Boolean(label);
    const firstPoint = activeRoute?.[0];
    const lastPoint = activeRoute?.[activeRoute.length - 1];

    return (
      <g
        key={id}
        data-wire-backbone={id}
        pointerEvents="auto"
        className="cursor-pointer group"
        onClick={(e) => {
          e.stopPropagation();
          selectEditableWire(id);
        }}
      >
        {renderCablePath(pathStr, activeColor, activeThickness, `${id}-path`, isSelected, { lineStyle: getCableLineStyle(activeWire) })}
        {showCaps && firstPoint && (
          <circle cx={firstPoint.x} cy={firstPoint.y} r={Math.max(3, activeThickness * 0.56)} fill="#ffffff" stroke={cableEdgeColor(activeColor)} strokeWidth="1.5" />
        )}
        {showCaps && lastPoint && (
          <circle cx={lastPoint.x} cy={lastPoint.y} r={Math.max(3, activeThickness * 0.56)} fill="#ffffff" stroke={cableEdgeColor(activeColor)} strokeWidth="1.5" />
        )}
        {label && renderCableGaugeTag(activeRoute, label, activeColor, `${id}-tag`)}
      </g>
    );
  };

  const renderDescriptorPath = (descriptor, routePoints, key, options = {}) => {
    if (!routePoints || routePoints.length < 2) return null;
    const storedWire = getStoredWire(descriptor.wire.id);
    const activeWire = getEditableWire(descriptor.wire.id);
    if (!isCableVisible(activeWire) || activeWire.deleted) return null;
    const fallbackThickness = options.thickness ?? descriptor.thickness;
    const baseColor = activeWire.color
      ? wireDisplayColor(normalizedWireColor(activeWire))
      : options.color || wireDisplayColor(descriptor.color);
    const hasEditableThickness = Boolean(storedWire) || getExplicitWireThickness(activeWire) !== null;
    const thickness = hasEditableThickness
      ? getEffectiveWireThickness(activeWire, fallbackThickness)
      : fallbackThickness;
    const hasCustomRoute = Boolean(
      storedWire?.route_points?.length
      || getCableControlPoints(storedWire || {}).length
      || activeWire.route_points?.length
      || getCableControlPoints(activeWire).length
    );
    const baseRoutePoints = hasCustomRoute
      ? routePoints
      : cleanRoutePoints([routePoints[0], routePoints[routePoints.length - 1]]);
    const registeredRoutePoints = registerWireRoute(activeWire, baseRoutePoints, {
      descriptor,
      color: baseColor,
      colorName: activeWire.color || descriptor.color,
      thickness,
    });
    const editableRoutePoints = getEditableWireRoutePoints(activeWire, registeredRoutePoints);
    const pathStr = getRoundedPath(editableRoutePoints, getCableCornerRadius(activeWire, options.radius ?? DEFAULT_CABLE_CORNER_RADIUS));
	    const isHighlighted = selectedWireId === descriptor.wire.id || hoveredWireId === descriptor.wire.id;
	    const tapPoint = options.showTap ? editableRoutePoints[0] : null;
	    const explicitTextLabel = cleanDisplayText(activeWire?.labelMeta?.text || "");
	    const shouldShowTextLabel = Boolean(options.showLabel || explicitTextLabel);

	    return (
      <g
        key={key}
        className="cursor-pointer group"
        data-wire-id={descriptor.wire.id}
        data-wire-kind={descriptor.kind}
        data-wire-corridor={descriptor.corridor}
        onPointerEnter={() => setHoveredWireId(descriptor.wire.id)}
        onPointerLeave={() => setHoveredWireId("")}
        onClick={(event) => {
          event.stopPropagation();
          selectEditableWire(descriptor.wire.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          selectEditableWire(descriptor.wire.id);
          setWireMoveMode("target");
        }}
      >
        {renderCablePath(pathStr, baseColor, thickness, `${key}-path`, isHighlighted, { lineStyle: getCableLineStyle(activeWire) })}
        {options.showGauge !== false && renderCableGaugeTag(
          editableRoutePoints,
          descriptor.wire.label || descriptor.wire.gauge,
          baseColor,
          `${key}-gauge`,
        )}
        {tapPoint && (
          <g pointerEvents="none">
            <circle cx={tapPoint.x} cy={tapPoint.y} r={Math.max(2.6, thickness * 0.62)} fill="#ffffff" stroke={baseColor} strokeWidth="1.4" />
            <circle cx={tapPoint.x} cy={tapPoint.y} r={Math.max(1.1, thickness * 0.26)} fill={baseColor} />
          </g>
	        )}
	        {options.startTerminal !== false && !tapPoint && renderCableTerminal(editableRoutePoints[0], editableRoutePoints[1], baseColor, thickness, `${key}-terminal-start`, activeWire?.source || descriptor.wire?.source, activeWire?.terminal_source || descriptor.wire?.terminal_source)}
	        {options.endTerminal !== false && renderCableTerminal(editableRoutePoints[editableRoutePoints.length - 1], editableRoutePoints[editableRoutePoints.length - 2], baseColor, thickness, `${key}-terminal-end`, activeWire?.target || descriptor.wire?.target, activeWire?.terminal_target || descriptor.wire?.terminal_target)}
	        {shouldShowTextLabel && renderDestinationLabel(
	          { ...descriptor, wire: activeWire },
	          editableRoutePoints,
	          `${key}-label`,
	          { includeDefault: Boolean(options.showLabel) },
	        )}
	      </g>
	    );
	  };

  const routeLocalDeviceJumper = (descriptor) => {
    const { p1, p2, sourceMeta, targetMeta } = descriptor;
    const sameRail = sourceMeta?.railIndex === targetMeta?.railIndex;
    const railIndex = Math.max(0, sourceMeta?.railIndex ?? targetMeta?.railIndex ?? 0);

    if (sameRail && sourceMeta?.term === "bottom" && targetMeta?.term === "top") {
      const topDuctY = getRailDuctY(railIndex, "top", phaseLaneOffset(descriptor.color));
      const bottomDuctY = getRailDuctY(railIndex, "bottom", phaseLaneOffset(descriptor.color));
      const sideX = snapWireGrid(Math.max(52, Math.min(p1.x, p2.x) - MOD));

      return cleanRoutePoints([
        p1,
        { x: p1.x, y: bottomDuctY },
        { x: sideX, y: bottomDuctY },
        { x: sideX, y: topDuctY },
        { x: p2.x, y: topDuctY },
        p2,
      ]);
    }

    const jumperY = sameRail
      ? snapWireGrid(Math.max(p1.y, p2.y) + 28 + phaseLaneOffset(descriptor.color))
      : getRailDuctY(railIndex, "bottom", phaseLaneOffset(descriptor.color));

    return cleanRoutePoints([
      p1,
      { x: p1.x, y: jumperY },
      { x: p2.x, y: jumperY },
      p2,
    ]);
  };

  const routeServicePowerDescriptor = (descriptor) => {
    const { p1, p2, sourceMeta, targetMeta } = descriptor;

    if (isTerminalFeedWire(descriptor)) {
      const sourceIsTerminal = String(descriptor.wire.source || "").startsWith("terminal_left_top:");
      const terminal = sourceIsTerminal ? p1 : p2;
      const device = sourceIsTerminal ? p2 : p1;
      const laneY = referenceFeedLaneY(descriptor);
      return sourceIsTerminal
        ? cleanRoutePoints([
            terminal,
            { x: terminal.x, y: laneY },
            { x: device.x, y: laneY },
            device,
          ])
        : cleanRoutePoints([
            device,
            { x: device.x, y: laneY },
            { x: terminal.x, y: laneY },
            terminal,
          ]);
    }

    const sameRail = sourceMeta?.railIndex === targetMeta?.railIndex;
    if (sameRail && sourceMeta?.term === "bottom" && targetMeta?.term === "top") {
      return routeLocalDeviceJumper(descriptor);
    }

    const railIndex = Math.max(0, targetMeta?.railIndex ?? sourceMeta?.railIndex ?? 0);
    const ductSide = sourceMeta?.term === "bottom" && targetMeta?.term === "bottom" ? "bottom" : "top";
    const ductY = getRailDuctY(railIndex, ductSide, phaseLaneOffset(descriptor.color));

    return cleanRoutePoints([
      p1,
      { x: p1.x, y: ductY },
      { x: p2.x, y: ductY },
      p2,
    ]);
  };

  const renderPowerServiceWire = (descriptor) => (
    renderDescriptorPath(descriptor, routeServicePowerDescriptor(descriptor), `${descriptor.wire.id}-service`, {
      radius: 2,
      startTerminal: true,
      endTerminal: true,
    })
  );

  const renderSolarIncomingPhaseGroup = (group, groupIndex) => {
    const descriptors = group.descriptors;
    if (!descriptors.length) return null;

    const endpoints = descriptors.map((descriptor) => {
      const terminal = descriptor.sourceMeta?.type === "incoming" ? descriptor.p1 : descriptor.p2;
      const device = descriptor.sourceMeta?.type === "component" ? descriptor.p1 : descriptor.p2;
      return { descriptor, terminal, device };
    });
    const terminal = endpoints[0].terminal;
    const devices = endpoints.map((item) => item.device);
    const laneY = referenceFeedLaneY(descriptors[0]);
    const endX = Math.max(...devices.map((point) => point.x));
    const color = wireDisplayColor(group.color);
    const thickness = Math.max(...descriptors.map((descriptor) => descriptor.thickness));
    const trunkWireId = `solar-incoming-trunk-${groupIndex}-${String(group.key).replace(/[^a-z0-9_-]/gi, "_")}`;
    const phaseLabel = group.color === "red" ? "L2" : group.color === "brown" || group.color === "orange" ? "L3" : "L1";
    const trunk = cleanRoutePoints([
      terminal,
      { x: terminal.x, y: laneY },
      { x: endX, y: laneY },
    ]);

    return (
      <g
        key={`solar-incoming-phase-${group.key}-${groupIndex}`}
        className="cursor-pointer"
        data-wire-bundle="solar-incoming-phase"
        onClick={() => selectEditableWire(trunkWireId)}
      >
        {renderReferenceRoute(`solar-incoming-phase-${group.key}-${groupIndex}-trunk`, trunk, color, thickness, {
          radius: 2,
          wireId: trunkWireId,
          visualOnly: true,
          colorName: group.color,
          name: `Tronco ${phaseLabel} entrada`,
        })}
        {renderCableTextTag({ x: terminal.x + 34, y: laneY }, phaseLabel, color, `solar-incoming-phase-${group.key}-${groupIndex}-phase`)}
        {groupIndex === 1 && renderCableTextTag({ x: terminal.x + 82, y: laneY - 18 }, "ENTRADA DA REDE", COLORS.phaseA, `solar-incoming-phase-${group.key}-${groupIndex}-origin`)}
        {endpoints.map(({ descriptor, device }) => {
          const branch = cleanRoutePoints([
            { x: device.x, y: laneY },
            device,
          ]);
          return renderDescriptorPath(descriptor, branch, `${descriptor.wire.id}-solar-incoming-branch`, {
            color,
            thickness,
            radius: 2,
            showGauge: false,
            showTap: true,
            startTerminal: true,
            endTerminal: true,
          });
        })}
      </g>
    );
  };

  const renderSolarProtectionPhaseGroup = (group, groupIndex) => {
    const descriptors = group.descriptors;
    if (!descriptors.length) return null;

    const source = descriptors[0].p1;
    const targets = descriptors.map((descriptor) => descriptor.p2);
    const railY = descriptors[0].sourceMeta?.railY ?? 190;
    const busY = snapWireGrid(railY + 88 + phaseLaneOffset(group.color));
    const endX = Math.max(source.x, ...targets.map((point) => point.x));
    const color = wireDisplayColor(group.color);
    const thickness = Math.max(...descriptors.map((descriptor) => descriptor.thickness));
    const trunkWireId = `solar-protection-trunk-${groupIndex}-${String(group.key).replace(/[^a-z0-9_-]/gi, "_")}`;
    const phaseLabel = group.color === "red" ? "L2" : group.color === "brown" || group.color === "orange" ? "L3" : "L1";
    const trunk = cleanRoutePoints([
      source,
      { x: source.x, y: busY },
      { x: endX, y: busY },
    ]);

    return (
      <g
        key={`solar-protection-phase-${group.key}-${groupIndex}`}
        className="cursor-pointer"
        data-wire-bundle="solar-protection-phase"
        onClick={() => selectEditableWire(trunkWireId)}
      >
        {renderReferenceRoute(`solar-protection-phase-${group.key}-${groupIndex}-trunk`, trunk, color, thickness, {
          radius: 2,
          wireId: trunkWireId,
          visualOnly: true,
          colorName: group.color,
          name: `Tronco ${phaseLabel} proteção`,
        })}
        {renderCableTextTag({ x: source.x + 30, y: busY }, phaseLabel, color, `solar-protection-phase-${group.key}-${groupIndex}-phase`)}
        {groupIndex === 1 && renderCableTextTag({ x: (source.x + endX) / 2, y: busY + 18 }, "DJ ENTRADA -> DJ SAIDA", COLORS.phaseA, `solar-protection-phase-${group.key}-${groupIndex}-label`)}
        {descriptors.map((descriptor) => {
          const branch = cleanRoutePoints([
            { x: descriptor.p2.x, y: busY },
            descriptor.p2,
          ]);
          return renderDescriptorPath(descriptor, branch, `${descriptor.wire.id}-solar-protection-branch`, {
            color,
            thickness,
            radius: 2,
            showGauge: false,
            showTap: true,
            startTerminal: true,
            endTerminal: true,
          });
        })}
      </g>
    );
  };

  const renderSolarServiceToInverterGroup = (group, groupIndex) => {
    const descriptors = group.descriptors;
    if (!descriptors.length) return null;

    const sameRail = descriptors.every((descriptor) => (
      descriptor.sourceMeta?.railIndex === descriptor.targetMeta?.railIndex
    ));
    const railIndex = Math.max(0, descriptors[0].targetMeta?.railIndex ?? descriptors[0].sourceMeta?.railIndex ?? 0);
    const labelAnchor = {
      x: (Math.min(...descriptors.map((descriptor) => descriptor.p1.x), ...descriptors.map((descriptor) => descriptor.p2.x))
        + Math.max(...descriptors.map((descriptor) => descriptor.p1.x), ...descriptors.map((descriptor) => descriptor.p2.x))) / 2,
      y: sameRail
        ? getRailDuctY(railIndex, "top", -52)
        : getRailDuctY(railIndex, "top", -44),
    };

    return (
      <g
        key={`solar-service-inverter-${group.key}-${groupIndex}`}
        className="cursor-pointer"
        data-wire-bundle="solar-service-to-inverter"
        onClick={() => selectEditableWire(descriptors[0].wire.id)}
      >
        {descriptors.map((descriptor, descriptorIndex) => {
          const color = wireDisplayColor(descriptor.color);
          const thickness = descriptor.thickness;
          const indexedOffset = (descriptorIndex - (descriptors.length - 1) / 2) * PHASE_LANE_SPACING;
          const laneY = sameRail
            ? getRailDuctY(railIndex, "top", indexedOffset)
            : getRailDuctY(railIndex, "top", indexedOffset);
          const routePoints = cleanRoutePoints([
            descriptor.p1,
            { x: descriptor.p1.x, y: laneY },
            { x: descriptor.p2.x, y: laneY },
            descriptor.p2,
          ]);

          return renderDescriptorPath(descriptor, routePoints, `${descriptor.wire.id}-service-inverter`, {
            color,
            thickness,
            radius: 2,
            showGauge: false,
            startTerminal: true,
            endTerminal: true,
          });
        })}
        {renderCableTextTag(labelAnchor, "DJ SAIDA -> DJ INVERSOR", COLORS.phaseA, `solar-service-inverter-${group.key}-${groupIndex}-label`)}
      </g>
    );
  };

  const renderPhaseDistributionGroup = (group, groupIndex) => {
    const descriptors = group.descriptors;
    if (!descriptors.length) return null;

    const color = wireDisplayColor(group.color);

    return (
      <g
        key={`phase-distribution-${group.key}-${groupIndex}`}
        className="cursor-pointer"
        data-wire-bundle="phase-distribution"
      >
        {descriptors.map((descriptor) => {
          const routePoints = cleanRoutePoints([
            descriptor.p1,
            descriptor.p2,
          ]);
          return renderDescriptorPath(descriptor, routePoints, `${descriptor.wire.id}-distribution-independent`, {
            color,
            thickness: descriptor.thickness,
            radius: 1,
            startTerminal: true,
            endTerminal: true,
          });
        })}
      </g>
    );
  };

  const renderPhaseOutputWire = (descriptor) => {
    const loadEndpoint = getLoadEndpoint(descriptor);
    if (!loadEndpoint) return null;
    const devicePoint = descriptor.sourceMeta?.type === "load" ? descriptor.p2 : descriptor.p1;
    const dropY = snapWireGrid(devicePoint.y + 68 + phaseLaneOffset(descriptor.color));
    const routePoints = cleanRoutePoints([
      devicePoint,
      { x: devicePoint.x, y: dropY },
      { x: loadEndpoint.point.x, y: dropY },
      loadEndpoint.point,
    ]);

    return renderDescriptorPath(descriptor, routePoints, `${descriptor.wire.id}-output`, {
      radius: 2,
      showLabel: true,
      startTerminal: true,
      endTerminal: true,
    });
  };

  const getNeutralBranchLaneY = (point, meta, descriptor, branchIndex = 0) => {
    if (meta?.type === "load") return snapWireGrid(point.y);

    const railIndex = Math.max(0, meta?.railIndex ?? descriptor.targetMeta?.railIndex ?? descriptor.sourceMeta?.railIndex ?? 0);
    const side = meta?.term === "bottom" ? "bottom" : "top";
    const laneOffset = side === "top" ? -20 : 16;
    const laneY = getRailDuctY(railIndex, side, laneOffset + (branchIndex % 2) * 6);
    return Math.max(getNeutralBackboneTopY() + 22, snapWireGrid(laneY));
  };

  const routeNeutralDescriptorBranches = (descriptor) => {

    const endpoints = getBusbarBranchEndpoints(descriptor);
    const busPoint = getNeutralBusPoint(descriptor);

    if (endpoints.length === 2 || !endpoints.length) {
      return [routeLocalDeviceJumper(descriptor)];
    }

    return endpoints.map(({ point, pin, meta }, branchIndex) => {
      const start = busPoint || { x: getNeutralBackboneX(), y: getNeutralBackboneTopY() };

      if (String(pin).startsWith("load_out:")) {
        const branchY = snapWireGrid(point.y);
        return cleanRoutePoints([
          start,
          { x: start.x, y: branchY },
          { x: point.x, y: branchY },
          point,
        ]);
      }

      if (meta?.type === "component" && meta?.term === "top" && Number(meta?.railIndex) === 0) {
        const laneY = snapWireGrid((busPoint?.y ?? NEUTRAL_BUS.pinY) + 34 + (branchIndex % 3) * 8);
        return cleanRoutePoints([
          start,
          { x: start.x, y: laneY },
          { x: point.x, y: laneY },
          point,
        ]);
      }

      const laneY = getNeutralBranchLaneY(point, meta, descriptor, branchIndex);
      return cleanRoutePoints([
        start,
        { x: start.x, y: laneY },
        { x: point.x, y: laneY },
        point,
      ]);
    });
  };

  const renderNeutralBranchWire = (descriptor) => {
    if (descriptor.wire?.id?.includes("main") || descriptor.wire?.id?.includes("backbone") || descriptor.wire?.id?.includes("tie")) return null;
    return routeNeutralDescriptorBranches(descriptor).map((routePoints, index) => {
      const branchId = `${descriptor.wire.id}-neutral-${index}`;
      const customWire = wires.find(w => w.id === branchId);
      if (customWire?.deleted) return null;
      let finalStart = routePoints[0];
      let finalEnd = routePoints[routePoints.length - 1];
      if (customWire?.source) finalStart = getPinCoords(customWire.source, rails, panelHeight, infrastructure) || finalStart;
      if (customWire?.target) finalEnd = getPinCoords(customWire.target, rails, panelHeight, infrastructure) || finalEnd;

      let innerPoints = customWire?.route_points?.length > 0 ? [...customWire.route_points] : [...routePoints.slice(1, -1)];
      
      if (!(customWire?.route_points?.length > 0) && innerPoints.length > 0) {
        const lastInner = innerPoints[innerPoints.length - 1];
        const origEnd = routePoints[routePoints.length - 1];
        const origPrev = routePoints[routePoints.length - 2];
        if (Math.abs(origPrev.y - origEnd.y) < 2) lastInner.y = finalEnd.y;
        else if (Math.abs(origPrev.x - origEnd.x) < 2) lastInner.x = finalEnd.x;

        const firstInner = innerPoints[0];
        const origStart = routePoints[0];
        const origNext = routePoints[1];
        if (Math.abs(origNext.y - origStart.y) < 2) firstInner.y = finalStart.y;
        else if (Math.abs(origNext.x - origStart.x) < 2) firstInner.x = finalStart.x;
      }
      
      const activeRoutePoints = [finalStart, ...innerPoints, finalEnd];
      
      const branchDesc = { ...descriptor, wire: { ...descriptor.wire, id: branchId, route_points: [] } };
      
      return renderDescriptorPath(branchDesc, activeRoutePoints, branchId, {
        color: customWire?.color ? wireDisplayColor(customWire.color) : COLORS.neutral,
        radius: PROFESSIONAL_BUS.branchRadius,
        showTap: true,
        showLabel: hasLoadEndpoint(descriptor),
        startTerminal: true,
        endTerminal: true,
      });
    });
  };

const getGroundBusPoint = (descriptor = {}, infrastructure = [], panelHeight = 820) => {
  const source = String(descriptor.wire?.source || "");
  const target = String(descriptor.wire?.target || "");
  let pinId = isGroundBusPin(source) ? source : (isGroundBusPin(target) ? target : null);
  if (!pinId) return null;
  const pinIdx = parseInt(pinId.split(":")[1]);
  if (isNaN(pinIdx)) return null;
  
  const groundBus = getGroundBusLayout(infrastructure, panelHeight);
  const x = groundBus.pinStartX + (Math.abs(Number(pinIdx) || 0) % GROUND_BUS.pinCount) * groundBus.pinGap;
  const y = groundBus.pinY;
  return { x, y };
};

  const routeGroundDescriptorBranches = (descriptor) => {
    if (isTerminalFeedWire(descriptor)) return [];

    const endpoints = getBusbarBranchEndpoints(descriptor);
    
    const groundLayout = getGroundBusLayout(infrastructure, panelHeight);
    const bottomY = groundLayout.pinY;

    const busPoint = getGroundBusPoint(descriptor, infrastructure, panelHeight) || { x: PROFESSIONAL_BUS.groundLeftX, y: bottomY };

    if (endpoints.length === 2 || !endpoints.length) {
      return [routeLocalDeviceJumper(descriptor)];
    }

    return endpoints.map(({ point, pin, meta }, branchIndex) => {
      if (String(pin).startsWith("load_out:") || point.y >= panelHeight - 140) {
        const branchY = snapWireGrid(point.y);

        return cleanRoutePoints([
          busPoint,
          { x: busPoint.x, y: branchY },
          { x: point.x, y: branchY },
          point,
        ]);
      }

      const riserX = PROFESSIONAL_BUS.groundLeftX;
      const isDpsGround = /dps/i.test(`${descriptor.wire?.id || ""}:${pin || ""}`);
      if (isDpsGround) {
        const railIndex = Math.max(0, meta?.railIndex ?? descriptor.sourceMeta?.railIndex ?? descriptor.targetMeta?.railIndex ?? 0);
        const laneY = getRailDuctY(railIndex, "bottom", -8 + (branchIndex % 2) * 6);
        return cleanRoutePoints([
          busPoint,
          { x: busPoint.x, y: laneY },
          { x: riserX, y: laneY },
          { x: point.x, y: laneY },
          { x: point.x, y: point.y },
          point,
        ]);
      }

      return cleanRoutePoints([
        busPoint,
        { x: busPoint.x, y: point.y },
        point,
      ]);
    });
  };

  const renderGroundBranchWire = (descriptor) => {
    if (descriptor.wire?.id?.includes("main") || descriptor.wire?.id?.includes("backbone") || descriptor.wire?.id?.includes("tie")) return null;
    return routeGroundDescriptorBranches(descriptor).map((routePoints, index) => {
      const branchId = `${descriptor.wire.id}-ground-${index}`;
      const customWire = wires.find(w => w.id === branchId);
      if (customWire?.deleted) return null;
      let finalStart = routePoints[0];
      let finalEnd = routePoints[routePoints.length - 1];
      if (customWire?.source) finalStart = getPinCoords(customWire.source, rails, panelHeight, infrastructure) || finalStart;
      if (customWire?.target) finalEnd = getPinCoords(customWire.target, rails, panelHeight, infrastructure) || finalEnd;

      let innerPoints = customWire?.route_points?.length > 0 ? [...customWire.route_points] : [...routePoints.slice(1, -1)];
      
      if (!(customWire?.route_points?.length > 0) && innerPoints.length > 0) {
        const lastInner = innerPoints[innerPoints.length - 1];
        const origEnd = routePoints[routePoints.length - 1];
        const origPrev = routePoints[routePoints.length - 2];
        if (Math.abs(origPrev.y - origEnd.y) < 2) lastInner.y = finalEnd.y;
        else if (Math.abs(origPrev.x - origEnd.x) < 2) lastInner.x = finalEnd.x;

        const firstInner = innerPoints[0];
        const origStart = routePoints[0];
        const origNext = routePoints[1];
        if (Math.abs(origNext.y - origStart.y) < 2) firstInner.y = finalStart.y;
        else if (Math.abs(origNext.x - origStart.x) < 2) firstInner.x = finalStart.x;
      }
      
      const activeRoutePoints = [finalStart, ...innerPoints, finalEnd];
      
      const branchDesc = { ...descriptor, wire: { ...descriptor.wire, id: branchId, route_points: [] } };
      
      return renderDescriptorPath(branchDesc, activeRoutePoints, branchId, {
        color: customWire?.color ? wireDisplayColor(customWire.color) : COLORS.ground,
        radius: PROFESSIONAL_BUS.branchRadius,
        showTap: true,
        showLabel: hasLoadEndpoint(descriptor),
        startTerminal: true,
        endTerminal: true,
      });
    });
  };

  const getSolarComponents = () => (
    rails.flatMap((rail) => rail.components || []).filter((component) => component.type !== "spacer")
  );

  const getSolarReferenceComponent = (predicate) => getSolarComponents().find(predicate);

  const isValidWirePoint = (point) => (
    point && Number.isFinite(point.x) && Number.isFinite(point.y) && (point.x !== 0 || point.y !== 0)
  );

  const getSolarPinPoint = (componentId, term, poleIndex = 0) => (
    getPinCoords(`comp:${componentId}:${term}:${poleIndex}`, rails, panelHeight, infrastructure)
  );

  const getWireDescriptorById = (wireId) => (
    routedWires.find((descriptor) => descriptor.wire?.id === wireId) || null
  );

  const getReferenceWirePoints = (wireId, fallbackSource, fallbackTarget) => {
    const descriptor = getWireDescriptorById(wireId);
    if (!descriptor) return null;
    return { source: descriptor.p1, target: descriptor.p2, descriptor };
  };

  const getIncomingEndpoint = (descriptor) => {
    if (!descriptor) return null;
    if (descriptor.sourceMeta?.type === "incoming") return descriptor.p1;
    if (descriptor.targetMeta?.type === "incoming") return descriptor.p2;
    return null;
  };

  const getComponentEndpoint = (descriptor) => {
    if (!descriptor) return null;
    if (descriptor.sourceMeta?.type === "component") return descriptor.p1;
    if (descriptor.targetMeta?.type === "component") return descriptor.p2;
    return null;
  };

  const renderWireTap = (point, baseColor, key) => {
    if (!isValidWirePoint(point)) return null;
    return (
      <g key={key} pointerEvents="none">
        <circle cx={point.x} cy={point.y} r="3.1" fill="#ffffff" stroke={cableEdgeColor(baseColor)} strokeWidth="1.1" />
        <circle cx={point.x} cy={point.y} r="1.55" fill={baseColor} />
      </g>
    );
  };

  const renderReferenceRoute = (id, routePoints, baseColor, thickness = 4.7, options = {}) => {
    let fallbackPoints = cleanRoutePoints(routePoints);
    if (fallbackPoints.length < 2) return null;
    const radius = options.radius ?? 6;
    const wireId = options.wireId || "";
    const storedWire = wireId ? getStoredWire(wireId) : null;
    if (storedWire?.deleted) return null;
    const descriptor = wireId ? getWireDescriptorById(wireId) : null;
    const activeWire = wireId ? getEditableWire(wireId) : {};
    if (wireId && !isCableVisible(activeWire)) return null;
    if (wireId && fallbackPoints.length >= 2) {
      const anchoredPoints = [...fallbackPoints];
      const sourcePoint = activeWire.source ? getPinCoords(activeWire.source, rails, panelHeight, infrastructure) : null;
      const targetPoint = activeWire.target ? getPinCoords(activeWire.target, rails, panelHeight, infrastructure) : null;
      if (isValidWirePoint(sourcePoint)) anchoredPoints[0] = sourcePoint;
      if (isValidWirePoint(targetPoint)) anchoredPoints[anchoredPoints.length - 1] = targetPoint;
      fallbackPoints = cleanRoutePoints(anchoredPoints);
    }
    const hasCustomRoute = Boolean(
      storedWire?.route_points?.length
      || getCableControlPoints(storedWire || {}).length
      || activeWire.route_points?.length
      || getCableControlPoints(activeWire).length
    );
    if (wireId && !hasCustomRoute && fallbackPoints.length >= 2) {
      fallbackPoints = cleanRoutePoints([fallbackPoints[0], fallbackPoints[fallbackPoints.length - 1]]);
    }
    const baseDisplayColor = storedWire?.color
      ? wireDisplayColor(normalizedWireColor(storedWire))
      : baseColor;
    const hasEditableThickness = Boolean(storedWire) || getExplicitWireThickness(activeWire) !== null;
    const effectiveThickness = hasEditableThickness
      ? getEffectiveWireThickness(activeWire, thickness)
      : thickness;
    const registeredPoints = wireId
      ? registerWireRoute(activeWire, fallbackPoints, {
          descriptor,
          color: baseDisplayColor,
          colorName: activeWire.color || options.colorName,
          gauge: options.gauge,
          name: options.name,
          thickness: effectiveThickness,
          visualOnly: options.visualOnly ?? !descriptor,
        })
      : fallbackPoints;
    const points = getEditableWireRoutePoints(activeWire, registeredPoints);
	    const isHighlighted = wireId && (selectedWireId === wireId || hoveredWireId === wireId);
	    const explicitTextLabel = cleanDisplayText(activeWire?.labelMeta?.text || "");
	    const handleSelectWire = (event) => {
	      if (!wireId) return;
	      event.stopPropagation();
      selectEditableWire(wireId);
    };
    return (
      <g
        key={id}
        data-wire-reference={id}
        data-wire-id={wireId || undefined}
        className={wireId ? "cursor-pointer" : undefined}
        pointerEvents={wireId ? "auto" : "none"}
        onPointerEnter={() => wireId && setHoveredWireId(wireId)}
        onPointerLeave={() => wireId && setHoveredWireId("")}
        onClick={handleSelectWire}
      >
        {renderCablePath(
          getRoundedPath(points, getCableCornerRadius(activeWire, radius)),
          baseDisplayColor,
          effectiveThickness,
          `${id}-path`,
          Boolean(isHighlighted),
          { lineStyle: getCableLineStyle(activeWire) },
        )}
	        {options.startTerminal && renderCableTerminal(points[0], points[1], baseDisplayColor, effectiveThickness, `${id}-start`, null)}
	        {options.endTerminal && renderCableTerminal(points[points.length - 1], points[points.length - 2], baseDisplayColor, effectiveThickness, `${id}-end`, null)}
	        {options.label && renderCableTextTag(options.labelPoint || getCableLabelAnchor(points), options.label, baseDisplayColor, `${id}-label`, options.labelOptions)}
	        {wireId && explicitTextLabel && renderDestinationLabel(
	          { wire: activeWire, kind: getWireKind(normalizedWireColor(activeWire)) },
	          points,
	          `${id}-wire-label`,
	          { includeDefault: false },
	        )}
	      </g>
	    );
	  };

  const renderSolarReferencePhaseInput = (phase, feeder, dps) => {
    const feedWireId = `solar_phase_feed_${phase.index}`;
    const dpsWireId = `solar_dps_phase_${phase.index}`;
    const feedDescriptor = getWireDescriptorById(feedWireId);
    const dpsDescriptor = getWireDescriptorById(dpsWireId);
    const terminal = getIncomingEndpoint(feedDescriptor)
      || getIncomingEndpoint(dpsDescriptor)
      || getPinCoords(`terminal_left_top:${phase.index + 1}`, rails, panelHeight, infrastructure);
    const feederTop = getComponentEndpoint(feedDescriptor) || (feeder ? getSolarPinPoint(feeder.id, "top", phase.index) : null);
    const dpsTop = getComponentEndpoint(dpsDescriptor) || (dps ? getSolarPinPoint(dps.id, "top", 0) : null);
    const devices = [
      { point: feederTop, wireId: feedWireId },
      { point: dpsTop, wireId: dpsWireId },
    ].filter((item) => isValidWirePoint(item.point)).sort((a, b) => a.point.x - b.point.x);
    if (!isValidWirePoint(terminal) || devices.length === 0) return null;

    const laneY = 88 + phase.index * PHASE_LANE_SPACING;
    const endX = Math.max(...devices.map(({ point }) => point.x));
    const trunk = [
      terminal,
      { x: terminal.x, y: laneY },
      { x: endX, y: laneY },
    ];
    const feedWire = getEditableWire(feedWireId);
    const feedBends = getWireRouteBends(feedWire);

    return (
      <g key={`solar-reference-input-${phase.label}`}>
        {renderReferenceRoute(`solar-reference-input-${phase.label}-trunk`, feedBends.length ? [terminal, ...feedBends, { x: endX, y: laneY }] : trunk, phase.color, 4.8, { radius: 7, wireId: feedWireId })}
        {renderCableTextTag({ x: terminal.x + 24, y: laneY }, phase.label, phase.color, `solar-reference-input-${phase.label}-tag`)}
        {devices.map(({ point, wireId }, index) => {
          const tap = { x: point.x, y: laneY };
          const deviceBends = getWireRouteBends(getEditableWire(wireId));
          return (
            <g key={`solar-reference-input-${phase.label}-branch-${index}`}>
              {renderReferenceRoute(`solar-reference-input-${phase.label}-branch-${index}`, deviceBends.length ? [tap, ...deviceBends, point] : [tap, point], phase.color, 4.8, { radius: 5, wireId })}
              {renderWireTap(tap, phase.color, `solar-reference-input-${phase.label}-tap-${index}`)}
            </g>
          );
        })}
      </g>
    );
  };

  const renderSolarReferencePhaseRoute = (id, phase, sourcePoint, targetPoint, laneY, options = {}) => {
    if (!isValidWirePoint(sourcePoint) || !isValidWirePoint(targetPoint)) return null;
    const wire = options.wireId ? getEditableWire(options.wireId) : {};
    const bends = getWireRouteBends(wire);
    const route = bends.length ? [sourcePoint, ...bends, targetPoint] : [
      sourcePoint,
      { x: sourcePoint.x, y: laneY },
      { x: targetPoint.x, y: laneY },
      targetPoint,
    ];
    return renderReferenceRoute(id, route, phase.color, options.thickness || 4.8, options);
  };

  const renderSolarReferenceWiring = () => {
    const feeder = getSolarReferenceComponent((component) => (
      component.isSolarFeeder || component.id === "solar_feeder_breaker" || /entrada|alimentador/i.test(String(component.label || ""))
    ));
    const service = getSolarReferenceComponent((component) => (
      component.isSolarServiceDisconnect || component.id === "solar_service_breaker" || /sa[ií]da/i.test(String(component.label || ""))
    ));
    const inverter = getSolarReferenceComponent((component) => (
      component.id === "solar_main_breaker" || /inversor/i.test(String(component.label || ""))
    ));
    const dpsList = getSolarComponents()
      .filter((component) => component.type === "dps")
      .sort((a, b) => String(a.phase || a.id).localeCompare(String(b.phase || b.id)));

    if (!feeder || !inverter) return renderDuctedWiringPlan();

    const phases = [
      { index: 0, label: "L1", color: COLORS.phaseA },
      { index: 1, label: "L2", color: COLORS.phaseB },
      { index: 2, label: "L3", color: COLORS.phaseC },
    ];
    const groundLaneX = getGroundBackboneLeftX();

    return (
      <g id="solar-reference-complete-wiring">
        {phases.map((phase) => renderSolarReferencePhaseInput(phase, feeder, dpsList[phase.index]))}

        {service && phases.map((phase) => {
          const wireId = `solar_phase_feeder_to_service_${phase.index}`;
          const points = getReferenceWirePoints(
            wireId,
            getSolarPinPoint(feeder.id, "bottom", phase.index),
            getSolarPinPoint(service.id, "top", phase.index)
          );
          if (!points) return null;
          const { source, target } = points;
          const laneY = 282 + phase.index * PHASE_LANE_SPACING;
          return renderSolarReferencePhaseRoute(
            `solar-reference-feeder-service-${phase.label}`,
            phase,
            source,
            target,
            laneY,
            phase.index === 1
              ? { label: "DJ ENTRADA -> DJ SAIDA", labelPoint: { x: (source.x + target.x) / 2, y: laneY - 14 }, radius: 7, wireId }
              : { wireId, radius: 7 }
          );
        })}

        {service && phases.map((phase) => {
          const wireId = `solar_phase_service_to_inverter_${phase.index}`;
          const points = getReferenceWirePoints(
            wireId,
            getSolarPinPoint(service.id, "bottom", phase.index),
            getSolarPinPoint(inverter.id, "top", phase.index)
          );
          if (!points) return null;
          const { source, target } = points;
          const laneY = 350 + phase.index * PHASE_LANE_SPACING;
          return renderSolarReferencePhaseRoute(
            `solar-reference-service-inverter-${phase.label}`,
            phase,
            source,
            target,
            laneY,
            phase.index === 1
              ? { label: "DJ SAIDA -> DJ INVERSOR", labelPoint: { x: (source.x + target.x) / 2, y: laneY - 14 }, radius: 7, wireId }
              : { wireId, radius: 7 }
          );
        })}

        {phases.map((phase) => {
          const wireId = `solar_phase_load_${phase.index}`;
          const points = getReferenceWirePoints(
            wireId,
            getSolarPinPoint(inverter.id, "bottom", phase.index),
            getPinCoords(`load_out:solar_inverter:${phase.index}`, rails, panelHeight, infrastructure)
          );
          if (!points) return null;
          const { source, target } = points;
          return renderSolarReferencePhaseRoute(
            `solar-reference-inverter-output-${phase.label}`,
            phase,
            source,
            target,
            Math.max(source.y + 74 + phase.index * 10, target.y - 28),
            {
              endTerminal: true,
              label: `VAI P/ INVERSOR ${phase.label}`,
              labelPoint: { x: target.x + 10, y: target.y + 46 },
              labelOptions: { rotate: -90 },
              wireId,
              radius: 7,
            }
          );
        })}

        {dpsList.map((dps, index) => {
          const wireId = `solar_dps_ground_${index}`;
          const points = getReferenceWirePoints(
            wireId,
            getSolarPinPoint(dps.id, "bottom", 0),
            { x: groundLaneX, y: 318 + index * 14 }
          );
          if (!points) return null;
          const point = points.source;
          const laneY = 318 + index * 14;
          const sideTap = { x: groundLaneX, y: laneY };
          return (
            <g key={`solar-reference-dps-pe-${dps.id}`}>
              {renderReferenceRoute(
                `solar-reference-dps-pe-${dps.id}`,
                [
                  point,
                  { x: point.x, y: laneY },
                  sideTap,
                ],
                COLORS.ground,
                4.6,
                { radius: 7, wireId }
              )}
              {renderWireTap(sideTap, COLORS.ground, `solar-reference-dps-pe-${dps.id}-tap`)}
            </g>
          );
        })}

      </g>
    );
  };

  const renderWiringLegend = () => {
    const width = 184;
    const height = 118;
    const rowH = 12.6;
    const x = Math.max(30, Math.min(PANEL_W - width - 30, legendPosition.x));
    const y = Math.max(30, Math.min(panelHeight - height - 30, legendPosition.y));
    const items = [
      { code: "L1", label: "Fase preta", color: COLORS.phaseA },
      { code: "L2", label: "Fase vermelha", color: COLORS.phaseB },
      { code: "L3", label: "Fase marrom", color: COLORS.phaseC },
      { code: "N", label: "Neutro azul", color: COLORS.neutral },
      { code: "PE", label: "Proteção terra", color: COLORS.ground },
      { code: "PENTE", label: "Barramento pente", color: COLORS.yellowComb },
    ];

    return (
      <g id="wiring-legend">
        <rect x={x + 2} y={y + 3} width={width} height={height} rx="8" fill="#0f172a" fillOpacity="0.13" />
        <rect x={x} y={y} width={width} height={height} rx="8" fill="#ffffff" fillOpacity="0.97" stroke="#cbd5e1" strokeWidth="0.9" />
        <g className="cursor-move" onPointerDown={startLegendDrag}>
          <rect x={x} y={y} width={width} height="23" rx="8" fill="#f8fafc" />
          <rect x={x} y={y + 15} width={width} height="8" fill="#f8fafc" />
          <line x1={x} y1={y + 23} x2={x + width} y2={y + 23} stroke="#e2e8f0" strokeWidth="0.8" />
          <circle cx={x + 11} cy={y + 11.5} r="3" fill="#e0f2fe" stroke="#0284c7" strokeWidth="0.75" pointerEvents="none" />
          <text x={x + 20} y={y + 14.6} fill="#0f172a" fontSize="7.2" fontWeight="950" pointerEvents="none">
            LEGENDA DAS LIGAÇÕES
          </text>
        </g>
        <g
          className="cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            setShowLegend(false);
          }}
        >
          <rect x={x + width - 21} y={y + 5} width="15" height="14" rx="4" fill="#fee2e2" stroke="#fecaca" strokeWidth="0.7" />
          <text x={x + width - 13.5} y={y + 15} fill="#dc2626" fontSize="8" fontWeight="950" textAnchor="middle" pointerEvents="none">
            x
          </text>
        </g>
        {items.map((item, index) => {
          const lineY = y + 34 + index * rowH;
          const isComb = item.code === "PENTE";
          return (
            <g key={item.label}>
              <line
                x1={x + 11}
                y1={lineY}
                x2={x + 41}
                y2={lineY}
                stroke={item.color}
                strokeWidth={isComb ? 4.8 : 3.6}
                strokeLinecap="round"
                pointerEvents="none"
              />
              <circle cx={x + 11} cy={lineY} r="2.35" fill="#ffffff" stroke={isComb ? "#854d0e" : cableEdgeColor(item.color)} strokeWidth="0.75" pointerEvents="none" />
              <text x={x + 50} y={lineY + 2.4} fill="#0f172a" fontSize="6.5" fontWeight="950" pointerEvents="none">
                {item.code}
              </text>
              <text x={x + 78} y={lineY + 2.4} fill="#475569" fontSize="6.35" fontWeight="800" pointerEvents="none">
                {item.label}
              </text>
            </g>
          );
        })}
        <line x1={x + 11} y1={y + height - 17} x2={x + width - 11} y2={y + height - 17} stroke="#e2e8f0" strokeWidth="0.8" />
        <text x={x + 11} y={y + height - 6.5} fill="#64748b" fontSize="5.5" fontWeight="800" pointerEvents="none">
          Trajetos ortogonais e curvas de 90 graus
        </text>
      </g>
    );
  };

  const renderLegendToggle = () => {
    const x = PANEL_W - 154;
    const y = 38;
    return (
      <g
        id="legend-toggle"
        className="cursor-pointer"
        onClick={(event) => {
          event.stopPropagation();
          setShowLegend(true);
        }}
      >
        <rect x={x + 1} y={y + 2} width="122" height="24" rx="7" fill="#0f172a" fillOpacity="0.12" />
        <rect x={x} y={y} width="122" height="24" rx="7" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.9" />
        <circle cx={x + 14} cy={y + 12} r="5.2" fill="#e0f2fe" stroke="#0284c7" strokeWidth="0.8" />
        <text x={x + 14} y={y + 14.4} fill="#0369a1" fontSize="7" fontWeight="950" textAnchor="middle" pointerEvents="none">
          i
        </text>
        <text x={x + 27} y={y + 14.8} fill="#0f172a" fontSize="7" fontWeight="900" pointerEvents="none">
          Mostrar legenda
        </text>
      </g>
    );
  };

  const renderDuctedWiringPlan = () => (
    <g id="ducted-wiring-plan">
      {ductedWiringPlan.solarIncomingPhaseGroups.map(renderSolarIncomingPhaseGroup)}
      {ductedWiringPlan.servicePower.map(renderPowerServiceWire)}
      {ductedWiringPlan.solarProtectionPhaseGroups.map(renderSolarProtectionPhaseGroup)}
      {ductedWiringPlan.solarServiceToInverterGroups.map(renderSolarServiceToInverterGroup)}
      {ductedWiringPlan.phaseDistributionGroups.map(renderPhaseDistributionGroup)}
      {ductedWiringPlan.phaseOutputs.map(renderPhaseOutputWire)}
      {ductedWiringPlan.neutralBranches.map(renderNeutralBranchWire)}
      {ductedWiringPlan.groundBranches.map(renderGroundBranchWire)}
    </g>
  );

  const connectionPinColor = (pin = {}) => {
    if (pin.kind === "neutral" || pin.kind === "blue") return COLORS.neutral;
    if (pin.kind === "ground" || pin.kind === "green") return COLORS.ground;
    if (pin.kind === "red") return COLORS.phaseB;
    if (pin.kind === "brown" || pin.kind === "orange") return COLORS.phaseC;
    return COLORS.phaseA;
  };

  const renderConnectionHotspots = () => {
    if (!showConnectionEditor) return null;
    const activeEndpoint = wireEndpointDrag?.endpoint || wireMoveMode;

    return (
      <g id="editable-connection-hotspots">
        {connectionPins.map((pin) => {
          const isHovered = hoveredPinId === pin.id;
          const isCurrentSource = selectedWireDescriptor?.wire?.source === pin.id;
          const isCurrentTarget = selectedWireDescriptor?.wire?.target === pin.id;
          const baseColor = connectionPinColor(pin);
          const shouldLabel = isHovered || isCurrentSource || isCurrentTarget;

          return (
            <g
              key={pin.id}
              className="cursor-crosshair"
              onClick={(event) => handleConnectionPinClick(event, pin.id)}
              onPointerEnter={() => setHoveredPinId(pin.id)}
              onPointerLeave={() => {
                if (!wireEndpointDrag) setHoveredPinId("");
              }}
            >
              <circle
                cx={pin.x}
                cy={pin.y}
                r={isHovered ? 12 : 8}
                fill="#ffffff"
                fillOpacity={isHovered ? 0.98 : 0.72}
                stroke={isHovered ? "#00d8b8" : baseColor}
                strokeWidth={isHovered || isCurrentSource || isCurrentTarget ? 2.4 : 1.4}
                filter={isHovered ? "url(#glow)" : undefined}
              />
              <circle
                cx={pin.x}
                cy={pin.y}
                r={isHovered ? 4.4 : 3.2}
                fill={baseColor}
                pointerEvents="none"
              />
              {(isCurrentSource || isCurrentTarget) && (
                <text
                  x={pin.x}
                  y={pin.y - 12}
                  fill={isCurrentSource ? "#00d8b8" : "#f97316"}
                  fontSize="6.5"
                  fontWeight="950"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {isCurrentSource ? "ORIGEM" : "DESTINO"}
                </text>
              )}
              {shouldLabel && (
                <g pointerEvents="none">
                  <rect
                    x={pin.x + 10}
                    y={pin.y - 10}
                    width={Math.max(42, String(pin.label || pin.id).length * 4.3 + 12)}
                    height="16"
                    rx="5"
                    fill="#0f172a"
                    fillOpacity="0.9"
                  />
                  <text x={pin.x + 16} y={pin.y + 1.2} fill="#ffffff" fontSize="6.2" fontWeight="900">
                    {activeEndpoint ? `${activeEndpoint === "source" ? "Origem" : "Destino"} -> ` : ""}
                    {pin.label || pin.id}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  const renderSelectedWireEndpointHandles = () => {
    const visualMeta = wireRouteMetaRef.current[selectedWireId];
    const selectedWire = getEditableWire(selectedWireId);
    if (!isCableVisible(selectedWire) || isCableLocked(selectedWire)) return null;

    if (visualMeta?.routePoints?.length >= 2) {
      const sourcePoint = wireEndpointDrag?.endpoint === "source" && endpointDragCoords
        ? endpointDragCoords
        : visualMeta.sourcePoint;
      const targetPoint = wireEndpointDrag?.endpoint === "target" && endpointDragCoords
        ? endpointDragCoords
        : visualMeta.targetPoint;
      const handles = [
        { endpoint: "source", label: "Origem", point: sourcePoint, color: "#00d8b8", pin: selectedWire.source },
        { endpoint: "target", label: "Destino", point: targetPoint, color: "#f97316", pin: selectedWire.target },
      ].filter((handle) => isValidWirePoint(handle.point));

      return (
        <g id="selected-wire-endpoint-handles">
          {handles.map((handle) => {
            const isDragging = wireEndpointDrag?.endpoint === handle.endpoint;
            const labelWidth = Math.max(36, handle.label.length * 5.4 + 12);
            return (
              <g
                key={handle.endpoint}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(event) => startWireEndpointDrag(event, handle.endpoint)}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveTab("wiring");
                  setWireMoveMode(handle.endpoint);
                }}
              >
                <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_HANDLE_HIT_RADIUS} fill="transparent" />
                <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ENDPOINT_HANDLE_RADIUS.outer} fill={handle.color} fillOpacity="0.14" stroke={handle.color} strokeWidth="1.15" strokeDasharray={isDragging ? "0" : "3,2.5"} />
                <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ENDPOINT_HANDLE_RADIUS.inner} fill="#ffffff" stroke={handle.color} strokeWidth="1.55" />
                <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ENDPOINT_HANDLE_RADIUS.dot} fill={handle.color} />
                <rect
                  x={handle.point.x - labelWidth / 2}
                  y={handle.point.y + 10}
                  width={labelWidth}
                  height="13.5"
                  rx="4"
                  fill={handle.color}
                  filter="url(#shadow)"
                />
                <text x={handle.point.x} y={handle.point.y + 19.6} fill="#ffffff" fontSize="5.8" fontWeight="950" textAnchor="middle" pointerEvents="none">
                  {handle.label}
                </text>
                {isDragging && hoveredPinId && (
                  <text x={handle.point.x} y={handle.point.y - 15} fill={handle.color} fontSize="6" fontWeight="950" textAnchor="middle" pointerEvents="none">
                    Solte no borne destacado
                  </text>
                )}
              </g>
            );
          })}
        </g>
      );
    }

    let descriptor = selectedWireDescriptor;
    
    if (!descriptor && (String(selectedWireId).includes("-ground-") || String(selectedWireId).includes("-neutral-"))) {
      const isGround = String(selectedWireId).includes("-ground-");
      const parentId = String(selectedWireId).split(isGround ? "-ground-" : "-neutral-")[0];
      descriptor = routedWires.find(d => d.wire?.id === parentId);
    }
    
    if (!descriptor) return null;

    const handles = [
      { endpoint: "source", label: "Origem", point: wireEndpointDrag?.endpoint === "source" && endpointDragCoords ? endpointDragCoords : descriptor.p1, color: "#00d8b8", pin: descriptor.wire.source },
      { endpoint: "target", label: "Destino", point: wireEndpointDrag?.endpoint === "target" && endpointDragCoords ? endpointDragCoords : descriptor.p2, color: "#f97316", pin: descriptor.wire.target },
    ].filter((handle) => isValidWirePoint(handle.point));

    return (
      <g id="selected-wire-endpoint-handles">
        {handles.map((handle) => {
          const isDragging = wireEndpointDrag?.endpoint === handle.endpoint;
          const labelWidth = Math.max(36, handle.label.length * 5.4 + 12);
          return (
            <g
              key={handle.endpoint}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => startWireEndpointDrag(event, handle.endpoint)}
              onClick={(event) => {
                event.stopPropagation();
                setActiveTab("wiring");
                setWireMoveMode(handle.endpoint);
              }}
            >
              <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_HANDLE_HIT_RADIUS} fill="transparent" />
              <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ENDPOINT_HANDLE_RADIUS.outer} fill={handle.color} fillOpacity="0.14" stroke={handle.color} strokeWidth="1.15" strokeDasharray={isDragging ? "0" : "3,2.5"} />
              <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ENDPOINT_HANDLE_RADIUS.inner} fill="#ffffff" stroke={handle.color} strokeWidth="1.55" />
              <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ENDPOINT_HANDLE_RADIUS.dot} fill={handle.color} />
              <rect
                x={handle.point.x - labelWidth / 2}
                y={handle.point.y + 10}
                width={labelWidth}
                height="13.5"
                rx="4"
                fill={handle.color}
                filter="url(#shadow)"
              />
              <text x={handle.point.x} y={handle.point.y + 19.6} fill="#ffffff" fontSize="5.8" fontWeight="950" textAnchor="middle" pointerEvents="none">
                {handle.label}
              </text>
              {isDragging && hoveredPinId && (
                <text x={handle.point.x} y={handle.point.y - 15} fill={handle.color} fontSize="6" fontWeight="950" textAnchor="middle" pointerEvents="none">
                  Solte no borne destacado
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  const renderSelectedWireRouteHandles = () => {
    let wire, bends, allPoints, baseColor;
    const visualMeta = wireRouteMetaRef.current[selectedWireId];

    if (visualMeta?.routePoints?.length >= 2) {
      wire = getEditableWire(selectedWireId);
      bends = getWireRouteBends(wire);
      const basePoints = visualMeta.routePoints;
      allPoints = bends.length
        ? cleanRoutePoints([basePoints[0], ...bends, basePoints[basePoints.length - 1]])
        : basePoints;
      baseColor = visualMeta.color || wireDisplayColor(normalizedWireColor(wire));
    } else if (String(selectedWireId).includes("backbone") || String(selectedWireId).includes("main") || String(selectedWireId).includes("tie")) {
      wire = wires.find(w => w.id === selectedWireId) || { id: selectedWireId, route_points: [] };
      bends = getWireRouteBends(wire);
      let defaultRoute = [];
      if (selectedWireId === "ground-main") defaultRoute = getGroundBackboneRoute(panelHeight, infrastructure);
      else if (selectedWireId === "neutral-main") defaultRoute = getNeutralBackboneRoute(panelHeight, neutralBackboneEndY);
      else if (selectedWireId === "ground-bus-tie") defaultRoute = getGroundBusTieRoute(panelHeight, infrastructure);
      else if (selectedWireId === "neutral-bus-tie") defaultRoute = getNeutralBusTieRoute(infrastructure);

      if (!defaultRoute.length) return null;
      allPoints = cleanRoutePoints([defaultRoute[0], ...bends, defaultRoute[defaultRoute.length - 1]]);
      baseColor = selectedWireId.includes("ground") ? COLORS.ground : COLORS.neutral;
    } else if (String(selectedWireId).includes("-ground-") || String(selectedWireId).includes("-neutral-")) {
      wire = wires.find(w => w.id === selectedWireId) || { id: selectedWireId, route_points: [] };
      bends = getWireRouteBends(wire);
      const basePoints = wirePathsRef.current[selectedWireId] || [];
      if (!basePoints.length) return null;
      allPoints = cleanRoutePoints([basePoints[0], ...bends, basePoints[basePoints.length - 1]]);
      baseColor = selectedWireId.includes("ground") ? COLORS.ground : COLORS.neutral;
    } else if (selectedWireDescriptor) {
      wire = getEditableWire(selectedWireId);
      bends = getWireRouteBends(wire);
      const sourcePoint = wire.source ? getPinCoords(wire.source, rails, panelHeight, infrastructure) : selectedWireDescriptor.p1;
      const targetPoint = wire.target ? getPinCoords(wire.target, rails, panelHeight, infrastructure) : selectedWireDescriptor.p2;
      allPoints = cleanRoutePoints([
        isValidWirePoint(sourcePoint) ? sourcePoint : selectedWireDescriptor.p1,
        ...bends,
        isValidWirePoint(targetPoint) ? targetPoint : selectedWireDescriptor.p2,
      ]);
      baseColor = wireDisplayColor(selectedWireDescriptor.color);
    } else {
      return null;
    }

    if (!isCableVisible(wire) || isCableLocked(wire)) return null;

    const routeHandles = [];
    const segmentHandles = [];
    
    // Add real bends
    bends.forEach((point, index) => {
      routeHandles.push({ point, index, isVirtual: false });
    });

    // Add virtual midpoints for every segment
    for (let i = 0; i < allPoints.length - 1; i++) {
      const midpoint = getRouteMidpoint([allPoints[i], allPoints[i + 1]]);
      if (midpoint) {
        routeHandles.push({ point: midpoint, index: i, isVirtual: true });
        segmentHandles.push({
          index: i,
          start: allPoints[i],
          end: allPoints[i + 1],
          midpoint,
        });
      }
    }

    if (!routeHandles.length) return null;

    return (
      <g id="selected-wire-route-handles">
        {segmentHandles.map((segment) => {
          const isDragging = wireSegmentDrag?.wireId === wire.id && wireSegmentDrag?.segmentIndex === segment.index;
          const isHorizontal = Math.abs(segment.end.y - segment.start.y) <= Math.abs(segment.end.x - segment.start.x);
          return (
            <g
              key={`${wire.id}-segment-${segment.index}`}
              className={isHorizontal ? "cursor-ns-resize" : "cursor-ew-resize"}
              onPointerDown={(event) => startWireSegmentDrag(event, wire.id, segment.index, allPoints)}
              onClick={(event) => {
                event.stopPropagation();
                selectEditableWire(wire.id);
              }}
            >
              <line
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                stroke="transparent"
                strokeWidth="18"
                strokeLinecap="round"
                pointerEvents="stroke"
              />
              <line
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                stroke="#00d8b8"
                strokeWidth={isDragging ? "2" : "1.2"}
                strokeDasharray="4,4"
                strokeOpacity={isDragging ? "0.85" : "0.28"}
                strokeLinecap="round"
                pointerEvents="none"
              />
            </g>
          );
        })}
        {routeHandles.map((handle) => {
          const isDragging = wireRoutePointDrag?.wireId === wire.id && wireRoutePointDrag?.index === handle.index;
          const label = handle.isVirtual ? "Dobrar" : `Ponto ${handle.index + 1}`;
          const labelWidth = Math.max(34, label.length * 5.1 + 12);

          return (
            <g
              key={`${wire.id}-route-${handle.index}-${handle.isVirtual ? "virtual" : "bend"}`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => startWireRoutePointDrag(event, wire.id, handle.index, handle.point, handle.isVirtual)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (!handle.isVirtual) {
                  const newBends = bends.filter((_, i) => i !== handle.index);
                  setWireRoutePoints(wire.id, newBends);
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!handle.isVirtual) {
                  const newBends = bends.filter((_, i) => i !== handle.index);
                  setWireRoutePoints(wire.id, newBends);
                  setSelectedRoutePoint(null);
                }
              }}
              onClick={(event) => {
                event.stopPropagation();
                selectEditableWire(wire.id);
                if (!handle.isVirtual) {
                  setSelectedRoutePoint({ wireId: wire.id, index: handle.index });
                }
              }}
            >
              <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_HANDLE_HIT_RADIUS} fill="transparent" />
              <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ROUTE_HANDLE_RADIUS.outer} fill="#ffffff" fillOpacity="0.86" stroke="#00d8b8" strokeWidth="1.1" strokeDasharray={isDragging ? "0" : "3,2.5"} />
              <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ROUTE_HANDLE_RADIUS.inner} fill={baseColor} stroke="#ffffff" strokeWidth="1.25" />
              <circle cx={handle.point.x} cy={handle.point.y} r={WIRE_ROUTE_HANDLE_RADIUS.dot} fill="#00d8b8" />
              <rect
                x={handle.point.x - labelWidth / 2}
                y={handle.point.y - 25}
                width={labelWidth}
                height="12.5"
                rx="4"
                fill={selectedRoutePoint?.wireId === wire.id && selectedRoutePoint?.index === handle.index ? "#0f766e" : "#00d8b8"}
                filter="url(#shadow)"
              />
              <text x={handle.point.x} y={handle.point.y - 16.5} fill="#ffffff" fontSize="5.6" fontWeight="950" textAnchor="middle" pointerEvents="none">
                {label}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const renderComponentDragPreview = () => {
    if (!componentDrag?.active) return null;
    const targetRailIndex = Math.max(0, Math.min(rails.length - 1, Math.round((componentDrag.y - 190) / 240)));
    const railY = 190 + targetRailIndex * 240;
    const dropX = Math.max(148, Math.min(PANEL_W - 148, componentDrag.x));

    return (
      <g id="component-drag-preview" pointerEvents="none">
        <rect x="132" y={railY - 66} width={PANEL_W - 264} height="132" rx="10" fill="#00d8b8" fillOpacity="0.08" stroke="#00d8b8" strokeWidth="1.4" strokeDasharray="7,5" />
        <line x1={dropX} y1={railY - 62} x2={dropX} y2={railY + 62} stroke="#00d8b8" strokeWidth="2.2" strokeDasharray="5,4" />
        <rect x={dropX - 58} y={railY - 84} width="116" height="19" rx="6" fill="#00d8b8" />
        <text x={dropX} y={railY - 71} fill="#ffffff" fontSize="7.2" fontWeight="950" textAnchor="middle">
          Solte para mover aqui
        </text>
      </g>
    );
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-20 app-page-enter">
      <PageHeader
        icon={LayoutGrid}
        title="Quadro Elétrico"
        subtitle="Construa, dimensione e organize visualmente os disjuntores, barramentos e cabeamentos do seu quadro."
      >
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-12 min-w-[220px] rounded-[14px] border-[#BCEEE5] bg-white text-sm font-bold shadow-md">
            <SelectValue placeholder="Selecionar projeto..." />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      {project && (
        <section className="overflow-hidden rounded-2xl border border-[#CDEFE8] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF4FB] text-primary">
                <PanelTop className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-slate-900">Quadros do projeto</h3>
                <p className="text-[11px] font-bold text-slate-500">{panelBoards.length} cadastrado(s)</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button
                size="sm"
                className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700"
                onClick={handleGenerateQgbt}
                disabled={qgbtSourceCount === 0}
                title="Gerar quadro geral com o disjuntor principal de cada quadro"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Gerar QGBT
              </Button>
              <Button variant="outline" size="sm" className="h-9 rounded-lg px-3 text-xs font-extrabold" onClick={handleAddBoard}>
                <Plus className="h-3.5 w-3.5" />
                Novo
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-red-200 px-3 text-xs font-extrabold text-red-600 hover:text-red-700"
                onClick={handleDeleteActiveBoard}
                disabled={panelBoards.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border-b border-slate-100 bg-slate-50/60 p-3 lg:border-b-0 lg:border-r">
              <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                {panelBoards.map((board) => {
                  const isActive = board.id === activeBoardId;
                  const usedModules = getBoardUsedModules(board);
                  const railsCount = board.layout?.rails?.length || 0;
                  return (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => handleSelectBoard(board.id)}
                      className={`flex min-w-[210px] items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition lg:min-w-0 ${
                        isActive
                          ? "border-primary bg-white text-primary shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#BCEEE5] hover:bg-[#F8FBFD]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-extrabold">{board.name}</span>
                          {board.type === "qgbt" && (
                            <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
                              QGBT
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-bold text-slate-500">
                          {railsCount} trilhos · {usedModules} DIN
                        </span>
                      </span>
                      {isActive && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">Quadro ativo</p>
                  <h4 className="text-lg font-extrabold text-slate-950">{activeBoard?.name || "Quadro"}</h4>
                </div>
                <div className="flex gap-2 text-[11px] font-extrabold text-slate-600">
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{rails.length} trilhos</span>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{getBoardUsedModules(activeBoard)} DIN</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1">{visibleWires.length} cabos</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Nome</Label>
                  <Input
                    value={activeBoard?.name || ""}
                    onChange={(event) => handleUpdateActiveBoard("name", event.target.value)}
                    className="h-10 rounded-lg bg-white text-sm font-extrabold"
                    placeholder="Ex: QD-01 Principal"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Local</Label>
                  <Input
                    value={activeBoard?.location || ""}
                    onChange={(event) => handleUpdateActiveBoard("location", event.target.value)}
                    className="h-10 rounded-lg bg-white text-sm font-bold"
                    placeholder="Ex: Pavimento térreo"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {!project ? (
        <div className="p-24 rounded-2xl bg-white border-2 border-dashed border-[#BCEEE5] text-center max-w-4xl mx-auto shadow-sm">
          <LayoutGrid className="w-16 h-16 mx-auto text-primary/30 mb-5 animate-pulse" />
          <h3 className="text-lg font-bold text-slate-800">Nenhum projeto selecionado</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">Selecione um projeto no topo para carregar o editor visual do quadro de distribuição elétrico.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* COLUNA DO EDITOR VISUAL (SVG CANVAS) */}
          <div className="xl:col-span-8 space-y-4" ref={containerRef}>
            
            {/* TOOLBAR DO QUADRO */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={wiringMode ? "destructive" : "secondary"} className="h-8 rounded-lg px-3 text-xs font-bold uppercase">
                      {wiringMode ? "Modo Conexão" : "Modo Navegação"}
                    </Badge>
                    <span className="truncate text-xs font-medium text-slate-500">
                      {wiringMode ? "Clique em dois bornes para ligar o cabo" : activeBoard?.name || "Quadro ativo"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => setScale(s => clampPanelScale(+((s ?? fitScale) - 0.1).toFixed(2)))} aria-label="Diminuir zoom" title="Diminuir zoom">
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="flex h-8 min-w-14 items-center justify-center text-xs font-extrabold text-slate-600">
                      {Math.round(activeScale * 100)}%
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => setScale(s => clampPanelScale(+((s ?? fitScale) + 0.1).toFixed(2)))} aria-label="Aumentar zoom" title="Aumentar zoom">
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={handleFitViewport} aria-label="Ajustar ao quadro" title="Ajustar ao quadro">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={showLegend ? "secondary" : "outline"}
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    onClick={() => setShowLegend((current) => !current)}
                    aria-label={showLegend ? "Ocultar legenda" : "Mostrar legenda"}
                    title={showLegend ? "Ocultar legenda" : "Mostrar legenda"}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={wiringMode ? "destructive" : "secondary"}
                    size="icon"
                    className="h-9 w-9 rounded-lg"
                    onClick={() => {
                      setWiringMode(!wiringMode);
                      setWiringStart("");
                    }}
                    aria-label={wiringMode ? "Cancelar fiação" : "Fiação rápida"}
                    title={wiringMode ? "Cancelar fiação" : "Fiação rápida"}
                  >
                    <Cable className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={handleExportSvg} aria-label="Exportar SVG" title="Exportar SVG">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-red-200 text-red-500" onClick={handleClearWires} aria-label="Limpar fiação" title="Limpar fiação">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* PAINEL DE DESENHO VETORIAL */}
            <div ref={panelViewportRef} className="overflow-auto rounded-2xl border border-slate-200 bg-[#eef2f6] p-6 shadow-lg min-h-[600px] flex items-center justify-center">
              <div
                style={{
                  width: PANEL_W * activeScale,
                  height: panelHeight * activeScale,
                  position: "relative",
                  transition: "width 0.2s, height 0.2s",
                }}
              >
                <div style={{ transformOrigin: "top left", transform: `scale(${activeScale})`, transition: "transform 0.2s" }}>
                  <svg
                    width={PANEL_W}
                    height={panelHeight}
                    viewBox={`0 0 ${PANEL_W} ${panelHeight}`}
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ fontFamily: "'Inter','Arial',sans-serif" }}
                    ref={svgRef}
                    onPointerDown={(e) => {
                      if (!wiringMode && (e.target.tagName === "svg" || e.target.id === "panel-background")) {
                        clearWireSelection({ exitWiringMode: false });
                      }
                    }}
                    onPointerMove={handleSvgPointerMove}
                    onPointerUp={handleSvgPointerUp}
                    onPointerCancel={() => {
                      setWireEndpointDrag(null);
                      setEndpointDragCoords(null);
	                      setWireRoutePointDrag(null);
	                      setLegendDrag(null);
	                      setComponentDrag(null);
	                      setTextDrag(null);
	                      setWireMoveMode("");
	                      setHoveredPinId("");
	                    }}
                    onClick={() => {
                      if (!wireEndpointDrag) setHoveredPinId("");
                    }}
                  >
                    {/* Definições de Gradientes Metálicos e Brilhos */}
                    <defs>
                      <linearGradient id="railGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#475569" />
                        <stop offset="30%" stopColor="#cbd5e1" />
                        <stop offset="50%" stopColor="#f1f5f9" />
                        <stop offset="70%" stopColor="#cbd5e1" />
                        <stop offset="100%" stopColor="#334155" />
                      </linearGradient>
                      <linearGradient id="brassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#b45309" />
                        <stop offset="30%" stopColor="#fbbf24" />
                        <stop offset="70%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#78350f" />
                      </linearGradient>
                      <linearGradient id="screwCageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#94a3b8" />
                        <stop offset="50%" stopColor="#cbd5e1" />
                        <stop offset="100%" stopColor="#475569" />
                      </linearGradient>
                      <linearGradient id="metallicScrew" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#cbd5e1" />
                        <stop offset="50%" stopColor="#64748b" />
                        <stop offset="100%" stopColor="#334155" />
                      </linearGradient>
                      <linearGradient id="breakerBody" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f8fafc" />
                        <stop offset="15%" stopColor="#f1f5f9" />
                        <stop offset="85%" stopColor="#e2e8f0" />
                        <stop offset="100%" stopColor="#cbd5e1" />
                      </linearGradient>
                      <linearGradient id="dpsBody" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="25%" stopColor="#dc2626" />
                        <stop offset="85%" stopColor="#b91c1c" />
                        <stop offset="100%" stopColor="#991b1b" />
                      </linearGradient>
                      <linearGradient id="drBody" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="20%" stopColor="#f8fafc" />
                        <stop offset="85%" stopColor="#f1f5f9" />
                        <stop offset="100%" stopColor="#e2e8f0" />
                      </linearGradient>
                      <linearGradient id="toggleGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                        <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
                      </linearGradient>
                      <linearGradient id="combBusbar" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="30%" stopColor="#fde047" />
                        <stop offset="70%" stopColor="#eab308" />
                        <stop offset="100%" stopColor="#ca8a04" />
                      </linearGradient>
                      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                        <feDropShadow dx="2" dy="5" stdDeviation="4" floodOpacity="0.15" />
                      </filter>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* 1. ESTRUTURA DO GABINETE (ENCLOSURE) */}
                    {/* Borda Externa */}
                    <rect x="15" y="15" width={PANEL_W-30} height={panelHeight-30} rx="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" filter="url(#shadow)" />
                    {/* Quadro Interno */}
                    <rect x="25" y="25" width={PANEL_W-50} height={panelHeight-50} rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
                    
                    {/* Canaletas Passa-fios Laterais (Pentes organizadores amarelos na borda) */}
                    {/* Canaleta Direita */}
                    {Array.from({ length: Math.ceil(panelHeight / 40) }).map((_, i) => (
                      <rect key={`y-r-${i}`} x={PANEL_W - 40} y={40 + i * 40} width="12" height="15" rx="1.5" fill={COLORS.yellowComb} stroke="#d97706" strokeWidth="0.5" />
                    ))}
                    {/* Canaleta Esquerda */}
                    {Array.from({ length: Math.ceil(panelHeight / 40) }).map((_, i) => (
                      <rect key={`y-l-${i}`} x={28} y={40 + i * 40} width="12" height="15" rx="1.5" fill={COLORS.yellowComb} stroke="#d97706" strokeWidth="0.5" />
                    ))}
                    
                    {/* Pinos amarelos de teto e chão */}
                    <rect x={60} y={26} width={15} height="12" rx="1" fill={COLORS.yellowComb} />
                    <rect x={PANEL_W - 75} y={26} width={15} height="12" rx="1" fill={COLORS.yellowComb} />

                    {/* Saída no topo esquerdo (PE + N + L1 + L2 + L3) */}
                    <g id="three-phase-output" className="cursor-default">
                      <rect
                        x={THREE_PHASE_OUTPUT.x}
                        y={THREE_PHASE_OUTPUT.y}
                        width={THREE_PHASE_OUTPUT.width}
                        height={THREE_PHASE_OUTPUT.height}
                        rx="5"
                        fill="#f8fafc"
                        stroke="#cbd5e1"
                        strokeWidth="1"
                        filter="url(#shadow)"
                      />
                      <rect
                        x={THREE_PHASE_OUTPUT.x + 8}
                        y={THREE_PHASE_OUTPUT.y + 15}
                        width={THREE_PHASE_OUTPUT.width - 16}
                        height="13"
                        rx="2.5"
                        fill="url(#screwCageGrad)"
                        stroke="#64748b"
                        strokeWidth="0.55"
                      />
                      {THREE_PHASE_TERMINALS.map((terminal) => {
                        const point = getThreePhaseOutputPin(terminal.index, infrastructure);
                        const pinId = `terminal_left_top:${terminal.index}`;
                        return (
                          <g key={pinId}>
                            <text x={point.x} y={THREE_PHASE_OUTPUT.y + 10.5} fill={terminal.fill} fontSize="6.6" fontWeight="950" textAnchor="middle">
                              {terminal.label}
                            </text>
                            <circle cx={point.x} cy={point.y} r="4.8" fill="#334155" stroke="#e2e8f0" strokeWidth="0.7" />
                            <line x1={point.x - 3} y1={point.y} x2={point.x + 3} y2={point.y} stroke="#cbd5e1" strokeWidth="1" />
                            <line x1={point.x} y1={point.y - 3} x2={point.x} y2={point.y + 3} stroke="#cbd5e1" strokeWidth="1" />
                            <rect x={point.x - 8} y={THREE_PHASE_OUTPUT.y + THREE_PHASE_OUTPUT.height - 5} width="16" height="2.4" rx="1.2" fill={terminal.fill} fillOpacity="0.85" />
                            {(wiringMode || !!wireMoveMode) && (
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r="9"
                                fill={wiringStart === pinId ? "#00d8b8" : "#22c55e"}
                                fillOpacity="0.76"
                                className="animate-pulse cursor-pointer"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handlePinClick(pinId);
                                }}
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>

                    {/* 2. BARRAMENTO NEUTRO SUPERIOR (EDITÁVEL) */}
                    {(() => {
                      const neutralBus = infrastructure.find(i => i.id === "neutral-bus") || {};
                      const neutralLayout = getNeutralBusLayout(infrastructure);
                      const isSelected = selectedInfrastructureId === "neutral-bus";
                      return (
                        <g
                          id="neutral-busbar"
                          className="cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedInfrastructureId("neutral-bus");
                            setSelectedComponentId("");
                            setSelectedWireId("");
                            setSelectedTextWireId("");
                            setSelectedAnnotationId("");
                            setActiveTab("infra");
                          }}
                        >
                          {isSelected && (
                            <rect
                              x={neutralLayout.x - 20}
                              y={neutralLayout.y - 10}
                              width={neutralLayout.width + 40}
                              height="38"
                              rx="6"
                              fill="none"
                              stroke="#00d8b8"
                              strokeWidth="1.25"
                              strokeDasharray="4,3"
                              pointerEvents="none"
                            />
                          )}
                          {/* Suportes plásticos azuis */}
                          <rect
                            x={neutralLayout.x - 13}
                            y={neutralLayout.y - 4}
                            width="18"
                            height="28"
                            rx="2"
                            fill="#00d8b8"
                            stroke={isSelected ? "#00d8b8" : "#00d8b8"}
                            strokeWidth={isSelected ? 1.5 : 0.8}
                            onPointerDown={(event) => startInfraTextDrag(event, "neutral-bus", neutralLayout.x, neutralLayout.y)}
                          />
                          <rect
                            x={neutralLayout.x + neutralLayout.width - 5}
                            y={neutralLayout.y - 4}
                            width="18"
                            height="28"
                            rx="2"
                            fill="#00d8b8"
                            stroke={isSelected ? "#00d8b8" : "#00d8b8"}
                            strokeWidth={isSelected ? 1.5 : 0.8}
                            onPointerDown={(event) => startInfraTextDrag(event, "neutral-bus", neutralLayout.x, neutralLayout.y)}
                          />
                          {/* Barra azul superior */}
                          <rect
                            x={neutralLayout.x}
                            y={neutralLayout.y}
                            width={neutralLayout.width}
                            height={neutralLayout.height}
                            rx="1.5"
                            fill="#0ea5e9"
                            stroke={isSelected ? "#00d8b8" : "#0369a1"}
                            strokeWidth={isSelected ? 1.35 : 0.8}
                            onPointerDown={(event) => startInfraTextDrag(event, "neutral-bus", neutralLayout.x, neutralLayout.y)}
                          />
                          <rect x={neutralLayout.x + 4} y={neutralLayout.y + 3} width={neutralLayout.width - 8} height="3" fill="#e0f2fe" fillOpacity="0.5" pointerEvents="none" />
                          {/* Parafusos */}
                          {Array.from({ length: NEUTRAL_BUS.pinCount }).map((_, i) => {
                            const sx = neutralLayout.pinStartX + i * neutralLayout.pinGap;
                            const pinId = `busbar_neutral:${i}`;
                            return (
                              <g key={i}>
                                <circle cx={sx} cy={neutralLayout.pinY} r="4.2" fill="#e0f2fe" stroke="#075985" strokeWidth="0.8" />
                                <line x1={sx-2} y1={neutralLayout.pinY} x2={sx+2} y2={neutralLayout.pinY} stroke="#075985" strokeWidth="0.9" />
                                {(wiringMode || !!wireMoveMode) && (
                                  <circle
                                    cx={sx}
                                    cy={neutralLayout.pinY}
                                    r="8"
                                    fill={wiringStart === pinId ? "#00d8b8" : "#22c55e"}
                                    fillOpacity="0.8"
                                    className="animate-pulse cursor-pointer"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handlePinClick(pinId);
                                    }}
                                  />
                                )}
                              </g>
                            );
                          })}
                          <text
                            x={neutralBus.labelX ?? (neutralLayout.x + neutralLayout.width + 14)}
                            y={neutralBus.labelY ?? (neutralLayout.y + 12)}
                            fill={neutralBus.color || "#0f172a"}
                            fontSize={neutralBus.fontSize || 8}
                            fontWeight="900"
                            textAnchor="start"
                            className="cursor-move"
                            onPointerDown={(event) => startInfraTextDrag(event, "neutral-bus", neutralLayout.x, neutralLayout.y)}
                          >
                            {neutralBus.label || "N"}
                          </text>
                        </g>
                      );
                    })()}

                    {/* 3. BARRAMENTO TERRA (BASE VERDE) */}
                    {(() => {
                      const groundBus = infrastructure.find(i => i.id === "ground-bus") || {};
                      const groundLayout = getGroundBusLayout(infrastructure, panelHeight);
                      const groundY = groundLayout.y;
                      const isSelected = selectedInfrastructureId === "ground-bus";
                      return (
                        <g 
                          id="ground-bus" 
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedInfrastructureId("ground-bus");
                            setSelectedComponentId("");
                            setSelectedWireId("");
                            setSelectedTextWireId("");
                            setSelectedAnnotationId("");
                            setActiveTab("infra");
                          }}
                          className="cursor-pointer"
                        >
                          {isSelected && (
                            <rect
                              x={groundLayout.x - 24}
                              y={groundLayout.y - 8}
                              width={groundLayout.width + 48}
                              height="42"
                              rx="6"
                              fill="none"
                              stroke="#00d8b8"
                              strokeWidth="1.25"
                              strokeDasharray="4,3"
                              pointerEvents="none"
                            />
                          )}
                          {/* Suportes plásticos verdes */}
                          <rect x={groundLayout.x - 16} y={groundY} width="22" height="28" rx="2" fill="#16a34a" stroke={isSelected ? "#00d8b8" : "#15803d"} strokeWidth={isSelected ? 2 : 0.8} onPointerDown={(event) => startInfraTextDrag(event, "ground-bus", groundLayout.x, groundLayout.y)} />
                          <rect x={groundLayout.x + groundLayout.width - 6} y={groundY} width="22" height="28" rx="2" fill="#16a34a" stroke={isSelected ? "#00d8b8" : "#15803d"} strokeWidth={isSelected ? 2 : 0.8} onPointerDown={(event) => startInfraTextDrag(event, "ground-bus", groundLayout.x, groundLayout.y)} />
                          {/* Barra de latão */}
                          <rect x={groundLayout.x} y={groundY + 6} width={groundLayout.width} height="15" rx="1.5" fill="url(#brassGrad)" stroke={isSelected ? "#00d8b8" : "#d97706"} strokeWidth={isSelected ? 1.3 : 0.6} onPointerDown={(event) => startInfraTextDrag(event, "ground-bus", groundLayout.x, groundLayout.y)} />
                          {/* Parafusos */}
                          {Array.from({ length: GROUND_BUS.pinCount }).map((_, i) => {
                            const sx = groundLayout.pinStartX + i * groundLayout.pinGap;
                            const pinId = `busbar_ground:${i}`;
                            return (
                              <g key={i}>
                                <circle cx={sx} cy={groundLayout.pinY} r="4.5" fill="#334155" stroke="#cbd5e1" strokeWidth="0.5" />
                                <line x1={sx-2} y1={groundLayout.pinY} x2={sx+2} y2={groundLayout.pinY} stroke="#cbd5e1" strokeWidth="0.8" />
                                {(wiringMode || !!wireMoveMode) && (
                                  <circle cx={sx} cy={groundLayout.pinY} r="8" fill={wiringStart === pinId ? "#00d8b8" : "#22c55e"} fillOpacity="0.8" className="animate-pulse cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePinClick(pinId); }} />
                                )}
                              </g>
                            );
                          })}
                          <text 
                            x={groundBus.labelX ?? (groundLayout.x + groundLayout.width / 2)} 
                            y={groundBus.labelY ?? (groundY - 6)} 
                            fill={groundBus.color || "#16a34a"} 
                            fontSize={groundBus.fontSize || 7} 
                            fontWeight="bold" 
                            textAnchor="middle"
                            className={`cursor-move ${selectedTextWireId === "ground-bus" ? "stroke-emerald-500 stroke-[0.3]" : ""}`}
                            onPointerDown={(e) => startInfraTextDrag(e, "ground-bus", groundLayout.x, groundLayout.y)}
                          >
                            {groundBus.label || "BARRAMENTO DE PROTEÇÃO TERRA (PE)"}
                          </text>
                        </g>
                      );
                    })()}

                    {/* 4. RENDERIZAÇÃO DOS TRILHOS DIN */}
                    {rails.map((r, rIdx) => {
                      const railY = 190 + rIdx * 240;
                      return (
                        <g key={r.id}>
                          {/* Nome do Trilho */}
                          <text x={160} y={railY - 60} fill="#64748b" fontSize="8.5" fontWeight="950">{r.name.toUpperCase()}</text>
                          {/* Trilho DIN Metálico */}
                          <rect x="140" y={railY - 12} width={PANEL_W - 280} height="24" rx="2" fill="url(#railGrad)" stroke="#475569" strokeWidth="0.8" />
                          <rect x="142" y={railY - 10} width={PANEL_W - 284} height="4" fill="#ffffff" fillOpacity="0.25" />
                          
                          {/* Parafusos de fixação do trilho */}
                          <circle cx="150" cy={railY} r="3" fill="#334155" />
                          <circle cx={PANEL_W - 150} cy={railY} r="3" fill="#334155" />
                        </g>
                      );
                    })}

                    {/* 5. CABEAMENTO PROFISSIONAL ATRÁS DOS DISJUNTORES */}
                    <g id="professional-wiring-under-devices">
                      {showNeutralBackbone && renderBackbonePath("neutral-main", getNeutralBackboneRoute(panelHeight, neutralBackboneEndY), COLORS.neutral, 5.6)}
                      {showNeutralBackbone && renderBackbonePath("neutral-bus-tie", getNeutralBusTieRoute(infrastructure), COLORS.neutral, 4.8)}
                      {renderBackbonePath("ground-main", getGroundBackboneRoute(panelHeight, infrastructure), COLORS.ground, 5.8)}
                      {renderBackbonePath("ground-bus-tie", getGroundBusTieRoute(panelHeight, infrastructure), COLORS.ground, 4.8)}
                      {isSolarReferenceBoard ? renderSolarReferenceWiring() : renderDuctedWiringPlan()}
                    </g>

                    {/* 6. RENDERIZAÇÃO DOS COMPONENTES ELÉTRICOS NOS TRILHOS */}
                    {rails.map((r, rIdx) => {
                      const railY = 190 + rIdx * 240;
                      let currentX = 160;
                      
                      return (
                        <g key={`comp-list-${r.id}`}>
                          {r.components.map(c => {
                            const compW = c.poles * MOD;
                            const isSelected = selectedComponentId === c.id;
                            const x = currentX;
                            currentX += compW + 2;
                            
                            const y = railY - 45;
                            
                            if (c.type === "breaker") return renderBreaker(c, x, y, isSelected);
                            if (c.type === "dps") return renderDPS(c, x, y, isSelected);
                            if (c.type === "dr") return renderDR(c, x, y, isSelected);
                            if (c.type === "spacer") return renderSpacer(c, x, y);
                            if (c.type === "borne") return renderBorne(c, x, y, isSelected);
                            return null;
                          })}
                        </g>
                      );
                    })}

                    {/* 7. BARRAMENTOS PENTE VETORIAIS REALISTAS E ACESSÓRIOS LIVRES */}
                    {renderCombBusbars()}
                    {renderThreePhaseBusbars()}
                    {renderFreeDinRails()}
                    {renderTextAnnotations()}
                    {renderComponentDragPreview()}
                    {renderConnectionHotspots()}
                    {renderSelectedWireRouteHandles()}
                    {renderSelectedWireEndpointHandles()}
                    {/* Preview line enquanto arrasta endpoint */}
                    {wireEndpointDrag && endpointDragCoords && (() => {
                      const dragEndpoint = wireEndpointDrag.endpoint;
                      const visualMeta = wireRouteMetaRef.current[selectedWireId];
                      const anchorPoint = selectedWireDescriptor
                        ? (dragEndpoint === "source" ? selectedWireDescriptor.p2 : selectedWireDescriptor.p1)
                        : visualMeta
                          ? (dragEndpoint === "source" ? visualMeta.targetPoint : visualMeta.sourcePoint)
                          : null;
                      const dragColor = dragEndpoint === "source" ? "#00d8b8" : "#f97316";
                      if (!anchorPoint || !Number.isFinite(anchorPoint.x)) return null;
                      return (
                        <g pointerEvents="none">
                          <line
                            x1={anchorPoint.x} y1={anchorPoint.y}
                            x2={endpointDragCoords.x} y2={endpointDragCoords.y}
                            stroke={dragColor}
                            strokeWidth={2.5}
                            strokeDasharray="8,5"
                            strokeLinecap="round"
                            opacity={0.7}
                          />
                          <circle cx={endpointDragCoords.x} cy={endpointDragCoords.y} r={6} fill={dragColor} fillOpacity={0.3} stroke={dragColor} strokeWidth={2} />
                          <circle cx={endpointDragCoords.x} cy={endpointDragCoords.y} r={2.5} fill={dragColor} />
                        </g>
                      );
                    })()}
                    {showLegend && renderWiringLegend()}
                    {!showLegend && renderLegendToggle()}
                  </svg>
                </div>
              </div>
            </div>

            {/* TABELA DE CIRCUITOS VINCULADOS */}
            {project && metrics && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Circuitos do Projeto ({project.circuits?.length || 0})</h3>
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary font-bold">NBR 5410</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 font-extrabold uppercase text-[10px]">
                        <th className="py-2.5">Circuito</th>
                        <th className="py-2.5">Carga (W)</th>
                        <th className="py-2.5">Fase</th>
                        <th className="py-2.5">Bitola do Fio</th>
                        <th className="py-2.5">Disjuntor Sugerido</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {project.circuits?.map((c, i) => (
                        <tr key={i}>
                          <td className="py-3">{getCircuitDisplayLabel(c, i)}</td>
                          <td className="py-3">{c.power_w} W</td>
                          <td className="py-3">Fase {c.phase || "A"}</td>
                          <td className="py-3">{c.wire_gauge || "2.5mm²"}</td>
                          <td className="py-3">{c.breaker_a || 16}A / {c.breaker_curve || "B"}</td>
                          <td className="py-3">
                            <span className={c.voltage_drop_ok !== false ? "text-emerald-600" : "text-red-500"}>
                              {c.voltage_drop_ok !== false ? "Conforme" : "Queda ΔU excessiva"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* COLUNA DO SIDEBAR DE CONTROLES */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* TABS DE ALTERNÂNCIA */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              {[
                { id: "components", label: "Componentes" },
                { id: "wiring", label: "Fiação / Cabos" },
                { id: "text", label: "Textos / Obs." },
                { id: "settings", label: "Estrutura" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tab.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* CONTEÚDO TAB: COMPONENTES */}
            {activeTab === "components" && (
              <div className="space-y-6">
                
                {/* COMPONENTE SELECIONADO ATUAL */}
                {selectedComponentId ? (
                  (() => {
                    const sel = getSelectedComponent();
                    if (!sel) return null;
                    const { component } = sel;
                    const isCircuitBreaker = component.type === "breaker" && !component.isGeneral;
                    const displayLabel = getComponentDisplayLabel(component);
                    const identityEditKey = `component:${component.id}:identity`;
                    return (
                      <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">Selecionado</span>
                            <h3 className="text-base font-extrabold text-slate-800 uppercase mt-0.5">{displayLabel}</h3>
                            <p className="mt-1 text-[10px] font-semibold leading-normal text-slate-500">
                              Arraste este dispositivo no quadro para trocar trilho ou posição.
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600" onClick={() => setSelectedComponentId("")}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">{isCircuitBreaker ? "Identificação do circuito" : "Nome do Dispositivo"}</Label>
                            <Input
                              value={isCircuitBreaker ? (component.circuitLabel || component.label || "") : (component.label || "")}
                              onFocus={() => captureEditHistoryStart(identityEditKey)}
                              onBlur={() => commitEditHistory(identityEditKey)}
                              onChange={(e) => {
                                if (isCircuitBreaker) {
                                  handleUpdateComponentFields({
                                    label: e.target.value,
                                    circuitLabel: e.target.value,
                                  }, { history: false });
                                } else {
                                  handleUpdateComponent("label", e.target.value, { history: false });
                                }
                              }}
                              className="bg-white rounded-lg h-9 font-bold text-slate-800"
                              placeholder={isCircuitBreaker ? "Ex: C1 - Iluminação sala" : "Nome do dispositivo"}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Tipo</Label>
                            <Input value={component.type.toUpperCase()} disabled className="bg-slate-200 rounded-lg h-9 font-bold text-slate-500" />
                          </div>

                          {isCircuitBreaker && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500">Número</Label>
                                <Input
                                  value={component.circuitNumber || ""}
                                  onFocus={() => captureEditHistoryStart(identityEditKey)}
                                  onBlur={() => commitEditHistory(identityEditKey)}
                                  onChange={(e) => handleUpdateComponentFields({ circuitNumber: e.target.value }, { history: false })}
                                  className="bg-white rounded-lg h-9 font-bold text-slate-800"
                                  placeholder="Ex: C1"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500">Nome do circuito</Label>
                                <Input
                                  value={component.name || ""}
                                  onFocus={() => captureEditHistoryStart(identityEditKey)}
                                  onBlur={() => commitEditHistory(identityEditKey)}
                                  onChange={(e) => handleUpdateComponentFields({ name: e.target.value }, { history: false })}
                                  className="bg-white rounded-lg h-9 font-bold text-slate-800"
                                  placeholder="Ex: Iluminação sala"
                                />
                              </div>
                              <div className="space-y-1 col-span-2">
                                <Label className="text-[10px] font-bold text-slate-500">Descrição curta</Label>
                                <Input
                                  value={component.description || ""}
                                  onFocus={() => captureEditHistoryStart(identityEditKey)}
                                  onBlur={() => commitEditHistory(identityEditKey)}
                                  onChange={(e) => handleUpdateComponentFields({ description: e.target.value }, { history: false })}
                                  className="bg-white rounded-lg h-9 font-bold text-slate-800"
                                  placeholder="Ex: Pavimento térreo, cozinha ou suíte"
                                />
                              </div>
                            </>
                          )}
                          
                          {component.type === "breaker" && (
                            <>
                              <div className="space-y-1 col-span-2">
                                <Label className="text-[10px] font-bold text-slate-500">Tipo de fase do disjuntor</Label>
                                <Select
                                  value={supplyTypeFromBreaker(component)}
                                  onValueChange={(val) => {
                                    const config = phaseTypeConfig[val] || phaseTypeConfig.Monofásico;
                                    handleUpdateComponentFields({
                                      supply_type: val,
                                      phase: config.phase,
                                      poles: config.poles,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(phaseTypeConfig).map(([value, config]) => (
                                      <SelectItem key={value} value={value}>{config.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500">Corrente (A)</Label>
                                <Select value={String(component.current)} onValueChange={(val) => handleUpdateComponent("current", parseInt(val, 10))}>
                                  <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {[6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125].map(val => (
                                      <SelectItem key={val} value={String(val)}>{val}A</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500">Curva de Disparo</Label>
                                <Select value={component.curve} onValueChange={(val) => handleUpdateComponent("curve", val)}>
                                  <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["B", "C", "D"].map(val => (
                                      <SelectItem key={val} value={val}>Curva {val}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          )}
                          
                          {component.type !== "spacer" && (
                            <div className="space-y-1 col-span-2">
                              <Label className="text-[10px] font-bold text-slate-500">Pólos DIN (Largura)</Label>
                              <Select value={String(component.poles)} onValueChange={(val) => {
                                const poles = parseInt(val, 10);
                                if (component.type === "breaker") {
                                  const supplyType = poles >= 3 ? "Trifásico" : poles === 2 ? "Bifásico" : "Monofásico";
                                  const config = phaseTypeConfig[supplyType] || phaseTypeConfig.Monofásico;
                                  handleUpdateComponentFields({
                                    poles,
                                    supply_type: supplyType,
                                    phase: config.phase,
                                  });
                                } else {
                                  handleUpdateComponent("poles", poles);
                                }
                              }}>
                                <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(component.type === "breaker" ? [1, 2, 3] : [1, 2, 3, 4]).map(val => (
                                    <SelectItem key={val} value={String(val)}>{val} DIN ({val * 18}mm)</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {/* Controles de Posicionamento */}
                        <div className="pt-2 space-y-2.5">
                          <Label className="text-[10px] font-bold text-slate-500 block">Posição no Trilho DIN</Label>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 rounded-lg h-9 font-bold text-xs" onClick={() => handleMoveComponent("left")}>
                              <ChevronLeft className="w-4 h-4 mr-1" />
                              Esquerda
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 rounded-lg h-9 font-bold text-xs" onClick={() => handleMoveComponent("right")}>
                              Direita
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {rails.map((r, idx) => (
                              <Button key={r.id} size="sm" variant="secondary" className="rounded-lg h-8 text-[9px] font-extrabold" onClick={() => handleMoveToRail(r.id)}>
                                Mover T{idx + 1}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Botão Excluir */}
                        <Button type="button" variant="destructive" size="sm" className="w-full rounded-lg h-9 font-bold text-xs" onClick={() => handleDeleteComponent()}>
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Excluir Dispositivo
                        </Button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
                    Clique em um disjuntor ou DPS para editar. Segure e arraste no quadro para mover a posição.
                  </div>
                )}

                {/* ADICIONAR COMPONENTE MANUALMENTE */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Adicionar Novo Dispositivo</h3>
                  <form onSubmit={handleAddComponent} className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Tipo de Dispositivo</Label>
                      <Select value={newCompType} onValueChange={(val) => {
                        setNewCompType(val);
                        if (val === "dps") {
                          setNewCompLabel("DPS FASE");
                          setNewCompPoles(1);
                        } else if (val === "dr") {
                          setNewCompLabel("IDR GERAL");
                          setNewCompPoles(2);
                        } else if (val === "borne") {
                          setNewCompLabel("BORNE X1");
                          setNewCompPoles(1);
                        } else if (val === "spacer") {
                          setNewCompLabel("RESERVA");
                          setNewCompPoles(1);
                        } else {
                          setNewCompLabel("DISJUNTOR");
                          setNewCompSupplyType("Monofásico");
                          setNewCompPhase(phaseTypeConfig.Monofásico.phase);
                          setNewCompPoles(phaseTypeConfig.Monofásico.poles);
                        }
                      }}>
                        <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="breaker">Disjuntor Termomagnético</SelectItem>
                          <SelectItem value="dps">DPS (Surtos)</SelectItem>
                          <SelectItem value="dr">IDR (Diferencial Residual)</SelectItem>
                          <SelectItem value="borne">Borne / Terminal</SelectItem>
                          <SelectItem value="spacer">Espaçador / Reserva</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Etiqueta Identificadora</Label>
                      <Input
                        value={newCompLabel}
                        onChange={(e) => setNewCompLabel(e.target.value)}
                        className="bg-white rounded-lg h-9 font-bold"
                        placeholder="Ex: C02 CHUVEIRO"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {newCompType === "breaker" && (
                        <>
                          <div className="space-y-1 col-span-2">
                            <Label className="text-[10px] font-bold text-slate-500">Tipo de fase do disjuntor</Label>
                            <Select
                              value={newCompSupplyType}
                              onValueChange={(val) => {
                                const config = phaseTypeConfig[val] || phaseTypeConfig.Monofásico;
                                setNewCompSupplyType(val);
                                setNewCompPhase(config.phase);
                                setNewCompPoles(config.poles);
                              }}
                            >
                              <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(phaseTypeConfig).map(([value, config]) => (
                                  <SelectItem key={value} value={value}>{config.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Corrente (A)</Label>
                            <Select value={newCompCurrent} onValueChange={setNewCompCurrent}>
                              <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[6, 10, 16, 20, 25, 32, 40, 50, 63].map(val => (
                                  <SelectItem key={val} value={String(val)}>{val} A</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Curva</Label>
                            <Select value={newCompCurve} onValueChange={setNewCompCurve}>
                              <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="B">Curva B</SelectItem>
                                <SelectItem value="C">Curva C</SelectItem>
                                <SelectItem value="D">Curva D</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">Pólos DIN</Label>
                        <Select value={String(newCompPoles)} onValueChange={(val) => {
                          const poles = parseInt(val, 10);
                          setNewCompPoles(poles);
                          if (newCompType === "breaker") {
                            const supplyType = poles >= 3 ? "Trifásico" : poles === 2 ? "Bifásico" : "Monofásico";
                            const config = phaseTypeConfig[supplyType] || phaseTypeConfig.Monofásico;
                            setNewCompSupplyType(supplyType);
                            setNewCompPhase(config.phase);
                          }
                        }}>
                          <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(newCompType === "breaker" ? [1, 2, 3] : [1, 2, 3, 4]).map(val => (
                              <SelectItem key={val} value={String(val)}>{val} DIN</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">Trilho Destino</Label>
                        <Select value={newCompRail} onValueChange={setNewCompRail}>
                          <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {rails.map((r, idx) => (
                              <SelectItem key={r.id} value={r.id}>Trilho {idx + 1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button type="submit" className="w-full rounded-xl h-10 font-bold bg-primary text-white">
                      <Plus className="w-4 h-4 mr-1.5" />
                      Adicionar ao Trilho DIN
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {/* CONTEÚDO TAB: CABOS / FIAÇÃO */}
            {activeTab === "wiring" && (
              <div className="space-y-6">
                
                {/* SELEÇÃO DO CABO ATUAL */}
                {selectedWireId ? (
                  (() => {
                    const wire = getEditableWire(selectedWireId);
                    const selectedWireRouteBends = getWireRouteBends(wire);
                    const selectedWireRoutePoint = selectedRoutePoint?.wireId === wire.id && Number.isInteger(selectedRoutePoint.index)
                      ? selectedWireRouteBends[selectedRoutePoint.index]
                      : null;
                    const selectedWireRouteMode = getCableRoutingMode(wire, selectedWireRouteBends);
                    const selectedWireLineStyle = getCableLineStyle(wire);
                    const selectedWireCornerRadius = getCableCornerRadius(wire);
                    const selectedWireLocked = isCableLocked(wire);
                    const selectedWireVisible = isCableVisible(wire);
                    const rawThicknessValue = Number(wire.visual_thickness ?? wire.thickness ?? wire.stroke_width);
                    const selectedWireThicknessValue = Number.isFinite(rawThicknessValue) && rawThicknessValue > 0
                      ? String(rawThicknessValue)
                      : "auto";
                    const wireInfo = getWireDisplayInfo(wire);
                    const selectedWireTitle = wireInfo.main || "Cabo sem nome";
                    const wireEditKey = `wire:${wire.id}:name`;
                    const wireLabelMeta = wire.labelMeta || {};
                    const wireLabelEditKey = `wire-label:${wire.id}`;
                    const wireLabelText = wireLabelMeta.text ?? destinationCircuitLabel(wire) ?? "";
                    return (
                      <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 shadow-sm space-y-4 animate-in fade-in duration-200 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">Cabo Selecionado</span>
                            <h3 className="text-sm font-extrabold text-slate-800 mt-0.5">Conexão: {selectedWireTitle}</h3>
                            <p className="mt-1 text-[10px] font-semibold leading-normal text-slate-500">
                              Arraste Origem/Destino para trocar os bornes e arraste Dobrar/Ponto para moldar o caminho do cabo.
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600" onClick={() => clearWireSelection()}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Nome do Cabo</Label>
                          <Input
                            value={wire.name || ""}
                            onFocus={() => captureEditHistoryStart(wireEditKey)}
                            onBlur={() => commitEditHistory(wireEditKey)}
                            onChange={(event) => handleUpdateWire(wire.id, "name", event.target.value, { history: false })}
                            className="h-9 rounded-lg bg-white text-xs font-bold"
                            placeholder="Ex: Alimentacao C1, Retorno sala, Neutro circuito 2"
                          />
                        </div>

                        <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <Label className="text-[10px] font-bold text-slate-500">Texto exibido no circuito</Label>
                              <p className="mt-0.5 text-[9.5px] font-semibold leading-normal text-slate-500">
                                Este texto aparece no desenho e fica salvo junto com a conexão.
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={wireLabelMeta.hidden ? "outline" : "secondary"}
                              className="h-8 shrink-0 rounded-lg px-3 text-[10px] font-extrabold"
                              onClick={() => updateWireLabelMeta(wire.id, { hidden: !wireLabelMeta.hidden })}
                            >
                              {wireLabelMeta.hidden ? "Mostrar" : "Ocultar"}
                            </Button>
                          </div>
                          <Input
                            value={wireLabelText}
                            onFocus={() => captureEditHistoryStart(wireLabelEditKey)}
                            onBlur={() => commitEditHistory(wireLabelEditKey)}
                            onChange={(event) => updateWireLabelMeta(wire.id, { text: event.target.value }, { history: false })}
                            className="h-9 rounded-lg bg-slate-50 text-xs font-bold"
                            placeholder="Ex: PE - C1 ILUMINACAO, Neutro cozinha, Circuito 4"
                          />
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500">Tamanho</Label>
                              <Input
                                type="number"
                                step="0.5"
                                value={wireLabelMeta.fontSize || 7}
                                onChange={(event) => updateWireLabelMeta(wire.id, { fontSize: Number(event.target.value) })}
                                className="h-9 rounded-lg bg-slate-50 text-xs font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500">Rotação</Label>
                              <Input
                                type="number"
                                step="5"
                                value={wireLabelMeta.rotation ?? (wire.color?.includes("green") ? 0 : -90)}
                                onChange={(event) => updateWireLabelMeta(wire.id, { rotation: Number(event.target.value) })}
                                className="h-9 rounded-lg bg-slate-50 text-xs font-bold"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-slate-500">Cor</Label>
                              <input
                                type="color"
                                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 p-1"
                                value={wireLabelMeta.color || "#0f172a"}
                                onChange={(event) => updateWireLabelMeta(wire.id, { color: event.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/70 p-2 text-[10px] font-semibold text-slate-500">
                          <div className="min-w-0">
                            <span className="block font-black uppercase text-emerald-600">Origem</span>
                            <span className="block truncate text-slate-700">{wireInfo.origin}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="block font-black uppercase text-orange-600">Destino</span>
                            <span className="block truncate text-slate-700">{wireInfo.destination}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Cor do Cabo</Label>
                            <Select value={wire.color || normalizedWireColor(wire)} onValueChange={(val) => handleUpdateWire(wire.id, "color", val)}>
                              <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {WIRE_COLOR_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Bitola (Gauge)</Label>
                            <Select value={wire.gauge || "2.5mm²"} onValueChange={(val) => handleUpdateWire(wire.id, "gauge", val)}>
                              <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["1.5mm²", "2.5mm²", "4mm²", "6mm²", "10mm²", "16mm²"].map(g => (
                                  <SelectItem key={g} value={g}>{g}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Grossura Visual do Fio</Label>
                            <Select
                              value={selectedWireThicknessValue}
                              onValueChange={(val) => handleUpdateWire(wire.id, "visual_thickness", val === "auto" ? "" : Number(val))}
                            >
                              <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {WIRE_THICKNESS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Pontos de Rota</Label>
                            <div className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 font-extrabold text-slate-700">
                              <span>{selectedWireRouteBends.length}</span>
                              <span className="text-[9px] uppercase text-slate-400">arrastáveis</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 rounded-xl border border-emerald-100 bg-white p-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Modo da Rota</Label>
                            <Select
                              value={selectedWireRouteMode}
                              disabled={selectedWireLocked}
                              onValueChange={(val) => setWireRoutingMode(wire.id, val)}
                            >
                              <SelectTrigger className="bg-slate-50 rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {CABLE_ROUTING_MODES.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Estilo da Linha</Label>
                            <Select
                              value={selectedWireLineStyle}
                              onValueChange={(val) => handleUpdateWire(wire.id, "lineStyle", val)}
                            >
                              <SelectTrigger className="bg-slate-50 rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {CABLE_LINE_STYLES.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Raio da Curva</Label>
                            <Input
                              type="number"
                              min="0"
                              max="24"
                              step="1"
                              value={selectedWireCornerRadius}
                              onChange={(event) => handleUpdateWire(wire.id, "cornerRadius", Number(event.target.value))}
                              className="h-9 rounded-lg bg-slate-50 text-xs font-bold"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={selectedWireLocked ? "default" : "outline"}
                              className="h-9 rounded-lg text-[10px] font-extrabold"
                              onClick={() => handleUpdateWire(wire.id, "locked", !selectedWireLocked)}
                            >
                              {selectedWireLocked ? "Desbloquear" : "Bloquear"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={selectedWireVisible ? "outline" : "default"}
                              className="h-9 rounded-lg text-[10px] font-extrabold"
                              onClick={() => handleUpdateWire(wire.id, "visible", !selectedWireVisible)}
                            >
                              {selectedWireVisible ? "Ocultar" : "Mostrar"}
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Conector Origem</Label>
                            <Select
                              value={wire.terminal_source || "agulha"}
                              onValueChange={(val) => handleUpdateWire(wire.id, "terminal_source", val)}
                            >
                              <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="agulha">Agulha</SelectItem>
                                <SelectItem value="ilhais">Olhal / Ilhós</SelectItem>
                                <SelectItem value="compressao">Compressão</SelectItem>
                                <SelectItem value="duplo">Duplo</SelectItem>
                                <SelectItem value="nenhum">Nenhum</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-500">Conector Destino</Label>
                            <Select
                              value={wire.terminal_target || "agulha"}
                              onValueChange={(val) => handleUpdateWire(wire.id, "terminal_target", val)}
                            >
                              <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="agulha">Agulha</SelectItem>
                                <SelectItem value="ilhais">Olhal / Ilhós</SelectItem>
                                <SelectItem value="compressao">Compressão</SelectItem>
                                <SelectItem value="duplo">Duplo</SelectItem>
                                <SelectItem value="nenhum">Nenhum</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-slate-500 block">Posicionamento das Pontas</Label>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={wireMoveMode === "source" ? "destructive" : "outline"}
                              className={`flex-1 rounded-lg h-9 font-bold text-xs ${wireMoveMode === "source" ? "animate-pulse" : ""}`}
                              disabled={selectedWireLocked}
                              onClick={() => {
                                if (selectedWireLocked) return;
                                setWiringMode(false);
                                setWireEndpointDrag(null);
                                setHoveredPinId("");
                                setWireMoveMode(wireMoveMode === "source" ? "" : "source");
                              }}
                            >
                              {wireMoveMode === "source" ? "Cancelando..." : "Mover Origem"}
                            </Button>
                            <Button
                              size="sm"
                              variant={wireMoveMode === "target" ? "destructive" : "outline"}
                              className={`flex-1 rounded-lg h-9 font-bold text-xs ${wireMoveMode === "target" ? "animate-pulse" : ""}`}
                              disabled={selectedWireLocked}
                              onClick={() => {
                                if (selectedWireLocked) return;
                                setWiringMode(false);
                                setWireEndpointDrag(null);
                                setHoveredPinId("");
                                setWireMoveMode(wireMoveMode === "target" ? "" : "target");
                              }}
                            >
                              {wireMoveMode === "target" ? "Cancelando..." : "Mover Destino"}
                            </Button>
                          </div>
                          {wireMoveMode && (
                            <p className="text-[10px] text-emerald-600 font-extrabold text-center bg-emerald-50 py-1 rounded">
                              Clique em um borne destacado ou arraste a ponta do cabo para redefinir a {wireMoveMode === "source" ? "origem" : "destino"}.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2 rounded-xl border border-emerald-100 bg-white p-3">
                          <Label className="text-[10px] font-bold text-slate-500 block">Caminho do Cabo</Label>
                          <p className="text-[10px] font-semibold leading-normal text-slate-500">
                            Clique no fio e arraste o marcador Dobrar. Use mais pontos quando precisar passar o cabo por cantos diferentes do quadro.
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={selectedWireRouteMode === "automatic" ? "default" : "outline"}
                              className="h-8 rounded-lg text-[10px] font-bold"
                              disabled={selectedWireLocked}
                              onClick={() => setWireRoutingMode(wire.id, "automatic")}
                            >
                              Automática
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={selectedWireRouteMode === "orthogonal" ? "default" : "outline"}
                              className="h-8 rounded-lg text-[10px] font-bold"
                              disabled={selectedWireLocked}
                              onClick={() => setWireRoutingMode(wire.id, "orthogonal")}
                            >
                              Ortogonal
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={selectedWireRouteMode === "manual" ? "default" : "outline"}
                              className="h-8 rounded-lg text-[10px] font-bold"
                              disabled={selectedWireLocked}
                              onClick={() => setWireRoutingMode(wire.id, "manual")}
                            >
                              Manual
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg text-xs font-bold"
                              disabled={selectedWireLocked}
                              onClick={() => addWireRoutePoint(wire.id)}
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Adicionar ponto
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg text-xs font-bold"
                              disabled={selectedWireLocked || selectedWireRouteBends.length === 0}
                              onClick={() => clearWireRoutePoints(wire.id)}
                            >
                              Limpar rota
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg text-xs font-bold"
                              disabled={selectedWireLocked || selectedWireRouteBends.length === 0}
                              onClick={() => removeLastWireRoutePoint(wire.id)}
                            >
                              Remover ponto
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg text-xs font-bold"
                              disabled={selectedWireLocked}
                              onClick={() => duplicateWireRoutePoint(wire.id)}
                            >
                              Duplicar ponto
                            </Button>
                          </div>
                          {selectedWireRoutePoint && (
                            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500">Ponto X</Label>
                                <Input
                                  type="number"
                                  value={Math.round(selectedWireRoutePoint.x)}
                                  disabled={selectedWireLocked}
                                  onChange={(event) => updateWireRoutePoint(wire.id, selectedRoutePoint.index, {
                                    x: Number(event.target.value),
                                    y: selectedWireRoutePoint.y,
                                  })}
                                  className="h-8 rounded-lg bg-white text-xs font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-slate-500">Ponto Y</Label>
                                <Input
                                  type="number"
                                  value={Math.round(selectedWireRoutePoint.y)}
                                  disabled={selectedWireLocked}
                                  onChange={(event) => updateWireRoutePoint(wire.id, selectedRoutePoint.index, {
                                    x: selectedWireRoutePoint.x,
                                    y: Number(event.target.value),
                                  })}
                                  className="h-8 rounded-lg bg-white text-xs font-bold"
                                />
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg text-[10px] font-bold"
                              disabled={selectedWireLocked}
                              onClick={() => reverseWireDirection(wire.id)}
                            >
                              Inverter
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg text-[10px] font-bold"
                              disabled={selectedWireLocked}
                              onClick={() => disconnectWireEndpoint(wire.id, "source")}
                            >
                              Soltar origem
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg text-[10px] font-bold"
                              disabled={selectedWireLocked}
                              onClick={() => disconnectWireEndpoint(wire.id, "target")}
                            >
                              Soltar destino
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-medium text-slate-500 bg-slate-100 p-2 rounded-lg">
                          <button
                            type="button"
                            className="min-w-0 rounded-md bg-white px-2 py-1.5 text-left shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedWireLocked}
                            onClick={() => !selectedWireLocked && setWireMoveMode("source")}
                          >
                            <span className="block font-black uppercase text-emerald-600">Origem</span>
                            <span className="block truncate font-bold text-slate-700">{wireInfo.origin}</span>
                          </button>
                          <button
                            type="button"
                            className="min-w-0 rounded-md bg-white px-2 py-1.5 text-left shadow-sm transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={selectedWireLocked}
                            onClick={() => !selectedWireLocked && setWireMoveMode("target")}
                          >
                            <span className="block font-black uppercase text-orange-600">Destino</span>
                            <span className="block truncate font-bold text-slate-700">{wireInfo.destination}</span>
                          </button>
                        </div>

                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full rounded-lg h-9 font-bold text-xs"
                          disabled={selectedWireLocked}
                          onClick={() => {
                            deleteSelectedElement();
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Excluir Cabo Elétrico
                        </Button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
                    Selecione um cabo no quadro para arrastar Origem/Destino. Para criar um cabo novo, ative <strong className="text-primary">Fiação Rápida</strong> e clique em dois bornes.
                  </div>
                )}

                {/* FORMULARIO DE CABO MANUAL */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Criar Conexão Manual</h3>
                  <div className="space-y-4 text-xs">
	                    <div className="space-y-1">
	                      <Label className="text-[10px] font-bold text-slate-500">Nome da conexão</Label>
	                      <Input
	                        value={wireName}
	                        onChange={(event) => setWireName(event.target.value)}
	                        className="bg-white rounded-lg h-9 font-bold"
	                        placeholder="Ex: Neutro circuito 4"
	                      />
	                    </div>

	                    <div className="space-y-1">
	                      <Label className="text-[10px] font-bold text-slate-500">Texto no desenho</Label>
	                      <Input
	                        value={wireDisplayText}
	                        onChange={(event) => setWireDisplayText(event.target.value)}
	                        className="bg-white rounded-lg h-9 font-bold"
	                        placeholder="Ex: Vai para circuito 1"
	                      />
	                    </div>
	                    
	                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">Cor do Isolamento</Label>
                        <Select value={wireColor} onValueChange={setWireColor}>
                          <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {WIRE_COLOR_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">Seção Transversal</Label>
                        <Select value={wireGauge} onValueChange={setWireGauge}>
                          <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["1.5mm²", "2.5mm²", "4mm²", "6mm²", "10mm²", "16mm²"].map(g => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-[10px] text-slate-500 leading-normal font-medium">
                        Selecione o <strong>"Fiação Rápida"</strong> acima, clique em uma conexão inicial (ex: parafuso de barramento) e depois em uma final (ex: disjuntor) para rotear o cabo com precisão.
                      </p>
                    </div>

                  </div>
                </div>

                {/* LISTA COMPLETA DE CABOS NO QUADRO */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Conexões no Quadro ({visibleWires.length})</h3>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
                    {visibleWires.map((w) => {
                      const info = getWireDisplayInfo(w);
                      const isSelectedConnection = selectedWireId === w.id;
                      const rowLabelMeta = w.labelMeta || {};
                      const rowLabelText = rowLabelMeta.text ?? destinationCircuitLabel(w) ?? "";
                      const rowLabelEditKey = `wire-label:${w.id}:inline`;
                      return (
                        <div
                          key={w.id}
                          onClick={() => selectEditableWire(w.id)}
                          className={`pt-2 text-xs font-bold cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors ${
                            isSelectedConnection ? "bg-emerald-50 ring-1 ring-emerald-200" : ""
                          }`}
                        >
                          <div className="flex gap-2">
                            <span
                              className="mt-1 h-3 w-3 shrink-0 rounded-full border border-slate-300"
                              style={{
                                background: wireDisplayColor(normalizedWireColor(w))
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[10px] font-black uppercase text-slate-800">{info.main}</div>
                              <div className="truncate text-[9px] font-extrabold text-slate-500">{info.subtitle}</div>
                              <div className="mt-1 grid grid-cols-2 gap-1 text-[8.5px] font-bold text-slate-400">
                                <span className="truncate">Origem: {info.origin}</span>
                                <span className="truncate">Destino: {info.destination}</span>
                              </div>
                            </div>
                          </div>
                          {isSelectedConnection && (
                            <div
                              className="mt-3 space-y-2 rounded-lg border border-emerald-100 bg-white p-3"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-[10px] font-bold text-slate-500">Texto no circuito</Label>
                                <button
                                  type="button"
                                  className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700"
                                  onClick={() => updateWireLabelMeta(w.id, { hidden: !rowLabelMeta.hidden })}
                                >
                                  {rowLabelMeta.hidden ? "Mostrar texto" : "Ocultar texto"}
                                </button>
                              </div>
                              <Input
                                value={rowLabelText}
                                onFocus={() => captureEditHistoryStart(rowLabelEditKey)}
                                onBlur={() => commitEditHistory(rowLabelEditKey)}
                                onChange={(event) => updateWireLabelMeta(w.id, { text: event.target.value }, { history: false })}
                                className="h-9 rounded-lg bg-slate-50 text-xs font-bold"
                                placeholder="Digite o texto que aparece no circuito"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* CONTEÚDO TAB: TEXTOS */}
            {activeTab === "text" && (() => {
              const selectedAnnotation = textAnnotations.find((item) => item.id === selectedAnnotationId);
              const selectedWireText = selectedTextWireId
                ? wires.find((w) => w.id === selectedTextWireId) || getEditableWire(selectedTextWireId)
                : null;
              const labelMeta = selectedWireText?.labelMeta || {};
              const labeledWires = visibleWires.filter((wire) => !wire.labelMeta?.hidden && (destinationCircuitLabel(wire) || wire.labelMeta?.text));

              return (
                <div className="space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Adicionar texto / observação</h3>
                        <p className="mt-1 text-[10px] font-semibold leading-normal text-slate-500">
                          Crie notas livres no quadro e arraste o texto diretamente no desenho.
                        </p>
                      </div>
                      <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-[10px] font-black text-emerald-700">
                        {textAnnotations.length} obs.
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(ANNOTATION_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setAnnotationPreset(key);
                            setNewAnnotationText(preset.text);
                          }}
                          className={`rounded-lg border px-3 py-2 text-left text-[10px] font-extrabold transition ${
                            annotationPreset === key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Conteúdo</Label>
                      <Textarea
                        value={newAnnotationText}
                        onChange={(event) => setNewAnnotationText(event.target.value)}
                        className="min-h-[92px] rounded-lg bg-slate-50 text-xs font-semibold leading-relaxed"
                        placeholder="Digite uma observação, nota técnica, alerta ou instrução de montagem"
                      />
                    </div>

                    <Button
                      type="button"
                      className="h-10 w-full rounded-xl text-xs font-extrabold"
                      onClick={() => handleCreateAnnotation(annotationPreset)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Adicionar no quadro
                    </Button>
                  </div>

                  {selectedAnnotation && (
                    <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5 shadow-sm space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Observação selecionada</span>
                          <h3 className="mt-0.5 text-sm font-extrabold text-slate-800">{selectedAnnotation.label || "Texto livre"}</h3>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600" onClick={() => setSelectedAnnotationId("")}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">Texto</Label>
                        <Textarea
                          value={selectedAnnotation.text || ""}
                          onChange={(event) => updateInfrastructure(selectedAnnotation.id, { text: event.target.value })}
                          className="min-h-[96px] rounded-lg bg-white text-xs font-semibold leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Cor do texto</Label>
                          <input
                            type="color"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white p-1"
                            value={selectedAnnotation.color || "#0f172a"}
                            onChange={(event) => updateInfrastructure(selectedAnnotation.id, { color: event.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Fundo</Label>
                          <input
                            type="color"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white p-1"
                            value={selectedAnnotation.background || "#ffffff"}
                            onChange={(event) => updateInfrastructure(selectedAnnotation.id, { background: event.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Tamanho</Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={selectedAnnotation.fontSize ?? 9}
                            onChange={(event) => updateInfrastructure(selectedAnnotation.id, { fontSize: Number(event.target.value) })}
                            className="h-9 rounded-lg bg-white text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Largura</Label>
                          <Input
                            type="number"
                            value={selectedAnnotation.width ?? 214}
                            onChange={(event) => updateInfrastructure(selectedAnnotation.id, { width: Number(event.target.value) })}
                            className="h-9 rounded-lg bg-white text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Rotação</Label>
                          <Input
                            type="number"
                            step="5"
                            value={selectedAnnotation.rotation ?? 0}
                            onChange={(event) => updateInfrastructure(selectedAnnotation.id, { rotation: Number(event.target.value) })}
                            className="h-9 rounded-lg bg-white text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Posição X</Label>
                          <Input
                            type="number"
                            value={Math.round(selectedAnnotation.x ?? 0)}
                            onChange={(event) => updateInfrastructure(selectedAnnotation.id, { x: Number(event.target.value) })}
                            className="h-9 rounded-lg bg-white text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Posição Y</Label>
                          <Input
                            type="number"
                            value={Math.round(selectedAnnotation.y ?? 0)}
                            onChange={(event) => updateInfrastructure(selectedAnnotation.id, { y: Number(event.target.value) })}
                            className="h-9 rounded-lg bg-white text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={selectedAnnotation.showBox === false ? "outline" : "secondary"}
                          className="h-9 rounded-lg text-xs font-bold"
                          onClick={() => updateInfrastructure(selectedAnnotation.id, { showBox: selectedAnnotation.showBox === false })}
                        >
                          {selectedAnnotation.showBox === false ? "Mostrar caixa" : "Ocultar caixa"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="h-9 rounded-lg text-xs font-bold"
                          onClick={() => handleDeleteAnnotation(selectedAnnotation.id)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedWireText && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Editar rótulo de cabo</h3>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500">Conteúdo</Label>
                        <Input
                          value={labelMeta.text ?? destinationCircuitLabel(selectedWireText)}
                          onFocus={() => captureEditHistoryStart(`wire-label:${selectedWireText.id}`)}
                          onBlur={() => commitEditHistory(`wire-label:${selectedWireText.id}`)}
                          onChange={(event) => updateWireLabelMeta(selectedWireText.id, { text: event.target.value }, { history: false })}
                          className="h-9 rounded-lg bg-slate-50 text-xs font-bold"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Tamanho</Label>
                          <Input type="number" step="0.5" value={labelMeta.fontSize || 7} onChange={(event) => updateWireLabelMeta(selectedWireText.id, { fontSize: Number(event.target.value) })} className="h-9 rounded-lg bg-slate-50 text-xs font-bold" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Rotação</Label>
                          <Input type="number" step="5" value={labelMeta.rotation ?? (selectedWireText.color?.includes("green") ? 0 : -90)} onChange={(event) => updateWireLabelMeta(selectedWireText.id, { rotation: Number(event.target.value) })} className="h-9 rounded-lg bg-slate-50 text-xs font-bold" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-500">Cor</Label>
                          <input type="color" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 p-1" value={labelMeta.color || "#0f172a"} onChange={(event) => updateWireLabelMeta(selectedWireText.id, { color: event.target.value })} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Textos no quadro</h3>
                    <div className="space-y-2">
                      {textAnnotations.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[10px] font-semibold text-slate-500">
                          Nenhuma observação livre adicionada.
                        </div>
                      )}
                      {textAnnotations.map((annotation) => (
                        <button
                          key={annotation.id}
                          type="button"
                          onClick={() => {
                            setSelectedAnnotationId(annotation.id);
                            setSelectedTextWireId("");
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-[10px] font-bold transition ${
                            selectedAnnotationId === annotation.id ? "border-primary bg-primary/10 text-primary" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                          }`}
                        >
                          <span className="block truncate">{annotation.text || annotation.label || "Observação"}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Rótulos de cabos</h3>
                    <div className="max-h-[190px] space-y-2 overflow-y-auto pr-1">
                      {labeledWires.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[10px] font-semibold text-slate-500">
                          Nenhum rótulo automático disponível neste quadro.
                        </div>
                      )}
                      {labeledWires.map((wire) => (
                        <button
                          key={wire.id}
                          type="button"
                          onClick={() => {
                            setSelectedTextWireId(wire.id);
                            setSelectedAnnotationId("");
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-[10px] font-bold transition ${
                            selectedTextWireId === wire.id ? "border-primary bg-primary/10 text-primary" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                          }`}
                        >
                          <span className="block truncate">{wire.labelMeta?.text || destinationCircuitLabel(wire) || getWireDisplayInfo(wire).main}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* CONTEÚDO TAB: ESTRUTURA E CONFIGURAÇÕES */}
            {activeTab === "infra" && selectedInfrastructureId && (() => {
              const infraId = selectedInfrastructureId;
	              const infraItem = infrastructure.find(i => i.id === infraId) || {};
	              const isGroundBus = infraId === "ground-bus";
	              const isNeutralBus = infraId === "neutral-bus";
	              const isCombBusbar = isCombBusbarId(infraId);
                  const isThreePhase = isThreePhaseBusbarId(infraId);
                  const isFreeDin = isFreeDinRailId(infraId);
                  const isScalableProperty = isCombBusbar || isThreePhase || isFreeDin;
	              const combBusbarInfo = (() => {
	                if (!isScalableProperty) return null;
	                if (isFreeCombBusbarId(infraId) || isThreePhase || isFreeDin) {
	                  return {
	                    free: true,
	                    railIndex: null,
	                    groupIndex: null,
	                    defaultX: 220,
	                    defaultY: 360,
	                    defaultWidth: 180,
	                    x: Number.isFinite(Number(infraItem.x)) ? Number(infraItem.x) : 220,
	                    y: Number.isFinite(Number(infraItem.y)) ? Number(infraItem.y) : 360,
		                    width: Number.isFinite(Number(infraItem.width)) ? Number(infraItem.width) : 180,
		                    height: Number.isFinite(Number(infraItem.height)) ? Number(infraItem.height) : (isFreeDin ? 24 : 8),
		                    toothHeight: Number.isFinite(Number(infraItem.toothHeight)) ? Number(infraItem.toothHeight) : 10,
		                    toothGap: Number.isFinite(Number(infraItem.toothGap)) ? Number(infraItem.toothGap) : MOD,
		                    rotation: Number.isFinite(Number(infraItem.rotation)) ? Number(infraItem.rotation) : 0,
		                  };
	                }
	                const [, railId = "", groupIndexRaw = "0"] = String(infraId).split(":");
	                const railIndex = rails.findIndex((rail) => String(rail.id) === railId);
	                const rail = railIndex >= 0 ? rails[railIndex] : null;
	                const groupIndex = Number(groupIndexRaw);
	                const group = rail ? getCombBusbarGroups(rail)[Number.isFinite(groupIndex) ? groupIndex : 0] : null;
	                if (!group?.length) return null;
	                const first = group[0];
	                const last = group[group.length - 1];
	                const defaultX = first.x + 4;
	                const defaultWidth = (last.x + last.width) - first.x - 8;
	                const defaultY = (190 + railIndex * 240) - 45 - 4;
	                return {
	                  railIndex,
	                  groupIndex: Number.isFinite(groupIndex) ? groupIndex : 0,
	                  defaultX,
	                  defaultY,
	                  defaultWidth,
	                  x: Number.isFinite(Number(infraItem.x)) ? Number(infraItem.x) : defaultX,
	                  y: Number.isFinite(Number(infraItem.y)) ? Number(infraItem.y) : defaultY,
		                  width: Number.isFinite(Number(infraItem.width)) ? Number(infraItem.width) : defaultWidth,
		                  height: Number.isFinite(Number(infraItem.height)) ? Number(infraItem.height) : 8,
		                  toothHeight: Number.isFinite(Number(infraItem.toothHeight)) ? Number(infraItem.toothHeight) : 10,
		                  rotation: Number.isFinite(Number(infraItem.rotation)) ? Number(infraItem.rotation) : 0,
		                };
	              })();
	              const busLayout = isNeutralBus
	                ? getNeutralBusLayout(infrastructure)
	                : isGroundBus
	                  ? getGroundBusLayout(infrastructure, panelHeight)
	                  : null;
              const defaultLabel = isGroundBus ? "BARRAMENTO DE PROTEÇÃO TERRA (PE)" : isNeutralBus ? "N" : "INFRA";
              const defaultColor = isGroundBus ? "#16a34a" : isNeutralBus ? "#0f172a" : "#16a34a";
              const defaultFontSize = isNeutralBus ? 8 : 7;
              const defaultX = busLayout?.x ?? 400;
              const defaultY = busLayout?.y ?? 752;
              const defaultLabelY = isNeutralBus ? (busLayout?.y ?? NEUTRAL_BUS.y) + 12 : (busLayout?.y ? busLayout.y - 6 : 746);
              
              return (
                <div className="flex h-full flex-col p-4 bg-slate-50/50">
                  <div className="mb-4">
	                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">
	                      {isScalableProperty ? (isThreePhase ? "Editar Barramento Trifásico" : isFreeDin ? "Editar Trilho DIN Livre" : isFreeCombBusbarId(infraId) ? "Editar Barramento Pente Livre" : "Editar Barramento Pente") : isNeutralBus ? "Editar Barramento Superior" : isGroundBus ? "Editar Barramento Terra" : "Editar Infraestrutura"}
	                    </h2>
	                    <p className="text-xs font-semibold text-slate-500">
	                      {isScalableProperty ? "Ajustes finos e dimensões ficam salvos automaticamente." : isNeutralBus || isGroundBus ? "Ajuste posição, largura e identificação do barramento." : "Ajuste o texto e a posição"}
	                    </p>
	                  </div>
	                  <div className="flex-1 overflow-y-auto pr-2 space-y-4">
	                    {isScalableProperty && (
	                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
	                        {combBusbarInfo ? (
	                          <div className="space-y-4">
	                            <div className="flex items-start justify-between gap-3">
	                              <div>
	                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
	                                  {combBusbarInfo.free ? "Barramento livre" : `Trilho ${combBusbarInfo.railIndex + 1} · grupo ${combBusbarInfo.groupIndex + 1}`}
	                                </span>
	                                <p className="mt-1 text-[10px] font-semibold leading-normal text-amber-800">
	                                  {combBusbarInfo.free ? "Arraste o pente diretamente no desenho ou ajuste os valores finos abaixo." : "O ajuste não muda a ordem dos disjuntores; ele só posiciona e dimensiona o barramento pente."}
	                                </p>
	                              </div>
	                              <Button
	                                type="button"
	                                variant="outline"
	                                size="sm"
	                                className="h-8 shrink-0 rounded-lg border-amber-300 bg-white text-[10px] font-extrabold text-amber-700 hover:text-amber-800"
	                                onClick={() => resetInfrastructureItem(infraId)}
	                              >
	                                Resetar
	                              </Button>
	                            </div>

	                            <div>
	                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Identificação opcional</label>
	                              <input
	                                type="text"
	                                className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
	                                value={infraItem.label || ""}
	                                onChange={(event) => updateInfrastructure(infraId, { label: event.target.value })}
	                                placeholder="Ex: PENTE FASES"
	                              />
	                            </div>

		                            <div className="grid grid-cols-3 gap-3">
		                              <div>
		                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Posição X</label>
		                                <input
	                                  type="number"
	                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium"
	                                  value={Math.round(combBusbarInfo.x)}
	                                  onChange={(event) => updateInfrastructure(infraId, { x: Number(event.target.value) })}
	                                />
	                              </div>
	                              <div>
	                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Posição Y</label>
	                                <input
	                                  type="number"
	                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium"
	                                  value={Math.round(combBusbarInfo.y)}
		                                  onChange={(event) => updateInfrastructure(infraId, { y: Number(event.target.value) })}
		                                />
		                              </div>
		                              <div>
		                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Rotação</label>
		                                <input
		                                  type="number"
		                                  step="5"
		                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium"
		                                  value={Math.round(combBusbarInfo.rotation)}
		                                  onChange={(event) => updateInfrastructure(infraId, { rotation: Number(event.target.value) })}
		                                />
		                              </div>
		                            </div>

	                            <div className="grid grid-cols-3 gap-3">
	                              <div>
	                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Comprimento</label>
	                                <input
	                                  type="number"
	                                  min="18"
	                                  max={PANEL_W - 40}
	                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium"
	                                  value={Math.round(combBusbarInfo.width)}
	                                  onChange={(event) => updateInfrastructure(infraId, { width: Number(event.target.value) })}
	                                />
	                              </div>
	                              <div>
	                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Altura</label>
	                                <input
	                                  type="number"
	                                  min="4"
	                                  max={isThreePhase ? panelHeight : 40}
                                      disabled={isFreeDin}
	                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium"
	                                  value={Math.round(combBusbarInfo.height)}
	                                  onChange={(event) => updateInfrastructure(infraId, { height: Number(event.target.value) })}
	                                />
	                              </div>
	                              {(!isThreePhase && !isFreeDin) && (
	                              <div>
	                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Altura dentes</label>
	                                <input
	                                  type="number"
	                                  min="4"
	                                  max="22"
	                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium"
	                                  value={Math.round(combBusbarInfo.toothHeight)}
	                                  onChange={(event) => updateInfrastructure(infraId, { toothHeight: Number(event.target.value) })}
	                                />
	                              </div>
                                  )}
	                            </div>

	                            {combBusbarInfo.free && (
	                              <div>
	                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Espaçamento dos dentes</label>
	                                <input
	                                  type="number"
	                                  min="8"
	                                  max="60"
	                                  className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm font-medium"
	                                  value={Math.round(combBusbarInfo.toothGap)}
	                                  onChange={(event) => updateInfrastructure(infraId, { toothGap: Number(event.target.value) })}
	                                />
	                              </div>
	                            )}

	                            <div className="grid grid-cols-3 gap-3">
	                              <div>
	                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Isolador</label>
	                                <input
	                                  type="color"
	                                  className="w-full h-[38px] p-1 bg-white border border-amber-200 rounded-lg cursor-pointer"
	                                  value={infraItem.color || COLORS.yellowComb}
	                                  onChange={(event) => updateInfrastructure(infraId, { color: event.target.value })}
	                                />
	                              </div>
	                              <div>
	                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Metal</label>
	                                <input
	                                  type="color"
	                                  className="w-full h-[38px] p-1 bg-white border border-amber-200 rounded-lg cursor-pointer"
	                                  value={infraItem.conductorColor || "#ca8a04"}
	                                  onChange={(event) => updateInfrastructure(infraId, { conductorColor: event.target.value })}
	                                />
	                              </div>
	                              <div>
	                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Texto</label>
	                                <input
	                                  type="color"
	                                  className="w-full h-[38px] p-1 bg-white border border-amber-200 rounded-lg cursor-pointer"
	                                  value={infraItem.labelColor || "#854d0e"}
	                                  onChange={(event) => updateInfrastructure(infraId, { labelColor: event.target.value })}
	                                />
	                              </div>
	                            </div>
	                          </div>
	                        ) : (
	                          <div className="space-y-3 text-xs font-semibold text-amber-800">
	                            <p>Este barramento pente não está mais disponível porque o grupo de disjuntores mudou.</p>
	                            <Button
	                              type="button"
	                              variant="outline"
	                              className="h-9 rounded-lg border-amber-300 bg-white text-xs font-extrabold text-amber-700"
	                              onClick={() => resetInfrastructureItem(infraId)}
	                            >
	                              Limpar ajuste salvo
	                            </Button>
	                          </div>
	                        )}
	                      </div>
	                    )}

	                    {!isCombBusbar && (
	                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
	                      <div className="space-y-4">
	                        <div>
	                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Título</label>
                          <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={infraItem.label ?? defaultLabel}
                            onChange={(e) => updateInfrastructure(infraId, { label: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tamanho da Fonte</label>
                            <input type="number" step="0.5" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
                              value={infraItem.fontSize ?? defaultFontSize}
                              onChange={(e) => updateInfrastructure(infraId, { fontSize: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cor</label>
                            <input type="color" className="w-full h-[38px] p-1 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                              value={infraItem.color || defaultColor}
                              onChange={(e) => updateInfrastructure(infraId, { color: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                              {isNeutralBus || isGroundBus ? "Posição X do Barramento" : "Posição X"}
                            </label>
                            <input type="number" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
                              value={Math.round(infraItem.x ?? defaultX)}
                              onChange={(e) => updateInfrastructure(infraId, { x: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Posição Y do Texto</label>
                            <input type="number" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
                              value={Math.round(infraItem.labelY ?? defaultLabelY)}
                              onChange={(e) => updateInfrastructure(infraId, { labelY: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Posição Y do Barramento</label>
                          <input type="number" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
                            value={Math.round(infraItem.y ?? defaultY)}
                            onChange={(e) => updateInfrastructure(infraId, { y: Number(e.target.value) })}
                          />
                        </div>
                        {(isNeutralBus || isGroundBus) && (
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Largura do Barramento</label>
                            <input
                              type="number"
                              min={isGroundBus ? "260" : "180"}
                              max="520"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium"
                              value={Math.round(infraItem.width ?? busLayout?.width ?? (isGroundBus ? GROUND_BUS.width : NEUTRAL_BUS.width))}
                              onChange={(e) => updateInfrastructure(infraId, { width: Number(e.target.value) })}
                            />
	                          </div>
	                        )}
	                      </div>
	                    </div>
	                    )}
	                  </div>
	                </div>
	              );
            })()}

            {activeTab === "settings" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Quadro Ativo</h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Nome do quadro</Label>
                      <Input
                        value={activeBoard?.name || ""}
                        onChange={(event) => handleUpdateActiveBoard("name", event.target.value)}
                        className="h-9 rounded-lg bg-white text-sm font-bold"
                        placeholder="Ex: QD-01 Principal"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500">Local / setor</Label>
                      <Input
                        value={activeBoard?.location || ""}
                        onChange={(event) => handleUpdateActiveBoard("location", event.target.value)}
                        className="h-9 rounded-lg bg-white text-sm font-bold"
                        placeholder="Ex: Pavimento térreo"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[10px] font-bold text-slate-500">Tipo de fase do quadro</Label>
                      <Select value={activeSupplyType} onValueChange={handleUpdateBoardSupply}>
                        <SelectTrigger className="h-9 rounded-lg bg-white text-sm font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monofásico">Monofásico - fase preta + neutro azul claro</SelectItem>
                          <SelectItem value="Bifásico">Bifásico - preto + vermelho</SelectItem>
                          <SelectItem value="Trifásico">Trifásico - preto + vermelho + marrom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] font-extrabold">
                    <span className="rounded-lg bg-emerald-50 px-2 py-2 text-emerald-700">{rails.length} trilhos</span>
                    <span className="rounded-lg bg-emerald-50 px-2 py-2 text-emerald-700">{getBoardUsedModules(activeBoard)} DIN usados</span>
                    <span className="rounded-lg bg-slate-50 px-2 py-2 text-slate-600">{visibleWires.length} cabos</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Dimensões do Quadro</h3>
                  
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">Quantidade de Trilhos DIN</Label>
                    <Select value={String(rails.length)} onValueChange={(val) => {
                      const size = parseInt(val, 10);
                      let nextRails = [...rails];
                      if (size > rails.length) {
                        // Adicionar trilho
                        for (let i = rails.length; i < size; i++) {
                          nextRails.push({
                            id: `rail_${i+1}`,
                            name: `Trilho DIN T${i+1} (Expansão)`,
                            components: [{ id: `spacer_${Date.now()}_${i}`, type: "spacer", poles: 18, label: "RESERVA" }]
                          });
                        }
                      } else if (size < rails.length) {
                        nextRails = nextRails.slice(0, size);
                      }
                      updateRails(nextRails);
                    }}>
                      <SelectTrigger className="bg-white rounded-lg h-9 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Trilho DIN (Até 18 Módulos)</SelectItem>
                        <SelectItem value="2">2 Trilhos DIN (Até 36 Módulos)</SelectItem>
                        <SelectItem value="3">3 Trilhos DIN (Até 54 Módulos)</SelectItem>
                        <SelectItem value="4">4 Trilhos DIN (Até 72 Módulos)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-4 bg-yellow-50/50 rounded-xl border border-yellow-200 space-y-2">
                    <h4 className="text-xs font-bold text-yellow-800 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Regras NBR 5410 de Reserva
                    </h4>
                    <p className="text-[10px] text-yellow-700 leading-normal font-medium">
                      Quadros elétricos devem prever espaço reserva para expansões futuras:
                      <br />• Até 6 circuitos: mínimo 2 módulos livres.
                      <br />• 7 a 12 circuitos: mínimo 3 módulos livres.
                      <br />• 13 a 30 circuitos: mínimo 4 módulos livres.
                      <br />• Acima de 30 circuitos: mínimo 15% de reserva.
                    </p>
                  </div>
                </div>

	                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
	                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Ações Estruturais</h3>
	                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-3">
	                    <div>
	                      <h4 className="text-xs font-black uppercase tracking-wide text-amber-800">Infraestrutura Livre</h4>
	                      <p className="mt-1 text-[10px] font-semibold leading-normal text-amber-700">
	                        Adicione elementos estruturais independentes que podem ser rotacionados e reposicionados.
	                      </p>
	                    </div>
                        <div className="space-y-2">
                          <Button
                            type="button"
                            className="h-9 w-full rounded-xl bg-amber-500 text-xs font-extrabold text-white hover:bg-amber-600"
                            onClick={addFreeCombBusbar}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Barramento Pente Livre
                          </Button>
                          <Button
                            type="button"
                            className="h-9 w-full rounded-xl bg-orange-600 text-xs font-extrabold text-white hover:bg-orange-700"
                            onClick={addThreePhaseBusbar}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Barramento Trifásico Vertical
                          </Button>
                          <Button
                            type="button"
                            className="h-9 w-full rounded-xl bg-slate-600 text-xs font-extrabold text-white hover:bg-slate-700"
                            onClick={addFreeDinRail}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Trilho DIN Livre
                          </Button>
                        </div>
	                  </div>
	                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
	                    <div className="mb-3">
	                      <h4 className="text-xs font-black uppercase tracking-wide text-emerald-800">QGBT - Quadro Geral</h4>
                      <p className="mt-1 text-[10px] font-semibold leading-normal text-emerald-700">
                        Gera um quadro geral usando o disjuntor principal de cada quadro cadastrado como saída.
                      </p>
                    </div>
                    <Button
                      className="h-9 w-full rounded-xl bg-emerald-600 text-xs font-extrabold text-white hover:bg-emerald-700"
                      onClick={handleGenerateQgbt}
                      disabled={qgbtSourceCount === 0}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Gerar / Atualizar QGBT
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full rounded-xl text-xs font-bold text-slate-700 h-9" onClick={() => {
                    const rawLayout = generateDefaultPanelLayout(project, { forceDistribution: activeBoard?.type !== "solar_ac" });
                    const def = normalizeSolarPanelLayout(project, activeBoard?.type, activeSupplyType, { ...rawLayout, infrastructure });
                    if (activeBoard?.type === "solar_ac") {
                      setRails(def.rails || []);
                      setWires(def.wires || []);
                      setInfrastructure(def.infrastructure || []);
                      saveLayoutToDb(def.rails || [], def.wires || [], def.infrastructure || []);
                    } else {
                      updateWires(def.wires);
                    }
                  }}>
                    Auto-gerar Cabeamento Recomendado
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 w-full rounded-xl border-red-200 text-xs font-bold text-red-600 hover:text-red-700"
                    onClick={handleResetLayout}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Redefinir estrutura do quadro
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
