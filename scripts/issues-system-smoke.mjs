import assert from "node:assert/strict";
import { generateProtocol } from "../src/lib/issuePersistence.js";
import { collectTechnicalInfo, parseUserAgent } from "../src/lib/technicalInfo.js";

console.log("🧪 Iniciando testes de validação da Central de Avisos e Erros...");

// 1. Validação da Geração Sequencial de Protocolo
const currentYear = new Date().getFullYear();

// Lista vazia gera o primeiro protocolo do ano
const proto1 = generateProtocol([]);
assert.equal(proto1, `#ERR-${currentYear}-0001`, "Primeiro protocolo deve ser #ERR-YYYY-0001");

// Incremento correto
const mockList = [
  { protocol: `#ERR-${currentYear}-0001` },
  { protocol: `#ERR-${currentYear}-0002` },
  { protocol: `#ERR-${currentYear}-0005` },
];
const protoNext = generateProtocol(mockList);
assert.equal(protoNext, `#ERR-${currentYear}-0006`, "Deve incrementar baseado no maior número existente");

// 2. Validação da Coleta Ética de Informações Técnicas
const techInfo = collectTechnicalInfo({
  module: "Quadro Elétrico",
  projectId: "proj_teste_123",
  user: { id: "user_456", email: "engenheiro@nacif.com" },
});

assert.equal(techInfo.module, "Quadro Elétrico", "Módulo correto");
assert.equal(techInfo.project_id, "proj_teste_123", "ID do projeto correto");
assert.equal(techInfo.user_id, "user_456", "ID do usuário correto");
assert.ok(techInfo.timestamp, "Deve conter timestamp ISO");
assert.ok(techInfo.app_version, "Deve conter versão do app");
assert.ok(techInfo.browser, "Deve conter navegador");
assert.ok(techInfo.os, "Deve conter sistema operacional");

// Garantir que nenhum dado sensível foi coletado
assert.equal(techInfo.password, undefined, "Não deve conter senhas");
assert.equal(techInfo.token, undefined, "Não deve conter tokens");
assert.equal(techInfo.credit_card, undefined, "Não deve conter dados financeiros");

console.log("✅ Todos os testes da Central de Avisos e Erros passaram com sucesso!");
