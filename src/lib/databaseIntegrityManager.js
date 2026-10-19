/**
 * Motor de Integridade do Banco de Dados e Recuperação de Desastres (DR) — Nacif Electric
 * Implementa validação relacional, detecção/saneamento de órfãos, controle de concorrência otimista,
 * exportação criptográfica de backups (SHA-256), restauração isolada e métricas de RPO/RTO.
 */

// Helper para cálculo de checksum SHA-256
async function computeSha256(str) {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    const enc = new TextEncoder();
    const hashBuf = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(str));
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback para Node.js environment
  try {
    const cryptoModule = await import("node:crypto");
    return cryptoModule.createHash("sha256").update(str).digest("hex");
  } catch {
    return "checksum_fallback";
  }
}

/**
 * 1. Auditoria de Integridade de Componentes Técnicos do Projeto
 * Valida unicidade de IDs de circuitos, vinculações de quadros elétricos,
 * pontos da planta baixa e conjuntos solares fotovoltaicos.
 */
export function auditProjectComponents(project) {
  const issues = [];
  if (!project || typeof project !== "object") {
    return { valid: false, issues: ["Objeto do projeto é inválido ou nulo."] };
  }

  const circuits = Array.isArray(project.circuits) ? project.circuits : [];
  const circuitIdSet = new Set();

  circuits.forEach((c, idx) => {
    const cId = c?.id || c?.circuit_id || `c_${idx}`;
    if (circuitIdSet.has(cId)) {
      issues.push(`Circuito duplicado com identificador id='${cId}' no projeto '${project.name}'.`);
    } else {
      circuitIdSet.add(cId);
    }

    if (c?.power_w !== undefined && Number(c.power_w) < 0) {
      issues.push(`Circuito '${c?.name || cId}' possui potência negativa inválida: ${c.power_w}W.`);
    }
  });

  // Validação dos quadros elétricos (painéis DIN)
  const panelBoards = Array.isArray(project.panel_boards) ? project.panel_boards : [];
  panelBoards.forEach((panel) => {
    const breakerRefs = Array.isArray(panel?.devices) ? panel.devices : [];
    breakerRefs.forEach((dev) => {
      if (dev?.circuit_id && !circuitIdSet.has(dev.circuit_id) && dev.circuit_id !== "geral") {
        issues.push(`Dispositivo no quadro '${panel?.name || "QD"}' referencia circuito inexistente: '${dev.circuit_id}'.`);
      }
    });
  });

  // Validação dos pontos da planta baixa
  const plantPoints = Array.isArray(project?.plant_design?.points) ? project.plant_design.points : [];
  plantPoints.forEach((pt, idx) => {
    if (pt.x === undefined || pt.y === undefined || isNaN(pt.x) || isNaN(pt.y)) {
      issues.push(`Ponto elétrico #${idx} na planta possui coordenadas geométricas inválidas.`);
    }
  });

  // Validação dos conjuntos solares fotovoltaicos
  const solarArrays = Array.isArray(project?.solar_data?.arrays) ? project.solar_data.arrays : [];
  const solarArrayIds = new Set();
  solarArrays.forEach((arr, idx) => {
    const aId = arr?.id || `arr_${idx}`;
    if (solarArrayIds.has(aId)) {
      issues.push(`Conjunto solar duplicado com identificador id='${aId}'.`);
    } else {
      solarArrayIds.add(aId);
    }
    if (arr?.modules_count !== undefined && Number(arr.modules_count) < 0) {
      issues.push(`Conjunto solar '${aId}' possui contagem negativa de módulos.`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    circuitsCount: circuits.length,
    panelBoardsCount: panelBoards.length,
    plantPointsCount: plantPoints.length,
    solarArraysCount: solarArrays.length,
  };
}

/**
 * 2. Auditoria de Integridade de Orçamentos Financeiros
 * Garante preservação de snapshots de preços, arredondamentos monetários consistentes
 * e ausência de corrupção ou distorção em cálculos históricos.
 */
export function auditBudgetFinancials(budget) {
  const issues = [];
  if (!budget || typeof budget !== "object") {
    return { valid: false, issues: ["Objeto do orçamento é inválido ou nulo."] };
  }

  const materials = Array.isArray(budget.materials) ? budget.materials : [];
  materials.forEach((mat, idx) => {
    if (mat.unit_price !== undefined && Number(mat.unit_price) < 0) {
      issues.push(`Item de material #${idx} ('${mat.name}') possui preço unitário negativo.`);
    }
    if (mat.quantity !== undefined && Number(mat.quantity) < 0) {
      issues.push(`Item de material #${idx} ('${mat.name}') possui quantidade negativa.`);
    }
  });

  const services = Array.isArray(budget.services) ? budget.services : [];
  services.forEach((srv, idx) => {
    if (srv.unit_price !== undefined && Number(srv.unit_price) < 0) {
      issues.push(`Item de serviço #${idx} ('${srv.name}') possui preço unitário negativo.`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
    materialsCount: materials.length,
    servicesCount: services.length,
  };
}

/**
 * 3. Detecção de Registros Órfãos no Sistema
 */
export function findOrphanRecords({ users = [], projects = [], budgets = [], notifications = [] }) {
  const userIds = new Set(users.map((u) => u.id));
  const projectIds = new Set(projects.map((p) => p.id));

  const orphanProjects = projects.filter((p) => p.owner_id && !userIds.has(p.owner_id));
  const orphanBudgets = budgets.filter((b) => (b.owner_id && !userIds.has(b.owner_id)) || (b.project_id && !projectIds.has(b.project_id)));
  const orphanNotifications = notifications.filter((n) => n.user_id && !userIds.has(n.user_id));

  return {
    orphanProjects,
    orphanBudgets,
    orphanNotifications,
    hasOrphans: orphanProjects.length > 0 || orphanBudgets.length > 0 || orphanNotifications.length > 0,
  };
}

/**
 * 4. Saneamento Seguro de Registros Órfãos
 * Remove ou desvincula referências sem comprometer o histórico financeiro.
 */
export function sanitizeOrphanRecords({ users = [], projects = [], budgets = [], notifications = [] }) {
  const userIds = new Set(users.map((u) => u.id));
  const projectIds = new Set(projects.map((p) => p.id));

  // Orçamentos que apontavam para projetos excluídos têm project_id desvinculado (ON DELETE SET NULL)
  const cleanedBudgets = budgets
    .filter((b) => !b.owner_id || userIds.has(b.owner_id))
    .map((b) => {
      if (b.project_id && !projectIds.has(b.project_id)) {
        return { ...b, project_id: null, project_name: b.project_name ? `${b.project_name} (Projeto Arquivado)` : null };
      }
      return b;
    });

  const cleanedNotifications = notifications.filter((n) => !n.user_id || userIds.has(n.user_id));
  const cleanedProjects = projects.filter((p) => !p.owner_id || userIds.has(p.owner_id));

  return {
    projects: cleanedProjects,
    budgets: cleanedBudgets,
    notifications: cleanedNotifications,
  };
}

/**
 * 5. Controle de Concorrência Otimista (Optimistic Concurrency Control)
 * Previne sobrescrita silenciosa por abas ou processos concorrentes desatualizados.
 */
export function checkOptimisticConcurrency(currentEntity, expectedVersionOrDate) {
  if (!currentEntity || !expectedVersionOrDate) return true;

  // Comparação por versão numérica incremental
  if (typeof currentEntity.version === "number" && typeof expectedVersionOrDate === "number") {
    if (currentEntity.version !== expectedVersionOrDate) {
      const err = new Error("Conflito de concorrência: o registro foi modificado por outra operação. Atualize a página.");
      err.status = 409;
      err.code = "CONCURRENCY_CONFLICT";
      throw err;
    }
  }

  // Comparação por timestamp ISO de atualização
  if (typeof expectedVersionOrDate === "string" && currentEntity.updated_date) {
    if (currentEntity.updated_date !== expectedVersionOrDate) {
      const err = new Error("Conflito de concorrência: os dados no servidor são mais recentes do que a sua versão em tela.");
      err.status = 409;
      err.code = "STALE_DATA_CONFLICT";
      throw err;
    }
  }

  return true;
}

/**
 * 6. Exportação Criptográfica de Backup com Metadados de Continuidade (RPO / RTO)
 */
export async function exportDatabaseBackup(collections = {}) {
  const timestamp = new Date().toISOString();
  const rawPayload = JSON.stringify({
    users: collections.users || [],
    projects: collections.projects || [],
    budgets: collections.budgets || [],
    notifications: collections.notifications || [],
    issues: collections.issues || [],
    audit_logs: collections.audit_logs || [],
  });

  const checksum = await computeSha256(rawPayload);

  return {
    nacif_backup_format: "1.0",
    schema_version: "1.4.0",
    created_at: timestamp,
    disaster_recovery: {
      rpo_target: "15 minutos (Recovery Point Objective)",
      rto_target: "Menor que 5 minutos (Recovery Time Objective)",
      backup_frequency: "Diária com snapshots contínuos por sessão",
      retention_policy: "Diários por 30 dias, Semanais por 90 dias, Mensais por 1 ano",
      lgpd_compliance: "Dados pessoais anonimizados/excluídos respeitam o direito de eliminação do Art. 18",
    },
    counts: {
      users: (collections.users || []).length,
      projects: (collections.projects || []).length,
      budgets: (collections.budgets || []).length,
      notifications: (collections.notifications || []).length,
      issues: (collections.issues || []).length,
      audit_logs: (collections.audit_logs || []).length,
    },
    checksum_sha256: checksum,
    data: JSON.parse(rawPayload),
  };
}

/**
 * 7. Validação de Integridade do Arquivo de Backup
 */
export async function validateBackupArchive(archive) {
  if (!archive || typeof archive !== "object") {
    return { valid: false, reason: "Estrutura do backup não é um objeto JSON válido." };
  }

  if (archive.nacif_backup_format !== "1.0") {
    return { valid: false, reason: "Formato ou versão incompatível de backup." };
  }

  if (!archive.data || typeof archive.data !== "object") {
    return { valid: false, reason: "Seção de dados do backup ausente ou corrompida." };
  }

  const rawPayload = JSON.stringify(archive.data);
  const actualChecksum = await computeSha256(rawPayload);

  if (archive.checksum_sha256 && archive.checksum_sha256 !== actualChecksum) {
    return {
      valid: false,
      reason: "Falha de integridade: o checksum SHA-256 dos dados não confere com o arquivo de backup (dados corrompidos ou alterados).",
    };
  }

  return { valid: true, counts: archive.counts, checksum: actualChecksum };
}

/**
 * 8. Restauração Isolada do Backup com Verificação de Integridade
 */
export async function restoreDatabaseBackup(archive, writeTargetCallback) {
  const validation = await validateBackupArchive(archive);
  if (!validation.valid) {
    const err = new Error(`Restauração bloqueada por falha de integridade: ${validation.reason}`);
    err.status = 400;
    throw err;
  }

  // Executa callback de gravação segura no destino isolado
  if (typeof writeTargetCallback === "function") {
    await writeTargetCallback(archive.data);
  }

  return {
    success: true,
    restored_at: new Date().toISOString(),
    restored_counts: archive.counts,
    checksum_verified: validation.checksum,
  };
}
