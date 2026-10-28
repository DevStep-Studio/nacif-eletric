/**
 * Configuração e Mapeamento de Preços do Stripe Billing para o Nacif Energy
 *
 * Regras de Negócio:
 * - Nacif Estudante: APENAS faturamento mensal (R$ 99,99/mês). O toggle anual NÃO afeta este plano.
 * - Nacif Elétrico: Mensal (R$ 149,90) ou Anual (-30% OFF)
 * - Nacif Solar: Mensal (R$ 149,90) ou Anual (-30% OFF)
 * - Nacif Completo: Mensal (R$ 210,00) ou Anual (-30% OFF)
 */

export const STRIPE_TEST_PRICE_IDS = {
  estudante: {
    monthly:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PRICE_ESTUDANTE_MONTHLY) ||
      "price_test_estudante_monthly",
    // NOTA: Estudante NÃO POSSUI chave anual por regra de negócio
  },
  eletrico: {
    monthly:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PRICE_ELETRICO_MONTHLY) ||
      "price_test_eletrico_monthly",
    annual:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PRICE_ELETRICO_ANNUAL) ||
      "price_test_eletrico_annual",
  },
  solar: {
    monthly:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PRICE_SOLAR_MONTHLY) ||
      "price_test_solar_monthly",
    annual:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PRICE_SOLAR_ANNUAL) ||
      "price_test_solar_annual",
  },
  completo: {
    monthly:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PRICE_COMPLETO_MONTHLY) ||
      "price_test_completo_monthly",
    annual:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_PRICE_COMPLETO_ANNUAL) ||
      "price_test_completo_annual",
  },
};

/**
 * Obtém o priceId correto da Stripe com base no plano e no toggle selecionado.
 *
 * @param {string} planCode - Código do plano ('estudante', 'eletrico', 'solar', 'completo')
 * @param {string} cycle - Ciclo selecionado ('monthly' ou 'annual')
 * @returns {string} - ID de preço da Stripe correspondente
 */
export function getPlanPriceId(planCode, cycle = "monthly") {
  const planPrices = STRIPE_TEST_PRICE_IDS[planCode];
  if (!planPrices) return null;

  // REGRA DE NEGÓCIO: O plano Estudante é estritamente mensal. O toggle anual não o afeta.
  if (planCode === "estudante") {
    return planPrices.monthly;
  }

  // Planos Elétrico, Solar e Completo:
  if (cycle === "annual" && planPrices.annual) {
    return planPrices.annual;
  }

  return planPrices.monthly;
}

/**
 * Comunica com o backend para gerar uma nova Checkout Session da Stripe
 */
export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  userName,
  email,
  name,
}) {
  if (!priceId) {
    throw new Error("Identificador de preço (priceId) é obrigatório.");
  }

  const rawApiBaseUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";
  const baseUrl = rawApiBaseUrl.replace(/\/+$/, "");

  const token =
    (typeof window !== "undefined" &&
      (window.localStorage.getItem("voltai_access_token") ||
        window.localStorage.getItem("voltai_token"))) ||
    "";

  // Tenta o endpoint raiz /create-checkout-session ou prefixado
  const endpoint = baseUrl ? `${baseUrl}/create-checkout-session` : "/create-checkout-session";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      priceId,
      userId,
      userEmail: userEmail || email,
      userName: userName || name,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Comunica com o backend para gerar uma nova Customer Portal Session da Stripe
 */
export async function createPortalSession({
  userId,
  userEmail,
  userName,
  email,
  name,
} = {}) {
  const rawApiBaseUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";
  const baseUrl = rawApiBaseUrl.replace(/\/+$/, "");

  const token =
    (typeof window !== "undefined" &&
      (window.localStorage.getItem("voltai_access_token") ||
        window.localStorage.getItem("voltai_token"))) ||
    "";

  const endpoint = baseUrl ? `${baseUrl}/create-portal-session` : "/create-portal-session";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      userId,
      userEmail: userEmail || email,
      userName: userName || name,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Comunica com o backend para validar a Checkout Session da Stripe e sincronizar o plano
 */
export async function verifyCheckoutSession({ sessionId }) {
  if (!sessionId) return null;

  const rawApiBaseUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";
  const baseUrl = rawApiBaseUrl.replace(/\/+$/, "");

  const token =
    (typeof window !== "undefined" &&
      (window.localStorage.getItem("voltai_access_token") ||
        window.localStorage.getItem("voltai_token"))) ||
    "";

  const endpoint = baseUrl ? `${baseUrl}/verify-checkout-session` : "/verify-checkout-session";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

