import fs from "node:fs/promises";
import path from "node:path";
import cuid from "cuid";
import type { MultipartFile } from "@fastify/multipart";
import { uploadDirPath } from "../config/env.js";
import { AppError } from "./errors.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
]);

export const ensureUploadDir = async () => {
  await fs.mkdir(uploadDirPath, { recursive: true });
};

export const saveUpload = async (file: MultipartFile) => {
  await ensureUploadDir();

  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new AppError("Tipo de arquivo não suportado para upload.", 415);
  }

  const ext = path.extname(file.filename || "") || "";
  const safeName = `${cuid()}${ext}`;
  const outputPath = path.join(uploadDirPath, safeName);
  const buffer = await file.toBuffer();

  await fs.writeFile(outputPath, buffer);

  return {
    fileName: safeName,
    relativeUrl: `/uploads/${safeName}`,
  };
};
