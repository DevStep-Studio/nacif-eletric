/**
 * solarConsumptionEngine.js — Motor centralizado de cálculo e normalização do histórico de consumo
 *
 * Princípios Fundamentais:
 * 1. Única Fonte da Verdade para cálculos de consumo, médias, totais e picos.
 * 2. NUNCA inventa dados ou preenche períodos inexistentes com valores artificiais.
 * 3. Diferencia explicitamente:
 *    - Consumo 0 confirmado (ex: imóvel fechado) vs.
 *    - Mês não informado / ausente (null).
 * 4. Suporta múltiplos formatos de mês brasileiros (Jan/25, 01/2025, Janeiro/2025, etc.).
 */

export const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MONTH_SYNONYMS = {
  jan: 0, janeiro: 0, "01": 0, "1": 0,
  fev: 1, fevereiro: 1, feb: 1, "02": 1, "2": 1,
  mar: 2, marco: 2, março: 2, "03": 2, "3": 2,
  abr: 3, abril: 3, apr: 3, "04": 3, "4": 3,
  mai: 4, maio: 4, may: 4, "05": 4, "5": 4,
  jun: 5, junho: 5, "06": 5, "6": 5,
  jul: 6, julho: 6, "07": 6, "7": 6,
  ago: 7, agosto: 7, aug: 7, "08": 7, "8": 7,
  set: 8, setembro: 8, sep: 8, "09": 8, "9": 8,
  out: 9, outubro: 9, oct: 9, "10": 9,
  nov: 10, novembro: 10, "11": 10,
  dez: 11, dezembro: 11, dec: 11, "12": 11,
};

/**
 * Analisa uma string de mês/ano e retorna { monthIdx: 0..11, year: 2025, label: "Jan/25" } ou null.
 */
export function parseMonthYearString(str = "") {
  if (!str || typeof str !== "string") return null;
  const clean = str.trim().toLowerCase().replace(/[^\w\d\sáéíóúç/._-]/g, "");

  // Formato 1: "Jan/25", "Janeiro/2025", "01/25", "01/2025", "Jan-25", "Jan.25", "Jan 2025"
  const match = clean.match(/^([a-zçáéíóú]+|\d{1,2})[\/\s\-_.]?(\d{2,4})?$/i);
  if (!match) return null;

  const rawMonth = match[1];
  const rawYear = match[2];

  let monthIdx = -1;
  if (MONTH_SYNONYMS[rawMonth] !== undefined) {
    monthIdx = MONTH_SYNONYMS[rawMonth];
  } else {
    const foundIdx = MONTH_NAMES_SHORT.findIndex((m) => rawMonth.startsWith(m.toLowerCase()));
    if (foundIdx !== -1) monthIdx = foundIdx;
  }

  if (monthIdx < 0 || monthIdx > 11) return null;

  let year = null;
  if (rawYear) {
    year = rawYear.length === 2 ? 2000 + parseInt(rawYear, 10) : parseInt(rawYear, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) year = null;
  }

  const shortName = MONTH_NAMES_SHORT[monthIdx];
  const yrShort = year ? String(year).slice(-2) : "";
  const label = yrShort ? `${shortName}/${yrShort}` : shortName;

  return { monthIdx, year, label, shortName };
}

/**
 * Normaliza um item de histórico de consumo.
 */
export function normalizeHistoryItem(item, fallbackLabel = "Mês") {
  if (!item || typeof item !== "object") {
    return {
      month: fallbackLabel,
      kwh: null,
      value_brl: null,
      source: "manual",
      is_valid: false,
      is_zero: false,
    };
  }

  const rawKwh = item.kwh !== undefined && item.kwh !== null && item.kwh !== "" ? Number(item.kwh) : null;
  const isKwhNumeric = rawKwh !== null && Number.isFinite(rawKwh) && rawKwh >= 0;
  const kwh = isKwhNumeric ? rawKwh : null;

  const rawVal = item.value_brl !== undefined && item.value_brl !== null && item.value_brl !== "" ? Number(item.value_brl) : null;
  const valueBrl = rawVal !== null && Number.isFinite(rawVal) && rawVal >= 0 ? rawVal : null;

  const parsed = parseMonthYearString(String(item.month || ""));
  const month = parsed?.label || String(item.month || fallbackLabel).trim();

  return {
    month,
    kwh,
    value_brl: valueBrl,
    source: item.source || (kwh !== null ? "extracted" : "manual"),
    is_valid: kwh !== null,
    is_zero: kwh === 0,
  };
}

/**
 * Motor centralizado de cálculo de métricas de consumo.
 * Fonte Única da Verdade para Step 1, Modal, Step 2 e Dimensionamento.
 */
export function computeConsumptionMetrics(history = [], manualAvgKwh = null) {
  const normalizedList = Array.isArray(history)
    ? history.map((item, idx) => normalizeHistoryItem(item, `Mês ${idx + 1}`))
    : [];

  // Considera meses válidos aqueles que possuem número informado (kwh >= 0)
  const validEntries = normalizedList.filter((item) => item.kwh !== null && Number.isFinite(item.kwh) && item.kwh >= 0);
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

  // Soma de todos os consumos válidos
  const totalKwh = validEntries.reduce((sum, item) => sum + item.kwh, 0);
  const averageKwh = validCount > 0 ? Math.round(totalKwh / validCount) : 0;

  // Determina Pico e Mínimo
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
 * Constrói e alinha uma linha do tempo de 12 meses cronológicos de referência,
 * pareando com precisão os dados extraídos ou informados pelo usuário.
 */
export function buildDefault12MonthTimeline(existingHistory = []) {
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  // Cria os 12 meses anteriores
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

    timeline.push({
      targetMonthIdx: mIdx,
      targetYear: year,
      month: monthLabel,
      kwh: null,
      value_brl: null,
      source: "manual",
      is_valid: false,
    });
  }

  // Se já temos um histórico de entrada, pareia de forma inteligente
  if (Array.isArray(existingHistory) && existingHistory.length > 0) {
    // 1. Se já forem exatamente 12 itens ordenados, preserva com normalização
    if (existingHistory.length === 12 && existingHistory.every((h) => h && h.month)) {
      return existingHistory.map((item, idx) => normalizeHistoryItem(item, timeline[idx]?.month || `Mês ${idx + 1}`));
    }

    // 2. Pareamento flexível por parsing de mês/ano
    const matchedHistory = timeline.map((slot) => {
      // Procura no histórico existente por mês correspondente
      const found = existingHistory.find((item) => {
        if (!item || !item.month) return false;
        const parsed = parseMonthYearString(String(item.month));
        if (parsed) {
          if (parsed.monthIdx === slot.targetMonthIdx) {
            if (!parsed.year || parsed.year === slot.targetYear) return true;
          }
        }
        // Fallback para match de substring no nome do mês
        const sName = slot.month.split("/")[0].toLowerCase();
        return String(item.month).toLowerCase().includes(sName);
      });

      if (found) {
        const rawKwh = found.kwh !== undefined && found.kwh !== null && found.kwh !== "" ? Number(found.kwh) : null;
        const hasKwh = rawKwh !== null && Number.isFinite(rawKwh) && rawKwh >= 0;
        return {
          month: slot.month,
          kwh: hasKwh ? rawKwh : null,
          value_brl: found.value_brl ? Number(found.value_brl) : null,
          source: found.source || "extracted",
          is_valid: hasKwh,
        };
      }

      return slot;
    });

    return matchedHistory;
  }

  return timeline;
}
