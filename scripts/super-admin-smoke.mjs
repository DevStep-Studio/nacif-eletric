import assert from "node:assert/strict";
import { isSuperAdmin, hasPermission, SYSTEM_MODULES, DEFAULT_ROLES, canOperatorManageTarget } from "../src/lib/rbac.js";
import { recordAuditEvent, filterAuditLogs } from "../src/lib/auditLogger.js";

console.log("🧪 Iniciando testes de validação do Painel Super Admin (RBAC & Segurança)...");

// 1. Validação de Reconhecimento de Super Admin
const superAdminUser = { id: "sa_1", full_name: "Administrador Nacif", email: "admin@nacif.com", role: "super_admin", is_super_admin: true };
const regularAdminUser = { id: "adm_1", email: "gerente@nacif.com", role: "admin", is_super_admin: false };
const standardUser = { id: "usr_1", email: "joao@cliente.com", role: "user", is_super_admin: false };

const grcSuperAdmin = { id: "sa_grc", full_name: "Gabriel Nacif", email: "grc22.09@hotmail.com" };
const ianSuperAdmin = { id: "sa_ian", full_name: "Ian Mello", email: "ian.mellofla@gmail.com" };
const wellingtonSuperAdmin = { id: "sa_well", full_name: "Wellington Alfredo", email: "wellingtonalfredo550@gmail.com" };
const comercialSuperAdmin = { id: "sa_comercial", full_name: "Comercial Nacif Solutions", email: "comercial@nacifsolutions.com.br" };
const gabrielRezendeSuperAdmin = { id: "sa_gabriel_rezende", full_name: "Gabriel Rezende", email: "gabrielderezende13@gmail.com" };

assert.equal(isSuperAdmin(superAdminUser), true, "Super Admin deve ser reconhecido");
assert.equal(isSuperAdmin(grcSuperAdmin), true, "grc22.09@hotmail.com deve ser reconhecido como Super Admin");
assert.equal(isSuperAdmin(ianSuperAdmin), true, "ian.mellofla@gmail.com deve ser reconhecido como Super Admin");
assert.equal(isSuperAdmin(wellingtonSuperAdmin), true, "wellingtonalfredo550@gmail.com deve ser reconhecido como Super Admin");
assert.equal(isSuperAdmin(comercialSuperAdmin), true, "comercial@nacifsolutions.com.br deve ser reconhecido como Super Admin");
assert.equal(isSuperAdmin(gabrielRezendeSuperAdmin), true, "gabrielderezende13@gmail.com deve ser reconhecido como Super Admin");
assert.equal(isSuperAdmin(regularAdminUser), false, "Admin regular NÃO é Super Admin");
assert.equal(isSuperAdmin(standardUser), false, "Usuário padrão NÃO é Super Admin");

// 2. Validação da Matriz de Permissões Granulares
// Super Admin deve ter acesso irrestrito a todos os módulos e ações
for (const mod of SYSTEM_MODULES) {
  assert.equal(hasPermission(superAdminUser, mod.id, "view"), true, `Super admin visualiza ${mod.id}`);
  assert.equal(hasPermission(superAdminUser, mod.id, "admin"), true, `Super admin administra ${mod.id}`);
}

// Usuário padrão não deve ter acesso a user_management nem system_settings
assert.equal(hasPermission(standardUser, "user_management", "view"), false, "Usuário padrão não visualiza user_management");
assert.equal(hasPermission(standardUser, "system_settings", "view"), false, "Usuário padrão não visualiza system_settings");
assert.equal(hasPermission(standardUser, "projects", "view"), true, "Usuário padrão visualiza projects");
assert.equal(hasPermission(standardUser, "projects", "create"), true, "Usuário padrão cria projects");

// 3. Validação da Hierarquia de Operadores
assert.equal(canOperatorManageTarget(superAdminUser, standardUser), true, "Super Admin gerencia usuário");
assert.equal(canOperatorManageTarget(superAdminUser, regularAdminUser), true, "Super Admin gerencia admin");
assert.equal(canOperatorManageTarget(regularAdminUser, standardUser), true, "Admin gerencia usuário padrão");
assert.equal(canOperatorManageTarget(regularAdminUser, superAdminUser), false, "Admin NÃO PODE gerenciar Super Admin");
assert.equal(canOperatorManageTarget(standardUser, regularAdminUser), false, "Usuário padrão não gerencia ninguém");

// 4. Validação de Registro e Filtragem de Logs de Auditoria
const mockLog = recordAuditEvent({
  actor: superAdminUser,
  action: "USER_CREATED",
  targetType: "user",
  targetId: "usr_novo",
  targetName: "Novo Engenheiro",
  details: "Criou novo usuário no sistema",
  metadata: { role: "engenheiro", status: "active", password: "NAO_DEVE_ESTAR_AQUI" },
});

assert.ok(mockLog.id, "Log possui ID");
assert.equal(mockLog.actor_name, "Administrador Nacif");
assert.equal(mockLog.action, "USER_CREATED");
// Garantir que campos confidenciais como senhas foram removidos da metadata
assert.equal(mockLog.metadata.password, undefined, "Metadata do log higienizada contra vazamento de senhas");

const filtered = filterAuditLogs([mockLog], { action: "USER_CREATED", search: "Engenheiro" });
assert.equal(filtered.length, 1, "Filtro de auditoria por ação e texto funciona");

console.log("✅ Todos os testes de validação do Super Admin passaram com 100% de sucesso!");
