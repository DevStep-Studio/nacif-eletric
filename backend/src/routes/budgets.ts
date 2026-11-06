import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

const serializeBudget = (b: any) => ({
  id: b.id,
  name: b.name,
  status: b.status,
  margin: b.margin,
  labor_cost: b.laborCost,
  product_adjustment: b.productAdjustment,
  discount_type: b.discountType,
  discount_value: b.discountValue,
  surcharge_type: b.surchargeType,
  surcharge_value: b.surchargeValue,
  materials: Array.isArray(b.materials) ? b.materials : [],
  services: Array.isArray(b.services) ? b.services : [],
  notes: b.notes || "",
  validity_days: b.validityDays,
  payment_terms: b.paymentTerms || "",
  execution_deadline: b.executionDeadline || "",
  project_id: b.projectId,
  owner_id: b.ownerId,
  user_id: b.ownerId,
  created_date: b.createdAt.toISOString(),
  updated_date: b.updatedAt.toISOString(),
});

export const registerBudgetRoutes = async (app: FastifyInstance) => {
  app.get("/api/budgets", { preHandler: [app.authenticate] }, async (request) => {
    const isAdmin = request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin";
    const where = isAdmin ? {} : { ownerId: request.authUser.id };

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return budgets.map(serializeBudget);
  });

  app.post("/api/budgets/filter", { preHandler: [app.authenticate] }, async (request) => {
    const body = (request.body as Record<string, unknown>) || {};
    const isAdmin = request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin";
    const where: any = isAdmin ? {} : { ownerId: request.authUser.id };

    if (body.project_id) {
      where.projectId = String(body.project_id);
    }
    if (body.status) {
      where.status = body.status;
    }

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return budgets.map(serializeBudget);
  });

  app.get("/api/budgets/:id", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const budget = await prisma.budget.findUnique({ where: { id } });

    if (!budget) {
      throw new AppError("Orçamento não encontrado.", 404);
    }

    const isAdmin = request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin";
    if (!isAdmin && budget.ownerId && budget.ownerId !== request.authUser.id) {
      throw new AppError("Acesso negado a este orçamento.", 403);
    }

    return serializeBudget(budget);
  });

  app.post("/api/budgets", { preHandler: [app.authenticate] }, async (request) => {
    const data = (request.body as Record<string, any>) || {};
    const name = String(data.name || "").trim() || `Orçamento ${new Date().toLocaleDateString("pt-BR")}`;

    const budget = await prisma.budget.create({
      data: {
        name,
        status: data.status || "Rascunho",
        margin: typeof data.margin === "number" ? data.margin : 30,
        laborCost: typeof data.labor_cost === "number" ? data.labor_cost : 0,
        productAdjustment: typeof data.product_adjustment === "number" ? data.product_adjustment : 0,
        discountType: data.discount_type || "percent",
        discountValue: typeof data.discount_value === "number" ? data.discount_value : 0,
        surchargeType: data.surcharge_type || "percent",
        surchargeValue: typeof data.surcharge_value === "number" ? data.surcharge_value : 0,
        materials: Array.isArray(data.materials) ? data.materials : [],
        services: Array.isArray(data.services) ? data.services : [],
        notes: data.notes || "",
        validityDays: typeof data.validity_days === "number" ? data.validity_days : 15,
        paymentTerms: data.payment_terms || "50% entrada e 50% na conclusão dos serviços",
        executionDeadline: data.execution_deadline || "15 dias úteis",
        projectId: data.project_id || null,
        ownerId: request.authUser.id,
      },
    });

    return serializeBudget(budget);
  });

  app.patch("/api/budgets/:id", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await prisma.budget.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("Orçamento não encontrado.", 404);
    }

    const isAdmin = request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin";
    if (!isAdmin && existing.ownerId && existing.ownerId !== request.authUser.id) {
      throw new AppError("Acesso negado para modificar este orçamento.", 403);
    }

    const data = (request.body as Record<string, any>) || {};
    const budget = await prisma.budget.update({
      where: { id },
      data: {
        ...(data.name ? { name: String(data.name).trim() } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(typeof data.margin === "number" ? { margin: data.margin } : {}),
        ...(typeof data.labor_cost === "number" ? { laborCost: data.labor_cost } : {}),
        ...(typeof data.product_adjustment === "number" ? { productAdjustment: data.product_adjustment } : {}),
        ...(data.discount_type ? { discountType: data.discount_type } : {}),
        ...(typeof data.discount_value === "number" ? { discountValue: data.discount_value } : {}),
        ...(data.surcharge_type ? { surchargeType: data.surcharge_type } : {}),
        ...(typeof data.surcharge_value === "number" ? { surchargeValue: data.surcharge_value } : {}),
        ...(Array.isArray(data.materials) ? { materials: data.materials } : {}),
        ...(Array.isArray(data.services) ? { services: data.services } : {}),
        ...(data.notes !== undefined ? { notes: String(data.notes) } : {}),
        ...(typeof data.validity_days === "number" ? { validityDays: data.validity_days } : {}),
        ...(data.payment_terms !== undefined ? { paymentTerms: String(data.payment_terms) } : {}),
        ...(data.execution_deadline !== undefined ? { executionDeadline: String(data.execution_deadline) } : {}),
        ...(data.project_id !== undefined ? { projectId: data.project_id || null } : {}),
      },
    });

    return serializeBudget(budget);
  });

  app.delete("/api/budgets/:id", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await prisma.budget.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("Orçamento não encontrado.", 404);
    }

    const isAdmin = request.authUser.role === "admin" || (request.authUser.role as string) === "super_admin";
    if (!isAdmin && existing.ownerId && existing.ownerId !== request.authUser.id) {
      throw new AppError("Acesso negado para excluir este orçamento.", 403);
    }

    await prisma.budget.delete({ where: { id } });
    return { ok: true, message: "Orçamento excluído com sucesso." };
  });

  app.post("/api/budgets/:id/duplicate", { preHandler: [app.authenticate] }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const existing = await prisma.budget.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("Orçamento não encontrado.", 404);
    }

    const duplicate = await prisma.budget.create({
      data: {
        name: `${existing.name} (Cópia)`,
        status: "Rascunho",
        margin: existing.margin,
        laborCost: existing.laborCost,
        productAdjustment: existing.productAdjustment,
        discountType: existing.discountType,
        discountValue: existing.discountValue,
        surchargeType: existing.surchargeType,
        surchargeValue: existing.surchargeValue,
        materials: Array.isArray(existing.materials) ? existing.materials : [],
        services: Array.isArray(existing.services) ? existing.services : [],
        notes: existing.notes || "",
        validityDays: existing.validityDays,
        paymentTerms: existing.paymentTerms || "",
        executionDeadline: existing.executionDeadline || "",
        projectId: existing.projectId,
        ownerId: request.authUser.id,
      },
    });

    return serializeBudget(duplicate);
  });
};
