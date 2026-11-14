import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import {
  drawElectricalUnifilarVector,
  drawSolarUnifilarVector,
  drawInteractiveNodesUnifilarPdf,
  drawPdfKpiStrip,
  drawPdfSectionTitle,
  drawVectorBarChart,
} from "../src/lib/unifilarPdfDrawer.js";
import {
  generateSitePlanReport,
  generateElectricalDiagramReport,
  generateTechnicalMemorialReport,
  generateBillOfMaterialsReport,
  generateGenerationSimulationReport,
  generateCommercialProposalReport,
  generateExecutiveSolarPdf,
} from "../src/lib/solarReportGenerator.js";
import { buildBudgetPDFDoc } from "../src/lib/budgetExportUtils.js";
import { buildProfessionalElectricalSheetDoc } from "../src/lib/professionalElectricalSheet.js";
import { calcProjectMetrics } from "../src/lib/electricalEngine.js";

const mockProject = {
  id: "proj-pdf-01",
  name: "Residência Alto Padrão Nacif",
  client_name: "Carlos Eduardo Silva",
  address: "Rua das Palmeiras, 420 — Jardins, São Paulo/SP",
  city: "São Paulo",
  state: "SP",
  supply_type: "Trifásico",
  voltage: 220,
  area_m2: 310,
  circuits: [
    { name: "Iluminação Social", type: "Iluminação", supply_type: "Monofásico", voltage: 127, phase: "A", power_w: 1200, breaker_a: 10, breaker_poles: 1, breaker_curve: "B", wire_gauge: "1.5mm²", needs_dr: true },
    { name: "TUGs Sala e Quartos", type: "TUG", supply_type: "Monofásico", voltage: 127, phase: "B", power_w: 2200, breaker_a: 16, breaker_poles: 1, breaker_curve: "C", wire_gauge: "2.5mm²", needs_dr: true },
    { name: "Chuveiro Suíte Master", type: "TUE", supply_type: "Bifásico", voltage: 220, phase: "AB", power_w: 6800, breaker_a: 40, breaker_poles: 2, breaker_curve: "C", wire_gauge: "6mm²", needs_dr: true },
    { name: "Ar-Condicionado Central", type: "HVAC", supply_type: "Trifásico", voltage: 220, phase: "ABC", power_w: 9200, breaker_a: 32, breaker_poles: 3, breaker_curve: "C", wire_gauge: "6mm²", needs_dr: false },
  ],
};

const mockConfig = {
  inverter_power_kw: 8,
  panel_wattage: 550,
  ac_supply_type: "Trifásico",
  ac_voltage: 220,
  ac_breaker_a: 32,
  ac_cable_gauge: "6mm²",
  roof_area_m2: 110,
  roof_pitch_deg: 18,
  roof_azimuth_deg: 0,
};

const mockSizing = {
  panelCount: 16,
  dcPowerKw: 8.8,
  inverterKw: 8,
  estimatedAnnualKwh: 12600,
  estimatedAnnualSavings: 11850,
  investmentEstimate: 34500,
  paybackYears: 2.9,
  usableRoofAreaM2: 72,
};

// 1. Test vector drawing primitives directly on jsPDF
{
  const doc = new jsPDF("p", "mm", "a4");
  const metrics = calcProjectMetrics(mockProject);
  let y = drawPdfKpiStrip(doc, [
    { label: "POTÊNCIA", value: "19,40 kW", sub: "4 circuitos", highlight: true },
    { label: "GERAL", value: "63 A", sub: "Trifásico 220V" },
  ], 14, 24, 182, 20);
  assert.ok(y > 40);

  y = drawPdfSectionTitle(doc, "Diagrama Unifilar Elétrico", 14, y + 4, 182, { rightBadge: "NBR 5410" });
  const endY = drawElectricalUnifilarVector(doc, mockProject, metrics, { x: 14, y, w: 182, h: 120 });
  assert.ok(endY > y + 100);

  const solarEndY = drawSolarUnifilarVector(doc, { ...mockSizing, inverterKw: 8, acVoltage: 220, isTri: true, supplyType: "Trifásico", breaker: 32, acCurrent: 21.8, cableGauge: "6mm²", moduleWp: 550 }, { x: 14, y: 180, w: 182, h: 95 });
  assert.ok(solarEndY > 260);

  const barEndY = drawVectorBarChart(doc, {
    x: 14,
    y: 20,
    w: 182,
    h: 50,
    title: "Teste Barra",
    labels: ["A", "B", "C"],
    values: [10, 20, 15],
  });
  assert.ok(barEndY >= 70);
}

// 2. Test interactive node A3 vector unifilar export
{
  const interactiveDoc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  drawInteractiveNodesUnifilarPdf(interactiveDoc, {
    project: mockProject,
    metrics: calcProjectMetrics(mockProject),
    nodes: [
      { id: "n1", label: "Medidor Concessionária", type: "meter", subtext: "Tri 220V", circuitCount: 4, x: 80, y: 120 },
      { id: "n2", label: "QGBT Principal", type: "panel", subtext: "DJ 63A 3P", circuitCount: 4, x: 420, y: 120 },
      { id: "n3", label: "Chuveiro Suíte", type: "circuit", subtext: "6.8kW · 40A", x: 760, y: 120, phase: "AB" },
    ],
    connections: [{ from: "n1", to: "n2" }, { from: "n2", to: "n3" }],
  });
  assert.equal(interactiveDoc.getNumberOfPages(), 1);
  assert.ok(interactiveDoc.output("arraybuffer").byteLength > 2000);
}

// 3. Test all 7 Solar PDFs
{
  const r1 = await generateSitePlanReport(mockProject, mockConfig, mockSizing);
  const r2 = await generateElectricalDiagramReport(mockProject, mockConfig, mockSizing);
  const r3 = await generateTechnicalMemorialReport(mockProject, mockConfig, mockSizing);
  const r4 = await generateBillOfMaterialsReport(mockProject, mockConfig, mockSizing);
  const r5 = await generateGenerationSimulationReport(mockProject, mockConfig, mockSizing);
  const r6 = await generateCommercialProposalReport(mockProject, mockConfig, mockSizing);
  const r7 = await generateExecutiveSolarPdf(mockProject, mockConfig, mockSizing);

  assert.equal(r1.getNumberOfPages(), 2, "Site Plan report must stay 2 pages");
  assert.ok(r2.getNumberOfPages() >= 1, "Electrical Diagram report generated");
  assert.ok(r3.getNumberOfPages() >= 2, "Technical Memorial report generated");
  assert.ok(r4.getNumberOfPages() >= 1, "BOM report generated");
  assert.ok(r5.getNumberOfPages() >= 1, "Generation Simulation report generated");
  assert.ok(r6.getNumberOfPages() >= 1, "Commercial Proposal report generated");
  assert.equal(r7.getNumberOfPages(), 3, "Executive Solar PDF now has 3 pages (Cover/Strings + Unifilar/Chart + BOM/ROI)");

  // Confirm embedded Solar Unifilar diagram output is valid non-trivial PDF
  assert.ok(r2.output("arraybuffer").byteLength > 3000, "Electrical Diagram PDF has vector content");
}

// 4. Test Professional A0 Electrical Sheet doc builder
{
  const metrics = calcProjectMetrics(mockProject);
  const a0Doc = buildProfessionalElectricalSheetDoc(mockProject, metrics);
  assert.ok(a0Doc);
  assert.equal(a0Doc.getNumberOfPages(), 1);
  assert.ok(a0Doc.output("arraybuffer").byteLength > 3000);
}

// 5. Test Budget PDF generation
{
  const { doc: budgetDoc, fileName } = buildBudgetPDFDoc({
    project: mockProject,
    budgetName: "Orçamento Residencial Alto Padrão com Descrição Extensa Para Validar Quebra De Linha Automática",
    materials: [
      { name: "Cabo Flexível 6,0mm² EPR/XLPE Isolação 1kV Anti-chama Preto (Rolo 100m)", category: "Cabos", qty: 2, unit: "rl", price: 680 },
      { name: "Disjuntor Tripolar 63A Curva C 10kA IEC 60898 Linha Industrial", category: "Proteção", qty: 1, unit: "un", price: 145.5 },
    ],
    services: [
      { name: "Montagem completa de quadro geral de distribuição trifásico com barramento pente e identificação", category: "Instalação", qty: 1, unit: "vb", price: 1850 },
    ],
    totals: { materialTotal: 1505.5, servicesTotal: 1850, total: 3355.5 },
  });
  assert.ok(fileName.endsWith(".pdf"));
  assert.ok(budgetDoc.getNumberOfPages() >= 1);
  assert.ok(budgetDoc.output("arraybuffer").byteLength > 2000);
}

console.log("PDF Unifilar & Visual Smoke Test passed successfully!");
