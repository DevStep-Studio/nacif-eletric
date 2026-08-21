/**
 * Utilitário de impressão ABNT NBR 10068 — NACIF Solutions Eletric
 * Folhas: A4, A3, A2, A1, A0 · Paisagem · Margens ABNT
 * Garante que o conteúdo caiba exatamente na folha selecionada.
 */
import { DEFAULT_LOGO_URL, WEG_BLUE } from "@/lib/brandingDefaults";

// Dimensões em mm (paisagem: width > height)
export const PAPER_SIZES = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
  A2: { w: 594, h: 420 },
  A1: { w: 841, h: 594 },
  A0: { w: 1189, h: 841 },
};

// Margens ABNT NBR 10068 (mm)
const M = { top: 5, right: 5, bottom: 5, left: 25 };
// Altura do bloco de legenda (mm)
const TITLE_H = 36;

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildTitleBlock(projectName, logoUrl, paperSize, projectInfo = {}) {
  const date = new Date().toLocaleDateString("pt-BR");
  const displayLogo = logoUrl || DEFAULT_LOGO_URL;
  const clientName = projectInfo.clientName || projectInfo.client_name || projectInfo.client || "";
  const address = projectInfo.address || projectInfo.project_address || "";
  const fields = [
    ["Formato", paperSize],
    ["Data", date],
    ["Escala", "S/E"],
    ["Rev.", "01"],
    ["Folha", "1 / 1"],
  ];
  return `
    <div style="
      border:1px solid #333; border-bottom:none;
      display:flex; height:${TITLE_H}mm; font-family:Arial,sans-serif;
      font-size:8pt; background:white; flex-shrink:0;
    ">
      <div style="width:34mm;border-right:1px solid #333;display:flex;align-items:center;justify-content:center;padding:3mm;flex-shrink:0;">
        <img src="${displayLogo}" style="max-height:22mm;max-width:30mm;object-fit:contain;" />
      </div>
      <div style="flex:1;border-right:1px solid #333;padding:2mm 4mm;display:flex;flex-direction:column;justify-content:space-around;min-width:0;">
        <div style="font-size:11pt;font-weight:bold;color:${WEG_BLUE};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(projectName || "PROJETO")}</div>
        <div style="display:grid;grid-template-columns:18mm minmax(0,1fr);gap:1mm 2mm;font-size:7pt;color:#333;line-height:1.2;">
          <span style="font-weight:bold;color:#555;">Cliente:</span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(clientName || "—")}</span>
          <span style="font-weight:bold;color:#555;">Endereço:</span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(address || "—")}</span>
        </div>
        <div style="font-size:7pt;color:#555;">NACIF Solutions Eletric · Cálculo Paramétrico Elétrico · NBR 5410:2004 / IEC 60617 / ABNT</div>
      </div>
      <div style="width:42mm;flex-shrink:0;display:flex;flex-direction:column;justify-content:space-around;padding:2mm 3mm;border-left:1px solid #333;">
        ${fields.map(([k, v]) => `
          <div style="display:flex;justify-content:space-between;border-bottom:0.5px solid #ddd;padding:1px 0;font-size:7pt;">
            <span style="color:#666;">${k}</span>
            <span style="font-weight:bold;">${v}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/**
 * Prepara o SVG para caber na área útil da folha:
 * - Garante atributo viewBox
 * - Substitui width/height por 100% para deixar o CSS controlar
 */
function prepareSVG(svgContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return svgContent;

  // Garante viewBox a partir de width/height se não existir
  if (!svg.getAttribute("viewBox")) {
    const w = parseFloat(svg.getAttribute("width") || 800);
    const h = parseFloat(svg.getAttribute("height") || 600);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }

  // Deixa CSS controlar o tamanho
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.display = "block";

  return new XMLSerializer().serializeToString(svg);
}

export function openSVGPrint({ svgContent, paperSize = "A4", projectName = "", logoUrl = "", projectInfo = {} }) {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
  // Área útil (mm) após margens ABNT
  const areaW = paper.w - M.left - M.right;   // largura útil
  const areaH = paper.h - M.top  - M.bottom;  // altura útil total
  const svgH  = areaH - TITLE_H - 2;          // altura para o SVG (2mm gap)

  const preparedSVG = prepareSVG(svgContent);
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(projectName)} — ${paperSize}</title>
  <style>
    @page {
      /* As medidas já estão em paisagem. Acrescentar landscape a duas
         dimensões torna a declaração inválida e o navegador volta para A4 retrato. */
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
      font-family: Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: ${paper.w}mm;
      height: ${paper.h}mm;
      padding: ${M.top}mm ${M.right}mm ${M.bottom}mm ${M.left}mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    /* Borda da área de desenho */
    .drawing-border {
      flex: 1;
      border: 1px solid #333;
      display: flex;
      align-items: stretch;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
      /* altura exata disponível para o SVG */
      max-height: ${svgH}mm;
    }
    .drawing-border svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .title-block {
      flex-shrink: 0;
      margin-top: 2mm;
    }
    @media print {
      html, body { width: ${paper.w}mm; height: ${paper.h}mm; min-height: 0; }
      .page { width: ${paper.w}mm; height: ${paper.h}mm; }
      .page { break-after: page; page-break-after: always; }
      .page:last-child { break-after: auto; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="drawing-border">${preparedSVG}</div>
    <div class="title-block">${buildTitleBlock(projectName, logoUrl, paperSize, projectInfo)}</div>
  </div>
</body>
</html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

export function openHTMLPrint({ htmlContent, paperSize = "A4", projectName = "", logoUrl = "", projectInfo = {} }) {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.A4;
  const areaW = paper.w - M.left - M.right;
  const areaH = paper.h - M.top  - M.bottom;
  const contentH = areaH - TITLE_H - 2;

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(projectName)} — ${paperSize}</title>
  <style>
    @page {
      /* A largura maior que a altura já define a orientação paisagem. */
      size: ${paper.w}mm ${paper.h}mm;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${paper.w}mm;
      min-height: ${paper.h}mm;
      background: white;
      font-family: Arial, sans-serif;
      font-size: 9pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: ${paper.w}mm;
      min-height: ${paper.h}mm;
      padding: ${M.top}mm ${M.right}mm ${M.bottom}mm ${M.left}mm;
      display: flex;
      flex-direction: column;
      break-after: page;
      page-break-after: always;
    }
    .content {
      flex: 1;
      border: 1px solid #333;
      padding: 4mm;
      overflow: visible;
      min-height: ${contentH}mm;
    }
    .title-block {
      flex-shrink: 0;
      margin-top: 2mm;
    }
    h2 { font-size: 12pt; color: ${WEG_BLUE}; margin-bottom: 4pt; }
    p.sub { font-size: 8pt; color: #666; margin-bottom: 5pt; }
    table { width: 100%; border-collapse: collapse; font-size: 8pt; page-break-inside: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    th { background: ${WEG_BLUE}; color: white; padding: 3px 5px; text-align: left; }
    td { padding: 2px 5px; border-bottom: 0.5px solid #e0e0e0; }
    tr, img, .totals, .total-row, .grand-total {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    tr:nth-child(even) td { background: #f7f9fc; }
    .totals { margin-top: 5pt; display: flex; flex-direction: column; align-items: flex-end; gap: 2pt; }
    .total-row { display: flex; gap: 14px; font-size: 8pt; }
    .grand-total { font-size: 10pt; font-weight: bold; color: ${WEG_BLUE}; margin-top: 3pt; }
    @media print {
      html, body { width: ${paper.w}mm; min-height: ${paper.h}mm; }
      .page { width: ${paper.w}mm; min-height: ${paper.h}mm; }
      .page { break-after: page; page-break-after: always; }
      .page:last-child { break-after: auto; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="content">${htmlContent}</div>
    <div class="title-block">${buildTitleBlock(projectName, logoUrl, paperSize, projectInfo)}</div>
  </div>
</body>
</html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}
