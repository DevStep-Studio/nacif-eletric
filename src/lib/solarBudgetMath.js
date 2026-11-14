/**
 * Motor de Orçamento Detalhado Solar & Viabilidade Financeira (25 Anos) — NACIF ENERGY
 * Pure ESM module compatible with both Vite browser builds and Node smoke tests.
 */

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const SOLAR_MARGIN_PRESETS = [12, 15, 20, 25, 30, 35];

export const DEFAULT_FINANCIAL_PREMISES = {
  annualDegradationPct: 0.7,
  tariffInflationPct: 5.5,
  discountRatePct: 8.5,
  annualMaintenancePct: 0.6,
  poupancaYieldPct: 6.17,
  rendaFixaYieldPct: 11.5,
  financingMonthlyRatePct: 1.49,
  availabilityCostKwh: 50,
  publicLightingBrl: 35,
};

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function estimateBreakerPrice(amps = 40, isTri = false) {
  const base = amps <= 25 ? 85 : amps <= 40 ? 115 : amps <= 63 ? 165 : amps <= 100 ? 290 : 480;
  return isTri ? Math.round(base * 1.45) : base;
}

/**
 * Gera os itens padrão de Equipamentos Fotovoltaicos (Kit CC) com preços de referência de mercado.
 */
export function buildDefaultSolarEquipmentItems({ project = {}, config = {}, sizing = {} } = {}) {
  const c = config || {};
  const s = sizing || {};
  const p = project || {};

  const panelCount = Math.max(1, Math.round(num(s.panelCount ?? c.requested_panel_count, 20)));
  const moduleWp = Math.max(100, num(c.module_wp, 550));
  const inverterKw = Math.max(1, num(c.inverter_kw, 5));
  const inverterCount = Math.max(1, Math.round(num(c.inverter_quantity, 1)));
  const systemMode = String(p.system_mode || c.system_mode || "on-grid").toLowerCase();
  const isMicro = systemMode.includes("micro");
  const isHybrid = systemMode.includes("hibr") || Boolean(p.has_battery || c.has_battery);
  const stringsCount = Math.max(1, Array.isArray(s.strings) ? s.strings.length : Math.ceil(panelCount / 10));

  const moduleModel = [c.module_manufacturer, c.module_model].filter(Boolean).join(" ") || `Módulo Fotovoltaico ${moduleWp} Wp Tier-1`;
  const inverterModel = [c.inverter_manufacturer, c.inverter_model].filter(Boolean).join(" ") || `Inversor Solar ${inverterKw} kW`;

  const moduleUnitPrice = round2(moduleWp * 1.08);
  const inverterUnitPrice = round2(Math.max(2600, inverterKw * (isHybrid ? 1150 : 680)));
  const structureUnitPrice = 135;
  const cableMeters = Math.max(40, panelCount * 3);
  const mc4Pairs = Math.max(4, stringsCount * 2 + 2);
  const batteryKwh = num(p.battery_config?.capacity_kwh ?? c.battery_config?.capacity_kwh, 0);

  const items = [
    {
      id: "eq_modules",
      name: `${moduleModel} (${moduleWp} Wp)`,
      category: "Equipamentos CC",
      unit: "un",
      quantity: panelCount,
      unitPrice: moduleUnitPrice,
    },
    {
      id: "eq_inverter",
      name: `${inverterModel} (${inverterKw} kW)`,
      category: "Equipamentos CC",
      unit: "un",
      quantity: inverterCount,
      unitPrice: inverterUnitPrice,
    },
    {
      id: "eq_structure",
      name: "Estrutura de Fixação Alumínio Anodizado / Aço Inox",
      category: "Equipamentos CC",
      unit: "mód",
      quantity: panelCount,
      unitPrice: structureUnitPrice,
    },
    {
      id: "eq_cable_cc",
      name: "Cabo Solar Fotovoltaico 6,0 mm² 1,5 kVcc (Preto/Vermelho)",
      category: "Equipamentos CC",
      unit: "m",
      quantity: cableMeters,
      unitPrice: 8.9,
    },
    {
      id: "eq_mc4",
      name: "Kit Conectores MC4 IP68 1500V",
      category: "Equipamentos CC",
      unit: "par",
      quantity: mc4Pairs,
      unitPrice: 24,
    },
    {
      id: "eq_string_box",
      name: isMicro ? "Kit Tronco / Conectores AC Microinversor + Aterramento" : "String Box CC 1000V c/ DPS Classe II + Chave Seccionadora",
      category: "Equipamentos CC",
      unit: "cj",
      quantity: isMicro ? 1 : Math.max(1, Math.ceil(stringsCount / 2)),
      unitPrice: isMicro ? 420 : 620,
    },
    {
      id: "eq_signage",
      name: "Kit Placas de Advertência Solar (NBR 16690) & Terminais",
      category: "Equipamentos CC",
      unit: "cj",
      quantity: 1,
      unitPrice: 180,
    },
  ];

  if (isHybrid && batteryKwh > 0) {
    items.push({
      id: "eq_battery",
      name: `Banco de Baterias Lítio LiFePO4 (${batteryKwh} kWh)`,
      category: "Armazenamento",
      unit: "kWh",
      quantity: batteryKwh,
      unitPrice: 2150,
    });
  }

  return items;
}

/**
 * Gera os itens padrão de Infraestrutura CA + Engenharia / Instalação / Homologação.
 */
export function buildDefaultSolarCaAndServiceItems({ project = {}, config = {}, sizing = {} } = {}) {
  const c = config || {};
  const s = sizing || {};
  const p = project || {};

  const panelCount = Math.max(1, Math.round(num(s.panelCount ?? c.requested_panel_count, 20)));
  const moduleWp = Math.max(100, num(c.module_wp, 550));
  const dcPowerKw = Math.max(0.5, num(s.dcPowerKw, (panelCount * moduleWp) / 1000));
  const supplyType = c.ac_supply_type || p.supply_type || "Bifásico";
  const isTri = /tri|3f|3p/i.test(String(supplyType));
  const acCurrent = num(s.acCurrent, (num(c.inverter_kw, 5) * 1000) / (num(c.ac_voltage, 220) * (isTri ? 1.732 * 0.92 : 0.92)));
  const breaker = Math.max(10, Math.round(num(s.breaker, acCurrent * 1.25)));
  const dpsQty = isTri ? 4 : 3;

  const caItems = [
    {
      id: "ca_qdc",
      name: "Quadro de Proteção CA (String Box CA) Sobrepor IP65",
      category: "Infraestrutura CA",
      unit: "un",
      quantity: 1,
      unitPrice: 340,
    },
    {
      id: "ca_breaker",
      name: `Disjuntor Termomagnético Curva C ${breaker}A (${isTri ? "3P" : "2P"})`,
      category: "Infraestrutura CA",
      unit: "un",
      quantity: 1,
      unitPrice: estimateBreakerPrice(breaker, isTri),
    },
    {
      id: "ca_dps",
      name: "DPS Classe II 275V / 40kA + Barramento & Terminais CA",
      category: "Infraestrutura CA",
      unit: "un",
      quantity: dpsQty,
      unitPrice: 68,
    },
    {
      id: "ca_cable",
      name: `Cabo Flexível EPR/PVC 750V (${breaker > 50 ? "16 mm²" : breaker > 32 ? "10 mm²" : "6 mm²"}) + Eletroduto`,
      category: "Infraestrutura CA",
      unit: "m",
      quantity: 20,
      unitPrice: breaker > 50 ? 24 : breaker > 32 ? 16.5 : 11.5,
    },
  ];

  const installationTotal = round2(Math.max(2400, dcPowerKw * 460));
  const engineeringTotal = round2(Math.max(1450, dcPowerKw * 145));

  const serviceItems = [
    {
      id: "sv_install",
      name: "Instalação Mecânica, Cabeamento CC/CA & Comissionamento",
      category: "Serviços & Instalação",
      unit: "kWp",
      quantity: round2(dcPowerKw),
      unitPrice: round2(installationTotal / dcPowerKw),
    },
    {
      id: "sv_engineering",
      name: "Projeto Executivo Elétrico, Memorial & Homologação Concessionária",
      category: "Engenharia & Homologação",
      unit: "sv",
      quantity: 1,
      unitPrice: engineeringTotal,
    },
    {
      id: "sv_art",
      name: "Emissão de ART CREA + Acompanhamento Vistoria & Monitoramento",
      category: "Engenharia & Homologação",
      unit: "sv",
      quantity: 1,
      unitPrice: 490,
    },
  ];

  return { caItems, serviceItems };
}

function normalizeBudgetItems(rawItems, defaultItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return defaultItems.map((item) => ({
      ...item,
      subtotal: round2(num(item.quantity, 0) * num(item.unitPrice, 0)),
    }));
  }

  return rawItems.map((item, idx) => {
    const qty = Math.max(0, num(item.quantity, 0));
    const price = Math.max(0, num(item.unitPrice, 0));
    return {
      id: item.id || `custom_${idx + 1}`,
      name: String(item.name || "Item"),
      category: String(item.category || "Geral"),
      unit: String(item.unit || "un"),
      quantity: qty,
      unitPrice: price,
      subtotal: round2(qty * price),
    };
  });
}

/**
 * Calcula Taxa Interna de Retorno (TIR) por busca binária estável em [-0.9, 5.0].
 */
export function computeInternalRateOfReturn(cashflows = []) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return 0;
  const npv = (rate) => cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);

  if (npv(0) <= 0) return 0;
  let low = 0.0001;
  let high = 4.0;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (npv(mid) > 0) low = mid;
    else high = mid;
  }
  return round2(((low + high) / 2) * 100);
}

/**
 * Calcula simulações de parcelamento (24x, 36x, 48x, 60x) por Tabela Price (PMT).
 */
export function computeSolarFinancingOptions(investmentBrl, monthlyRatePct = DEFAULT_FINANCIAL_PREMISES.financingMonthlyRatePct) {
  const pv = Math.max(0, num(investmentBrl, 0));
  const r = Math.max(0.0001, num(monthlyRatePct, 1.49) / 100);
  const terms = [24, 36, 48, 60];

  return terms.map((months) => {
    const factor = (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    const installmentBrl = round2(pv * factor);
    const totalFinancedBrl = round2(installmentBrl * months);
    return {
      optionLabel: `Opção ${terms.indexOf(months) + 1}`,
      months,
      entryBrl: 0,
      installmentBrl,
      totalFinancedBrl,
      monthlyRatePct: round2(r * 100),
    };
  });
}

/**
 * Análise financeira de 25 anos (Ano 0 a Ano 24), VPL, TIR, Payback, Rendimentos e Redução de Fatura.
 */
export function computeSolarFinancialAnalysis({
  investmentBrl = 0,
  annualGenerationKwh = 0,
  monthlyConsumptionKwh = 0,
  tariffBrlKwh = 0.95,
  premises = {},
} = {}) {
  const p = { ...DEFAULT_FINANCIAL_PREMISES, ...(premises || {}) };
  const inv = Math.max(1, num(investmentBrl, 0));
  const year1Kwh = Math.max(0, num(annualGenerationKwh, 0));
  const tariff = Math.max(0.1, num(tariffBrlKwh, 0.95));
  const monthlyConsKwh = Math.max(50, num(monthlyConsumptionKwh, year1Kwh > 0 ? year1Kwh / 12 : 500));

  const deg = Math.max(0, num(p.annualDegradationPct, 0.7) / 100);
  const inf = Math.max(0, num(p.tariffInflationPct, 5.5) / 100);
  const discRate = Math.max(0.001, num(p.discountRatePct, 8.5) / 100);
  const omPct = Math.max(0, num(p.annualMaintenancePct, 0.6) / 100);

  const beforeBillMonthlyBrl = round2(monthlyConsKwh * tariff + num(p.publicLightingBrl, 35));
  const minGridCostMonthlyBrl = round2(num(p.availabilityCostKwh, 50) * tariff + num(p.publicLightingBrl, 35));
  const grossGenMonthlySavingsBrl = round2((year1Kwh / 12) * tariff);
  const effectiveMonthlySavingsBrl = round2(Math.min(Math.max(0, beforeBillMonthlyBrl - minGridCostMonthlyBrl * 0.4), grossGenMonthlySavingsBrl));
  const afterBillMonthlyBrl = round2(Math.max(minGridCostMonthlyBrl, beforeBillMonthlyBrl - grossGenMonthlySavingsBrl));
  const reductionPct = beforeBillMonthlyBrl > 0
    ? round2(Math.min(96, Math.max(0, ((beforeBillMonthlyBrl - afterBillMonthlyBrl) / beforeBillMonthlyBrl) * 100)))
    : 0;

  const year1GrossSavingsBrl = round2(year1Kwh * tariff);
  const cashflowRows = [];
  const irrSeries = [-inv];

  let cumulativeBalance = -inv;
  let paybackYearsExact = null;
  let npvBrl = -inv;

  cashflowRows.push({
    year: 0,
    generationKwh: round2(year1Kwh),
    tariffBrl: round2(tariff),
    annualSavingsBrl: round2(year1GrossSavingsBrl),
    investmentBrl: round2(-inv),
    cumulativeBalanceBrl: round2(-inv),
  });

  // Ano 1..24 correspondem aos 24 ciclos operacionais seguintes (Total 25 linhas: Ano 0 .. Ano 24)
  for (let yr = 1; yr <= 24; yr += 1) {
    const genKwh = round2(year1Kwh * Math.pow(1 - deg, yr));
    const tarYr = round2(tariff * Math.pow(1 + inf, yr));
    const maintenanceBrl = inv * omPct;
    const annualSavings = round2(Math.max(0, genKwh * tarYr - maintenanceBrl));
    const prevBalance = cumulativeBalance;
    cumulativeBalance = round2(cumulativeBalance + annualSavings);

    if (paybackYearsExact === null && cumulativeBalance >= 0 && annualSavings > 0) {
      const fraction = Math.abs(prevBalance) / annualSavings;
      paybackYearsExact = round2((yr - 1) + fraction);
    }

    npvBrl += annualSavings / Math.pow(1 + discRate, yr);
    irrSeries.push(annualSavings);

    cashflowRows.push({
      year: yr,
      generationKwh: genKwh,
      tariffBrl: tarYr,
      annualSavingsBrl: annualSavings,
      investmentBrl: 0,
      cumulativeBalanceBrl: cumulativeBalance,
    });
  }

  // Fallback de payback se ultrapassar 24 anos
  if (paybackYearsExact === null) {
    paybackYearsExact = year1GrossSavingsBrl > 0 ? round2(inv / year1GrossSavingsBrl) : 0;
  }

  const tirPct = computeInternalRateOfReturn(irrSeries);
  const firstYearReturnPct = round2((year1GrossSavingsBrl / inv) * 100);
  const poupanca25Years = round2(inv * Math.pow(1 + num(p.poupancaYieldPct, 6.17) / 100, 25));
  const rendaFixa25Years = round2(inv * Math.pow(1 + num(p.rendaFixaYieldPct, 11.5) / 100, 25));
  const solar25YearsAccumulated = round2(cumulativeBalance);

  return {
    investmentBrl: round2(inv),
    year1GenerationKwh: round2(year1Kwh),
    year1SavingsBrl: year1GrossSavingsBrl,
    paybackYears: paybackYearsExact,
    paybackLabel: `${Math.floor(paybackYearsExact)} anos e ${Math.round((paybackYearsExact % 1) * 12)} meses`,
    npvBrl: round2(npvBrl),
    irrPct: tirPct,
    firstYearReturnPct,
    poupancaYieldPct: num(p.poupancaYieldPct, 6.17),
    rendaFixaYieldPct: num(p.rendaFixaYieldPct, 11.5),
    poupanca25Years,
    rendaFixa25Years,
    solar25YearsAccumulated,
    beforeBillMonthlyBrl,
    monthlySavingsBrl: effectiveMonthlySavingsBrl,
    afterBillMonthlyBrl,
    reductionPct,
    cashflowRows,
    financingOptions: computeSolarFinancingOptions(inv, p.financingMonthlyRatePct),
  };
}

/**
 * Orquestrador principal do Orçamento Solar Detalhado:
 * combina Preço do Equipamento (itens ou valor fechado do kit) + Infra CA + Serviços + Margem Solicitada (%) + Análise Financeira 25 anos.
 */
export function buildDetailedSolarBudget({ project = {}, config = {}, sizing = {} } = {}) {
  const c = config || {};
  const p = project || {};
  const s = sizing || {};
  const saved = c.solar_budget || p.solar_config?.solar_budget || {};

  const panelCount = Math.max(1, Math.round(num(s.panelCount ?? c.requested_panel_count, 20)));
  const moduleWp = Math.max(100, num(c.module_wp, 550));
  const dcPowerKw = Math.max(0.5, num(s.dcPowerKw, (panelCount * moduleWp) / 1000));

  const defaultEquip = buildDefaultSolarEquipmentItems({ project: p, config: c, sizing: s });
  const { caItems: defaultCa, serviceItems: defaultServices } = buildDefaultSolarCaAndServiceItems({
    project: p,
    config: c,
    sizing: s,
  });

  const equipmentItems = normalizeBudgetItems(saved.equipmentItems, defaultEquip);
  const caItems = normalizeBudgetItems(saved.caItems, defaultCa);
  const serviceItems = normalizeBudgetItems(saved.serviceItems, defaultServices);

  const itemizedEquipmentTotal = round2(equipmentItems.reduce((sum, i) => sum + i.subtotal, 0));
  const useKitTotalOverride = Boolean(saved.useKitTotalOverride);
  const kitTotalOverride = Math.max(0, num(saved.kitTotalOverride, itemizedEquipmentTotal));
  const equipmentTotal = useKitTotalOverride && kitTotalOverride > 0 ? round2(kitTotalOverride) : itemizedEquipmentTotal;

  const caTotal = round2(caItems.reduce((sum, i) => sum + i.subtotal, 0));
  const servicesTotal = round2(serviceItems.reduce((sum, i) => sum + i.subtotal, 0));
  const baseCostTotal = round2(equipmentTotal + caTotal + servicesTotal);

  const marginPercent = Math.max(0, Math.min(300, num(saved.marginPercent ?? c.margin_percent, 20)));
  const marginBrl = round2(baseCostTotal * (marginPercent / 100));
  const discountBrl = Math.max(0, num(saved.discountBrl, 0));

  const grossTotal = round2(baseCostTotal + marginBrl);
  const finalTotal = round2(Math.max(0, grossTotal - discountBrl));
  const pricePerWp = dcPowerKw > 0 ? round2(finalTotal / (dcPowerKw * 1000)) : 0;

  const annualGenerationKwh = num(s.annualGenerationKwh, dcPowerKw * 1380);
  const monthlyConsumptionKwh = num(
    p.consumption?.monthly_consumption_kwh ?? p.monthly_consumption_kwh ?? c.monthly_consumption_kwh,
    Math.round(annualGenerationKwh / 12)
  );
  const tariffBrlKwh = num(
    p.consumption?.tariff_brl_kwh ?? p.tariff_brl_kwh ?? c.tariff_brl_kwh,
    0.95
  );

  const financial = computeSolarFinancialAnalysis({
    investmentBrl: finalTotal,
    annualGenerationKwh,
    monthlyConsumptionKwh,
    tariffBrlKwh,
    premises: saved.financialPremises,
  });

  const validityDays = Math.max(1, Math.round(num(saved.validityDays, 15)));
  const commercialContact = {
    companyName: saved.commercialContact?.companyName || "NACIF ENERGY",
    responsibleName: saved.commercialContact?.responsibleName || p.technical_responsible?.name || p.technical_responsible_name || "Eng. Responsável NACIF",
    phone: saved.commercialContact?.phone || p.client_phone || "(21) 99999-0000",
    email: saved.commercialContact?.email || "contato@nacifenergy.com.br",
    address: saved.commercialContact?.address || [p.city, p.state].filter(Boolean).join(" - ") || "Rio de Janeiro - RJ",
    notes: saved.commercialContact?.notes || "Inclui projeto executivo, homologação na distribuidora, instalação completa e garantia.",
  };

  return {
    panelCount,
    moduleWp,
    dcPowerKw: round2(dcPowerKw),
    equipmentItems,
    caItems,
    serviceItems,
    itemizedEquipmentTotal,
    useKitTotalOverride,
    kitTotalOverride: round2(kitTotalOverride),
    equipmentTotal,
    caTotal,
    servicesTotal,
    baseCostTotal,
    marginPercent,
    marginBrl,
    discountBrl,
    grossTotal,
    finalTotal,
    pricePerWp,
    equipmentSharePct: finalTotal > 0 ? round2((equipmentTotal / finalTotal) * 100) : 0,
    caAndServicesSharePct: finalTotal > 0 ? round2(((caTotal + servicesTotal) / finalTotal) * 100) : 0,
    marginSharePct: finalTotal > 0 ? round2((marginBrl / finalTotal) * 100) : 0,
    validityDays,
    selectedPaymentOption: saved.selectedPaymentOption || "cash",
    commercialContact,
    financial,
  };
}
