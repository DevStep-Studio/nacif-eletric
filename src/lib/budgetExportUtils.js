import { stampPdfWithPlanWatermark } from "./planEnforcement.js";
import { jsPDF } from "jspdf";
import { NACIF_SYMBOL_BASE64 } from "./solarLogoAsset.js";
import { PDF_THEME, drawPdfKpiStrip, drawPdfSectionTitle } from "./unifilarPdfDrawer.js";

const formatBRL = (value = 0) =>
  `R$ ${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatQty = (value = 0) => {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
};

const sanitizeFileName = (name = "") =>
  (name || "projeto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
    .toLowerCase();

/**
 * Gera o documento jsPDF de Orçamento formatado no padrão A4 Executivo Comercial
 */
export function buildBudgetPDFDoc({
  project = {},
  budget = {},
  budgetName = "",
  budgetStatus = "",
  materials = [],
  services = [],
  totals = {},
  commercialTerms = {},
  brandName = "NACIF Energy",
  logoUrl = null,
  exportAuth = null,
} = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  let curY = 14;

  const projectName = budgetName || budget.name || budget.project_name || project.name || "Projeto Elétrico";
  const clientName = budget.client_name || project.client_name || "Não informado";
  const address = budget.client_address || project.address || "Local não informado";
  const supplyInfo = `${project.supply_type || "Padrão"} · ${project.voltage ? `${project.voltage}V` : "220V"}`;
  const dateStr = budget.created_date ? new Date(budget.created_date).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
  const proposalId = budget.id
    ? `PROP-${String(budget.id).slice(-6).toUpperCase()}`
    : `PROP-${project.id ? String(project.id).slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`;

  const drawHeaderBanner = (isFirstPage = true) => {
    const logoType = /^data:image\/(png|jpe?g);/i.exec(String(logoUrl || ""));
    const addBannerLogo = (lx, ly, lw, lh) => {
      try {
        if (logoType) {
          doc.addImage(logoUrl, logoType[1].toLowerCase().startsWith("jp") ? "JPEG" : "PNG", lx, ly, lw, lh, undefined, "FAST");
        } else {
          doc.addImage(NACIF_SYMBOL_BASE64, "PNG", lx, ly, lw, lh, undefined, "FAST");
        }
      } catch {
        try {
          doc.addImage(NACIF_SYMBOL_BASE64, "PNG", lx, ly, lw, lh, undefined, "FAST");
        } catch {}
      }
    };

    if (isFirstPage) {
      doc.setFillColor(...PDF_THEME.navy);
      doc.rect(marginX, curY, contentWidth, 22, "F");
      doc.setFillColor(...PDF_THEME.blue);
      doc.rect(marginX, curY + 20.4, contentWidth, 0.7, "F");
      doc.setFillColor(...PDF_THEME.teal);
      doc.rect(marginX, curY + 21.1, contentWidth, 1.4, "F");

      addBannerLogo(marginX + 3.5, curY + 3.5, 13.5, 13.5);

      doc.setTextColor(...PDF_THEME.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`${brandName.toUpperCase()} — ORÇAMENTO EXECUTIVO`, marginX + 20, curY + 8.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF_THEME.teal);
      doc.text("PROPOSTA TÉCNICA E COMERCIAL DE ENGENHARIA ELÉTRICA · ABNT NBR 5410", marginX + 20, curY + 14.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.6);
      doc.setTextColor(...PDF_THEME.white);
      doc.text(`Nº: ${proposalId}`, marginX + contentWidth - 4, curY + 8.2, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(190, 206, 226);
      doc.text(`EMISSÃO: ${dateStr}`, marginX + contentWidth - 4, curY + 14.2, { align: "right" });

      curY += 26;
    } else {
      doc.setFillColor(...PDF_THEME.navy);
      doc.rect(marginX, curY, contentWidth, 11, "F");
      doc.setFillColor(...PDF_THEME.teal);
      doc.rect(marginX, curY + 10, contentWidth, 1, "F");
      addBannerLogo(marginX + 2.5, curY + 1.5, 7.5, 7.5);

      doc.setTextColor(...PDF_THEME.white);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.8);
      doc.text(`${brandName.toUpperCase()} — ${projectName.toUpperCase().slice(0, 48)}`, marginX + 12.5, curY + 7);

      doc.setFontSize(7.2);
      doc.setTextColor(...PDF_THEME.teal);
      doc.text(`Nº: ${proposalId} (Continuação)`, marginX + contentWidth - 3.5, curY + 7, { align: "right" });

      curY += 14.5;
    }
  };

  const drawFooter = (pageNo, totalPages) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, marginX + contentWidth, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${brandName} · Engenharia e Instalações Elétricas · Proposta ${proposalId}`,
      marginX,
      pageHeight - 8,
    );
    doc.text(
      `Página ${pageNo} de ${totalPages}`,
      marginX + contentWidth,
      pageHeight - 8,
      { align: "right" },
    );
  };

  drawHeaderBanner(true);

  // Card de Dados do Projeto e Contratante (Cantos Quadrados)
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.3);
  doc.rect(marginX, curY, contentWidth, 21, "FD");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(marginX, curY, 2.2, 21, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...PDF_THEME.navy);
  doc.text("DADOS DO PROJETO E DO CONTRATANTE", marginX + 5, curY + 4.8);
  if (budgetStatus) {
    doc.setFontSize(6.6);
    doc.setTextColor(...PDF_THEME.tealDeep);
    doc.text(`STATUS: ${String(budgetStatus).toUpperCase()}`, marginX + contentWidth - 4, curY + 4.8, { align: "right" });
  }

  doc.setFontSize(7.4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_THEME.slate500);
  doc.text("Projeto / Obra:", marginX + 5, curY + 10.5);
  doc.text("Cliente:", marginX + 5, curY + 16);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_THEME.slate900);
  doc.text(String(projectName).slice(0, 42), marginX + 26, curY + 10.5);
  doc.text(String(clientName).slice(0, 42), marginX + 26, curY + 16);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_THEME.slate500);
  doc.text("Alimentação:", marginX + 102, curY + 10.5);
  doc.text("Endereço / Local:", marginX + 102, curY + 16);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_THEME.slate900);
  doc.text(String(supplyInfo).slice(0, 32), marginX + 121, curY + 10.5);
  doc.text(String(address).slice(0, 32), marginX + 126, curY + 16);

  curY += 24;

  // Mini Cards de Resumo dos Totais (KPIs)
  curY = drawPdfKpiStrip(doc, [
    { label: "MATERIAIS E EQUIP.", value: formatBRL(totals.materialTotal || totals.baseMaterialTotal), sub: `${materials.length} item(ns)` },
    { label: "SERVIÇOS / MÃO DE OBRA", value: formatBRL(totals.servicesTotal || totals.laborCost), sub: "Instalação e engenharia", accent: PDF_THEME.blue },
    { label: "VALOR TOTAL DA PROPOSTA", value: formatBRL(totals.total), sub: "Condição Turnkey NBR 5410", highlight: true },
  ], marginX, curY, contentWidth, 18.5);

  curY += 2;

  // Tabela de Materiais
  curY = drawPdfSectionTitle(doc, "1. DISCRIMINAÇÃO DETALHADA DE MATERIAIS E COMPONENTES", marginX, curY, contentWidth, {
    accentColor: PDF_THEME.teal,
    rightBadge: `${materials.length} itens`,
  });

  const colW = {
    idx: 9,
    name: 83,
    cat: 26,
    qty: 15,
    unit: 11,
    price: 19,
    total: 19,
  };

  const drawTableHeader = (title = "MATERIAIS") => {
    doc.setFillColor(...PDF_THEME.navy);
    doc.rect(marginX, curY, contentWidth, 6.5, "F");
    doc.setFillColor(...PDF_THEME.teal);
    doc.rect(marginX, curY + 6.1, contentWidth, 0.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let x = marginX + 1.8;
    doc.text("#", x, curY + 4.4); x += colW.idx;
    doc.text(title === "MATERIAIS" ? "DESCRIÇÃO DO MATERIAL" : "DESCRIÇÃO DO SERVIÇO / ATIVIDADE", x, curY + 4.4); x += colW.name;
    doc.text("CATEGORIA", x, curY + 4.4); x += colW.cat;
    doc.text("QTD", x + colW.qty - 2, curY + 4.4, { align: "right" }); x += colW.qty;
    doc.text("UN.", x, curY + 4.4); x += colW.unit;
    doc.text("UNIT. (R$)", x + colW.price - 2, curY + 4.4, { align: "right" }); x += colW.price;
    doc.text("TOTAL (R$)", x + colW.total - 2, curY + 4.4, { align: "right" });

    curY += 6.6;
  };

  const drawLineItemRow = (item, idx, defaultCategory = "Geral", tableKind = "MATERIAIS") => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    const wrappedName = doc.splitTextToSize(String(item.name || "Item"), colW.name - 3);
    const rowH = Math.max(5.6, wrappedName.length * 3.4 + 2.2);

    if (curY + rowH > pageHeight - 28) {
      doc.addPage();
      curY = 14;
      drawHeaderBanner(false);
      drawTableHeader(tableKind);
    }

    const rowTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
    if (idx % 2 === 0) {
      doc.setFillColor(...PDF_THEME.slate50);
      doc.rect(marginX, curY, contentWidth, rowH, "F");
    }

    const textY = curY + 3.8;
    let x = marginX + 1.8;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_THEME.slate500);
    doc.text(String(idx + 1), x, textY); x += colW.idx;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_THEME.slate900);
    doc.text(wrappedName, x, textY); x += colW.name;

    doc.setTextColor(...PDF_THEME.slate500);
    doc.text(String(item.category || defaultCategory).slice(0, 18), x, textY); x += colW.cat;

    doc.setTextColor(...PDF_THEME.slate900);
    doc.text(formatQty(item.qty), x + colW.qty - 2, textY, { align: "right" }); x += colW.qty;
    doc.text(String(item.unit || "un"), x, textY); x += colW.unit;
    doc.text(Number(item.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x + colW.price - 2, textY, { align: "right" }); x += colW.price;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_THEME.navy);
    doc.text(Number(rowTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x + colW.total - 2, textY, { align: "right" });

    doc.setDrawColor(...PDF_THEME.slate200);
    doc.setLineWidth(0.18);
    doc.line(marginX, curY + rowH, marginX + contentWidth, curY + rowH);

    curY += rowH;
  };

  drawTableHeader("MATERIAIS");

  materials.forEach((m, idx) => {
    drawLineItemRow(m, idx, "Geral", "MATERIAIS");
  });

  // Tabela de Serviços (se existirem serviços detalhados)
  const actualServices = Array.isArray(services) && services.length > 0
    ? services
    : (Array.isArray(budget.services) && budget.services.length > 0 ? budget.services : []);

  if (actualServices.length > 0) {
    curY += 5;
    if (curY > pageHeight - 36) {
      doc.addPage();
      curY = 14;
      drawHeaderBanner(false);
    }

    curY = drawPdfSectionTitle(doc, "2. DISCRIMINAÇÃO DETALHADA DE SERVIÇOS E EXECUÇÃO", marginX, curY, contentWidth, {
      accentColor: PDF_THEME.blue,
      rightBadge: `${actualServices.length} atividades`,
    });

    drawTableHeader("SERVICOS");

    actualServices.forEach((s, idx) => {
      drawLineItemRow(s, idx, "Instalação", "SERVICOS");
    });
  }

  curY += 5;

  // Bloco financeiro e condições
  if (curY > pageHeight - 68) {
    doc.addPage();
    curY = 14;
    drawHeaderBanner(false);
  }

  const splitW = (contentWidth - 6) / 2;

  // Lado esquerdo: Condições Comerciais e Normativas (Cantos Quadrados)
  doc.setFillColor(...PDF_THEME.slate50);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.rect(marginX, curY, splitW, 50, "FD");
  doc.setFillColor(...PDF_THEME.blue);
  doc.rect(marginX, curY, splitW, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...PDF_THEME.navy);
  doc.text("CONDIÇÕES COMERCIAIS & GARANTIA", marginX + 3.5, curY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(...PDF_THEME.slate700);
  const validityDays = commercialTerms?.validityDays || budget.validity_days || 15;
  const executionDeadline = commercialTerms?.executionTime || budget.execution_deadline || "15 dias úteis";
  const paymentTerms = commercialTerms?.paymentTerms || budget.payment_terms || "50% entrada e 50% na conclusão";
  const notesText = commercialTerms?.notes || budget.notes;

  const conditions = [
    `• Validade da proposta: ${validityDays} dias corridos.`,
    `• Prazo de execução: ${executionDeadline}.`,
    `• Pagamento: ${paymentTerms}.`,
    "• Materiais certificados INMETRO e ensaiados em fábrica.",
    "• Dimensionamento em estrita conformidade com a ABNT NBR 5410.",
    "• Mão de obra qualificada NR-10 com emissão de ART/TRT.",
    notesText
      ? `• Obs: ${String(notesText).slice(0, 50)}`
      : "• Garantia de 12 meses para serviços elétricos instalados.",
  ];
  conditions.forEach((cond, idx) => {
    doc.text(cond, marginX + 3.5, curY + 13 + idx * 5.0);
  });

  // Lado direito: Quadro de Totais Detalhado (Cantos Quadrados)
  const rightX = marginX + splitW + 6;
  doc.setFillColor(...PDF_THEME.white);
  doc.setDrawColor(...PDF_THEME.slate300);
  doc.rect(rightX, curY, splitW, 50, "FD");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(rightX, curY, splitW, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.setTextColor(...PDF_THEME.navy);
  doc.text("COMPOSIÇÃO FINANCEIRA DO ORÇAMENTO", rightX + 3.5, curY + 7);

  const discountAmount = Number(totals.discountAmount || totals.discount_amount || 0);
  const surchargeAmount = Number(totals.surchargeAmount || totals.surcharge_amount || 0);
  const marginAmount = Number(totals.marginAmount || totals.marginBrl || totals.margin_amount || 0);
  const marginPct = Number(totals.marginPct ?? totals.margin ?? 0);

  const finRows = [
    ["Subtotal Materiais:", formatBRL(totals.materialTotal || totals.baseMaterialTotal || 0)],
    ["Serviços e Mão de Obra:", formatBRL(totals.servicesTotal || totals.laborCost || 0)],
    ...(discountAmount > 0 ? [["Desconto Concedido (-):", `- ${formatBRL(discountAmount)}`]] : []),
    ...(surchargeAmount > 0 ? [["Acréscimos / Taxas (+):", `+ ${formatBRL(surchargeAmount)}`]] : []),
    ...(marginAmount > 0 ? [[`Margem BDI Aplicada (${marginPct}%):`, formatBRL(marginAmount)]] : []),
  ];

  finRows.slice(0, 4).forEach(([lbl, val], idx) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text(lbl, rightX + 3.5, curY + 13 + idx * 5.2);

    doc.setFont("helvetica", "bold");
    if (lbl.includes("Desconto")) {
      doc.setTextColor(...PDF_THEME.emerald);
    } else {
      doc.setTextColor(...PDF_THEME.slate900);
    }
    doc.text(val, rightX + splitW - 3.5, curY + 13 + idx * 5.2, { align: "right" });
  });

  // Linha de Destaque Total Final (Cantos Quadrados)
  doc.setFillColor(...PDF_THEME.navy);
  doc.rect(rightX + 2.5, curY + 35, splitW - 5, 12.5, "F");
  doc.setFillColor(...PDF_THEME.teal);
  doc.rect(rightX + 2.5, curY + 35, 2.2, 12.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_THEME.teal);
  doc.text("TOTAL DA PROPOSTA:", rightX + 6.5, curY + 42.5);

  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_THEME.white);
  doc.text(formatBRL(totals.total), rightX + splitW - 4.5, curY + 42.8, { align: "right" });

  curY += 54;

  // Bloco de Assinaturas
  if (curY < pageHeight - 30) {
    const signW = (contentWidth - 14) / 2;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);

    doc.line(marginX, curY + 16, marginX + signW, curY + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(clientName.toUpperCase(), marginX + signW / 2, curY + 20, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("Contratante / Aceite da Proposta", marginX + signW / 2, curY + 23.5, { align: "center" });

    const engX = marginX + signW + 14;
    doc.line(engX, curY + 16, engX + signW, curY + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(brandName.toUpperCase(), engX + signW / 2, curY + 20, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("Responsável Técnico / Engenharia", engX + signW / 2, curY + 23.5, { align: "center" });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  const sanitized = sanitizeFileName(projectName);
  const baseName = sanitized.startsWith("orcamento") ? sanitized : `orcamento_${sanitized}`;
  if (exportAuth) { stampPdfWithPlanWatermark(doc, exportAuth); }
  const fileName = `${baseName}.pdf`;
  return { doc, fileName };
}

/**
 * Gera e baixa o Orçamento em PDF formatado no padrão A4 Executivo Comercial
 */
export function downloadBudgetPDF(options = {}) {
  const { doc, fileName } = buildBudgetPDFDoc(options);
  doc.save(fileName);
  return fileName;
}

/**
 * Gera e baixa o Orçamento em formato CSV (compatível com Excel / Google Sheets)
 */
export function downloadBudgetCSV({
  project = {},
  budget = {},
  budgetName = "",
  materials = [],
  services = [],
  totals = {},
  exportAuth = null,
} = {}) {
  const projectName = budgetName || budget.name || budget.project_name || project.name || "Projeto Elétrico";
  const rows = [
    ["Tipo", "Item", "Descrição", "Categoria", "Quantidade", "Unidade", "Preço Unitário (R$)", "Total (R$)"],
  ];

  materials.forEach((m, idx) => {
    const qty = Number(m.qty) || 0;
    const price = Number(m.price) || 0;
    const itemTotal = qty * price;
    rows.push([
      "Material",
      idx + 1,
      `"${String(m.name || "").replace(/"/g, '""')}"`,
      `"${String(m.category || "Material").replace(/"/g, '""')}"`,
      qty.toFixed(2).replace(".", ","),
      m.unit || "un",
      price.toFixed(2).replace(".", ","),
      itemTotal.toFixed(2).replace(".", ","),
    ]);
  });

  const actualServices = Array.isArray(services) && services.length > 0
    ? services
    : (Array.isArray(budget.services) && budget.services.length > 0 ? budget.services : []);

  actualServices.forEach((s, idx) => {
    const qty = Number(s.qty) || 0;
    const price = Number(s.price) || 0;
    const itemTotal = qty * price;
    rows.push([
      "Serviço",
      idx + 1,
      `"${String(s.name || "").replace(/"/g, '""')}"`,
      `"${String(s.category || "Serviço").replace(/"/g, '""')}"`,
      qty.toFixed(2).replace(".", ","),
      s.unit || "un",
      price.toFixed(2).replace(".", ","),
      itemTotal.toFixed(2).replace(".", ","),
    ]);
  });

  rows.push([]);
  rows.push(["", "", "", "", "", "", "Total Materiais:", (Number(totals.materialTotal || totals.baseMaterialTotal || 0)).toFixed(2).replace(".", ",")]);
  rows.push(["", "", "", "", "", "", "Total Serviços:", (Number(totals.servicesTotal || totals.laborCost || 0)).toFixed(2).replace(".", ",")]);
  if (Number(totals.discountAmount || 0) > 0) {
    rows.push(["", "", "", "", "", "", "Desconto Aplicado (-):", `-${Number(totals.discountAmount).toFixed(2).replace(".", ",")}`]);
  }
  if (Number(totals.surchargeAmount || 0) > 0) {
    rows.push(["", "", "", "", "", "", "Acréscimos / Taxas (+):", `+${Number(totals.surchargeAmount).toFixed(2).replace(".", ",")}`]);
  }
  rows.push(["", "", "", "", "", "", `Margem BDI (${totals.marginPct ?? totals.margin ?? 0}%):`, (Number(totals.marginAmount || 0)).toFixed(2).replace(".", ",")]);
  rows.push(["", "", "", "", "", "", "TOTAL DO ORÇAMENTO:", (Number(totals.total || 0)).toFixed(2).replace(".", ",")]);

  if (exportAuth?.watermark) rows.unshift([exportAuth.watermark]);
  const csvContent = "\uFEFF" + rows.map((r) => r.join(";")).join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const sanitized = sanitizeFileName(projectName);
  const baseName = sanitized.startsWith("orcamento") ? sanitized : `orcamento_${sanitized}`;
  a.download = `${baseName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
