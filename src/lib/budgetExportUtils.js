import { jsPDF } from "jspdf";

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
 * Gera e baixa o Orçamento em PDF formatado no padrão A4 Executivo Comercial
 */
export function downloadBudgetPDF({
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
    if (isFirstPage) {
      doc.setFillColor(15, 79, 73);
      doc.rect(marginX, curY, contentWidth, 20, "F");

      doc.setFillColor(0, 216, 184);
      doc.rect(marginX, curY + 18.5, contentWidth, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(brandName.toUpperCase(), marginX + 4, curY + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 216, 184);
      doc.text("PROPOSTA TÉCNICA E COMERCIAL DE ENGENHARIA ELÉTRICA · NBR 5410", marginX + 4, curY + 13);

      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`Nº: ${proposalId}`, marginX + contentWidth - 4, curY + 7, { align: "right" });
      doc.text(`EMISSÃO: ${dateStr}`, marginX + contentWidth - 4, curY + 13, { align: "right" });

      curY += 24;
    } else {
      doc.setFillColor(15, 79, 73);
      doc.rect(marginX, curY, contentWidth, 10, "F");
      doc.setFillColor(0, 216, 184);
      doc.rect(marginX, curY + 9, contentWidth, 1, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${brandName.toUpperCase()} — ORÇAMENTO: ${projectName.toUpperCase()}`, marginX + 4, curY + 6.5);

      doc.setFontSize(7.5);
      doc.text(`Nº: ${proposalId} (Continuação)`, marginX + contentWidth - 4, curY + 6.5, { align: "right" });

      curY += 13;
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
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(marginX, curY, contentWidth, 20, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 79, 73);
  doc.text("DADOS DO PROJETO E DO CLIENTE", marginX + 3.5, curY + 4.5);

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Projeto / Obra:", marginX + 3.5, curY + 9.5);
  doc.text("Cliente:", marginX + 3.5, curY + 14.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(projectName, marginX + 24, curY + 9.5);
  doc.text(clientName, marginX + 24, curY + 14.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Alimentação:", marginX + 105, curY + 9.5);
  doc.text("Endereço / Local:", marginX + 105, curY + 14.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(supplyInfo, marginX + 124, curY + 9.5);
  doc.text(address, marginX + 128, curY + 14.5);

  curY += 24;

  // Mini Cards de Resumo dos Totais (KPIs)
  const kpiWidth = (contentWidth - 6) / 3;
  const kpis = [
    { label: "MATERIAIS E EQUIP.", val: formatBRL(totals.materialTotal || totals.baseMaterialTotal) },
    { label: "SERVIÇOS / MÃO DE OBRA", val: formatBRL(totals.servicesTotal || totals.laborCost) },
    { label: "VALOR TOTAL DA PROPOSTA", val: formatBRL(totals.total), highlight: true },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = marginX + idx * (kpiWidth + 3);
    if (kpi.highlight) {
      doc.setFillColor(0, 216, 184);
      doc.setDrawColor(0, 169, 142);
      doc.rect(kpiX, curY, kpiWidth, 14, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(15, 79, 73);
      doc.text(kpi.label, kpiX + 3, curY + 4.5);

      doc.setFontSize(10.5);
      doc.setTextColor(15, 79, 73);
      doc.text(kpi.val, kpiX + 3, curY + 10.5);
    } else {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(226, 232, 240);
      doc.rect(kpiX, curY, kpiWidth, 14, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label, kpiX + 3, curY + 4.5);

      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(kpi.val, kpiX + 3, curY + 10.5);
    }
  });

  curY += 18;

  // Tabela de Materiais
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 79, 73);
  doc.text("DISCRIMINAÇÃO DETALHADA DE MATERIAIS E COMPONENTES", marginX, curY + 3);
  curY += 6;

  const colW = {
    idx: 10,
    name: 82,
    cat: 26,
    qty: 16,
    unit: 12,
    price: 18,
    total: 18,
  };

  const drawTableHeader = (title = "MATERIAIS") => {
    doc.setFillColor(15, 79, 73);
    doc.rect(marginX, curY, contentWidth, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let x = marginX + 1.5;
    doc.text("#", x, curY + 4.2); x += colW.idx;
    doc.text(title === "MATERIAIS" ? "DESCRIÇÃO DO MATERIAL" : "DESCRIÇÃO DO SERVIÇO / ATIVIDADE", x, curY + 4.2); x += colW.name;
    doc.text("CATEGORIA", x, curY + 4.2); x += colW.cat;
    doc.text("QTD", x + colW.qty - 2, curY + 4.2, { align: "right" }); x += colW.qty;
    doc.text("UN.", x, curY + 4.2); x += colW.unit;
    doc.text("UNIT. (R$)", x + colW.price - 2, curY + 4.2, { align: "right" }); x += colW.price;
    doc.text("TOTAL (R$)", x + colW.total - 2, curY + 4.2, { align: "right" });

    curY += 6;
  };

  drawTableHeader("MATERIAIS");

  materials.forEach((m, idx) => {
    if (curY > pageHeight - 32) {
      doc.addPage();
      curY = 14;
      drawHeaderBanner(false);
      drawTableHeader("MATERIAIS");
    }

    const rowTotal = (Number(m.qty) || 0) * (Number(m.price) || 0);
    const isEven = idx % 2 === 0;

    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, curY, contentWidth, 5.2, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);

    let x = marginX + 1.5;
    doc.text(String(idx + 1), x, curY + 3.8); x += colW.idx;

    const shortName = String(m.name || "Material").length > 55
      ? `${String(m.name).slice(0, 52)}...`
      : String(m.name);
    doc.text(shortName, x, curY + 3.8); x += colW.name;

    doc.setTextColor(100, 116, 139);
    doc.text(String(m.category || "Geral").slice(0, 18), x, curY + 3.8); x += colW.cat;

    doc.setTextColor(15, 23, 42);
    doc.text(formatQty(m.qty), x + colW.qty - 2, curY + 3.8, { align: "right" }); x += colW.qty;
    doc.text(String(m.unit || "un"), x, curY + 3.8); x += colW.unit;
    doc.text(Number(m.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x + colW.price - 2, curY + 3.8, { align: "right" }); x += colW.price;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 79, 73);
    doc.text(Number(rowTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x + colW.total - 2, curY + 3.8, { align: "right" });

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(marginX, curY + 5.2, marginX + contentWidth, curY + 5.2);

    curY += 5.2;
  });

  // Tabela de Serviços (se existirem serviços detalhados)
  const actualServices = Array.isArray(services) && services.length > 0
    ? services
    : (Array.isArray(budget.services) && budget.services.length > 0 ? budget.services : []);

  if (actualServices.length > 0) {
    curY += 4;
    if (curY > pageHeight - 35) {
      doc.addPage();
      curY = 14;
      drawHeaderBanner(false);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 79, 73);
    doc.text("DISCRIMINAÇÃO DETALHADA DE SERVIÇOS E EXECUÇÃO", marginX, curY + 3);
    curY += 6;

    drawTableHeader("SERVICOS");

    actualServices.forEach((s, idx) => {
      if (curY > pageHeight - 32) {
        doc.addPage();
        curY = 14;
        drawHeaderBanner(false);
        drawTableHeader("SERVICOS");
      }

      const rowTotal = (Number(s.qty) || 0) * (Number(s.price) || 0);
      const isEven = idx % 2 === 0;

      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, curY, contentWidth, 5.2, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(15, 23, 42);

      let x = marginX + 1.5;
      doc.text(String(idx + 1), x, curY + 3.8); x += colW.idx;

      const shortName = String(s.name || "Serviço").length > 55
        ? `${String(s.name).slice(0, 52)}...`
        : String(s.name);
      doc.text(shortName, x, curY + 3.8); x += colW.name;

      doc.setTextColor(100, 116, 139);
      doc.text(String(s.category || "Instalação").slice(0, 18), x, curY + 3.8); x += colW.cat;

      doc.setTextColor(15, 23, 42);
      doc.text(formatQty(s.qty), x + colW.qty - 2, curY + 3.8, { align: "right" }); x += colW.qty;
      doc.text(String(s.unit || "un"), x, curY + 3.8); x += colW.unit;
      doc.text(Number(s.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x + colW.price - 2, curY + 3.8, { align: "right" }); x += colW.price;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 79, 73);
      doc.text(Number(rowTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x + colW.total - 2, curY + 3.8, { align: "right" });

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(marginX, curY + 5.2, marginX + contentWidth, curY + 5.2);

      curY += 5.2;
    });
  }

  curY += 4;

  // Bloco financeiro e condições
  if (curY > pageHeight - 65) {
    doc.addPage();
    curY = 14;
    drawHeaderBanner(false);
  }

  const splitW = (contentWidth - 6) / 2;

  // Lado esquerdo: Condições Comerciais e Normativas (Cantos Quadrados)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(marginX, curY, splitW, 48, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 79, 73);
  doc.text("CONDIÇÕES COMERCIAIS & GARANTIA", marginX + 3.5, curY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(71, 85, 105);
  const validityDays = commercialTerms?.validityDays || budget.validity_days || 15;
  const executionDeadline = commercialTerms?.executionTime || budget.execution_deadline || "15 dias úteis";
  const paymentTerms = commercialTerms?.paymentTerms || budget.payment_terms || "50% entrada e 50% na conclusão";
  const notesText = commercialTerms?.notes || budget.notes;

  const conditions = [
    `• Validade da proposta: ${validityDays} dias corridos.`,
    `• Prazo de execução: ${executionDeadline}.`,
    `• Pagamento: ${paymentTerms}.`,
    "• Materiais de primeira linha certificados INMETRO.",
    "• Dimensionamento em estrita conformidade com a NBR 5410:2004.",
    "• Mão de obra técnica qualificada com emissão de ART/TRT.",
    notesText
      ? `• Obs: ${String(notesText).slice(0, 50)}`
      : "• Garantia de 12 meses para serviços elétricos instalados.",
  ];
  conditions.forEach((cond, idx) => {
    doc.text(cond, marginX + 3.5, curY + 11 + idx * 5.0);
  });

  // Lado direito: Quadro de Totais Detalhado (Cantos Quadrados)
  const rightX = marginX + splitW + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(rightX, curY, splitW, 48, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 79, 73);
  doc.text("COMPOSIÇÃO FINANCEIRA DO ORÇAMENTO", rightX + 3.5, curY + 5);

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
    doc.setTextColor(71, 85, 105);
    doc.text(lbl, rightX + 3.5, curY + 11 + idx * 5.2);

    doc.setFont("helvetica", "bold");
    if (lbl.includes("Desconto")) {
      doc.setTextColor(16, 185, 129);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(val, rightX + splitW - 3.5, curY + 11 + idx * 5.2, { align: "right" });
  });

  // Linha de Destaque Total Final (Cantos Quadrados)
  doc.setFillColor(15, 79, 73);
  doc.rect(rightX + 2, curY + 33, splitW - 4, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 216, 184);
  doc.text("TOTAL DA PROPOSTA:", rightX + 5, curY + 40.5);

  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(formatBRL(totals.total), rightX + splitW - 5, curY + 40.8, { align: "right" });

  curY += 52;

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
  const fileName = `${baseName}.pdf`;
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
