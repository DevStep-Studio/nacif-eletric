import assert from "node:assert/strict";
import { test } from "node:test";
import type { User, PasswordResetToken } from "@prisma/client";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { verifyPassword } from "../src/lib/auth.js";

test("Password Reset flow: forgot-password and reset-password", async (t) => {
  const app = await buildApp();
  const restores: Array<() => void> = [];

  const replaceMethod = (target: any, name: string, replacement: any) => {
    const original = target[name];
    target[name] = replacement;
    restores.push(() => {
      target[name] = original;
    });
  };

  const users: User[] = [
    {
      id: "user-123",
      email: "eng.gabriel@nacifenergy.com.br",
      fullName: "Gabriel Nacif",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuv", // hash de teste
      role: "admin",
      plan: "completo",
      isSuperAdmin: false,
      status: "active",
      isDeleted: false,
      profession: "engenheiro",
      company: null,
      crea: null,
      phone: null,
      avatarUrl: null,
      theme: "light",
      customPermissions: {},
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as User,
  ];

  const resetTokens: PasswordResetToken[] = [];

  replaceMethod(prisma.user, "findUnique", async ({ where }: any) => {
    return users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null;
  });

  replaceMethod(prisma.user, "update", async ({ where, data }: any) => {
    const user = users.find((u) => u.id === where.id);
    if (!user) throw new Error("User not found");
    Object.assign(user, data);
    return user;
  });

  replaceMethod(prisma.passwordResetToken, "updateMany", async ({ where, data }: any) => {
    let count = 0;
    for (const token of resetTokens) {
      if (token.userId === where.userId && (where.usedAt === null ? token.usedAt === null : true)) {
        Object.assign(token, data);
        count++;
      }
    }
    return { count };
  });

  replaceMethod(prisma.passwordResetToken, "create", async ({ data }: any) => {
    const newToken: PasswordResetToken = {
      id: `tok-${resetTokens.length + 1}`,
      token: data.token,
      userId: data.userId,
      expiresAt: data.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    resetTokens.push(newToken);
    return newToken;
  });

  replaceMethod(prisma.passwordResetToken, "findUnique", async ({ where }: any) => {
    const found = resetTokens.find((t) => t.token === where.token);
    if (!found) return null;
    const user = users.find((u) => u.id === found.userId);
    return { ...found, user };
  });

  replaceMethod(prisma.passwordResetToken, "update", async ({ where, data }: any) => {
    const token = resetTokens.find((t) => t.id === where.id);
    if (!token) throw new Error("Token not found");
    Object.assign(token, data);
    return token;
  });

  // Prisma transaction mock
  replaceMethod(prisma, "$transaction", async (promises: any[]) => {
    return Promise.all(promises);
  });

  try {
    await t.test("POST /api/auth/forgot-password gera token seguro e link de recuperação", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { email: "eng.gabriel@nacifenergy.com.br" },
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.ok, true);
      assert.ok(body.message);
      assert.equal(resetTokens.length, 1);
      assert.equal(resetTokens[0].userId, "user-123");
      assert.equal(resetTokens[0].usedAt, null);
      // O token deve ter 64 caracteres hexadecimais (32 bytes)
      assert.equal(resetTokens[0].token.length, 64);
      // Expira em aproximadamente 1 hora
      const diffMs = resetTokens[0].expiresAt.getTime() - Date.now();
      assert.ok(diffMs > 3500 * 1000 && diffMs <= 3600 * 1000);
    });

    await t.test("POST /api/auth/reset-password-request responde de forma idêntica (compatibilidade)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password-request",
        payload: { email: "eng.gabriel@nacifenergy.com.br" },
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.ok, true);
      // O token anterior deve ter sido invalidado
      assert.equal(resetTokens[0].usedAt instanceof Date, true);
      // O novo token é o ativo
      assert.equal(resetTokens.length, 2);
      assert.equal(resetTokens[1].usedAt, null);
    });

    await t.test("POST /api/auth/forgot-password com e-mail inexistente retorna 200 sem vazar dados", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/forgot-password",
        payload: { email: "desconhecido@teste.com" },
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.ok, true);
      assert.equal(body.emailSent, false);
    });

    await t.test("POST /api/auth/reset-password redefine a senha com sucesso e invalida o token", async () => {
      const activeToken = resetTokens[1].token;
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: {
          token: activeToken,
          password: "NovaSenhaForte@2026",
        },
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.ok, true);

      // Token foi marcado como utilizado
      assert.equal(resetTokens[1].usedAt instanceof Date, true);

      // Senha do usuário foi atualizada com hash bcrypt
      const isNewPasswordValid = await verifyPassword("NovaSenhaForte@2026", users[0].passwordHash);
      assert.equal(isNewPasswordValid, true);
    });

    await t.test("POST /api/auth/reset-password rejeita token já utilizado com erro 400", async () => {
      const usedToken = resetTokens[1].token;
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: {
          token: usedToken,
          password: "OutraSenhaTentativa@2026",
        },
      });

      assert.equal(res.statusCode, 400);
      const body = res.json();
      assert.match(body.message, /inválido ou expirado/i);
    });

    await t.test("POST /api/auth/reset-password rejeita token inexistente com erro 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/reset-password",
        payload: {
          token: "token-falso-12345",
          password: "OutraSenhaTentativa@2026",
        },
      });

      assert.equal(res.statusCode, 400);
      const body = res.json();
      assert.match(body.message, /inválido ou expirado/i);
    });
  } finally {
    for (const restore of restores) restore();
    await app.close();
  }
});

