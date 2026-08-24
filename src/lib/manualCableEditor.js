export const ROUTE_SYSTEMS = Object.freeze({
  eletrica: { cableType: "ELÉTRICA", color: "#000000", label: "Elétrica" },
  telecom: { cableType: "TELECOM", color: "#2563eb", label: "Telecom" },
});

export const DEFAULT_ROUTE_SYSTEM = "eletrica";

export const CONDUIT_DIAMETER_OPTIONS = Object.freeze(['1/2"', '3/4"', '1"', '1 1/4"', '1 1/2"', '2"', '3"', '4"']);
export const DEFAULT_CONDUIT_DIAMETER = '3/4"';

const DN_TO_CONDUIT_DIAMETER = Object.freeze({
  16: '1/2"',
  20: '3/4"',
  25: '1"',
  32: '1 1/4"',
  40: '1 1/2"',
  50: '2"',
  75: '3"',
  100: '4"',
});

export const normalizeRouteSystem = (value = "") => {
  const source = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (source.includes("telecom") || source.includes("dados") || source.includes("rede") || source.includes("telefon")) return "telecom";
  return DEFAULT_ROUTE_SYSTEM;
};

export const cableTypeForRouteSystem = (system = DEFAULT_ROUTE_SYSTEM) => (
  ROUTE_SYSTEMS[normalizeRouteSystem(system)]?.cableType || ROUTE_SYSTEMS.eletrica.cableType
);

export const colorForRouteSystem = (system = DEFAULT_ROUTE_SYSTEM) => (
  ROUTE_SYSTEMS[normalizeRouteSystem(system)]?.color || ROUTE_SYSTEMS.eletrica.color
);

export const normalizeConduitDiameter = (value = "", fallback = DEFAULT_CONDUIT_DIAMETER) => {
  const raw = String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[″]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  if (!raw || raw.toLowerCase() === "nenhuma") return fallback || "";

  const dnMatch = raw.match(/\bDN\s*(16|20|25|32|40|50|75|100)\b/i);
  if (dnMatch) return DN_TO_CONDUIT_DIAMETER[dnMatch[1]] || fallback || "";

  const mmMatch = raw.match(/\b(16|20|25|32|40|50|75|100)\s*mm\b/i);
  if (mmMatch) return DN_TO_CONDUIT_DIAMETER[mmMatch[1]] || fallback || "";

  const compact = raw.replace(/\s+/g, "");
  if (compact.includes('11/4"')) return '1 1/4"';
  if (compact.includes('11/2"')) return '1 1/2"';

  const matchedOption = CONDUIT_DIAMETER_OPTIONS.find((option) => raw.includes(option));
  if (matchedOption) return matchedOption;

  return fallback || "";
};

const DEFAULT_CABLE_COLORS = {
  ELÉTRICA: "#000000",
  TELECOM: "#2563eb",
  L1: "#111827",
  L2: "#DC2626",
  L3: "#7C2D12",
  N: "#00d8b8",
  PE: "#16A34A",
  CUSTOM: "#050505",
};

const VALID_CABLE_TYPES = new Set(["ELÉTRICA", "TELECOM", "L1", "L2", "L3", "N", "PE", "CUSTOM"]);
const VALID_ROUTING_MODES = new Set(["free", "orthogonal", "curved"]);
const VALID_CABLE_INSTALLATION_MODES = new Set(["embutido", "piso", "externa", "sobe", "desce"]);
const DESIGN_WIDTH = 1400;
const DESIGN_HEIGHT = 900;
const POINT_TERMINAL_OFFSETS_PX = {
  tug: { x: -18, y: 0, terminalId: "tomada-foot" },
  tue: { x: -18, y: 0, terminalId: "tomada-foot" },
  chuveiro: { x: -18, y: 0, terminalId: "tomada-foot" },
};

export const clampCablePct = (value, fallback = 50) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, numeric));
};

export const createCablePointId = (prefix = "node") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const rotatedOffset = (offset = {}, rotation = 0) => {
  const angle = (Number(rotation) || 0) * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = Number(offset.x) || 0;
  const y = Number(offset.y) || 0;
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
};

export const terminalIdForPoint = (point = {}) => {
  const type = String(point.type || "component");
  return POINT_TERMINAL_OFFSETS_PX[type]?.terminalId || `${type}-main`;
};

export const pointToTerminal = (point = {}) => {
  const type = String(point.type || "");
  const offset = rotatedOffset(POINT_TERMINAL_OFFSETS_PX[type], point.rotation);
  return {
    ...point,
    componentId: point.id,
    terminalId: terminalIdForPoint(point),
    x: clampCablePct((Number(point.x) || 0) + (offset.x / DESIGN_WIDTH) * 100),
    y: clampCablePct((Number(point.y) || 0) + (offset.y / DESIGN_HEIGHT) * 100),
  };
};

export const cablePath = (cable = {}) => {
  if (Array.isArray(cable.path) && cable.path.length >= 2) {
    return cable.path.map((point, index) => ({
      id: point.id || (index === 0 ? "source" : index === cable.path.length - 1 ? "target" : createCablePointId("node")),
      x: clampCablePct(point.x),
      y: clampCablePct(point.y),
    }));
  }

  const source = cable.source || cable.points?.[0] || { x: 50, y: 50 };
  const target = cable.target || cable.points?.[cable.points.length - 1] || source;
  const middle = Array.isArray(cable.points) ? cable.points : [];
  return [
    { id: "source", x: clampCablePct(source.x), y: clampCablePct(source.y) },
    ...middle.map((point) => ({
      id: point.id || createCablePointId("node"),
      x: clampCablePct(point.x),
      y: clampCablePct(point.y),
    })),
    { id: "target", x: clampCablePct(target.x), y: clampCablePct(target.y) },
  ];
};

export const normalizeCableInstallationMode = (value = "", fallback = "embutido") => {
  const source = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (!source) return fallback;
  if (VALID_CABLE_INSTALLATION_MODES.has(source)) return source;
  if (source.includes("piso") || source.includes("floor")) return "piso";
  if (source.includes("extern") || source.includes("aparente") || source.includes("sobrepor")) return "externa";
  if (source.includes("sobe") || source.includes("subida") || source === "up") return "sobe";
  if (source.includes("desce") || source.includes("descida") || source === "down") return "desce";
  if (
    source.includes("embut") ||
    source.includes("teto") ||
    source.includes("parede") ||
    source.includes("alvenaria") ||
    source === "embedded" ||
    VALID_ROUTING_MODES.has(source)
  ) {
    return "embutido";
  }

  return VALID_CABLE_INSTALLATION_MODES.has(fallback) ? fallback : "embutido";
};

export const syncCableFromPath = (cable = {}, nextPath = []) => {
  const path = nextPath.map((point, index) => ({
    id: point.id || (index === 0 ? "source" : index === nextPath.length - 1 ? "target" : createCablePointId("node")),
    x: clampCablePct(point.x),
    y: clampCablePct(point.y),
  }));
  if (path.length < 2) return cable;

  const sourcePath = path[0];
  const targetPath = path[path.length - 1];
  const source = {
    ...(cable.source || {}),
    x: sourcePath.x,
    y: sourcePath.y,
  };
  const target = {
    ...(cable.target || {}),
    x: targetPath.x,
    y: targetPath.y,
  };

  return {
    ...cable,
    source,
    target,
    points: path.slice(1, -1).map((point) => ({
      id: point.id || createCablePointId("node"),
      x: point.x,
      y: point.y,
    })),
    path,
  };
};

export const normalizeCableRoute = (route = {}, index = 0) => {
  const systemType = normalizeRouteSystem(route.systemType || route.system_type || route.system || route.type);
  const type = VALID_CABLE_TYPES.has(route.type) ? route.type : cableTypeForRouteSystem(systemType);
  const conduitDiameter = normalizeConduitDiameter(
    route.conduit_diameter || route.conduitDiameter || route.eletroduto || route.diameter || route.gauge,
    DEFAULT_CONDUIT_DIAMETER,
  );
  const rawPath = cablePath(route);
  const cable = {
    ...route,
    id: route.id || createCablePointId("cable"),
    name: route.name || route.label || route.circuit_name || `Cabo ${index + 1}`,
    type,
    systemType,
    color: route.color || route.circuit_color || route.stroke || route.strokeColor || DEFAULT_CABLE_COLORS[type] || colorForRouteSystem(systemType),
    thickness: Math.max(0.8, Math.min(8, Number(route.thickness) || Number(route.strokeWidth) || 1.4)),
    routingMode: VALID_ROUTING_MODES.has(route.routingMode) ? route.routingMode : "free",
    mode: normalizeCableInstallationMode(route.mode || route.installationMode || route.installation_mode || route.routeInstallationMode, "embutido"),
    gauge: route.gauge || route.wire_gauge || undefined,
    conduit_diameter: conduitDiameter || undefined,
    circuit_name: route.circuit_name || route.circuit || undefined,
    circuit: route.circuit || route.circuit_name || undefined,
    locked: Boolean(route.locked),
    visible: route.visible !== false,
    zIndex: Number.isFinite(Number(route.zIndex)) ? Number(route.zIndex) : index,
    source: route.source || {
      ...(rawPath[0] || { x: 50, y: 50 }),
      ...(route.start_id ? { componentId: route.start_id, terminalId: route.start_terminal_id || "main" } : {}),
    },
    target: route.target || {
      ...(rawPath[rawPath.length - 1] || { x: 50, y: 50 }),
      ...(route.end_id ? { componentId: route.end_id, terminalId: route.end_terminal_id || "main" } : {}),
    },
  };

  return syncCableFromPath(cable, rawPath);
};

export const normalizeCableRoutes = (routes = []) => (
  (Array.isArray(routes) ? routes : []).map((route, index) => normalizeCableRoute(route, index))
);

export const createManualCable = ({
  source = null,
  target = null,
  points = [],
  name = "",
  type = "CUSTOM",
  systemType = "",
  color = "",
  thickness = 1.4,
  routingMode = "free",
  mode = "embutido",
  gauge = "",
  wire_gauge = "",
  conduit_diameter = "",
  circuit_name = "",
  circuit = "",
  zIndex = 0,
} = {}) => {
  const normalizedSystemType = normalizeRouteSystem(systemType || type);
  const cableType = VALID_CABLE_TYPES.has(type) ? type : cableTypeForRouteSystem(normalizedSystemType);
  const conduitDiameter = normalizeConduitDiameter(conduit_diameter || gauge, DEFAULT_CONDUIT_DIAMETER);
  const base = {
    id: createCablePointId("cable"),
    name: name || "Cabo manual",
    type: cableType,
    systemType: normalizedSystemType,
    color: color || DEFAULT_CABLE_COLORS[cableType] || colorForRouteSystem(normalizedSystemType),
    thickness,
    mode: normalizeCableInstallationMode(mode, "embutido"),
    gauge: gauge || undefined,
    wire_gauge: wire_gauge || undefined,
    conduit_diameter: conduitDiameter || undefined,
    circuit_name: circuit_name || circuit || undefined,
    circuit: circuit || circuit_name || undefined,
    source: source || { x: 50, y: 50 },
    target: target || points[points.length - 1] || source || { x: 50, y: 50 },
    points: points.map((point) => ({ id: point.id || createCablePointId("node"), x: clampCablePct(point.x), y: clampCablePct(point.y) })),
    routingMode: VALID_ROUTING_MODES.has(routingMode) ? routingMode : "free",
    locked: false,
    visible: true,
    zIndex,
  };
  return syncCableFromPath(base, [
    base.source,
    ...base.points,
    base.target,
  ]);
};

export const updateCableNode = (cable, nodeIndex, nextNode, connection = null) => {
  const path = cablePath(cable);
  if (!path[nodeIndex]) return cable;
  path[nodeIndex] = {
    ...path[nodeIndex],
    x: clampCablePct(nextNode.x),
    y: clampCablePct(nextNode.y),
  };
  const updated = syncCableFromPath(cable, path);
  if (nodeIndex === 0) {
    updated.source = connection
      ? { ...updated.source, ...connection, x: path[0].x, y: path[0].y }
      : { x: path[0].x, y: path[0].y };
  }
  if (nodeIndex === path.length - 1) {
    updated.target = connection
      ? { ...updated.target, ...connection, x: path[path.length - 1].x, y: path[path.length - 1].y }
      : { x: path[path.length - 1].x, y: path[path.length - 1].y };
  }
  return syncCableFromPath(updated, cablePath(updated));
};

export const addCableNode = (cable, node, insertIndex = null) => {
  const path = cablePath(cable);
  const index = Math.max(1, Math.min(path.length - 1, insertIndex ?? path.length - 1));
  const nextPath = [
    ...path.slice(0, index),
    { id: createCablePointId("node"), x: clampCablePct(node.x), y: clampCablePct(node.y) },
    ...path.slice(index),
  ];
  return syncCableFromPath(cable, nextPath);
};

export const removeCableNode = (cable, nodeIndex) => {
  const path = cablePath(cable);
  if (nodeIndex <= 0 || nodeIndex >= path.length - 1 || path.length <= 2) return cable;
  return syncCableFromPath(cable, path.filter((_, index) => index !== nodeIndex));
};

export const moveCable = (cable, dx = 0, dy = 0) => syncCableFromPath(
  {
    ...cable,
    source: cable.source?.componentId ? cable.source : { ...(cable.source || {}), x: clampCablePct((cable.source?.x || 0) + dx), y: clampCablePct((cable.source?.y || 0) + dy) },
    target: cable.target?.componentId ? cable.target : { ...(cable.target || {}), x: clampCablePct((cable.target?.x || 0) + dx), y: clampCablePct((cable.target?.y || 0) + dy) },
  },
  cablePath(cable).map((point, index, path) => {
    const isSourceConnected = index === 0 && cable.source?.componentId;
    const isTargetConnected = index === path.length - 1 && cable.target?.componentId;
    if (isSourceConnected || isTargetConnected) return point;
    return { ...point, x: clampCablePct(point.x + dx), y: clampCablePct(point.y + dy) };
  }),
);

export const duplicateCable = (cable, zIndex = 0) => ({
  ...syncCableFromPath(
    {
      ...cable,
      id: createCablePointId("cable"),
      name: `${cable.name || cable.label || "Cabo"} copia`,
      source: { x: clampCablePct((cable.source?.x || cablePath(cable)[0]?.x || 0) + 1.4), y: clampCablePct((cable.source?.y || cablePath(cable)[0]?.y || 0) + 1.4) },
      target: { x: clampCablePct((cable.target?.x || cablePath(cable).at(-1)?.x || 0) + 1.4), y: clampCablePct((cable.target?.y || cablePath(cable).at(-1)?.y || 0) + 1.4) },
      zIndex,
    },
    cablePath(cable).map((point) => ({ ...point, id: point.id === "source" || point.id === "target" ? point.id : createCablePointId("node"), x: clampCablePct(point.x + 1.4), y: clampCablePct(point.y + 1.4) })),
  ),
  start_id: "",
  end_id: "",
});

export const updateCablesForMovedComponent = (cables = [], componentId, terminal) => (
  cables.map((cable) => {
    let next = cable;
    if (String(cable.source?.componentId || "") === String(componentId)) {
      next = updateCableNode(next, 0, terminal, {
        componentId,
        terminalId: cable.source.terminalId || terminal.terminalId || "main",
      });
    }
    const path = cablePath(next);
    if (String(next.target?.componentId || "") === String(componentId)) {
      next = updateCableNode(next, path.length - 1, terminal, {
        componentId,
        terminalId: next.target.terminalId || terminal.terminalId || "main",
      });
    }
    return next;
  })
);

export const findNearestTerminal = (terminals = [], point, maxDistancePct = 2.4) => {
  const nearest = terminals
    .map((terminal) => ({
      terminal,
      distance: Math.hypot((Number(terminal.x) || 0) - (Number(point.x) || 0), (Number(terminal.y) || 0) - (Number(point.y) || 0)),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest && nearest.distance <= maxDistancePct ? nearest.terminal : null;
};

export const validateCableConnections = (cables = [], terminals = []) => {
  const terminalKeys = new Set(terminals.map((terminal) => `${terminal.componentId}:${terminal.terminalId}`));
  const warnings = [];
  cables.forEach((cable) => {
    if (!cable.name && !cable.label) {
      warnings.push({ type: "missing-name", cableId: cable.id, description: "Cabo sem identificação." });
    }
    ["source", "target"].forEach((side) => {
      const endpoint = cable[side];
      if (!endpoint) {
        warnings.push({ type: `missing-${side}`, cableId: cable.id, description: `${side === "source" ? "Origem" : "Destino"} não definido.` });
        return;
      }
      if (endpoint.componentId && !endpoint.terminalId) {
        warnings.push({ type: "missing-terminal", cableId: cable.id, componentId: endpoint.componentId, description: "Conexão sem terminal definido." });
      }
      if (endpoint.componentId && endpoint.terminalId && !terminalKeys.has(`${endpoint.componentId}:${endpoint.terminalId}`)) {
        warnings.push({
          type: "terminal-not-found",
          cableId: cable.id,
          componentId: endpoint.componentId,
          terminalId: endpoint.terminalId,
          description: "Terminal conectado não existe mais no desenho.",
        });
      }
    });
  });
  return warnings;
};

export { DEFAULT_CABLE_COLORS, VALID_CABLE_TYPES, VALID_ROUTING_MODES, VALID_CABLE_INSTALLATION_MODES };
