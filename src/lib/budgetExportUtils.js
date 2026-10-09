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
  materials = [],
  totals = {},
  brandName = "NACIF Solutions Eletric",
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

  const projectName = project.name || "Projeto Elétrico";
  const clientName = project.client_name || "Não informado";
  const address = project.address || "Local não informado";
  const supplyInfo = `${project.supply_type || "Padrão"} · ${project.voltage ? `${project.voltage}V` : "220V"}`;
  const dateStr = new Date().toLocaleDateString("pt-BR");
  const proposalId = `PROP-${project.id ? String(project.id).slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`;

  const drawHeaderBanner = (isFirstPage = true) => {
    if (isFirstPage) {
      // Faixa de Cabeçalho Superior
      doc.setFillColor(15, 79, 73); // WEG_BLUE_DEEP
      doc.rect(marginX, curY, contentWidth, 20, "F");

      // Detalhe acento cor Ciano/Teal
      doc.setFillColor(0, 216, 184); // WEG_BLUE
      doc.rect(marginX, curY + 18.5, contentWidth, 1.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(brandName.toUpperCase(), marginX + 4, curY + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(0, 216, 184);
      doc.text("PROPOSTA TÉCNICA E COMERCIAL DE INSTALAÇÃO ELÉTRICA · NBR 5410", marginX + 4, curY + 13);

      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`Nº: ${proposalId}`, marginX + contentWidth - 4, curY + 7, { align: "right" });
      doc.text(`EMISSÃO: ${dateStr}`, marginX + contentWidth - 4, curY + 13, { align: "right" });

      curY += 24;
    } else {
      // Cabeçalho simplificado de continuação
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

  // Primeira página
  drawHeaderBanner(true);

  // Card de Dados do Projeto e Contratante
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, curY, contentWidth, 20, 2, 2, "FD");

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
    { label: "MÃO DE OBRA TÉCNICA", val: formatBRL(totals.laborCost) },
    { label: "VALOR TOTAL DA PROPOSTA", val: formatBRL(totals.total), highlight: true },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = marginX + idx * (kpiWidth + 3);
    if (kpi.highlight) {
      doc.setFillColor(0, 216, 184); // Ciano brilhante
      doc.setDrawColor(0, 169, 142);
      doc.roundedRect(kpiX, curY, kpiWidth, 14, 2, 2, "FD");

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
      doc.roundedRect(kpiX, curY, kpiWidth, 14, 2, 2, "FD");

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

  // Seção da Tabela de Materiais
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 79, 73);
  doc.text("DISCRIMINAÇÃO DETALHADA DE MATERIAIS E COMPONENTES", marginX, curY + 3);
  curY += 6;

  // Larguras das colunas: 182mm total
  const colW = {
    idx: 10,
    name: 82,
    cat: 26,
    qty: 16,
    unit: 12,
    price: 18,
    total: 18,
  };

  const drawTableHeader = () => {
    doc.setFillColor(15, 79, 73);
    doc.rect(marginX, curY, contentWidth, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);

    let x = marginX + 1.5;
    doc.text("#", x, curY + 4.2); x += colW.idx;
    doc.text("DESCRIÇÃO DO ITEM", x, curY + 4.2); x += colW.name;
    doc.text("CATEGORIA", x, curY + 4.2); x += colW.cat;
    doc.text("QTD", x + colW.qty - 2, curY + 4.2, { align: "right" }); x += colW.qty;
    doc.text("UN.", x, curY + 4.2); x += colW.unit;
    doc.text("UNIT. (R$)", x + colW.price - 2, curY + 4.2, { align: "right" }); x += colW.price;
    doc.text("TOTAL (R$)", x + colW.total - 2, curY + 4.2, { align: "right" });

    curY += 6;
  };

  drawTableHeader();

  // Linhas da tabela
  materials.forEach((m, idx) => {
    // Quebra de página se estiver perto do fim (deixar espaço para linhas e totais)
    if (curY > pageHeight - 32) {
      doc.addPage();
      curY = 14;
      drawHeaderBanner(false);
      drawTableHeader();
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

    // Linha inferior sutil
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(marginX, curY + 5.2, marginX + contentWidth, curY + 5.2);

    curY += 5.2;
  });

  // Espaço após a tabela
  curY += 4;

  // Verificar espaço para o bloco financeiro e condições (precisa de ~60mm)
  if (curY > pageHeight - 65) {
    doc.addPage();
    curY = 14;
    drawHeaderBanner(false);
  }

  // Bloco de Composição Financeira e Condições Comerciais lado a lado
  const splitW = (contentWidth - 6) / 2;

  // Lado esquerdo: Condições Comerciais e Normativas
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, curY, splitW, 46, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 79, 73);
  doc.text("CONDIÇÕES COMERCIAIS & GARANTIA", marginX + 3.5, curY + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(71, 85, 105);
  const conditions = [
    "• Validade da proposta: 15 (quinze) dias corridos.",
    "• Materiais de primeira linha certificados INMETRO.",
    "• Dimensionamento em estrita conformidade com a NBR 5410:2004.",
    "• Mão de obra técnica qualificada com emissão de ART/TRT.",
    "• Garantia de 12 meses para serviços elétricos instalados.",
    "• Pagamento: conforme etapas de avanço da obra acordadas.",
  ];
  conditions.forEach((cond, idx) => {
    doc.text(cond, marginX + 3.5, curY + 11 + idx * 5.2);
  });

  // Lado direito: Quadro de Totais Detalhado
  const rightX = marginX + splitW + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(rightX, curY, splitW, 46, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 79, 73);
  doc.text("COMPOSIÇÃO FINANCEIRA DO ORÇAMENTO", rightX + 3.5, curY + 5);

  const finRows = [
    ["Subtotal Materiais:", formatBRL(totals.materialTotal || totals.baseMaterialTotal)],
    ["Mão de Obra de Instalação:", formatBRL(totals.laborCost)],
    [`Margem BDI Aplicada (${totals.margin || 0}%):`, formatBRL((Number(totals.total || 0) - (Number(totals.materialTotal || 0) + Number(totals.laborCost || 0))))],
  ];

  finRows.forEach(([lbl, val], idx) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(lbl, rightX + 3.5, curY + 12 + idx * 6);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(val, rightX + splitW - 3.5, curY + 12 + idx * 6, { align: "right" });
  });

  // Linha de Destaque Total Final
  doc.setFillColor(15, 79, 73);
  doc.roundedRect(rightX + 2, curY + 31, splitW - 4, 12, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 216, 184);
  doc.text("TOTAL DA PROPOSTA:", rightX + 5, curY + 38.5);

  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(formatBRL(totals.total), rightX + splitW - 5, curY + 38.8, { align: "right" });

  curY += 50;

  // Bloco de Assinaturas (se houver espaço na página)
  if (curY < pageHeight - 30) {
    const signW = (contentWidth - 14) / 2;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);

    // Assinatura Contratante
    doc.line(marginX, curY + 16, marginX + signW, curY + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(clientName.toUpperCase(), marginX + signW / 2, curY + 20, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("Contratante / Aceite da Proposta", marginX + signW / 2, curY + 23.5, { align: "center" });

    // Assinatura Responsável Técnico
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

  // Numeração de páginas no rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  const fileName = `orcamento_${sanitizeFileName(projectName)}.pdf`;
  doc.save(fileName);
  return fileName;
}

/**
 * Gera e baixa o Orçamento em formato CSV (compatível com Excel / Google Sheets)
 */
export function downloadBudgetCSV({
  project = {},
  materials = [],
  totals = {},
} = {}) {
  const projectName = project.name || "Projeto Elétrico";
  const rows = [
    ["Item", "Descrição do Material", "Categoria", "Quantidade", "Unidade", "Preço Unitário (R$)", "Total (R$)"],
  ];

  materials.forEach((m, idx) => {
    const qty = Number(m.qty) || 0;
    const price = Number(m.price) || 0;
    const itemTotal = qty * price;
    rows.push([
      idx + 1,
      `"${String(m.name || "").replace(/"/g, '""')}"`,
      `"${String(m.category || "").replace(/"/g, '""')}"`,
      qty.toFixed(2).replace(".", ","),
      m.unit || "un",
      price.toFixed(2).replace(".", ","),
      itemTotal.toFixed(2).replace(".", ","),
    ]);
  });

  // Linhas de totais
  rows.push([]);
  rows.push(["", "", "", "", "", "Total Materiais:", (Number(totals.materialTotal || 0)).toFixed(2).replace(".", ",")]);
  rows.push(["", "", "", "", "", "Mão de Obra:", (Number(totals.laborCost || 0)).toFixed(2).replace(".", ",")]);
  rows.push(["", "", "", "", "", `Margem BDI (${totals.margin || 0}%):`, ((Number(totals.total || 0) - (Number(totals.materialTotal || 0) + Number(totals.laborCost || 0)))).toFixed(2).replace(".", ",")]);
  rows.push(["", "", "", "", "", "TOTAL DO ORÇAMENTO:", (Number(totals.total || 0)).toFixed(2).replace(".", ",")]);

  // UTF-8 BOM para compatibilidade com Microsoft Excel
  const csvContent = "\uFEFF" + rows.map((r) => r.join(";")).join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orcamento_${sanitizeFileName(projectName)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
