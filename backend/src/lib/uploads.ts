import fs from "node:fs/promises";
import path from "node:path";
import cuid from "cuid";
import type { MultipartFile } from "@fastify/multipart";
import { uploadDirPath } from "../config/env.js";
import { AppError } from "./errors.js";

const MIME_TO_SAFE_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
};

const FORBIDDEN_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".php",
  ".vbs",
  ".js",
  ".mjs",
  ".cjs",
  ".html",
  ".htm",
  ".msi",
  ".dll",
  ".scr",
  ".com",
  ".pif",
  ".jsp",
  ".asp",
  ".aspx",
]);

function detectBufferMimeType(buffer: Buffer, declaredMime: string): string | null {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  const headText = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf-8");

  if (declaredMime === "image/svg+xml") {
    const fullText = buffer.toString("utf-8");
    if (
      /<script\b/i.test(fullText) ||
      /javascript:/i.test(fullText) ||
      /\bon[a-z]+\s*=/i.test(fullText) ||
      /<iframe\b/i.test(fullText) ||
      /<object\b/i.test(fullText) ||
      /<embed\b/i.test(fullText) ||
      /<foreignObject\b/i.test(fullText)
    ) {
      throw new AppError("Arquivo SVG contém scripts ativos ou elementos bloqueados por segurança.", 400);
    }
    if (!/<svg\b/i.test(headText)) {
      return null;
    }
    return "image/svg+xml";
  }

  if (declaredMime === "text/plain") {
    if (/<!doctype\s+html/i.test(headText) || /<html\b/i.test(headText) || /<script\b/i.test(headText)) {
      throw new AppError("Conteúdo HTML/Script não é permitido em arquivos de texto.", 400);
    }
    return "text/plain";
  }

  return null;
}

export const ensureUploadDir = async () => {
  await fs.mkdir(uploadDirPath, { recursive: true });
};

export const saveUpload = async (file: MultipartFile) => {
  await ensureUploadDir();

  const rawFilename = String(file.filename || "").trim();
  const originalExt = path.extname(rawFilename).toLowerCase();

  if (originalExt && FORBIDDEN_EXTENSIONS.has(originalExt)) {
    throw new AppError("Extensão de arquivo bloqueada por políticas de segurança.", 415);
  }

  const declaredMime = String(file.mimetype || "").toLowerCase().trim();
  if (!declaredMime || !(declaredMime in MIME_TO_SAFE_EXT)) {
    throw new AppError("Tipo de arquivo não suportado para upload.", 415);
  }

  const buffer = await file.toBuffer();
  if (buffer.length === 0) {
    throw new AppError("O arquivo enviado está vazio.", 400);
  }

  const verifiedMime = detectBufferMimeType(buffer, declaredMime);
  if (!verifiedMime || !(verifiedMime in MIME_TO_SAFE_EXT)) {
    throw new AppError("Assinatura do arquivo inválida ou incompatível com o formato declarado.", 415);
  }

  const safeExt = MIME_TO_SAFE_EXT[verifiedMime];
  const safeName = `${cuid()}${safeExt}`;
  const outputPath = path.join(uploadDirPath, safeName);

  await fs.writeFile(outputPath, buffer);

  return {
    fileName: safeName,
    sizeBytes: buffer.length,
    relativeUrl: `/uploads/${safeName}`,
  };
};
