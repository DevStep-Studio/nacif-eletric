export const FEATURE_KEYS = {
  PROJECTS: "projects",
  STORAGE_MB: "storageMb",
  TEAM_MEMBERS: "teamMembers",
  EXPORTS: "exports",
  AI_SCANS: "aiScans",
  CUSTOM_TEMPLATES: "customTemplates",
};

export const PLAN_CATALOG = [
  {
    code: "free",
    legacyCodes: ["gratuito", "starter"],
    name: "Gratuito",
    description: "Para testar o fluxo e organizar os primeiros estudos.",
    monthlyPrice: 0,
    annualPrice: 0,
    recommended: false,
    limits: {
      [FEATURE_KEYS.PROJECTS]: 3,
      [FEATURE_KEYS.STORAGE_MB]: 250,
      [FEATURE_KEYS.TEAM_MEMBERS]: 1,
      [FEATURE_KEYS.EXPORTS]: 5,
      [FEATURE_KEYS.AI_SCANS]: 5,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: 0,
    },
    features: [
      "Projetos iniciais",
      "Editor de planta e circuitos",
      "Exportações limitadas",
    ],
  },
  {
    code: "professional",
    legacyCodes: ["profissional", "pro"],
    name: "Profissional",
    description: "Para projetistas e eletricistas que usam o sistema no dia a dia.",
    monthlyPrice: 49,
    annualPrice: 470,
    recommended: true,
    limits: {
      [FEATURE_KEYS.PROJECTS]: 50,
      [FEATURE_KEYS.STORAGE_MB]: 5000,
      [FEATURE_KEYS.TEAM_MEMBERS]: 3,
      [FEATURE_KEYS.EXPORTS]: 100,
      [FEATURE_KEYS.AI_SCANS]: 100,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: 10,
    },
    features: [
      "Projetos profissionais",
      "Exportação técnica",
      "Biblioteca e modelos personalizados",
      "Uso colaborativo inicial",
    ],
  },
  {
    code: "engineering",
    legacyCodes: ["engenharia", "enterprise"],
    name: "Engenharia",
    description: "Para equipes, escritórios e operação técnica com maior volume.",
    monthlyPrice: 99,
    annualPrice: 950,
    recommended: false,
    limits: {
      [FEATURE_KEYS.PROJECTS]: Number.POSITIVE_INFINITY,
      [FEATURE_KEYS.STORAGE_MB]: 50000,
      [FEATURE_KEYS.TEAM_MEMBERS]: 15,
      [FEATURE_KEYS.EXPORTS]: Number.POSITIVE_INFINITY,
      [FEATURE_KEYS.AI_SCANS]: 500,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: Number.POSITIVE_INFINITY,
    },
    features: [
      "Projetos ilimitados",
      "Equipe com permissões",
      "Relatórios e documentação avançada",
      "Limites ampliados de IA e arquivos",
    ],
  },
];

export const USAGE_LABELS = {
  [FEATURE_KEYS.PROJECTS]: "Projetos",
  [FEATURE_KEYS.STORAGE_MB]: "Armazenamento",
  [FEATURE_KEYS.TEAM_MEMBERS]: "Membros",
  [FEATURE_KEYS.EXPORTS]: "Exportações",
  [FEATURE_KEYS.AI_SCANS]: "Scans de IA",
  [FEATURE_KEYS.CUSTOM_TEMPLATES]: "Modelos personalizados",
};

export const USAGE_UNITS = {
  [FEATURE_KEYS.STORAGE_MB]: "MB",
};

const DEFAULT_PLAN_CODE = "free";

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function getPlanByCode(code) {
  const normalized = normalizeCode(code || DEFAULT_PLAN_CODE);
  return (
    PLAN_CATALOG.find(
      (plan) =>
        normalizeCode(plan.code) === normalized ||
        plan.legacyCodes.some((legacyCode) => normalizeCode(legacyCode) === normalized),
    ) || PLAN_CATALOG[0]
  );
}

export function normalizeSubscription(user = {}) {
  const rawCode =
    user?.subscription?.plan_code ||
    user?.subscription?.plan ||
    user?.plan_code ||
    user?.current_plan ||
    user?.plan ||
    DEFAULT_PLAN_CODE;
  const plan = getPlanByCode(rawCode);

  return {
    plan,
    planCode: plan.code,
    status: user?.subscription?.status || user?.subscription_status || user?.billing_status || "development",
    provider: user?.subscription?.provider || user?.billing_provider || "manual",
    renewalDate: user?.subscription?.renewal_date || user?.renewal_date || null,
    billingConfigured: Boolean(user?.billing_provider && user.billing_provider !== "manual"),
  };
}

export function buildUsageFromProjects(projects = [], overrides = {}) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProjects = safeProjects.filter((project) => project?.status !== "Arquivado");

  return {
    [FEATURE_KEYS.PROJECTS]: activeProjects.length,
    [FEATURE_KEYS.STORAGE_MB]: Math.round(
      activeProjects.reduce(
        (total, project) =>
          total +
          Number(project?.storage_mb || project?.storageMb || project?.file_size_mb || project?.fileSizeMb || 0),
        0,
      ),
    ),
    [FEATURE_KEYS.TEAM_MEMBERS]: Number(overrides.teamMembers || overrides.members || 1),
    [FEATURE_KEYS.EXPORTS]: activeProjects.reduce(
      (total, project) => total + Number(project?.exports_count || project?.exportsCount || 0),
      0,
    ),
    [FEATURE_KEYS.AI_SCANS]: activeProjects.reduce(
      (total, project) => total + Number(project?.ai_scans_count || project?.aiScansCount || 0),
      0,
    ),
    [FEATURE_KEYS.CUSTOM_TEMPLATES]: activeProjects.filter((project) => project?.is_template || project?.template).length,
    ...overrides,
  };
}

export function getLimit(plan, featureKey) {
  return plan?.limits?.[featureKey] ?? 0;
}

export function canUseFeature(plan, featureKey, currentUsage = 0) {
  const limit = getLimit(plan, featureKey);
  return limit === Number.POSITIVE_INFINITY || Number(currentUsage) < Number(limit);
}

export function formatLimitValue(value, featureKey) {
  if (value === Number.POSITIVE_INFINITY) return "Ilimitado";
  const suffix = USAGE_UNITS[featureKey] ? ` ${USAGE_UNITS[featureKey]}` : "";
  return `${Number(value || 0).toLocaleString("pt-BR")}${suffix}`;
}

export function getUsageRows(plan, usage = {}) {
  return Object.values(FEATURE_KEYS).map((featureKey) => {
    const used = Number(usage[featureKey] || 0);
    const limit = getLimit(plan, featureKey);
    const percent =
      limit === Number.POSITIVE_INFINITY || limit <= 0
        ? used > 0
          ? 100
          : 0
        : Math.min(100, Math.round((used / limit) * 100));
    const remaining = limit === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Math.max(0, limit - used);
    const state = limit !== Number.POSITIVE_INFINITY && percent >= 100 ? "limit" : percent >= 80 ? "near" : "normal";

    return {
      key: featureKey,
      label: USAGE_LABELS[featureKey],
      used,
      limit,
      remaining,
      percent,
      state,
      usedLabel: formatLimitValue(used, featureKey),
      limitLabel: formatLimitValue(limit, featureKey),
      remainingLabel: formatLimitValue(remaining, featureKey),
    };
  });
}
