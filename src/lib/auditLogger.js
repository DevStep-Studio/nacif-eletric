/**
 * Gerenciador de Auditoria e Logs Administrativos
 * Registra todas as ações sensíveis com identificação de ator, ação e timestamp.
 */

const LOCAL_AUDIT_LOGS_KEY = "voltai_superadmin_audit_logs_v1";
export const AUDIT_LOGS_EVENT = "nacif:audit-logs-changed";

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function readAuditLogs() {
  const store = getStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(LOCAL_AUDIT_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeAuditLogs(logs) {
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(logs.slice(0, 500)));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUDIT_LOGS_EVENT, { detail: logs[0] }));
    }
  } catch (err) {
    console.warn("[writeAuditLogs] Erro ao gravar logs de auditoria:", err);
  }
}

/**
 * Registra um evento de auditoria
 */
export function recordAuditEvent({
  actor = null,
  action,
  targetType = "user",
  targetId = null,
  targetName = "",
  details = "",
  metadata = {},
}) {
  const logs = readAuditLogs();
  const timestamp = new Date().toISOString();

  // Higieniza metadata para evitar senhas, tokens ou dados sensíveis
  const safeMetadata = { ...metadata };
  delete safeMetadata.password;
  delete safeMetadata.token;
  delete safeMetadata.resetToken;
  delete safeMetadata.creditCard;

  const entry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    actor_id: actor?.id || "sistema",
    actor_name: actor?.full_name || actor?.name || "Administrador",
    actor_email: actor?.email || "sistema@nacif.com",
    actor_role: actor?.role || "super_admin",
    action,
    target_type: targetType,
    target_id: targetId,
    target_name: targetName,
    details,
    metadata: safeMetadata,
    ip_address: "127.0.0.1",
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "Node.js",
  };

  const nextLogs = [entry, ...logs].slice(0, 500);
  writeAuditLogs(nextLogs);
  return entry;
}

/**
 * Helper para filtros de logs
 */
export function filterAuditLogs(logs, { search = "", action = "todos", limit = 100 } = {}) {
  let result = [...logs];

  if (action && action !== "todos") {
    result = result.filter((l) => l.action === action);
  }

  if (search.trim()) {
    const q = search.toLowerCase().trim();
    result = result.filter(
      (l) =>
        l.actor_name?.toLowerCase().includes(q) ||
        l.actor_email?.toLowerCase().includes(q) ||
        l.target_name?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q)
    );
  }

  return result.slice(0, limit);
}
