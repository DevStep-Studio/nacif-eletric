import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega variáveis de ambiente tanto de backend/.env quanto do .env da raiz (DevStep / VPS)
const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "backend/.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    const parsed = dotenv.parse(fs.readFileSync(envPath, "utf-8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (value && (!process.env[key] || process.env[key]?.trim() === "")) {
        process.env[key] = value.trim();
      }
    }
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z
    .string()
    .url()
    .default(process.env.VITE_APP_URL || "https://nacifenergy.com.br").transform(value => value.replace(/\/+$/, "")),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("mysql://root:root@127.0.0.1:3306/nacif_electric"),
  JWT_SECRET: z
    .string()
    .min(16)
    .default("nacif-electric-jwt-secret-production-2026-default-key"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-5.5"),
  UPLOAD_DIR: z.string().default("./uploads"),
  STRIPE_SECRET_KEY: z.string().trim().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().trim().default(""),
  STRIPE_PUBLISHABLE_KEY: z
    .string()
    .default(process.env.VITE_STRIPE_PUBLISHABLE_KEY || ""),
  STRIPE_PRICE_ESTUDANTE_MONTHLY: z.string().trim().default(""),
  STRIPE_PRICE_ELETRICO_MONTHLY: z.string().trim().default(""),
  STRIPE_PRICE_ELETRICO_ANNUAL: z.string().trim().default(""),
  STRIPE_PRICE_SOLAR_MONTHLY: z.string().trim().default(""),
  STRIPE_PRICE_SOLAR_ANNUAL: z.string().trim().default(""),
  STRIPE_PRICE_COMPLETO_MONTHLY: z.string().trim().default(""),
  STRIPE_PRICE_COMPLETO_ANNUAL: z.string().trim().default(""),
});

export const env = envSchema.parse(process.env);
export const uploadDirPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
