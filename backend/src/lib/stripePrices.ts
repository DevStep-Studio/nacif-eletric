import { COMMERCIAL_PLANS } from "./planCatalog.js";
import { AppError } from "./errors.js";
import {
  stripe,
  STRIPE_PRICES,
  isStripeConfigured,
  isStripeLiveMode,
  stripeEnvironment,
} from "./stripe.js";

export async function getCheckoutPrice(
  planCode: string,
  cycle: string,
): Promise<string> {
  const plan = COMMERCIAL_PLANS.find((p) => p.code === planCode);
  if (
    !plan ||
    !["monthly", "annual"].includes(cycle) ||
    (cycle === "annual" && !plan.hasAnnualOption)
  )
    throw new AppError("Plano ou ciclo de cobrança inválido.", 400);
  const variable = `STRIPE_PRICE_${planCode.toUpperCase()}_${cycle.toUpperCase()}`;
  const prices = STRIPE_PRICES[
    planCode as keyof typeof STRIPE_PRICES
  ] as Record<string, string>;
  const id = prices[cycle];
  if (!id || !/^price_[A-Za-z0-9]+$/.test(id))
    throw new AppError(
      `Configure ${variable} no backend com um preço da sua conta Stripe.`,
      503,
    );
  if (!isStripeConfigured)
    throw new AppError("Stripe não configurada no backend.", 503);
  let price;
  try {
    price = await stripe.prices.retrieve(id);
  } catch (error: any) {
    if (error.code === "resource_missing")
      throw new AppError(
        `${variable}: preço não encontrado na conta Stripe em modo ${stripeEnvironment}. Configure um ID da mesma conta e ambiente da chave do backend.`,
        503,
      );
    if (
      error.type === "StripeAuthenticationError" ||
      error.type === "StripePermissionError"
    )
      throw new AppError(
        "A chave Stripe do backend é inválida ou não permite consultar preços.",
        503,
      );
    throw new AppError(
      "Não foi possível validar o preço na Stripe. Tente novamente mais tarde.",
      503,
    );
  }
  const amount = Math.round(
    (cycle === "annual" ? plan.annualPrice : plan.monthlyPrice) * 100,
  );
  if (
    !price.active ||
    price.livemode !== isStripeLiveMode ||
    price.type !== "recurring" ||
    price.currency !== "brl" ||
    price.unit_amount !== amount ||
    price.recurring?.interval !== (cycle === "annual" ? "year" : "month") ||
    price.recurring.interval_count !== 1 ||
    price.recurring.usage_type !== "licensed"
  ) {
    throw new AppError(
      `${variable}: o preço precisa estar ativo e corresponder ao valor em BRL, ciclo e ambiente do plano ${plan.name}.`,
      503,
    );
  }
  return id;
}
