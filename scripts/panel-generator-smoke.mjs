import assert from "node:assert/strict";
import { generateDefaultPanelLayout } from "../src/lib/electricalEngine.js";

const findComponent = (layout, id) => (
  layout.rails.flatMap((rail) => rail.components || []).find((component) => component.id === id)
);

const monoProject = {
  supply_type: "Monofásico",
  voltage: 220,
  circuits: [
    {
      id: "ckt-1",
      name: "Iluminação sala",
      circuitNumber: "C1",
      label: "C1 - Iluminação sala",
      wire_gauge: "2.5mm²",
      breaker_a: 16,
      breaker_curve: "B",
      breaker_poles: 1,
      phase: "A",
      supply_type: "Monofásico",
      power_w: 600,
    },
  ],
};

const monoLayout = generateDefaultPanelLayout(monoProject, { forceDistribution: true });
assert.ok(Array.isArray(monoLayout.infrastructure), "layout preserva lista de infraestrutura");

const monoBreaker = findComponent(monoLayout, "circuit_0");
assert.equal(monoBreaker.label, "C1 - Iluminação sala", "disjuntor usa identificação real do circuito");
assert.equal(monoBreaker.name, "Iluminação sala", "disjuntor preserva nome real do circuito");
assert.equal(monoBreaker.circuitNumber, "C1", "disjuntor preserva número do circuito");
assert.equal(monoBreaker.circuit_id, "ckt-1", "disjuntor preserva referência estável do circuito");

const neutralFeed = monoLayout.wires.find((wire) => wire.id === "w_neutral_feed");
assert.equal(neutralFeed.source, "terminal_left_top:4", "neutro de entrada usa terminal independente N");
assert.equal(neutralFeed.color, "blue", "neutro mantém cor elétrica dedicada");

const phaseOut = monoLayout.wires.find((wire) => wire.id === "w_r2_dist_out_circuit_0_0");
assert.equal(phaseOut.circuit_id, "ckt-1", "fase de saída preserva circuito vinculado");
assert.equal(phaseOut.circuitLabel, "C1 - Iluminação sala", "fase de saída preserva etiqueta do circuito");
assert.equal(phaseOut.conductorType, "phase", "fase de saída identifica tipo de condutor");

const neutralOut = monoLayout.wires.find((wire) => wire.id === "w_circ_n_circuit_0");
assert.equal(neutralOut.conductorType, "neutral", "circuito monofásico recebe neutro");
assert.equal(neutralOut.target, "load_out:circuit_0:neutral", "neutro de carga não reutiliza ponto de fase");

const groundOut = monoLayout.wires.find((wire) => wire.id === "w_circ_g_circuit_0");
assert.equal(groundOut.conductorType, "ground", "circuito monofásico mantém terra");

const biLayout = generateDefaultPanelLayout({
  supply_type: "Bifásico",
  voltage: 220,
  circuits: [
    {
      id: "ckt-2",
      name: "Chuveiro",
      circuitNumber: "C2",
      label: "C2 - Chuveiro",
      wire_gauge: "4mm²",
      breaker_a: 32,
      breaker_curve: "C",
      breaker_poles: 2,
      phase: "AB",
      supply_type: "Bifásico",
      power_w: 5500,
    },
  ],
}, { forceDistribution: true });
assert.equal(
  biLayout.wires.some((wire) => wire.id === "w_circ_n_circuit_0"),
  false,
  "circuito bifásico não recebe neutro automático",
);

const technicalLabelLayout = generateDefaultPanelLayout({
  supply_type: "Monofásico",
  circuits: [
    {
      id: "ckt-3",
      name: "Tomadas cozinha",
      circuitNumber: "C3",
      label: "RETORNO",
      breaker_poles: 1,
      supply_type: "Monofásico",
    },
  ],
}, { forceDistribution: true });
assert.equal(
  findComponent(technicalLabelLayout, "circuit_0").label,
  "C3 - Tomadas cozinha",
  "texto técnico não vira identificação principal do usuário",
);

console.log("panel generator smoke: ok");
