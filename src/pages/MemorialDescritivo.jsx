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
function generatePDF(project, metrics, { brandName = "NACIF Solutions Eletric", logoUrl = DEFAULT_LOGO_URL } = {}) {
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
  const ML = 20; const MR = 20; const TW = PW - ML - MR;
  let page = 1;

  const newPage = () => {
    doc.addPage();
    page++;
    // rodapé
    doc.setFontSize(7); doc.setTextColor(130, 130, 130);
    doc.line(ML, PH - 14, PW - MR, PH - 14);
    doc.text(`${brandName} · Memorial Descritivo · NBR 5410:2004 · Página ${page}`, ML, PH - 9);
    doc.text(`${project.name}`, PW - MR, PH - 9, { align: "right" });
  };

  // helper – checkY com margem
  let curY = 0;
  const checkY = (need = 12) => {
    if (curY + need > PH - 20) { newPage(); curY = 24; }
  };

  // ── CAPA ──────────────────────────────────────────────────────────────────
  doc.setFillColor(14, 36, 89);
  doc.rect(0, 0, PW, 80, "F");

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 75, PW, 6, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(`${brandName.toUpperCase()} — PLATAFORMA DE ENGENHARIA ELÉTRICA`, ML, 22);
  if (pdfImageType) {
    try {
      doc.addImage(logoUrl, pdfImageType, PW - MR - 38, 14, 36, 18, undefined, "FAST");
    } catch {
      // Mantém o PDF válido mesmo quando o arquivo de logo não está em base64.
    }
  }

  doc.setFontSize(24); doc.setFont("helvetica", "bold");
  doc.text("MEMORIAL", ML, 38);
  doc.text("DESCRITIVO", ML, 52);
  doc.setFontSize(12); doc.setFont("helvetica", "normal");
  doc.text("Elétrico, Instalação e Quantitativo de Materiais", ML, 65);

  doc.setTextColor(37, 99, 235);
  doc.rect(ML, 90, 4, 100, "F");

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text((project.name || "Projeto").toUpperCase(), ML + 10, 108);

  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  const infoLines = [
    ["Cliente:", project.client_name || "—"],
    ["Endereço:", project.address || "—"],
    ["Região:", region],
    ["Área:", areaM2 > 0 ? `${areaM2.toFixed(2).replace(".", ",")} m²` : "—"],
    ["GPS:", gps || "—"],
    ["Alimentação:", `${project.supply_type || "—"} · ${project.voltage || "—"}V`],
    ["Potência Total:", `${(metrics.totalPower / 1000).toFixed(2)} kW`],
    ["Nº de Circuitos:", `${circuits.length}`],
    ["Disjuntor Geral:", `${metrics.generalBreaker}A`],
    ["Tamanho do Quadro:", `${metrics.panelSize} DINs`],
    ["NBR Score:", `${metrics.nbrScore}/100`],
    ["Data:", new Date().toLocaleDateString("pt-BR")],
    ["Responsável:", "Engenheiro Eletricista"],
  ];
  infoLines.forEach(([l, v], i) => {
    doc.setFont("helvetica", "bold"); doc.text(l, ML + 10, 124 + i * 9);
    doc.setFont("helvetica", "normal"); doc.text(v, ML + 46, 124 + i * 9);
  });

  // Caixa NBR Score
  const sc = metrics.nbrScore;
  const scColor = sc >= 90 ? [22, 163, 74] : sc >= 70 ? [202, 138, 4] : [220, 38, 38];
  doc.setFillColor(...scColor);
  doc.roundedRect(PW - MR - 44, 100, 44, 44, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28); doc.setFont("helvetica", "bold");
  doc.text(`${sc}`, PW - MR - 22, 124, { align: "center" });
  doc.setFontSize(8);
  doc.text("NBR Score", PW - MR - 22, 133, { align: "center" });
  doc.text("/100", PW - MR - 22, 140, { align: "center" });

  // rodapé capa
  doc.setTextColor(130, 130, 130); doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.line(ML, PH - 14, PW - MR, PH - 14);
  doc.text(`${brandName} · Memorial Descritivo · NBR 5410:2004 · Página 1`, ML, PH - 9);
  doc.text(new Date().toLocaleDateString("pt-BR"), PW - MR, PH - 9, { align: "right" });

  // ── SUMÁRIO ───────────────────────────────────────────────────────────────
  newPage(); curY = 28;
  doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(14, 36, 89);
  doc.text("SUMÁRIO", ML, curY); curY += 4;
  doc.setFillColor(37, 99, 235); doc.rect(ML, curY, TW, 1.5, "F"); curY += 10;

  const sumItems = [
    ["1.", "Escopo do Projeto"],
    ["2.", "Normas e Referências Técnicas"],
    ["3.", "Dados da Instalação"],
    ["4.", "Detalhes de Instalação e Execução"],
    ["5.", "Memorial de Cálculo dos Circuitos"],
    ["6.", "Balanceamento de Fases"],
    ["7.", "Quadro de Distribuição — Composição"],
    ["8.", "Quantitativo de Materiais"],
    ["9.", "Análise NBR 5410 — Não-Conformidades"],
    ["10.", "ART — Anotação de Responsabilidade Técnica"],
    ["11.", "Conclusão e Assinatura"],
  ];
  doc.setFontSize(11); doc.setTextColor(30, 30, 30);
  sumItems.forEach(([n, t]) => {
    checkY(10);
    doc.setFont("helvetica", "bold"); doc.text(n, ML, curY);
    doc.setFont("helvetica", "normal"); doc.text(t, ML + 12, curY);
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(ML + 12 + doc.getTextWidth(t) + 2, curY, PW - MR - 8, curY - 1);
    doc.setLineDashPattern([], 0);
    curY += 10;
  });

  // ── 1. ESCOPO ─────────────────────────────────────────────────────────────
  newPage(); curY = 28;
  const h2 = (txt) => {
    checkY(16);
    doc.setFillColor(239, 246, 255); doc.rect(ML, curY - 5, TW, 10, "F");
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(14, 36, 89);
    doc.text(txt, ML + 2, curY); curY += 8;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
  };
  const para = (txt) => {
    checkY(12);
    const lines = doc.splitTextToSize(txt, TW);
    doc.text(lines, ML, curY); curY += lines.length * 5.5 + 3;
  };
  const bullet = (txt) => {
    checkY(8);
    doc.text("•", ML + 2, curY);
    const lines = doc.splitTextToSize(txt, TW - 8);
    doc.text(lines, ML + 8, curY); curY += lines.length * 5.5 + 1.5;
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
    ["Potência total instalada", `${(metrics.totalPower / 1000).toFixed(2)} kW`, "Soma de todos os circuitos"],
    ["Corrente geral", `${metrics.generalCurrent} A`, "Corrente nominal total"],
    ["Disjuntor geral", `${metrics.generalBreaker} A / ${metrics.generalBreakerPoles || 2}P`, "Proteção geral da instalação"],
    ["IDR geral", `${metrics.generalDr} A / ${metrics.generalDrPoles || 2}P · 30 mA`, "Diferencial residual da entrada"],
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
  newPage(); curY = 28;
  h2("5. MEMORIAL DE CÁLCULO DOS CIRCUITOS");
  para(`Os circuitos foram dimensionados conforme os critérios da NBR 5410:2004, considerando: método de instalação, temperatura ambiente (${30}°C), fator de agrupamento, queda de tensão máxima de 4% e seleção do disjuntor com 25% de sobrecarga.`);
  para("Foi adotada seção mínima de 1.5mm² para iluminação e 2.5mm² para tomadas, TUE e circuitos de força, preservando o aumento automático de bitola quando exigido pelos cálculos.");
  curY += 2;

  circuits.forEach((c, i) => {
    checkY(70);
    // cabeçalho do circuito
    const phaseColors = { A: [29, 78, 216], B: [126, 34, 206], C: [180, 83, 9], AB: [29, 78, 216], BC: [126, 34, 206], ABC: [22, 101, 52] };
    const [r, g, b] = phaseColors[(c.phase || "A")[0] === "A" ? "A" : (c.phase || "A")[0] === "B" ? "B" : "C"] || [29, 78, 216];
    doc.setFillColor(r, g, b);
    doc.rect(ML, curY - 5, TW, 9, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(`Circuito C${String(i + 1).padStart(2, "0")} — ${c.name || "Circuito"} · Fase ${c.phase || "A"}`, ML + 2, curY + 1);
    curY += 8;

    doc.setTextColor(30, 30, 30); doc.setFontSize(9); doc.setFont("helvetica", "normal");

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

    cRows.forEach(([l1, v1, l2, v2]) => {
      checkY(7);
      if (curY % 14 < 7) { doc.setFillColor(247, 250, 255); doc.rect(ML, curY - 5, TW, 6.5, "F"); }
      doc.setFont("helvetica", "bold"); doc.text(l1 + ":", ML + 2, curY);
      doc.setFont("helvetica", "normal"); doc.text(v1, ML + 52, curY);
      if (l2) {
        doc.setFont("helvetica", "bold"); doc.text(l2 + ":", ML + 96, curY);
        doc.setFont("helvetica", "normal"); doc.text(v2 || "", ML + 146, curY);
      }
      curY += 6.5;
    });
    curY += 5;
  });

  // ── 6. BALANCEAMENTO DE FASES ─────────────────────────────────────────────
  checkY(60);
  h2("6. BALANCEAMENTO DE FASES");

  const phLoad = metrics.phaseLoad;
  const phRows = [
    ["Fase", "Circuitos", "Corrente Total (A)", "% Carregamento", "Status"],
    ["A (R)", circuits.filter(c => (c.phase||"").includes("A")).length, `${phLoad.A.toFixed(1)} A`, `${((phLoad.A / (metrics.generalCurrent || 1)) * 100).toFixed(1)}%`, phLoad.A > metrics.generalBreaker * 0.9 ? "⚠ Atenção" : "✓ OK"],
    ["B (S)", circuits.filter(c => (c.phase||"").includes("B")).length, `${phLoad.B.toFixed(1)} A`, `${((phLoad.B / (metrics.generalCurrent || 1)) * 100).toFixed(1)}%`, phLoad.B > metrics.generalBreaker * 0.9 ? "⚠ Atenção" : "✓ OK"],
    ["C (T)", circuits.filter(c => (c.phase||"").includes("C")).length, `${phLoad.C.toFixed(1)} A`, `${((phLoad.C / (metrics.generalCurrent || 1)) * 100).toFixed(1)}%`, phLoad.C > metrics.generalBreaker * 0.9 ? "⚠ Atenção" : "✓ OK"],
    ["Neutro (N)", "—", `${metrics.neutral_a} A (calc.)`, "—", "Verificar corrente harmônica"],
  ];
  let pbY = curY;
  phRows.forEach((row, ri) => {
    checkY(8);
    if (pbY !== curY) pbY = curY;
    if (ri === 0) { doc.setFillColor(14, 36, 89); doc.setTextColor(255, 255, 255); }
    else { doc.setFillColor(ri % 2 === 0 ? 239 : 255, ri % 2 === 0 ? 246 : 255, 255); doc.setTextColor(30, 30, 30); }
    doc.rect(ML, pbY - 5, TW, 8, "F");
    const pCols = [24, 26, 40, 38, TW - 128];
    let phX = ML + 2;
    row.forEach((cell, ci) => {
      doc.setFont("helvetica", ri === 0 ? "bold" : "normal"); doc.setFontSize(9);
      doc.text(String(cell), phX, pbY);
      phX += pCols[ci];
    });
    doc.setDrawColor(200, 200, 200); doc.rect(ML, pbY - 5, TW, 8, "S");
    pbY += 8; curY = pbY;
  });
  curY += 4;
  para(`Desequilíbrio entre fases: ${metrics.imbalance_pct}% — ${metrics.imbalance_pct <= 5 ? "ACEITÁVEL conforme NBR 5410" : metrics.imbalance_pct <= 10 ? "ATENÇÃO — recomenda-se redistribuição" : "CRÍTICO — redistribuição obrigatória (NBR 5410)"}`);

  // ── 7. QUADRO DE DISTRIBUIÇÃO ─────────────────────────────────────────────
  checkY(40);
  h2("7. QUADRO DE DISTRIBUIÇÃO — COMPOSIÇÃO");
  para(`O quadro de distribuição (QDC) deverá ser dimensionado para ${metrics.panelSize} módulos DIN, incluindo reserva de 20% para expansões futuras, conforme boa prática de engenharia e NBR 5410.`);
  bullet(`Disjuntor geral: ${poles_label(project.supply_type)} ${metrics.generalBreaker}A Curva C`);
  bullet(`DR geral (opcional): ${project.supply_type === "Trifásico" ? "4P" : "2P"} — proteção diferencial geral`);
  bullet(`DPS Classe II — ${project.voltage || 220}V — instalado após o medidor`);
  bullet(`Barramento de neutro (N) e terra (PE) separados — conforme NBR 5410`);
  bullet(`${circuits.filter(c => c.needs_dr).length} circuito(s) com proteção DR individual obrigatória`);
  bullet(`Total de módulos DIN utilizados: ${circuits.reduce((s, c) => s + (c.din_modules || 1), 0)} + ${4} (geral/DR/DPS) = ${circuits.reduce((s, c) => s + (c.din_modules || 1), 0) + 4}`);

  // ── 8. QUANTITATIVO DE MATERIAIS ──────────────────────────────────────────
  newPage(); curY = 28;
  h2("8. QUANTITATIVO DE MATERIAIS");
  para("Os materiais abaixo foram selecionados a partir da base técnica do projeto, garantindo conformidade com as normas e rastreabilidade do memorial.");
  curY += 2;

  const qCols = [TW - 104, 24, 14, 26, 26];
  const qHeaders = ["Descrição / Modelo", "Código", "Un", "Qtd", "Total R$"];
  // header
  doc.setFillColor(14, 36, 89); doc.rect(ML, curY - 5, TW, 8, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  let qx = ML + 2;
  qHeaders.forEach((h, hi) => { doc.text(h, qx, curY); qx += qCols[hi]; });
  doc.setDrawColor(255, 255, 255); doc.rect(ML, curY - 5, TW, 8, "S");
  curY += 8;

  bom.forEach((item, ii) => {
    checkY(8);
    if (ii % 2 === 0) { doc.setFillColor(239, 246, 255); } else { doc.setFillColor(255, 255, 255); }
    doc.rect(ML, curY - 5, TW, 7, "F");
    doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const cells = [
      item.model || item.name,
      item.code || "—",
      item.unit || "un",
      item.unit === "m" ? `${item.qty.toFixed(0)}m` : String(item.qty),
      `R$ ${item.total.toFixed(2)}`,
    ];
    let itemX = ML + 2;
    cells.forEach((cell, ci) => {
      doc.text(String(cell).slice(0, ci === 0 ? 38 : 12), itemX, curY);
      itemX += qCols[ci];
    });
    doc.setDrawColor(200, 200, 200); doc.rect(ML, curY - 5, TW, 7, "S");
    curY += 7;
  });

  // Total
  checkY(14);
  doc.setFillColor(14, 36, 89); doc.rect(ML, curY - 5, TW, 9, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("TOTAL ESTIMADO DE MATERIAIS (sem mão de obra):", ML + 2, curY + 1);
  doc.text(`R$ ${totalBOM.toFixed(2)}`, PW - MR - 2, curY + 1, { align: "right" });
  curY += 14;
  para("* Valores de referência. Podem variar conforme fornecedor, região e condições comerciais. Mão de obra não inclusa.");

  // ── 9. ANÁLISE NBR 5410 ───────────────────────────────────────────────────
  checkY(30);
  h2("9. ANÁLISE NBR 5410 — NÃO-CONFORMIDADES E ALERTAS");
  if (metrics.validations.length === 0) {
    doc.setTextColor(22, 163, 74); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("✓ Nenhuma não-conformidade identificada. Instalação dentro dos parâmetros NBR 5410.", ML, curY);
    curY += 10;
  } else {
    metrics.validations.forEach(v => {
      checkY(10);
      const isErr = v.severity === "error";
      doc.setFillColor(isErr ? 254 : 255, isErr ? 242 : 251, isErr ? 242 : 235);
      doc.rect(ML, curY - 5, TW, 9, "F");
      doc.setTextColor(isErr ? 220 : 202, isErr ? 38 : 138, isErr ? 38 : 4);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text(isErr ? "⚠ ERRO:" : "⚡ AVISO:", ML + 2, curY);
      doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(v.msg, TW - 30);
      doc.text(lines, ML + 22, curY);
      curY += 9;
    });
    curY += 4;
    para("Todas as não-conformidades identificadas devem ser corrigidas antes da energização da instalação, conforme NBR 5410:2004 item 3.4 (responsabilidade do instalador).");
  }

  // ── 10. ART ───────────────────────────────────────────────────────────────
  newPage(); curY = 28;
  h2("10. ART — ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA");
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
    ["Responsável técnico:", "___________________________________ CREA nº: ___________"],
    ["Registro CREA:", "___________"],
    ["Data de emissão:", "___________"],
    ["Assinatura:", "___________________________________ (Responsável Técnico)"],
    ["Visto CREA:", "___________________________________ (Fiscal)"],
  ];

  doc.setFontSize(10);
  artFields.forEach(([label, val]) => {
    checkY(9);
    doc.setFont("helvetica", "bold"); doc.setTextColor(14, 36, 89);
    doc.text(label, ML + 2, curY);
    doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(val, TW - 60);
    doc.text(lines, ML + 58, curY);
    doc.setDrawColor(210, 210, 210);
    doc.line(ML, curY + 3, PW - MR, curY + 3);
    curY += 9;
  });

  curY += 8;
  doc.setFontSize(8.5); doc.setTextColor(100, 100, 100);
  para("IMPORTANTE: Esta ART deve ser recolhida no CREA da jurisdição da obra e uma via entregue ao contratante antes do início dos serviços. O valor da ART é determinado pela tabela de honorários do CREA estadual.");

  // ── 11. CONCLUSÃO ─────────────────────────────────────────────────────────
  checkY(60);
  h2("11. CONCLUSÃO E ASSINATURA");
  para(`O presente memorial descritivo apresenta o dimensionamento completo da instalação elétrica de baixa tensão para o empreendimento "${project.name || "descrito na capa"}", elaborado em conformidade com a NBR 5410:2004 e suas referências normativas.`);
  curY += 2;
  para(`O projeto prevê ${circuits.length} circuito(s) finais com potência total instalada de ${(metrics.totalPower / 1000).toFixed(2)} kW, alimentados por sistema ${project.supply_type || "—"} em ${project.voltage || 220}V, protegidos por disjuntor geral de ${metrics.generalBreaker}A.`);
  curY += 2;
  para(`O NBR Score calculado pela plataforma ${brandName} considera queda de tensão, balanceamento de fases, proteção diferencial e DPS, resultando em uma avaliação objetiva da conformidade normativa.`);
  curY += 4;

  // Caixa de assinatura
  checkY(60);
  doc.setDrawColor(14, 36, 89); doc.setLineWidth(0.8);
  doc.rect(ML, curY, TW, 54, "S");
  doc.setFillColor(239, 246, 255); doc.rect(ML, curY, TW, 10, "F");
  doc.setTextColor(14, 36, 89); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("DECLARAÇÃO DO RESPONSÁVEL TÉCNICO", PW / 2, curY + 7, { align: "center" });

  doc.setTextColor(40, 40, 40); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Declaro que o presente memorial descritivo foi elaborado por mim, conforme as", ML + 4, curY + 18);
  doc.text("normas técnicas vigentes, sendo de minha responsabilidade técnica e legal.", ML + 4, curY + 25);
  doc.text(`Local e data: _________________________, ${new Date().toLocaleDateString("pt-BR")}`, ML + 4, curY + 34);
  doc.text("Assinatura: ___________________________________ CREA: ___________", ML + 4, curY + 43);
  doc.text("Carimbo:", ML + 4, curY + 50);

  curY += 60;
  doc.setFontSize(8); doc.setTextColor(130, 130, 130);
  para(`Este documento foi gerado automaticamente pela plataforma ${brandName} com base nos dados inseridos pelo usuário. A responsabilidade técnica pelo projeto é inteiramente do Engenheiro Responsável habilitado. ${brandName} é uma ferramenta de auxílio ao projeto e não substitui a análise crítica do profissional.`);

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
  const [selectedId, setSelectedId] = useState(searchParams.get("project") || "");
  const [project, setProject]       = useState(null);
  const [metrics, setMetrics]       = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated]   = useState(false);
  const brandName = [branding.appName, branding.appSuffix].filter(Boolean).join(" ") || "NACIF Solutions Eletric";
  const logoUrl = getProjectLogo(project, branding.logoDataUrl || DEFAULT_LOGO_URL);
  const areaM2 = project ? resolveProjectAreaM2(project) : 0;
  const projectRegion = project ? resolveProjectRegion(project) : "";
  const projectGps = project ? resolveProjectGps(project) : "";

  useEffect(() => { backend.entities.Project.list().then(setProjects); }, []);
  useEffect(() => {
    if (!selectedId) return;
    setProject(null); setMetrics(null); setGenerated(false);
    backend.entities.Project.get(selectedId).then(p => {
      setProject(p); setMetrics(calcProjectMetrics(p));
    });
  }, [selectedId]);

  const handleGenerate = async () => {
    if (!project || !metrics) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 400)); // UX — feedback visual
    const doc = generatePDF(project, metrics, { brandName, logoUrl });
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
        <Select value={selectedId} onValueChange={setSelectedId}>
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
              { icon: Cpu,           label: "Potência Total",    value: `${(metrics.totalPower/1000).toFixed(2)} kW` },
              { icon: Shield,        label: "NBR Score",         value: `${metrics.nbrScore}/100`, color: metrics.nbrScore >= 70 ? "text-primary" : "text-red-600" },
              { icon: BookOpen,      label: "Circuitos",         value: `${(metrics.circuits||[]).length}` },
              { icon: FileText,      label: "Material (est.)",   value: `R$ ${totalBOM.toFixed(0)}` },
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
                <img src={logoUrl} alt={brandName} className="max-h-20 max-w-full object-contain" />
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
