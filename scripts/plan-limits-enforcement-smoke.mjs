import assert from "node:assert/strict";
import {
  canAccessModule,
  checkProjectCreationAllowed,
  checkFeatureQuotaAllowed,
  resolveEffectiveSubscription,
  buildUsageFromProjects,
  getPlanByCode,
  getLimit,
  FEATURE_KEYS,
  DATA_RETENTION_POLICY,
} from "../src/lib/subscriptionPlans.js";

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

const { backend } = await import("../src/api/backendClient.js");

console.log("================================================================================");
console.log("🛡️  NACIF ENERGY — SUÍTE DE AUDITORIA DE LIMITES E DIRETRIZES DE PLANOS");
console.log("    Verificação Rigorosa de Cotas, Governança, Anti-Escalada e Retenção de Dados");
console.log("================================================================================\n");

async function testSignupDefaultsAndAntiEscalation() {
  console.log("1. Testando padrão de cadastro (free) e proteção anti-escalada...");

  mockStorage.clear();

  // Novo usuário deve nascer com plano gratuito (free) e não profissional/completo
  const regUser = await backend.auth.register({
    email: "cliente.novo@nacifenergy.com.br",
    password: "SenhaSegura#2026",
    profession: "projetista",
  });
  assert.equal(regUser.user.plan, "free", "Novo usuário deve ser registrado no plano 'free'");
  assert.equal(regUser.user.role, "user", "Novo usuário não pode receber papel administrativo");

  backend.auth.setToken(regUser.access_token);

  // Tentativa de elevação indevida de plano via updateMe
  const escalated = await backend.auth.updateMe({
    plan: "completo",
    academic_status: "approved",
  });
  assert.equal(escalated.plan, "free", "Usuário comum NÃO pode se auto-promover para plano pago via updateMe!");
  assert.notEqual(escalated.academic_status, "approved", "Usuário comum NÃO pode auto-aprovar vínculo acadêmico!");

  // Downgrade voluntário / cancelamento é permitido
  const downgraded = await backend.auth.updateMe({ plan: "free" });
  assert.equal(downgraded.plan, "free", "Cancelamento/downgrade para free é aceito");

  // Usuário super admin institucional possui papel super_admin e plano completo
  const loginSuper = await backend.auth.loginViaEmailPassword({
    email: "grc22.09@hotmail.com",
    password: "admin",
  });
  assert.equal(loginSuper.user.role, "super_admin", "Email institucional recebe super_admin");
  assert.equal(loginSuper.user.plan, "completo", "Super admin recebe plano completo");

  console.log("  [OK] Cadastro inicial 'free' e barreira contra auto-escalada validados com sucesso.");
}

async function testModuleAccessGating() {
  console.log("\n2. Testando autorização e bloqueio de módulos por plano (canAccessModule)...");

  const freeUser = { id: "u-free", email: "free@test.com", plan: "free", role: "user" };
  const studentUser = { id: "u-student", email: "student@test.com", plan: "estudante", role: "user", academic_status: "pending_review" };
  const studentExpired = { id: "u-exp", email: "exp@test.com", plan: "estudante", role: "user", academic_status: "expired" };
  const eletricoUser = { id: "u-ele", email: "ele@test.com", plan: "eletrico", role: "user" };
  const solarUser = { id: "u-sol", email: "sol@test.com", plan: "solar", role: "user" };
  const completoUser = { id: "u-com", email: "com@test.com", plan: "completo", role: "user" };
  const adminUser = { id: "u-adm", email: "admin@test.com", plan: "free", role: "admin" };

  // FREE
  assert.equal(canAccessModule(freeUser, "solar").allowed, false, "Free não acessa dimensionamento solar");
  assert.equal(canAccessModule(freeUser, "panel").allowed, false, "Free não acessa quadro DIN");
  assert.equal(canAccessModule(freeUser, "unifilar").allowed, false, "Free não acessa diagrama unifilar");
  assert.equal(canAccessModule(freeUser, "team").allowed, false, "Free não acessa gestão de equipe");
  const freePlant = canAccessModule(freeUser, "plant");
  assert.equal(freePlant.allowed, true, "Free avalia planta em até 3 projetos");
  assert.equal(freePlant.isFreeRestricted, true, "Planta no free tem flag de restrição de avaliação");

  // ESTUDANTE
  assert.equal(canAccessModule(studentUser, "solar").allowed, true, "Estudante acessa solar");
  assert.equal(canAccessModule(studentUser, "panel").allowed, true, "Estudante acessa quadro DIN");
  assert.equal(canAccessModule(studentUser, "unifilar").allowed, true, "Estudante acessa unifilar");
  assert.equal(canAccessModule(studentUser, "team").allowed, false, "Estudante é individual: equipe bloqueada");
  assert.equal(canAccessModule(studentExpired, "plant").allowed, false, "Estudante com vínculo expirado é bloqueado");

  // ELÉTRICO
  assert.equal(canAccessModule(eletricoUser, "solar").allowed, false, "Elétrico não acessa solar");
  assert.equal(canAccessModule(eletricoUser, "plant").allowed, true, "Elétrico acessa planta");
  assert.equal(canAccessModule(eletricoUser, "panel").allowed, true, "Elétrico acessa quadro DIN");
  assert.equal(canAccessModule(eletricoUser, "unifilar").allowed, true, "Elétrico acessa unifilar");

  // SOLAR
  assert.equal(canAccessModule(solarUser, "solar").allowed, true, "Solar acessa solar");
  assert.equal(canAccessModule(solarUser, "plant").allowed, false, "Solar não acessa planta predial");
  assert.equal(canAccessModule(solarUser, "panel").allowed, false, "Solar não acessa quadro DIN");

  // COMPLETO E ADMIN
  assert.equal(canAccessModule(completoUser, "solar").allowed, true, "Completo acessa solar");
  assert.equal(canAccessModule(completoUser, "panel").allowed, true, "Completo acessa quadro DIN");
  assert.equal(canAccessModule(adminUser, "solar").allowed, true, "Admin acessa qualquer módulo");

  // Inadimplência / Cancelamento cai para free
  const cancelledUser = { id: "u-canc", email: "canc@test.com", plan: "completo", subscription_status: "cancelled" };
  assert.equal(canAccessModule(cancelledUser, "solar").allowed, false, "Assinatura cancelada cai para direitos free");

  console.log("  [OK] Regras de autorização por módulo e plano validadas com sucesso.");
}

async function testProjectCreationAndDuplicationLimits() {
  console.log("\n3. Testando limites de criação e duplicação de projetos...");

  mockStorage.clear();
  const reg = await backend.auth.register({
    email: "projetos.limite@nacif.test",
    password: "Password#123",
    profession: "projetista",
  });
  backend.auth.setToken(reg.access_token);

  // Usuário free pode criar até 3 projetos
  const p1 = await backend.entities.Project.create({ name: "Projeto Free 1", project_type: "Instalações Elétricas" });
  const p2 = await backend.entities.Project.create({ name: "Projeto Free 2", project_type: "Instalações Elétricas" });
  const p3 = await backend.entities.Project.create({ name: "Projeto Free 3", project_type: "Instalações Elétricas" });

  assert.ok(p1.id && p2.id && p3.id, "3 projetos criados no plano free");

  // 4º projeto deve ser bloqueado com 403
  let creationBlocked = false;
  try {
    await backend.entities.Project.create({ name: "Projeto Free 4", project_type: "Instalações Elétricas" });
  } catch (err) {
    creationBlocked = true;
    assert.equal(err.status, 403, "Criação acima de 3 projetos deve retornar HTTP 403");
  }
  assert.equal(creationBlocked, true, "4º projeto foi bloqueado corretamente");

  // Duplicação também deve ser bloqueada quando no limite de 3 projetos
  let dupBlocked = false;
  try {
    await backend.entities.Project.duplicate(p1.id);
  } catch (err) {
    dupBlocked = true;
    assert.equal(err.status, 403, "Duplicação acima da cota deve retornar HTTP 403");
  }
  assert.equal(dupBlocked, true, "Duplicação acima da cota foi bloqueada");

  // Upgrade para plano Elétrico
  await backend.subscriptions.changePlan({ planCode: "eletrico", cycle: "monthly" });

  // Agora pode criar até 30 projetos
  const p4 = await backend.entities.Project.create({ name: "Projeto Elétrico 4", project_type: "Instalações Elétricas" });
  assert.ok(p4.id, "Projeto criado com sucesso após upgrade");

  // Mas Elétrico não pode criar projeto Solar!
  let solarBlockedOnEletrico = false;
  try {
    await backend.entities.Project.create({ name: "Projeto Solar Bloqueado", project_type: "Solar" });
  } catch (err) {
    solarBlockedOnEletrico = true;
    assert.equal(err.status, 403, "Projeto solar no plano elétrico deve retornar 403");
  }
  assert.equal(solarBlockedOnEletrico, true, "Restrição de disciplina solar no plano elétrico validada");

  console.log("  [OK] Limites de criação, duplicação e restrições de disciplina validados com sucesso.");
}

async function testMonthlyAiScansAndExportsQuotas() {
  console.log("\n4. Testando cotas mensais de Scans de IA e Exportações...");

  mockStorage.clear();
  const reg = await backend.auth.register({
    email: "cotas.teste@nacif.test",
    password: "Password#123",
    profession: "projetista",
  });
  backend.auth.setToken(reg.access_token);

  // Usuário free possui cota de 5 scans de IA por mês
  for (let i = 1; i <= 5; i++) {
    const res = await backend.integrations.Core.InvokeLLM({ prompt: `Teste IA ${i}`, response_json_schema: { properties: { unit_price: {} } } });
    assert.ok(res, `IA scan ${i} deve ser executado`);
  }

  // 6ª chamada de IA deve ser bloqueada com 403
  let aiQuotaExhausted = false;
  try {
    await backend.integrations.Core.InvokeLLM({ prompt: "Teste IA 6", response_json_schema: { properties: { unit_price: {} } } });
  } catch (err) {
    aiQuotaExhausted = true;
    assert.equal(err.status, 403, "Cota de IA esgotada deve retornar HTTP 403");
  }
  assert.equal(aiQuotaExhausted, true, "6ª operação de IA foi bloqueada por limite mensal");

  // Usuário free possui cota de 5 exportações por mês
  for (let i = 1; i <= 5; i++) {
    const exp = await backend.subscriptions.consumeExportQuota({ format: "PDF", label: `Prancha ${i}` });
    assert.equal(exp.allowed, true, `Exportação ${i} deve ser autorizada`);
  }

  // 6ª exportação deve retornar allowed: false
  const expBlocked = await backend.subscriptions.consumeExportQuota({ format: "PDF", label: "Prancha 6" });
  assert.equal(expBlocked.allowed, false, "6ª exportação mensal no free deve ser bloqueada");
  assert(expBlocked.reason.includes("Limite mensal"), "Motivo claro do bloqueio de exportação");

  // Testando carimbo acadêmico no plano Estudante
  await backend.subscriptions.changePlan({ planCode: "estudante", cycle: "monthly" });
  const studentExp = await backend.subscriptions.consumeExportQuota({ format: "PDF", label: "Memorial Acadêmico" });
  assert.equal(studentExp.allowed, true, "Estudante tem nova cota mensal (20)");
  assert.equal(studentExp.isAcademic, true, "Exportação do estudante recebe flag de uso educacional");
  assert(studentExp.watermark.includes("Versão Acadêmica"), "Carimbo acadêmico oficial configurado");

  console.log("  [OK] Cotas mensais de IA, exportações e carimbos de conformidade validados com sucesso.");
}

async function testTeamMembersAndWorkspaceQuota() {
  console.log("\n5. Testando gestão de equipe multi-usuário (TEAM_MEMBERS)...");

  mockStorage.clear();
  const reg = await backend.auth.register({
    email: "equipe.teste@nacif.test",
    password: "Password#123",
    profession: "engenheiro",
  });
  backend.auth.setToken(reg.access_token);

  // No plano free (individual), convidar membro é bloqueado
  let inviteBlockedOnFree = false;
  try {
    await backend.subscriptions.inviteTeamMember({ email: "colab1@empresa.com", name: "Colaborador 1" });
  } catch (err) {
    inviteBlockedOnFree = true;
    assert.equal(err.status, 403, "Plano individual não permite convidar membros");
  }
  assert.equal(inviteBlockedOnFree, true, "Convite bloqueado no plano free");

  // Upgrade para plano Elétrico (permite 3 membros)
  await backend.subscriptions.changePlan({ planCode: "eletrico", cycle: "monthly" });

  const m1 = await backend.subscriptions.inviteTeamMember({ email: "membro1@empresa.com", name: "Carlos Silva" });
  const m2 = await backend.subscriptions.inviteTeamMember({ email: "membro2@empresa.com", name: "Ana Souza" });
  assert.ok(m1.id && m2.id, "2 membros adicionados (total 3 com o dono)");

  // 4º membro deve estourar o limite de 3
  let memberLimitReached = false;
  try {
    await backend.subscriptions.inviteTeamMember({ email: "membro3@empresa.com", name: "Excedente" });
  } catch (err) {
    memberLimitReached = true;
    assert.equal(err.status, 403, "Limite de 3 membros atingido");
  }
  assert.equal(memberLimitReached, true, "Limite de 3 membros respeitado");

  // Remover membro libera vaga
  await backend.subscriptions.removeTeamMember(m1.id);
  const teamAfterRemoval = await backend.subscriptions.getTeamMembers();
  assert.equal(teamAfterRemoval.members.length, 1, "Membro removido com sucesso");

  console.log("  [OK] Gestão de equipe e limites (1/3/15) validados com sucesso.");
}

async function runAll() {
  try {
    await testSignupDefaultsAndAntiEscalation();
    await testModuleAccessGating();
    await testProjectCreationAndDuplicationLimits();
    await testMonthlyAiScansAndExportsQuotas();
    await testTeamMembersAndWorkspaceQuota();

    console.log("\n================================================================================");
    console.log("🎉 TODOS OS TESTES DE LIMITES, DIRETRIZES E GOVERNANÇA FORAM APROVADOS!");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("\n❌ ERRO NA AUDITORIA DE LIMITES:", err);
    process.exit(1);
  }
}

runAll();
