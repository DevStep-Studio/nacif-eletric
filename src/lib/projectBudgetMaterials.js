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
    if (i >= 1600) return p >= 4 ? 19500 : p === 3 ? 14500 : 11000;
    if (i >= 1000) return p >= 4 ? 11800 : p === 3 ? 8900 : 6800;
    if (i >= 800) return p >= 4 ? 7200 : p === 3 ? 5400 : p === 2 ? 4200 : 3100;
    if (i >= 600) return p >= 4 ? 4300 : p === 3 ? 3200 : p === 2 ? 2450 : 1800; // 630A 3P -> R$ 3.200,00!
    if (i >= 500) return p >= 4 ? 3500 : p === 3 ? 2600 : p === 2 ? 2050 : 1500;
    if (i >= 400) return p >= 4 ? 2650 : p === 3 ? 1950 : p === 2 ? 1550 : 1150;
    if (i >= 300) return p >= 4 ? 2250 : p === 3 ? 1650 : p === 2 ? 1300 : 980;
    if (i >= 225) return p >= 4 ? 1580 : p === 3 ? 1150 : p === 2 ? 920 : 690;
    if (i >= 175) return p >= 4 ? 1220 : p === 3 ? 890 : p === 2 ? 710 : 530;
    if (i >= 150) return p >= 4 ? 1020 : p === 3 ? 740 : p === 2 ? 590 : 440;
    if (i >= 125) return p >= 4 ? 780 : p === 3 ? 560 : p === 2 ? 450 : 340;
    return p >= 4 ? 660 : p === 3 ? 480 : p === 2 ? 380 : 290;
  }

  // Mini-disjuntores padrão DIN (residencial / comercial):
  if (i <= 25) {
    return p >= 4 ? 115 : p === 3 ? 78 : p === 2 ? 48 : 19.90;
  }
  if (i <= 32) {
    return p >= 4 ? 128 : p === 3 ? 88 : p === 2 ? 54 : 24.90;
  }
  if (i <= 40) {
    return p >= 4 ? 145 : p === 3 ? 98 : p === 2 ? 66.50 : 29.90;
  }
  if (i <= 50) {
    return p >= 4 ? 170 : p === 3 ? 118 : p === 2 ? 78 : 36.00;
  }
  if (i <= 63) {
    return p >= 4 ? 198 : p === 3 ? 138 : p === 2 ? 89 : 42.00;
  }
  if (i <= 80) {
    return p >= 4 ? 360 : p === 3 ? 260 : p === 2 ? 180 : 85.00;
  }
  if (i <= 100) {
    return p >= 4 ? 480 : p === 3 ? 340 : p === 2 ? 240 : 115.00;
  }
  return p >= 4 ? 590 : p === 3 ? 420 : p === 2 ? 295 : 145.00;
};

export const BUDGET_BASE_MATERIAL_PRICES = {
  "Disjuntor 10A": 19.9,
  "Disjuntor 16A": 19.9,
  "Disjuntor 20A": 19.9,
  "Disjuntor 25A": 22.9,
  "Disjuntor 32A": 24.9,
  "Disjuntor 40A": 29.9,
  "Disjuntor 50A": 36.0,
  "Disjuntor 63A": 42.0,
  "Disjuntor 70A": 85.0,
  "Disjuntor 80A": 85.0,
  "Disjuntor 100A": 115.0,
  "Disjuntor 125A": 145.0,
  "Disjuntor geral 630A 3P/C": 3200.0,
  "Disjuntor geral 400A 3P/C": 1950.0,
  "Disjuntor geral 250A 3P/C": 1150.0,
  "Disjuntor geral 160A 3P/C": 740.0,
  "Disjuntor geral 125A 3P/C": 560.0,
  "Disjuntor geral 100A 3P/C": 480.0,
  "DR 30mA 25A": 125,
  "DR 30mA 40A": 145,
  "DR 30mA 63A": 175,
  "DPS Classe II": 85,
  "DPS Classe II 275V 20kA": 85,
  "DPS Classe II 275V 45kA": 110,
  "DPS Classe I+II 255V 50kA": 320,
  "Cabo 1.5mm² (m)": 2.5,
  "Cabo 2.5mm² (m)": 3.8,
  "Cabo 4mm² (m)": 5.8,
  "Cabo 6mm² (m)": 8.6,
  "Cabo 10mm² (m)": 14.5,
  "Cabo 16mm² (m)": 22.5,
  "Cabo 25mm² (m)": 36.0,
  "Cabo 35mm² (m)": 49.0,
  "Cabo 50mm² (m)": 72.0,
  "Cabo 70mm² (m)": 98.0,
  "Cabo 95mm² (m)": 138.0,
  "Cabo 120mm² (m)": 178.0,
  "Cabo 150mm² (m)": 225.0,
  "Cabo 185mm² (m)": 285.0,
  "Cabo 240mm² (m)": 375.0,
  "Quadro 12 DIN": 75,
  "Quadro 18 DIN": 95,
  "Quadro 24 DIN": 130,
  "Quadro 36 DIN": 180,
  "Quadro 48 DIN": 260,
  "Quadro 72 DIN": 380,
  "QGBT Autoportante 250A": 1650,
  "QGBT Autoportante 400A": 2900,
  "QGBT Autoportante 630A": 4800,
  "QGBT Autoportante 800A": 6500,
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
    { pattern: /dps|surto/, price: 85 },
    { pattern: /cabo.*240/, price: 375 },
    { pattern: /cabo.*185/, price: 285 },
    { pattern: /cabo.*150/, price: 225 },
    { pattern: /cabo.*120/, price: 178 },
    { pattern: /cabo.*95/, price: 138 },
    { pattern: /cabo.*70/, price: 98 },
    { pattern: /cabo.*50/, price: 72 },
    { pattern: /cabo.*35/, price: 49 },
    { pattern: /cabo.*25/, price: 36 },
    { pattern: /cabo.*16/, price: 22.5 },
    { pattern: /cabo.*10/, price: 14.5 },
    { pattern: /cabo.*6/, price: 8.6 },
    { pattern: /cabo.*4/, price: 5.8 },
    { pattern: /cabo.*2[,.]?5/, price: 3.8 },
    { pattern: /cabo.*1[,.]?5/, price: 2.5 },
    { pattern: /qgbt.*800/, price: 6500 },
    { pattern: /qgbt.*630/, price: 4800 },
    { pattern: /qgbt.*400/, price: 2900 },
    { pattern: /qgbt.*250|qgbt/, price: 1650 },
    { pattern: /quadro.*(48|54)/, price: 260 },
    { pattern: /quadro.*36/, price: 180 },
    { pattern: /quadro.*24/, price: 130 },
    { pattern: /quadro.*(12|18)/, price: 95 },
    { pattern: /tomada.*20a/, price: 22 },
    { pattern: /tomada/, price: 18 },
    { pattern: /interruptor.*(paralelo|three|intermediario)/, price: 24 },
    { pattern: /interruptor/, price: 16 },
    { pattern: /caixa.*4x4/, price: 9.5 },
    { pattern: /caixa.*4x2|caixa/, price: 5.8 },
    { pattern: /condulete/, price: 26 },
    { pattern: /eletroduto.*galvan/, price: 18.5 },
    { pattern: /eletroduto/, price: 2.8 },
    { pattern: /curva/, price: 3.5 },
    { pattern: /luva/, price: 1.4 },
    { pattern: /bucha.*arruela/, price: 1.2 },
    { pattern: /abracadeira|abraçadeira/, price: 1.6 },
    { pattern: /conector.*5\s*vias/, price: 4.5 },
    { pattern: /conector|borne|emenda/, price: 2.9 },
    { pattern: /terminal.*(compressao|tubular|ilhos|olhal|garfo)/, price: 1.2 },
    { pattern: /barramento.*trifas/, price: 68 },
    { pattern: /barramento/, price: 38 },
    { pattern: /canaleta/, price: 28 },
    { pattern: /trilho/, price: 18 },
    { pattern: /prensa/, price: 4.8 },
    { pattern: /fita.*auto\s*fus/, price: 24 },
    { pattern: /fita/, price: 9.5 },
    { pattern: /anilha|etiqueta|fixador|parafuso|bucha/, price: 0.45 },
    { pattern: /rack|cftv|nvr|dvr/, price: 450 },
    { pattern: /ar condicionado|split/, price: 55 },
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

const MATERIAL_IMAGE_URLS = {
  breaker: "https://zennyt.com.br/wp-content/uploads/2025/04/mini_disjuntor_weg_unipolar_16a_curva_c_mdw_c16_5291_1_b83d06e37dabf8827df140ca9ebcab4f.jpg",
  dr: "https://el12.com/zdjecia/residual-current-device-iid-2p-25a-30ma,p94293,w400_m.webp",
  dps: "https://i.shopar.openk.com.br/protetor_de_surto_dps_classe_ii_1p_20ka_275v_clamper_16235_plug_in_front_v_vermelho_21532_38290.jpg",
  cable: "https://images.tcdn.com.br/img/img_prod/1223709/1690997268_design_sem_nome_5.png",
  panel: "https://images.tcdn.com.br/img/img_prod/1061963/quadro_de_distribuicao_de_sobrepor_para_12_disjuntores_din_pvc_porta_opaca_steck_911_1_7f1f8dbea4c6c71931a80104efd459d1.jpg",
  outlet: "https://cdn.awsli.com.br/600x450/454/454948/produto/194023350/tomada-2p-t-10a-branca-weg-pial-tramontina-xzghfwny9t.jpg",
  switch: "https://cdn.leroymerlin.com.br/products/interruptor_simples_10a_branco_liz_tramontina_89471200_0001_600x600.jpg",
  box: "https://cdn.awsli.com.br/600x450/1984/1984878/produto/155519996/caixa-de-luz-4x2-amarela-tigre-r5eg71rp3x.jpg",
  conduit: "https://images.tcdn.com.br/img/img_prod/1061963/eletroduto_corrugado_flexivel_20mm_amarelo_rolo_50_metros_1103_1_458b5884218ddf9dcdd10ae0f676731d.jpg",
};

export const getBudgetMaterialImageUrl = (name = "") => {
  const term = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (term.includes("dps")) return MATERIAL_IMAGE_URLS.dps;
  if ((term.includes("dr") || term.includes("diferencial")) && (term.includes("trifas") || term.includes("tetrapolar") || term.includes("4p"))) return "";
  if (term.includes("dr 30ma") || term.includes("idr") || term.includes("diferencial")) return MATERIAL_IMAGE_URLS.dr;
  if (term.includes("disjuntor")) return MATERIAL_IMAGE_URLS.breaker;
  if (term.includes("cabo")) return MATERIAL_IMAGE_URLS.cable;
  if (term.includes("quadro") || term.includes("rack")) return MATERIAL_IMAGE_URLS.panel;
  if (term.includes("tomada")) return MATERIAL_IMAGE_URLS.outlet;
  if (term.includes("interruptor")) return MATERIAL_IMAGE_URLS.switch;
  if (term.includes("caixa")) return MATERIAL_IMAGE_URLS.box;
  if (term.includes("eletroduto") || term.includes("condulete") || term.includes("curva") || term.includes("luva") || term.includes("abracadeira")) return MATERIAL_IMAGE_URLS.conduit;

  return "";
};

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
  const materials = aggregatedBaseMaterials.map((material) => ({
    ...material,
    imageUrl: getBudgetMaterialImageUrl(material.name),
    basePrice: material.price,
    price: Math.round(material.price * productMultiplier * 100) / 100,
  }));
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
