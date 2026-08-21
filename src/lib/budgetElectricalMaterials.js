const normalizeText = (value = "") => (
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
);

export const BUDGET_MATERIAL_PRICES = {
  "DR Monofasico 40A 30mA": 150,
  "DR Bifasico 40A 30mA": 170,
  "DR Tripolar 40A 30mA": 240,
  "DR Tetrapolar 40A 30mA (Trifasico)": 275,
  "Conector de emenda compacto 3 vias": 2.9,
  "Terminal tubular isolado sortido": 0.75,
  "Terminal olhal/garfo isolado para quadro": 1.2,
  "Caixa 4x2 PVC embutir": 5.8,
  "Caixa 4x4 PVC embutir/passagem": 9.5,
  "Condulete aluminio tipo C/L/T": 24,
  "Curva 90 para eletroduto": 3.5,
  "Luva para eletroduto": 1.2,
  "Bucha e arruela para eletroduto": 1.1,
  "Abraçadeira tipo D com parafuso": 1.4,
  "Fita isolante antichama": 8.5,
  "Fita auto fusão": 18,
  "Anilha/etiqueta de identificação": 0.35,
  "Barramento fase pente/garfo": 38,
  "Barramento neutro isolado": 28,
  "Barramento terra PE": 24,
  "Canaleta recortada para quadro": 22,
  "Trilho DIN 35mm": 18,
  "Prensa-cabo/entrada de quadro": 4.5,
  "Parafuso, bucha e fixadores": 0.45,
  "Tomada 2P+T 10A com placa": 18,
  "Tomada 2P+T 20A com placa": 22,
  "Interruptor simples com placa": 16,
  "Interruptor paralelo/intermediario com placa": 24,
  "Ponto de luz/soquete plafon": 18,
  "Rack CFTV/Telecom 6U": 420,
};

export const GENERATED_BUDGET_SOURCES = new Set([
  "planta-ia-bom",
  "planta-ia-completa",
  "scanner-planta-ia",
]);

const CONDUIT_DIAMETER_OPTIONS = ['1/2"', '3/4"', '1"', '1 1/4"', '1 1/2"', '2"', '3"', '4"'];
const DEFAULT_CONDUIT_DIAMETER = '3/4"';
const DN_TO_CONDUIT_DIAMETER = {
  16: '1/2"',
  20: '3/4"',
  25: '1"',
  32: '1 1/4"',
  40: '1 1/2"',
  50: '2"',
  75: '3"',
  100: '4"',
};
const CONDUIT_PRICE_FACTOR = {
  '1/2"': 0.82,
  '3/4"': 1,
  '1"': 1.48,
  '1 1/4"': 2.15,
  '1 1/2"': 2.85,
  '2"': 4.35,
  '3"': 8.2,
  '4"': 12.5,
};

const standardProtectionRating = (value = 40) => {
  const current = Math.max(40, Number(value) || 40);
  const standards = [40, 63, 80, 100, 125, 160, 200, 250];
  return standards.find((rating) => current <= rating) || standards[standards.length - 1];
};

export const phaseCountForBudgetCircuit = (circuit = {}) => {
  const supply = normalizeText(circuit.supply_type || circuit.supplyType);
  const phase = String(circuit.phase || "").toUpperCase();
  const poles = Number(circuit.breaker_poles || circuit.poles || 0);

  if (supply.includes("trifas") || phase === "ABC" || poles >= 3) return 3;
  if (supply.includes("bifas") || phase.length === 2 || poles === 2) return 2;
  return 1;
};

export const conductorCountForBudgetCircuit = (circuit = {}) => {
  const phases = phaseCountForBudgetCircuit(circuit);
  if (phases === 3) return 5;
  return 3;
};

export const isGeneratedBudgetSource = (source = "") => GENERATED_BUDGET_SOURCES.has(String(source || ""));

const panelLayoutsForBudget = (project = {}) => {
  const boards = Array.isArray(project?.panel_boards) ? project.panel_boards : [];
  const boardLayouts = boards.map((board) => board?.layout).filter(Boolean);
  return boardLayouts.length ? boardLayouts : [project?.panel_layout].filter(Boolean);
};

const panelComponentsForBudget = (project = {}) => (
  panelLayoutsForBudget(project).flatMap((layout) => (
    (layout.rails || []).flatMap((rail) => rail.components || [])
  ))
);

const inferBudgetSupplyTypeFromPanel = (project = {}) => {
  const boards = Array.isArray(project?.panel_boards) ? project.panel_boards : [];
  const boardSupplyText = boards.map((board) => board?.supply_type || board?.supplyType).join(" ");
  const normalizedBoardSupply = normalizeText(boardSupplyText);
  if (normalizedBoardSupply.includes("trifas")) return "Trifásico";
  if (normalizedBoardSupply.includes("bifas")) return "Bifásico";

  const components = panelComponentsForBudget(project).filter((component) => component?.type !== "spacer");
  const dpsCount = components.filter((component) => component?.type === "dps").length;
  const componentText = normalizeText(components.map((component) => (
    `${component?.supply_type || ""} ${component?.supplyType || ""} ${component?.phase || ""} ${component?.label || ""}`
  )).join(" "));

  if (
    dpsCount >= 3 ||
    componentText.includes("trifas") ||
    componentText.includes("abcn") ||
    components.some((component) => component?.type === "dr" && Number(component?.poles) >= 4) ||
    components.some((component) => component?.type === "breaker" && (component?.phase === "ABC" || Number(component?.poles) >= 3))
  ) {
    return "Trifásico";
  }

  if (
    dpsCount >= 2 ||
    componentText.includes("bifas") ||
    components.some((component) => component?.phase === "AB" || Number(component?.poles) === 2)
  ) {
    return "Bifásico";
  }

  return "";
};

export const normalizeBudgetConduitDiameter = (value = "", fallback = DEFAULT_CONDUIT_DIAMETER) => {
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

  return CONDUIT_DIAMETER_OPTIONS.find((option) => raw.includes(option)) || fallback || "";
};

export const conduitPriceForBudget = (diameter = DEFAULT_CONDUIT_DIAMETER, infraType = "embutido") => {
  const basePrice = infraType === "galvanizado" ? 18.5 : 2.8;
  const normalizedDiameter = normalizeBudgetConduitDiameter(diameter);
  return Math.round(basePrice * (CONDUIT_PRICE_FACTOR[normalizedDiameter] || 1) * 100) / 100;
};

const routePath = (route = {}) => {
  if (Array.isArray(route.path) && route.path.length >= 2) return route.path;
  const source = route.source || route.points?.[0];
  const target = route.target || route.points?.[route.points.length - 1];
  const middle = Array.isArray(route.points) ? route.points : [];
  return [source, ...middle, target].filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)));
};

export const estimateRouteLengthMeters = (
  route = {},
  { designWidth = 1400, designHeight = 900, scalePxPerMeter = 50 } = {},
) => {
  const path = routePath(route);
  if (path.length < 2) return 0;
  const pxPerMeter = Math.max(1, Number(scalePxPerMeter) || 50);
  let totalPx = 0;

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const x1 = (Number(start.x) || 0) / 100 * designWidth;
    const y1 = (Number(start.y) || 0) / 100 * designHeight;
    const x2 = (Number(end.x) || 0) / 100 * designWidth;
    const y2 = (Number(end.y) || 0) / 100 * designHeight;
    totalPx += Math.hypot(x2 - x1, y2 - y1);
  }

  return totalPx / pxPerMeter;
};

export const buildConduitBudgetItems = ({
  plantRoutes = [],
  infraType = "embutido",
  scalePxPerMeter = 50,
  fallbackMeters = 10,
} = {}) => {
  const groups = new Map();

  (Array.isArray(plantRoutes) ? plantRoutes : []).forEach((route) => {
    if (route?.visible === false) return;
    const diameter = normalizeBudgetConduitDiameter(
      route.conduit_diameter || route.conduitDiameter || route.eletroduto || route.diameter || route.gauge,
      DEFAULT_CONDUIT_DIAMETER,
    );
    const lengthM = estimateRouteLengthMeters(route, { scalePxPerMeter });
    if (lengthM <= 0) return;
    groups.set(diameter, (groups.get(diameter) || 0) + lengthM);
  });

  if (groups.size === 0) {
    groups.set(DEFAULT_CONDUIT_DIAMETER, Math.max(1, Number(fallbackMeters) || 10));
  }

  return [...groups.entries()]
    .sort(([left], [right]) => CONDUIT_DIAMETER_OPTIONS.indexOf(left) - CONDUIT_DIAMETER_OPTIONS.indexOf(right))
    .map(([diameter, meters]) => {
      const qty = Math.max(1, Math.ceil(meters));
      const pricePerUnit = conduitPriceForBudget(diameter, infraType);
      return {
        name: infraType === "galvanizado"
          ? `Eletroduto Galvanizado de Aço Rígido ${diameter}`
          : `Eletroduto Flexível Corrugado PVC ${diameter}`,
        qty,
        unit: "m",
        pricePerUnit,
        total: qty * pricePerUnit,
        category: "infraestrutura",
        conduit_diameter: diameter,
      };
    });
};

export const resolveBudgetSupplyType = ({ project = {}, projectSupplyType = "", circuits = [] } = {}) => {
  const safeProject = /** @type {Record<string, any>} */ (project || {});
  const declared = normalizeText(projectSupplyType || safeProject.supply_type || safeProject.supplyType);
  const panelSupplyType = inferBudgetSupplyTypeFromPanel(safeProject);

  if (declared.includes("trifas") || panelSupplyType === "Trifásico" || circuits.some((circuit) => phaseCountForBudgetCircuit(circuit) === 3)) {
    return "Trifásico";
  }

  if (declared.includes("bifas") || panelSupplyType === "Bifásico" || circuits.some((circuit) => phaseCountForBudgetCircuit(circuit) === 2)) {
    return "Bifásico";
  }

  return "Monofásico";
};

export const getBudgetDrMaterial = ({
  project = {},
  projectSupplyType = "",
  circuits = [],
  required = false,
  quantity = 1,
} = {}) => {
  if (!required) return null;

  const safeProject = /** @type {Record<string, any>} */ (project || {});
  const supplyType = resolveBudgetSupplyType({ project, projectSupplyType, circuits });
  const maxBreaker = circuits.reduce((max, circuit) => (
    Math.max(max, Number(circuit.breaker_a || circuit.breaker || circuit.current || 0))
  ), Number(safeProject.general_breaker_a || safeProject.main_breaker_a || 40));
  const rating = standardProtectionRating(maxBreaker);

  if (supplyType === "Trifásico") {
    return {
      name: `DR Tetrapolar ${rating}A 30mA (Trifásico)`,
      qty: Math.max(1, Number(quantity) || 1),
      price: rating === 40 ? BUDGET_MATERIAL_PRICES["DR Tetrapolar 40A 30mA (Trifasico)"] : Math.round(rating * 7),
      poles: 4,
      supplyType,
    };
  }

  if (supplyType === "Bifásico") {
    return {
      name: `DR Bifásico ${rating}A 30mA`,
      qty: Math.max(1, Number(quantity) || 1),
      price: rating === 40 ? BUDGET_MATERIAL_PRICES["DR Bifasico 40A 30mA"] : Math.round(rating * 4.8),
      poles: 2,
      supplyType,
    };
  }

  return {
    name: `DR Monofásico ${rating}A 30mA`,
    qty: Math.max(1, Number(quantity) || 1),
    price: rating === 40 ? BUDGET_MATERIAL_PRICES["DR Monofasico 40A 30mA"] : Math.round(rating * 4.2),
    poles: 2,
    supplyType,
  };
};

export const getBudgetDrMaterialFromDevice = (device = {}, context = {}) => {
  const safeDevice = /** @type {Record<string, any>} */ (device || {});
  const safeContext = /** @type {Record<string, any>} */ (context || {});
  const supplyText = normalizeText(
    safeContext.supplyType ||
    safeContext.supply_type ||
    safeDevice.supply_type ||
    safeDevice.supplyType ||
    safeDevice.phase ||
    "",
  );
  const declaredThreePhase = supplyText.includes("trifas") || supplyText.includes("abcn") || String(safeDevice.phase || "").toUpperCase() === "ABCN";
  const declaredTwoPhase = supplyText.includes("bifas") || String(safeDevice.phase || "").toUpperCase() === "AB";
  const rawPoles = Math.max(1, Number(safeDevice.poles || safeDevice.dinSize || safeDevice.moduleWidth || 0));
  const poles = declaredThreePhase ? Math.max(rawPoles, 4) : declaredTwoPhase ? Math.max(rawPoles, 2) : rawPoles;
  const current = standardProtectionRating(safeDevice.current || safeDevice.breaker_a || safeDevice.rating || safeContext.current || 40);
  const quantity = Math.max(1, Number(safeContext.quantity) || 1);

  if (declaredThreePhase || poles >= 4) {
    return {
      name: `DR Tetrapolar ${current}A 30mA (Trifásico)`,
      qty: quantity,
      price: current === 40 ? BUDGET_MATERIAL_PRICES["DR Tetrapolar 40A 30mA (Trifasico)"] : Math.round(current * 7),
      poles: 4,
      supplyType: "Trifásico",
    };
  }

  if (poles === 3) {
    return {
      name: `DR Tripolar ${current}A 30mA`,
      qty: quantity,
      price: current === 40 ? BUDGET_MATERIAL_PRICES["DR Tripolar 40A 30mA"] : Math.round(current * 6),
      poles: 3,
      supplyType: "Trifásico",
    };
  }

  if (poles === 2) {
    return {
      name: `DR Bifásico ${current}A 30mA`,
      qty: quantity,
      price: current === 40 ? BUDGET_MATERIAL_PRICES["DR Bifasico 40A 30mA"] : Math.round(current * 4.8),
      poles: 2,
      supplyType: "Bifásico",
    };
  }

  return {
    name: `DR Monofásico ${current}A 30mA`,
    qty: quantity,
    price: current === 40 ? BUDGET_MATERIAL_PRICES["DR Monofasico 40A 30mA"] : Math.round(current * 4.2),
    poles: 1,
    supplyType: "Monofásico",
  };
};

export const estimateBudgetAccessoryQuantities = ({ circuits = [], pointCount = 0, routeCount = 0 } = {}) => {
  const circuitCount = Math.max(1, circuits.length);
  const conductorEnds = Math.max(
    0,
    circuits.reduce((sum, circuit) => sum + conductorCountForBudgetCircuit(circuit) * 2, 0),
  );

  return {
    connectors: Math.max(10, Math.ceil(pointCount * 1.2 + routeCount * 2 + circuitCount * 3)),
    tubularTerminals: Math.max(20, conductorEnds + circuitCount * 2),
    boardTerminals: Math.max(6, Math.ceil(circuitCount * 1.5) + 4),
  };
};

const pointTypeText = (point = {}) => normalizeText(
  point.type || point.id || point.kind || point.symbol || point.label || point.name || point.description,
);

const isPointType = (point, patterns = []) => {
  const term = pointTypeText(point);
  return patterns.some((pattern) => term.includes(pattern));
};

const addGroupedBudgetItem = (items, item) => {
  if (!item?.name || Number(item.qty) <= 0) return;
  items.push({
    unit: item.unit || "un",
    category: item.category || "materiais",
    note: item.note || "",
    ...item,
    qty: Math.max(0, Number(item.qty) || 0),
    price: Math.max(0, Number(item.price ?? item.unit_price ?? item.pricePerUnit) || 0),
  });
};

export const buildProfessionalBudgetComplements = ({
  project = {},
  circuits = [],
  plantPoints = [],
  plantRoutes = [],
  panelComponents = [],
  panelWires = [],
  infraType = "embutido",
  budgetPhaseCount = 1,
  panelDinModules = 12,
  conduitMeters = 0,
} = {}) => {
  const items = [];
  const safePoints = Array.isArray(plantPoints) ? plantPoints : [];
  const safeRoutes = Array.isArray(plantRoutes) ? plantRoutes : [];
  const safeCircuits = Array.isArray(circuits) ? circuits : [];
  const safePanelComponents = Array.isArray(panelComponents) ? panelComponents.filter((item) => item?.type !== "spacer") : [];
  const safePanelWires = Array.isArray(panelWires) ? panelWires.filter((item) => item?.visible !== false && !item?.deleted) : [];

  const pointCounts = safePoints.reduce((acc, point) => {
    if (isPointType(point, ["tomada", "tug", "tue"])) acc.outlets += 1;
    else if (isPointType(point, ["interruptor", "switch", "comando"])) acc.switches += 1;
    else if (isPointType(point, ["luminaria", "iluminacao", "lampada", "light", "ponto luz"])) acc.lights += 1;
    else if (isPointType(point, ["rack-cftv", "rack cftv", "rack", "dvr", "nvr"])) acc.racks += 1;
    else if (isPointType(point, ["caixa", "passagem", "derivacao"])) acc.junctionBoxes += 1;
    else if (isPointType(point, ["qgbt", "quadro", "qe", "qd"])) acc.boards += 1;
    else acc.generic += 1;
    return acc;
  }, {
    outlets: 0,
    switches: 0,
    lights: 0,
    junctionBoxes: 0,
    boards: 0,
    racks: 0,
    generic: 0,
  });

  const circuitPointCount = safeCircuits.reduce((sum, circuit) => sum + Math.max(0, Number(circuit.point_count || circuit.points || 0)), 0);
  const totalElectricalPoints = Math.max(safePoints.length, circuitPointCount);
  const derivedOutletCount = safeCircuits.reduce((sum, circuit) => {
    const type = normalizeText(circuit.type || circuit.name || circuit.label);
    if (type.includes("tomada") || type.includes("tug") || type.includes("tue") || type.includes("ar condicionado") || type.includes("chuveiro")) {
      return sum + Math.max(1, Number(circuit.point_count || 1));
    }
    return sum;
  }, 0);
  const derivedLightCount = safeCircuits.reduce((sum, circuit) => {
    const type = normalizeText(circuit.type || circuit.name || circuit.label);
    return type.includes("ilumin") ? sum + Math.max(1, Number(circuit.point_count || 1)) : sum;
  }, 0);

  const outlet10Qty = Math.max(pointCounts.outlets, derivedOutletCount);
  const outlet20Qty = safeCircuits.reduce((sum, circuit) => {
    const type = normalizeText(circuit.type || circuit.name || circuit.label);
    if (type.includes("tue") || type.includes("chuveiro") || type.includes("ar condicionado") || type.includes("forca")) {
      return sum + Math.max(1, Number(circuit.point_count || 1));
    }
    return sum;
  }, 0);
  const regularOutletQty = Math.max(0, outlet10Qty - outlet20Qty);
  const switchQty = Math.max(pointCounts.switches, Math.ceil(Math.max(pointCounts.lights, derivedLightCount) * 0.8));
  const lightQty = Math.max(pointCounts.lights, derivedLightCount);
  const box42Qty = Math.max(regularOutletQty + outlet20Qty + switchQty + lightQty, totalElectricalPoints - pointCounts.junctionBoxes - pointCounts.boards);
  const box44Qty = Math.max(pointCounts.junctionBoxes, Math.ceil(safeRoutes.length / 3), Math.ceil(safeCircuits.length / 4));
  const routeCount = Math.max(1, safeRoutes.length);
  const circuitCount = Math.max(1, safeCircuits.length || safePanelComponents.filter((item) => item.type === "breaker").length);
  const panelWireEnds = safePanelWires.length * 2;
  const conductorEnds = Math.max(
    panelWireEnds,
    safeCircuits.reduce((sum, circuit) => sum + conductorCountForBudgetCircuit(circuit) * 2, 0),
  );
  const effectiveConduitMeters = Math.max(Number(conduitMeters) || 0, safeCircuits.reduce((sum, circuit) => sum + (Number(circuit.length_m) || 0), 0));
  const isExternal = normalizeText(infraType).includes("galvan") || normalizeText(infraType).includes("sobrepor");

  addGroupedBudgetItem(items, {
    name: isExternal ? "Condulete aluminio tipo C/L/T" : "Caixa 4x4 PVC embutir/passagem",
    qty: isExternal ? Math.max(box44Qty, Math.ceil(routeCount * 0.8)) : box44Qty,
    price: isExternal ? BUDGET_MATERIAL_PRICES["Condulete aluminio tipo C/L/T"] : BUDGET_MATERIAL_PRICES["Caixa 4x4 PVC embutir/passagem"],
    category: "infraestrutura",
    note: "Caixas de passagem/derivação previstas por rotas, circuitos e pontos da planta.",
  });
  addGroupedBudgetItem(items, {
    name: "Caixa 4x2 PVC embutir",
    qty: box42Qty,
    price: BUDGET_MATERIAL_PRICES["Caixa 4x2 PVC embutir"],
    category: "infraestrutura",
    note: "Caixas para tomadas, interruptores e pontos de iluminação.",
  });
  addGroupedBudgetItem(items, {
    name: "Tomada 2P+T 10A com placa",
    qty: regularOutletQty,
    price: BUDGET_MATERIAL_PRICES["Tomada 2P+T 10A com placa"],
    category: "acabamentos",
  });
  addGroupedBudgetItem(items, {
    name: "Tomada 2P+T 20A com placa",
    qty: outlet20Qty,
    price: BUDGET_MATERIAL_PRICES["Tomada 2P+T 20A com placa"],
    category: "acabamentos",
  });
  addGroupedBudgetItem(items, {
    name: "Interruptor simples com placa",
    qty: switchQty,
    price: BUDGET_MATERIAL_PRICES["Interruptor simples com placa"],
    category: "acabamentos",
  });
  addGroupedBudgetItem(items, {
    name: "Ponto de luz/soquete plafon",
    qty: lightQty,
    price: BUDGET_MATERIAL_PRICES["Ponto de luz/soquete plafon"],
    category: "acabamentos",
  });
  addGroupedBudgetItem(items, {
    name: "Rack CFTV/Telecom 6U",
    qty: pointCounts.racks,
    price: BUDGET_MATERIAL_PRICES["Rack CFTV/Telecom 6U"],
    category: "telecom",
    note: "Rack previsto a partir dos pontos CFTV/telecom da planta.",
  });

  const conduitAccessoryBase = Math.max(routeCount, Math.ceil(effectiveConduitMeters / 6));
  addGroupedBudgetItem(items, {
    name: "Curva 90 para eletroduto",
    qty: Math.max(routeCount * 2, conduitAccessoryBase),
    price: isExternal ? 7.5 : BUDGET_MATERIAL_PRICES["Curva 90 para eletroduto"],
    category: "infraestrutura",
  });
  addGroupedBudgetItem(items, {
    name: "Luva para eletroduto",
    qty: Math.max(routeCount, Math.ceil(effectiveConduitMeters / 9)),
    price: isExternal ? 4.8 : BUDGET_MATERIAL_PRICES["Luva para eletroduto"],
    category: "infraestrutura",
  });
  addGroupedBudgetItem(items, {
    name: "Bucha e arruela para eletroduto",
    qty: Math.max(routeCount * 2, box44Qty * 2 + pointCounts.boards * 4),
    price: BUDGET_MATERIAL_PRICES["Bucha e arruela para eletroduto"],
    category: "infraestrutura",
  });
  addGroupedBudgetItem(items, {
    name: "Abraçadeira tipo D com parafuso",
    qty: isExternal ? Math.max(routeCount * 3, Math.ceil(effectiveConduitMeters / 1.5)) : 0,
    price: BUDGET_MATERIAL_PRICES["Abraçadeira tipo D com parafuso"],
    category: "infraestrutura",
  });
  addGroupedBudgetItem(items, {
    name: "Parafuso, bucha e fixadores",
    qty: Math.max(20, box42Qty * 2 + box44Qty * 4 + Math.ceil(effectiveConduitMeters / 2)),
    price: BUDGET_MATERIAL_PRICES["Parafuso, bucha e fixadores"],
    category: "consumíveis",
  });

  addGroupedBudgetItem(items, {
    name: "Conector de emenda compacto 3 vias",
    qty: Math.max(12, Math.ceil(totalElectricalPoints * 1.5 + routeCount * 2 + circuitCount * 3)),
    price: BUDGET_MATERIAL_PRICES["Conector de emenda compacto 3 vias"],
    category: "conectores",
    note: "Emendas e derivações em caixas conforme pontos e circuitos.",
  });
  addGroupedBudgetItem(items, {
    name: "Terminal tubular isolado sortido",
    qty: Math.max(24, conductorEnds + circuitCount * 4),
    price: BUDGET_MATERIAL_PRICES["Terminal tubular isolado sortido"],
    category: "conectores",
  });
  addGroupedBudgetItem(items, {
    name: "Terminal olhal/garfo isolado para quadro",
    qty: Math.max(8, Math.ceil(conductorEnds / 2) + budgetPhaseCount * 2),
    price: BUDGET_MATERIAL_PRICES["Terminal olhal/garfo isolado para quadro"],
    category: "conectores",
  });

  addGroupedBudgetItem(items, {
    name: "Barramento fase pente/garfo",
    qty: Math.max(1, Math.ceil(circuitCount / 12)),
    price: BUDGET_MATERIAL_PRICES["Barramento fase pente/garfo"],
    category: "quadro",
  });
  addGroupedBudgetItem(items, {
    name: "Barramento neutro isolado",
    qty: 1,
    price: BUDGET_MATERIAL_PRICES["Barramento neutro isolado"],
    category: "quadro",
  });
  addGroupedBudgetItem(items, {
    name: "Barramento terra PE",
    qty: 1,
    price: BUDGET_MATERIAL_PRICES["Barramento terra PE"],
    category: "quadro",
  });
  addGroupedBudgetItem(items, {
    name: "Trilho DIN 35mm",
    qty: Math.max(1, Math.ceil((Number(panelDinModules) || 12) / 12)),
    price: BUDGET_MATERIAL_PRICES["Trilho DIN 35mm"],
    category: "quadro",
  });
  addGroupedBudgetItem(items, {
    name: "Canaleta recortada para quadro",
    qty: Math.max(1, Math.ceil((Number(panelDinModules) || 12) / 18)),
    price: BUDGET_MATERIAL_PRICES["Canaleta recortada para quadro"],
    category: "quadro",
  });
  addGroupedBudgetItem(items, {
    name: "Prensa-cabo/entrada de quadro",
    qty: Math.max(4, budgetPhaseCount + circuitCount),
    price: BUDGET_MATERIAL_PRICES["Prensa-cabo/entrada de quadro"],
    category: "quadro",
  });
  addGroupedBudgetItem(items, {
    name: "Anilha/etiqueta de identificação",
    qty: Math.max(20, conductorEnds + circuitCount * 2),
    price: BUDGET_MATERIAL_PRICES["Anilha/etiqueta de identificação"],
    category: "identificação",
  });
  addGroupedBudgetItem(items, {
    name: "Fita isolante antichama",
    qty: Math.max(2, Math.ceil(circuitCount / 6)),
    price: BUDGET_MATERIAL_PRICES["Fita isolante antichama"],
    category: "consumíveis",
  });
  addGroupedBudgetItem(items, {
    name: "Fita auto fusão",
    qty: Math.max(1, Math.ceil(circuitCount / 12)),
    price: BUDGET_MATERIAL_PRICES["Fita auto fusão"],
    category: "consumíveis",
  });

  return items;
};
