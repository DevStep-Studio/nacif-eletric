import { randomUUID } from "node:crypto";
import { Prisma, type BillingAccount, type BillingSubscription } from "@prisma/client";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import { AppError } from "./errors.js";
import { paidEntitlement } from "./planGovernance.js";
import { assertAccountAvailable } from "./accountAccess.js";
import { COMMERCIAL_PLANS } from "./planCatalog.js";
import { asaasList, asaasRequest, AsaasError, safeInvoiceUrl } from "./asaas.js";

export const changeSchema = z.object({
  planCode: z.enum(["estudante", "eletrico", "solar", "completo"]),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});
const digits = (value: string) => value.replace(/\D/g, "");
export function validDocument(raw: string): boolean {
  const value = digits(raw);
  if (!/^\d{11}$|^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const check = (base: string, weights: number[]) => {
    const remainder = [...base].reduce((sum, n, i) => sum + Number(n) * weights[i], 0) % 11;
    return String(remainder < 2 ? 0 : 11 - remainder);
  };
  if (value.length === 11) {
    const first = check(value.slice(0, 9), [10,9,8,7,6,5,4,3,2]);
    return value.slice(-2) === first + check(value.slice(0, 9) + first, [11,10,9,8,7,6,5,4,3,2]);
  }
  const first = check(value.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  return value.slice(-2) === first + check(value.slice(0, 12) + first, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
}
export const checkoutSchema = changeSchema.extend({
  billingType: z.enum(["CREDIT_CARD", "PIX", "BOLETO"]),
  billingDetails: z.object({
    cpfCnpj: z.string().transform(digits).refine(validDocument, "CPF/CNPJ inválido."),
    postalCode: z.string().transform(digits).pipe(z.string().regex(/^\d{8}$/, "CEP inválido.")),
    address: z.string().trim().min(3).max(255),
    addressNumber: z.string().trim().min(1).max(20),
    province: z.string().trim().min(2).max(100),
    phone: z.string().transform(digits).pipe(z.string().regex(/^\d{10,11}$/, "Telefone inválido.")),
  }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const permissionData = (user: { customPermissions: unknown }): Record<string, any> =>
  (user.customPermissions as Record<string, any>) || {};
const dateOnly = (date = new Date()) => date.toISOString().slice(0, 10);
export function addCycle(date: Date, cycle: string): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + (cycle === "annual" ? 12 : 1));
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}
export function planPrice(planCode: string, cycle: string) {
  const plan = COMMERCIAL_PLANS.find(p => p.code === planCode);
  if (!plan || !["monthly", "annual"].includes(cycle) || cycle === "annual" && !plan.hasAnnualOption)
    throw new AppError("Plano ou ciclo de cobrança inválido.", 400);
  return { plan, value: cycle === "annual" ? plan.annualPrice : plan.monthlyPrice };
}
async function academicCheck(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const p = permissionData(user);
  if (code === "estudante" && (p.academicStatus !== "approved" || !p.academicValidUntil || Date.parse(p.academicValidUntil) <= Date.now()))
    throw new AppError("A contratação acadêmica exige comprovante aprovado e válido.", 403);
}

// A durable lease serializes billing operations across processes. Intent is saved before
// each external creation, so a crash/timeout can only recover by externalReference.
export async function withBillingAccount<T>(userId: string, fn: (account: BillingAccount) => Promise<T>, allowUnavailable = false): Promise<T> {
  const token = randomUUID();
  const account = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!allowUnavailable) assertAccountAvailable(user);
    else if (!user) throw new AppError("Conta de cobrança não encontrada.", 503);
    const account = await tx.billingAccount.upsert({
      where: { userId_environment: { userId, environment: env.ASAAS_ENVIRONMENT } },
      create: { userId, environment: env.ASAAS_ENVIRONMENT }, update: {},
    });
    if (account.lockUntil && account.lockUntil.getTime() > Date.now())
      throw new AppError("Uma operação de cobrança está em andamento. Aguarde e tente novamente.", 409);
    return tx.billingAccount.update({ where: { id: account.id }, data: { lockToken: token, lockUntil: new Date(Date.now() + 180000) } });
  });
  // Heartbeat prevents a long paginated reconciliation from outliving its lease.
  let lostLease = false;
  const heartbeat = setInterval(() => {
    void prisma.billingAccount.updateMany({ where: { id: account.id, lockToken: token }, data: { lockUntil: new Date(Date.now() + 180000) } })
      .then(result => { if (!result.count) lostLease = true; }).catch(() => { lostLease = true; });
  }, 30000);
  heartbeat.unref();
  try {
    const result = await fn(account);
    if (lostLease) throw new AppError("Operação em conciliação. Atualize a assinatura antes de tentar novamente.", 503);
    return result;
  } finally {
    clearInterval(heartbeat);
    await prisma.billingAccount.updateMany({ where: { id: account.id, lockToken: token }, data: { lockToken: null, lockUntil: null } });
  }
}
async function customer(account: BillingAccount, input: CheckoutInput) {
  if (account.customerId) return account.customerId;
  const reference = `nacif:${account.environment}:${account.userId}`;
  const existing = await asaasList(`/customers?externalReference=${encodeURIComponent(reference)}`);
  if (existing.length > 1) throw new AppError("Cadastro duplicado no Asaas; conciliação manual necessária.", 409);
  let remote = existing[0];
  if (!remote) {
    if (account.customerAttempted) throw new AppError("Cadastro em conciliação no Asaas. Aguarde ou contate o suporte; nenhuma nova cobrança foi criada.", 503);
    await prisma.billingAccount.update({ where: { id: account.id }, data: { customerAttempted: true } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
    try {
      remote = await asaasRequest("/customers", "POST", {
        name: user.fullName, email: user.email, externalReference: reference,
        ...input.billingDetails, notificationDisabled: false,
      });
    } catch (error) {
      if (error instanceof AsaasError && [400,401,403,422].includes(error.remoteStatus))
        await prisma.billingAccount.update({ where: { id: account.id }, data: { customerAttempted: false } });
      throw error;
    }
  }
  if (!remote.id || remote.externalReference !== reference) throw new AppError("Cliente Asaas sem vínculo válido.", 503);
  await prisma.billingAccount.update({ where: { id: account.id }, data: { customerId: remote.id } });
  account.customerId = remote.id;
  return remote.id as string;
}
export async function currentSubscription(account: BillingAccount) {
  return prisma.billingSubscription.findFirst({ where: { accountId: account.id, status: { notIn: ["cancelled", "failed"] } }, orderBy: { createdAt: "desc" } });
}
export const PAID_STATUSES = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
const unpaidStatuses = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS", "DUNNING_REQUESTED"];

async function recoverSubscription(account: BillingAccount, local: BillingSubscription) {
  if (local.remoteId) return local;
  const found = await asaasList(`/subscriptions?customer=${encodeURIComponent(account.customerId!)}&externalReference=${encodeURIComponent(local.id)}`);
  if (found.length > 1) throw new AppError("Assinaturas duplicadas no Asaas; contate o suporte.", 409);
  if (found[0]) return prisma.billingSubscription.update({ where: { id: local.id }, data: { remoteId: found[0].id, status: "pending" } });
  if (local.createAttempted) throw new AppError("Assinatura em conciliação no Asaas. Não repita a contratação; aguarde ou contate o suporte.", 503);
  return local;
}
export async function startCheckout(account: BillingAccount, input: CheckoutInput) {
  const { plan, value } = planPrice(input.planCode, input.cycle);
  await academicCheck(account.userId, input.planCode);
  const customerId = await customer(account, input);
  let local = await currentSubscription(account);
  if (local && (local.planCode !== input.planCode || local.cycle !== input.cycle || local.billingType !== input.billingType))
    throw new AppError("Você já possui uma contratação. Gerencie ou cancele a assinatura atual antes de contratar outra.", 409);
  if (!local) {
    const due = new Date(); due.setUTCDate(due.getUTCDate() + 3);
    local = await prisma.billingSubscription.create({ data: {
      accountId: account.id, planCode: input.planCode, cycle: input.cycle, billingType: input.billingType,
      value, nextDueDate: dateOnly(due),
    } });
  }
  local = await recoverSubscription(account, local);
  if (!local.remoteId) {
    await asaasRequest(`/customers/${encodeURIComponent(customerId)}`, "PUT", input.billingDetails);
    await prisma.billingSubscription.update({ where: { id: local.id }, data: { createAttempted: true } });
    let remote;
    try {
      remote = await asaasRequest("/subscriptions", "POST", {
        customer: customerId, billingType: local.billingType, value: Number(local.value),
        cycle: local.cycle === "annual" ? "YEARLY" : "MONTHLY", nextDueDate: local.nextDueDate,
        description: `${plan.name} — ${local.cycle === "annual" ? "Anual" : "Mensal"}`,
        externalReference: local.id,
        callback: { successUrl: `${env.FRONTEND_URL}/subscription?checkout=success&subscription_id=${encodeURIComponent(local.id)}`, autoRedirect: true },
      });
    } catch (error) {
      if (error instanceof AsaasError && [400,401,403,422].includes(error.remoteStatus))
        await prisma.billingSubscription.update({ where: { id: local.id }, data: { createAttempted: false, status: "failed" } });
      throw error;
    }
    if (!remote.id) throw new AppError("Assinatura em conciliação no Asaas.", 503);
    local = await prisma.billingSubscription.update({ where: { id: local.id }, data: { remoteId: remote.id, status: "pending" } });
  }
  await reconcileSubscription(account, local);
  const payment = await prisma.billingPayment.findFirst({ where: { subscriptionId: local.id, status: { in: unpaidStatuses } }, orderBy: { dueDate: "asc" } });
  if (!payment?.invoiceUrl) throw new AppError("Assinatura criada. O Asaas ainda está preparando a cobrança; atualize os detalhes em instantes.", 409);
  return { url: payment.invoiceUrl, subscriptionId: local.id, paymentId: payment.id };
}

// Compute periods from all previously paid invoices, including reversals. A refund must
// revoke only its own period, never shift the periods of later invoices backwards.
export function paymentPeriods(payments: Array<{ id: string; dueDate: string; paidAt: Date | null; cycle: string }>) {
  const result = new Map<string, { periodStart: Date; periodEnd: Date }>();
  const byDue = new Map<string, { periodStart: Date; periodEnd: Date }>();
  let previousEnd: Date | undefined;
  for (const payment of [...payments].filter(p => p.paidAt).sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))) {
    let period = byDue.get(payment.dueDate);
    if (!period) {
      const start = new Date(Math.max(payment.paidAt!.getTime(), previousEnd?.getTime() || 0));
      period = { periodStart: start, periodEnd: addCycle(start, payment.cycle) };
      byDue.set(payment.dueDate, period);
      previousEnd = period.periodEnd;
    }
    result.set(payment.id, period);
  }
  return result;
}

async function cleanupUnpaidPayments(payments: any[]) {
  for (const payment of payments) {
    if (["PENDING", "OVERDUE"].includes(payment.status))
      await asaasRequest(`/payments/${encodeURIComponent(payment.id)}`, "DELETE");
    else if (["AWAITING_RISK_ANALYSIS", "REFUND_REQUESTED", "REFUND_IN_PROGRESS"].includes(payment.status))
      throw new AppError("Existe uma cobrança em processamento no Asaas. Aguarde a conclusão e repita o cancelamento.", 409);
  }
}

async function alignInitialSchedule(local: BillingSubscription, remote: any, payments: any[]) {
  if (local.scheduleAligned || local.pendingChange || local.cancelRequested || remote.status !== "ACTIVE") return;
  const ordered = [...payments].sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  const first = ordered[0];
  if (!first || !PAID_STATUSES.includes(first.status)) return;
  const paidAt = new Date(first.clientPaymentDate || first.paymentDate || first.confirmedDate);
  if (!Number.isFinite(paidAt.getTime())) return;
  let next = addCycle(paidAt, local.cycle);
  // Align future due dates with the start of paid access, rather than the original
  // three-day payment deadline, avoiding a gap before the second renewal.
  if (dateOnly(next) > dateOnly()) {
    for (const payment of ordered.slice(1)) {
      if (!["PENDING", "OVERDUE"].includes(payment.status)) continue;
      const dueDate = dateOnly(next);
      if (payment.dueDate !== dueDate) await asaasRequest(`/payments/${encodeURIComponent(payment.id)}`, "PUT", { dueDate });
      payment.dueDate = dueDate;
      next = addCycle(next, local.cycle);
    }
    if (remote.nextDueDate !== dateOnly(next)) {
      await asaasRequest(`/subscriptions/${encodeURIComponent(local.remoteId!)}`, "PUT", { nextDueDate: dateOnly(next) });
      remote.nextDueDate = dateOnly(next);
    }
  }
  await prisma.billingSubscription.update({ where: { id: local.id }, data: { scheduleAligned: true } });
}

export async function reconcileSubscription(account: BillingAccount, local: BillingSubscription, event?: { id: string; event: string }) {
  if (!local.remoteId) local = await recoverSubscription(account, local);
  if (!local.remoteId) return;
  let remote;
  try { remote = await asaasRequest(`/subscriptions/${encodeURIComponent(local.remoteId)}`); }
  catch (error) {
    if (!(error instanceof AsaasError) || error.remoteStatus !== 404) throw error;
    remote = { customer: account.customerId, externalReference: local.id, deleted: true, status: "INACTIVE", nextDueDate: local.nextDueDate };
  }
  if (remote.customer !== account.customerId || remote.externalReference !== local.id)
    throw new AppError("Assinatura Asaas sem vínculo válido com a conta.", 403);
  let payments = await asaasList(`/payments?subscription=${encodeURIComponent(local.remoteId)}`);
  if ((remote.deleted || remote.status === "INACTIVE" || remote.status === "EXPIRED") && local.status !== "cancelled") {
    local = await prisma.billingSubscription.update({ where: { id: local.id }, data: { cancelRequested: true } });
    await cleanupUnpaidPayments(payments);
    local = await prisma.billingSubscription.update({ where: { id: local.id }, data: { status: "cancelled" } });
    payments = await asaasList(`/payments?subscription=${encodeURIComponent(local.remoteId!)}`);
  }
  const pending = local.pendingChange as any;
  if (pending?.state === "applying" && Number(remote.value) === pending.value &&
      remote.cycle === (pending.cycle === "annual" ? "YEARLY" : "MONTHLY") && remote.description === pending.description) {
    await prisma.$transaction(async tx => {
      await tx.billingSubscription.update({ where: { id: local.id }, data: { pendingChange: { ...pending, state: "scheduled" } } });
      await tx.billingPayment.updateMany({ where: { subscriptionId: local.id, status: { in: unpaidStatuses }, dueDate: { gte: pending.effectiveDate } },
        data: { planCode: pending.planCode, cycle: pending.cycle, value: pending.value } });
    });
    local = await prisma.billingSubscription.findUniqueOrThrow({ where: { id: local.id } });
  }
  await alignInitialSchedule(local, remote, payments);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${account.userId} FOR UPDATE`;
    if (event && await tx.billingEvent.findUnique({ where: { id: `${account.environment}:${event.id}` } })) return;
    for (const remotePayment of payments) {
      if (remotePayment.customer !== account.customerId || remotePayment.subscription !== local.remoteId)
        throw new AppError("Cobrança Asaas sem vínculo válido.", 403);
      const old = await tx.billingPayment.findUnique({ where: { id: `${account.environment}:${remotePayment.id}` } });
      const change = local.pendingChange as any;
      const changed = change?.state === "scheduled" && remotePayment.dueDate >= change.effectiveDate;
      const planCode = old?.planCode || (changed ? change.planCode : local.planCode);
      const cycle = old?.cycle || (changed ? change.cycle : local.cycle);
      const expected = old ? Number(old.value) : changed ? change.value : Number(local.value);
      if (Math.round(Number(remotePayment.originalValue ?? remotePayment.value) * 100) !== Math.round(expected * 100))
        throw new AppError("Valor da cobrança diverge do plano contratado; conciliação necessária.", 409);
      const paid = PAID_STATUSES.includes(remotePayment.status) && !remotePayment.deleted;
      const paidDate = remotePayment.clientPaymentDate || remotePayment.paymentDate || remotePayment.confirmedDate;
      if (paid && (!paidDate || !Number.isFinite(Date.parse(paidDate)))) throw new AppError("Pagamento sem data de confirmação válida.", 503);
      const data = {
        remoteId: remotePayment.id, subscriptionId: local.id, planCode, cycle, value: remotePayment.originalValue ?? remotePayment.value,
        dueDate: remotePayment.dueDate, invoiceUrl: safeInvoiceUrl(remotePayment.invoiceUrl),
        status: remotePayment.deleted ? "DELETED" : remotePayment.status,
        paidAt: old?.paidAt || (paid ? new Date(paidDate) : null),
      };
      await tx.billingPayment.upsert({ where: { id: `${account.environment}:${remotePayment.id}` }, create: { id: `${account.environment}:${remotePayment.id}`, ...data }, update: data });
    }
    // Removed invoices are absent from default listings. Refresh known missing records.
    const known = await tx.billingPayment.findMany({ where: { subscriptionId: local.id } });
    const seen = new Set(payments.map(p => p.id));
    for (const payment of known) {
      if (!seen.has(payment.remoteId)) {
        let latest;
        try { latest = await asaasRequest(`/payments/${encodeURIComponent(payment.remoteId)}`); }
        catch (error) {
          if (!(error instanceof AsaasError) || error.remoteStatus !== 404) throw error;
          latest = { deleted: true };
        }
        await tx.billingPayment.update({ where: { id: payment.id }, data: { status: latest.deleted ? "DELETED" : latest.status } });
      }
    }
    const all = await tx.billingPayment.findMany({ where: { subscriptionId: local.id } });
    const periods = paymentPeriods(all);
    for (const [id, period] of periods) await tx.billingPayment.update({ where: { id }, data: period });
    const cancelled = local.cancelRequested || remote.deleted || remote.status === "INACTIVE" || remote.status === "EXPIRED";
    const status = local.cancelRequested && local.status !== "cancelled" ? "cancelling" : cancelled ? "cancelled" : all.some(p => p.status === "OVERDUE") ? "past_due" : all.some(p => PAID_STATUSES.includes(p.status)) ? "active" : "pending";
    await tx.billingSubscription.update({ where: { id: local.id }, data: { status, nextDueDate: remote.nextDueDate || local.nextDueDate } });
    await updateEntitlement(tx, account);
    if (event) await tx.billingEvent.create({ data: { id: `${account.environment}:${event.id}`, environment: account.environment, type: event.event } });
  }, { timeout: 90000 });
}

async function updateEntitlement(tx: Prisma.TransactionClient, account: BillingAccount) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: account.userId } });
  const subscriptions = await tx.billingSubscription.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" } });
  const now = new Date();
  const payments = await tx.billingPayment.findMany({ where: { subscriptionId: { in: subscriptions.map(s => s.id) }, status: { in: PAID_STATUSES }, periodEnd: { gt: now } }, orderBy: { periodEnd: "desc" } });
  const entitled = payments.find(p => p.periodStart && p.periodStart <= now);
  const sub = subscriptions.find(s => s.id === entitled?.subscriptionId) || subscriptions[0];
  const p = permissionData(user);
  await tx.user.update({ where: { id: user.id }, data: {
    plan: entitled?.planCode as any || "gratuito",
    customPermissions: { ...p, billingProvider: "asaas", billingEnvironment: account.environment,
      asaasCustomerId: account.customerId, asaasSubscriptionId: sub?.remoteId || null,
      subscriptionStatus: entitled ? sub?.status === "cancelled" ? "cancelled" : "active" : sub?.status === "active" ? "expired" : sub?.status || "pending",
      subscriptionCycle: entitled?.cycle || sub?.cycle || "monthly",
      subscriptionStartDate: entitled?.periodStart?.toISOString() || null,
      subscriptionRenewalDate: entitled?.periodEnd?.toISOString() || null,
      subscriptionPrice: entitled ? Number(entitled.value) : sub ? Number(sub.value) : 0,
      autoRenew: Boolean(sub && !sub.cancelRequested && !["cancelled", "failed"].includes(sub.status)),
      billingType: sub?.billingType || null,
      billingEntitlements: payments.map(p => ({ planCode: p.planCode, cycle: p.cycle, price: Number(p.value), start: p.periodStart?.toISOString(), end: p.periodEnd?.toISOString() })),
    },
  } });
}

export async function cancelSubscription(account: BillingAccount, reason = "") {
  let local = await currentSubscription(account) || await prisma.billingSubscription.findFirst({ where: { accountId: account.id, status: "cancelled" }, orderBy: { createdAt: "desc" } });
  if (!local) return { cancelled: true };
  if (!local.remoteId) local = await recoverSubscription(account, local);
  if (!local.remoteId) {
    await prisma.billingSubscription.update({ where: { id: local.id }, data: { status: "cancelled", cancelRequested: true } });
    return { cancelled: true };
  }
  // Save intent before the external mutation. Retries resume cleanup safely.
  local = await prisma.billingSubscription.update({ where: { id: local.id }, data: { cancelRequested: true } });
  await asaasRequest(`/subscriptions/${encodeURIComponent(local.remoteId!)}`, "PUT", { status: "INACTIVE" });
  const payments = await asaasList(`/payments?subscription=${encodeURIComponent(local.remoteId!)}`);
  await cleanupUnpaidPayments(payments);
  local = await prisma.billingSubscription.update({ where: { id: local.id }, data: { status: "cancelled" } });
  await reconcileSubscription(account, local);
  await prisma.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: account.userId } });
    await tx.user.update({ where: { id: user.id }, data: { customPermissions: { ...permissionData(user), subscriptionCancelReason: reason } } });
  });
  return { cancelled: true };
}

export async function changeSubscription(account: BillingAccount, input: z.infer<typeof changeSchema>) {
  const { plan, value } = planPrice(input.planCode, input.cycle);
  await academicCheck(account.userId, input.planCode);
  let local = await currentSubscription(account);
  if (!local?.remoteId || local.cancelRequested) throw new AppError("Nenhuma assinatura renovável. Inicie uma nova contratação.", 409);
  await reconcileSubscription(account, local);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } });
  local = await prisma.billingSubscription.findUniqueOrThrow({ where: { id: local.id } });
  const previous = local.pendingChange as any;
  if (previous?.state === "applying" && (previous.planCode !== input.planCode || previous.cycle !== input.cycle))
    throw new AppError("Uma alteração anterior está em conciliação no Asaas. Atualize a assinatura antes de escolher outro plano.", 409);
  const validUntil = paidEntitlement(user)?.end;
  if (!validUntil || Date.parse(validUntil) <= Date.now()) throw new AppError("Confirme o pagamento atual antes de alterar o plano.", 409);
  const effectiveDate = dateOnly(new Date(validUntil));
  const pending = await prisma.billingPayment.findMany({ where: { subscriptionId: local.id, status: { in: unpaidStatuses } } });
  if (pending.some(p => p.dueDate < effectiveDate)) throw new AppError("Regularize as cobranças pendentes antes de alterar o plano.", 409);
  const change = { planCode: input.planCode, cycle: input.cycle, value, effectiveDate, state: "applying", description: `${plan.name} — ${input.cycle === "annual" ? "Anual" : "Mensal"}` };
  // Store before PUT, so retries and incoming payments share the same interpretation.
  await prisma.billingSubscription.update({ where: { id: local.id }, data: { pendingChange: change } });
  try {
    await asaasRequest(`/subscriptions/${encodeURIComponent(local.remoteId!)}`, "PUT", {
    value, cycle: input.cycle === "annual" ? "YEARLY" : "MONTHLY", nextDueDate: effectiveDate,
    description: `${plan.name} — ${input.cycle === "annual" ? "Anual" : "Mensal"}`, updatePendingPayments: true,
    });
  } catch (error) {
    if (error instanceof AsaasError && [400,401,403,422].includes(error.remoteStatus))
      await prisma.billingSubscription.update({ where: { id: local.id }, data: { pendingChange: local.pendingChange ?? Prisma.DbNull } });
    throw error;
  }
  // Confirm metadata atomically only after the remote update succeeds.
  await prisma.$transaction(async tx => {
    await tx.billingSubscription.update({ where: { id: local.id }, data: { pendingChange: { ...change, state: "scheduled" } } });
    await tx.billingPayment.updateMany({ where: { subscriptionId: local.id, status: { in: unpaidStatuses }, dueDate: { gte: effectiveDate } }, data: { planCode: input.planCode, cycle: input.cycle, value } });
  });
  return { scheduled: true, effectiveDate, planCode: input.planCode, cycle: input.cycle };
}

export async function billingDetails(userId: string) {
  const account = await prisma.billingAccount.findUnique({ where: { userId_environment: { userId, environment: env.ASAAS_ENVIRONMENT } } });
  if (!account) return { subscription: null, payments: [] };
  const subscription = await prisma.billingSubscription.findFirst({ where: { accountId: account.id }, orderBy: { createdAt: "desc" } });
  const payments = subscription ? await prisma.billingPayment.findMany({ where: { subscriptionId: subscription.id }, orderBy: { dueDate: "desc" } }) : [];
  return { subscription, payments };
}
