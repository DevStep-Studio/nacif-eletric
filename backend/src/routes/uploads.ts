import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { saveUpload } from "../lib/uploads.js";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { uploadDirPath } from "../config/env.js";
import { assertStorageQuota } from "../lib/planStorage.js";

export const registerUploadRoutes = async (app: FastifyInstance) => {
  app.post(
    "/api/files/upload",
    { preHandler: [app.authenticate] },
    async (request) => {
      const file = await request.file();
      if (!file) throw new AppError("Nenhum arquivo enviado.", 400);
      const saved = await saveUpload(file);
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${request.authUser.id} FOR UPDATE`;
          const user = await tx.user.findUniqueOrThrow({
            where: { id: request.authUser.id },
          });
          const p = (user.customPermissions || {}) as Record<string, any>;
          const used =
            Number(p.storageUsedMb || 0) + saved.sizeBytes / (1024 * 1024);
          await assertStorageQuota(tx, user, used);
          await tx.user.update({
            where: { id: user.id },
            data: { customPermissions: { ...p, storageUsedMb: used } },
          });
        });
      } catch (error) {
        await fs
          .unlink(path.join(uploadDirPath, saved.fileName))
          .catch(() => {});
        throw error;
      }
      return {
        file_url: `${request.protocol}://${request.headers.host}${saved.relativeUrl}`,
        file_name: saved.fileName,
      };
    },
  );
};
