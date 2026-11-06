import { request } from "@/api/backendClient";

export async function createCheckoutSession({ planCode, cycle = "monthly" }) {
  return request("/api/subscriptions/create-checkout-session", { method: "POST", body: { planCode, cycle } });
}
export async function createPortalSession() {
  return request("/api/subscriptions/create-portal-session", { method: "POST", body: {} });
}
export async function verifyCheckoutSession({ sessionId }) {
  return request("/api/subscriptions/verify-checkout-session", { method: "POST", body: { sessionId } });
}
export async function syncStripeSubscription() {
  return request("/api/subscriptions/sync-stripe", { method: "POST", body: {} });
}
