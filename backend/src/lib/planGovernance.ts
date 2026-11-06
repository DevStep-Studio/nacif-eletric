import { COMMERCIAL_PLANS, LEGACY_PLANS } from "./planCatalog.js";
export type ServerPlanCode =
  | "gratuito"
  | "free"
  | "estudante"
  | "eletrico"
  | "solar"
  | "completo"
  | "profissional"
  | "engenharia";

export interface PlanLimitDefinition {
  name: string;
  projects: number;
  storageMb: number;
  teamMembers: number;
  exports: number;
  aiScans: number;
  customTemplates: number;
  isAcademic?: boolean;
}

export const SERVER_PLAN_MATRIX: Record<string, PlanLimitDefinition> =
  Object.fromEntries(
    [...COMMERCIAL_PLANS, ...LEGACY_PLANS].flatMap((plan) =>
      [plan.code, ...(plan.legacyCodes || [])].map((code) => [
        code,
        { name: plan.name, ...plan.limits, isAcademic: plan.isAcademic },
      ]),
    ),
  );

export const getCurrentUsagePeriod = (): string =>
  new Date().toISOString().slice(0, 7);

export const effectivePlanCode = (user: {
  plan?: string;
  customPermissions?: unknown;
}): string => {
  const p = (user.customPermissions || {}) as Record<string, any>;
  const inactive = [
    "cancelled",
    "canceled",
    "suspended",
    "unpaid",
    "expired",
    "past_due",
    "incomplete",
    "incomplete_expired",
    "paused",
  ].includes(p.subscriptionStatus);
  const expired =
    p.billingProvider === "stripe" &&
    p.subscriptionRenewalDate &&
    Date.parse(p.subscriptionRenewalDate) <= Date.now();
  const invalidAcademic = user.plan === "estudante" && (["rejected", "expired"].includes(p.academicStatus) || p.academicValidUntil && Date.parse(p.academicValidUntil) <= Date.now());
  return inactive || expired || invalidAcademic ? "gratuito" : user.plan || "gratuito";
};

export const getServerPlan = (
  planCode?: string | null,
): PlanLimitDefinition => {
  const normalized = String(planCode || "gratuito")
    .toLowerCase()
    .trim();
  return SERVER_PLAN_MATRIX[normalized] || SERVER_PLAN_MATRIX.gratuito;
};

export const isServerAdmin = (user: {
  role?: string;
  isSuperAdmin?: boolean;
}): boolean => {
  return (
    user.role === "admin" ||
    user.role === "super_admin" ||
    Boolean(user.isSuperAdmin)
  );
};

export const checkServerProjectCreation = (
  user: {
    role?: string;
    isSuperAdmin?: boolean;
    plan?: string;
    customPermissions?: unknown;
  },
  currentProjectCount: number,
  projectType?: string | null,
): { allowed: boolean; reason?: string } => {
  if (isServerAdmin(user)) {
    return { allowed: true };
  }

  const permissions = (user.customPermissions as Record<string, unknown>) || {};
  const subStatus = String(
    permissions.subscriptionStatus || "active",
  ).toLowerCase();
  const isInactive =
    subStatus === "cancelled" ||
    subStatus === "suspended" ||
    subStatus === "unpaid" ||
    subStatus === "expired";
  const effectiveCode = effectivePlanCode(user);
  const plan = getServerPlan(effectiveCode);

  if (plan.isAcademic) {
    const academicStatus = String(permissions.academicStatus || "");
    if (academicStatus === "expired" || academicStatus === "rejected") {
      return {
        allowed: false,
        reason:
          "Vínculo acadêmico vencido ou rejeitado. Regularize seu comprovante acadêmico para criar novos projetos.",
      };
    }
  }

  const normalizedType = String(projectType || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalizedType.length > 0) {
    const isSolar =
      normalizedType.includes("solar") || normalizedType.includes("fotovolt");
    const isPredial =
      normalizedType.includes("predial") ||
      normalizedType.includes("instalac") ||
      normalizedType.includes("eletric");

    if (isSolar) {
      if (effectivePlanCode(user) === "eletrico") {
        return {
          allowed: false,
          reason:
            "Projetos solares não estão incluídos no plano Nacif Elétrico. Faça upgrade para o Nacif Solar ou Nacif Completo.",
        };
      }
      if (effectivePlanCode(user) === "gratuito" || isInactive) {
        return {
          allowed: false,
          reason:
            "Projetos solares fotovoltaicos não estão incluídos no plano Gratuito. Faça upgrade para o Nacif Solar ou Nacif Completo.",
        };
      }
    }

    if (isPredial && effectivePlanCode(user) === "solar") {
      return {
        allowed: false,
        reason:
          "Projetos elétricos prediais completos não estão incluídos no plano Nacif Solar. Faça upgrade para o Nacif Elétrico ou Nacif Completo.",
      };
    }
  }

  if (
    plan.projects !== Number.POSITIVE_INFINITY &&
    currentProjectCount >= plan.projects
  ) {
    return {
      allowed: false,
      reason: `Limite de ${plan.projects} projetos ativos atingido para o plano ${plan.name}. Faça upgrade para continuar criando novos projetos.`,
    };
  }

  return { allowed: true };
};

export const checkServerModuleAccess = (
  user: {
    role?: string;
    isSuperAdmin?: boolean;
    plan?: string;
    customPermissions?: unknown;
  },
  moduleKey: string,
): {
  allowed: boolean;
  isAcademic?: boolean;
  isFreeRestricted?: boolean;
  watermark?: string;
  message?: string;
} => {
  if (isServerAdmin(user)) {
    return { allowed: true };
  }

  const permissions = (user.customPermissions as Record<string, unknown>) || {};
  const subStatus = String(
    permissions.subscriptionStatus || "active",
  ).toLowerCase();
  const isInactive =
    subStatus === "cancelled" ||
    subStatus === "suspended" ||
    subStatus === "unpaid" ||
    subStatus === "expired";
  const effectiveCode = effectivePlanCode(user);
  const plan = getServerPlan(effectiveCode);
  const normalizedModule = String(moduleKey).toLowerCase().trim();

  if (["gratuito", "free"].includes(effectiveCode)) {
    if (
      normalizedModule === "solar" ||
      normalizedModule === "solar_project" ||
      normalizedModule === "solar_3d"
    ) {
      return {
        allowed: false,
        message:
          "O dimensionamento solar fotovoltaico está disponível nos planos Nacif Solar e Nacif Completo.",
      };
    }
    if (normalizedModule === "panel" || normalizedModule === "unifilar") {
      return {
        allowed: false,
        message:
          "A montagem de quadros DIN e diagramas unifilares exige o plano Nacif Elétrico ou Nacif Completo.",
      };
    }
    return {
      allowed: true,
      isFreeRestricted: true,
      watermark: "Versão de Avaliação Gratuita — Nacif Energy",
    };
  }

  if (plan.isAcademic) {
    return {
      allowed: true,
      isAcademic: true,
      watermark: "Versão Acadêmica — Nacif Estudante — Uso Educacional",
    };
  }

  if (normalizedModule.includes("solar")) {
    if (effectivePlanCode(user) === "eletrico") {
      return {
        allowed: false,
        message:
          "O dimensionamento solar está disponível nos planos Nacif Solar e Nacif Completo.",
      };
    }
    return { allowed: true };
  }

  if (
    normalizedModule.includes("predial") ||
    normalizedModule.includes("plant") ||
    normalizedModule.includes("panel") ||
    normalizedModule.includes("unifilar")
  ) {
    if (effectivePlanCode(user) === "solar") {
      return {
        allowed: false,
        message:
          "Projetos elétricos prediais e quadros DIN estão disponíveis nos planos Nacif Elétrico e Nacif Completo.",
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
};
