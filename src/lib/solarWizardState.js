import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  SOLAR_MODULE_HEIGHT_M,
  SOLAR_MODULE_WIDTH_M,
  getBestPanelLayout,
  normalizeRoofPolygon,
} from "@/lib/solarDesignerGeometry";
import {
  computeInstantResults,
  estimateBatteryAutonomyHours,
  sizeFromAvailableArea,
  sizeFromDesiredPower,
} from "@/lib/solarSizing";

export const WIZARD_STEPS = [
  { key: "dados", label: "Dados do projeto" },
  { key: "consumo", label: "Consumo" },
  { key: "localizacao", label: "Localização" },
  { key: "telhado", label: "Telhado" },
  { key: "equipamentos", label: "Equipamentos" },
  { key: "projeto", label: "Projeto" },
];

export const DRAFT_STORAGE_KEY = "voltai_solar_wizard_draft_v1";

export function defaultWizardState() {
  return {
    // 1. Dados do projeto
    name: "",
    client_name: "",
    installation_type: "Residencial",
    entry_method: "power",
    desired_power_kwp: 11.55,
    available_area_m2: 60,
    system_mode: "on-grid",
    has_battery: false,
    bill_file_name: "",
    bill_file_url: "",
    bill_reading_status: "idle",
    bill_reading_message: "",

    // 2. Consumo
    monthly_consumption_kwh: "",
    tariff_brl_kwh: "",
    contracted_demand_kw: "",
    tariff_class: "B1 - Residencial",
    distributor: "",

    // 3. Localização
    address: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
    map_center_lat: DEFAULT_SOLAR_MAP_CENTER.lat,
    map_center_lng: DEFAULT_SOLAR_MAP_CENTER.lng,
    map_zoom: DEFAULT_SOLAR_MAP_ZOOM,
    location_confirmed: false,

    // 4. Telhado
    roof_polygon: [],
    roof_defined: false,
    roof_width_m: 9,
    roof_height_m: 6,
    roof_rotation_deg: 0,
    roof_area_m2: 54,
    roof_utilization_pct: 75,
    module_orientation: "auto",
    module_width_m: SOLAR_MODULE_WIDTH_M,
    module_height_m: SOLAR_MODULE_HEIGHT_M,

    // 5. Equipamentos
    inverter_kw: 5,
    module_wp: 550,
    ac_voltage: 220,
    ac_supply_type: "Bifásico",
    requested_panel_count: 21,
    battery_config: {
      capacity_kwh: "",
      model: "",
      voltage: "",
      technology: "Íon-lítio",
      depth_of_discharge_pct: 80,
      efficiency_pct: 90,
      desired_autonomy_h: "",
      priority_loads: [],
    },

    // 6. Projeto
    investment_brl: "",
  };
}

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Estimativa preliminar (etapa 1), antes de qualquer telhado desenhado.
 * Usada apenas para pré-preencher a etapa "Telhado" com um retângulo inicial editável.
 */
export function getPreliminarySizing(state) {
  if (state.entry_method === "area") {
    return sizeFromAvailableArea(state.available_area_m2, { moduleWp: state.module_wp });
  }
  return sizeFromDesiredPower(state.desired_power_kwp, state.module_wp);
}

/**
 * Deriva um retângulo inicial (largura x altura) plausível a partir da área-alvo,
 * para semear a etapa Telhado. O usuário sempre pode redesenhar livremente.
 */
export function estimateRoofRectangleFromArea(areaM2) {
  const area = Math.max(4, num(areaM2, 54));
  const aspect = 1.3; // retângulo levemente retangular, ajustável no desenho
  const height = Math.sqrt(area / aspect);
  const width = area / height;
  return { widthM: Math.round(width * 10) / 10, heightM: Math.round(height * 10) / 10 };
}

/**
 * Capacidade física real do telhado (desenhado ou retângulo-base), usando a MESMA
 * função (getBestPanelLayout) que o editor completo (/solar-project) já usa —
 * evita dois cálculos de encaixe divergentes entre o assistente e o editor.
 */
export function getRoofPhysicalLayout(state) {
  return getBestPanelLayout(state, 1200);
}

/**
 * Antes de o telhado ser desenhado (etapas 1-3), getRoofPolygonFromConfig não
 * tem um polígono real e roof_defined ainda é false — não faz sentido usar a
 * capacidade geométrica. Nessa fase, o quantitativo vem da estimativa preliminar
 * (potência desejada ou área informada na etapa 1). Depois que o telhado é
 * desenhado, passa a valer a MESMA capacidade física usada no editor completo.
 */
export function getEffectivePanelCount(state) {
  const hasRoof = normalizeRoofPolygon(state.roof_polygon).length >= 3 && state.roof_defined !== false;

  if (!hasRoof) {
    const preliminary = getPreliminarySizing(state);
    const panelCount = Math.max(0, Math.round(preliminary.panelCount || 0));
    return { panelCount, physicalCapacity: panelCount, requested: panelCount, hasRoof, fits: true };
  }

  const layout = getRoofPhysicalLayout(state);
  const requested = Math.max(0, Math.round(num(state.requested_panel_count, 0)));
  return {
    panelCount: Math.min(requested, layout.panelCount),
    physicalCapacity: layout.panelCount,
    requested,
    hasRoof,
    fits: requested <= layout.panelCount,
  };
}

export function getInstantResults(state) {
  const { panelCount } = getEffectivePanelCount(state);
  return computeInstantResults({
    panelCount,
    moduleWp: state.module_wp,
    monthlyConsumptionKwh: state.monthly_consumption_kwh,
    tariffBrlPerKwh: state.tariff_brl_kwh,
    investmentBrl: state.investment_brl,
  });
}

export function getBatteryAutonomyHours(batteryConfig) {
  if (!batteryConfig) return null;
  return estimateBatteryAutonomyHours({
    capacityKwh: batteryConfig.capacity_kwh,
    depthOfDischargePct: batteryConfig.depth_of_discharge_pct,
    efficiencyPct: batteryConfig.efficiency_pct,
    priorityLoadsW: (batteryConfig.priority_loads || []).map((load) => load.power_w),
  });
}

/**
 * Campos obrigatórios por etapa. Usado para bloquear o avanço e sinalizar pendências
 * (seção 3.2 do briefing: indicar erros antes de permitir avançar).
 */
export function getStepErrors(stepKey, state) {
  const errors = [];

  if (stepKey === "dados") {
    if (!state.name?.trim()) errors.push("Informe o nome do projeto.");
    if (state.entry_method === "power" && num(state.desired_power_kwp, 0) <= 0) {
      errors.push("Informe a potência desejada.");
    }
    if (state.entry_method === "area" && num(state.available_area_m2, 0) <= 0) {
      errors.push("Informe a área disponível.");
    }
    if (state.entry_method === "bill" && state.bill_reading_status !== "done" && num(state.desired_power_kwp, 0) <= 0) {
      errors.push("A leitura automática da conta está indisponível neste ambiente — informe a potência desejada manualmente para continuar.");
    }
  }

  if (stepKey === "consumo") {
    if (num(state.monthly_consumption_kwh, 0) <= 0) errors.push("Informe o consumo médio mensal (kWh).");
    if (num(state.tariff_brl_kwh, 0) <= 0) errors.push("Informe a tarifa de energia (R$/kWh).");
  }

  if (stepKey === "localizacao") {
    if (!state.address?.trim()) errors.push("Informe o endereço.");
    if (!state.city?.trim()) errors.push("Informe a cidade.");
    if (!state.state?.trim()) errors.push("Informe o estado (UF).");
  }

  if (stepKey === "telhado") {
    if (!(normalizeRoofPolygon(state.roof_polygon).length >= 3 && state.roof_defined !== false)) {
      errors.push("Desenhe o contorno do telhado no mapa.");
    }
  }

  if (stepKey === "equipamentos") {
    if (num(state.inverter_kw, 0) <= 0) errors.push("Informe a potência do inversor.");
    if (num(state.module_wp, 0) <= 0) errors.push("Informe a potência do módulo.");
    if (state.has_battery) {
      if (num(state.battery_config?.capacity_kwh, 0) <= 0) errors.push("Informe a capacidade da bateria (kWh).");
      const hasLoads = (state.battery_config?.priority_loads || []).length > 0;
      if (!hasLoads) errors.push("Adicione ao menos uma carga prioritária para calcular a autonomia.");
    }
  }

  return errors;
}
