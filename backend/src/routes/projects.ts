import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma, type ProjectRevision } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { serializeProject } from "../lib/serializers.js";
import { createNotification } from "../lib/notifications.js";

const projectPayloadSchema = z.object({
  name: z.string().trim().min(1, "Nome do projeto é obrigatório."),
  client_name: z.string().trim().optional(),
  address: z.string().trim().optional(),
  project_type: z.string().trim().optional(),
  solar_config: z.unknown().optional(),
  voltage: z.number().int().nullable().optional(),
  supply_type: z.string().trim().optional(),
  circuits: z.array(z.unknown()).optional(),
  total_demand_w: z.number().optional(),
  panel_size: z.number().int().nullable().optional(),
  panel_boards: z.array(z.unknown()).optional(),
  panel_layout: z.unknown().optional(),
  diagram_layout: z.unknown().optional(),
  plant_design: z.unknown().optional(),
  plant_points_count: z.number().int().optional(),
  plant_routes_count: z.number().int().optional(),
  plant_infra_type: z.string().trim().optional(),
  status: z.enum(["Rascunho", "Em Andamento", "Concluído", "Aprovado"]).optional(),
  notes: z.string().optional(),
  materials: z.array(z.unknown()).optional(),
  manual_budget_items: z.array(z.unknown()).optional(),
}).strict();

const projectUpdateSchema = projectPayloadSchema.partial();

const listQuerySchema = z.object({
  sortBy: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const sortMap: Record<string, Record<string, "asc" | "desc">> = {
  created_date: { createdAt: "asc" },
  "-created_date": { createdAt: "desc" },
  updated_date: { updatedAt: "asc" },
  "-updated_date": { updatedAt: "desc" },
  name: { name: "asc" },
  "-name": { name: "desc" },
};

const mapStatus = (value?: "Rascunho" | "Em Andamento" | "Concluído" | "Aprovado") => {
  if (!value) return undefined;

  const map = {
    "Rascunho": "Rascunho",
    "Em Andamento": "Em_Andamento",
    "Concluído": "Concluido",
    "Aprovado": "Aprovado",
  } as const;

  return map[value];
};

const ensureProjectAccess = async (projectId: string, userId: string, isAdmin: boolean) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { createdBy: { select: { email: true } } },
  });

  if (!project) {
    throw new AppError("Projeto não encontrado.", 404);
  }

  if (!isAdmin && project.createdById !== userId) {
    throw new AppError("Você não tem acesso a este projeto.", 403);
  }

  return project;
};

const buildRevisionSnapshot = (project: {
  id: string;
  name: string;
  clientName: string | null;
  address: string | null;
  projectType: string | null;
  solarConfig: unknown;
  voltage: number | null;
  supplyType: string | null;
  circuits: unknown;
  totalDemandW: number;
  panelSize: number | null;
  panelBoards: unknown;
  panelLayout: unknown;
  diagramLayout: unknown;
  plantDesign: unknown;
  plantPointsCount: number | null;
  plantRoutesCount: number | null;
  plantInfraType: string | null;
  status: string;
  notes: string | null;
  materials: unknown;
  manualBudgetItems: unknown;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: { email: string } | null;
}) => ({
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
  status: project.status,
  notes: project.notes ?? "",
  materials: Array.isArray(project.materials) ? project.materials : [],
  manual_budget_items: Array.isArray(project.manualBudgetItems) ? project.manualBudgetItems : [],
  created_by: project.createdBy?.email ?? "",
  created_by_id: project.createdById,
  created_date: project.createdAt.toISOString(),
  updated_date: project.updatedAt.toISOString(),
});

const createProjectRevision = async ({
  project,
  actorUserId,
  actorEmail,
  action,
  summary,
}: {
  project: Awaited<ReturnType<typeof ensureProjectAccess>>;
  actorUserId: string;
  actorEmail: string;
  action: "create" | "update" | "delete";
  summary?: string;
}) => {
  const currentMax = await prisma.projectRevision.aggregate({
    where: { projectId: project.id },
    _max: { version: true },
  });

  return prisma.projectRevision.create({
    data: {
      projectId: project.id,
      version: (currentMax._max.version ?? 0) + 1,
      action,
      actorUserId,
      actorEmail,
      snapshot: buildRevisionSnapshot(project) as Prisma.InputJsonValue,
      summary,
    },
  });
};

const notifyProjectState = async ({
  userId,
  projectId,
  projectName,
  circuits,
}: {
  userId: string;
  projectId: string;
  projectName: string;
  circuits: unknown;
}) => {
  const projectCircuits = Array.isArray(circuits) ? circuits : [];

  if (projectCircuits.length === 0) {
    await createNotification({
      userId,
      title: `Projeto "${projectName}" sem circuitos`,
      description: "Cadastre os primeiros circuitos para liberar análises, quadro e documentação.",
      category: "Projeto",
      tone: "warning",
      href: `/projects/${projectId}`,
    });
  }
};

export const registerProjectRoutes = async (app: FastifyInstance) => {
  app.get("/api/projects", { preHandler: [app.authenticate] }, async (request) => {
    const query = listQuerySchema.parse(request.query);
    const isAdmin = request.authUser.role === "admin";
    const projects = await prisma.project.findMany({
      where: isAdmin ? undefined : { createdById: request.authUser.id },
      include: { createdBy: { select: { email: true } } },
      orderBy: query.sortBy ? sortMap[query.sortBy] ?? { createdAt: "desc" } : { createdAt: "desc" },
      take: query.limit,
    });

    return projects.map(serializeProject);
  });

  app.get("/api/projects/:id", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const project = await ensureProjectAccess(id, request.authUser.id, request.authUser.role === "admin");
    return serializeProject(project);
  });

  app.get("/api/projects/:id/revisions", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    await ensureProjectAccess(id, request.authUser.id, request.authUser.role === "admin");

    const revisions = await prisma.projectRevision.findMany({
      where: { projectId: id },
      orderBy: { version: "desc" },
    });

    return revisions.map((revision: ProjectRevision) => ({
      id: revision.id,
      project_id: revision.projectId,
      version: revision.version,
      action: revision.action,
      actor_user_id: revision.actorUserId,
      actor_email: revision.actorEmail,
      snapshot: revision.snapshot,
      summary: revision.summary ?? "",
      created_date: revision.createdAt.toISOString(),
    }));
  });

  app.post("/api/projects", { preHandler: [app.authenticate] }, async (request) => {
    const data = projectPayloadSchema.parse(request.body);

    // Validação centralizada de limite de projetos e restrição de escopo por plano
    const userPlan = String(request.authUser.plan || "gratuito").toLowerCase();
    const activeProjectsCount = await prisma.project.count({
      where: {
        createdById: request.authUser.id,
        status: { not: "Aprovado" },
      },
    });

    const planLimits: Record<string, number> = {
      gratuito: 3,
      free: 3,
      estudante: 5,
      eletrico: 30,
      profissional: 50,
      solar: 30,
      completo: Number.POSITIVE_INFINITY,
      engenharia: Number.POSITIVE_INFINITY,
    };

    const limit = planLimits[userPlan] ?? 3;
    if (activeProjectsCount >= limit) {
      throw new AppError(
        `Limite de ${limit} projetos ativos atingido para o seu plano. Faça upgrade para continuar criando novos projetos.`,
        403,
      );
    }

    const projectTypeNormalized = String(data.project_type || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (projectTypeNormalized.includes("solar") && userPlan === "eletrico") {
      throw new AppError(
        "Projetos solares não estão incluídos no plano Nacif Elétrico. Faça upgrade para o Nacif Solar ou Nacif Completo.",
        403,
      );
    }

    if ((projectTypeNormalized.includes("predial") || projectTypeNormalized.includes("instalac") || projectTypeNormalized.includes("eletric")) && userPlan === "solar") {
      throw new AppError(
        "Plantas elétricas prediais gerais não estão incluídas no plano Nacif Solar. Faça upgrade para o Nacif Elétrico ou Nacif Completo.",
        403,
      );
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        clientName: data.client_name ?? "",
        address: data.address ?? "",
        projectType: data.project_type ?? "Instalações Elétricas",
        solarConfig: (data.solar_config ?? null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
        voltage: data.voltage ?? null,
        supplyType: data.supply_type ?? "",
        circuits: (data.circuits ?? []) as Prisma.InputJsonValue,
        totalDemandW: data.total_demand_w ?? 0,
        panelSize: data.panel_size ?? null,
        panelBoards: (data.panel_boards ?? []) as Prisma.InputJsonValue,
        panelLayout: (data.panel_layout ?? null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
        diagramLayout: (data.diagram_layout ?? null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
        plantDesign: (data.plant_design ?? null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
        plantPointsCount: data.plant_points_count ?? 0,
        plantRoutesCount: data.plant_routes_count ?? 0,
        plantInfraType: data.plant_infra_type ?? "",
        status: mapStatus(data.status) ?? "Rascunho",
        notes: data.notes ?? "",
        materials: (data.materials ?? []) as Prisma.InputJsonValue,
        manualBudgetItems: (data.manual_budget_items ?? []) as Prisma.InputJsonValue,
        createdById: request.authUser.id,
      },
      include: { createdBy: { select: { email: true } } },
    });

    await createProjectRevision({
      project,
      actorUserId: request.authUser.id,
      actorEmail: request.authUser.email,
      action: "create",
      summary: "Projeto criado",
    });

    await createNotification({
      userId: request.authUser.id,
      title: "Projeto criado com sucesso",
      description: `"${project.name}" foi cadastrado e já pode receber circuitos, quadro e documentação.`,
      category: "Projeto",
      tone: "success",
      href: `/projects/${project.id}`,
    });

    await notifyProjectState({
      userId: request.authUser.id,
      projectId: project.id,
      projectName: project.name,
      circuits: project.circuits,
    });

    return serializeProject(project);
  });

  app.patch("/api/projects/:id", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    await ensureProjectAccess(id, request.authUser.id, request.authUser.role === "admin");
    const data = projectUpdateSchema.parse(request.body);

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        clientName: data.client_name,
        address: data.address,
        projectType: data.project_type,
        solarConfig: data.solar_config as Prisma.InputJsonValue | undefined,
        voltage: data.voltage,
        supplyType: data.supply_type,
        circuits: data.circuits as Prisma.InputJsonValue | undefined,
        totalDemandW: data.total_demand_w,
        panelSize: data.panel_size,
        panelBoards: data.panel_boards as Prisma.InputJsonValue | undefined,
        panelLayout: data.panel_layout as Prisma.InputJsonValue | undefined,
        diagramLayout: data.diagram_layout as Prisma.InputJsonValue | undefined,
        plantDesign: data.plant_design as Prisma.InputJsonValue | undefined,
        plantPointsCount: data.plant_points_count,
        plantRoutesCount: data.plant_routes_count,
        plantInfraType: data.plant_infra_type,
        status: mapStatus(data.status),
        notes: data.notes,
        materials: data.materials as Prisma.InputJsonValue | undefined,
        manualBudgetItems: data.manual_budget_items as Prisma.InputJsonValue | undefined,
      },
      include: { createdBy: { select: { email: true } } },
    });

    await createProjectRevision({
      project,
      actorUserId: request.authUser.id,
      actorEmail: request.authUser.email,
      action: "update",
      summary: "Projeto atualizado",
    });

    await notifyProjectState({
      userId: request.authUser.id,
      projectId: project.id,
      projectName: project.name,
      circuits: project.circuits,
    });

    return serializeProject(project);
  });

  app.delete("/api/projects/:id", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const project = await ensureProjectAccess(id, request.authUser.id, request.authUser.role === "admin");
    await createProjectRevision({
      project,
      actorUserId: request.authUser.id,
      actorEmail: request.authUser.email,
      action: "delete",
      summary: "Projeto removido",
    });
    await prisma.project.delete({ where: { id } });

    await createNotification({
      userId: request.authUser.id,
      title: "Projeto removido",
      description: `"${project.name}" foi excluído da base do sistema.`,
      category: "Projeto",
      tone: "info",
      href: "/projects",
    });

    return { ok: true };
  });
};
