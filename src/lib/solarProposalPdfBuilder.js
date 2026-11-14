/**
 * Gerador da Proposta Comercial Solar Completa (9 Páginas) — NACIF ENERGY
 * Identidade Visual NACIF Energy (Original Logo, Minimalista, Sem Gradientes).
 */

import { jsPDF } from "jspdf";
import { buildDetailedSolarBudget } from "./solarBudgetMath.js";
import {
  NACIF_LOGO_DARK_BASE64,
  NACIF_LOGO_PRINCIPAL_BASE64,
  NACIF_SYMBOL_BASE64,
} from "./solarLogoAsset.js";
import { PDF_THEME, drawPdfSectionTitle, drawVectorBarChart } from "./unifilarPdfDrawer.js";

const brl = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtNum = (v, d = 1) =>
  Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

const NA_NAVY = PDF_THEME.navy;     // [14, 23, 38] #0E1726
const NA_BLUE = PDF_THEME.blue;     // [13, 59, 130] #0D3B82
const NA_TEAL = PDF_THEME.teal;     // [0, 216, 184] #00D8B8
const NA_TEAL_DARK = [0, 155, 132]; // #009B84
const NA_TEAL_SOFT = [242, 255, 252];

function addProposalPageHeader(doc, sectionLabel, projectName) {
  // Faixa superior minimalista limpa (#FFFFFF) com filete inferior #0E1726 / #00D8B8
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 22, "F");

  try {
    doc.addImage(NACIF_LOGO_PRINCIPAL_BASE64, "PNG", 14, 5.2, 31.5, 10.5, undefined, "FAST");
  } catch {
    try {
      doc.addImage(NACIF_SYMBOL_BASE64, "PNG", 14, 5.5, 10, 9.3, undefined, "FAST");
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...NA_NAVY);
  doc.text("PROPOSTA COMERCIAL · ENERGIA SOLAR", 196, 9.4, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...NA_TEAL_DARK);
  const labelText = sectionLabel || projectName || "Sistema Fotovoltaico";
  doc.text(String(labelText).slice(0, 60), 196, 14.5, { align: "right" });

  // Linha divisória nítida sem gradiente
  doc.setFillColor(...NA_NAVY);
  doc.rect(14, 18.8, 150, 0.7, "F");
  doc.setFillColor(...NA_TEAL);
  doc.rect(164, 18.8, 32, 0.7, "F");
}

function addProposalPageFooter(doc, pageNum, totalPages = 9) {
  const ph = doc.internal.pageSize.height || 297;
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.3);
  doc.line(14, ph - 12, 196, ph - 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...NA_NAVY);
  doc.text("NACIF ENERGY", 14, ph - 7.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...PDF_THEME.slate500);
  doc.text("· DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR · NBR 16690 / LEI 14.300", 33, ph - 7.2);
  doc.text(`Página ${pageNum} de ${totalPages}`, 196, ph - 7.2, { align: "right" });
}

function drawGeometricSolarMotif(doc, x, y, w, h) {
  // Ilustração vetorial minimalista de painéis solares e arquitetura (100% sólido, zero gradiente)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.rect(x, y, w, h, "FD");

  // Linhas de engenharia sutis no fundo
  doc.setDrawColor(235, 240, 248);
  doc.setLineWidth(0.2);
  for (let gx = x + 10; gx < x + w; gx += 12) {
    doc.line(gx, y, gx, y + h);
  }
  for (let gy = y + 10; gy < y + h; gy += 12) {
    doc.line(x, gy, x + w, gy);
  }

  // Sol geométrico minimalista à direita
  const sunX = x + w - 26;
  const sunY = y + 22;
  doc.setFillColor(...NA_TEAL);
  doc.circle(sunX, sunY, 9, "F");
  doc.setDrawColor(...NA_TEAL_DARK);
  doc.setLineWidth(0.45);
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    doc.line(
      sunX + Math.cos(rad) * 11.5,
      sunY + Math.sin(rad) * 11.5,
      sunX + Math.cos(rad) * 15,
      sunY + Math.sin(rad) * 15
    );
  }

  // Matriz de painéis inclinados em perspectiva isométrica simples
  const cols = 5;
  const rows = 3;
  const pw = 24;
  const ph = 14;
  const gap = 3;
  const startX = x + 16;
  const startY = y + 20;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const px = startX + c * (pw + gap) + r * 6;
      const py = startY + r * (ph + gap + 1);
      doc.setFillColor(...NA_NAVY);
      doc.rect(px, py, pw, ph, "F");
      doc.setDrawColor(...NA_TEAL);
      doc.setLineWidth(0.35);
      doc.rect(px, py, pw, ph, "S");
      // Grade interna das células fotovoltaicas
      doc.setDrawColor(48, 72, 108);
      doc.setLineWidth(0.2);
      doc.line(px + pw / 2, py, px + pw / 2, py + ph);
      doc.line(px, py + ph / 2, px + pw, py + ph / 2);
    }
  }

  // Seta discreta de conversão energética
  doc.setFillColor(...NA_BLUE);
  doc.rect(x + 16, y + h - 14, w - 32, 8, "F");
  doc.setFillColor(...NA_TEAL);
  doc.rect(x + 16, y + h - 14, 3, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);
  doc.text("ENGENHARIA SOLAR DE ALTA PERFORMANCE · GERAÇÃO LIMPA E RENTÁVEL", x + 23, y + h - 8.7);
}

/**
 * Gera a Proposta Comercial Completa (9 Páginas) no padrão visual NACIF Energy.
 */
export function buildNacifCommercialProposalPdf({ project = {}, config = {}, sizing = {}, params = {} } = {}) {
  const budget = buildDetailedSolarBudget({ project, config, sizing });
  const { financial } = budget;
  const doc = new jsPDF("p", "mm", "a4");
  const totalPages = 9;

  const clientName = project?.client_name || project?.customer_name || "Cliente";
  const projectName = project?.name || "Sistema Solar Fotovoltaico";
  const cityState = [project?.city, project?.state].filter(Boolean).join(" / ");
  const clientAddress = [project?.address, project?.neighborhood, cityState].filter(Boolean).join(" · ") || "Endereço a definir";
  const todayStr = new Date().toLocaleDateString("pt-BR");
  const validDate = new Date(Date.now() + budget.validityDays * 86400000).toLocaleDateString("pt-BR");

  // =========================================================================
  // PÁGINA 1: CAPA PROPOSTA COMERCIAL (MINIMALISTA NACIF ENERGY, SEM GRADIENTE)
  // =========================================================================
  doc.setFillColor(...NA_NAVY);
  doc.rect(0, 0, 210, 16, "F");
  doc.setFillColor(...NA_TEAL);
  doc.rect(0, 16, 210, 2.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...NA_TEAL);
  doc.text("NACIF ENERGY · SOLUÇÕES EM ENGENHARIA ELÉTRICA E ENERGIA SOLAR", 14, 10.2);
  doc.setTextColor(220, 232, 245);
  doc.text(`EMISSÃO: ${todayStr}`, 196, 10.2, { align: "right" });

  // Logotipo Original Principal NACIF Energy em destaque
  try {
    doc.addImage(NACIF_LOGO_PRINCIPAL_BASE64, "PNG", 14, 30, 78, 26, undefined, "FAST");
  } catch {
    try {
      doc.addImage(NACIF_SYMBOL_BASE64, "PNG", 14, 30, 26, 24, undefined, "FAST");
    } catch {}
  }

  // Barra vertical lateral ciano minimalista para o título
  doc.setFillColor(...NA_TEAL);
  doc.rect(14, 68, 3.2, 34, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...NA_NAVY);
  doc.text("PROPOSTA", 22, 80);
  doc.setTextColor(...NA_TEAL_DARK);
  doc.text("COMERCIAL", 22, 92.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_THEME.slate700);
  const modeDesc = /hibr/i.test(String(project?.system_mode || ""))
    ? "Sistema Fotovoltaico Híbrido"
    : /off/i.test(String(project?.system_mode || ""))
    ? "Sistema Fotovoltaico Off-Grid"
    : "Sistema Fotovoltaico Conectado à Rede (On-Grid)";
  doc.text(`${modeDesc} · ${fmtNum(budget.dcPowerKw, 2)} kWp (${budget.panelCount} módulos de ${budget.moduleWp} Wp)`, 22, 100.5);

  // Ilustração geométrica minimalista do sistema fotovoltaico
  drawGeometricSolarMotif(doc, 14, 114, 182, 88);

  // Cartão de dados do Cliente & Resumo da Proposta na capa
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.setLineWidth(0.4);
  doc.rect(14, 212, 182, 62, "FD");
  doc.setFillColor(...NA_NAVY);
  doc.rect(14, 212, 182, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(255, 255, 255);
  doc.text("IDENTIFICAÇÃO DA PROPOSTA", 18, 218);

  const coverInfoRows = [
    ["Cliente:", clientName, "Projeto:", projectName],
    ["Local da Obra:", clientAddress.slice(0, 48), "Potência:", `${fmtNum(budget.dcPowerKw, 2)} kWp · Geração ~${Math.round(financial.year1GenerationKwh / 12)} kWh/mês`],
    ["Data de Emissão:", todayStr, "Validade:", `${validDate} (${budget.validityDays} dias)`],
    ["Investimento:", brl(budget.finalTotal), "Economia Anual:", `${brl(financial.year1SavingsBrl)}/ano · Payback ${fmtNum(financial.paybackYears, 1)} anos`],
  ];

  let cy = 229;
  coverInfoRows.forEach(([k1, v1, k2, v2], idx) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.slate500);
    doc.text(k1, 18, cy);
    doc.text(k2, 110, cy);
    doc.setFont("helvetica", idx === 3 ? "bold" : "normal");
    doc.setTextColor(idx === 3 ? 0 : 15, idx === 3 ? 130 : 23, idx === 3 ? 110 : 42);
    doc.text(String(v1).slice(0, 38), 44, cy);
    doc.text(String(v2).slice(0, 40), 134, cy);
    if (idx < coverInfoRows.length - 1) {
      doc.setDrawColor(...PDF_THEME.slate100);
      doc.line(18, cy + 3.2, 192, cy + 3.2);
    }
    cy += 11.2;
  });

  addProposalPageFooter(doc, 1, totalPages);

  // =========================================================================
  // PÁGINA 2: CONHEÇA A NACIF ENERGY + SUA PROPOSTA INCLUI
  // =========================================================================
  doc.addPage();
  addProposalPageHeader(doc, "Apresentação Institucional & Escopo Turnkey", projectName);

  let y = 26;
  y = drawPdfSectionTitle(doc, "CONHEÇA A NACIF ENERGY", 14, y, 182, { accentColor: NA_TEAL });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  doc.setTextColor(...PDF_THEME.slate700);
  const introLines = doc.splitTextToSize(
    "A NACIF ENERGY atua do projeto elétrico à usina fotovoltaica completa, unindo engenharia especializada, equipamentos de primeira linha e atendimento transparente. Nosso foco é reduzir drasticamente a sua conta de energia elétrica com segurança normativa (ABNT NBR 16690 e NBR 5410) e máxima rentabilidade sobre o capital investido.",
    182
  );
  doc.text(introLines, 14, y + 3);
  y += introLines.length * 4.8 + 7;

  // 4 Cards minimalistas de destaque institucional (flat, crisp 1px border)
  const instStats = [
    { metric: "100% TURNKEY", title: "Da Planta ao Sol", desc: "Engenharia elétrica, projeto, fornecimento, instalação e homologação integrados." },
    { metric: "NBR 16690", title: "Segurança Normativa", desc: "Dimensionamento CC/CA rigoroso, proteções DPS, disjuntores e aterramento." },
    { metric: "TIER-1", title: "Equipamentos Certificados", desc: "Módulos monocristalinos de alta eficiência e inversores homologados INMETRO." },
    { metric: "25 ANOS", title: "Foco em Rentabilidade", desc: "Monitoramento em tempo real e retorno garantido do seu patrimônio energético." },
  ];

  const cardW = 88.5;
  const cardH = 26;
  instStats.forEach((st, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = 14 + col * (cardW + 5);
    const ry = y + row * (cardH + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.setLineWidth(0.3);
    doc.rect(cx, ry, cardW, cardH, "FD");
    doc.setFillColor(...NA_TEAL);
    doc.rect(cx, ry, 2.2, cardH, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NA_NAVY);
    doc.text(st.metric, cx + 6, ry + 7.5);

    doc.setFontSize(8.2);
    doc.setTextColor(...NA_TEAL_DARK);
    doc.text(st.title, cx + 6, ry + 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...PDF_THEME.slate500);
    doc.text(doc.splitTextToSize(st.desc, cardW - 10), cx + 6, ry + 18);
  });
  y += cardH * 2 + 14;

  y = drawPdfSectionTitle(doc, "SUA PROPOSTA INCLUI — ESCOPO COMPLETO", 14, y, 182, { accentColor: NA_BLUE });

  const scopeItems = [
    ["01. Dimensionamento Personalizado", "Estudo da curva de carga, irradiação solar local e definição do arranjo ideal para sua unidade consumidora."],
    ["02. Engenharia & Projeto Executivo", "Elaboração de diagramas unifilar e multifilar, memorial técnico descritivo e emissão de ART junto ao CREA."],
    ["03. Fornecimento & Logística", "Kit fotovoltaico completo com módulos Tier-1, inversor(es), estrutura, cabeamento solar e String Box CC/CA."],
    ["04. Instalação & Comissionamento", "Montagem mecânica, interligação elétrica conforme normas ABNT, testes de isolação e configuração do monitoramento."],
    ["05. Gestão Energética & Monitoramento", "Acompanhamento de geração via aplicativo com alertas inteligentes e suporte técnico pós-venda."],
    ["06. Homologação & Vistoria", "Solicitação de acesso junto à distribuidora local até a troca do medidor bidirecional e ativação dos créditos."],
    ["07. Garantias & Pós-Venda", "Garantia integrada de instalação, equipamentos originais de fábrica e suporte dedicado NACIF Energy."],
  ];

  scopeItems.forEach(([title, desc], idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 182, 13.5, "FD");
    doc.setFillColor(...NA_NAVY);
    doc.rect(16.5, y + 3, 7.5, 7.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...NA_TEAL);
    doc.text(String(idx + 1).padStart(2, "0"), 20.25, y + 7.9, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...NA_NAVY);
    doc.text(title.slice(4), 27.5, y + 5.6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text(desc, 27.5, y + 10.6);
    y += 14.5;
  });

  addProposalPageFooter(doc, 2, totalPages);

  // =========================================================================
  // PÁGINA 3: COMO FUNCIONA A ENERGIA SOLAR + REGULAMENTAÇÃO NO BRASIL
  // =========================================================================
  doc.addPage();
  addProposalPageHeader(doc, "Funcionamento do Sistema & Marco Legal", projectName);

  y = 26;
  y = drawPdfSectionTitle(doc, "COMO FUNCIONA A ENERGIA SOLAR FOTOVOLTAICA", 14, y, 182, { accentColor: NA_TEAL });

  // Esquema vetorial horizontal dos 5 blocos
  const stepsDiagram = [
    { num: "1", label: "PAINÉIS\nSOLARES", sub: "Captação CC" },
    { num: "2", label: "INVERSOR\nSOLAR", sub: "CC para CA" },
    { num: "3", label: "QUADRO\nELÉTRICO", sub: "Consumo Local" },
    { num: "4", label: "MEDIDOR\nBIDIRECIONAL", sub: "Créditos Rede" },
    { num: "5", label: "REDE DE\nDISTRIBUIÇÃO", sub: "Compensação" },
  ];
  const boxW = 31;
  const gapD = 6.75;
  stepsDiagram.forEach((step, idx) => {
    const bx = 14 + idx * (boxW + gapD);
    doc.setFillColor(...NA_NAVY);
    doc.rect(bx, y + 2, boxW, 24, "F");
    doc.setFillColor(...NA_TEAL);
    doc.rect(bx, y + 2, boxW, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...NA_TEAL);
    doc.text(`ETAPA ${step.num}`, bx + boxW / 2, y + 9.2, { align: "center" });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.1);
    doc.text(step.label.split("\n"), bx + boxW / 2, y + 14.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(180, 200, 220);
    doc.text(step.sub, bx + boxW / 2, y + 23.6, { align: "center" });

    if (idx < stepsDiagram.length - 1) {
      const ax1 = bx + boxW + 1;
      const ax2 = bx + boxW + gapD - 1.2;
      const ay = y + 14;
      doc.setDrawColor(...NA_TEAL_DARK);
      doc.setLineWidth(0.7);
      doc.line(ax1, ay, ax2, ay);
      doc.line(ax2 - 1.5, ay - 1.3, ax2, ay);
      doc.line(ax2 - 1.5, ay + 1.3, ax2, ay);
    }
  });
  y += 33;

  const howItWorksDetails = [
    ["1. Painéis Solares", "Convertem a radiação solar em energia elétrica em corrente contínua (CC) de forma silenciosa e contínua durante todo o dia."],
    ["2. Inversor Fotovoltaico", "Transforma a corrente contínua (CC) gerada pelos módulos em corrente alternada (CA) sincronizada com a rede da concessionária."],
    ["3. Quadro de Distribuição", "A energia limpa passa a abastecer prioritariamente os equipamentos e tomadas do imóvel em tempo real, gerando economia imediata."],
    ["4. Medidor Bidirecional", "Registra tanto a energia consumida da distribuidora à noite quanto a energia excedente injetada na rede durante o dia."],
    ["5. Sistema de Compensação", "O excedente injetado na rede gera créditos em kWh válidos por até 60 meses, abatendo seu consumo noturno ou em outras UCs da mesma titularidade."],
  ];

  howItWorksDetails.forEach(([title, text]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 182, 16, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NA_BLUE);
    doc.text(title, 18, y + 5.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text(doc.splitTextToSize(text, 174), 18, y + 10.6);
    y += 18;
  });

  y += 4;
  y = drawPdfSectionTitle(doc, "REGULAMENTAÇÃO NO BRASIL (ANEEL & LEI 14.300)", 14, y, 182, { accentColor: NA_BLUE });

  doc.setFillColor(...NA_TEAL_SOFT);
  doc.setDrawColor(...NA_TEAL_DARK);
  doc.setLineWidth(0.35);
  doc.rect(14, y, 182, 62, "FD");

  const regItems = [
    "• REN 482/2012 & REN 687/2015 (ANEEL): Instituíram o Sistema de Compensação de Energia Elétrica (SCEE), permitindo ao consumidor gerar sua própria energia e acumular créditos por até 60 meses.",
    "• Marco Legal da Geração Distribuída — Lei 14.300/2022 & REN 1.000/1.059: Trouxe segurança jurídica definitiva ao setor solar brasileiro até 2045 e consolidou modalidades de autoconsumo local, remoto e geração compartilhada.",
    "• Fio B e Economia Real: A energia gerada e consumida instantaneamente no imóvel (simultaneidade) tem isenção integral de encargos de distribuição, enquanto os créditos injetados seguem as regras vigentes da concessionária local.",
  ];
  let ry = y + 7.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...NA_NAVY);
  regItems.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, 172);
    doc.text(wrapped, 19, ry);
    ry += wrapped.length * 4.4 + 4;
  });

  addProposalPageFooter(doc, 3, totalPages);

  // =========================================================================
  // PÁGINA 4: DIFERENCIAIS, FINANCIAMENTO, GARANTIAS & FORNECEDORES TIER-1
  // =========================================================================
  doc.addPage();
  addProposalPageHeader(doc, "Diferenciais, Garantias & Fornecedores Homologados", projectName);

  y = 26;
  y = drawPdfSectionTitle(doc, "SOLUÇÕES FINANCEIRAS & LINHAS DE CRÉDITO SOLAR", 14, y, 182, { accentColor: NA_TEAL });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.4);
  doc.setTextColor(...PDF_THEME.slate700);
  doc.text(
    doc.splitTextToSize(
      "A NACIF ENERGY auxilia você na escolha da melhor linha de financiamento bancário com aprovação ágil, carência de até 90 dias e parcelas que frequentemente são menores do que a economia gerada na sua própria conta de energia.",
      182
    ),
    14,
    y + 2
  );
  y += 14;

  const banks = ["Santander Solar", "BV Financeira", "Banco do Brasil", "Solfácil", "Sicredi", "Itaú"];
  const bw = 28.5;
  banks.forEach((b, idx) => {
    const bx = 14 + idx * (bw + 2.2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(bx, y, bw, 11, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.1);
    doc.setTextColor(...NA_NAVY);
    doc.text(b, bx + bw / 2, y + 6.9, { align: "center" });
  });
  y += 18;

  y = drawPdfSectionTitle(doc, "GARANTIAS INCLUSAS NA PROPOSTA", 14, y, 182, { accentColor: NA_BLUE });

  const warranties = [
    ["NACIF ENERGY", "1 Ano", "Garantia integral de instalação elétrica/mecânica e mão de obra especializada."],
    ["MÓDULOS FOTOVOLTAICOS", "12 Anos / 25 Anos", "12 anos contra defeitos de fabricação e 25 anos de garantia linear de geração mínima."],
    ["INVERSORES SOLARES", "5 a 10 Anos", "Garantia oficial de fábrica no Brasil conforme modelo especificado nesta proposta."],
    ["ESTRUTURAS DE FIXAÇÃO", "12 Anos", "Alumínio estrutural anodizado e parafusos em aço inox resistentes à corrosão."],
  ];

  warranties.forEach(([who, term, detail], idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 182, 16, "FD");
    doc.setFillColor(...NA_NAVY);
    doc.rect(14, y, 42, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(255, 255, 255);
    doc.text(who, 17, y + 9.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NA_TEAL_DARK);
    doc.text(term, 60, y + 6.8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text(detail, 60, y + 12.2);
    y += 18;
  });

  y += 4;
  y = drawPdfSectionTitle(doc, "FORNECEDORES GLOBAIS HOMOLOGADOS (BLOOMBERG TIER-1)", 14, y, 182, { accentColor: NA_TEAL });
  const suppliers = [
    "Canadian Solar", "Jinko Solar", "JA Solar", "Trina Solar",
    "Growatt", "Sungrow", "Solis", "Deye",
    "Fronius", "BYD", "WEG Solar", "ABB / Clamper",
  ];
  const sw = 43.2;
  suppliers.forEach((sup, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const sx = 14 + col * (sw + 3);
    const sy = y + row * 14.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(sx, sy, sw, 11.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...NA_NAVY);
    doc.text(sup, sx + sw / 2, sy + 7.2, { align: "center" });
  });

  addProposalPageFooter(doc, 4, totalPages);

  // =========================================================================
  // PÁGINA 5: DIMENSIONAMENTO, PRINCIPAIS EQUIPAMENTOS & COMPOSIÇÃO DE PREÇOS
  // =========================================================================
  doc.addPage();
  addProposalPageHeader(doc, "Dimensionamento Técnico, Equipamentos & Orçamento", projectName);

  y = 26;
  y = drawPdfSectionTitle(doc, "DIMENSIONAMENTO DO SISTEMA PROPOSTO", 14, y, 182, { accentColor: NA_TEAL });

  const usableArea = Number(params.usableArea || sizing.roofArea || Math.round(budget.panelCount * 2.58));
  const monthlyKwh = Math.round(financial.year1GenerationKwh / 12);

  // 3 KPIs principais inspirados na página 5 do modelo
  const dimKpis = [
    { label: "POTÊNCIA PROPOSTA", val: `${fmtNum(budget.dcPowerKw, 2)} kWp`, sub: `${budget.panelCount} módulos de ${budget.moduleWp} Wp` },
    { label: "GERAÇÃO ESTIMADA", val: `${monthlyKwh.toLocaleString("pt-BR")} kWh/mês`, sub: `${Math.round(financial.year1GenerationKwh).toLocaleString("pt-BR")} kWh/ano` },
    { label: "ÁREA ÚTIL ESTIMADA", val: `${fmtNum(usableArea, 1)} m²`, sub: `Conexão ${params.supplyType || "Bifásico"} ${params.acVoltage || 220}V` },
  ];
  dimKpis.forEach((k, idx) => {
    const kx = 14 + idx * 62;
    doc.setFillColor(idx === 0 ? 14 : 248, idx === 0 ? 23 : 250, idx === 0 ? 38 : 252);
    doc.setDrawColor(...(idx === 0 ? NA_NAVY : PDF_THEME.slate200));
    doc.rect(kx, y, 58, 22, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...(idx === 0 ? NA_TEAL : PDF_THEME.slate500));
    doc.text(k.label, kx + 4, y + 6);
    doc.setFontSize(12);
    doc.setTextColor(...(idx === 0 ? PDF_THEME.white : NA_NAVY));
    doc.text(k.val, kx + 4, y + 13.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...(idx === 0 ? [203, 213, 225] : PDF_THEME.slate500));
    doc.text(k.sub, kx + 4, y + 19);
  });
  y += 28;

  y = drawPdfSectionTitle(doc, "PRINCIPAIS EQUIPAMENTOS, SERVIÇOS & PREÇOS", 14, y, 182, { accentColor: NA_BLUE });

  // Tabela discriminada de Equipamentos CC + CA + Serviços + Margem Aplicada
  const tableHeaders = ["Descrição do Item / Escopo", "Qtd.", "Unitário (R$)", "Subtotal (R$)"];
  const colW = [104, 18, 30, 30];
  doc.setFillColor(...NA_NAVY);
  doc.rect(14, y, 182, 7.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);
  let tx = 14;
  tableHeaders.forEach((h, i) => {
    doc.text(h, i === 0 ? tx + 3 : tx + colW[i] - 3, y + 5, { align: i === 0 ? "left" : "right" });
    tx += colW[i];
  });
  y += 7.5;

  const equipDisplayRows = [
    ...budget.equipmentItems.map((i) => ({ ...i, displayPrice: budget.useKitTotalOverride ? null : i.unitPrice, displaySub: budget.useKitTotalOverride ? null : i.subtotal })),
    ...budget.caItems.map((i) => ({ ...i, displayPrice: i.unitPrice, displaySub: i.subtotal })),
    ...budget.serviceItems.map((i) => ({ ...i, displayPrice: i.unitPrice, displaySub: i.subtotal })),
  ];

  equipDisplayRows.forEach((item, idx) => {
    if (y > 238) return; // Mantém tabela organizada na página 5
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 182, 6.8, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.1);
    doc.setTextColor(...PDF_THEME.slate900);
    doc.text(String(item.name).slice(0, 62), 17, y + 4.6);
    doc.text(`${item.quantity} ${item.unit}`, 133, y + 4.6, { align: "right" });
    doc.text(item.displayPrice === null ? "Incluso Kit" : brl(item.displayPrice), 163, y + 4.6, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(item.displaySub === null ? "—" : brl(item.displaySub), 193, y + 4.6, { align: "right" });
    y += 6.8;
  });

  // Quadro de Consolidação Orçamentária (Equipamentos + Serviços + Margem Solicitada = Final)
  y += 4;
  doc.setFillColor(...NA_TEAL_SOFT);
  doc.setDrawColor(...NA_TEAL_DARK);
  doc.setLineWidth(0.35);
  doc.rect(14, y, 182, 34, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...NA_NAVY);
  doc.text("RESUMO COMERCIAL DO ORÇAMENTO", 18, y + 6.5);

  const summaryPairs = [
    ["1. Preço dos Equipamentos (Kit Solar CC):", brl(budget.equipmentTotal)],
    ["2. Infraestrutura CA, Engenharia & Instalação:", brl(budget.caTotal + budget.servicesTotal)],
    [`3. BDI / Margem Comercial (${budget.marginPercent}%)${budget.discountBrl > 0 ? ` · Desc. ${brl(budget.discountBrl)}` : ""}:`, brl(budget.marginBrl - budget.discountBrl)],
  ];
  let sy = y + 12.5;
  summaryPairs.forEach(([label, val]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...PDF_THEME.slate700);
    doc.text(label, 18, sy);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NA_NAVY);
    doc.text(val, 192, sy, { align: "right" });
    sy += 5.4;
  });

  doc.setFillColor(...NA_NAVY);
  doc.rect(14, y + 25.5, 182, 8.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.2);
  doc.setTextColor(...NA_TEAL);
  doc.text("VALOR FINAL PROPOSTA TURNKEY:", 18, y + 31.2);
  doc.setTextColor(255, 255, 255);
  doc.text(`${brl(budget.finalTotal)} (${brl(budget.pricePerWp)}/Wp)`, 192, y + 31.2, { align: "right" });

  addProposalPageFooter(doc, 5, totalPages);

  // =========================================================================
  // PÁGINA 6: ANÁLISE FINANCEIRA DO INVESTIMENTO (PAYBACK, VPL, TIR + GRÁFICOS)
  // =========================================================================
  doc.addPage();
  addProposalPageHeader(doc, "Análise Financeira & Comparativo de Rentabilidade", projectName);

  y = 26;
  y = drawPdfSectionTitle(doc, "ANÁLISE FINANCEIRA DO INVESTIMENTO", 14, y, 182, { accentColor: NA_TEAL });

  const finCards = [
    { label: "INVESTIMENTO TURNKEY", val: brl(budget.finalTotal), sub: `${brl(budget.pricePerWp)} por Wp instalado`, dark: true },
    { label: "PAYBACK ESTIMADO", val: `${fmtNum(financial.paybackYears, 1)} anos`, sub: financial.paybackLabel },
    { label: "VPL (25 ANOS)", val: brl(financial.npvBrl), sub: "Taxa de desconto 8,5% a.a." },
    { label: "TIR DO PROJETO", val: `${fmtNum(financial.irrPct, 1)}% a.a.`, sub: "Retorno interno anualizado" },
  ];
  finCards.forEach((fc, idx) => {
    const fx = 14 + idx * 46.5;
    doc.setFillColor(...(fc.dark ? NA_NAVY : PDF_THEME.slate50));
    doc.setDrawColor(...(fc.dark ? NA_NAVY : PDF_THEME.slate200));
    doc.rect(fx, y, 42.5, 24, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(...(fc.dark ? NA_TEAL : PDF_THEME.slate500));
    doc.text(fc.label, fx + 3.5, y + 6);
    doc.setFontSize(10.5);
    doc.setTextColor(...(fc.dark ? PDF_THEME.white : NA_NAVY));
    doc.text(fc.val, fx + 3.5, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    doc.setTextColor(...(fc.dark ? [203, 213, 225] : PDF_THEME.slate500));
    doc.text(fc.sub, fx + 3.5, y + 20);
  });
  y += 30;

  // Gráfico 1: Rendimento no Primeiro Ano (%)
  y = drawVectorBarChart(doc, {
    x: 14,
    y,
    w: 182,
    h: 64,
    title: "RENDIMENTO NO PRIMEIRO ANO (% a.a.) — COMPARATIVO DE INVESTIMENTOS",
    subtitle: "Retorno percentual no Ano 1 comparando aplicações tradicionais com a usina fotovoltaica",
    labels: ["Poupança", "Renda Fixa (CDI)", "Energia Solar (Ano 1)", "TIR Projeto (25a)"],
    values: [financial.poupancaYieldPct, financial.rendaFixaYieldPct, financial.firstYearReturnPct, financial.irrPct],
    barColor: NA_BLUE,
    valueFormatter: (v) => `${fmtNum(v, 1)}%`,
  });

  y += 6;

  // Gráfico 2: Saldo da Aplicação após 25 Anos (Mil R$)
  y = drawVectorBarChart(doc, {
    x: 14,
    y,
    w: 182,
    h: 66,
    title: "SALDO DA APLICAÇÃO APÓS 25 ANOS (R$ ACUMULADOS)",
    subtitle: "Patrimônio líquido acumulado em 25 anos com reajuste médio tarifário considerado",
    labels: ["Poupança", "Renda Fixa", "Sistema Fotovoltaico (25 anos)"],
    values: [
      Math.round(financial.poupanca25Years),
      Math.round(financial.rendaFixa25Years),
      Math.round(financial.solar25YearsAccumulated),
    ],
    barColor: NA_TEAL_DARK,
    valueFormatter: (v) => `R$ ${Math.round(v / 1000)}k`,
  });

  y += 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...PDF_THEME.slate200);
  doc.rect(14, y, 182, 20, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...NA_NAVY);
  doc.text("CONCLUSÃO FINANCEIRA:", 18, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(...PDF_THEME.slate700);
  doc.text(
    doc.splitTextToSize(
      `O investimento de ${brl(budget.finalTotal)} se paga em aproximadamente ${fmtNum(financial.paybackYears, 1)} anos e gera uma economia líquida projetada de ${brl(financial.solar25YearsAccumulated)} ao longo de 25 anos.`,
      174
    ),
    18,
    y + 12.5
  );

  addProposalPageFooter(doc, 6, totalPages);

  // =========================================================================
  // PÁGINA 7: FLUXO DE CAIXA DO PROJETO (25 ANOS — ANO 0 A ANO 24)
  // =========================================================================
  doc.addPage();
  addProposalPageHeader(doc, "Fluxo de Caixa Projetado (25 Anos)", projectName);

  y = 26;
  y = drawPdfSectionTitle(doc, "FLUXO DE CAIXA DO PROJETO (25 ANOS · ANO 0 A 24)", 14, y, 182, {
    accentColor: NA_TEAL,
    rightBadge: "Degradação 0,7%/a · Inflação 5,5%/a",
  });

  const cfWidths = [16, 34, 28, 34, 34, 36];
  const cfHeaders = ["ANO", "GERAÇÃO (kWh)", "TARIFA (R$)", "ECONOMIA (R$)", "INVESTIMENTO", "SALDO ACUMULADO"];
  doc.setFillColor(...NA_NAVY);
  doc.rect(14, y, 182, 7.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.1);
  doc.setTextColor(255, 255, 255);
  let cfx = 14;
  cfHeaders.forEach((h, i) => {
    doc.text(h, i === 0 ? cfx + cfWidths[i] / 2 : cfx + cfWidths[i] - 2.5, y + 5.1, { align: i === 0 ? "center" : "right" });
    cfx += cfWidths[i];
  });
  y += 7.6;

  let highlightedPayback = false;
  financial.cashflowRows.forEach((row, rIdx) => {
    const isCrossover = !highlightedPayback && row.cumulativeBalanceBrl >= 0;
    if (isCrossover) highlightedPayback = true;

    if (isCrossover) {
      doc.setFillColor(...NA_TEAL_SOFT);
    } else {
      doc.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 255 : 250, rIdx % 2 === 0 ? 255 : 252);
    }
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 182, 6.7, "FD");

    doc.setFont("helvetica", isCrossover || row.year === 0 || row.year === 24 ? "bold" : "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...PDF_THEME.slate900);

    let rx = 14;
    doc.text(String(row.year), rx + cfWidths[0] / 2, y + 4.7, { align: "center" });
    rx += cfWidths[0];
    doc.text(Math.round(row.generationKwh).toLocaleString("pt-BR"), rx + cfWidths[1] - 2.5, y + 4.7, { align: "right" });
    rx += cfWidths[1];
    doc.text(`R$ ${fmtNum(row.tariffBrl, 2)}`, rx + cfWidths[2] - 2.5, y + 4.7, { align: "right" });
    rx += cfWidths[2];
    doc.text(brl(row.annualSavingsBrl), rx + cfWidths[3] - 2.5, y + 4.7, { align: "right" });
    rx += cfWidths[3];
    doc.text(row.investmentBrl < 0 ? brl(row.investmentBrl) : "R$ 0,00", rx + cfWidths[4] - 2.5, y + 4.7, { align: "right" });
    rx += cfWidths[4];

    if (row.cumulativeBalanceBrl < 0) {
      doc.setTextColor(190, 18, 60);
    } else {
      doc.setTextColor(...NA_TEAL_DARK);
    }
    doc.setFont("helvetica", "bold");
    doc.text(brl(row.cumulativeBalanceBrl), rx + cfWidths[5] - 2.5, y + 4.7, { align: "right" });
    y += 6.7;
  });

  y += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.1);
  doc.setTextColor(...PDF_THEME.slate500);
  doc.text(
    "* Linha destacada em ciano indica o ano em que o saldo acumulado torna-se positivo (Payback alcançado).",
    14,
    y
  );

  addProposalPageFooter(doc, 7, totalPages);

  // =========================================================================
  // PÁGINA 8: REDUÇÃO DA CONTA DE ENERGIA + FORMAS DE PAGAMENTO / FINANCIAMENTO
  // =========================================================================
  doc.addPage();
  addProposalPageHeader(doc, "Redução da Conta & Condições Comerciais", projectName);

  y = 26;
  y = drawPdfSectionTitle(doc, "REDUÇÃO DA CONTA DE ENERGIA MENSAL ESTIMADA", 14, y, 182, { accentColor: NA_TEAL });

  const billCols = [
    { label: "CONTA ATUAL (SEM SOLAR)", val: brl(financial.beforeBillMonthlyBrl), sub: "Estimativa média mensal", bg: [248, 250, 252], color: PDF_THEME.slate900 },
    { label: "ECONOMIA MENSAL ESTIMADA", val: brl(financial.monthlySavingsBrl), sub: `Redução aproximada de ${fmtNum(financial.reductionPct, 0)}%`, bg: NA_TEAL_SOFT, color: NA_TEAL_DARK },
    { label: "CONTA APÓS O SOLAR", val: brl(financial.afterBillMonthlyBrl), sub: "Taxa mínima + iluminação pública", bg: NA_NAVY, color: NA_TEAL, lightText: true },
  ];
  billCols.forEach((bc, idx) => {
    const bx = 14 + idx * 62;
    doc.setFillColor(...bc.bg);
    doc.setDrawColor(...(bc.lightText ? NA_NAVY : PDF_THEME.slate200));
    doc.rect(bx, y, 58, 26, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(...(bc.lightText ? [203, 213, 225] : PDF_THEME.slate500));
    doc.text(bc.label, bx + 29, y + 6.5, { align: "center" });
    doc.setFontSize(12.5);
    doc.setTextColor(...bc.color);
    doc.text(bc.val, bx + 29, y + 15.2, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...(bc.lightText ? [180, 200, 220] : PDF_THEME.slate500));
    doc.text(bc.sub, bx + 29, y + 21.5, { align: "center" });
  });
  y += 33;

  y = drawVectorBarChart(doc, {
    x: 14,
    y,
    w: 182,
    h: 58,
    title: "COMPARATIVO DA FATURA MENSAL (R$/MÊS)",
    subtitle: "Impacto direto no orçamento mensal após ativação do sistema fotovoltaico",
    labels: ["Fatura Antes", "Economia Mensal", "Fatura Após Solar"],
    values: [financial.beforeBillMonthlyBrl, financial.monthlySavingsBrl, financial.afterBillMonthlyBrl],
    barColor: NA_TEAL_DARK,
    valueFormatter: (v) => brl(v),
  });

  y += 7;
  y = drawPdfSectionTitle(doc, "CONDIÇÕES COMERCIAIS & FORMAS DE PAGAMENTO", 14, y, 182, { accentColor: NA_BLUE });

  // Destaque À Vista
  doc.setFillColor(...NA_NAVY);
  doc.rect(14, y, 182, 18, "F");
  doc.setFillColor(...NA_TEAL);
  doc.rect(14, y, 3, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text("PAGAMENTO À VISTA (PIX / TED / BOLETO)", 21, y + 8);
  doc.setFontSize(7.6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...NA_TEAL);
  doc.text(`Sistema completo ${fmtNum(budget.dcPowerKw, 2)} kWp com garantia turnkey`, 21, y + 13.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(brl(budget.finalTotal), 191, y + 11.2, { align: "right" });
  y += 23;

  // Tabela de Financiamento Simulado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...NA_NAVY);
  doc.text("SIMULAÇÃO DE FINANCIAMENTO BANCÁRIO (ENTRADA R$ 0,00 · TAXA REF. 1,49% a.m.)", 14, y);
  y += 3;

  const finWidths = [32, 34, 34, 42, 40];
  const finHeaders = ["OPÇÃO", "ENTRADA", "PRAZO", "PARCELA MENSAL", "TAXA REF."];
  doc.setFillColor(...NA_BLUE);
  doc.rect(14, y, 182, 7.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  let fx = 14;
  finHeaders.forEach((h, i) => {
    doc.text(h, fx + finWidths[i] / 2, y + 5, { align: "center" });
    fx += finWidths[i];
  });
  y += 7.5;

  financial.financingOptions.forEach((opt, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(...PDF_THEME.slate200);
    doc.rect(14, y, 182, 9, "FD");
    let px = 14;
    const cells = [
      opt.optionLabel,
      "R$ 0,00",
      `${opt.months} parcelas`,
      `${brl(opt.installmentBrl)}/mês`,
      `${fmtNum(opt.monthlyRatePct, 2)}% a.m.`,
    ];
    cells.forEach((val, ci) => {
      doc.setFont("helvetica", ci === 3 ? "bold" : "normal");
      doc.setFontSize(8);
      doc.setTextColor(...(ci === 3 ? NA_TEAL_DARK : PDF_THEME.slate900));
      doc.text(val, px + finWidths[ci] / 2, y + 5.8, { align: "center" });
      px += finWidths[ci];
    });
    y += 9;
  });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.slate500);
  doc.text("* Valores de financiamento estimados, sujeitos à análise e aprovação de crédito pela instituição financeira.", 14, y + 6);

  addProposalPageFooter(doc, 8, totalPages);

  // =========================================================================
  // PÁGINA 9: ACEITE DA PROPOSTA, ASSINATURAS & CONTATO OFICIAL NACIF ENERGY
  // =========================================================================
  doc.addPage();
  addProposalPageHeader(doc, "Aceite Formal da Proposta & Contato", projectName);

  y = 28;
  y = drawPdfSectionTitle(doc, "ACEITE DA PROPOSTA COMERCIAL", 14, y, 182, { accentColor: NA_TEAL });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.8);
  doc.setTextColor(...PDF_THEME.slate700);
  doc.text(
    doc.splitTextToSize(
      `Eu, ${clientName}, declaro estar ciente e de acordo com as especificações técnicas, escopo de fornecimento e condições comerciais descritas nesta proposta para o projeto "${projectName}", selecionando a forma de pagamento abaixo:`,
      182
    ),
    14,
    y + 2
  );
  y += 16;

  // Checkboxes da forma de pagamento selecionada
  const payChoices = [
    { key: "cash", label: `À Vista (Pix / TED / Boleto) — ${brl(budget.finalTotal)}` },
    ...financial.financingOptions.map((opt) => ({
      key: `${opt.months}x`,
      label: `${opt.optionLabel} — Financiamento em ${opt.months}x de ${brl(opt.installmentBrl)}/mês`,
    })),
  ];

  payChoices.forEach((choice) => {
    const selected = budget.selectedPaymentOption === choice.key;
    doc.setFillColor(...(selected ? NA_TEAL_SOFT : PDF_THEME.slate50));
    doc.setDrawColor(...(selected ? NA_TEAL_DARK : PDF_THEME.slate200));
    doc.rect(14, y, 182, 10.5, "FD");
    // Quadrado checkbox
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...NA_NAVY);
    doc.rect(18, y + 2.8, 4.8, 4.8, "FD");
    if (selected) {
      doc.setFillColor(...NA_TEAL_DARK);
      doc.rect(19, y + 3.8, 2.8, 2.8, "F");
    }
    doc.setFont("helvetica", selected ? "bold" : "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(...NA_NAVY);
    doc.text(choice.label, 26.5, y + 6.7);
    y += 12.2;
  });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...NA_NAVY);
  doc.text(`Data de Emissão: ${todayStr}     ·     Validade da Proposta: ${validDate} (${budget.validityDays} dias)`, 14, y);
  y += 18;

  // Área de Assinaturas
  doc.setDrawColor(...NA_NAVY);
  doc.setLineWidth(0.45);
  doc.line(14, y + 18, 96, y + 18);
  doc.line(114, y + 18, 196, y + 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...NA_NAVY);
  doc.text(clientName.slice(0, 38), 55, y + 23.5, { align: "center" });
  doc.text(budget.commercialContact.responsibleName.slice(0, 38), 155, y + 23.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...PDF_THEME.slate500);
  doc.text("Contratante / Aceite do Cliente", 55, y + 28, { align: "center" });
  doc.text("NACIF ENERGY · Responsável Comercial / Técnico", 155, y + 28, { align: "center" });

  // Bloco final de Contato & Endereço com Logotipo Original Darkmode
  const boxY = 226;
  doc.setFillColor(...NA_NAVY);
  doc.rect(14, boxY, 182, 48, "F");
  doc.setFillColor(...NA_TEAL);
  doc.rect(14, boxY, 182, 1.8, "F");

  try {
    doc.addImage(NACIF_LOGO_DARK_BASE64, "PNG", 20, boxY + 9, 52, 16, undefined, "FAST");
  } catch {
    try {
      doc.addImage(NACIF_SYMBOL_BASE64, "PNG", 20, boxY + 9, 16, 15, undefined, "FAST");
    } catch {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...NA_TEAL);
  doc.text("DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR", 20, boxY + 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(255, 255, 255);
  doc.text("CONTATO & ATENDIMENTO", 96, boxY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(`Consultor: ${budget.commercialContact.responsibleName}`, 96, boxY + 18.5);
  doc.text(`Telefone / WhatsApp: ${budget.commercialContact.phone}`, 96, boxY + 24.5);
  doc.text(`E-mail: ${budget.commercialContact.email}`, 96, boxY + 30.5);
  doc.text(`Endereço: ${budget.commercialContact.address}`, 96, boxY + 36.5);

  addProposalPageFooter(doc, 9, totalPages);

  return doc;
}
