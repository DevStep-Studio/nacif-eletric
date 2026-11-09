import { env } from "../config/env.js";
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

export function paidEntitlement(user?: { customPermissions?: unknown }) {
  const p = (user?.customPermissions as Record<string, any>) || {};
  if (p.billingProvider !== "asaas" || p.billingEnvironment !== env.ASAAS_ENVIRONMENT) return null;
  const now = Date.now();
  const periods = Array.isArray(p.billingEntitlements) ? p.billingEntitlements : [];
  const active = periods.filter((period: any) => Date.parse(period.start) <= now && Date.parse(period.end) > now)
    .sort((a: any, b: any) => Date.parse(b.start) - Date.parse(a.start))[0];
  if (!active) return null;
  const result = { ...active };
  for (const period of [...periods].sort((a: any,b: any) => Date.parse(a.start) - Date.parse(b.start))) {
    if (period.planCode === result.planCode && period.cycle === result.cycle && Date.parse(period.start) <= Date.parse(result.end) && Date.parse(period.end) > Date.parse(result.end)) result.end = period.end;
  }
  return result;
}

export const effectivePlanCode = (user?: {
  role?: string; isSuperAdmin?: boolean; plan?: string; customPermissions?: unknown;
}): string => {
  if (user && isServerAdmin(user)) return "completo";
  const entitlement = paidEntitlement(user);
  if (entitlement && COMMERCIAL_PLANS.some(p => p.code === entitlement.planCode)) {
    return entitlement.planCode;
  }
  return "gratuito";
};

export const getServerPlan = (planCode?: string | null): PlanLimitDefinition => {
  const base = SERVER_PLAN_MATRIX[planCode || "completo"] || SERVER_PLAN_MATRIX.completo || SERVER_PLAN_MATRIX.gratuito;
  return {
    ...base,
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
  _user?: { role?: string; isSuperAdmin?: boolean; plan?: string; customPermissions?: unknown },
  _count = 0, _projectType?: string | null,
): { allowed: boolean; reason?: string } => {
  return { allowed: true };
};

export const checkServerModuleAccess = (
  _user?: { role?: string; isSuperAdmin?: boolean; plan?: string; customPermissions?: unknown }, _moduleKey = "",
): { allowed: boolean; isAcademic?: boolean; isFreeRestricted?: boolean; watermark?: string; message?: string } => {
  return { allowed: true, isAcademic: false, isFreeRestricted: false };
};
