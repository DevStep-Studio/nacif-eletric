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
  return entitlement && COMMERCIAL_PLANS.some(p => p.code === entitlement.planCode) ? entitlement.planCode : "gratuito";
};

export const getServerPlan = (planCode?: string | null): PlanLimitDefinition =>
  SERVER_PLAN_MATRIX[planCode || "gratuito"] || SERVER_PLAN_MATRIX.gratuito;

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
  user?: { role?: string; isSuperAdmin?: boolean; plan?: string; customPermissions?: unknown },
  count = 0, projectType?: string | null,
): { allowed: boolean; reason?: string } => {
  const plan = getServerPlan(effectivePlanCode(user));
  const module = checkServerModuleAccess(user, /solar|fotovolta/i.test(projectType || "") ? "solar" : "plant");
  if (!module.allowed) return { allowed: false, reason: module.message };
  return count < plan.projects ? { allowed: true } : { allowed: false, reason: "Limite de projetos atingido. Consulte os planos disponíveis." };
};

export const checkServerModuleAccess = (
  user?: { role?: string; isSuperAdmin?: boolean; plan?: string; customPermissions?: unknown }, moduleKey = "",
): { allowed: boolean; isAcademic?: boolean; isFreeRestricted?: boolean; watermark?: string; message?: string } => {
  const code = effectivePlanCode(user);
  const plan = [...COMMERCIAL_PLANS, ...LEGACY_PLANS].find(p => p.code === code || p.legacyCodes?.includes(code));
  const aliases: Record<string, string> = { circuit_editor: "plant", phase_balance: "calculator", electrical_tools: "calculator", memorial: "unifilar", solar_project: "solar" };
  const level = moduleKey === "scanner" ? plan?.limits?.aiScans > 0 : plan?.modules?.[aliases[moduleKey] || moduleKey];
  const allowed = Boolean(level && level !== "none" && level !== "restricted");
  return { allowed, isAcademic: !!plan?.isAcademic, isFreeRestricted: code === "gratuito",
    ...(code === "gratuito" ? { watermark: "Versão de Avaliação Gratuita" } : {}),
    ...(!allowed ? { message: "Este recurso exige uma assinatura ativa com acesso ao módulo." } : {}),
  };
};
