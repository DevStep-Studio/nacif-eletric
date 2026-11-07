import { normalizeAccountStatus } from "./accountAccess.js";
import { effectivePlanCode } from "./planGovernance.js";
import type { Project, ProjectStatus, User, UserPlan, UserRole } from "@prisma/client";

const projectStatusLabelMap: Record<ProjectStatus, "Rascunho" | "Em Andamento" | "Concluído" | "Aprovado"> = {
  Rascunho: "Rascunho",
  Em_Andamento: "Em Andamento",
  Concluido: "Concluído",
  Aprovado: "Aprovado",
};

type SafeUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  plan: UserPlan;
  profession: string;
  profissao?: string;
  is_super_admin: boolean;
  status: string;
  company: string;
  crea: string;
  phone: string;
  avatar_url: string;
  created_date: string;
  updated_date: string;
  subscription_start_date?: string | null;
  subscription_valid_until?: string | null;
  subscription_auto_renew?: boolean;
  billing_provider?: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  team_members_count?: number;
  academic_document_url?: string;
  academic_document_name?: string;
  academic_valid_until?: string | null;
  subscription_status?: string;
  subscription_cycle?: string;
  academic_status?: string;
  academic_institution?: string;
  academic_course?: string;
  monthly_exports_count?: number;
  monthly_ai_scans_count?: number;
  usage_period?: string;
  storage_used_mb?: number;
};

type SafeProject = {
  id: string;
  name: string;
  client_name: string;
  address: string;
  city: string;
  project_type: string;
  solar_config: unknown;
  voltage: number | null;
  supply_type: string;
  circuits: unknown[];
  total_demand_w: number;
  panel_size: number | null;
  panel_boards: unknown[];
  panel_layout: unknown;
  diagram_layout: unknown;
  plant_design: unknown;
  plant_points_count: number;
  plant_routes_count: number;
  plant_infra_type: string;
  status: "Rascunho" | "Em Andamento" | "Concluído" | "Aprovado";
  notes: string;
  materials: unknown[];
  manual_budget_items: unknown[];
  created_by: string;
  created_date: string;
  updated_date: string;
};

const SUPER_ADMIN_EMAILS = [
  "admin@nacif.com",
  "grc22.09@hotmail.com",
  "ian.mellofla@gmail.com",
  "wellingtonalfredo550@gmail.com",
  "comercial@nacifsolutions.com.br",
  "gabrielderezende13@gmail.com",
  "testegabriel@gmail.com",
];

export const serializeUser = (user: User): SafeUser => {
  const normalizedEmail = (user.email || "").toLowerCase().trim();
  const isSuper = user.role === "super_admin" || Boolean(user.isSuperAdmin) || SUPER_ADMIN_EMAILS.includes(normalizedEmail);
  const permissions = (user.customPermissions as Record<string, any>) || {};

  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: isSuper ? ("super_admin" as UserRole) : user.role,
    plan: effectivePlanCode(user) as UserPlan,
    profession: user.profession ?? "",
    profissao: user.profession ?? "",
    is_super_admin: isSuper,
    status: normalizeAccountStatus(user.status),
    company: user.company ?? "",
    crea: user.crea ?? "",
    phone: user.phone ?? "",
    avatar_url: user.avatarUrl ?? "",
    created_date: user.createdAt.toISOString(),
    updated_date: user.updatedAt.toISOString(),
    subscription_status: permissions.subscriptionStatus || "active",
    subscription_cycle: permissions.subscriptionCycle || "monthly",
    subscription_start_date: permissions.subscriptionStartDate || null,
    subscription_valid_until: permissions.subscriptionRenewalDate || null,
    subscription_auto_renew: permissions.autoRenew ?? false,
    billing_provider: permissions.billingProvider || "manual",
    stripe_customer_id: permissions.stripeCustomerId || null,
    stripe_subscription_id: permissions.stripeSubscriptionId || null,
    academic_status: permissions.academicStatus || (user.plan === "estudante" ? "approved" : "not_submitted"),
    academic_institution: permissions.academicInstitution || "",
    academic_course: permissions.academicCourse || "",
    academic_valid_until: permissions.academicValidUntil || null,
    academic_document_name: permissions.academicDocumentName || "",
    academic_document_url: permissions.academicDocumentUrl || "",
    monthly_exports_count: typeof permissions.monthlyExports === "number" ? permissions.monthlyExports : (typeof permissions.monthlyExportsCount === "number" ? permissions.monthlyExportsCount : 0),
    monthly_ai_scans_count: typeof permissions.monthlyAiScans === "number" ? permissions.monthlyAiScans : (typeof permissions.monthlyAiScansCount === "number" ? permissions.monthlyAiScansCount : 0),
    usage_period: permissions.usagePeriod || new Date().toISOString().slice(0, 7),
    storage_used_mb: typeof permissions.storageUsedMb === "number" ? permissions.storageUsedMb : 0,
    team_members_count: (Array.isArray(permissions.teamMembers) ? permissions.teamMembers.length : 0) + 1,
  };
};

export const serializeProject = (
  project: Project & { createdBy?: { email: string } | null },
): SafeProject => ({
  id: project.id,
  name: project.name,
  client_name: project.clientName ?? "",
  address: project.address ?? "",
  city: (project as any).city ?? "",
  project_type: project.projectType ?? "Instalações Elétricas",
  solar_config: project.solarConfig ?? null,
  voltage: project.voltage,
  supply_type: project.supplyType ?? "",
  circuits: Array.isArray(project.circuits) ? project.circuits : [],
  total_demand_w: project.totalDemandW,
  panel_size: project.panelSize,
  panel_boards: Array.isArray(project.panelBoards) ? project.panelBoards : [],
  panel_layout: project.panelLayout ?? null,
  diagram_layout: project.diagramLayout ?? null,
  plant_design: project.plantDesign ?? null,
  plant_points_count: project.plantPointsCount ?? 0,
  plant_routes_count: project.plantRoutesCount ?? 0,
  plant_infra_type: project.plantInfraType ?? "",
  status: projectStatusLabelMap[project.status],
  notes: project.notes ?? "",
  materials: Array.isArray(project.materials) ? project.materials : [],
  manual_budget_items: Array.isArray(project.manualBudgetItems) ? project.manualBudgetItems : [],
  created_by: project.createdBy?.email ?? "",
  created_date: project.createdAt.toISOString(),
  updated_date: project.updatedAt.toISOString(),
});
