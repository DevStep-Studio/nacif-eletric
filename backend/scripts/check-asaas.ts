import { env } from "../src/config/env.js";
import { asaasList, asaasRequest, asaasConfigured } from "../src/lib/asaas.js";
import { prisma } from "../src/lib/prisma.js";

const events = ["PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_AWAITING_CHARGEBACK_REVERSAL", "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"];
try {
  if (!asaasConfigured()) throw new Error("Configure ASAAS_API_KEY no backend.");
  if (env.ASAAS_WEBHOOK_TOKEN.length < 32) throw new Error("Configure ASAAS_WEBHOOK_TOKEN com pelo menos 32 caracteres.");
  console.log(`Ambiente Asaas: ${env.ASAAS_ENVIRONMENT}`);
  await asaasRequest("/customers?limit=1");
  console.log("API autenticada (nenhum cliente ou pagamento criado).");
  await Promise.all([
    prisma.billingAccount.findFirst({ select: { id: true } }),
    prisma.billingSubscription.findFirst({ select: { id: true } }),
    prisma.billingPayment.findFirst({ select: { id: true } }),
    prisma.billingEvent.findFirst({ select: { id: true } }),
  ]);
  console.log("Tabelas de cobrança acessíveis.");
  const hooks = await asaasList("/webhooks");
  const hook = hooks.find(h => h.enabled && !h.interrupted && new URL(h.url).pathname === "/api/subscriptions/webhook/asaas");
  if (!hook) throw new Error("Cadastre ou reative o webhook /api/subscriptions/webhook/asaas na conta Asaas.");
  const missing = events.filter(event => !hook.events?.includes(event));
  if (missing.length) throw new Error(`Eventos não habilitados: ${missing.join(", ")}`);
  console.log("Webhook ativo com os eventos necessários. Confira o mesmo token no painel e no backend.");
} catch (error: any) {
  console.error(error.message || "Falha na configuração Asaas.");
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
