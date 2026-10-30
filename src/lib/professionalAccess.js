export const PROFESSIONS = [
  { value: "engenheiro", label: "Engenheiro" },
  { value: "projetista", label: "Projetista" },
  { value: "eletricista", label: "Eletricista" },
  { value: "arquiteto", label: "Arquiteto" },
  { value: "tecnico", label: "Técnico Eletrotécnico" },
  { value: "estudante", label: "Estudante" },
];

export const PENDING_REGISTER_PROFESSION_KEY = "voltai_pending_register_profession";

const normalizeText = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

export function normalizeProfession(value = "") {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.includes("arquit")) return "arquiteto";
  if (text.includes("engenh")) return "engenheiro";
  if (text.includes("proj")) return "projetista";
  if (text.includes("tecn")) return "tecnico";
  if (text.includes("estud") || text.includes("acad")) return "estudante";
  if (text.includes("elet")) return "eletricista";
  return "";
}

export function professionLabel(value = "") {
  const normalized = normalizeProfession(value);
  return PROFESSIONS.find((item) => item.value === normalized)?.label || "Projetista";
}

export const SUPER_ADMIN_EMAILS = [
  "admin@nacif.com",
  "grc22.09@hotmail.com",
  "ian.mellofla@gmail.com",
  "wellingtonalfredo550@gmail.com",
  "comercial@nacifsolutions.com.br",
  "gabrielderezende13@gmail.com",
];

export function isSuperAdmin(user) {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.is_super_admin === true) return true;
  const email = String(user.email || "").toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    return true;
  }
  if (user.role === "admin" && (email === "admin@nacif.com" || user.id === "local_admin_default")) {
    return true;
  }
  return false;
}

export function isAdminUser(user) {
  if (!user) return false;
  return Boolean(isSuperAdmin(user) || user.role === "admin" || user.role === "super_admin");
}

export function isArchitectUser(user) {
  return !isAdminUser(user) && normalizeProfession(user?.profession || user?.profissao) === "arquiteto";
}

export function canAccessSuperAdmin(user) {
  return isSuperAdmin(user);
}

/**
 * Todos os usuários autenticados e ativos (incluindo Arquiteto, Projetista,
 * Engenheiro, Eletricista, Técnico e Estudante) acessam o Dashboard e a navegação
 * do sistema. A liberação de recursos avançados é controlada pelo plano contratado
 * (ModuleAccessGate / subscriptionPlans) e permissões administrativas (RBAC).
 */
export function hasFullSystemAccess(user) {
  if (!user) return false;
  if (user.status === "suspended" || user.is_deleted) return false;
  return true;
}

export function getDefaultAuthenticatedRoute() {
  return "/";
}

export function canAccessPath(user, path = "") {
  if (!user || user.status === "suspended" || user.is_deleted) return false;
  const cleanPath = String(path || "").split("?")[0] || "/";
  if (cleanPath === "/super-admin" || cleanPath.startsWith("/super-admin/")) {
    return canAccessSuperAdmin(user);
  }
  if (cleanPath === "/admin" || cleanPath.startsWith("/admin/")) {
    return isAdminUser(user);
  }
  return true;
}

export function filterNavItemsForUser(items = [], user) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => canAccessPath(user, item?.path || ""));
}
