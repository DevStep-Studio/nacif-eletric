import assert from "node:assert/strict";
import { checkHealth } from "./start-backend-prod.mjs";
const originalFetch = globalThis.fetch;
const catalog = { plans: ["free", "estudante", "eletrico", "solar", "completo"].map(code => ({ code })) };
const health = { ok: true, service: "nacif-electric-backend", asaasConfigured: false };
let plansStatus = 200;
let body = catalog;
let serviceHealth = health;
try {
  globalThis.fetch = async url => url.endsWith("/api/health") ? Response.json(serviceHealth) : Response.json(body, { status: plansStatus });
  assert.equal((await checkHealth()).ok, true);
  plansStatus = 404;
  assert.match((await checkHealth()).reason, /Backend desatualizado/);
  plansStatus = 503;
  assert.equal((await checkHealth()).ok, false);
  plansStatus = 200;
  body = { plans: [] };
  assert.equal((await checkHealth()).ok, false);
  body = catalog;
  serviceHealth = { ok: true, service: "other-service" };
  assert.equal((await checkHealth()).ok, false);
  globalThis.fetch = async () => { throw new Error("Connection refused"); };
  assert.equal((await checkHealth()).ok, false);
  console.log("PASS: readiness rejects outdated APIs, invalid catalogs, wrong services and unreachable servers.");
} finally { globalThis.fetch = originalFetch; }
