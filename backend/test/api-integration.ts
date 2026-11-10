import assert from "node:assert/strict";

// This suite only runs against an explicitly selected disposable database.
assert.match(
  process.env.DATABASE_URL || "",
  /\/[^/?]*_test(?:\?|$)/,
  "Use a disposable DATABASE_URL ending in _test",
);
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-only-secret-minimum-32-characters";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.UPLOAD_DIR = "/tmp/nacif-integration-uploads";
const { buildApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { effectivePlanCode, checkServerModuleAccess } = await import(
  "../src/lib/planGovernance.js"
);
const { normalizeAccountStatus, assertAccountAvailable } = await import(
  "../src/lib/accountAccess.js"
);
const app = await buildApp();
const createdIds: string[] = [];
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
  for (const [input, expected] of [
    [null, "active"],
    [" AtIvA ", "active"],
    ["SUSPENSO", "suspended"],
    ["BLOQUEADA", "suspended"],
    ["INATIVO", "inactive"],
    ["EXCLUÍDA", "deleted"],
  ])
    eq(normalizeAccountStatus(input), expected);
  assert.throws(() => assertAccountAvailable({ status: "suspenso" }), {
    statusCode: 403,
    message: "Sua conta está suspensa. Entre em contato com o administrador.",
  });
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
  for (let i = 0; i < 3; i++)
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
    3,
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
  eq(concurrent.filter((r) => r.body.allowed).length, 3);
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
  eq(projectRace.filter((r) => r.status === 200).length, 0);
  eq(projectRace.filter((r) => r.status === 403).length, 5);
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
  await prisma.user.update({
    where: { id: other.id },
    data: { role: "super_admin" },
  });
  for (const role of ["user", "admin", "super_admin"] as const) {
    await prisma.user.update({ where: { id: other.id }, data: { role } });
    eq((await call("GET", "/api/projects", undefined, otherToken)).body.length, 0);
    for (const [method, url, payload] of [
      ["GET", `/api/projects/${projectId}`, undefined],
      ["GET", `/api/projects/${projectId}/revisions`, undefined],
      ["PATCH", `/api/projects/${projectId}`, { name: "Foreign edit" }],
      ["POST", `/api/projects/${projectId}/duplicate`, {}],
      ["DELETE", `/api/projects/${projectId}`, undefined],
    ] as const) eq((await call(method, url, payload, otherToken)).status, 403);
    eq((await call("POST", "/api/subscriptions/consume-export", { projectId }, otherToken)).status, 404);
  }
  const auditId = `audit-integration-${Date.now()}`;
  await prisma.auditLog.create({
    data: {
      id: auditId,
      actorId: id,
      actorName: "Actor",
      actorEmail: email,
      actorRole: "user",
      action: "INTEGRATION",
      targetType: "user",
      details: "Test",
    },
  });
  try {
    const logs = await call(
      "GET",
      "/api/super-admin/audit-logs",
      undefined,
      otherToken,
    );
    eq(logs.status, 200);
    eq(logs.body.find((log: any) => log.id === auditId).actor_name, "Actor");
    const findAuditLogs = prisma.auditLog.findMany;
    try {
      (prisma.auditLog as any).findMany = async () => {
        throw Object.assign(new Error("Missing table"), { code: "P2021" });
      };
      const missingAudit = await call(
        "GET",
        "/api/super-admin/audit-logs",
        undefined,
        otherToken,
      );
      eq(missingAudit.status, 503);
      eq(missingAudit.body.code, "DATABASE_SCHEMA_OUTDATED");
      eq(
        (await call("GET", "/api/super-admin/settings", undefined, otherToken))
          .status,
        200,
      );
    } finally {
      (prisma.auditLog as any).findMany = findAuditLogs;
    }
  } finally {
    await prisma.auditLog.delete({ where: { id: auditId } });
    await prisma.user.update({
      where: { id: other.id },
      data: { role: "user" },
    });
  }
  // The financial lifecycle is covered by test/asaas-billing.ts without live charges.
  eq(
    effectivePlanCode({
      plan: "completo",
      customPermissions: {
        billingProvider: "asaas",
        subscriptionRenewalDate: "2020-01-01",
      },
    }),
    "gratuito",
  );
  eq(checkServerModuleAccess({ plan: "gratuito" }, "solar").allowed, false);
  eq(checkServerModuleAccess({ plan: "solar" }, "solar").allowed, false);
  // Exercise actual paid entitlements through HTTP and MySQL row locks.
  const { env } = await import("../src/config/env.js");
  const paidPermissions = (planCode: string) => ({
    billingProvider: "asaas", billingEnvironment: env.ASAAS_ENVIRONMENT,
    billingEntitlements: [{ planCode, start: new Date(Date.now()-86400000).toISOString(), end: new Date(Date.now()+86400000).toISOString() }],
    usagePeriod: new Date().toISOString().slice(0,7), monthlyExports: 99, monthlyAiScans: 100,
  });
  await prisma.user.update({ where: { id }, data: { customPermissions: paidPermissions("solar") } });
  const solar = await call("POST", "/api/projects", { name: "Paid solar", project_type: "Solar" }, token);
  eq(solar.status, 200);
  eq((await call("POST", "/api/subscriptions/consume-export", { moduleKey: "panel" }, token)).status, 403);
  const paidRace = await Promise.all(Array.from({ length: 6 }, () => call("POST", "/api/subscriptions/consume-export", { moduleKey: "solar", projectId: solar.body.id }, token)));
  eq(paidRace.filter(result => result.body.allowed === true).length, 1);
  eq((await call("POST", "/api/ai/invoke", { prompt: "Should never reach the provider" }, token)).status, 403);
  for (let n=0; n<2; n++) eq((await call("POST", "/api/subscriptions/invite-member", { email: `member${n}@example.com` }, token)).status, 200);
  eq((await call("POST", "/api/subscriptions/invite-member", { email: "overflow@example.com" }, token)).status, 403);
  await prisma.user.update({ where: { id }, data: { customPermissions: paidPermissions("eletrico") } });
  eq((await call("PATCH", `/api/projects/${solar.body.id}`, { name: "Forbidden solar edit" }, token)).status, 403);
  eq((await call("POST", "/api/subscriptions/consume-export", { moduleKey: "budget", projectId: solar.body.id }, token)).status, 403);
  eq((await call("GET", `/api/projects/${solar.body.id}`, undefined, token)).status, 200);
  await prisma.user.update({ where: { id }, data: { status: "suspended" } });
  eq((await call("GET", "/api/auth/me", undefined, token)).status, 403);
  console.log(
    `PASS: ${assertions} API integration assertions (real MySQL; no live charges; billing has a separate Asaas simulator).`,
  );
} finally {
  await prisma.billingAccount.deleteMany({ where: { userId: { in: createdIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  await app.close();
  await prisma.$disconnect();
}
