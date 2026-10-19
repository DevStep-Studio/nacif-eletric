import assert from "node:assert/strict";
import {
  roundMoney,
  calcItemSubtotal,
  calculateBudgetFinancials,
  formatCurrencyBR,
  formatQtyBR,
  BUDGET_STATUS_CONFIG,
} from "../src/lib/budgetFinancialMath.js";
import {
  buildProjectBudgetMaterials,
} from "../src/lib/projectBudgetMaterials.js";

console.log("=================================================");
console.log("🧪 INICIANDO BATERIA DE TESTES DO MÓDULO DE ORÇAMENTOS");
console.log("=================================================");

// ── 1. Precisão Monetária & Arredondamentos Financeiros ────────────────────────
console.log("\n[1/6] Testando Precisão Monetária e Arredondamento (roundMoney)...");

assert.equal(roundMoney(0.1 + 0.2), 0.3, "0.1 + 0.2 deve arredondar estritamente para 0.30");
assert.equal(roundMoney(1.005), 1.01, "1.005 deve arredondar para 1.01 nos centavos");
assert.equal(roundMoney(1.004), 1.0, "1.004 deve arredondar para 1.00");
assert.equal(roundMoney(35.999), 36.0, "35.999 deve arredondar para 36.00");
assert.equal(roundMoney("123.456"), 123.46, "Conversão de string com casas decimais");
assert.equal(roundMoney(null), 0, "Null deve retornar 0");
assert.equal(roundMoney(undefined), 0, "Undefined deve retornar 0");
assert.equal(roundMoney(NaN), 0, "NaN deve retornar 0");

// Subtotal de itens com quantidades fracionárias e centavos
const itemSub1 = calcItemSubtotal(12.5, 4.75); // 12.5 * 4.75 = 59.375 -> 59.38
assert.equal(itemSub1, 59.38, "12.5 m a R$ 4.75 deve resultar em R$ 59.38");

const itemSub2 = calcItemSubtotal(33.333, 10);
assert.equal(itemSub2, 333.33, "33.333 a R$ 10 deve resultar em R$ 333.33");
console.log("✅ Precisão monetária validada com sucesso!");

// ── 2. Cálculos Financeiros: Materiais, Serviços, Descontos e Acréscimos ──────
console.log("\n[2/6] Testando Pipeline Financeiro (calculateBudgetFinancials)...");

const sampleMaterials = [
  { name: "Cabo de cobre 2,5mm²", qty: 100, price: 3.5 }, // 350.00
  { name: "Disjuntor monopolar 16A", qty: 6, price: 18.9 }, // 113.40
  { name: "Quadro de distribuição 12 DIN", qty: 1, price: 120.0 }, // 120.00
]; // Total materiais = 583.40

const sampleServices = [
  { id: "s1", name: "Passagem de fiação", qty: 100, unit: "m", price: 5.0 }, // 500.00
  { id: "s2", name: "Montagem do QDC", qty: 1, unit: "vb.", price: 400.0 }, // 400.00
]; // Total serviços = 900.00

// Cenário A: Sem variação, sem margem, sem descontos
const finA = calculateBudgetFinancials({
  materials: sampleMaterials,
  services: sampleServices,
  productAdjustmentPercent: 0,
  marginPercent: 0,
  discountValue: 0,
  surchargeValue: 0,
});
assert.equal(finA.baseMaterialTotal, 583.4, "Materiais base deve ser 583.40");
assert.equal(finA.materialTotal, 583.4, "Materiais total deve ser 583.40");
assert.equal(finA.servicesTotal, 900.0, "Serviços total deve ser 900.00");
assert.equal(finA.subtotal, 1483.4, "Subtotal bruto deve ser 1483.40");
assert.equal(finA.total, 1483.4, "Total final sem margem/desconto deve ser 1483.40");

// Cenário B: Com Variação de Materiais (+10%)
const finB = calculateBudgetFinancials({
  materials: sampleMaterials,
  services: sampleServices,
  productAdjustmentPercent: 10,
  marginPercent: 0,
  discountValue: 0,
  surchargeValue: 0,
});
// 583.40 * 10% = 58.34 -> materialTotal = 641.74
assert.equal(finB.productAdjustmentValue, 58.34, "Ajuste de produtos de 10% deve ser 58.34");
assert.equal(finB.materialTotal, 641.74, "Materiais com +10% deve ser 641.74");
assert.equal(finB.servicesTotal, 900.0, "Serviços não devem ser afetados pela variação de materiais");
assert.equal(finB.subtotal, 1541.74, "Subtotal bruto com materiais ajustados deve ser 1541.74");

// Cenário C: Desconto Fixo de R$ 100.00 e Acréscimo Fixo de R$ 50.00
const finC = calculateBudgetFinancials({
  materials: sampleMaterials,
  services: sampleServices,
  productAdjustmentPercent: 0,
  marginPercent: 0,
  discountType: "fixed",
  discountValue: 100.0,
  surchargeType: "fixed",
  surchargeValue: 50.0,
});
assert.equal(finC.discountAmount, 100.0, "Desconto fixo deve ser R$ 100.00");
assert.equal(finC.surchargeAmount, 50.0, "Acréscimo fixo deve ser R$ 50.00");
// Subtotal = 1483.40 -> após desc/acréscimo = 1483.40 - 100 + 50 = 1433.40
assert.equal(finC.total, 1433.4, "Total após desc R$100 e acréscimo R$50 deve ser 1433.40");

// Cenário D: Desconto Percentual de 5% e Margem BDI de 30%
const finD = calculateBudgetFinancials({
  materials: sampleMaterials,
  services: sampleServices,
  productAdjustmentPercent: 0,
  marginPercent: 30,
  discountType: "percent",
  discountValue: 5, // 5% de 1483.40 = 74.17
  surchargeValue: 0,
});
// subtotal = 1483.40
// desc = roundMoney(1483.40 * 0.05) = 74.17
// base = 1483.40 - 74.17 = 1409.23
// marginBrl = roundMoney(1409.23 * 0.30) = 422.77
// total = 1409.23 + 422.77 = 1832.00
assert.equal(finD.discountAmount, 74.17, "Desconto de 5% sobre 1483.40 deve ser 74.17");
assert.equal(finD.marginBrl, 422.77, "Margem de 30% deve ser 422.77");
assert.equal(finD.total, 1832.0, "Total com desconto 5% e margem 30% deve ser 1832.00");

// Cenário E: Salvaguarda contra desconto maior que o subtotal
const finE = calculateBudgetFinancials({
  materials: sampleMaterials,
  services: [],
  discountType: "fixed",
  discountValue: 99999, // Desconto absurdo
});
assert.equal(finE.discountAmount, finE.subtotal, "Desconto não pode exceder o subtotal");
assert.ok(finE.total >= 0, "Total nunca pode ser negativo");

console.log("✅ Pipeline de cálculos financeiros validado!");

// ── 3. Teste de Duplicação e Preservação de Snapshots Históricos ─────────────
console.log("\n[3/6] Testando Duplicação Independente e Snapshots Históricos...");

// Simulação do repositório em memória com a mesma lógica do backend
let inMemoryStore = [];

function createBudget(data) {
  const fin = calculateBudgetFinancials(data);
  const record = {
    id: `budget-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...data,
    ...fin,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  };
  inMemoryStore.push(record);
  return JSON.parse(JSON.stringify(record));
}

function duplicateBudget(id) {
  const original = inMemoryStore.find((b) => b.id === id);
  if (!original) throw new Error("Not found");
  const clone = JSON.parse(JSON.stringify(original));
  clone.id = `budget-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  clone.name = `Cópia de ${clone.name || "Orçamento"}`;
  clone.status = "rascunho";
  clone.created_date = new Date().toISOString();
  clone.updated_date = new Date().toISOString();
  inMemoryStore.push(clone);
  return JSON.parse(JSON.stringify(clone));
}

function updateBudget(id, updates) {
  const idx = inMemoryStore.findIndex((b) => b.id === id);
  if (idx < 0) throw new Error("Not found");
  const merged = { ...inMemoryStore[idx], ...updates, updated_date: new Date().toISOString() };
  const fin = calculateBudgetFinancials(merged);
  const updated = { ...merged, ...fin };
  inMemoryStore[idx] = updated;
  return JSON.parse(JSON.stringify(updated));
}

// Criação do orçamento original
const originalBudget = createBudget({
  project_id: "proj-101",
  name: "Proposta Original de Instalação",
  status: "enviado",
  materials: [
    { name: "Disjuntor Bipolar 25A", qty: 2, price: 45.0 }, // 90.00
    { name: "Cabo flexível 4mm²", qty: 50, price: 5.2 }, // 260.00
  ], // Total materiais = 350.00
  services: [
    { id: "s-1", name: "Montagem do quadro", qty: 1, unit: "vb.", price: 500.0 },
  ], // Total serviços = 500.00
  margin_percent: 20,
  product_adjustment_percent: 0,
});

assert.equal(originalBudget.baseMaterialTotal, 350.0, "Materiais base original = 350");
assert.equal(originalBudget.servicesTotal, 500.0, "Serviços base original = 500");
assert.equal(originalBudget.subtotal, 850.0, "Subtotal original = 850");
assert.equal(originalBudget.total, 1020.0, "Total original (850 + 20%) = 1020.00");

// Duplicação da proposta
const clonedBudget = duplicateBudget(originalBudget.id);
assert.notEqual(clonedBudget.id, originalBudget.id, "Orçamento duplicado tem novo ID");
assert.equal(clonedBudget.status, "rascunho", "Orçamento duplicado inicia como rascunho");
assert.equal(clonedBudget.name, "Cópia de Proposta Original de Instalação");

// Modificação agressiva na proposta clonada
updateBudget(clonedBudget.id, {
  materials: [
    { name: "Disjuntor Bipolar 25A", qty: 10, price: 150.0 }, // Preço alterado para R$ 150!
  ],
  margin_percent: 50,
});

// Verificação do orçamento original no repositório: NENHUM campo pode ter mudado!
const originalInStore = inMemoryStore.find((b) => b.id === originalBudget.id);
assert.equal(originalInStore.materials.length, 2, "Original preserva exatamente 2 materiais");
assert.equal(originalInStore.materials[0].price, 45.0, "Preço do disjuntor no original continua R$ 45.00");
assert.equal(originalInStore.materials[0].qty, 2, "Quantidade no original continua 2");
assert.equal(originalInStore.margin_percent, 20, "Margem original continua 20%");
assert.equal(originalInStore.total, 1020.0, "Total do orçamento original permanece R$ 1.020,00");

console.log("✅ Duplicação e Preservação de Snapshots Históricos comprovadas com sucesso!");

// ── 4. Integração com Dados Técnicos do Projeto (buildProjectBudgetMaterials) ──
console.log("\n[4/6] Testando Integração com Dados Técnicos do Projeto...");

const technicalProject = {
  id: "proj-tech-1",
  name: "Residência Unifamiliar",
  voltage: 220,
  supply_type: "Bifásico",
  circuits: [
    {
      id: "c-1",
      name: "Iluminação Sala",
      breaker_a: 10,
      breaker_poles: 1,
      wire_gauge: "1.5mm²",
      conduit_length: 15,
      power_w: 400,
    },
    {
      id: "c-2",
      name: "Chuveiro Elétrico",
      breaker_a: 32,
      breaker_poles: 2,
      wire_gauge: "6.0mm²",
      conduit_length: 20,
      power_w: 5500,
    },
  ],
};

const generated = buildProjectBudgetMaterials(technicalProject, { productAdjustment: 0 });
assert.ok(Array.isArray(generated.materials), "Gera lista de materiais");
assert.ok(generated.materials.length > 0, "Lista de materiais do projeto não pode ser vazia");
assert.ok(generated.baseMaterialTotal > 0, "Total de materiais deve ser maior que zero");

// Confirma que disjuntores e condutores foram identificados
const hasBreakers = generated.materials.some((m) => m.name.toLowerCase().includes("disjuntor"));
assert.ok(hasBreakers, "Materiais gerados a partir do projeto devem incluir disjuntores");

console.log("✅ Integração com projeto técnico validada!");

// ── 5. Testes de Valores Extremos e Entradas Inválidas ─────────────────────────
console.log("\n[5/6] Testando Valores Extremos e Entradas Inválidas...");

// Orçamento vazio (sem materiais e sem serviços)
const emptyFin = calculateBudgetFinancials({
  materials: [],
  services: [],
});
assert.equal(emptyFin.baseMaterialTotal, 0);
assert.equal(emptyFin.servicesTotal, 0);
assert.equal(emptyFin.total, 0);

// Valores nulos, indefinidos e negativos
const nullFin = calculateBudgetFinancials({
  materials: [{ name: "Teste", qty: null, price: undefined }],
  services: [{ name: "Serviço", qty: -5, price: -100 }],
  marginPercent: null,
  discountValue: undefined,
});
assert.equal(nullFin.baseMaterialTotal, 0, "Valores nulos devem ser tratados como 0");
assert.equal(nullFin.servicesTotal, 0, "Valores negativos devem ser bloqueados em 0");
assert.equal(nullFin.total, 0, "Total final deve ser 0 sem erros ou NaNs");

console.log("✅ Valores extremos e salvaguardas de entrada validados!");

// ── 6. Formatações e Configurações de Status ───────────────────────────────────
console.log("\n[6/6] Testando Formatadores e Configurações de Status...");

assert.equal(formatCurrencyBR(1500.5), "R$ 1.500,50", "Formatação de moeda BRL");
assert.equal(formatCurrencyBR(0), "R$ 0,00", "Formatação de zero BRL");
assert.equal(formatQtyBR(12.5), "12,5", "Formatação de quantidade fracionária");
assert.equal(formatQtyBR(10), "10", "Formatação de quantidade inteira");

assert.ok(BUDGET_STATUS_CONFIG.rascunho, "Status rascunho configurado");
assert.ok(BUDGET_STATUS_CONFIG.enviado, "Status enviado configurado");
assert.ok(BUDGET_STATUS_CONFIG.aprovado, "Status aprovado configurado");
assert.ok(BUDGET_STATUS_CONFIG.recusado, "Status recusado configurado");
assert.ok(BUDGET_STATUS_CONFIG.cancelado, "Status cancelado configurado");

console.log("✅ Formatadores e status validados!");

console.log("\n=================================================");
console.log("🎉 TODOS OS TESTES DO MÓDULO DE ORÇAMENTOS PASSARAM COM SUCESSO!");
console.log("=================================================");
