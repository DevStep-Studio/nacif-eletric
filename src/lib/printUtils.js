/**
 * Utilitário de Impressão e Plotagem Técnica ABNT NBR 10068 / NBR 16861 / NBR 5410
 * NACIF Solutions Eletric — Formatos Padronizados: A4, A3, A2, A1, A0 (Paisagem)
 * Garante enquadramento milimétrico, paginação automática e carimbo técnico normatizado.
 */
import { DEFAULT_LOGO_URL, WEG_BLUE } from "./brandingDefaults.js";

// Dimensões ISO 216 / ABNT NBR 10068 em mm (orientação Paisagem / Landscape)
export const PAPER_SIZES = {
  A4: { w: 297, h: 210, name: "A4" },
  A3: { w: 420, h: 297, name: "A3" },
  A2: { w: 594, h: 420, name: "A2" },
  A1: { w: 841, h: 594, name: "A1" },
  A0: { w: 1189, h: 841, name: "A0" },
};

// Configurações Técnicas e Escalares por Formato de Folha
export const SHEET_CONFIG = {
  A4: {
    w: 297,
    h: 210,
    name: "A4",
    margins: { left: 20, top: 7, right: 7, bottom: 7 }, // mm (20mm margem de pasta/furação)
    scale: 1.0,
    baseFontPt: 7.4,
    thPaddingMm: "1.4mm 2mm",
    tdPaddingMm: "1.2mm 2mm",
    imgSizePx: 18,
    headerFontPt: 10,
    headerSubFontPt: 6.2,
    headerHeightMm: 12,
    carimboHeightMm: 25,
    carimboTitlePt: 8.5,
    carimboTextPt: 6.2,
    carimboLogoWidthMm: 34,
    carimboMetaWidthMm: 44,
    totalsWidthMm: 76,
    totalsFontPt: 6.6,
    maxRowsFirstPage: 20,
    maxRowsPerPage: 25,
    borderWidth: 1.4,
  },
  A3: {
    w: 420,
    h: 297,
    name: "A3",
    margins: { left: 25, top: 9, right: 9, bottom: 9 },
    scale: 1.38,
    baseFontPt: 9.6,
    thPaddingMm: "1.8mm 2.8mm",
    tdPaddingMm: "1.6mm 2.8mm",
    imgSizePx: 24,
    headerFontPt: 13,
    headerSubFontPt: 7.8,
    headerHeightMm: 16,
    carimboHeightMm: 32,
    carimboTitlePt: 11,
    carimboTextPt: 7.8,
    carimboLogoWidthMm: 46,
    carimboMetaWidthMm: 58,
    totalsWidthMm: 105,
    totalsFontPt: 8.4,
    maxRowsFirstPage: 26,
    maxRowsPerPage: 32,
    borderWidth: 1.6,
  },
  A2: {
    w: 594,
    h: 420,
    name: "A2",
    margins: { left: 25, top: 10, right: 10, bottom: 10 },
    scale: 1.85,
    baseFontPt: 12.2,
    thPaddingMm: "2.5mm 3.6mm",
    tdPaddingMm: "2.2mm 3.6mm",
    imgSizePx: 32,
    headerFontPt: 16.5,
    headerSubFontPt: 10,
    headerHeightMm: 22,
    carimboHeightMm: 42,
    carimboTitlePt: 14.5,
    carimboTextPt: 9.8,
    carimboLogoWidthMm: 62,
    carimboMetaWidthMm: 76,
    totalsWidthMm: 145,
    totalsFontPt: 10.8,
    maxRowsFirstPage: 30,
    maxRowsPerPage: 38,
    borderWidth: 2.0,
  },
  A1: {
    w: 841,
    h: 594,
    name: "A1",
    margins: { left: 25, top: 10, right: 10, bottom: 10 },
    scale: 2.5,
    baseFontPt: 15.5,
    thPaddingMm: "3.4mm 4.8mm",
    tdPaddingMm: "3.0mm 4.8mm",
    imgSizePx: 42,
    headerFontPt: 21,
    headerSubFontPt: 12.5,
    headerHeightMm: 28,
    carimboHeightMm: 54,
    carimboTitlePt: 18,
    carimboTextPt: 12.2,
    carimboLogoWidthMm: 85,
    carimboMetaWidthMm: 105,
    totalsWidthMm: 195,
    totalsFontPt: 13.8,
    maxRowsFirstPage: 36,
    maxRowsPerPage: 44,
    borderWidth: 2.4,
  },
  A0: {
    w: 1189,
    h: 841,
    name: "A0",
    margins: { left: 25, top: 10, right: 10, bottom: 10 },
    scale: 3.4,
    baseFontPt: 19.5,
    thPaddingMm: "4.5mm 6.5mm",
    tdPaddingMm: "4.0mm 6.5mm",
    imgSizePx: 56,
    headerFontPt: 27,
    headerSubFontPt: 15.5,
    headerHeightMm: 38,
    carimboHeightMm: 70,
    carimboTitlePt: 23,
    carimboTextPt: 15.5,
    carimboLogoWidthMm: 115,
    carimboMetaWidthMm: 145,
    totalsWidthMm: 260,
    totalsFontPt: 17.5,
    maxRowsFirstPage: 42,
    maxRowsPerPage: 52,
    borderWidth: 2.8,
  },
};

function escapeHTML(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSheetConfig(paperSize = "A4") {
  const normalizedKey = String(paperSize || "A4").toUpperCase().trim();
  return SHEET_CONFIG[normalizedKey] || SHEET_CONFIG.A4;
}

/**
 * Constrói o Carimbo Técnico Padronizado ABNT NBR 10068 / NBR 16861
 */
function buildTitleBlock(projectName, logoUrl, paperSize, projectInfo = {}, pageIndex = 1, totalPages = 1, cfg = SHEET_CONFIG.A4) {
  const date = new Date().toLocaleDateString("pt-BR");
  const displayLogo = logoUrl || DEFAULT_LOGO_URL;
  const clientName = projectInfo.clientName || projectInfo.client_name || projectInfo.client || "—";
  const address = projectInfo.address || projectInfo.project_address || "—";
  const fields = [
    ["Formato", paperSize],
    ["Data", date],
    ["Escala", "S/E"],
    ["Rev.", projectInfo.revision || "01"],
    ["Folha", `${pageIndex} / ${totalPages}`],
  ];

  return `
    <div class="sheet-carimbo" style="height:${cfg.carimboHeightMm}mm;">
      <div class="sheet-carimbo-logo" style="width:${cfg.carimboLogoWidthMm}mm;">
        <img src="${displayLogo}" alt="NACIF ELETRIC" style="max-height:${cfg.carimboHeightMm - 6}mm;" />
      </div>
      <div class="sheet-carimbo-main">
        <div class="sheet-carimbo-title" style="font-size:${cfg.carimboTitlePt}pt;">${escapeHTML(projectName || "PROJETO ELÉTRICO")}</div>
        <div class="sheet-carimbo-grid" style="font-size:${cfg.carimboTextPt}pt;">
          <div class="sheet-carimbo-row">
            <span class="sheet-carimbo-label">Cliente:</span>
            <span class="sheet-carimbo-val">${escapeHTML(clientName)}</span>
          </div>
          <div class="sheet-carimbo-row">
            <span class="sheet-carimbo-label">Endereço:</span>
            <span class="sheet-carimbo-val">${escapeHTML(address)}</span>
          </div>
        </div>
        <div class="sheet-carimbo-norm" style="font-size:${Math.max(5.5, cfg.carimboTextPt - 1.2)}pt;">
          NACIF Solutions Eletric · Cálculo Paramétrico Elétrico · NBR 5410:2004 / IEC 60617 / ABNT NBR 10068
        </div>
      </div>
      <div class="sheet-carimbo-meta" style="width:${cfg.carimboMetaWidthMm}mm; font-size:${cfg.carimboTextPt}pt;">
        ${fields.map(([k, v]) => `
          <div class="sheet-carimbo-field">
            <span class="sheet-field-k">${k}</span>
            <span class="sheet-field-v">${v}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * Prepara o SVG para caber com enquadramento milimétrico na folha:
 */
function prepareSVG(svgContent) {
  if (!svgContent) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgContent;

    if (!svg.getAttribute("viewBox")) {
      const w = parseFloat(svg.getAttribute("width") || 1189);
      const h = parseFloat(svg.getAttribute("height") || 841);
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }

    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.display = "block";

    return new XMLSerializer().serializeToString(svg);
  } catch {
    return svgContent;
  }
}

/**
 * Impressão / Plotagem de Pranchas CAD e Diagramas SVG (Individual ou Múltiplas Folhas)
 */
export function openSVGPrint({ svgContent, svgContents, paperSize = "A4", projectName = "", logoUrl = "", projectInfo = {} }) {
  const cfg = getSheetConfig(paperSize);
  const rawList = Array.isArray(svgContents) && svgContents.length > 0 ? svgContents : (svgContent ? [svgContent] : []);
  const totalPages = rawList.length || 1;

  const isAnyFullCadSheet = rawList.some((content) =>
    /PRANCHA|QE-|QGBT-|TitleBlock|QUADRO DE CARGAS|DIAGRAMA UNIFILAR PRINCIPAL|data\.sheet/i.test(content)
  );

  const pagesHtml = rawList.map((content, idx) => {
    const isFullCad = /PRANCHA|QE-|QGBT-|TitleBlock|QUADRO DE CARGAS|DIAGRAMA UNIFILAR PRINCIPAL|data\.sheet/i.test(content);
    const prepared = prepareSVG(content);
    const infoWithSheet = {
      ...projectInfo,
      sheetNumber: `${idx + 1} / ${totalPages}`,
    };

    return `
      <div class="sheet-page">
        ${isFullCad ? `
          <div class="cad-prancha-wrap">
            ${prepared}
          </div>
        ` : `
          <div class="sheet-frame">
            <div class="drawing-area">${prepared}</div>
            ${buildTitleBlock(projectName, logoUrl, paperSize, infoWithSheet, idx + 1, totalPages, cfg)}
          </div>
        `}
      </div>
    `;
  }).join("");

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(projectName || "Projeto")} — Formato ${cfg.name}</title>
  <style>
    @page {
      size: ${cfg.w}mm ${cfg.h}mm landscape;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${cfg.w}mm;
      min-height: ${cfg.h}mm;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(8px);
      padding: 8px 18px;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
      color: white;
      font-size: 13px;
      font-weight: 600;
    }
    .print-btn {
      background: #00d8b8;
      color: #0f172a;
      border: none;
      font-weight: 800;
      padding: 6px 16px;
      border-radius: 9999px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .print-btn:hover {
      background: #00f0cc;
      transform: scale(1.04);
    }
    .close-btn {
      background: transparent;
      color: #94a3b8;
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 9999px;
      cursor: pointer;
      font-weight: 600;
    }
    .close-btn:hover {
      color: white;
      border-color: #64748b;
    }
    .sheet-page {
      width: ${cfg.w}mm;
      height: ${cfg.h}mm;
      max-width: ${cfg.w}mm;
      max-height: ${cfg.h}mm;
      padding: ${isAnyFullCadSheet ? "3mm" : `${cfg.margins.top}mm ${cfg.margins.right}mm ${cfg.margins.bottom}mm ${cfg.margins.left}mm`};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-sizing: border-box;
      background: white;
      margin: 20px auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      break-after: page;
      page-break-after: always;
    }
    .sheet-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .cad-prancha-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .cad-prancha-wrap svg {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      display: block;
      object-fit: contain;
    }
    .sheet-frame {
      flex: 1;
      width: 100%;
      height: 100%;
      border: ${cfg.borderWidth}px solid #1e293b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #ffffff;
      box-sizing: border-box;
    }
    .drawing-area {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: ${Math.round(2 * cfg.scale)}mm;
    }
    .drawing-area svg {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      display: block;
      object-fit: contain;
    }
    .sheet-carimbo {
      border-top: ${cfg.borderWidth}px solid #1e293b;
      display: flex;
      background: #ffffff;
      flex-shrink: 0;
      width: 100%;
      box-sizing: border-box;
    }
    .sheet-carimbo-logo {
      border-right: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5mm;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .sheet-carimbo-logo img {
      max-width: 90%;
      object-fit: contain;
    }
    .sheet-carimbo-main {
      flex: 1;
      border-right: 1px solid #1e293b;
      padding: ${Math.round(1.5 * cfg.scale)}mm ${Math.round(3 * cfg.scale)}mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      box-sizing: border-box;
    }
    .sheet-carimbo-title {
      font-weight: 800;
      color: ${WEG_BLUE};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.1;
    }
    .sheet-carimbo-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5mm;
      color: #1e293b;
    }
    .sheet-carimbo-row {
      display: flex;
      gap: 2mm;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-carimbo-label {
      font-weight: 700;
      color: #64748b;
      flex-shrink: 0;
    }
    .sheet-carimbo-val {
      font-weight: 600;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-carimbo-norm {
      color: #64748b;
      font-weight: 500;
    }
    .sheet-carimbo-meta {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      padding: ${Math.round(1 * cfg.scale)}mm ${Math.round(2.5 * cfg.scale)}mm;
      box-sizing: border-box;
    }
    .sheet-carimbo-field {
      display: flex;
      justify-content: space-between;
      border-bottom: 0.5px solid #e2e8f0;
      padding: 0.5px 0;
    }
    .sheet-field-k { color: #64748b; font-weight: 500; }
    .sheet-field-v { color: #0f172a; font-weight: 800; }

    @media print {
      .print-toolbar { display: none !important; }
      html, body {
        width: ${cfg.w}mm !important;
        height: ${cfg.h}mm !important;
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      .sheet-page {
        width: ${cfg.w}mm !important;
        height: ${cfg.h}mm !important;
        max-width: ${cfg.w}mm !important;
        max-height: ${cfg.h}mm !important;
        margin: 0 !important;
        padding: ${isAnyFullCadSheet ? "3mm !important" : `${cfg.margins.top}mm ${cfg.margins.right}mm ${cfg.margins.bottom}mm ${cfg.margins.left}mm !important`};
        break-after: page !important;
        page-break-after: always !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        overflow: hidden !important;
        box-shadow: none !important;
      }
      .sheet-page:last-child {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <span>📐 Formato ${cfg.name} (${cfg.w} × ${cfg.h} mm) · ${totalPages} Folha(s)</span>
    <button class="print-btn" onclick="window.print()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      Imprimir / Salvar PDF
    </button>
    <button class="close-btn" onclick="window.close()">Fechar</button>
  </div>
  ${pagesHtml}
</body>
</html>`);

  win.document.close();
  win.onload = () => {
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };
}

/**
 * Impressão HTML ABNT NBR 10068 / NBR 5410 com Enquadramento e Escala Adaptativa
 */
export function openHTMLPrint({
  htmlContent = "",
  items = [],
  totals = null,
  paperSize = "A4",
  projectName = "",
  documentTitle = "",
  subtitle = "",
  logoUrl = "",
  projectInfo = {},
}) {
  const cfg = getSheetConfig(paperSize);
  const docTitle = documentTitle || (projectName ? `Orçamento — ${projectName}` : "Orçamento Técnico");
  const docSub = subtitle || "Proposta gerada automaticamente · NACIF Solutions Eletric · NBR 5410:2004 / IEC 60617";

  let rowItems = Array.isArray(items) && items.length > 0 ? items : [];
  let totalsData = totals;
  let customThead = "";

  if (rowItems.length === 0 && htmlContent) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${htmlContent}</div>`, "text/html");
      const thead = doc.querySelector("thead");
      if (thead) customThead = thead.innerHTML;

      const trs = Array.from(doc.querySelectorAll("tbody tr"));
      if (trs.length > 0) {
        rowItems = trs.map((tr) => tr.outerHTML);
      }
    } catch {
      rowItems = [];
    }
  }

  const count = rowItems.length;

  // Paginação Inteligente: divide dinamicamente respeitando limites do formato
  const maxRowsSingle = count <= cfg.maxRowsFirstPage;
  let pages = [];

  if (maxRowsSingle || count <= cfg.maxRowsFirstPage) {
    pages.push({ rows: rowItems, isLast: true, pageIndex: 1 });
  } else {
    let remaining = [...rowItems];
    let pageNum = 1;
    while (remaining.length > 0) {
      const isFirst = pageNum === 1;
      const capacity = isFirst ? cfg.maxRowsFirstPage : cfg.maxRowsPerPage;
      const isFinal = remaining.length <= capacity;
      pages.push({
        rows: remaining.slice(0, capacity),
        isLast: isFinal,
        pageIndex: pageNum,
      });
      remaining = remaining.slice(capacity);
      pageNum++;
    }
  }

  const totalPages = pages.length;

  const defaultThead = `
    <tr>
      <th style="width:${Math.round(28 * cfg.scale)}px;text-align:center">Símb.</th>
      <th style="text-align:left">Material / Descrição Técnica</th>
      <th style="width:${Math.round(45 * cfg.scale)}px;text-align:center">Qtd.</th>
      <th style="width:${Math.round(45 * cfg.scale)}px;text-align:center">Unid.</th>
      <th style="width:${Math.round(80 * cfg.scale)}px;text-align:right">Valor Unitário</th>
      <th style="width:${Math.round(85 * cfg.scale)}px;text-align:right">Total</th>
    </tr>
  `;

  const formatBRL = (val = 0) => `R$ ${Number(val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderTotalsBlock = () => {
    if (!totalsData) {
      if (htmlContent.includes("totals")) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${htmlContent}</div>`, "text/html");
        const tot = doc.querySelector(".totals");
        if (tot) return `<div class="sheet-totals-box">${tot.innerHTML}</div>`;
      }
      return "";
    }

    if (totalsData.total !== undefined) {
      return `
        <div class="sheet-totals-box">
          <div class="sheet-totals-table" style="width:${cfg.totalsWidthMm}mm; font-size:${cfg.totalsFontPt}pt;">
            <div class="tot-row"><span>Materiais base:</span><span class="tot-val">${formatBRL(totalsData.baseMaterialTotal)}</span></div>
            ${totalsData.productAdjustment ? `<div class="tot-row"><span>Variação produtos (${totalsData.productAdjustment}%):</span><span class="tot-val">${formatBRL(totalsData.productAdjustmentValue)}</span></div>` : ""}
            <div class="tot-row"><span>Materiais ajustados:</span><span class="tot-val">${formatBRL(totalsData.materialTotal)}</span></div>
            <div class="tot-row"><span>Mão de Obra técnica:</span><span class="tot-val">${formatBRL(totalsData.laborCost)}</span></div>
            <div class="tot-row"><span>Margem (${totalsData.margin}%):</span><span class="tot-val">${formatBRL(totalsData.margin ? ((totalsData.materialTotal + totalsData.laborCost) * totalsData.margin / 100) : 0)}</span></div>
            <div class="tot-grand-row" style="font-size:${cfg.totalsFontPt + 1.6}pt;"><span>Total:</span><span class="tot-grand-val">${formatBRL(totalsData.total)}</span></div>
          </div>
        </div>
      `;
    }

    if (totalsData.referenceTotal !== undefined) {
      return `
        <div class="sheet-totals-box">
          <div class="sheet-totals-table" style="width:${cfg.totalsWidthMm}mm; font-size:${cfg.totalsFontPt}pt;">
            <div class="tot-row"><span>Total de Referência:</span><span class="tot-val">${formatBRL(totalsData.referenceTotal)}</span></div>
            ${totalsData.mixedTotal ? `<div class="tot-row"><span>Menor Preço Estimado IA:</span><span class="tot-val">${formatBRL(totalsData.mixedTotal)}</span></div>` : ""}
            ${totalsData.saving ? `<div class="tot-row" style="color:#059669;font-weight:bold;"><span>Economia Estimada:</span><span class="tot-val">${formatBRL(totalsData.saving)}</span></div>` : ""}
            ${totalsData.bestSingleSupplier ? `<div class="tot-row"><span>Melhor Fornecedor Único:</span><span class="tot-val">${escapeHTML(totalsData.bestSingleSupplier)}</span></div>` : ""}
          </div>
        </div>
      `;
    }

    return "";
  };

  const renderRow = (row) => {
    if (typeof row === "string") return row;
    const formatQty = (v) => (Number.isInteger(Number(v)) ? String(v) : Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
    const formatUnit = (u) => (!u || u === "un" ? "un." : u === "m" ? "m" : u);
    return `
      <tr>
        <td style="width:${Math.round(28 * cfg.scale)}px;text-align:center;padding:${cfg.tdPaddingMm}">
          ${row.imageUrl ? `<img src="${row.imageUrl}" alt="" style="width:${cfg.imgSizePx}px;height:${cfg.imgSizePx}px;object-fit:contain;display:inline-block;vertical-align:middle;" />` : "—"}
        </td>
        <td style="padding:${cfg.tdPaddingMm}">
          <div style="font-weight:700;color:#0f172a;line-height:1.2;">${escapeHTML(row.name)}</div>
          ${row.category ? `<span style="display:inline-block;font-size:${cfg.baseFontPt - 1.4}pt;text-transform:uppercase;font-weight:800;color:#64748b;background:#f1f5f9;padding:0.5px 3px;border-radius:2px;margin-top:1px;">${escapeHTML(row.category)}</span>` : ""}
          ${row.manual ? `<span style="display:inline-block;font-size:${cfg.baseFontPt - 1.4}pt;text-transform:uppercase;font-weight:800;color:#0d9488;background:#ccfbf1;padding:0.5px 3px;border-radius:2px;margin-top:1px;margin-left:2px;">manual</span>` : ""}
        </td>
        <td style="text-align:center;font-weight:700;padding:${cfg.tdPaddingMm}">${formatQty(row.qty)}</td>
        <td style="text-align:center;color:#64748b;padding:${cfg.tdPaddingMm}">${formatUnit(row.unit)}</td>
        <td style="text-align:right;padding:${cfg.tdPaddingMm}">${formatBRL(row.price)}</td>
        <td style="text-align:right;font-weight:800;color:${WEG_BLUE};padding:${cfg.tdPaddingMm}">${formatBRL(row.qty * row.price)}</td>
      </tr>
    `;
  };

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(docTitle)} — Formato ${cfg.name}</title>
  <style>
    @page {
      size: ${cfg.w}mm ${cfg.h}mm landscape;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${cfg.w}mm;
      min-height: ${cfg.h}mm;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: ${cfg.baseFontPt}pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-toolbar {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(8px);
      padding: 8px 18px;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
      color: white;
      font-size: 13px;
      font-weight: 600;
    }
    .print-btn {
      background: #00d8b8;
      color: #0f172a;
      border: none;
      font-weight: 800;
      padding: 6px 16px;
      border-radius: 9999px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .print-btn:hover {
      background: #00f0cc;
      transform: scale(1.04);
    }
    .close-btn {
      background: transparent;
      color: #94a3b8;
      border: 1px solid #334155;
      padding: 6px 12px;
      border-radius: 9999px;
      cursor: pointer;
      font-weight: 600;
    }
    .close-btn:hover {
      color: white;
      border-color: #64748b;
    }
    .sheet-page {
      width: ${cfg.w}mm;
      height: ${cfg.h}mm;
      max-width: ${cfg.w}mm;
      max-height: ${cfg.h}mm;
      padding: ${cfg.margins.top}mm ${cfg.margins.right}mm ${cfg.margins.bottom}mm ${cfg.margins.left}mm;
      display: flex;
      flex-direction: column;
      background: white;
      margin: 20px auto;
      overflow: hidden;
      box-sizing: border-box;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: ${totalPages > 1 ? "always" : "avoid"};
      break-after: ${totalPages > 1 ? "page" : "avoid"};
    }
    .sheet-frame {
      flex: 1;
      border: ${cfg.borderWidth}px solid #1e293b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #ffffff;
      height: 100%;
      max-height: 100%;
      box-sizing: border-box;
    }
    .sheet-header-banner {
      border-bottom: 1px solid #cbd5e1;
      padding: ${Math.round(1.5 * cfg.scale)}mm ${Math.round(3 * cfg.scale)}mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      flex-shrink: 0;
      height: ${cfg.headerHeightMm}mm;
    }
    .sheet-header-title {
      font-size: ${cfg.headerFontPt}pt;
      font-weight: 900;
      color: ${WEG_BLUE};
      line-height: 1.1;
    }
    .sheet-header-sub {
      font-size: ${cfg.headerSubFontPt}pt;
      color: #64748b;
      font-weight: 500;
      margin-top: 0.3mm;
    }
    .sheet-header-badge {
      display: flex;
      align-items: center;
      gap: 2mm;
    }
    .sheet-page-indicator {
      font-size: ${cfg.baseFontPt - 0.8}pt;
      font-weight: 800;
      color: #0f172a;
      background: #f1f5f9;
      padding: ${Math.round(0.6 * cfg.scale)}mm ${Math.round(2 * cfg.scale)}mm;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .sheet-table-wrap {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      padding: ${Math.round(1 * cfg.scale)}mm ${Math.round(2.5 * cfg.scale)}mm;
      display: flex;
      flex-direction: column;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${cfg.baseFontPt}pt;
    }
    th {
      background: ${WEG_BLUE};
      color: #ffffff;
      font-weight: 800;
      font-size: ${cfg.baseFontPt - 0.4}pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: ${cfg.thPaddingMm};
      border: none;
    }
    td {
      padding: ${cfg.tdPaddingMm};
      border-bottom: 0.5px solid #e2e8f0;
      vertical-align: middle;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .sheet-continuation {
      margin-top: auto;
      padding-top: 1mm;
      text-align: right;
      font-size: ${cfg.baseFontPt - 0.8}pt;
      font-weight: 800;
      color: ${WEG_BLUE};
      font-style: italic;
    }
    .sheet-totals-box {
      margin-top: auto;
      padding: ${Math.round(0.8 * cfg.scale)}mm ${Math.round(2.5 * cfg.scale)}mm ${Math.round(1 * cfg.scale)}mm ${Math.round(2.5 * cfg.scale)}mm;
      display: flex;
      justify-content: flex-end;
      background: #ffffff;
      flex-shrink: 0;
    }
    .sheet-totals-table {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: ${Math.round(1 * cfg.scale)}mm ${Math.round(2.5 * cfg.scale)}mm;
      display: flex;
      flex-direction: column;
      gap: ${Math.round(0.8 * cfg.scale)}mm;
    }
    .tot-row {
      display: flex;
      justify-content: space-between;
      color: #475569;
    }
    .tot-val {
      font-weight: 700;
      color: #0f172a;
    }
    .tot-grand-row {
      display: flex;
      justify-content: space-between;
      border-top: 1.5px solid ${WEG_BLUE};
      padding-top: 1mm;
      margin-top: 0.8mm;
      font-weight: 900;
      color: ${WEG_BLUE};
    }
    .tot-grand-val {
      font-weight: 900;
      color: ${WEG_BLUE};
    }
    .sheet-carimbo {
      border-top: ${cfg.borderWidth}px solid #1e293b;
      display: flex;
      background: #ffffff;
      flex-shrink: 0;
      width: 100%;
      box-sizing: border-box;
    }
    .sheet-carimbo-logo {
      border-right: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5mm;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .sheet-carimbo-logo img {
      max-width: 90%;
      object-fit: contain;
    }
    .sheet-carimbo-main {
      flex: 1;
      border-right: 1px solid #1e293b;
      padding: ${Math.round(1.2 * cfg.scale)}mm ${Math.round(2.8 * cfg.scale)}mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      box-sizing: border-box;
    }
    .sheet-carimbo-title {
      font-weight: 800;
      color: ${WEG_BLUE};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.1;
    }
    .sheet-carimbo-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5mm;
      color: #1e293b;
    }
    .sheet-carimbo-row {
      display: flex;
      gap: 2mm;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-carimbo-label {
      font-weight: 700;
      color: #64748b;
      flex-shrink: 0;
    }
    .sheet-carimbo-val {
      font-weight: 600;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-carimbo-norm {
      color: #64748b;
      font-weight: 500;
    }
    .sheet-carimbo-meta {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      padding: ${Math.round(1 * cfg.scale)}mm ${Math.round(2.5 * cfg.scale)}mm;
      box-sizing: border-box;
    }
    .sheet-carimbo-field {
      display: flex;
      justify-content: space-between;
      border-bottom: 0.5px solid #e2e8f0;
      padding: 0.5px 0;
    }
    .sheet-field-k { color: #64748b; font-weight: 500; }
    .sheet-field-v { color: #0f172a; font-weight: 800; }

    @media print {
      .print-toolbar { display: none !important; }
      html, body {
        width: ${cfg.w}mm !important;
        height: ${cfg.h}mm !important;
        max-height: ${cfg.h}mm !important;
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      .sheet-page {
        width: ${cfg.w}mm !important;
        height: ${cfg.h}mm !important;
        max-width: ${cfg.w}mm !important;
        max-height: ${cfg.h}mm !important;
        margin: 0 !important;
        padding: ${cfg.margins.top}mm ${cfg.margins.right}mm ${cfg.margins.bottom}mm ${cfg.margins.left}mm !important;
        break-after: ${totalPages > 1 ? "page" : "avoid"} !important;
        page-break-after: ${totalPages > 1 ? "always" : "avoid"} !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        box-shadow: none !important;
        overflow: hidden !important;
      }
      .sheet-page:last-child {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <span>📐 Formato ${cfg.name} (${cfg.w} × ${cfg.h} mm) · ${totalPages} Folha(s)</span>
    <button class="print-btn" onclick="window.print()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      Imprimir / Salvar PDF
    </button>
    <button class="close-btn" onclick="window.close()">Fechar</button>
  </div>
  ${pages.map((p, idx) => `
    <div class="sheet-page">
      <div class="sheet-frame">
        <div class="sheet-header-banner">
          <div>
            <div class="sheet-header-title">${escapeHTML(docTitle)}${totalPages > 1 ? ` — Folha ${idx + 1}/${totalPages}` : ""}</div>
            <div class="sheet-header-sub">${escapeHTML(docSub)}</div>
          </div>
          <div class="sheet-header-badge">
            <span class="sheet-page-indicator">Folha ${idx + 1} de ${totalPages}</span>
          </div>
        </div>

        <div class="sheet-table-wrap">
          <table>
            <thead>
              ${customThead || defaultThead}
            </thead>
            <tbody>
              ${p.rows.map(renderRow).join("")}
            </tbody>
          </table>

          ${!p.isLast ? `<div class="sheet-continuation">Continua na folha seguinte (${idx + 2}/${totalPages}) ➔</div>` : ""}
        </div>

        ${p.isLast ? renderTotalsBlock() : ""}

        ${buildTitleBlock(projectName, logoUrl, paperSize, projectInfo, idx + 1, totalPages, cfg)}
      </div>
    </div>
  `).join("")}
</body>
</html>`);

  win.document.close();
  win.onload = () => {
    win.focus();
    setTimeout(() => {
      win.print();
    }, 400);
  };
}
