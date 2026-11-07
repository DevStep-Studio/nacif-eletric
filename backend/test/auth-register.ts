import assert from "node:assert/strict";
import { test } from "node:test";
import type { User } from "@prisma/client";
import { buildApp } from "../src/app.js";
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
    const user = {
      ...data, id: `registration-${users.length}`, status: "active",
      isDeleted: false, customPermissions: null,
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
    payload: { email, password, profession: "Projetista", terms_accepted: true },
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
        assert.equal(user.email, email);
        assert.equal(user.passwordHash, undefined);
        assert.equal(app.jwt.verify<{ sub: string }>(access_token).sub, user.id);
        assert.equal(notificationCalls, failure === 1 ? 1 : 2);
        const login = await app.inject({
          method: "POST", url: "/api/auth/login",
          payload: { email, password: "test-secret-123" },
        });
        assert.equal(login.statusCode, 200);
        const me = await app.inject({
          method: "GET", url: "/api/auth/me",
          headers: { authorization: `Bearer ${access_token}` },
        });
        assert.equal(me.statusCode, 200);
        assert.equal(me.json().id, user.id);
        assert.equal((await register(email)).statusCode, 409);
      });
    }
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
