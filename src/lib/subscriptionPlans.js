import { isSuperAdmin } from "./professionalAccess.js";

import { FEATURE_KEYS, COMMERCIAL_PLANS, LEGACY_PLANS, catalogModuleAccess, planComparisonValue } from "../../backend/src/lib/planCatalog.js";
export { FEATURE_KEYS, COMMERCIAL_PLANS };

export function applyRemotePlanCatalog(_plans) {
  if (!Array.isArray(_plans)) return;
  for (const remote of _plans) {
    const plan = ALL_PLANS.find(p => p.code === remote.code);
    if (plan && remote.limits) Object.assign(plan, { ...remote, limits: Object.fromEntries(Object.entries(remote.limits).map(([key, value]) => [key, value === null ? Infinity : value])) });
  }
  refreshPlanComparisonRows();
}

export const PLAN_CATALOG = COMMERCIAL_PLANS;
export const ALL_PLANS = [...COMMERCIAL_PLANS, ...LEGACY_PLANS];

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

export const PLAN_COMPARISON_ROWS = [
  {
    key: "projects",
    category: "Limites",
    label: "Projetos ativos",
    description: "Quantidade máxima de projetos ativos simultâneos no workspace.",
    values: {
      estudante: "5",
      eletrico: "30",
      solar: "30",
      completo: "Ilimitado",
    },
  },
  {
    key: "storage",
    category: "Limites",
    label: "Armazenamento",
    description: "Arquivos, importações e documentação técnica associada aos projetos.",
    values: {
      estudante: "1 GB",
      eletrico: "5 GB",
      solar: "5 GB",
      completo: "50 GB",
    },
  },
  {
    key: "members",
    category: "Limites",
    label: "Membros",
    description: "Usuários com permissão para participar da organização e colaborar.",
    values: {
      estudante: "1",
      eletrico: "3",
      solar: "3",
      completo: "15",
    },
  },
  {
    key: "exports",
    category: "Limites",
    label: "Exportações/mês",
    description: "Geração de pranchas PDF, memorial descritivo, listas e relatórios.",
    values: {
      estudante: "20",
      eletrico: "100",
      solar: "100",
      completo: "Ilimitado",
    },
  },
  {
    key: "ai",
    category: "Limites",
    label: "IA/mês",
    description: "Processamentos com inteligência artificial, leitura assistida e dimensionamento.",
    values: {
      estudante: "20",
      eletrico: "100",
      solar: "100",
      completo: "500",
    },
  },
  {
    key: "plant",
    category: "Recursos",
    label: "Editor de planta elétrica",
    description: "Desenho arquitetônico de circuitos, tomadas, iluminação e pontos de comando.",
    values: {
      estudante: "Acadêmico",
      eletrico: "Completo",
      solar: "Restrito",
      completo: "Completo",
    },
  },
  {
    key: "panel",
    category: "Recursos",
    label: "Quadro elétrico",
    description: "Montagem de quadros DIN, disjuntores, barramentos e balanceamento.",
    values: {
      estudante: "Acadêmico",
      eletrico: "Completo",
      solar: "Restrito",
      completo: "Completo",
    },
  },
  {
    key: "unifilar",
    category: "Recursos",
    label: "Diagrama unifilar",
    description: "Geração e exportação do diagrama unifilar e trifilar automático NBR 5410.",
    values: {
      estudante: "Acadêmico",
      eletrico: "Completo",
      solar: "Restrito",
      completo: "Completo",
    },
  },
  {
    key: "solar",
    category: "Recursos",
    label: "Projeto solar",
    description: "Dimensionamento fotovoltaico, irradiação, inversor e memorial solar.",
    values: {
      estudante: "Acadêmico",
      eletrico: "Não incluído",
      solar: "Completo",
      completo: "Completo",
    },
  },
  {
    key: "solar_3d",
    category: "Recursos",
    label: "Layout solar 2D/3D",
    description: "Planejamento e organização de módulos fotovoltaicos sobre telhados.",
    values: {
      estudante: "Acadêmico",
      eletrico: "Não incluído",
      solar: "Completo",
      completo: "Completo",
    },
  },
  {
    key: "team",
    category: "Recursos",
    label: "Gerenciamento de equipes",
    description: "Controle de papéis, permissões granulares e governança corporativa.",
    values: {
      estudante: "Não",
      eletrico: "Sim",
      solar: "Sim",
      completo: "Sim",
    },
  },
];

function refreshPlanComparisonRows() {
  for (const row of PLAN_COMPARISON_ROWS) row.values = Object.fromEntries(COMMERCIAL_PLANS.map(plan => [plan.code, planComparisonValue(plan, row.key)]));
}
refreshPlanComparisonRows();

const DEFAULT_PLAN_CODE = "free";

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function getPlanByCode(code) {
  const normalized = normalizeCode(code || DEFAULT_PLAN_CODE);

  // 1. Procurar nos planos comerciais novos
  const commercial = COMMERCIAL_PLANS.find(
    (plan) =>
      normalizeCode(plan.code) === normalized ||
      (plan.legacyCodes && plan.legacyCodes.some((legacyCode) => normalizeCode(legacyCode) === normalized)),
  );
  if (commercial) return commercial;

  // 2. Procurar nos planos legados (para compatibilidade com registros antigos)
  const legacy = LEGACY_PLANS.find(
    (plan) =>
      normalizeCode(plan.code) === normalized ||
      (plan.legacyCodes && plan.legacyCodes.some((legacyCode) => normalizeCode(legacyCode) === normalized)),
  );
  if (legacy) return legacy;

  return LEGACY_PLANS.find(plan => plan.code === "free");
}

export function normalizeSubscription(user = {}) {
  const provider = user?.subscription?.provider || user?.billing_provider || "none";
  const storedStatus = user?.subscription_status || user?.subscription?.status || "none";
  const renewalDate = user?.subscription?.renewal_date || user?.renewal_date || user?.subscription_valid_until || null;
  const startDate = user?.subscription?.start_date || user?.subscription_start_date || null;
  const currentPeriodPaid = provider === "asaas" && Date.parse(renewalDate) > Date.now() && (!startDate || Date.parse(startDate) <= Date.now());
  const explicitPlanCode = user?.subscription_plan || user?.plan || user?.subscription?.planCode || user?.subscription?.plan_code || user?.plan_code;
  const isTerminatedStatus = ["cancelled", "expired", "past_due"].includes(storedStatus);
  const hasPaidSubscription = Boolean(
    (currentPeriodPaid && (user?.has_paid_subscription ?? !isTerminatedStatus)) ||
    (explicitPlanCode && explicitPlanCode !== "free" && provider !== "asaas" && !isTerminatedStatus)
  );
  const plan = getPlanByCode(hasPaidSubscription && explicitPlanCode ? explicitPlanCode : "free");
  const billingConfigured = provider === "asaas" || Boolean(user?.asaas_subscription_id);
  const cycle = hasPaidSubscription ? user?.subscription?.cycle || user?.subscription_cycle || user?.billing_cycle || "monthly" : null;

  return {
    plan,
    planCode: plan.code,
    cycle,
    status: hasPaidSubscription ? storedStatus : billingConfigured ? storedStatus === "active" ? "expired" : storedStatus : "none",
    provider,
    hasPaidSubscription,
    price: hasPaidSubscription ? user?.subscription?.price ?? user?.subscription_price ?? (cycle === "annual" ? plan.annualPrice : plan.monthlyPrice) : 0,
    startDate: hasPaidSubscription ? user?.subscription?.start_date || user?.subscription_start_date || null : null,
    renewalDate: hasPaidSubscription ? renewalDate : null,
    autoRenew: billingConfigured ? user?.subscription?.auto_renew ?? user?.subscription_auto_renew ?? false : false,
    asaasCustomerId: user?.asaas_customer_id || user?.subscription?.asaas_customer_id || null,
    asaasSubscriptionId: user?.asaas_subscription_id || user?.subscription?.asaas_subscription_id || null,
    billingType: user?.billing_type || null,
    billingConfigured,
    academicStatus: user?.academic_status || "not_submitted",
    academicInstitution: user?.academic_institution || "",
    academicCourse: user?.academic_course || "",
    academicDocumentUrl: user?.academic_document_url || "",
    academicValidUntil: user?.academic_valid_until || null,
  };
}

export function getCurrentUsagePeriod() {
  return new Date().toISOString().slice(0, 7);
}

export function estimateProjectStorageMb(project = {}) {
  if (!project) return 0;
  const explicit = Number(project.storage_mb || project.storageMb || project.file_size_mb || project.fileSizeMb || 0);
  if (explicit > 0) return explicit;

  let estimatedBytes = 150 * 1024;
  if (Array.isArray(project.circuits)) estimatedBytes += project.circuits.length * 4096;
  if (Array.isArray(project.panel_boards)) estimatedBytes += project.panel_boards.length * 16384;
  if (project.plant_design?.points?.length) estimatedBytes += project.plant_design.points.length * 1024;
  if (project.plant_design?.routes?.length) estimatedBytes += project.plant_design.routes.length * 512;
  if (project.plant_design?.walls?.length) estimatedBytes += project.plant_design.walls.length * 512;
  if (project.solar_design?.areas?.length) estimatedBytes += project.solar_design.areas.length * 8192;
  if (project.plant_design?.imageUrl?.length) estimatedBytes += project.plant_design.imageUrl.length;

  return Math.max(0.2, Number((estimatedBytes / (1024 * 1024)).toFixed(2)));
}

export function resolveEffectiveSubscription(user = {}) {
  const sub = normalizeSubscription(user);
  const isAdmin = user?.role === "admin" || isSuperAdmin(user);
  return { ...sub, isAdmin, isInactive: !sub.hasPaidSubscription };
}

export function checkFeatureQuotaAllowed(user = {}, featureKey = "", currentUsage = 0, increment = 1) {
  const subscription = resolveEffectiveSubscription(user);
  const nextUsage = Number(currentUsage) + Number(increment);
  const limit = subscription.isAdmin ? Infinity : getLimit(subscription.plan, featureKey);
  return { allowed: nextUsage <= limit, currentUsage: Number(currentUsage), nextUsage, limit,
    remaining: limit === Infinity ? Infinity : Math.max(0, limit - nextUsage), planCode: subscription.isAdmin ? "completo" : subscription.planCode,
    reason: nextUsage <= limit ? null : "Limite do plano atingido. Consulte os planos disponíveis." };
}

export function buildUsageFromProjects(projects = [], overrides = {}, maybeUser = null) {
  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProjects = safeProjects.filter((project) => project?.status !== "Arquivado");
  const user = maybeUser || overrides?.user || null;
  const currentPeriod = getCurrentUsagePeriod();

  const projectsExports = activeProjects.reduce(
    (total, project) => total + Number(project?.exports_count || project?.exportsCount || 0),
    0,
  );
  const userMonthlyExports = user?.usage_period === currentPeriod ? Number(user.monthly_exports_count || 0) : 0;
  const totalExports = Math.max(projectsExports, userMonthlyExports);

  const projectsAiScans = activeProjects.reduce(
    (total, project) => total + Number(project?.ai_scans_count || project?.aiScansCount || 0),
    0,
  );
  const userMonthlyAiScans = user?.usage_period === currentPeriod ? Number(user.monthly_ai_scans_count || 0) : 0;
  const totalAiScans = Math.max(projectsAiScans, userMonthlyAiScans);

  const projectsStorageMb = activeProjects.reduce(
    (total, project) => total + estimateProjectStorageMb(project),
    0,
  );
  const userDirectStorageMb = Number(user?.storage_used_mb || 0);
  const totalStorageMb = Number((projectsStorageMb + userDirectStorageMb).toFixed(1));

  const userMembersCount = Number(
    user?.team_members_count ||
    (Array.isArray(user?.team_members) ? user.team_members.length + 1 : 1),
  );

  return {
    [FEATURE_KEYS.PROJECTS]: activeProjects.length,
    [FEATURE_KEYS.STORAGE_MB]: totalStorageMb,
    [FEATURE_KEYS.TEAM_MEMBERS]: Number(overrides.teamMembers || overrides.members || userMembersCount),
    [FEATURE_KEYS.EXPORTS]: overrides[FEATURE_KEYS.EXPORTS] !== undefined ? Number(overrides[FEATURE_KEYS.EXPORTS]) : totalExports,
    [FEATURE_KEYS.AI_SCANS]: overrides[FEATURE_KEYS.AI_SCANS] !== undefined ? Number(overrides[FEATURE_KEYS.AI_SCANS]) : totalAiScans,
    [FEATURE_KEYS.CUSTOM_TEMPLATES]: activeProjects.filter((project) => project?.is_template || project?.template).length,
    ...overrides,
  };
}

export function getLimit(plan, featureKey) {
  return plan?.limits?.[featureKey] ?? 0;
}

export function canUseFeature(plan, featureKey, currentUsage = 0) {
  return Number(currentUsage) < getLimit(plan, featureKey);
}

export function formatLimitValue(value, featureKey) {
  if (value === Number.POSITIVE_INFINITY) return "Ilimitado";
  if (featureKey === FEATURE_KEYS.STORAGE_MB) {
    const num = Number(value || 0);
    if (num >= 1000) {
      const gb = num / 1000;
      return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
    }
    return `${num} MB`;
  }
  const suffix = USAGE_UNITS[featureKey] ? ` ${USAGE_UNITS[featureKey]}` : "";
  return `${Number(value || 0).toLocaleString("pt-BR")}${suffix}`;
}

export function calculateAnnualSavings(plan) {
  if (!plan?.hasAnnualOption || !plan?.annualPrice || !plan?.monthlyPrice) {
    return {
      annualTotal: 0,
      monthlyEquiv: 0,
      discountPercent: 0,
      savingsTotal: 0,
    };
  }

  const fullAnnual = plan.monthlyPrice * 12;
  const annualTotal = plan.annualPrice;
  const savingsTotal = Math.max(0, fullAnnual - annualTotal);
  const discountPercent = Math.round((savingsTotal / fullAnnual) * 100);
  const monthlyEquiv = Number((annualTotal / 12).toFixed(2));

  return {
    annualTotal,
    monthlyEquiv,
    discountPercent,
    savingsTotal,
  };
}

export function formatPlanPrice(plan, cycle = "monthly") {
  if (!plan) return "R$ 0";
  if (cycle === "annual" && plan.hasAnnualOption && plan.annualPrice !== null) {
    return `R$ ${Number(plan.annualPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `R$ ${Number(plan.monthlyPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    const state =
      limit === Number.POSITIVE_INFINITY
        ? "unlimited"
        : percent >= 100
        ? "limit"
        : percent >= 80
        ? "near"
        : "normal";

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

/**
 * Validação centralizada de elegibilidade acadêmica.
 * Quando o vínculo vence, não bloqueia a conta inteira;
 * apenas restringe novas operações sujeitas ao plano até a regularização.
 */
export function isAcademicValid(user = {}) {
  const status = user?.academic_status;
  if (!status || status === "not_submitted" || status === "rejected") {
    return { valid: false, reason: "pending_submission", label: "Comprovação pendente" };
  }
  if (status === "pending_review") {
    return { valid: false, reason: "in_review", label: "Em análise administrativa" };
  }
  if (status === "expired") {
    return { valid: false, reason: "expired", label: "Vínculo acadêmico vencido" };
  }
  if (user?.academic_valid_until) {
    const validUntil = new Date(user.academic_valid_until).getTime();
    if (Date.now() > validUntil) {
      return { valid: false, reason: "expired", label: "Vínculo acadêmico vencido" };
    }
  }
  return { valid: true, reason: null, label: "Elegibilidade ativa" };
}

/**
 * Camada centralizada de autorização por módulo e recurso baseada no plano contratado.
 */
export function canAccessModule(user = {}, moduleKey = "") {
  const sub = resolveEffectiveSubscription(user);
  return catalogModuleAccess(sub.planCode, moduleKey, { isAdmin: sub.isAdmin,
    academicStatus: user?.academic_status, academicValidUntil: user?.academic_valid_until });
}

export function checkProjectCreationAllowed(user = {}, currentProjectCount = 0, projectType = "") {
  const sub = resolveEffectiveSubscription(user);
  const access = canAccessModule(user, /solar|fotovolta/i.test(projectType) ? "solar" : "plant");
  const limit = sub.isAdmin ? Infinity : getLimit(sub.plan, FEATURE_KEYS.PROJECTS);
  return { allowed: access.allowed && currentProjectCount < limit, currentCount: Number(currentProjectCount),
    limit, planCode: sub.isAdmin ? "completo" : sub.planCode,
    reason: !access.allowed ? access.message : currentProjectCount >= limit ? `Seu plano permite ${limit} projetos ativos. Exclua um projeto ou altere seu plano.` : null };
}

/**
 * Política oficial de retenção de dados e continuidade do cliente Nacif Electric.
 * Garante que cancelamentos ou downgrades NUNCA apaguem projetos existentes.
 */
export const DATA_RETENTION_POLICY = {
  version: "2.0",
  lastReviewed: "2026-10-22",
  guarantees: [
    {
      topic: "Preservação de Projetos",
      description:
        "Projetos, plantas elétricas, quadros de distribuição, diagramas unifilares e orçamentos criados são mantidos integralmente salvos, mesmo em caso de cancelamento da assinatura ou downgrade.",
    },
    {
      topic: "Acesso e Consulta Pós-Cancelamento",
      description:
        "O usuário que altera ou cancela a assinatura mantém acesso de leitura, exportação e consulta aos seus projetos existentes.",
    },
    {
      topic: "Exportação de Dados",
      description:
        "O cliente pode exportar seus dados a qualquer momento em formatos padrão (PDF de pranchas, relatórios técnicos e arquivos estruturados JSON/CSV).",
    },
    {
      topic: "Sem Exclusão Silenciosa",
      description:
        "Nenhum arquivo ou projeto é excluído silenciosamente quando a conta atinge ou ultrapassa o limite do plano inferior após um downgrade. Apenas novas criações acima da cota são bloqueadas.",
    },
  ],
};

export function getDataRetentionPolicy() {
  return DATA_RETENTION_POLICY;
}
