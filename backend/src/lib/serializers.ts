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
  company: string;
  crea: string;
  phone: string;
  avatar_url: string;
  created_date: string;
  updated_date: string;
  status?: string;
  is_super_admin?: boolean;
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

export const serializeUser = (user: User): SafeUser => ({
  status: user.status,
  is_super_admin: user.isSuperAdmin,
  subscription_status: (user.customPermissions as any)?.subscriptionStatus || "active",
  subscription_cycle: (user.customPermissions as any)?.subscriptionCycle || "monthly",
  subscription_start_date: (user.customPermissions as any)?.subscriptionStartDate || null,
  subscription_valid_until: (user.customPermissions as any)?.subscriptionRenewalDate || null,
  subscription_auto_renew: (user.customPermissions as any)?.autoRenew ?? false,
  billing_provider: (user.customPermissions as any)?.billingProvider || "manual",
  stripe_customer_id: (user.customPermissions as any)?.stripeCustomerId || null,
  stripe_subscription_id: (user.customPermissions as any)?.stripeSubscriptionId || null,
  academic_status: (user.customPermissions as any)?.academicStatus || "not_submitted",
  academic_institution: (user.customPermissions as any)?.academicInstitution || "",
  academic_course: (user.customPermissions as any)?.academicCourse || "",
  academic_valid_until: (user.customPermissions as any)?.academicValidUntil || null,
  academic_document_name: (user.customPermissions as any)?.academicDocumentName || "",
  academic_document_url: (user.customPermissions as any)?.academicDocumentUrl || "",
  monthly_exports_count: (user.customPermissions as any)?.monthlyExports || 0,
  monthly_ai_scans_count: (user.customPermissions as any)?.monthlyAiScans || 0,
  usage_period: (user.customPermissions as any)?.usagePeriod || "",
  storage_used_mb: (user.customPermissions as any)?.storageUsedMb || 0,
  team_members_count: ((user.customPermissions as any)?.teamMembers || []).length + 1,
  id: user.id,
  email: user.email,
  full_name: user.fullName,
  role: user.role,
  plan: effectivePlanCode(user) as UserPlan,
  profession: user.profession ?? "",
  company: user.company ?? "",
  crea: user.crea ?? "",
  phone: user.phone ?? "",
  avatar_url: user.avatarUrl ?? "",
  created_date: user.createdAt.toISOString(),
  updated_date: user.updatedAt.toISOString(),
});

export const serializeProject = (
  project: Project & { createdBy?: { email: string } | null },
): SafeProject => ({
  id: project.id,
  name: project.name,
  client_name: project.clientName ?? "",
  address: project.address ?? "",
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
