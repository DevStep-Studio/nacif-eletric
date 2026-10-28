/**
 * Configuração e Mapeamento Oficial de Preços e API do Stripe Billing — Nacif Energy
 *
 * Regras de Negócio:
 * - Nacif Estudante: APENAS faturamento mensal (R$ 99,99/mês). O toggle anual NÃO afeta este plano.
 * - Nacif Elétrico: Mensal (R$ 149,90) ou Anual (-30% OFF -> R$ 1.259,16)
 * - Nacif Solar: Mensal (R$ 149,90) ou Anual (-30% OFF -> R$ 1.259,16)
 * - Nacif Completo: Mensal (R$ 210,00) ou Anual (-30% OFF -> R$ 1.764,00)
 */

const getEnvVar = (key) => {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    const val = String(import.meta.env[key]).trim();
    if (val && !val.startsWith("price_test_") && !val.includes("...")) {
      return val;
    }
  }
  return "";
};

export const STRIPE_TEST_PRICE_IDS = {
  estudante: {
    monthly: getEnvVar("VITE_STRIPE_PRICE_ESTUDANTE_MONTHLY") || "price_1UVAQqJl6h9d8TBMRYFoOdBM",
    // NOTA: Estudante NÃO POSSUI chave anual por regra de negócio
  },
  eletrico: {
    monthly: getEnvVar("VITE_STRIPE_PRICE_ELETRICO_MONTHLY") || "price_1UVAS5Jl6h9d8TBMQLt9F7nB",
    annual: getEnvVar("VITE_STRIPE_PRICE_ELETRICO_ANNUAL") || "price_1UVAfiJl6h9d8TBMcF6J01KS",
  },
  solar: {
    monthly: getEnvVar("VITE_STRIPE_PRICE_SOLAR_MONTHLY") || "price_1UVAX2Jl6h9d8TBMkWZsDn0s",
    annual: getEnvVar("VITE_STRIPE_PRICE_SOLAR_ANNUAL") || "price_1UVAgGJl6h9d8TBMmK3sEsRZ",
  },
  completo: {
    monthly: getEnvVar("VITE_STRIPE_PRICE_COMPLETO_MONTHLY") || "price_1UVAYaJl6h9d8TBMc8YTZsHp",
    annual: getEnvVar("VITE_STRIPE_PRICE_COMPLETO_ANNUAL") || "price_1UVAgoJl6h9d8TBMubc39FAP",
  },
};

/**
 * Links Diretos Oficiais de Pagamento da Stripe (Stripe Payment Links)
 * Atuam como fallback de alta disponibilidade caso o proxy reverso /api esteja em reinicialização
 */
export const STRIPE_PAYMENT_LINKS = {
  estudante: {
    monthly:
      getEnvVar("VITE_STRIPE_LINK_ESTUDANTE_MONTHLY") ||
      "https://buy.stripe.com/test_eVq9AU2j39m1dfl6HkbQY01",
  },
  eletrico: {
    monthly:
      getEnvVar("VITE_STRIPE_LINK_ELETRICO_MONTHLY") ||
      "https://buy.stripe.com/test_dRmdRa7Dncyd4IPc1EbQY02",
    annual:
      getEnvVar("VITE_STRIPE_LINK_ELETRICO_ANNUAL") ||
      "https://buy.stripe.com/test_3cI3cwaPz69P7V19TwbQY03",
  },
  solar: {
    monthly:
      getEnvVar("VITE_STRIPE_LINK_SOLAR_MONTHLY") ||
      "https://buy.stripe.com/test_3cI9AUe1LdCh0sz9TwbQY04",
    annual:
      getEnvVar("VITE_STRIPE_LINK_SOLAR_ANNUAL") ||
      "https://buy.stripe.com/test_6oU14o8Hr9m12AH9TwbQY05",
  },
  completo: {
    monthly:
      getEnvVar("VITE_STRIPE_LINK_COMPLETO_MONTHLY") ||
      "https://buy.stripe.com/test_dRm00k6zj1Tzfnte9MbQY06",
    annual:
      getEnvVar("VITE_STRIPE_LINK_COMPLETO_ANNUAL") ||
      "https://buy.stripe.com/test_28E5kE5vf2XD3ELe9MbQY07",
  },
};

export const STRIPE_PORTAL_LOGIN_URL =
  getEnvVar("VITE_STRIPE_PORTAL_LOGIN_URL") ||
  "https://billing.stripe.com/p/login/test_14A00k8Hrbu91wD0iWbQY00";

/**
 * Obtém o link direto de pagamento da Stripe para o plano/ciclo, enriquecido com dados do cliente
 */
export function getPlanPaymentLink(planCode, cycle = "monthly", { userId, userEmail } = {}) {
  if (!planCode) return null;
  const planLinks = STRIPE_PAYMENT_LINKS[planCode];
  if (!planLinks) return null;

  const rawLink =
    planCode === "estudante"
      ? planLinks.monthly || null
      : cycle === "annual" && planLinks.annual
        ? planLinks.annual
        : planLinks.monthly || null;

  if (!rawLink) return null;

  try {
    const url = new URL(rawLink);
    if (userEmail && String(userEmail).includes("@")) {
      url.searchParams.set("prefilled_email", String(userEmail).trim());
    }
    if (userId) {
      url.searchParams.set("client_reference_id", String(userId).trim());
    }
    url.searchParams.set("locale", "pt-BR");
    return url.toString();
  } catch {
    return rawLink;
  }
}

export function getDirectStripePortalUrl(userEmail) {
  try {
    const url = new URL(STRIPE_PORTAL_LOGIN_URL);
    if (userEmail && String(userEmail).includes("@")) {
      url.searchParams.set("prefilled_email", String(userEmail).trim());
    }
    return url.toString();
  } catch {
    return STRIPE_PORTAL_LOGIN_URL;
  }
}

/**
 * Obtém o priceId oficial da Stripe com base no plano e no toggle selecionado.
 */
export function getPlanPriceId(planCode, cycle = "monthly") {
  const planPrices = STRIPE_TEST_PRICE_IDS[planCode];
  if (!planPrices) return null;

  // REGRA DE NEGÓCIO: O plano Estudante é estritamente mensal. O toggle anual não o afeta.
  if (planCode === "estudante") {
    return planPrices.monthly;
  }

  if (cycle === "annual" && planPrices.annual) {
    return planPrices.annual;
  }

  return planPrices.monthly;
}

const isLocalhostBrowser = () => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
};

/**
 * Obtém a URL base externa da API (retorna "" quando same-origin para usar /api/* sem duplicidade ou 405)
 */
export function getStripeApiBaseUrl() {
  const isLocal = isLocalhostBrowser();
  const rawEnvUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

  const candidates = [];
  if (typeof window !== "undefined") {
    const customUrl =
      window.localStorage.getItem("nacif_api_base_url") ||
      window.localStorage.getItem("voltai_api_base_url");
    if (customUrl && customUrl.trim()) {
      candidates.push(customUrl.trim());
    }
  }
  if (rawEnvUrl && rawEnvUrl.trim()) {
    candidates.push(rawEnvUrl.trim());
  }

  for (const candidate of candidates) {
    const normalized = candidate.replace(/\/+$/, "");
    // Ignora localhost:3001 caso tenha sido embutido por engano em build de produção
    if (!isLocal && (normalized.includes("localhost") || normalized.includes("127.0.0.1"))) {
      continue;
    }
    // Se apontar para a própria origem do frontend (ex: https://nacifenergy.com.br), trata como same-origin ("")
    // para chamar apenas rotas /api/* via proxy Nginx e evitar erro 405 em rotas estáticas
    if (typeof window !== "undefined" && normalized === window.location.origin) {
      return "";
    }
    return normalized;
  }

  if (isLocal) {
    return "http://localhost:3001";
  }

  return "";
}

function buildApiEndpoints(routeSuffix) {
  const cleanSuffix = routeSuffix.replace(/^\/+/, "");
  const baseUrl = getStripeApiBaseUrl();
  const isLocal = isLocalhostBrowser();
  const endpoints = new Set();

  if (isLocal) {
    // Em dev local (Vite proxy ou Fastify direto em :3001)
    endpoints.add(`/api/subscriptions/${cleanSuffix}`);
    endpoints.add(`/api/${cleanSuffix}`);
    endpoints.add(`http://localhost:3001/api/subscriptions/${cleanSuffix}`);
    endpoints.add(`http://localhost:3001/${cleanSuffix}`);
  } else if (baseUrl) {
    // Em produção com domínio de API dedicado (ex: https://api.nacifenergy.com.br)
    endpoints.add(`${baseUrl}/api/subscriptions/${cleanSuffix}`);
    endpoints.add(`${baseUrl}/api/${cleanSuffix}`);
    endpoints.add(`${baseUrl}/${cleanSuffix}`);
  } else {
    // Em produção same-origin (ex: https://nacifenergy.com.br -> Nginx proxy /api/*)
    // Nunca chama /create-checkout-session na raiz estática para evitar erro 405 Method Not Allowed
    endpoints.add(`/api/subscriptions/${cleanSuffix}`);
    endpoints.add(`/api/${cleanSuffix}`);
  }

  return Array.from(endpoints);
}

function getAuthToken() {
  if (typeof window === "undefined") return "";
  return (
    window.localStorage.getItem("voltai_access_token") ||
    window.localStorage.getItem("voltai_token") ||
    ""
  );
}

/**
 * Comunica com a API da Stripe para gerar uma Checkout Session vinculada às assinaturas Nacif
 */
export async function createCheckoutSession({
  priceId,
  planCode,
  cycle = "monthly",
  userId,
  userEmail,
  userName,
  email,
  name,
}) {
  const effectiveCycle = planCode === "estudante" ? "monthly" : cycle;
  const resolvedPriceId = priceId || getPlanPriceId(planCode, effectiveCycle);
  const resolvedEmail = userEmail || email;
  const resolvedName = userName || name;
  const directPaymentLink = getPlanPaymentLink(planCode, effectiveCycle, {
    userId,
    userEmail: resolvedEmail,
  });

  if (!resolvedPriceId && !directPaymentLink) {
    throw new Error("Identificador de preço (priceId) é obrigatório.");
  }

  const token = getAuthToken();
  const candidateEndpoints = buildApiEndpoints("create-checkout-session");
  let lastError = null;

  for (const endpoint of candidateEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          priceId: resolvedPriceId,
          planCode,
          cycle: effectiveCycle,
          userId,
          userEmail: resolvedEmail,
          userName: resolvedName,
        }),
      });

      if (
        response.status === 404 ||
        response.status === 405 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504
      ) {
        lastError = new Error(`Servidor de API indisponível em ${endpoint} (HTTP ${response.status}).`);
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();

      // Se o backend retornou modo simulado por ausência de chave secreta, prefere o link oficial real da Stripe
      if (data?.simulated && directPaymentLink) {
        return {
          url: directPaymentLink,
          isDirectPaymentLink: true,
          provider: "stripe_payment_link",
        };
      }

      if (data?.url) {
        return data;
      }
    } catch (err) {
      lastError = err;
    }
  }

  // Fallback automático de alta disponibilidade via Stripe Payment Link oficial do plano Nacif
  if (directPaymentLink) {
    return {
      url: directPaymentLink,
      isDirectPaymentLink: true,
      provider: "stripe_payment_link",
    };
  }

  throw (
    lastError ||
    new Error("Não foi possível iniciar o checkout da Stripe no momento. Tente novamente em instantes.")
  );
}

/**
 * Comunica com a API para gerar uma Customer Portal Session da Stripe
 */
export async function createPortalSession({
  userId,
  userEmail,
  userName,
  email,
  name,
  stripeCustomerId,
  allowDirectFallback = true,
} = {}) {
  const resolvedEmail = userEmail || email;
  const resolvedName = userName || name;
  const token = getAuthToken();
  const candidateEndpoints = buildApiEndpoints("create-portal-session");
  let lastError = null;

  for (const endpoint of candidateEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          userEmail: resolvedEmail,
          userName: resolvedName,
          stripeCustomerId,
        }),
      });

      if (
        response.status === 404 ||
        response.status === 405 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504
      ) {
        lastError = new Error(`Portal API indisponível em ${endpoint} (HTTP ${response.status}).`);
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data?.simulated && allowDirectFallback) {
        return {
          url: getDirectStripePortalUrl(resolvedEmail),
          isDirectPortalLink: true,
        };
      }

      if (data?.url) {
        return data;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (allowDirectFallback) {
    return {
      url: getDirectStripePortalUrl(resolvedEmail),
      isDirectPortalLink: true,
    };
  }

  throw lastError || new Error("Falha ao comunicar com o Customer Portal da Stripe.");
}

/**
 * Valida a Checkout Session da Stripe após retorno e obtém dados reais do contrato
 */
export async function verifyCheckoutSession({ sessionId }) {
  if (!sessionId || sessionId === "{CHECKOUT_SESSION_ID}") return null;

  const token = getAuthToken();
  const candidateEndpoints = buildApiEndpoints("verify-checkout-session");

  for (const endpoint of candidateEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.success) {
          return data;
        }
      }
    } catch {
      // continua tentando próximo endpoint
    }
  }

  return null;
}

/**
 * Sincroniza em segundo plano o estado real da assinatura do usuário na Stripe
 */
export async function syncStripeSubscription({ userId, userEmail, stripeCustomerId } = {}) {
  if (!userEmail && !stripeCustomerId) return null;

  const token = getAuthToken();
  const candidateEndpoints = buildApiEndpoints("sync-stripe");

  for (const endpoint of candidateEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          userEmail,
          stripeCustomerId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.synced) {
          return data;
        }
      }
    } catch {
      // falha silenciosa caso API não esteja acessível
    }
  }

  return null;
}
