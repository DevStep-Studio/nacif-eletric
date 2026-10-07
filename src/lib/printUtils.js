/**
 * Utilitário de impressão e plotagem ABNT NBR 10068 / NBR 5410 — NACIF Solutions Eletric
 * Folhas: A4, A3, A2, A1, A0 · Paisagem · Margens Técnicas ABNT
 * Garante enquadramento milimétrico, paginação automática sem cortes e carimbo técnico padronizado.
 */
import { DEFAULT_LOGO_URL, WEG_BLUE } from "./brandingDefaults.js";

// Dimensões em mm (paisagem: width > height)
export const PAPER_SIZES = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
  A2: { w: 594, h: 420 },
  A1: { w: 841, h: 594 },
  A0: { w: 1189, h: 841 },
};

// Margens de segurança ABNT para plotagem/impressão física (mm)
// Margem esquerda de 20mm para fixação/furação, 8mm nas demais bordas para evitar cortes em qualquer impressora
const M = { top: 8, right: 8, bottom: 8, left: 20 };
// Altura da legenda / carimbo técnico inferior (mm)
const TITLE_H = 32;

function escapeHTML(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTitleBlock(projectName, logoUrl, paperSize, projectInfo = {}, pageIndex = 1, totalPages = 1) {
  const date = new Date().toLocaleDateString("pt-BR");
  const displayLogo = logoUrl || DEFAULT_LOGO_URL;
  const clientName = projectInfo.clientName || projectInfo.client_name || projectInfo.client || "";
  const address = projectInfo.address || projectInfo.project_address || "";
  const fields = [
    ["Formato", paperSize],
    ["Data", date],
    ["Escala", "S/E"],
    ["Rev.", "01"],
    ["Folha", `${pageIndex} / ${totalPages}`],
  ];

  return `
    <div class="sheet-carimbo">
      <div class="sheet-carimbo-logo">
        <img src="${displayLogo}" alt="NACIF ELETRIC" />
      </div>
      <div class="sheet-carimbo-main">
        <div class="sheet-carimbo-title">${escapeHTML(projectName || "PROJETO ELÉTRICO")}</div>
        <div class="sheet-carimbo-grid">
          <div class="sheet-carimbo-row">
            <span class="sheet-carimbo-label">Cliente:</span>
            <span class="sheet-carimbo-val">${escapeHTML(clientName || "—")}</span>
          </div>
          <div class="sheet-carimbo-row">
            <span class="sheet-carimbo-label">Endereço:</span>
            <span class="sheet-carimbo-val">${escapeHTML(address || "—")}</span>
          </div>
        </div>
        <div class="sheet-carimbo-norm">NACIF Solutions Eletric · Cálculo Paramétrico Elétrico · NBR 5410:2004 / IEC 60617 / ABNT</div>
      </div>
      <div class="sheet-carimbo-meta">
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
 * Prepara o SVG para caber na área útil da folha sem cortes:
 */
function prepareSVG(svgContent) {
  if (!svgContent) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgContent;

    if (!svg.getAttribute("viewBox")) {
      const w = parseFloat(svg.getAttribute("width") || 800);
      const h = parseFloat(svg.getAttribute("height") || 600);
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

export function openSVGPrint({ svgContent, paperSize = "A4", projectName = "", logoUrl = "", projectInfo = {} }) {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
  const preparedSVG = prepareSVG(svgContent);
  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(projectName)} — ${paperSize}</title>
  <style>
    @page {
      size: ${paper.w}mm ${paper.h}mm;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${paper.w}mm;
      height: ${paper.h}mm;
      min-height: 0;
      overflow: hidden;
      background: white;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet-page {
      width: ${paper.w}mm;
      height: ${paper.h}mm;
      padding: ${M.top}mm ${M.right}mm ${M.bottom}mm ${M.left}mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    }
    .sheet-frame {
      flex: 1;
      border: 1.5px solid #1e293b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #ffffff;
      height: 100%;
      box-sizing: border-box;
    }
    .drawing-area {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: stretch;
      justify-content: center;
      overflow: hidden;
      padding: 2mm;
    }
    .drawing-area svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .sheet-carimbo {
      height: ${TITLE_H}mm;
      border-top: 1.5px solid #1e293b;
      display: flex;
      background: #ffffff;
      flex-shrink: 0;
      width: 100%;
      box-sizing: border-box;
    }
    .sheet-carimbo-logo {
      width: 36mm;
      border-right: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2mm;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .sheet-carimbo-logo img {
      max-height: 22mm;
      max-width: 32mm;
      object-fit: contain;
    }
    .sheet-carimbo-main {
      flex: 1;
      border-right: 1px solid #1e293b;
      padding: 2mm 3.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      box-sizing: border-box;
    }
    .sheet-carimbo-title {
      font-size: 10pt;
      font-weight: 800;
      color: ${WEG_BLUE};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-carimbo-grid {
      display: flex;
      flex-direction: column;
      gap: 1mm;
      font-size: 7pt;
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
      width: 16mm;
      flex-shrink: 0;
    }
    .sheet-carimbo-val {
      font-weight: 600;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-carimbo-norm {
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 500;
    }
    .sheet-carimbo-meta {
      width: 44mm;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      padding: 1.5mm 3mm;
      box-sizing: border-box;
    }
    .sheet-carimbo-field {
      display: flex;
      justify-content: space-between;
      border-bottom: 0.5px solid #e2e8f0;
      padding: 0.5px 0;
      font-size: 7pt;
    }
    .sheet-field-k { color: #64748b; font-weight: 500; }
    .sheet-field-v { color: #0f172a; font-weight: 800; }
    @media print {
      html, body { width: ${paper.w}mm; height: ${paper.h}mm; }
      .sheet-page { break-after: page; page-break-after: always; }
      .sheet-page:last-child { break-after: auto; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="sheet-page">
    <div class="sheet-frame">
      <div class="drawing-area">${preparedSVG}</div>
      ${buildTitleBlock(projectName, logoUrl, paperSize, projectInfo, 1, 1)}
    </div>
  </div>
</body>
</html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

/**
 * Função de Impressão HTML Multi-páginas ABNT com enquadramento perfeito
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
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
  const displayLogo = logoUrl || DEFAULT_LOGO_URL;
  const docTitle = documentTitle || (projectName ? `Orçamento — ${projectName}` : "Orçamento Técnico");
  const docSub = subtitle || "Proposta gerada automaticamente · NACIF Solutions Eletric · NBR 5410:2004 / IEC 60617";

  // Se items não foram passados diretamente mas htmlContent contém uma tabela HTML,
  // faz o parse dos rows e totals para paginar perfeitamente.
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

  // Capacidade de itens por folha para garantir que NUNCA haja corte vertical
  const isA3 = paper.w >= 400;
  const maxRowsFirstPage = isA3 ? 24 : 13; // Página com Totais
  const maxRowsMiddlePage = isA3 ? 32 : 17; // Página contínua (sem Totais)

  let pages = [];
  if (rowItems.length === 0) {
    pages.push({ rows: [], isLast: true, pageIndex: 1 });
  } else if (rowItems.length <= maxRowsFirstPage) {
    pages.push({ rows: rowItems, isLast: true, pageIndex: 1 });
  } else {
    // Paginação dinâmica
    let remaining = [...rowItems];
    let pIdx = 1;
    while (remaining.length > 0) {
      const isFinal = remaining.length <= maxRowsFirstPage;
      const takeCount = isFinal ? remaining.length : maxRowsMiddlePage;
      const chunk = remaining.slice(0, takeCount);
      remaining = remaining.slice(takeCount);
      pages.push({
        rows: chunk,
        isLast: remaining.length === 0,
        pageIndex: pIdx,
      });
      pIdx += 1;
    }
  }

  const totalPages = pages.length;

  const defaultThead = `
    <tr>
      <th style="width:36px;text-align:center">Símb.</th>
      <th style="text-align:left">Material / Descrição Técnica</th>
      <th style="width:55px;text-align:center">Qtd.</th>
      <th style="width:55px;text-align:center">Unid.</th>
      <th style="width:90px;text-align:right">Valor Unitário</th>
      <th style="width:95px;text-align:right">Total</th>
    </tr>
  `;

  const formatBRL = (val = 0) => `R$ ${Number(val || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const renderTotalsBlock = () => {
    if (!totalsData) {
      // Se não passou totalsData mas htmlContent tinha totals, tenta extrair
      if (htmlContent.includes("totals")) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${htmlContent}</div>`, "text/html");
        const tot = doc.querySelector(".totals");
        if (tot) return `<div class="sheet-totals-box">${tot.innerHTML}</div>`;
      }
      return "";
    }

    // Totais estruturados do orçamento
    if (totalsData.total !== undefined) {
      return `
        <div class="sheet-totals-box">
          <div class="sheet-totals-table">
            <div class="tot-row"><span>Materiais base:</span><span class="tot-val">${formatBRL(totalsData.baseMaterialTotal)}</span></div>
            ${totalsData.productAdjustment ? `<div class="tot-row"><span>Variação produtos (${totalsData.productAdjustment}%):</span><span class="tot-val">${formatBRL(totalsData.productAdjustmentValue)}</span></div>` : ""}
            <div class="tot-row"><span>Materiais ajustados:</span><span class="tot-val">${formatBRL(totalsData.materialTotal)}</span></div>
            <div class="tot-row"><span>Mão de Obra técnica:</span><span class="tot-val">${formatBRL(totalsData.laborCost)}</span></div>
            <div class="tot-row"><span>BDI / Margem (${totalsData.margin}%):</span><span class="tot-val">${formatBRL(totalsData.margin ? ((totalsData.materialTotal + totalsData.laborCost) * totalsData.margin / 100) : 0)}</span></div>
            <div class="tot-grand-row"><span>TOTAL GERAL:</span><span class="tot-grand-val">${formatBRL(totalsData.total)}</span></div>
          </div>
        </div>
      `;
    }

    // Totais de Lista de Materiais
    if (totalsData.referenceTotal !== undefined) {
      return `
        <div class="sheet-totals-box">
          <div class="sheet-totals-table">
            <div class="tot-row"><span>Total de Referência:</span><span class="tot-val">${formatBRL(totalsData.referenceTotal)}</span></div>
            ${totalsData.mixedTotal ? `<div class="tot-row"><span>Menor Preço Estimado IA:</span><span class="tot-val">${formatBRL(totalsData.mixedTotal)}</span></div>` : ""}
            ${totalsData.saving ? `<div class="tot-row" style="color:#059669;font-weight:bold;"><span>Economia Estimada:</span><span class="tot-val">${formatBRL(totalsData.saving)}</span></div>` : ""}
            ${totalsData.bestSingleSupplier ? `<div class="tot-row"><span>Melhor Fornecedor Único:</span><span class="tot-val">${totalsData.bestSingleSupplier}</span></div>` : ""}
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
        <td style="width:36px;text-align:center">
          ${row.imageUrl ? `<img src="${row.imageUrl}" alt="" style="width:24px;height:24px;object-fit:contain;display:inline-block;vertical-align:middle;" />` : "—"}
        </td>
        <td>
          <div style="font-weight:700;color:#0f172a;line-height:1.2;">${escapeHTML(row.name)}</div>
          ${row.category ? `<span style="display:inline-block;font-size:6pt;text-transform:uppercase;font-weight:800;color:#64748b;background:#f1f5f9;padding:0.5px 3px;border-radius:2px;margin-top:1px;">${escapeHTML(row.category)}</span>` : ""}
          ${row.manual ? `<span style="display:inline-block;font-size:6pt;text-transform:uppercase;font-weight:800;color:#0d9488;background:#ccfbf1;padding:0.5px 3px;border-radius:2px;margin-top:1px;margin-left:2px;">manual</span>` : ""}
        </td>
        <td style="text-align:center;font-weight:700;">${formatQty(row.qty)}</td>
        <td style="text-align:center;color:#64748b;">${formatUnit(row.unit)}</td>
        <td style="text-align:right;">${formatBRL(row.price)}</td>
        <td style="text-align:right;font-weight:800;color:${WEG_BLUE};">${formatBRL(row.qty * row.price)}</td>
      </tr>
    `;
  };

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(docTitle)} — ${paperSize}</title>
  <style>
    @page {
      size: ${paper.w}mm ${paper.h}mm;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${paper.w}mm;
      background: #f1f5f9;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet-page {
      width: ${paper.w}mm;
      height: ${paper.h}mm;
      padding: ${M.top}mm ${M.right}mm ${M.bottom}mm ${M.left}mm;
      display: flex;
      flex-direction: column;
      background: white;
      margin: 0 auto 10px auto;
      overflow: hidden;
      box-sizing: border-box;
      break-after: page;
      page-break-after: always;
    }
    .sheet-page:last-child {
      margin-bottom: 0;
      break-after: auto;
      page-break-after: auto;
    }
    .sheet-frame {
      flex: 1;
      border: 1.5px solid #1e293b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #ffffff;
      height: 100%;
      box-sizing: border-box;
    }
    .sheet-header-banner {
      border-bottom: 1px solid #cbd5e1;
      padding: 2.5mm 4mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      flex-shrink: 0;
    }
    .sheet-header-title {
      font-size: 11.5pt;
      font-weight: 900;
      color: ${WEG_BLUE};
      line-height: 1.2;
    }
    .sheet-header-sub {
      font-size: 7pt;
      color: #64748b;
      font-weight: 500;
      margin-top: 0.5mm;
    }
    .sheet-header-badge {
      display: flex;
      align-items: center;
      gap: 3mm;
    }
    .sheet-page-indicator {
      font-size: 7.5pt;
      font-weight: 800;
      color: #0f172a;
      background: #f1f5f9;
      padding: 1mm 2.5mm;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }
    .sheet-table-wrap {
      flex: 1;
      min-height: 0;
      overflow: hidden;
      padding: 2mm 3.5mm;
      display: flex;
      flex-direction: column;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
    }
    th {
      background: ${WEG_BLUE};
      color: #ffffff;
      font-weight: 800;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 2mm 2.5mm;
      border: none;
    }
    td {
      padding: 1.8mm 2.5mm;
      border-bottom: 0.5px solid #e2e8f0;
      vertical-align: middle;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .sheet-continuation {
      margin-top: auto;
      padding-top: 1.5mm;
      text-align: right;
      font-size: 7pt;
      font-weight: 800;
      color: ${WEG_BLUE};
      font-style: italic;
    }
    .sheet-totals-box {
      margin-top: auto;
      padding: 2mm 3.5mm 2.5mm 3.5mm;
      display: flex;
      justify-content: flex-end;
      background: #ffffff;
      flex-shrink: 0;
    }
    .sheet-totals-table {
      width: 75mm;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 2mm 3mm;
      display: flex;
      flex-direction: column;
      gap: 1mm;
    }
    .tot-row {
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
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
      padding-top: 1.5mm;
      margin-top: 1mm;
      font-size: 8.5pt;
      font-weight: 900;
      color: ${WEG_BLUE};
    }
    .tot-grand-val {
      font-weight: 900;
      color: ${WEG_BLUE};
    }
    .sheet-carimbo {
      height: ${TITLE_H}mm;
      border-top: 1.5px solid #1e293b;
      display: flex;
      background: #ffffff;
      flex-shrink: 0;
      width: 100%;
      box-sizing: border-box;
    }
    .sheet-carimbo-logo {
      width: 36mm;
      border-right: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2mm;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .sheet-carimbo-logo img {
      max-height: 22mm;
      max-width: 32mm;
      object-fit: contain;
    }
    .sheet-carimbo-main {
      flex: 1;
      border-right: 1px solid #1e293b;
      padding: 2mm 3.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-width: 0;
      box-sizing: border-box;
    }
    .sheet-carimbo-title {
      font-size: 10pt;
      font-weight: 800;
      color: ${WEG_BLUE};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-carimbo-grid {
      display: flex;
      flex-direction: column;
      gap: 1mm;
      font-size: 7pt;
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
      width: 16mm;
      flex-shrink: 0;
    }
    .sheet-carimbo-val {
      font-weight: 600;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet-carimbo-norm {
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 500;
    }
    .sheet-carimbo-meta {
      width: 44mm;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      padding: 1.5mm 3mm;
      box-sizing: border-box;
    }
    .sheet-carimbo-field {
      display: flex;
      justify-content: space-between;
      border-bottom: 0.5px solid #e2e8f0;
      padding: 0.5px 0;
      font-size: 7pt;
    }
    .sheet-field-k { color: #64748b; font-weight: 500; }
    .sheet-field-v { color: #0f172a; font-weight: 800; }
    @media print {
      html, body {
        width: ${paper.w}mm !important;
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .sheet-page {
        width: ${paper.w}mm !important;
        height: ${paper.h}mm !important;
        margin: 0 !important;
        padding: ${M.top}mm ${M.right}mm ${M.bottom}mm ${M.left}mm !important;
        break-after: page !important;
        page-break-after: always !important;
        box-shadow: none !important;
      }
      .sheet-page:last-child {
        break-after: auto !important;
        page-break-after: auto !important;
      }
    }
  </style>
</head>
<body>
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

        ${buildTitleBlock(projectName, logoUrl, paperSize, projectInfo, idx + 1, totalPages)}
      </div>
    </div>
  `).join("")}
</body>
</html>`);

  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}
