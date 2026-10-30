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

export const SERVER_PLAN_MATRIX: Record<string, PlanLimitDefinition> = {
  gratuito: {
    name: "Nacif Gratuito",
    projects: 3,
    storageMb: 250,
    teamMembers: 1,
    exports: 5,
    aiScans: 5,
    customTemplates: 0,
  },
  free: {
    name: "Nacif Gratuito",
    projects: 3,
    storageMb: 250,
    teamMembers: 1,
    exports: 5,
    aiScans: 5,
    customTemplates: 0,
  },
  estudante: {
    name: "Nacif Estudante",
    projects: 5,
    storageMb: 1000,
    teamMembers: 1,
    exports: 20,
    aiScans: 20,
    customTemplates: 0,
    isAcademic: true,
  },
  eletrico: {
    name: "Nacif Elétrico",
    projects: 30,
    storageMb: 5000,
    teamMembers: 3,
    exports: 100,
    aiScans: 100,
    customTemplates: 10,
  },
  solar: {
    name: "Nacif Solar",
    projects: 30,
    storageMb: 5000,
    teamMembers: 3,
    exports: 100,
    aiScans: 100,
    customTemplates: 10,
  },
  completo: {
    name: "Nacif Completo",
    projects: Number.POSITIVE_INFINITY,
    storageMb: 50000,
    teamMembers: 15,
    exports: Number.POSITIVE_INFINITY,
    aiScans: 500,
    customTemplates: Number.POSITIVE_INFINITY,
  },
  profissional: {
    name: "Profissional (Legado)",
    projects: 50,
    storageMb: 5000,
    teamMembers: 3,
    exports: 100,
    aiScans: 100,
    customTemplates: 10,
  },
  engenharia: {
    name: "Engenharia (Legado)",
    projects: Number.POSITIVE_INFINITY,
    storageMb: 50000,
    teamMembers: 15,
    exports: Number.POSITIVE_INFINITY,
    aiScans: 500,
    customTemplates: Number.POSITIVE_INFINITY,
  },
};

export const getCurrentUsagePeriod = (): string => {
  return new Date().toISOString().slice(0, 7);
};

export const getServerPlan = (planCode?: string | null): PlanLimitDefinition => {
  const normalized = String(planCode || "gratuito").toLowerCase().trim();
  return SERVER_PLAN_MATRIX[normalized] || SERVER_PLAN_MATRIX.gratuito;
};

export const isServerAdmin = (user: { role?: string; isSuperAdmin?: boolean }): boolean => {
  return user.role === "admin" || user.role === "super_admin" || Boolean(user.isSuperAdmin);
};

export const checkServerProjectCreation = (
  user: { role?: string; isSuperAdmin?: boolean; plan?: string; customPermissions?: unknown },
  currentProjectCount: number,
  projectType?: string | null,
): { allowed: boolean; reason?: string } => {
  if (isServerAdmin(user)) {
    return { allowed: true };
  }

  const permissions = (user.customPermissions as Record<string, unknown>) || {};
  const subStatus = String(permissions.subscriptionStatus || "active").toLowerCase();
  const isInactive = subStatus === "cancelled" || subStatus === "suspended" || subStatus === "unpaid" || subStatus === "expired";
  const plan = isInactive ? SERVER_PLAN_MATRIX.gratuito : getServerPlan(user.plan);

  if (plan.isAcademic) {
    const academicStatus = String(permissions.academicStatus || "");
    if (academicStatus === "expired" || academicStatus === "rejected") {
      return {
        allowed: false,
        reason: "Vínculo acadêmico vencido ou rejeitado. Regularize seu comprovante acadêmico para criar novos projetos.",
      };
    }
  }

  const normalizedType = String(projectType || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalizedType.length > 0) {
    const isSolar = normalizedType.includes("solar") || normalizedType.includes("fotovolt");
    const isPredial = normalizedType.includes("predial") || normalizedType.includes("instalac") || normalizedType.includes("eletric");

    if (isSolar) {
      if (user.plan === "eletrico") {
        return {
          allowed: false,
          reason: "Projetos solares não estão incluídos no plano Nacif Elétrico. Faça upgrade para o Nacif Solar ou Nacif Completo.",
        };
      }
      if (user.plan === "gratuito" || isInactive) {
        return {
          allowed: false,
          reason: "Projetos solares fotovoltaicos não estão incluídos no plano Gratuito. Faça upgrade para o Nacif Solar ou Nacif Completo.",
        };
      }
    }

    if (isPredial && user.plan === "solar") {
      return {
        allowed: false,
        reason: "Projetos elétricos prediais completos não estão incluídos no plano Nacif Solar. Faça upgrade para o Nacif Elétrico ou Nacif Completo.",
      };
    }
  }

  if (plan.projects !== Number.POSITIVE_INFINITY && currentProjectCount >= plan.projects) {
    return {
      allowed: false,
      reason: `Limite de ${plan.projects} projetos ativos atingido para o plano ${plan.name}. Faça upgrade para continuar criando novos projetos.`,
    };
  }

  return { allowed: true };
};

export const checkServerModuleAccess = (
  user: { role?: string; isSuperAdmin?: boolean; plan?: string; customPermissions?: unknown },
  moduleKey: string,
): { allowed: boolean; isAcademic?: boolean; isFreeRestricted?: boolean; watermark?: string; message?: string } => {
  if (isServerAdmin(user)) {
    return { allowed: true };
  }

  const permissions = (user.customPermissions as Record<string, unknown>) || {};
  const subStatus = String(permissions.subscriptionStatus || "active").toLowerCase();
  const isInactive = subStatus === "cancelled" || subStatus === "suspended" || subStatus === "unpaid" || subStatus === "expired";
  const plan = isInactive ? SERVER_PLAN_MATRIX.gratuito : getServerPlan(user.plan);
  const normalizedModule = String(moduleKey).toLowerCase().trim();

  if (plan.name === "Nacif Gratuito") {
    if (normalizedModule === "solar" || normalizedModule === "solar_project" || normalizedModule === "solar_3d") {
      return { allowed: false, message: "O dimensionamento solar fotovoltaico está disponível nos planos Nacif Solar e Nacif Completo." };
    }
    if (normalizedModule === "panel" || normalizedModule === "unifilar") {
      return { allowed: false, message: "A montagem de quadros DIN e diagramas unifilares exige o plano Nacif Elétrico ou Nacif Completo." };
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
    if (user.plan === "eletrico") {
      return { allowed: false, message: "O dimensionamento solar está disponível nos planos Nacif Solar e Nacif Completo." };
    }
    return { allowed: true };
  }

  if (normalizedModule.includes("predial") || normalizedModule.includes("plant") || normalizedModule.includes("panel")) {
    if (user.plan === "solar") {
      return { allowed: false, message: "Projetos elétricos prediais e quadros DIN estão disponíveis nos planos Nacif Elétrico e Nacif Completo." };
    }
    return { allowed: true };
  }

  return { allowed: true };
};

