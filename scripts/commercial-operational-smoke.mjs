import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PLAN_CATALOG,
  FEATURE_KEYS,
  getPlanByCode,
  normalizeSubscription,
  checkProjectCreationAllowed,
  getDataRetentionPolicy,
} from "../src/lib/subscriptionPlans.js";

import {
  INCIDENT_SEVERITY,
  SUPPORT_CHANNELS,
  classifyIncident,
  INCIDENT_RUNBOOK_STEPS,
  INCIDENT_NOTIFICATION_TEMPLATES,
} from "../src/lib/incidentResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=== INICIANDO AUDITORIA COMERCIAL E OPERACIONAL (NACIF) ===\n");

// 1. Auditoria dos Planos Comerciais e Limites
console.log("1. Validando catálogo de planos comerciais...");
assert(Array.isArray(PLAN_CATALOG), "PLAN_CATALOG deve ser um array");
assert.equal(PLAN_CATALOG.length, 3, "Devem existir 3 planos definidos (free, professional, engineering)");

const freePlan = getPlanByCode("free");
assert.equal(freePlan.monthlyPrice, 0, "Plano gratuito deve ser R$ 0");
assert.equal(freePlan.limits[FEATURE_KEYS.PROJECTS], 3, "Plano gratuito deve ter limite de 3 projetos");

const proPlan = getPlanByCode("professional");
assert.equal(proPlan.monthlyPrice, 49, "Plano profissional deve custar R$ 49/mês");
assert.equal(proPlan.annualPrice, 470, "Plano profissional anual deve custar R$ 470");
assert.equal(proPlan.limits[FEATURE_KEYS.PROJECTS], 50, "Plano profissional deve ter limite de 50 projetos");

const engPlan = getPlanByCode("engineering");
assert.equal(engPlan.monthlyPrice, 99, "Plano engenharia deve custar R$ 99/mês");
assert.equal(engPlan.limits[FEATURE_KEYS.PROJECTS], Number.POSITIVE_INFINITY, "Plano engenharia deve ter projetos ilimitados");

console.log("  [OK] Planos comerciais e limites validados com sucesso.");

// 2. Auditoria da Política de Retenção de Dados e Guarda de Projetos
console.log("\n2. Validando política de retenção de dados e cancelamento...");
const retentionPolicy = getDataRetentionPolicy();
assert(retentionPolicy.guarantees.length >= 4, "Devem existir pelo menos 4 garantias estruturadas de retenção");
const guaranteesText = JSON.stringify(retentionPolicy.guarantees);
assert(guaranteesText.includes("Preservação de Projetos"), "Deve conter garantia de preservação de projetos");
assert(guaranteesText.includes("Sem Exclusão Silenciosa"), "Deve conter garantia contra exclusão silenciosa");

// Teste de criação de projeto sob limites
const freeUser = { subscription: { plan_code: "free" } };
const allowedCheck1 = checkProjectCreationAllowed(freeUser, 2);
assert.equal(allowedCheck1.allowed, true, "Usuário free com 2 projetos deve poder criar o 3º");

const blockedCheck1 = checkProjectCreationAllowed(freeUser, 3);
assert.equal(blockedCheck1.allowed, false, "Usuário free com 3 projetos não deve poder criar o 4º");
assert(blockedCheck1.reason.includes("Limite de 3 projetos"), "Motivo de bloqueio deve ser claro");

const engUser = { subscription: { plan_code: "engineering" } };
const allowedCheck2 = checkProjectCreationAllowed(engUser, 150);
assert.equal(allowedCheck2.allowed, true, "Usuário engenharia deve ter criação ilimitada de projetos");

console.log("  [OK] Preservação de dados e controle de limites validados com sucesso.");

// 3. Auditoria do Protocolo Operacional de Incidentes Críticos e SLAs
console.log("\n3. Validando protocolo de incidentes críticos e SLAs...");
assert.equal(INCIDENT_SEVERITY.CRITICAL.slaFirstResponseMinutes, 30, "SLA crítico deve ser de 30 minutos");
assert.equal(INCIDENT_SEVERITY.HIGH.slaFirstResponseMinutes, 120, "SLA alto deve ser de 2 horas");
assert.equal(SUPPORT_CHANNELS.officialEmail, "suporte@nacifelectric.com.br", "Canal oficial de suporte deve estar correto");

const criticalIncident = classifyIncident({ databaseDown: true });
assert.equal(criticalIncident.level, "P1", "Falha de banco de dados deve ser classificada como P1 (Crítico)");

const highIncident = classifyIncident({ coreModuleDown: true });
assert.equal(highIncident.level, "P2", "Módulo principal inoperante deve ser P2 (Alto)");

const lowIncident = classifyIncident({});
assert.equal(lowIncident.level, "P4", "Ocorrência sem impacto crítico deve ser P4 (Baixo)");

assert.equal(INCIDENT_RUNBOOK_STEPS.length, 6, "Runbook de incidentes deve conter 6 etapas operacionais");
const notif = INCIDENT_NOTIFICATION_TEMPLATES.investigating("Falha de Conexão", "Banco de Dados");
assert(notif.body.includes("permanecem íntegros"), "Notificação de cliente deve garantir a integridade dos dados");

console.log("  [OK] Protocolo de incidentes, matriz de severidade e SLAs validados com sucesso.");

// 4. Auditoria dos Arquivos de Termos de Uso, Privacidade e Cadastro
console.log("\n4. Validando integridade dos termos jurídicos e consentimento...");
const termsContent = fs.readFileSync(path.join(rootDir, "src/pages/legal/TermsOfService.jsx"), "utf-8");
assert(termsContent.includes("NBR 5410"), "Termos devem referenciar NBR 5410");
assert(termsContent.includes("ART/TRT/RRT") || termsContent.includes("ART/RRT"), "Termos devem esclarecer responsabilidade do profissional legalmente habilitado");
assert(termsContent.includes("juridico@nacifelectric.com.br"), "Termos devem indicar e-mail jurídico");

const privacyContent = fs.readFileSync(path.join(rootDir, "src/pages/legal/PrivacyPolicy.jsx"), "utf-8");
assert(privacyContent.includes("LGPD") || privacyContent.includes("13.709"), "Política de privacidade deve referenciar LGPD");

const registerContent = fs.readFileSync(path.join(rootDir, "src/pages/Register.jsx"), "utf-8");
assert(registerContent.includes("accept-terms"), "Cadastro deve conter checkbox de aceitação de termos");
assert(registerContent.includes("terms_accepted"), "Cadastro deve persistir flag de aceitação de termos");
assert(registerContent.includes("/terms"), "Cadastro deve conter link para Termos de Uso");
assert(registerContent.includes("/privacy"), "Cadastro deve conter link para Política de Privacidade");

console.log("  [OK] Termos de uso, política de privacidade e aceite no cadastro validados com sucesso.");

// 5. Auditoria da Experiência de Onboarding no Dashboard
console.log("\n5. Validando experiência de onboarding para novos clientes...");
const homeContent = fs.readFileSync(path.join(rootDir, "src/pages/Home.jsx"), "utf-8");
assert(homeContent.includes("Bem-vindo ao Nacif Electric"), "Dashboard deve possuir mensagem de boas-vindas para clientes sem projetos");
assert(homeContent.includes("Criar Primeiro Projeto"), "Dashboard deve ter botão de criação do primeiro projeto no estado vazio");
assert(homeContent.includes("Guia Rápido de Uso"), "Dashboard deve conter link para a Central de Ajuda");

console.log("  [OK] Onboarding e estado vazio de novos usuários validados com sucesso.");

// 6. Auditoria da Central de Ajuda e Documentação Técnica
console.log("\n6. Validando Central de Ajuda e Documentação de Utilização...");
const helpContent = fs.readFileSync(path.join(rootDir, "src/pages/support/HelpCenter.jsx"), "utf-8");
assert(helpContent.includes("Gestão de Projetos"), "Central de ajuda deve documentar Gestão de Projetos");
assert(helpContent.includes("Calculadora & Dimensionamento NBR 5410"), "Central de ajuda deve documentar a Calculadora");
assert(helpContent.includes("Orçamentos & Lista de Materiais"), "Central de ajuda deve documentar Orçamentos");
assert(helpContent.includes("Suporte & Relato de Incidentes"), "Central de ajuda deve documentar Suporte e Incidentes");
assert(helpContent.includes("suporte@nacifelectric.com.br"), "Central de ajuda deve indicar o e-mail oficial de suporte");

console.log("  [OK] Documentação técnica de utilização validada com sucesso.");

// 7. Auditoria da Página de Status e Avisos/Erros
console.log("\n7. Validando páginas operacionais (Status e Cancelamento)...");
const statusContent = fs.readFileSync(path.join(rootDir, "src/pages/support/SystemStatus.jsx"), "utf-8");
assert(statusContent.includes("Protocolo Operacional & Níveis de Serviço (SLA)"), "Página de status deve exibir o protocolo e SLAs");

const cancelContent = fs.readFileSync(path.join(rootDir, "src/pages/billing/CancelSubscription.jsx"), "utf-8");
assert(cancelContent.includes("Nenhum projeto ou dado criado será apagado"), "Página de cancelamento deve assegurar preservação dos projetos");

console.log("  [OK] Telas de status, SLA e cancelamento validadas com sucesso.");

console.log("\n========================================================");
console.log("TODOS OS 7 MÓDULOS DE AUDITORIA FORAM APROVADOS COM SUCESSO!");
console.log("========================================================\n");
