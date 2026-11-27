import { auditProjectNBR5410, calcProjectMetrics } from "@/lib/electricalEngine";
import { buildProjectBudgetMaterials } from "@/lib/projectBudgetMaterials";
import { getProjectProgress } from "@/lib/projectProgress";
import { DEFAULT_SIZING_PREMISES, estimateAnnualGenerationKwh } from "@/lib/solarSizing";

/**
 * Fator médio de emissão de CO₂ do Sistema Interligado Nacional (SIN) — Brasil (referência MCTI).
 * Utilizado exclusivamente quando há geração solar fotovoltaica ou eficiência calculada no projeto.
 */
export const BR_SIN_CO2_KG_PER_KWH = 0.0385;
/** Sequestro anual médio de referência por árvore adulta em projetos de compensação (~15,5 kg CO₂/ano). */
export const KG_CO2_PER_TREE_YEAR = 15.5;

export const normalizeProjectText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function getProjectTimestamp(project) {
  const raw =
    project?.updated_date ||
    project?.updated_at ||
    project?.created_date ||
    project?.created_at;
  if (!raw) return null;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatShortProjectDate(project) {
  const ts = getProjectTimestamp(project);
  if (!ts) return "Sem data";
  return new Date(ts)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .replace(/\./g, "");
}

export function isProjectCompleted(project) {
  const s = normalizeProjectText(project?.status);
  return ["concluido", "concluidos", "aprovado", "finalizado", "entregue"].includes(s);
}

export function isProjectArchived(project) {
  const s = normalizeProjectText(project?.status);
  return ["arquivado", "cancelado"].includes(s);
}

export function isSolarTypedProject(project) {
  return (
    normalizeProjectText(project?.project_type).includes("solar") ||
    normalizeProjectText(project?.name).includes("solar") ||
    Number(project?.solar_power_kwp || 0) > 0 ||
    Number(project?.solar_config?.installed_kwp || 0) > 0 ||
    Number(project?.solar_sizing?.installedKwp || 0) > 0 ||
    Number(project?.solar_config?.dc_power_kw || 0) > 0 ||
    Number(project?.solar_config?.system_size_kw || 0) > 0 ||
    Boolean(project?.solar_config && Object.keys(project.solar_config).length > 0)
  );
}

export function resolveProjectVoltageLabel(project) {
  if (!project) return "220 V";
  const rawVoltage = Number(project.voltage || project.system_voltage || project.nominal_voltage || 0);
  if (rawVoltage > 0) return `${rawVoltage} V`;
  const supply = normalizeProjectText(project.supply_type);
  if (supply.includes("trif")) return "220/380 V";
  if (supply.includes("127") && !supply.includes("220")) return "127 V";
  return "220 V";
}

export function resolveInstallationTypeLabel(project) {
  if (!project) return "Instalação elétrica";
  const type = String(project.project_type || project.building_type || "").trim();
  if (type) return type;
  return isSolarTypedProject(project) ? "Sistema fotovoltaico" : "Residência unifamiliar";
}

export function computeProjectMetricsSafe(project) {
  if (!project) return null;
  let metrics = null;
  try {
    metrics = calcProjectMetrics(project);
  } catch {
    metrics = null;
  }

  const isSolar = isSolarTypedProject(project);

  const circuits = Array.isArray(project.circuits) && project.circuits.length > 0
    ? project.circuits
    : Array.isArray(metrics?.circuits)
    ? metrics.circuits
    : [];
  const circuitsCount = circuits.length;

  const solarConfig = project.solar_config || {};
  const solarSizing = project.solar_sizing || {};

  // Extrair contagem de módulos/painéis solares de áreas ou parâmetros
  const areas = Array.isArray(solarConfig.areas)
    ? solarConfig.areas
    : Array.isArray(project.roof_areas)
    ? project.roof_areas
    : Array.isArray(project.solar_areas)
    ? project.solar_areas
    : [];
  const solarPanelsCount =
    Number(solarSizing.panelCount) ||
    Number(solarConfig.total_panels) ||
    Number(solarConfig.requested_panel_count) ||
    areas.reduce((sum, a) => sum + (Number(a.panelCount) || Number(a.panelPolygons?.length) || Number(a.panels?.length) || 0), 0) ||
    0;

  const moduleWp = Number(solarConfig.module_wp || project.module_wp || 550);
  const derivedKwpFromPanels = solarPanelsCount > 0 ? (solarPanelsCount * moduleWp) / 1000 : 0;

  const solarKwp =
    Number(project.solar_power_kwp) ||
    Number(solarSizing.installedKwp) ||
    Number(solarSizing.systemSizeKwp) ||
    Number(solarSizing.dcPowerKw) ||
    Number(solarConfig.installed_kwp) ||
    Number(solarConfig.dc_power_kw) ||
    Number(solarConfig.system_size_kw) ||
    Number(solarConfig.system_power_kwp) ||
    Number(solarConfig.inverter_kw) ||
    derivedKwpFromPanels ||
    0;

  let installedPowerW =
    Number(metrics?.totalInstalledPower || metrics?.totalPower) ||
    Number(project.total_power_w) ||
    circuits.reduce((acc, c) => acc + Number(c?.power_w || 0), 0) ||
    0;

  let demandPowerW =
    Number(metrics?.totalDemandPower) ||
    Number(project.total_demand_w) ||
    (installedPowerW > 0 ? installedPowerW * 0.8 : 0);

  // Se for projeto solar e não possuir cargas CA cadastradas manualmente, reflete a potência do inversor/geração
  if (isSolar && demandPowerW === 0 && solarKwp > 0) {
    const inverterW = Math.round((Number(solarConfig.inverter_kw) || solarKwp) * 1000);
    installedPowerW = Math.round(solarKwp * 1000);
    demandPowerW = inverterW;
  }

  const demandKva =
    Number(metrics?.totalDemandVa) > 0
      ? Number(metrics.totalDemandVa) / 1000
      : demandPowerW > 0
      ? (demandPowerW / 0.92) / 1000
      : installedPowerW / 1000;

  const explicitBudget = Number(
    project.budget_total ||
    project.total_budget ||
    project.investment_brl ||
    solarConfig?.solar_budget?.finalTotal ||
    0
  );
  let computedBudget = explicitBudget;
  if (
    !(computedBudget > 0) &&
    (circuitsCount > 0 || (Array.isArray(project.panel_boards) && project.panel_boards.length > 0) || project.solar_config)
  ) {
    try {
      computedBudget = Number(buildProjectBudgetMaterials(project)?.materialTotal || 0);
    } catch {
      computedBudget = 0;
    }
  }

  const explicitAnnualKwh =
    Number(project.solar_sizing?.annualGenerationKwh) ||
    Number(project.solar_config?.annual_generation_kwh) ||
    0;

  const annualGenerationKwh =
    explicitAnnualKwh > 0
      ? explicitAnnualKwh
      : solarKwp > 0
      ? estimateAnnualGenerationKwh(solarKwp, {
          dailyIrradiationHspKwhM2:
            Number(project.solar_config?.daily_irradiation_hsp) || DEFAULT_SIZING_PREMISES.dailyIrradiationHspKwhM2,
          performanceRatio:
            Number(project.solar_config?.performance_ratio) || DEFAULT_SIZING_PREMISES.performanceRatio,
        }) || 0
      : 0;

  const avoidedCo2KgYear = annualGenerationKwh > 0 ? Math.round(annualGenerationKwh * BR_SIN_CO2_KG_PER_KWH) : 0;
  const treesEquivalent = avoidedCo2KgYear > 0 ? Math.max(1, Math.round(avoidedCo2KgYear / KG_CO2_PER_TREE_YEAR)) : 0;

  let nbrAudit = metrics?.audit || null;
  if (!nbrAudit && circuitsCount > 0) {
    try {
      nbrAudit = auditProjectNBR5410(project, metrics || { circuits });
    } catch {
      nbrAudit = null;
    }
  }

  const progress = getProjectProgress(project);

  return {
    project,
    metrics,
    nbrAudit,
    progress,
    isSolar,
    circuitsCount,
    solarPanelsCount,
    installedPowerW,
    demandPowerW,
    demandKw: demandPowerW / 1000,
    demandKva,
    budgetTotal: computedBudget,
    budgetHasRealSource: computedBudget > 0,
    solarKwp,
    annualGenerationKwh,
    avoidedCo2KgYear,
    treesEquivalent,
    voltageLabel: resolveProjectVoltageLabel(project),
    installationTypeLabel: resolveInstallationTypeLabel(project),
    supplyLabel: project.supply_type || "Bifásico 220 V",
    updatedTimestamp: getProjectTimestamp(project),
  };
}

function calcPeriodComparison(currentSum, previousSum, hadPreviousSamples) {
  if (!hadPreviousSamples || !(previousSum > 0)) {
    return {
      hasComparison: false,
      pct: null,
      direction: "neutral",
      label: null,
    };
  }
  const pct = Math.round(((currentSum - previousSum) / previousSum) * 100);
  return {
    hasComparison: true,
    pct,
    direction: pct > 0 ? "up" : pct < 0 ? "down" : "neutral",
    label: `${pct > 0 ? "+" : ""}${pct}%`,
  };
}

export function buildDashboardAnalytics(projects = [], period = "30d", activeProjectId = null) {
  const now = Date.now();
  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : Infinity;

  const enriched = (Array.isArray(projects) ? projects : []).map((project) => computeProjectMetricsSafe(project)).filter(Boolean);

  const inCurrentPeriod = enriched.filter((item) => {
    if (periodDays === Infinity) return true;
    if (!item.updatedTimestamp) return false;
    const daysAgo = Math.max(0, (now - item.updatedTimestamp) / 86400000);
    return daysAgo <= periodDays;
  });

  const inPreviousPeriod = periodDays === Infinity
    ? []
    : enriched.filter((item) => {
        if (!item.updatedTimestamp) return false;
        const daysAgo = Math.max(0, (now - item.updatedTimestamp) / 86400000);
        return daysAgo > periodDays && daysAgo <= periodDays * 2;
      });

  // Fallback para KPIs globais caso todos os projetos não tenham timestamp dentro da janela, mantendo filtro real para série
  const kpiSource = inCurrentPeriod.length > 0 || periodDays === Infinity ? inCurrentPeriod : [];

  const sumDemandKw = kpiSource.reduce((acc, item) => acc + item.demandKw, 0);
  const sumInstalledKw = kpiSource.reduce((acc, item) => acc + item.installedPowerW / 1000, 0);
  const sumDemandKva = kpiSource.reduce((acc, item) => acc + item.demandKva, 0);
  const sumCircuits = kpiSource.reduce((acc, item) => acc + item.circuitsCount, 0);
  const sumBudget = kpiSource.reduce((acc, item) => acc + item.budgetTotal, 0);
  const activeCount = kpiSource.filter((item) => !isProjectCompleted(item.project) && !isProjectArchived(item.project)).length;

  const prevDemandKw = inPreviousPeriod.reduce((acc, item) => acc + item.demandKw, 0);
  const prevDemandKva = inPreviousPeriod.reduce((acc, item) => acc + item.demandKva, 0);
  const prevCircuits = inPreviousPeriod.reduce((acc, item) => acc + item.circuitsCount, 0);
  const prevBudget = inPreviousPeriod.reduce((acc, item) => acc + item.budgetTotal, 0);
  const prevActiveCount = inPreviousPeriod.filter((item) => !isProjectCompleted(item.project) && !isProjectArchived(item.project)).length;
  const hasPrevSamples = inPreviousPeriod.length > 0;

  let nbrErrorCount = 0;
  let nbrWarnCount = 0;
  enriched.forEach((item) => {
    const validations = item.metrics?.validations || [];
    nbrErrorCount += validations.filter((v) => v.severity === "error").length;
    nbrWarnCount += validations.filter((v) => v.severity === "warning").length;
  });

  // Agrupamento temporal por DIA ÚNICO para o eixo X (elimina repetições de datas)
  const chartItems = [...kpiSource].sort((a, b) => (a.updatedTimestamp || 0) - (b.updatedTimestamp || 0));
  const dailyMap = new Map();

  chartItems.forEach((item) => {
    const ts = item.updatedTimestamp;
    let dayKey;
    let dateLabel;
    let fullDateLabel;

    if (ts) {
      const d = new Date(ts);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dayKey = `${year}-${month}-${day}`;
      dateLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(/\./g, "");
      fullDateLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } else {
      dayKey = "sem-data";
      dateLabel = "Sem data";
      fullDateLabel = "Data não informada";
    }

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, {
        dayKey,
        date: dateLabel,
        fullDate: fullDateLabel,
        timestamp: ts || 0,
        projects: [],
        powerKva: 0,
        powerKw: 0,
        demandKw: 0,
        budget: 0,
        circuits: 0,
      });
    }

    const group = dailyMap.get(dayKey);
    group.projects.push(item);
    group.powerKva += item.demandKva;
    group.powerKw += item.demandKw;
    group.demandKw += item.demandKw;
    group.budget += item.budgetTotal;
    group.circuits += item.circuitsCount;
  });

  const series = Array.from(dailyMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((g) => ({
      id: g.dayKey,
      date: g.date,
      fullDate: g.fullDate,
      name:
        g.projects.length === 1
          ? g.projects[0].project.name || "Projeto"
          : `${g.projects.length} projetos (${g.projects.map((p) => p.project.name || "Projeto").slice(0, 2).join(", ")}${g.projects.length > 2 ? "..." : ""})`,
      projectCount: g.projects.length,
      circuits: g.circuits,
      powerKva: Math.round(g.powerKva * 10) / 10,
      powerKw: Math.round(g.powerKw * 10) / 10,
      demandKw: Math.round(g.demandKw * 10) / 10,
      budget: Math.round(g.budget),
    }));

  const maxKvaIndex = series.reduce((bestIdx, curr, idx, arr) => (curr.powerKva >= (arr[bestIdx]?.powerKva ?? -1) ? idx : bestIdx), 0);

  const hasBudgetData = chartItems.some((item) => item.budgetHasRealSource);
  const demandItems = chartItems.filter((item) => item.demandKw > 0);
  const budgetItems = chartItems.filter((item) => item.budgetHasRealSource);
  const avgDemandKw =
    demandItems.length > 0
      ? Math.round((sumDemandKw / demandItems.length) * 10) / 10
      : 0;
  const avgBudget =
    budgetItems.length > 0
      ? Math.round(sumBudget / budgetItems.length)
      : 0;

  // Sustentabilidade (estritamente condicional à existência de dados solares/eficiência reais)
  const solarProjects = enriched.filter((item) => item.solarKwp > 0 && item.annualGenerationKwh > 0);
  const totalSolarKwp = solarProjects.reduce((acc, item) => acc + item.solarKwp, 0);
  const totalAnnualGenerationKwh = solarProjects.reduce((acc, item) => acc + item.annualGenerationKwh, 0);
  const totalAvoidedCo2KgYear = solarProjects.reduce((acc, item) => acc + item.avoidedCo2KgYear, 0);
  const totalTreesEquivalent = solarProjects.reduce((acc, item) => acc + item.treesEquivalent, 0);

  // Projeto em destaque: prioriza projeto ativo selecionado; caso não haja, prioriza projeto em andamento com dados de engenharia
  const featuredItem =
    (activeProjectId ? enriched.find((item) => item.project.id === activeProjectId) : null) ||
    enriched.find((item) => (item.circuitsCount > 0 || item.solarKwp > 0 || item.demandKw > 0) && !isProjectCompleted(item.project) && !isProjectArchived(item.project)) ||
    enriched.find((item) => !isProjectCompleted(item.project) && !isProjectArchived(item.project)) ||
    enriched[0] ||
    null;

  return {
    enriched,
    periodProjects: kpiSource.map((item) => item.project),
    periodProjectsCount: kpiSource.length,
    featuredItem,
    kpis: {
      demandKw: Math.round(sumDemandKw * 10) / 10,
      installedKw: Math.round(sumInstalledKw * 10) / 10,
      demandKva: Math.round(sumDemandKva * 10) / 10,
      circuits: sumCircuits,
      activeProjects: activeCount,
      totalProjects: kpiSource.length,
      budgetTotal: sumBudget,
      hasBudgetData,
      nbrErrorCount,
      nbrWarnCount,
      deltas: {
        demandKw: calcPeriodComparison(sumDemandKw, prevDemandKw, hasPrevSamples),
        circuits: calcPeriodComparison(sumCircuits, prevCircuits, hasPrevSamples),
        activeProjects: calcPeriodComparison(activeCount, prevActiveCount, hasPrevSamples),
        budgetTotal: calcPeriodComparison(sumBudget, prevBudget, hasPrevSamples),
        demandKva: calcPeriodComparison(sumDemandKva, prevDemandKva, hasPrevSamples),
      },
    },
    charts: {
      isEmpty: series.length === 0,
      count: series.length,
      totalKva: Math.round(sumDemandKva * 10) / 10,
      totalKw: Math.round(sumDemandKw * 10) / 10,
      avgDemandKw,
      avgBudget,
      hasBudgetData,
      maxKvaIndex,
      series,
    },
    sustainability: {
      available: solarProjects.length > 0 && totalAvoidedCo2KgYear > 0,
      solarProjectsCount: solarProjects.length,
      totalSolarKwp: Math.round(totalSolarKwp * 10) / 10,
      annualGenerationKwh: Math.round(totalAnnualGenerationKwh),
      avoidedCo2KgYear: totalAvoidedCo2KgYear,
      treesEquivalent: totalTreesEquivalent,
      emissionFactorKgKwh: BR_SIN_CO2_KG_PER_KWH,
      methodologyNote:
        "Estimativa anual baseada na geração FV calculada multiplicada pelo fator médio do SIN brasileiro (0,0385 kg CO₂/kWh) e taxa média de absorção de 15,5 kg CO₂/árvore/ano.",
    },
  };
}
