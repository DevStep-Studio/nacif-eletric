import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const serializeIssue = (issue: any) => ({
  id: issue.id,
  protocol: issue.protocol,
  type: issue.type,
  title: issue.title,
  module: issue.module,
  description: issue.description,
  steps_to_reproduce: issue.stepsToReproduce || "",
  expected_result: issue.expectedResult || "",
  actual_result: issue.actualResult || "",
  status: issue.status,
  priority: issue.priority,
  user_id: issue.userId,
  user_name: issue.userName,
  user_email: issue.userEmail,
  workspace_id: issue.workspaceId,
  project_id: issue.projectId,
  technical_info: issue.technicalInfo || {},
  internal_notes: issue.internalNotes || "",
  attachments: (issue.attachments || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    size: a.size,
    type: a.type,
    created_at: a.createdAt?.toISOString(),
  })),
  comments: (issue.comments || []).map((c: any) => ({
    id: c.id,
    author_name: c.authorName,
    author_email: c.authorEmail,
    author_role: c.authorRole,
    content: c.message,
    message: c.message,
    is_internal: c.isInternal,
    created_date: c.createdAt?.toISOString(),
  })),
  created_date: issue.createdAt.toISOString(),
  updated_date: issue.updatedAt.toISOString(),
});

export const registerIssueRoutes = async (app: FastifyInstance) => {
  app.get("/api/issues", { preHandler: [app.authenticate] }, async (request) => {
    const isAdmin = request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin";
    const where = isAdmin ? {} : { userId: request.authUser.id };

    const issues = await prisma.issue.findMany({
      where,
      include: {
        comments: { orderBy: { createdAt: "asc" } },
        attachments: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return issues.map(serializeIssue);
  });

  app.get("/api/issues/:id", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        comments: { orderBy: { createdAt: "asc" } },
        attachments: true,
      },
    });

    if (!issue) {
      throw new AppError("Relato não encontrado.", 404);
    }

    const isAdmin = request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin";
    if (!isAdmin && issue.userId && issue.userId !== request.authUser.id) {
      throw new AppError("Acesso negado a este relato.", 403);
    }

    return serializeIssue(issue);
  });

  app.post("/api/issues", { preHandler: [app.authenticate] }, async (request) => {
    const data = (request.body as Record<string, any>) || {};
    const count = await prisma.issue.count();
    const year = new Date().getFullYear();
    const protocol = `NCF-${year}-${String(count + 1).padStart(5, "0")}`;

    const issue = await prisma.issue.create({
      data: {
        protocol,
        type: data.type || "erro",
        title: String(data.title || "").trim() || "Relato de problema",
        module: data.module || "Geral",
        description: String(data.description || "").trim(),
        stepsToReproduce: data.steps_to_reproduce || null,
        expectedResult: data.expected_result || null,
        actualResult: data.actual_result || null,
        status: "recebido",
        priority: data.priority || "media",
        userId: request.authUser.id,
        userEmail: request.authUser.email,
        userName: request.authUser.email.split("@")[0],
        workspaceId: data.workspace_id || "default",
        projectId: data.project_id || null,
        technicalInfo: data.technical_info || {},
        internalNotes: data.internal_notes || "",
      },
      include: {
        comments: true,
        attachments: true,
      },
    });

    return serializeIssue(issue);
  });

  app.patch("/api/issues/:id", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await prisma.issue.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("Relato não encontrado.", 404);
    }

    const isAdmin = request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin";
    const isOwner = existing.userId === request.authUser.id;

    if (!isAdmin && !isOwner) {
      throw new AppError("Permissão negada para alterar este relato.", 403);
    }

    const data = (request.body as Record<string, any>) || {};
    const updated = await prisma.issue.update({
      where: { id },
      data: {
        ...(data.title ? { title: String(data.title).trim() } : {}),
        ...(data.description ? { description: String(data.description).trim() } : {}),
        ...(data.steps_to_reproduce !== undefined ? { stepsToReproduce: data.steps_to_reproduce } : {}),
        ...(data.expected_result !== undefined ? { expectedResult: data.expected_result } : {}),
        ...(data.actual_result !== undefined ? { actualResult: data.actual_result } : {}),
        ...(isAdmin && data.status ? { status: data.status } : {}),
        ...(isAdmin && data.priority ? { priority: data.priority } : {}),
        ...(isAdmin && data.internal_notes !== undefined ? { internalNotes: String(data.internal_notes) } : {}),
      },
      include: {
        comments: true,
        attachments: true,
      },
    });

    return serializeIssue(updated);
  });

  app.post("/api/issues/:id/comments", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = (request.body as Record<string, any>) || {};

    const comment = await prisma.issueComment.create({
      data: {
        issueId: id,
        authorId: request.authUser.id,
        authorName: request.authUser.email.split("@")[0],
        authorEmail: request.authUser.email,
        authorRole: request.authUser.role,
        message: String(data.content || data.message || "").trim(),
        isInternal: Boolean(data.is_internal && (request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin")),
      },
    });

    return {
      id: comment.id,
      author_name: comment.authorName,
      author_email: comment.authorEmail,
      author_role: comment.authorRole,
      content: comment.message,
      message: comment.message,
      is_internal: comment.isInternal,
      created_date: comment.createdAt.toISOString(),
    };
  });
};
