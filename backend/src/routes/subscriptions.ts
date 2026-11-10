import { assertAccountAvailable } from "../lib/accountAccess.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { serializeUser } from "../lib/serializers.js";
import { projectStorageMb } from "../lib/planStorage.js";
import { env } from "../config/env.js";
import { COMMERCIAL_PLANS, LEGACY_PLANS } from "../lib/planCatalog.js";
import { effectivePlanCode, getServerPlan, getCurrentUsagePeriod, isServerAdmin, checkServerModuleAccess, projectModule } from "../lib/planGovernance.js";
import { asaasRequest, validateAsaasWebhook } from "../lib/asaas.js";
import { checkoutSchema, changeSchema, withBillingAccount, startCheckout,
  reconcileSubscription, cancelSubscription, changeSubscription, billingDetails, permissionData as permissions } from "../lib/asaasBilling.js";

const getUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  assertAccountAvailable(user);
  return user;
};
export const registerSubscriptionRoutes = async (app: FastifyInstance) => {
  const auth = { preHandler: [app.authenticate] };
  const admin = { preHandler: [app.requireAdmin] };
  app.get("/api/subscriptions/plans", async () => ({
    plans: [...LEGACY_PLANS.filter(p => p.code === "free"), ...COMMERCIAL_PLANS].map(p => ({
      ...p, limits: Object.fromEntries(Object.entries(p.limits).map(([k,v]) => [k, v === Infinity ? null : v])),
    })),
  }));
  app.post("/api/subscriptions/create-checkout-session", auth, async request => {
    const input = checkoutSchema.parse(request.body);
    return withBillingAccount(request.authUser.id, account => startCheckout(account, input));
  });
  app.post("/api/subscriptions/change-plan", auth, async request => {
    const input = changeSchema.parse(request.body);
    return withBillingAccount(request.authUser.id, account => changeSubscription(account, input));
  });
  app.post("/api/subscriptions/cancel", auth, async request => {
    const { reason } = z.object({ reason: z.string().max(500).default("") }).parse(request.body || {});
    await withBillingAccount(request.authUser.id, account => cancelSubscription(account, reason));
    return serializeUser(await getUser(request.authUser.id));
  });
  app.get("/api/subscriptions/billing", auth, request => billingDetails(request.authUser.id));
  app.post("/api/subscriptions/sync", auth, async request => {
    await withBillingAccount(request.authUser.id, async account => {
      const records = await prisma.billingSubscription.findMany({ where: { accountId: account.id, status: { not: "failed" } } });
      for (const local of records) await reconcileSubscription(account, local);
    });
    return { user: serializeUser(await getUser(request.authUser.id)), ...await billingDetails(request.authUser.id) };
  });
  app.post("/api/subscriptions/verify-checkout-session", auth, async request => {
    const { subscriptionId } = z.object({ subscriptionId: z.string().min(1) }).parse(request.body);
    const local = await prisma.billingSubscription.findUnique({ where: { id: subscriptionId } });
    const account = local && await prisma.billingAccount.findUnique({ where: { id: local.accountId } });
    if (!local || !account || account.userId !== request.authUser.id || account.environment !== env.ASAAS_ENVIRONMENT)
      throw new AppError("Contratação não encontrada para esta conta.", 404);
    await withBillingAccount(request.authUser.id, account => reconcileSubscription(account, local));
    const paid = Boolean(await prisma.billingPayment.findFirst({ where: { subscriptionId: local.id,
      status: { in: ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"] }, periodStart: { lte: new Date() }, periodEnd: { gt: new Date() } } }));
    return { paid, user: serializeUser(await getUser(request.authUser.id)) };
  });
  app.get("/api/subscriptions/status", auth, async (request) => {
    const user = await getUser(request.authUser.id);
    const serialized = serializeUser(user);
    const p: Record<string, any> = { ...permissions(user), subscriptionStatus: serialized.subscription_status, subscriptionCycle: serialized.subscription_cycle, subscriptionStartDate: serialized.subscription_start_date, subscriptionRenewalDate: serialized.subscription_valid_until };
    const period = getCurrentUsagePeriod();
    return {
      ...serializeUser(user),
      billing: await billingDetails(user.id),
      plan: serialized.plan,
      status: serialized.subscription_status,
      cycle: serialized.subscription_cycle,
      startDate: p.subscriptionStartDate || null,
      academicStatus: p.academicStatus || "not_submitted",
      academicInstitution: p.academicInstitution || "",
      academicCourse: p.academicCourse || "",
      modules: [...COMMERCIAL_PLANS, ...LEGACY_PLANS].find(plan => plan.code === effectivePlanCode(user) || plan.legacyCodes?.includes(effectivePlanCode(user)))?.modules || {},
      renewalDate: p.subscriptionRenewalDate || null,
      validUntil: p.subscriptionRenewalDate || null,
      autoRenew: serialized.subscription_auto_renew ?? false,
      limits: JSON.parse(
        JSON.stringify(getServerPlan(effectivePlanCode(user))),
      ),
      usage: {
        projects: await prisma.project.count({
          where: { createdById: user.id },
        }),
        exports: p.usagePeriod === period ? p.monthlyExports || 0 : 0,
        aiScans: p.usagePeriod === period ? p.monthlyAiScans || 0 : 0,
        storageMb: Number(p.storageUsedMb || 0) + await projectStorageMb(prisma, user.id),
        teamMembers: (p.teamMembers || []).length + 1,
      },
    };
  });
  app.post("/api/subscriptions/consume-export", auth, async (request) => {
    const { projectId, moduleKey } = z
      .object({ projectId: z.string().nullable().optional(), moduleKey: z.enum(["plant", "panel", "unifilar", "solar", "budget", "calculator", "nbr_library"]).optional() })
      .parse(request.body || {});
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${request.authUser.id} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({
        where: { id: request.authUser.id },
      });
      const project = projectId ? await tx.project.findFirst({ where: { id: projectId, createdById: user.id } }) : null;
      if (projectId && !project) throw new AppError("Projeto não encontrado.", 404);
      for (const key of new Set([moduleKey || (project ? projectModule(project.projectType) : "budget"), ...(project ? [projectModule(project.projectType)] : [])])) {
        const access = checkServerModuleAccess(user, key);
        if (!access.allowed) throw new AppError(access.message || "Exportação não incluída no plano.", 403);
      }
      const p = permissions(user),
        period = getCurrentUsagePeriod(),
        plan = getServerPlan(effectivePlanCode(user));
      const count =
        p.usagePeriod === period ? Number(p.monthlyExports || 0) : 0;
      if (!isServerAdmin(user) && count >= plan.exports)
        return {
          allowed: false,
          remaining: 0,
          reason: "Limite mensal de exportações atingido.",
        };
      await tx.user.update({
        where: { id: user.id },
        data: {
          customPermissions: {
            ...p,
            usagePeriod: period,
            monthlyExports: count + 1,
            monthlyAiScans:
              p.usagePeriod === period ? p.monthlyAiScans || 0 : 0,
          },
        },
      });
      return {
        allowed: true,
        limit: plan.exports === Infinity ? null : plan.exports,
        currentUsage: count + 1,
        remaining: plan.exports === Infinity ? null : plan.exports - count - 1,
        planCode: effectivePlanCode(user),
        isAcademic: !!plan.isAcademic,
        isFreeRestricted: effectivePlanCode(user) === "gratuito",
        watermark: plan.isAcademic
          ? "Versão Acadêmica — Uso Educacional"
          : effectivePlanCode(user) === "gratuito"
            ? "Versão de Avaliação Gratuita"
            : null,
      };
    });
  });
  app.get("/api/subscriptions/team-members", auth, async (request) => {
    const user = await getUser(request.authUser.id),
      p = permissions(user);
    return {
      members: p.teamMembers || [],
      limit: getServerPlan(effectivePlanCode(user)).teamMembers,
      currentCount: (p.teamMembers || []).length + 1,
    };
  });
  app.post("/api/subscriptions/invite-member", auth, async (request) => {
    const member = z
      .object({
        email: z.email(),
        name: z.string().optional(),
        role: z
          .enum([
            "member",
            "admin",
            "viewer",
            "membro",
            "administrador",
            "visualizador",
          ])
          .default("member"),
      })
      .parse(request.body);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${request.authUser.id} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({
        where: { id: request.authUser.id },
      });
      const access = checkServerModuleAccess(user, "team");
      if (!access.allowed) throw new AppError(access.message || "Seu plano não inclui equipes.", 403);
      const p = permissions(user),
        members = p.teamMembers || [];
      if (
        members.length + 1 >=
        getServerPlan(effectivePlanCode(user)).teamMembers
      )
        throw new AppError("Limite de membros atingido.", 403);
      if (
        member.email.toLowerCase() === user.email ||
        members.some((m: any) => m.email === member.email.toLowerCase())
      )
        throw new AppError("Membro já cadastrado.", 409);
      const result = {
        ...member,
        email: member.email.toLowerCase(),
        id: crypto.randomUUID(),
        status: "pending",
        invited_at: new Date().toISOString(),
      };
      await tx.user.update({
        where: { id: user.id },
        data: {
          customPermissions: { ...p, teamMembers: [...members, result] },
        },
      });
      return result;
    });
  });
  app.delete("/api/subscriptions/remove-member/:id", auth, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const user = await getUser(request.authUser.id),
      p = permissions(user);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        customPermissions: {
          ...p,
          teamMembers: (p.teamMembers || []).filter((m: any) => m.id !== id),
        },
      },
    });
    return { ok: true };
  });
  app.post("/api/subscriptions/academic-verify", auth, async (request) => {
    const data = z
      .object({
        institution: z.string().trim().min(2),
        course: z.string().trim().min(2),
        documentName: z.string().optional(),
        documentUrl: z.string().min(1),
      })
      .parse(request.body);
    const user = await getUser(request.authUser.id);
    return serializeUser(
      await prisma.user.update({
        where: { id: user.id },
        data: {
          customPermissions: {
            ...permissions(user),
            academicStatus: "pending_review",
            academicInstitution: data.institution,
            academicCourse: data.course,
            academicDocumentUrl: data.documentUrl,
            academicDocumentName: data.documentName || "",
          },
        },
      }),
    );
  });
  app.get("/api/subscriptions/admin/users", admin, async () =>
    (await prisma.user.findMany()).map(serializeUser),
  );
  app.patch("/api/subscriptions/admin/users/:id/plan", admin, async () => {
    throw new AppError("Planos pagos são gerenciados pelo Asaas.", 403);
  });
  app.post(
    "/api/subscriptions/admin/academic/:id/decide",
    admin,
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const { decision } = z
        .object({ decision: z.enum(["approve", "reject"]) })
        .parse(request.body);
      const user = await getUser(id);
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 6);
      return serializeUser(
        await prisma.user.update({
          where: { id },
          data: {
            customPermissions: {
              ...permissions(user),
              academicStatus: decision === "approve" ? "approved" : "rejected",
              academicValidUntil: decision === "approve" ? validUntil.toISOString() : null,
              academicReviewedAt: new Date().toISOString(),
            },
          },
        }),
      );
    },
  );
  app.post("/api/subscriptions/webhook/asaas", async request => {
    validateAsaasWebhook(request.headers["asaas-access-token"]);
    const event = z.object({ id: z.string().min(1).max(160), event: z.string().min(1),
      payment: z.object({ id: z.string(), subscription: z.string().optional() }).passthrough().optional(),
      subscription: z.object({ id: z.string(), externalReference: z.string().optional() }).passthrough().optional(),
    }).passthrough().parse(request.body);
    const eventId = `${env.ASAAS_ENVIRONMENT}:${event.id}`;
    if (await prisma.billingEvent.findUnique({ where: { id: eventId } })) return { received: true };
    const remoteId = event.payment?.subscription || event.subscription?.id;
    if (!remoteId || !/^(PAYMENT_|SUBSCRIPTION_)/.test(event.event)) return { received: true };
    // Look up by remote ID first; externalReference recovers the creation/webhook race.
    let candidates = await prisma.billingSubscription.findMany({ where: { remoteId } });
    if (!candidates.length) {
      const remote = await asaasRequest(`/subscriptions/${encodeURIComponent(remoteId)}`);
      if (remote.externalReference) {
        const intent = await prisma.billingSubscription.findUnique({ where: { id: remote.externalReference } });
        if (intent) candidates = [intent];
      }
    }
    for (const local of candidates) {
      const account = await prisma.billingAccount.findUnique({ where: { id: local.accountId } });
      if (!account || account.environment !== env.ASAAS_ENVIRONMENT) continue;
      await withBillingAccount(account.userId, account => reconcileSubscription(account, local, event), true);
      return { received: true };
    }
    // Other sales made directly in the merchant's Asaas account are unrelated to this app.
    return { received: true };
  });
};
