import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

export const asaasConfigured = () => Boolean(env.ASAAS_API_KEY && !env.ASAAS_API_KEY.includes("..."));
export const asaasBaseUrl = env.ASAAS_ENVIRONMENT === "production"
  ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

export class AsaasError extends AppError {
  constructor(message: string, public remoteStatus: number) {
    super(message, remoteStatus === 400 || remoteStatus === 422 ? 400 : 503);
  }
}

export async function asaasRequest<T = any>(path: string, method = "GET", body?: unknown): Promise<T> {
  if (!asaasConfigured()) throw new AppError("Asaas não configurado no servidor.", 503);
  let response: Response;
  try {
    response = await fetch(`${asaasBaseUrl}${path}`, {
      method,
      headers: { access_token: env.ASAAS_API_KEY, "Content-Type": "application/json", "User-Agent": "NacifEnergy/1.0" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    // Never automatically retry a financial POST after an ambiguous network failure.
    throw new AsaasError("Comunicação com o Asaas indisponível. A operação será conciliada antes de uma nova tentativa.", 0);
  }
  const data = await response.json().catch(() => null) as any;
  if (!response.ok) {
    const detail = response.status === 400 || response.status === 422
      ? data?.errors?.map((error: any) => error.description).filter(Boolean).join(" ") : "";
    throw new AsaasError(detail || "Não foi possível concluir a operação no Asaas. Verifique a configuração ou tente novamente.", response.status);
  }
  if (!data) throw new AsaasError("Resposta inválida do Asaas; conciliação necessária.", 0);
  return data as T;
}

export async function asaasList(path: string): Promise<any[]> {
  const items: any[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await asaasRequest(`${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`);
    if (!Array.isArray(page.data)) throw new AsaasError("Listagem inválida do Asaas.", 0);
    items.push(...page.data);
    if (!page.hasMore) return items;
    if (offset >= 9900) throw new AppError("Conciliação excedeu o limite de registros; contate o suporte.", 503);
  }
}

export function validateAsaasWebhook(token: unknown) {
  const expected = env.ASAAS_WEBHOOK_TOKEN;
  if (expected.length < 32 || !asaasConfigured()) throw new AppError("Webhook Asaas não configurado.", 503);
  if (typeof token !== "string" || Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(expected)))
    throw new AppError("Token do webhook inválido.", 401);
}

export function safeInvoiceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const hosts = env.ASAAS_ENVIRONMENT === "production"
      ? ["www.asaas.com", "asaas.com"] : ["sandbox.asaas.com", "www.sandbox.asaas.com"];
    return url.protocol === "https:" && hosts.includes(url.hostname) ? url.toString() : null;
  } catch { return null; }
}
