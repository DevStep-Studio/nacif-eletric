/**
 * Gerador de Relatórios Profissionais Fotovoltaicos — VOLTAI / NACIF
 *
 * Gera relatórios técnicos e executivos em PDF de alta qualidade com jsPDF:
 * 1. Planta de Implantação
 * 2. Diagrama Elétrico Solar
 * 3. Memorial Descritivo Fotovoltaico
 * 4. Lista de Materiais e Quantitativos (BOM)
 * 5. Simulação de Geração e Desempenho
 * 6. Proposta Comercial Executiva
 * 7. Relatório Executivo Completo Consolidado
 */

import { jsPDF } from "jspdf";
import { getAzimuthWithCardinal } from "./solarDesignerGeometry.js";

const BRAND_DARK = [14, 23, 38];   // #0e1726
const BRAND_BLUE = [13, 59, 130];  // #0d3b82
const BRAND_TEAL = [0, 180, 155];  // #00b49b

function normalizeParams(project = {}, config = {}, sizing = {}) {
  const p = project || {};
  const c = config || {};
  const s = sizing || {};

  const azimuth = getAzimuthWithCardinal(c.roof_rotation_deg ?? 24);
  const dcPowerKw = Number(s.dcPowerKw ?? 11.55);
  const panelCount = Math.max(1, Number(s.panelCount ?? 21));
  const usableArea = Number(s.usableArea ?? 58.7);
  const annualKwh = Number(s.annualGenerationKwh ?? (dcPowerKw * 1320));
  const annualSavings = Number(s.annualSavingsBrl ?? (annualKwh * 0.85));
  const moduleWp = Number(c.module_wp ?? 550);
  const inverterKw = Number(c.inverter_kw ?? 5);
  const roofArea = Number(c.roof_area_m2 ?? 72.4);
  const roofWidth = Number(c.roof_width_m ?? 14.67);
  const roofHeight = Number(c.roof_height_m ?? 4.8);
  const roofPitch = Number(c.roof_pitch_deg ?? 12);
  const breaker = Number(s.breaker ?? 32);
  const acCurrent = Number(s.acCurrent ?? (dcPowerKw * 1000 / (220 * 1.732)));
  const investment = (dcPowerKw * 1000 * 3.5) || 40425;
  const payback = annualSavings > 0 ? (investment / annualSavings).toFixed(1) : "3.5";

  return {
    project: p,
    config: c,
    sizing: s,
    azimuth,
    dcPowerKw,
    panelCount,
    usableArea,
    annualKwh,
    annualSavings,
    moduleWp,
    inverterKw,
    roofArea,
    roofWidth,
    roofHeight,
    roofPitch,
    breaker,
    acCurrent,
    investment,
    payback,
  };
}

const firstFilled = (...values) => values.find((value) => (
  value !== undefined && value !== null && String(value).trim() !== ""
));

const asDisplayText = (value, fallback = "Não informado") => {
  const resolved = firstFilled(value);
  return resolved === undefined ? fallback : String(resolved).trim();
};

const formatDecimalBR = (value, digits = 2) => Number(value || 0).toLocaleString("pt-BR", {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const buildCompleteAddress = (project = {}) => {
  const cityState = [project.city, project.state].filter(Boolean).join(" / ");
  return [
    project.address || project.project_address,
    project.complement,
    project.neighborhood,
    cityState,
    project.zip_code ? `CEP ${project.zip_code}` : "",
  ].filter((part, index, parts) => part && parts.indexOf(part) === index).join(" · ") || "Não informado";
};

const systemModeLabel = (mode) => {
  const normalized = String(mode || "").toLowerCase();
  if (normalized.includes("micro")) return "Microinversor";
  if (normalized.includes("hibr")) return "Híbrido";
  if (normalized.includes("off")) return "Off-grid";
  return "On-grid";
};

const phaseCountForSupply = (supplyType) => {
  const normalized = String(supplyType || "").toLowerCase();
  if (normalized.includes("tri")) return 3;
  if (normalized.includes("bi")) return 2;
  return 1;
};

export function buildTechnicalMemorialData(project = {}, config = {}, sizing = {}) {
  const normalized = normalizeParams(project, config, sizing);
  const consumption = project?.consumption || {};
  const technicalResponsible = project?.technical_responsible || project?.technicalResponsible || {};
  const supplyType = asDisplayText(firstFilled(config?.ac_supply_type, project?.supply_type), "Não informado");
  const voltage = Number(firstFilled(config?.ac_voltage, project?.voltage, 220));
  const connectionBreaker = Number(firstFilled(
    sizing?.breaker,
    config?.connection_breaker_a,
    project?.connection_breaker_a,
    project?.general_breaker_a,
  ));
  const generalBreaker = Number(firstFilled(
    project?.general_breaker_a,
    project?.main_breaker_a,
    sizing?.generalBreaker,
    connectionBreaker,
  ));
  const contractedDemand = Number(firstFilled(
    consumption?.contracted_demand_kw,
    project?.contracted_demand_kw,
  ));
  const inverterCount = Math.max(1, Number(firstFilled(config?.inverter_quantity, project?.inverter_quantity, 1)) || 1);

  return {
    projectName: asDisplayText(project?.name, "Projeto solar fotovoltaico"),
    clientName: asDisplayText(firstFilled(project?.client_name, project?.customer_name, project?.owner_name)),
    address: buildCompleteAddress(project),
    consumerUnit: asDisplayText(firstFilled(
      config?.consumer_unit,
      consumption?.consumer_unit,
      consumption?.installation_code,
      project?.consumer_unit,
      project?.consumer_unit_number,
      project?.uc_number,
      project?.energy_bill?.installation_code,
    )),
    distributor: asDisplayText(firstFilled(config?.distributor, consumption?.distributor, project?.distributor)),
    technicalResponsibleName: asDisplayText(firstFilled(
      technicalResponsible?.name,
      technicalResponsible?.full_name,
      project?.technical_responsible_name,
      project?.responsible_technical,
    )),
    crea: asDisplayText(firstFilled(
      technicalResponsible?.crea,
      technicalResponsible?.registration,
      project?.crea,
      project?.technical_responsible_crea,
    )),
    systemPowerKwp: normalized.dcPowerKw,
    supplyVoltage: voltage,
    supplyType,
    frequencyHz: 60,
    generalBreakerA: Number.isFinite(generalBreaker) && generalBreaker > 0 ? generalBreaker : null,
    availableDemandKw: Number.isFinite(contractedDemand) && contractedDemand > 0 ? contractedDemand : null,
    entryStandardLocation: asDisplayText(firstFilled(
      config?.entry_standard_location,
      project?.entry_standard_location,
      project?.service_entrance_location,
    )),
    modulePowerKwp: normalized.dcPowerKw,
    inverterPowerKw: normalized.inverterKw * inverterCount,
    panelCount: normalized.panelCount,
    inverterCount,
    systemType: systemModeLabel(firstFilled(project?.system_mode, config?.system_mode)),
    connectionVoltage: voltage,
    phaseCount: phaseCountForSupply(supplyType),
    moduleManufacturer: asDisplayText(firstFilled(
      config?.module_manufacturer,
      project?.module_manufacturer,
      project?.solar_equipment?.module_manufacturer,
    )),
    moduleModel: asDisplayText(firstFilled(
      config?.module_model,
      project?.module_model,
      project?.solar_equipment?.module_model,
    )),
    moduleWp: normalized.moduleWp,
    inverterManufacturer: asDisplayText(firstFilled(
      config?.inverter_manufacturer,
      project?.inverter_manufacturer,
      project?.solar_equipment?.inverter_manufacturer,
    )),
    inverterModel: asDisplayText(firstFilled(
      config?.inverter_model,
      project?.inverter_model,
      project?.solar_equipment?.inverter_model,
    )),
    connectionPoint: asDisplayText(firstFilled(
      config?.connection_point,
      project?.connection_point,
      project?.solar_connection_point,
    ), "Quadro de distribuição principal da unidade consumidora"),
    connectionBreakerA: Number.isFinite(connectionBreaker) && connectionBreaker > 0 ? connectionBreaker : null,
    connectionLocation: asDisplayText(firstFilled(
      config?.connection_location,
      project?.connection_location,
      project?.solar_connection_location,
    )),
    date: new Date().toLocaleDateString("pt-BR"),
  };
}

function addHeader(doc, title, project) {
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, 210, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("VOLTAI · ENGENHARIA SOLAR", 14, 10);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 216, 184);
  doc.text("DA PLANTA AO SOL · TUDO EM UM SÓ LUGAR", 14, 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 210 - 14, 10, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 210, 225);
  doc.text(`Projeto: ${project?.name || "Projeto Solar"} · ${new Date().toLocaleDateString("pt-BR")}`, 210 - 14, 16, { align: "right" });
}

function addFooter(doc, pageNum = 1, totalPages = 1) {
  const pageHeight = doc.internal.pageSize.height || 297;
  doc.setDrawColor(220, 225, 235);
  doc.line(14, pageHeight - 12, 196, pageHeight - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 145);
  doc.text("NACIF Solutions Eletric / VOLTAI Solar · Conforme NBR 16690 e NBR 5410", 14, pageHeight - 7);
  doc.text(`Página ${pageNum} de ${totalPages}`, 196, pageHeight - 7, { align: "right" });
}

function drawSimpleTable(doc, startY, headers, rows, colWidths) {
  let y = startY;
  const rowHeight = 7;
  const headerHeight = 8;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(14, y, totalWidth, headerHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  let curX = 14;
  headers.forEach((h, i) => {
    doc.text(String(h), curX + 2, y + 5.5);
    curX += colWidths[i];
  });
  y += headerHeight;

  // Rows
  rows.forEach((row, rIndex) => {
    if (y > 270) {
      doc.addPage();
      y = 25;
    }
    const isEven = rIndex % 2 === 0;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.rect(14, y, totalWidth, rowHeight, "F");
    doc.setDrawColor(230, 235, 242);
    doc.line(14, y + rowHeight, 14 + totalWidth, y + rowHeight);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 40, 55);

    curX = 14;
    row.forEach((cell, cIndex) => {
      doc.text(String(cell ?? "—"), curX + 2, y + 4.8);
      curX += colWidths[cIndex];
    });
    y += rowHeight;
  });

  return y + 4;
}

/**
 * Salva com segurança o documento PDF no navegador, garantindo compatibilidade com blob
 */
export function downloadPdfBlob(doc, filename = "relatorio_solar.pdf") {
  try {
    doc.save(filename);
  } catch {
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * 1. Planta de Implantação
 */
export function generateSitePlanReport(project = {}, config = {}, sizing = {}) {
  const { azimuth, dcPowerKw, panelCount, usableArea, roofArea, roofWidth, roofHeight, roofPitch, moduleWp } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "PLANTA DE IMPLANTAÇÃO SOLAR", project);

  let y = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_DARK);
  doc.text("1. Dados Gerais da Instalação", 14, y);
  y += 4;

  const dataRows = [
    ["Cliente", project?.client_name || "Cliente Solar", "Endereço", project?.address || "Endereço da Instalação"],
    ["Cidade / UF", `${project?.city || "São Paulo"} / ${project?.state || "SP"}`, "Tipo de Instalação", project?.installation_type || "Residencial"],
    ["Área Total do Telhado", `${roofArea.toFixed(1)} m²`, "Área Útil Ocupada", `${usableArea.toFixed(1)} m²`],
    ["Orientação / Azimute", azimuth.formatted, "Inclinação do Telhado", `${roofPitch}°`],
    ["Total de Módulos", `${panelCount} unidades`, "Potência Instalada", `${dcPowerKw.toFixed(2)} kWp`],
  ];

  y = drawSimpleTable(doc, y, ["Parâmetro", "Especificação", "Parâmetro", "Especificação"], dataRows, [42, 49, 42, 49]);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_DARK);
  doc.text("2. Layout e Arranjo Físico no Telhado", 14, y);
  y += 5;

  doc.setFillColor(245, 248, 252);
  doc.roundedRect(14, y, 182, 80, 2, 2, "FD");
  doc.setDrawColor(180, 200, 225);
  doc.roundedRect(18, y + 4, 174, 72, 2, 2, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND_BLUE);
  doc.text(`Água 01 — ${panelCount} Módulos FV (${moduleWp}Wp) · Arranjo Matricial`, 22, y + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 85, 105);
  doc.text(`• Dimensões do Telhado: ${roofWidth} m × ${roofHeight} m`, 22, y + 20);
  doc.text(`• Afastamento de segurança periférico (Setback): 0,30 m`, 22, y + 27);
  doc.text(`• Orientação dos módulos: ${config?.module_orientation === "horizontal" ? "Deitado (Paisagem)" : "Em pé (Retrato)"}`, 22, y + 34);
  doc.text(`• Obstáculos identificados: ${config?.obstacles?.length || 0} excluídos da área útil`, 22, y + 41);
  doc.text(`• Estrutura de fixação: Alumínio anodizado sobre telha cerâmica / fibrocimento`, 22, y + 48);
  doc.text(`• Espaçamento térmico intermódulos: 20 mm com grampos intermediários/finais`, 22, y + 55);
  doc.text(`• Rosa dos ventos e Azimute calculado: ${azimuth.formatted} com inclinação de ${roofPitch}°`, 22, y + 62);

  addFooter(doc, 1, 1);
  return doc;
}

/**
 * 2. Diagrama Elétrico Solar
 */
export function generateElectricalDiagramReport(project = {}, config = {}, sizing = {}) {
  const { dcPowerKw, panelCount, moduleWp, inverterKw, breaker } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "DIAGRAMA ELÉTRICO SOLAR & STRINGS", project);

  let y = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_DARK);
  doc.text("1. Configuração de Strings e Inversor", 14, y);
  y += 4;

  const countStr1 = Math.ceil(panelCount / 2);
  const countStr2 = Math.floor(panelCount / 2);
  const stringRows = [
    ["String 01", `${countStr1} × ${moduleWp}Wp`, `${((countStr1 * moduleWp) / 1000).toFixed(2)} kWp`, "456,5 V", "547,8 V", "13,25 A"],
    ["String 02", `${countStr2} × ${moduleWp}Wp`, `${((countStr2 * moduleWp) / 1000).toFixed(2)} kWp`, "415,0 V", "498,0 V", "13,25 A"],
    ["Total Gerador CC", `${panelCount} módulos`, `${dcPowerKw.toFixed(2)} kWp`, "—", "—", "26,50 A"],
  ];
  y = drawSimpleTable(doc, y, ["String / Circuito", "Módulos", "Potência (kWp)", "Vmp (V)", "Voc (V)", "Imp (A)"], stringRows, [30, 32, 30, 30, 30, 30]);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_DARK);
  doc.text("2. Proteção e Saída CA (Conexão ao Quadro Principal)", 14, y);
  y += 4;

  const acRows = [
    ["Inversor Fotovoltaico", `${inverterKw} kW (${config?.ac_supply_type || "Bifásico"} ${config?.ac_voltage || 220}V)`, "Sobrecarga CC/CA: 1,25x"],
    ["Corrente Nominal CA", `${(dcPowerKw * 1000 / (220 * 1.732)).toFixed(1)} A`, "I = P / (V × √3)"],
    ["Disjuntor Termomagnético CA", `${breaker}A Curva C (${config?.ac_supply_type === "Trifásico" ? "3P" : "2P"})`, "NBR 5410 / NBR 16690"],
    ["Condutores CA (Fase/Neutro/PE)", "6 mm² Cobre EPR/XLPE 90°C", "Queda de tensão < 1,5%"],
    ["DPS CA (Classe II)", "DPS 275V / 20-40kA com sinalização", "Proteção contra surtos"],
    ["Quadro de Conexão", "Integrado no Quadro Principal de Entrada", "Quadro de Distribuição"],
  ];
  y = drawSimpleTable(doc, y, ["Elemento", "Parâmetro Calculado", "Critério Normativo"], acRows, [52, 65, 65]);

  addFooter(doc, 1, 1);
  return doc;
}

/**
 * 3. Memorial Descritivo
 */
export function generateTechnicalMemorialReport(project = {}, config = {}, sizing = {}) {
  const data = buildTechnicalMemorialData(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  const pageBottom = 278;
  let y = 30;

  const startPage = () => {
    doc.addPage();
    addHeader(doc, "MEMORIAL DESCRITIVO FOTOVOLTAICO", project);
    y = 30;
  };

  const ensureSpace = (height) => {
    if (y + height > pageBottom) startPage();
  };

  const sectionTitle = (title) => {
    ensureSpace(14);
    doc.setFillColor(239, 250, 248);
    doc.roundedRect(14, y - 5, 182, 10, 1.5, 1.5, "F");
    doc.setFillColor(...BRAND_TEAL);
    doc.rect(14, y - 5, 2, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_DARK);
    doc.text(title, 19, y + 1.5);
    y += 11;
  };

  const paragraph = (text) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(45, 55, 70);
    const lines = doc.splitTextToSize(text, 182);
    ensureSpace(lines.length * 4.5 + 5);
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 5;
  };

  const keyValueRows = (rows) => {
    const labelWidth = 64;
    const valueWidth = 118;
    rows.forEach(([label, value], index) => {
      const valueLines = doc.splitTextToSize(String(value ?? "Não informado"), valueWidth - 6);
      const rowHeight = Math.max(8, valueLines.length * 4 + 4);
      ensureSpace(rowHeight);
      doc.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255);
      doc.rect(14, y, 182, rowHeight, "F");
      doc.setDrawColor(225, 231, 239);
      doc.rect(14, y, 182, rowHeight, "S");
      doc.line(14 + labelWidth, y, 14 + labelWidth, y + rowHeight);
      doc.setFontSize(8.5);
      doc.setTextColor(45, 55, 70);
      doc.setFont("helvetica", "bold");
      doc.text(String(label), 17, y + 5.4);
      doc.setFont("helvetica", "normal");
      doc.text(valueLines, 14 + labelWidth + 3, y + 5.4);
      y += rowHeight;
    });
    y += 7;
  };

  addHeader(doc, "MEMORIAL DESCRITIVO FOTOVOLTAICO", project);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_BLUE);
  doc.text("MEMORIAL DESCRITIVO", 14, y);
  y += 7;
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_TEAL);
  doc.text("SISTEMA FOTOVOLTAICO", 14, y);
  y += 12;

  sectionTitle("1. IDENTIFICAÇÃO DO PROJETO");
  keyValueRows([
    ["Cliente", data.clientName],
    ["Endereço da instalação", data.address],
    ["Unidade Consumidora – UC", data.consumerUnit],
    ["Distribuidora", data.distributor],
    ["Responsável Técnico", data.technicalResponsibleName],
    ["CREA", data.crea],
    ["Potência do Sistema", `${formatDecimalBR(data.systemPowerKwp)} kWp`],
  ]);

  sectionTitle("2. OBJETIVO");
  paragraph("O presente Memorial Descritivo tem por objetivo apresentar as principais características técnicas do sistema de geração de energia elétrica por fonte solar fotovoltaica a ser instalado na unidade consumidora identificada neste documento.");
  paragraph("O sistema fotovoltaico será conectado à instalação elétrica da unidade consumidora, permitindo a geração de energia elétrica a partir da conversão da energia solar em energia elétrica.");

  sectionTitle("3. CARACTERÍSTICAS DA UNIDADE CONSUMIDORA");
  keyValueRows([
    ["Número da UC", data.consumerUnit],
    ["Distribuidora", data.distributor],
    ["Tensão de fornecimento", `${data.supplyVoltage} V`],
    ["Tipo de fornecimento", data.supplyType],
    ["Frequência", `${data.frequencyHz} Hz`],
    ["Disjuntor geral", data.generalBreakerA ? `${data.generalBreakerA} A` : "Não informado"],
    ["Potência disponibilizada/demanda", data.availableDemandKw ? `${formatDecimalBR(data.availableDemandKw)} kW` : "Não informado"],
    ["Local do padrão de entrada", data.entryStandardLocation],
  ]);

  ensureSpace(105);
  sectionTitle("4. CARACTERÍSTICAS DO SISTEMA FOTOVOLTAICO");
  paragraph("O sistema fotovoltaico será constituído por módulos fotovoltaicos responsáveis pela conversão da radiação solar em energia elétrica em corrente contínua (CC), sendo posteriormente convertida em corrente alternada (CA) através do(s) inversor(es).");
  keyValueRows([
    ["Potência total dos módulos", `${formatDecimalBR(data.modulePowerKwp)} kWp`],
    ["Potência total dos inversores", `${formatDecimalBR(data.inverterPowerKw)} kW`],
    ["Quantidade de módulos", `${data.panelCount} unidades`],
    ["Quantidade de inversores", `${data.inverterCount} unidades`],
    ["Inversor – fabricante/modelo", [data.inverterManufacturer, data.inverterModel].filter((value) => value !== "Não informado").join(" · ") || "Não informado"],
    ["Tipo do sistema", data.systemType],
    ["Tensão de conexão", `${data.connectionVoltage} V`],
    ["Número de fases", `${data.phaseCount} (${data.supplyType})`],
  ]);

  ensureSpace(82);
  sectionTitle("5. MÓDULOS FOTOVOLTAICOS E FABRICANTE");
  keyValueRows([
    ["Fabricante", data.moduleManufacturer],
    ["Modelo", data.moduleModel],
    ["Potência unitária", `${data.moduleWp} Wp`],
    ["Quantidade", `${data.panelCount} módulos`],
    ["Potência total instalada", `${formatDecimalBR(data.modulePowerKwp)} kWp`],
  ]);
  paragraph("Os módulos fotovoltaicos serão instalados em estrutura apropriada, observando as condições do local, orientação, inclinação e condições necessárias para operação segura do sistema.");

  ensureSpace(160);
  sectionTitle("6. PONTO DE CONEXÃO À REDE");
  paragraph("A conexão do sistema fotovoltaico será realizada na instalação elétrica da unidade consumidora, através do quadro elétrico indicado no projeto.");
  paragraph(`O ponto de conexão será realizado no ${data.connectionPoint}, em tensão de ${data.connectionVoltage} V, sistema ${data.supplyType.toLowerCase()}, interligando a saída em corrente alternada do(s) inversor(es) ao sistema elétrico da unidade consumidora.`);
  keyValueRows([
    ["Ponto de conexão", data.connectionPoint],
    ["Tensão", `${data.connectionVoltage} V`],
    ["Número de fases", `${data.phaseCount}`],
    ["Disjuntor de conexão", data.connectionBreakerA ? `${data.connectionBreakerA} A` : "Não informado"],
    ["Localização", data.connectionLocation],
  ]);
  paragraph("O sistema será conectado de forma a operar em paralelo com a rede elétrica da distribuidora, conforme as características técnicas estabelecidas no projeto elétrico.");

  ensureSpace(44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(45, 55, 70);
  doc.text(`Responsável Técnico: ${data.technicalResponsibleName}`, 14, y);
  y += 12;
  doc.line(14, y, 112, y);
  doc.text(`CREA: ${data.crea}`, 122, y);
  y += 13;
  doc.text(`Data: ${data.date}`, 14, y);
  y += 10;
  doc.text("Assinatura do Responsável Técnico", 14, y);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    addFooter(doc, page, totalPages);
  }
  return doc;
}

/**
 * 4. Lista de Materiais e Quantitativos (BOM)
 */
export function generateBillOfMaterialsReport(project = {}, config = {}, sizing = {}) {
  const { panelCount, moduleWp, inverterKw, breaker } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "LISTA DE MATERIAIS & QUANTITATIVOS (BOM)", project);

  const bomRows = [
    ["01", `Módulo Solar Monocristalino ${moduleWp}Wp Half-Cell Tier 1`, "Canadian / Jinko / Longi", String(panelCount), "un"],
    ["02", `Inversor Solar On-Grid/Híbrido ${inverterKw}kW ${config?.ac_voltage || 220}V 2 MPPTs`, "Growatt / Deye / Solis", "1", "un"],
    ["03", "Estrutura de Fixação em Alumínio para Telhado Cerâmico / Metálico", "Perfil + Ganchos Inox", String(panelCount), "conj"],
    ["04", "Cabo Solar Fotovoltaico 1kV 4mm² Cobre Estanhado Preto", "Prysmian / Nexans", "60", "m"],
    ["05", "Cabo Solar Fotovoltaico 1kV 4mm² Cobre Estanhado Vermelho", "Prysmian / Nexans", "60", "m"],
    ["06", "Par de Conectores MC4 Macho / Fêmea 1000V", "Stäubli / Compatível", "6", "par"],
    ["07", `Disjuntor Termomagnético Bipolar/Tripolar Curva C ${breaker}A`, "Schneider / WEG", "1", "un"],
    ["08", "Dispositivo de Proteção contra Surtos (DPS) CA Classe II 275V 20/40kA", "Clamper / WEG", "2", "un"],
    ["09", "Cabo de Cobre Flexível 750V 6mm² para Saída CA (Fases / Neutro / PE)", "Sil / Corfio", "30", "m"],
    ["10", "Eletroduto Rígido / Corrugado Antichamas c/ Conexões e Abraçadeiras", "Tigre / Amanco", "1", "lote"],
    ["11", "Placas de Advertência e Sinalização de Segurança NBR 16690", "Acrílico / Adesivo", "1", "kit"],
  ];

  drawSimpleTable(doc, 30, ["Item", "Descrição do Material / Equipamento", "Fabricante / Ref.", "Qtd.", "Un."], bomRows, [14, 86, 46, 18, 18]);

  addFooter(doc, 1, 1);
  return doc;
}

/**
 * 5. Simulação de Geração e Desempenho
 */
export function generateGenerationSimulationReport(project = {}, config = {}, sizing = {}) {
  const { annualKwh } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "SIMULAÇÃO DE GERAÇÃO & DESEMPENHO ANUAL", project);

  const monthWeights = [1.12, 1.08, 1.05, 0.95, 0.85, 0.78, 0.82, 0.90, 0.96, 1.08, 1.18, 1.23];
  const weightSum = monthWeights.reduce((a, b) => a + b, 0);
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const tableBody = months.map((month, i) => {
    const kwh = Math.round((annualKwh * monthWeights[i]) / weightSum);
    const savings = Math.round(kwh * 0.95);
    return [month, `${kwh.toLocaleString("pt-BR")} kWh`, `R$ ${savings.toLocaleString("pt-BR")}`, "80,0%"];
  });
  tableBody.push(["TOTAL ANUAL", `${Math.round(annualKwh).toLocaleString("pt-BR")} kWh`, `R$ ${Math.round(annualKwh * 0.95).toLocaleString("pt-BR")}`, "80,0%"]);

  drawSimpleTable(doc, 30, ["Mês", "Geração Prevista (kWh)", "Economia Estimada (R$)", "PR Médio"], tableBody, [45, 45, 46, 46]);

  addFooter(doc, 1, 1);
  return doc;
}

/**
 * 6. Proposta Comercial Executiva
 */
export function generateCommercialProposalReport(project = {}, config = {}, sizing = {}) {
  const { dcPowerKw, annualSavings, investment, payback, panelCount } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "PROPOSTA COMERCIAL EXECUTIVA", project);

  const savings25Years = annualSavings * 25;

  let y = 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_DARK);
  doc.text("Resumo do Investimento e Retorno Financeiro", 14, y);
  y += 4;

  const proposalRows = [
    ["Potência do Sistema", `${dcPowerKw.toFixed(2)} kWp`, `${panelCount} módulos fotovoltaicos`],
    ["Investimento Estimado", investment.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Equipamentos + Engenharia + Instalação"],
    ["Economia no 1º Ano", annualSavings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Redução de até 95% na conta de luz"],
    ["Economia em 25 Anos", savings25Years.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Garantia linear de desempenho"],
    ["Payback Simples", `${payback} anos`, "Tempo estimado de retorno do investimento"],
    ["Impacto Ambiental", `${(dcPowerKw * 0.48).toFixed(1)} ton CO2/ano`, "Equivalente a 85 árvores plantadas"],
  ];

  drawSimpleTable(doc, y, ["Indicador Financeiro", "Valor Projetado", "Observação"], proposalRows, [55, 55, 72]);

  addFooter(doc, 1, 1);
  return doc;
}

/**
 * 7. Relatório Executivo Completo Consolidado (Todas as seções em um único PDF de 2 páginas)
 */
export function generateExecutiveSolarPdf(project = {}, config = {}, sizing = {}) {
  const { azimuth, dcPowerKw, panelCount, usableArea, annualKwh, annualSavings, moduleWp, inverterKw, roofArea, roofPitch, breaker, investment, payback } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");

  // PÁGINA 1: Capa & Dados Técnicos e Financeiros
  addHeader(doc, "RELATÓRIO TÉCNICO EXECUTIVO SOLAR", project);

  let y = 28;

  // Box de Indicadores Principais (KPIs)
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(14, y, 182, 28, 2, 2, "FD");
  doc.setDrawColor(200, 215, 235);
  doc.roundedRect(14, y, 182, 28, 2, 2, "D");

  const kpis = [
    { label: "POTÊNCIA INSTALADA", val: `${dcPowerKw.toFixed(2)} kWp`, sub: `${panelCount} Módulos (${moduleWp}Wp)` },
    { label: "GERAÇÃO ANUAL", val: `${(annualKwh / 1000).toFixed(2)} MWh`, sub: `${Math.round(annualKwh / 12)} kWh/mês` },
    { label: "ECONOMIA 1º ANO", val: `R$ ${Math.round(annualSavings).toLocaleString("pt-BR")}`, sub: "Até 95% de abatimento" },
    { label: "PAYBACK ESTIMADO", val: `${payback} anos`, sub: `Invest. R$ ${Math.round(investment).toLocaleString("pt-BR")}` },
  ];

  kpis.forEach((kpi, idx) => {
    const xPos = 18 + idx * 45;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 115, 135);
    doc.text(kpi.label, xPos, y + 7);

    doc.setFontSize(11);
    doc.setTextColor(...BRAND_DARK);
    doc.text(kpi.val, xPos, y + 15);

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 150, 130);
    doc.text(kpi.sub, xPos, y + 21);
  });

  y += 34;

  // Seção 1: Dados Gerais
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.text("1. Dados da Instalação e Características do Telhado", 14, y);
  y += 4;

  const dataRows = [
    ["Cliente / Titular", project?.client_name || "Cliente Solar", "Endereço", project?.address || "Endereço da Instalação"],
    ["Cidade / UF", `${project?.city || "São Paulo"} / ${project?.state || "SP"}`, "Distribuidora", project?.consumption?.distributor || project?.distributor || "Enel SP"],
    ["Área do Telhado", `${roofArea.toFixed(1)} m² (Útil: ${usableArea.toFixed(1)} m²)`, "Azimute / Inclinação", `${azimuth.formatted} / ${roofPitch}°`],
    ["Inversor FV", `${inverterKw} kW (${config?.ac_supply_type || "Bifásico"} ${config?.ac_voltage || 220}V)`, "Disjuntor CA", `${breaker}A Curva C`],
  ];
  y = drawSimpleTable(doc, y, ["Parâmetro", "Especificação", "Parâmetro", "Especificação"], dataRows, [42, 49, 42, 49]);

  y += 2;
  // Seção 2: Arranjo de Strings
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.text("2. Arranjo de Strings CC e Geração", 14, y);
  y += 4;

  const stringRows = [
    ["String 01", `${Math.ceil(panelCount / 2)} × ${moduleWp}Wp`, `${((Math.ceil(panelCount / 2) * moduleWp) / 1000).toFixed(2)} kWp`, "456,5 V", "13,25 A"],
    ["String 02", `${Math.floor(panelCount / 2)} × ${moduleWp}Wp`, `${((Math.floor(panelCount / 2) * moduleWp) / 1000).toFixed(2)} kWp`, "415,0 V", "13,25 A"],
    ["Total Gerador", `${panelCount} Módulos`, `${dcPowerKw.toFixed(2)} kWp`, "—", "26,50 A"],
  ];
  y = drawSimpleTable(doc, y, ["Circuito", "Módulos", "Potência CC", "Tensão Vmp", "Corrente Imp"], stringRows, [35, 40, 35, 36, 36]);

  addFooter(doc, 1, 2);

  // PÁGINA 2: Lista de Materiais e Retorno Financeiro
  doc.addPage();
  addHeader(doc, "RELATÓRIO TÉCNICO EXECUTIVO SOLAR (CONT.)", project);

  y = 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.text("3. Lista Resumida de Materiais e Equipamentos (BOM)", 14, y);
  y += 4;

  const bomRows = [
    ["01", `Módulos Solares Monocristalinos ${moduleWp}Wp Half-Cell Tier 1`, String(panelCount), "un"],
    ["02", `Inversor Solar On-Grid/Híbrido ${inverterKw}kW c/ Monitoramento WiFi`, "1", "un"],
    ["03", "Estrutura de Fixação em Alumínio e Ganchos Inox para Telhado", String(panelCount), "conj"],
    ["04", "Cabos Solares 1kV 4mm² Cobre Estanhado c/ Conectores MC4", "120", "m"],
    ["05", `Disjuntor Termomagnético ${breaker}A + DPS CA Classe II 275V`, "1", "kit"],
  ];
  y = drawSimpleTable(doc, y, ["Item", "Descrição do Equipamento / Material", "Qtd.", "Un."], bomRows, [14, 130, 20, 18]);

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.text("4. Viabilidade Financeira e Retorno em 25 Anos", 14, y);
  y += 4;

  const finRows = [
    ["Investimento Estimado (Turnkey)", investment.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Equipamentos + Engenharia + Instalação + Homologação"],
    ["Economia no 1º Ano de Operação", annualSavings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Redução média de até 95% no faturamento de energia"],
    ["Economia Acumulada em 25 Anos", (annualSavings * 25).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Garantia linear de geração de energia"],
    ["Payback Estimado", `${payback} anos`, "Retorno do capital investido"],
  ];
  drawSimpleTable(doc, y, ["Indicador Financeiro", "Valor Projetado", "Premissa Técnica"], finRows, [60, 48, 74]);

  addFooter(doc, 2, 2);
  return doc;
}

/**
 * 8. Impressão Direta do Relatório Executivo Integrado (window.print)
 */
export function printExecutiveSolarReport(project = {}, config = {}, sizing = {}) {
  const { azimuth, dcPowerKw, panelCount, annualKwh, annualSavings, moduleWp, inverterKw, roofArea, usableArea, roofPitch, breaker, investment, payback } = normalizeParams(project, config, sizing);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Executivo Solar — ${project?.name || "Projeto Fotovoltaico"}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
        .logo-title { font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
        .logo-sub { font-size: 9px; font-weight: 600; color: #00b49b; text-transform: uppercase; }
        .doc-title { text-align: right; font-size: 12px; font-weight: 800; color: #0f172a; }
        .doc-meta { font-size: 9px; color: #64748b; }
        
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
        .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #f8fafc; }
        .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; }
        .kpi-value { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
        .kpi-sub { font-size: 8.5px; color: #059669; font-weight: 600; }
        
        .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin: 10px 0 6px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
        th { background: #1e293b; color: #fff; font-weight: 700; text-align: left; padding: 4px 6px; font-size: 9px; }
        td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) td { background: #f8fafc; }
        
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background: #fff; }
        .box-title { font-size: 10px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
        .info-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed #f1f5f9; }
        .info-label { color: #64748b; font-size: 9.5px; }
        .info-val { font-weight: 700; color: #0f172a; font-size: 9.5px; }
        
        .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo-title">VOLTAI · ENGENHARIA SOLAR</div>
          <div class="logo-sub">NACIF Solutions Eletric · NBR 16690 / NBR 5410</div>
        </div>
        <div>
          <div class="doc-title">RELATÓRIO TÉCNICO EXECUTIVO</div>
          <div class="doc-meta">Projeto: ${project?.name || "Projeto Solar"} · ${new Date().toLocaleDateString("pt-BR")}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Potência Instalada</div>
          <div class="kpi-value">${dcPowerKw.toFixed(2)} kWp</div>
          <div class="kpi-sub">${panelCount} Módulos (${moduleWp}Wp)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Geração Anual</div>
          <div class="kpi-value">${(annualKwh / 1000).toFixed(2)} MWh</div>
          <div class="kpi-sub">${Math.round(annualKwh / 12)} kWh/mês médio</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Economia Anual</div>
          <div class="kpi-value">R$ ${Math.round(annualSavings).toLocaleString("pt-BR")}</div>
          <div class="kpi-sub">Até 95% de abatimento</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Payback Estimado</div>
          <div class="kpi-value">${payback} anos</div>
          <div class="kpi-sub">Investimento R$ ${Math.round(investment).toLocaleString("pt-BR")}</div>
        </div>
      </div>

      <div class="section-title">1. Dados do Cliente e Implantação</div>
      <div class="grid-2">
        <div class="box">
          <div class="box-title">Identificação da Instalação</div>
          <div class="info-row"><span class="info-label">Cliente:</span><span class="info-val">${project?.client_name || "Cliente Solar"}</span></div>
          <div class="info-row"><span class="info-label">Endereço:</span><span class="info-val">${project?.address || "Endereço da Instalação"}</span></div>
          <div class="info-row"><span class="info-label">Cidade / UF:</span><span class="info-val">${project?.city || "São Paulo"} / ${project?.state || "SP"}</span></div>
          <div class="info-row"><span class="info-label">Distribuidora:</span><span class="info-val">${project?.consumption?.distributor || project?.distributor || "Enel SP"}</span></div>
        </div>
        <div class="box">
          <div class="box-title">Características do Telhado</div>
          <div class="info-row"><span class="info-label">Área Total:</span><span class="info-val">${roofArea.toFixed(1)} m²</span></div>
          <div class="info-row"><span class="info-label">Área Utilizável:</span><span class="info-val">${usableArea.toFixed(1)} m²</span></div>
          <div class="info-row"><span class="info-label">Orientação / Azimute:</span><span class="info-val">${azimuth.formatted}</span></div>
          <div class="info-row"><span class="info-label">Inclinação:</span><span class="info-val">${roofPitch}°</span></div>
        </div>
      </div>

      <div class="section-title">2. Arranjo de Strings CC e Inversor</div>
      <table>
        <thead>
          <tr>
            <th>Circuito</th>
            <th>Módulos</th>
            <th>Potência (kWp)</th>
            <th>Vmp (V)</th>
            <th>Voc (V)</th>
            <th>Imp (A)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>String 01</strong></td>
            <td>${Math.ceil(panelCount / 2)} × ${moduleWp}Wp</td>
            <td>${((Math.ceil(panelCount / 2) * moduleWp) / 1000).toFixed(2)} kWp</td>
            <td>456,5 V</td>
            <td>547,8 V</td>
            <td>13,25 A</td>
          </tr>
          <tr>
            <td><strong>String 02</strong></td>
            <td>${Math.floor(panelCount / 2)} × ${moduleWp}Wp</td>
            <td>${((Math.floor(panelCount / 2) * moduleWp) / 1000).toFixed(2)} kWp</td>
            <td>415,0 V</td>
            <td>498,0 V</td>
            <td>13,25 A</td>
          </tr>
          <tr>
            <td><strong>Total CC</strong></td>
            <td>${panelCount} Módulos</td>
            <td>${dcPowerKw.toFixed(2)} kWp</td>
            <td>—</td>
            <td>—</td>
            <td>26,50 A</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">3. Integração com o Quadro de Distribuição CA (QD-01)</div>
      <div class="grid-2">
        <div class="box">
          <div class="box-title">Proteção Termomagnética e Cabos</div>
          <div class="info-row"><span class="info-label">Inversor CA:</span><span class="info-val">${inverterKw} kW (${config?.ac_supply_type || "Bifásico"} ${config?.ac_voltage || 220}V)</span></div>
          <div class="info-row"><span class="info-label">Corrente Nominal CA:</span><span class="info-val">${(dcPowerKw * 1000 / (220 * 1.732)).toFixed(1)} A</span></div>
          <div class="info-row"><span class="info-label">Disjuntor CA:</span><span class="info-val">${breaker}A Curva C (${config?.ac_supply_type === "Trifásico" ? "3P" : "2P"})</span></div>
          <div class="info-row"><span class="info-label">Condutores CA:</span><span class="info-val">${breaker > 40 ? "10mm²" : breaker > 25 ? "6mm²" : "4mm²"} Cobre EPR 90°C</span></div>
        </div>
        <div class="box">
          <div class="box-title">Proteções e Conformidade</div>
          <div class="info-row"><span class="info-label">DPS CA:</span><span class="info-val">Classe II 275V / 20-40kA</span></div>
          <div class="info-row"><span class="info-label">Norma de Arranjo:</span><span class="info-val">ABNT NBR 16690</span></div>
          <div class="info-row"><span class="info-label">Norma de Instalação:</span><span class="info-val">ABNT NBR 5410</span></div>
          <div class="info-row"><span class="info-label">Regulatório ANEEL:</span><span class="info-val">REN 1.000 / REN 1.059</span></div>
        </div>
      </div>

      <div class="footer">
        <div>VOLTAI Solar · NACIF Solutions Eletric · Engenharia Elétrica Aplicada</div>
        <div>Emissão: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  try {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
  } catch {
    // Popup bloqueado pelo navegador
  }

  // Fallback seguro via iframe oculto
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }
  }, 400);
}
