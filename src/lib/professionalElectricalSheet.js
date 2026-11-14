import { jsPDF } from "jspdf";
import { calcProjectMetrics } from "./electricalEngine.js";
import { NACIF_SYMBOL_BASE64 } from "./solarLogoAsset.js";
import { PDF_THEME, PHASE_RGB } from "./unifilarPdfDrawer.js";

const SHEET = { w: 1189, h: 841 };
const C = {
  black: PDF_THEME.navy,
  slate900: PDF_THEME.slate900,
  slate700: PDF_THEME.slate700,
  slate500: PDF_THEME.slate500,
  slate200: PDF_THEME.slate200,
  slate50: PDF_THEME.slate50,
  gray: [130, 144, 164],
  grid: [215, 224, 236],
  blue: PDF_THEME.blue,
  teal: PDF_THEME.teal,
  tealDeep: PDF_THEME.tealDeep,
  tealSoft: PDF_THEME.tealSoft,
  cyan: [14, 116, 144],
  green: PDF_THEME.emerald,
  magenta: [124, 58, 237],
  red: PDF_THEME.red,
  amber: PDF_THEME.amber,
  amberSoft: PDF_THEME.amberSoft,
  yellow: [254, 249, 195],
};

const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const fmt = (value, digits = 1) => asNumber(value).toLocaleString("pt-BR", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const text = (doc, value, x, y, options = {}) => {
  if (Array.isArray(value)) {
    doc.text(value.map((line) => String(line ?? "")), x, y, options);
    return;
  }
  doc.text(String(value ?? ""), x, y, options);
};

const safeName = (value) => String(value || "projeto")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9_-]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 80) || "projeto";

function feederGauge(current) {
  const table = [
    [50, 10], [70, 16], [100, 25], [150, 35], [200, 50],
    [250, 70], [320, 95], [380, 120], [460, 150], [540, 185],
  ];
  return (table.find(([limit]) => current <= limit) || table[table.length - 1])[1];
}

function drawRect(doc, x, y, w, h, color = C.black, width = 0.5) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.rect(x, y, w, h);
}

export function drawSheetFrame(doc, mode = "unifilar") {
  // Faixa Executiva Superior NACIF (y=8..50, preservando a área útil y=55..824 intacta)
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(6, 8, SHEET.w - 12, 38, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(6, 46, SHEET.w - 12, 4, "F");

  try {
    doc.addImage(NACIF_SYMBOL_BASE64, "PNG", 18, 13, 28, 28, undefined, "FAST");
  } catch {}

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PDF_THEME.white);
  text(doc, "NACIF ENERGY — PROJETO EXECUTIVO DE ENGENHARIA ELÉTRICA", 56, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_THEME.teal);
  text(
    doc,
    mode === "unifilar"
      ? "DIAGRAMA UNIFILAR DE QUADROS, BARRAMENTOS E PLANILHA DE DIMENSIONAMENTO · ABNT NBR 5410"
      : "PRANCHA EXECUTIVA DE INSTALAÇÕES ELÉTRICAS EM PLANTA BAIXA · ABNT NBR 5410",
    56,
    38
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_THEME.white);
  text(doc, "FORMATO ABNT A0 (1189 × 841 mm)", SHEET.w - 20, 24, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(190, 206, 226);
  text(doc, "DOCUMENTAÇÃO TÉCNICA PADRONIZADA · NBR 10068 / NBR 5410", SHEET.w - 20, 37, { align: "right" });

  // Moldura principal da prancha (mesmas coordenadas de contorno para compatibilidade)
  drawRect(doc, 6, 55, SHEET.w - 12, SHEET.h - 72, C.black, 0.85);
  if (mode === "unifilar") {
    doc.setDrawColor(...C.black);
    doc.setLineWidth(0.5);
    doc.line(444, 55, 444, SHEET.h - 17);
    doc.line(444, 535, SHEET.w - 6, 535);
    doc.line(910, 535, 910, SHEET.h - 17);
  }
}

export function drawTitleBlock(doc, project = {}, title = "PROJETO EXECUTIVO") {
  const x = 910;
  const y = 535;
  const w = SHEET.w - x - 6; // 273 mm
  const h = SHEET.h - y - 17; // 289 mm
  doc.setFillColor(...PDF_THEME.white);
  doc.rect(x, y, w, h, "F");
  drawRect(doc, x, y, w, h, C.black, 0.85);

  const clientName = project.client_name || project.client || project.clientName || "CLIENTE";
  const address = project.address || project.project_address || "ENDERECO DA OBRA";
  const projectName = project.name || project.projectName || "PROJETO ELETRICO";
  const responsible = project.responsible || project.engineer_name || project.engineer || "ENGENHEIRO ELETRICISTA";
  const revision = project.revision || "00";
  const sheetCode = project.sheetCode || project.sheet_number || "EL-01 / R00";
  const scaleText = project.scale || "INDICADA";
  const currentDate = new Date().toLocaleDateString("pt-BR");

  // Alturas normatizadas somando exatamente 289 mm:
  // 18 + 30 + 30 + 32 + 32 + 28 + 40 + 32 + 47 = 289 mm
  let cy = y;

  // 1. Linha de Revisão / Emissão (18 mm)
  doc.setFillColor(...C.slate50);
  doc.rect(x, cy, w, 18, "F");
  drawRect(doc, x, cy, w, 18, C.black, 0.4);
  doc.line(x + 38, cy, x + 38, cy + 18);
  doc.line(x + 118, cy, x + 118, cy + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.black);
  text(doc, revision, x + 19, cy + 11.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  text(doc, currentDate, x + 78, cy + 11.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.tealDeep);
  text(doc, "EMISSÃO INICIAL PARA EXECUÇÃO", x + 124, cy + 11.5);
  cy += 18;

  // 2. Cliente (30 mm)
  drawRect(doc, x, cy, w, 30, C.black, 0.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "CLIENTE:", x + 5, cy + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.slate900);
  text(doc, clientName.slice(0, 36), x + 5, cy + 22);
  cy += 30;

  // 3. Endereço (30 mm)
  drawRect(doc, x, cy, w, 30, C.black, 0.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "ENDEREÇO DA OBRA:", x + 5, cy + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  doc.setTextColor(...C.slate900);
  const addrLines = doc.splitTextToSize(address || "", w - 12);
  text(doc, addrLines.slice(0, 2), x + 5, cy + 21);
  cy += 30;

  // 4. Projetista (32 mm)
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(x, cy, w, 32, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(x, cy, 4, 32, "F");
  drawRect(doc, x, cy, w, 32, C.black, 0.4);
  try {
    doc.addImage(NACIF_SYMBOL_BASE64, "PNG", x + w - 28, cy + 5, 22, 22, undefined, "FAST");
  } catch {}
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_THEME.teal);
  text(doc, "PROJETISTA / ENGENHARIA RESPONSÁVEL:", x + 8, cy + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(...PDF_THEME.white);
  text(doc, "NACIF ENERGY", x + 8, cy + 20.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(190, 206, 226);
  text(doc, "Da Planta ao Sol · NBR 5410 / NBR 16690", x + 8, cy + 28);
  cy += 32;

  // 5. Nome do Projeto (32 mm)
  drawRect(doc, x, cy, w, 32, C.black, 0.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "NOME DO PROJETO:", x + 5, cy + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.slate900);
  const projLines = doc.splitTextToSize(projectName || "", w - 12);
  text(doc, projLines.slice(0, 2), x + 5, cy + 22);
  cy += 32;

  // 6. Disciplina (28 mm)
  drawRect(doc, x, cy, w, 28, C.black, 0.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "DISCIPLINA / SUB-DISCIPLINA:", x + 5, cy + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.slate900);
  text(doc, "SISTEMA DE INSTALAÇÕES ELÉTRICAS", x + 5, cy + 21);
  cy += 28;

  // 7. Título do Desenho (40 mm)
  doc.setFillColor(...C.slate50);
  doc.rect(x, cy, w, 40, "F");
  drawRect(doc, x, cy, w, 40, C.black, 0.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.slate500);
  text(doc, "TÍTULO DO DESENHO:", x + 5, cy + 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.setTextColor(...C.blue);
  const titleLines = doc.splitTextToSize(title || "PROJETO EXECUTIVO", w - 12);
  text(doc, titleLines.slice(0, 2), x + 5, cy + 24);
  cy += 40;

  // 8. Responsável Técnico (32 mm)
  drawRect(doc, x, cy, w, 32, C.black, 0.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "RESPONSÁVEL TÉCNICO:", x + 5, cy + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...C.slate900);
  text(doc, responsible, x + 5, cy + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "CREA / CFT REGISTRADO · CONSELHO REGIONAL", x + 5, cy + 27.5);
  cy += 32;

  // 9. Metadados e Prancha (47 mm)
  drawRect(doc, x, cy, w, 47, C.black, 0.4);
  doc.line(x + 78, cy, x + 78, cy + 47);
  doc.line(x + 162, cy, x + 162, cy + 47);

  // Coluna Data
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "DATA:", x + 5, cy + 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...C.slate900);
  text(doc, currentDate, x + 5, cy + 30);

  // Coluna Escala
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "ESCALA:", x + 83, cy + 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...C.slate900);
  text(doc, scaleText, x + 83, cy + 30);

  // Coluna Prancha / Revisão
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.slate500);
  text(doc, "PRANCHA / REVISÃO:", x + 167, cy + 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...C.blue);
  text(doc, sheetCode, x + 167, cy + 35);
}

function drawBreakerSymbol(doc, x, y, amp, poles = 1, curve = "C", side = "right") {
  const dir = side === "right" ? 1 : -1;
  doc.setDrawColor(...C.slate900);
  doc.setLineWidth(0.55);
  doc.line(x, y, x + dir * 7, y);

  // Caixa normativa IEC de disjuntor termomagnético
  const bx = dir === 1 ? x + 7 : x - 21;
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...C.blue);
  doc.rect(bx, y - 3.6, 14, 7.2, "FD");
  doc.setDrawColor(...C.slate900);
  doc.line(bx + 2.5, y + 2, bx + 11.5, y - 2);
  doc.line(x + dir * 21, y, x + dir * 28, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...C.slate900);
  text(doc, `${amp || 16}A ${poles}P-${curve}`, x + dir * 30, y + 1.8, { align: side === "right" ? "left" : "right" });
}

function drawBusbarDiagram(doc, project, metrics) {
  const circuits = metrics.circuits || [];
  const x = 20;
  const y = 65;
  const w = 410;
  const h = 690;
  const center = x + w / 2 + 10;
  const top = y + 185;
  const bottom = y + h - 50;
  const supply = project.supply_type || "Trifasico";
  const hasPolyphaseCircuits = circuits.some((circuit) =>
    circuit.supply_type === "Trifásico" ||
    circuit.supply_type === "Bifásico" ||
    String(circuit.phase || "").length > 1
  );
  const isTri = supply === "Trifásico" || hasPolyphaseCircuits;
  const isBi = supply === "Bifásico";
  const phaseLabels = isTri ? ["R", "S", "T", "N", "PE"] : isBi ? ["R", "S", "N", "PE"] : ["F", "N", "PE"];
  const feederPhaseCount = isTri ? 3 : isBi ? 2 : 1;
  const busSpacing = phaseLabels.length >= 5 ? 30 : 34;
  const busXs = phaseLabels.map((_, i) => center + (i - (phaseLabels.length - 1) / 2) * busSpacing);
  const phaseIndexFor = (phase = "A") => {
    const value = String(phase || "A");
    if ((value.includes("B") || value.includes("S")) && feederPhaseCount >= 2) return 1;
    if ((value.includes("C") || value.includes("T")) && feederPhaseCount >= 3) return 2;
    return 0;
  };

  // Moldura do painel do Diagrama Unifilar de Barramentos
  doc.setFillColor(...C.slate50);
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.6);
  doc.rect(x - 6, y, w + 10, 32, "FD");
  doc.setFillColor(...C.navy || C.black);
  doc.rect(x - 6, y, w + 10, 26, "F");
  doc.setFillColor(...C.teal);
  doc.rect(x - 6, y + 24, w + 10, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_THEME.white);
  doc.setFontSize(12);
  const sheetTitle = supply === "Trifásico" ? "DIAGRAMA UNIFILAR — QGBT" : "DIAGRAMA UNIFILAR — QDC";
  const panelName = (project.panel_name || project.name || "QUADRO").toUpperCase();
  text(doc, `${sheetTitle} · ${panelName}`.slice(0, 56), center - 10, y + 16, { align: "center" });

  // Alimentador Geral superior + Disjuntor Geral + IDR
  const fg = feederGauge(metrics.generalCurrent || metrics.generalBreaker || 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.slate700);
  text(doc, `ALIMENTAÇÃO PRINCIPAL: ${supply.toUpperCase()} ${project.voltage || 220}V · CABO ${fg}mm²`, center - 10, y + 54, { align: "center" });

  // Caixa do Disjuntor Geral no topo dos barramentos
  const mainY = top - 34;
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(center - 68, mainY - 12, 136, 22, "F");
  doc.setFillColor(...C.teal);
  doc.rect(center - 68, mainY - 12, 3, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.white);
  text(doc, `DISJUNTOR GERAL: ${metrics.generalBreaker || 50}A (${isTri ? "3P" : "2P"} Curva C)`, center, mainY - 2, { align: "center" });
  doc.setFontSize(7.2);
  doc.setTextColor(...C.teal);
  text(
    doc,
    metrics.generalDr ? `IDR GERAL: ${metrics.generalDr}A / 30mA` : `BARRAMENTO ${phaseLabels.join(" + ")}`,
    center,
    mainY + 6,
    { align: "center" }
  );

  const busColors = {
    R: PHASE_RGB.A,
    F: PHASE_RGB.A,
    S: PHASE_RGB.B,
    T: PHASE_RGB.C,
    N: [14, 116, 144],
    PE: [21, 128, 61],
  };

  phaseLabels.forEach((label, i) => {
    const col = busColors[label] || C.black;
    doc.setFillColor(...col);
    doc.rect(busXs[i] - 7, y + 128, 14, 15, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(label.length > 1 ? 8.5 : 10);
    doc.setTextColor(...PDF_THEME.white);
    text(doc, label, busXs[i], y + 138.5, { align: "center" });

    doc.setDrawColor(...col);
    doc.setLineWidth(label === "PE" ? 1.0 : 1.4);
    if (label === "PE") doc.setLineDashPattern([4, 2], 0);
    doc.line(busXs[i], top, busXs[i], bottom);
    doc.setLineDashPattern([], 0);
  });

  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.9);
  doc.line(busXs[0] - 28, bottom, busXs[busXs.length - 1] + 28, bottom);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.slate500);
  text(doc, "BARRAMENTO DE INTERLIGAÇÃO E RESERVA DIN", center - 10, bottom + 10, { align: "center" });

  // Bloco DPS Classe II normativo
  const sideLabelLeft = phaseLabels.length >= 5 ? "R / S / T" : phaseLabels[0];
  const sideLabelRight = phaseLabels.includes("PE") ? "N / PE" : phaseLabels[phaseLabels.length - 1];
  doc.setTextColor(...C.slate900);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  text(doc, sideLabelLeft, x + 74, y + 151, { align: "right" });
  text(doc, sideLabelRight, x + w - 120, y + 151);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  text(doc, `${fg}mm²`, x + 102, y + 151);
  text(doc, `${fg}mm²`, x + w - 78, y + 151);

  doc.setDrawColor(...C.red);
  doc.setLineWidth(0.5);
  Array.from({ length: feederPhaseCount }).forEach((_, phaseIdx) => {
    const yy = top + 34 + phaseIdx * 13;
    doc.line(x + 68, yy, busXs[phaseIdx], yy);
    doc.setFillColor(...C.green);
    doc.circle(x + 68, yy, 1.8, "F");
    doc.circle(busXs[phaseIdx], yy, 1.8, "F");
    doc.setFillColor(...PDF_THEME.redSoft);
    doc.rect(x + 80, yy - 3.2, 46, 6.4, "F");
    doc.setTextColor(...C.red);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    text(doc, "DPS 275V/20kA", x + 103, yy + 1.5, { align: "center" });
  });

  const minVisibleRows = 14;
  const displayRows = [
    ...circuits.slice(0, 28).map((circuit) => ({ type: "circuit", circuit })),
    ...Array.from({ length: Math.max(0, minVisibleRows - Math.min(circuits.length, 28)) }, (_, index) => ({
      type: "reserve",
      label: `Reserva ${index + 1}`,
    })),
  ].slice(0, 28);
  const branchStart = top + 88;
  const spacing = Math.min(30, Math.max(12, (bottom - branchStart - 36) / Math.max(displayRows.length - 1, 1)));
  displayRows.forEach((rowData, index) => {
    const circuit = rowData.circuit;
    const side = index % 2 === 0 ? "left" : "right";
    const yy = branchStart + index * spacing;
    
    // Determine all phase indices this row connects to
    let connectedIndices = [0];
    if (rowData.type === "circuit") {
      const phStr = String(circuit.phase || "A").toUpperCase();
      const isTri = circuit.supply_type === "Trifásico" || phStr === "ABC";
      const isBi = circuit.supply_type === "Bifásico" || (circuit.supply_type !== "Monofásico" && phStr.length === 2);
      
      const tmp = [];
      if (isTri || isBi || phStr.includes("A") || phStr.includes("R") || phStr.includes("F")) {
        tmp.push(0);
      }
      if ((isTri || isBi || phStr.includes("B") || phStr.includes("S")) && feederPhaseCount >= 2) {
        tmp.push(1);
      }
      if ((isTri || phStr.includes("C") || phStr.includes("T")) && feederPhaseCount >= 3) {
        tmp.push(2);
      }
      if (tmp.length > 0) {
        connectedIndices = tmp;
      }
    }
    
    const bx = busXs[connectedIndices[0]];
    const outX = side === "left" ? busXs[0] - 62 : busXs[busXs.length - 1] + 62;
    const labelX = side === "left" ? x + 8 : x + w - 8;

    // Draw the connection line starting from the furthest connected phase
    const lineStartX = rowData.type === "circuit"
      ? (side === "left"
          ? busXs[Math.max(...connectedIndices)]
          : busXs[Math.min(...connectedIndices)])
      : bx;

    if (rowData.type === "reserve") {
      doc.setDrawColor(199, 203, 209);
      doc.setLineDashPattern([4, 3], 0);
    } else {
      doc.setDrawColor(...C.gray);
      doc.setLineDashPattern([], 0);
    }
    doc.setLineWidth(0.35);
    doc.line(lineStartX, yy, outX, yy);
    doc.setLineDashPattern([], 0);

    if (rowData.type === "circuit") {
      doc.setFillColor(...C.green);
      connectedIndices.forEach((idx) => {
        doc.circle(busXs[idx], yy, 1.7, "F");
      });
      doc.circle(outX, yy, 1.7, "F");
      drawBreakerSymbol(
        doc,
        outX,
        yy,
        circuit.breaker_a,
        circuit.breaker_poles || connectedIndices.length || 1,
        circuit.breaker_curve || "C",
        side === "left" ? "left" : "right"
      );
    } else {
      doc.setDrawColor(199, 203, 209);
      doc.circle(bx, yy, 1.45, "S");
      doc.circle(outX, yy, 1.45, "S");
    }

    doc.setFont("helvetica", rowData.type === "circuit" ? "bold" : "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(...(rowData.type === "circuit" ? C.slate900 : [139, 147, 161]));
    const label = rowData.type === "circuit"
      ? `C${String(index + 1).padStart(2, "0")} [${String(circuit.phase || "A")}] ${(circuit.name || circuit.type || "CIRCUITO").toUpperCase()} (${circuit.wire_gauge || "2.5mm²"})`
      : rowData.label;
    text(doc, label.slice(0, 48), labelX, yy - 4.8, { align: side === "left" ? "left" : "right" });
  });

  if (circuits.length > 28) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.red);
    text(doc, `${circuits.length - 28} circuito(s) adicionais listados na planilha`, center, bottom - 22, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.black);
  text(doc, `MEMÓRIA DE CÁLCULO — ${panelName}`.toUpperCase(), center - 10, bottom + 34, { align: "center" });
}

function drawDimensioningTable(doc, metrics) {
  const circuits = metrics.circuits || [];
  const x = 455;
  const y = 95;
  const w = 715;
  const rowH = 9.5;
  const widths = [30, 135, 48, 34, 28, 44, 28, 44, 78, 38, 48, 44, 44, 44, 28];
  const headers = ["Circuito", "Descrição", "Potência (W)", "Tensão", "FP", "Ib (A)", "Fc", "Iaj (A)", "Disjuntor", "Queda", "Condutor", "Fase A", "Fase B", "Fase C", "Mód."];

  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(x, y - 16, w, 13, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(x, y - 4.5, w, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...PDF_THEME.white);
  text(doc, "PLANILHA DE DIMENSIONAMENTO DE CARGAS E CIRCUITOS DO QUADRO (ABNT NBR 5410)", x + w / 2, y - 7.5, { align: "center" });

  let cx = x;
  doc.setFillColor(...C.slate50);
  doc.rect(x, y - 3, w, rowH, "F");
  doc.setTextColor(...C.slate900);
  doc.setFontSize(5.9);
  headers.forEach((header, i) => {
    doc.setDrawColor(...C.slate200);
    doc.rect(cx, y - 3, widths[i], rowH);
    text(doc, header, cx + widths[i] / 2, y + 3.0, { align: "center" });
    cx += widths[i];
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  circuits.slice(0, 22).forEach((c, index) => {
    const yy = y + 6.5 + index * rowH;
    const phaseA = (c.phase || "").includes("A") ? Math.round(c.power_w || 0) : "";
    const phaseB = (c.phase || "").includes("B") ? Math.round(c.power_w || 0) : "";
    const phaseC = (c.phase || "").includes("C") ? Math.round(c.power_w || 0) : "";
    const poles = c.breaker_poles || (c.phase?.length > 1 ? c.phase.length : 1);
    const breakerText = c.breaker_label || `${c.breaker_a || 16}A ${poles}P Curva ${c.breaker_curve || "C"}`;
    const row = [
      `C${String(index + 1).padStart(2, "0")}`,
      (c.name || c.type || "Circuito").toUpperCase().slice(0, 32),
      Math.round(c.power_w || 0),
      c.voltage || 220,
      fmt(c.power_factor ?? 0.92, 2),
      fmt(c.project_current_a, 2),
      fmt(c.group_factor || 1, 2),
      fmt(c.corrected_current_a, 2),
      breakerText,
      `${fmt(c.voltage_drop_pct, 1)}%`,
      c.wire_gauge || "2.5mm²",
      phaseA,
      phaseB,
      phaseC,
      c.din_modules || 1,
    ];

    cx = x;
    row.forEach((cell, i) => {
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(cx, yy, widths[i], rowH, "F");
      }
      if (i === 8 && asNumber(c.breaker_a) >= 40) {
        doc.setFillColor(...PDF_THEME.amberSoft);
        doc.rect(cx, yy, widths[i], rowH, "F");
      } else if (i >= 11 && i <= 13 && cell !== "") {
        doc.setFillColor(...C.tealSoft);
        doc.rect(cx, yy, widths[i], rowH, "F");
      }
      doc.setDrawColor(...C.slate200);
      doc.rect(cx, yy, widths[i], rowH);
      doc.setTextColor(...C.slate900);
      if (i === 0) doc.setFont("helvetica", "bold");
      else doc.setFont("helvetica", "normal");
      const align = i === 1 ? "left" : "center";
      const tx = align === "left" ? cx + 3 : cx + widths[i] / 2;
      text(doc, String(cell), tx, yy + 6.2, { align });
      cx += widths[i];
    });
  });

  const totalY = y + 6.5 + Math.min(circuits.length, 22) * rowH;
  const phaseColStartX = x + widths.slice(0, 11).reduce((s, item) => s + item, 0);
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(phaseColStartX - 120, totalY, 120, rowH, "F");
  doc.setTextColor(...PDF_THEME.white);
  doc.setFont("helvetica", "bold");
  text(doc, "BALANCEAMENTO (W / A)", phaseColStartX - 60, totalY + 6.2, { align: "center" });
  doc.setFillColor(...C.tealSoft);
  ["A", "B", "C"].forEach((ph, index) => {
    doc.setDrawColor(...C.teal);
    doc.rect(phaseColStartX + index * 44, totalY, 44, rowH, "FD");
    doc.setTextColor(...C.tealDeep);
    text(doc, `${fmt(metrics.phaseLoad?.[ph] || 0, 1)} A`, phaseColStartX + index * 44 + 22, totalY + 6.2, { align: "center" });
  });
}

function drawCharacteristics(doc, project, metrics) {
  const x = 460;
  let y = 552;
  const cardW = 434;
  const cardH = 258;
  doc.setFillColor(...C.slate50);
  doc.setDrawColor(...C.slate200);
  doc.setLineWidth(0.5);
  doc.rect(x, y, cardW, cardH, "FD");
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(x, y, cardW, 24, "F");
  doc.setFillColor(...C.teal);
  doc.rect(x, y + 24, cardW, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_THEME.white);
  text(doc, "CARACTERÍSTICAS TÉCNICAS GERAIS DO QUADRO", x + 12, y + 16);

  const current = metrics.generalCurrent || 0;
  const gauge = feederGauge(current || metrics.generalBreaker || 50);
  const supply = project.supply_type || "Trifásico";
  const phases = supply === "Trifásico" ? "3F+N+T" : supply === "Bifásico" ? "2F+N+T" : "F+N+T";
  const rows = [
    ["ORIGEM:", project.panel_name || project.name || "QUADRO DE DISTRIBUIÇÃO"],
    ["CARGA INSTALADA:", `${fmt((metrics.totalPower || 0) / 1000, 2)} kVA`],
    ["TENSÃO NOMINAL:", `${supply.toUpperCase()} ${project.voltage || 220}V · 60Hz`],
    ["CORRENTE DE PROJETO:", `${fmt(current, 1)} A`],
    ["PROTEÇÃO GERAL:", `DISJUNTOR TERMOMAG. ${supply === "Trifásico" ? "TRIPOLAR" : "BIPOLAR"} DE ${metrics.generalBreaker || 0}A`],
    ["BARRAMENTO:", `${phases} — CAPACIDADE ${Math.max(80, metrics.generalBreaker || 80)}A`],
    ["CONDUTORES ALIM.:", `FASES #${gauge}mm² · NEUTRO #${gauge}mm² XLPE 90°C`],
    ["CONDUTOR TERRA (PE):", `#${Math.max(10, Math.round(gauge / 2))}mm² COBRE ISOLADO VERDE/AMARELO`],
    ["ESPACAMENTO DIN:", `QUADRO ${metrics.panelSize || 24} MÓDULOS DIN (C/ RESERVA 20%)`],
  ];

  let ry = y + 46;
  rows.forEach(([label, value], idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(...PDF_THEME.white);
      doc.rect(x + 8, ry - 11, cardW - 16, 17, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.tealDeep);
    text(doc, label, x + 14, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.slate900);
    text(doc, String(value).slice(0, 42), x + 150, ry);
    ry += 22;
  });
}

function drawNotes(doc, metrics) {
  const x = 455;
  const y = 370;
  const w = 438;
  const h = 148;
  doc.setFillColor(...C.slate50);
  doc.setDrawColor(...C.slate200);
  doc.rect(x, y, w, h, "FD");
  doc.setFillColor(...C.teal);
  doc.rect(x, y, 4, h, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  text(doc, "NOTAS TÉCNICAS E REQUISITOS NORMATIVOS (ABNT NBR 5410)", x + 12, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.slate700);
  const notes = [
    "1. Condutores dimensionados conforme ABNT NBR 5410, considerando queda de tensão máxima, método de instalação e fator de agrupamento.",
    "2. Seção mínima adotada: 1,5mm² para circuitos de iluminação e 2,5mm² para tomadas (TUG/TUE) e circuitos de força.",
    "3. Confirmar capacidade de interrupção (Icu/Icn), método de instalação e identificação permanente dos circuitos antes da energização.",
    "4. Executar ensaios de continuidade do condutor de proteção (PE), resistência de isolação e atuação do IDR após a montagem.",
  ];
  let cy = y + 32;
  notes.forEach((note) => {
    const lines = doc.splitTextToSize(note, w - 24);
    text(doc, lines, x + 12, cy);
    cy += lines.length * 8.5 + 5;
  });

  const warnings = (metrics.validations || []).slice(0, 3);
  if (warnings.length > 0) {
    doc.setTextColor(...C.red);
    doc.setFont("helvetica", "bold");
    text(doc, "PENDÊNCIAS / ALERTAS DE PROJETO:", x + 12, cy + 5);
    doc.setFont("helvetica", "normal");
    warnings.forEach((warning, index) => {
      text(doc, `${index + 1}. ${warning.msg}`.slice(0, 96), x + 12, cy + 16 + index * 8.5);
    });
  }
}

export function buildProfessionalElectricalSheetDoc(project, metricsArg) {
  if (!project) return null;
  const metrics = metricsArg || calcProjectMetrics(project);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [SHEET.w, SHEET.h], compress: true });
  const title = "DIAGRAMA UNIFILAR E MEMÓRIA DE CÁLCULO DO QUADRO";

  doc.setProperties({
    title: `${project.name || "Projeto"} - Projeto Executivo Elétrico`,
    subject: "Prancha executiva A0 de diagrama unifilar e memória de cálculo",
    creator: "NACIF Energy",
  });

  drawSheetFrame(doc);
  drawBusbarDiagram(doc, project, metrics);
  drawDimensioningTable(doc, metrics);
  drawNotes(doc, metrics);
  drawCharacteristics(doc, project, metrics);
  drawTitleBlock(doc, project, title);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.slate500);
  text(doc, "NACIF ENERGY · ARQUIVO EXECUTIVO GERADO AUTOMATICAMENTE · VALIDAR POR ENGENHEIRO RESPONSÁVEL ANTES DA EMISSÃO.", 12, SHEET.h - 7);
  return doc;
}

export function downloadProfessionalElectricalSheet(project, metricsArg) {
  const doc = buildProfessionalElectricalSheetDoc(project, metricsArg);
  if (!doc) return;
  doc.save(`projeto_executivo_${safeName(project.name)}_A0.pdf`);
}
