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

console.log("budget materials smoke: ok");
