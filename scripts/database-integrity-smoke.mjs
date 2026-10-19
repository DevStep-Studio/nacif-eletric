import assert from "node:assert/strict";
import { validateMigrationsIntegrity, getAvailableMigrations } from "../src/db/migrationRunner.js";
import {
  auditProjectComponents,
  auditBudgetFinancials,
  findOrphanRecords,
  sanitizeOrphanRecords,
  checkOptimisticConcurrency,
  exportDatabaseBackup,
  validateBackupArchive,
  restoreDatabaseBackup,
} from "../src/lib/databaseIntegrityManager.js";

// Mock minimal browser storage & window for testing backendClient methods
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorage = new MemoryStorage();
globalThis.window = {
  localStorage: mockStorage,
  sessionStorage: new MemoryStorage(),
  location: { origin: "http://localhost:5173", href: "" },
  dispatchEvent: () => true,
};

// Import backendClient after setting up window mock
const { backend } = await import("../src/api/backendClient.js");

console.log("=== INICIANDO SUÍTE DE AUDITORIA DE BANCO DE DADOS E INTEGRIDADE NACIF ===");

async function testMigrationsAndSchemaReproducibility() {
  console.log("\n[1] Testando Sequência, Integridade e Reprodutibilidade das Migrations...");

  const migrations = getAvailableMigrations();
  assert(migrations.length >= 3, `Devem existir pelo menos 3 migrations no banco, encontradas: ${migrations.length}`);

  // Verificar presença das migrations essenciais
  assert(migrations[0].name.includes("20261001_initial_core_schema"), "Primeira migration deve ser o esquema central inicial");
  const hasSuperAdmin = migrations.some(m => m.name.includes("20261016_create_super_admin"));
  const hasIssues = migrations.some(m => m.name.includes("20261016_create_issues_system"));
  assert(hasSuperAdmin, "Deve conter a migration de super admin/RBAC");
  assert(hasIssues, "Deve conter a migration da central de avisos e erros");

  const validation = validateMigrationsIntegrity();
  assert(validation.valid, `Falha de validação das migrations: ${validation.errors.join("; ")}`);

  const expectedTables = [
    "users",
    "projects",
    "budgets",
    "notifications",
    "roles",
    "audit_logs",
    "system_settings",
    "issues",
    "issue_attachments",
    "issue_comments",
    "issue_audit_logs",
  ];

  expectedTables.forEach((table) => {
    assert(
      validation.tables.includes(table),
      `A tabela essencial '${table}' deve ser criada nas migrations.`
    );
  });

  console.log(`✔ Todas as ${migrations.length} migrations são válidas, ordenadas e reproduzem as ${validation.tables.length} tabelas relacionais.`);
}

async function testProjectComponentIntegrity() {
  console.log("\n[2] Testando Integridade de Componentes Técnicos do Projeto...");

  // 1. Projeto válido
  const validProject = {
    name: "Edifício Comercial Nacif",
    circuits: [
      { id: "c1", name: "Iluminação Térreo", power_w: 1200 },
      { id: "c2", name: "Tomadas Escritório", power_w: 2400 },
    ],
    panel_boards: [
      { name: "QD-Geral", devices: [{ circuit_id: "c1" }, { circuit_id: "c2" }] },
    ],
    plant_design: {
      points: [{ x: 100, y: 150, power_w: 100 }],
    },
    solar_data: {
      arrays: [{ id: "arr1", modules_count: 24, power_w: 13200 }],
    },
  };

  const auditValid = auditProjectComponents(validProject);
  assert(auditValid.valid, `Projeto válido deve ser aprovado sem erros: ${auditValid.issues.join(", ")}`);
  assert.equal(auditValid.circuitsCount, 2, "Contagem de circuitos deve conferir");

  // 2. Projeto com inconsistências (circuitos duplicados, potência negativa, disjuntor para circuito inexistente)
  const invalidProject = {
    name: "Projeto com Inconsistências",
    circuits: [
      { id: "c1", name: "Circuito 1", power_w: -500 },
      { id: "c1", name: "Circuito 1 Duplicado", power_w: 1000 },
    ],
    panel_boards: [
      { name: "QD", devices: [{ circuit_id: "c99_inexistente" }] },
    ],
  };

  const auditInvalid = auditProjectComponents(invalidProject);
  assert(!auditInvalid.valid, "Projeto com dados corrompidos deve ser reprovado");
  assert(auditInvalid.issues.some((i) => i.includes("duplicado")), "Deve acusar circuito duplicado");
  assert(auditInvalid.issues.some((i) => i.includes("negativa")), "Deve acusar potência negativa");
  assert(auditInvalid.issues.some((i) => i.includes("inexistente")), "Deve acusar disjuntor referenciando circuito inexistente");

  console.log("✔ Integridade de componentes técnicos (circuitos, quadros, planta, solar) comprovada.");
}

async function testBudgetFinancialIntegrity() {
  console.log("\n[3] Testando Integridade de Dados Financeiros e Preservação de Snapshots...");

  // Orçamento válido com snapshot de preços
  const validBudget = {
    name: "Orçamento Executivo Subestação",
    materials: [
      { id: "mat1", name: "Disjuntor Caixa Moldada 100A", unit_price: 345.5, quantity: 2 },
      { id: "mat2", name: "Cabo de Cobre 25mm² 750V (m)", unit_price: 24.8, quantity: 50 },
    ],
    services: [
      { id: "srv1", name: "Montagem do Quadro Elétrico", unit_price: 1500.0, quantity: 1 },
    ],
    margin: 30,
    labor_cost: 1500.0,
  };

  const auditValid = auditBudgetFinancials(validBudget);
  assert(auditValid.valid, "Orçamento íntegro deve ser aprovado");

  // Orçamento com dados inconsistentes (preço negativo)
  const invalidBudget = {
    name: "Orçamento Inválido",
    materials: [
      { id: "mat1", name: "Item Inválido", unit_price: -50.0, quantity: 1 },
    ],
  };
  const auditInvalid = auditBudgetFinancials(invalidBudget);
  assert(!auditInvalid.valid, "Preço unitário negativo deve ser reprovado pela auditoria financeira");

  console.log("✔ Integridade financeira e consistência de snapshots validadas com sucesso.");
}

async function testReferentialIntegrityAndOrphanHandling() {
  console.log("\n[4] Testando Integridade Referencial e Prevenção de Órfãos (ON DELETE SET NULL)...");

  // Logar como super admin
  const adminLogin = await backend.auth.loginViaEmailPassword("admin@nacif.com", "admin");
  backend.auth.setToken(adminLogin.access_token);

  // 1. Criar projeto
  const project = await backend.entities.Project.create({
    name: "Projeto Referencial Teste",
    circuits: [{ id: "c_ref_1", name: "C1", power_w: 1500 }],
  });

  // 2. Criar orçamento vinculado a este projeto
  const budget = await backend.entities.Budget.create({
    name: "Orçamento Vinculado ao Projeto",
    project_id: project.id,
    project_name: project.name,
    materials: [{ name: "Disjuntor 20A", unit_price: 25.0, quantity: 1 }],
  });

  assert.equal(budget.project_id, project.id, "Orçamento deve estar inicialmente associado ao projeto");

  // 3. Excluir o projeto
  await backend.entities.Project.delete(project.id);

  // 4. Verificar que o orçamento NÃO foi destruído, mas seu vínculo foi desassociado com segurança (ON DELETE SET NULL)
  const budgetAfter = await backend.entities.Budget.get(budget.id);
  assert(budgetAfter, "Orçamento deve ser preservado para fins contábeis e fiscais");
  assert.equal(budgetAfter.project_id, null, "project_id deve ser redefinido para null (ON DELETE SET NULL)");
  assert(budgetAfter.project_name.includes("Arquivado"), "Nome do projeto arquivado deve ser anotado");

  console.log("✔ Integridade referencial comprovada: exclusão de projeto preserva orçamento e elimina órfãos.");
}

async function testOptimisticConcurrencyControl() {
  console.log("\n[5] Testando Controle de Concorrência Otimista (Anti-Sobrescrita Silenciosa)...");

  const project = await backend.entities.Project.create({
    name: "Projeto Concorrente Alpha",
    supply_type: "Trifásico",
  });

  const staleTimestamp = "2020-01-01T00:00:00.000Z";

  let conflictDetected = false;
  try {
    // Simula uma segunda aba tentando salvar com base em timestamp antigo desatualizado
    await backend.entities.Project.update(project.id, {
      name: "Projeto Concorrente Modificado por Aba Antiga",
      expected_updated_date: staleTimestamp,
    });
  } catch (err) {
    conflictDetected = true;
    assert.equal(err.status, 409, "Tentativa de atualizar com timestamp antigo deve retornar HTTP 409 Conflito");
  }

  assert.equal(conflictDetected, true, "Sobrescrita silenciosa por aba concorrente deve ser bloqueada com 409");

  // Atualização com timestamp correto deve suceder
  const updated = await backend.entities.Project.update(project.id, {
    name: "Projeto Atualizado com Sucesso",
    expected_updated_date: project.updated_date,
  });
  assert.equal(updated.name, "Projeto Atualizado com Sucesso", "Atualização coordenada deve ser concluída");
  assert(updated.version >= 2, "Versão incremental deve ser atualizada");

  console.log("✔ Concorrência otimista validada (HTTP 409 em conflitos de atualização).");
}

async function testBackupGenerationValidationAndRestore() {
  console.log("\n[6] Testando Geração de Backup Criptográfico (SHA-256) e Restauração em Sandbox...");

  // 1. Exportar Backup do Sistema
  const backupArchive = await backend.database.exportBackup();

  assert(backupArchive.nacif_backup_format === "1.0", "Formato de backup deve ser '1.0'");
  assert(backupArchive.schema_version === "1.4.0", "Versão do esquema deve ser '1.4.0'");
  assert(backupArchive.checksum_sha256 && backupArchive.checksum_sha256.length === 64, "Checksum SHA-256 de 64 hexchars deve estar presente");
  assert(backupArchive.disaster_recovery.rpo_target.includes("15 minutos"), "Métrica RPO deve estar documentada");
  assert(backupArchive.disaster_recovery.rto_target.includes("5 minutos"), "Métrica RTO deve estar documentada");

  // 2. Validar integridade do arquivo de backup
  const validation = await backend.database.validateBackup(backupArchive);
  assert(validation.valid, "Arquivo de backup legítimo deve ser validado com sucesso");

  // 3. Simular corrupção de dados e verificar detecção
  const tamperedArchive = JSON.parse(JSON.stringify(backupArchive));
  tamperedArchive.data.projects.push({ id: "hacked_p", name: "Injeção Maliciosa" });
  const tamperedValidation = await backend.database.validateBackup(tamperedArchive);
  assert(!tamperedValidation.valid, "Backup adulterado deve ser rejeitado por divergência de checksum SHA-256");

  // 4. Executar Restauração Real em Sandbox Isolado
  const sandboxStore = new Map();
  const sandboxCallback = async (restoredData) => {
    sandboxStore.set("restored_projects", restoredData.projects);
    sandboxStore.set("restored_budgets", restoredData.budgets);
    sandboxStore.set("restored_users", restoredData.users);
  };

  const restoreResult = await restoreDatabaseBackup(backupArchive, sandboxCallback);
  assert(restoreResult.success, "Restauração de backup em sandbox deve ser bem-sucedida");
  assert.equal(restoreResult.checksum_verified, backupArchive.checksum_sha256, "Checksum deve ser verificado na restauração");

  // 5. Validar integridade dos dados restaurados no sandbox
  const restoredProjects = sandboxStore.get("restored_projects");
  assert(Array.isArray(restoredProjects), "Projetos restaurados devem ser um array");
  assert.equal(restoredProjects.length, backupArchive.counts.projects, "Quantidade de projetos restaurados deve ser 100% idêntica");

  console.log("✔ Backup com checksum SHA-256, detecção de adulteração e restauração validada em sandbox.");
}

async function testDatabaseHealthAudit() {
  console.log("\n[7] Testando Diagnóstico e Auditoria Global de Saúde do Banco de Dados...");

  const healthReport = await backend.database.auditIntegrity();
  assert(typeof healthReport.healthy === "boolean", "Relatório de saúde deve retornar indicador booleano");
  assert(healthReport.counts.users > 0, "Deve computar contagem de usuários");
  assert(healthReport.counts.projects >= 0, "Deve computar contagem de projetos");
  assert(healthReport.counts.budgets >= 0, "Deve computar contagem de orçamentos");

  console.log(`✔ Diagnóstico de saúde executado: ${healthReport.counts.projects} projetos, ${healthReport.counts.budgets} orçamentos, ${healthReport.counts.users} usuários.`);
}

async function runAll() {
  try {
    await testMigrationsAndSchemaReproducibility();
    await testProjectComponentIntegrity();
    await testBudgetFinancialIntegrity();
    await testReferentialIntegrityAndOrphanHandling();
    await testOptimisticConcurrencyControl();
    await testBackupGenerationValidationAndRestore();
    await testDatabaseHealthAudit();

    console.log("\n========================================================");
    console.log("🎉 TODOS OS TESTES DE BANCO DE DADOS E INTEGRIDADE PASSARAM!");
    console.log("========================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ FALHA NA AUDITORIA DO BANCO DE DADOS:", err);
    process.exit(1);
  }
}

runAll();
