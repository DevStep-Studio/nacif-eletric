import type { Prisma, PrismaClient } from "@prisma/client";
import { getServerPlan, effectivePlanCode, isServerAdmin } from "./planGovernance.js";
import { AppError } from "./errors.js";

type Database = Prisma.TransactionClient | PrismaClient;
export async function projectStorageMb(db: Database, userId: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{ bytes: bigint | number | null }>>`
    SELECT
      COALESCE((SELECT SUM(
        OCTET_LENGTH(COALESCE(name, '')) + OCTET_LENGTH(COALESCE(client_name, '')) +
        OCTET_LENGTH(COALESCE(address, '')) + OCTET_LENGTH(COALESCE(city, '')) + OCTET_LENGTH(COALESCE(notes, '')) +
        OCTET_LENGTH(COALESCE(CAST(solar_config AS CHAR), '')) + OCTET_LENGTH(COALESCE(CAST(circuits AS CHAR), '')) +
        OCTET_LENGTH(COALESCE(CAST(panel_boards AS CHAR), '')) + OCTET_LENGTH(COALESCE(CAST(panel_layout AS CHAR), '')) +
        OCTET_LENGTH(COALESCE(CAST(diagram_layout AS CHAR), '')) + OCTET_LENGTH(COALESCE(CAST(plant_design AS CHAR), '')) +
        OCTET_LENGTH(COALESCE(CAST(materials AS CHAR), '')) + OCTET_LENGTH(COALESCE(CAST(manual_budget_items AS CHAR), ''))
      ) FROM projects WHERE created_by_id = ${userId}), 0)
      + COALESCE((SELECT SUM(OCTET_LENGTH(CAST(r.snapshot AS CHAR)))
        FROM project_revisions r JOIN projects p ON p.id = r.project_id WHERE p.created_by_id = ${userId}), 0) AS bytes
  `;
  return Number(rows[0]?.bytes || 0) / (1024 * 1024);
}
export async function assertStorageQuota(db: Database, user: { id: string; role?: string; isSuperAdmin?: boolean; customPermissions?: unknown }, fileMb?: number) {
  if (isServerAdmin(user)) return;
  const permissions = (user.customPermissions as Record<string, any>) || {};
  const total = (fileMb ?? Number(permissions.storageUsedMb || 0)) + await projectStorageMb(db, user.id);
  const limit = getServerPlan(effectivePlanCode(user)).storageMb;
  if (total > limit) throw new AppError(`Limite de armazenamento do plano atingido (${limit} MB), incluindo arquivos, projetos e histórico.`, 403);
}
