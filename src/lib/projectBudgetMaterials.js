import { DEFAULT_LOGO_URL } from "@/lib/brandingDefaults";
import { calcMainProtection, calcProjectMetrics } from "@/lib/electricalEngine";
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
} from "@/lib/budgetElectricalMaterials";

export const BUDGET_BASE_MATERIAL_PRICES = {
  "Disjuntor 10A": 18,
  "Disjuntor 16A": 19,
  "Disjuntor 20A": 20,
  "Disjuntor 25A": 22,
  "Disjuntor 32A": 25,
  "Disjuntor 40A": 35,
  "Disjuntor 50A": 45,
  "DR 30mA 25A": 120,
  "DR 30mA 40A": 140,
  "DPS Classe II": 85,
  "Cabo 1.5mm² (m)": 2.5,
  "Cabo 2.5mm² (m)": 3.8,
  "Cabo 4mm² (m)": 5.5,
  "Cabo 6mm² (m)": 8.2,
  "Cabo 10mm² (m)": 13.5,
  "Cabo 16mm² (m)": 22,
  "Quadro 12 DIN": 65,
  "Quadro 24 DIN": 110,
  "Quadro 36 DIN": 160,
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

  const rules = [
    { pattern: /disjuntor.*(6|10)a/, price: 20 },
    { pattern: /disjuntor.*16a/, price: 19 },
    { pattern: /disjuntor.*20a/, price: 20 },
    { pattern: /disjuntor.*(25|32)a/, price: 25 },
    { pattern: /disjuntor.*(40|50)a/, price: 45 },
    { pattern: /\bdr\b|idr|diferencial/, price: 140 },
    { pattern: /dps|surto/, price: 85 },
    { pattern: /cabo.*1[,.]?5/, price: 2.5 },
    { pattern: /cabo.*2[,.]?5/, price: 3.8 },
    { pattern: /cabo.*4/, price: 5.5 },
    { pattern: /cabo.*6/, price: 8.2 },
    { pattern: /cabo.*10/, price: 13.5 },
    { pattern: /quadro.*(12|18)/, price: 85 },
    { pattern: /quadro.*24/, price: 110 },
    { pattern: /quadro.*36/, price: 160 },
    { pattern: /tomada/, price: 16 },
    { pattern: /interruptor/, price: 14 },
    { pattern: /caixa/, price: 6 },
    { pattern: /eletroduto/, price: 3 },
    { pattern: /curva|luva|bucha|arruela|abracadeira|abraçadeira/, price: 2.5 },
    { pattern: /condulete/, price: 22 },
    { pattern: /conector|borne|emenda/, price: 2.9 },
    { pattern: /terminal|ilh[oó]s|olhal|garfo/, price: 0.9 },
    { pattern: /barramento|trilho|canaleta|prensa/, price: 22 },
    { pattern: /fita|anilha|etiqueta|fixador|parafuso|bucha/, price: 5 },
    { pattern: /rack|cftv|nvr|dvr/, price: 420 },
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
  return { ...component, current: spec.current, poles: spec.poles, curve: spec.curve || component.curve };
};

const breakerMaterialFromComponent = (component = {}) => {
  const current = Math.max(6, Number(component.current || component.breaker_a || component.rating || component.breaker) || 16);
  const poles = Math.max(1, Number(component.poles || component.breaker_poles || 1) || 1);
  const curve = String(component.curve || component.breaker_curve || "").trim();
  const baseName = `Disjuntor ${current}A`;
  const poleSuffix = `${poles}P${curve ? `/${curve}` : ""}`;
  const name = component.isGeneral || /geral/i.test(String(component.label || component.name || ""))
    ? `Disjuntor geral ${current}A ${poleSuffix}`
    : `Disjuntor ${current}A ${poleSuffix}`;
  const poleFactor = poles >= 3 ? 2.8 : poles === 2 ? 1.9 : 1;
  const basePrice = BUDGET_BASE_MATERIAL_PRICES[baseName] || estimateLocalMaterialPrice(baseName);
  return {
    name,
    qty: 1,
    price: Math.round(basePrice * poleFactor * 100) / 100,
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
