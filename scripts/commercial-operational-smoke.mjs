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

// 1. Auditoria dos Novos Planos Comerciais e Limites (Nacif Energy)
console.log("1. Validando catálogo dos 4 novos planos comerciais...");
assert(Array.isArray(PLAN_CATALOG), "PLAN_CATALOG deve ser um array");
assert.equal(PLAN_CATALOG.length, 4, "Devem existir 4 planos comerciais definidos (estudante, eletrico, solar, completo)");

// Plano 1: Nacif Estudante
const studentPlan = getPlanByCode("estudante");
assert.equal(studentPlan.code, "estudante", "Código do plano estudante correto");
assert.equal(studentPlan.monthlyPrice, 99.99, "Plano estudante deve custar R$ 99,99/mês");
assert.equal(studentPlan.annualPrice, null, "Plano estudante não deve ter valor anual oficialmente configurado");
assert.equal(studentPlan.limits[FEATURE_KEYS.PROJECTS], 5, "Estudante deve ter limite de 5 projetos ativos");
assert.equal(studentPlan.limits[FEATURE_KEYS.STORAGE_MB], 1000, "Estudante deve ter 1 GB (1000 MB)");
assert.equal(studentPlan.limits[FEATURE_KEYS.TEAM_MEMBERS], 1, "Estudante deve permitir 1 membro");
assert.equal(studentPlan.limits[FEATURE_KEYS.EXPORTS], 20, "Estudante deve permitir 20 exportações mensais");
assert.equal(studentPlan.limits[FEATURE_KEYS.AI_SCANS], 20, "Estudante deve permitir 20 IAs mensais");
assert.equal(studentPlan.isAcademic, true, "Plano estudante deve ter flag acadêmica");

// Plano 2: Nacif Elétrico
const eletricoPlan = getPlanByCode("eletrico");
assert.equal(eletricoPlan.code, "eletrico", "Código do plano elétrico correto");
assert.equal(eletricoPlan.monthlyPrice, 149.90, "Plano elétrico mensal deve ser R$ 149,90");
assert.equal(eletricoPlan.annualPrice, 1259.16, "Plano elétrico anual deve ser R$ 1.259,16 (30% desconto)");
assert.equal(eletricoPlan.limits[FEATURE_KEYS.PROJECTS], 30, "Elétrico deve ter limite de 30 projetos ativos");
assert.equal(eletricoPlan.limits[FEATURE_KEYS.STORAGE_MB], 5000, "Elétrico deve ter 5 GB (5000 MB)");
assert.equal(eletricoPlan.limits[FEATURE_KEYS.TEAM_MEMBERS], 3, "Elétrico deve permitir 3 usuários");
assert.equal(eletricoPlan.limits[FEATURE_KEYS.EXPORTS], 100, "Elétrico deve permitir 100 exportações");
assert.equal(eletricoPlan.limits[FEATURE_KEYS.AI_SCANS], 100, "Elétrico deve permitir 100 IAs");

// Plano 3: Nacif Solar
const solarPlan = getPlanByCode("solar");
assert.equal(solarPlan.code, "solar", "Código do plano solar correto");
assert.equal(solarPlan.monthlyPrice, 149.90, "Plano solar mensal deve ser R$ 149,90");
assert.equal(solarPlan.annualPrice, 1259.16, "Plano solar anual deve ser R$ 1.259,16 (30% desconto)");
assert.equal(solarPlan.limits[FEATURE_KEYS.PROJECTS], 30, "Solar deve ter limite de 30 projetos ativos");
assert.equal(solarPlan.limits[FEATURE_KEYS.STORAGE_MB], 5000, "Solar deve ter 5 GB (5000 MB)");
assert.equal(solarPlan.limits[FEATURE_KEYS.TEAM_MEMBERS], 3, "Solar deve permitir 3 usuários");
assert.equal(solarPlan.limits[FEATURE_KEYS.EXPORTS], 100, "Solar deve permitir 100 exportações");
assert.equal(solarPlan.limits[FEATURE_KEYS.AI_SCANS], 100, "Solar deve permitir 100 IAs");

// Plano 4: Nacif Completo
const completoPlan = getPlanByCode("completo");
assert.equal(completoPlan.code, "completo", "Código do plano completo correto");
assert.equal(completoPlan.monthlyPrice, 210.00, "Plano completo mensal deve ser R$ 210,00");
assert.equal(completoPlan.annualPrice, 1764.00, "Plano completo anual deve ser R$ 1.764,00 (30% desconto)");
assert.equal(completoPlan.limits[FEATURE_KEYS.PROJECTS], Number.POSITIVE_INFINITY, "Completo deve ter projetos ilimitados");
assert.equal(completoPlan.limits[FEATURE_KEYS.STORAGE_MB], 50000, "Completo deve ter 50 GB (50000 MB)");
assert.equal(completoPlan.limits[FEATURE_KEYS.TEAM_MEMBERS], 15, "Completo deve permitir 15 membros");
assert.equal(completoPlan.limits[FEATURE_KEYS.EXPORTS], Number.POSITIVE_INFINITY, "Completo deve ter exportações ilimitadas");
assert.equal(completoPlan.limits[FEATURE_KEYS.AI_SCANS], 500, "Completo deve permitir 500 IAs");
assert.equal(completoPlan.highlightBadge, "Mais completo", "Completo deve ter badge de destaque 'Mais completo'");

// Compatibilidade com planos legados
const legacyFree = getPlanByCode("free");
assert.equal(legacyFree.code, "free", "Plano legado gratuito deve ser resolvido");
assert.equal(legacyFree.limits[FEATURE_KEYS.PROJECTS], 3, "Plano legado gratuito preserva 3 projetos");

const legacyPro = getPlanByCode("professional");
assert.equal(legacyPro.code, "professional", "Plano legado profissional resolvido");

const legacyEng = getPlanByCode("engineering");
assert.equal(legacyEng.code, "engineering", "Plano legado engenharia resolvido");

console.log("  [OK] Os 4 novos planos comerciais e compatibilidade com legados validados com sucesso.");

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

const studentUser = { subscription: { plan_code: "estudante" } };
assert.equal(checkProjectCreationAllowed(studentUser, 4).allowed, true, "Estudante com 4 projetos pode criar o 5º");
assert.equal(checkProjectCreationAllowed(studentUser, 5).allowed, false, "Estudante com 5 projetos não pode criar o 6º");

const eletricoUser = { subscription: { plan_code: "eletrico" } };
assert.equal(checkProjectCreationAllowed(eletricoUser, 29).allowed, true, "Elétrico com 29 projetos pode criar o 30º");
assert.equal(checkProjectCreationAllowed(eletricoUser, 30).allowed, false, "Elétrico com 30 projetos não pode criar o 31º");
assert.equal(checkProjectCreationAllowed(eletricoUser, 5, "Projeto Solar").allowed, false, "Elétrico não pode criar projeto solar");

const solarUser = { subscription: { plan_code: "solar" } };
assert.equal(checkProjectCreationAllowed(solarUser, 5, "Instalações Elétricas Prediais").allowed, false, "Solar não pode criar planta predial geral");

const engUser = { subscription: { plan_code: "engineering" } };
const allowedCheck2 = checkProjectCreationAllowed(engUser, 150);
assert.equal(allowedCheck2.allowed, true, "Usuário engenharia deve ter criação ilimitada de projetos");

const completoUser = { subscription: { plan_code: "completo" } };
assert.equal(checkProjectCreationAllowed(completoUser, 500).allowed, true, "Usuário completo deve ter criação ilimitada");

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
