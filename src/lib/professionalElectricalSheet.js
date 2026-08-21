import { jsPDF } from "jspdf";
import { calcProjectMetrics } from "@/lib/electricalEngine";

const SHEET = { w: 1189, h: 841 };
const C = {
  black: [0, 0, 0],
  gray: [150, 150, 150],
  grid: [215, 215, 215],
  blue: [84, 92, 255],
  cyan: [0, 168, 215],
  green: [0, 190, 38],
  magenta: [255, 92, 255],
  red: [255, 0, 0],
  yellow: [255, 255, 0],
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
  drawRect(doc, 6, 55, SHEET.w - 12, SHEET.h - 72, C.black, 0.75);
  if (mode === "unifilar") {
    doc.setLineWidth(0.45);
    doc.line(444, 55, 444, SHEET.h - 17);
    doc.line(444, 535, SHEET.w - 6, 535);
    doc.line(910, 535, 910, SHEET.h - 17);
  }
}

export function drawTitleBlock(doc, project, title) {
  const x = 910;
  const y = 535;
  const w = SHEET.w - x - 6;
  const h = SHEET.h - y - 17;
  drawRect(doc, x, y, w, h, C.black, 0.65);

  const rows = [
    { h: 24, cells: ["00", new Date().toLocaleDateString("pt-BR"), "EMISSAO INICIAL"] },
    { h: 36, cells: ["CLIENTE:", project.client_name || "CLIENTE"] },
    { h: 38, cells: ["ENDERECO:", project.address || "ENDERECO DA OBRA"] },
    { h: 38, cells: ["PROJETISTA:", "VOLT AI / ENGENHARIA"] },
    { h: 40, cells: ["NOME DO PROJETO:", project.name || "PROJETO ELETRICO"] },
    { h: 40, cells: ["DISCIPLINA / SUB-DISCIPLINA:", "SISTEMA DE INSTALACOES ELETRICAS"] },
    { h: 50, cells: ["TITULO DO DESENHO:", title] },
    { h: 30, cells: ["RESPONSAVEL DO PROJETO:", "ENGENHEIRO ELETRICISTA"] },
    { h: 24, cells: ["DATA:", "ESCALA:", "PRANCHA / REVISAO:"] },
  ];

  let cy = y;
  doc.setFont("helvetica", "normal");
  rows.forEach((row, i) => {
    drawRect(doc, x, cy, w, row.h, C.black, 0.35);
    doc.setFontSize(i === 5 ? 14.5 : 13);
    doc.setTextColor(...C.black);

    if (row.cells.length === 3) {
      const cw = w / 3;
      row.cells.forEach((cell, idx) => {
        if (idx > 0) doc.line(x + idx * cw, cy, x + idx * cw, cy + row.h);
        doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
        doc.setFontSize(i === rows.length - 1 ? 12.5 : 12);
        text(doc, cell, x + idx * cw + 5, cy + row.h / 2 + 2);
      });
    } else {
      doc.setFont("helvetica", "bold");
      text(doc, row.cells[0], x + 5, cy + 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(i === 6 ? 18 : 15.5);
      const lines = doc.splitTextToSize(row.cells[1] || "", w - 14);
      text(doc, lines.slice(0, 3), x + 5, cy + 23);
    }
    cy += row.h;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  text(doc, new Date().toLocaleDateString("pt-BR"), x + 5, h + y - 8);
  text(doc, "SEM ESCALA", x + 94, h + y - 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  text(doc, "201/R00", x + w - 70, h + y - 8);
}

function drawBreakerSymbol(doc, x, y, amp, side = "right") {
  doc.setDrawColor(...C.magenta);
  doc.setTextColor(...C.magenta);
  doc.setLineWidth(0.45);
  const dir = side === "right" ? 1 : -1;
  doc.line(x, y, x + dir * 9, y);
  doc.line(x + dir * 9, y, x + dir * 16, y - 6);
  doc.line(x + dir * 16, y, x + dir * 25, y);
  doc.setFontSize(5.6);
  text(doc, `${amp || 16}A`, x + dir * 28, y + 2, { align: side === "right" ? "left" : "right" });
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

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.black);
  doc.setFontSize(12.5);
  const sheetTitle = supply === "Trifásico" ? "QUADRO GERAL DE BAIXA TENSAO" : "QUADRO DE FORCA E ILUMINACAO";
  const panelName = (project.panel_name || project.name || "QUADRO").toUpperCase();
  text(doc, `${sheetTitle} - ${panelName}`.slice(0, 58), center, y + 77, { align: "center" });

  const fg = feederGauge(metrics.generalCurrent || metrics.generalBreaker || 50);
  doc.setFontSize(9.5);
  text(doc, `${fg}mm²`, center, y + 109, { align: "center" });

  phaseLabels.forEach((label, i) => {
    doc.setFontSize(label.length > 1 ? 10.5 : 13);
    doc.setTextColor(...C.black);
    text(doc, label, busXs[i], y + 139, { align: "center" });
    doc.setDrawColor(...C.gray);
    doc.setLineWidth(0.45);
    doc.line(busXs[i], top, busXs[i], bottom);
  });
  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.65);
  doc.line(busXs[0] - 28, bottom, busXs[busXs.length - 1] + 28, bottom);

  const sideLabelLeft = phaseLabels.length >= 5 ? "R/S/T" : phaseLabels[0];
  const sideLabelRight = phaseLabels.includes("PE") ? "N / PE" : phaseLabels[phaseLabels.length - 1];
  doc.setTextColor(...C.black);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11.5);
  text(doc, sideLabelLeft, x + 74, y + 151, { align: "right" });
  text(doc, sideLabelRight, x + w - 120, y + 151);
  doc.setFontSize(9);
  text(doc, `${fg}mm²`, x + 102, y + 151);
  text(doc, `${fg}mm²`, x + w - 78, y + 151);

  doc.setDrawColor(...C.gray);
  doc.setLineWidth(0.4);
  Array.from({ length: feederPhaseCount }).forEach((_, phaseIdx) => {
    const yy = top + 34 + phaseIdx * 13;
    doc.line(x + 68, yy, busXs[phaseIdx], yy);
    doc.setFillColor(...C.green);
    doc.circle(x + 68, yy, 1.6, "F");
    doc.circle(busXs[phaseIdx], yy, 1.6, "F");
    doc.setTextColor(...C.red);
    doc.setFontSize(5.7);
    doc.setFont("helvetica", "bold");
    text(doc, "275V/20kA", x + 88, yy + 1.4);
  });

  doc.setTextColor(...C.magenta);
  doc.setFontSize(5.7);
  text(doc, `${metrics.generalBreaker || 50}A`, busXs[Math.max(0, feederPhaseCount - 1)] + 26, top - 18);
  const mainTop = top - 20;
  for (let i = 0; i < feederPhaseCount; i++) {
    doc.setDrawColor(...C.magenta);
    doc.ellipse(busXs[i], mainTop, 8, 3.2, "S");
  }

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
        doc.circle(busXs[idx], yy, 1.6, "F");
      });
      doc.circle(outX, yy, 1.6, "F");
      drawBreakerSymbol(doc, outX, yy, circuit.breaker_a, side === "left" ? "left" : "right");
    } else {
      doc.setDrawColor(199, 203, 209);
      doc.circle(bx, yy, 1.45, "S");
      doc.circle(outX, yy, 1.45, "S");
    }

    doc.setFont("courier", "normal");
    doc.setFontSize(5.7);
    doc.setTextColor(...(rowData.type === "circuit" ? C.blue : [139, 147, 161]));
    const label = rowData.type === "circuit"
      ? `C${String(index + 1).padStart(2, "0")}F-${String(circuit.phase || "A")} - ${(circuit.name || circuit.type || "CIRCUITO").toUpperCase()}`
      : rowData.label;
    text(doc, label.slice(0, 52), labelX, yy - 4.8, { align: side === "left" ? "left" : "right" });
  });

  if (circuits.length > 28) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C.red);
    text(doc, `${circuits.length - 28} circuito(s) adicionais listados na planilha`, center, bottom - 22, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.black);
  text(doc, `MEMORIA DE CALCULO - ${panelName}`.toUpperCase(), center, bottom + 34, { align: "center" });
}

function drawDimensioningTable(doc, metrics) {
  const circuits = metrics.circuits || [];
  const x = 455;
  const y = 135;
  const w = 715;
  const rowH = 9;
  const widths = [34, 139, 45, 38, 42, 40, 46, 52, 46, 54, 44, 44, 44, 37];
  const headers = ["Circuito", "Descricao", "Pva (W)", "Tensao", "In (A)", "Fc", "Iaj(A)", "Disjuntor", "Queda", "Condutor", "Fase A", "Fase B", "Fase C", "Espaco"];

  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.35);
  doc.setFillColor(...C.cyan);
  doc.rect(x, y - 11, w, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  doc.setTextColor(...C.black);
  text(doc, "Planilha de dimensionamento de carga do quadro", x + w / 2, y - 5.2, { align: "center" });

  let cx = x;
  doc.setFillColor(245, 245, 245);
  doc.rect(x, y - 3, w, rowH, "F");
  headers.forEach((header, i) => {
    doc.rect(cx, y - 3, widths[i], rowH);
    text(doc, header, cx + widths[i] / 2, y + 2.6, { align: "center" });
    cx += widths[i];
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  circuits.slice(0, 22).forEach((c, index) => {
    const yy = y + 6 + index * rowH;
    const phaseA = (c.phase || "").includes("A") ? Math.round(c.power_w || 0) : "";
    const phaseB = (c.phase || "").includes("B") ? Math.round(c.power_w || 0) : "";
    const phaseC = (c.phase || "").includes("C") ? Math.round(c.power_w || 0) : "";
    const row = [
      `C${String(index + 1).padStart(2, "0")}`,
      (c.name || c.type || "Circuito").toUpperCase().slice(0, 32),
      Math.round(c.power_w || 0),
      c.voltage || 220,
      fmt(c.project_current_a, 1),
      fmt(c.group_factor || 1, 2),
      fmt(c.corrected_current_a, 1),
      `${c.breaker_a || 16}A`,
      `${fmt(c.voltage_drop_pct, 1)}%`,
      c.wire_gauge || "2.5mm²",
      phaseA,
      phaseB,
      phaseC,
      c.din_modules || 1,
    ];

    cx = x;
    row.forEach((cell, i) => {
      if (i === 7 && asNumber(c.breaker_a) >= 40) {
        doc.setFillColor(...C.red);
        doc.rect(cx, yy, widths[i], rowH, "F");
      } else if (i >= 10 && cell !== "") {
        doc.setFillColor(...C.yellow);
        doc.rect(cx, yy, widths[i], rowH, "F");
      }
      doc.setDrawColor(...C.black);
      doc.rect(cx, yy, widths[i], rowH);
      doc.setTextColor(...C.black);
      text(doc, String(cell), cx + widths[i] / 2, yy + 5.8, { align: "center" });
      cx += widths[i];
    });
  });

  const totalY = y + 6 + Math.min(circuits.length, 22) * rowH;
  doc.setFillColor(...C.cyan);
  doc.rect(x + 360, totalY, 150, rowH, "F");
  doc.setFont("helvetica", "bold");
  text(doc, "Balanceamento", x + 435, totalY + 5.8, { align: "center" });
  doc.setFillColor(...C.yellow);
  ["A", "B", "C"].forEach((ph, index) => {
    doc.rect(x + 510 + index * 44, totalY, 44, rowH, "F");
    text(doc, fmt(metrics.phaseLoad?.[ph] || 0, 1), x + 532 + index * 44, totalY + 5.8, { align: "center" });
  });
}

function drawCharacteristics(doc, project, metrics) {
  const x = 475;
  let y = 575;
  const current = metrics.generalCurrent || 0;
  const gauge = feederGauge(current || metrics.generalBreaker || 50);
  const supply = project.supply_type || "Trifásico";
  const phases = supply === "Trifásico" ? "3F+N+T" : supply === "Bifásico" ? "2F+N+T" : "F+N+T";
  const rows = [
    ["ORIGEM:", project.panel_name || project.name || "QUADRO DE DISTRIBUICAO"],
    ["CARGA INSTALADA:", `${fmt((metrics.totalPower || 0) / 1000, 2)} kVA`],
    ["TENSAO NOMINAL:", `${supply.toUpperCase()} ${project.voltage || 220}V`],
    ["CORRENTE NOMINAL:", `${fmt(current, 0)}A`],
    ["PROTECAO GERAL:", `DISJUNTOR TERMOMAG. ${supply === "Trifásico" ? "TRIPOLAR" : "BIPOLAR"} DE ${metrics.generalBreaker || 0}A`],
    ["BARRAMENTO:", `${phases} DE ${Math.max(80, metrics.generalBreaker || 80)}A`],
    ["CONDUTORES:", `FASES - #${gauge}mm2 XLPE OU HPE`],
    ["", `NEUTRO - #${gauge}mm2 XLPE OU HPE`],
    ["", `TERRA - #${Math.max(10, Math.round(gauge / 2))}mm2 XLPE OU HPE`],
    ["QUADRO:", `DIN - ${metrics.panelSize || 24} MODULOS`],
  ];

  doc.setFont("courier", "normal");
  doc.setFontSize(14);
  doc.setTextColor(...C.red);
  text(doc, "CARACTERISTICAS:", x, y);
  y += 22;
  doc.setFontSize(12);
  rows.forEach(([label, value]) => {
    if (label) text(doc, label, x, y);
    text(doc, value, x + 145, y);
    y += 17;
  });
}

function drawNotes(doc, metrics) {
  const x = 455;
  const y = 365;
  const w = 360;
  const h = 135;
  drawRect(doc, x, y, w, h, C.black, 0.35);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.black);
  text(doc, "NOTAS TECNICAS", x + 8, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const notes = [
    "1. Condutores dimensionados conforme NBR 5410, considerando queda de tensao e agrupamento.",
    "2. Iluminacao: secao minima 1.5mm2; tomadas/TUE/forca: secao minima 2.5mm2.",
    "3. Confirmar metodo de instalacao, temperatura ambiente e Icu/Icn antes da compra.",
    "4. Executar identificacao dos circuitos no quadro e ensaios antes da energizacao.",
  ];
  let cy = y + 27;
  notes.forEach((note) => {
    const lines = doc.splitTextToSize(note, w - 18);
    text(doc, lines, x + 8, cy);
    cy += lines.length * 8 + 4;
  });

  const warnings = (metrics.validations || []).slice(0, 3);
  if (warnings.length > 0) {
    doc.setTextColor(...C.red);
    doc.setFont("helvetica", "bold");
    text(doc, "PENDENCIAS:", x + 8, cy + 5);
    doc.setFont("helvetica", "normal");
    warnings.forEach((warning, index) => {
      text(doc, `${index + 1}. ${warning.msg}`.slice(0, 92), x + 8, cy + 17 + index * 8);
    });
  }
}

export function downloadProfessionalElectricalSheet(project, metricsArg) {
  if (!project) return;
  const metrics = metricsArg || calcProjectMetrics(project);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [SHEET.w, SHEET.h], compress: true });
  const title = "DIAGRAMA E MEMORIA DE CALCULO DO QUADRO";

  doc.setProperties({
    title: `${project.name || "Projeto"} - Projeto Executivo Eletrico`,
    subject: "Prancha executiva de diagrama e memoria de calculo",
    creator: "Volt AI",
  });

  drawSheetFrame(doc);
  drawBusbarDiagram(doc, project, metrics);
  drawDimensioningTable(doc, metrics);
  drawNotes(doc, metrics);
  drawCharacteristics(doc, project, metrics);
  drawTitleBlock(doc, project, title);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.gray);
  text(doc, "Arquivo gerado automaticamente. Revisar e validar por profissional habilitado antes de emissao.", 12, SHEET.h - 8);

  doc.save(`projeto_executivo_${safeName(project.name)}_A0.pdf`);
}
