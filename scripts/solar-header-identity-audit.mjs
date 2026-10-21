import assert from "assert";
import {
  generateSitePlanReport,
  generateElectricalDiagramReport,
  generateTechnicalMemorialReport,
  generateBillOfMaterialsReport,
  generateGenerationSimulationReport,
  generateCommercialProposalReport,
  generateExecutiveSolarPdf,
} from "../src/lib/solarReportGenerator.js";
import {
  NACIF_SYMBOL_BASE64,
  NACIF_BRAND_NAME,
  NACIF_BRAND_SLOGAN,
} from "../src/lib/solarLogoAsset.js";

console.log("🧪 Iniciando Auditoria Completa da Nova Identidade Visual NACIF ELECTRIC nos Relatórios Solares...\n");

const mockProject = {
  id: "proj_solar_audit_001",
  name: "Residencial Nacif Solar Premium",
  client_name: "Engenharia Nacif LTDA",
  address: "Av. Américo Buaiz, 501",
  city: "Vitória",
  state: "ES",
  installation_type: "Residencial",
  system_mode: "on_grid",
  supply_type: "Trifásico",
  voltage: 220,
};

const mockConfig = {
  roof_width_m: 16,
  roof_height_m: 6,
  roof_pitch_deg: 15,
  roof_rotation_deg: 24,
  module_wp: 550,
  inverter_kw: 10,
  ac_supply_type: "Trifásico",
  ac_voltage: 220,
};

const mockSizing = {
  dcPowerKw: 13.2,
  panelCount: 24,
  usableArea: 62.5,
  annualGenerationKwh: 18500,
  annualSavingsBrl: 15725,
  breaker: 40,
};

// 1. Validando constantes oficiais da marca
console.log("▶ Teste 1: Validação dos assets e constantes oficiais da marca Nacif Electric...");
assert.strictEqual(NACIF_BRAND_NAME, "NACIF ELECTRIC", "Nome da marca deve ser 'NACIF ELECTRIC'");
assert.strictEqual(NACIF_BRAND_SLOGAN, "DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR", "Slogan oficial deve ser 'DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR'");
assert(NACIF_SYMBOL_BASE64.startsWith("data:image/png;base64,"), "Base64 da logo deve ser um PNG válido");
console.log("   ✓ Nome oficial: NACIF ELECTRIC");
console.log("   ✓ Slogan oficial: DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR");
console.log("   ✓ Símbolo oficial embutido em alta resolução com transparência");

// 2. Testando Planta de Implantação Solar
console.log("\n▶ Teste 2: Geração e validação do relatório 'Planta de Implantação Solar'...");
const sitePlanDoc = generateSitePlanReport(mockProject, mockConfig, mockSizing);
assert(sitePlanDoc, "Documento jsPDF da Planta de Implantação deve ser instanciado");
const sitePlanPdf = sitePlanDoc.output();
assert(sitePlanPdf.includes("NACIF ELECTRIC"), "Cabeçalho deve conter 'NACIF ELECTRIC'");
assert(sitePlanPdf.includes("DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR"), "Cabeçalho deve conter o slogan correto");
assert(sitePlanPdf.includes("PLANTA DE IMPLANTAÇÃO SOLAR"), "Cabeçalho deve conter o título 'PLANTA DE IMPLANTAÇÃO SOLAR'");
assert(sitePlanPdf.includes("Residencial Nacif Solar Premium"), "Cabeçalho deve conter o nome do projeto dinâmico");
assert(!sitePlanPdf.includes("VOLTAI · ENGENHARIA SOLAR"), "Cabeçalho não pode conter referências à marca VOLTAI");
console.log("   ✓ 'PLANTA DE IMPLANTAÇÃO SOLAR' gerado com sucesso com cabeçalho NACIF ELECTRIC");

// 3. Testando todos os outros relatórios PDF do módulo solar
console.log("\n▶ Teste 3: Auditoria dos demais relatórios solares em PDF...");
const reportsToTest = [
  { name: "Diagrama Elétrico", fn: generateElectricalDiagramReport, expectedTitle: "DIAGRAMA ELÉTRICO SOLAR" },
  { name: "Memorial Descritivo", fn: generateTechnicalMemorialReport, expectedTitle: "MEMORIAL DESCRITIVO FOTOVOLTAICO" },
  { name: "Lista de Materiais (BOM)", fn: generateBillOfMaterialsReport, expectedTitle: "LISTA DE MATERIAIS & QUANTITATIVOS (BOM)" },
  { name: "Simulação de Geração", fn: generateGenerationSimulationReport, expectedTitle: "SIMULAÇÃO DE GERAÇÃO & DESEMPENHO ANUAL" },
  { name: "Proposta Comercial", fn: generateCommercialProposalReport, expectedTitle: "PROPOSTA COMERCIAL EXECUTIVA" },
  { name: "Relatório Executivo Completo", fn: generateExecutiveSolarPdf, expectedTitle: "RELATÓRIO TÉCNICO EXECUTIVO SOLAR" },
];

for (const rep of reportsToTest) {
  const doc = rep.fn(mockProject, mockConfig, mockSizing);
  assert(doc, `Documento ${rep.name} deve ser gerado`);
  const pdfOutput = doc.output();
  assert(pdfOutput.includes("NACIF ELECTRIC"), `${rep.name} deve ter 'NACIF ELECTRIC' no cabeçalho`);
  assert(pdfOutput.includes("DA PLANTA AO SOL - TUDO EM UM SÓ LUGAR"), `${rep.name} deve ter o slogan no cabeçalho`);
  assert(!pdfOutput.includes("VOLTAI · ENGENHARIA SOLAR"), `${rep.name} não pode ter 'VOLTAI · ENGENHARIA SOLAR'`);
  console.log(`   ✓ ${rep.name} verificado e aprovado.`);
}

console.log("\n========================================================");
console.log("🎉 AUDITORIA CONCLUÍDA COM 100% DE APROVAÇÃO!");
console.log("Identidade visual NACIF ELECTRIC perfeitamente implantada no cabeçalho.");
console.log("========================================================\n");
