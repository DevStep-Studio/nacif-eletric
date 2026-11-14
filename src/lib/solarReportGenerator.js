/**
 * Gerador de Relatórios Profissionais Fotovoltaicos — NACIF ENERGY
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
import { NACIF_SYMBOL_BASE64 } from "./solarLogoAsset.js";
import { resolveSolarReportImages, resolveSolarReportImagesAsync } from "./solarLayoutImageRenderer.js";
import {
  PDF_THEME,
  drawPdfKpiStrip,
  drawPdfSectionTitle,
  drawSolarUnifilarVector,
  drawVectorBarChart,
} from "./unifilarPdfDrawer.js";

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

  const acVoltage = Number(c.ac_voltage || p.voltage || 220);
  const supplyType = c.ac_supply_type || p.supply_type || "Bifásico";
  const isTri = /tri|3f|3p/i.test(String(supplyType));
  const fp = Math.max(0.01, Number(c.power_factor || p.power_factor || 0.92));

  // Fórmula Exata de Corrente de Projeto (Ib) conforme ABNT NBR 5410:
  // Se Trifásico: Ib = Potência (W) / (Tensão (V) * Math.sqrt(3) * FatorDePotencia)
  // Se Monofásico / Bifásico: Ib = Potência (W) / (Tensão (V) * FatorDePotencia)
  const calculatedIb = isTri
    ? ((inverterKw * 1000 / acVoltage / Math.sqrt(3)) / fp)
    : ((inverterKw * 1000) / (acVoltage * fp));
  const acCurrent = Math.round(Number(s.acCurrent || calculatedIb) * 100) / 100;

  // Seleção automática do calibre comercial padrão IEC/DIN (In >= Ib)
  const calibresComerciais = [6, 10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125, 160, 200, 225, 250, 315, 400, 500, 630];
  const autoBreaker = calibresComerciais.find((cal) => cal >= acCurrent) || calibresComerciais[calibresComerciais.length - 1];
  const breaker = Number(s.breaker || autoBreaker);

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
    acVoltage,
    supplyType,
    isTri,
    powerFactor: fp,
    breaker,
    acCurrent,
    investment,
    payback,
    areas: s.areas || c.areas || [],
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
  // Barra de fundo executiva escura (#0E1726)
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, 210, 24.3, "F");

  // Filete luminoso de destaque inferior em ciano/turquesa institucional (#00D8B8)
  doc.setFillColor(0, 216, 184);
  doc.rect(0, 24.3, 210, 0.7, "F");

  // Emblema container da logomarca Nacif com destaque e contraste profissional
  try {
    doc.setFillColor(19, 32, 53);
    doc.roundedRect(13.5, 3.8, 17.2, 16.5, 2, 2, "F");
    doc.setDrawColor(0, 216, 184);
    doc.setLineWidth(0.35);
    doc.roundedRect(13.5, 3.8, 17.2, 16.5, 2, 2, "S");

    // Símbolo Oficial Nacif Energy (proporções 269:251 preservadas, pureza ciano sobre transparente)
    doc.addImage(NACIF_SYMBOL_BASE64, "PNG", 14.8, 4.8, 14.6, 13.6, undefined, "FAST");
  } catch {
    // Fallback gracioso
  }

  // Nome oficial da marca com destaque e tipografia institucional: NACIF (branco) + ENERGY (ciano)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text("NACIF", 34.5, 11.2);
  const nacifWidth = doc.getTextWidth("NACIF");

  doc.setTextColor(0, 216, 184);
  doc.text("ENERGY", 34.5 + nacifWidth + 1.8, 11.2);

  // Slogan institucional perfeitamente alinhado abaixo do logotipo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(0, 216, 184);
  doc.text("DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR", 34.5, 16.5);

  // Lado direito: Título do Documento, Projeto e Metadados rigorosamente alinhados na margem de 196mm
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.8);
  doc.setTextColor(255, 255, 255);
  doc.text(title, 196, 8.8, { align: "right" });

  const projectName = project?.name || "Projeto Solar";
  const displayProject = projectName.length > 40 ? projectName.slice(0, 37) + "..." : projectName;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Projeto: ${displayProject}`, 196, 13.6, { align: "right" });

  const locationText = [project?.city, project?.state].filter(Boolean).join(" / ") || project?.address || "";
  const dateStr = new Date().toLocaleDateString("pt-BR");
  const metaText = locationText ? `${locationText} · ${dateStr}` : dateStr;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.0);
  doc.setTextColor(148, 163, 184);
  doc.text(metaText, 196, 17.6, { align: "right" });
}

function addFooter(doc, pageNum = 1, totalPages = 1) {
  const pageHeight = doc.internal.pageSize.height || 297;
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.line(14, pageHeight - 12, 196, pageHeight - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 130, 145);
  doc.text("NACIF ENERGY · Conforme NBR 16690 e NBR 5410", 14, pageHeight - 7);
  doc.text(`Página ${pageNum} de ${totalPages}`, 196, pageHeight - 7, { align: "right" });
}

function drawSimpleTable(doc, startY, headers, rows, colWidths, colAlignments = []) {
  let y = startY;
  const baseRowHeight = 7.6;
  const headerHeight = 7.8;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  // Cabeçalho da tabela com cantos rigorosamente retos e alinhamento coordenado
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(14, y, totalWidth, headerHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(255, 255, 255);

  let curX = 14;
  headers.forEach((h, i) => {
    const align = colAlignments[i] || "left";
    const w = colWidths[i];
    if (align === "center") {
      doc.text(String(h), curX + w / 2, y + 5.1, { align: "center", maxWidth: Math.max(4, w - 2) });
    } else if (align === "right") {
      doc.text(String(h), curX + w - 2.8, y + 5.1, { align: "right", maxWidth: Math.max(4, w - 2) });
    } else {
      doc.text(String(h), curX + 2.8, y + 5.1, { align: "left", maxWidth: Math.max(4, w - 2) });
    }
    curX += w;
  });
  y += headerHeight;

  // Linhas com cantos quadrados, quebra inteligente de texto e alinhamento simétrico
  rows.forEach((row, rIndex) => {
    if (y > 270) {
      doc.addPage();
      y = 28;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);

    // Pré-calcula quebra de linhas para cada célula para definir a altura necessária da linha
    const cellLines = row.map((cell, cIdx) => {
      const text = String(cell ?? "—");
      const w = colWidths[cIdx];
      const align = colAlignments[cIdx] || "left";
      if (align === "left") {
        return doc.splitTextToSize(text, Math.max(8, w - 4));
      }
      return [text];
    });

    const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
    const rowHeight = maxLines > 1 ? maxLines * 3.6 + 4.0 : baseRowHeight;

    const isEven = rIndex % 2 === 0;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.rect(14, y, totalWidth, rowHeight, "F");

    // Divisórias horizontais sutis
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(14, y + rowHeight, 14 + totalWidth, y + rowHeight);

    // Divisórias verticais entre colunas para precisão visual
    let colX = 14;
    colWidths.forEach((w, cIdx) => {
      if (cIdx > 0) {
        doc.line(colX, y, colX, y + rowHeight);
      }
      colX += w;
    });

    const isTotalRow = String(row[0] || "").toLowerCase().includes("total");
    doc.setFont("helvetica", isTotalRow ? "bold" : "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(isTotalRow ? BRAND_DARK[0] : 30, isTotalRow ? BRAND_DARK[1] : 40, isTotalRow ? BRAND_DARK[2] : 55);

    curX = 14;
    row.forEach((cell, cIndex) => {
      const align = colAlignments[cIndex] || "left";
      const w = colWidths[cIndex];
      const lines = cellLines[cIndex];

      if (align === "center") {
        const textY = y + rowHeight / 2 + 1.2;
        doc.text(lines[0] || "—", curX + w / 2, textY, { align: "center", maxWidth: Math.max(4, w - 2) });
      } else if (align === "right") {
        const textY = y + rowHeight / 2 + 1.2;
        doc.text(lines[0] || "—", curX + w - 2.8, textY, { align: "right", maxWidth: Math.max(4, w - 2) });
      } else {
        if (lines.length <= 1) {
          const textY = y + rowHeight / 2 + 1.2;
          doc.text(lines[0] || "—", curX + 2.8, textY, { align: "left", maxWidth: Math.max(4, w - 3.5) });
        } else {
          const startYText = y + (rowHeight - (lines.length - 1) * 3.5) / 2 + 0.9;
          lines.forEach((l, lIdx) => {
            doc.text(l, curX + 2.8, startYText + lIdx * 3.5, { align: "left", maxWidth: Math.max(4, w - 3.5) });
          });
        }
      }
      curX += w;
    });
    y += rowHeight;
  });

  // Borda externa nítida e quadrada delimitando toda a tabela
  doc.setDrawColor(210, 222, 236);
  doc.setLineWidth(0.3);
  doc.rect(14, startY, totalWidth, y - startY, "D");

  return y + 4.5;
}

/**
 * Salva com segurança o documento PDF no navegador, garantindo compatibilidade com blob
 */
export async function downloadPdfBlob(docOrPromise, filename = "relatorio_solar.pdf") {
  const doc = await docOrPromise;
  if (!doc) {
    throw new Error("Instância do documento PDF não foi gerada.");
  }

  // 1. Tenta o método nativo doc.save() do jsPDF
  try {
    if (typeof doc.save === "function") {
      doc.save(filename);
      return;
    }
  } catch (err) {
    console.warn("doc.save() falhou, tentando fallback via Blob:", err);
  }

  // 2. Fallback via doc.output('blob') e link de download temporário
  try {
    if (typeof doc.output === "function") {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }
  } catch (err) {
    console.warn("doc.output('blob') falhou:", err);
  }

  throw new Error("Não foi possível salvar o arquivo PDF no navegador.");
}

/**
 * 1. Planta de Implantação
 */
export async function generateSitePlanReport(project = {}, config = {}, sizing = {}) {
  const { azimuth, dcPowerKw, panelCount, usableArea, roofArea, roofWidth, roofHeight, roofPitch, moduleWp, inverterKw } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");

  // Resolve as imagens técnicas oficiais do projeto (layout com vista real de satélite dos prédios e strings)
  const { layoutImage, stringsImage, extraImages } = await resolveSolarReportImagesAsync({ project, config, sizing });

  // ==========================================
  // PÁGINA 1: DADOS GERAIS & LAYOUT DO TELHADO
  // ==========================================
  addHeader(doc, "PLANTA DE IMPLANTAÇÃO SOLAR", project);

  let y = 28;
  y = drawPdfSectionTitle(doc, "1. Dados Gerais da Instalação", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: `${dcPowerKw.toFixed(2)} kWp · ${panelCount} módulos`,
  });

  const dataRows = [
    ["Cliente", project?.client_name || "Cliente Solar", "Endereço", project?.address || "Endereço da Instalação"],
    ["Cidade / UF", `${project?.city || "São Paulo"} / ${project?.state || "SP"}`, "Tipo de Instalação", project?.installation_type || "Residencial"],
    ["Área Total do Telhado", `${roofArea.toFixed(1)} m²`, "Área Útil Ocupada", `${usableArea.toFixed(1)} m²`],
    ["Orientação / Azimute", azimuth.formatted, "Inclinação do Telhado", `${roofPitch}°`],
    ["Total de Módulos", `${panelCount} unidades`, "Potência Instalada", `${dcPowerKw.toFixed(2)} kWp`],
  ];

  y = drawSimpleTable(doc, y, ["Parâmetro", "Especificação", "Parâmetro", "Especificação"], dataRows, [42, 49, 42, 49]);

  y += 1.5;
  y = drawPdfSectionTitle(doc, "2. Layout e Arranjo Físico no Telhado", 14, y, 182, {
    accentColor: BRAND_BLUE,
    rightBadge: `Azimute ${azimuth.formatted}`,
  });

  // Sub-bloco A: Imagem do Layout dos Módulos no Telhado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_BLUE);
  doc.text("2.1 Layout dos módulos no telhado (Vista Superior)", 14, y);
  y += 2.5;

  // Imagem do layout dos módulos no telhado
  const imgWidth = 182;
  const imgHeight = 76;
  try {
    if (layoutImage) {
      doc.addImage(layoutImage, "PNG", 14, y, imgWidth, imgHeight, undefined, "FAST");
      doc.setDrawColor(180, 200, 225);
      doc.setLineWidth(0.35);
      doc.rect(14, y, imgWidth, imgHeight, "D");
    }
  } catch (err) {
    console.warn("Falha ao incluir imagem de layout no PDF:", err);
  }
  y += imgHeight + 3.5;

  // Box de Especificações Técnicas de Montagem Física (Cantos Quadrados e Simétricos)
  doc.setFillColor(248, 250, 253);
  doc.rect(14, y, 182, 52, "FD");
  doc.setDrawColor(210, 225, 240);
  doc.setLineWidth(0.3);
  doc.rect(14, y, 182, 52, "D");
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(14, y, 2.0, 52, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_BLUE);
  doc.text(`Especificações Técnicas de Montagem Física · ${panelCount} Módulos (${moduleWp}Wp)`, 18.5, y + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(60, 75, 95);

  const col1X = 18.5;
  const col2X = 105;

  doc.text(`• Dimensões do Telhado: ${roofWidth} m × ${roofHeight} m (${roofArea.toFixed(1)} m²)`, col1X, y + 13.5);
  doc.text(`• Afastamento de segurança (Setback): 0,30 m nas bordas`, col1X, y + 20.2);
  doc.text(`• Orientação dos módulos: ${config?.module_orientation === "horizontal" ? "Deitado (Paisagem)" : "Em pé (Retrato)"}`, col1X, y + 26.9);
  doc.text(`• Obstáculos identificados: ${config?.obstacles?.length || 0} excluídos da área útil`, col1X, y + 33.6);
  doc.text(`• Espaçamento térmico intermódulos: 20 mm c/ grampos`, col1X, y + 40.3);
  doc.text(`• Inclinação / Azimute: ${roofPitch}° / ${azimuth.formatted}`, col1X, y + 47.0);

  doc.text(`• Estrutura de fixação: Perfis de alumínio anodizado 6063-T6`, col2X, y + 13.5);
  doc.text(`• Fixadores: Parafusos prisioneiros / ganchos inox 304`, col2X, y + 20.2);
  doc.text(`• Carga estática admissível: 2400 Pa (vento) / 5400 Pa (peso)`, col2X, y + 26.9);
  doc.text(`• Aterramento da estrutura: Cabo de cobre nu / isolado 6 mm²`, col2X, y + 33.6);
  doc.text(`• Grau de proteção dos módulos: IP68 (caixa de junção)`, col2X, y + 40.3);
  doc.text(`• Conexões CC: Conectores padrão MC4 c/ travamento de segurança`, col2X, y + 47.0);

  // =======================================================
  // PÁGINA 2: ARRANJO ELÉTRICO DE STRINGS / CIRCUITOS CC
  // =======================================================
  doc.addPage();
  addHeader(doc, "PLANTA DE IMPLANTAÇÃO SOLAR — ARRANJO ELÉTRICO", project);

  let y2 = 28;
  y2 = drawPdfSectionTitle(doc, "2. Layout e Arranjo Físico no Telhado (Continuação)", 14, y2, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "Topologia CC · NBR 16690",
  });

  // Sub-bloco B: Imagem do Arranjo de Strings / Circuito Solar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_BLUE);
  doc.text("2.2 Arranjo de strings / circuito solar", 14, y2);
  y2 += 2.5;

  // Imagem do arranjo elétrico / strings / circuitos (Borda Quadrada)
  const stringsImgHeight = 80;
  try {
    if (stringsImage) {
      doc.addImage(stringsImage, "PNG", 14, y2, imgWidth, stringsImgHeight, undefined, "FAST");
      doc.setDrawColor(180, 200, 225);
      doc.setLineWidth(0.35);
      doc.rect(14, y2, imgWidth, stringsImgHeight, "D");
    }
  } catch (err) {
    console.warn("Falha ao incluir imagem de arranjo elétrico no PDF:", err);
  }
  y2 += stringsImgHeight + 4;

  // Tabela Técnica de Strings / Circuitos Solares
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...BRAND_DARK);
  doc.text("2.3 Quadro de Divisão das Strings e Conexão ao Inversor", 14, y2);
  y2 += 3;

  // Cálculo e listagem detalhada das strings
  const stringList = (sizing?.strings && sizing.strings.length > 0)
    ? sizing.strings
    : [
        {
          stringName: "String 01",
          modulesCount: Math.ceil(panelCount / 2),
          powerKw: ((Math.ceil(panelCount / 2) * moduleWp) / 1000).toFixed(2),
          vmpV: (Math.ceil(panelCount / 2) * 41.5).toFixed(1),
          vocV: (Math.ceil(panelCount / 2) * 49.8).toFixed(1),
          impA: "13.25",
          mppt: "MPPT 1",
        },
        {
          stringName: "String 02",
          modulesCount: Math.floor(panelCount / 2),
          powerKw: ((Math.floor(panelCount / 2) * moduleWp) / 1000).toFixed(2),
          vmpV: (Math.floor(panelCount / 2) * 41.5).toFixed(1),
          vocV: (Math.floor(panelCount / 2) * 49.8).toFixed(1),
          impA: "13.25",
          mppt: "MPPT 2 (ou MPPT 1 Par.)",
        },
      ];

  const stringTableRows = stringList.map((str, idx) => [
    str.stringName || `String 0${idx + 1}`,
    `${str.modulesCount || str.count || Math.ceil(panelCount / stringList.length)} un`,
    `${Number(str.powerKw || ((str.modulesCount || 10) * moduleWp / 1000)).toFixed(2)} kWp`,
    `${str.vmpV || "415.0"} V`,
    `${str.vocV || "498.0"} V`,
    `${str.impA || "13.25"} A`,
    str.mppt || `MPPT ${idx + 1}`,
  ]);

  // Linha totalizadora CC
  stringTableRows.push([
    "Total Gerador CC",
    `${panelCount} módulos`,
    `${dcPowerKw.toFixed(2)} kWp`,
    "—",
    "—",
    "—",
    `${inverterKw} kW Inversor`,
  ]);

  y2 = drawSimpleTable(
    doc,
    y2,
    ["Circuito / String", "Módulos", "Potência CC", "Tensão Vmp", "Tensão Voc", "Corrente Imp", "Entrada Inversor"],
    stringTableRows,
    [32, 22, 26, 25, 25, 24, 28]
  );

  y2 += 3;
  // Normas e Requisitos Construtivos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_DARK);
  doc.text("2.4 Conformidade Normativa e Requisitos de Instalação CC", 14, y2);
  y2 += 2.5;

  // Box Normativo com Cantos Quadrados e Alinhamento Preciso
  const normBoxH = 38;
  doc.setFillColor(248, 250, 253);
  doc.rect(14, y2, 182, normBoxH, "FD");
  doc.setDrawColor(210, 225, 240);
  doc.setLineWidth(0.3);
  doc.rect(14, y2, 182, normBoxH, "D");
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(14, y2, 2.0, normBoxH, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(50, 65, 85);
  const normLeft = 18.5;
  doc.text("• ABNT NBR 16690: Instalação de arranjos fotovoltaicos com proteção contra sobrecorrentes e sobretensões transitórias.", normLeft, y2 + 7);
  doc.text("• Condutores CC: Cabos flexíveis de cobre estanhado 4/6 mm², classe térmica 90°C (120°C máx), isolação 1,8 kV CC resistente a UV.", normLeft, y2 + 13.5);
  doc.text("• Conectores MC4: Crimpagem profissional com ferramentas calibradas e teste de continuidade prévio ao comissionamento.", normLeft, y2 + 20);
  doc.text("• Aterramento e Equipotencialização: Molduras de alumínio e estruturas interligadas ao barramento de equipotencialização (BEP).", normLeft, y2 + 26.5);
  doc.text("• Identificação Permanente: Etiquetas de advertência e sinalização indelével dos circuitos CC e polaridade nos eletrodutos.", normLeft, y2 + 33);

  // =======================================================
  // PÁGINA 3+ (OPCIONAL): REGISTROS FOTOGRÁFICOS / EXTRAS
  // =======================================================
  if (Array.isArray(extraImages) && extraImages.length > 0) {
    doc.addPage();
    addHeader(doc, "PLANTA DE IMPLANTAÇÃO SOLAR — VISTAS COMPLEMENTARES", project);

    let y3 = 28;
    y3 = drawPdfSectionTitle(doc, "3. Vistas Complementares e Registros Técnicos", 14, y3, 182, {
      accentColor: BRAND_BLUE,
    });

    extraImages.slice(0, 4).forEach((extra, idx) => {
      if (idx > 0 && idx % 2 === 0) {
        doc.addPage();
        addHeader(doc, "PLANTA DE IMPLANTAÇÃO SOLAR — VISTAS COMPLEMENTARES", project);
        y3 = 29;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...BRAND_BLUE);
      doc.text(extra.title || `Vista Complementar 0${idx + 1}`, 14, y3);
      y3 += 2.5;

      try {
        doc.addImage(extra.dataUrl, "PNG", 14, y3, 182, 85, undefined, "FAST");
        doc.setDrawColor(180, 200, 225);
        doc.setLineWidth(0.3);
        doc.rect(14, y3, 182, 85, "D");
      } catch (err) {
        console.warn("Falha ao incluir imagem complementar no PDF:", err);
      }
      y3 += 92;
    });
  }

  // =======================================================
  // RENUMERAÇÃO E ATUALIZAÇÃO DO RODAPÉ EM TODAS AS PÁGINAS
  // =======================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, totalPages);
  }

  return doc;
}

/**
 * 2. Diagrama Elétrico Solar
 */
export function generateElectricalDiagramReport(project = {}, config = {}, sizing = {}) {
  const { dcPowerKw, panelCount, moduleWp, inverterKw, breaker, acCurrent, isTri, acVoltage, powerFactor, supplyType } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "DIAGRAMA ELÉTRICO SOLAR & STRINGS", project);

  const cableGauge = breaker >= 160 ? "70 mm²" : breaker >= 125 ? "50 mm²" : breaker >= 100 ? "35 mm²" : breaker > 63 ? "16 mm²" : breaker > 40 ? "10 mm²" : "6 mm²";

  let y = 28;
  y = drawPdfKpiStrip(doc, [
    { label: "GERADOR CC", value: `${dcPowerKw.toFixed(2)} kWp`, sub: `${panelCount} × ${moduleWp}Wp`, highlight: true },
    { label: "INVERSOR CA", value: `${inverterKw} kW`, sub: `${isTri ? "Trifásico" : supplyType} · ${acVoltage}V` },
    { label: "CORRENTE PROJETO (Ib)", value: `${acCurrent.toFixed(1)} A`, sub: `FP ${powerFactor.toFixed(2)}` },
    { label: "DISJUNTOR / CABO CA", value: `${breaker}A ${isTri ? "3P" : "2P"}`, sub: `Curva C · ${cableGauge}` },
  ], 14, y, 182, 20);

  // Bloco principal: Diagrama Unifilar Vetorial Completo CC -> Inversor -> CA -> Rede
  y = drawPdfSectionTitle(doc, "1. Diagrama Unifilar Elétrico Fotovoltaico (NBR 16690 / NBR 5410)", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "Esquema Vetorial CC / CA",
  });

  const countStr1 = Math.ceil(panelCount / 2);
  const countStr2 = Math.floor(panelCount / 2);
  const resolvedStrings = (sizing?.strings && sizing.strings.length > 0)
    ? sizing.strings
    : [
        {
          stringName: "String 01",
          modulesCount: countStr1,
          powerKw: ((countStr1 * moduleWp) / 1000).toFixed(2),
          vmpV: (countStr1 * 41.5).toFixed(1),
          vocV: (countStr1 * 49.8).toFixed(1),
          impA: "13,25",
        },
        ...(countStr2 > 0 ? [{
          stringName: "String 02",
          modulesCount: countStr2,
          powerKw: ((countStr2 * moduleWp) / 1000).toFixed(2),
          vmpV: (countStr2 * 41.5).toFixed(1),
          vocV: (countStr2 * 49.8).toFixed(1),
          impA: "13,25",
        }] : []),
      ];

  y = drawSolarUnifilarVector(doc, {
    dcPowerKw,
    panelCount,
    moduleWp,
    inverterKw,
    acVoltage,
    supplyType,
    isTri,
    breaker,
    acCurrent,
    cableGauge,
    strings: resolvedStrings,
  }, { x: 14, y, w: 182, h: 102 });

  y = drawPdfSectionTitle(doc, "2. Configuração de Strings e Inversor", 14, y, 182, {
    accentColor: BRAND_BLUE,
    rightBadge: `${resolvedStrings.length} String(s) CC`,
  });

  const stringRows = resolvedStrings.map((str, idx) => {
    const cnt = Number(str.modulesCount || str.count || Math.ceil(panelCount / resolvedStrings.length));
    return [
      str.stringName || `String 0${idx + 1}`,
      `${cnt} × ${moduleWp}Wp`,
      `${Number(str.powerKw || ((cnt * moduleWp) / 1000)).toFixed(2)} kWp`,
      `${str.vmpV || "456,5"} V`,
      `${str.vocV || "547,8"} V`,
      `${str.impA || "13,25"} A`,
    ];
  });
  stringRows.push(["Total Gerador CC", `${panelCount} módulos`, `${dcPowerKw.toFixed(2)} kWp`, "—", "—", `${(resolvedStrings.length * 13.25).toFixed(2).replace(".", ",")} A`]);
  y = drawSimpleTable(doc, y, ["String / Circuito", "Módulos", "Potência (kWp)", "Vmp (V)", "Voc (V)", "Imp (A)"], stringRows, [30, 32, 30, 30, 30, 30]);

  if (y > 215) {
    doc.addPage();
    addHeader(doc, "DIAGRAMA ELÉTRICO SOLAR & PROTEÇÕES (CONT.)", project);
    y = 29;
  }

  y = drawPdfSectionTitle(doc, "3. Proteção e Saída CA (Conexão ao Quadro Principal)", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "NBR 5410 · IEC 60898",
  });

  const acRows = [
    ["Inversor Fotovoltaico", `${inverterKw} kW (${isTri ? "Trifásico" : "Bifásico/Monofásico"} ${acVoltage}V)`, `FP = ${powerFactor.toFixed(2)}`],
    ["Corrente de Projeto (Ib)", `${acCurrent.toFixed(2)} A`, isTri ? "Ib = P / (V × √3 × FP) [NBR 5410]" : "Ib = P / (V × FP) [NBR 5410]"],
    ["Disjuntor Termomagnético CA", `Disjuntor ${breaker}A ${isTri ? "3P" : "2P"} Curva C`, `In ≥ Ib (${breaker}A ≥ ${acCurrent.toFixed(2)}A) IEC/DIN`],
    ["Condutores CA (Fase/Neutro/PE)", `${cableGauge} Cobre EPR/XLPE 90°C`, "Capacidade de condução Iz ≥ In"],
    ["DPS CA (Classe II)", "DPS 275V / 20-40kA com sinalização", "Proteção contra surtos NBR 5410"],
    ["Quadro de Conexão", "Integrado no Quadro Principal de Entrada", "Quadro de Distribuição"],
  ];
  y = drawSimpleTable(doc, y, ["Elemento", "Parâmetro Calculado", "Critério Normativo"], acRows, [52, 65, 65]);

  if (y <= 252) {
    doc.setFillColor(...PDF_THEME.slate50);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 182, 22, "FD");
    doc.setFillColor(...BRAND_TEAL);
    doc.rect(14, y, 2.0, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BRAND_DARK);
    doc.text("Notas Técnicas de Execução e Comissionamento", 18.5, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.9);
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text("• Polaridade CC, tensão de circuito aberto (Voc) e isolação deverão ser verificadas antes da energização do inversor.", 18.5, y + 11.2);
    doc.text("• Identificar de forma permanente os quadros CC/CA, seccionadoras e ponto de conexão com advertência de geração própria.", 18.5, y + 16.5);
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, totalPages);
  }
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
    doc.rect(14, y - 5, 182, 10, "F");
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

  // Bloco Hero Executivo do Memorial Solar
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.35);
  doc.rect(14, y - 2, 182, 20, "FD");
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(14, y - 2, 2.5, 20, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BRAND_BLUE);
  doc.text("MEMORIAL DESCRITIVO", 20, y + 6);
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND_TEAL);
  doc.text("SISTEMA DE GERAÇÃO SOLAR FOTOVOLTAICO · NBR 16690 & NBR 5410", 20, y + 12.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  doc.text(`Emissão: ${data.date}`, 192, y + 12.5, { align: "right" });
  y += 22;

  y = drawPdfKpiStrip(doc, [
    { label: "POTÊNCIA GERADOR", value: `${formatDecimalBR(data.systemPowerKwp)} kWp`, sub: `${data.panelCount} × ${data.moduleWp}Wp`, highlight: true },
    { label: "INVERSOR(ES)", value: `${formatDecimalBR(data.inverterPowerKw)} kW`, sub: `${data.inverterCount} un · ${data.systemType}` },
    { label: "CONEXÃO CA", value: `${data.connectionVoltage} V`, sub: `${data.supplyType} · ${data.frequencyHz} Hz` },
    { label: "DISJUNTOR CONEXÃO", value: data.connectionBreakerA ? `${data.connectionBreakerA} A` : "A definir", sub: data.distributor },
  ], 14, y, 182, 19);

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

  const memorialSolarParams = normalizeParams(project, config, sizing);
  ensureSpace(112);
  y = drawPdfSectionTitle(doc, "6.1 Esquema Unifilar Simplificado de Conexão", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "NBR 16690 / NBR 5410",
  });
  y = drawSolarUnifilarVector(doc, {
    ...memorialSolarParams,
    strings: [
      { id: "STR 01", modules: Math.ceil(memorialSolarParams.panelCount / 2), kw: (Math.ceil(memorialSolarParams.panelCount / 2) * memorialSolarParams.moduleWp) / 1000, vmp: 456.5, imp: 13.25 },
      { id: "STR 02", modules: Math.floor(memorialSolarParams.panelCount / 2), kw: (Math.floor(memorialSolarParams.panelCount / 2) * memorialSolarParams.moduleWp) / 1000, vmp: 415.0, imp: 13.25 },
    ],
  }, { x: 14, y, w: 182, h: 92 });

  ensureSpace(46);
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.rect(14, y, 182, 34, "FD");
  doc.setFillColor(...BRAND_DARK);
  doc.rect(14, y, 2, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text("RESPONSÁVEL TÉCNICO PELO PROJETO", 19, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(45, 55, 70);
  doc.text(`Profissional: ${data.technicalResponsibleName}`, 19, y + 12.5);
  doc.text(`Registro Profissional: ${data.crea}   |   Data: ${data.date}`, 19, y + 18);
  doc.setDrawColor(...PDF_THEME.slate500);
  doc.setLineWidth(0.35);
  doc.line(19, y + 27, 112, y + 27);
  doc.setFontSize(7.2);
  doc.setTextColor(...PDF_THEME.slate500);
  doc.text("Assinatura do Responsável Técnico", 19, y + 31);
  y += 38;

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    addFooter(doc, page, totalPages);
  }
  return doc;
}

/**
 * Classifica automaticamente um item da Lista de Materiais (BOM) entre:
 * - "ESCOPO_01_CC": Equipamentos de Energia Solar (Kit Gerador / Lado CC - NBR 16690)
 * - "ESCOPO_02_CA": Materiais Elétricos de Infraestrutura (Lado CA - NBR 5410)
 */
export function classifySolarBomScope(item = {}) {
  if (item.scope === "ESCOPO_01_CC" || item.scope === "ESCOPO_02_CA") {
    return item.scope;
  }
  const text = String(item.description || item.name || item.category || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // ESCOPO 02: MATERIAIS ELÉTRICOS (Infraestrutura / Lado CA - NBR 5410)
  if (
    text.includes("disjuntor") ||
    text.includes("termomagnetico") ||
    text.includes("dps") ||
    text.includes("surto") ||
    text.includes("750v") ||
    text.includes("saida ca") ||
    text.includes("cabo de cobre flexivel") ||
    text.includes("eletroduto") ||
    text.includes("corrugado") ||
    text.includes("abracadeira") ||
    text.includes("quadro de protecao") ||
    text.includes("string box ca") ||
    text.includes("qdc")
  ) {
    return "ESCOPO_02_CA";
  }

  // ESCOPO 01: ENERGIA SOLAR (Kit Gerador / Lado CC - NBR 16690)
  return "ESCOPO_01_CC";
}

/**
 * Separa o array de itens da BOM nas duas categorias normativas (CC vs CA)
 * e calcula isoladamente `total_orcamento_integrador` somando apenas o ESCOPO 02.
 */
export function separateAndCalculateSolarBom(items = []) {
  const escopo01_kit_solar_cc = [];
  const escopo02_materiais_eletricos_ca = [];

  items.forEach((rawItem) => {
    const scope = classifySolarBomScope(rawItem);
    const quantity = Number(rawItem.quantity ?? rawItem.qty ?? 1) || 0;
    const unitPrice = Number(rawItem.unitPrice ?? rawItem.unit_price ?? 0) || 0;
    const subtotal = Number((quantity * unitPrice).toFixed(2));

    const normalizedItem = {
      ...rawItem,
      scope,
      quantity,
      unitPrice,
      subtotal,
    };

    if (scope === "ESCOPO_02_CA") {
      escopo02_materiais_eletricos_ca.push({
        ...normalizedItem,
        itemCode: String(escopo02_materiais_eletricos_ca.length + 1).padStart(2, "0"),
      });
    } else {
      escopo01_kit_solar_cc.push({
        ...normalizedItem,
        itemCode: String(escopo01_kit_solar_cc.length + 1).padStart(2, "0"),
      });
    }
  });

  // Variável exigida: soma exclusivamente os itens classificados no ESCOPO 02 (Lado CA - NBR 5410)
  const total_orcamento_integrador = Number(
    escopo02_materiais_eletricos_ca
      .reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)
      .toFixed(2)
  );

  return {
    escopo01_kit_solar_cc,
    escopo02_materiais_eletricos_ca,
    total_orcamento_integrador,
    totalOrcamentoIntegradorFormatted: `R$ ${formatDecimalBR(total_orcamento_integrador)}`,
  };
}

/**
 * Constrói os quantitativos e orçamentos estruturados da BOM Solar (Lado CC vs Lado CA)
 */
export function buildSolarBomData(project = {}, config = {}, sizing = {}) {
  const { panelCount, moduleWp, inverterKw, breaker, isTri, acVoltage } = normalizeParams(project, config, sizing);
  const poleLabel = isTri ? "Tripolar 3P" : "Bipolar 2P";
  const breakerPrice = breaker >= 200 ? 480.0 : breaker >= 100 ? 185.0 : breaker >= 63 ? 118.0 : 78.9;
  const cableGauge = breaker >= 160 ? "70mm²" : breaker >= 125 ? "50mm²" : breaker >= 100 ? "35mm²" : breaker > 63 ? "16mm²" : breaker > 40 ? "10mm²" : "6mm²";
  const cableUnitPrice = breaker >= 160 ? 68.0 : breaker >= 125 ? 49.0 : breaker >= 100 ? 34.5 : breaker > 63 ? 16.9 : breaker > 40 ? 11.2 : 6.8;

  const defaultBomItems = [
    // ESCOPO 01: ENERGIA SOLAR (Kit Gerador / Lado CC - NBR 16690)
    {
      description: `Módulo Solar Monocristalino ${moduleWp}Wp Half-Cell Tier 1`,
      manufacturer: "Canadian / Jinko / Longi",
      quantity: panelCount,
      unit: "un",
      unitPrice: 0,
      scope: "ESCOPO_01_CC",
    },
    {
      description: `Inversor Solar On-Grid/Híbrido ${inverterKw}kW ${acVoltage}V 2 MPPTs`,
      manufacturer: "Growatt / Deye / Solis",
      quantity: 1,
      unit: "un",
      unitPrice: 0,
      scope: "ESCOPO_01_CC",
    },
    {
      description: "Estrutura de Fixação em Alumínio p/ Telhado Cerâmico / Metálico",
      manufacturer: "Perfil + Ganchos Inox",
      quantity: panelCount,
      unit: "conj",
      unitPrice: 0,
      scope: "ESCOPO_01_CC",
    },
    {
      description: "Cabo Solar Fotovoltaico 1kV 4mm² Cobre Estanhado Preto",
      manufacturer: "Prysmian / Nexans",
      quantity: 60,
      unit: "m",
      unitPrice: 0,
      scope: "ESCOPO_01_CC",
    },
    {
      description: "Cabo Solar Fotovoltaico 1kV 4mm² Cobre Estanhado Vermelho",
      manufacturer: "Prysmian / Nexans",
      quantity: 60,
      unit: "m",
      unitPrice: 0,
      scope: "ESCOPO_01_CC",
    },
    {
      description: "Par de Conectores MC4 Macho / Fêmea 1000V",
      manufacturer: "Stäubli / Compatível",
      quantity: 6,
      unit: "par",
      unitPrice: 0,
      scope: "ESCOPO_01_CC",
    },
    {
      description: "Placas de Advertência e Sinalização de Segurança NBR 16690",
      manufacturer: "Acrílico / Adesivo",
      quantity: 1,
      unit: "kit",
      unitPrice: 0,
      scope: "ESCOPO_01_CC",
    },

    // ESCOPO 02: MATERIAIS ELÉTRICOS (Infraestrutura / Lado CA - NBR 5410)
    {
      description: `Disjuntor Termomagnético Curva C ${breaker}A (${poleLabel})`,
      manufacturer: "Schneider / WEG",
      quantity: 1,
      unit: "un",
      unitPrice: breakerPrice,
      scope: "ESCOPO_02_CA",
    },
    {
      description: "DPS CA Classe II 275V 20/40kA (Proteção Surtos)",
      manufacturer: "Clamper / WEG",
      quantity: 2,
      unit: "un",
      unitPrice: 64.5,
      scope: "ESCOPO_02_CA",
    },
    {
      description: `Cabo de Cobre Flexível 750V ${cableGauge} (Fases / Neutro / PE)`,
      manufacturer: "Sil / Corfio",
      quantity: 30,
      unit: "m",
      unitPrice: cableUnitPrice,
      scope: "ESCOPO_02_CA",
    },
    {
      description: "Eletroduto Corrugado Antichamas c/ Conexões e Abraçadeiras",
      manufacturer: "Tigre / Amanco",
      quantity: 1,
      unit: "lote",
      unitPrice: 195.0,
      scope: "ESCOPO_02_CA",
    },
    {
      description: "Quadro de Proteção CA (String Box CA / QDC Sobrepor IP65)",
      manufacturer: "Brum / Cemar / Steck",
      quantity: 1,
      unit: "un",
      unitPrice: 168.0,
      scope: "ESCOPO_02_CA",
    },
  ];

  const sourceItems =
    Array.isArray(project?.solar_bom_items) && project.solar_bom_items.length > 0
      ? project.solar_bom_items
      : defaultBomItems;

  return separateAndCalculateSolarBom(sourceItems);
}

/**
 * 4. Lista de Materiais e Quantitativos (BOM)
 */
export function generateBillOfMaterialsReport(project = {}, config = {}, sizing = {}) {
  const {
    escopo01_kit_solar_cc,
    escopo02_materiais_eletricos_ca,
    total_orcamento_integrador,
  } = buildSolarBomData(project, config, sizing);
  const { dcPowerKw, panelCount, inverterKw } = normalizeParams(project, config, sizing);

  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "LISTA DE MATERIAIS & QUANTITATIVOS (BOM)", project);

  let y = 26;
  y = drawPdfKpiStrip(doc, [
    { label: "ITENS KIT SOLAR (CC)", value: `${escopo01_kit_solar_cc.length} itens`, sub: `${panelCount} módulos · ${dcPowerKw.toFixed(2)} kWp` },
    { label: "ITENS INFRA CA (5410)", value: `${escopo02_materiais_eletricos_ca.length} itens`, sub: `Inversor ${inverterKw} kW` },
    { label: "ESCOPO CC (KIT)", value: "Isolado", sub: "Custo oculto ao integrador", accent: BRAND_BLUE },
    { label: "ORÇAMENTO INTEGRADOR", value: `R$ ${formatDecimalBR(total_orcamento_integrador)}`, sub: "Escopo 02 (Lado CA)", highlight: true },
  ], 14, y, 182, 18.5);
  y += 3.5;

  // BLOCO 01: ESCOPO 01 — EQUIPAMENTOS DE ENERGIA SOLAR (LADO CC - NBR 16690)
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 10, "F");
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(14, y, 2.5, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text("ESCOPO 01: EQUIPAMENTOS DE ENERGIA SOLAR (Kit Gerador / Lado CC — ABNT NBR 16690)", 19, y + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(90, 105, 125);
  doc.text("Composição física do Kit Gerador Fotovoltaico (valores financeiros e margens do kit não repassados ao integrador)", 19, y + 8.2);
  y += 11.5;

  const escopo01Rows = escopo01_kit_solar_cc.map((item) => [
    item.itemCode,
    item.description,
    item.manufacturer,
    String(item.quantity),
    item.unit,
  ]);

  y = drawSimpleTable(
    doc,
    y,
    ["Item", "Descrição do Equipamento Solar (Lado CC)", "Fabricante / Ref.", "Qtd.", "Un."],
    escopo01Rows,
    [12, 92, 46, 16, 16],
    ["center", "left", "left", "center", "center"]
  );

  y += 4.5;

  // BLOCO 02: ESCOPO 02 — MATERIAIS ELÉTRICOS DE INFRAESTRUTURA (LADO CA - NBR 5410)
  doc.setFillColor(236, 253, 245);
  doc.rect(14, y, 182, 10, "F");
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(14, y, 2.5, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text("ESCOPO 02: MATERIAIS ELÉTRICOS DE INFRAESTRUTURA (Lado CA — ABNT NBR 5410)", 19, y + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(15, 79, 73);
  doc.text("Escopo de fornecimento e responsabilidade de instalação elétrica CA (base para orçamento do Integrador/Instalador)", 19, y + 8.2);
  y += 11.5;

  const escopo02Rows = escopo02_materiais_eletricos_ca.map((item) => [
    item.itemCode,
    item.description,
    item.manufacturer,
    String(item.quantity),
    item.unit,
    `R$ ${formatDecimalBR(item.unitPrice)}`,
    `R$ ${formatDecimalBR(item.subtotal)}`,
  ]);

  y = drawSimpleTable(
    doc,
    y,
    ["Item", "Descrição do Material Elétrico (Lado CA)", "Fabricante / Ref.", "Qtd.", "Un.", "Vlr. Unit.", "Subtotal"],
    escopo02Rows,
    [10, 70, 36, 11, 11, 22, 22],
    ["center", "left", "left", "center", "center", "right", "right"]
  );

  y += 5.5;

  // RESUMO FINANCEIRO ISOLADO DO INTEGRADOR (RODAPÉ DESTACADO)
  const cardHeight = 25;
  doc.setFillColor(...BRAND_DARK);
  doc.rect(14, y, 182, cardHeight, "F");
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(14, y, 3, cardHeight, "F");
  doc.setDrawColor(...BRAND_TEAL);
  doc.setLineWidth(0.35);
  doc.rect(14, y, 182, cardHeight, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...BRAND_TEAL);
  doc.text("DEMONSTRATIVO FINANCEIRO FECHADO — INFRAESTRUTURA ELÉTRICA CA (NBR 5410)", 20, y + 6.3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Orçamento de Materiais Elétricos (Integrador): R$ ${formatDecimalBR(total_orcamento_integrador)}`,
    20,
    y + 14.6
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.0);
  doc.setTextColor(175, 190, 210);
  doc.text(
    "Nota: Subtotal apurado exclusivamente sobre o Escopo 02 (Lado CA). Custos e margens do Kit Gerador Solar (Escopo 01) estão isolados e ocultos.",
    20,
    y + 21.0
  );

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, totalPages);
  }
  return doc;
}

/**
 * 5. Simulação de Geração e Desempenho
 */
export function generateGenerationSimulationReport(project = {}, config = {}, sizing = {}) {
  const { annualKwh, annualSavings, dcPowerKw, panelCount, moduleWp } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "SIMULAÇÃO DE GERAÇÃO & DESEMPENHO ANUAL", project);

  const monthWeights = [1.12, 1.08, 1.05, 0.95, 0.85, 0.78, 0.82, 0.90, 0.96, 1.08, 1.18, 1.23];
  const weightSum = monthWeights.reduce((a, b) => a + b, 0);
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const shortMonths = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const monthlyKwh = months.map((_, i) => Math.round((annualKwh * monthWeights[i]) / weightSum));
  const peakIdx = monthlyKwh.indexOf(Math.max(...monthlyKwh));
  const avgMonthly = Math.round(annualKwh / 12);

  let y = 26;
  y = drawPdfKpiStrip(doc, [
    { label: "GERAÇÃO ANUAL", value: `${Math.round(annualKwh).toLocaleString("pt-BR")} kWh`, sub: `${dcPowerKw.toFixed(2)} kWp (${panelCount}×${moduleWp}Wp)`, highlight: true },
    { label: "MÉDIA MENSAL", value: `${avgMonthly.toLocaleString("pt-BR")} kWh`, sub: `Mês pico: ${shortMonths[peakIdx]} (${monthlyKwh[peakIdx]} kWh)` },
    { label: "PERFORMANCE RATIO", value: "80,0%", sub: "Fator global de perdas (PR)" },
    { label: "ECONOMIA 1º ANO", value: `R$ ${Math.round(annualSavings).toLocaleString("pt-BR")}`, sub: "Tarifa ref. estimada" },
  ], 14, y, 182, 19);

  y += 2;
  y = drawVectorBarChart(doc, {
    x: 14,
    y,
    w: 182,
    h: 58,
    title: "CURVA DE GERAÇÃO MENSAL ESTIMADA (kWh/MÊS)",
    subtitle: `Irradiação regional típica · Sistema ${dcPowerKw.toFixed(2)} kWp`,
    labels: shortMonths,
    values: monthlyKwh,
    barColor: BRAND_TEAL,
    valueFormatter: (v) => String(Math.round(v)),
  });

  y += 2;
  y = drawPdfSectionTitle(doc, "Detalhamento Mensal de Geração e Economia Estimada", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "Ciclo 12 Meses",
  });

  const tableBody = months.map((month, i) => {
    const kwh = monthlyKwh[i];
    const savings = Math.round(kwh * 0.95);
    return [month, `${kwh.toLocaleString("pt-BR")} kWh`, `R$ ${savings.toLocaleString("pt-BR")}`, "80,0%"];
  });
  tableBody.push(["TOTAL ANUAL", `${Math.round(annualKwh).toLocaleString("pt-BR")} kWh`, `R$ ${Math.round(annualKwh * 0.95).toLocaleString("pt-BR")}`, "80,0%"]);

  y = drawSimpleTable(doc, y, ["Mês", "Geração Prevista (kWh)", "Economia Estimada (R$)", "PR Médio"], tableBody, [45, 45, 46, 46]);

  if (y <= 255) {
    doc.setFillColor(...PDF_THEME.slate50);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 182, 16, "FD");
    doc.setFillColor(...BRAND_BLUE);
    doc.rect(14, y, 2, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(...BRAND_DARK);
    doc.text("Premissas de Simulação:", 18.5, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.9);
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text("Consideradas perdas por temperatura, cabeamento CC/CA, eficiência do inversor, sujeira e sombreamento parcial conforme orientação do telhado.", 18.5, y + 11.2);
  }

  addFooter(doc, 1, 1);
  return doc;
}

/**
 * 6. Proposta Comercial Executiva
 */
export function generateCommercialProposalReport(project = {}, config = {}, sizing = {}) {
  const { dcPowerKw, annualSavings, annualKwh, investment, payback, panelCount, moduleWp, inverterKw } = normalizeParams(project, config, sizing);
  const doc = new jsPDF("p", "mm", "a4");
  addHeader(doc, "PROPOSTA COMERCIAL EXECUTIVA", project);

  const savings25Years = annualSavings * 25;
  const roiPct = investment > 0 ? ((savings25Years - investment) / investment) * 100 : 0;
  const co2Year = (dcPowerKw * 0.48).toFixed(1);
  const trees = Math.max(12, Math.round(dcPowerKw * 18));

  let y = 26;
  y = drawPdfKpiStrip(doc, [
    { label: "INVESTIMENTO TURNKEY", value: investment.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), sub: `${dcPowerKw.toFixed(2)} kWp · ${panelCount}×${moduleWp}Wp` },
    { label: "ECONOMIA 1º ANO", value: annualSavings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), sub: `~${Math.round(annualKwh / 12)} kWh/mês gerados`, accent: BRAND_TEAL },
    { label: "ECONOMIA 25 ANOS", value: savings25Years.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), sub: `ROI acumulado ${Math.round(roiPct)}%`, highlight: true },
    { label: "PAYBACK SIMPLES", value: `${payback} anos`, sub: "Retorno do capital investido" },
  ], 14, y, 182, 20);

  y += 2;
  // Gráfico comparativo de fluxo acumulado (Anos 1, 3, 5, 10, 15, 20, 25)
  const yearsLabels = ["Ano 1", "Ano 3", "Ano 5", "Ano 10", "Ano 15", "Ano 20", "Ano 25"];
  const yearsMult = [1, 3, 5, 10, 15, 20, 25];
  const cumSavings = yearsMult.map((yr) => Math.round((annualSavings * yr) / 1000));
  y = drawVectorBarChart(doc, {
    x: 14,
    y,
    w: 182,
    h: 54,
    title: "PROJEÇÃO DE ECONOMIA ACUMULADA AO LONGO DE 25 ANOS (MIL R$)",
    subtitle: `Inversor ${inverterKw} kW · Vida útil estimada de geração > 25 anos`,
    labels: yearsLabels,
    values: cumSavings,
    barColor: BRAND_TEAL,
    valueFormatter: (v) => `R$ ${Math.round(v)}k`,
  });

  y += 2;
  y = drawPdfSectionTitle(doc, "1. Resumo do Investimento e Retorno Financeiro", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "Proposta Turnkey",
  });

  const proposalRows = [
    ["Potência do Sistema", `${dcPowerKw.toFixed(2)} kWp`, `${panelCount} módulos fotovoltaicos (${moduleWp} Wp)`],
    ["Investimento Estimado", investment.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Equipamentos + Engenharia + Instalação + Homologação"],
    ["Economia no 1º Ano", annualSavings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Redução de até 95% na fatura de energia elétrica"],
    ["Economia em 25 Anos", savings25Years.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Garantia linear de desempenho dos módulos"],
    ["Payback Simples", `${payback} anos`, "Tempo estimado de retorno integral do investimento"],
    ["Impacto Ambiental", `${co2Year} ton CO2/ano`, `Equivalente a ~${trees} árvores preservadas/ano`],
  ];

  y = drawSimpleTable(doc, y, ["Indicador Financeiro", "Valor Projetado", "Observação"], proposalRows, [48, 48, 86]);
  y += 3;

  // Bloco de condições comerciais e escopo incluso
  if (y <= 238) {
    doc.setFillColor(...PDF_THEME.slate50);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 89, 34, "FD");
    doc.setFillColor(...BRAND_TEAL);
    doc.rect(14, y, 2, 34, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(...BRAND_DARK);
    doc.text("ESCOPO INCLUSO NA PROPOSTA", 18.5, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.0);
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text("• Módulos fotovoltaicos Tier-1 + Inversor homologado INMETRO", 18.5, y + 12);
    doc.text("• String Box CC / Proteções CA (Disjuntor + DPS)", 18.5, y + 17.5);
    doc.text("• Projeto executivo, ART CREA e homologação na distribuidora", 18.5, y + 23);
    doc.text("• Instalação mecânica/elétrica e comissionamento completo", 18.5, y + 28.5);

    doc.setFillColor(...PDF_THEME.navySoft);
    doc.setDrawColor(...BRAND_DARK);
    doc.rect(107, y, 89, 34, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    doc.setTextColor(...BRAND_TEAL);
    doc.text("CONDIÇÕES & GARANTIAS", 112, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.0);
    doc.setTextColor(226, 232, 240);
    doc.text("• Validade da proposta: 15 dias corridos", 112, y + 12);
    doc.text("• Garantia de geração linear módulos: 25 anos", 112, y + 17.5);
    doc.text("• Garantia do inversor: conforme fabricante (5 a 10 anos)", 112, y + 23);
    doc.text("• Garantia de instalação e engenharia: 12 meses", 112, y + 28.5);
  }

  addFooter(doc, 1, 1);
  return doc;
}

/**
 * 7. Relatório Executivo Completo Consolidado (Todas as seções em um único PDF de 2 páginas)
 */
export async function generateExecutiveSolarPdf(project = {}, config = {}, sizing = {}) {
  const solarParams = normalizeParams(project, config, sizing);
  const {
    azimuth,
    dcPowerKw,
    panelCount,
    usableArea,
    annualKwh,
    annualSavings,
    moduleWp,
    inverterKw,
    roofArea,
    roofPitch,
    breaker,
    acVoltage,
    supplyType,
    isTri,
    acCurrent,
    cableGauge,
    investment,
    payback,
  } = solarParams;
  const doc = new jsPDF("p", "mm", "a4");
  const { layoutImage, stringsImage } = await resolveSolarReportImagesAsync({ project, config, sizing }).catch(() => ({ layoutImage: null, stringsImage: null }));

  // PÁGINA 1: Capa Executiva, Dados Técnicos, Strings & Implantação
  addHeader(doc, "RELATÓRIO TÉCNICO EXECUTIVO SOLAR", project);

  let y = 26;
  y = drawPdfKpiStrip(doc, [
    { label: "POTÊNCIA INSTALADA", value: `${dcPowerKw.toFixed(2)} kWp`, sub: `${panelCount} Módulos (${moduleWp}Wp)`, highlight: true },
    { label: "GERAÇÃO ANUAL", value: `${(annualKwh / 1000).toFixed(2)} MWh`, sub: `${Math.round(annualKwh / 12)} kWh/mês` },
    { label: "ECONOMIA 1º ANO", value: `R$ ${Math.round(annualSavings).toLocaleString("pt-BR")}`, sub: "Até 95% de abatimento" },
    { label: "PAYBACK ESTIMADO", value: `${payback} anos`, sub: `Invest. R$ ${Math.round(investment).toLocaleString("pt-BR")}` },
  ], 14, y, 182, 20);

  y += 2;
  y = drawPdfSectionTitle(doc, "1. Dados da Instalação e Características do Telhado", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "Visão Geral",
  });

  const dataRows = [
    ["Cliente / Titular", project?.client_name || "Cliente Solar", "Endereço", project?.address || "Endereço da Instalação"],
    ["Cidade / UF", `${project?.city || "São Paulo"} / ${project?.state || "SP"}`, "Distribuidora", project?.consumption?.distributor || project?.distributor || "Enel SP"],
    ["Área do Telhado", `${roofArea.toFixed(1)} m² (Útil: ${usableArea.toFixed(1)} m²)`, "Azimute / Inclinação", `${azimuth.formatted} / ${roofPitch}°`],
    ["Inversor FV", `${inverterKw} kW (${supplyType} ${acVoltage}V)`, "Disjuntor CA", `${breaker}A Curva C`],
  ];
  y = drawSimpleTable(doc, y, ["Parâmetro", "Especificação", "Parâmetro", "Especificação"], dataRows, [42, 49, 42, 49]);

  y += 2;
  y = drawPdfSectionTitle(doc, "2. Arranjo de Strings CC e Geração", 14, y, 182, {
    accentColor: BRAND_BLUE,
    rightBadge: "NBR 16690",
  });

  const s1Count = Math.ceil(panelCount / 2);
  const s2Count = Math.floor(panelCount / 2);
  const stringRows = [
    ["String 01", `${s1Count} × ${moduleWp}Wp`, `${((s1Count * moduleWp) / 1000).toFixed(2)} kWp`, "456,5 V", "13,25 A"],
    ["String 02", `${s2Count} × ${moduleWp}Wp`, `${((s2Count * moduleWp) / 1000).toFixed(2)} kWp`, "415,0 V", "13,25 A"],
    ["Total Gerador", `${panelCount} Módulos`, `${dcPowerKw.toFixed(2)} kWp`, "—", "26,50 A"],
  ];
  y = drawSimpleTable(doc, y, ["Circuito", "Módulos", "Potência CC", "Tensão Vmp", "Corrente Imp"], stringRows, [35, 40, 35, 36, 36]);

  if (layoutImage || stringsImage) {
    y += 2;
    y = drawPdfSectionTitle(doc, "2.1 Implantação dos Módulos no Telhado e Topologia de Strings", 14, y, 182, {
      accentColor: BRAND_TEAL,
    });

    const cardW = 89;
    const cardH = 54;
    if (layoutImage) {
      try {
        doc.addImage(layoutImage, "PNG", 14, y, cardW, cardH, undefined, "FAST");
        doc.setDrawColor(...PDF_THEME.slate300);
        doc.setLineWidth(0.35);
        doc.rect(14, y, cardW, cardH, "D");
      } catch {}
    }
    if (stringsImage) {
      try {
        doc.addImage(stringsImage, "PNG", 107, y, cardW, cardH, undefined, "FAST");
        doc.setDrawColor(...PDF_THEME.slate300);
        doc.setLineWidth(0.35);
        doc.rect(107, y, cardW, cardH, "D");
      } catch {}
    }
  }

  // PÁGINA 2: Diagrama Unifilar Elétrico Solar + Proteções + Curva de Geração Mensal
  doc.addPage();
  addHeader(doc, "DIAGRAMA UNIFILAR & DESEMPENHO SOLAR", project);
  y = 26;

  y = drawPdfSectionTitle(doc, "3. Diagrama Unifilar Elétrico — Sistema Fotovoltaico CC / CA", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "NBR 16690 · NBR 5410",
  });
  y = drawSolarUnifilarVector(doc, {
    ...solarParams,
    strings: [
      { id: "STR 01", modules: s1Count, kw: (s1Count * moduleWp) / 1000, vmp: 456.5, imp: 13.25 },
      { id: "STR 02", modules: s2Count, kw: (s2Count * moduleWp) / 1000, vmp: 415.0, imp: 13.25 },
    ],
  }, { x: 14, y, w: 182, h: 102 });

  y += 2;
  y = drawPdfSectionTitle(doc, "3.1 Dimensionamento de Proteção e Circuito CA", 14, y, 182, {
    accentColor: BRAND_BLUE,
    rightBadge: `${supplyType} ${acVoltage}V`,
  });
  const acSummaryRows = [
    ["Corrente de Projeto (Ib)", `${acCurrent.toFixed(2)} A`, "Disjuntor CA (In)", `${breaker}A ${isTri ? "3P" : "2P"} Curva C`],
    ["Condutores CA", `${cableGauge} Cobre XLPE 90°C`, "Proteção Surto (DPS)", "Classe II 275V 20/40kA"],
  ];
  y = drawSimpleTable(doc, y, ["Parâmetro CA", "Valor Calculado", "Proteção / Norma", "Especificação"], acSummaryRows, [42, 46, 42, 52]);

  y += 2;
  const monthWeights = [1.12, 1.08, 1.05, 0.95, 0.85, 0.78, 0.82, 0.90, 0.96, 1.08, 1.18, 1.23];
  const weightSum = monthWeights.reduce((a, b) => a + b, 0);
  const shortMonths = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthlyKwh = shortMonths.map((_, i) => Math.round((annualKwh * monthWeights[i]) / weightSum));

  drawVectorBarChart(doc, {
    x: 14,
    y,
    w: 182,
    h: 58,
    title: "4. CURVA DE GERAÇÃO MENSAL ESTIMADA (kWh/MÊS)",
    subtitle: `Geração anual total: ${Math.round(annualKwh).toLocaleString("pt-BR")} kWh/ano (PR 80%)`,
    labels: shortMonths,
    values: monthlyKwh,
    barColor: BRAND_TEAL,
    valueFormatter: (v) => String(Math.round(v)),
  });

  // PÁGINA 3: Lista de Materiais (Escopo 01 CC / Escopo 02 CA) e Retorno Financeiro
  doc.addPage();
  addHeader(doc, "MATERIAIS (BOM) & VIABILIDADE FINANCEIRA", project);

  const {
    escopo01_kit_solar_cc,
    escopo02_materiais_eletricos_ca,
    total_orcamento_integrador,
  } = buildSolarBomData(project, config, sizing);

  y = 26;
  y = drawPdfSectionTitle(doc, "5. Lista de Materiais & Quantitativos (BOM — Separação Normativa CC / CA)", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: "CC + CA",
  });

  // Escopo 01: Kit Solar CC (NBR 16690)
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7.5, "F");
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(14, y, 2.5, 7.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.0);
  doc.setTextColor(...BRAND_DARK);
  doc.text("ESCOPO 01: EQUIPAMENTOS DE ENERGIA SOLAR (Kit Gerador / Lado CC — NBR 16690)", 19, y + 5.0);
  y += 8.5;

  const execEscopo01Rows = escopo01_kit_solar_cc.map((item) => [
    item.itemCode,
    item.description,
    item.manufacturer,
    String(item.quantity),
    item.unit,
  ]);
  y = drawSimpleTable(
    doc,
    y,
    ["Item", "Descrição do Equipamento Solar (Lado CC)", "Fabricante / Ref.", "Qtd.", "Un."],
    execEscopo01Rows,
    [12, 92, 46, 16, 16],
    ["center", "left", "left", "center", "center"]
  );

  y += 2.5;

  // Escopo 02: Materiais Elétricos CA (NBR 5410)
  doc.setFillColor(236, 253, 245);
  doc.rect(14, y, 182, 7.5, "F");
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(14, y, 2.5, 7.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.0);
  doc.setTextColor(...BRAND_DARK);
  doc.text("ESCOPO 02: MATERIAIS ELÉTRICOS DE INFRAESTRUTURA (Lado CA — NBR 5410)", 19, y + 5.0);
  y += 8.5;

  const execEscopo02Rows = escopo02_materiais_eletricos_ca.map((item) => [
    item.itemCode,
    item.description,
    item.manufacturer,
    String(item.quantity),
    item.unit,
    `R$ ${formatDecimalBR(item.unitPrice)}`,
    `R$ ${formatDecimalBR(item.subtotal)}`,
  ]);
  y = drawSimpleTable(
    doc,
    y,
    ["Item", "Descrição do Material Elétrico (Lado CA)", "Fabricante / Ref.", "Qtd.", "Un.", "Vlr. Unit.", "Subtotal"],
    execEscopo02Rows,
    [10, 70, 36, 11, 11, 22, 22],
    ["center", "left", "left", "center", "center", "right", "right"]
  );

  // Card de Resumo Financeiro do Integrador
  doc.setFillColor(...BRAND_DARK);
  doc.rect(14, y, 182, 14, "F");
  doc.setFillColor(...BRAND_TEAL);
  doc.rect(14, y, 2.5, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Orçamento de Materiais Elétricos (Integrador): R$ ${formatDecimalBR(total_orcamento_integrador)}`,
    19,
    y + 6.5
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(175, 190, 210);
  doc.text(
    "Subtotal isolado do Escopo 02 (Infraestrutura CA - NBR 5410). Custos e margens do Kit Solar (Escopo 01) ocultados desta visualização.",
    19,
    y + 11.5
  );
  y += 18;

  y = drawPdfSectionTitle(doc, "6. Viabilidade Financeira e Retorno em 25 Anos", 14, y, 182, {
    accentColor: BRAND_TEAL,
    rightBadge: `Payback ${payback} anos`,
  });

  const finRows = [
    ["Investimento Estimado (Turnkey)", investment.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Equipamentos + Engenharia + Instalação + Homologação"],
    ["Economia no 1º Ano de Operação", annualSavings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Redução média de até 95% no faturamento de energia"],
    ["Economia Acumulada em 25 Anos", (annualSavings * 25).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Garantia linear de geração de energia"],
    ["Payback Estimado", `${payback} anos`, "Retorno do capital investido"],
  ];
  drawSimpleTable(doc, y, ["Indicador Financeiro", "Valor Projetado", "Premissa Técnica"], finRows, [60, 48, 74]);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addFooter(doc, p, totalPages);
  }
  return doc;
}

/**
 * 8. Impressão Direta do Relatório Executivo Integrado (window.print)
 */
export async function printExecutiveSolarReport(project = {}, config = {}, sizing = {}, exportAuth = {}) {
  const { azimuth, dcPowerKw, panelCount, annualKwh, annualSavings, moduleWp, inverterKw, roofArea, usableArea, roofPitch, breaker, investment, payback } = normalizeParams(project, config, sizing);
  const {
    escopo01_kit_solar_cc,
    escopo02_materiais_eletricos_ca,
    total_orcamento_integrador,
  } = buildSolarBomData(project, config, sizing);
  const { layoutImage, stringsImage } = await resolveSolarReportImagesAsync({ project, config, sizing });

  const escopo01HtmlRows = escopo01_kit_solar_cc
    .map(
      (item) => `
          <tr>
            <td class="text-center"><strong>${item.itemCode}</strong></td>
            <td class="text-left">${item.description}</td>
            <td class="text-left">${item.manufacturer}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-center">${item.unit}</td>
          </tr>`
    )
    .join("");

  const escopo02HtmlRows = escopo02_materiais_eletricos_ca
    .map(
      (item) => `
          <tr>
            <td class="text-center"><strong>${item.itemCode}</strong></td>
            <td class="text-left">${item.description}</td>
            <td class="text-left">${item.manufacturer}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-center">${item.unit}</td>
            <td class="text-right">R$ ${formatDecimalBR(item.unitPrice)}</td>
            <td class="text-right"><strong>R$ ${formatDecimalBR(item.subtotal)}</strong></td>
          </tr>`
    )
    .join("");

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
        .header { display: flex; justify-content: space-between; align-items: center; background: #0e1726; color: #fff; padding: 10px 16px; border-radius: 0; margin-bottom: 14px; border-bottom: 3px solid #00d8b8; }
        .logo-box { display: flex; align-items: center; gap: 12px; }
        .logo-emblem { background: #132035; border: 1.5px solid #00d8b8; border-radius: 6px; padding: 4px; display: flex; align-items: center; justify-content: center; width: 44px; height: 42px; }
        .logo-img { width: 36px; height: 34px; object-fit: contain; }
        .logo-title { font-size: 17px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px; line-height: 1.1; }
        .logo-sub { font-size: 8px; font-weight: 700; color: #00d8b8; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 3px; }
        .doc-info-box { text-align: right; }
        .doc-title { text-align: right; font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.3px; }
        .doc-meta { text-align: right; font-size: 8.8px; color: #cbd5e1; margin-top: 2px; }
        .doc-submeta { text-align: right; font-size: 7.8px; color: #94a3b8; margin-top: 2px; }
        
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
        .kpi-card { border: 1px solid #cbd5e1; border-radius: 0; padding: 10px; background: #f8fafc; }
        .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; }
        .kpi-value { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
        .kpi-sub { font-size: 8.5px; color: #059669; font-weight: 600; }
        
        .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin: 10px 0 6px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; border-radius: 0; table-layout: fixed; }
        th { background: #003a78; color: #fff; font-weight: 700; text-align: left; padding: 5px 6px; font-size: 9px; }
        td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; vertical-align: middle; word-break: break-word; overflow-wrap: break-word; }
        td:last-child { border-right: none; }
        tr:nth-child(even) td { background: #f8fafc; }
        th.text-center, td.text-center { text-align: center; }
        th.text-right, td.text-right { text-align: right; }
        th.text-left, td.text-left { text-align: left; }
        
        .bom-scope-banner { padding: 6px 10px; margin: 8px 0 4px 0; border-left: 4px solid #003a78; background: #f1f5f9; }
        .bom-scope-banner.scope-ca { border-left-color: #00a896; background: #ecfdf5; }
        .bom-scope-title { font-size: 9.5px; font-weight: 800; color: #0e1726; text-transform: uppercase; }
        .bom-scope-sub { font-size: 8px; color: #475569; margin-top: 1px; }
        .integrator-budget-card { margin-top: 8px; margin-bottom: 12px; padding: 12px 14px; background: #0e1726; border-left: 4px solid #00d8b8; color: #ffffff; display: flex; justify-content: space-between; align-items: center; }
        .integrator-budget-tag { font-size: 8px; font-weight: 700; color: #00d8b8; text-transform: uppercase; letter-spacing: 0.4px; }
        .integrator-budget-title { font-size: 13px; font-weight: 800; color: #ffffff; margin-top: 2px; }
        .integrator-budget-note { font-size: 8px; color: #94a3b8; margin-top: 2px; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .box { border: 1px solid #e2e8f0; border-radius: 0; padding: 10px; background: #fff; }
        .box-title { font-size: 10px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
        .info-row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dashed #f1f5f9; }
        .info-label { color: #64748b; font-size: 9.5px; }
        .info-val { font-weight: 700; color: #0f172a; font-size: 9.5px; }
        
        .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; }
      </style>
    </head>
    <body>
      ${exportAuth.watermark ? `<div style="position:fixed;bottom:3mm;left:0;width:100%;text-align:center;color:#777;font-size:10px;z-index:9999">${String(exportAuth.watermark).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
      <div class="header">
        <div class="logo-box">
          <div class="logo-emblem">
            <img src="${NACIF_SYMBOL_BASE64}" class="logo-img" alt="Nacif Energy" />
          </div>
          <div>
            <div class="logo-title">NACIF <span style="color:#00d8b8">ENERGY</span></div>
            <div class="logo-sub">DA PLANTA AO SOL · TUDO EM UM SÓ LUGAR</div>
          </div>
        </div>
        <div class="doc-info-box">
          <div class="doc-title">RELATÓRIO TÉCNICO EXECUTIVO SOLAR</div>
          <div class="doc-meta">Projeto: ${project?.name || "Projeto Solar"}</div>
          <div class="doc-submeta">${[project?.city, project?.state].filter(Boolean).join(" / ") || project?.address ? `${[project?.city, project?.state].filter(Boolean).join(" / ") || project?.address} · ` : ""}${new Date().toLocaleDateString("pt-BR")}</div>
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

      <div class="section-title">2. Layout no Telhado e Arranjo de Strings</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <div style="border: 1px solid #cbd5e1; border-radius: 0; overflow: hidden; background: #0f172a;">
          <div style="background: #1e293b; color: #fff; padding: 5px 8px; font-size: 9px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
            <span>Layout dos módulos no telhado</span>
            <span style="font-size: 7.5px; color: #38bdf8;">Vista Superior CAD</span>
          </div>
          <div style="padding: 4px; display: flex; align-items: center; justify-content: center; min-height: 140px;">
            <img src="${layoutImage}" style="max-width: 100%; height: auto; display: block; border-radius: 0;" alt="Layout dos Módulos no Telhado" />
          </div>
          <div style="padding: 3px 6px; background: #f8fafc; font-size: 7.5px; color: #64748b; border-top: 1px solid #e2e8f0;">
            Disposição real dos módulos fotovoltaicos sobre a água do telhado com cotas e orientação cardeal
          </div>
        </div>

        <div style="border: 1px solid #cbd5e1; border-radius: 0; overflow: hidden; background: #0f172a;">
          <div style="background: #1e293b; color: #fff; padding: 5px 8px; font-size: 9px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
            <span>Arranjo de strings / circuito solar</span>
            <span style="font-size: 7.5px; color: #34d399;">Topologia CC</span>
          </div>
          <div style="padding: 4px; display: flex; align-items: center; justify-content: center; min-height: 140px;">
            <img src="${stringsImage}" style="max-width: 100%; height: auto; display: block; border-radius: 0;" alt="Arranjo de Strings / Circuito Solar" />
          </div>
          <div style="padding: 3px 6px; background: #f8fafc; font-size: 7.5px; color: #64748b; border-top: 1px solid #e2e8f0;">
            Mapeamento elétrico por cores e fiação em série das strings conectadas às entradas MPPT do inversor
          </div>
        </div>
      </div>

      <div class="section-title">3. Arranjo de Strings CC e Inversor</div>
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

      <div class="section-title">4. Integração com o Quadro de Distribuição CA (QD-01)</div>
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

      <div class="section-title">5. Lista de Materiais & Quantitativos (BOM)</div>
      <div class="bom-scope-banner">
        <div class="bom-scope-title">ESCOPO 01: EQUIPAMENTOS DE ENERGIA SOLAR (Kit Gerador / Lado CC — NBR 16690)</div>
        <div class="bom-scope-sub">Itens componentes do kit base fotovoltaico (valores financeiros e margem não repassados ao integrador)</div>
      </div>
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 7%;">Item</th>
            <th class="text-left" style="width: 53%;">Descrição do Equipamento Solar (Lado CC)</th>
            <th class="text-left" style="width: 24%;">Fabricante / Ref.</th>
            <th class="text-center" style="width: 8%;">Qtd.</th>
            <th class="text-center" style="width: 8%;">Un.</th>
          </tr>
        </thead>
        <tbody>
          ${escopo01HtmlRows}
        </tbody>
      </table>

      <div class="bom-scope-banner scope-ca">
        <div class="bom-scope-title">ESCOPO 02: MATERIAIS ELÉTRICOS DE INFRAESTRUTURA (Lado CA — NBR 5410)</div>
        <div class="bom-scope-sub">Bloco de responsabilidade do Integrador/Instalador — Orçamento isolado de infraestrutura elétrica CA</div>
      </div>
      <table>
        <thead>
          <tr>
            <th class="text-center" style="width: 6%;">Item</th>
            <th class="text-left" style="width: 42%;">Descrição do Material Elétrico (Lado CA)</th>
            <th class="text-left" style="width: 20%;">Fabricante / Ref.</th>
            <th class="text-center" style="width: 6%;">Qtd.</th>
            <th class="text-center" style="width: 6%;">Un.</th>
            <th class="text-right" style="width: 10%;">Vlr. Unit.</th>
            <th class="text-right" style="width: 10%;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${escopo02HtmlRows}
        </tbody>
      </table>

      <div class="integrator-budget-card">
        <div>
          <div class="integrator-budget-tag">Demonstrativo Financeiro Fechado — Infraestrutura Elétrica CA (NBR 5410)</div>
          <div class="integrator-budget-title">Orçamento de Materiais Elétricos (Integrador): R$ ${formatDecimalBR(total_orcamento_integrador)}</div>
          <div class="integrator-budget-note">Subtotal calculado exclusivamente sobre o Escopo 02. Custos e margens do Kit Solar (Escopo 01) estão ocultos desta visualização.</div>
        </div>
      </div>

      <div class="footer">
        <div>NACIF ENERGY · Engenharia Elétrica Aplicada</div>
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
