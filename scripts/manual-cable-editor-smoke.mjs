import assert from "node:assert/strict";

import {
  addCableNode,
  cablePath,
  createManualCable,
  duplicateCable,
  moveCable,
  normalizeCableInstallationMode,
  normalizeCableRoute,
  pointToTerminal,
  removeCableNode,
  syncCableFromPath,
  updateCableNode,
  updateCablesForMovedComponent,
  validateCableConnections,
} from "../src/lib/manualCableEditor.js";

const qd = { id: "qd-01", type: "qe", x: 12, y: 18 };
const light = { id: "lamp-01", type: "luminaria", x: 72, y: 44 };
const outlet = { id: "tomada-01", type: "tug", x: 55, y: 66 };

const qdTerminal = pointToTerminal(qd);
const lightTerminal = pointToTerminal(light);
const outletTerminal = pointToTerminal(outlet);
const terminals = [
  { ...qdTerminal, label: "QD" },
  { ...lightTerminal, label: "Luminaria" },
  { ...outletTerminal, label: "Tomada" },
];

const assertPathPoint = (point, x, y, message) => {
  assert.equal(point.x, x, `${message} x`);
  assert.equal(point.y, y, `${message} y`);
};

const terminalCable = createManualCable({
  source: qdTerminal,
  target: lightTerminal,
  name: "Circuito luz",
  type: "L1",
  color: "#111827",
  thickness: 1.2,
});
assert.equal(terminalCable.source.componentId, "qd-01", "cria cabo entre terminais com origem conectada");
assert.equal(terminalCable.target.componentId, "lamp-01", "cria cabo entre terminais com destino conectado");
assert.equal(cablePath(terminalCable).length, 2, "cabo terminal-terminal inicia com duas pontas");

const freeCable = createManualCable({
  source: { x: 20, y: 20 },
  target: { x: 40, y: 35 },
  routingMode: "curved",
});
assert.equal(freeCable.source.componentId, undefined, "cria cabo entre pontos livres");
assert.equal(freeCable.routingMode, "curved", "preserva modo curvo");

const oneEndpointCable = createManualCable({
  source: qdTerminal,
  target: { x: 38, y: 72 },
});
assert.equal(oneEndpointCable.source.componentId, "qd-01", "permite somente uma extremidade conectada");
assert.equal(oneEndpointCable.target.componentId, undefined, "outra extremidade pode ficar livre");

const disconnectedSource = updateCableNode(terminalCable, 0, { x: 16, y: 22 });
assert.equal(disconnectedSource.source.componentId, undefined, "desconecta origem quando ponta sai do terminal sem snap");
assertPathPoint(cablePath(disconnectedSource)[0], 16, 22, "origem desconectada move");

const movedSource = updateCableNode(terminalCable, 0, { x: 13, y: 19 }, {
  componentId: "qd-01",
  terminalId: qdTerminal.terminalId,
});
assert.equal(movedSource.source.componentId, "qd-01", "move origem e mantém terminal quando há snap");
assertPathPoint(cablePath(movedSource)[0], 13, 19, "origem conectada move");

const movedTarget = updateCableNode(terminalCable, 1, { x: 75, y: 46 }, {
  componentId: "lamp-01",
  terminalId: lightTerminal.terminalId,
});
assert.equal(movedTarget.target.componentId, "lamp-01", "move destino conectado");
assertPathPoint(cablePath(movedTarget).at(-1), 75, 46, "destino conectado move");

const withMiddle = addCableNode(terminalCable, { x: 34, y: 18 }, 1);
assert.equal(cablePath(withMiddle).length, 3, "adiciona ponto intermediario");
const movedMiddle = updateCableNode(withMiddle, 1, { x: 36, y: 26 });
assertPathPoint(cablePath(movedMiddle)[1], 36, 26, "move ponto intermediario");
const removedMiddle = removeCableNode(movedMiddle, 1);
assert.equal(cablePath(removedMiddle).length, 2, "exclui ponto intermediario sem quebrar cabo");

const beforeComponentMove = JSON.stringify(cablePath(withMiddle));
const movedConnected = updateCablesForMovedComponent([withMiddle], "qd-01", {
  ...qdTerminal,
  x: 18,
  y: 24,
})[0];
assertPathPoint(cablePath(movedConnected)[0], 18, 24, "mover componente conectado move somente ponta presa");
assertPathPoint(cablePath(movedConnected)[1], 34, 18, "mover componente conectado preserva ponto intermediario");
assert.notEqual(JSON.stringify(cablePath(movedConnected)), beforeComponentMove, "cabo conectado atualiza apenas o necessario");

const freeBefore = JSON.stringify(freeCable);
const freeAfterComponentMove = updateCablesForMovedComponent([freeCable], "qd-01", {
  ...qdTerminal,
  x: 25,
  y: 25,
})[0];
assert.equal(JSON.stringify(freeAfterComponentMove), freeBefore, "mover componente nao conectado nao altera cabo livre");

const movedWholeCable = moveCable(withMiddle, 2, 3);
assertPathPoint(cablePath(movedWholeCable)[0], 12, 18, "arrastar cabo com origem conectada preserva origem");
assertPathPoint(cablePath(movedWholeCable)[1], 36, 21, "arrastar cabo move pontos intermediarios");
assertPathPoint(cablePath(movedWholeCable)[2], 72, 44, "arrastar cabo com destino conectado preserva destino");

const duplicated = duplicateCable(withMiddle, 9);
assert.notEqual(duplicated.id, withMiddle.id, "duplica cabo com novo id");
assert.equal(duplicated.source.componentId, undefined, "duplicata fica livre na origem");
assert.equal(duplicated.target.componentId, undefined, "duplicata fica livre no destino");
assert.equal(duplicated.zIndex, 9, "duplicata preserva camada informada");

const persisted = normalizeCableRoute(JSON.parse(JSON.stringify({
  ...withMiddle,
  routingMode: "orthogonal",
  routeMode: "manual",
  locked: true,
  visible: false,
  zIndex: 4,
})));
assert.equal(persisted.routingMode, "orthogonal", "salva e recarrega modo ortogonal");
assert.equal(persisted.routeMode, "manual", "salva e recarrega modo manual da rota");
assert.equal(persisted.locked, true, "salva e recarrega bloqueio");
assert.equal(persisted.visible, false, "salva e recarrega visibilidade");
assert.equal(persisted.points.length, 1, "salva e recarrega pontos intermediarios");
assert.equal(normalizeCableRoute({ ...persisted, mode: "piso" }).mode, "piso", "preserva instalacao no piso");
assert.equal(normalizeCableRoute({ ...persisted, mode: "Teto/Parede" }).mode, "embutido", "converte instalacao teto/parede");
assert.equal(normalizeCableRoute({ ...persisted, mode: "externo aparente" }).mode, "externa", "converte instalacao aparente");
assert.equal(normalizeCableInstallationMode("floor"), "piso", "normaliza alias floor");
assert.equal(normalizeCableInstallationMode("curved"), "embutido", "routing antigo nao vira instalacao invalida");

["free", "orthogonal", "curved"].forEach((routingMode) => {
  const cable = createManualCable({ source: { x: 1, y: 2 }, target: { x: 3, y: 4 }, routingMode });
  assert.equal(cable.routingMode, routingMode, `alterna modo ${routingMode}`);
});

const validationTarget = normalizeCableRoute({
  ...terminalCable,
  target: { componentId: "removed-point", terminalId: "missing-terminal", x: 80, y: 80 },
});
const beforeValidation = JSON.stringify(validationTarget);
const warnings = validateCableConnections([validationTarget], terminals);
assert.equal(JSON.stringify(validationTarget), beforeValidation, "validacao nao modifica o desenho");
assert.equal(warnings.some((warning) => warning.type === "terminal-not-found"), true, "validacao avisa terminal inexistente");

const directReset = syncCableFromPath(withMiddle, [cablePath(withMiddle)[0], cablePath(withMiddle).at(-1)]);
assert.equal(cablePath(directReset).length, 2, "reset manual remove apenas intermediarios");

const history = [[], [terminalCable], []];
assert.equal(history[0].length, 0, "historico simula estado antes de criar cabo");
assert.equal(history[1][0].id, terminalCable.id, "historico simula desfazer/refazer com cabo persistente");
assert.equal(history[2].length, 0, "historico simula excluir cabo");

const viewport = { x: 120, y: 80, scale: 1.75, panX: -35, panY: 42 };
const screenToPct = (screenX, screenY) => ({
  x: Math.round((((screenX - viewport.x - viewport.panX) / viewport.scale) / 1400) * 1000) / 10,
  y: Math.round((((screenY - viewport.y - viewport.panY) / viewport.scale) / 900) * 1000) / 10,
});
const zoomPanPoint = screenToPct(715, 437);
const zoomPanCable = addCableNode(freeCable, zoomPanPoint, 1);
assert.deepEqual(cablePath(zoomPanCable)[1], { id: cablePath(zoomPanCable)[1].id, ...zoomPanPoint }, "coordenadas percentuais independem de zoom/pan");

console.log("manual cable editor smoke: ok");
