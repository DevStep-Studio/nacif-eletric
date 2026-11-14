import { authorizePlanExport, stampPdfWithPlanWatermark } from "@/lib/planEnforcement";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { calcProjectMetrics } from "@/lib/electricalEngine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, CheckCircle2, AlertTriangle, BookOpen, Cpu, Shield, Image as ImageIcon, MapPin, Ruler } from "lucide-react";
import { jsPDF } from "jspdf";
import PageHeader from "@/components/PageHeader";
import { DEFAULT_LOGO_URL } from "@/lib/brandingDefaults";
import { useBranding } from "@/lib/appPreferences";
import { buildProjectBudgetMaterials, getProjectLogo } from "@/lib/projectBudgetMaterials";
import { NACIF_LOGO_DARK_BASE64, NACIF_SYMBOL_BASE64 } from "@/lib/solarLogoAsset";
import {
  PDF_THEME,
  drawPdfKpiStrip,
  drawPdfSectionTitle,
  drawElectricalUnifilarVector,
  drawVectorBarChart,
} from "@/lib/unifilarPdfDrawer";
import brandLogoEnergy from "@/assets/brand-logo-principal.png";

const formatCurrencyBR = (value = 0) => Number(value || 0).toLocaleString("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const buildMemorialMaterialRows = (project = {}) => (
  buildProjectBudgetMaterials(project).materials.map((item, index) => ({
    name: item.name,
    model: item.model || item.name,
    code: item.code || item.source || `MAT-${String(index + 1).padStart(3, "0")}`,
    unit: item.unit || "un",
    qty: Number(item.qty) || 0,
    price: Number(item.price) || 0,
    total: Math.round((Number(item.qty) || 0) * (Number(item.price) || 0) * 100) / 100,
  }))
);

const parseAreaM2 = (value) => {
  if (value == null || value === "") return 0;
  const numeric = Number(String(value).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const resolveProjectAreaM2 = (project = {}) => {
  const explicit = parseAreaM2(
    project.area_m2
    || project.areaM2
    || project.built_area_m2
    || project.constructed_area_m2
    || project.total_area_m2
    || project.area,
  );
  if (explicit > 0) return explicit;

  const plant = project.plant_design || project.plantDesign || {};
  const rooms = Array.isArray(plant.rooms) ? plant.rooms : [];
  const roomArea = rooms.reduce((sum, room) => sum + parseAreaM2(room.area_m2 || room.area), 0);
  return Math.round(roomArea * 100) / 100;
};

const resolveProjectRegion = (project = {}) => {
  const explicit = [
    project.region,
    project.neighborhood,
    project.city,
    project.state,
  ].filter(Boolean).join(" / ");
  if (explicit) return explicit;

  const address = String(project.address || project.project_address || "").trim();
  if (!address) return "Região não informada";
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join(" / ") : address;
};

const resolveProjectGps = (project = {}) => {
  const location = project.location || project.geo || project.gps || {};
  const lat = project.latitude ?? project.lat ?? location.latitude ?? location.lat;
  const lng = project.longitude ?? project.lng ?? project.lon ?? location.longitude ?? location.lng ?? location.lon;
  if (lat == null || lng == null || lat === "" || lng === "") return "";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
};

const detectPdfImageType = (url = "") => {
  const match = String(url).match(/^data:image\/(png|jpe?g);/i);
  if (!match) return "";
  return match[1].toLowerCase().startsWith("jp") ? "JPEG" : "PNG";
};

// ─── Geração do PDF com jsPDF ─────────────────────────────────────────────────
export function generatePDF(project, metrics, { brandName = "NACIF Energy", logoUrl = brandLogoEnergy } = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const circuits = metrics.circuits || [];
  const bom = buildMemorialMaterialRows(project);
  const totalBOM = bom.reduce((s, i) => s + i.total, 0);
  const areaM2 = resolveProjectAreaM2(project);
  const region = resolveProjectRegion(project);
  const gps = resolveProjectGps(project);
  const pdfImageType = detectPdfImageType(logoUrl);

  const PW = 210; // page width mm
  const PH = 297;
  const ML = 16;
  const MR = 16;
  const TW = PW - ML - MR; // 178mm

  const drawRunningHeader = (sectionSubtitle = "Memorial Técnico Descritivo · ABNT NBR 5410") => {
    doc.setFillColor(...PDF_THEME.navy);
    doc.rect(0, 0, PW, 16, "F");
    doc.setFillColor(...PDF_THEME.teal);
    doc.rect(0, 16, PW, 1.2, "F");

    try {
      if (pdfImageType) {
        doc.addImage(logoUrl, pdfImageType, ML, 3.2, 28, 9.3, undefined, "FAST");
      } else {
        doc.addImage(NACIF_LOGO_DARK_BASE64, "PNG", ML, 3.2, 29, 8.9, undefined, "FAST");
      }
    } catch {
      try {
        doc.addImage(NACIF_LOGO_DARK_BASE64, "PNG", ML, 3.2, 29, 8.9, undefined, "FAST");
      } catch {
        try {
          doc.addImage(NACIF_SYMBOL_BASE64, "PNG", ML, 3, 10, 10, undefined, "FAST");
        } catch {}
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_THEME.white);
    doc.text(`${brandName.toUpperCase()} — MEMORIAL DESCRITIVO ELÉTRICO`, ML + 32, 8.0);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...PDF_THEME.teal);
    doc.text(sectionSubtitle, ML + 32, 12.6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_THEME.white);
    doc.text(String(project?.name || "Projeto Elétrico").slice(0, 38), PW - MR, 8.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(180, 198, 220);
    doc.text(`${project?.supply_type || "Sistema BT"} · ${project?.voltage || 220}V`, PW - MR, 12.6, { align: "right" });
  };

  let currentSectionSubtitle = "Memorial Técnico Descritivo · ABNT NBR 5410";
  const newPage = (subtitle = currentSectionSubtitle) => {
    currentSectionSubtitle = subtitle;
    doc.addPage();
    drawRunningHeader(subtitle);
    return 24;
  };

  let curY = 0;
  const checkY = (need = 12, subtitle = currentSectionSubtitle) => {
    if (curY + need > PH - 18) {
      curY = newPage(subtitle);
    }
  };

  // ── CAPA EXECUTIVA NACIF ──────────────────────────────────────────────────
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(0, 0, PW, 74, "F");
  doc.setFillColor(...PDF_THEME.blue);
  doc.rect(0, 74, PW, 1.5, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(0, 75.5, PW, 2.0, "F");

  try {
    if (pdfImageType) {
      doc.addImage(logoUrl, pdfImageType, PW - MR - 54, 15, 54, 18, undefined, "FAST");
    } else {
      doc.addImage(NACIF_LOGO_DARK_BASE64, "PNG", PW - MR - 56, 15, 56, 17.3, undefined, "FAST");
    }
  } catch {
    try {
      doc.addImage(NACIF_LOGO_DARK_BASE64, "PNG", PW - MR - 56, 15, 56, 17.3, undefined, "FAST");
    } catch {
      try {
        doc.addImage(NACIF_SYMBOL_BASE64, "PNG", PW - MR - 24, 14, 24, 24, undefined, "FAST");
      } catch {}
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...PDF_THEME.teal);
  doc.text(`${brandName.toUpperCase()} · DA PLANTA AO SOL · ENGENHARIA ELÉTRICA`, ML, 18);

  doc.setTextColor(...PDF_THEME.white);
  doc.setFontSize(25);
  doc.text("MEMORIAL DESCRITIVO", ML, 36);
  doc.setFontSize(20);
  doc.setTextColor(...PDF_THEME.teal);
  doc.text("PROJETO ELÉTRICO DE BAIXA TENSÃO", ML, 48);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(210, 224, 240);
  doc.text("Dimensionamento normativo, diagrama unifilar, proteção, balanceamento e quantitativo (ABNT NBR 5410)", ML, 61);

  // Card principal do empreendimento
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.35);
  doc.rect(ML, 88, TW, 134, "FD");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(ML, 88, 3, 134, "F");

  doc.setTextColor(...PDF_THEME.navy);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text((project.name || "Projeto Elétrico").toUpperCase().slice(0, 44), ML + 8, 102);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_THEME.slate500);
  doc.text("FICHA TÉCNICA DO EMPREENDIMENTO", ML + 8, 108.5);

  // Badge NBR Score
  const sc = Number(metrics.nbrScore || 0);
  const scColor = sc >= 90 ? PDF_THEME.emerald : sc >= 70 ? PDF_THEME.amber : PDF_THEME.red;
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(PW - MR - 42, 95, 36, 36, "F");
  doc.setFillColor(...scColor);
  doc.rect(PW - MR - 42, 95, 36, 3.5, "F");
  doc.setTextColor(...PDF_THEME.white);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(`${sc}`, PW - MR - 24, 115, { align: "center" });
  doc.setFontSize(7.2);
  doc.setTextColor(...PDF_THEME.teal);
  doc.text("NBR 5410 SCORE", PW - MR - 24, 122.5, { align: "center" });
  doc.setTextColor(180, 198, 220);
  doc.setFont("helvetica", "normal");
  doc.text("de 100 pontos", PW - MR - 24, 127.5, { align: "center" });

  doc.setFontSize(9.2);
  const infoLines = [
    ["Cliente / Titular:", project.client_name || "—"],
    ["Endereço da Obra:", project.address || "—"],
    ["Região / Cidade:", region],
    ["Área Construída:", Number(areaM2 || 0) > 0 ? `${Number(areaM2).toFixed(2).replace(".", ",")} m²` : "—"],
    ["Coordenadas GPS:", gps || "—"],
    ["Alimentação:", `${project.supply_type || "—"} · ${project.voltage || "—"}V · 60 Hz`],
    ["Potência Instalada:", `${(Number(metrics?.totalPower || 0) / 1000).toFixed(2)} kW`],
    ["Circuitos Finais:", `${circuits.length} circuito(s)`],
    ["Disjuntor Geral:", metrics.generalBreaker ? `${metrics.generalBreaker}A (${poles_label(project.supply_type)})` : "—"],
    ["Quadro de Distribuição:", `${metrics.panelSize || 24} módulos DIN`],
    ["Responsável Técnico:", project.technical_responsible || "Engenheiro Eletricista"],
    ["Data de Emissão:", new Date().toLocaleDateString("pt-BR")],
  ];
  infoLines.forEach(([l, v], i) => {
    const rowY = 120 + i * 8.2;
    if (i % 2 === 0) {
      doc.setFillColor(...PDF_THEME.white);
      doc.rect(ML + 7, rowY - 4.8, TW - 54, 7.2, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text(l, ML + 9, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_THEME.slate900);
    doc.text(String(v).slice(0, 48), ML + 49, rowY);
  });

  // Strip de KPIs na Capa
  drawPdfKpiStrip(doc, [
    { label: "CARGA INSTALADA", value: `${(Number(metrics?.totalPower || 0) / 1000).toFixed(2)} kW`, sub: `${circuits.length} circuitos finais` },
    { label: "DEMANDA CALCULADA", value: `${(Number(metrics?.totalDemandPower ?? metrics?.totalPower ?? 0) / 1000).toFixed(2)} kW`, sub: `Ib = ${metrics?.generalCurrent || 0} A` },
    { label: "PROTEÇÃO GERAL", value: metrics.generalBreaker ? `${metrics.generalBreaker} A` : "A definir", sub: metrics.generalDr ? `IDR ${metrics.generalDr}A 30mA` : "Com DPS Classe II", accent: PDF_THEME.blue },
    { label: "CONFORMIDADE", value: `${sc}/100`, sub: sc >= 90 ? "Aprovado NBR 5410" : "Verificar alertas", highlight: true },
  ], ML, 232, TW, 22);

  // ── SUMÁRIO ───────────────────────────────────────────────────────────────
  curY = newPage("Índice Técnico do Documento") + 4;
  curY = drawPdfSectionTitle(doc, "SUMÁRIO EXECUTIVO DO MEMORIAL", ML, curY, TW, {
    accentColor: PDF_THEME.teal,
    rightBadge: "NBR 5410:2004",
  });
  curY += 3;

  const sumItems = [
    ["01.", "Escopo do Projeto"],
    ["02.", "Normas e Referências Técnicas"],
    ["03.", "Dados da Instalação"],
    ["04.", "Detalhes de Instalação e Execução"],
    ["05.", "Memorial de Cálculo dos Circuitos"],
    ["06.", "Balanceamento de Fases e Gráfico de Carregamento"],
    ["07.", "Quadro de Distribuição — Composição"],
    ["08.", "Diagrama Unifilar do Quadro de Distribuição"],
    ["09.", "Quantitativo de Materiais"],
    ["10.", "Análise NBR 5410 — Não-Conformidades"],
    ["11.", "ART — Anotação de Responsabilidade Técnica"],
    ["12.", "Conclusão e Assinatura"],
  ];
  doc.setFontSize(10.5);
  sumItems.forEach(([n, t], idx) => {
    checkY(11);
    if (idx % 2 === 0) {
      doc.setFillColor(...PDF_THEME.slate50);
      doc.rect(ML, curY - 5.2, TW, 8.2, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_THEME.tealDeep);
    doc.text(n, ML + 3, curY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_THEME.slate900);
    doc.text(t, ML + 14, curY);
    doc.setDrawColor(...PDF_THEME.slate300);
    doc.setLineDashPattern([0.8, 1.8], 0);
    doc.line(ML + 16 + doc.getTextWidth(t), curY - 0.8, PW - MR - 6, curY - 0.8);
    doc.setLineDashPattern([], 0);
    curY += 9.5;
  });

  // ── 1. ESCOPO ─────────────────────────────────────────────────────────────
  curY = newPage("1. Escopo e Referências Normativas") + 2;
  const h2 = (txt, badge = "") => {
    checkY(18);
    curY = drawPdfSectionTitle(doc, txt, ML, curY, TW, {
      accentColor: PDF_THEME.teal,
      rightBadge: badge,
    });
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_THEME.slate700);
  };
  const para = (txt) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    doc.setTextColor(...PDF_THEME.slate700);
    const lines = doc.splitTextToSize(txt, TW);
    checkY(lines.length * 4.8 + 4);
    doc.text(lines, ML, curY);
    curY += lines.length * 4.8 + 3;
  };
  const bullet = (txt) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.1);
    doc.setTextColor(...PDF_THEME.slate700);
    const lines = doc.splitTextToSize(txt, TW - 8);
    checkY(lines.length * 4.7 + 2.5);
    doc.setFillColor(...PDF_THEME.teal);
    doc.rect(ML + 2.5, curY - 2.3, 1.5, 1.5, "F");
    doc.text(lines, ML + 7.5, curY);
    curY += lines.length * 4.7 + 1.8;
  };

  h2("1. ESCOPO DO PROJETO");
  para(`Este memorial descritivo tem por objetivo definir, justificar e documentar o dimensionamento da instalação elétrica de baixa tensão do empreendimento "${project.name || "conforme identificado na capa"}", elaborado em conformidade com a NBR 5410:2004 e sua Emenda 1:2008.`);
  para("O presente documento abrange:");
  bullet("Dimensionamento de condutores elétricos por método de instalação e bitola mínima NBR 5410");
  bullet("Seleção de dispositivos de proteção contra sobrecorrente (disjuntores termomagnéticos)");
  bullet("Seleção de dispositivos de proteção diferencial residual (DR 30mA — NBR 5410 item 6.3.6)");
  bullet("Proteção contra surtos — DPS Classe II (recomendação NBR 5410 item 6.3.7)");
  bullet("Cálculo de queda de tensão por circuito (limite: 4% terminais — NBR 5410 item 6.2.7)");
  bullet("Balanceamento automático de fases e dimensionamento do neutro");
  bullet("Quantitativo completo de materiais com referências comerciais");
  bullet("Anotação de Responsabilidade Técnica (ART) para o engenheiro responsável");

  // ── 2. NORMAS ─────────────────────────────────────────────────────────────
  h2("2. NORMAS E REFERÊNCIAS TÉCNICAS");
  const normas = [
    ["NBR 5410:2004 + Em.1:2008", "Instalações elétricas de baixa tensão — regra principal"],
    ["NBR 14136:2012",            "Plugues e tomadas de uso doméstico — padrão brasileiro"],
    ["NBR 5419:2015",             "Proteção contra descargas atmosféricas"],
    ["IEC 60364 (série)",         "Low-voltage electrical installations — norma internacional"],
    ["IEC 60898-1",               "Circuit-breakers for overcurrent protection"],
    ["IEC 61008 / IEC 61009",     "Residual current operated circuit-breakers (RCCBs / RCBOs)"],
    ["NBR IEC 61643-11",          "Dispositivos de proteção contra surtos — Part 11"],
    ["ABNT NBR ISO 6578",         "Simbologia para diagramas elétricos"],
    ["CONFEA Res. 1.010/2010",    "Atribuições por título, cargo e função"],
    ["NR-10 (MTE)",               "Segurança em instalações e serviços em eletricidade"],
  ];
  normas.forEach(([n, d]) => {
    checkY(8);
    doc.setFont("helvetica", "bold"); doc.text(n, ML + 2, curY);
    doc.setFont("helvetica", "normal");
    const dl = doc.splitTextToSize(d, TW - doc.getTextWidth(n) - 10);
    doc.text(dl, ML + doc.getTextWidth(n) + 8, curY);
    curY += 7;
  });

  // ── 3. DADOS DA INSTALAÇÃO ────────────────────────────────────────────────
  checkY(30);
  h2("3. DADOS DA INSTALAÇÃO");
  const tableRows = [
    ["Parâmetro", "Valor", "Observação"],
    ["Tipo de sistema", project.supply_type || "—", "Conforme projeto arquitetônico"],
    ["Tensão nominal", `${project.voltage || 220}V`, "Alimentação da concessionária"],
    ["Frequência", "60 Hz", "Padrão brasileiro ANEEL"],
    ["Nível de tensão", "Baixa Tensão (BT)", "≤ 1000V CA — NBR 5410"],
    ["Potência total instalada", `${(Number(metrics?.totalPower || 0) / 1000).toFixed(2)} kW`, "Soma da carga instalada nominal"],
    ["Demanda total calculada", `${(Number(metrics?.totalDemandPower ?? metrics?.totalPower ?? 0) / 1000).toFixed(2)} kW (${metrics?.totalDemandKva || (Number(metrics?.totalDemandPower ?? metrics?.totalPower ?? 0) / 1000).toFixed(2)} kVA)`, `Fator de demanda médio: ${metrics?.averageDemandFactor || 1}`],
    ["Corrente de demanda geral (Ib)", `${metrics?.generalCurrent || 0} A`, "Corrente de projeto na fase mais carregada"],
    ["Disjuntor geral", metrics.generalBreaker ? `${metrics.generalBreaker} A / ${metrics.generalBreakerPoles || 2}P` : "—", "Proteção geral da instalação"],
    ["IDR geral", metrics.generalDr ? `${metrics.generalDr} A / ${metrics.generalDrPoles || 2}P · 30 mA` : "—", "Diferencial residual da entrada"],
    ["Número de circuitos", `${circuits.length}`, "Circuitos finais dimensionados"],
    ["Tamanho do quadro", `${metrics.panelSize} módulos DIN`, "Com reserva de 20%"],
    ["Desequilíbrio de fases", `${metrics.imbalance_pct}%`, metrics.imbalance_pct <= 5 ? "✓ Aceitável (< 5%)" : "⚠ Revisar balanceamento"],
    ["Neutro — corrente calculada", `${metrics.neutral_a} A`, "Estimativa 10% da soma de fases"],
  ];
  const colW = [60, 50, TW - 112];
  const rowH = 7;
  let tbY = curY;
  tableRows.forEach((row, ri) => {
    checkY(rowH + 2);
    if (tbY !== curY) tbY = curY;
    if (ri === 0) { doc.setFillColor(14, 36, 89); doc.setTextColor(255, 255, 255); }
    else if (ri % 2 === 0) { doc.setFillColor(239, 246, 255); doc.setTextColor(30, 30, 30); }
    else { doc.setFillColor(255, 255, 255); doc.setTextColor(30, 30, 30); }
    doc.rect(ML, tbY - 5, TW, rowH, "F");
    let cx = ML + 2;
    row.forEach((cell, ci) => {
      doc.setFont("helvetica", ri === 0 ? "bold" : "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(cell, colW[ci] - 4);
      doc.text(lines, cx, tbY);
      cx += colW[ci];
    });
    doc.setDrawColor(200, 200, 200);
    doc.rect(ML, tbY - 5, TW, rowH, "S");
    tbY += rowH;
    curY = tbY;
  });
  curY += 4;

  // ── 4. DETALHES DE INSTALAÇÃO ─────────────────────────────────────────────
  checkY(72);
  h2("4. DETALHES DE INSTALAÇÃO E EXECUÇÃO");
  para("A execução da instalação elétrica deverá seguir o projeto aprovado, este memorial, as pranchas técnicas, os diagramas unifilar/trifilar e as prescrições da NBR 5410 e NR-10.");
  bullet("Condutores de cobre flexível com isolação 750V ou superior, identificados por cor: fase(s), neutro azul-claro e proteção PE verde ou verde/amarelo.");
  bullet("Circuitos de iluminação com seção mínima de 1.5mm², salvo quando o cálculo de corrente, queda de tensão ou agrupamento exigir bitola superior.");
  bullet("Circuitos de tomadas, TUE e força com seção mínima de 2.5mm², salvo quando o cálculo exigir bitola superior.");
  bullet("Eletrodutos embutidos, aparentes ou enterrados conforme método de instalação adotado no circuito, com taxa de ocupação e raio de curvatura compatíveis com a passagem dos cabos.");
  bullet("Caixas de passagem previstas em mudanças de direção, trechos longos, derivações e pontos de manutenção, mantendo acesso para inspeção e lançamento dos condutores.");
  bullet("Quadro de distribuição instalado em local seco, acessível, identificado, com barramentos de neutro e proteção separados, reserva técnica e identificação individual dos circuitos.");
  bullet("Circuitos de áreas molhadas, externas, cozinhas, banheiros, lavanderias e tomadas de uso geral protegidos por DR 30mA quando aplicável.");
  bullet("DPS Classe II instalado no quadro conforme esquema de aterramento e tensão nominal, com condutores de ligação curtos e adequados.");
  bullet("Aterramento e equipotencialização executados conforme o esquema da instalação, com continuidade do condutor PE até todos os pontos de utilização.");
  bullet("Antes da energização, executar inspeção visual, teste de continuidade do PE, resistência de isolamento, polaridade, atuação do DR e conferência de identificação dos circuitos.");

  // ── 5. MEMORIAL DE CÁLCULO ────────────────────────────────────────────────
  curY = newPage("5. Memorial de Cálculo dos Circuitos") + 2;
  h2("5. MEMORIAL DE CÁLCULO DOS CIRCUITOS", "ABNT NBR 5410");
  para(`Os circuitos foram dimensionados conforme os critérios da NBR 5410:2004, considerando: método de instalação, temperatura ambiente (${30}°C), fator de agrupamento, queda de tensão máxima de 4% e seleção do disjuntor com 25% de sobrecarga.`);
  para("Foi adotada seção mínima de 1.5mm² para iluminação e 2.5mm² para tomadas, TUE e circuitos de força, preservando o aumento automático de bitola quando exigido pelos cálculos.");
  curY += 2;

  circuits.forEach((c, i) => {
    checkY(70, "5. Memorial de Cálculo dos Circuitos");
    const phaseColors = { A: PDF_THEME.blue, B: PDF_THEME.violet, C: PDF_THEME.amber, AB: PDF_THEME.blue, BC: PDF_THEME.violet, ABC: PDF_THEME.emerald };
    const phaseKey = (c.phase || "A")[0];
    const [r, g, b] = phaseColors[phaseKey] || PDF_THEME.navy;
    doc.setFillColor(...PDF_THEME.navy);
    doc.rect(ML, curY - 4.5, TW, 8.5, "F");
    doc.setFillColor(r, g, b);
    doc.rect(ML, curY - 4.5, 3, 8.5, "F");
    doc.setTextColor(...PDF_THEME.white); doc.setFontSize(9.3); doc.setFont("helvetica", "bold");
    doc.text(`Circuito C${String(i + 1).padStart(2, "0")} — ${c.name || "Circuito"} · Fase ${c.phase || "A"}`, ML + 5.5, curY + 1);
    curY += 7.5;

    doc.setTextColor(...PDF_THEME.slate900); doc.setFontSize(8.5); doc.setFont("helvetica", "normal");

    const cRows = [
      ["Tipo de circuito", c.type || "—", "Alimentação", `${c.supply_type || "—"} · ${c.voltage}V`],
      ["Potência instalada", `${c.power_w} W`, "Fator de potência (fp)", String(c.power_factor || "—")],
      ["Corrente de projeto (Ip)", `${c.project_current_a} A`, "Corrente corrigida", `${c.corrected_current_a} A`],
      ["Fator de temperatura", String(c.temp_factor || 1.0), "Fator de agrupamento", String(c.group_factor || 1.0)],
      ["Bitola selecionada", c.wire_gauge || "—", "Método instalação", (c.install_method || "—").slice(0, 28)],
      ["Comprimento do circuito", `${c.length_m || 15} m`, "Queda de tensão ΔU", `${c.voltage_drop_pct}% ${c.voltage_drop_ok ? "✓" : "⚠"}`],
      ["Disjuntor", `${c.breaker_poles || 1}P · ${c.breaker_a}A · Curva ${c.breaker_curve || "B"}`, "Cap. de interrupção", `${c.breaking_capacity_ka || 6} kA`],
      ["Proteção DR", c.needs_dr ? `Sim — 2P ${c.breaker_a <= 25 ? "25A" : "40A"} 30mA Tipo AC` : "Não obrigatório pela norma", "DPS", "Classe II 275V 20kA"],
      ["Queda de tensão (V)", `${c.voltage_drop_v} V`, "Módulos DIN ocupados", String(c.din_modules || 1)],
    ];

    cRows.forEach(([l1, v1, l2, v2], rowIdx) => {
      checkY(7, "5. Memorial de Cálculo dos Circuitos");
      if (rowIdx % 2 === 0) {
        doc.setFillColor(...PDF_THEME.slate50);
        doc.rect(ML, curY - 4.5, TW, 6.2, "F");
      }
      doc.setDrawColor(...PDF_THEME.slate200);
      doc.setLineWidth(0.15);
      doc.line(ML, curY + 1.7, ML + TW, curY + 1.7);
      doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_THEME.slate700); doc.text(l1 + ":", ML + 2.5, curY);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF_THEME.slate900); doc.text(String(v1).slice(0, 26), ML + 46, curY);
      if (l2) {
        doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_THEME.slate700); doc.text(l2 + ":", ML + 92, curY);
        doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF_THEME.slate900); doc.text(String(v2 || "").slice(0, 28), ML + 138, curY);
      }
      curY += 6.2;
    });
    curY += 5;
  });

  // ── 6. BALANCEAMENTO DE FASES ─────────────────────────────────────────────
  checkY(115, "6. Balanceamento de Fases");
  h2("6. BALANCEAMENTO DE FASES", "Desequilíbrio <= 5%");

  const phLoad = metrics?.phaseLoad || {};
  const phA = Number(phLoad?.A || 0);
  const phB = Number(phLoad?.B || 0);
  const phC = Number(phLoad?.C || 0);

  curY = drawVectorBarChart(doc, {
    x: ML,
    y: curY,
    w: TW,
    h: 50,
    title: "CARREGAMENTO DE CORRENTE POR FASE (A)",
    subtitle: `Desequilíbrio apurado: ${metrics.imbalance_pct || 0}% · Corrente de demanda geral: ${metrics?.generalCurrent || 0} A`,
    labels: ["Fase A (R)", "Fase B (S)", "Fase C (T)", "Neutro (N)"],
    values: [phA, phB, phC, Number(metrics?.neutral_a || 0)],
    barColor: PDF_THEME.teal,
    valueFormatter: (v) => `${Number(v).toFixed(1)} A`,
  });

  const phRows = [
    ["Fase", "Circuitos", "Corrente Total (A)", "% Carregamento", "Status"],
    ["A (R)", circuits.filter(c => (c.phase||"").includes("A")).length, `${phA.toFixed(1)} A`, `${((phA / (metrics?.generalCurrent || 1)) * 100).toFixed(1)}%`, (metrics?.generalBreaker && phA > metrics.generalBreaker * 0.9) ? "⚠ Atenção" : "✓ OK"],
    ["B (S)", circuits.filter(c => (c.phase||"").includes("B")).length, `${phB.toFixed(1)} A`, `${((phB / (metrics?.generalCurrent || 1)) * 100).toFixed(1)}%`, (metrics?.generalBreaker && phB > metrics.generalBreaker * 0.9) ? "⚠ Atenção" : "✓ OK"],
    ["C (T)", circuits.filter(c => (c.phase||"").includes("C")).length, `${phC.toFixed(1)} A`, `${((phC / (metrics?.generalCurrent || 1)) * 100).toFixed(1)}%`, (metrics?.generalBreaker && phC > metrics.generalBreaker * 0.9) ? "⚠ Atenção" : "✓ OK"],
    ["Neutro (N)", "—", `${metrics?.neutral_a || 0} A (calc.)`, "—", "Verificar corrente harmônica"],
  ];
  let pbY = curY;
  phRows.forEach((row, ri) => {
    checkY(8);
    if (pbY !== curY) pbY = curY;
    if (ri === 0) { doc.setFillColor(...PDF_THEME.navy); doc.setTextColor(255, 255, 255); }
    else { doc.setFillColor(...(ri % 2 === 0 ? PDF_THEME.slate50 : PDF_THEME.white)); doc.setTextColor(...PDF_THEME.slate900); }
    doc.rect(ML, pbY - 5, TW, 8, "F");
    const pCols = [24, 26, 40, 38, TW - 128];
    let phX = ML + 2;
    row.forEach((cell, ci) => {
      doc.setFont("helvetica", ri === 0 ? "bold" : "normal"); doc.setFontSize(8.8);
      doc.text(String(cell), phX, pbY);
      phX += pCols[ci];
    });
    doc.setDrawColor(...PDF_THEME.slate200); doc.rect(ML, pbY - 5, TW, 8, "S");
    pbY += 8; curY = pbY;
  });
  curY += 4;
  para(`Desequilíbrio entre fases: ${metrics.imbalance_pct}% — ${metrics.imbalance_pct <= 5 ? "ACEITÁVEL conforme NBR 5410" : metrics.imbalance_pct <= 10 ? "ATENÇÃO — recomenda-se redistribuição" : "CRÍTICO — redistribuição obrigatória (NBR 5410)"}`);

  // ── 7. QUADRO DE DISTRIBUIÇÃO ─────────────────────────────────────────────
  checkY(48);
  h2("7. QUADRO DE DISTRIBUIÇÃO — COMPOSIÇÃO", `${metrics.panelSize || 24} DINs`);
  para(`O quadro de distribuição (QDC) deverá ser dimensionado para ${metrics.panelSize} módulos DIN, incluindo reserva de 20% para expansões futuras, conforme boa prática de engenharia e NBR 5410.`);
  bullet(metrics.generalBreaker ? `Disjuntor geral: ${poles_label(project.supply_type)} ${metrics.generalBreaker}A Curva C` : "Disjuntor geral: a definir (sem cargas)");
  bullet(`DR geral (opcional): ${project.supply_type === "Trifásico" ? "4P" : "2P"} — proteção diferencial geral`);
  bullet(`DPS Classe II — ${project.voltage || 220}V — instalado após o medidor`);
  bullet(`Barramento de neutro (N) e terra (PE) separados — conforme NBR 5410`);
  bullet(`${circuits.filter(c => c.needs_dr).length} circuito(s) com proteção DR individual obrigatória`);
  bullet(`Total de módulos DIN utilizados: ${circuits.reduce((s, c) => s + (c.din_modules || 1), 0)} + ${4} (geral/DR/DPS) = ${circuits.reduce((s, c) => s + (c.din_modules || 1), 0) + 4}`);

  // ── 8. DIAGRAMA UNIFILAR DO QUADRO DE DISTRIBUIÇÃO ────────────────────────
  const perSheetCircuits = 16;
  const totalUnifilarSheets = Math.max(1, Math.ceil(circuits.length / perSheetCircuits));
  for (let sheetIdx = 0; sheetIdx < totalUnifilarSheets; sheetIdx += 1) {
    curY = newPage(`8. Diagrama Unifilar (${sheetIdx + 1}/${totalUnifilarSheets})`) + 2;
    const startIdx = sheetIdx * perSheetCircuits;
    const sheetTitle = totalUnifilarSheets > 1
      ? `8. DIAGRAMA UNIFILAR DO QUADRO DE DISTRIBUIÇÃO (FOLHA ${sheetIdx + 1}/${totalUnifilarSheets})`
      : "8. DIAGRAMA UNIFILAR DO QUADRO DE DISTRIBUIÇÃO";
    h2(sheetTitle, "ABNT NBR 5410 · IEC");
    curY = drawElectricalUnifilarVector(doc, project, metrics, {
      x: ML,
      y: curY,
      w: TW,
      h: 222,
      startIndex: startIdx,
      maxCircuits: perSheetCircuits,
      sheetLabel: totalUnifilarSheets > 1 ? `FOLHA ${sheetIdx + 1}/${totalUnifilarSheets}` : "PRANCHA ÚNICA",
    });
  }

  // ── 9. QUANTITATIVO DE MATERIAIS ──────────────────────────────────────────
  curY = newPage("9. Quantitativo de Materiais") + 2;
  h2("9. QUANTITATIVO DE MATERIAIS", `${bom.length} itens`);
  para("Os materiais abaixo foram selecionados a partir da base técnica do projeto, garantindo conformidade com as normas e rastreabilidade do memorial.");
  curY += 2;

  const qCols = [TW - 92, 24, 14, 24, 30];
  const qHeaders = ["Descrição / Modelo", "Código", "Un", "Qtd", "Total R$"];
  doc.setFillColor(...PDF_THEME.navy); doc.rect(ML, curY - 5, TW, 8, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.8);
  let qx = ML + 2;
  qHeaders.forEach((h, hi) => { doc.text(h, qx, curY); qx += qCols[hi]; });
  doc.setDrawColor(...PDF_THEME.navy); doc.rect(ML, curY - 5, TW, 8, "S");
  curY += 8;

  bom.forEach((item, ii) => {
    checkY(8, "9. Quantitativo de Materiais");
    if (ii % 2 === 0) { doc.setFillColor(...PDF_THEME.slate50); } else { doc.setFillColor(...PDF_THEME.white); }
    doc.rect(ML, curY - 5, TW, 7, "F");
    doc.setTextColor(...PDF_THEME.slate900); doc.setFont("helvetica", "normal"); doc.setFontSize(8.3);
    const cells = [
      item.model || item.name,
      item.code || "—",
      item.unit || "un",
      item.unit === "m" ? `${item.qty.toFixed(0)}m` : String(item.qty),
      `R$ ${formatCurrencyBR(item.total)}`,
    ];
    let itemX = ML + 2;
    cells.forEach((cell, ci) => {
      doc.text(String(cell).slice(0, ci === 0 ? 44 : 14), itemX, curY);
      itemX += qCols[ci];
    });
    doc.setDrawColor(...PDF_THEME.slate200); doc.rect(ML, curY - 5, TW, 7, "S");
    curY += 7;
  });

  // Total
  checkY(14);
  doc.setFillColor(...PDF_THEME.navy); doc.rect(ML, curY - 5, TW, 9, "F");
  doc.setFillColor(...PDF_THEME.teal); doc.rect(ML, curY - 5, 2.5, 9, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
  doc.text("TOTAL ESTIMADO DE MATERIAIS (sem mão de obra):", ML + 5, curY + 1);
  doc.setTextColor(...PDF_THEME.teal);
  doc.text(`R$ ${formatCurrencyBR(totalBOM)}`, PW - MR - 3, curY + 1, { align: "right" });
  curY += 13;
  para("* Valores de referência. Podem variar conforme fornecedor, região e condições comerciais. Mão de obra não inclusa.");

  // ── 10. ANÁLISE NBR 5410 ──────────────────────────────────────────────────
  checkY(32);
  h2("10. ANÁLISE NBR 5410 — NÃO-CONFORMIDADES E ALERTAS", `${metrics.validations.length} apontamento(s)`);
  if (metrics.validations.length === 0) {
    doc.setFillColor(...PDF_THEME.emeraldSoft);
    doc.setDrawColor(...PDF_THEME.emerald);
    doc.rect(ML, curY - 4, TW, 10, "FD");
    doc.setTextColor(...PDF_THEME.emerald); doc.setFont("helvetica", "bold"); doc.setFontSize(9.8);
    doc.text("✓ Nenhuma não-conformidade identificada. Instalação dentro dos parâmetros NBR 5410.", ML + 4, curY + 2.5);
    curY += 12;
  } else {
    metrics.validations.forEach(v => {
      const lines = doc.splitTextToSize(v.msg || "", TW - 28);
      const rowH = Math.max(9, lines.length * 4.5 + 4);
      checkY(rowH + 2);
      const isErr = v.severity === "error";
      doc.setFillColor(...(isErr ? PDF_THEME.redSoft : PDF_THEME.amberSoft));
      doc.rect(ML, curY - 4.5, TW, rowH, "F");
      doc.setTextColor(...(isErr ? PDF_THEME.red : PDF_THEME.amber));
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.8);
      doc.text(isErr ? "⚠ ERRO:" : "⚡ AVISO:", ML + 2.5, curY + 0.5);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF_THEME.slate900);
      doc.text(lines, ML + 22, curY + 0.5);
      curY += rowH + 1.5;
    });
    curY += 3;
    para("Todas as não-conformidades identificadas devem ser corrigidas antes da energização da instalação, conforme NBR 5410:2004 item 3.4 (responsabilidade do instalador).");
  }

  // ── 11. ART ───────────────────────────────────────────────────────────────
  curY = newPage("11. ART & Conclusão Técnica") + 2;
  h2("11. ART — ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA", "CONFEA / CREA");
  para("A Anotação de Responsabilidade Técnica (ART) é documento obrigatório conforme Lei Federal 6.496/77 e Resolução CONFEA 1.010/2010, devendo ser emitida pelo profissional habilitado (Engenheiro Eletricista) antes do início dos serviços.");
  curY += 4;

  const artFields = [
    ["Tipo de atividade:", "Elaboração de Projeto Elétrico / Memorial Descritivo"],
    ["Atividade CONFEA:", "Projetos e especificações (Engenharia Elétrica)"],
    ["Código de atividade:", "Instalações elétricas prediais de baixa tensão — Código 4.01.001"],
    ["Código NBR aplicável:", "NBR 5410:2004 + Emenda 1:2008"],
    ["Título do projeto:", project.name || "—"],
    ["Endereço da obra:", project.address || "—"],
    ["Contratante:", project.client_name || "—"],
    ["Responsável técnico:", `${project.technical_responsible || "___________________________________"}   CREA nº: ${project.crea || "___________"}`],
    ["Data de emissão:", new Date().toLocaleDateString("pt-BR")],
    ["Assinatura:", "___________________________________ (Responsável Técnico)"],
  ];

  doc.setFontSize(9.2);
  artFields.forEach(([label, val], idx) => {
    checkY(9);
    if (idx % 2 === 0) {
      doc.setFillColor(...PDF_THEME.slate50);
      doc.rect(ML, curY - 4.5, TW, 8, "F");
    }
    doc.setFont("helvetica", "bold"); doc.setTextColor(...PDF_THEME.navy);
    doc.text(label, ML + 2.5, curY);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...PDF_THEME.slate900);
    const lines = doc.splitTextToSize(val, TW - 58);
    doc.text(lines, ML + 56, curY);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.line(ML, curY + 3.2, PW - MR, curY + 3.2);
    curY += 8.2;
  });

  curY += 5;
  para("IMPORTANTE: Esta ART deve ser recolhida no CREA da jurisdição da obra e uma via entregue ao contratante antes do início dos serviços.");

  // ── 12. CONCLUSÃO ─────────────────────────────────────────────────────────
  checkY(65);
  h2("12. CONCLUSÃO E ASSINATURA", "Termo Técnico");
  para(`O presente memorial descritivo apresenta o dimensionamento completo da instalação elétrica de baixa tensão para o empreendimento "${project.name || "descrito na capa"}", elaborado em conformidade com a NBR 5410:2004 e suas referências normativas.`);
  para(`O projeto prevê ${circuits.length} circuito(s) finais com potência total instalada de ${(metrics.totalPower / 1000).toFixed(2)} kW, alimentados por sistema ${project.supply_type || "—"} em ${project.voltage || 220}V${metrics.generalBreaker ? `, protegidos por disjuntor geral de ${metrics.generalBreaker}A` : ""}.`);
  para(`O NBR Score calculado pela plataforma ${brandName} considera queda de tensão, balanceamento de fases, proteção diferencial e DPS, resultando em uma avaliação objetiva da conformidade normativa.`);
  curY += 2;

  // Caixa de assinatura
  checkY(58);
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.navy);
  doc.setLineWidth(0.5);
  doc.rect(ML, curY, TW, 52, "FD");
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(ML, curY, TW, 9.5, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(ML, curY + 9.5, TW, 1, "F");
  doc.setTextColor(...PDF_THEME.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("DECLARAÇÃO DO RESPONSÁVEL TÉCNICO", PW / 2, curY + 6.5, { align: "center" });

  doc.setTextColor(...PDF_THEME.slate700);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.text("Declaro que o presente memorial descritivo foi elaborado por mim, conforme as normas", ML + 5, curY + 17);
  doc.text("técnicas vigentes (ABNT NBR 5410), sendo de minha responsabilidade técnica e legal.", ML + 5, curY + 23);
  doc.text(`Local e data: _________________________, ${new Date().toLocaleDateString("pt-BR")}`, ML + 5, curY + 32);
  doc.text("Assinatura: ___________________________________ CREA: ___________", ML + 5, curY + 41);
  doc.text("Carimbo profissional:", ML + 5, curY + 48);

  curY += 56;
  doc.setFontSize(7.8); doc.setTextColor(...PDF_THEME.slate500);
  para(`Documento gerado automaticamente pela plataforma ${brandName}. A responsabilidade técnica pela execução é inteiramente do profissional habilitado.`);

  // Rodapé unificado em todas as páginas (Página X de Y)
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.setLineWidth(0.3);
    doc.line(ML, PH - 13, PW - MR, PH - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...PDF_THEME.slate500);
    doc.text(`${brandName} · Memorial Descritivo · ABNT NBR 5410:2004`, ML, PH - 8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_THEME.navy);
    doc.text(`${project?.name || "Projeto"} · Página ${p} de ${totalPages}`, PW - MR, PH - 8, { align: "right" });
  }

  return doc;
}

function poles_label(supply) {
  if (supply === "Trifásico") return "4P";
  if (supply === "Bifásico")  return "2P";
  return "2P";
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function MemorialDescritivo() {
  const [searchParams] = useSearchParams();
  const { branding } = useBranding();
  const [projects, setProjects]    = useState([]);
  const [selectedId, setSelectedId] = useState(() => (
    searchParams.get("project")
    || (typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : "")
    || ""
  ));
  const [project, setProject]       = useState(null);
  const [metrics, setMetrics]       = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated]   = useState(false);
  const brandName = [branding.appName, branding.appSuffix].filter(Boolean).join(" ") || "NACIF Energy";
  const rawProjectLogo = getProjectLogo(project, branding.logoDataUrl || brandLogoEnergy || DEFAULT_LOGO_URL);
  const isOldLogo = !rawProjectLogo ||
    rawProjectLogo === "/brand-logo-principal.png" ||
    rawProjectLogo === "/brand-mark-principal.png" ||
    rawProjectLogo.includes("brand-logo-principal") ||
    rawProjectLogo.includes("brand-mark-principal");
  const logoUrl = isOldLogo ? brandLogoEnergy : rawProjectLogo;
  const areaM2 = project ? resolveProjectAreaM2(project) : 0;
  const projectRegion = project ? resolveProjectRegion(project) : "";
  const projectGps = project ? resolveProjectGps(project) : "";

  useEffect(() => {
    const urlProjectId = searchParams.get("project");
    if (urlProjectId && urlProjectId !== selectedId) {
      setSelectedId(urlProjectId);
      try { window.localStorage.setItem("voltai_active_project_id", urlProjectId); } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    backend.entities.Project.list("-updated_date", 100).then((list) => {
      if (cancelled) return;
      const safeList = Array.isArray(list) ? list : [];
      setProjects(safeList);
      const currentUrlId = searchParams.get("project");
      if (!currentUrlId && !selectedId && safeList.length > 0) {
        const storedId = typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : null;
        const target = safeList.find((p) => p.id === storedId) || safeList[0];
        if (target?.id) {
          setSelectedId(target.id);
          try { window.localStorage.setItem("voltai_active_project_id", target.id); } catch {}
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleSelectProject = (newId) => {
    setSelectedId(newId || "");
    if (newId) {
      try { window.localStorage.setItem("voltai_active_project_id", newId); } catch {}
    }
  };

  useEffect(() => {
    if (!selectedId) return;
    setProject(null); setMetrics(null); setGenerated(false);
    backend.entities.Project.get(selectedId).then(p => {
      setProject(p); setMetrics(calcProjectMetrics(p));
    });
  }, [selectedId]);

  const handleGenerate = async () => {
    if (!project || !metrics) return;
    const exportAuth = await authorizePlanExport({
      projectId: project.id,
      format: "PDF",
      label: "Memorial Descritivo",
    });
    if (!exportAuth.allowed) return;

    setGenerating(true);
    await new Promise(r => setTimeout(r, 400)); // UX — feedback visual
    const doc = generatePDF(project, metrics, { brandName, logoUrl });
    stampPdfWithPlanWatermark(doc, exportAuth);
    doc.save(`memorial_${project.name?.replace(/\s+/g, "_") || "projeto"}.pdf`);
    setGenerating(false);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 4000);
  };

  const bom = project && metrics ? buildMemorialMaterialRows(project) : [];
  const totalBOM = bom.reduce((s, i) => s + i.total, 0);

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
      <PageHeader
        icon={FileText}
        title="Memorial Descritivo"
        subtitle="Geração automática em PDF · NBR 5410:2004 · detalhes de instalação · ART"
      >
        <Select value={selectedId} onValueChange={handleSelectProject}>
          <SelectTrigger className="h-12 min-w-0 flex-1 rounded-[14px] border-[#BCEEE5] bg-white text-sm font-bold shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <SelectValue placeholder="Escolha o projeto para gerar o memorial..." />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Preview do documento */}
      {project && metrics && (
        <>
          {/* Métricas do projeto */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Cpu,           label: "Potência Total",    value: `${(Number(metrics?.totalPower || 0) / 1000).toFixed(2)} kW` },
              { icon: Shield,        label: "NBR Score",         value: `${metrics?.nbrScore || 0}/100`, color: Number(metrics?.nbrScore || 0) >= 70 ? "text-primary" : "text-red-600" },
              { icon: BookOpen,      label: "Circuitos",         value: `${(metrics?.circuits || []).length}` },
              { icon: FileText,      label: "Material (est.)",   value: `R$ ${Number(totalBOM || 0).toFixed(0)}` },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <k.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                </div>
                <p className={`text-xl font-bold ${k.color || "text-foreground"}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 rounded-2xl border border-[#BCEEE5] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.045)] lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex min-h-[112px] items-center justify-center rounded-xl border border-[#CDEFE8] bg-[#F8FFFD] p-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={brandName}
                  onError={(e) => { e.currentTarget.src = brandLogoEnergy; }}
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-10 w-10 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Identificação do memorial</p>
              <h2 className="mt-1 truncate text-2xl font-black text-[#0f1728]">{project.name || "Projeto sem nome"}</h2>
              <p className="mt-1 truncate text-sm font-semibold text-muted-foreground">{project.client_name || "Cliente não informado"}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 rounded-xl border border-border/50 bg-secondary/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" /> Região
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-[#0f1728]">{projectRegion}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-border/50 bg-secondary/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
                    <Ruler className="h-4 w-4 text-primary" /> Metragem
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-[#0f1728]">{areaM2 > 0 ? `${areaM2.toFixed(2).replace(".", ",")} m²` : "Não informada"}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-border/50 bg-secondary/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" /> GPS
                  </div>
                  <p className="mt-1 truncate text-sm font-bold text-[#0f1728]">{projectGps || "Não informado"}</p>
                </div>
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-muted-foreground">{project.address || "Endereço da obra não informado"}</p>
            </div>
          </div>

          {/* Conteúdo do memorial */}
          <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold">Conteúdo do Memorial</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { n: "1", t: "Capa",                     d: "Identificação, dados técnicos, NBR Score" },
                { n: "2", t: "Sumário",                   d: "Índice automático de seções" },
                { n: "3", t: "Escopo",                   d: "Objetivo e abrangência do projeto" },
                { n: "4", t: "Normas Técnicas",           d: "NBR 5410, IEC 60364, NR-10..." },
                { n: "5", t: "Detalhes de Instalação",    d: "Condutores, eletrodutos, caixas, aterramento e ensaios" },
                { n: "6", t: "Memorial de Cálculo",       d: `${(metrics.circuits||[]).length} circuito(s) com dados completos` },
                { n: "7", t: "Balanceamento de Fases",    d: `Desequilíbrio: ${metrics.imbalance_pct}%` },
                { n: "8", t: "Quadro de Distribuição",    d: `${metrics.panelSize} DINs · layout detalhado` },
                { n: "9", t: "Quantitativo de materiais", d: `${bom.length} itens · R$ ${formatCurrencyBR(totalBOM)}` },
                { n: "10", t: "Análise NBR 5410",         d: `${metrics.validations.length} ocorrência(s) identificada(s)` },
                { n: "11", t: "ART Sugerida",             d: "Modelo de Anotação de Responsabilidade Técnica" },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">{s.n}</div>
                  <div>
                    <p className="font-medium text-sm">{s.t}</p>
                    <p className="text-xs text-muted-foreground">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas NBR */}
          {metrics.validations.length > 0 && (
            <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Ocorrências NBR 5410 ({metrics.validations.length})
              </h2>
              {metrics.validations.map((v, i) => (
                <div key={i} className={`flex items-start gap-2 text-sm p-3 rounded-lg ${v.severity === "error" ? "bg-red-50 text-red-800 border border-red-200" : "bg-yellow-50 text-yellow-800 border border-yellow-200"}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {v.msg}
                </div>
              ))}
            </div>
          )}

          {/* Botão gerar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleGenerate}
              disabled={generating}
              size="lg"
              className="flex-1 h-14 text-base font-semibold"
            >
              {generating ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" />Gerando Memorial PDF...</>
              ) : generated ? (
                <><CheckCircle2 className="w-5 h-5 mr-2" />Memorial Gerado! ✓</>
              ) : (
                <><Download className="w-5 h-5 mr-2" />Gerar Memorial Descritivo PDF</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            O PDF será baixado automaticamente. Contém {(metrics.circuits||[]).length} circuito(s) + detalhes de instalação + ART + quantitativo de materiais.
          </p>
        </>
      )}

      {!project && (
        <div className="p-16 rounded-2xl bg-card border border-dashed border-border text-center">
          <FileText className="w-14 h-14 mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground">Selecione um projeto para visualizar e gerar o memorial descritivo</p>
        </div>
      )}
    </div>
  );
}
