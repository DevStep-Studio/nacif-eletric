/**
 * solarBillExtractor.js — Motor inteligente de extração e validação de contas de energia elétrica
 *
 * Suporta distribuidoras brasileiras:
 * Enel, Light, Cemig, CPFL, Equatorial, Neoenergia, Energisa, Copel, Celesc, RGE e padrão ANEEL.
 *
 * Princípio fundamental: NUNCA inventa dados. Extrai apenas o que existe no documento
 * e classifica o nível de confiabilidade de cada informação.
 */

import { computeConsumptionMetrics, MONTH_NAMES_SHORT } from "./solarConsumptionEngine.js";

export const SUPPORTED_DISTRIBUTORS = [
  { key: "enel_sp", name: "Enel SP", state: "SP", regex: /\b(enel|eletropaulo)\b/i },
  { key: "enel_rj", name: "Enel RJ", state: "RJ", regex: /\b(enel\s+rio|ampla)\b/i },
  { key: "enel_ce", name: "Enel Ceará", state: "CE", regex: /\b(enel\s+cear[aá]|coelce)\b/i },
  { key: "light", name: "Light", state: "RJ", regex: /\blight\s+(servi[çc]os|energia)?\b/i },
  { key: "cemig", name: "Cemig", state: "MG", regex: /\bcemig\b/i },
  { key: "cpfl_paulista", name: "CPFL Paulista", state: "SP", regex: /\bcpfl\s+paulista\b/i },
  { key: "cpfl", name: "CPFL Energia", state: "SP", regex: /\bcpfl\b/i },
  { key: "neoenergia_coelba", name: "Neoenergia Coelba", state: "BA", regex: /\b(neoenergia\s+coelba|coelba)\b/i },
  { key: "neoenergia_elektro", name: "Neoenergia Elektro", state: "SP", regex: /\b(neoenergia\s+elektro|elektro)\b/i },
  { key: "neoenergia_brasilia", name: "Neoenergia Brasília", state: "DF", regex: /\b(neoenergia\s+bras[ií]lia|ceb)\b/i },
  { key: "equatorial_pa", name: "Equatorial Pará", state: "PA", regex: /\b(equatorial\s+par[aá]|celpa)\b/i },
  { key: "equatorial_ma", name: "Equatorial Maranhão", state: "MA", regex: /\b(equatorial\s+maranh[aã]o|cemar)\b/i },
  { key: "equatorial_go", name: "Equatorial Goiás", state: "GO", regex: /\b(equatorial\s+goi[aá]s|celg)\b/i },
  { key: "energisa", name: "Energisa", state: "", regex: /\benergisa\b/i },
  { key: "copel", name: "Copel", state: "PR", regex: /\bcopel\b/i },
  { key: "celesc", name: "Celesc", state: "SC", regex: /\bcelesc\b/i },
  { key: "rge", name: "RGE Sul", state: "RS", regex: /\brge(\s+sul)?\b/i },
];

/**
 * Identifica a distribuidora a partir do texto do documento.
 */
export function identifyDistributor(text = "") {
  const clean = String(text || "").toLowerCase();
  for (const dist of SUPPORTED_DISTRIBUTORS) {
    if (dist.regex.test(clean)) {
      return dist;
    }
  }
  return null;
}

/**
 * Identifica a classe tarifária a partir do texto.
 */
export function identifyTariffClass(text = "") {
  const clean = String(text || "").toUpperCase();
  if (/\b(B1|RESIDENCIAL)\b/.test(clean)) return "B1 - Residencial";
  if (/\b(B2|RURAL)\b/.test(clean)) return "B2 - Rural";
  if (/\b(B3|COMERCIAL|INDUSTRIAL|OUTROS)\b/.test(clean)) return "B3 - Comercial/Industrial (baixa tensão)";
  if (/\b(A4\s+VERDE|VERDE)\b/.test(clean)) return "A4 - Verde (média tensão)";
  if (/\b(A4\s+AZUL|AZUL)\b/.test(clean)) return "A4 - Azul (média tensão)";
  if (/\b(A4|M[EÉ]DIA\s+TENS[AÃ]O)\b/.test(clean)) return "A4 - Verde (média tensão)";
  return null;
}

/**
 * Extrai histórico de consumo mensal de strings tabulares.
 */
export function extractConsumptionHistoryFromText(text = "") {
  const history = [];
  const lines = String(text || "").split(/\r?\n/);

  // Padrões de meses comuns em faturas: JAN/25, JAN/2025, 01/2025, JANEIRO/2025
  const monthRegex = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[\/\s\-_.]?(\d{2,4})\b/i;
  const numRegex = /\b(\d{1,5}(?:[.,]\d{1,2})?)\b/g;

  lines.forEach((line) => {
    const match = line.match(monthRegex);
    if (match) {
      const rawMonth = match[1].toUpperCase();
      const rawYear = match[2];
      const yrShort = rawYear.length === 4 ? rawYear.slice(2) : rawYear;

      const normMonthName = MONTH_NAMES_SHORT.find(
        (m) => m.toUpperCase() === rawMonth || rawMonth.startsWith(m.toUpperCase().slice(0, 3))
      ) || rawMonth;
      const monthLabel = `${normMonthName}/${yrShort}`;

      // Extrai números da linha após o mês
      const numbers = [];
      let nMatch;
      while ((nMatch = numRegex.exec(line)) !== null) {
        const val = parseFloat(nMatch[1].replace(",", "."));
        if (Number.isFinite(val) && val > 0 && val < 50000) {
          numbers.push(val);
        }
      }

      // O maior número ou o primeiro número típico de kWh
      const plausibleKwh = numbers.find((n) => n >= 30 && n <= 25000) || numbers[0] || null;

      if (plausibleKwh !== null && !history.some((h) => h.month === monthLabel)) {
        history.push({
          month: monthLabel,
          kwh: Math.round(plausibleKwh),
          value_brl: null,
          source: "extracted",
          is_valid: true,
        });
      }
    }
  });

  return history;
}

/**
 * Validador e sanitizador de resultados da extração.
 */
export function sanitizeAndValidateBillResult(rawExtraction = {}) {
  const distributorObj = rawExtraction.distributor
    ? (typeof rawExtraction.distributor === "string"
        ? identifyDistributor(rawExtraction.distributor) || { name: rawExtraction.distributor }
        : rawExtraction.distributor)
    : null;

  const tariffClass = rawExtraction.tariff_class || null;
  const holderName = rawExtraction.holder_name?.trim() || null;
  const address = rawExtraction.address?.trim() || null;
  const installationCode = rawExtraction.installation_code?.trim() || null;

  // Demanda contratada: só aceita se for numérica, positiva e pertinente (comum em A4/B3, NUNCA imposta em B1)
  const rawDemand = rawExtraction.contracted_demand_kw !== undefined && rawExtraction.contracted_demand_kw !== null
    ? Number(rawExtraction.contracted_demand_kw)
    : null;
  const contractedDemandKw = rawDemand !== null && Number.isFinite(rawDemand) && rawDemand > 0 && tariffClass !== "B1 - Residencial"
    ? rawDemand
    : null;

  // Tarifa unitária em R$/kWh (valores típicos no Brasil: 0.50 a 1.60)
  const rawTariff = rawExtraction.tariff_brl_kwh !== undefined && rawExtraction.tariff_brl_kwh !== null
    ? Number(rawExtraction.tariff_brl_kwh)
    : null;
  const tariffBrlKwh = rawTariff !== null && Number.isFinite(rawTariff) && rawTariff >= 0.2 && rawTariff <= 3.0
    ? rawTariff
    : null;

  // Histórico de consumo
  const rawHistory = Array.isArray(rawExtraction.history_12_months) ? rawExtraction.history_12_months : [];
  const cleanHistory = rawHistory
    .filter((item) => item && typeof item === "object")
    .map((item, idx) => {
      const kwh = item.kwh !== undefined && item.kwh !== null && item.kwh !== "" ? Number(item.kwh) : null;
      return {
        month: String(item.month || `Mês ${idx + 1}`).trim(),
        kwh: kwh !== null && Number.isFinite(kwh) && kwh >= 0 ? kwh : null,
        value_brl: item.value_brl ? Number(item.value_brl) : null,
        source: "extracted",
        is_valid: kwh !== null && kwh > 0,
      };
    })
    .filter((item) => item.is_valid);

  const metrics = computeConsumptionMetrics(cleanHistory, rawExtraction.monthly_consumption_kwh);

  // Nível de confiabilidade
  let confidence = "high";
  const warnings = [];

  if (metrics.validCount === 0) {
    confidence = "none";
    warnings.push("Histórico de consumo não encontrado no documento.");
  } else if (metrics.validCount < 6) {
    confidence = "low";
    warnings.push(`Histórico parcial identificado (${metrics.validCount} meses). Recomenda-se completar os 12 meses.`);
  } else if (metrics.validCount < 12) {
    confidence = "medium";
    warnings.push(`Histórico com ${metrics.validCount} meses identificados.`);
  }

  return {
    success: metrics.validCount > 0 || Boolean(metrics.averageKwh > 0),
    confidence,
    distributor: distributorObj?.name || null,
    tariff_class: tariffClass,
    holder_name: holderName,
    address,
    installation_code: installationCode,
    contracted_demand_kw: contractedDemandKw,
    tariff_brl_kwh: tariffBrlKwh,
    monthly_consumption_kwh: metrics.averageKwh > 0 ? metrics.averageKwh : null,
    history_12_months: metrics.entries,
    metrics,
    warnings,
  };
}
