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
 * Links Diretos de Pagamento da Stripe (Stripe Payment Links)
 * Permite processar pagamentos na produção mesmo sem manter um servidor backend ativo 24h
 */
export const STRIPE_PAYMENT_LINKS = {
  estudante: {
    monthly:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_LINK_ESTUDANTE_MONTHLY) || "",
  },
  eletrico: {
    monthly:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_LINK_ELETRICO_MONTHLY) || "",
    annual:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_LINK_ELETRICO_ANNUAL) || "",
  },
  solar: {
    monthly:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_LINK_SOLAR_MONTHLY) || "",
    annual:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_LINK_SOLAR_ANNUAL) || "",
  },
  completo: {
    monthly:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_LINK_COMPLETO_MONTHLY) || "",
    annual:
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_LINK_COMPLETO_ANNUAL) || "",
  },
};

/**
 * Obtém o link direto de pagamento da Stripe caso configurado
 */
export function getPlanPaymentLink(planCode, cycle = "monthly") {
  if (!planCode) return null;
  const planLinks = STRIPE_PAYMENT_LINKS[planCode];
  if (!planLinks) return null;
  if (planCode === "estudante") return planLinks.monthly || null;
  if (cycle === "annual" && planLinks.annual) return planLinks.annual || null;
  return planLinks.monthly || null;
}

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
/**
 * Obtém a URL base da API da Stripe com resolução inteligente:
 * 1. import.meta.env.VITE_API_BASE_URL (se definido)
 * 2. localStorage override ('nacif_api_base_url')
 * 3. Fallback para http://localhost:3001 quando em desenvolvimento local
 */
export function getStripeApiBaseUrl() {
  const envUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const customUrl =
      window.localStorage.getItem("nacif_api_base_url") ||
      window.localStorage.getItem("voltai_api_base_url");
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/+$/, "");
    }

    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:3001";
    }
  }

  return "";
}

/**
 * Comunica com o backend para gerar uma nova Checkout Session da Stripe
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
  const directPaymentLink = getPlanPaymentLink(planCode, cycle);
  const baseUrl = getStripeApiBaseUrl();

  // Se estiver em produção web sem backend configurado, utiliza o link direto de pagamento do Stripe se disponível
  if (
    !baseUrl &&
    directPaymentLink &&
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return {
      url: directPaymentLink,
      isDirectPaymentLink: true,
    };
  }

  if (!priceId && !directPaymentLink) {
    throw new Error("Identificador de preço (priceId) é obrigatório.");
  }

  const token =
    (typeof window !== "undefined" &&
      (window.localStorage.getItem("voltai_access_token") ||
        window.localStorage.getItem("voltai_token"))) ||
    "";

  // Monta lista de endpoints candidatos em ordem de prioridade
  const candidateEndpoints = [];
  if (baseUrl) {
    candidateEndpoints.push(`${baseUrl}/create-checkout-session`);
    candidateEndpoints.push(`${baseUrl}/api/create-checkout-session`);
    candidateEndpoints.push(`${baseUrl}/api/subscriptions/create-checkout-session`);
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    if (!candidateEndpoints.includes("http://localhost:3001/create-checkout-session")) {
      candidateEndpoints.push("http://localhost:3001/create-checkout-session");
      candidateEndpoints.push("http://localhost:3001/api/create-checkout-session");
    }
  }

  candidateEndpoints.push("/api/create-checkout-session");
  candidateEndpoints.push("/create-checkout-session");

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
          priceId,
          planCode,
          cycle,
          userId,
          userEmail: userEmail || email,
          userName: userName || name,
        }),
      });

      // Se o endpoint retornar 405 (Method Not Allowed em servidor estático) ou 404, tenta o próximo
      if (response.status === 405 || response.status === 404) {
        lastError = new Error(
          `O servidor em ${endpoint} respondeu com status ${response.status} (Método POST não suportado em rota estática).`
        );
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      lastError = err;
    }
  }

  // Se todos os endpoints falharem, mas existir um link de pagamento direto para o plano:
  if (directPaymentLink) {
    return {
      url: directPaymentLink,
      isDirectPaymentLink: true,
    };
  }

  throw (
    lastError ||
    new Error(
      "Falha ao comunicar com o servidor da Stripe. Em produção, configure VITE_API_BASE_URL apontando para a API do backend ou configure os links diretos de pagamento VITE_STRIPE_LINK_*."
    )
  );
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
  const baseUrl = getStripeApiBaseUrl();

  const token =
    (typeof window !== "undefined" &&
      (window.localStorage.getItem("voltai_access_token") ||
        window.localStorage.getItem("voltai_token"))) ||
    "";

  const candidateEndpoints = [];
  if (baseUrl) {
    candidateEndpoints.push(`${baseUrl}/create-portal-session`);
    candidateEndpoints.push(`${baseUrl}/api/create-portal-session`);
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    if (!candidateEndpoints.includes("http://localhost:3001/create-portal-session")) {
      candidateEndpoints.push("http://localhost:3001/create-portal-session");
    }
  }

  candidateEndpoints.push("/api/create-portal-session");
  candidateEndpoints.push("/create-portal-session");

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
          userEmail: userEmail || email,
          userName: userName || name,
        }),
      });

      if (response.status === 405 || response.status === 404) {
        lastError = new Error(
          `O servidor em ${endpoint} respondeu com status ${response.status} (Método POST não suportado em rota estática).`
        );
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      lastError = err;
    }
  }

  throw (
    lastError ||
    new Error(
      "Falha ao comunicar com o servidor do Customer Portal da Stripe."
    )
  );
}

/**
 * Comunica com o backend para validar a Checkout Session da Stripe e sincronizar o plano
 */
export async function verifyCheckoutSession({ sessionId }) {
  if (!sessionId) return null;

  const baseUrl = getStripeApiBaseUrl();

  const token =
    (typeof window !== "undefined" &&
      (window.localStorage.getItem("voltai_access_token") ||
        window.localStorage.getItem("voltai_token"))) ||
    "";

  const candidateEndpoints = [];
  if (baseUrl) {
    candidateEndpoints.push(`${baseUrl}/verify-checkout-session`);
    candidateEndpoints.push(`${baseUrl}/api/verify-checkout-session`);
  }

  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    if (!candidateEndpoints.includes("http://localhost:3001/verify-checkout-session")) {
      candidateEndpoints.push("http://localhost:3001/verify-checkout-session");
    }
  }

  candidateEndpoints.push("/api/verify-checkout-session");
  candidateEndpoints.push("/verify-checkout-session");

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
        return await response.json();
      }
    } catch {
      // continua tentando próximo
    }
  }

  return null;
}

