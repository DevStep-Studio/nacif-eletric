import assert from "assert";
import {
  generateSitePlanReport,
} from "../src/lib/solarReportGenerator.js";
import {
  extractSolarProjectGeometry,
  generateRoofLayoutImage,
  generateStringLayoutImage,
  resolveSolarReportImages,
  STRING_PALETTE,
} from "../src/lib/solarLayoutImageRenderer.js";

console.log("🧪 Iniciando Teste de Validação: Imagens de Layout e Arranjo de Strings no Relatório Solar | NACIF ELECTRIC\n");

// 1. Projeto mock realista com geometria e strings calculadas
const mockProject = {
  id: "proj_solar_nacif_layout_01",
  name: "Usina Solar Residencial Alphaville",
  client_name: "Dr. Carlos Eduardo Nacif",
  address: "Alameda dos Jacarandás, 1420",
  city: "Campinas",
  state: "SP",
  installation_type: "Residencial",
  system_mode: "on_grid",
  supply_type: "Bifásico",
  voltage: 220,
};

const mockConfig = {
  roof_width_m: 14.5,
  roof_height_m: 5.2,
  roof_pitch_deg: 18,
  roof_rotation_deg: 32,
  module_wp: 550,
  inverter_kw: 6,
  module_orientation: "vertical",
  obstacles: [],
};

const mockSizing = {
  panelCount: 22,
  dcPowerKw: 12.1,
  usableArea: 54.2,
  annualGenerationKwh: 16800,
  annualSavingsBrl: 14280,
  breaker: 32,
  strings: [
    {
      stringName: "String 01",
      startModule: 1,
      endModule: 11,
      modulesCount: 11,
      powerKw: "6.05",
      vocV: "547.8",
      vmpV: "456.5",
      impA: "13.25",
      mppt: "MPPT 1",
    },
    {
      stringName: "String 02",
      startModule: 12,
      endModule: 22,
      modulesCount: 11,
      powerKw: "6.05",
      vocV: "547.8",
      vmpV: "456.5",
      impA: "13.25",
      mppt: "MPPT 2",
    },
  ],
};

// =========================================================================
// TESTE 1: Extração e consistência da geometria solar fotovoltaica
// =========================================================================
console.log("▶ Teste 1: Extração e consistência da geometria e strings...");
const geo = extractSolarProjectGeometry(mockProject, mockConfig, mockSizing);
assert(geo, "Geometria deve ser extraída com sucesso");
assert(Array.isArray(geo.areas) && geo.areas.length > 0, "Deve conter ao menos uma área computada");
assert(geo.totalPanels > 0, "Deve conter painéis solares");
assert.strictEqual(geo.totalPanels, 22, "Deve refletir os 22 módulos do projeto");
assert.strictEqual(geo.moduleWp, 550, "Módulos de 550 Wp");
assert.strictEqual(geo.inverterKw, 6, "Inversor de 6 kW");
assert(STRING_PALETTE.length >= 6, "Paleta oficial de cores de strings deve conter ao menos 6 variações distintas");
console.log(`   ✓ Geometria validada: ${geo.totalPanels} módulos, ${geo.areas.length} área(s), azimute ${geo.azimuth.formatted}`);

// =========================================================================
// TESTE 2: Resolução e geração autônoma de imagens técnicas (DataURLs PNG)
// =========================================================================
console.log("\n▶ Teste 2: Geração das imagens de Layout do Telhado e Arranjo de Strings...");
const reportImages = resolveSolarReportImages({ project: mockProject, config: mockConfig, sizing: mockSizing });
assert(reportImages.layoutImage, "Imagem de layout dos módulos deve ser gerada");
assert(reportImages.layoutImage.startsWith("data:image/png;base64,"), "layoutImage deve ser um DataURL PNG válido");
assert(reportImages.stringsImage, "Imagem de arranjo de strings deve ser gerada");
assert(reportImages.stringsImage.startsWith("data:image/png;base64,"), "stringsImage deve ser um DataURL PNG válido");
console.log(`   ✓ Imagem 1 (Layout Telhado): ${reportImages.layoutImage.length} bytes base64`);
console.log(`   ✓ Imagem 2 (Arranjo Strings): ${reportImages.stringsImage.length} bytes base64`);

// =========================================================================
// TESTE 3: Priorização de imagens customizadas se fornecidas no projeto
// =========================================================================
console.log("\n▶ Teste 3: Priorização de imagens customizadas pré-cadastradas...");
const customProject = {
  ...mockProject,
  layout_image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
};
const customResolved = resolveSolarReportImages({ project: customProject, config: mockConfig, sizing: mockSizing });
assert.strictEqual(customResolved.layoutImage, customProject.layout_image, "Deve honrar a imagem customizada pré-existente");
assert(customResolved.stringsImage.startsWith("data:image/png;base64,"), "Deve gerar autonomamente a imagem de strings ausente");
console.log("   ✓ Priorização e fallback transparente validados");

// =========================================================================
// TESTE 4: Estrutura multipáginas da 'Planta de Implantação Solar' em PDF
// =========================================================================
console.log("\n▶ Teste 4: Geração e inspeção da 'Planta de Implantação Solar' com 2 páginas...");
const doc = generateSitePlanReport(mockProject, mockConfig, mockSizing);
assert(doc, "Documento jsPDF da Planta de Implantação deve ser gerado");
assert.strictEqual(doc.getNumberOfPages(), 2, "A Planta de Implantação deve possuir exatamente 2 páginas estruturadas");

const pdfContent = doc.output();
// Validações da Página 1
assert(pdfContent.includes("PLANTA DE IMPLANTAÇÃO SOLAR"), "Página 1 deve conter título oficial");
assert(pdfContent.includes("1. Dados Gerais da Instalação"), "Página 1 deve conter Dados Gerais");
assert(pdfContent.includes("2. Layout e Arranjo Físico no Telhado"), "Página 1 deve conter Seção 2");
assert(pdfContent.includes("2.1 Layout dos módulos no telhado"), "Página 1 deve conter Subtítulo 2.1");
assert(pdfContent.includes("Especificações Técnicas de Montagem Física"), "Página 1 deve conter especificações de montagem");
assert(pdfContent.includes("Página 1 de 2"), "Rodapé da Página 1 deve indicar 'Página 1 de 2'");

// Validações da Página 2
assert(pdfContent.includes("2.2 Arranjo de strings / circuito solar"), "Página 2 deve conter Subtítulo 2.2");
assert(pdfContent.includes("2.3 Quadro de Divisão das Strings e Conexão ao Inversor"), "Página 2 deve conter Tabela Técnica de Strings");
assert(pdfContent.includes("2.4 Conformidade Normativa e Requisitos de Instalação CC"), "Página 2 deve conter conformidade NBR 16690");
assert(pdfContent.includes("Página 2 de 2"), "Rodapé da Página 2 deve indicar 'Página 2 de 2'");
console.log("   ✓ Página 1: Layout dos Módulos no Telhado + Dados + Especificações de Montagem");
console.log("   ✓ Página 2: Arranjo de Strings / Circuito Solar + Tabela MPPT + Normas NBR 16690/5410");
console.log("   ✓ Paginação: 'Página 1 de 2' e 'Página 2 de 2'");

// =========================================================================
// TESTE 5: Suporte a Imagens Extras Complementares (Página 3)
// =========================================================================
console.log("\n▶ Teste 5: Suporte a fotos e vistas complementares extras...");
const projectWithExtras = {
  ...mockProject,
  extra_images: [
    {
      title: "Foto Aérea do Telhado - Drone",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    },
  ],
};
const docWithExtras = generateSitePlanReport(projectWithExtras, mockConfig, mockSizing);
assert.strictEqual(docWithExtras.getNumberOfPages(), 3, "Com imagem extra, relatório deve expandir para 3 páginas");
const pdfWithExtrasContent = docWithExtras.output();
assert(pdfWithExtrasContent.includes("3. Vistas Complementares e Registros Técnicos"), "Página 3 deve listar vistas complementares");
assert(pdfWithExtrasContent.includes("Foto Aérea do Telhado - Drone"), "Página 3 deve exibir título da foto extra");
assert(pdfWithExtrasContent.includes("Página 1 de 3"), "Página 1 deve indicar 'Página 1 de 3'");
assert(pdfWithExtrasContent.includes("Página 3 de 3"), "Página 3 deve indicar 'Página 3 de 3'");
console.log("   ✓ Expansão dinâmica para 3 páginas com renumeração global de rodapé concluída");

console.log("\n========================================================");
console.log("🎉 TODOS OS TESTES DE LAYOUT E STRINGS FORAM APROVADOS COM 100% DE SUCESSO!");
console.log("========================================================\n");
