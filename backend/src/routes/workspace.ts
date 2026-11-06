import { env } from "../config/env.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { serializeProject, serializeUser } from "../lib/serializers.js";
import { generateResetToken, hashPassword } from "../lib/auth.js";
import { isServerAdmin } from "../lib/planGovernance.js";

const idOf = (request: any) =>
  z.object({ id: z.string().min(1) }).parse(request.params).id;
const budgetFields: Record<string, string> = {
  client_info: "clientInfo",
  project_id: "projectId",
  labor_cost: "laborCost",
  product_adjustment: "productAdjustment",
  discount_type: "discountType",
  discount_value: "discountValue",
  surcharge_type: "surchargeType",
  surcharge_value: "surchargeValue",
  validity_days: "validityDays",
  payment_terms: "paymentTerms",
  execution_deadline: "executionDeadline",
};
const budgetSchema = z.object({
  name: z.string().min(1),
  status: z
    .enum(["Rascunho", "Enviado", "Aprovado", "Recusado", "Em Revisão"])
    .optional(),
  margin: z.number().min(0).optional(),
  labor_cost: z.number().min(0).optional(),
  product_adjustment: z.number().optional(),
  discount_type: z.enum(["percent", "fixed"]).optional(),
  discount_value: z.number().min(0).optional(),
  surcharge_type: z.enum(["percent", "fixed"]).optional(),
  surcharge_value: z.number().min(0).optional(),
  validity_days: z.number().int().positive().optional(),
  payment_terms: z.string().nullable().optional(),
  execution_deadline: z.string().nullable().optional(),
  materials: z.array(z.any()).optional(),
  services: z.array(z.any()).optional(),
  client_info: z.record(z.string(), z.any()).optional(),
  notes: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
});
const budgetData = (input: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(input).map(([k, v]) => [
      budgetFields[k] || k,
      k === "status" && v === "Em Revisão" ? "Em_Revisao" : v,
    ]),
  );
const serializeBudget = (row: any) => {
  const reverse = Object.fromEntries(
    Object.entries(budgetFields).map(([k, v]) => [v, k]),
  );
  return {
    ...Object.fromEntries(
      Object.entries(row).map(([k, v]) => [reverse[k] || k, v]),
    ),
    status: row.status === "Em_Revisao" ? "Em Revisão" : row.status,
    owner_id: row.ownerId,
    created_date: row.createdAt.toISOString(),
    updated_date: row.updatedAt.toISOString(),
  };
};
const issueFields: Record<string, string> = {
  steps_to_reproduce: "stepsToReproduce",
  expected_result: "expectedResult",
  actual_result: "actualResult",
  technical_info: "technicalInfo",
  project_id: "projectId",
  internal_notes: "internalNotes",
};
const issueSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  module: z.string().min(1),
  description: z.string().min(1),
  steps_to_reproduce: z.string().optional(),
  expected_result: z.string().optional(),
  actual_result: z.string().optional(),
  technical_info: z.record(z.string(), z.any()).optional(),
  project_id: z.string().nullable().optional(),
});
const serializeIssue = (row: any, admin: boolean) => ({
  id: row.id,
  protocol: row.protocol,
  type: row.type,
  title: row.title,
  module: row.module,
  description: row.description,
  status: row.status,
  priority: row.priority,
  user_id: row.userId,
  user_name: row.user?.fullName || "",
  user_email: row.user?.email || "",
  project_id: row.projectId,
  steps_to_reproduce: row.stepsToReproduce,
  expected_result: row.expectedResult,
  actual_result: row.actualResult,
  technical_info: row.technicalInfo,
  ...(admin ? { internal_notes: row.internalNotes } : {}),
  unread_user: row.unreadUser,
  unread_admin: row.unreadAdmin,
  created_date: row.createdAt.toISOString(),
  updated_date: row.updatedAt.toISOString(),
  comments: (row.comments || [])
    .filter((c: any) => admin || !c.isInternal)
    .map((c: any) => ({
      id: c.id,
      content: c.message,
      message: c.message,
      author_id: c.authorId,
      author_name: c.authorName,
      author_role: c.authorRole,
      is_internal: c.isInternal,
      created_date: c.createdAt.toISOString(),
    })),
  attachments: row.attachments || [],
  audit_logs: row.auditLogs || [],
});

export const registerWorkspaceRoutes = async (app: FastifyInstance) => {
  const auth = { preHandler: [app.authenticate] },
    admin = { preHandler: [app.requireAdmin] };
  const own = (request: any, field: string) =>
    isServerAdmin(request.authUser) ? {} : { [field]: request.authUser.id };
  const ensureProject = async (id: string | null | undefined, request: any) => {
    if (
      id &&
      !(await prisma.project.findFirst({
        where: { id, ...own(request, "createdById") },
      }))
    )
      throw new AppError("Projeto não encontrado.", 404);
  };
  const budget = async (request: any) => {
    const row = await prisma.budget.findFirst({
      where: { id: idOf(request), ...own(request, "ownerId") },
    });
    if (!row) throw new AppError("Orçamento não encontrado.", 404);
    return row;
  };
  const listBudgets = async (request: any) => {
    const filter = z
      .object({
        project_id: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.method === "POST" ? request.body : {});
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(1000).default(100),
        sortBy: z.string().optional(),
      })
      .parse(request.query);
    const order = query.sortBy?.includes("created_date")
      ? "createdAt"
      : query.sortBy?.includes("name")
        ? "name"
        : "updatedAt";
    const rows = await prisma.budget.findMany({
      where: {
        ...own(request, "ownerId"),
        ...(filter.project_id ? { projectId: filter.project_id } : {}),
        ...(filter.status
          ? {
              status: (filter.status === "Em Revisão"
                ? "Em_Revisao"
                : filter.status) as any,
            }
          : {}),
      },
      orderBy: {
        [order]: query.sortBy?.startsWith("-") === false ? "asc" : "desc",
      },
      take: query.limit,
    });
    return rows.map(serializeBudget);
  };
  app.get("/api/budgets", auth, listBudgets);
  app.post("/api/budgets/filter", auth, listBudgets);
  app.get("/api/budgets/:id", auth, async (request) =>
    serializeBudget(await budget(request)),
  );
  app.post("/api/budgets", auth, async (request) => {
    const data = budgetSchema.parse(request.body);
    await ensureProject(data.project_id, request);
    return serializeBudget(
      await prisma.budget.create({
        data: {
          ...budgetData(data),
          name: data.name,
          ownerId: request.authUser.id,
        } as any,
      }),
    );
  });
  app.put("/api/budgets/:id", auth, async (request) => {
    const row = await budget(request),
      data = budgetSchema.partial().parse(request.body);
    await ensureProject(data.project_id, request);
    return serializeBudget(
      await prisma.budget.update({
        where: { id: row.id },
        data: { ...budgetData(data), version: { increment: 1 } },
      }),
    );
  });
  app.delete("/api/budgets/:id", auth, async (request) => {
    const row = await budget(request);
    await prisma.budget.delete({ where: { id: row.id } });
    return { ok: true };
  });
  app.post("/api/budgets/:id/duplicate", auth, async (request) => {
    const row = await budget(request);
    const { id, createdAt, updatedAt, ...data } = row;
    return serializeBudget(
      await prisma.budget.create({
        data: {
          ...data,
          name: `Cópia de ${data.name}`,
          status: "Rascunho",
          ownerId: request.authUser.id,
          version: 1,
        } as any,
      }),
    );
  });

  const include = {
    user: true,
    comments: true,
    attachments: true,
    auditLogs: true,
  };
  const issue = async (request: any) => {
    const row = await prisma.issue.findFirst({
      where: { id: idOf(request), ...own(request, "userId") },
      include,
    });
    if (!row) throw new AppError("Relato não encontrado.", 404);
    return row;
  };
  app.get("/api/issues", auth, async (request) => {
    const q = z
      .object({
        status: z.string().optional(),
        type: z.string().optional(),
        module: z.string().optional(),
        search: z.string().optional(),
        userOnly: z.string().optional(),
      })
      .parse(request.query);
    const filters: any = { ...own(request, "userId") };
    if (q.userOnly === "true") filters.userId = request.authUser.id;
    for (const key of ["status", "type", "module"] as const)
      if (q[key] && q[key] !== "todos") filters[key] = q[key];
    if (q.search)
      filters.OR = ["title", "description", "protocol"].map((k) => ({
        [k]: { contains: q.search },
      }));
    return (
      await prisma.issue.findMany({
        where: filters,
        include,
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    ).map((row) => serializeIssue(row, isServerAdmin(request.authUser)));
  });
  app.get("/api/issues/stats", auth, async (request) => {
    const rows = await prisma.issue.groupBy({
      by: ["status"],
      where: own(request, "userId"),
      _count: true,
    });
    return Object.assign(
      { total: rows.reduce((sum, r) => sum + r._count, 0) },
      ...rows.map((r) => ({ [r.status]: r._count })),
    );
  });
  app.get("/api/issues/:id", auth, async (request) =>
    serializeIssue(await issue(request), isServerAdmin(request.authUser)),
  );
  app.post("/api/issues", auth, async (request) => {
    const data = issueSchema.parse(request.body);
    await ensureProject(data.project_id, request);
    const mapped = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [issueFields[k] || k, v]),
    );
    return serializeIssue(
      await prisma.issue.create({
        data: {
          ...mapped,
          protocol: `NAC-${crypto.randomUUID()}`,
          userId: request.authUser.id,
        } as any,
        include,
      }),
      isServerAdmin(request.authUser),
    );
  });
  app.patch("/api/issues/:id", auth, async (request) => {
    const row = await issue(request),
      data = issueSchema.partial().parse(request.body);
    await ensureProject(data.project_id, request);
    return serializeIssue(
      await prisma.issue.update({
        where: { id: row.id },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [issueFields[k] || k, v]),
        ),
        include,
      }),
      isServerAdmin(request.authUser),
    );
  });
  app.patch("/api/issues/:id/status", admin, async (request) => {
    const row = await issue(request),
      data = z
        .object({
          status: z.enum([
            "recebido",
            "em_analise",
            "em_correcao",
            "resolvido",
            "encerrado",
          ]),
          priority: z.enum(["baixa", "media", "alta", "critica"]).optional(),
          internal_notes: z.string().optional(),
        })
        .parse(request.body);
    return serializeIssue(
      await prisma.issue.update({
        where: { id: row.id },
        data: {
          status: data.status,
          priority: data.priority,
          internalNotes: data.internal_notes,
          unreadUser: true,
        },
        include,
      }),
      true,
    );
  });
  app.post("/api/issues/:id/comments", auth, async (request) => {
    const row = await issue(request),
      data = z
        .object({
          content: z.string().optional(),
          message: z.string().optional(),
          is_internal: z.boolean().default(false),
        })
        .parse(request.body);
    const message = data.content || data.message;
    if (!message?.trim()) throw new AppError("Comentário obrigatório.", 400);
    if (data.is_internal && !isServerAdmin(request.authUser))
      throw new AppError("Comentário interno restrito.", 403);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.authUser.id },
    });
    await prisma.issueComment.create({
      data: {
        issueId: row.id,
        authorId: user.id,
        authorName: user.fullName,
        authorEmail: user.email,
        authorRole: user.role,
        message,
        isInternal: data.is_internal,
      },
    });
    return serializeIssue(
      await issue(request),
      isServerAdmin(request.authUser),
    );
  });
  app.patch("/api/issues/:id/read", auth, async (request) => {
    const row = await issue(request);
    await prisma.issue.update({
      where: { id: row.id },
      data: isServerAdmin(request.authUser)
        ? { unreadAdmin: false }
        : { unreadUser: false },
    });
    return { ok: true };
  });
  app.delete("/api/issues/:id", admin, async (request) => {
    const row = await issue(request);
    await prisma.issue.delete({ where: { id: row.id } });
    return { ok: true };
  });

  app.get("/api/auth/export-data", auth, async (request) => ({
    user: serializeUser(
      await prisma.user.findUniqueOrThrow({
        where: { id: request.authUser.id },
      }),
    ),
    projects: (
      await prisma.project.findMany({
        where: { createdById: request.authUser.id },
      })
    ).map(serializeProject),
    budgets: (
      await prisma.budget.findMany({ where: { ownerId: request.authUser.id } })
    ).map(serializeBudget),
  }));
  app.delete("/api/auth/me", auth, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.authUser.id },
    });
    if (
      (user.customPermissions as any)?.stripeSubscriptionId &&
      (user.customPermissions as any)?.autoRenew
    )
      throw new AppError(
        "Cancele a renovação da assinatura antes de excluir sua conta.",
        409,
      );
    await prisma.user.update({
      where: { id: user.id },
      data: { isDeleted: true, deletedAt: new Date(), status: "deleted" },
    });
    return { ok: true };
  });
  // The existing users interface is shared with the administration screen.
  app.get("/api/super-admin/users", admin, async () =>
    (
      await prisma.user.findMany({
        where: { isDeleted: false },
        include: { _count: { select: { projects: true } } },
      })
    ).map((u) => ({ ...serializeUser(u), projects_count: u._count.projects })),
  );
  app.get("/api/super-admin/users/:id", admin, async (request) =>
    serializeUser(
      await prisma.user.findUniqueOrThrow({ where: { id: idOf(request) } }),
    ),
  );
  app.post("/api/super-admin/users", admin, async (request) => {
    if (request.authUser.role !== "super_admin")
      throw new AppError("Acesso restrito ao super administrador.", 403);
    const data = z
      .object({
        email: z.email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        role: z.enum(["user", "admin", "super_admin"]).default("user"),
        profession: z.string().optional(),
      })
      .parse(request.body);
    return serializeUser(
      await prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: await hashPassword(data.password),
          fullName: data.full_name,
          role: data.role,
          profession: data.profession,
        },
      }),
    );
  });
  const manageUser = async (request: any) => {
    const target = await prisma.user.findUniqueOrThrow({
      where: { id: idOf(request) },
    });
    if (
      target.id === request.authUser.id ||
      (request.authUser.role !== "super_admin" && isServerAdmin(target))
    )
      throw new AppError("Operação não permitida para esta conta.", 403);
    return target;
  };
  app.patch("/api/super-admin/users/:id", admin, async (request) => {
    const target = await manageUser(request);
    const data = z
      .object({
        full_name: z.string().min(1).optional(),
        role: z.enum(["user", "admin", "super_admin"]).optional(),
        profession: z.string().optional(),
        company: z.string().optional(),
        phone: z.string().optional(),
        crea: z.string().optional(),
      })
      .parse(request.body);
    if (data.role && request.authUser.role !== "super_admin")
      throw new AppError("Alteração de perfil restrita.", 403);
    return serializeUser(
      await prisma.user.update({
        where: { id: target.id },
        data: {
          fullName: data.full_name,
          role: data.role,
          profession: data.profession,
          company: data.company,
          phone: data.phone,
          crea: data.crea,
        },
      }),
    );
  });
  app.patch("/api/super-admin/users/:id/status", admin, async (request) => {
    const target = await manageUser(request),
      { status } = z
        .object({ status: z.enum(["active", "suspended", "inactive"]) })
        .parse(request.body);
    return serializeUser(
      await prisma.user.update({ where: { id: target.id }, data: { status } }),
    );
  });
  app.delete("/api/super-admin/users/:id", admin, async (request) => {
    const target = await manageUser(request);
    if ((target.customPermissions as any)?.autoRenew)
      throw new AppError("Cancele a renovação antes de excluir a conta.", 409);
    await prisma.user.update({
      where: { id: target.id },
      data: { isDeleted: true, deletedAt: new Date(), status: "deleted" },
    });
    return { ok: true };
  });
  app.post(
    "/api/super-admin/users/:id/reset-password",
    admin,
    async (request) => {
      const target = await manageUser(request),
        token = generateResetToken();
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: target.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      return {
        ok: true,
        recoveryLink: `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`,
      };
    },
  );
  app.get("/api/super-admin/metrics", admin, async () => {
    const users = await prisma.user.findMany({ where: { isDeleted: false } });
    return {
      total_users: users.length,
      active_users: users.filter((u) => u.status === "active").length,
      suspended_users: users.filter((u) => u.status === "suspended").length,
      total_admins: users.filter((u) => u.role === "admin").length,
      total_super_admins: users.filter((u) => u.role === "super_admin").length,
      new_users_month: users.filter(
        (u) =>
          u.createdAt.toISOString().slice(0, 7) ===
          new Date().toISOString().slice(0, 7),
      ).length,
      total_projects: await prisma.project.count(),
    };
  });
  app.get("/api/super-admin/audit-logs", admin, async () =>
    (await prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 500 })).map(log => ({
      id: log.id, actor_id: log.actorId, actor_name: log.actorName, actor_email: log.actorEmail,
      actor_role: log.actorRole, action: log.action, target_type: log.targetType,
      target_id: log.targetId, target_name: log.targetName, details: log.details,
      metadata: log.metadata, ip_address: log.ipAddress, user_agent: log.userAgent,
      timestamp: log.timestamp.toISOString(),
    })),
  );
  const settingNames: Record<string, string> = {
    require_mfa_super_admin: "requireMfaSuperAdmin",
    session_timeout_minutes: "sessionTimeoutMinutes",
    max_login_attempts: "maxLoginAttempts",
    allow_user_registration: "allowUserRegistration",
    maintenance_mode: "maintenanceMode",
    system_version: "systemVersion",
  };
  const serializeSettings = (row: any) =>
    Object.fromEntries(
      Object.entries(settingNames).map(([client, server]) => [
        client,
        row[server],
      ]),
    );
  app.get("/api/super-admin/settings", admin, async () =>
    serializeSettings(
      await prisma.systemSetting.upsert({
        where: { id: "global_settings" },
        update: {},
        create: {},
      }),
    ),
  );
  app.put("/api/super-admin/settings", admin, async (request) => {
    if (request.authUser.role !== "super_admin")
      throw new AppError("Configuração restrita ao super administrador.", 403);
    const payload = z
      .object({
        require_mfa_super_admin: z.boolean().optional(),
        session_timeout_minutes: z.number().int().positive().optional(),
        max_login_attempts: z.number().int().positive().optional(),
        allow_user_registration: z.boolean().optional(),
        maintenance_mode: z.boolean().optional(),
      })
      .parse(request.body);
    const data = Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [settingNames[k], v]),
    );
    return serializeSettings(
      await prisma.systemSetting.upsert({
        where: { id: "global_settings" },
        update: { ...data, updatedBy: request.authUser.id },
        create: { ...data, updatedBy: request.authUser.id },
      }),
    );
  });
};
