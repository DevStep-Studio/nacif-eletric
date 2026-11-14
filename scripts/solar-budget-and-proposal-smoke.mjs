import assert from "node:assert/strict";
import fs from "node:fs";
import { buildDetailedSolarBudget } from "../src/lib/solarBudgetMath.js";
import { buildProjectBudgetMaterials } from "../src/lib/projectBudgetMaterials.js";
import { generateCommercialProposalReport } from "../src/lib/solarReportGenerator.js";
import {
  NACIF_LOGO_DARK_BASE64,
  NACIF_LOGO_PRINCIPAL_BASE64,
  NACIF_SYMBOL_BASE64,
} from "../src/lib/solarLogoAsset.js";

console.log("🧪 Testando Orçamento Solar Detalhado + Proposta Comercial 9 Páginas NACIF Energy...\n");

// 1. Verificar integridade das logos originais embutidas
assert(NACIF_SYMBOL_BASE64.startsWith("data:image/png;base64,"), "Símbolo original deve ser PNG base64 válido");
assert(NACIF_LOGO_PRINCIPAL_BASE64.startsWith("data:image/png;base64,"), "Logo principal original deve ser PNG base64 válido");
assert(NACIF_LOGO_DARK_BASE64.startsWith("data:image/png;base64,"), "Logo darkmode original deve ser PNG base64 válido");

const sampleProject = {
  id: "proj_solar_prop_01",
  name: "Usina Solar Residencial Nacif",
  project_type: "Solar",
  client_name: "Jefferson Niterói",
  address: "Av. Quintino Bocaiúva, 150",
  neighborhood: "São Francisco",
  city: "Niterói",
  state: "RJ",
  system_mode: "hibrido",
  has_battery: true,
  battery_config: { capacity_kwh: 10 },
  supply_type: "Bifásico",
  voltage: 220,
  consumption: {
    monthly_consumption_kwh: 1200,
    tariff_brl_kwh: 1.05,
    distributor: "Enel RJ",
  },
};

const sampleConfig = {
  module_wp: 550,
  inverter_kw: 8,
  inverter_quantity: 1,
  ac_supply_type: "Bifásico",
  ac_voltage: 220,
  solar_budget: {
    useKitTotalOverride: true,
    kitTotalOverride: 24800,
    marginPercent: 25,
    discountBrl: 500,
    validityDays: 15,
    selectedPaymentOption: "48x",
  },
};

const sampleSizing = {
  panelCount: 20,
  dcPowerKw: 11.0,
  usableArea: 52.0,
  annualGenerationKwh: 15840,
  annualSavingsBrl: 16632,
  acCurrent: 39.5,
  breaker: 40,
};

// 2. Testar motor de Orçamento Solar Detalhado
const detailed = buildDetailedSolarBudget({
  project: sampleProject,
  config: sampleConfig,
  sizing: sampleSizing,
});

assert.equal(detailed.equipmentTotal, 24800, "Kit override deve refletir o preço informado do equipamento");
assert.equal(detailed.marginPercent, 25, "Margem solicitada deve ser 25%");
assert(detailed.baseCostTotal > 24800, "Custo base deve somar kit + CA + serviços");
const expectedGross = Math.round((detailed.baseCostTotal * 1.25 + Number.EPSILON) * 100) / 100;
assert.equal(detailed.grossTotal, expectedGross, "Subtotal com margem de 25% deve bater com precisão");
assert.equal(detailed.finalTotal, Math.round((expectedGross - 500 + Number.EPSILON) * 100) / 100, "Desconto deve abater do total");
assert.equal(detailed.financial.cashflowRows.length, 25, "Fluxo de caixa deve conter 25 linhas (Ano 0 a 24)");
assert.equal(detailed.financial.financingOptions.length, 4, "Simulação deve conter 4 prazos (24x, 36x, 48x, 60x)");
assert(detailed.financial.irrPct > 15, `TIR deve ser atrativa (>15%), obteve ${detailed.financial.irrPct}%`);
assert(detailed.financial.npvBrl > 0, "VPL em 25 anos deve ser positivo");
console.log(`   ✓ Orçamento: Equipamento R$ ${detailed.equipmentTotal.toFixed(2)} | Margem 25% = +R$ ${detailed.marginBrl.toFixed(2)} | Total = R$ ${detailed.finalTotal.toFixed(2)}`);

// 3. Testar integração no gerador de materiais de Budget.jsx
const solarBudgetMaterials = buildProjectBudgetMaterials({
  ...sampleProject,
  solar_config: sampleConfig,
  solar_sizing: sampleSizing,
});
assert.equal(solarBudgetMaterials.budgetScope, "solar", "Projeto Solar deve resolver budgetScope='solar'");
assert(solarBudgetMaterials.materials.length >= 9, "Lista de materiais do módulo Orçamentos deve incluir itens CC e CA");
console.log(`   ✓ Integração Módulo Orçamentos: ${solarBudgetMaterials.materials.length} materiais carregados com preços.`);

// 4. Testar Proposta Comercial Completa de 9 páginas
const proposalDoc = generateCommercialProposalReport(sampleProject, sampleConfig, sampleSizing);
assert.equal(proposalDoc.getNumberOfPages(), 9, "Proposta Comercial deve ter exatamente 9 páginas");
const outPdf = proposalDoc.output();
assert(outPdf.includes("NACIF ENERGY"), "PDF deve conter marca NACIF ENERGY");
assert(outPdf.includes("DA PLANTA AO SOL"), "PDF deve conter slogan oficial");
assert(outPdf.includes("PROPOSTA"), "PDF deve conter título PROPOSTA");
assert(outPdf.includes("FLUXO DE CAIXA DO PROJETO"), "Página 7 deve conter Fluxo de Caixa");
assert(outPdf.includes("CONDIC") || outPdf.includes("FORMAS DE PAGAMENTO"), "Página 8 deve conter Condições Comerciais");
assert(outPdf.includes("ACEITE DA PROPOSTA"), "Página 9 deve conter Aceite da Proposta");

// 5. Garantir zero gradientes CSS no componente novo
const panelSource = fs.readFileSync(new URL("../src/components/solar/SolarBudgetPanel.jsx", import.meta.url), "utf8");
assert(!/bg-gradient|linear-gradient|radial-gradient/i.test(panelSource), "SolarBudgetPanel.jsx não pode usar gradientes CSS");
console.log("   ✓ Proposta Comercial 9 páginas validada e visual minimalista sem gradiente confirmado.");
console.log("\n✅ Todos os testes do Orçamento Solar e Proposta 9 Páginas passaram!\n");
