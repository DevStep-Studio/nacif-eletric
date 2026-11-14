import { NACIF_LOGO_DARK_BASE64, NACIF_SYMBOL_BASE64 } from "./solarLogoAsset.js";

export const PDF_THEME = {
  navy: [14, 23, 38],         // #0E1726
  navySoft: [20, 34, 56],     // #142238
  blue: [13, 59, 130],        // #0D3B82
  blueLight: [239, 246, 255], // #EFF6FF
  teal: [0, 216, 184],        // #00D8B8
  tealDeep: [15, 79, 73],     // #0F4F49
  tealSoft: [236, 253, 245],  // #ECFDF5
  slate900: [15, 23, 42],
  slate700: [51, 65, 85],
  slate500: [100, 116, 139],
  slate300: [203, 213, 225],
  slate200: [226, 232, 240],
  slate100: [241, 245, 249],
  slate50: [248, 250, 252],
  white: [255, 255, 255],
  red: [220, 38, 38],
  redSoft: [254, 242, 242],
  amber: [217, 119, 6],
  amberSoft: [255, 251, 235],
  emerald: [22, 163, 74],
  emeraldSoft: [240, 253, 244],
  violet: [124, 58, 237],
};

export const PHASE_RGB = {
  A: [220, 38, 38],   // Vermelho (R)
  B: [37, 99, 235],   // Azul (S)
  C: [217, 119, 6],   // Âmbar (T)
  N: [0, 168, 150],   // Turquesa (N)
  PE: [22, 163, 74],  // Verde (PE)
  DEFAULT: [51, 65, 85],
};

const txt = (doc, value, x, y, opts = {}) => {
  if (Array.isArray(value)) {
    doc.text(value.map((v) => String(v ?? "")), x, y, opts);
    return;
  }
  doc.text(String(value ?? ""), x, y, opts);
};

const fmtNum = (val, digits = 1) => {
  const n = Number(val);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const feederGaugeByAmps = (current = 50) => {
  const table = [
    [32, 6], [50, 10], [70, 16], [100, 25], [150, 35],
    [200, 50], [250, 70], [320, 95], [380, 120], [460, 150],
  ];
  return (table.find(([lim]) => Number(current || 0) <= lim) || table[table.length - 1])[1];
};

const hexToRgb = (hex, fallback = PDF_THEME.teal) => {
  const clean = String(hex || "").replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b].every(Number.isFinite) ? [r, g, b] : fallback;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b].every(Number.isFinite) ? [r, g, b] : fallback;
  }
  return fallback;
};

/**
 * Título de seção padronizado NACIF Energy para documentos PDF
 */
export function drawPdfSectionTitle(doc, title, x, y, w, { accentColor = PDF_THEME.teal, rightBadge = "" } = {}) {
  doc.setFillColor(...PDF_THEME.slate100);
  doc.rect(x, y, w, 8.5, "F");
  doc.setFillColor(...accentColor);
  doc.rect(x, y, 2.2, 8.5, "F");
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, 8.5, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_THEME.navy);
  txt(doc, title, x + 5, y + 5.7);

  if (rightBadge) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...PDF_THEME.blue);
    txt(doc, rightBadge, x + w - 3, y + 5.6, { align: "right" });
  }
  return y + 11;
}

/**
 * Faixa horizontal de cartões KPI
 */
export function drawPdfKpiStrip(doc, items = [], x = 14, y = 30, w = 182, h = 21) {
  if (!items.length) return y;
  const gap = 3;
  const cardW = (w - gap * (items.length - 1)) / items.length;

  items.forEach((item, idx) => {
    const cx = x + idx * (cardW + gap);
    const isHighlight = Boolean(item.highlight);
    const accent = item.accent || (isHighlight ? PDF_THEME.teal : PDF_THEME.blue);

    doc.setFillColor(...(isHighlight ? PDF_THEME.navy : PDF_THEME.slate50));
    doc.setDrawColor(...(isHighlight ? PDF_THEME.teal : PDF_THEME.slate200));
    doc.setLineWidth(isHighlight ? 0.45 : 0.25);
    doc.rect(cx, y, cardW, h, "FD");

    doc.setFillColor(...accent);
    doc.rect(cx, y, cardW, 1.4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    doc.setTextColor(...(isHighlight ? PDF_THEME.teal : PDF_THEME.slate500));
    txt(doc, String(item.label || "").toUpperCase(), cx + 3, y + 6.2, { maxWidth: cardW - 6 });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(item.valueSize || 10.5);
    doc.setTextColor(...(isHighlight ? PDF_THEME.white : PDF_THEME.navy));
    txt(doc, item.value ?? "—", cx + 3, y + 12.8, { maxWidth: cardW - 6 });

    if (item.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(...(isHighlight ? PDF_THEME.slate300 : PDF_THEME.tealDeep));
      txt(doc, item.sub, cx + 3, y + 18.0, { maxWidth: cardW - 6 });
    }
  });

  return y + h + 4;
}

/**
 * Gráfico de barras vetorial em jsPDF (ex: Geração Mensal kWh ou Retorno Financeiro)
 */
export function drawVectorBarChart(doc, {
  x = 14,
  y = 56,
  w = 182,
  h = 56,
  title = "",
  subtitle = "",
  labels = [],
  values = [],
  barColor = PDF_THEME.teal,
  secondaryValues = null,
  secondaryColor = PDF_THEME.blue,
  valueFormatter = (v) => String(Math.round(v)),
} = {}) {
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "FD");

  // Header
  doc.setFillColor(...PDF_THEME.slate50);
  doc.rect(x, y, w, 9, "F");
  doc.line(x, y + 9, x + w, y + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.navy);
  txt(doc, title, x + 4, y + 6);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...PDF_THEME.slate500);
    txt(doc, subtitle, x + w - 4, y + 6, { align: "right" });
  }

  const plotX = x + 13;
  const plotY = y + 14;
  const plotW = w - 18;
  const plotH = h - 24;

  const allVals = [...values, ...(Array.isArray(secondaryValues) ? secondaryValues : [])].map((v) => Math.max(0, Number(v) || 0));
  const maxVal = Math.max(1, ...allVals) * 1.15;

  // Grid horizontal
  for (let g = 0; g <= 3; g++) {
    const gy = plotY + plotH - (plotH * g) / 3;
    doc.setDrawColor(232, 238, 245);
    doc.setLineWidth(0.2);
    doc.line(plotX, gy, plotX + plotW, gy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...PDF_THEME.slate500);
    const tickVal = (maxVal * g) / 3;
    txt(doc, valueFormatter(tickVal), plotX - 1.5, gy + 1.5, { align: "right" });
  }

  const n = Math.max(1, labels.length);
  const slotW = plotW / n;
  const hasSecondary = Array.isArray(secondaryValues) && secondaryValues.length === labels.length;
  const barW = hasSecondary ? Math.min(7, slotW * 0.34) : Math.min(10, slotW * 0.58);

  labels.forEach((lbl, idx) => {
    const val = Math.max(0, Number(values[idx]) || 0);
    const barH = (val / maxVal) * plotH;
    const cx = plotX + idx * slotW + slotW / 2;

    if (hasSecondary) {
      const val2 = Math.max(0, Number(secondaryValues[idx]) || 0);
      const bar2H = (val2 / maxVal) * plotH;
      doc.setFillColor(...barColor);
      doc.rect(cx - barW - 0.6, plotY + plotH - barH, barW, barH, "F");
      doc.setFillColor(...secondaryColor);
      doc.rect(cx + 0.6, plotY + plotH - bar2H, barW, bar2H, "F");
    } else {
      doc.setFillColor(...barColor);
      doc.rect(cx - barW / 2, plotY + plotH - barH, barW, barH, "F");
      if (barH > 2) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.4);
        doc.setTextColor(...PDF_THEME.navy);
        txt(doc, valueFormatter(val), cx, plotY + plotH - barH - 1.3, { align: "center" });
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_THEME.slate700);
    txt(doc, String(lbl).slice(0, 6), cx, plotY + plotH + 5, { align: "center" });
  });

  doc.setDrawColor(...PDF_THEME.slate300);
  doc.setLineWidth(0.3);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

  return y + h + 4;
}

/**
 * Símbolo IEC vetorial de Disjuntor Termomagnético
 */
function drawIecBreakerSymbol(doc, x, y, { width = 10, color = PDF_THEME.navy, horizontal = true } = {}) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.45);
  if (horizontal) {
    const mid = x + width / 2;
    doc.line(x, y, x + 2.2, y);
    doc.setFillColor(...PDF_THEME.white);
    doc.circle(x + 2.4, y, 0.7, "FD");
    doc.line(x + 2.4, y, mid + 2.4, y - 3.2);
    doc.line(mid + 2.4, y, x + width, y);
    doc.circle(mid + 2.4, y, 0.7, "FD");
    // Arco térmico/magnético no braço
    doc.setLineWidth(0.3);
    doc.line(x + 4.0, y - 1.6, x + 4.8, y - 2.6);
  } else {
    const mid = y + width / 2;
    doc.line(x, y, x, y + 2.2);
    doc.setFillColor(...PDF_THEME.white);
    doc.circle(x, y + 2.4, 0.7, "FD");
    doc.line(x, y + 2.4, x - 3.2, mid + 2.4);
    doc.line(x, mid + 2.4, x, y + width);
    doc.circle(x, mid + 2.4, 0.7, "FD");
  }
}

/**
 * Símbolo vetorial de Aterramento (PE / BEP)
 */
function drawGroundSymbol(doc, x, y, color = PDF_THEME.emerald) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.42);
  doc.line(x, y, x, y + 3.2);
  doc.line(x - 3.2, y + 3.2, x + 3.2, y + 3.2);
  doc.line(x - 2.1, y + 4.5, x + 2.1, y + 4.5);
  doc.line(x - 1.0, y + 5.8, x + 1.0, y + 5.8);
}

/**
 * Símbolo vetorial de DPS (Dispositivo de Proteção contra Surtos)
 */
function drawDpsSymbol(doc, x, y, w = 8, h = 11, color = PDF_THEME.amber) {
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h, "FD");
  // Seta interna para terra
  doc.line(x + w / 2, y + 1.5, x + w / 2, y + h - 2);
  doc.line(x + w / 2 - 1.4, y + h - 3.8, x + w / 2, y + h - 1.8);
  doc.line(x + w / 2 + 1.4, y + h - 3.8, x + w / 2, y + h - 1.8);
}

/**
 * Desenha o Diagrama Unifilar Elétrico do Quadro de Distribuição (ABNT NBR 5410)
 * inteiramente em vetor no jsPDF.
 */
export function drawElectricalUnifilarVector(
  doc,
  project = {},
  metrics = {},
  {
    x = 14,
    y = 30,
    w = 182,
    h = 205,
    startIndex = 0,
    maxCircuits = 18,
    sheetLabel = "",
  } = {}
) {
  const allCircuits = Array.isArray(metrics.circuits) ? metrics.circuits : [];
  const circuitsSlice = allCircuits.slice(startIndex, startIndex + maxCircuits);
  const supply = project.supply_type || "Trifásico";
  const hasTri = /tri/i.test(supply) || allCircuits.some((c) => /tri/i.test(c.supply_type) || String(c.phase || "").length >= 3);
  const hasBi = !hasTri && (/bi/i.test(supply) || allCircuits.some((c) => /bi/i.test(c.supply_type) || String(c.phase || "").length === 2));

  const phaseLabels = hasTri ? ["R", "S", "T", "N", "PE"] : hasBi ? ["R", "S", "N", "PE"] : ["F", "N", "PE"];
  const phaseCodes = hasTri ? ["A", "B", "C"] : hasBi ? ["A", "B"] : ["A"];
  const systemBadge = hasTri ? "3F+N+PE" : hasBi ? "2F+N+PE" : "F+N+PE";
  const voltage = project.voltage || 220;
  const generalBreaker = metrics.generalBreaker || 50;
  const generalPoles = metrics.generalBreakerPoles || (hasTri ? 3 : 2);
  const generalDr = metrics.generalDr || null;
  const feederGauge = feederGaugeByAmps(metrics.generalCurrent || generalBreaker);
  const peGauge = feederGauge <= 16 ? feederGauge : feederGauge <= 35 ? 16 : Math.round(feederGauge / 2);

  // Moldura principal do diagrama
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...PDF_THEME.slate300);
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h, "FD");

  // Barra de título do diagrama
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(x, y, w, 9.5, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(x, y, 2.5, 9.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, "DIAGRAMA UNIFILAR — QUADRO DE DISTRIBUIÇÃO (ABNT NBR 5410)", x + 5, y + 6.2);

  doc.setFontSize(7.2);
  doc.setTextColor(...PDF_THEME.teal);
  const rightMeta = sheetLabel
    ? `${systemBadge} · ${voltage}V · ${sheetLabel}`
    : `${systemBadge} · ${voltage}V · QDC ${(metrics.panelSize || 24)} DIN`;
  txt(doc, rightMeta, x + w - 4, y + 6.2, { align: "right" });

  // =========================================================================
  // FAIXA SUPERIOR: ALIMENTAÇÃO -> DISJUNTOR GERAL -> DPS -> IDR -> BARRAMENTO
  // =========================================================================
  const feedY = y + 21;
  const chainStartX = x + 6;

  // Bloco Entrada / Medidor
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.blue);
  doc.setLineWidth(0.4);
  doc.rect(chainStartX, feedY - 6, 30, 13, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF_THEME.blue);
  txt(doc, "ENTRADA / RAMAL", chainStartX + 15, feedY - 1.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...PDF_THEME.slate900);
  txt(doc, `${systemBadge} · ${voltage}V`, chainStartX + 15, feedY + 2.3, { align: "center" });
  txt(doc, `Cabo #${feederGauge}mm²`, chainStartX + 15, feedY + 5.6, { align: "center" });

  // Linha Entrada -> DJ Geral
  let curX = chainStartX + 30;
  doc.setDrawColor(...PDF_THEME.slate700);
  doc.setLineWidth(0.6);
  doc.line(curX, feedY, curX + 10, feedY);
  curX += 10;

  // Disjuntor Geral (Card + Símbolo IEC)
  doc.setFillColor(...PDF_THEME.blueLight);
  doc.setDrawColor(...PDF_THEME.blue);
  doc.setLineWidth(0.4);
  doc.rect(curX, feedY - 7, 36, 15, "FD");
  drawIecBreakerSymbol(doc, curX + 3, feedY - 1.5, { width: 11, color: PDF_THEME.blue });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  doc.setTextColor(...PDF_THEME.navy);
  txt(doc, "DJ GERAL", curX + 16, feedY - 2.3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...PDF_THEME.blue);
  txt(doc, `${generalBreaker}A ${generalPoles}P C`, curX + 16, feedY + 2.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  doc.setTextColor(...PDF_THEME.slate500);
  txt(doc, "Termomagnético", curX + 16, feedY + 6.0);
  curX += 36;

  // Linha até derivação DPS
  doc.setDrawColor(...PDF_THEME.slate700);
  doc.setLineWidth(0.6);
  doc.line(curX, feedY, curX + 14, feedY);

  // Derivação DPS Classe II (para baixo)
  const dpsX = curX + 7;
  doc.setDrawColor(...PDF_THEME.amber);
  doc.setLineWidth(0.4);
  doc.line(dpsX, feedY, dpsX, feedY + 9);
  doc.setFillColor(...PDF_THEME.navy);
  doc.circle(dpsX, feedY, 0.85, "F");
  drawDpsSymbol(doc, dpsX - 4, feedY + 9, 8, 9, PDF_THEME.amber);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.7);
  doc.setTextColor(...PDF_THEME.amber);
  txt(doc, "DPS Cl. II", dpsX + 6, feedY + 12.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.setTextColor(...PDF_THEME.slate700);
  txt(doc, "275V / 20kA", dpsX + 6, feedY + 16.0);
  drawGroundSymbol(doc, dpsX, feedY + 18, PDF_THEME.emerald);
  curX += 14;

  // IDR Geral (se existir ou recomendado)
  const drLabel = generalDr ? `${generalDr}A · 30mA` : `${Math.max(40, generalBreaker)}A · 30mA`;
  doc.setFillColor(...PDF_THEME.tealSoft);
  doc.setDrawColor(...PDF_THEME.tealDeep);
  doc.setLineWidth(0.4);
  doc.rect(curX, feedY - 7, 36, 15, "FD");
  // Símbolo toróide IDR
  doc.setDrawColor(...PDF_THEME.tealDeep);
  doc.ellipse(curX + 7.5, feedY, 3.6, 2.2, "S");
  doc.line(curX + 2, feedY, curX + 13, feedY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);
  doc.setTextColor(...PDF_THEME.tealDeep);
  txt(doc, generalDr ? "IDR GERAL" : "PROTEÇÃO DR", curX + 15, feedY - 2.3);
  doc.setFontSize(6.6);
  txt(doc, drLabel, curX + 15, feedY + 2.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...PDF_THEME.slate500);
  txt(doc, "Diferencial 30mA", curX + 15, feedY + 6.0);
  curX += 36;

  // Resumo técnico à direita do barramento superior
  const summaryBoxX = curX + 6;
  const summaryBoxW = Math.max(24, x + w - summaryBoxX - 5);
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.3);
  doc.rect(summaryBoxX, feedY - 7, summaryBoxW, 15, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(...PDF_THEME.navy);
  txt(doc, "CARGA & QUADRO", summaryBoxX + 3, feedY - 2.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.0);
  doc.setTextColor(...PDF_THEME.slate700);
  txt(doc, `Pot. Total: ${fmtNum((metrics.totalPower || 0) / 1000, 2)} kW`, summaryBoxX + 3, feedY + 2.1);
  txt(doc, `Ib Geral: ${fmtNum(metrics.generalCurrent || 0, 1)} A · PE #${peGauge}mm²`, summaryBoxX + 3, feedY + 6.0);

  // =========================================================================
  // BARRAMENTO VERTICAL (R / S / T / N / PE) E CIRCUITOS DERIVADOS
  // =========================================================================
  const busStartY = feedY + 26;
  const legendH = 12;
  const busEndY = y + h - legendH - 5;
  const busSpacing = phaseLabels.length >= 5 ? 4.2 : 4.8;
  const busStartX = x + 10;
  const busXs = phaseLabels.map((_, idx) => busStartX + idx * busSpacing);

  // Conexão horizontal do IDR até o topo dos barramentos de fase
  const topConnectY = feedY + 12;
  doc.setDrawColor(...PDF_THEME.slate700);
  doc.setLineWidth(0.5);
  doc.line(curX - 18, feedY + 8, curX - 18, topConnectY);
  doc.line(busXs[0], topConnectY, curX - 18, topConnectY);

  // Rótulos do barramento e linhas verticais
  phaseLabels.forEach((lbl, idx) => {
    const bx = busXs[idx];
    const code = lbl === "R" || lbl === "F" ? "A" : lbl === "S" ? "B" : lbl === "T" ? "C" : lbl;
    const rgb = PHASE_RGB[code] || PHASE_RGB.DEFAULT;

    // Pílula de identificação da barra
    doc.setFillColor(...rgb);
    doc.rect(bx - 1.9, busStartY - 6.5, 3.8, 4.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.2);
    doc.setTextColor(...PDF_THEME.white);
    txt(doc, lbl, bx, busStartY - 3.3, { align: "center" });

    if (idx < phaseCodes.length) {
      doc.setDrawColor(...rgb);
      doc.setLineWidth(0.45);
      doc.line(bx, topConnectY, bx, busStartY - 6.5);
    }

    // Linha do barramento vertical
    doc.setDrawColor(...rgb);
    doc.setLineWidth(0.7);
    if (lbl === "N") doc.setLineDashPattern([2, 1.2], 0);
    doc.line(bx, busStartY - 2, bx, busEndY);
    doc.setLineDashPattern([], 0);
  });

  // Símbolo de aterramento na base da barra PE
  const peIdx = phaseLabels.indexOf("PE");
  if (peIdx >= 0) {
    drawGroundSymbol(doc, busXs[peIdx], busEndY, PDF_THEME.emerald);
  }

  // Cabeçalho da grade de circuitos derivados
  const circuitsAreaX = busXs[busXs.length - 1] + 7;
  const circuitsAreaW = x + w - circuitsAreaX - 5;

  doc.setFillColor(...PDF_THEME.slate100);
  doc.rect(circuitsAreaX, busStartY - 6.5, circuitsAreaW, 5.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  doc.setTextColor(...PDF_THEME.slate700);
  txt(doc, "DISJUNTOR", circuitsAreaX + 10, busStartY - 2.9);
  txt(doc, "CONDUTOR", circuitsAreaX + 41, busStartY - 2.9);
  txt(doc, "CIRCUITO / DESCRIÇÃO", circuitsAreaX + 64, busStartY - 2.9);
  txt(doc, "CARGA / ΔU", x + w - 7, busStartY - 2.9, { align: "right" });

  // Linhas dos circuitos derivados
  const minRows = Math.max(circuitsSlice.length, 6);
  const availH = Math.max(30, busEndY - (busStartY + 2));
  const rowStep = Math.min(8.6, availH / minRows);

  const resolveConnectedIndices = (phaseStr = "A", supplyStr = "") => {
    const ph = String(phaseStr || "A").toUpperCase();
    const isTriC = /tri/i.test(supplyStr) || ph === "ABC" || ph === "RST";
    const isBiC = !isTriC && (/bi/i.test(supplyStr) || ph.length === 2);
    const idxs = [];
    if (isTriC || isBiC || ph.includes("A") || ph.includes("R") || ph.includes("F")) idxs.push(0);
    if ((isTriC || isBiC || ph.includes("B") || ph.includes("S")) && phaseCodes.length >= 2) idxs.push(1);
    if ((isTriC || ph.includes("C") || ph.includes("T")) && phaseCodes.length >= 3) idxs.push(2);
    return idxs.length ? idxs : [0];
  };

  if (circuitsSlice.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.slate500);
    txt(doc, "Nenhum circuito terminal cadastrado neste projeto.", circuitsAreaX + circuitsAreaW / 2, busStartY + 24, { align: "center" });
  } else {
    circuitsSlice.forEach((circuit, idx) => {
      const globalIdx = startIndex + idx;
      const ry = busStartY + 4 + idx * rowStep;
      const connectedIdxs = resolveConnectedIndices(circuit.phase, circuit.supply_type);
      const primaryRgb = PHASE_RGB[phaseCodes[connectedIdxs[0]]] || PDF_THEME.blue;
      const furthestBusX = busXs[Math.min(...connectedIdxs)];

      // Fundo zebra sutil na área do circuito
      if (idx % 2 === 0) {
        doc.setFillColor(250, 252, 255);
        doc.rect(circuitsAreaX, ry - rowStep * 0.48, circuitsAreaW, rowStep * 0.92, "F");
      }

      // Linha de derivação saindo da barra mais à esquerda conectada
      doc.setDrawColor(...primaryRgb);
      doc.setLineWidth(0.42);
      doc.line(furthestBusX, ry, circuitsAreaX + 4, ry);

      // Pontos de derivação nas fases conectadas
      connectedIdxs.forEach((busIdx) => {
        const dotRgb = PHASE_RGB[phaseCodes[busIdx]] || primaryRgb;
        doc.setFillColor(...dotRgb);
        doc.circle(busXs[busIdx], ry, 1.05, "F");
      });

      // Símbolo IEC do disjuntor do circuito
      drawIecBreakerSymbol(doc, circuitsAreaX + 4, ry, { width: 9.5, color: PDF_THEME.navy });

      // Linha de saída até a carga
      doc.setDrawColor(...PDF_THEME.slate500);
      doc.setLineWidth(0.35);
      doc.line(circuitsAreaX + 13.5, ry, circuitsAreaX + circuitsAreaW - 2, ry);

      // Rótulo Disjuntor (ex: 16A 1P B)
      const poles = circuit.breaker_poles || (connectedIdxs.length > 1 ? connectedIdxs.length : 1);
      const breakerTxt = `${circuit.breaker_a || 16}A ${poles}P ${circuit.breaker_curve || "C"}`;
      doc.setFillColor(...PDF_THEME.white);
      doc.rect(circuitsAreaX + 14.5, ry - 2.3, 24.5, 4.4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.8);
      doc.setTextColor(...PDF_THEME.navy);
      txt(doc, breakerTxt, circuitsAreaX + 15.2, ry + 1.0);

      // Badge DR se aplicável
      if (circuit.needs_dr) {
        doc.setFillColor(...PDF_THEME.tealSoft);
        doc.setDrawColor(...PDF_THEME.tealDeep);
        doc.setLineWidth(0.2);
        doc.rect(circuitsAreaX + 34.5, ry - 2.0, 6.2, 3.8, "FD");
        doc.setFontSize(4.7);
        doc.setTextColor(...PDF_THEME.tealDeep);
        txt(doc, "DR", circuitsAreaX + 37.6, ry + 0.8, { align: "center" });
      }

      // Bitola do condutor
      const wireTxt = String(circuit.wire_gauge || "2.5mm²").replace("mm²", " mm²");
      doc.setFillColor(...PDF_THEME.white);
      doc.rect(circuitsAreaX + 41.5, ry - 2.3, 19, 4.4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.7);
      doc.setTextColor(...PDF_THEME.slate700);
      txt(doc, wireTxt, circuitsAreaX + 42.2, ry + 1.0);

      // Tag C01 + Nome do circuito
      const tag = `C${String(globalIdx + 1).padStart(2, "0")}`;
      doc.setFillColor(...primaryRgb);
      doc.rect(circuitsAreaX + 62, ry - 2.2, 8.5, 4.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.4);
      doc.setTextColor(...PDF_THEME.white);
      txt(doc, tag, circuitsAreaX + 66.25, ry + 0.85, { align: "center" });

      const loadRightW = 28;
      const nameMaxW = Math.max(20, circuitsAreaW - 73 - loadRightW);
      const rawName = String(circuit.name || circuit.type || "Circuito");
      doc.setFillColor(...PDF_THEME.white);
      doc.rect(circuitsAreaX + 71.5, ry - 2.3, nameMaxW, 4.4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.0);
      doc.setTextColor(...PDF_THEME.slate900);
      txt(doc, rawName, circuitsAreaX + 72.2, ry + 1.0, { maxWidth: nameMaxW - 2 });

      // Potência e Queda de tensão à direita
      const loadLabel = `${Math.round(circuit.power_w || 0)}W · ΔU ${fmtNum(circuit.voltage_drop_pct || 0, 1)}%`;
      doc.setFillColor(...PDF_THEME.white);
      doc.rect(x + w - 34, ry - 2.3, 28, 4.4, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.7);
      doc.setTextColor(...PDF_THEME.slate700);
      txt(doc, loadLabel, x + w - 6.5, ry + 1.0, { align: "right" });
    });
  }

  // Reserva técnica (1 linha tracejada se houver espaço)
  const reserveRowIdx = circuitsSlice.length;
  if (reserveRowIdx < minRows) {
    const ry = busStartY + 4 + reserveRowIdx * rowStep;
    doc.setDrawColor(...PDF_THEME.slate300);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(busXs[0], ry, circuitsAreaX + 35, ry);
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(5.7);
    doc.setTextColor(...PDF_THEME.slate500);
    txt(doc, "ESPAÇO RESERVA TÉCNICA (EXPANSÃO FUTURA 20%)", circuitsAreaX + 37, ry + 1.0);
  }

  // =========================================================================
  // LEGENDA TÉCNICA INFERIOR
  // =========================================================================
  const legY = y + h - legendH;
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.25);
  doc.rect(x, legY, w, legendH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.0);
  doc.setTextColor(...PDF_THEME.navy);
  txt(doc, "LEGENDA:", x + 4, legY + 5.0);

  const legendSwatches = [
    { label: "Fase A (R)", color: PHASE_RGB.A },
    { label: "Fase B (S)", color: PHASE_RGB.B },
    { label: "Fase C (T)", color: PHASE_RGB.C },
    { label: "Neutro (N)", color: PHASE_RGB.N },
    { label: "Terra (PE)", color: PHASE_RGB.PE },
  ];
  let lx = x + 22;
  legendSwatches.forEach((sw) => {
    doc.setFillColor(...sw.color);
    doc.rect(lx, legY + 2.6, 3.2, 2.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_THEME.slate700);
    txt(doc, sw.label, lx + 4.3, legY + 4.9);
    lx += 22.5;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  doc.setTextColor(...PDF_THEME.slate500);
  txt(
    doc,
    "Símbolos conforme ABNT NBR ISO 6578 / NBR 5410 · DJ: Disjuntor Termomagnético · IDR: Diferencial Residual 30mA · DPS: Supressor de Surtos Cl. II",
    x + 4,
    legY + 9.5
  );

  return y + h + 4;
}

/**
 * Desenha o Diagrama Unifilar Elétrico Fotovoltaico (ABNT NBR 16690 / NBR 5410)
 * inteiramente em vetor no jsPDF.
 */
export function drawSolarUnifilarVector(
  doc,
  params = {},
  { x = 14, y = 48, w = 182, h = 112 } = {}
) {
  const dcPowerKw = Number(params.dcPowerKw || 0);
  const panelCount = Math.max(1, Number(params.panelCount || 20));
  const moduleWp = Number(params.moduleWp || 550);
  const inverterKw = Number(params.inverterKw || 5);
  const acVoltage = Number(params.acVoltage || 220);
  const supplyType = params.supplyType || "Bifásico";
  const isTri = Boolean(params.isTri || /tri/i.test(String(supplyType)));
  const breaker = Number(params.breaker || 32);
  const acCurrent = Number(params.acCurrent || 20);
  const cableGauge = params.cableGauge || (breaker >= 160 ? "70 mm²" : breaker >= 125 ? "50 mm²" : breaker >= 100 ? "35 mm²" : breaker > 63 ? "16 mm²" : breaker > 40 ? "10 mm²" : "6 mm²");

  const strings = Array.isArray(params.strings) && params.strings.length > 0
    ? params.strings
    : [
        {
          stringName: "String 01",
          modulesCount: Math.ceil(panelCount / 2),
          powerKw: ((Math.ceil(panelCount / 2) * moduleWp) / 1000).toFixed(2),
          vmpV: (Math.ceil(panelCount / 2) * 41.5).toFixed(0),
          vocV: (Math.ceil(panelCount / 2) * 49.8).toFixed(0),
          impA: "13,3",
        },
        {
          stringName: "String 02",
          modulesCount: Math.floor(panelCount / 2),
          powerKw: ((Math.floor(panelCount / 2) * moduleWp) / 1000).toFixed(2),
          vmpV: (Math.floor(panelCount / 2) * 41.5).toFixed(0),
          vocV: (Math.floor(panelCount / 2) * 49.8).toFixed(0),
          impA: "13,3",
        },
      ].filter((s) => Number(s.modulesCount) > 0);

  // Moldura externa
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...PDF_THEME.slate300);
  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h, "FD");

  // Header do Diagrama
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(x, y, w, 9, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(x, y, 2.5, 9, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, "DIAGRAMA UNIFILAR ELÉTRICO SOLAR (CC / CA)", x + 5, y + 5.9);

  doc.setFontSize(6.8);
  doc.setTextColor(...PDF_THEME.teal);
  txt(doc, `NBR 16690 · NBR 5410 · ${dcPowerKw.toFixed(2)} kWp / ${inverterKw} kW`, x + w - 4, y + 5.9, { align: "right" });

  // Coordenadas dos 5 estágios horizontais
  const bodyY = y + 12;
  const bodyH = h - 24;
  const midY = bodyY + bodyH / 2 - 2;

  const s1X = x + 4;
  const s1W = 41;
  const s2X = s1X + s1W + 7;
  const s2W = 28;
  const s3X = s2X + s2W + 7;
  const s3W = 31;
  const s4X = s3X + s3W + 7;
  const s4W = 29;
  const s5X = s4X + s4W + 6;
  const s5W = x + w - s5X - 4;

  // Rótulos superiores dos estágios (CC vs CA)
  doc.setFillColor(...PDF_THEME.redSoft);
  doc.rect(s1X, bodyY, s1W + 7 + s2W, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  doc.setTextColor(...PDF_THEME.red);
  txt(doc, "LADO CC — CORRENTE CONTÍNUA (NBR 16690)", s1X + (s1W + 7 + s2W) / 2, bodyY + 3.6, { align: "center" });

  doc.setFillColor(...PDF_THEME.blueLight);
  doc.rect(s3X, bodyY, s3W + 7 + s4W + 6 + s5W, 5, "F");
  doc.setTextColor(...PDF_THEME.blue);
  txt(doc, "CONVERSÃO & LADO CA — CORRENTE ALTERNADA (NBR 5410)", s3X + (s3W + 7 + s4W + 6 + s5W) / 2, bodyY + 3.6, { align: "center" });

  // -------------------------------------------------------------------------
  // ESTÁGIO 1: ARRANJO FOTOVOLTAICO (STRINGS)
  // -------------------------------------------------------------------------
  const visibleStrings = strings.slice(0, 3);
  const strAreaTop = bodyY + 9;
  const strGap = 4;
  const strBoxH = Math.min(22, (bodyH - 18 - strGap * Math.max(0, visibleStrings.length - 1)) / Math.max(1, visibleStrings.length));
  const totalStrHeight = visibleStrings.length * strBoxH + Math.max(0, visibleStrings.length - 1) * strGap;
  const firstStrY = midY - totalStrHeight / 2 + 2;

  visibleStrings.forEach((str, idx) => {
    const sy = firstStrY + idx * (strBoxH + strGap);
    doc.setFillColor(...PDF_THEME.slate50);
    doc.setDrawColor(...PDF_THEME.blue);
    doc.setLineWidth(0.35);
    doc.rect(s1X, sy, s1W, strBoxH, "FD");

    // Ícone de placa solar (grade azul)
    doc.setFillColor(...PDF_THEME.navy);
    doc.rect(s1X + 2.2, sy + 2.5, 8.5, 9.5, "F");
    doc.setDrawColor(...PDF_THEME.teal);
    doc.setLineWidth(0.2);
    doc.line(s1X + 5.0, sy + 2.5, s1X + 5.0, sy + 12.0);
    doc.line(s1X + 7.8, sy + 2.5, s1X + 7.8, sy + 12.0);
    doc.line(s1X + 2.2, sy + 5.7, s1X + 10.7, sy + 5.7);
    doc.line(s1X + 2.2, sy + 8.9, s1X + 10.7, sy + 8.9);

    const modCount = Number(str.modulesCount || str.count || Math.ceil(panelCount / visibleStrings.length));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(...PDF_THEME.navy);
    txt(doc, str.stringName || `String 0${idx + 1}`, s1X + 12.5, sy + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    doc.setTextColor(...PDF_THEME.slate700);
    txt(doc, `${modCount} × ${moduleWp}Wp`, s1X + 12.5, sy + 9.2);
    txt(doc, `Voc ${str.vocV || "498"}V · ${str.impA || "13,3"}A`, s1X + 12.5, sy + 12.8);

    // Conexão + / - CC até String Box CC
    const cy = sy + strBoxH / 2;
    doc.setDrawColor(...PDF_THEME.red);
    doc.setLineWidth(0.42);
    doc.line(s1X + s1W, cy - 1.5, s2X, cy - 1.5);
    doc.setDrawColor(...PDF_THEME.navy);
    doc.line(s1X + s1W, cy + 1.5, s2X, cy + 1.5);
  });

  if (strings.length > 3) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(5.2);
    doc.setTextColor(...PDF_THEME.slate500);
    txt(doc, `+ ${strings.length - 3} string(s) no arranjo`, s1X + s1W / 2, firstStrY + totalStrHeight + 4.5, { align: "center" });
  }

  // Etiqueta Cabo Solar CC
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.0);
  doc.setTextColor(...PDF_THEME.red);
  txt(doc, "Cabo 4/6mm²", s1X + s1W + 3.5, midY - 17, { align: "center" });
  doc.setFont("helvetica", "normal");
  txt(doc, "1,8kV CC", s1X + s1W + 3.5, midY - 13.5, { align: "center" });

  // -------------------------------------------------------------------------
  // ESTÁGIO 2: STRING BOX CC / PROTEÇÃO CC
  // -------------------------------------------------------------------------
  const sbH = 54;
  const sbY = midY - sbH / 2 + 2;
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...PDF_THEME.red);
  doc.setLineWidth(0.45);
  doc.rect(s2X, sbY, s2W, sbH, "FD");
  doc.setFillColor(...PDF_THEME.red);
  doc.rect(s2X, sbY, s2W, 6.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.7);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, "STRING BOX CC", s2X + s2W / 2, sbY + 4.3, { align: "center" });

  // Seccionadora CC
  drawIecBreakerSymbol(doc, s2X + 5, sbY + 13, { width: 18, color: PDF_THEME.red });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.3);
  doc.setTextColor(...PDF_THEME.navy);
  txt(doc, "Secc. CC 1000V", s2X + s2W / 2, sbY + 19.5, { align: "center" });

  // DPS CC
  drawDpsSymbol(doc, s2X + s2W / 2 - 4, sbY + 23, 8, 9, PDF_THEME.amber);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  doc.setTextColor(...PDF_THEME.amber);
  txt(doc, "DPS CC 1000V", s2X + s2W / 2, sbY + 36, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.0);
  doc.setTextColor(...PDF_THEME.slate700);
  txt(doc, "Classe II 40kA", s2X + s2W / 2, sbY + 39.5, { align: "center" });

  // Aterramento CC
  drawGroundSymbol(doc, s2X + s2W / 2, sbY + 42.5, PDF_THEME.emerald);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.9);
  doc.setTextColor(...PDF_THEME.emerald);
  txt(doc, "BEP #6mm²", s2X + s2W / 2, sbY + 51.5, { align: "center" });

  // Linhas String Box CC -> Inversor
  doc.setDrawColor(...PDF_THEME.red);
  doc.setLineWidth(0.5);
  doc.line(s2X + s2W, midY - 2, s3X, midY - 2);
  doc.setDrawColor(...PDF_THEME.navy);
  doc.line(s2X + s2W, midY + 2, s3X, midY + 2);

  // -------------------------------------------------------------------------
  // ESTÁGIO 3: INVERSOR FOTOVOLTAICO
  // -------------------------------------------------------------------------
  const invH = 48;
  const invY = midY - invH / 2 + 2;
  doc.setFillColor(...PDF_THEME.navy);
  doc.setDrawColor(...PDF_THEME.teal);
  doc.setLineWidth(0.55);
  doc.rect(s3X, invY, s3W, invH, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(...PDF_THEME.teal);
  txt(doc, "INVERSOR FV", s3X + s3W / 2, invY + 6.5, { align: "center" });

  // Quadrado simbólico CC -> CA
  const symX = s3X + 7;
  const symY = invY + 10;
  const symS = s3W - 14;
  doc.setFillColor(...PDF_THEME.navySoft);
  doc.setDrawColor(...PDF_THEME.teal);
  doc.setLineWidth(0.4);
  doc.rect(symX, symY, symS, symS, "FD");
  doc.line(symX, symY + symS, symX + symS, symY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, "=", symX + 3.5, symY + 5.5);
  txt(doc, "~", symX + symS - 3.5, symY + symS - 2.5, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, `${inverterKw} kW`, s3X + s3W / 2, invY + 34, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.setTextColor(...PDF_THEME.slate300);
  txt(doc, `${isTri ? "Trifásico" : supplyType}`, s3X + s3W / 2, invY + 39, { align: "center" });
  txt(doc, `${acVoltage}V · Ib ${acCurrent.toFixed(1)}A`, s3X + s3W / 2, invY + 43.5, { align: "center" });

  // Linha Inversor -> Proteção CA
  doc.setDrawColor(...PDF_THEME.blue);
  doc.setLineWidth(0.75);
  doc.line(s3X + s3W, midY + 2, s4X, midY + 2);

  // -------------------------------------------------------------------------
  // ESTÁGIO 4: PROTEÇÃO CA (STRING BOX CA / DISJUNTOR + DPS CA)
  // -------------------------------------------------------------------------
  const acH = 54;
  const acY = midY - acH / 2 + 2;
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...PDF_THEME.blue);
  doc.setLineWidth(0.45);
  doc.rect(s4X, acY, s4W, acH, "FD");
  doc.setFillColor(...PDF_THEME.blue);
  doc.rect(s4X, acY, s4W, 6.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.7);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, "PROTEÇÃO CA", s4X + s4W / 2, acY + 4.3, { align: "center" });

  // Disjuntor CA
  drawIecBreakerSymbol(doc, s4X + 5.5, acY + 13, { width: 18, color: PDF_THEME.blue });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.0);
  doc.setTextColor(...PDF_THEME.navy);
  txt(doc, `DJ ${breaker}A ${isTri ? "3P" : "2P"}`, s4X + s4W / 2, acY + 19.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.2);
  doc.setTextColor(...PDF_THEME.slate700);
  txt(doc, "Curva C · IEC", s4X + s4W / 2, acY + 23.0, { align: "center" });

  // DPS CA
  drawDpsSymbol(doc, s4X + s4W / 2 - 4, acY + 26, 8, 9, PDF_THEME.amber);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  doc.setTextColor(...PDF_THEME.amber);
  txt(doc, "DPS CA 275V", s4X + s4W / 2, acY + 39, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.0);
  doc.setTextColor(...PDF_THEME.slate700);
  txt(doc, `Cabo ${cableGauge}`, s4X + s4W / 2, acY + 43, { align: "center" });

  drawGroundSymbol(doc, s4X + s4W / 2, acY + 45.5, PDF_THEME.emerald);

  // Linha Proteção CA -> Ponto de Conexão
  doc.setDrawColor(...PDF_THEME.blue);
  doc.setLineWidth(0.75);
  doc.line(s4X + s4W, midY + 2, s5X, midY + 2);

  // -------------------------------------------------------------------------
  // ESTÁGIO 5: QDC -> MEDIDOR BIDIRECIONAL -> REDE CONCESSIONÁRIA
  // -------------------------------------------------------------------------
  const qdcY = midY - 25;
  doc.setFillColor(...PDF_THEME.tealSoft);
  doc.setDrawColor(...PDF_THEME.tealDeep);
  doc.setLineWidth(0.4);
  doc.rect(s5X, qdcY, s5W, 14, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  doc.setTextColor(...PDF_THEME.tealDeep);
  txt(doc, "QDC PRINCIPAL", s5X + s5W / 2, qdcY + 5.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.0);
  doc.setTextColor(...PDF_THEME.slate700);
  txt(doc, "Barramento CA", s5X + s5W / 2, qdcY + 10.2, { align: "center" });

  // Medidor Bidirecional
  const medY = qdcY + 19;
  doc.setDrawColor(...PDF_THEME.slate700);
  doc.setLineWidth(0.5);
  doc.line(s5X + s5W / 2, qdcY + 14, s5X + s5W / 2, medY);

  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...PDF_THEME.navy);
  doc.rect(s5X, medY, s5W, 14, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  doc.setTextColor(...PDF_THEME.navy);
  txt(doc, "MEDIDOR", s5X + s5W / 2, medY + 5.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.0);
  doc.setTextColor(...PDF_THEME.blue);
  txt(doc, "Bidirecional kWh", s5X + s5W / 2, medY + 10.2, { align: "center" });

  // Rede Concessionária
  const gridY = medY + 19;
  doc.setDrawColor(...PDF_THEME.slate700);
  doc.line(s5X + s5W / 2, medY + 14, s5X + s5W / 2, gridY);
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(s5X, gridY, s5W, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...PDF_THEME.teal);
  txt(doc, "REDE ELÉTRICA", s5X + s5W / 2, gridY + 5.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.9);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, "Distribuidora", s5X + s5W / 2, gridY + 9.2, { align: "center" });

  // =========================================================================
  // LEGENDA INFERIOR DO DIAGRAMA SOLAR
  // =========================================================================
  const legY = y + h - 10;
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.25);
  doc.rect(x, legY, w, 10, "FD");

  const items = [
    { color: PDF_THEME.red, label: "Circuito CC (1,8 kV Solar)" },
    { color: PDF_THEME.blue, label: `Circuito CA (${acVoltage}V · ${cableGauge})` },
    { color: PDF_THEME.amber, label: "DPS Classe II CC / CA" },
    { color: PDF_THEME.emerald, label: "Aterramento BEP / PE" },
  ];
  let lx = x + 4;
  items.forEach((it) => {
    doc.setFillColor(...it.color);
    doc.rect(lx, legY + 3.4, 3.2, 2.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...PDF_THEME.slate700);
    txt(doc, it.label, lx + 4.5, legY + 5.8);
    lx += 44.5;
  });

  return y + h + 4;
}

/**
 * Desenha o Diagrama Unifilar Interativo (nodes + connections) em formato A3 Paisagem (420 x 297 mm)
 * com moldura normativa ABNT NBR 10068, cabeçalho NACIF Energy, legenda e carimbo técnico.
 */
export function drawInteractiveNodesUnifilarPdf(doc, { project = {}, nodes = [], connections = [], metrics = {} } = {}) {
  const W = 420;
  const H = 297;

  // Fundo branco limpo
  doc.setFillColor(...PDF_THEME.white);
  doc.rect(0, 0, W, H, "F");

  // Moldura externa e interna ABNT NBR 10068
  doc.setDrawColor(...PDF_THEME.navy);
  doc.setLineWidth(0.6);
  doc.rect(12, 8, W - 20, H - 16, "S");
  doc.setLineWidth(0.25);
  doc.rect(14, 10, W - 24, H - 20, "S");

  // Cabeçalho executivo NACIF Energy
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(14, 10, W - 24, 17, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(14, 26.2, W - 24, 0.8, "F");

  try {
    doc.addImage(NACIF_LOGO_DARK_BASE64, "PNG", 17.5, 11.8, 35.5, 10.9, undefined, "FAST");
  } catch {
    try {
      doc.addImage(NACIF_SYMBOL_BASE64, "PNG", 17.5, 12.2, 12.5, 11.7, undefined, "FAST");
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.0);
  doc.setTextColor(...PDF_THEME.slate300);
  txt(doc, "DA PLANTA AO SOL · DIAGRAMA UNIFILAR INTERATIVO DE FLUXO · ABNT NBR 5410", 57, 19.6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, String(project.name || "PROJETO ELÉTRICO").toUpperCase(), W - 15, 17.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...PDF_THEME.teal);
  txt(
    doc,
    `${project.supply_type || "Monofásico"} · ${project.voltage || 220}V · ${(project.circuits || []).length} circuito(s)`,
    W - 15,
    23.0,
    { align: "right" }
  );

  // Área de desenho do diagrama
  const vpX = 18;
  const vpY = 31;
  const vpW = W - 36;
  const vpH = 207;

  // Grade sutil de engenharia
  doc.setDrawColor(242, 245, 249);
  doc.setLineWidth(0.15);
  for (let gx = vpX; gx <= vpX + vpW; gx += 15) {
    doc.line(gx, vpY, gx, vpY + vpH);
  }
  for (let gy = vpY; gy <= vpY + vpH; gy += 15) {
    doc.line(vpX, gy, vpX + vpW, gy);
  }

  const NODE_W = 240;
  const NODE_H = 74;
  const validNodes = Array.isArray(nodes) ? nodes : [];

  if (validNodes.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    validNodes.forEach((n) => {
      const nx = Number(n.x) || 0;
      const ny = Number(n.y) || 0;
      minX = Math.min(minX, nx);
      minY = Math.min(minY, ny);
      maxX = Math.max(maxX, nx + NODE_W);
      maxY = Math.max(maxY, ny + NODE_H);
    });

    const contentW = Math.max(300, maxX - minX);
    const contentH = Math.max(200, maxY - minY);
    const pad = 8;
    const scale = Math.min((vpW - pad * 2) / contentW, (vpH - pad * 2) / contentH, 0.24);
    const offsetX = vpX + (vpW - contentW * scale) / 2 - minX * scale;
    const offsetY = vpY + (vpH - contentH * scale) / 2 - minY * scale;

    const toPdfX = (px) => offsetX + px * scale;
    const toPdfY = (py) => offsetY + py * scale;

    // 1. Desenha conexões ortogonais/escalonadas entre nós
    (connections || []).forEach((conn) => {
      const from = validNodes.find((n) => n.id === conn.from);
      const to = validNodes.find((n) => n.id === conn.to);
      if (!from || !to) return;

      const x1 = toPdfX((Number(from.x) || 0) + NODE_W);
      const y1 = toPdfY((Number(from.y) || 0) + NODE_H / 2);
      const x2 = toPdfX(Number(to.x) || 0);
      const y2 = toPdfY((Number(to.y) || 0) + NODE_H / 2);

      const lineColor = conn.type === "neutro"
        ? PHASE_RGB.N
        : conn.type === "terra"
          ? PHASE_RGB.PE
          : PDF_THEME.slate700;

      doc.setDrawColor(...lineColor);
      doc.setLineWidth(0.5);
      if (conn.type === "neutro") doc.setLineDashPattern([1.8, 1.4], 0);

      if (x2 >= x1 + 2) {
        const midX = (x1 + x2) / 2;
        doc.line(x1, y1, midX, y1);
        doc.line(midX, y1, midX, y2);
        doc.line(midX, y2, x2, y2);
      } else {
        const dropY = Math.max(y1, y2) + 8;
        doc.line(x1, y1, x1 + 4, y1);
        doc.line(x1 + 4, y1, x1 + 4, dropY);
        doc.line(x1 + 4, dropY, x2 - 4, dropY);
        doc.line(x2 - 4, dropY, x2 - 4, y2);
        doc.line(x2 - 4, y2, x2, y2);
      }
      doc.setLineDashPattern([], 0);

      // Seta na chegada
      doc.setFillColor(...lineColor);
      doc.triangle(x2, y2, x2 - 2.0, y2 - 1.0, x2 - 2.0, y2 + 1.0, "F");
    });

    // 2. Desenha os nós vetoriais
    const typeShort = {
      feed: "ENT",
      breaker: "DJ",
      dr: "IDR",
      dps: "DPS",
      busbar: "BUS",
      circuit: "CIR",
      annotation: "OBS",
    };

    validNodes.forEach((node) => {
      const rx = toPdfX(Number(node.x) || 0);
      const ry = toPdfY(Number(node.y) || 0);
      const rw = Math.max(30, NODE_W * scale);
      const rh = Math.max(10.5, NODE_H * scale);
      const accent = hexToRgb(node.accentColor, PDF_THEME.teal);
      const isActive = node.active !== false;

      // Sombra sutil + Cartão branco
      doc.setFillColor(232, 238, 245);
      doc.rect(rx + 0.6, ry + 0.6, rw, rh, "F");

      doc.setFillColor(...PDF_THEME.white);
      doc.setDrawColor(...(isActive ? PDF_THEME.slate300 : PDF_THEME.red));
      doc.setLineWidth(0.3);
      doc.rect(rx, ry, rw, rh, "FD");

      // Filete esquerdo colorido
      doc.setFillColor(...accent);
      doc.rect(rx, ry, 1.8, rh, "F");

      // Badge do tipo
      const badgeSize = Math.min(7.5, rh * 0.56);
      doc.setFillColor(...PDF_THEME.slate100);
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.25);
      doc.rect(rx + 3.2, ry + (rh - badgeSize) / 2, badgeSize, badgeSize, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(4.5, Math.min(5.8, rw * 0.1)));
      doc.setTextColor(...accent);
      txt(doc, typeShort[node.type] || "EL", rx + 3.2 + badgeSize / 2, ry + rh / 2 + 1.2, { align: "center" });

      // Título e subtítulo
      const textX = rx + 4.8 + badgeSize;
      const textMaxW = Math.max(12, rw - (textX - rx) - 2);
      const fontTitle = Math.max(5.2, Math.min(7.2, rh * 0.42));
      const fontSub = Math.max(4.4, Math.min(5.6, rh * 0.32));

      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontTitle);
      doc.setTextColor(...PDF_THEME.navy);
      txt(doc, String(node.title || "Componente").slice(0, 26), textX, ry + rh * 0.38, { maxWidth: textMaxW });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSub);
      doc.setTextColor(...PDF_THEME.slate500);
      txt(doc, String(node.subtitle || "").slice(0, 30), textX, ry + rh * 0.62, { maxWidth: textMaxW });

      // Parâmetro e Fase na linha inferior
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(4.2, fontSub - 0.3));
      doc.setTextColor(...PDF_THEME.blue);
      const metaStr = [node.value, node.phase ? `Fase ${node.phase}` : "", !isActive ? "DESLIGADO" : ""].filter(Boolean).join(" · ");
      txt(doc, metaStr.slice(0, 28), textX, ry + rh * 0.86, { maxWidth: textMaxW });
    });
  }

  // =========================================================================
  // FAIXA INFERIOR: LEGENDA + CARIMBO TÉCNICO ABNT NBR 10068
  // =========================================================================
  const footY = 241;
  const footH = 46;

  // Legenda e Métricas (esquerda)
  const legW = 242;
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.navy);
  doc.setLineWidth(0.35);
  doc.rect(14, footY, legW, footH, "FD");

  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(14, footY, legW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...PDF_THEME.white);
  txt(doc, "LEGENDA DE CONDUTORES, PROTEÇÃO & RESUMO DO QUADRO", 18, footY + 4.8);

  const wireLegend = [
    { color: PDF_THEME.slate700, label: "Condutor Fase (R/S/T)", dash: false },
    { color: PHASE_RGB.N, label: "Condutor Neutro (N)", dash: true },
    { color: PHASE_RGB.PE, label: "Condutor Proteção (PE)", dash: false },
  ];
  wireLegend.forEach((wl, idx) => {
    const wx = 18 + idx * 78;
    const wy = footY + 14;
    doc.setDrawColor(...wl.color);
    doc.setLineWidth(0.75);
    if (wl.dash) doc.setLineDashPattern([2, 1.5], 0);
    doc.line(wx, wy, wx + 12, wy);
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(...PDF_THEME.slate700);
    txt(doc, wl.label, wx + 15, wy + 1.2);
  });

  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.25);
  doc.line(18, footY + 20, 14 + legW - 4, footY + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(...PDF_THEME.slate700);
  txt(doc, `Potência Instalada: ${fmtNum((metrics.totalPower || 0) / 1000, 2)} kW   ·   Corrente Geral (Ib): ${fmtNum(metrics.generalCurrent || 0, 1)} A   ·   Disjuntor Geral: ${metrics.generalBreaker || 50} A`, 18, footY + 27);
  txt(doc, `Tamanho do Quadro: ${metrics.panelSize || 24} módulos DIN   ·   Desequilíbrio: ${fmtNum(metrics.imbalance_pct || 0, 1)}%   ·   NBR Score: ${metrics.nbrScore ?? "—"} / 100`, 18, footY + 34);
  doc.setFontSize(6.0);
  doc.setTextColor(...PDF_THEME.slate500);
  txt(doc, "NOTAS: 1) Instalação em conformidade com ABNT NBR 5410:2004. 2) Conferir conexões, torques e ensaios antes da energização.", 18, footY + 41.5);

  // Carimbo Técnico (direita)
  const cX = 14 + legW + 4;
  const cW = W - 10 - cX;
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...PDF_THEME.navy);
  doc.setLineWidth(0.45);
  doc.rect(cX, footY, cW, footH, "FD");

  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(cX, footY, cW, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...PDF_THEME.teal);
  txt(doc, "CARIMBO TÉCNICO · ABNT NBR 10068", cX + 4, footY + 4.8);

  const carimboRows = [
    ["PROJETO:", String(project.name || "Projeto Elétrico").slice(0, 34)],
    ["CLIENTE:", String(project.client_name || "Não informado").slice(0, 34)],
    ["ENDEREÇO:", String(project.address || "Não informado").slice(0, 34)],
    ["SISTEMA:", `${project.supply_type || "Monofásico"} · ${project.voltage || 220}V · 60Hz`],
  ];
  carimboRows.forEach(([k, v], idx) => {
    const ry = footY + 13 + idx * 6.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.0);
    doc.setTextColor(...PDF_THEME.slate500);
    txt(doc, k, cX + 4, ry);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_THEME.navy);
    txt(doc, v, cX + 26, ry);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.setLineWidth(0.2);
    doc.line(cX + 2, ry + 1.8, cX + cW - 2, ry + 1.8);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(...PDF_THEME.blue);
  txt(doc, `EMISSÃO: ${new Date().toLocaleDateString("pt-BR")}   ·   FORMATO: A3   ·   PRANCHA: UNIFILAR-01`, cX + 4, footY + 42.5);
}
