import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: "custom",
});
const originalWindow = globalThis.window;
const entries = new Map();
globalThis.window = {
  location: { origin: "http://localhost:5173" }, dispatchEvent: () => true,
  localStorage: { getItem: key => entries.get(key) ?? null, setItem: (key,value) => entries.set(key,value), removeItem: key => entries.delete(key) },
};
try {
  const { normalizeSubscription, resolveEffectiveSubscription } = await server.ssrLoadModule("/src/lib/subscriptionPlans.js");
  for (const user of [
    {}, { plan: "gratuito" }, { plan: "completo" },
    { plan: "completo", subscription_status: "active", billing_provider: "manual" },
    { role: "admin", plan: "completo", subscription_plan: null, has_paid_subscription: false },
  ]) {
    const subscription = normalizeSubscription(user);
    assert.equal(subscription.planCode, "free");
    assert.equal(subscription.status, "none");
    assert.equal(subscription.hasPaidSubscription, false);
    assert.equal(subscription.price, 0);
    assert.equal(subscription.cycle, null);
    assert.equal(subscription.startDate, null);
    assert.equal(subscription.renewalDate, null);
    assert.equal(subscription.autoRenew, false);
    assert.equal(resolveEffectiveSubscription(user).hasPaidSubscription, false);
    assert.equal(resolveEffectiveSubscription(user).planCode, "free");
  }
  const paidUser = { plan: "solar", subscription_plan: "solar", has_paid_subscription: true,
    billing_provider: "asaas", subscription_status: "active", subscription_cycle: "monthly",
    subscription_price: 149.9, subscription_valid_until: new Date(Date.now()+86400000).toISOString() };
  assert.equal(normalizeSubscription(paidUser).planCode, "solar");
  assert.equal(normalizeSubscription(paidUser).hasPaidSubscription, true);
  assert.equal(normalizeSubscription(paidUser).price, 149.9);
  const { backend, isLocalAuthMode } = await server.ssrLoadModule("/src/api/backendClient.js");
  assert.equal(isLocalAuthMode, true);
  const { user } = await backend.auth.register({ email: "signup-no-plan@example.com", password: "test-password-123", profession: "engenheiro" });
  assert.equal(user.plan, "gratuito");
  assert.equal(user.subscription_status, "none");
  assert.equal(user.has_paid_subscription, false);
  assert.equal((await backend.auth.me()).plan, "gratuito", "local reload must not promote the account");
  assert.equal(normalizeSubscription(await backend.auth.me()).status, "none");
  console.log("PASS: novas contas e perfis antigos sem assinatura, recarga local sem promoção e assinatura paga preservada.");
} finally {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  await server.close();
}
