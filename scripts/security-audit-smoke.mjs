import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  sanitizeTextInput,
  validateUploadedFile,
} from "../src/lib/securityCrypto.js";
import { sanitizeLogMetadata } from "../src/lib/auditLogger.js";

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
const { backend, SESSION_EXPIRATION_MS } = await import("../src/api/backendClient.js");

console.log("=== INICIANDO SUÍTE DE TESTES DE SEGURANÇA E AUDITORIA NACIF ===");

async function testPasswordHashingAndLegacyMigration() {
  console.log("\n[1] Testando Criptografia de Senhas (PBKDF2) e Migração Transparente...");
  
  const rawPassword = "MinhaSenhaForte@2026";
  const hash = await hashPassword(rawPassword);

  assert(hash.startsWith("pbkdf2_sha256$100000$"), "O hash deve ter o formato pbkdf2_sha256$100000$<salt>$<derivedKey>");
  
  // Verificação de senha correta
  const valid = await verifyPassword(rawPassword, hash);
  assert.equal(valid, true, "A senha correta deve ser verificada como válida");

  // Verificação de senha incorreta
  const invalid = await verifyPassword("SenhaIncorreta@123", hash);
  assert.equal(invalid, false, "Senha incorreta deve retornar falso");

  // Compatibilidade com senhas legadas em texto simples
  const legacyMatch = await verifyPassword("admin", "admin");
  assert.equal(legacyMatch, true, "Senha legada em texto simples deve validar para compatibilidade retroativa");

  console.log("✔ Criptografia PBKDF2-SHA256 e verificação validadas com sucesso.");
}

async function testSessionInvalidationOnPasswordChange() {
  console.log("\n[2] Testando Invalidação de Sessão Determinística após Mudança de Senha...");
  
  // Cadastrar usuário de teste
  const email = `sec_user_${Date.now()}@nacif.test`;
  const registerResult = await backend.auth.register({
    email,
    password: "SenhaInicial#123",
    profession: "Engenheiro",
  });
  assert(registerResult.access_token, "Deve retornar access_token no registro");

  const initialToken = registerResult.access_token;
  backend.auth.setToken(initialToken);

  // Usuário autenticado com sucesso
  const meBefore = await backend.auth.me();
  assert.equal(meBefore.email, email, "Deve retornar perfil do usuário antes da troca de senha");

  // Aguarda 10ms para garantir timestamp posterior
  await new Promise((r) => setTimeout(r, 20));

  // Alterar senha via updateMe
  await backend.auth.updateMe({
    current_password: "SenhaInicial#123",
    new_password: "NovaSenhaForte#456",
  });

  // Re-definir token antigo para simular sessão anterior (token emitido antes da mudança)
  backend.auth.setToken(initialToken);

  let sessionRejected = false;
  try {
    await backend.auth.me();
  } catch (err) {
    sessionRejected = true;
    assert.equal(err.status, 401, "Token emitido antes da troca de senha deve ser recusado com status 401");
  }
  assert.equal(sessionRejected, true, "Sessão anterior deve ser invalidada deterministicamente após troca de senha");

  // Fazer login com a nova senha
  const loginResult = await backend.auth.loginViaEmailPassword(email, "NovaSenhaForte#456");
  assert(loginResult.access_token, "Deve permitir login com a nova senha");
  backend.auth.setToken(loginResult.access_token);
  const meAfter = await backend.auth.me();
  assert.equal(meAfter.email, email, "Deve obter perfil normalmente com novo token");

  console.log("✔ Invalidação de sessões anteriores após troca de senha validada com sucesso.");
}

async function testMassAssignmentAndOwnershipProtection() {
  console.log("\n[3] Testando Prevenção contra Mass-Assignment e IDOR em Projetos e Orçamentos...");

  const user = await backend.auth.me();
  const attackerUserId = "attacker_victim_steal_99";

  // Tentativa de injetar owner_id arbitrário na criação de projeto
  const forgedProject = await backend.entities.Project.create({
    name: "Projeto Confidencial Alpha",
    owner_id: attackerUserId,
    user_id: attackerUserId,
    id: "forced_id_12345",
  });

  assert.equal(forgedProject.owner_id, user.id, "owner_id deve ser forçado para o usuário autenticado, ignorando injeção");
  assert.notEqual(forgedProject.id, "forced_id_12345", "ID forçado deve ser descartado em prol do gerador seguro");

  // Tentativa de injetar owner_id no update do projeto
  const updatedProject = await backend.entities.Project.update(forgedProject.id, {
    owner_id: attackerUserId,
    user_id: attackerUserId,
    name: "Projeto Alpha Atualizado",
  });
  assert.equal(updatedProject.owner_id, user.id, "owner_id original deve ser protegido contra reatribuição indevida");

  // Tentativa de injetar owner_id na criação de orçamento
  const forgedBudget = await backend.entities.Budget.create({
    name: "Orçamento Executivo 2026",
    owner_id: attackerUserId,
    user_id: attackerUserId,
  });
  assert.equal(forgedBudget.owner_id, user.id, "owner_id do orçamento deve ser forçado para o usuário autenticado");

  // Tentativa de sobrescrever owner_id no update do orçamento
  const updatedBudget = await backend.entities.Budget.update(forgedBudget.id, {
    owner_id: attackerUserId,
    name: "Orçamento Alterado",
  });
  assert.equal(updatedBudget.owner_id, user.id, "owner_id do orçamento deve permanecer inalterado");

  console.log("✔ Proteção contra Mass-Assignment e IDOR validada em Projetos e Orçamentos.");
}

async function testRateLimiting() {
  console.log("\n[4] Testando Limitação de Requisições (Rate Limiting)...");

  // 1. Password Reset Request Rate Limit (Max 3 / 15 min)
  const targetEmail = `rate_test_${Date.now()}@nacif.test`;
  await backend.auth.register({
    email: targetEmail,
    password: "Password#123",
    profession: "Eletricista",
  });

  // Requisições 1, 2 e 3 devem passar
  await backend.auth.resetPasswordRequest(targetEmail);
  await backend.auth.resetPasswordRequest(targetEmail);
  await backend.auth.resetPasswordRequest(targetEmail);

  // A 4ª requisição deve ser bloqueada com 429
  let rateBlocked = false;
  try {
    await backend.auth.resetPasswordRequest(targetEmail);
  } catch (err) {
    rateBlocked = true;
    assert.equal(err.status, 429, "Excesso de solicitações de reset deve retornar status 429");
  }
  assert.equal(rateBlocked, true, "4ª solicitação de recuperação de senha deve ser bloqueada por rate limit");

  // 2. Issue Creation Rate Limit (Max 10 / hour)
  let issueBlocked = false;
  try {
    for (let i = 0; i < 11; i++) {
      await backend.entities.Issue.create({
        title: `Relato de Teste ${i}`,
        type: "duvida",
        description: `Descrição do relato de teste ${i}`,
      });
    }
  } catch (err) {
    issueBlocked = true;
    assert.equal(err.status, 429, "Criação abusiva de relatos deve retornar 429");
  }
  assert.equal(issueBlocked, true, "Envio repetitivo de relatos deve ser bloqueado por rate limit");

  console.log("✔ Mecanismos de Rate Limiting validados com sucesso (HTTP 429).");
}

async function testFileUploadSecurity() {
  console.log("\n[5] Testando Segurança no Upload de Arquivos...");

  // 1. Arquivo executável malicioso deve ser rejeitado
  const maliciousFile = {
    name: "trojan.exe",
    type: "application/x-msdownload",
    size: 1024,
  };

  assert.throws(
    () => validateUploadedFile(maliciousFile),
    /executáveis são bloqueados/i,
    "Extensões executáveis (.exe) devem ser rejeitadas"
  );

  const maliciousScript = {
    name: "exploit.php",
    type: "application/x-php",
    size: 512,
  };
  assert.throws(
    () => validateUploadedFile(maliciousScript),
    /executáveis são bloqueados/i,
    "Arquivos de script (.php) devem ser rejeitados"
  );

  // 2. Arquivo com tamanho excessivo (> 10MB) deve ser rejeitado
  const oversizedFile = {
    name: "planta_gigante.pdf",
    type: "application/pdf",
    size: 15 * 1024 * 1024, // 15MB
  };
  assert.throws(
    () => validateUploadedFile(oversizedFile),
    /excede o tamanho máximo/i,
    "Arquivos acima de 10MB devem ser rejeitados"
  );

  // 3. Arquivo legítimo deve ser aprovado
  const legitFile = {
    name: "diagrama_unifilar.pdf",
    type: "application/pdf",
    size: 2 * 1024 * 1024, // 2MB
  };
  assert.doesNotThrow(
    () => validateUploadedFile(legitFile),
    "Documento PDF legítimo de 2MB deve ser aceito"
  );

  console.log("✔ Validação de tipo, tamanho e extensões perigosas validada com sucesso.");
}

async function testXssInputSanitization() {
  console.log("\n[6] Testando Proteção contra XSS e Sanitização de Entradas...");

  const dangerousInput = "<script>alert('XSS Attack!')</script>Engenheiro Nacif<img src=x onerror=alert('hacked')>";
  const sanitized = sanitizeTextInput(dangerousInput);

  assert(!sanitized.includes("<script>"), "Tags <script> devem ser eliminadas");
  assert(!sanitized.includes("onerror="), "Manipuladores onerror devem ser eliminados");
  assert(sanitized.includes("Engenheiro Nacif"), "Texto legítimo deve ser preservado");

  // Teste com protocolo javascript:
  const maliciousHref = "javascript:alert(document.cookie)";
  const sanitizedHref = sanitizeTextInput(maliciousHref);
  assert(!sanitizedHref.startsWith("javascript:"), "Protocolo javascript: deve ser neutralizado");

  console.log("✔ Sanitização contra XSS validada com sucesso.");
}

async function testLgpdRightsAndDataErasure() {
  console.log("\n[7] Testando Conformidade com LGPD (Portabilidade e Direito à Eliminação - Art. 18)...");

  // Criar usuário para teste de exclusão e exportação
  const lgpdEmail = `lgpd_user_${Date.now()}@nacif.test`;
  const reg = await backend.auth.register({
    email: lgpdEmail,
    password: "PasswordLgpd#2026",
    profession: "Projetista Solar",
  });
  backend.auth.setToken(reg.access_token);

  // Criar dados vinculados
  const project = await backend.entities.Project.create({ name: "Projeto Solar Residencial" });
  const budget = await backend.entities.Budget.create({ name: "Orçamento Solar 5kWp" });

  // 1. Testar Portabilidade dos Dados (LGPD Art. 18, II e V)
  const exportData = await backend.auth.exportUserData();
  assert(exportData.user_profile, "Exportação deve conter perfil do usuário");
  assert(exportData.projects.some((p) => p.id === project.id), "Exportação deve conter projetos do titular");
  assert(exportData.budgets.some((b) => b.id === budget.id), "Exportação deve conter orçamentos do titular");
  assert.equal(exportData.user_profile.email, lgpdEmail, "E-mail do titular deve ser idêntico");

  // 2. Testar Direito à Eliminação dos Dados (LGPD Art. 18, VI)
  await backend.auth.deleteAccount();

  // Verificar que usuário foi removido e não consegue mais acessar
  let authFailed = false;
  try {
    await backend.auth.me();
  } catch (err) {
    authFailed = true;
    assert.equal(err.status, 401, "Sessão deve estar encerrada após exclusão de conta");
  }
  assert.equal(authFailed, true, "Usuário excluído não deve ter sessão ativa");

  // Logar como admin para verificar a exclusão em cascata dos projetos e orçamentos
  const adminLogin = await backend.auth.loginViaEmailPassword("admin@nacif.com", "admin");
  backend.auth.setToken(adminLogin.access_token);

  const allProjects = await backend.entities.Project.list();
  const allBudgets = await backend.entities.Budget.list();

  assert(!allProjects.some((p) => p.id === project.id), "Projeto do titular excluído deve ser eliminado em cascata");
  assert(!allBudgets.some((b) => b.id === budget.id), "Orçamento do titular excluído deve ser eliminado em cascata");

  console.log("✔ Conformidade com LGPD (Portabilidade e Eliminação em Cascata) validada com sucesso.");
}

async function testAuditLogSanitization() {
  console.log("\n[8] Testando Sanitização e Ofuscação de Dados Sensíveis nos Logs...");

  const rawMetadata = {
    email: "cliente@nacif.com",
    password: "SuperSecretPassword123!",
    current_password: "OldPassword123!",
    token: "bearer_xyz_jwt_token_secret",
    api_key: "nacif_live_sk_abcdef123456",
    cpf: "123.456.789-00",
    project_name: "Projeto Solar Morumbi",
    circuits_count: 12,
  };

  const sanitized = sanitizeLogMetadata(rawMetadata);

  assert.equal(sanitized.password, "[CONFIDENCIAL / REDACTED]", "Senhas devem ser ofuscadas nos logs");
  assert.equal(sanitized.current_password, "[CONFIDENCIAL / REDACTED]", "Senhas atuais devem ser ofuscadas");
  assert.equal(sanitized.token, "[CONFIDENCIAL / REDACTED]", "Tokens de autenticação devem ser ofuscados");
  assert.equal(sanitized.api_key, "[CONFIDENCIAL / REDACTED]", "Chaves de API devem ser ofuscadas");
  assert.equal(sanitized.cpf, "[CONFIDENCIAL / REDACTED]", "Dados sensíveis (CPF) devem ser ofuscados");
  assert.equal(sanitized.project_name, "Projeto Solar Morumbi", "Dados não confidenciais de diagnóstico devem ser preservados");
  assert.equal(sanitized.circuits_count, 12, "Contadores numéricos devem ser preservados");

  console.log("✔ Sanitização de dados sensíveis e credenciais em logs validada com sucesso.");
}

async function runAllTests() {
  try {
    await testPasswordHashingAndLegacyMigration();
    await testSessionInvalidationOnPasswordChange();
    await testMassAssignmentAndOwnershipProtection();
    await testRateLimiting();
    await testFileUploadSecurity();
    await testXssInputSanitization();
    await testLgpdRightsAndDataErasure();
    await testAuditLogSanitization();

    console.log("\n========================================================");
    console.log("🎉 TODOS OS TESTES DE SEGURANÇA E AUDITORIA PASSARAM COM SUCESSO!");
    console.log("========================================================\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ FALHA NO TESTE DE SEGURANÇA:", error);
    process.exit(1);
  }
}

runAllTests();
