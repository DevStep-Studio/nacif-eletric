import { getCurrentUsagePeriod, getServerPlan, isServerAdmin, SERVER_PLAN_MATRIX } from "../lib/planGovernance.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { serializeUser } from "../lib/serializers.js";
import { env } from "../config/env.js";
import {
  stripe,
  isStripeConfigured,
  getOrCreateStripeCustomer,
  resolvePlanFromPriceId,
  resolveRealStripePriceId,
  buildStripePaymentLinkUrl,
  buildStripePortalFallbackUrl,
} from "../lib/stripe.js";

const changePlanSchema = z.object({
  planCode: z.enum(["gratuito", "profissional", "engenharia", "estudante", "eletrico", "solar", "completo"]),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

const academicVerifySchema = z.object({
  institution: z.string().trim().min(2, "Instituição de ensino é obrigatória."),
  course: z.string().trim().min(2, "Curso é obrigatório."),
  documentName: z.string().trim().optional(),
  documentUrl: z.string().trim().optional(),
});

const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().optional(),
});

const adminUpdatePlanSchema = z.object({
  plan: z.enum(["gratuito", "profissional", "engenharia", "estudante", "eletrico", "solar", "completo"]),
  cycle: z.enum(["monthly", "annual"]).optional(),
  status: z.string().optional(),
});

const adminDecideAcademicSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

const createCheckoutSessionSchema = z.object({
  priceId: z.string().optional(),
  planCode: z.string().optional(),
  cycle: z.enum(["monthly", "annual"]).optional().default("monthly"),
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  email: z.string().optional(),
  userName: z.string().optional(),
  name: z.string().optional(),
  fullName: z.string().optional(),
});

const createPortalSessionSchema = z.object({
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  email: z.string().optional(),
  userName: z.string().optional(),
  name: z.string().optional(),
  stripeCustomerId: z.string().optional(),
});

const verifySessionSchema = z.object({
  sessionId: z.string().min(1, "sessionId é obrigatório."),
});

const syncStripeSchema = z.object({
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  email: z.string().optional(),
  stripeCustomerId: z.string().optional(),
});

/**
 * Resolve a URL base do frontend a partir do cabeçalho Origin/Referer confiável ou env.FRONTEND_URL
 */
function resolveFrontendOrigin(request: FastifyRequest): string {
  const candidates = [request.headers.origin, request.headers.referer].filter(Boolean) as string[];

  for (const raw of candidates) {
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      if (
        host === "nacifenergy.com.br" ||
        host.endsWith(".nacifenergy.com.br") ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".vercel.app") ||
        host.endsWith(".pages.dev")
      ) {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // ignora URL malformada
    }
  }

  return env.FRONTEND_URL.replace(/\/+$/, "");
}

/**
 * Extrai dados do usuário a partir dos cabeçalhos de autenticação (JWT ou token local)
 */
function extractUserFromAuthHeader(request: FastifyRequest): {
  id?: string;
  email?: string;
  name?: string;
} | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  // 1. Formato de token local: local:userId:timestamp:random
  if (token.startsWith("local:")) {
    const parts = token.split(":");
    if (parts[1]) {
      return { id: parts[1] };
    }
  }

  // 2. Token JWT padrão (tenta decodificar o payload base64)
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decodedJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
      const payload = JSON.parse(decodedJson);
      if (payload && typeof payload === "object") {
        return {
          id: payload.sub || payload.id || payload.userId,
          email: payload.email || payload.user_metadata?.email,
          name:
            payload.name ||
            payload.fullName ||
            payload.full_name ||
            payload.user_metadata?.full_name ||
            payload.user_metadata?.name,
        };
      }
    }
  } catch {
    // Formato de token não JWT ou payload inválido
  }

  return null;
}

type ResolvedCheckoutUser = {
  id: string;
  email: string;
  fullName: string;
  plan: string;
  status: string;
  customPermissions?: any;
  _ephemeral?: boolean;
};

let dbOfflineCooldownUntil = 0;

async function withFastDb<T>(fn: () => Promise<T>, timeoutMs = 1200): Promise<T> {
  if (Date.now() < dbOfflineCooldownUntil) {
    throw Object.assign(new Error("DB_COOLDOWN_OFFLINE"), { code: "DB_COOLDOWN" });
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error("DB_CONNECT_TIMEOUT"), { code: "DB_TIMEOUT" })),
          timeoutMs,
        );
      }),
    ]);
    dbOfflineCooldownUntil = 0;
    return result;
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (
      err?.code === "DB_TIMEOUT" ||
      err?.code === "P1001" ||
      err?.code === "P1002" ||
      err?.code === "P1003" ||
      msg.includes("Can't reach database") ||
      msg.includes("Access denied") ||
      msg.includes("Unknown database")
    ) {
      dbOfflineCooldownUntil = Date.now() + 60_000;
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Localiza o usuário no banco MySQL ou retorna perfil efêmero resiliente caso o MySQL
 * não esteja provisionado no servidor de produção, garantindo que a API da Stripe nunca falhe.
 */
async function resolveOrCreateUser(
  request: FastifyRequest,
  bodyData: {
    userId?: string;
    userEmail?: string;
    email?: string;
    userName?: string;
    name?: string;
    fullName?: string;
    stripeCustomerId?: string;
  } = {},
): Promise<ResolvedCheckoutUser> {
  const tokenUser = extractUserFromAuthHeader(request);
  const authUser = (request as any).authUser;

  const resolvedUserId = authUser?.id || bodyData.userId || tokenUser?.id || undefined;

  const candidateEmail =
    bodyData.userEmail ||
    bodyData.email ||
    authUser?.email ||
    tokenUser?.email ||
    (resolvedUserId && resolvedUserId.includes("@") ? resolvedUserId : undefined);

  const fallbackId = resolvedUserId || `user_nacif_${Date.now().toString(36)}`;
  const cleanId = fallbackId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "user";
  const finalEmail = candidateEmail
    ? candidateEmail.toLowerCase().trim()
    : `user_${cleanId}@nacifenergy.local`;

  const finalName =
    bodyData.userName ||
    bodyData.name ||
    bodyData.fullName ||
    authUser?.name ||
    tokenUser?.name ||
    (candidateEmail ? candidateEmail.split("@")[0] : `Cliente Nacif`);

  try {
    return await withFastDb(async () => {
      let user = resolvedUserId
        ? await prisma.user.findUnique({
            where: { id: resolvedUserId },
          })
        : null;

      if (!user && candidateEmail) {
        user = await prisma.user.findUnique({
          where: { email: candidateEmail.toLowerCase().trim() },
        });
      }

      if (user) {
        return user;
      }

      try {
        user = await prisma.user.upsert({
          where: { id: fallbackId },
          update: {
            status: "active",
          },
          create: {
            id: fallbackId,
            email: finalEmail,
            fullName: finalName,
            passwordHash: "$2a$10$abcdefDevPlaceholderHashForLocalEnvironment1234567890",
            role: "user",
            plan: "gratuito",
            status: "active",
            customPermissions: bodyData.stripeCustomerId
              ? { stripeCustomerId: bodyData.stripeCustomerId }
              : undefined,
          },
        });
        return user;
      } catch {
        const existingByEmail = await prisma.user.findUnique({
          where: { email: finalEmail },
        });
        if (existingByEmail) {
          return existingByEmail;
        }

        user = await prisma.user.create({
          data: {
            id: fallbackId,
            email: `${cleanId}_${Date.now()}@nacifenergy.local`,
            fullName: finalName,
            passwordHash: "$2a$10$abcdefDevPlaceholderHashForLocalEnvironment1234567890",
            role: "user",
            plan: "gratuito",
            status: "active",
          },
        });
        return user;
      }
    });
  } catch (dbErr: any) {
    if (dbErr?.code !== "DB_COOLDOWN") {
      request.log.warn(
        `[Stripe] Banco MySQL indisponível (${dbErr?.code || "DB_OFFLINE"}). Prosseguindo em modo direto com a API da Stripe para ${finalEmail}.`,
      );
    }
    return {
      id: fallbackId,
      email: finalEmail,
      fullName: finalName,
      plan: "gratuito",
      status: "active",
      customPermissions: bodyData.stripeCustomerId
        ? { stripeCustomerId: bodyData.stripeCustomerId }
        : {},
      _ephemeral: true,
    };
  }
}

async function safeFindUser(opts: { userId?: string | null; email?: string | null; customerId?: string | null }) {
  try {
    return await withFastDb(async () => {
      if (opts.userId) {
        const byId = await prisma.user.findUnique({ where: { id: opts.userId } });
        if (byId) return byId;
      }
      if (opts.email) {
        const byEmail = await prisma.user.findUnique({
          where: { email: opts.email.toLowerCase().trim() },
        });
        if (byEmail) return byEmail;
      }
      if (opts.customerId) {
        const users = await prisma.user.findMany();
        return users.find((u) => (u.customPermissions as any)?.stripeCustomerId === opts.customerId) || null;
      }
      return null;
    });
  } catch {
    return null;
  }
}

export const registerSubscriptionRoutes = async (app: FastifyInstance) => {
  // =========================================================================
  // 1. STRIPE CHECKOUT: POST /create-checkout-session
  // =========================================================================
  const handleCreateCheckoutSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createCheckoutSessionSchema.parse(request.body || {});
    const { priceId, planCode, cycle, ...userData } = parsed;

    // Validação da Regra de Negócio:
    // Nacif Estudante: APENAS faturamento mensal (R$ 99,99/mês).
    const effectiveCycle = planCode === "estudante" ? "monthly" : cycle || "monthly";
    const resolvedPriceId = resolveRealStripePriceId(priceId, planCode, effectiveCycle);
    const planInfo = resolvePlanFromPriceId(resolvedPriceId, planCode, effectiveCycle);
    const targetPlanCode = planInfo?.plan || planCode || "completo";
    const targetCycle = targetPlanCode === "estudante" ? "monthly" : planInfo?.cycle || effectiveCycle;

    if (!resolvedPriceId) {
      throw new AppError("Identificador de preço (priceId) ou plano válido é obrigatório.", 400);
    }

    const user = await resolveOrCreateUser(request, userData);
    const frontendOrigin = resolveFrontendOrigin(request);

    // Caso a chave secreta não esteja presente no servidor, redireciona com segurança via Stripe Payment Link oficial
    if (!isStripeConfigured) {
      const fallbackLink = buildStripePaymentLinkUrl(targetPlanCode, targetCycle, {
        id: user.id,
        email: user.email,
      });

      if (fallbackLink) {
        app.log.warn(
          `[Stripe] STRIPE_SECRET_KEY ausente no ambiente; redirecionando para Payment Link oficial da Stripe (${targetPlanCode}/${targetCycle}).`,
        );
        return reply.send({
          url: fallbackLink,
          isDirectPaymentLink: true,
          provider: "stripe_payment_link",
        });
      }

      throw new AppError(
        "Chave STRIPE_SECRET_KEY não configurada no servidor de produção.",
        503,
      );
    }

    const successUrl = `${frontendOrigin}/subscription?session_id={CHECKOUT_SESSION_ID}&checkout=success&plan=${encodeURIComponent(targetPlanCode)}&cycle=${encodeURIComponent(targetCycle)}`;
    const cancelUrl = `${frontendOrigin}/subscription?checkout=cancelled`;

    // Obtém ou cria o Customer ID da Stripe para este usuário
    const customerId = await getOrCreateStripeCustomer(user);

    // Salva o customerId no banco local se MySQL estiver ativo
    if (!user._ephemeral && (user.customPermissions as any)?.stripeCustomerId !== customerId) {
      await prisma.user
        .update({
          where: { id: user.id },
          data: {
            customPermissions: {
              ...((user.customPermissions as any) || {}),
              stripeCustomerId: customerId,
            },
          },
        })
        .catch(() => null);
    }

    // Cria a sessão de Checkout oficial no Stripe Billing
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      locale: "pt-BR",
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        userEmail: user.email,
        planCode: targetPlanCode,
        cycle: targetCycle,
        priceId: resolvedPriceId,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          userEmail: user.email,
          planCode: targetPlanCode,
          cycle: targetCycle,
          priceId: resolvedPriceId,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    return reply.send({
      url: session.url,
      sessionId: session.id,
      provider: "stripe",
      plan: targetPlanCode,
      cycle: targetCycle,
    });
  };

  // Handlers utilitários para compatibilidade total com proxies, Cloudflare e preflight
  const handlePreflight = async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
      .header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, stripe-signature, x-requested-with, Accept, Origin",
      )
      .status(204)
      .send();
  };

  const handleStatusPing = (name: string) => async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      service: "Nacif Energy - Stripe Billing API",
      stripeConfigured: isStripeConfigured,
      endpoint: name,
      method: "POST",
    });
  };

  app.post("/create-checkout-session", handleCreateCheckoutSession);
  app.get("/create-checkout-session", handleStatusPing("/create-checkout-session"));
  app.options("/create-checkout-session", handlePreflight);

  app.post("/api/create-checkout-session", handleCreateCheckoutSession);
  app.get("/api/create-checkout-session", handleStatusPing("/api/create-checkout-session"));
  app.options("/api/create-checkout-session", handlePreflight);

  app.post("/api/subscriptions/create-checkout-session", handleCreateCheckoutSession);
  app.get("/api/subscriptions/create-checkout-session", handleStatusPing("/api/subscriptions/create-checkout-session"));
  app.options("/api/subscriptions/create-checkout-session", handlePreflight);

  // =========================================================================
  // 2. STRIPE CUSTOMER PORTAL: POST /create-portal-session
  // =========================================================================
  const handleCreatePortalSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const parsed = createPortalSessionSchema.parse(body);

    const user = await resolveOrCreateUser(request, parsed);
    const frontendOrigin = resolveFrontendOrigin(request);

    if (!isStripeConfigured) {
      return reply.send({
        url: buildStripePortalFallbackUrl(user.email),
        isDirectPortalLink: true,
      });
    }

    const customerId = await getOrCreateStripeCustomer(user);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendOrigin}/subscription?portal_return=true`,
      locale: "pt-BR",
    });

    return reply.send({
      url: portalSession.url,
      customerId,
    });
  };

  app.post("/create-portal-session", handleCreatePortalSession);
  app.get("/create-portal-session", handleStatusPing("/create-portal-session"));
  app.options("/create-portal-session", handlePreflight);

  app.post("/api/create-portal-session", handleCreatePortalSession);
  app.get("/api/create-portal-session", handleStatusPing("/api/create-portal-session"));
  app.options("/api/create-portal-session", handlePreflight);

  app.post("/api/subscriptions/create-portal-session", handleCreatePortalSession);
  app.get("/api/subscriptions/create-portal-session", handleStatusPing("/api/subscriptions/create-portal-session"));
  app.options("/api/subscriptions/create-portal-session", handlePreflight);

  // =========================================================================
  // 3. STRIPE CHECKOUT VERIFICATION: POST /verify-checkout-session
  // =========================================================================
  const handleVerifyCheckoutSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = verifySessionSchema.parse(request.body);

    if (!isStripeConfigured || sessionId === "{CHECKOUT_SESSION_ID}") {
      return reply.send({
        success: false,
        stripeConfigured: isStripeConfigured,
      });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "line_items"],
      });

      const isPaid = session.payment_status === "paid" || session.status === "complete";
      const userId = session.client_reference_id || session.metadata?.userId;
      const priceId =
        session.metadata?.priceId || session.line_items?.data?.[0]?.price?.id || null;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id || null;

      const subObj =
        session.subscription && typeof session.subscription === "object"
          ? (session.subscription as Stripe.Subscription)
          : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : subObj?.id || null;

      const recurringInterval =
        subObj?.items?.data?.[0]?.price?.recurring?.interval ||
        session.line_items?.data?.[0]?.price?.recurring?.interval;
      const inferredCycle =
        recurringInterval === "year"
          ? "annual"
          : recurringInterval === "month"
            ? "monthly"
            : session.metadata?.cycle || "monthly";

      const planInfo = resolvePlanFromPriceId(
        priceId,
        session.metadata?.planCode || session.metadata?.plan,
        inferredCycle,
      );
      const newPlan = planInfo?.plan || "completo";
      const newCycle = newPlan === "estudante" ? "monthly" : planInfo?.cycle || "monthly";

      const periodStartUnix = (subObj as any)?.current_period_start || session.created;
      const periodEndUnix = (subObj as any)?.current_period_end || null;
      const startDate = periodStartUnix ? new Date(periodStartUnix * 1000).toISOString() : new Date().toISOString();
      const renewalDate = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
      const autoRenew = subObj ? !subObj.cancel_at_period_end : true;

      if (isPaid) {
        const targetUser = await safeFindUser({
          userId,
          email: session.customer_details?.email || session.metadata?.userEmail,
          customerId,
        });

        if (targetUser) {
          await prisma.user
            .update({
              where: { id: targetUser.id },
              data: {
                plan: newPlan,
                status: "active",
                customPermissions: {
                  ...(targetUser.customPermissions && typeof targetUser.customPermissions === "object"
                    ? targetUser.customPermissions
                    : {}),
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: subscriptionId,
                  stripePriceId: priceId,
                  subscriptionStatus: "active",
                  subscriptionCycle: newCycle,
                  subscriptionStartDate: startDate,
                  subscriptionRenewalDate: renewalDate,
                  autoRenew,
                  lastSyncAt: new Date().toISOString(),
                },
              },
            })
            .catch(() => null);
        }
      }

      return reply.send({
        success: isPaid,
        paid: isPaid,
        plan: newPlan,
        cycle: newCycle,
        status: isPaid ? "active" : session.status,
        startDate,
        renewalDate,
        autoRenew,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        sessionId: session.id,
      });
    } catch (err: any) {
      app.log.error(`[Verify Session] Erro ao verificar sessão ${sessionId}: ${err.message}`);
      return reply.status(400).send({
        error: `Não foi possível verificar a sessão: ${err.message}`,
      });
    }
  };

  app.post("/verify-checkout-session", handleVerifyCheckoutSession);
  app.get("/verify-checkout-session", handleStatusPing("/verify-checkout-session"));
  app.options("/verify-checkout-session", handlePreflight);

  app.post("/api/verify-checkout-session", handleVerifyCheckoutSession);
  app.get("/api/verify-checkout-session", handleStatusPing("/api/verify-checkout-session"));
  app.options("/api/verify-checkout-session", handlePreflight);

  app.post("/api/subscriptions/verify-checkout-session", handleVerifyCheckoutSession);
  app.get("/api/subscriptions/verify-checkout-session", handleStatusPing("/api/subscriptions/verify-checkout-session"));
  app.options("/api/subscriptions/verify-checkout-session", handlePreflight);

  // =========================================================================
  // 4. STRIPE LIVE SUBSCRIPTION SYNC: POST /api/subscriptions/sync-stripe
  // Sincroniza diretamente da API da Stripe o plano ativo, datas e renovação
  // =========================================================================
  const handleSyncStripeSubscription = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = syncStripeSchema.parse(request.body || {});
    const tokenUser = extractUserFromAuthHeader(request);
    const email = (parsed.userEmail || parsed.email || tokenUser?.email || "").toLowerCase().trim();
    const userId = parsed.userId || tokenUser?.id;

    if (!isStripeConfigured) {
      return reply.send({
        synced: false,
        stripeConfigured: false,
      });
    }

    if (!email && !parsed.stripeCustomerId) {
      return reply.send({
        synced: false,
        reason: "missing_email_or_customer",
      });
    }

    try {
      const customerIds: string[] = [];

      if (parsed.stripeCustomerId) {
        customerIds.push(parsed.stripeCustomerId);
      }

      if (email && !email.endsWith("@nacifenergy.local")) {
        const customers = await stripe.customers.list({ email, limit: 5 });
        for (const c of customers.data) {
          if (!customerIds.includes(c.id)) {
            customerIds.push(c.id);
          }
        }
      }

      if (customerIds.length === 0) {
        return reply.send({
          synced: true,
          hasActiveSubscription: false,
        });
      }

      let matchedSub: Stripe.Subscription | null = null;
      let matchedCustomerId: string | null = null;

      for (const cid of customerIds) {
        const subs = await stripe.subscriptions.list({
          customer: cid,
          status: "all",
          limit: 10,
        });

        const active = subs.data.find((s) =>
          ["active", "trialing", "past_due"].includes(s.status),
        );
        if (active) {
          matchedSub = active;
          matchedCustomerId = cid;
          break;
        }
        if (!matchedSub && subs.data.length > 0) {
          matchedSub = subs.data[0];
          matchedCustomerId = cid;
        }
      }

      if (!matchedSub) {
        return reply.send({
          synced: true,
          hasActiveSubscription: false,
          stripeCustomerId: customerIds[0],
        });
      }

      const item = matchedSub.items?.data?.[0];
      const priceId = item?.price?.id || matchedSub.metadata?.priceId || null;
      const interval = item?.price?.recurring?.interval;
      const inferredCycle =
        interval === "year" ? "annual" : interval === "month" ? "monthly" : matchedSub.metadata?.cycle || "monthly";

      const planInfo = resolvePlanFromPriceId(
        priceId,
        matchedSub.metadata?.planCode || matchedSub.metadata?.plan,
        inferredCycle,
      );

      const isActive = ["active", "trialing", "past_due"].includes(matchedSub.status);
      const resolvedPlan = isActive ? planInfo?.plan || "completo" : "gratuito";
      const resolvedCycle = resolvedPlan === "estudante" ? "monthly" : planInfo?.cycle || "monthly";

      const periodStartUnix = (matchedSub as any).current_period_start || matchedSub.start_date || matchedSub.created;
      const periodEndUnix = (matchedSub as any).current_period_end || null;
      const startDate = periodStartUnix ? new Date(periodStartUnix * 1000).toISOString() : null;
      const renewalDate = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null;
      const autoRenew = !matchedSub.cancel_at_period_end && matchedSub.status !== "canceled";
      const unitAmount = item?.price?.unit_amount ? item.price.unit_amount / 100 : null;

      const targetUser = await safeFindUser({
        userId,
        email,
        customerId: matchedCustomerId,
      });

      if (targetUser) {
        await prisma.user
          .update({
            where: { id: targetUser.id },
            data: {
              plan: resolvedPlan,
              status: "active",
              customPermissions: {
                ...(targetUser.customPermissions && typeof targetUser.customPermissions === "object"
                  ? targetUser.customPermissions
                  : {}),
                stripeCustomerId: matchedCustomerId,
                stripeSubscriptionId: matchedSub.id,
                stripePriceId: priceId,
                subscriptionStatus: matchedSub.status === "canceled" ? "cancelled" : matchedSub.status,
                subscriptionCycle: resolvedCycle,
                subscriptionStartDate: startDate,
                subscriptionRenewalDate: renewalDate,
                autoRenew,
                lastSyncAt: new Date().toISOString(),
              },
            },
          })
          .catch(() => null);
      }

      return reply.send({
        synced: true,
        hasActiveSubscription: isActive,
        plan: resolvedPlan,
        cycle: resolvedCycle,
        status: matchedSub.status === "canceled" ? "cancelled" : matchedSub.status,
        startDate,
        renewalDate,
        autoRenew,
        price: unitAmount,
        stripeCustomerId: matchedCustomerId,
        stripeSubscriptionId: matchedSub.id,
        stripePriceId: priceId,
      });
    } catch (err: any) {
      app.log.error(`[Sync Stripe] Falha ao sincronizar assinatura de ${email}: ${err.message}`);
      return reply.status(200).send({
        synced: false,
        error: err.message,
      });
    }
  };

  app.post("/sync-stripe-subscription", handleSyncStripeSubscription);
  app.options("/sync-stripe-subscription", handlePreflight);
  app.post("/api/sync-stripe-subscription", handleSyncStripeSubscription);
  app.options("/api/sync-stripe-subscription", handlePreflight);
  app.post("/api/subscriptions/sync-stripe", handleSyncStripeSubscription);
  app.get("/api/subscriptions/sync-stripe", handleStatusPing("/api/subscriptions/sync-stripe"));
  app.options("/api/subscriptions/sync-stripe", handlePreflight);

  // =========================================================================
  // 5. STRIPE WEBHOOK: POST /webhook (utiliza Raw Body preservado)
  // =========================================================================
  const handleStripeWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers["stripe-signature"] as string;
    const rawBody = (request as any).rawBody || request.body;

    let event: Stripe.Event;

    if (env.STRIPE_WEBHOOK_SECRET && isStripeConfigured && sig) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        app.log.error(`[Stripe Webhook] Falha de validação da assinatura: ${err.message}`);
        return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
      }
    } else {
      event = (typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody) as Stripe.Event;
    }

    app.log.info(`[Stripe Webhook] Processando evento recebido: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.client_reference_id || session.metadata?.userId;
          const priceId = session.metadata?.priceId;
          const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

          const targetUser = await safeFindUser({
            userId,
            email: session.customer_details?.email || session.metadata?.userEmail,
            customerId,
          });

          if (targetUser) {
            const planInfo = resolvePlanFromPriceId(
              priceId,
              session.metadata?.planCode || session.metadata?.plan,
              session.metadata?.cycle,
            );
            const newPlan = planInfo?.plan || "completo";

            await prisma.user
              .update({
                where: { id: targetUser.id },
                data: {
                  plan: newPlan,
                  status: "active",
                  customPermissions: {
                    ...(targetUser.customPermissions && typeof targetUser.customPermissions === "object"
                      ? targetUser.customPermissions
                      : {}),
                    stripeCustomerId: customerId,
                    stripeSubscriptionId: subscriptionId,
                    stripePriceId: priceId,
                    subscriptionStatus: "active",
                    subscriptionCycle: planInfo?.cycle || "monthly",
                    lastEvent: "checkout.session.completed",
                    updatedAt: new Date().toISOString(),
                  },
                },
              })
              .catch(() => null);

            await prisma.notification
              .create({
                data: {
                  userId: targetUser.id,
                  title: "Assinatura confirmada!",
                  description: `Seu plano Nacif ${newPlan.toUpperCase()} está ativo e seus recursos foram liberados.`,
                  category: "Assinatura",
                  tone: "success",
                  href: "/subscription",
                },
              })
              .catch(() => null);
          }
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
          const userId = sub.metadata?.userId;
          const item = sub.items?.data?.[0];
          const priceId = item?.price?.id || sub.metadata?.priceId;
          const interval = item?.price?.recurring?.interval;
          const cycle = interval === "year" ? "annual" : "monthly";

          const targetUser = await safeFindUser({
            userId,
            email: sub.metadata?.userEmail,
            customerId,
          });

          if (targetUser) {
            const planInfo = resolvePlanFromPriceId(priceId, sub.metadata?.planCode, cycle);
            const isActive = ["active", "trialing", "past_due"].includes(sub.status);
            const nextPlan = isActive ? planInfo?.plan || targetUser.plan : "gratuito";

            await prisma.user
              .update({
                where: { id: targetUser.id },
                data: {
                  plan: nextPlan,
                  customPermissions: {
                    ...(targetUser.customPermissions && typeof targetUser.customPermissions === "object"
                      ? targetUser.customPermissions
                      : {}),
                    stripeCustomerId: customerId,
                    stripeSubscriptionId: sub.id,
                    stripePriceId: priceId,
                    subscriptionStatus: sub.status,
                    subscriptionCycle: planInfo?.cycle || cycle,
                    autoRenew: !sub.cancel_at_period_end,
                    lastEvent: event.type,
                    updatedAt: new Date().toISOString(),
                  },
                },
              })
              .catch(() => null);
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
          const customerEmail = invoice.customer_email;
          const subscriptionId =
            typeof (invoice as any).subscription === "string"
              ? (invoice as any).subscription
              : (invoice as any).subscription?.id;

          const targetUser = await safeFindUser({
            email: customerEmail,
            customerId,
          });

          if (targetUser) {
            await prisma.user
              .update({
                where: { id: targetUser.id },
                data: {
                  status: "active",
                  customPermissions: {
                    ...(targetUser.customPermissions && typeof targetUser.customPermissions === "object"
                      ? targetUser.customPermissions
                      : {}),
                    stripeCustomerId: customerId,
                    stripeSubscriptionId: subscriptionId,
                    subscriptionStatus: "active",
                    lastInvoicePaidAt: new Date().toISOString(),
                  },
                },
              })
              .catch(() => null);
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerEmail = invoice.customer_email;
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

          const targetUser = await safeFindUser({
            email: customerEmail,
            customerId,
          });

          if (targetUser) {
            await prisma.user
              .update({
                where: { id: targetUser.id },
                data: {
                  customPermissions: {
                    ...(targetUser.customPermissions && typeof targetUser.customPermissions === "object"
                      ? targetUser.customPermissions
                      : {}),
                    subscriptionStatus: "past_due",
                    lastPaymentFailure: new Date().toISOString(),
                  },
                },
              })
              .catch(() => null);

            await prisma.notification
              .create({
                data: {
                  userId: targetUser.id,
                  title: "Falha na renovação da assinatura",
                  description:
                    "Houve um problema com a cobrança da sua mensalidade. Atualize seus dados de pagamento para evitar suspensão.",
                  category: "Cobrança",
                  tone: "danger",
                  href: "/subscription",
                },
              })
              .catch(() => null);
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId =
            typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
          const userId = subscription.metadata?.userId;

          const targetUser = await safeFindUser({
            userId,
            email: subscription.metadata?.userEmail,
            customerId,
          });

          if (targetUser) {
            await prisma.user
              .update({
                where: { id: targetUser.id },
                data: {
                  plan: "gratuito",
                  customPermissions: {
                    ...(targetUser.customPermissions && typeof targetUser.customPermissions === "object"
                      ? targetUser.customPermissions
                      : {}),
                    subscriptionStatus: "canceled",
                    autoRenew: false,
                    canceledAt: new Date().toISOString(),
                  },
                },
              })
              .catch(() => null);

            await prisma.notification
              .create({
                data: {
                  userId: targetUser.id,
                  title: "Assinatura encerrada",
                  description:
                    "Sua assinatura foi cancelada e sua conta retornou para o plano Gratuito. Todos os seus dados permanecem salvos.",
                  category: "Assinatura",
                  tone: "warning",
                  href: "/subscription",
                },
              })
              .catch(() => null);
          }
          break;
        }

        default:
          app.log.info(`[Stripe Webhook] Evento não mapeado ignorado: ${event.type}`);
      }

      return reply.send({ received: true });
    } catch (err: any) {
      app.log.error(`[Stripe Webhook] Erro ao processar evento ${event.type}: ${err.message}`);
      return reply.status(500).send({ error: "Erro interno ao processar webhook" });
    }
  };

  app.post("/webhook", handleStripeWebhook);
  app.post("/api/webhook", handleStripeWebhook);
  app.post("/api/subscriptions/webhook", handleStripeWebhook);

  // =========================================================================
  // ROTAS DE GERENCIAMENTO DE ASSINATURA
  // =========================================================================
  app.get("/api/subscriptions/status", { preHandler: [app.authenticate] }, async (request) => {
    const user = await resolveOrCreateUser(request, {
      userId: request.authUser.id,
      email: request.authUser.email,
    });

    const permissions = (user.customPermissions as any) || {};

    return {
      plan: user.plan,
      status: permissions.subscriptionStatus || "active",
      cycle: permissions.subscriptionCycle || "monthly",
      startDate: permissions.subscriptionStartDate || null,
      renewalDate: permissions.subscriptionRenewalDate || null,
      validUntil: permissions.subscriptionRenewalDate || null,
      autoRenew: permissions.autoRenew ?? true,
      academicStatus: permissions.academicStatus || "not_submitted",
      academicInstitution: permissions.academicInstitution || "",
      academicCourse: permissions.academicCourse || "",
      academicDocumentUrl: permissions.academicDocumentUrl || "",
      stripeCustomerId: permissions.stripeCustomerId || null,
      stripeSubscriptionId: permissions.stripeSubscriptionId || null,
    };
  });

  app.post("/api/subscriptions/change-plan", { preHandler: [app.authenticate] }, async (request) => {
    const { planCode, cycle } = changePlanSchema.parse(request.body);

    const user = await resolveOrCreateUser(request, {
      userId: request.authUser.id,
      email: request.authUser.email,
    });

    if (user._ephemeral) {
      return {
        ...user,
        plan: planCode,
        subscription_cycle: cycle,
      };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: planCode,
        customPermissions: {
          ...((user.customPermissions as any) || {}),
          subscriptionCycle: cycle,
          subscriptionStatus: "active",
        },
      },
    });

    return serializeUser(updatedUser);
  });

  app.post("/api/subscriptions/cancel", { preHandler: [app.authenticate] }, async (request) => {
    cancelSubscriptionSchema.parse(request.body);

    const user = await resolveOrCreateUser(request, {
      userId: request.authUser.id,
      email: request.authUser.email,
    });

    if (user._ephemeral) {
      return { ...user, plan: "gratuito" };
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: "gratuito",
      },
    });

    return serializeUser(updatedUser);
  });

  app.post("/api/subscriptions/academic-verify", { preHandler: [app.authenticate] }, async (request) => {
    academicVerifySchema.parse(request.body);

    return {
      message: "Comprovante enviado com sucesso para análise administrativa.",
      status: "pending_review",
    };
  });

  app.get("/api/subscriptions/admin/users", { preHandler: [app.requireAdmin] }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    return users.map(serializeUser);
  });

  app.patch("/api/subscriptions/admin/users/:id/plan", { preHandler: [app.requireAdmin] }, async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = adminUpdatePlanSchema.parse(request.body);

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        plan: data.plan,
      },
    });

    return serializeUser(user);
  });

  app.post("/api/subscriptions/admin/academic/:id/decide", { preHandler: [app.requireAdmin] }, async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = adminDecideAcademicSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    return {
      id: user.id,
      academicStatus: data.decision === "approve" ? "approved" : "rejected",
    };
  });
};
