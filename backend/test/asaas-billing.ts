import { Prisma } from "@prisma/client";
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { addCycle, paymentPeriods, validDocument } from "../src/lib/asaasBilling.js";
import { effectivePlanCode, paidEntitlement } from "../src/lib/planGovernance.js";

const clone = <T>(value: T): T => structuredClone(value);
const dateOnly = (date = new Date()) => date.toISOString().slice(0, 10);

test("calendar periods, duplicate invoices and document validation", () => {
  assert.equal(addCycle(new Date("2027-01-31T12:00:00Z"), "monthly").toISOString(), "2027-02-28T12:00:00.000Z");
  assert.equal(addCycle(new Date("2028-02-29T12:00:00Z"), "annual").toISOString(), "2029-02-28T12:00:00.000Z");
  assert.equal(validDocument("529.982.247-25"), true);
  assert.equal(validDocument("11.222.333/0001-81"), true);
  assert.equal(validDocument("111.111.111-11"), false);
  assert.equal(validDocument("52998224724"), false);
  const periods = paymentPeriods([
    { id: "second", dueDate: "2027-02-10", cycle: "monthly", paidAt: new Date("2027-02-10") },
    { id: "first", dueDate: "2027-01-10", cycle: "monthly", paidAt: new Date("2027-01-09") },
    { id: "duplicate", dueDate: "2027-01-10", cycle: "monthly", paidAt: new Date("2027-01-09") },
  ]);
  assert.equal(periods.get("first")!.periodEnd.toISOString(), periods.get("duplicate")!.periodEnd.toISOString());
  assert.equal(periods.get("second")!.periodEnd.toISOString(), "2027-03-10T00:00:00.000Z");
  assert.equal(effectivePlanCode({ plan: "completo" }), "gratuito", "a stored paid plan alone cannot grant access");
  assert.equal(effectivePlanCode({ role: "admin" }), "completo");
  const end = new Date(Date.now() + 86400000).toISOString();
  const extendedEnd = new Date(Date.now() + 172800000).toISOString();
  const user = { customPermissions: { billingProvider: "asaas", billingEnvironment: env.ASAAS_ENVIRONMENT,
    billingEntitlements: [{ planCode: "eletrico", cycle: "monthly", start: new Date(Date.now()-86400000).toISOString(), end },
      { planCode: "eletrico", cycle: "monthly", start: end, end: extendedEnd }] } };
  assert.equal(effectivePlanCode(user), "eletrico");
  assert.equal(paidEntitlement(user)?.end, extendedEnd);
  assert.equal(effectivePlanCode({ customPermissions: { ...user.customPermissions, billingEnvironment: "other" } }), "gratuito");
});

test("billing HTTP lifecycle with real handlers and an isolated Asaas simulator", async t => {
  // Explicit test-only settings; no real credentials or network calls are used.
  const oldEnv = { key: env.ASAAS_API_KEY, token: env.ASAAS_WEBHOOK_TOKEN };
  env.ASAAS_API_KEY = "test-asaas-key";
  env.ASAAS_WEBHOOK_TOKEN = "test-webhook-01-abcd-9876-secure-token";
  const tables: Record<string, any[]> = {};
  const restores: Array<() => void> = [];
  let seq = 0;
  const match = (row: any, where: any = {}): boolean => Object.entries(where).every(([key,value]: any) => {
    if (key === "OR") return value.some((filter: any) => match(row, filter));
    if (key === "userId_environment") return match(row, value);
    const actual = row[key];
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value && !value.in.includes(actual)) return false;
      if ("notIn" in value && value.notIn.includes(actual)) return false;
      if ("not" in value && actual === value.not) return false;
      if ("gt" in value && !(actual > value.gt)) return false;
      if ("gte" in value && !(actual >= value.gte)) return false;
      if ("lte" in value && !(actual <= value.lte)) return false;
      return true;
    }
    return actual === value;
  });
  function replace(target: any, key: string, value: any) {
    const old = target[key]; target[key] = value; restores.push(() => { target[key] = old; });
  }
  for (const model of ["user", "billingAccount", "billingSubscription", "billingPayment", "billingEvent"]) {
    tables[model] = [];
    const delegate = (prisma as any)[model];
    const findMany = async ({ where, orderBy }: any = {}) => {
      let result = tables[model].filter(row => match(row, where));
      if (orderBy) {
        const [key,direction] = Object.entries(orderBy)[0];
        result = [...result].sort((a,b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (direction === "desc" ? -1 : 1));
      }
      return clone(result);
    };
    const create = async ({ data }: any) => {
      const row = { id: `${model}-${++seq}`, customerId: null, customerAttempted: false, lockToken: null, lockUntil: null,
        remoteId: null, status: model === "billingSubscription" ? "creating" : "active", cancelRequested: false,
        createAttempted: false, scheduleAligned: false, pendingChange: null, paidAt: null, periodStart: null, periodEnd: null,
        createdAt: new Date(), updatedAt: new Date(), ...data };
      tables[model].push(clone(row)); return clone(row);
    };
    const update = async ({ where, data }: any) => {
      const row = tables[model].find(row => match(row, where));
      if (!row) throw new Error(`${model} update missing`);
      const patch = { ...data };
      if (patch.pendingChange === Prisma.DbNull) patch.pendingChange = null;
      Object.assign(row, clone(patch)); return clone(row);
    };
    replace(delegate, "findMany", findMany);
    replace(delegate, "findFirst", async (args: any) => (await findMany(args))[0] || null);
    replace(delegate, "findUnique", async ({ where }: any) => clone(tables[model].find(row => match(row, where)) || null));
    replace(delegate, "findUniqueOrThrow", async ({ where }: any) => {
      const row = tables[model].find(row => match(row, where));
      if (!row) throw new Error(`${model} not found`); return clone(row);
    });
    replace(delegate, "create", create);
    replace(delegate, "update", update);
    replace(delegate, "upsert", async ({ where, create: data, update: patch }: any) => tables[model].some(row => match(row, where)) ? update({ where, data: patch }) : create({ data }));
    replace(delegate, "updateMany", async ({ where, data }: any) => {
      const rows = tables[model].filter(row => match(row, where));
      for (const row of rows) Object.assign(row, clone(data)); return { count: rows.length };
    });
  }
  replace(prisma, "$queryRaw", async () => []);
  replace(prisma, "$transaction", async (fn: any) => {
    const snapshot = clone(tables);
    try { return await fn(prisma); }
    catch (error) { for (const key of Object.keys(tables)) tables[key] = snapshot[key]; throw error; }
  });
  const customers: any[] = [], subscriptions: any[] = [], payments: any[] = [];
  let creationCalls = 0, customerCalls = 0;
  let timeoutAfterCreate = false, rejectCreate = false, failDelete = false, failUpdate = false, timeoutAfterUpdate = false;
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, options: any = {}) => {
    assert.equal(options.headers.access_token, env.ASAAS_API_KEY);
    const parsed = new URL(String(url));
    assert.equal(parsed.hostname, "api-sandbox.asaas.com", "tests never call production");
    const path = parsed.pathname.replace("/v3", "");
    const method = options.method || "GET";
    const data = options.body ? JSON.parse(options.body) : null;
    const response = (value: any, status = 200) => new Response(JSON.stringify(value), { status });
    const listing = (items: any[]) => response({ data: items.filter(item => !item.deleted), hasMore: false });
    if (path === "/customers" && method === "GET") return listing(customers.filter(c => c.externalReference === parsed.searchParams.get("externalReference")));
    if (path === "/customers" && method === "POST") { customerCalls++; const customer = { ...data, id: `cus_${++seq}` }; customers.push(customer); return response(customer); }
    if (path.startsWith("/customers/") && method === "PUT") return response({ id: path.split("/")[2], ...data });
    if (path === "/subscriptions" && method === "GET") return listing(subscriptions.filter(s => s.customer === parsed.searchParams.get("customer") && s.externalReference === parsed.searchParams.get("externalReference")));
    if (path === "/subscriptions" && method === "POST") {
      creationCalls++;
      if (rejectCreate) return response({ errors: [{ description: "Dados inválidos" }] }, 400);
      const sub = { ...data, id: `sub_${++seq}`, status: "ACTIVE" }; subscriptions.push(sub);
      payments.push({ id: `pay_${++seq}`, subscription: sub.id, customer: sub.customer, value: data.value, dueDate: data.nextDueDate, status: "PENDING", invoiceUrl: `https://sandbox.asaas.com/i/payment-${seq}` });
      if (timeoutAfterCreate) { timeoutAfterCreate = false; throw new Error("simulated response lost after commit"); }
      return response(sub);
    }
    if (path.startsWith("/subscriptions/")) {
      const sub = subscriptions.find(s => s.id === path.split("/")[2]);
      if (!sub) return response({}, 404);
      if (method === "PUT") {
        if (failUpdate) return response({ errors: [{ description: "Atualização recusada" }] }, 400);
        Object.assign(sub, data);
        if (timeoutAfterUpdate) { timeoutAfterUpdate = false; throw new Error("simulated update response lost"); }
        if (data.updatePendingPayments) for (const p of payments.filter(p => p.subscription === sub.id && ["PENDING", "OVERDUE"].includes(p.status))) Object.assign(p, { value: data.value });
      }
      return response(sub);
    }
    if (path === "/payments") return listing(payments.filter(p => p.subscription === parsed.searchParams.get("subscription")));
    if (path.startsWith("/payments/")) {
      const payment = payments.find(p => p.id === path.split("/")[2]);
      if (!payment) return response({}, 404);
      if (method === "PUT") Object.assign(payment, data);
      if (method === "DELETE") {
        if (failDelete) { failDelete = false; return response({}, 500); }
        payment.deleted = true;
      }
      return response(payment);
    }
    throw new Error(`Unexpected Asaas call: ${method} ${path}`);
  };
  const app = await buildApp();
  function reset() {
    for (const key of Object.keys(tables)) tables[key] = [];
    tables.user = ["owner", "other"].map(id => ({ id, email: `${id}@example.com`, fullName: "Cliente Teste", role: "user", plan: "gratuito", status: "active", customPermissions: {}, isDeleted: false, createdAt: new Date(), updatedAt: new Date() }));
    customers.length = 0; subscriptions.length = 0; payments.length = 0;
    creationCalls = 0; customerCalls = 0; timeoutAfterCreate = false; rejectCreate = false; failDelete = false; failUpdate = false; timeoutAfterUpdate = false;
  }
  const headers = (id = "owner") => ({ authorization: `Bearer ${app.jwt.sign({ sub: id, email: `${id}@example.com`, role: "user" })}` });
  const input = (billingType = "PIX", planCode = "eletrico", cycle = "monthly") => ({ planCode, cycle, billingType,
    billingDetails: { cpfCnpj: "52998224725", phone: "11999999999", postalCode: "01001000", address: "Praça da Sé", addressNumber: "1", province: "Sé" } });
  const post = (suffix: string, payload: any = {}, id = "owner") => app.inject({ method: "POST", url: `/api/subscriptions/${suffix}`, payload, headers: headers(id) });
  const webhook = (id: string, event = "PAYMENT_CONFIRMED", payment = payments[0]) => app.inject({ method: "POST", url: "/api/subscriptions/webhook/asaas", headers: { "asaas-access-token": env.ASAAS_WEBHOOK_TOKEN }, payload: { id, event, payment: { id: payment.id, subscription: payment.subscription, status: "CONFIRMED" } } });
  try {
    for (const type of ["PIX", "BOLETO", "CREDIT_CARD"]) await t.test(`${type}: pending checkout, verified payment and cancellation`, async () => {
      reset();
      const checkout = await post("create-checkout-session", { ...input(type), value: 0.01 });
      assert.equal(checkout.statusCode, 200, checkout.body);
      assert.ok(checkout.json().url.startsWith("https://sandbox.asaas.com/"));
      assert.equal(subscriptions[0].value, 149.9, "client cannot choose the price");
      assert.equal(effectivePlanCode(tables.user[0]), "gratuito");
      const verifyPending = await post("verify-checkout-session", { subscriptionId: checkout.json().subscriptionId });
      assert.equal(verifyPending.json().paid, false);
      assert.equal((await post("create-checkout-session", input(type))).statusCode, 200);
      assert.equal(creationCalls, 1); assert.equal(customerCalls, 1);
      payments[0].status = "CONFIRMED"; payments[0].paymentDate = dateOnly();
      assert.equal((await webhook("confirmed")).statusCode, 200);
      assert.equal(effectivePlanCode(tables.user[0]), "eletrico");
      const before = tables.user[0].customPermissions.subscriptionRenewalDate;
      assert.equal((await webhook("confirmed")).statusCode, 200);
      assert.equal(tables.billingEvent.length, 1);
      assert.equal(tables.user[0].customPermissions.subscriptionRenewalDate, before);
      assert.equal((await post("cancel", { reason: "Teste" })).statusCode, 200);
      assert.equal(subscriptions[0].status, "INACTIVE");
      assert.equal(effectivePlanCode(tables.user[0]), "eletrico", "cancel preserves paid access");
      assert.equal(tables.user[0].customPermissions.autoRenew, false);
    });
    await t.test("ownership, academic constraints and invalid inputs", async () => {
      reset();
      assert.equal((await post("create-checkout-session", input("PIX", "estudante", "annual"))).statusCode, 400);
      assert.equal((await post("create-checkout-session", input("PIX", "estudante"))).statusCode, 403);
      assert.equal((await post("create-checkout-session", { ...input(), billingDetails: { ...input().billingDetails, cpfCnpj: "11111111111" } })).statusCode, 400);
      const checkout = await post("create-checkout-session", input());
      assert.equal((await post("verify-checkout-session", { subscriptionId: checkout.json().subscriptionId }, "other")).statusCode, 404);
      assert.equal((await post("create-checkout-session", input("PIX", "solar"))).statusCode, 409);
      assert.equal((await app.inject({ method: "POST", url: "/api/subscriptions/webhook/asaas", payload: {} })).statusCode, 401);
      tables.user[0].customPermissions.academicStatus = "approved";
      tables.user[0].customPermissions.academicValidUntil = new Date(Date.now()+86400000).toISOString();
      assert.equal((await post("cancel")).statusCode, 200);
      assert.equal((await post("create-checkout-session", input("BOLETO", "estudante"))).statusCode, 200);
    });
    await t.test("ambiguous creation is recovered without a second subscription", async () => {
      reset(); timeoutAfterCreate = true;
      assert.equal((await post("create-checkout-session", input())).statusCode, 503);
      assert.equal((await post("create-checkout-session", input())).statusCode, 200);
      assert.equal(creationCalls, 1); assert.equal(subscriptions.length, 1);
    });
    await t.test("explicit creation rejection permits a corrected attempt", async () => {
      reset(); rejectCreate = true;
      assert.equal((await post("create-checkout-session", input())).statusCode, 400);
      rejectCreate = false;
      assert.equal((await post("create-checkout-session", input())).statusCode, 200);
      assert.equal(subscriptions.length, 1);
    });
    await t.test("concurrent request is rejected by the durable lease", async () => {
      reset(); await post("create-checkout-session", input());
      tables.billingAccount[0].lockUntil = new Date(Date.now()+120000);
      assert.equal((await post("create-checkout-session", input())).statusCode, 409);
      assert.equal(creationCalls, 1);
    });
    await t.test("renewal, out-of-order events, refund and dispute use current remote state", async () => {
      reset(); await post("create-checkout-session", input());
      payments[0].status = "CONFIRMED"; payments[0].paymentDate = dateOnly(new Date(Date.now()-35*86400000));
      payments[0].dueDate = payments[0].paymentDate;
      const next = { ...payments[0], id: "pay_renewal", dueDate: dateOnly(), paymentDate: dateOnly(), status: "RECEIVED" };
      payments.push(next);
      assert.equal((await webhook("renewal", "PAYMENT_RECEIVED", next)).statusCode, 200);
      const until = tables.user[0].customPermissions.subscriptionRenewalDate;
      payments[0].status = "REFUNDED";
      assert.equal((await webhook("old-refund", "PAYMENT_REFUNDED")).statusCode, 200);
      assert.equal(tables.user[0].customPermissions.subscriptionRenewalDate, until);
      assert.equal((await webhook("late-confirm", "PAYMENT_CONFIRMED")).statusCode, 200);
      assert.equal(tables.billingPayment.find(p => p.remoteId === payments[0].id).status, "REFUNDED");
      assert.equal(effectivePlanCode(tables.user[0]), "eletrico");
      next.status = "CHARGEBACK_REQUESTED";
      assert.equal((await webhook("dispute", "PAYMENT_CHARGEBACK_REQUESTED", next)).statusCode, 200);
      assert.equal(effectivePlanCode(tables.user[0]), "gratuito");
    });
    await t.test("plan change retains current paid access and applies to future invoices", async () => {
      reset(); await post("create-checkout-session", input());
      payments[0].status = "CONFIRMED"; payments[0].paymentDate = dateOnly(); await webhook("paid");
      const until = tables.user[0].customPermissions.subscriptionRenewalDate;
      failUpdate = true;
      assert.equal((await post("change-plan", { planCode: "solar", cycle: "annual" })).statusCode, 400);
      assert.equal(tables.billingSubscription[0].pendingChange, null);
      failUpdate = false;
      const changed = await post("change-plan", { planCode: "solar", cycle: "annual" });
      assert.equal(changed.statusCode, 200, changed.body);
      assert.equal(changed.json().effectiveDate, until.slice(0,10));
      assert.equal(effectivePlanCode(tables.user[0]), "eletrico");
      assert.equal(subscriptions[0].value, 1259.16);
      assert.equal(subscriptions[0].cycle, "YEARLY");
      assert.equal(tables.billingPayment[0].value, 149.9);
    });
    await t.test("first payment aligns already-generated renewals with the paid period", async () => {
      reset(); await post("create-checkout-session", input());
      payments[0].status = "CONFIRMED"; payments[0].paymentDate = dateOnly();
      const next = { ...payments[0], id: "pay_next", status: "PENDING", paymentDate: undefined, dueDate: dateOnly(addCycle(new Date(payments[0].dueDate), "monthly")) };
      payments.push(next);
      const result = await webhook("first-paid");
      assert.equal(result.statusCode, 200, result.body);
      assert.equal(next.dueDate, dateOnly(addCycle(new Date(dateOnly()), "monthly")));
      assert.equal(subscriptions[0].nextDueDate, dateOnly(addCycle(new Date(next.dueDate), "monthly")));
      assert.equal(tables.billingSubscription[0].scheduleAligned, true);
    });
    await t.test("a timed-out plan update is reconciled before new invoice metadata is accepted", async () => {
      reset(); await post("create-checkout-session", input());
      payments[0].status = "CONFIRMED"; payments[0].paymentDate = dateOnly(); await webhook("paid-before-change");
      timeoutAfterUpdate = true;
      assert.equal((await post("change-plan", { planCode: "solar", cycle: "annual" })).statusCode, 503);
      assert.equal(tables.billingSubscription[0].pendingChange.state, "applying");
      const next = { ...payments[0], id: "pay_changed", dueDate: subscriptions[0].nextDueDate, status: "PENDING", paymentDate: undefined, value: 1259.16 };
      payments.push(next);
      const result = await post("sync");
      assert.equal(result.statusCode, 200, result.body);
      assert.equal(tables.billingSubscription[0].pendingChange.state, "scheduled");
      assert.equal(tables.billingPayment.find(p => p.remoteId === next.id).planCode, "solar");
      assert.equal(tables.billingPayment.find(p => p.remoteId === next.id).cycle, "annual");
      assert.equal(effectivePlanCode(tables.user[0]), "eletrico");
    });
    await t.test("a paid invoice with a forged amount is rejected transactionally", async () => {
      reset(); await post("create-checkout-session", input());
      payments[0].status = "CONFIRMED"; payments[0].paymentDate = dateOnly(); payments[0].value = 1;
      assert.equal((await webhook("wrong-value")).statusCode, 409);
      assert.equal(tables.billingEvent.length, 0);
      assert.equal(tables.billingPayment[0].status, "PENDING");
      assert.equal(effectivePlanCode(tables.user[0]), "gratuito");
    });
    await t.test("cancellation resumes cleanup after a partial failure", async () => {
      reset(); await post("create-checkout-session", input()); failDelete = true;
      assert.equal((await post("cancel")).statusCode, 503);
      assert.equal(tables.billingSubscription[0].cancelRequested, true);
      assert.equal((await post("cancel")).statusCode, 200);
      assert.equal(payments[0].deleted, true);
      assert.equal(tables.billingSubscription[0].status, "cancelled");
      assert.equal((await post("cancel")).statusCode, 200);
    });
    await t.test("unknown and disabled-account events do not block the merchant queue", async () => {
      reset(); await post("create-checkout-session", input());
      tables.user[0].status = "suspended";
      payments[0].status = "RECEIVED"; payments[0].paymentDate = dateOnly();
      assert.equal((await webhook("suspended")).statusCode, 200);
      subscriptions.push({ id: "sub_unrelated", customer: "unrelated", externalReference: "other-system" });
      assert.equal((await webhook("unrelated", "PAYMENT_CONFIRMED", { id: "pay_external", subscription: "sub_unrelated" })).statusCode, 200);
    });
  } finally {
    await app.close();
    globalThis.fetch = fetchOriginal;
    for (const restore of restores.reverse()) restore();
    env.ASAAS_API_KEY = oldEnv.key; env.ASAAS_WEBHOOK_TOKEN = oldEnv.token;
  }
});
