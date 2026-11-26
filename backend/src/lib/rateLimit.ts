/**
 * Utilitário de Rate Limiting e Proteção contra Força Bruta em Memória — Nacif Energy
 */

type RateEntry = {
  count: number;
  windowStart: number;
};

const rateStore = new Map<string, RateEntry>();
const failedLoginStore = new Map<string, RateEntry>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_STORE_ENTRIES = 10000;

function cleanupExpiredEntries(now = Date.now(), maxAgeMs = 30 * 60 * 1000) {
  if (rateStore.size > MAX_STORE_ENTRIES) {
    for (const [k, v] of rateStore.entries()) {
      if (now - v.windowStart > maxAgeMs) rateStore.delete(k);
    }
  }
  if (failedLoginStore.size > MAX_STORE_ENTRIES) {
    for (const [k, v] of failedLoginStore.entries()) {
      if (now - v.windowStart > maxAgeMs) failedLoginStore.delete(k);
    }
  }
}

setInterval(() => cleanupExpiredEntries(), CLEANUP_INTERVAL_MS).unref?.();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const entry = rateStore.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    rateStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSeconds: 0,
    };
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - entry.windowStart)) / 1000),
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  entry.count += 1;
  rateStore.set(key, entry);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - entry.count),
    retryAfterSeconds: 0,
  };
}

export function isLoginBlocked(
  key: string,
  maxAttempts = 8,
  lockoutMs = 15 * 60 * 1000,
): { blocked: boolean; retryAfterMinutes: number } {
  const now = Date.now();
  const entry = failedLoginStore.get(key);
  if (!entry) return { blocked: false, retryAfterMinutes: 0 };

  if (now - entry.windowStart >= lockoutMs) {
    failedLoginStore.delete(key);
    return { blocked: false, retryAfterMinutes: 0 };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterMinutes = Math.max(
      1,
      Math.ceil((lockoutMs - (now - entry.windowStart)) / 60000),
    );
    return { blocked: true, retryAfterMinutes };
  }

  return { blocked: false, retryAfterMinutes: 0 };
}

export function recordFailedLoginAttempt(
  key: string,
  maxAttempts = 8,
  lockoutMs = 15 * 60 * 1000,
): { blocked: boolean; remaining: number; retryAfterMinutes: number } {
  const now = Date.now();
  const entry = failedLoginStore.get(key);

  if (!entry || now - entry.windowStart >= lockoutMs) {
    failedLoginStore.set(key, { count: 1, windowStart: now });
    return {
      blocked: false,
      remaining: Math.max(0, maxAttempts - 1),
      retryAfterMinutes: 0,
    };
  }

  entry.count += 1;
  entry.windowStart = now;
  failedLoginStore.set(key, entry);

  const blocked = entry.count >= maxAttempts;
  const retryAfterMinutes = blocked ? Math.ceil(lockoutMs / 60000) : 0;

  return {
    blocked,
    remaining: Math.max(0, maxAttempts - entry.count),
    retryAfterMinutes,
  };
}

export function clearFailedLoginAttempts(key: string): void {
  failedLoginStore.delete(key);
}
