import assert from "node:assert/strict";

// Test placement logic for DIN rail components
const ROW_MAX = 18;

function clampNumber(val, min, max, fallback = min) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function placeComponentOnRailAtSlot(existingActive, movedComponent, targetSlot, compPoles, railId) {
  const poles = Math.max(1, Number(compPoles || movedComponent?.poles) || 1);
  const maxStart = ROW_MAX - poles + 1;
  const clampedTarget = clampNumber(Math.round(targetSlot), 1, maxStart, 1);

  const items = (existingActive || [])
    .filter((c) => c && c.id !== movedComponent?.id && c.type !== "spacer")
    .map((c) => {
      const rawPos = Number(c.dinPosition ?? c.startDin ?? c.slot);
      const cPoles = Math.max(1, Number(c.poles) || 1);
      return {
        ...c,
        start: Number.isFinite(rawPos) ? Math.round(rawPos) : 1,
        size: cPoles,
      };
    })
    .sort((a, b) => a.start - b.start);

  const moved = {
    ...movedComponent,
    railId,
    dinPosition: clampedTarget,
    startDin: clampedTarget,
    slot: clampedTarget,
    poles,
    moduleWidth: poles,
    dinSize: poles,
    start: clampedTarget,
    size: poles,
  };

  const targetEnd = clampedTarget + poles - 1;
  const hasCollision = items.some((item) => {
    const itemEnd = item.start + item.size - 1;
    return Math.max(clampedTarget, item.start) <= Math.min(targetEnd, itemEnd);
  });

  if (!hasCollision) {
    return [...items, moved].map((c) => {
      const pos = c.start;
      return {
        ...c,
        railId,
        dinPosition: pos,
        startDin: pos,
        slot: pos,
      };
    });
  }

  const beforeItems = [];
  const afterItems = [];

  for (const item of items) {
    if (item.start + item.size - 1 < clampedTarget) {
      beforeItems.push(item);
    } else {
      afterItems.push(item);
    }
  }

  let currentPos = clampedTarget + poles;
  const adjustedAfter = afterItems.map((item) => {
    const newStart = Math.max(item.start, currentPos);
    currentPos = newStart + item.size;
    return { ...item, start: newStart };
  });

  let allPlaced = [...beforeItems, moved, ...adjustedAfter];

  const lastItem = allPlaced[allPlaced.length - 1];
  if (lastItem) {
    const overflow = (lastItem.start + lastItem.size - 1) - ROW_MAX;
    if (overflow > 0) {
      for (let i = allPlaced.length - 1; i >= 0; i--) {
        const item = allPlaced[i];
        const nextLimit = i === allPlaced.length - 1 ? ROW_MAX - item.size + 1 : allPlaced[i + 1].start - item.size;
        item.start = Math.max(1, Math.min(item.start, nextLimit));
      }
      for (let i = 1; i < allPlaced.length; i++) {
        const prev = allPlaced[i - 1];
        const curr = allPlaced[i];
        if (curr.start < prev.start + prev.size) {
          curr.start = prev.start + prev.size;
        }
      }
    }
  }

  return allPlaced.map((c) => {
    const pos = c.start;
    return {
      ...c,
      railId,
      dinPosition: pos,
      startDin: pos,
      slot: pos,
    };
  });
}

function normalizeRailsLayout(currentRails) {
  let normalized = currentRails.map(r => ({
    ...r,
    components: (r.components || [])
      .filter(c => c.type !== "spacer")
      .sort((a, b) => {
        const aPos = Number(a.dinPosition ?? a.startDin ?? a.slot);
        const bPos = Number(b.dinPosition ?? b.startDin ?? b.slot);
        const aHasPosition = Number.isFinite(aPos);
        const bHasPosition = Number.isFinite(bPos);
        if (aHasPosition && bHasPosition && aPos !== bPos) return aPos - bPos;
        if (aHasPosition !== bHasPosition) return aHasPosition ? -1 : 1;
        return 0;
      })
  }));

  return normalized.map(r => {
    const activeComponents = [...(r.components || [])].sort((a, b) => {
      const aPos = Number(a.dinPosition ?? a.startDin ?? a.slot);
      const bPos = Number(b.dinPosition ?? b.startDin ?? b.slot);
      const aHasPosition = Number.isFinite(aPos);
      const bHasPosition = Number.isFinite(bPos);
      if (aHasPosition && bHasPosition && aPos !== bPos) return aPos - bPos;
      if (aHasPosition !== bHasPosition) return aHasPosition ? -1 : 1;
      return (r.components || []).indexOf(a) - (r.components || []).indexOf(b);
    });

    let nextDinPosition = 1;
    const positionedComponents = [];
    const addSpacer = (start, size) => {
      if (size <= 0) return;
      positionedComponents.push({
        id: `spacer_auto_${r.id}_${start}`,
        type: "spacer",
        poles: size,
        label: "RESERVA TÉCNICA",
        railId: r.id,
        dinPosition: start,
        startDin: start,
        slot: start,
        moduleWidth: size,
        dinSize: size,
      });
    };

    activeComponents.forEach((component, index) => {
      const dinSize = Math.max(1, Number(component.poles) || 1);
      const remainingDinSize = activeComponents
        .slice(index)
        .reduce((sum, item) => sum + Math.max(1, Number(item.poles) || 1), 0);
      const maxStartForRemaining = Math.max(nextDinPosition, ROW_MAX - remainingDinSize + 1);
      const rawPosition = Number(component.dinPosition ?? component.startDin ?? component.slot);
      const wantedPosition = Number.isFinite(rawPosition)
        ? clampNumber(Math.round(rawPosition), 1, maxStartForRemaining, nextDinPosition)
        : nextDinPosition;
      const startPosition = Math.max(nextDinPosition, wantedPosition);

      addSpacer(nextDinPosition, startPosition - nextDinPosition);

      const positioned = {
        ...component,
        railId: r.id,
        dinPosition: startPosition,
        startDin: startPosition,
        slot: startPosition,
        moduleWidth: dinSize,
        dinSize,
        poles: dinSize,
      };
      positionedComponents.push(positioned);
      nextDinPosition = startPosition + dinSize;
    });

    addSpacer(nextDinPosition, ROW_MAX - nextDinPosition + 1);
    return { ...r, components: positionedComponents };
  });
}

console.log("🧪 Iniciando testes de Posicionamento Livre no Trilho DIN...");

// Teste 1: Posicionar disjuntor em slot livre (ex: Módulo 10)
{
  const initial = [
    { id: "c1", label: "C1 - Ilum", poles: 1, dinPosition: 1 },
    { id: "dps_b", label: "DPS-B", poles: 1, dinPosition: 2 },
  ];
  const dpsA = { id: "dps_a", label: "DPS-A", poles: 1, dinPosition: 3 };

  // Usuário arrasta DPS-A para o slot 10
  const placed = placeComponentOnRailAtSlot(initial, dpsA, 10, 1, "rail_1");
  const normalized = normalizeRailsLayout([{ id: "rail_1", components: placed }])[0];

  const foundDpsA = normalized.components.find((c) => c.id === "dps_a");
  assert.equal(foundDpsA.dinPosition, 10, "DPS-A deve estar exatamente no slot 10");

  const spacerBefore = normalized.components.find((c) => c.type === "spacer" && c.dinPosition === 3);
  assert.ok(spacerBefore, "Deve existir reserva técnica entre slot 3 e 9");
  assert.equal(spacerBefore.poles, 7, "A reserva antes do slot 10 deve ter 7 módulos (3 a 9)");

  const spacerAfter = normalized.components.find((c) => c.type === "spacer" && c.dinPosition === 11);
  assert.ok(spacerAfter, "Deve existir reserva técnica do slot 11 ao final");
  assert.equal(spacerAfter.poles, 8, "A reserva após o slot 10 deve ter 8 módulos (11 a 18)");
  console.log("  ✓ Teste 1: Posicionamento livre no slot 10 aprovado!");
}

// Teste 2: Posicionar no final do trilho (slot 18)
{
  const initial = [
    { id: "c1", label: "C1", poles: 1, dinPosition: 1 },
  ];
  const dpsA = { id: "dps_a", label: "DPS-A", poles: 1 };

  const placed = placeComponentOnRailAtSlot(initial, dpsA, 18, 1, "rail_1");
  const normalized = normalizeRailsLayout([{ id: "rail_1", components: placed }])[0];

  const foundDpsA = normalized.components.find((c) => c.id === "dps_a");
  assert.equal(foundDpsA.dinPosition, 18, "DPS-A deve estar no slot 18");
  console.log("  ✓ Teste 2: Posicionamento no slot 18 (final do trilho) aprovado!");
}

// Teste 3: Colisão e empurrão ordenado
{
  const initial = [
    { id: "c1", label: "C1", poles: 1, dinPosition: 1 },
    { id: "c2", label: "C2", poles: 1, dinPosition: 2 },
  ];
  const c3 = { id: "c3", label: "C3", poles: 1 };

  // Solta no slot 2 (onde C2 estava)
  const placed = placeComponentOnRailAtSlot(initial, c3, 2, 1, "rail_1");
  const normalized = normalizeRailsLayout([{ id: "rail_1", components: placed }])[0];

  const foundC3 = normalized.components.find((c) => c.id === "c3");
  const foundC2 = normalized.components.find((c) => c.id === "c2");
  assert.equal(foundC3.dinPosition, 2, "C3 deve ocupar o slot 2");
  assert.equal(foundC2.dinPosition, 3, "C2 deve ser deslocado para o slot 3");
  console.log("  ✓ Teste 3: Resolução de colisão com empurrão ordenado aprovado!");
}

// Teste 4: Disjuntor bipolar (2 polos) posicionado no slot 17 (maxStart = 17)
{
  const comp2P = { id: "c_chuv", label: "Chuveiro 2P", poles: 2 };
  const placed = placeComponentOnRailAtSlot([], comp2P, 18, 2, "rail_1");
  const normalized = normalizeRailsLayout([{ id: "rail_1", components: placed }])[0];

  const found = normalized.components.find((c) => c.id === "c_chuv");
  assert.equal(found.dinPosition, 17, "Disjuntor 2P no slot 18 deve ser clampado para o slot 17");
  console.log("  ✓ Teste 4: Limite dimensional de disjuntor multipolar aprovado!");
}

console.log("🎉 TODOS OS TESTES DE POSICIONAMENTO LIVRE DIN APROVADOS COM SUCESSO!");
