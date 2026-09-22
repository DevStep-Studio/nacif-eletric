import assert from "node:assert/strict";
import {
  calcCircuit,
  calcMainProtection,
  calcNominalCurrent,
  calcCorrectedCurrent,
  calcProjectMetrics,
  calcVoltageDrop,
  selectBreaker,
  selectDrRating,
  selectWireGauge,
  selectFeederCable,
  mainProtectionPoles,
  normalizeElectricalPower,
  auditProjectNBR5410,
  generateDefaultPanelLayout,
  buildProjectElectricalSyncPayload,
  COMMERCIAL_BREAKER_RATINGS,
  DR_RATINGS,
} from "../src/lib/electricalEngine.js";

console.log("🧪 Iniciando bateria completa de 20 testes de conformidade elétrica NBR 5410...");

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 1: Sistema sem cargas cadastradas
// ─────────────────────────────────────────────────────────────────────────────
{
  const emptyProject = {
    name: "Projeto Vazio",
    supply_type: "Monofásico",
    voltage: 220,
    circuits: [],
  };

  const metrics = calcProjectMetrics(emptyProject);
  assert.equal(metrics.totalPower, 0, "T1: Potência instalada deve ser 0 W");
  assert.equal(metrics.totalDemandPower, 0, "T1: Demanda deve ser 0 W");
  assert.equal(metrics.generalCurrent, 0, "T1: Corrente geral deve ser 0 A");
  assert.equal(metrics.generalBreaker, null, "T1: Disjuntor geral NÃO deve ser fixo em 40 A (deve ser null)");
  assert.equal(metrics.generalDr, null, "T1: IDR geral deve ser null");
  assert.equal(metrics.mainProtection.status, "insufficient_data", "T1: Status deve indicar dados insuficientes");
  assert.equal(metrics.hasLoads, false, "T1: hasLoads deve ser false");
  assert.equal(metrics.audit.score, null, "T1: Score de auditoria NÃO pode ser 95% fixo (deve ser null/pendente)");
  assert.equal(metrics.audit.status, "pending", "T1: Status da auditoria deve ser pending");
  console.log("✅ 1. Sistema sem cargas cadastradas: OK (sem fallback de 40A nem 95%)");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 2: Adição de um circuito
// ─────────────────────────────────────────────────────────────────────────────
{
  const projectWithOne = {
    supply_type: "Monofásico",
    voltage: 220,
    circuits: [
      {
        id: "c1",
        name: "Iluminação Geral",
        type: "Iluminação",
        power_w: 1200,
        voltage: 220,
        supply_type: "Monofásico",
        power_factor: 0.95,
        demand_factor: 1.0,
      },
    ],
  };

  const metrics = calcProjectMetrics(projectWithOne);
  assert.equal(metrics.totalPower, 1200, "T2: Carga instalada = 1200 W");
  assert.equal(metrics.totalDemandPower, 1200, "T2: Demanda = 1200 W");
  // I = 1200 / (220 * 0.95) = 5.74 A
  assert.equal(metrics.generalCurrent, 5.7, "T2: Corrente geral calculada ~5.7 A");
  // Menor disjuntor comercial >= 5.74 A é 6A ou 10A
  assert.equal(metrics.generalBreaker, 6, "T2: Disjuntor geral selecionado comercial = 6 A");
  assert.equal(metrics.mainProtection.breaker.isVerified, true, "T2: Proteção geral verificada");
  console.log("✅ 2. Adição de um circuito: OK (recalculou carga, demanda, corrente e disjuntor)");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 3: Remoção de um circuito
// ─────────────────────────────────────────────────────────────────────────────
{
  const initial = {
    supply_type: "Monofásico",
    voltage: 220,
    circuits: [
      { id: "c1", name: "Luz", type: "Iluminação", power_w: 1000, voltage: 220, supply_type: "Monofásico" },
      { id: "c2", name: "Tomadas", type: "Tomadas de Uso Geral", power_w: 2000, voltage: 220, supply_type: "Monofásico" },
    ],
  };
  const afterRemove = {
    ...initial,
    circuits: [initial.circuits[0]],
  };

  const mBefore = calcProjectMetrics(initial);
  const mAfter = calcProjectMetrics(afterRemove);
  assert.ok(mBefore.totalPower > mAfter.totalPower, "T3: Potência reduzida após remoção");
  assert.ok(mBefore.generalCurrent > mAfter.generalCurrent, "T3: Corrente reduzida após remoção");
  console.log("✅ 3. Remoção de um circuito: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 4: Alteração da potência e transição de degraus de disjuntor
// ─────────────────────────────────────────────────────────────────────────────
{
  // Carga pequena: 2 kW em 220V -> ~9.5 A -> disjuntor 10 A
  const cSmall = calcCircuit({ power_w: 2000, voltage: 220, supply_type: "Monofásico", power_factor: 1.0, demand_factor: 1.0 });
  assert.equal(cSmall.breaker_a, 10, "T4: 2000W em 220V = Disjuntor 10A");

  // Aumenta para 5.5 kW em 220V -> 25 A -> disjuntor 25 A
  const cMed = calcCircuit({ power_w: 5500, voltage: 220, supply_type: "Monofásico", power_factor: 1.0, demand_factor: 1.0 });
  assert.equal(cMed.breaker_a, 25, "T4: 5500W em 220V = Disjuntor 25A");

  // Aumenta para 7.5 kW em 220V -> 34.09 A -> disjuntor 40 A
  const cLarge = calcCircuit({ power_w: 7500, voltage: 220, supply_type: "Monofásico", power_factor: 1.0, demand_factor: 1.0 });
  assert.equal(cLarge.breaker_a, 40, "T4: 7500W em 220V = Disjuntor 40A");

  // Aumenta para 12 kW em 220V -> 54.55 A -> disjuntor 63 A
  const cXLarge = calcCircuit({ power_w: 12000, voltage: 220, supply_type: "Monofásico", power_factor: 1.0, demand_factor: 1.0 });
  assert.equal(cXLarge.breaker_a, 63, "T4: 12000W em 220V = Disjuntor 63A");
  console.log("✅ 4. Alteração da potência com transição de disjuntores: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 5: Alteração da tensão (127V vs 220V vs 380V)
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = 5000; // 5000 W
  const i127 = calcNominalCurrent(p, 127, "Monofásico", 1.0);
  const i220 = calcNominalCurrent(p, 220, "Monofásico", 1.0);
  const i380 = calcNominalCurrent(p, 380, "Trifásico", 1.0);

  // I_127 = 5000 / 127 = 39.37 A
  assert.equal(i127, 39.37, "T5: 5000W em 127V = 39.37 A");
  // I_220 = 5000 / 220 = 22.73 A
  assert.equal(i220, 22.73, "T5: 5000W em 220V = 22.73 A");
  // I_380 (Trifásico) = 5000 / (sqrt(3) * 380) = 7.6 A
  assert.equal(i380, 7.6, "T5: 5000W em 380V Trifásico = 7.60 A");
  console.log("✅ 5. Alteração da tensão (127V, 220V, 380V): OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 6: Alteração do fator de potência (fp) e unidades (W, kW, VA, kVA, cv, HP)
// ─────────────────────────────────────────────────────────────────────────────
{
  // 10 kW com fp 1.0 -> 10 kVA -> I = 10000 / 220 = 45.45 A
  const cFp1 = calcCircuit({ power_w: 10000, voltage: 220, supply_type: "Monofásico", power_factor: 1.0, demand_factor: 1.0 });
  assert.equal(cFp1.nominal_current_a, 45.45, "T6: 10kW fp=1.0 = 45.45 A");

  // 10 kW com fp 0.80 -> 12.5 kVA -> I = 10000 / (220 * 0.80) = 56.82 A
  const cFp08 = calcCircuit({ power_w: 10000, voltage: 220, supply_type: "Monofásico", power_factor: 0.80, demand_factor: 1.0 });
  assert.equal(cFp08.nominal_current_a, 56.82, "T6: 10kW fp=0.80 = 56.82 A");
  assert.equal(cFp08.power_va, 12500, "T6: Potência aparente = 12500 VA");

  // Conversão de motor 5 cv com rendimento 85% e fp 0.85
  // P_mec = 5 * 735.5 = 3677.5 W; P_elec = 3677.5 / 0.85 = 4326.47 W
  const motorNorm = normalizeElectricalPower({ power: 5, power_unit: "CV", efficiency: 0.85, power_factor: 0.85 });
  assert.equal(Math.round(motorNorm.power_w), 4326, "T6: 5 cv @ 85% rendimento = 4326 W elétricos");
  console.log("✅ 6. Fator de potência e conversão de unidades/rendimento: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 7: Alimentação monofásica (F+N)
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = 4400; // 4400 W em 220V, fp = 1.0
  const I = calcNominalCurrent(p, 220, "Monofásico", 1.0);
  assert.equal(I, 20.0, "T7: I = 4400 / 220 = 20.0 A");
  const poles = mainProtectionPoles("Monofásico");
  assert.equal(poles.breaker, 2, "T7: Disjuntor monofásico com seccionamento de entrada = 2P");
  assert.equal(poles.dr, 2, "T7: IDR monofásico = 2P");
  console.log("✅ 7. Alimentação monofásica: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 8: Alimentação entre duas fases (carga ligada entre fases V_FF sem raiz de 3)
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = 4400; // 4400 W em 220V bifásico
  const I = calcNominalCurrent(p, 220, "Bifásico", 1.0);
  // I = P / (V_FF * fp) = 4400 / 220 = 20.0 A (NÃO divide por sqrt(3)!)
  assert.equal(I, 20.0, "T8: I bifásico entre fases em 220V = 20.0 A (sem sqrt(3))");
  const poles = mainProtectionPoles("Bifásico");
  assert.equal(poles.breaker, 2, "T8: Disjuntor geral bifásico = 2P");
  assert.equal(poles.dr, 2, "T8: IDR geral bifásico = 2P");
  console.log("✅ 8. Carga entre duas fases (Bifásico sem raiz de 3): OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 9: Trifásico equilibrado
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = 38000; // 38 kW em 380V, fp = 1.0
  const I = calcNominalCurrent(p, 380, "Trifásico", 1.0);
  // I = 38000 / (sqrt(3) * 380 * 1.0) = 57.74 A
  assert.equal(I, 57.74, "T9: 38kW 380V Trifásico equilibrado = 57.74 A");
  const poles = mainProtectionPoles("Trifásico");
  assert.equal(poles.breaker, 3, "T9: Disjuntor geral trifásico = 3P");
  assert.equal(poles.dr, 4, "T9: IDR geral trifásico (3F+N) = 4P");
  console.log("✅ 9. Trifásico equilibrado: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 10: Trifásico desequilibrado (correntes por fase individuais IA, IB, IC)
// ─────────────────────────────────────────────────────────────────────────────
{
  const unbalProject = {
    supply_type: "Trifásico",
    voltage: 380,
    circuits: [
      // Fase A com carga pesada de 6600 W em 220V (F-N) -> I = 30 A
      { id: "c1", name: "Chuveiro 1", type: "Chuveiro", phase: "A", power_w: 6600, voltage: 220, supply_type: "Monofásico", power_factor: 1.0, demand_factor: 1.0 },
      // Fase B com carga moderada de 2200 W em 220V (F-N) -> I = 10 A
      { id: "c2", name: "Tomadas B", type: "Tomadas de Uso Geral", phase: "B", power_w: 2200, voltage: 220, supply_type: "Monofásico", power_factor: 1.0, demand_factor: 1.0 },
      // Fase C com carga leve de 1100 W em 220V (F-N) -> I = 5 A
      { id: "c3", name: "Iluminação C", type: "Iluminação", phase: "C", power_w: 1100, voltage: 220, supply_type: "Monofásico", power_factor: 1.0, demand_factor: 1.0 },
    ],
  };

  const metrics = calcProjectMetrics(unbalProject);
  // Fase A: 30 A; Fase B: 10 A; Fase C: 5 A
  assert.equal(metrics.phaseLoad.A, 30.0, "T10: Fase A = 30 A");
  assert.equal(metrics.phaseLoad.B, 10.0, "T10: Fase B = 10 A");
  assert.equal(metrics.phaseLoad.C, 5.0, "T10: Fase C = 5 A");
  // Corrente de projeto geral Ib = max(IA, IB, IC) = 30 A
  assert.equal(metrics.generalCurrent, 30.0, "T10: Ib geral = max(30, 10, 5) = 30 A");
  // Disjuntor geral deve proteger a fase mais carregada (30 A -> 32 A)
  assert.equal(metrics.generalBreaker, 32, "T10: Disjuntor geral = 32 A");
  assert.ok(metrics.imbalance_pct > 10, "T10: Desequilíbrio severo detectado");
  console.log("✅ 10. Trifásico desequilibrado com correntes por fase individuais: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 11: Alteração dos fatores de demanda
// ─────────────────────────────────────────────────────────────────────────────
{
  const projDemand = {
    supply_type: "Monofásico",
    voltage: 220,
    circuits: [
      { id: "c1", name: "TUG Sala", type: "Tomadas de Uso Geral", power_w: 3000, voltage: 220, supply_type: "Monofásico", demand_factor: 0.70 },
      { id: "c2", name: "Ar Condicionado", type: "Ar Condicionado", power_w: 2000, voltage: 220, supply_type: "Monofásico", demand_factor: 0.85 },
    ],
  };
  const m = calcProjectMetrics(projDemand);
  assert.equal(m.totalInstalledPower, 5000, "T11: Potência instalada = 5000 W");
  // Demanda = 3000*0.7 + 2000*0.85 = 2100 + 1700 = 3800 W
  assert.equal(m.totalDemandPower, 3800, "T11: Demanda calculada = 3800 W");
  assert.equal(m.averageDemandFactor, 0.76, "T11: Fator de demanda médio = 3800/5000 = 0.76");
  console.log("✅ 11. Aplicação e cálculo de fatores de demanda: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 12: Atualização da corrente geral
// ─────────────────────────────────────────────────────────────────────────────
{
  const p1 = {
    supply_type: "Monofásico",
    voltage: 220,
    circuits: [{ id: "c1", name: "C1", type: "Chuveiro", power_w: 5500, voltage: 220, supply_type: "Monofásico", demand_factor: 1.0, power_factor: 1.0 }],
  };
  const m1 = calcProjectMetrics(p1);
  assert.equal(m1.generalCurrent, 25.0, "T12: Ib inicial = 25.0 A");

  // Adiciona segunda carga
  const p2 = {
    supply_type: "Monofásico",
    voltage: 220,
    circuits: [
      ...p1.circuits,
      { id: "c2", name: "C2", type: "Forno", power_w: 4400, voltage: 220, supply_type: "Monofásico", demand_factor: 1.0, power_factor: 1.0 },
    ],
  };
  const m2 = calcProjectMetrics(p2);
  assert.equal(m2.generalCurrent, 45.0, "T12: Ib atualizado = 25 + 20 = 45.0 A");
  console.log("✅ 12. Atualização dinâmica da corrente geral Ib: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 13: Reavaliação do disjuntor geral (Ib <= In <= Iz e I2 <= 1.45 Iz)
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = {
    supply_type: "Monofásico",
    voltage: 220,
    circuits: [
      { id: "c1", name: "C1", type: "Chuveiro", power_w: 7000, voltage: 220, supply_type: "Monofásico", demand_factor: 1.0, power_factor: 1.0 },
    ],
  };
  const m = calcProjectMetrics(p);
  // Ib = 7000 / 220 = 31.82 A
  assert.equal(m.generalCurrent, 31.8, "T13: Ib = 31.8 A");
  assert.equal(m.generalBreaker, 32, "T13: In = 32 A (menor comercial >= 31.8 A)");

  const prot = m.mainProtection;
  assert.equal(prot.breaker.current, 32, "T13: Disjuntor geral = 32 A");
  assert.ok(prot.feeder.iz >= 32, "T13: Capacidade do cabo Iz >= In");
  assert.equal(prot.breaker.isOverloaded, false, "T13: Sem sobrecarga");
  assert.equal(prot.breaker.isCableProtected, true, "T13: Cabo devidamente protegido");
  console.log("✅ 13. Reavaliação do disjuntor geral com verificação NBR 5410: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 14: Verificação de condutor e sobrecarga com disjuntor manual
// ─────────────────────────────────────────────────────────────────────────────
{
  // Projeto com demanda de 50 A, mas usuário força disjuntor subdimensionado de 32 A
  const pSub = {
    supply_type: "Monofásico",
    voltage: 220,
    manual_general_breaker: 32,
    circuits: [
      { id: "c1", name: "C1", type: "Chuveiro", power_w: 11000, voltage: 220, supply_type: "Monofásico", demand_factor: 1.0, power_factor: 1.0 },
    ],
  };
  const mSub = calcProjectMetrics(pSub);
  assert.equal(mSub.generalCurrent, 50.0, "T14: Ib = 50 A");
  assert.equal(mSub.mainProtection.breaker.current, 32, "T14: Preserva seleção manual de 32 A");
  assert.equal(mSub.mainProtection.breaker.isOverloaded, true, "T14: Detecta disjuntor subdimensionado In < Ib");
  assert.equal(mSub.mainProtection.breaker.status, "incompatible", "T14: Status incompatível");
  console.log("✅ 14. Detecção técnica de incompatibilidade e sobrecarga: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 15: Capacidade de interrupção
// ─────────────────────────────────────────────────────────────────────────────
{
  const c220 = calcCircuit({ power_w: 2000, voltage: 220, supply_type: "Monofásico" });
  assert.equal(c220.breaking_capacity_ka, 3, "T15: Capacidade de interrupção 220V = 3 kA");
  const c380 = calcCircuit({ power_w: 10000, voltage: 380, supply_type: "Trifásico" });
  assert.equal(c380.breaking_capacity_ka, 6, "T15: Capacidade de interrupção 380V = 6 kA");
  console.log("✅ 15. Capacidade de interrupção normatizada: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 16: Disjuntor manual compatível preservado
// ─────────────────────────────────────────────────────────────────────────────
{
  // Demanda de 20 A -> disjuntor automático seria 20 A ou 25 A; usuário escolhe 40 A
  const pManual = {
    supply_type: "Monofásico",
    voltage: 220,
    manual_general_breaker: 40,
    circuits: [
      { id: "c1", name: "C1", type: "Chuveiro", power_w: 4400, voltage: 220, supply_type: "Monofásico", demand_factor: 1.0, power_factor: 1.0 },
    ],
  };
  const m = calcProjectMetrics(pManual);
  assert.equal(m.mainProtection.breaker.current, 40, "T16: Preserva disjuntor manual de 40 A");
  assert.equal(m.mainProtection.breaker.isManual, true, "T16: Identifica como manual");
  assert.equal(m.mainProtection.breaker.isOverloaded, false, "T16: Sem sobrecarga (In=40A >= Ib=20A)");
  console.log("✅ 16. Disjuntor manual compatível com validação técnica: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 17: Persistência dos resultados e sincronização
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = {
    id: "proj-1",
    supply_type: "Bifásico",
    voltage: 220,
    circuits: [
      { id: "c1", name: "Ar 1", type: "Ar Condicionado", power_w: 2000, voltage: 220, supply_type: "Bifásico", demand_factor: 0.85 },
    ],
  };
  const syncPayload = buildProjectElectricalSyncPayload(p, p.circuits);
  assert.ok(syncPayload.total_demand_w > 0, "T17: Payload sincroniza demanda");
  assert.ok(Array.isArray(syncPayload.panel_boards), "T17: Payload sincroniza quadros");
  console.log("✅ 17. Sincronização e persistência de dados: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 18: Atualização dos dados expostos para os cartões
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = {
    supply_type: "Monofásico",
    voltage: 220,
    circuits: [
      { id: "c1", name: "Tomadas", type: "Tomadas de Uso Geral", power_w: 2200, voltage: 220, supply_type: "Monofásico", demand_factor: 0.70 },
    ],
  };
  const m = calcProjectMetrics(p);
  assert.equal(typeof m.totalInstalledPower, "number", "T18: expõe totalInstalledPower");
  assert.equal(typeof m.totalDemandPower, "number", "T18: expõe totalDemandPower");
  assert.equal(typeof m.generalCurrent, "number", "T18: expõe generalCurrent");
  assert.ok(m.generalBreaker > 0, "T18: expõe generalBreaker");
  assert.ok(m.generalDr > 0, "T18: expõe generalDr");
  console.log("✅ 18. Dados completos para cartões executivos: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 19: Integração com o quadro de distribuição
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = {
    supply_type: "Trifásico",
    voltage: 380,
    circuits: [
      { id: "c1", name: "Motor 1", type: "Motor", power_w: 15000, voltage: 380, supply_type: "Trifásico", demand_factor: 0.80 },
    ],
  };
  const layout = generateDefaultPanelLayout(p, { forceDistribution: true });
  const genBrk = layout.rails[0].components.find(c => c.id === "gen_brk");
  const genDr = layout.rails[0].components.find(c => c.id === "gen_dr");
  assert.ok(genBrk, "T19: Disjuntor geral presente no trilho 1");
  assert.ok(genBrk.current > 0, "T19: Corrente do disjuntor geral dimensionada");
  assert.equal(genBrk.poles, 3, "T19: Polos do disjuntor geral = 3P");
  assert.ok(genDr, "T19: IDR presente no trilho 1");
  assert.equal(genDr.poles, 4, "T19: IDR trifásico = 4P");
  assert.ok(genDr.current >= genBrk.current, "T19: In,DR >= In,disjuntor no quadro");
  console.log("✅ 19. Integração com o quadro de distribuição e trilhos DIN: OK");
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE 20: Auditoria técnica e geração do memorial NBR 5410
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = {
    name: "Edifício Comercial",
    supply_type: "Trifásico",
    voltage: 380,
    circuits: [
      { id: "c1", name: "Iluminação", type: "Iluminação", power_w: 3000, voltage: 220, supply_type: "Monofásico", phase: "A", demand_factor: 1.0 },
      { id: "c2", name: "Tomadas Escritório", type: "Tomadas de Uso Geral", power_w: 4000, voltage: 220, supply_type: "Monofásico", phase: "B", demand_factor: 0.70 },
      { id: "c3", name: "Ar Condicionado", type: "Ar Condicionado", power_w: 5000, voltage: 220, supply_type: "Monofásico", phase: "C", demand_factor: 0.85 },
    ],
  };
  const metrics = calcProjectMetrics(p);
  const audit = auditProjectNBR5410(p, metrics);

  assert.ok(Array.isArray(audit.checks), "T20: Auditoria possui lista de verificações");
  assert.ok(audit.checks.length >= 7, "T20: Pelo menos 7 verificações normativas");
  assert.ok(audit.score >= 0 && audit.score <= 100, "T20: Score calculado realisticamente");
  assert.ok(audit.disclaimer.includes("Engenheiro Eletricista"), "T20: Contém disclaimer de ART de engenheiro");
  console.log("✅ 20. Auditoria técnica estruturada de conformidade NBR 5410: OK");
}

console.log("\n🎉 TODOS OS 20 TESTES TÉCNICOS FORAM EXECUTADOS E APROVADOS COM SUCESSO!");
