import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-5.5"),
  UPLOAD_DIR: z.string().default("./uploads"),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PUBLISHABLE_KEY: z.string().default(""),
  STRIPE_PRICE_ESTUDANTE_MONTHLY: z.string().default("price_test_estudante_monthly"),
  STRIPE_PRICE_ELETRICO_MONTHLY: z.string().default("price_test_eletrico_monthly"),
  STRIPE_PRICE_ELETRICO_ANNUAL: z.string().default("price_test_eletrico_annual"),
  STRIPE_PRICE_SOLAR_MONTHLY: z.string().default("price_test_solar_monthly"),
  STRIPE_PRICE_SOLAR_ANNUAL: z.string().default("price_test_solar_annual"),
  STRIPE_PRICE_COMPLETO_MONTHLY: z.string().default("price_test_completo_monthly"),
  STRIPE_PRICE_COMPLETO_ANNUAL: z.string().default("price_test_completo_annual"),
});

export const env = envSchema.parse(process.env);
export const uploadDirPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
