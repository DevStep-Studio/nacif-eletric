/**
 * Motor Central de Sincronização Unificada do Projeto Elétrico
 * Garante uma ÚNICA FONTE DE VERDADE com sincronização bidirecional idempotente
 * entre Planta Elétrica, Circuitos, Dimensionamento NBR 5410, Quadro DIN e Sistema Solar.
 */

import {
  calcCircuit,
  calcProjectMetrics,
  auditProjectNBR5410,
  autoBalancePhases,
  selectBreaker,
  selectWireGauge,
  calcNominalCurrent,
  isSolarProject,
  findSolarInverterCircuit,
  getPrimaryPanelBoard,
  calculateProjectDemand,
} from "./electricalEngine.js";

const MOD = 18;
const MAX_DIN_PER_RAIL = 18;

// Helper para comparação segura de identificadores (string ou number)
export function sameEntityId(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// Limpeza e padronização de textos de exibição
export function cleanEntityText(text = "") {
  return String(text || "").trim();
}

// Extrai e normaliza pontos da planta
export function getPlantPoints(project = {}) {
  const points = project?.plant_design?.points || project?.points || [];
  return Array.isArray(points) ? points : [];
}

// Extrai e normaliza circuitos do projeto
export function getProjectCircuits(project = {}) {
  const circuits = project?.circuits || [];
  return Array.isArray(circuits) ? circuits : [];
}

/**
 * 1. SINCRONIZAÇÃO PLANTA → CIRCUITOS
 * Agrupa os pontos elétricos da planta por circuito, soma as potências reais,
 * recalcula os dimensionamentos (NBR 5410) e valida proteções existentes.
 */
export function syncPlantPointsToCircuits(project = {}, plantPoints = null) {
  const points = plantPoints !== null ? plantPoints : getPlantPoints(project);
  const currentCircuits = getProjectCircuits(project);
  const supplyType = project?.supply_type || "Trifásico";
  const defaultVoltage = Number(project?.voltage) || 220;

  // Mapear pontos agrupados por circuito
  const pointsByCircuitRef = new Map();
  const unlinkedPoints = [];

  points.forEach((point) => {
    // Ignorar interruptores que apenas comandam luminárias (não somam carga de potência própria)
    const pType = String(point?.type || "").toLowerCase();
    const isControlSwitch = pType.includes("interruptor") && !pType.includes("paralelo_carga");
    
    const circuitRef = point?.circuit_id || point?.circuit_name || point?.circuitId || point?.circuitRef;
    if (!circuitRef) {
      unlinkedPoints.push(point);
      return;
    }

    const key = String(circuitRef).trim().toLowerCase();
    if (!pointsByCircuitRef.has(key)) {
      pointsByCircuitRef.set(key, {
        ref: circuitRef,
        points: [],
        loadWTotal: 0,
        rooms: new Set(),
      });
    }

    const group = pointsByCircuitRef.get(key);
    group.points.push(point);

    if (!isControlSwitch) {
      const load = Number(point?.load_w !== undefined && point?.load_w !== ""
        ? point.load_w
        : (point?.power_w !== undefined && point?.power_w !== "" ? point.power_w : point?.power_va || 0));
      group.loadWTotal += Number.isFinite(load) && load > 0 ? load : 0;
    }

    const roomName = cleanEntityText(point?.room_name || point?.room || point?.room_id);
    if (roomName) group.rooms.add(roomName);
  });

  // Atualizar circuitos existentes ou criar novos a partir da planta
  const processedKeys = new Set();
  const updatedCircuits = currentCircuits.map((c, idx) => {
    const cId = String(c.id || c.circuit_id || `circuit_${idx}`).trim().toLowerCase();
    const cName = String(c.name || c.label || "").trim().toLowerCase();
    const cNum = String(c.circuit_number || c.circuitNumber || idx + 1);

    // Encontrar pontos correspondentes
    let matchGroup = null;
    for (const [key, group] of pointsByCircuitRef.entries()) {
      if (key === cId || key === cName || key === `c${cNum}` || key === `c0${cNum}`) {
        matchGroup = group;
        processedKeys.add(key);
        break;
      }
    }

    if (!matchGroup) {
      // Se não há pontos na planta vinculados diretamente a este circuito,
      // preservamos suas configurações e cargas manuais existentes!
      return { ...c };
    }

    // Circuito possui pontos na planta: atualizar carga calculada real
    const totalPlantLoad = matchGroup.loadWTotal;
    const finalLoadW = totalPlantLoad > 0 ? totalPlantLoad : Number(c.power_w || c.load_w_total || 0);
    const roomsList = Array.from(matchGroup.rooms);
    const roomsText = roomsList.length > 0 ? roomsList.join(", ") : (c.rooms || c.description || "");

    const enrichedDraft = {
      ...c,
      power_w: finalLoadW,
      load_w_total: finalLoadW,
      point_count: matchGroup.points.length,
      rooms: roomsText,
      source: c.source || "planta",
    };

    // Recalcular dimensionamento pelo motor NBR 5410
    const sized = calcCircuit(enrichedDraft);

    // Verificar compatibilidade de disjuntor manual (se o usuário escolheu manual anteriormente)
    let breakerManualWarning = null;
    if (c.manual_breaker && Number(c.breaker_a) > 0) {
      const manualA = Number(c.breaker_a);
      const reqA = Number(sized.nominal_current || sized.current);
      if (manualA < reqA) {
        breakerManualWarning = `Disjuntor manual (${manualA}A) menor que a corrente de projeto calculada (${reqA.toFixed(1)}A).`;
      }
    }

    return {
      ...sized,
      breaker_manual_warning: breakerManualWarning,
      has_manual_override: Boolean(c.manual_breaker),
    };
  });

  // Criar circuitos novos para grupos de pontos que ainda não constam na lista de circuitos
  let nextCircuitNum = updatedCircuits.length + 1;
  pointsByCircuitRef.forEach((group, key) => {
    if (processedKeys.has(key)) return;

    const samplePoint = group.points[0] || {};
    const pType = String(samplePoint.type || "").toLowerCase();
    
    let circuitType = "Tomadas de Uso Geral";
    let circuitCurve = "C";
    let circuitPoles = 1;
    let needsDr = true;

    if (pType.includes("ilumin")) {
      circuitType = "Iluminação";
      circuitCurve = "B";
      needsDr = false;
    } else if (pType.includes("chuveiro") || pType.includes("ducha")) {
      circuitType = "Chuveiro";
      circuitCurve = "B";
      circuitPoles = supplyType === "Monofásico" ? 1 : 2;
    } else if (pType.includes("arcond") || pType.includes("ar_condicionado")) {
      circuitType = "Ar Condicionado";
      circuitCurve = "D";
      circuitPoles = supplyType === "Monofásico" ? 1 : 2;
    } else if (pType.includes("motor") || pType.includes("bomba")) {
      circuitType = "Motor";
      circuitCurve = "D";
    }

    const cId = `ckt_plant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cName = cleanEntityText(group.ref) || `C${nextCircuitNum} - ${circuitType}`;
    const roomsList = Array.from(group.rooms);

    const newCircuitDraft = {
      id: cId,
      circuit_id: cId,
      name: cName,
      label: cName,
      circuit_number: nextCircuitNum,
      type: circuitType,
      power_w: Math.max(100, group.loadWTotal),
      load_w_total: Math.max(100, group.loadWTotal),
      voltage: defaultVoltage,
      supply_type: circuitPoles === 3 ? "Trifásico" : circuitPoles === 2 ? "Bifásico" : "Monofásico",
      phase: circuitPoles === 3 ? "ABC" : circuitPoles === 2 ? "AB" : "A",
      breaker_poles: circuitPoles,
      breaker_curve: circuitCurve,
      point_count: group.points.length,
      rooms: roomsList.join(", "),
      source: "planta",
      needs_dr: needsDr,
    };

    nextCircuitNum += 1;
    const sizedNewCircuit = calcCircuit(newCircuitDraft);
    updatedCircuits.push(sizedNewCircuit);
  });

  return {
    circuits: updatedCircuits,
    unlinkedPointsCount: unlinkedPoints.length,
    unlinkedPoints,
  };
}

/**
 * 2. SINCRONIZAÇÃO CIRCUITOS → QUADRO ELÉTRICO DIN (NÃO-DESTRUTIVA E IDEMPOTENTE)
 * Atualiza parâmetros dos disjuntores existentes SEM mover posições customizadas no trilho.
 * Se houver novos circuitos, aloca-os em espaços livres ou na reserva técnica.
 */
export function syncCircuitsToPanelBoard(project = {}, options = {}) {
  const circuits = getProjectCircuits(project);
  const currentBoards = Array.isArray(project?.panel_boards) && project.panel_boards.length > 0
    ? project.panel_boards
    : [];

  const primaryBoard = getPrimaryPanelBoard(currentBoards) || currentBoards[0] || {
    id: "board-principal",
    name: "Quadro de Distribuição (QD)",
    type: "distribution",
    layout: project?.panel_layout || { rails: [], wires: [], infrastructure: [] },
  };

  const layout = primaryBoard.layout || project?.panel_layout || { rails: [], wires: [], infrastructure: [] };
  const currentRails = Array.isArray(layout.rails) ? layout.rails : [];
  const currentWires = Array.isArray(layout.wires) ? layout.wires : [];
  const currentInfra = Array.isArray(layout.infrastructure) ? layout.infrastructure : [];

  // Se o quadro não tiver trilhos ainda, inicializar 2 trilhos padrão
  let rails = currentRails.length > 0 ? currentRails.map((r) => ({ ...r, components: [...(r.components || [])] })) : [
    { id: "rail_1", name: "Trilho DIN Superior (Entrada e Proteção)", components: [] },
    { id: "rail_2", name: "Trilho DIN Central (Distribuição)", components: [] },
  ];

  // Identificar componentes de proteção já instalados no quadro
  const allInstalled = rails.flatMap((r) => r.components || []);
  const matchedCircuitIds = new Set();

  // Atualizar componentes existentes
  rails = rails.map((rail) => ({
    ...rail,
    components: rail.components.map((comp) => {
      if (!comp || comp.type !== "breaker" || comp.isGeneral || comp.id === "gen_brk") {
        return comp;
      }

      // Localizar circuito correspondente
      const matched = circuits.find((c, cIdx) => (
        sameEntityId(comp.circuit_id, c.id) ||
        sameEntityId(comp.id, c.id) ||
        sameEntityId(comp.circuitNumber, c.circuit_number) ||
        sameEntityId(comp.label, c.name) ||
        comp.id === `circuit_${cIdx}`
      ));

      if (!matched) return comp;

      matchedCircuitIds.add(matched.id);
      const poles = Number(matched.breaker_poles) || (matched.supply_type === "Trifásico" ? 3 : matched.supply_type === "Bifásico" ? 2 : 1);
      const displayLabel = cleanEntityText(matched.name || comp.label);

      return {
        ...comp,
        circuit_id: matched.id,
        label: displayLabel,
        current: Number(matched.breaker_a) || comp.current || 16,
        curve: matched.breaker_curve || comp.curve || "C",
        poles,
        phase: matched.phase || comp.phase || "A",
        supply_type: matched.supply_type || comp.supply_type || "Monofásico",
        circuitNumber: matched.circuit_number || comp.circuitNumber,
      };
    }),
  }));

  // Adicionar novos circuitos que ainda não estão presentes nos trilhos
  const newCircuits = circuits.filter((c) => !matchedCircuitIds.has(c.id));
  if (newCircuits.length > 0) {
    // Distribuir novos disjuntores no trilho de distribuição (rail_2 ou último trilho ativo)
    let targetRailIndex = rails.length > 1 ? 1 : 0;

    newCircuits.forEach((circuit) => {
      const poles = Number(circuit.breaker_poles) || (circuit.supply_type === "Trifásico" ? 3 : circuit.supply_type === "Bifásico" ? 2 : 1);
      const newComp = {
        id: `comp_${circuit.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        circuit_id: circuit.id,
        type: "breaker",
        label: cleanEntityText(circuit.name) || `Circuito ${circuit.circuit_number}`,
        current: Number(circuit.breaker_a) || 16,
        curve: circuit.breaker_curve || "C",
        poles,
        phase: circuit.phase || "A",
        supply_type: circuit.supply_type || "Monofásico",
        circuitNumber: circuit.circuit_number,
        status: "ON",
      };

      // Verificar capacidade do trilho alvo
      const targetRail = rails[targetRailIndex];
      const usedPoles = (targetRail.components || []).filter((c) => c.type !== "spacer").reduce((sum, c) => sum + (Number(c.poles) || 1), 0);

      if (usedPoles + poles > MAX_DIN_PER_RAIL && targetRailIndex < rails.length - 1) {
        targetRailIndex += 1;
      }

      // Remover spacer/reserva se existir e inserir disjuntor
      const nonSpacers = (rails[targetRailIndex].components || []).filter((c) => c.type !== "spacer");
      nonSpacers.push(newComp);

      // Recalcular reserva técnica no final do trilho
      const currentUsed = nonSpacers.reduce((sum, c) => sum + (Number(c.poles) || 1), 0);
      const remainingFree = Math.max(0, MAX_DIN_PER_RAIL - currentUsed);
      const componentsWithReserve = [...nonSpacers];
      if (remainingFree > 0) {
        componentsWithReserve.push({
          id: `spacer_rail_${targetRailIndex + 1}`,
          type: "spacer",
          poles: remainingFree,
          label: "RESERVA TÉCNICA",
        });
      }

      rails[targetRailIndex].components = componentsWithReserve;
    });
  }

  const updatedLayout = {
    ...layout,
    rails,
    wires: currentWires,
    infrastructure: currentInfra,
    meta: {
      ...(layout.meta || {}),
      lastSyncAt: new Date().toISOString(),
      syncedCircuitsCount: circuits.length,
    },
  };

  const updatedBoards = currentBoards.map((b) => (
    b.id === primaryBoard.id ? { ...b, layout: updatedLayout } : b
  ));

  if (!updatedBoards.some((b) => b.id === primaryBoard.id)) {
    updatedBoards.unshift({ ...primaryBoard, layout: updatedLayout });
  }

  return {
    panel_boards: updatedBoards,
    panel_layout: updatedLayout,
    primaryBoardId: primaryBoard.id,
  };
}

/**
 * 3. SINCRONIZAÇÃO QUADRO → CIRCUITOS E PLANTA
 * Quando o usuário edita um disjuntor no quadro elétrico (corrente, curva, fase, nome),
 * a alteração propaga imediatamente para project.circuits e revalida os cabos.
 */
export function syncPanelDeviceToCircuit(project = {}, componentId, fieldUpdates = {}) {
  const circuits = getProjectCircuits(project);
  const plantPoints = getPlantPoints(project);

  let targetCircuitIndex = -1;
  circuits.forEach((c, idx) => {
    if (sameEntityId(c.id, componentId) ||
        sameEntityId(c.circuit_id, componentId) ||
        sameEntityId(c.circuitNumber, fieldUpdates.circuitNumber) ||
        sameEntityId(c.name, fieldUpdates.label)) {
      targetCircuitIndex = idx;
    }
  });

  if (targetCircuitIndex === -1) {
    return { project, modified: false };
  }

  const currentCircuit = circuits[targetCircuitIndex];
  const nextCircuit = { ...currentCircuit };

  if (fieldUpdates.current !== undefined) nextCircuit.breaker_a = Number(fieldUpdates.current);
  if (fieldUpdates.curve !== undefined) nextCircuit.breaker_curve = String(fieldUpdates.curve);
  if (fieldUpdates.phase !== undefined) nextCircuit.phase = String(fieldUpdates.phase);
  if (fieldUpdates.supply_type !== undefined) nextCircuit.supply_type = String(fieldUpdates.supply_type);
  if (fieldUpdates.label !== undefined) {
    nextCircuit.name = cleanEntityText(fieldUpdates.label);
    nextCircuit.label = cleanEntityText(fieldUpdates.label);
  }
  if (fieldUpdates.circuitNumber !== undefined) nextCircuit.circuit_number = fieldUpdates.circuitNumber;

  // Marcar como customização manual confirmada pelo usuário
  nextCircuit.manual_breaker = true;

  // Re-auditar circuito
  const auditedCircuit = calcCircuit(nextCircuit);

  // Verificar se o disjuntor manual suporta a corrente do circuito
  const nominalIb = Number(auditedCircuit.project_current_a || auditedCircuit.nominal_current_a || auditedCircuit.nominal_current || auditedCircuit.current || 0);
  if (nextCircuit.breaker_a < nominalIb) {
    auditedCircuit.validation_status = "incompatible";
    auditedCircuit.validation_message = `Disjuntor manual (${nextCircuit.breaker_a}A) é inferior à corrente de projeto (${nominalIb.toFixed(1)}A). Risco de desarme indevido NBR 5410.`;
  } else {
    auditedCircuit.validation_status = "valid";
  }

  const nextCircuits = [...circuits];
  nextCircuits[targetCircuitIndex] = auditedCircuit;

  // Atualizar pontos da planta que referenciam este circuito
  const nextPlantPoints = plantPoints.map((p) => {
    if (sameEntityId(p.circuit_id, currentCircuit.id) || sameEntityId(p.circuit_name, currentCircuit.name)) {
      return {
        ...p,
        circuit_id: auditedCircuit.id,
        circuit_name: auditedCircuit.name,
        phase: auditedCircuit.phase,
      };
    }
    return p;
  });

  const nextProject = {
    ...project,
    circuits: nextCircuits,
    plant_design: project.plant_design ? { ...project.plant_design, points: nextPlantPoints } : project.plant_design,
  };

  return {
    project: nextProject,
    circuit: auditedCircuit,
    modified: true,
  };
}

/**
 * 4. SINCRONIZAÇÃO SISTEMA SOLAR → MODELO ELÉTRICO
 * Extrai inversores, calcula corrente CA e proteções NBR 16690 e reflete no quadro.
 */
export function syncSolarToProjectCircuits(project = {}, solarConfig = null) {
  const config = solarConfig || project?.solar_config;
  if (!config) return { project, solarCircuit: null };

  const acVoltage = Number(config.ac_voltage) || 220;
  const acSupply = config.ac_supply_type || "Bifásico";
  const dcPowerKw = Number(config.dc_power_kw || config.system_size_kw || 5);
  const inverterPowerKw = Number(config.inverter_power_kw || dcPowerKw);
  const powerW = Math.round(inverterPowerKw * 1000);

  // Corrente nominal CA do inversor
  const acCurrent = calcNominalCurrent(powerW, acVoltage, acSupply, 0.98);
  // Proteção NBR 16690: disjuntor mínimo de 1.25 * I_ac
  const recommendedBreakerA = selectBreaker(acCurrent * 1.25);
  const poles = acSupply === "Trifásico" ? 3 : acSupply === "Bifásico" ? 2 : 1;
  const phase = acSupply === "Trifásico" ? "ABC" : acSupply === "Bifásico" ? "AB" : "A";
  const wireGauge = selectWireGauge(recommendedBreakerA);

  const solarCircuitId = "ckt_solar_inverter";
  const solarCircuitName = "C_SOLAR - Inversor Fotovoltaico";

  const solarCircuit = {
    id: solarCircuitId,
    circuit_id: solarCircuitId,
    name: solarCircuitName,
    label: solarCircuitName,
    circuit_number: "SOLAR",
    type: "Solar Fotovoltaico",
    power_w: powerW,
    load_w_total: powerW,
    voltage: acVoltage,
    supply_type: acSupply,
    phase,
    breaker_poles: poles,
    breaker_a: recommendedBreakerA,
    breaker_curve: "C",
    wire_gauge: wireGauge,
    is_solar: true,
    source: "solar",
    needs_dr: false,
    demand_factor: 1.0,
    demand_power_w: powerW,
  };

  const currentCircuits = getProjectCircuits(project);
  const existingIdx = currentCircuits.findIndex((c) => (
    c.id === solarCircuitId || /inversor|solar fotovoltaico/i.test(`${c.name} ${c.type}`)
  ));

  let nextCircuits = [...currentCircuits];
  if (existingIdx >= 0) {
    nextCircuits[existingIdx] = { ...nextCircuits[existingIdx], ...solarCircuit };
  } else {
    nextCircuits.push(solarCircuit);
  }

  const nextProject = {
    ...project,
    circuits: nextCircuits,
  };

  // Sincronizar quadro DIN preservando layout existente
  const panelSync = syncCircuitsToPanelBoard(nextProject);

  return {
    project: {
      ...nextProject,
      panel_boards: panelSync.panel_boards,
      panel_layout: panelSync.panel_layout,
    },
    solarCircuit,
  };
}

/**
 * 5. VALIDAÇÃO TÉCNICA CENTRALIZADA DO PROJETO UNIFICADO
 * Identifica discrepâncias entre planta, circuitos, proteções, quadro e solar.
 */
export function validateUnifiedProject(project = {}) {
  const circuits = getProjectCircuits(project);
  const plantPoints = getPlantPoints(project);
  const metrics = calcProjectMetrics(project);
  const nbrAudit = auditProjectNBR5410(project, metrics);

  const issues = [];

  // 1. Pontos da planta sem circuito vinculado
  const unlinkedPoints = plantPoints.filter((p) => {
    const pType = String(p.type || "").toLowerCase();
    if (pType.includes("interruptor")) return false;
    return !p.circuit_id && !p.circuit_name && !p.circuitId;
  });

  if (unlinkedPoints.length > 0) {
    issues.push({
      id: "unlinked-plant-points",
      type: "warning",
      category: "plant",
      title: "Pontos sem circuito atribuído",
      description: `${unlinkedPoints.length} ponto(s) elétrico(s) na planta não possuem circuito atribuído.`,
      action: "associar_circuito",
    });
  }

  // 2. Circuitos com disjuntor manual subdimensionado
  circuits.forEach((c) => {
    if (c.breaker_manual_warning) {
      issues.push({
        id: `breaker-undersized-${c.id}`,
        type: "error",
        category: "circuit",
        title: `Disjuntor incompatível no circuito ${c.name}`,
        description: c.breaker_manual_warning,
        action: "ajustar_disjuntor",
      });
    }
  });

  // 3. Auditoria NBR 5410 (Sobrecargas, DR, DPS)
  if (Array.isArray(nbrAudit?.warnings)) {
    nbrAudit.warnings.forEach((w, idx) => {
      issues.push({
        id: `nbr5410-warn-${idx}`,
        type: "warning",
        category: "nbr5410",
        title: "Requisito NBR 5410",
        description: typeof w === "string" ? w : w.message || "Aviso normativo.",
      });
    });
  }

  // 4. Verificação de ocupação dos trilhos DIN do quadro
  const boards = Array.isArray(project.panel_boards) ? project.panel_boards : [];
  boards.forEach((board) => {
    const rails = board?.layout?.rails || [];
    rails.forEach((rail, rIdx) => {
      const activePoles = (rail.components || []).filter((c) => c.type !== "spacer").reduce((sum, c) => sum + (Number(c.poles) || 1), 0);
      if (activePoles > MAX_DIN_PER_RAIL) {
        issues.push({
          id: `rail-overflow-${board.id}-${rIdx}`,
          type: "error",
          category: "panel",
          title: `Sobrecarga física no trilho T${rIdx + 1} (${board.name || "Quadro"})`,
          description: `Trilho com ${activePoles} módulos DIN ocupados (capacidade máxima recomendada: ${MAX_DIN_PER_RAIL} DIN).`,
          action: "reorganizar_trilhos",
        });
      }
    });
  });

  return {
    valid: !issues.some((i) => i.type === "error"),
    issues,
    summary: {
      pointsCount: plantPoints.length,
      unlinkedPointsCount: unlinkedPoints.length,
      circuitsCount: circuits.length,
      totalDemandW: calculateProjectDemand(circuits),
      totalPowerW: circuits.reduce((sum, c) => sum + (Number(c.power_w) || 0), 0),
      imbalancePct: metrics?.storedImbalance_pct || 0,
      isSolar: isSolarProject(project),
    },
  };
}

/**
 * 6. SINCRONIZADOR GLOBAL DO PROJETO (ORQUESTRADOR CENTRAL)
 */
export function buildUnifiedSyncPayload(project = {}, options = {}) {
  // 1. Sincronizar pontos da planta para os circuitos
  const plantSync = syncPlantPointsToCircuits(project);
  const syncedCircuits = plantSync.circuits;

  // 2. Calcular demanda e métricas unificadas
  const totalDemand = calculateProjectDemand(syncedCircuits);
  const intermediateProject = {
    ...project,
    circuits: syncedCircuits,
    total_demand_w: totalDemand,
  };

  // 3. Sincronizar quadro elétrico preservando layouts
  const panelSync = syncCircuitsToPanelBoard(intermediateProject, options);

  // 4. Se for projeto solar, sincronizar inversor e proteções
  let finalProject = {
    ...intermediateProject,
    panel_boards: panelSync.panel_boards,
    panel_layout: panelSync.panel_layout,
    // PRESERVAR O DIAGRAMA UNIFILAR SE EXISTIR
    diagram_layout: project.diagram_layout || null,
  };

  if (isSolarProject(project)) {
    const solarSync = syncSolarToProjectCircuits(finalProject);
    finalProject = solarSync.project;
  }

  const validation = validateUnifiedProject(finalProject);

  return {
    project: finalProject,
    circuits: finalProject.circuits,
    total_demand_w: totalDemand,
    panel_boards: finalProject.panel_boards,
    panel_layout: finalProject.panel_layout,
    diagram_layout: finalProject.diagram_layout,
    validation,
  };
}
