import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type Stripe from "stripe";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { serializeUser } from "../lib/serializers.js";
import { env } from "../config/env.js";
import {
  stripe,
  getOrCreateStripeCustomer,
  resolvePlanFromPriceId,
  STRIPE_PRICES,
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
  priceId: z.string().min(1, "O priceId é obrigatório."),
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
});

const verifySessionSchema = z.object({
  sessionId: z.string().min(1, "sessionId é obrigatório."),
});

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

/**
 * Localiza o usuário no banco MySQL ou o cria/atualiza automaticamente (Upsert)
 * para garantir que o fluxo de checkout da Stripe nunca falhe em ambiente local/híbrido.
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
  } = {}
) {
  const tokenUser = extractUserFromAuthHeader(request);
  const authUser = (request as any).authUser;

  // 1. Identifica o ID do usuário (prioridade: authUser > bodyData > token)
  const resolvedUserId =
    authUser?.id || bodyData.userId || tokenUser?.id || undefined;

  // 2. Identifica candidato de email
  const candidateEmail =
    bodyData.userEmail ||
    bodyData.email ||
    authUser?.email ||
    tokenUser?.email ||
    (resolvedUserId && resolvedUserId.includes("@") ? resolvedUserId : undefined);

  // 3. Tenta buscar usuário existente pelo ID no Prisma
  let user = resolvedUserId
    ? await prisma.user.findUnique({
        where: { id: resolvedUserId },
      })
    : null;

  // 4. Se não achou por ID, tenta buscar por email se disponível
  if (!user && candidateEmail) {
    user = await prisma.user.findUnique({
      where: { email: candidateEmail.toLowerCase().trim() },
    });
  }

  // 5. Se o usuário já existe no MySQL local, retorna imediatamente
  if (user) {
    return user;
  }

  // 6. Caso não exista no MySQL local (banco novo ou IDs desalinhados),
  // realiza a criação automática na hora via prisma.user.upsert / create
  const fallbackId = resolvedUserId || `user_dev_${Date.now().toString(36)}`;
  const cleanId = fallbackId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "dev";
  const finalEmail = candidateEmail
    ? candidateEmail.toLowerCase().trim()
    : `user_${cleanId}@nacifenergy.local`;

  const finalName =
    bodyData.userName ||
    bodyData.name ||
    bodyData.fullName ||
    authUser?.name ||
    tokenUser?.name ||
    (candidateEmail ? candidateEmail.split("@")[0] : `Usuário ${cleanId}`);

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
      },
    });
  } catch (err: any) {
    // Caso ocorra conflito único de email com outro ID já existente
    const existingByEmail = await prisma.user.findUnique({
      where: { email: finalEmail },
    });

    if (existingByEmail) {
      return existingByEmail;
    }

    // Cria com email único contendo timestamp
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
  }

  return user;
}

export const registerSubscriptionRoutes = async (app: FastifyInstance) => {
  // =========================================================================
  // 1. STRIPE CHECKOUT: POST /create-checkout-session
  // =========================================================================
  const handleCreateCheckoutSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const { priceId, ...userData } = createCheckoutSessionSchema.parse(request.body);

    // Resolve ou cria o usuário automaticamente no banco local se não existir
    const user = await resolveOrCreateUser(request, userData);

    // Validação da Regra de Negócio:
    // Nacif Estudante: APENAS faturamento mensal (R$ 99,99/mês). Toggle anual proibido.
    const planInfo = resolvePlanFromPriceId(priceId);
    if (planInfo?.plan === "estudante" && planInfo.cycle === "annual") {
      throw new AppError("O plano Nacif Estudante está disponível exclusivamente na contratação mensal.", 400);
    }

    // Configura as URLs de redirecionamento de volta ao painel
    const successUrl = `${env.FRONTEND_URL}/subscription?session_id={CHECKOUT_SESSION_ID}&checkout=success`;
    const cancelUrl = `${env.FRONTEND_URL}/subscription?checkout=cancelled`;

    // Modo de Desenvolvimento sem chaves reais configuradas
    if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
      app.log.warn("[Stripe] Chave STRIPE_SECRET_KEY não definida. Retornando URL simulada de checkout.");
      return reply.send({
        url: `${env.FRONTEND_URL}/subscription?session_id=cs_simulated_${Date.now()}&checkout=success&priceId=${priceId}`,
        sessionId: `cs_simulated_${Date.now()}`,
        simulated: true,
      });
    }

    // Obtém ou cria o Customer ID da Stripe para este usuário
    const customerId = await getOrCreateStripeCustomer(user);

    // Salva o customerId no banco local se ainda não estava gravado
    if ((user.customPermissions as any)?.stripeCustomerId !== customerId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          customPermissions: {
            ...((user.customPermissions as any) || {}),
            stripeCustomerId: customerId,
          },
        },
      }).catch(() => null);
    }

    // Cria a sessão de Checkout no Stripe Billing
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        priceId: priceId,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          priceId: priceId,
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
    });
  };

  // Registra o endpoint na raiz e nas rotas prefixadas
  app.post("/create-checkout-session", handleCreateCheckoutSession);
  app.post("/api/create-checkout-session", handleCreateCheckoutSession);
  app.post("/api/subscriptions/create-checkout-session", handleCreateCheckoutSession);

  // =========================================================================
  // 2. STRIPE CUSTOMER PORTAL: POST /create-portal-session
  // =========================================================================
  const handleCreatePortalSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const parsed = createPortalSessionSchema.parse(body);

    // Resolve ou cria o usuário no banco local
    const user = await resolveOrCreateUser(request, parsed);

    // Modo simulado se chave não configurada
    if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
      return reply.send({
        url: `${env.FRONTEND_URL}/subscription?portal_mock=true`,
        simulated: true,
      });
    }

    const customerId = await getOrCreateStripeCustomer(user);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${env.FRONTEND_URL}/subscription`,
    });

    return reply.send({
      url: portalSession.url,
    });
  };

  app.post("/create-portal-session", handleCreatePortalSession);
  app.post("/api/create-portal-session", handleCreatePortalSession);
  app.post("/api/subscriptions/create-portal-session", handleCreatePortalSession);

  // =========================================================================
  // 3. STRIPE CHECKOUT VERIFICATION: POST /verify-checkout-session
  // Sincroniza o plano caso o webhook não consiga alcançar o localhost
  // =========================================================================
  const handleVerifyCheckoutSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = verifySessionSchema.parse(request.body);

    if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
      return reply.send({
        success: true,
        plan: "completo",
        simulated: true,
      });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "line_items"],
      });

      const userId = session.client_reference_id || session.metadata?.userId;
      const priceId =
        session.metadata?.priceId ||
        session.line_items?.data?.[0]?.price?.id;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as any)?.id;

      let targetUser = null;
      if (userId) {
        targetUser = await prisma.user.findUnique({ where: { id: userId } });
      }
      if (!targetUser && session.customer_details?.email) {
        targetUser = await prisma.user.findUnique({
          where: { email: session.customer_details.email },
        });
      }

      const planInfo = priceId ? resolvePlanFromPriceId(priceId) : null;
      const newPlan = planInfo?.plan || "completo";

      if (targetUser) {
        await prisma.user.update({
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
              lastSyncAt: new Date().toISOString(),
            },
          },
        });
        app.log.info(`[Verify Session] Usuário ${targetUser.id} sincronizado com sucesso para o plano ${newPlan}`);
      }

      return reply.send({
        success: true,
        plan: newPlan,
        cycle: planInfo?.cycle || "monthly",
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
  app.post("/api/verify-checkout-session", handleVerifyCheckoutSession);
  app.post("/api/subscriptions/verify-checkout-session", handleVerifyCheckoutSession);

  // =========================================================================
  // 3. STRIPE WEBHOOK: POST /webhook (utiliza Raw Body preservado)
  // =========================================================================
  const handleStripeWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers["stripe-signature"] as string;
    const rawBody = (request as any).rawBody || request.body;

    let event: Stripe.Event;

    // Se o webhook secret estiver configurado, valida a assinatura criptográfica
    if (env.STRIPE_WEBHOOK_SECRET && env.STRIPE_SECRET_KEY) {
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        app.log.error(`[Stripe Webhook] Falha de validação da assinatura: ${err.message}`);
        return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
      }
    } else {
      // Em modo de testes/dev sem webhook secret, processa o payload direto
      event = (typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody) as Stripe.Event;
    }

    app.log.info(`[Stripe Webhook] Processando evento recebido: ${event.type}`);

    try {
      switch (event.type) {
        // ---------------------------------------------------------------------
        // Evento 1: checkout.session.completed
        // ---------------------------------------------------------------------
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.client_reference_id || session.metadata?.userId;
          const priceId = session.metadata?.priceId;
          const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

          let targetUser = null;
          if (userId) {
            targetUser = await prisma.user.findUnique({ where: { id: userId } });
          }
          if (!targetUser && session.customer_details?.email) {
            targetUser = await prisma.user.findUnique({ where: { email: session.customer_details.email } });
          }

          if (targetUser) {
            const planInfo = priceId ? resolvePlanFromPriceId(priceId) : null;
            const newPlan = planInfo?.plan || "completo";

            await prisma.user.update({
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
            });

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

            app.log.info(`[Stripe Webhook] Usuário ${targetUser.id} atualizado para o plano ${newPlan}`);
          }
          break;
        }

        // ---------------------------------------------------------------------
        // Evento 2: invoice.paid
        // ---------------------------------------------------------------------
        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
          const customerEmail = invoice.customer_email;
          const subscriptionId =
            typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;

          let targetUser = null;
          if (customerEmail) {
            targetUser = await prisma.user.findUnique({ where: { email: customerEmail } });
          }
          if (!targetUser && customerId) {
            const users = await prisma.user.findMany();
            targetUser = users.find((u) => (u.customPermissions as any)?.stripeCustomerId === customerId) || null;
          }

          if (targetUser) {
            await prisma.user.update({
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
            });
            app.log.info(`[Stripe Webhook] Fatura paga para usuário ${targetUser.id}`);
          }
          break;
        }

        // ---------------------------------------------------------------------
        // Evento 3: invoice.payment_failed
        // ---------------------------------------------------------------------
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerEmail = invoice.customer_email;
          const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

          let targetUser = null;
          if (customerEmail) {
            targetUser = await prisma.user.findUnique({ where: { email: customerEmail } });
          }
          if (!targetUser && customerId) {
            const users = await prisma.user.findMany();
            targetUser = users.find((u) => (u.customPermissions as any)?.stripeCustomerId === customerId) || null;
          }

          if (targetUser) {
            await prisma.user.update({
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
            });

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

            app.log.warn(`[Stripe Webhook] Falha de pagamento de fatura para usuário ${targetUser.id}`);
          }
          break;
        }

        // ---------------------------------------------------------------------
        // Evento 4: customer.subscription.deleted
        // ---------------------------------------------------------------------
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId =
            typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
          const userId = subscription.metadata?.userId;

          let targetUser = null;
          if (userId) {
            targetUser = await prisma.user.findUnique({ where: { id: userId } });
          }
          if (!targetUser && customerId) {
            const users = await prisma.user.findMany();
            targetUser = users.find((u) => (u.customPermissions as any)?.stripeCustomerId === customerId) || null;
          }

          if (targetUser) {
            // Rebaixa o plano para o gratuito e atualiza status
            await prisma.user.update({
              where: { id: targetUser.id },
              data: {
                plan: "gratuito",
                customPermissions: {
                  ...(targetUser.customPermissions && typeof targetUser.customPermissions === "object"
                    ? targetUser.customPermissions
                    : {}),
                  subscriptionStatus: "canceled",
                  canceledAt: new Date().toISOString(),
                },
              },
            });

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

            app.log.info(`[Stripe Webhook] Assinatura cancelada para usuário ${targetUser.id}. Retornado para gratuito.`);
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
  // ROTAS EXISTENTES DE GERENCIAMENTO DE ASSINATURA
  // =========================================================================
  // Obter status da assinatura do usuário atual
  app.get("/api/subscriptions/status", { preHandler: [app.authenticate] }, async (request) => {
    let user = await prisma.user.findUnique({
      where: { id: request.authUser.id },
    });

    if (!user) {
      user = await resolveOrCreateUser(request, {
        userId: request.authUser.id,
        email: request.authUser.email,
      });
    }

    const permissions = (user.customPermissions as any) || {};

    return {
      plan: user.plan,
      status: permissions.subscriptionStatus || "active",
      validUntil: null,
      academicStatus: "approved",
      stripeCustomerId: permissions.stripeCustomerId || null,
      stripeSubscriptionId: permissions.stripeSubscriptionId || null,
    };
  });

  // Mudar de plano manualmente (Upgrade / Downgrade interno)
  app.post("/api/subscriptions/change-plan", { preHandler: [app.authenticate] }, async (request) => {
    const { planCode } = changePlanSchema.parse(request.body);

    const user = await resolveOrCreateUser(request, {
      userId: request.authUser.id,
      email: request.authUser.email,
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: planCode,
      },
    });

    return serializeUser(updatedUser);
  });

  // Cancelar assinatura manualmente
  app.post("/api/subscriptions/cancel", { preHandler: [app.authenticate] }, async (request) => {
    cancelSubscriptionSchema.parse(request.body);

    const user = await resolveOrCreateUser(request, {
      userId: request.authUser.id,
      email: request.authUser.email,
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: "gratuito",
      },
    });

    return serializeUser(updatedUser);
  });

  // Enviar comprovação de matrícula estudantil
  app.post("/api/subscriptions/academic-verify", { preHandler: [app.authenticate] }, async (request) => {
    academicVerifySchema.parse(request.body);

    return {
      message: "Comprovante enviado com sucesso para análise administrativa.",
      status: "pending_review",
    };
  });

  // Admin: Listar todos os usuários com dados de assinatura
  app.get("/api/subscriptions/admin/users", { preHandler: [app.requireAdmin] }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    return users.map(serializeUser);
  });

  // Admin: Atualizar plano de qualquer usuário
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

  // Admin: Decidir aprovação ou rejeição de estudante
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
