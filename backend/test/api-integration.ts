import assert from "node:assert/strict";

// This suite only runs against an explicitly selected disposable database.
assert.match(
  process.env.DATABASE_URL || "",
  /\/[^/?]*_test(?:\?|$)/,
  "Use a disposable DATABASE_URL ending in _test",
);
process.env.NODE_ENV = "test";
process.env.STRIPE_SECRET_KEY = "sk_test_integration_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_integration_fake";
process.env.JWT_SECRET = "integration-only-secret-minimum-32-characters";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.UPLOAD_DIR = "/tmp/nacif-integration-uploads";
const { buildApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { stripe, STRIPE_PRICES } = await import("../src/lib/stripe.js");
const { effectivePlanCode, checkServerModuleAccess } = await import(
  "../src/lib/planGovernance.js"
);
const { normalizeAccountStatus, assertAccountAvailable } = await import("../src/lib/accountAccess.js");
const app = await buildApp();
const createdIds: string[] = [];
const eventIds: string[] = [];
const call = async (
  method: any,
  url: string,
  payload?: any,
  token?: string,
) => {
  const response = await app.inject({
    method,
    url,
    payload,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: response.statusCode, body: response.json() };
};
let assertions = 0;
const eq = (actual: any, expected: any) => {
  assert.deepEqual(actual, expected);
  assertions++;
};
try {
  for (const [input, expected] of [[null, "active"], [" AtIvA ", "active"], ["SUSPENSO", "suspended"], ["BLOQUEADA", "suspended"], ["INATIVO", "inactive"], ["EXCLUÍDA", "deleted"]]) eq(normalizeAccountStatus(input), expected);
  assert.throws(() => assertAccountAvailable({ status: "suspenso" }), { statusCode: 403, message: "Sua conta está suspensa. Entre em contato com o administrador." });
  const plans = await call("GET", "/api/subscriptions/plans");
  eq(plans.status, 200);
  eq(plans.body.plans.length, 5);
  eq(
    plans.body.plans.find((p: any) => p.code === "completo").limits.projects,
    null,
  );
  eq(
    plans.body.plans.find((p: any) => p.code === "estudante").annualPrice,
    null,
  );
  eq((await call("GET", "/api/auth/me")).status, 401);
  eq(
    (await call("GET", "/api/auth/me", undefined, "local:fake:token")).status,
    401,
  );
  const email = `integration-${Date.now()}@example.com`;
  const registered = await call("POST", "/api/auth/register", {
    email,
    password: "test-secret-123",
    full_name: "Integration User",
    profession: "engenheiro",
  });
  eq(registered.status, 200);
  eq(registered.body.user.full_name, "Integration User");
  const id = registered.body.user.id;
  createdIds.push(id);
  await prisma.user.update({ where: { id }, data: { role: "user" } });
  const login = await call("POST", "/api/auth/login", {
    email,
    password: "test-secret-123",
  });
  const token = login.body.access_token;
  eq(login.status, 200);
  eq(
    (await call("GET", "/api/auth/me", undefined, token)).body.plan,
    "gratuito",
  );
  eq(
    (await call("POST", "/api/auth/login", { email, password: "wrong" }))
      .status,
    401,
  );
  for (const legacy of ["ativo", "ATIVA", " Active ", ""]) {
    await prisma.user.update({ where: { id }, data: { status: legacy } });
    const legacyLogin = await call("POST", "/api/auth/login", {
      email,
      password: "test-secret-123",
    });
    eq(legacyLogin.status, 200);
    eq(legacyLogin.body.user.status, "active");
    eq((await call("GET", "/api/auth/me", undefined, token)).status, 200);
    eq(
      (await call("GET", "/api/subscriptions/status", undefined, token)).status,
      200,
    );
  }
  for (const blocked of [
    "suspended",
    "bloqueado",
    "inactive",
    "inativo",
    "deleted",
    "unexpected",
  ]) {
    await prisma.user.update({ where: { id }, data: { status: blocked } });
    const blockedLogin = await call("POST", "/api/auth/login", {
      email,
      password: "test-secret-123",
    });
    eq(blockedLogin.status, 403);
    eq(blockedLogin.body.access_token, undefined);
    eq((await call("GET", "/api/auth/me", undefined, token)).status, 403);
  }
  for (const deleted of [
    { isDeleted: true, deletedAt: null },
    { isDeleted: false, deletedAt: new Date() },
  ]) {
    await prisma.user.update({
      where: { id },
      data: { status: "active", ...deleted },
    });
    eq(
      (
        await call("POST", "/api/auth/login", {
          email,
          password: "test-secret-123",
        })
      ).status,
      403,
    );
    eq((await call("GET", "/api/auth/me", undefined, token)).status, 403);
  }
  await prisma.user.update({
    where: { id },
    data: { status: "active", isDeleted: false, deletedAt: null },
  });
  const missingUserToken = app.jwt.sign({
    sub: "missing-user",
    email,
    role: "user",
  });
  eq(
    (await call("GET", "/api/auth/me", undefined, missingUserToken)).status,
    401,
  );

  eq(
    (await call("PATCH", "/api/auth/me", { plan: "completo" }, token)).status,
    403,
  );
  eq(
    (await call("GET", "/api/subscriptions/admin/users", undefined, token))
      .status,
    403,
  );
  eq(
    (
      await call("POST", "/api/subscriptions/change-plan", {
        planCode: "completo",
      })
    ).status,
    401,
  );
  eq(
    (
      await call(
        "POST",
        "/api/subscriptions/change-plan",
        { planCode: "estudante", cycle: "annual" },
        token,
      )
    ).status,
    400,
  );
  eq(
    (
      await call(
        "POST",
        "/api/subscriptions/change-plan",
        { planCode: "estudante" },
        token,
      )
    ).status,
    403,
  );
  const project = await call(
    "POST",
    "/api/projects",
    { name: "API project", project_type: "Instalações Elétricas" },
    token,
  );
  eq(project.status, 200);
  const projectId = project.body.id;
  eq(
    (
      await call(
        "PATCH",
        `/api/projects/${projectId}`,
        { notes: "Persisted" },
        token,
      )
    ).body.notes,
    "Persisted",
  );
  eq((await call("GET", "/api/projects", undefined, token)).body.length, 1);
  const budget = await call(
    "POST",
    "/api/budgets",
    { name: "Budget", project_id: projectId, materials: [] },
    token,
  );
  eq(budget.status, 200);
  eq(
    (await call("GET", `/api/budgets/${budget.body.id}`, undefined, token)).body
      .owner_id,
    id,
  );
  const issue = await call(
    "POST",
    "/api/issues",
    {
      type: "erro",
      title: "Test",
      description: "Integration test",
      module: "projetos",
      project_id: projectId,
    },
    token,
  );
  eq(issue.status, 200);
  eq(
    (await call("GET", `/api/issues/${issue.body.id}`, undefined, token))
      .status,
    200,
  );
  eq(
    (
      await call(
        "POST",
        "/api/issues/" + issue.body.id + "/comments",
        { message: "Private", is_internal: true },
        token,
      )
    ).status,
    403,
  );
  for (let i = 0; i < 5; i++)
    eq(
      (
        await call(
          "POST",
          "/api/subscriptions/consume-export",
          { projectId },
          token,
        )
      ).body.allowed,
      true,
    );
  eq(
    (
      await call(
        "POST",
        "/api/subscriptions/consume-export",
        { projectId },
        token,
      )
    ).body.allowed,
    false,
  );
  eq(
    (await call("GET", "/api/subscriptions/status", undefined, token)).body
      .usage.exports,
    5,
  );

  const beforeRollover = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({
    where: { id },
    data: {
      customPermissions: {
        ...(beforeRollover.customPermissions as any),
        usagePeriod: "2000-01",
        monthlyExports: 999,
        monthlyAiScans: 999,
      },
    },
  });
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      call("POST", "/api/subscriptions/consume-export", { projectId }, token),
    ),
  );
  eq(concurrent.filter((r) => r.body.allowed).length, 5);
  eq(
    (await call("GET", "/api/subscriptions/status", undefined, token)).body
      .usage.aiScans,
    0,
  );
  eq(
    (
      await call(
        "PATCH",
        `/api/projects/${projectId}`,
        { project_type: "Solar" },
        token,
      )
    ).status,
    403,
  );
  eq(
    (
      await call(
        "PATCH",
        `/api/projects/${projectId}`,
        { panel_layout: { paid: true } },
        token,
      )
    ).status,
    403,
  );
  const projectRace = await Promise.all(
    Array.from({ length: 5 }, (_, n) =>
      call("POST", "/api/projects", { name: `Quota ${n}` }, token),
    ),
  );
  eq(projectRace.filter((r) => r.status === 200).length, 2);
  eq(projectRace.filter((r) => r.status === 403).length, 3);
  const quotaUser = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({
    where: { id },
    data: {
      customPermissions: {
        ...(quotaUser.customPermissions as any),
        storageUsedMb: 250,
      },
    },
  });
  const multipart = Buffer.from(
    '--integration\r\nContent-Disposition: form-data; name="file"; filename="proof.txt"\r\nContent-Type: text/plain\r\n\r\nproof\r\n--integration--\r\n',
  );
  const upload = () =>
    app.inject({
      method: "POST",
      url: "/api/files/upload",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "multipart/form-data; boundary=integration",
      },
      payload: multipart,
    });
  eq((await upload()).statusCode, 403);
  await prisma.user.update({
    where: { id },
    data: {
      customPermissions: {
        ...(quotaUser.customPermissions as any),
        storageUsedMb: 0,
      },
    },
  });
  const uploaded = await upload();
  eq(uploaded.statusCode, 200);
  eq(
    (
      await call(
        "POST",
        "/api/subscriptions/academic-verify",
        {
          institution: "University",
          course: "Electrical Engineering",
          documentName: "proof.txt",
          documentUrl: uploaded.json().file_url,
        },
        token,
      )
    ).body.academic_status,
    "pending_review",
  );

  const spoofedRole = app.jwt.sign({ sub: id, email, role: "super_admin" });
  eq(
    (
      await call(
        "GET",
        "/api/subscriptions/admin/users",
        undefined,
        spoofedRole,
      )
    ).status,
    403,
  );
  eq(
    (
      await app.inject({
        method: "GET",
        url: "/api/subscriptions/plans",
        headers: { origin: "https://untrusted.example" },
      })
    ).statusCode,
    403,
  );
  eq(
    (
      await app.inject({
        method: "OPTIONS",
        url: "/api/projects",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
        },
      })
    ).statusCode,
    204,
  );

  const other = await prisma.user.create({
    data: {
      email: `other-${Date.now()}@example.com`,
      fullName: "Other",
      passwordHash: "unused",
    },
  });
  createdIds.push(other.id);
  const otherToken = app.jwt.sign({
    sub: other.id,
    email: other.email,
    role: "user",
  });
  eq(
    (await call("GET", `/api/projects/${projectId}`, undefined, otherToken))
      .status,
    403,
  );
  eq(
    (await call("GET", `/api/budgets/${budget.body.id}`, undefined, otherToken))
      .status,
    404,
  );
  eq(
    (await call("GET", `/api/issues/${issue.body.id}`, undefined, otherToken))
      .status,
    404,
  );
  const future = Math.floor(Date.now() / 1000) + 86400;
  const subscription: any = {
    id: "sub_integration",
    customer: "cus_integration",
    status: "active",
    current_period_start: future - 86400,
    current_period_end: future,
    cancel_at_period_end: false,
    metadata: { userId: id },
    items: { data: [{ price: { id: STRIPE_PRICES.completo.monthly } }] },
  };
  let checkoutInput: any;
  (stripe.customers as any).create = async () => ({ id: "cus_integration" });
  (stripe.customers as any).list = async () => ({ data: [] });
  (stripe.customers as any).retrieve = async () => ({ id: "cus_integration" });
  (stripe.checkout.sessions as any).create = async (input: any) => {
    checkoutInput = input;
    return {
      id: "cs_integration",
      url: "https://checkout.stripe.com/integration",
    };
  };
  (stripe.checkout.sessions as any).retrieve = async () => ({
    id: "cs_integration",
    client_reference_id: id,
    customer: "cus_integration",
    payment_status: "unpaid",
    status: "complete",
    subscription,
  });
  (stripe.subscriptions as any).retrieve = async () => subscription;
  (stripe.subscriptions as any).update = async (_id: string, input: any) => ({
    ...subscription,
    ...input,
  });
  const checkout = await call(
    "POST",
    "/api/subscriptions/create-checkout-session",
    {
      planCode: "completo",
      cycle: "monthly",
      priceId: "price_forged",
      userId: other.id,
    },
    token,
  );
  eq(checkout.status, 200);
  eq(checkoutInput.line_items[0].price, STRIPE_PRICES.completo.monthly);
  eq(checkoutInput.client_reference_id, id);
  eq((await prisma.user.findUniqueOrThrow({ where: { id } })).plan, "gratuito");
  eq(
    (
      await call(
        "POST",
        "/api/subscriptions/verify-checkout-session",
        { sessionId: "cs_integration" },
        otherToken,
      )
    ).status,
    403,
  );
  eq(
    (
      await call(
        "POST",
        "/api/subscriptions/verify-checkout-session",
        { sessionId: "cs_integration" },
        token,
      )
    ).body.paid,
    false,
  );
  eq((await prisma.user.findUniqueOrThrow({ where: { id } })).plan, "gratuito");
  (stripe.checkout.sessions as any).retrieve = async () => ({
    id: "cs_integration",
    client_reference_id: id,
    customer: "cus_integration",
    payment_status: "paid",
    subscription,
  });
  eq(
    (
      await call(
        "POST",
        "/api/subscriptions/verify-checkout-session",
        { sessionId: "cs_integration" },
        token,
      )
    ).body.paid,
    true,
  );
  eq(
    (await call("GET", "/api/auth/me", undefined, token)).body.plan,
    "completo",
  );
  eq(
    (await call("POST", "/api/subscriptions/cancel", {}, token)).body
      .subscription_auto_renew,
    false,
  );
  eq((await prisma.user.findUniqueOrThrow({ where: { id } })).plan, "completo");
  const eventId = `evt_integration_${Date.now()}`;
  eventIds.push(eventId);
  const event = {
    id: eventId,
    type: "customer.subscription.updated",
    data: { object: { id: subscription.id } },
  };
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const hook = async (sig: string) =>
    app.inject({
      method: "POST",
      url: "/api/subscriptions/webhook",
      payload,
      headers: { "content-type": "application/json", "stripe-signature": sig },
    });
  eq((await hook("invalid")).statusCode, 400);
  eq((await hook(signature)).statusCode, 200);
  eq((await hook(signature)).statusCode, 200);
  eq(await prisma.stripeEvent.count({ where: { id: eventId } }), 1);
  subscription.status = "canceled";
  const canceled = { ...event, id: eventId + "_cancel" };
  eventIds.push(canceled.id);
  const canceledPayload = JSON.stringify(canceled);
  eq(
    (
      await app.inject({
        method: "POST",
        url: "/api/subscriptions/webhook",
        payload: canceledPayload,
        headers: {
          "content-type": "application/json",
          "stripe-signature": stripe.webhooks.generateTestHeaderString({
            payload: canceledPayload,
            secret: process.env.STRIPE_WEBHOOK_SECRET,
          }),
        },
      })
    ).statusCode,
    200,
  );
  eq(
    (await call("GET", "/api/auth/me", undefined, token)).body.plan,
    "gratuito",
  );
  eq(
    effectivePlanCode({
      plan: "completo",
      customPermissions: {
        billingProvider: "stripe",
        subscriptionRenewalDate: "2020-01-01",
      },
    }),
    "gratuito",
  );
  eq(checkServerModuleAccess({ plan: "gratuito" }, "solar").allowed, false);
  eq(checkServerModuleAccess({ plan: "solar" }, "unifilar").allowed, false);
  await prisma.user.update({ where: { id }, data: { status: "suspended" } });
  eq((await call("GET", "/api/auth/me", undefined, token)).status, 403);
  console.log(
    `PASS: ${assertions} API integration assertions (real MySQL; Stripe mocked, no charges).`,
  );
} finally {
  await prisma.stripeEvent.deleteMany({ where: { id: { in: eventIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  await app.close();
  await prisma.$disconnect();
}
