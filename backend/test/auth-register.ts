import assert from "node:assert/strict";
import { test } from "node:test";
import type { User } from "@prisma/client";
import { buildApp } from "../src/app.js";
import { serializeUser } from "../src/lib/serializers.js";
import { effectivePlanCode } from "../src/lib/planGovernance.js";
import { prisma } from "../src/lib/prisma.js";

// Exercise real HTTP handlers, hashing, JWT and validation without a live database.
test("registration survives optional notification failures", async (t) => {
  const app = await buildApp();
  const restores: Array<() => void> = [];
  const replaceMethod = (target: any, name: string, replacement: any) => {
    const original = target[name];
    target[name] = replacement;
    restores.push(() => { target[name] = original; });
  };
  const users: User[] = [];
  let notificationCalls = 0;
  let failNotificationAt = 0;
  let failUserCreation = false;
  replaceMethod(prisma.user, "findUnique", async ({ where }: any) =>
    users.find((user) => where.id ? user.id === where.id : user.email === where.email) ?? null,
  );
  replaceMethod(prisma.user, "count", async () => users.length);
  replaceMethod(prisma.user, "create", async ({ data }: any) => {
    if (failUserCreation) throw new Error("User persistence unavailable");
    // Production may have a legacy NOT NULL column without a default.
    assert.deepEqual(data.customPermissions, {}, "registration must initialize custom_permissions");
    const user = {
      ...data, id: `registration-${users.length}`, status: "active",
      isDeleted: false,
      createdAt: new Date(), updatedAt: new Date(),
    } as User;
    users.push(user);
    return user;
  });
  replaceMethod(prisma.notification, "createMany", async () => {
    notificationCalls++;
    if (notificationCalls === failNotificationAt) {
      throw Object.assign(new Error("Notification storage unavailable"), { code: "P2021" });
    }
    return { count: 1 };
  });
  const register = (email: string, password = "test-secret-123") => app.inject({
    method: "POST", url: "/api/auth/register",
    payload: { email, password, profession: "Projetista", terms_accepted: true, plan: "completo", role: "admin", subscription_status: "active" },
  });
  try {
    for (const failure of [0, 1, 2]) {
      await t.test(`notification failure position ${failure}`, async () => {
        notificationCalls = 0;
        failNotificationAt = failure;
        const email = `registration-${failure}@example.com`;
        const response = await register(email);
        assert.equal(response.statusCode, 200);
        const { user, access_token } = response.json();
        assert.equal(user.profession, "projetista");
        assert.equal(user.role, "user", "even the first public signup must be an ordinary user");
        assert.equal(users.at(-1)!.plan, "gratuito", "persist no paid plan on signup");
        assert.equal(user.plan, "gratuito");
        assert.equal(user.subscription_plan, null);
        assert.equal(user.has_paid_subscription, false);
        assert.equal(user.subscription_status, "none");
        assert.equal(user.billing_provider, "none");
        assert.equal(user.subscription_price, 0);
        assert.equal(user.subscription_cycle, null);
        assert.equal(user.subscription_start_date, null);
        assert.equal(user.subscription_valid_until, null);
        assert.equal(user.subscription_auto_renew, false);
        assert.equal(user.email, email);
        assert.equal(user.passwordHash, undefined);
        assert.equal(app.jwt.verify<{ sub: string }>(access_token).sub, user.id);
        assert.equal(notificationCalls, failure === 1 ? 1 : 2);
        const login = await app.inject({
          method: "POST", url: "/api/auth/login",
          payload: { email, password: "test-secret-123" },
        });
        assert.equal(login.statusCode, 200);
        assert.equal(login.json().user.plan, "gratuito");
        assert.equal(login.json().user.subscription_status, "none");
        const me = await app.inject({
          method: "GET", url: "/api/auth/me",
          headers: { authorization: `Bearer ${access_token}` },
        });
        assert.equal(me.statusCode, 200);
        assert.equal(me.json().id, user.id);
        assert.equal(me.json().plan, "gratuito");
        assert.equal(me.json().has_paid_subscription, false);
        assert.equal((await register(email)).statusCode, 409);
      });
    }
    await t.test("legacy full-plan labels and administrator roles are not paid subscriptions", () => {
      const regular = { ...users[0], plan: "completo", customPermissions: {
        subscriptionStatus: "active", autoRenew: true, subscriptionPrice: 210,
        subscriptionCycle: "annual", subscriptionRenewalDate: "2099-01-01",
      } } as User;
      assert.equal(serializeUser(regular).plan, "gratuito");
      assert.equal(serializeUser(regular).subscription_status, "none");
      assert.equal(serializeUser(regular).subscription_price, 0);
      assert.equal(serializeUser(regular).subscription_auto_renew, false);
      assert.equal(serializeUser(regular).subscription_cycle, null);
      assert.equal(serializeUser(regular).subscription_valid_until, null);
      for (const role of ["admin", "super_admin"] as const) {
        const admin = { ...regular, role };
        assert.equal(effectivePlanCode(admin), "completo", "administrative access is preserved");
        const serialized = serializeUser(admin);
        assert.equal(serialized.role, role);
        assert.equal(serialized.plan, "gratuito");
        assert.equal(serialized.subscription_plan, null);
        assert.equal(serialized.has_paid_subscription, false);
      }
    });
    await t.test("invalid input creates no account", async () => {
      const before = users.length;
      assert.equal((await register("invalid")).statusCode, 400);
      assert.equal((await register("valid@example.com", "123")).statusCode, 400);
      assert.equal(users.length, before);
    });
    await t.test("user persistence errors still fail registration", async () => {
      failUserCreation = true;
      notificationCalls = 0;
      const before = users.length;
      assert.equal((await register("storage-error@example.com")).statusCode, 500);
      assert.equal(users.length, before);
      assert.equal(notificationCalls, 0);
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
    await app.close();
    await prisma.$disconnect();
  }
});
