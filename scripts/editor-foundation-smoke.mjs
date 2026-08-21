import assert from "node:assert/strict";

import { layerVisibilityForLegacyCanvas, normalizeLayerState } from "../src/editor/layers/defaultLayers.js";
import { normalizePlantDocument } from "../src/editor/schemas/plantDocument.js";
import { snapPointToReferences, snapToleranceToDocument } from "../src/editor/snapping/snapEngine.js";
import {
  designPxToMillimeters,
  formatDesignDistance,
  fromMillimeters,
  millimetersToDesignPx,
  toMillimeters,
} from "../src/editor/units/unitSystem.js";
import { screenToDesignPoint, zoomAtPoint } from "../src/editor/viewport/viewportMath.js";

assert.equal(toMillimeters(4, "m"), 4000, "4 m deve ser armazenado como 4000 mm");
assert.equal(fromMillimeters(2500, "m"), 2.5, "2500 mm deve ser exibido como 2,5 m");
assert.equal(designPxToMillimeters(200, 50), 4000, "50 px/m converte 200 px de desenho para 4 m");
assert.equal(millimetersToDesignPx(4000, 50), 200, "4 m converte de volta para 200 px de desenho");
assert.equal(formatDesignDistance(200, 50, "m", 2), "4,00 m", "distancia formatada respeita pt-BR");

const layers = normalizeLayerState({ iluminacao: false, circuits: { visible: false, locked: true, opacity: 0.4 } });
const legacyVisibility = layerVisibilityForLegacyCanvas(layers);
assert.equal(legacyVisibility.iluminacao, false, "layer legado de iluminacao mapeia para lighting");
assert.equal(legacyVisibility.infra, false, "layer de circuitos controla infra no canvas legado");
assert.equal(layers.circuits.locked, true, "estado de layer preserva bloqueio");

assert.equal(snapToleranceToDocument(8, 2), 4, "tolerancia visual deve reduzir em zoom alto");
const snapResult = snapPointToReferences({
  point: { x: 103, y: 109 },
  references: { x: [{ value: 100, type: "wall", id: "w1" }], y: [{ value: 100, type: "wall", id: "w1" }] },
  viewportScale: 2,
  tolerancePx: 8,
});
assert.equal(snapResult.point.x, 100, "snap x usa tolerancia visual convertida");
assert.equal(snapResult.point.y, 109, "y fora da tolerancia nao deve encaixar");

const viewport = { x: 60, y: 40 };
const pointer = { x: 420, y: 260 };
const before = screenToDesignPoint({ screen: pointer, viewport, scale: 1.2 });
const zoomed = zoomAtPoint({
  pointer,
  zoom: 1,
  zoomFactor: 1.2,
  baseScale: 1.2,
  stageWidth: 1000,
  stageHeight: 700,
  designWidth: 1400,
  designHeight: 900,
  viewport,
});
const nextViewport = {
  x: (1000 - 1400 * 1.44) / 2 + zoomed.pan.x,
  y: (700 - 900 * 1.44) / 2 + zoomed.pan.y,
};
const after = screenToDesignPoint({ screen: pointer, viewport: nextViewport, scale: 1.44 });
assert.equal(Math.round(after.x * 100) / 100, Math.round(before.x * 100) / 100, "zoom centralizado preserva x sob cursor");
assert.equal(Math.round(after.y * 100) / 100, Math.round(before.y * 100) / 100, "zoom centralizado preserva y sob cursor");

const migrated = normalizePlantDocument({
  pxPerMeter: 80,
  points: [{ id: "p1", type: "tug", x: 10, y: 20 }],
  walls: [{ id: "w1", x1: 0, y1: 0, x2: 10, y2: 0, thicknessCm: 12 }],
  routes: [{ id: "r1", path: [{ x: 10, y: 20 }, { x: 30, y: 40 }] }],
  layers: { tomadas: false },
});
assert.equal(migrated.schemaVersion, 1, "documento migrado recebe schemaVersion");
assert.equal(migrated.scalePxPerMeter, 80, "migra pxPerMeter legado");
assert.equal(migrated.points[0].layerId, "electrical", "ponto recebe layer tecnico");
assert.equal(migrated.walls[0].layerId, "walls", "parede recebe layer tecnico");
assert.equal(migrated.routes[0].source.x, 10, "rota legada por path vira cabo manual");
assert.equal(layerVisibilityForLegacyCanvas(migrated.layers).tomadas, false, "layers legados continuam abrindo");
assert.equal(normalizePlantDocument({}).showWallDimensions, true, "cotas de parede aparecem por padrao");
assert.equal(normalizePlantDocument({ showWallDimensions: false }).showWallDimensions, false, "preferencia de ocultar cotas persiste");

console.log("editor foundation smoke: ok");
