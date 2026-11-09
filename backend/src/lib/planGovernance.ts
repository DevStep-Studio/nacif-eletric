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

export const effectivePlanCode = (_user?: {
  plan?: string;
  customPermissions?: unknown;
}): string => {
  return "completo";
};

export const getServerPlan = (
  _planCode?: string | null,
): PlanLimitDefinition => {
  return {
    name: "Nacif Completo",
    projects: Number.POSITIVE_INFINITY,
    storageMb: Number.POSITIVE_INFINITY,
    teamMembers: Number.POSITIVE_INFINITY,
    exports: Number.POSITIVE_INFINITY,
    aiScans: Number.POSITIVE_INFINITY,
    customTemplates: Number.POSITIVE_INFINITY,
    isAcademic: false,
  };
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
  _user?: {
    role?: string;
    isSuperAdmin?: boolean;
    plan?: string;
    customPermissions?: unknown;
  },
  _currentProjectCount?: number,
  _projectType?: string | null,
): { allowed: boolean; reason?: string } => {
  return { allowed: true };
};

export const checkServerModuleAccess = (
  _user?: {
    role?: string;
    isSuperAdmin?: boolean;
    plan?: string;
    customPermissions?: unknown;
  },
  _moduleKey?: string,
): {
  allowed: boolean;
  isAcademic?: boolean;
  isFreeRestricted?: boolean;
  watermark?: string;
  message?: string;
} => {
  return {
    allowed: true,
    isAcademic: false,
    isFreeRestricted: false,
  };
};
