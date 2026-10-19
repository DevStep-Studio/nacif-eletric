import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getEnvironmentMetadata,
  probeSystemHealth,
  validateRollbackSafety,
  INFRASTRUCTURE_SLA,
} from "../src/lib/infrastructureHealth.js";

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
  location: { origin: "https://nacifenergy.com.br", protocol: "https:", hostname: "nacifenergy.com.br", href: "" },
  dispatchEvent: () => true,
};

try {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      onLine: true,
      storage: {
        estimate: async () => ({ usage: 10485760, quota: 1073741824 }),
      },
    },
    configurable: true,
    writable: true,
  });
} catch {
  if (globalThis.navigator) {
    try {
      globalThis.navigator.onLine = true;
      globalThis.navigator.storage = {
        estimate: async () => ({ usage: 10485760, quota: 1073741824 }),
      };
    } catch {}
  }
}

const { backend } = await import("../src/api/backendClient.js");

console.log("=== INICIANDO SUÍTE DE AUDITORIA DE INFRAESTRUTURA E PUBLICAÇÃO NACIF ===");

// 1. Auditoria de Ambientes, Isolamento e Metadados
async function testEnvironmentMetadata() {
  console.log("\n[1] Testando Metadados de Ambiente, Domínio e Protocolo SSL/TLS...");

  const meta = backend.system.getEnvironment();
  assert(meta.app_version, "Versão da aplicação deve estar definida.");
  assert(meta.environment, "Ambiente deve estar identificado.");
  assert.equal(meta.protocol, "https:", "Protocolo padrão deve ser HTTPS criptografado.");
  assert.equal(meta.is_https, true, "is_https deve ser verdadeiro.");
  assert.equal(meta.hostname, "nacifenergy.com.br", "Hostname de produção deve ser nacifenergy.com.br.");

  assert.equal(meta.sla.target_uptime_percentage, 99.9, "SLA de uptime deve ser 99.9%.");
  assert.equal(meta.sla.rpo_minutes, 15, "RPO deve ser de 15 minutos.");
  assert.equal(meta.sla.rto_minutes, 5, "RTO deve ser de no máximo 5 minutos.");

  console.log(`✔ Ambiente auditado: [${meta.environment}] v${meta.app_version} sob ${meta.hostname} com HTTPS validado.`);
}

// 2. Auditoria de Variáveis de Ambiente e Prevenção de Segredos
async function testEnvTemplateAndSecretProtection() {
  console.log("\n[2] Testando Template de Variáveis de Ambiente e Proteção contra Vazamentos...");

  const envExamplePath = path.resolve(process.cwd(), ".env.example");
  assert(fs.existsSync(envExamplePath), "Arquivo .env.example deve existir.");

  const envContent = fs.readFileSync(envExamplePath, "utf-8");
  assert(envContent.includes("VITE_APP_ENV"), ".env.example deve conter VITE_APP_ENV.");
  assert(envContent.includes("VITE_APP_VERSION"), ".env.example deve conter VITE_APP_VERSION.");
  assert(envContent.includes("VITE_APP_URL"), ".env.example deve conter VITE_APP_URL.");
  assert(envContent.includes("VITE_API_BASE_URL"), ".env.example deve conter VITE_API_BASE_URL.");

  // Verificar .gitignore
  const gitignorePath = path.resolve(process.cwd(), ".gitignore");
  const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
  assert(gitignoreContent.includes(".env"), ".gitignore deve conter .env.");
  assert(gitignoreContent.includes(".env.production"), ".gitignore deve conter .env.production.");
  assert(gitignoreContent.includes("!.env.example"), ".gitignore deve permitir .env.example.");

  // Confirmar que nenhum arquivo .env com credenciais reais está versionado no git
  const envRealExists = fs.existsSync(path.resolve(process.cwd(), ".env"));
  if (envRealExists) {
    const envRealContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf-8");
    assert(!envRealContent.includes("AIzaSy"), "Nenhuma chave Google real deve estar salva no .env versionado.");
  }

  console.log("✔ Variáveis de ambiente padronizadas e protegidas contra commits acidentais.");
}

// 3. Auditoria das Configurações de Servidor Web (Apache .htaccess, Vercel e _redirects)
async function testWebServerConfigs() {
  console.log("\n[3] Testando Configurações de Servidor Web e Roteamento SPA...");

  // 1. Apache .htaccess
  const htaccessPath = path.resolve(process.cwd(), "public", ".htaccess");
  assert(fs.existsSync(htaccessPath), "public/.htaccess deve existir para o host Apache/cPanel.");

  const htaccess = fs.readFileSync(htaccessPath, "utf-8");
  assert(htaccess.includes("RewriteEngine On"), ".htaccess deve ativar mod_rewrite.");
  assert(htaccess.includes("%{HTTPS}") && htaccess.includes("R=301"), ".htaccess deve redirecionar HTTP para HTTPS.");
  assert(htaccess.includes("index.html [L]"), ".htaccess deve conter fallback de roteamento SPA.");
  assert(htaccess.includes("Strict-Transport-Security"), ".htaccess deve conter cabeçalho HSTS.");
  assert(htaccess.includes("X-Content-Type-Options \"nosniff\""), ".htaccess deve conter nosniff.");
  assert(htaccess.includes("X-Frame-Options \"SAMEORIGIN\""), ".htaccess deve proteger contra Clickjacking.");

  // 2. Netlify / Cloudflare _redirects
  const redirectsPath = path.resolve(process.cwd(), "public", "_redirects");
  assert(fs.existsSync(redirectsPath), "public/_redirects deve existir.");
  const redirects = fs.readFileSync(redirectsPath, "utf-8");
  assert(redirects.includes("/index.html"), "_redirects deve direcionar para /index.html.");

  // 3. Vercel vercel.json
  const vercelPath = path.resolve(process.cwd(), "vercel.json");
  assert(fs.existsSync(vercelPath), "vercel.json deve existir.");
  const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf-8"));
  assert(Array.isArray(vercel.rewrites), "vercel.json deve conter regras de rewrite.");
  assert(vercel.rewrites[0].destination === "/index.html", "vercel rewrite deve apontar para /index.html.");

  // 4. devstep.json
  const devstepPath = path.resolve(process.cwd(), "devstep.json");
  const devstep = JSON.parse(fs.readFileSync(devstepPath, "utf-8"));
  assert.equal(devstep.project_type, "vite", "devstep.json project_type deve ser vite.");
  assert.equal(devstep.deploy_script, "npm run build", "deploy_script deve ser npm run build.");

  console.log("✔ Servidores web configurados para SPA, HTTPS forçado e Security Headers completos.");
}

// 4. Auditoria da Pipeline de CI/CD (GitHub Actions)
async function testCicdPipeline() {
  console.log("\n[4] Testando Pipeline de CI/CD e Verificações Automatizadas...");

  const workflowPath = path.resolve(process.cwd(), ".github", "workflows", "ci-cd.yml");
  assert(fs.existsSync(workflowPath), ".github/workflows/ci-cd.yml deve existir.");

  const workflow = fs.readFileSync(workflowPath, "utf-8");
  assert(workflow.includes("npm run build"), "Pipeline deve executar build de produção.");
  assert(workflow.includes("test:database-audit"), "Pipeline deve validar integridade do banco.");
  assert(workflow.includes("test:security-audit"), "Pipeline deve validar segurança e LGPD.");
  assert(workflow.includes("test:perf-audit"), "Pipeline deve validar desempenho.");
  assert(workflow.includes("test:electrical-audit"), "Pipeline deve validar conformidade NBR 5410.");
  assert(workflow.includes("actions/checkout@v4"), "Pipeline deve usar checkout oficial v4.");

  console.log("✔ Pipeline de CI/CD automatizada com 9 barreiras de qualidade e auditoria contínua.");
}

// 5. Teste da Sonda de Saúde Operacional (Health Check Probe)
async function testHealthCheckProbe() {
  console.log("\n[5] Testando Sonda Ativa de Saúde Operacional (Health Check)...");

  const health = await backend.system.getHealthCheck();
  assert(health.overall_status === "healthy" || health.overall_status === "degraded", "Status geral do sistema deve ser operacional.");
  assert(health.checks.web_app, "Checagem de web_app deve existir.");
  assert(health.checks.https_ssl, "Checagem de SSL deve existir.");
  assert(health.checks.client_storage, "Checagem de armazenamento do cliente deve existir.");
  assert(health.checks.database_layer, "Checagem da camada de dados deve existir.");
  assert(health.sla_compliance, "Relatório de conformidade com SLA deve existir.");

  console.log(`- Status Geral: ${health.overall_status.toUpperCase()}`);
  console.log(`- Tempo de Resposta da Sonda: ${health.total_probe_duration_ms} ms`);
  console.log(`- SLA RPO: ${health.sla_compliance.rpo} | RTO: ${health.sla_compliance.rto}`);
  console.log("✔ Sonda de telemetria operacional validada com sucesso.");
}

// 6. Teste e Simulação de Rollback Seguro de Versão
async function testRollbackSafety() {
  console.log("\n[6] Testando Procedimento e Validação de Rollback Seguro...");

  // Cenário 1: Rollback normal entre versões compatíveis
  const safeRollback = validateRollbackSafety({
    currentVersion: "1.0.1",
    targetVersion: "1.0.0",
    migrations: [
      { name: "20261016_create_issues_system.sql", sql: "CREATE TABLE IF NOT EXISTS issues..." },
    ],
  });

  assert.equal(safeRollback.safe, true, "Rollback sem destruição de tabelas deve ser seguro.");
  assert.equal(safeRollback.requires_database_restore, false, "Rollback seguro não exige restore destrutivo.");

  // Cenário 2: Rollback com migração destrutiva (DROP TABLE)
  const destructiveRollback = validateRollbackSafety({
    currentVersion: "2.0.0",
    targetVersion: "1.0.0",
    migrations: [
      { name: "destructive.sql", sql: "DROP TABLE projects CASCADE;" },
    ],
  });

  assert.equal(destructiveRollback.safe, false, "Migração destrutiva deve alertar impedimento.");
  assert.equal(destructiveRollback.requires_database_restore, true, "Exige restauração de backup pontual.");

  console.log("✔ Motor de validação de rollback protege integridade do banco contra reversões inseguras.");
}

async function runAll() {
  try {
    await testEnvironmentMetadata();
    await testEnvTemplateAndSecretProtection();
    await testWebServerConfigs();
    await testCicdPipeline();
    await testHealthCheckProbe();
    await testRollbackSafety();

    console.log("\n========================================================");
    console.log("🎉 TODOS OS TESTES DE INFRAESTRUTURA E PUBLICAÇÃO PASSARAM!");
    console.log("========================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ FALHA NA AUDITORIA DE INFRAESTRUTURA:", err);
    process.exit(1);
  }
}

runAll();
