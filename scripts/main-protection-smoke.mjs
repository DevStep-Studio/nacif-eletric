import assert from "node:assert/strict";
import {
  calcMainProtection,
  calcProjectMetrics,
  generateDefaultPanelLayout,
  selectDrRating,
} from "../src/lib/electricalEngine.js";

const findComponent = (layout, id) => (
  layout.rails.flatMap((rail) => rail.components || []).find((component) => component.id === id)
);

// ── selectDrRating: In do IDR ≥ In do disjuntor, em degraus comerciais ────────
assert.equal(selectDrRating(16), 40, "piso do IDR é 40 A");
assert.equal(selectDrRating(40), 40, "40 A casa exato");
assert.equal(selectDrRating(41), 63, "acima de 40 vai para 63");
assert.equal(selectDrRating(50), 63, "50 A de disjuntor pede IDR 63 A");
assert.equal(selectDrRating(63), 63, "63 A casa exato");
assert.equal(selectDrRating(80), 80, "80 A casa exato");

// ── Projeto bifásico (perfil do "Simulação": ~8,6 kW / 220 V) ─────────────────
const biProject = {
  supply_type: "Bifásico",
  voltage: 220,
  circuits: [
    { id: "c1", name: "Ar condicionado 18000", type: "Ar Condicionado", supply_type: "Bifásico", power_w: 1300, breaker_poles: 2 },
    { id: "c2", name: "Iluminação quarto", type: "Iluminação", supply_type: "Monofásico", power_w: 500 },
    { id: "c3", name: "Iluminação social", type: "Iluminação", supply_type: "Monofásico", power_w: 600 },
    { id: "c4", name: "Tomadas cozinha", type: "Tomadas de Uso Geral", supply_type: "Monofásico", power_w: 1200 },
    { id: "c5", name: "Tomadas área", type: "Tomadas de Uso Geral", supply_type: "Monofásico", power_w: 1200 },
    { id: "c6", name: "Tomadas quartos", type: "Tomadas de Uso Geral", supply_type: "Monofásico", power_w: 1100 },
    { id: "c7", name: "Chuveiro", type: "Chuveiro", supply_type: "Bifásico", power_w: 5500, breaker_poles: 2 },
    { id: "c8", name: "Máquina de lavar", type: "Tomadas de Uso Específico", supply_type: "Monofásico", power_w: 1500 },
  ],
};

const biMetrics = calcProjectMetrics(biProject);
const biMain = calcMainProtection(biProject, biMetrics);

// Âncora: o editor de circuitos mostra metrics.generalBreaker — tudo deve seguir isso.
assert.equal(biMain.breaker.current, biMetrics.generalBreaker, "proteção geral parte do dimensionamento do editor");
assert.equal(biMetrics.generalDr, selectDrRating(biMetrics.generalBreaker), "metrics.generalDr acompanha o disjuntor geral");
assert.equal(biMain.dr.current, biMetrics.generalDr, "calcMainProtection e metrics concordam no IDR");
assert.ok(biMain.dr.current >= biMain.breaker.current, "IDR nunca menor que o disjuntor geral");
assert.equal(biMain.breaker.poles, 2, "disjuntor geral bifásico = 2P");
assert.equal(biMain.dr.poles, 2, "IDR geral bifásico = 2P");
assert.equal(biMetrics.generalBreakerPoles, 2, "metrics expõe polos do disjuntor geral");
assert.equal(biMetrics.generalDrPoles, 2, "metrics expõe polos do IDR geral");

// O quadro gerado tem que bater com o dimensionamento (era o bug: 40 A no editor, 63 A no quadro).
const biLayout = generateDefaultPanelLayout(biProject, { forceDistribution: true });
const biGenBrk = findComponent(biLayout, "gen_brk");
const biGenDr = findComponent(biLayout, "gen_dr");
assert.equal(biGenBrk.current, biMetrics.generalBreaker, "DJ GERAL do quadro = disjuntor geral do dimensionamento");
assert.equal(biGenBrk.poles, biMain.breaker.poles, "DJ GERAL do quadro com polos corretos");
assert.equal(biGenDr.current, biMetrics.generalDr, "IDR GERAL do quadro = IDR do dimensionamento");
assert.equal(biGenDr.poles, biMain.dr.poles, "IDR GERAL do quadro com polos corretos");
assert.equal(biGenDr.current >= biGenBrk.current, true, "no quadro, IDR ≥ disjuntor geral");

// ── Projeto trifásico: polos 3P (disjuntor) e 4P (IDR) ───────────────────────
const triProject = {
  supply_type: "Trifásico",
  voltage: 380,
  circuits: [
    { id: "t1", name: "Motor bomba", type: "Motor", supply_type: "Trifásico", power_w: 7500, breaker_poles: 3 },
    { id: "t2", name: "Iluminação galpão", type: "Iluminação", supply_type: "Monofásico", power_w: 2000 },
    { id: "t3", name: "Tomadas", type: "Tomadas de Uso Geral", supply_type: "Monofásico", power_w: 2500 },
  ],
};
const triMetrics = calcProjectMetrics(triProject);
const triMain = calcMainProtection(triProject, triMetrics);
const triLayout = generateDefaultPanelLayout(triProject, { forceDistribution: true });
assert.equal(triMain.breaker.poles, 3, "disjuntor geral trifásico = 3P");
assert.equal(triMain.dr.poles, 4, "IDR geral trifásico = 4P (tetrapolar)");
assert.equal(findComponent(triLayout, "gen_brk").current, triMetrics.generalBreaker, "quadro trifásico segue o dimensionamento");
assert.equal(findComponent(triLayout, "gen_dr").current, triMetrics.generalDr, "IDR trifásico segue o dimensionamento");

console.log("main protection smoke: ok");
