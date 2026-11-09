import assert from "node:assert/strict";

// Opt-in test against a disposable MySQL database. Every financial API is simulated.
assert.match(process.env.DATABASE_URL || "", /\/[^/?]*_test(?:\?|$)/, "Use an isolated database ending in _test");
process.env.NODE_ENV = "test";
process.env.ASAAS_ENVIRONMENT = "sandbox";
process.env.ASAAS_API_KEY = "test-only-no-network";
process.env.ASAAS_WEBHOOK_TOKEN = "test-only-asaas-webhook-token-1234567890";
process.env.UPLOAD_DIR = "/tmp/nacif-asaas-test-uploads";
const { buildApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const app = await buildApp();
const originalFetch = globalThis.fetch;
const customers: any[] = [], subscriptions: any[] = [], payments: any[] = [];
let creations = 0;
globalThis.fetch = async (url, options: any = {}) => {
  const parsed = new URL(String(url));
  assert.equal(parsed.hostname, "api-sandbox.asaas.com");
  const path = parsed.pathname.replace("/v3", "");
  const method = options.method || "GET";
  const body = options.body ? JSON.parse(options.body) : {};
  const json = (value: any) => Response.json(value);
  const list = (items: any[]) => json({ data: items.filter(p => !p.deleted), hasMore: false });
  if (path === "/customers") {
    if (method === "GET") return list(customers.filter(c => c.externalReference === parsed.searchParams.get("externalReference")));
    const customer = { ...body, id: `cus_mysql_${customers.length}` }; customers.push(customer); return json(customer);
  }
  if (path.startsWith("/customers/")) return json({ ...body, id: customers[0].id });
  if (path === "/subscriptions") {
    if (method === "GET") return list(subscriptions.filter(s => s.externalReference === parsed.searchParams.get("externalReference")));
    creations++;
    const sub = { ...body, id: `sub_mysql_${Date.now()}`, status: "ACTIVE" }; subscriptions.push(sub);
    payments.push({ id: `pay_mysql_${Date.now()}`, customer: sub.customer, subscription: sub.id, status: "PENDING", value: sub.value, dueDate: sub.nextDueDate, invoiceUrl: "https://sandbox.asaas.com/i/mysql-test" });
    return json(sub);
  }
  if (path.startsWith("/subscriptions/")) {
    const sub = subscriptions.find(s => s.id === path.split("/")[2]);
    assert.ok(sub);
    if (method === "PUT") Object.assign(sub, body);
    return json(sub);
  }
  if (path === "/payments") return list(payments.filter(p => p.subscription === parsed.searchParams.get("subscription")));
  if (path.startsWith("/payments/")) {
    const p = payments.find(p => p.id === path.split("/")[2]); assert.ok(p);
    if (method === "DELETE") p.deleted = true;
    if (method === "PUT") Object.assign(p, body);
    return json(p);
  }
  throw new Error(`Unexpected request ${method} ${path}`);
};
const ids: string[] = [];
let accountId: string | undefined;
try {
  for (const name of ["owner", "other"]) {
    const user = await prisma.user.create({ data: { email: `billing-${name}-${Date.now()}@example.com`, fullName: "Billing Test", passwordHash: "unused-test-hash", customPermissions: {} } });
    ids.push(user.id);
  }
  const auth = (id = ids[0]) => ({ authorization: `Bearer ${app.jwt.sign({ sub: id, email: "billing@example.com", role: "user" })}` });
  const post = (path: string, payload: any = {}, id = ids[0]) => app.inject({ method: "POST", url: `/api/subscriptions/${path}`, payload, headers: auth(id) });
  const input = { planCode: "completo", cycle: "annual", billingType: "BOLETO", billingDetails: { cpfCnpj: "52998224725", phone: "11999999999", postalCode: "01001000", address: "Praça da Sé", addressNumber: "1", province: "Sé" } };
  const race = await Promise.all([post("create-checkout-session", input), post("create-checkout-session", input)]);
  assert.ok(race.every(r => [200,409].includes(r.statusCode)), race.map(r => r.body).join("\n"));
  assert.equal(creations, 1, "row locking serializes concurrent creation");
  const local = await prisma.billingSubscription.findFirstOrThrow({ where: { remoteId: subscriptions[0].id } });
  accountId = local.accountId;
  assert.equal(Number(local.value), 1764);
  assert.equal((await app.inject({ method: "DELETE", url: "/api/auth/me", headers: auth() })).statusCode, 409, "cannot delete a billable account");
  const pending = await post("verify-checkout-session", { subscriptionId: local.id });
  assert.equal(pending.json().paid, false);
  assert.equal(pending.json().user.plan, "gratuito");
  assert.equal((await post("verify-checkout-session", { subscriptionId: local.id }, ids[1])).statusCode, 404);
  payments[0].status = "CONFIRMED"; payments[0].paymentDate = new Date().toISOString().slice(0,10);
  const payload = { id: `evt_mysql_${Date.now()}`, event: "PAYMENT_CONFIRMED", payment: { id: payments[0].id, subscription: subscriptions[0].id } };
  const hook = () => app.inject({ method: "POST", url: "/api/subscriptions/webhook/asaas", headers: { "asaas-access-token": process.env.ASAAS_WEBHOOK_TOKEN! }, payload });
  const deliveries = await Promise.all([hook(), hook()]);
  assert.ok(deliveries.every(r => [200,409].includes(r.statusCode)), deliveries.map(r => r.body).join("\n"));
  assert.equal((await hook()).statusCode, 200);
  assert.equal(await prisma.billingEvent.count({ where: { id: `sandbox:${payload.id}` } }), 1);
  assert.equal(await prisma.billingPayment.count({ where: { subscriptionId: local.id } }), 1);
  const confirmed = await post("verify-checkout-session", { subscriptionId: local.id });
  assert.equal(confirmed.json().paid, true);
  assert.equal(confirmed.json().user.plan, "completo");
  const paidEnd = confirmed.json().user.subscription_valid_until;
  const changed = await post("change-plan", { planCode: "solar", cycle: "monthly" });
  assert.equal(changed.statusCode, 200, changed.body);
  assert.equal(changed.json().effectiveDate, paidEnd.slice(0,10));
  const record = await prisma.billingSubscription.findUniqueOrThrow({ where: { id: local.id } });
  assert.equal((record.pendingChange as any).state, "scheduled", "JSON state commits after external update");
  assert.equal((await post("cancel")).statusCode, 200);
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: auth() });
  assert.equal(me.json().plan, "completo");
  assert.equal(me.json().subscription_valid_until, paidEnd);
  assert.equal(me.json().subscription_auto_renew, false);
  console.log("PASS: real MySQL billing creation race, ownership, webhook deduplication, decimal values, JSON plan changes and cancellation.");
} finally {
  globalThis.fetch = originalFetch;
  if (accountId) {
    const subs = await prisma.billingSubscription.findMany({ where: { accountId } });
    await prisma.billingPayment.deleteMany({ where: { subscriptionId: { in: subs.map(s => s.id) } } });
    await prisma.billingSubscription.deleteMany({ where: { accountId } });
    await prisma.billingAccount.delete({ where: { id: accountId } });
  }
  await prisma.billingEvent.deleteMany({ where: { id: { startsWith: "sandbox:evt_mysql_" } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app.close(); await prisma.$disconnect();
}
