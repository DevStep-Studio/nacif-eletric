import { request } from "@/api/backendClient";

export const createCheckoutSession = ({ planCode, cycle = "monthly", billingType, billingDetails }) => request("/api/subscriptions/create-checkout-session", { method: "POST", body: { planCode, cycle, billingType, billingDetails } });
export const verifyCheckoutSession = ({ subscriptionId }) => request("/api/subscriptions/verify-checkout-session", { method: "POST", body: { subscriptionId } });
export const syncSubscription = () => request("/api/subscriptions/sync", { method: "POST", body: {} });
export const getBillingDetails = () => request("/api/subscriptions/billing");
export const BILLING_TYPE_LABELS = { CREDIT_CARD: "Cartão de crédito", PIX: "Pix", BOLETO: "Boleto bancário" };
