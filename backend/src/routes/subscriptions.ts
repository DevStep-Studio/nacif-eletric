import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { serializeUser } from "../lib/serializers.js";
import { env } from "../config/env.js";
import {
  stripe,
  isStripeConfigured,
  STRIPE_PRICES,
  getOrCreateStripeCustomer,
} from "../lib/stripe.js";
import { COMMERCIAL_PLANS, LEGACY_PLANS } from "../lib/planCatalog.js";
import {
  effectivePlanCode,
  getServerPlan,
  getCurrentUsagePeriod,
  isServerAdmin,
} from "../lib/planGovernance.js";

const changeSchema = z.object({
  planCode: z.enum(["estudante", "eletrico", "solar", "completo"]),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});
const permissions = (user: {
  customPermissions: unknown;
}): Record<string, any> =>
  (user.customPermissions as Record<string, any>) || {};
const requireStripe = () => {
  if (!isStripeConfigured)
    throw new AppError("Stripe não configurada no servidor.", 503);
};
const getUser = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.isDeleted || user.status !== "active")
    throw new AppError("Conta indisponível.", 403);
  return user;
};
const priceFor = (plan: string, cycle: string) => {
  const prices = STRIPE_PRICES[plan as keyof typeof STRIPE_PRICES] as
    | Record<string, string>
    | undefined;
  const price = prices?.[cycle];
  if (!price || !/^price_[A-Za-z0-9]+$/.test(price))
    throw new AppError("Preço não configurado no servidor.", 503);
  return price;
};
const planFromPrice = (price: string) => {
  for (const [plan, cycles] of Object.entries(STRIPE_PRICES)) {
    for (const [cycle, configured] of Object.entries(cycles))
      if (price === configured) return { plan, cycle };
  }
  throw new AppError(
    "Preço da assinatura não pertence ao catálogo configurado.",
    400,
  );
};
const subscriptionPatch = (sub: Stripe.Subscription) => {
  const { plan, cycle } = planFromPrice(sub.items.data[0]?.price.id || "");
  const active = sub.status === "active" || sub.status === "trialing";
  return {
    plan: active ? plan : "gratuito",
    details: {
      billingProvider: "stripe",
      stripeCustomerId:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status === "canceled" ? "cancelled" : sub.status,
      subscriptionCycle: cycle,
      subscriptionStartDate: new Date(
        sub.current_period_start * 1000,
      ).toISOString(),
      subscriptionRenewalDate: new Date(
        sub.current_period_end * 1000,
      ).toISOString(),
      autoRenew: !sub.cancel_at_period_end,
    },
  };
};
const saveSubscription = async (id: string, sub: Stripe.Subscription) => {
  const user = await getUser(id);
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  if (permissions(user).stripeCustomerId !== customerId)
    throw new AppError("Assinatura pertence a outra conta.", 403);
  const patch = subscriptionPatch(sub);
  return prisma.user.update({
    where: { id },
    data: {
      plan: patch.plan as any,
      customPermissions: { ...permissions(user), ...patch.details },
    },
  });
};

export const registerSubscriptionRoutes = async (app: FastifyInstance) => {
  const auth = { preHandler: [app.authenticate] };
  const admin = { preHandler: [app.requireAdmin] };
  app.get("/api/subscriptions/plans", async () => ({
    plans: [
      ...LEGACY_PLANS.filter((p) => p.code === "free"),
      ...COMMERCIAL_PLANS,
    ].map((p) => ({
      ...p,
      limits: Object.fromEntries(
        Object.entries(p.limits).map(([k, v]) => [
          k,
          v === Infinity ? null : v,
        ]),
      ),
    })),
  }));

  const checkout = async (request: any) => {
    requireStripe();
    const { planCode, cycle } = changeSchema.parse(request.body);
    if (planCode === "estudante" && cycle !== "monthly")
      throw new AppError(
        "Plano Estudante permite apenas cobrança mensal.",
        400,
      );
    const user = await getUser(request.authUser.id);
    const current = permissions(user);
    if (
      current.stripeSubscriptionId &&
      ["active", "trialing", "past_due"].includes(current.subscriptionStatus)
    ) {
      const session = await stripe.billingPortal.sessions.create({
        customer: current.stripeCustomerId,
        return_url: `${env.FRONTEND_URL}/subscription?portal_return=true`,
      });
      return { url: session.url };
    }
    if (planCode === "estudante" && (current.academicStatus !== "approved" || current.academicValidUntil && Date.parse(current.academicValidUntil) <= Date.now()))
      throw new AppError(
        "A contratação acadêmica exige comprovante aprovado.",
        403,
      );
    const customer = await getOrCreateStripeCustomer(user);
    await prisma.user.update({
      where: { id: user.id },
      data: { customPermissions: { ...current, stripeCustomerId: customer } },
    });
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer,
        client_reference_id: user.id,
        line_items: [{ price: priceFor(planCode, cycle), quantity: 1 }],
        metadata: { userId: user.id, planCode, cycle },
        subscription_data: { metadata: { userId: user.id, planCode, cycle } },
        success_url: `${env.FRONTEND_URL}/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.FRONTEND_URL}/subscription?checkout=cancelled`,
      },
      {
        idempotencyKey: `checkout:${user.id}:${planCode}:${cycle}:${Math.floor(Date.now() / 300000)}`,
      },
    );
    return { url: session.url, sessionId: session.id };
  };
  const portal = async (request: any) => {
    requireStripe();
    const user = await getUser(request.authUser.id);
    const customer = permissions(user).stripeCustomerId;
    if (!customer)
      throw new AppError("Conta ainda não possui assinatura Stripe.", 404);
    return stripe.billingPortal.sessions.create({
      customer,
      return_url: `${env.FRONTEND_URL}/subscription?portal_return=true`,
    });
  };
  const verify = async (request: any) => {
    requireStripe();
    const { sessionId } = z
      .object({ sessionId: z.string().min(1) })
      .parse(request.body);
    const user = await getUser(request.authUser.id);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
    const customer =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;
    if (
      session.client_reference_id !== user.id ||
      customer !== permissions(user).stripeCustomerId
    )
      throw new AppError("Sessão pertence a outra conta.", 403);
    const sub = session.subscription as Stripe.Subscription | null;
    const paid =
      session.payment_status === "paid" &&
      !!sub &&
      ["active", "trialing"].includes(sub.status);
    if (paid) await saveSubscription(user.id, sub!);
    return {
      success: paid,
      paid,
      ...(paid ? subscriptionPatch(sub!).details : {}),
      plan: paid ? subscriptionPatch(sub!).plan : null,
    };
  };
  const sync = async (request: any) => {
    requireStripe();
    const user = await getUser(request.authUser.id);
    const id = permissions(user).stripeSubscriptionId;
    if (!id) return { synced: false, hasActiveSubscription: false };
    const sub = await stripe.subscriptions.retrieve(id);
    const updated = await saveSubscription(user.id, sub);
    return {
      synced: true,
      hasActiveSubscription: updated.plan !== "gratuito",
      plan: updated.plan,
      ...subscriptionPatch(sub).details,
    };
  };
  for (const [suffix, handler] of [
    ["create-checkout-session", checkout],
    ["create-portal-session", portal],
    ["verify-checkout-session", verify],
    ["sync-stripe-subscription", sync],
  ] as const) {
    for (const path of [
      `/${suffix}`,
      `/api/${suffix}`,
      `/api/subscriptions/${suffix === "sync-stripe-subscription" ? "sync-stripe" : suffix}`,
    ])
      app.post(path, auth, handler);
  }
  app.post("/api/subscriptions/change-plan", auth, checkout);
  app.post("/api/subscriptions/cancel", auth, async (request) => {
    requireStripe();
    const user = await getUser(request.authUser.id);
    const id = permissions(user).stripeSubscriptionId;
    if (!id) throw new AppError("Nenhuma assinatura ativa.", 404);
    const existing = await stripe.subscriptions.retrieve(id);
    const customer =
      typeof existing.customer === "string"
        ? existing.customer
        : existing.customer.id;
    if (customer !== permissions(user).stripeCustomerId)
      throw new AppError("Assinatura pertence a outra conta.", 403);
    const sub = await stripe.subscriptions.update(id, {
      cancel_at_period_end: true,
    });
    return serializeUser(await saveSubscription(user.id, sub));
  });
  app.get("/api/subscriptions/status", auth, async (request) => {
    const user = await getUser(request.authUser.id);
    const p = permissions(user);
    const period = getCurrentUsagePeriod();
    return {
      ...serializeUser(user),
      plan: effectivePlanCode(user),
      status: p.subscriptionStatus || "active",
      cycle: p.subscriptionCycle || "monthly",
      startDate: p.subscriptionStartDate || null,
      academicStatus: p.academicStatus || "not_submitted",
      academicInstitution: p.academicInstitution || "",
      academicCourse: p.academicCourse || "",
      modules: [...COMMERCIAL_PLANS, ...LEGACY_PLANS].find(plan => plan.code === effectivePlanCode(user) || plan.legacyCodes?.includes(effectivePlanCode(user)))?.modules || {},
      renewalDate: p.subscriptionRenewalDate || null,
      validUntil: p.subscriptionRenewalDate || null,
      autoRenew: p.autoRenew ?? false,
      limits: JSON.parse(
        JSON.stringify(getServerPlan(effectivePlanCode(user))),
      ),
      usage: {
        projects: await prisma.project.count({
          where: { createdById: user.id },
        }),
        exports: p.usagePeriod === period ? p.monthlyExports || 0 : 0,
        aiScans: p.usagePeriod === period ? p.monthlyAiScans || 0 : 0,
        storageMb: p.storageUsedMb || 0,
        teamMembers: (p.teamMembers || []).length + 1,
      },
    };
  });
  app.post("/api/subscriptions/consume-export", auth, async (request) => {
    const { projectId } = z
      .object({ projectId: z.string().nullable().optional() })
      .parse(request.body || {});
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${request.authUser.id} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({
        where: { id: request.authUser.id },
      });
      if (
        projectId &&
        !(await tx.project.findFirst({
          where: { id: projectId, createdById: user.id },
        }))
      )
        throw new AppError("Projeto não encontrado.", 404);
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
    throw new AppError("Planos pagos são gerenciados pela Stripe.", 403);
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
  const webhook = async (request: any, reply: any) => {
    if (!env.STRIPE_WEBHOOK_SECRET || !isStripeConfigured)
      throw new AppError("Webhook Stripe não configurado.", 503);
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        request.headers["stripe-signature"],
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new AppError("Assinatura do webhook inválida.", 400);
    }
    if (await prisma.stripeEvent.findUnique({ where: { id: event.id } }))
      return { received: true };
    let sub: Stripe.Subscription | undefined;
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" && session.subscription)
        sub = await stripe.subscriptions.retrieve(
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id,
        );
    } else if (event.type.startsWith("customer.subscription.")) {
      // Read current state to tolerate out-of-order deliveries.
      sub = await stripe.subscriptions.retrieve(
        (event.data.object as Stripe.Subscription).id,
      );
    } else if (
      ["invoice.paid", "invoice.payment_failed"].includes(event.type)
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription)
        sub = await stripe.subscriptions.retrieve(
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription.id,
        );
    }
    try {
      await prisma.$transaction(async (tx) => {
        if (sub) {
          const customer =
            typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          const candidates = await tx.user.findMany({
            where: {
              isDeleted: false,
              customPermissions: {
                path: "$.stripeCustomerId",
                equals: customer,
              },
            },
          });
          const user = candidates.find(
            (u) => !sub!.metadata.userId || u.id === sub!.metadata.userId,
          );
          if (!user)
            throw new AppError(
              "Usuário da assinatura não encontrado; reenvio necessário.",
              503,
            );
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
          const fresh = await tx.user.findUniqueOrThrow({
            where: { id: user.id },
          });
          const current = permissions(fresh);
          if (
            current.stripeSubscriptionId &&
            current.stripeSubscriptionId !== sub.id &&
            !["canceled", "cancelled", "incomplete_expired"].includes(
              current.subscriptionStatus,
            )
          ) {
            await tx.stripeEvent.create({
              data: { id: event.id, type: event.type },
            });
            return;
          }
          const patch = subscriptionPatch(sub);
          await tx.user.update({
            where: { id: user.id },
            data: {
              plan: patch.plan as any,
              customPermissions: { ...permissions(fresh), ...patch.details },
            },
          });
        }
        await tx.stripeEvent.create({
          data: { id: event.id, type: event.type },
        });
      });
    } catch (error: any) {
      if (error.code !== "P2002") throw error;
    }
    return reply.send({ received: true });
  };
  for (const path of ["/webhook", "/api/webhook", "/api/subscriptions/webhook"])
    app.post(path, webhook);
};
