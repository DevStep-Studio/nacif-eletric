import Stripe from "stripe";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

// Inicializa a instância do Stripe com a chave secreta de ambiente
const stripeSecretKey = env.STRIPE_SECRET_KEY || "sk_test_placeholder";

export const isStripeConfigured = Boolean(
  env.STRIPE_SECRET_KEY &&
    env.STRIPE_SECRET_KEY.trim().startsWith("sk_") &&
    env.STRIPE_SECRET_KEY.trim() !== "sk_test_placeholder" &&
    !env.STRIPE_SECRET_KEY.includes("..."),
);

export const stripe = new Stripe(stripeSecretKey, {
  typescript: true,
});

/**
 * Mapeamento dos Price IDs oficiais da Stripe para os planos Nacif Energy
 * Regra de Negócio:
 * - Nacif Estudante: APENAS mensal (R$ 99,99/mês). Não possui chave anual.
 * - Nacif Elétrico: Mensal (R$ 149,90) ou Anual (-30% OFF -> R$ 1.259,16)
 * - Nacif Solar: Mensal (R$ 149,90) ou Anual (-30% OFF -> R$ 1.259,16)
 * - Nacif Completo: Mensal (R$ 210,00) ou Anual (-30% OFF -> R$ 1.764,00)
 */
export const STRIPE_PRICES = {
  estudante: {
    monthly: env.STRIPE_PRICE_ESTUDANTE_MONTHLY || "price_1UVAQqJl6h9d8TBMRYFoOdBM",
  },
  eletrico: {
    monthly: env.STRIPE_PRICE_ELETRICO_MONTHLY || "price_1UVAS5Jl6h9d8TBMQLt9F7nB",
    annual: env.STRIPE_PRICE_ELETRICO_ANNUAL || "price_1UVAfiJl6h9d8TBMcF6J01KS",
  },
  solar: {
    monthly: env.STRIPE_PRICE_SOLAR_MONTHLY || "price_1UVAX2Jl6h9d8TBMkWZsDn0s",
    annual: env.STRIPE_PRICE_SOLAR_ANNUAL || "price_1UVAgGJl6h9d8TBMmK3sEsRZ",
  },
  completo: {
    monthly: env.STRIPE_PRICE_COMPLETO_MONTHLY || "price_1UVAYaJl6h9d8TBMc8YTZsHp",
    annual: env.STRIPE_PRICE_COMPLETO_ANNUAL || "price_1UVAgoJl6h9d8TBMubc39FAP",
  },
} as const;

export const STRIPE_PAYMENT_LINKS = {
  estudante: {
    monthly:
      process.env.STRIPE_LINK_ESTUDANTE_MONTHLY ||
      process.env.VITE_STRIPE_LINK_ESTUDANTE_MONTHLY ||
      "https://buy.stripe.com/test_eVq9AU2j39m1dfl6HkbQY01",
  },
  eletrico: {
    monthly:
      process.env.STRIPE_LINK_ELETRICO_MONTHLY ||
      process.env.VITE_STRIPE_LINK_ELETRICO_MONTHLY ||
      "https://buy.stripe.com/test_dRmdRa7Dncyd4IPc1EbQY02",
    annual:
      process.env.STRIPE_LINK_ELETRICO_ANNUAL ||
      process.env.VITE_STRIPE_LINK_ELETRICO_ANNUAL ||
      "https://buy.stripe.com/test_3cI3cwaPz69P7V19TwbQY03",
  },
  solar: {
    monthly:
      process.env.STRIPE_LINK_SOLAR_MONTHLY ||
      process.env.VITE_STRIPE_LINK_SOLAR_MONTHLY ||
      "https://buy.stripe.com/test_3cI9AUe1LdCh0sz9TwbQY04",
    annual:
      process.env.STRIPE_LINK_SOLAR_ANNUAL ||
      process.env.VITE_STRIPE_LINK_SOLAR_ANNUAL ||
      "https://buy.stripe.com/test_6oU14o8Hr9m12AH9TwbQY05",
  },
  completo: {
    monthly:
      process.env.STRIPE_LINK_COMPLETO_MONTHLY ||
      process.env.VITE_STRIPE_LINK_COMPLETO_MONTHLY ||
      "https://buy.stripe.com/test_dRm00k6zj1Tzfnte9MbQY06",
    annual:
      process.env.STRIPE_LINK_COMPLETO_ANNUAL ||
      process.env.VITE_STRIPE_LINK_COMPLETO_ANNUAL ||
      "https://buy.stripe.com/test_28E5kE5vf2XD3ELe9MbQY07",
  },
} as const;

export const STRIPE_PORTAL_LOGIN_URL =
  process.env.STRIPE_PORTAL_LOGIN_URL ||
  process.env.VITE_STRIPE_PORTAL_LOGIN_URL ||
  "https://billing.stripe.com/p/login/test_14A00k8Hrbu91wD0iWbQY00";

export type PlanKey = keyof typeof STRIPE_PRICES;

/**
 * Converte placeholders ou planCode+cycle em um Price ID real da Stripe
 */
export const resolveRealStripePriceId = (
  priceId?: string,
  planCode?: string,
  cycle: "monthly" | "annual" = "monthly",
): string | null => {
  if (priceId && priceId.startsWith("price_") && !priceId.startsWith("price_test_")) {
    return priceId;
  }

  const inferred = priceId ? resolvePlanFromPriceId(priceId) : null;
  const targetPlan = (planCode || inferred?.plan) as PlanKey | undefined;
  const targetCycle = targetPlan === "estudante" ? "monthly" : cycle || inferred?.cycle || "monthly";

  if (!targetPlan || !(targetPlan in STRIPE_PRICES)) {
    return priceId || null;
  }

  if (targetPlan === "estudante") {
    return STRIPE_PRICES.estudante.monthly;
  }

  const planPrices = STRIPE_PRICES[targetPlan];
  return targetCycle === "annual" ? planPrices.annual : planPrices.monthly;
};

/**
 * Mapeia um priceId recebido da Stripe (ou metadados) para o plano correspondente do sistema
 */
export const resolvePlanFromPriceId = (
  priceId?: string | null,
  fallbackPlan?: string | null,
  fallbackCycle?: string | null,
): { plan: "estudante" | "eletrico" | "solar" | "completo"; cycle: "monthly" | "annual" } | null => {
  if (priceId) {
    // Estudante (Apenas Mensal)
    if (priceId === STRIPE_PRICES.estudante.monthly || priceId.includes("estudante")) {
      return { plan: "estudante", cycle: "monthly" };
    }

    // Elétrico
    if (
      priceId === STRIPE_PRICES.eletrico.annual ||
      (priceId.includes("eletrico") && priceId.includes("annual"))
    ) {
      return { plan: "eletrico", cycle: "annual" };
    }
    if (priceId === STRIPE_PRICES.eletrico.monthly || priceId.includes("eletrico")) {
      return { plan: "eletrico", cycle: "monthly" };
    }

    // Solar
    if (
      priceId === STRIPE_PRICES.solar.annual ||
      (priceId.includes("solar") && priceId.includes("annual"))
    ) {
      return { plan: "solar", cycle: "annual" };
    }
    if (priceId === STRIPE_PRICES.solar.monthly || priceId.includes("solar")) {
      return { plan: "solar", cycle: "monthly" };
    }

    // Completo
    if (
      priceId === STRIPE_PRICES.completo.annual ||
      (priceId.includes("completo") && priceId.includes("annual"))
    ) {
      return { plan: "completo", cycle: "annual" };
    }
    if (priceId === STRIPE_PRICES.completo.monthly || priceId.includes("completo")) {
      return { plan: "completo", cycle: "monthly" };
    }
  }

  if (
    fallbackPlan === "estudante" ||
    fallbackPlan === "eletrico" ||
    fallbackPlan === "solar" ||
    fallbackPlan === "completo"
  ) {
    return {
      plan: fallbackPlan,
      cycle: fallbackPlan === "estudante" ? "monthly" : fallbackCycle === "annual" ? "annual" : "monthly",
    };
  }

  return null;
};

/**
 * Monta URL de Payment Link da Stripe enriquecida com e-mail e ID do usuário Nacif
 */
export const buildStripePaymentLinkUrl = (
  planCode: string,
  cycle: "monthly" | "annual" = "monthly",
  user?: { id?: string; email?: string },
): string | null => {
  if (!(planCode in STRIPE_PAYMENT_LINKS)) return null;
  const key = planCode as PlanKey;
  const rawUrl =
    key === "estudante"
      ? STRIPE_PAYMENT_LINKS.estudante.monthly
      : cycle === "annual"
        ? STRIPE_PAYMENT_LINKS[key].annual
        : STRIPE_PAYMENT_LINKS[key].monthly;

  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (user?.email && !user.email.endsWith("@nacifenergy.local")) {
      url.searchParams.set("prefilled_email", user.email);
    }
    if (user?.id) {
      url.searchParams.set("client_reference_id", user.id);
    }
    url.searchParams.set("locale", "pt-BR");
    return url.toString();
  } catch {
    return rawUrl;
  }
};

export const buildStripePortalFallbackUrl = (email?: string): string => {
  try {
    const url = new URL(STRIPE_PORTAL_LOGIN_URL);
    if (email && !email.endsWith("@nacifenergy.local")) {
      url.searchParams.set("prefilled_email", email);
    }
    return url.toString();
  } catch {
    return STRIPE_PORTAL_LOGIN_URL;
  }
};

/**
 * Garante ou recupera o Customer ID da Stripe para o usuário (compatível com troca Test <-> Live)
 */
export const getOrCreateStripeCustomer = async (user: {
  id: string;
  email: string;
  fullName: string;
  customPermissions?: any;
}): Promise<string> => {
  const permissions =
    user.customPermissions && typeof user.customPermissions === "object"
      ? user.customPermissions
      : {};

  if (!isStripeConfigured) {
    return `cus_mock_${user.id}`;
  }

  // 1. Se já existir stripeCustomerId salvo, valida se existe no modo atual (Test/Live) da conta Stripe
  if (permissions.stripeCustomerId && typeof permissions.stripeCustomerId === "string") {
    try {
      const retrieved = await stripe.customers.retrieve(permissions.stripeCustomerId);
      if (retrieved && !(retrieved as Stripe.DeletedCustomer).deleted) {
        return retrieved.id;
      }
    } catch {
      // Caso o customer seja de outro ambiente (ex: migração sk_test -> sk_live), prossegue buscando por e-mail
    }
  }

  // 2. Busca na Stripe se já existe cliente ativo com esse e-mail
  try {
    if (user.email) {
      const existing = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (existing.data.length > 0) {
        return existing.data[0].id;
      }
    }

    // 3. Cria novo Customer na Stripe vinculado ao ID do Nacif Energy
    const newCustomer = await stripe.customers.create({
      email: user.email,
      name: user.fullName,
      metadata: {
        userId: user.id,
        platform: "nacif_energy",
      },
    });

    return newCustomer.id;
  } catch (error: any) {
    throw new AppError(`Erro ao comunicar com a Stripe: ${error.message}`, 500);
  }
};
