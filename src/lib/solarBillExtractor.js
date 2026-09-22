/**
 * solarBillExtractor.js — Motor inteligente de extração e validação de contas de energia elétrica
 *
 * Suporta distribuidoras brasileiras:
 * Enel, Light, Cemig, CPFL, Equatorial, Neoenergia, Energisa, Copel, Celesc, RGE e padrão ANEEL.
 *
 * Princípio fundamental: NUNCA inventa dados. Extrai apenas o que existe no documento
 * e classifica o nível de confiabilidade de cada informação.
 */

import { computeConsumptionMetrics, parseMonthYearString, MONTH_NAMES_SHORT } from "./solarConsumptionEngine.js";

export function normalizeSearchText(text = "") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const SUPPORTED_DISTRIBUTORS = [
  { key: "enel_sp", name: "Enel SP", state: "SP", regex: /\b(enel(\s+sao\s+paulo|\s+sp)?|eletropaulo)\b/i },
  { key: "enel_rj", name: "Enel RJ", state: "RJ", regex: /\b(enel(\s+rio|\s+rj)?|ampla)\b/i },
  { key: "enel_ce", name: "Enel Ceará", state: "CE", regex: /\b(enel(\s+ceara|\s+ce)?|coelce)\b/i },
  { key: "light", name: "Light", state: "RJ", regex: /\blight(\s+servicos|\s+energia|\s+s\.?a\.?)?\b/i },
  { key: "cemig", name: "Cemig", state: "MG", regex: /\bcemig(\s+distribuicao|\s+d)?\b/i },
  { key: "cpfl_paulista", name: "CPFL Paulista", state: "SP", regex: /\bcpfl\s+paulista\b/i },
  { key: "cpfl_piratininga", name: "CPFL Piratininga", state: "SP", regex: /\bcpfl\s+piratininga\b/i },
  { key: "cpfl_santa_cruz", name: "CPFL Santa Cruz", state: "SP", regex: /\bcpfl\s+santa\s+cruz\b/i },
  { key: "cpfl", name: "CPFL Energia", state: "SP", regex: /\bcpfl\b/i },
  { key: "neoenergia_coelba", name: "Neoenergia Coelba", state: "BA", regex: /\b(neoenergia\s+coelba|coelba)\b/i },
  { key: "neoenergia_elektro", name: "Neoenergia Elektro", state: "SP", regex: /\b(neoenergia\s+elektro|elektro)\b/i },
  { key: "neoenergia_brasilia", name: "Neoenergia Brasília", state: "DF", regex: /\b(neoenergia\s+brasilia|ceb(\s+distribuicao)?)\b/i },
  { key: "neoenergia_pe", name: "Neoenergia Pernambuco", state: "PE", regex: /\b(neoenergia\s+pernambuco|celpe)\b/i },
  { key: "neoenergia_cosern", name: "Neoenergia Cosern", state: "RN", regex: /\b(neoenergia\s+cosern|cosern)\b/i },
  { key: "equatorial_pa", name: "Equatorial Pará", state: "PA", regex: /\b(equatorial\s+para|celpa)\b/i },
  { key: "equatorial_ma", name: "Equatorial Maranhão", state: "MA", regex: /\b(equatorial\s+maranhao|cemar)\b/i },
  { key: "equatorial_go", name: "Equatorial Goiás", state: "GO", regex: /\b(equatorial\s+goias|celg)\b/i },
  { key: "equatorial_pi", name: "Equatorial Piauí", state: "PI", regex: /\b(equatorial\s+piaui|cepisa)\b/i },
  { key: "equatorial_al", name: "Equatorial Alagoas", state: "AL", regex: /\b(equatorial\s+alagoas|ceal)\b/i },
  { key: "energisa", name: "Energisa", state: "", regex: /\benergisa(\s+[a-z]+)?\b/i },
  { key: "copel", name: "Copel", state: "PR", regex: /\bcopel(\s+distribuicao)?\b/i },
  { key: "celesc", name: "Celesc", state: "SC", regex: /\bcelesc(\s+distribuicao)?\b/i },
  { key: "rge", name: "RGE Sul", state: "RS", regex: /\brge(\s+sul)?\b/i },
];

/**
 * Identifica a distribuidora a partir do texto do documento.
 */
export function identifyDistributor(text = "") {
  const clean = normalizeSearchText(text);
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
  const clean = normalizeSearchText(text).toUpperCase();
  if (/\b(B1|RESIDENCIAL)\b/.test(clean)) return "B1 - Residencial";
  if (/\b(B2|RURAL)\b/.test(clean)) return "B2 - Rural";
  if (/\b(B3|COMERCIAL|INDUSTRIAL\s+BT|OUTROS|PODER\s+PUBLICO)\b/.test(clean)) {
    return "B3 - Comercial/Industrial (baixa tensão)";
  }
  if (/\b(A4\s+VERDE|HORO-SAZONAL\s+VERDE|VERDE)\b/.test(clean)) return "A4 - Verde (média tensão)";
  if (/\b(A4\s+AZUL|HORO-SAZONAL\s+AZUL|AZUL)\b/.test(clean)) return "A4 - Azul (média tensão)";
  if (/\b(A4|MEDIA\s+TENSAO|GRUPO\s+A)\b/.test(clean)) return "A4 - Verde (média tensão)";
  return null;
}

/**
 * Identifica o tipo de fornecimento (Monofásico, Bifásico, Trifásico).
 */
export function identifySupplyType(text = "") {
  const clean = normalizeSearchText(text).toUpperCase();
  if (/\b(TRIFASIC[OA]|3\s*FAS|TRIF)\b/.test(clean)) return "Trifásico";
  if (/\b(BIFASIC[OA]|2\s*FAS|BIF)\b/.test(clean)) return "Bifásico";
  if (/\b(MONOFASIC[OA]|1\s*FAS|MONO)\b/.test(clean)) return "Monofásico";
  return null;
}

/**
 * Extrai dados textuais estruturados de um documento em texto puro.
 */
export function extractStructuredBillData(text = "") {
  if (!text || typeof text !== "string") return null;

  const distributor = identifyDistributor(text)?.name || null;
  const tariffClass = identifyTariffClass(text);
  const supplyType = identifySupplyType(text);

  // 1. Extração do Titular / Cliente
  let holderName = null;
  const namePatterns = [
    /(?:nome\s+do\s+cliente|titular|destinat[aá]rio|nome\s*\/\s*raz[aã]o\s+social)[:\s]+([^\r\n]{3,60})/i,
    /(?:cliente)[:\s]+([^\r\n]{3,60})/i,
  ];
  for (const pat of namePatterns) {
    const match = text.match(pat);
    if (match && match[1]?.trim().length > 3) {
      holderName = match[1].trim().replace(/\s{2,}/g, " ");
      break;
    }
  }

  // 2. Extração da Unidade Consumidora / Instalação
  let installationCode = null;
  const ucPatterns = [
    /(?:unidade\s+consumidora|n[uú]mero\s+da\s+instala[çc][aã]o|c[oó]digo\s+da\s+instala[çc][aã]o|c[oó]digo\s+[uú]nico|seu\s+c[oó]digo|matr[ií]cula)[:\s]+([0-9\/\-\.]{4,20})/i,
    /(?:instala[çc][aã]o|uc)[:\s]+([0-9\/\-\.]{4,20})/i,
  ];
  for (const pat of ucPatterns) {
    const match = text.match(pat);
    if (match && match[1]?.trim()) {
      installationCode = match[1].trim();
      break;
    }
  }

  // 3. Extração de Endereço e CEP
  let address = null;
  const addressPatterns = [
    /(?:endere[çc]o\s+da\s+instala[çc][aã]o|endere[çc]o\s+de\s+entrega|local\s+de\s+consumo)[:\s]+([^\n\r]{8,120})/i,
  ];
  for (const pat of addressPatterns) {
    const match = text.match(pat);
    if (match && match[1]?.trim()) {
      address = match[1].trim().replace(/\s{2,}/g, " ");
      break;
    }
  }

  // 4. Extração de Valores Financeiros e Vencimento
  let billTotalBrl = null;
  const totalMatch = text.match(/(?:total\s+a\s+pagar|valor\s+total|valor\s+a\s+pagar\s*r\$?)[:\s]*r?\$?\s*([0-9\.,]+)/i);
  if (totalMatch) {
    const parsed = parseFloat(totalMatch[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) billTotalBrl = parsed;
  }

  let dueDate = null;
  const dueMatch = text.match(/(?:vencimento|data\s+de\s+vencimento)[:\s]*(\d{2}\/\d{2}\/\d{4})/i);
  if (dueMatch) dueDate = dueMatch[1];

  let referenceDate = null;
  const refMatch = text.match(/(?:m[eê]s\s+de\s+refer[eê]ncia|refer[eê]ncia|m[eê]s\/ano)[:\s]*([a-z0-9\/\-_]+)/i);
  if (refMatch) referenceDate = refMatch[1].toUpperCase();

  // 5. Histórico de Consumo
  const history = extractConsumptionHistoryFromText(text);

  return {
    holder_name: holderName,
    distributor,
    installation_code: installationCode,
    address,
    tariff_class: tariffClass,
    supply_type: supplyType,
    bill_total_brl: billTotalBrl,
    due_date: dueDate,
    reference_date: referenceDate,
    history_12_months: history,
  };
}

/**
 * Extrai histórico de consumo mensal de texto ou tabelas de faturas brasileiras.
 */
export function extractConsumptionHistoryFromText(text = "") {
  const history = [];
  const lines = String(text || "").split(/\r?\n/);

  // Padrões de meses comuns em faturas: JAN/25, JAN/2025, 01/2025, JANEIRO/2025, JAN.25
  const monthRegex = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ|JANEIRO|FEVEREIRO|MAR[CÇ]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)[\/\s\-_.]?(\d{2,4})\b/i;
  const numRegex = /\b(\d{1,6}(?:[.,]\d{1,2})?)\b/g;

  lines.forEach((line) => {
    // Ignora linhas de cabeçalho, impostos, datas fiscais ou metadados de referência
    if (/cnpj|inscri[çc][aã]o|al[ií]quota|pis\/cofins|icms|refer[eê]ncia|vencimento|emiss[aã]o/i.test(line)) return;

    const match = line.match(monthRegex);
    if (match) {
      const parsedMonth = parseMonthYearString(`${match[1]}/${match[2]}`);
      if (!parsedMonth) return;

      const monthLabel = parsedMonth.label;

      // Extrai números da linha após o mês
      const numbers = [];
      let nMatch;
      while ((nMatch = numRegex.exec(line)) !== null) {
        const valStr = nMatch[1].includes(",")
          ? nMatch[1].replace(/\./g, "").replace(",", ".")
          : nMatch[1];
        const val = parseFloat(valStr);
        if (Number.isFinite(val) && val > 0 && val < 50000) {
          numbers.push(val);
        }
      }

      // Encontra um número plausível para kWh mensal residencial/comercial (10 a 25000 kWh)
      // Evita números pequenos como dias de faturamento (28, 29, 30, 31) se houver outro número maior
      const plausibleKwh = numbers.find((n) => n >= 32 && n <= 25000) || numbers.find((n) => n > 0 && n <= 50000) || null;

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

  // Ordena o histórico cronologicamente por ano e mês
  history.sort((a, b) => {
    const pa = parseMonthYearString(a.month);
    const pb = parseMonthYearString(b.month);
    if (pa && pb) {
      const ya = pa.year || 2025;
      const yb = pb.year || 2025;
      if (ya !== yb) return ya - yb;
      return pa.monthIdx - pb.monthIdx;
    }
    return 0;
  });

  return history;
}

/**
 * Validador e sanitizador de resultados da extração.
 * Aplica regras estritas contra números inventados e assegura consistência dos dados.
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
  const supplyType = rawExtraction.supply_type || null;

  // Demanda contratada: só aceita se for numérica, positiva e pertinente (comum em A4/B3, NUNCA imposta em B1)
  const isResidential = tariffClass === "B1 - Residencial" || (!tariffClass && rawExtraction.tariff_class === "B1");
  const rawDemand = rawExtraction.contracted_demand_kw !== undefined && rawExtraction.contracted_demand_kw !== null
    ? Number(rawExtraction.contracted_demand_kw)
    : null;

  const contractedDemandKw = !isResidential && rawDemand !== null && Number.isFinite(rawDemand) && rawDemand > 0
    ? rawDemand
    : null;

  // Tarifa unitária em R$/kWh (valores típicos no Brasil: 0.30 a 2.50)
  const rawTariff = rawExtraction.tariff_brl_kwh !== undefined && rawExtraction.tariff_brl_kwh !== null
    ? Number(rawExtraction.tariff_brl_kwh)
    : null;
  const tariffBrlKwh = rawTariff !== null && Number.isFinite(rawTariff) && rawTariff >= 0.2 && rawTariff <= 3.0
    ? rawTariff
    : null;

  // Valor total da fatura
  const rawTotalBrl = rawExtraction.bill_total_brl !== undefined && rawExtraction.bill_total_brl !== null
    ? Number(rawExtraction.bill_total_brl)
    : null;
  const billTotalBrl = rawTotalBrl !== null && Number.isFinite(rawTotalBrl) && rawTotalBrl > 0
    ? rawTotalBrl
    : null;

  // Histórico de consumo
  const rawHistory = Array.isArray(rawExtraction.history_12_months) ? rawExtraction.history_12_months : [];
  const cleanHistory = rawHistory
    .filter((item) => item && typeof item === "object")
    .map((item, idx) => {
      const kwh = item.kwh !== undefined && item.kwh !== null && item.kwh !== "" ? Number(item.kwh) : null;
      const isNum = kwh !== null && Number.isFinite(kwh) && kwh >= 0;
      return {
        month: String(item.month || `Mês ${idx + 1}`).trim(),
        kwh: isNum ? kwh : null,
        value_brl: item.value_brl ? Number(item.value_brl) : null,
        source: item.source || "extracted",
        is_valid: isNum && kwh > 0,
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
    supply_type: supplyType,
    holder_name: holderName,
    address,
    installation_code: installationCode,
    contracted_demand_kw: contractedDemandKw,
    tariff_brl_kwh: tariffBrlKwh,
    bill_total_brl: billTotalBrl,
    due_date: rawExtraction.due_date || null,
    reference_date: rawExtraction.reference_date || null,
    monthly_consumption_kwh: metrics.averageKwh > 0 ? metrics.averageKwh : null,
    history_12_months: metrics.entries,
    metrics,
    warnings,
  };
}
