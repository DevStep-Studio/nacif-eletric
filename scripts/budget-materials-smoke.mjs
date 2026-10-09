import assert from "node:assert/strict";
import {
  buildProfessionalBudgetComplements,
  isPanelAssemblyBudgetItem,
  PANEL_ASSEMBLY_BUDGET_CATEGORIES,
} from "../src/lib/budgetElectricalMaterials.js";

// ── Classificação direta de itens ─────────────────────────────────────────────
assert.equal(isPanelAssemblyBudgetItem({ category: "quadro" }), true, "quadro é item de quadro");
assert.equal(isPanelAssemblyBudgetItem({ category: "proteção" }), true, "acento não quebra a classificação");
assert.equal(isPanelAssemblyBudgetItem({ category: "conectores" }), true, "conectores é item de quadro");
assert.equal(isPanelAssemblyBudgetItem({ category: "consumíveis" }), true, "consumíveis é item de quadro");
assert.equal(isPanelAssemblyBudgetItem({ category: "infraestrutura" }), false, "infraestrutura não é item de quadro");
assert.equal(isPanelAssemblyBudgetItem({ category: "acabamentos" }), false, "acabamentos não é item de quadro");
assert.equal(isPanelAssemblyBudgetItem({ category: "telecom" }), false, "telecom não é item de quadro");
assert.equal(isPanelAssemblyBudgetItem({}), false, "item sem categoria não passa no filtro de quadro");
assert.ok(PANEL_ASSEMBLY_BUDGET_CATEGORIES.has("quadro"), "conjunto de categorias exportado");

// ── Complementos: só o que compõe o quadro sobrevive ao filtro ────────────────
const complements = buildProfessionalBudgetComplements({
  circuits: [
    { type: "Tomadas de uso geral", point_count: 6, breaker_poles: 1, supply_type: "Monofásico" },
    { type: "Iluminação", point_count: 5, breaker_poles: 1, supply_type: "Monofásico" },
    { type: "Chuveiro (TUE)", point_count: 1, breaker_poles: 2, supply_type: "Bifásico" },
  ],
  plantPoints: [],
  plantRoutes: [],
  panelComponents: [
    { type: "breaker", poles: 1 },
    { type: "breaker", poles: 1 },
    { type: "breaker", poles: 2 },
    { type: "dr", poles: 2 },
    { type: "dps" },
  ],
  panelWires: [],
  infraType: "embutido",
  budgetPhaseCount: 1,
  panelDinModules: 12,
  conduitMeters: 0,
});

const names = (list) => list.map((item) => item.name);
const kept = complements.filter(isPanelAssemblyBudgetItem);
const dropped = complements.filter((item) => !isPanelAssemblyBudgetItem(item));

// Itens que devem permanecer no projeto "só quadro".
for (const expected of [
  "Barramento fase pente/garfo",
  "Barramento neutro isolado",
  "Barramento terra PE",
  "Trilho DIN 35mm",
  "Canaleta recortada para quadro",
  "Conector de emenda compacto 3 vias",
  "Terminal tubular isolado sortido",
  "Terminal olhal/garfo isolado para quadro",
  "Parafuso, bucha e fixadores",
  "Anilha/etiqueta de identificação",
]) {
  assert.ok(names(kept).includes(expected), `mantém no quadro: ${expected}`);
}

// Itens de infraestrutura / acabamento que NÃO devem aparecer sem planta baixa.
for (const forbidden of [
  "Caixa 4x2 PVC embutir",
  "Caixa 4x4 PVC embutir/passagem",
  "Tomada 2P+T 10A com placa",
  "Interruptor simples com placa",
  "Ponto de luz/soquete plafon",
  "Curva 90 para eletroduto",
  "Luva para eletroduto",
  "Bucha e arruela para eletroduto",
]) {
  assert.ok(names(dropped).includes(forbidden), `gerado mas removido do quadro: ${forbidden}`);
  assert.ok(!names(kept).includes(forbidden), `não sobra no quadro: ${forbidden}`);
}

assert.ok(kept.length > 0 && dropped.length > 0, "o cenário exercita os dois lados do filtro");
const normalizeCategory = (value) => String(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
assert.ok(
  kept.every((item) => PANEL_ASSEMBLY_BUDGET_CATEGORIES.has(normalizeCategory(item.category))),
  "todo item mantido pertence a uma categoria de quadro",
);

// ── Verificação de Preços Realistas de Materiais e Proteção ─────────────────
import {
  calculateCircuitBreakerPrice,
  estimateLocalMaterialPrice,
  buildProjectBudgetMaterials,
} from "../src/lib/projectBudgetMaterials.js";
import { getBudgetDrPrice } from "../src/lib/budgetElectricalMaterials.js";

// Testes de Disjuntores de Alta Capacidade / Caixa Moldada
assert.equal(calculateCircuitBreakerPrice({ current: 630, poles: 3, isGeneral: true }), 2950, "Disjuntor geral 630A 3P deve custar R$ 2.950");
assert.equal(calculateCircuitBreakerPrice({ current: 800, poles: 3, isGeneral: true }), 4900, "Disjuntor geral 800A 3P deve custar R$ 4.900");
assert.equal(calculateCircuitBreakerPrice({ current: 400, poles: 3, isGeneral: true }), 1850, "Disjuntor geral 400A 3P deve custar R$ 1.850");
assert.equal(calculateCircuitBreakerPrice({ current: 250, poles: 3, isGeneral: true }), 980, "Disjuntor geral 250A 3P deve custar R$ 980");
assert.equal(calculateCircuitBreakerPrice({ current: 160, poles: 3, isGeneral: true }), 680, "Disjuntor geral 160A 3P deve custar R$ 680");
assert.equal(calculateCircuitBreakerPrice({ current: 100, poles: 3, isGeneral: true }), 480, "Disjuntor geral 100A 3P deve custar R$ 480 (caixa moldada)");

// Testes de Mini-Disjuntores DIN
assert.equal(calculateCircuitBreakerPrice({ current: 40, poles: 3 }), 68.9, "Disjuntor 40A 3P DIN deve custar R$ 68,90");
assert.equal(calculateCircuitBreakerPrice({ current: 40, poles: 2 }), 42.9, "Disjuntor 40A 2P DIN deve custar R$ 42,90");
assert.equal(calculateCircuitBreakerPrice({ current: 63, poles: 3 }), 89.9, "Disjuntor 63A 3P DIN deve custar R$ 89,90");
assert.equal(calculateCircuitBreakerPrice({ current: 20, poles: 1 }), 14.9, "Disjuntor 20A 1P DIN deve custar R$ 14,90");

// Testes de DRs por Amperagem
assert.equal(getBudgetDrPrice({ current: 250, poles: 4 }), 1390, "DR Tetrapolar 250A deve custar R$ 1.390");
assert.equal(getBudgetDrPrice({ current: 40, poles: 4 }), 165, "DR Tetrapolar 40A deve custar R$ 165");
assert.equal(getBudgetDrPrice({ current: 40, poles: 2 }), 98, "DR Bipolar 40A deve custar R$ 98");

// Testes de Estimativa Inteligente de Texto
assert.equal(estimateLocalMaterialPrice("Disjuntor geral 630A 3P/C"), 2950, "Estimativa de disjuntor geral 630A 3P deve ser R$ 2.950");
assert.equal(estimateLocalMaterialPrice("Disjuntor 40A 3P/C"), 68.9, "Estimativa de disjuntor 40A 3P/C deve ser R$ 68,90");
assert.equal(estimateLocalMaterialPrice("Disjuntor 40A 2P/C"), 42.9, "Estimativa de disjuntor 40A 2P/C deve ser R$ 42,90");

// Teste de montagem completa do orçamento com disjuntor geral 630A
const mockProject = {
  name: "Obra Industrial",
  supply_type: "Trifásico",
  panel_boards: [
    {
      layout: {
        rails: [
          {
            components: [
              { id: "gen_brk", type: "breaker", isGeneral: true, current: 630, poles: 3, curve: "C", label: "DJ Geral 630A" },
              { id: "gen_dr", type: "dr", isGeneral: true, current: 250, poles: 4, label: "DR Geral 250A" },
            ],
          },
        ],
      },
    },
  ],
};

const budget = buildProjectBudgetMaterials(mockProject);
const brkItem = budget.materials.find((m) => m.name.includes("630A"));
const drItem = budget.materials.find((m) => m.name.includes("250A"));
assert.ok(brkItem, "Disjuntor 630A está no orçamento");
assert.equal(brkItem.price, 2950, "Preço do disjuntor geral 630A é R$ 2.950");
assert.ok(drItem, "DR 250A está no orçamento");
assert.equal(drItem.price, 1390, "Preço do DR 250A é R$ 1.390");

console.log("budget materials smoke: ok (todos os preços e testes aprovados)");

