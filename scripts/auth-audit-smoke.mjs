import assert from "node:assert/strict";
import {
  isSuperAdmin,
  hasPermission,
  canOperatorManageTarget,
  DEFAULT_ROLES,
  SUPER_ADMIN_EMAILS,
} from "../src/lib/rbac.js";
import {
  isArchitectUser,
  isAdminUser,
  hasFullSystemAccess,
  canAccessPath,
  getDefaultAuthenticatedRoute,
} from "../src/lib/professionalAccess.js";

console.log("=================================================");
console.log("🔒 INICIANDO AUDITORIA DE AUTENTICAÇÃO, USUÁRIOS E PERMISSÕES");
console.log("=================================================");

// Mock environment de LocalStorage para simular testes em Node.js
const mockStorage = new Map();
global.window = {
  localStorage: {
    getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
    setItem: (key, val) => mockStorage.set(key, String(val)),
    removeItem: (key) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  },
  sessionStorage: {
    clear: () => {},
  },
  location: { origin: "http://localhost:5173", href: "" },
  dispatchEvent: () => {},
};

// ── 1. Testes de RBAC e Hierarquia de Acesso ──────────────────────────────────
console.log("\n[1/7] Testando Motor RBAC e Hierarquia de Papéis...");

const superAdminUser = {
  id: "usr-super-1",
  email: "admin@nacif.com",
  role: "super_admin",
  is_super_admin: true,
};

const adminUser = {
  id: "usr-admin-1",
  email: "gerente@empresa.com",
  role: "admin",
  is_super_admin: false,
};

const standardUser = {
  id: "usr-standard-1",
  email: "eletricista@empresa.com",
  role: "user",
  is_super_admin: false,
};

const architectUser = {
  id: "usr-arch-1",
  email: "arquiteto@estudio.com",
  role: "user",
  profession: "arquiteto",
};

// isSuperAdmin
assert.equal(isSuperAdmin(superAdminUser), true, "Super admin por role");
assert.equal(isSuperAdmin({ email: "grc22.09@hotmail.com" }), true, "Super admin institucional por email");
assert.equal(isSuperAdmin(adminUser), false, "Admin padrão não é super admin");
assert.equal(isSuperAdmin(standardUser), false, "Usuário comum não é super admin");
assert.equal(isSuperAdmin(null), false, "Nulo não é super admin");

// hasPermission
assert.equal(hasPermission(superAdminUser, "system_settings", "admin"), true, "Super admin tem acesso irrestrito");
assert.equal(hasPermission(adminUser, "system_settings", "admin"), false, "Admin não tem permissão total em system_settings");
assert.equal(hasPermission(adminUser, "projects", "create"), true, "Admin pode criar projetos");
assert.equal(hasPermission(standardUser, "user_management", "view"), false, "Usuário padrão não pode ver user_management");
assert.equal(hasPermission(standardUser, "projects", "create"), true, "Usuário padrão pode criar projetos");

// canOperatorManageTarget
assert.equal(canOperatorManageTarget(superAdminUser, adminUser), true, "Super Admin pode gerenciar Admin");
assert.equal(canOperatorManageTarget(superAdminUser, standardUser), true, "Super Admin pode gerenciar Usuário Comum");
assert.equal(canOperatorManageTarget(adminUser, standardUser), true, "Admin pode gerenciar Usuário Comum");
assert.equal(canOperatorManageTarget(adminUser, superAdminUser), false, "Admin NÃO pode gerenciar Super Admin!");
assert.equal(canOperatorManageTarget(adminUser, { role: "admin" }), false, "Admin NÃO pode gerenciar outro Admin!");
assert.equal(canOperatorManageTarget(standardUser, adminUser), false, "Usuário comum não pode gerenciar ninguém");

// Perfil de Arquiteto e Roteamento Inicial para o Dashboard
assert.equal(isArchitectUser(architectUser), true, "Identifica perfil de arquiteto");
assert.equal(isAdminUser(architectUser), false, "Arquiteto comum não é administrador");
assert.equal(isAdminUser(standardUser), false, "Usuário comum não é administrador");
assert.equal(isAdminUser(adminUser), true, "Admin possui flag administrativa");
assert.equal(isAdminUser(superAdminUser), true, "Super admin possui flag administrativa");
assert.equal(getDefaultAuthenticatedRoute(architectUser), "/", "Arquiteto vai direto para o Dashboard (/) ao entrar/cadastrar");
assert.equal(hasFullSystemAccess(architectUser), true, "Arquiteto acessa Dashboard e navegação completa do workspace");
assert.equal(canAccessPath(architectUser, "/"), true, "Arquiteto acessa Dashboard (/)");
assert.equal(canAccessPath(architectUser, "/dashboard"), true, "Arquiteto acessa rota /dashboard");
assert.equal(canAccessPath(architectUser, "/projects"), true, "Arquiteto acessa Meus Projetos");
assert.equal(canAccessPath(architectUser, "/planta-ia"), true, "Arquiteto acessa Planta IA");
assert.equal(canAccessPath(architectUser, "/panel-generator"), true, "Arquiteto não fica preso na Planta IA");
assert.equal(canAccessPath(architectUser, "/admin"), false, "Arquiteto não acessa painel administrativo");
assert.equal(canAccessPath(architectUser, "/super-admin"), false, "Arquiteto não acessa painel super-admin");
assert.equal(hasFullSystemAccess(standardUser), true, "Projetista/eletricista tem acesso integral");

console.log("✅ Motor RBAC e hierarquias validados!");

// ── 2. Importação do backendClient com ambiente isolado ───────────────────────
console.log("\n[2/7] Testando Fluxo de Autenticação, Tokens e Invalidação...");

const { backend, SESSION_EXPIRATION_MS, RESET_TOKEN_EXPIRATION_MS, MAX_LOGIN_ATTEMPTS } = await import(
  "../src/api/backendClient.js"
);

// Limpeza de storage
mockStorage.clear();

// Tentativa de me() sem token: DEVE FALHAR (401) e NÃO auto-logar como admin
let unauthRejected = false;
try {
  await backend.auth.me();
} catch (err) {
  unauthRejected = true;
  assert.equal(err.status, 401, "Acesso não autenticado deve retornar HTTP 401");
}
assert.ok(unauthRejected, "Requisição sem token DEVE ser rejeitada sem bypass");

// Tentativa de login com senha incorreta
let invalidPassFailed = false;
try {
  await backend.auth.loginViaEmailPassword("admin@nacif.com", "senha_incorreta_123");
} catch (err) {
  invalidPassFailed = true;
  assert.equal(err.status, 401, "Senha incorreta deve retornar HTTP 401");
}
assert.ok(invalidPassFailed, "Senha incorreta foi rejeitada");

// Tentativa de força bruta (Rate Limiting)
console.log("Testando proteção contra força bruta (5 tentativas incorretas)...");
for (let i = 0; i < 4; i++) {
  try {
    await backend.auth.loginViaEmailPassword("alvo@teste.com", `tentativa_${i}`);
  } catch {}
}

let bruteForceBlocked = false;
try {
  // 5ª tentativa consecutiva com erro
  await backend.auth.loginViaEmailPassword("alvo@teste.com", "tentativa_5");
} catch (err) {
  bruteForceBlocked = true;
  assert.equal(err.status, 429, "Após 5 tentativas falhas, deve bloquear com HTTP 429");
  assert.ok(err.message.includes("bloqueada"), "Mensagem de bloqueio temporário por segurança");
}
assert.ok(bruteForceBlocked, "Bloqueio temporário por força bruta acionado com sucesso!");

// Login com credenciais válidas do Super Admin padrão
const loginResult = await backend.auth.loginViaEmailPassword("admin@nacif.com", "admin");
assert.ok(loginResult.access_token, "Login bem-sucedido gera token de acesso");
assert.equal(loginResult.user.email, "admin@nacif.com");
assert.equal(loginResult.user.role, "super_admin");
assert.equal(loginResult.user.password, undefined, "Senha NUNCA deve ser retornada");

const currentMe = await backend.auth.me();
assert.equal(currentMe.email, "admin@nacif.com", "me() identifica o usuário autenticado");

// Logout limpa o token
backend.auth.logout(false);
let afterLogoutBlocked = false;
try {
  await backend.auth.me();
} catch (err) {
  afterLogoutBlocked = true;
  assert.equal(err.status, 401);
}
assert.ok(afterLogoutBlocked, "Após logout, me() rejeita imediatamente com 401");

console.log("✅ Autenticação, tokens e proteção contra força bruta validados!");

// ── 3. Testes de Cadastro e Prevenção de Escalada de Privilégios ──────────────
console.log("\n[3/7] Testando Cadastro Seguro e Prevenção de Escalada de Privilégios...");

// Cadastro com senha muito curta (< 6)
let shortPassRejected = false;
try {
  await backend.auth.register({ email: "curto@teste.com", password: "123", profession: "projetista" });
} catch (err) {
  shortPassRejected = true;
  assert.equal(err.status, 400);
}
assert.ok(shortPassRejected, "Senha menor que 6 caracteres rejeitada");

// Cadastro com email inválido
let invalidEmailRejected = false;
try {
  await backend.auth.register({ email: "email_invalido", password: "senha_valida_123", profession: "projetista" });
} catch (err) {
  invalidEmailRejected = true;
  assert.equal(err.status, 400);
}
assert.ok(invalidEmailRejected, "Email sem formato válido rejeitado");

// Cadastro válido de Usuário A
const userAReg = await backend.auth.register({
  email: "usuario_a@engenharia.com",
  password: "senha_segura_123",
  profession: "projetista",
});
assert.ok(userAReg.access_token, "Cadastro gera token");
assert.equal(userAReg.user.role, "user", "Novo cadastro comum recebe estritamente role 'user'");
assert.equal(userAReg.user.is_super_admin, false, "Novo cadastro comum NÃO pode ser super admin");

// Tentativa de elevação de privilégios via updateMe
const updateAttempt = await backend.auth.updateMe({
  full_name: "Usuario A Silva",
  role: "super_admin", // Tentativa de injeção de papel privilegiado
  is_super_admin: true,
  status: "suspended",
});
assert.equal(updateAttempt.full_name, "Usuario A Silva", "Atualiza campos permitidos");
assert.equal(updateAttempt.role, "user", "Tentativa de mudar role via updateMe foi BLOQUEADA!");
assert.equal(updateAttempt.is_super_admin, false, "Tentativa de virar super admin foi BLOQUEADA!");

// Cadastro válido de Arquiteto -> deve autenticar e ir para o Dashboard (/), sem bloqueio em /planta-ia
backend.auth.logout(false);
const archReg = await backend.auth.register({
  email: "testearquiteto@nacifenergy.com.br",
  password: "senha_arquiteto_123",
  profession: "arquiteto",
  terms_accepted: true,
  terms_version: "1.2",
});
assert.ok(archReg.access_token, "Cadastro de arquiteto gera token");
assert.equal(archReg.user.profession, "arquiteto", "Profissão arquiteto persistida corretamente");
assert.equal(archReg.user.role, "user", "Arquiteto cadastrado recebe role user");
assert.equal(getDefaultAuthenticatedRoute(archReg.user), "/", "Conta arquiteto vai para o Dashboard (/)");
assert.equal(canAccessPath(archReg.user, "/"), true, "Conta arquiteto acessa Dashboard (/)");
assert.equal(canAccessPath(archReg.user, "/projects"), true, "Conta arquiteto acessa Projetos (/projects)");
assert.equal(isAdminUser(archReg.user), false, "Conta arquiteto não recebe permissões de admin");

// Restaura sessão do Usuário A para os testes subsequentes
backend.auth.logout(false);
await backend.auth.loginViaEmailPassword("usuario_a@engenharia.com", "senha_segura_123");

console.log("✅ Cadastro seguro e prevenção contra escalada de privilégios comprovados!");

// ── 4. Isolamento Completo de Projetos (Prevenção de IDOR) ────────────────────
console.log("\n[4/7] Testando Isolamento de Projetos e Proteção contra IDOR...");

// Usuário A cria um projeto
const projectA = await backend.entities.Project.create({
  name: "Edifício Residencial Aurora - Usuário A",
  client_name: "Aurora Incorporadora",
});
assert.ok(projectA.id, "Projeto A criado");
assert.equal(projectA.owner_id, userAReg.user.id, "Proprietário registrado como Usuário A");

// Cadastra Usuário B
backend.auth.logout(false);
const userBReg = await backend.auth.register({
  email: "usuario_b@eletrica.com",
  password: "senha_segura_b_123",
  profession: "eletricista",
});

// Usuário B lista projetos: Projeto A NÃO DEVE APARECER
const userBProjects = await backend.entities.Project.list();
const hasProjectA = userBProjects.some((p) => p.id === projectA.id);
assert.equal(hasProjectA, false, "Projetos do Usuário A não devem aparecer na lista do Usuário B!");

// Usuário B tenta ler diretamente Projeto A por ID (IDOR)
let idorReadBlocked = false;
try {
  await backend.entities.Project.get(projectA.id);
} catch (err) {
  idorReadBlocked = true;
  assert.equal(err.status, 403, "Tentativa de ler projeto de outro usuário retorna 403");
}
assert.ok(idorReadBlocked, "Leitura cruzada de projeto bloqueada com sucesso!");

// Usuário B tenta atualizar Projeto A
let idorUpdateBlocked = false;
try {
  await backend.entities.Project.update(projectA.id, { name: "Invasão Incorreta" });
} catch (err) {
  idorUpdateBlocked = true;
  assert.equal(err.status, 403);
}
assert.ok(idorUpdateBlocked, "Edição cruzada de projeto bloqueada!");

// Usuário B tenta duplicar Projeto A
let idorDuplBlocked = false;
try {
  await backend.entities.Project.duplicate(projectA.id);
} catch (err) {
  idorDuplBlocked = true;
  assert.equal(err.status, 403);
}
assert.ok(idorDuplBlocked, "Duplicação cruzada de projeto bloqueada!");

// Usuário B tenta excluir Projeto A
let idorDelBlocked = false;
try {
  await backend.entities.Project.delete(projectA.id);
} catch (err) {
  idorDelBlocked = true;
  assert.equal(err.status, 403);
}
assert.ok(idorDelBlocked, "Exclusão cruzada de projeto bloqueada!");

console.log("✅ Isolamento de projetos e proteção contra IDOR validados!");

// ── 5. Isolamento Completo de Orçamentos Financeiros ──────────────────────────
console.log("\n[5/7] Testando Isolamento de Orçamentos Financeiros (IDOR)...");

// Usuário A cria um orçamento confidencial
backend.auth.logout(false);
await backend.auth.loginViaEmailPassword("usuario_a@engenharia.com", "senha_segura_123");

const budgetA = await backend.entities.Budget.create({
  project_id: projectA.id,
  name: "Proposta Confidencial R$ 45.000,00",
  total: 45000.0,
});
assert.ok(budgetA.id, "Orçamento confidencial do Usuário A criado");

// Alterna para Usuário B
backend.auth.logout(false);
await backend.auth.loginViaEmailPassword("usuario_b@eletrica.com", "senha_segura_b_123");

// Usuário B lista orçamentos: Orçamento A NÃO deve aparecer
const userBBudgets = await backend.entities.Budget.list();
const hasBudgetA = userBBudgets.some((b) => b.id === budgetA.id);
assert.equal(hasBudgetA, false, "Orçamentos do Usuário A não devem aparecer na lista do Usuário B!");

// Usuário B tenta acessar o orçamento confidencial por ID
let budgetIdorGetBlocked = false;
try {
  await backend.entities.Budget.get(budgetA.id);
} catch (err) {
  budgetIdorGetBlocked = true;
  assert.equal(err.status, 403, "Tentativa de ver orçamento alheio retorna 403");
}
assert.ok(budgetIdorGetBlocked, "Acesso direto a orçamento confidencial bloqueado!");

// Usuário B tenta atualizar ou excluir o orçamento de A
let budgetIdorUpdateBlocked = false;
try {
  await backend.entities.Budget.update(budgetA.id, { total: 0 });
} catch (err) {
  budgetIdorUpdateBlocked = true;
  assert.equal(err.status, 403);
}
assert.ok(budgetIdorUpdateBlocked, "Alteração de orçamento alheio bloqueada!");

console.log("✅ Isolamento de orçamentos e informações financeiras validado!");

// ── 6. Proteção de Listagem e Gerenciamento de Usuários ───────────────────────
console.log("\n[6/7] Testando Restrições de Gerenciamento de Usuários...");

// Usuário B (comum) tenta listar todos os usuários
let listUsersBlocked = false;
try {
  await backend.entities.User.list();
} catch (err) {
  listUsersBlocked = true;
  assert.equal(err.status, 403, "Usuário comum não pode listar todos os usuários");
}
assert.ok(listUsersBlocked, "Listagem geral de usuários restrita a administradores!");

// Super Admin pode listar todos os usuários normalmente
backend.auth.logout(false);
await backend.auth.loginViaEmailPassword("admin@nacif.com", "admin");
const allUsers = await backend.entities.User.list();
assert.ok(allUsers.length >= 3, "Super Admin lista usuários do sistema");

console.log("✅ Controle de acesso a dados de usuários validado!");

// ── 7. Recuperação de Senha e Expiração de Tokens ─────────────────────────────
console.log("\n[7/7] Testando Fluxo de Recuperação de Senha e Expiração...");

// Solicitação de reset
const resetReq = await backend.auth.resetPasswordRequest("usuario_a@engenharia.com");
assert.ok(resetReq.ok);
assert.ok(resetReq.recoveryLink);
const token = new URL(resetReq.recoveryLink).searchParams.get("token");
assert.ok(token, "Token de recuperação extraído do link");

// Redefinição com sucesso
const resetResult = await backend.auth.resetPassword({
  resetToken: token,
  newPassword: "nova_senha_super_segura_456",
});
assert.equal(resetResult.ok, true, "Senha redefinida com sucesso");

// Tentativa de reutilizar o token (Uso Único)
let reuseBlocked = false;
try {
  await backend.auth.resetPassword({
    resetToken: token,
    newPassword: "outra_senha_qualquer",
  });
} catch (err) {
  reuseBlocked = true;
  assert.equal(err.status, 400);
}
assert.ok(reuseBlocked, "Token de uso único descartado após o primeiro uso!");

// Login com a nova senha
backend.auth.logout(false);
const newLogin = await backend.auth.loginViaEmailPassword(
  "usuario_a@engenharia.com",
  "nova_senha_super_segura_456"
);
assert.ok(newLogin.access_token, "Login com nova senha bem-sucedido");

console.log("✅ Fluxo de recuperação de senha e descarte de token validado!");

console.log("\n=================================================");
console.log("🎉 TODOS OS TESTES DE SEGURANÇA E AUTENTICAÇÃO PASSARAM COM SUCESSO!");
console.log("=================================================");
