import type { FastifyInstance } from "fastify";
import { saveUpload } from "../lib/uploads.js";
import { AppError } from "../lib/errors.js";

export const registerUploadRoutes = async (app: FastifyInstance) => {
  app.post("/api/files/upload", { preHandler: [app.authenticate] }, async (request) => {
    const file = await request.file();

    if (!file) {
      throw new AppError("Nenhum arquivo enviado.", 400);
    }

    const saved = await saveUpload(file);

    return {
      file_url: `${request.protocol}://${request.headers.host}${saved.relativeUrl}`,
      file_name: saved.fileName,
    };
  });
};
