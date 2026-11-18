import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

// Real HTTP/auth handlers, with isolated transactional storage and no provider calls.
test("permanent account deletion and billing safeguards", async t => {
  const restores: Array<() => void> = [];
  const replace = (target: any, key: string, value: any) => {
    const original = target[key]; target[key] = value;
    restores.push(() => { target[key] = original; });
  };
  let tables: Record<string, any[]> = {};
  let failDelete = false;
  const match = (row: any, where: any = {}): boolean => Object.entries(where).every(([key, value]: any) => {
    if (key === "OR") return value.some((filter: any) => match(row, filter));
    if (value && typeof value === "object") {
      if (value.in) return value.in.includes(row[key]);
      if (value.notIn) return !value.notIn.includes(row[key]);
    }
    return row[key] === value;
  });
  const models = ["user", "billingAccount", "billingSubscription", "billingPayment", "auditLog", "notification"];
  for (const model of models) {
    const delegate = (prisma as any)[model];
    replace(delegate, "findUnique", async ({ where }: any) => tables[model].find(row => match(row, where)) || null);
    replace(delegate, "findUniqueOrThrow", async ({ where }: any) => {
      const row = tables[model].find(row => match(row, where));
      assert.ok(row); return row;
    });
    replace(delegate, "findMany", async ({ where }: any) => tables[model].filter(row => match(row, where)));
    replace(delegate, "findFirst", async ({ where }: any) => tables[model].find(row => match(row, where)) || null);
    replace(delegate, "deleteMany", async ({ where }: any) => {
      const before = tables[model].length;
      tables[model] = tables[model].filter(row => !match(row, where));
      return { count: before - tables[model].length };
    });
  }
  replace(prisma.user, "delete", async ({ where }: any) => {
    if (failDelete) throw new Error("Simulated deletion failure");
    const row = tables.user.find(row => match(row, where));
    assert.ok(row);
    tables.user = tables.user.filter(user => user.id !== row.id);
    return row;
  });
  replace(prisma.user, "create", async ({ data }: any) => {
    const row = { id: "new-account", ...data, status: "active", createdAt: new Date(), updatedAt: new Date() };
    tables.user.push(row); return row;
  });
  replace(prisma.notification, "createMany", async () => ({ count: 1 }));
  replace(prisma, "$queryRaw", async () => []);
  replace(prisma, "$transaction", async (fn: any) => {
    const snapshot = structuredClone(tables);
    try { return await fn(prisma); }
    catch (error) { tables = snapshot; throw error; }
  });
  const app = await buildApp();
  const headers = (id = "owner", role = "user") => ({ authorization: `Bearer ${app.jwt.sign({ sub: id, role, email: `${id}@example.com` })}` });
  const remove = () => app.inject({ method: "DELETE", url: "/api/auth/me", headers: headers() });
  const reset = () => {
    failDelete = false;
    for (const model of models) tables[model] = [];
    tables.user = ["owner", "other", "admin"].map(id => ({ id, email: `${id}@example.com`, fullName: id,
      role: id === "admin" ? "super_admin" : "user", status: "active", plan: "gratuito",
      customPermissions: {}, isDeleted: false, createdAt: new Date(), updatedAt: new Date() }));
    tables.billingAccount = [{ id: "account", userId: "owner", lockUntil: null }, { id: "other-account", userId: "other" }];
    tables.billingSubscription = [{ id: "subscription", accountId: "account", status: "cancelled" }, { id: "other-sub", accountId: "other-account", status: "active" }];
    tables.billingPayment = [{ id: "payment", subscriptionId: "subscription" }, { id: "other-payment", subscriptionId: "other-sub" }];
    tables.auditLog = [{ id: "own-log", actorId: "owner" }, { id: "target-log", actorId: "admin", targetType: "user", targetId: "owner" }, { id: "other-log", actorId: "other" }];
  };
  try {
    await t.test("physically removes account and billing records, rejects old session and frees email", async () => {
      reset();
      const result = await remove();
      assert.equal(result.statusCode, 200, result.body);
      assert.equal(result.json().ok, true);
      assert.deepEqual(tables.user.map(row => row.id), ["other", "admin"]);
      assert.deepEqual(tables.billingAccount.map(row => row.id), ["other-account"]);
      assert.deepEqual(tables.billingSubscription.map(row => row.id), ["other-sub"]);
      assert.deepEqual(tables.billingPayment.map(row => row.id), ["other-payment"]);
      assert.deepEqual(tables.auditLog.map(row => row.id), ["other-log"]);
      assert.equal((await app.inject({ method: "GET", url: "/api/auth/me", headers: headers() })).statusCode, 401);
      const register = await app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "owner@example.com", password: "new-password-123" } });
      assert.equal(register.statusCode, 200, register.body);
      assert.equal(register.json().user.id, "new-account");
    });
    await t.test("active subscription or billing lease prevents deletion without changing any records", async () => {
      for (const mode of ["subscription", "lease"]) {
        reset();
        if (mode === "subscription") tables.billingSubscription[0].status = "trialing";
        else tables.billingAccount[0].lockUntil = new Date(Date.now() + 60000);
        const before = structuredClone(tables);
        assert.equal((await remove()).statusCode, 409);
        assert.deepEqual(tables, before);
      }
    });
    await t.test("storage error rolls back deletion and does not report success", async () => {
      reset(); failDelete = true;
      const before = structuredClone(tables);
      assert.equal((await remove()).statusCode, 500);
      assert.deepEqual(tables, before);
    });
    await t.test("administrator deletion uses the same physical removal", async () => {
      reset();
      const result = await app.inject({ method: "DELETE", url: "/api/super-admin/users/owner", headers: headers("admin", "super_admin") });
      assert.equal(result.statusCode, 200, result.body);
      assert.equal(tables.user.some(row => row.id === "owner"), false);
    });
    await t.test("ordinary user cannot delete another account", async () => {
      reset();
      const result = await app.inject({ method: "DELETE", url: "/api/super-admin/users/other", headers: headers() });
      assert.equal(result.statusCode, 403);
      assert.equal(tables.user.length, 3);
    });
  } finally {
    restores.reverse().forEach(restore => restore());
    await app.close();
    await prisma.$disconnect();
  }
});
