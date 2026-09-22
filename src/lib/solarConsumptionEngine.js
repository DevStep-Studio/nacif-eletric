/**
 * solarConsumptionEngine.js — Motor centralizado de cálculo do histórico de consumo de energia
 *
 * Garante a Única Fonte da Verdade para:
 * 1. Consumo médio mensal (kWh/mês)
 * 2. Total do período / Total anual (kWh)
 * 3. Pico de consumo (kWh) e mês de ocorrência
 * 4. Abrangência e validação da sequência de meses
 * 5. Projeção anual quando o histórico for parcial (< 12 meses)
 */

export const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

/**
 * Normaliza um item do histórico de consumo mensal.
 */
export function normalizeHistoryItem(item, fallbackMonth = "Mês") {
  if (!item || typeof item !== "object") {
    return {
      month: fallbackMonth,
      kwh: null,
      value_brl: null,
      source: "manual",
      is_valid: false,
    };
  }

  const rawKwh = item.kwh !== undefined && item.kwh !== null && item.kwh !== "" ? Number(item.kwh) : null;
  const kwh = rawKwh !== null && Number.isFinite(rawKwh) && rawKwh >= 0 ? rawKwh : null;
  const rawVal = item.value_brl !== undefined && item.value_brl !== null && item.value_brl !== "" ? Number(item.value_brl) : null;
  const valueBrl = rawVal !== null && Number.isFinite(rawVal) && rawVal >= 0 ? rawVal : null;

  return {
    month: String(item.month || fallbackMonth).trim(),
    kwh,
    value_brl: valueBrl,
    source: item.source || "extracted",
    is_valid: kwh !== null,
  };
}

/**
 * Calcula todas as métricas a partir do array de histórico.
 * NUNCA inventa valores nem substitui histórico vazio por média artificial.
 */
export function computeConsumptionMetrics(history = [], manualAvgKwh = null) {
  const normalizedList = Array.isArray(history)
    ? history.map((item, idx) => normalizeHistoryItem(item, `Mês ${idx + 1}`))
    : [];

  const validEntries = normalizedList.filter((item) => item.kwh !== null && Number.isFinite(item.kwh) && item.kwh > 0);
  const validCount = validEntries.length;

  if (validCount === 0) {
    const fallback = manualAvgKwh !== null && manualAvgKwh !== undefined && manualAvgKwh !== ""
      ? Number(manualAvgKwh)
      : null;
    const hasManual = fallback !== null && Number.isFinite(fallback) && fallback > 0;

    return {
      hasHistory: false,
      validCount: 0,
      totalCount: normalizedList.length,
      totalKwh: 0,
      averageKwh: hasManual ? Math.round(fallback) : 0,
      peakKwh: 0,
      peakMonth: null,
      minKwh: 0,
      minMonth: null,
      isCompleteAnnual: false,
      periodRangeText: "Histórico não informado",
      totalLabel: "Total do período",
      projectedAnnualKwh: hasManual ? Math.round(fallback * 12) : 0,
      entries: normalizedList,
    };
  }

  const totalKwh = validEntries.reduce((sum, item) => sum + item.kwh, 0);
  const averageKwh = Math.round(totalKwh / validCount);

  // Pico e Mínimo
  let peakKwh = 0;
  let peakMonth = null;
  let minKwh = Infinity;
  let minMonth = null;

  validEntries.forEach((entry) => {
    if (entry.kwh > peakKwh) {
      peakKwh = entry.kwh;
      peakMonth = entry.month;
    }
    if (entry.kwh < minKwh) {
      minKwh = entry.kwh;
      minMonth = entry.month;
    }
  });

  if (minKwh === Infinity) minKwh = 0;

  const isCompleteAnnual = validCount === 12;
  const firstMonth = validEntries[0]?.month || "";
  const lastMonth = validEntries[validEntries.length - 1]?.month || "";
  const periodRangeText = validCount === 1
    ? firstMonth
    : `${firstMonth} a ${lastMonth} (${validCount} ${validCount === 1 ? "mês" : "meses"})`;

  const totalLabel = isCompleteAnnual ? "Total Anual" : `Total (${validCount} meses)`;
  const projectedAnnualKwh = isCompleteAnnual ? totalKwh : Math.round(averageKwh * 12);

  return {
    hasHistory: true,
    validCount,
    totalCount: normalizedList.length,
    totalKwh,
    averageKwh,
    peakKwh,
    peakMonth,
    minKwh,
    minMonth,
    isCompleteAnnual,
    periodRangeText,
    totalLabel,
    projectedAnnualKwh,
    entries: normalizedList,
  };
}

/**
 * Gera uma lista de 12 meses cronológicos de referência (ex: últimos 12 meses até o mês anterior),
 * mesclando com os dados existentes que o usuário já informou ou extraiu.
 */
export function buildDefault12MonthTimeline(existingHistory = []) {
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  const timeline = [];
  for (let i = 11; i >= 0; i--) {
    let mIdx = currentMonthIdx - i;
    let year = currentYear;
    while (mIdx < 0) {
      mIdx += 12;
      year -= 1;
    }
    const shortName = MONTH_NAMES_SHORT[mIdx];
    const yrShort = String(year).slice(-2);
    const monthLabel = `${shortName}/${yrShort}`;

    // Procura registro existente correspondente
    const found = Array.isArray(existingHistory)
      ? existingHistory.find((item) => item && String(item.month || "").toLowerCase().includes(shortName.toLowerCase()))
      : null;

    timeline.push({
      month: monthLabel,
      kwh: found && found.kwh !== undefined && found.kwh !== null && found.kwh !== "" ? Number(found.kwh) : null,
      value_brl: found && found.value_brl !== undefined && found.value_brl !== null ? Number(found.value_brl) : null,
      source: found ? (found.source || "extracted") : "manual",
      is_valid: Boolean(found && found.kwh !== null && found.kwh !== undefined && Number(found.kwh) > 0),
    });
  }

  return timeline;
}
