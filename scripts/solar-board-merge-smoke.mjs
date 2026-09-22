import assert from "node:assert/strict";
import {
  buildPanelBoardsWithLayout,
  buildSolarAcCircuitLayout,
  generateDefaultPanelLayout,
  getPrimaryPanelBoard,
  isDedicatedSolarBoard,
  isSolarProject,
  mergeSolarLayoutIntoPrincipal,
  nextBusbarIndex,
  remapBusbarIndices,
} from "../src/lib/electricalEngine.js";

const findRail = (layout, id) => (layout.rails || []).find((rail) => rail.id === id);
const findComponent = (layout, id) => (layout.rails || []).flatMap((rail) => rail.components || []).find((c) => c.id === id);

const solarProject = {
  project_type: "Solar",
  supply_type: "Monofásico",
  solar_config: { ac_supply_type: "Bifásico", ac_voltage: 220 },
  circuits: [
    { id: "ckt-1", name: "Iluminação sala", breaker_a: 16, breaker_curve: "B", breaker_poles: 1, phase: "A", supply_type: "Monofásico", power_w: 600 },
    { id: "solar_inverter_ac", name: "Inversor Solar 5kW CA", type: "Solar Fotovoltaico CA", breaker_a: 32, breaker_curve: "C", supply_type: "Bifásico" },
  ],
};

// ── isSolarProject / isDedicatedSolarBoard / getPrimaryPanelBoard ─────────────
assert.ok(isSolarProject(solarProject), "projeto com solar_config é solar");
assert.ok(!isSolarProject({ project_type: "Instalações Elétricas" }), "projeto sem solar_config não é solar");
assert.ok(isDedicatedSolarBoard({ name: "QD Solar CA" }), "detecta QD Solar CA por nome");
assert.ok(isDedicatedSolarBoard({ name: "QD Solar" }), "detecta QD Solar por nome");
assert.ok(isDedicatedSolarBoard({ type: "solar_ac" }), "detecta solar_ac por type");
assert.ok(isDedicatedSolarBoard({ type: "solar" }), "detecta solar por type");
assert.ok(!isDedicatedSolarBoard({ name: "QD-01 Principal", type: "principal" }), "QD-01 Principal não é solar dedicado");

assert.equal(getPrimaryPanelBoard([{ type: "qgbt" }, { type: "solar_ac" }, { id: "p1", type: "principal" }]).id, "p1", "quadro principal é o único não qgbt/solar_ac");
assert.equal(getPrimaryPanelBoard([{ name: "QD Solar CA" }, { id: "p1", name: "QD-01 Principal" }]).id, "p1", "ignora QD Solar CA pelo nome ao buscar principal");
assert.equal(getPrimaryPanelBoard([{ type: "qgbt" }]), null, "sem quadro principal retorna null");

// ── nextBusbarIndex / remapBusbarIndices ──────────────────────────────────────
const sampleWires = [
  { source: "terminal_left_top:0", target: "busbar_ground:0" },
  { source: "comp:x:bottom:0", target: "busbar_ground:2" },
];
assert.equal(nextBusbarIndex(sampleWires, "busbar_ground"), 3, "próximo índice livre é maior que o máximo usado + 1");
assert.equal(nextBusbarIndex([], "busbar_ground"), 0, "sem uso prévio começa em 0");
const remapped = remapBusbarIndices([{ source: "busbar_neutral:11", target: "comp:a:top:0" }], "busbar_neutral", 5);
assert.equal(remapped[0].source, "busbar_neutral:5", "remapeia índice antigo para o novo início livre");

// ── buildSolarAcCircuitLayout: não colide com índices já usados ───────────────
{
  const distribution = generateDefaultPanelLayout(solarProject, { forceDistribution: true });
  const solar = buildSolarAcCircuitLayout(solarProject, distribution.wires);
  const usedGround = distribution.wires
    .flatMap((w) => [w.source, w.target])
    .filter((ref) => typeof ref === "string" && ref.startsWith("busbar_ground:"))
    .map((ref) => Number(ref.split(":")[1]));
  const solarGroundIndices = solar.wires
    .flatMap((w) => [w.source, w.target])
    .filter((ref) => typeof ref === "string" && ref.startsWith("busbar_ground:"))
    .map((ref) => Number(ref.split(":")[1]));
  assert.ok(solarGroundIndices.every((index) => !usedGround.includes(index)), "trilhas solares não reutilizam slots de aterramento já ocupados pela distribuição");
  assert.equal(solar.rails[0].id, "rail_solar_1", "trilha de proteção solar tem id namespaced");
  assert.equal(solar.rails[1].id, "rail_solar_2", "trilha do disjuntor do inversor tem id namespaced");
  const inverterBreaker = findComponent(solar, "solar_main_breaker");
  assert.equal(inverterBreaker.current, 32, "disjuntor do inversor usa o breaker_a do circuito solar salvo");
  assert.equal(inverterBreaker.poles, 2, "Bifásico -> disjuntor de 2 polos");
}

// ── mergeSolarLayoutIntoPrincipal: mescla uma vez, não duplica, força regeneração quando pedido ──
{
  const distribution = generateDefaultPanelLayout(solarProject, { forceDistribution: true });
  const merged = mergeSolarLayoutIntoPrincipal(solarProject, distribution);
  assert.ok(findRail(merged, "rail_solar_1"), "primeira mesclagem adiciona as trilhas solares");
  assert.ok(findRail(merged, "rail_1"), "trilhas de distribuição originais são preservadas");

  const mergedAgain = mergeSolarLayoutIntoPrincipal(solarProject, merged);
  const solarRailCount = mergedAgain.rails.filter((r) => r.id === "rail_solar_1").length;
  assert.equal(solarRailCount, 1, "mesclar de novo sem forceRegenerate não duplica a trilha solar");

  const regenerated = mergeSolarLayoutIntoPrincipal(solarProject, merged, { forceRegenerate: true });
  assert.equal(regenerated.rails.filter((r) => r.id === "rail_solar_1").length, 1, "forceRegenerate substitui em vez de duplicar");

  const nonSolarProject = { ...solarProject, project_type: "Instalações Elétricas", solar_config: undefined };
  const untouched = mergeSolarLayoutIntoPrincipal(nonSolarProject, distribution);
  assert.ok(!findRail(untouched, "rail_solar_1"), "projeto não-solar não recebe trilhas solares");
}

// ── buildPanelBoardsWithLayout: nunca recria um quadro solar_ac separado ──────
{
  const legacyBoards = [
    {
      id: "board-principal",
      type: "principal",
      name: "QD-01 Principal",
      supply_type: "Monofásico",
      layout: generateDefaultPanelLayout(solarProject, { forceDistribution: true }),
    },
    {
      id: "board-solar",
      type: "solar_ac",
      name: "QD Solar CA",
      supply_type: "Trifásico",
      layout: { rails: [{ id: "rail_1", components: [{ id: "solar_feeder_breaker", type: "breaker", poles: 2 }] }], wires: [] },
    },
  ];
  const projectWithBoards = { ...solarProject, panel_boards: legacyBoards };
  const rebuilt = buildPanelBoardsWithLayout(projectWithBoards);
  assert.equal(rebuilt.length, 1, "quadro solar_ac legado é descartado da lista — só sobra o principal");
  assert.equal(rebuilt[0].type, "principal", "único quadro restante é o principal");
  assert.ok(findRail(rebuilt[0].layout, "rail_solar_1"), "proteção CA do inversor está dentro do quadro principal");
}

console.log("solar-board-merge-smoke: OK");
