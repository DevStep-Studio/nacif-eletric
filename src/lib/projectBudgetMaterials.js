import { DEFAULT_LOGO_URL } from "./brandingDefaults.js";
import { calcMainProtection, calcProjectMetrics } from "./electricalEngine.js";
import {
  BUDGET_MATERIAL_PRICES,
  buildConduitBudgetItems,
  buildProfessionalBudgetComplements,
  conductorCountForBudgetCircuit,
  getBudgetDrMaterial,
  getBudgetDrMaterialFromDevice,
  isGeneratedBudgetSource,
  isPanelAssemblyBudgetItem,
  phaseCountForBudgetCircuit,
  resolveBudgetSupplyType,
} from "./budgetElectricalMaterials.js";
import { getMaterialProductInfo } from "./materialProductCatalog.js";

export const calculateCircuitBreakerPrice = ({
  current = 16,
  poles = 1,
  isGeneral = false,
  curve = "C",
  name = "",
} = {}) => {
  const i = Math.max(6, Number(current) || 16);
  const p = Math.max(1, Number(poles) || 1);
  const text = String(name || "").toLowerCase();
  const isMoldedCase = text.includes("caixa moldada") || text.includes("mccb") || (isGeneral && i >= 100) || i >= 150;

  if (isMoldedCase) {
    if (i >= 1600) return p >= 4 ? 17500 : p === 3 ? 12800 : 9800;
    if (i >= 1000) return p >= 4 ? 10500 : p === 3 ? 7900 : 6100;
    if (i >= 800) return p >= 4 ? 6500 : p === 3 ? 4900 : p === 2 ? 3800 : 2800;
    if (i >= 600) return p >= 4 ? 3900 : p === 3 ? 2950 : p === 2 ? 2200 : 1650;
    if (i >= 500) return p >= 4 ? 3200 : p === 3 ? 2400 : p === 2 ? 1850 : 1380;
    if (i >= 400) return p >= 4 ? 2450 : p === 3 ? 1850 : p === 2 ? 1420 : 1080;
    if (i >= 300) return p >= 4 ? 2050 : p === 3 ? 1480 : p === 2 ? 1180 : 890;
    if (i >= 225) return p >= 4 ? 1380 : p === 3 ? 980 : p === 2 ? 790 : 590;
    if (i >= 175) return p >= 4 ? 1080 : p === 3 ? 790 : p === 2 ? 620 : 470;
    if (i >= 150) return p >= 4 ? 920 : p === 3 ? 680 : p === 2 ? 520 : 390;
    if (i >= 125) return p >= 4 ? 720 : p === 3 ? 540 : p === 2 ? 410 : 310;
    return p >= 4 ? 620 : p === 3 ? 480 : p === 2 ? 360 : 270;
  }

  // Mini-disjuntores padrão DIN (residencial / comercial):
  if (i <= 25) {
    return p >= 4 ? 82.00 : p === 3 ? 54.90 : p === 2 ? 34.90 : 14.90;
  }
  if (i <= 32) {
    return p >= 4 ? 92.00 : p === 3 ? 59.90 : p === 2 ? 38.90 : 16.90;
  }
  if (i <= 40) {
    return p >= 4 ? 105.00 : p === 3 ? 68.90 : p === 2 ? 42.90 : 18.90;
  }
  if (i <= 50) {
    return p >= 4 ? 125.00 : p === 3 ? 79.90 : p === 2 ? 49.90 : 22.50;
  }
  if (i <= 63) {
    return p >= 4 ? 145.00 : p === 3 ? 89.90 : p === 2 ? 56.90 : 26.90;
  }
  if (i <= 80) {
    return p >= 4 ? 260.00 : p === 3 ? 185.00 : p === 2 ? 125.00 : 58.00;
  }
  if (i <= 100) {
    return p >= 4 ? 340.00 : p === 3 ? 245.00 : p === 2 ? 165.00 : 78.00;
  }
  return p >= 4 ? 420.00 : p === 3 ? 310.00 : p === 2 ? 210.00 : 98.00;
};

export const BUDGET_BASE_MATERIAL_PRICES = {
  "Disjuntor 10A": 14.9,
  "Disjuntor 16A": 14.9,
  "Disjuntor 20A": 14.9,
  "Disjuntor 25A": 15.9,
  "Disjuntor 32A": 16.9,
  "Disjuntor 40A": 18.9,
  "Disjuntor 50A": 22.5,
  "Disjuntor 63A": 26.9,
  "Disjuntor 70A": 58.0,
  "Disjuntor 80A": 58.0,
  "Disjuntor 100A": 78.0,
  "Disjuntor 125A": 98.0,
  "Disjuntor geral 630A 3P/C": 2950.0,
  "Disjuntor geral 400A 3P/C": 1850.0,
  "Disjuntor geral 250A 3P/C": 980.0,
  "Disjuntor geral 160A 3P/C": 680.0,
  "Disjuntor geral 125A 3P/C": 540.0,
  "Disjuntor geral 100A 3P/C": 480.0,
  "DR 30mA 25A": 89,
  "DR 30mA 40A": 98,
  "DR 30mA 63A": 125,
  "DPS Classe II": 48,
  "DPS Classe II 275V 20kA": 45,
  "DPS Classe II 275V 45kA": 52,
  "DPS Classe I+II 255V 50kA": 235,
  "Cabo 1.5mm² (m)": 1.95,
  "Cabo 2.5mm² (m)": 2.95,
  "Cabo 4mm² (m)": 4.6,
  "Cabo 6mm² (m)": 6.8,
  "Cabo 10mm² (m)": 11.8,
  "Cabo 16mm² (m)": 18.9,
  "Cabo 25mm² (m)": 29.5,
  "Cabo 35mm² (m)": 41.0,
  "Cabo 50mm² (m)": 58.0,
  "Cabo 70mm² (m)": 82.0,
  "Cabo 95mm² (m)": 115.0,
  "Cabo 120mm² (m)": 148.0,
  "Cabo 150mm² (m)": 185.0,
  "Cabo 185mm² (m)": 235.0,
  "Cabo 240mm² (m)": 310.0,
  "Quadro 12 DIN": 54,
  "Quadro 18 DIN": 74,
  "Quadro 24 DIN": 98,
  "Quadro 36 DIN": 148,
  "Quadro 48 DIN": 198,
  "Quadro 72 DIN": 295,
  "QGBT Autoportante 250A": 1450,
  "QGBT Autoportante 400A": 2450,
  "QGBT Autoportante 630A": 3950,
  "QGBT Autoportante 800A": 5400,
  ...BUDGET_MATERIAL_PRICES,
};

export const normalizeManualBudgetItems = (items = []) => (
  Array.isArray(items)
    ? items.map((item, index) => ({
        id: item.id || `manual-${index}`,
        name: item.name || "Item manual",
        qty: Math.max(1, Number(item.qty || item.quantity) || 1),
        price: Math.max(0, Number(item.price || item.unit_price) || 0),
        unit: item.unit || "un",
        category: item.category || "manual",
        note: item.note || "",
        source: item.source || "manual",
      }))
    : []
);

export const estimateLocalMaterialPrice = (name = "") => {
  const term = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const exact = Object.entries(BUDGET_BASE_MATERIAL_PRICES).find(([key]) => key.toLowerCase() === name.toLowerCase());
  if (exact) return exact[1];

  // Identificação inteligente de disjuntores com corrente e polos
  if (term.includes("disjuntor") || term.includes("breaker") || term.includes("dj")) {
    const currentMatch = term.match(/(\d+)\s*a\b/i);
    const current = currentMatch ? Number(currentMatch[1]) : 20;
    const isGeneral = term.includes("geral") || term.includes("main") || term.includes("entrada");
    let poles = 1;
    if (term.includes("4p") || term.includes("tetra") || term.includes("quadripolar")) poles = 4;
    else if (term.includes("3p") || term.includes("tri") || term.includes("trifas")) poles = 3;
    else if (term.includes("2p") || term.includes("bi") || term.includes("bifas")) poles = 2;
    return calculateCircuitBreakerPrice({ current, poles, isGeneral, name: term });
  }

  // Identificação de DR / IDR
  if (term.includes("dr") || term.includes("idr") || term.includes("diferencial")) {
    const currentMatch = term.match(/(\d+)\s*a\b/i);
    const current = currentMatch ? Number(currentMatch[1]) : 40;
    let poles = 2;
    if (term.includes("4p") || term.includes("tetra") || term.includes("trifas")) poles = 4;
    else if (term.includes("3p") || term.includes("tri")) poles = 3;
    return getBudgetDrPrice({ current, poles });
  }

  const rules = [
    { pattern: /dps|surto/, price: 48 },
    { pattern: /cabo.*240/, price: 310 },
    { pattern: /cabo.*185/, price: 235 },
    { pattern: /cabo.*150/, price: 185 },
    { pattern: /cabo.*120/, price: 148 },
    { pattern: /cabo.*95/, price: 115 },
    { pattern: /cabo.*70/, price: 82 },
    { pattern: /cabo.*50/, price: 58 },
    { pattern: /cabo.*35/, price: 41 },
    { pattern: /cabo.*25/, price: 29.5 },
    { pattern: /cabo.*16/, price: 18.9 },
    { pattern: /cabo.*10/, price: 11.8 },
    { pattern: /cabo.*6/, price: 6.8 },
    { pattern: /cabo.*4/, price: 4.6 },
    { pattern: /cabo.*2[,.]?5/, price: 2.95 },
    { pattern: /cabo.*1[,.]?5/, price: 1.95 },
    { pattern: /qgbt.*800/, price: 5400 },
    { pattern: /qgbt.*630/, price: 3950 },
    { pattern: /qgbt.*400/, price: 2450 },
    { pattern: /qgbt.*250|qgbt/, price: 1450 },
    { pattern: /quadro.*(48|54)/, price: 198 },
    { pattern: /quadro.*36/, price: 148 },
    { pattern: /quadro.*24/, price: 98 },
    { pattern: /quadro.*(12|18)/, price: 64 },
    { pattern: /tomada.*20a/, price: 17.9 },
    { pattern: /tomada/, price: 15.9 },
    { pattern: /interruptor.*(paralelo|three|intermediario)/, price: 19.9 },
    { pattern: /interruptor/, price: 14.9 },
    { pattern: /caixa.*4x4/, price: 7.5 },
    { pattern: /caixa.*4x2|caixa/, price: 4.2 },
    { pattern: /condulete/, price: 19.5 },
    { pattern: /eletroduto.*galvan/, price: 16.8 },
    { pattern: /eletroduto/, price: 2.1 },
    { pattern: /curva/, price: 2.6 },
    { pattern: /luva/, price: 1.1 },
    { pattern: /bucha.*arruela/, price: 0.9 },
    { pattern: /abracadeira|abraçadeira/, price: 1.2 },
    { pattern: /conector.*5\s*vias/, price: 4.1 },
    { pattern: /conector|borne|emenda/, price: 2.7 },
    { pattern: /terminal.*(compressao|tubular|ilhos|olhal|garfo)/, price: 0.35 },
    { pattern: /barramento.*trifas/, price: 52 },
    { pattern: /barramento/, price: 28 },
    { pattern: /canaleta/, price: 32 },
    { pattern: /trilho/, price: 16.9 },
    { pattern: /prensa/, price: 3.6 },
    { pattern: /fita.*auto\s*fus/, price: 22.5 },
    { pattern: /fita/, price: 9.9 },
    { pattern: /anilha|etiqueta|fixador|parafuso|bucha/, price: 0.25 },
    { pattern: /rack|cftv|nvr|dvr/, price: 360 },
    { pattern: /ar condicionado|split/, price: 45 },
  ];

  const match = rules.find((rule) => rule.pattern.test(term));
  return match ? match.price : 25;
};

export const getProjectLogo = (project, fallback) => (
  project?.logo_url
  || project?.logoUrl
  || project?.project_logo
  || project?.projectLogo
  || project?.logo
  || fallback
  || DEFAULT_LOGO_URL
);

export const getBudgetMaterialImageUrl = (name = "") => (
  getMaterialProductInfo(name).imageUrl
);

const getProjectPanelLayouts = (project = {}) => {
  const boards = Array.isArray(project?.panel_boards) ? project.panel_boards : [];
  const boardLayouts = boards.map((board) => board?.layout).filter(Boolean);
  return boardLayouts.length ? boardLayouts : [project?.panel_layout].filter(Boolean);
};

const getProjectPanelComponents = (project = {}, componentType = "") => {
  const components = getProjectPanelLayouts(project).flatMap((layout) => (
    (layout.rails || []).flatMap((rail) => rail.components || [])
  ));
  return componentType ? components.filter((component) => component?.type === componentType) : components;
};

const getProjectPanelWires = (project = {}) => (
  getProjectPanelLayouts(project).flatMap((layout) => layout.wires || [])
);

const asArray = (value) => (Array.isArray(value) ? value : []);

// O projeto tem uma planta baixa / projeto de infraestrutura desenhado ou importado?
const projectHasFloorPlan = (project = {}, plantDesign = {}) => {
  const imported = plantDesign.importedPlanElements || project?.importedPlanElements || {};
  return (
    asArray(plantDesign.routes).length > 0
    || asArray(plantDesign.points).length > 0
    || asArray(plantDesign.rooms).length > 0
    || asArray(plantDesign.walls).length > 0
    || asArray(imported.lines).length > 0
    || Boolean(plantDesign.imageUrl)
    || Boolean(project?.floor_plan || project?.floorPlan || project?.plantDocument)
  );
};

// O projeto tem um layout de quadro real (com componentes montados nos trilhos)?
const projectHasPanelLayout = (project = {}) => (
  getProjectPanelComponents(project).some((component) => component?.type && component.type !== "spacer")
);

const isGeneralPanelComponent = (component = {}) => (
  !component?.locked
  && (
    component?.isGeneral === true
    || ["gen_brk", "gen_dr"].includes(String(component?.id || ""))
    || /geral/i.test(String(component?.label || component?.name || ""))
  )
);

// Alinha o disjuntor/IDR geral do quadro ao dimensionamento (mesma fonte do editor
// de circuitos), para o orçamento e os materiais baterem com as demais telas.
const withMainProtectionOverride = (component = {}, mainProtection = null) => {
  if (!mainProtection || !isGeneralPanelComponent(component)) return component;
  const spec = component.type === "dr" ? mainProtection.dr : mainProtection.breaker;
  if (!spec || !spec.current) return component;
  return { ...component, current: spec.current, poles: spec.poles || component.poles, curve: spec.curve || component.curve };
};

const breakerMaterialFromComponent = (component = {}) => {
  const current = Math.max(6, Number(component.current || component.breaker_a || component.rating || component.breaker) || 16);
  const poles = Math.max(1, Number(component.poles || component.breaker_poles || 1) || 1);
  const curve = String(component.curve || component.breaker_curve || "").trim();
  const isGeneral = component.isGeneral === true || /geral/i.test(String(component.label || component.name || ""));
  const poleSuffix = `${poles}P${curve ? `/${curve}` : ""}`;
  const isMoldedCase = (isGeneral && current >= 100) || current >= 150 || /caixa moldada|mccb/i.test(String(component.label || component.name || ""));

  const prefix = isGeneral ? "Disjuntor geral" : "Disjuntor";
  const name = `${prefix} ${current}A ${poleSuffix}`;
  const price = calculateCircuitBreakerPrice({
    current,
    poles,
    isGeneral,
    curve,
    name,
  });

  return {
    name,
    qty: 1,
    price: Math.round(price * 100) / 100,
  };
};

export const aggregateBudgetMaterials = (items = []) => {
  const grouped = new Map();
  items.forEach((item) => {
    if (!item?.name || Number(item.qty) <= 0) return;
    const price = Math.max(0, Number(item.price) || 0);
    const key = `${item.name}|${price}|${item.unit || "un"}|${item.manual ? item.source || "manual" : "auto"}`;
    const current = grouped.get(key);
    if (current) {
      current.qty += Number(item.qty) || 0;
      return;
    }
    grouped.set(key, { ...item, qty: Number(item.qty) || 0, price });
  });
  return [...grouped.values()];
};

export function buildProjectBudgetMaterials(project, { productAdjustment = 0 } = {}) {
  if (!project) {
    return {
      metrics: null,
      circuits: [],
      materials: [],
      baseMaterials: [],
      customManualItems: [],
      generatedManualItems: [],
      baseMaterialTotal: 0,
      materialTotal: 0,
      productAdjustmentValue: 0,
      isPanelAssemblyOnly: false,
      budgetScope: "installation",
    };
  }

  const metrics = calcProjectMetrics(project);
  const circuits = metrics.circuits || [];
  const mainProtection = calcMainProtection(project, metrics);
  const productMultiplier = Math.max(0, 1 + (Number(productAdjustment) || 0) / 100);
  const plantDesign = project?.plant_design || project?.plantDesign || {};
  const plantRoutes = Array.isArray(plantDesign.routes) ? plantDesign.routes : [];
  const plantPoints = Array.isArray(plantDesign.points) ? plantDesign.points : [];
  // Projeto de "montar quadro": tem o layout do quadro mas nenhuma planta baixa.
  // Nesse caso o orçamento lista apenas o que compõe o quadro — sem infraestrutura
  // (eletrodutos, caixas, curvas), acabamentos (tomadas, interruptores, pontos de
  // luz) nem o cabeamento de distribuição, que dependem da planta baixa.
  const isPanelAssemblyOnly = !projectHasFloorPlan(project, plantDesign) && projectHasPanelLayout(project);
  const inferredInfraType = plantRoutes.some((route) => String(route.mode || "").toLowerCase().includes("externa"))
    ? "galvanizado"
    : (project?.infra_type || project?.plant_infra_type || "embutido");

  const baseMaterials = [];
  const panelComponents = getProjectPanelComponents(project).filter((component) => component?.type && component.type !== "spacer");
  const panelBreakers = getProjectPanelComponents(project, "breaker");
  const drComponents = getProjectPanelComponents(project, "dr");
  const dpsComponents = getProjectPanelComponents(project, "dps");
  const panelWires = getProjectPanelWires(project).filter((wire) => wire?.visible !== false && !wire?.deleted);
  const budgetSupplyType = resolveBudgetSupplyType({ project, circuits });
  const budgetPhaseCount = budgetSupplyType === "Trifásico" ? 3 : budgetSupplyType === "Bifásico" ? 2 : 1;
  const hasBudgetElectricalSource = circuits.length > 0 || panelComponents.length > 0;
  const manualItems = normalizeManualBudgetItems(project?.manual_budget_items);
  const customManualItems = manualItems.filter((item) => !isGeneratedBudgetSource(item.source));
  const generatedManualItems = manualItems.filter((item) => isGeneratedBudgetSource(item.source));
  const useStoredGeneratedItems = !hasBudgetElectricalSource && plantRoutes.length === 0 && generatedManualItems.length > 0;

  if (panelBreakers.length > 0) {
    panelBreakers.forEach((component) => {
      baseMaterials.push(breakerMaterialFromComponent(withMainProtectionOverride(component, mainProtection)));
    });
  }

  circuits.forEach((circuit) => {
    if (panelBreakers.length === 0) {
      const breakerComponent = {
        current: circuit.breaker_a || circuit.breaker || 16,
        poles: circuit.breaker_poles || phaseCountForBudgetCircuit(circuit),
        curve: circuit.breaker_curve,
      };
      baseMaterials.push(breakerMaterialFromComponent(breakerComponent));
    }
    // Sem planta baixa não há traçado de cabos a quantificar.
    if (isPanelAssemblyOnly) return;
    const cableName = `Cabo ${circuit.wire_gauge} (m)`;
    const conductorCount = conductorCountForBudgetCircuit(circuit);
    baseMaterials.push({
      name: cableName,
      qty: (circuit.length_m || 10) * conductorCount,
      price: BUDGET_BASE_MATERIAL_PRICES[cableName] || 5,
      unit: "m",
      category: "cabos",
    });
  });

  if (hasBudgetElectricalSource) {
    if (drComponents.length > 0) {
      drComponents.forEach((component) => {
        const drMaterial = getBudgetDrMaterialFromDevice(withMainProtectionOverride(component, mainProtection), { supplyType: budgetSupplyType });
        baseMaterials.push({ name: drMaterial.name, qty: drMaterial.qty, price: drMaterial.price, category: "proteção" });
      });
    } else {
      const drMaterial = getBudgetDrMaterial({
        project,
        projectSupplyType: budgetSupplyType,
        circuits,
        required: circuits.some((circuit) => circuit.needs_dr),
        quantity: 1,
      });
      if (drMaterial) {
        baseMaterials.push({ name: drMaterial.name, qty: drMaterial.qty, price: drMaterial.price, category: "proteção" });
      }
    }

    const dpsQty = Math.max(dpsComponents.length, budgetPhaseCount);
    baseMaterials.push({ name: "DPS Classe II", qty: dpsQty, price: BUDGET_BASE_MATERIAL_PRICES["DPS Classe II"], category: "proteção" });
    const usedPanelDins = panelComponents.reduce((sum, component) => sum + (Number(component.poles || component.dinSize || component.moduleWidth) || 1), 0);
    const dins = usedPanelDins || circuits.length + 6;
    const quadro = dins <= 12 ? "12" : dins <= 24 ? "24" : "36";
    baseMaterials.push({ name: `Quadro ${quadro} DIN`, qty: 1, price: BUDGET_BASE_MATERIAL_PRICES[`Quadro ${quadro} DIN`] || 110, category: "quadro" });

    // Eletrodutos só entram quando há planta baixa (traçado de infraestrutura).
    const conduitItems = isPanelAssemblyOnly ? [] : buildConduitBudgetItems({
      plantRoutes,
      infraType: inferredInfraType,
      scalePxPerMeter: plantDesign.scalePxPerMeter || 50,
      fallbackMeters: 10,
    });
    conduitItems.forEach((item) => {
      baseMaterials.push({ name: item.name, qty: item.qty, price: item.pricePerUnit, unit: item.unit, category: item.category });
    });

    buildProfessionalBudgetComplements({
      project,
      circuits: circuits.length > 0 ? circuits : panelBreakers.map((component) => ({
        supply_type: component.supply_type || budgetSupplyType,
        phase: component.phase,
        breaker_poles: component.poles,
      })),
      plantPoints,
      plantRoutes,
      panelComponents,
      panelWires,
      infraType: inferredInfraType,
      budgetPhaseCount,
      panelDinModules: dins,
      conduitMeters: conduitItems.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    }).forEach((item) => {
      // Projeto só de quadro: mantém apenas os complementos de montagem do quadro.
      if (isPanelAssemblyOnly && !isPanelAssemblyBudgetItem(item)) return;
      baseMaterials.push(item);
    });
  }

  if (circuits.length === 0 && plantRoutes.length > 0) {
    buildConduitBudgetItems({
      plantRoutes,
      infraType: inferredInfraType,
      scalePxPerMeter: plantDesign.scalePxPerMeter || 50,
      fallbackMeters: 10,
    }).forEach((item) => {
      baseMaterials.push({ name: item.name, qty: item.qty, price: item.pricePerUnit, unit: item.unit, category: item.category });
    });
  }

  if (useStoredGeneratedItems) {
    generatedManualItems.forEach((item) => {
      baseMaterials.push({
        name: item.name,
        qty: item.qty,
        price: item.price,
        unit: item.unit,
        category: item.category,
        manual: false,
        source: item.source,
      });
    });
  }

  customManualItems.forEach((item) => {
    baseMaterials.push({
      name: item.name,
      qty: item.qty,
      price: item.price,
      unit: item.unit,
      category: item.category,
      manual: true,
      source: item.source,
    });
  });

  const aggregatedBaseMaterials = aggregateBudgetMaterials(baseMaterials);
  const materials = aggregatedBaseMaterials.map((material) => {
    const productInfo = getMaterialProductInfo(material);
    return {
      ...material,
      imageUrl: material.image || material.imageUrl || productInfo.imageUrl,
      brand: material.brand || productInfo.brand,
      specShort: material.specShort || productInfo.specShort,
      category: material.category || productInfo.categoryKey,
      basePrice: material.price,
      price: Math.round(material.price * productMultiplier * 100) / 100,
    };
  });
  const baseMaterialTotal = aggregatedBaseMaterials.reduce((sum, material) => sum + material.qty * material.price, 0);
  const materialTotal = materials.reduce((sum, material) => sum + material.qty * material.price, 0);

  return {
    metrics,
    circuits,
    plantDesign,
    plantRoutes,
    plantPoints,
    inferredInfraType,
    budgetSupplyType,
    budgetPhaseCount,
    isPanelAssemblyOnly,
    budgetScope: isPanelAssemblyOnly ? "panel" : "installation",
    materials,
    baseMaterials: aggregatedBaseMaterials,
    customManualItems,
    generatedManualItems,
    baseMaterialTotal,
    materialTotal,
    productAdjustmentValue: materialTotal - baseMaterialTotal,
  };
}
