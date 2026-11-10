import assert from "node:assert/strict";
import { createServer } from "vite";
const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: "custom",
});
const entries = new Map([["voltai_access_token", "local:old-session:123"]]);
globalThis.window = {
  location: { origin: "http://localhost:5173" },
  localStorage: {
    getItem: (k) => entries.get(k) || null,
    setItem: (k, v) => entries.set(k, v),
    removeItem: (k) => entries.delete(k),
  },
};
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url, ...options });
  const path = new URL(url, window.location.origin).pathname;
  if (path === "/api/auth/login")
    return Response.json({
      access_token: "signed-jwt",
      user: { id: "server-user" },
    });
  if (path === "/api/subscriptions/plans")
    return Response.json({
      plans: [{ code: "completo", limits: { projects: null } }],
    });
  if (path === "/api/auth/me")
    return Response.json({ id: "server-user", plan: "gratuito", subscription_status: "pending" });
  if (path.includes("/verify-checkout-session"))
    return Response.json({ paid: false });
  if (path.includes("/create-checkout-session"))
    return Response.json({ url: "https://sandbox.asaas.com/i/test" });
  if (path === "/api/projects")
    return Response.json([{ id: "server-project" }]);
  return Response.json({ error: "Servidor indisponível" }, { status: 503 });
};
try {
  const { backend, isLocalAuthMode } = await server.ssrLoadModule(
    "/src/api/backendClient.js",
  );
  const billing = await server.ssrLoadModule("/src/lib/billingApi.js");
  const plans = await server.ssrLoadModule("/src/lib/subscriptionPlans.js");
  assert.equal(isLocalAuthMode, false);
  assert.equal(backend.auth.getToken(), null);
  assert.equal(entries.has("voltai_access_token"), false);
  await backend.auth.loginViaEmailPassword("user@example.com", "password");
  assert.equal(backend.auth.getToken(), "signed-jwt");
  const me = await backend.auth.me();
  assert.equal(me.id, "server-user");
  assert.equal(me.plan, "gratuito");
  assert.equal(me.subscription_status, "pending");
  assert.equal(calls.at(-1).headers.get("Authorization"), "Bearer signed-jwt");
  assert.equal((await backend.entities.Project.list())[0].id, "server-project");
  const catalog = await backend.subscriptions.getPlans();
  plans.applyRemotePlanCatalog(catalog.plans);
  assert.equal(plans.getPlanByCode("completo").limits.projects, Infinity);
  assert.equal(plans.getPlanByCode("unknown").code, "free");
  await billing.createCheckoutSession({
    planCode: "completo",
    cycle: "annual",
    billingType: "PIX",
    billingDetails: { cpfCnpj: "52998224725" },
    priceId: "forged",
    userId: "other",
  });
  assert.deepEqual(JSON.parse(calls.at(-1).body), {
    planCode: "completo",
    cycle: "annual",
    billingType: "PIX",
    billingDetails: { cpfCnpj: "52998224725" },
  });
  assert.equal(calls.at(-1).headers.get("Authorization"), "Bearer signed-jwt");
  assert.equal(
    (await billing.verifyCheckoutSession({ subscriptionId: "local-subscription" })).paid,
    false,
  );
  await assert.rejects(() => backend.subscriptions.cancel({}), {
    message: "Servidor indisponível",
    status: 503,
  });
  const enforcement = await server.ssrLoadModule("/src/lib/planEnforcement.js");
  assert.equal((await enforcement.authorizePlanExport({ moduleKey: "panel" })).allowed, false, "HTTP failure must block export");
  globalThis.fetch = async () => Response.json({ allowed: false, reason: "Cota esgotada" });
  assert.equal((await backend.subscriptions.consumeExportQuota({ moduleKey: "panel" })).allowed, false);
  assert.equal((await enforcement.authorizePlanExport({ moduleKey: "panel" })).allowed, false);
  globalThis.fetch = async () => Response.json({ allowed: true, watermark: "Uso acadêmico" });
  const authorization = await enforcement.authorizePlanExport({ moduleKey: "plant" });
  assert.equal(authorization.allowed, true);
  assert.equal(authorization.watermark, "Uso acadêmico");
  assert.match(enforcement.stampSvgWithPlanWatermark('<svg></svg>', authorization), /Uso acadêmico/);
  const pages = [];
  const doc = { internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getCurrentPageInfo: () => ({ pageNumber: 2 }) },
    getNumberOfPages: () => 2, setPage: page => pages.push(page), setFontSize() {}, setTextColor() {}, text: text => assert.equal(text, authorization.watermark) };
  enforcement.stampPdfWithPlanWatermark(doc, authorization);
  assert.deepEqual(pages, [1, 2, 2], "watermark all pages and restore selection");
  globalThis.fetch = async () => Response.json({ message: "Route GET:/api/subscriptions/plans not found" }, { status: 404 });
  await assert.rejects(() => backend.subscriptions.getPlans(), { message: "O backend publicado não possui a rota de planos. Atualize o backend e reinicie nacif-electric-api no servidor.", status: 404 });
  console.log(
    "PASS: API client uses HTTP, JWT, remote plans, server checkout and propagated errors.",
  );
} finally {
  globalThis.fetch = originalFetch;
  delete globalThis.window;
  await server.close();
}
