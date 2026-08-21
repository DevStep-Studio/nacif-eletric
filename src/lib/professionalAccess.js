export const PROFESSIONS = [
  { value: "eletricista", label: "Eletricista" },
  { value: "projetista", label: "Projetista" },
  { value: "arquiteto", label: "Arquiteto" },
];

export const PENDING_REGISTER_PROFESSION_KEY = "voltai_pending_register_profession";

const normalizeText = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

export function normalizeProfession(value = "") {
  const text = normalizeText(value);
  if (text.includes("arquit")) return "arquiteto";
  if (text.includes("elet")) return "eletricista";
  if (text.includes("proj")) return "projetista";
  return "";
}

export function professionLabel(value = "") {
  const normalized = normalizeProfession(value);
  return PROFESSIONS.find((item) => item.value === normalized)?.label || "Projetista";
}

export function isArchitectUser(user) {
  return user?.role !== "admin" && normalizeProfession(user?.profession || user?.profissao) === "arquiteto";
}

export function hasFullSystemAccess(user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  const profession = normalizeProfession(user.profession || user.profissao);
  if (!profession) return true;
  return profession === "projetista" || profession === "eletricista";
}

export function canAccessPath(user, path = "") {
  if (hasFullSystemAccess(user)) return true;
  if (!isArchitectUser(user)) return true;
  return path === "/planta-ia" || path.startsWith("/planta-ia?") || path === "/settings";
}

export function filterNavItemsForUser(items = [], user) {
  if (hasFullSystemAccess(user)) return items;
  if (!isArchitectUser(user)) return items;
  return items.filter((item) => item.path === "/planta-ia");
}
