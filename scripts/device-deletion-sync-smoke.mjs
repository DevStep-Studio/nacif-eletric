import assert from "node:assert/strict";
import {
  generateDefaultPanelLayout,
  calcProjectMetrics,
  buildPanelBoardsWithLayout,
  getPrimaryPanelBoard,
} from "../src/lib/electricalEngine.js";
import { buildProfessionalPanelBoard } from "../src/lib/professionalPanelBoardLibrary.js";

console.log("Starting device deletion and unifilar sync smoke test...");

// 1. Setup initial project
const initialProject = {
  id: "proj-sync-test",
  name: "Residencial Teste Sincronização",
  supply_type: "Trifásico",
  voltage: 220,
  has_dr: true,
  has_dps: true,
  has_general_breaker: true,
  circuits: [
    {
      id: "ckt-1",
      circuit_id: "ckt-1",
      name: "Iluminação Sala",
      circuitNumber: "C1",
      label: "C1 - Iluminação Sala",
      wire_gauge: "2.5mm²",
      breaker_a: 16,
      breaker_curve: "B",
      breaker_poles: 1,
      phase: "A",
      supply_type: "Monofásico",
      power_w: 1200,
      needs_dr: false,
    },
    {
      id: "ckt-2",
      circuit_id: "ckt-2",
      name: "Tomadas Cozinha",
      circuitNumber: "C2",
      label: "C2 - Tomadas Cozinha",
      wire_gauge: "2.5mm²",
      breaker_a: 20,
      breaker_curve: "B",
      breaker_poles: 1,
      phase: "B",
      supply_type: "Monofásico",
      power_w: 2200,
      needs_dr: true,
    },
    {
      id: "ckt-3",
      circuit_id: "ckt-3",
      name: "Chuveiro Master",
      circuitNumber: "C3",
      label: "C3 - Chuveiro Master",
      wire_gauge: "6mm²",
      breaker_a: 32,
      breaker_curve: "C",
      breaker_poles: 2,
      phase: "AB",
      supply_type: "Bifásico",
      power_w: 6500,
      needs_dr: true,
    },
  ],
};

const initialMetrics = calcProjectMetrics(initialProject);
const initialLayout = generateDefaultPanelLayout(initialProject, { forceDistribution: true });
const initialBoards = buildPanelBoardsWithLayout(initialProject, initialLayout);
const initialCadBoard = buildProfessionalPanelBoard({ ...initialProject, panel_boards: initialBoards, panel_layout: initialLayout }, initialMetrics);

// Assert initial state has all components
assert.equal(initialProject.circuits.length, 3, "Initial project has 3 circuits");
assert.equal(initialCadBoard.circuits.length, 3, "CAD board has 3 circuits");
assert.ok(initialCadBoard.dpsCount > 0, "Initial CAD board has DPS");
assert.ok(initialCadBoard.drDeviceCount > 0, "Initial CAD board has IDR");
assert.ok(initialCadBoard.hasGeneralBreaker, "Initial CAD board has general breaker");

// 2. Simulate deletion of Circuit C1
const circuitsAfterC1Delete = initialProject.circuits.filter((c) => c.id !== "ckt-1");
const railsAfterC1Delete = initialLayout.rails.map((r) => ({
  ...r,
  components: (r.components || []).filter((c) => c.circuit_id !== "ckt-1" && c.id !== "circuit_0"),
}));
const wiresAfterC1Delete = initialLayout.wires.filter((w) => (
  w.circuit_id !== "ckt-1" &&
  !String(w.source || "").includes("circuit_0") &&
  !String(w.target || "").includes("circuit_0")
));
const layoutAfterC1Delete = { rails: railsAfterC1Delete, wires: wiresAfterC1Delete, infrastructure: [] };
const boardsAfterC1Delete = [{ id: "b1", name: "Quadro", layout: layoutAfterC1Delete }];
const projectAfterC1Delete = {
  ...initialProject,
  circuits: circuitsAfterC1Delete,
  panel_layout: layoutAfterC1Delete,
  panel_boards: boardsAfterC1Delete,
};
const metricsAfterC1Delete = calcProjectMetrics(projectAfterC1Delete);
const cadBoardAfterC1Delete = buildProfessionalPanelBoard(projectAfterC1Delete, metricsAfterC1Delete);

assert.equal(projectAfterC1Delete.circuits.length, 2, "Project has 2 circuits after C1 deletion");
assert.equal(cadBoardAfterC1Delete.circuits.length, 2, "CAD board has 2 circuits after C1 deletion");
assert.ok(!cadBoardAfterC1Delete.circuits.some((c) => c.id === "ckt-1" || c.name === "Iluminação Sala"), "C1 is completely absent from CAD board");
assert.ok(!wiresAfterC1Delete.some((w) => w.circuit_id === "ckt-1"), "Wires connected to C1 are removed");

// 3. Simulate deletion of DPS
const railsAfterDpsDelete = railsAfterC1Delete.map((r) => ({
  ...r,
  components: (r.components || []).filter((c) => c.type !== "dps"),
}));
const wiresAfterDpsDelete = wiresAfterC1Delete.filter((w) => (
  !String(w.source || "").includes("dps") && !String(w.target || "").includes("dps")
));
const layoutAfterDpsDelete = { rails: railsAfterDpsDelete, wires: wiresAfterDpsDelete, infrastructure: [] };
const boardsAfterDpsDelete = [{ id: "b1", name: "Quadro", layout: layoutAfterDpsDelete }];
const projectAfterDpsDelete = {
  ...projectAfterC1Delete,
  has_dps: false,
  dps_omitted: true,
  panel_layout: layoutAfterDpsDelete,
  panel_boards: boardsAfterDpsDelete,
};
const cadBoardAfterDpsDelete = buildProfessionalPanelBoard(projectAfterDpsDelete, metricsAfterC1Delete);

assert.equal(cadBoardAfterDpsDelete.dpsCount, 0, "DPS count is 0 on CAD board after DPS deletion");
assert.equal(cadBoardAfterDpsDelete.dpsDeviceCount, 0, "DPS device count is 0 on CAD board after DPS deletion");

// 4. Simulate deletion of IDR/DR
const railsAfterDrDelete = railsAfterDpsDelete.map((r) => ({
  ...r,
  components: (r.components || []).filter((c) => c.type !== "dr" && c.type !== "idr" && c.id !== "gen_dr"),
}));
const wiresAfterDrDelete = wiresAfterDpsDelete.filter((w) => (
  !String(w.source || "").includes("gen_dr") && !String(w.target || "").includes("gen_dr")
));
const layoutAfterDrDelete = { rails: railsAfterDrDelete, wires: wiresAfterDrDelete, infrastructure: [] };
const boardsAfterDrDelete = [{ id: "b1", name: "Quadro", layout: layoutAfterDrDelete }];
const projectAfterDrDelete = {
  ...projectAfterDpsDelete,
  has_dr: false,
  no_general_dr: true,
  panel_layout: layoutAfterDrDelete,
  panel_boards: boardsAfterDrDelete,
};
const cadBoardAfterDrDelete = buildProfessionalPanelBoard(projectAfterDrDelete, metricsAfterC1Delete);

assert.equal(cadBoardAfterDrDelete.drDeviceCount, 0, "DR device count is 0 on CAD board after DR deletion");
assert.equal(cadBoardAfterDrDelete.drCount, 0, "DR protected count is 0 on CAD board after DR deletion");

// 5. Simulate reopening project from persisted state
const regeneratedLayout = generateDefaultPanelLayout(projectAfterDrDelete, { forceDistribution: true });
const regeneratedComps = regeneratedLayout.rails.flatMap((r) => r.components || []);
assert.ok(!regeneratedComps.some((c) => c.type === "dps"), "Reopened project does NOT resurrect DPS");
assert.ok(!regeneratedComps.some((c) => c.type === "dr" || c.id === "gen_dr"), "Reopened project does NOT resurrect IDR");
assert.equal(regeneratedComps.filter((c) => c.type === "breaker" && !c.isGeneral).length, 2, "Reopened project only has active 2 circuits");

console.log("All device deletion and unifilar sync smoke tests passed successfully!");
