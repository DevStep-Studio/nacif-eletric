import Stripe from "stripe";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

// Inicializa a instância do Stripe com a chave secreta de ambiente
const stripeSecretKey = env.STRIPE_SECRET_KEY || "sk_test_placeholder";

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-01-27.acacia" as any,
  typescript: true,
});

/**
 * Mapeamento dos Price IDs de teste e produção da Stripe
 * Regra de Negócio:
 * - Nacif Estudante: APENAS mensal (R$ 99,99/mês). Não possui chave anual.
 * - Nacif Elétrico: Mensal (R$ 149,90) ou Anual (-30% OFF)
 * - Nacif Solar: Mensal (R$ 149,90) ou Anual (-30% OFF)
 * - Nacif Completo: Mensal (R$ 210,00) ou Anual (-30% OFF)
 */
export const STRIPE_PRICES = {
  estudante: {
    monthly: env.STRIPE_PRICE_ESTUDANTE_MONTHLY || "price_test_estudante_monthly",
  },
  eletrico: {
    monthly: env.STRIPE_PRICE_ELETRICO_MONTHLY || "price_test_eletrico_monthly",
    annual: env.STRIPE_PRICE_ELETRICO_ANNUAL || "price_test_eletrico_annual",
  },
  solar: {
    monthly: env.STRIPE_PRICE_SOLAR_MONTHLY || "price_test_solar_monthly",
    annual: env.STRIPE_PRICE_SOLAR_ANNUAL || "price_test_solar_annual",
  },
  completo: {
    monthly: env.STRIPE_PRICE_COMPLETO_MONTHLY || "price_test_completo_monthly",
    annual: env.STRIPE_PRICE_COMPLETO_ANNUAL || "price_test_completo_annual",
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PRICES;

/**
 * Mapeia um priceId recebido da Stripe para o plano correspondente do sistema
 */
export const resolvePlanFromPriceId = (
  priceId: string,
): { plan: "estudante" | "eletrico" | "solar" | "completo"; cycle: "monthly" | "annual" } | null => {
  if (!priceId) return null;

  // Estudante (Apenas Mensal)
  if (priceId === STRIPE_PRICES.estudante.monthly || priceId.includes("estudante")) {
    return { plan: "estudante", cycle: "monthly" };
  }

  // Elétrico
  if (priceId === STRIPE_PRICES.eletrico.annual || (priceId.includes("eletrico") && priceId.includes("annual"))) {
    return { plan: "eletrico", cycle: "annual" };
  }
  if (priceId === STRIPE_PRICES.eletrico.monthly || priceId.includes("eletrico")) {
    return { plan: "eletrico", cycle: "monthly" };
  }

  // Solar
  if (priceId === STRIPE_PRICES.solar.annual || (priceId.includes("solar") && priceId.includes("annual"))) {
    return { plan: "solar", cycle: "annual" };
  }
  if (priceId === STRIPE_PRICES.solar.monthly || priceId.includes("solar")) {
    return { plan: "solar", cycle: "monthly" };
  }

  // Completo
  if (priceId === STRIPE_PRICES.completo.annual || (priceId.includes("completo") && priceId.includes("annual"))) {
    return { plan: "completo", cycle: "annual" };
  }
  if (priceId === STRIPE_PRICES.completo.monthly || priceId.includes("completo")) {
    return { plan: "completo", cycle: "monthly" };
  }

  return null;
};

/**
 * Garante ou recupera o Customer ID da Stripe para o usuário
 */
export const getOrCreateStripeCustomer = async (user: {
  id: string;
  email: string;
  fullName: string;
  customPermissions?: any;
}): Promise<string> => {
  // 1. Verifica se já existe gravado nos metadados/permissões
  const permissions =
    user.customPermissions && typeof user.customPermissions === "object"
      ? user.customPermissions
      : {};

  if (permissions.stripeCustomerId && typeof permissions.stripeCustomerId === "string") {
    return permissions.stripeCustomerId;
  }

  if (!env.STRIPE_SECRET_KEY) {
    // Retorna ID simulado se Stripe Secret Key não foi definida em desenvolvimento local
    return `cus_mock_${user.id}`;
  }

  // 2. Busca na Stripe se já existe cliente com esse e-mail
  try {
    const existing = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (existing.data.length > 0) {
      return existing.data[0].id;
    }

    // 3. Cria novo Customer na Stripe
    const newCustomer = await stripe.customers.create({
      email: user.email,
      name: user.fullName,
      metadata: {
        userId: user.id,
      },
    });

    return newCustomer.id;
  } catch (error: any) {
    throw new AppError(`Erro ao comunicar com a Stripe: ${error.message}`, 500);
  }
};
