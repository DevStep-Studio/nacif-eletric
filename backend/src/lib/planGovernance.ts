import { env } from "../config/env.js";
import { COMMERCIAL_PLANS, LEGACY_PLANS, catalogModuleAccess } from "./planCatalog.js";
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

type AccessUser = { role?: string; isSuperAdmin?: boolean; plan?: string; customPermissions?: unknown };
export const projectModule = (projectType?: string | null) => /solar|fotovolta/i.test(projectType || "") ? "solar" : "plant";

export const checkServerProjectCreation = (user?: AccessUser, count = 0, projectType?: string | null): { allowed: boolean; reason?: string } => {
  if (user && isServerAdmin(user)) return { allowed: true };
  const access = checkServerModuleAccess(user, projectModule(projectType));
  if (!access.allowed) return { allowed: false, reason: access.message || undefined };
  const limit = getServerPlan(effectivePlanCode(user)).projects;
  return count < limit ? { allowed: true } : { allowed: false, reason: `Seu plano permite ${limit} projetos ativos. Exclua um projeto ou altere seu plano.` };
};

export const checkServerModuleAccess = (user?: AccessUser, moduleKey = "") => {
  const permissions = (user?.customPermissions as Record<string, any>) || {};
  return catalogModuleAccess(effectivePlanCode(user), moduleKey, {
    isAdmin: user ? isServerAdmin(user) : false,
    academicStatus: permissions.academicStatus,
    academicValidUntil: permissions.academicValidUntil,
  });
};

export function projectPayloadAccess(user: AccessUser, data: Record<string, any>, existingType?: string | null) {
  const nextType = data.project_type ?? data.projectType ?? existingType;
  const modules = new Set([projectModule(nextType)]);
  if (existingType) modules.add(projectModule(existingType));
  const populated = (value: any) => value != null && (typeof value === "object" ? Object.keys(value).length > 0 : Boolean(value));
  if (populated(data.plant_design ?? data.plantDesign) || data.plant_points_count > 0 || data.plant_routes_count > 0) modules.add("plant");
  const solar = data.solar_config ?? data.solarConfig;
  const common = new Set(["consumption", "monthly_consumption_kwh", "tariff_brl_kwh", "distributor", "consumer_unit", "tariff_class", "contracted_demand_kw", "zip_code", "city", "state", "address", "latitude", "longitude"]);
  if (solar && typeof solar === "object" && Object.keys(solar).some(key => !common.has(key))) modules.add("solar");
  // Solar projects contain their own inverter/protection circuits. General electrical
  // design remains gated separately, including when changing an existing project's type.
  if (projectModule(nextType) !== "solar") {
    if (populated(data.panel_layout ?? data.panelLayout) || populated(data.panel_boards ?? data.panelBoards)) modules.add("panel");
    if (populated(data.diagram_layout ?? data.diagramLayout)) modules.add("unifilar");
  }
  for (const module of modules) {
    const result = checkServerModuleAccess(user, module);
    if (!result.allowed) return result;
  }
  return checkServerModuleAccess(user, projectModule(nextType));
}
