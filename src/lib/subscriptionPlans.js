import { isSuperAdmin } from "./professionalAccess.js";

export const FEATURE_KEYS = {
  PROJECTS: "projects",
  STORAGE_MB: "storageMb",
  TEAM_MEMBERS: "teamMembers",
  EXPORTS: "exports",
  AI_SCANS: "aiScans",
  CUSTOM_TEMPLATES: "customTemplates",
};

export const COMMERCIAL_PLANS = [
  {
    code: "estudante",
    legacyCodes: ["student", "academico", "estudantil"],
    name: "Nacif Estudante",
    shortName: "Estudante",
    targetAudience: "Estudantes de Engenharia Elétrica, Engenharia de Energia, cursos técnicos em Eletrotécnica e áreas correlatas.",
    description: "Para estudantes de Engenharia Elétrica, Engenharia de Energia, cursos técnicos em Eletrotécnica e áreas relacionadas.",
    commercialTagline: "Aprenda, desenvolva projetos e coloque seus conhecimentos em prática.",
    monthlyPrice: 99.99,
    annualPrice: null, // Não oferecer contratação anual enquanto não existir um valor anual oficialmente configurado
    hasAnnualOption: false,
    annualNotice: "Apenas contratação mensal disponível para o plano Estudante.",
    recommended: false,
    highlightBadge: null,
    isAcademic: true,
    limits: {
      [FEATURE_KEYS.PROJECTS]: 5,
      [FEATURE_KEYS.STORAGE_MB]: 1000, // 1 GB
      [FEATURE_KEYS.TEAM_MEMBERS]: 1,
      [FEATURE_KEYS.EXPORTS]: 20,
      [FEATURE_KEYS.AI_SCANS]: 20,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: 0,
    },
    modules: {
      plant: "academic",
      panel: "academic",
      unifilar: "academic",
      solar: "academic",
      solar_3d: "academic",
      team: false,
      calculator: "full",
      nbr_library: "full",
      budget: "academic",
    },
    features: [
      "Editor de plantas elétricas (versão acadêmica)",
      "Criação de quadros de distribuição",
      "Dimensionamento de circuitos elétricos",
      "Criação de diagramas unifilares",
      "Calculadora elétrica completa",
      "Dimensionamento solar básico e arranjo de módulos",
      "Visualização 2D/3D (quando disponível)",
      "Geração de documentação acadêmica e estudo",
      "Armazenamento de até 5 projetos ativos (1 GB)",
      "Até 20 exportações e 20 operações de IA por mês",
    ],
    limitations: [
      "Uso exclusivamente acadêmico e educacional",
      "Documentos identificados como versão acadêmica",
      "1 usuário por assinatura (sem gestão de equipes)",
      "Exige comprovação de vínculo acadêmico ativo",
    ],
  },
  {
    code: "eletrico",
    legacyCodes: ["electrical", "eletric"],
    name: "Nacif Elétrico",
    shortName: "Elétrico",
    targetAudience: "Eletricistas, projetistas, técnicos e engenheiros que desenvolvem projetos de instalações elétricas.",
    description: "Para eletricistas, projetistas, técnicos e engenheiros que desenvolvem projetos de instalações elétricas.",
    commercialTagline: "Da planta ao quadro elétrico, todas as ferramentas para seus projetos.",
    monthlyPrice: 149.90,
    annualPrice: 1259.16, // Economia exata de 30% (R$ 104,93/mês cobrado anualmente)
    hasAnnualOption: true,
    annualNotice: "Economia de 30% no faturamento anual à vista.",
    recommended: false,
    highlightBadge: null,
    isAcademic: false,
    limits: {
      [FEATURE_KEYS.PROJECTS]: 30,
      [FEATURE_KEYS.STORAGE_MB]: 5000, // 5 GB
      [FEATURE_KEYS.TEAM_MEMBERS]: 3,
      [FEATURE_KEYS.EXPORTS]: 100,
      [FEATURE_KEYS.AI_SCANS]: 100,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: 10,
    },
    modules: {
      plant: "full",
      panel: "full",
      unifilar: "full",
      solar: "none",
      solar_3d: "none",
      team: true,
      calculator: "full",
      nbr_library: "full",
      budget: "full",
    },
    features: [
      "Editor completo de plantas elétricas NBR 5410",
      "Criação e personalização de quadros de distribuição",
      "Dimensionamento de circuitos elétricos, cabos e proteções",
      "Diagrama unifilar e trifilar automático",
      "Calculadora elétrica completa (potência, corrente, carga e demanda)",
      "Ferramentas de orçamento elétrico e lista de materiais (BOM)",
      "Biblioteca de referências técnicas e normas disponíveis",
      "Exportação de plantas, quadros e documentação elétrica",
      "Modelos personalizados para projetos elétricos",
      "Até 30 projetos ativos e 3 usuários inclusos",
      "5 GB de armazenamento, 100 exportações e 100 IAs/mês",
    ],
    limitations: [
      "Projetos fotovoltaicos e dimensionamento solar não incluídos (exige Nacif Solar ou Completo)",
    ],
  },
  {
    code: "solar",
    legacyCodes: ["fotovoltaico", "sol"],
    name: "Nacif Solar",
    shortName: "Solar",
    targetAudience: "Integradores solares, projetistas fotovoltaicos e profissionais de energia solar.",
    description: "Para integradores solares, projetistas fotovoltaicos e profissionais de energia solar.",
    commercialTagline: "Dimensione, organize e documente seus projetos fotovoltaicos.",
    monthlyPrice: 149.90,
    annualPrice: 1259.16, // Economia exata de 30% (R$ 104,93/mês cobrado anualmente)
    hasAnnualOption: true,
    annualNotice: "Economia de 30% no faturamento anual à vista.",
    recommended: false,
    highlightBadge: null,
    isAcademic: false,
    limits: {
      [FEATURE_KEYS.PROJECTS]: 30,
      [FEATURE_KEYS.STORAGE_MB]: 5000, // 5 GB
      [FEATURE_KEYS.TEAM_MEMBERS]: 3,
      [FEATURE_KEYS.EXPORTS]: 100,
      [FEATURE_KEYS.AI_SCANS]: 100,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: 10,
    },
    modules: {
      plant: "restricted",
      panel: "restricted",
      unifilar: "restricted",
      solar: "full",
      solar_3d: "full",
      team: true,
      calculator: "full",
      nbr_library: "full",
      budget: "full",
    },
    features: [
      "Criação e gerenciamento de projetos fotovoltaicos",
      "Dimensionamento solar e análise de consumo energético",
      "Dimensionamento da potência fotovoltaica e inversores",
      "Editor de layout fotovoltaico e organização sobre telhados",
      "Visualização 2D e 3D de arranjos solares",
      "Configuração de strings, MPPTs e circuitos solares",
      "Cálculos solares, irradiação e estimativa de geração",
      "Relatórios técnicos fotovoltaicos e memorial solar",
      "Exportação de layouts e relatórios fotovoltaicos",
      "Modelos de projetos solares personalizados",
      "Até 30 projetos ativos e 3 usuários inclusos",
      "5 GB de armazenamento, 100 exportações e 100 IAs/mês",
    ],
    limitations: [
      "Plantas elétricas prediais gerais e quadros comerciais complexos não incluídos (exige Nacif Elétrico ou Completo)",
    ],
  },
  {
    code: "completo",
    legacyCodes: ["complete", "all"],
    name: "Nacif Completo",
    shortName: "Completo",
    targetAudience: "Profissionais, empresas, engenheiros, escritórios e equipes que trabalham com projetos elétricos e solares na mesma plataforma.",
    description: "Para profissionais, empresas, engenheiros, escritórios e equipes que precisam trabalhar com projetos elétricos e fotovoltaicos na mesma plataforma.",
    commercialTagline: "Projetos elétricos e solares em uma única plataforma, sem limites de projetos.",
    monthlyPrice: 210.00,
    annualPrice: 1764.00, // Economia exata de 30% (R$ 147,00/mês cobrado anualmente)
    hasAnnualOption: true,
    annualNotice: "Economia de 30% no faturamento anual à vista.",
    recommended: true,
    highlightBadge: "Mais completo",
    isAcademic: false,
    limits: {
      [FEATURE_KEYS.PROJECTS]: Number.POSITIVE_INFINITY,
      [FEATURE_KEYS.STORAGE_MB]: 50000, // 50 GB
      [FEATURE_KEYS.TEAM_MEMBERS]: 15,
      [FEATURE_KEYS.EXPORTS]: Number.POSITIVE_INFINITY,
      [FEATURE_KEYS.AI_SCANS]: 500,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: Number.POSITIVE_INFINITY,
    },
    modules: {
      plant: "full",
      panel: "full",
      unifilar: "full",
      solar: "full",
      solar_3d: "full",
      team: true,
      calculator: "full",
      nbr_library: "full",
      budget: "full",
    },
    features: [
      "Todas as funcionalidades do Nacif Elétrico",
      "Todas as funcionalidades do Nacif Solar",
      "Editor completo de plantas elétricas NBR 5410",
      "Criação de quadros de distribuição e diagramas unifilares",
      "Dimensionamento elétrico e fotovoltaico integrados",
      "Visualização de módulos solares em 2D/3D e organização de strings",
      "Calculadoras elétricas e solares com orçamentos e BOM",
      "Biblioteca técnica e modelos personalizados ilimitados",
      "Relatórios e documentação técnica avançada",
      "Projetos e exportações ilimitados",
      "Gerenciamento de equipe e permissões (até 15 membros)",
      "50 GB de armazenamento e 500 operações de IA mensais",
    ],
    limitations: [],
  },
];

export const LEGACY_PLANS = [
  {
    code: "free",
    legacyCodes: ["gratuito", "starter"],
    name: "Gratuito",
    shortName: "Gratuito",
    description: "Para testar o fluxo e organizar os primeiros estudos.",
    commercialTagline: "Para testar o fluxo e organizar os primeiros estudos.",
    monthlyPrice: 0,
    annualPrice: 0,
    hasAnnualOption: false,
    recommended: false,
    isAcademic: false,
    limits: {
      [FEATURE_KEYS.PROJECTS]: 3,
      [FEATURE_KEYS.STORAGE_MB]: 250,
      [FEATURE_KEYS.TEAM_MEMBERS]: 1,
      [FEATURE_KEYS.EXPORTS]: 5,
      [FEATURE_KEYS.AI_SCANS]: 5,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: 0,
    },
    modules: {
      plant: "restricted",
      panel: "restricted",
      unifilar: "restricted",
      solar: "none",
      solar_3d: "none",
      team: false,
      calculator: "full",
      nbr_library: "full",
      budget: "restricted",
    },
    features: [
      "Projetos iniciais",
      "Editor de planta e circuitos",
      "Exportações limitadas",
    ],
    limitations: [
      "Recursos profissionais restritos",
    ],
  },
  {
    code: "professional",
    legacyCodes: ["profissional", "pro"],
    name: "Profissional",
    shortName: "Profissional",
    description: "Para projetistas e eletricistas que usam o sistema no dia a dia.",
    commercialTagline: "Para projetistas e eletricistas que usam o sistema no dia a dia.",
    monthlyPrice: 49,
    annualPrice: 470,
    hasAnnualOption: true,
    recommended: false,
    isAcademic: false,
    limits: {
      [FEATURE_KEYS.PROJECTS]: 50,
      [FEATURE_KEYS.STORAGE_MB]: 5000,
      [FEATURE_KEYS.TEAM_MEMBERS]: 3,
      [FEATURE_KEYS.EXPORTS]: 100,
      [FEATURE_KEYS.AI_SCANS]: 100,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: 10,
    },
    modules: {
      plant: "full",
      panel: "full",
      unifilar: "full",
      solar: "full",
      solar_3d: "full",
      team: true,
      calculator: "full",
      nbr_library: "full",
      budget: "full",
    },
    features: [
      "Projetos profissionais",
      "Exportação técnica",
      "Biblioteca e modelos personalizados",
      "Uso colaborativo inicial",
    ],
    limitations: [],
  },
  {
    code: "engineering",
    legacyCodes: ["engenharia"],
    name: "Engenharia",
    shortName: "Engenharia",
    description: "Para equipes, escritórios e operação técnica com maior volume.",
    commercialTagline: "Para equipes, escritórios e operação técnica com maior volume.",
    monthlyPrice: 99,
    annualPrice: 950,
    hasAnnualOption: true,
    recommended: false,
    isAcademic: false,
    limits: {
      [FEATURE_KEYS.PROJECTS]: Number.POSITIVE_INFINITY,
      [FEATURE_KEYS.STORAGE_MB]: 50000,
      [FEATURE_KEYS.TEAM_MEMBERS]: 15,
      [FEATURE_KEYS.EXPORTS]: Number.POSITIVE_INFINITY,
      [FEATURE_KEYS.AI_SCANS]: 500,
      [FEATURE_KEYS.CUSTOM_TEMPLATES]: Number.POSITIVE_INFINITY,
    },
    modules: {
      plant: "full",
      panel: "full",
      unifilar: "full",
      solar: "full",
      solar_3d: "full",
      team: true,
      calculator: "full",
      nbr_library: "full",
      budget: "full",
    },
    features: [
      "Projetos ilimitados",
      "Equipe com permissões",
      "Relatórios e documentação avançada",
      "Limites ampliados de IA e arquivos",
    ],
    limitations: [],
  },
];

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

  // 3. Fallback seguro: primeiro plano do catálogo comercial
  return COMMERCIAL_PLANS[0];
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

  const cycle =
    user?.subscription?.cycle ||
    user?.subscription_cycle ||
    user?.billing_cycle ||
    "monthly";

  return {
    plan,
    planCode: plan.code,
    cycle,
    status: user?.subscription?.status || user?.subscription_status || user?.billing_status || "active",
    provider: user?.subscription?.provider || user?.billing_provider || "manual",
    price: user?.subscription?.price || user?.subscription_price || (cycle === "annual" ? plan.annualPrice : plan.monthlyPrice),
    startDate: user?.subscription?.start_date || user?.subscription_start_date || null,
    renewalDate: user?.subscription?.renewal_date || user?.renewal_date || user?.subscription_valid_until || null,
    autoRenew: user?.subscription?.auto_renew ?? user?.subscription_auto_renew ?? true,
    stripeCustomerId: user?.stripe_customer_id || user?.subscription?.stripe_customer_id || null,
    stripeSubscriptionId: user?.stripe_subscription_id || user?.subscription?.stripe_subscription_id || null,
    billingConfigured: Boolean(
      (user?.billing_provider && user.billing_provider !== "manual") ||
      user?.stripe_customer_id ||
      user?.stripe_subscription_id
    ),
    academicStatus: user?.academic_status || "not_submitted",
    academicInstitution: user?.academic_institution || "",
    academicCourse: user?.academic_course || "",
    academicDocumentUrl: user?.academic_document_url || "",
    academicValidUntil: user?.academic_valid_until || null,
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
  // Super admin e administradores possuem acesso irrestrito
  if (
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    user?.is_super_admin === true ||
    isSuperAdmin(user)
  ) {
    return {
      allowed: true,
      level: "full",
      isAcademic: false,
      message: null,
      requiredPlans: [],
    };
  }

  const { plan } = normalizeSubscription(user);
  const normalizedModule = String(moduleKey).toLowerCase().trim();

  // Caso plano Estudante
  if (plan.isAcademic) {
    const academicCheck = isAcademicValid(user);
    if (!academicCheck.valid && (academicCheck.reason === "expired" || academicCheck.reason === "rejected")) {
      return {
        allowed: false,
        level: "expired",
        isAcademic: true,
        message: "O vínculo acadêmico desta conta precisa ser regularizado para acessar novos recursos do plano Estudante.",
        reason: academicCheck.reason,
        requiredPlans: ["Nacif Estudante"],
      };
    }

    return {
      allowed: true,
      level: "academic",
      isAcademic: true,
      watermark: "Versão Acadêmica — Nacif Estudante — Uso Educacional",
      message: null,
      requiredPlans: [],
    };
  }

  // Módulo Solar
  if (normalizedModule === "solar" || normalizedModule === "solar_project" || normalizedModule === "solar_3d") {
    if (
      plan.code === "solar" ||
      plan.code === "completo" ||
      plan.code === "engineering" ||
      plan.code === "professional"
    ) {
      return { allowed: true, level: "full", isAcademic: false, message: null, requiredPlans: [] };
    }

    return {
      allowed: false,
      level: "none",
      isAcademic: false,
      message: "Este recurso está disponível no plano Nacif Solar e no Nacif Completo.",
      requiredPlans: ["Nacif Solar", "Nacif Completo"],
    };
  }

  // Módulos Elétricos Prediais (Planta Elétrica, Quadro DIN, Diagrama Unifilar completo)
  if (
    normalizedModule === "plant" ||
    normalizedModule === "planta_ia" ||
    normalizedModule === "panel" ||
    normalizedModule === "panel_generator" ||
    normalizedModule === "unifilar"
  ) {
    if (plan.code === "eletrico" || plan.code === "completo" || plan.code === "professional" || plan.code === "engineering") {
      return { allowed: true, level: "full", isAcademic: false, message: null, requiredPlans: [] };
    }

    if (plan.code === "solar") {
      return {
        allowed: false,
        level: "restricted",
        isAcademic: false,
        message: "Este recurso está disponível no plano Nacif Elétrico e no Nacif Completo.",
        requiredPlans: ["Nacif Elétrico", "Nacif Completo"],
      };
    }
  }

  // Módulos Comuns (Calculadora, Normas NBR, Suporte)
  return { allowed: true, level: "full", isAcademic: false, message: null, requiredPlans: [] };
}

/**
 * Valida se um usuário pode criar um novo projeto com base no plano atual,
 * quantidade existente e tipo do projeto (solar vs elétrico).
 * NUNCA bloqueia projetos já existentes.
 */
export function checkProjectCreationAllowed(user = {}, currentProjectCount = 0, projectType = "") {
  if (
    user?.role === "super_admin" ||
    user?.role === "admin" ||
    user?.is_super_admin === true ||
    isSuperAdmin(user)
  ) {
    return {
      allowed: true,
      currentCount: Number(currentProjectCount),
      limit: Number.POSITIVE_INFINITY,
      planCode: "completo",
      reason: null,
    };
  }

  const { plan } = normalizeSubscription(user);
  const limit = getLimit(plan, FEATURE_KEYS.PROJECTS);
  const normalizedType = String(projectType || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  // Validação do tipo de projeto contra as restrições do plano
  if (normalizedType.includes("solar") || normalizedType.includes("fotovolt")) {
    if (plan.code === "eletrico") {
      return {
        allowed: false,
        currentCount: Number(currentProjectCount),
        limit: Number(limit),
        planCode: plan.code,
        reason: "Projetos solares não estão incluídos no plano Nacif Elétrico. Faça upgrade para o Nacif Solar ou Nacif Completo.",
      };
    }
  }

  if (normalizedType.includes("predial") || normalizedType.includes("instalac") || normalizedType.includes("eletric")) {
    if (plan.code === "solar") {
      return {
        allowed: false,
        currentCount: Number(currentProjectCount),
        limit: Number(limit),
        planCode: plan.code,
        reason: "Projetos elétricos prediais completos não estão incluídos no plano Nacif Solar. Faça upgrade para o Nacif Elétrico ou Nacif Completo.",
      };
    }
  }

  if (limit === Number.POSITIVE_INFINITY) {
    return {
      allowed: true,
      currentCount: Number(currentProjectCount),
      limit,
      planCode: plan.code,
      reason: null,
    };
  }

  const allowed = Number(currentProjectCount) < Number(limit);
  return {
    allowed,
    currentCount: Number(currentProjectCount),
    limit: Number(limit),
    planCode: plan.code,
    reason: allowed
      ? null
      : `Limite de ${limit} projetos ativos atingido para o plano ${plan.name}. Faça upgrade para continuar criando novos projetos.`,
  };
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
