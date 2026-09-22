import { SOLAR_MODULE_HEIGHT_M, SOLAR_MODULE_WIDTH_M } from "./solarDesignerGeometry.js";

// Premissas padrão do dimensionamento preliminar. Todas são exibidas e editáveis
// na etapa "Projeto" do assistente — não são apresentadas como medições exatas.
export const DEFAULT_SIZING_PREMISES = {
  dailyIrradiationHspKwhM2: 4.8, // média Brasil (HSP - horas de sol pleno / dia)
  performanceRatio: 0.8, // perdas de sistema (cabos, temperatura, sujidade, inversor)
  areaUtilizationPct: 70, // % da área informada aproveitável após afastamentos/obstáculos
  gridSpacingLossPct: 12, // perda adicional por espaçamento entre fileiras (área/telhado)
  selfConsumptionCreditFactor: 0.9, // fator de valorização do excedente injetado na rede
  costPerWpBrl: 3.5, // custo estimado por Wp instalado, usado só quando o usuário não informar investimento
};

const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Opção 2 do cadastro: potência desejada -> quantidade de módulos.
 * quantidade = ceil(potência desejada / potência do módulo), recalculando a potência efetiva instalada.
 */
export function sizeFromDesiredPower(desiredKwp, moduleWp, {
  moduleWidthM = SOLAR_MODULE_WIDTH_M,
  moduleHeightM = SOLAR_MODULE_HEIGHT_M,
} = {}) {
  const wp = Math.max(1, asNumber(moduleWp, 550));
  const desiredW = Math.max(0, asNumber(desiredKwp, 0)) * 1000;
  const panelCount = wp > 0 ? Math.ceil(desiredW / wp) : 0;
  const installedKwp = (panelCount * wp) / 1000;
  const moduleArea = Math.max(0.1, asNumber(moduleWidthM, SOLAR_MODULE_WIDTH_M) * asNumber(moduleHeightM, SOLAR_MODULE_HEIGHT_M));
  const areaM2 = panelCount * moduleArea * 1.35; // estimativa de área com afastamentos
  return { panelCount, installedKwp, areaM2, moduleArea };
}

/**
 * Opção 3 do cadastro: área disponível -> capacidade preliminar.
 * Não faz apenas área_total / área_do_painel: aplica um fator de aproveitamento
 * que já responde por afastamentos, espaçamento entre fileiras e obstáculos.
 */
export function sizeFromAvailableArea(areaM2, {
  moduleWp = 550,
  moduleWidthM = SOLAR_MODULE_WIDTH_M,
  moduleHeightM = SOLAR_MODULE_HEIGHT_M,
  areaUtilizationPct = DEFAULT_SIZING_PREMISES.areaUtilizationPct,
  gridSpacingLossPct = DEFAULT_SIZING_PREMISES.gridSpacingLossPct,
} = {}) {
  const totalArea = Math.max(0, asNumber(areaM2, 0));
  const moduleArea = Math.max(0.1, asNumber(moduleWidthM, SOLAR_MODULE_WIDTH_M) * asNumber(moduleHeightM, SOLAR_MODULE_HEIGHT_M));
  const usableFraction = clamp(asNumber(areaUtilizationPct, 70), 10, 95) / 100;
  const spacingFraction = 1 - clamp(asNumber(gridSpacingLossPct, 12), 0, 40) / 100;
  const effectiveArea = totalArea * usableFraction * spacingFraction;
  const panelCount = Math.max(0, Math.floor(effectiveArea / moduleArea));
  const installedKwp = (panelCount * Math.max(1, asNumber(moduleWp, 550))) / 1000;

  return { panelCount, installedKwp, areaM2: totalArea, effectiveArea, moduleArea };
}

/**
 * Geração anual estimada a partir da potência instalada e da irradiação (HSP/dia).
 * Retorna null (pendente) quando faltar potência instalada.
 */
export function estimateAnnualGenerationKwh(installedKwp, {
  dailyIrradiationHspKwhM2 = DEFAULT_SIZING_PREMISES.dailyIrradiationHspKwhM2,
  performanceRatio = DEFAULT_SIZING_PREMISES.performanceRatio,
} = {}) {
  const kwp = Math.max(0, asNumber(installedKwp, 0));
  if (kwp <= 0) return null;
  const hsp = Math.max(0, asNumber(dailyIrradiationHspKwhM2, DEFAULT_SIZING_PREMISES.dailyIrradiationHspKwhM2));
  const pr = clamp(asNumber(performanceRatio, DEFAULT_SIZING_PREMISES.performanceRatio), 0.4, 1);
  return kwp * hsp * 365 * pr;
}

/**
 * Economia anual estimada: consumo mensal + tarifa são obrigatórios.
 * Retorna null (pendente) quando faltar geração, consumo ou tarifa.
 */
export function estimateAnnualSavingsBrl(annualGenerationKwh, monthlyConsumptionKwh, tariffBrlPerKwh, {
  selfConsumptionCreditFactor = DEFAULT_SIZING_PREMISES.selfConsumptionCreditFactor,
} = {}) {
  const generation = asNumber(annualGenerationKwh, NaN);
  const consumption = asNumber(monthlyConsumptionKwh, NaN) * 12;
  const tariff = asNumber(tariffBrlPerKwh, NaN);
  if (!Number.isFinite(generation) || !Number.isFinite(consumption) || !Number.isFinite(tariff) || generation <= 0 || consumption <= 0 || tariff <= 0) {
    return null;
  }

  const creditFactor = clamp(asNumber(selfConsumptionCreditFactor, DEFAULT_SIZING_PREMISES.selfConsumptionCreditFactor), 0, 1);
  const selfConsumed = Math.min(generation, consumption);
  const surplus = Math.max(0, generation - consumption);
  return selfConsumed * tariff + surplus * tariff * creditFactor;
}

/**
 * Payback simples: exige investimento (informado ou estimado por custo/Wp) e economia anual.
 */
export function estimateSimplePaybackYears(investmentBrl, annualSavingsBrl) {
  const investment = asNumber(investmentBrl, NaN);
  const savings = asNumber(annualSavingsBrl, NaN);
  if (!Number.isFinite(investment) || !Number.isFinite(savings) || investment <= 0 || savings <= 0) {
    return null;
  }
  return investment / savings;
}

export function estimateInvestmentBrl(installedKwp, costPerWpBrl = DEFAULT_SIZING_PREMISES.costPerWpBrl) {
  const kwp = Math.max(0, asNumber(installedKwp, 0));
  if (kwp <= 0) return null;
  return kwp * 1000 * Math.max(0.5, asNumber(costPerWpBrl, DEFAULT_SIZING_PREMISES.costPerWpBrl));
}

/**
 * Autonomia estimada do banco de baterias para as cargas prioritárias.
 * autonomia (h) = (capacidade_util) / potência_total_das_cargas
 * capacidade_util = capacidade_kwh * profundidade_descarga * eficiência
 * Retorna null quando faltar capacidade ou não houver cargas prioritárias com potência > 0.
 */
export function estimateBatteryAutonomyHours({
  capacityKwh,
  depthOfDischargePct = 80,
  efficiencyPct = 90,
  priorityLoadsW = [],
} = {}) {
  const capacity = asNumber(capacityKwh, NaN);
  const totalLoadW = (priorityLoadsW || []).reduce((sum, load) => sum + Math.max(0, asNumber(load, 0)), 0);
  if (!Number.isFinite(capacity) || capacity <= 0 || totalLoadW <= 0) return null;

  const dod = clamp(asNumber(depthOfDischargePct, 80), 10, 100) / 100;
  const efficiency = clamp(asNumber(efficiencyPct, 90), 30, 100) / 100;
  const usableKwh = capacity * dod * efficiency;
  return (usableKwh * 1000) / totalLoadW;
}

/**
 * Compila o painel de resultados instantâneos exibido no cadastro (seção 7 do briefing).
 * Cada valor vem acompanhado de um estado: "ok" | "pending" (dado essencial ausente).
 */
export function computeInstantResults({
  panelCount,
  moduleWp,
  monthlyConsumptionKwh,
  tariffBrlPerKwh,
  investmentBrl,
  premises = DEFAULT_SIZING_PREMISES,
} = {}) {
  const installedKwp = (Math.max(0, asNumber(panelCount, 0)) * Math.max(1, asNumber(moduleWp, 550))) / 1000;
  const annualGenerationKwh = estimateAnnualGenerationKwh(installedKwp, premises);
  const annualSavingsBrl = annualGenerationKwh === null
    ? null
    : estimateAnnualSavingsBrl(annualGenerationKwh, monthlyConsumptionKwh, tariffBrlPerKwh, premises);
  const effectiveInvestment = asNumber(investmentBrl, 0) > 0
    ? asNumber(investmentBrl, 0)
    : estimateInvestmentBrl(installedKwp, premises.costPerWpBrl);
  const paybackYears = annualSavingsBrl === null
    ? null
    : estimateSimplePaybackYears(effectiveInvestment, annualSavingsBrl);

  return {
    installedKwp,
    panelCount: Math.max(0, Math.round(asNumber(panelCount, 0))),
    annualGenerationKwh,
    annualSavingsBrl,
    effectiveInvestment,
    paybackYears,
    investmentIsEstimated: !(asNumber(investmentBrl, 0) > 0),
  };
}
