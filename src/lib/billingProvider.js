export function createBillingProvider(user = {}) {
  const provider = user?.subscription?.provider || user?.billing_provider || "manual";
  const isConfigured = Boolean(provider && provider !== "manual");

  return {
    provider,
    isConfigured,
    async startCheckout(_options = {}) {
      if (!isConfigured) {
        throw new Error("Cobrança ainda não configurada");
      }

      return { provider, status: "pending" };
    },
    async openCustomerPortal(_options = {}) {
      if (!isConfigured) {
        throw new Error("Portal de cobrança ainda não configurado");
      }

      return { provider, status: "pending" };
    },
  };
}
