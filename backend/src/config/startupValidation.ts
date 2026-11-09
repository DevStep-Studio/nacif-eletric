import { env } from "./env.js";
import type { PrismaClient } from "@prisma/client";

export function maskDatabaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.password) {
      url.password = "******";
    }
    return url.toString();
  } catch {
    return rawUrl.replace(/:([^:@]+)@/, ":******@");
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validação estruturada de Fail-Fast das variáveis de ambiente.
 * Executa antes de tentar conectar ao banco ou abrir a porta do servidor.
 */
export function validateStartupEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = env.NODE_ENV === "production";

  // 1. Validação do Banco de Dados
  if (!env.DATABASE_URL || env.DATABASE_URL.trim() === "") {
    errors.push("Falta a variável DATABASE_URL no .env (obrigatória para conexão MySQL).");
  } else if (!env.DATABASE_URL.startsWith("mysql://") && !env.DATABASE_URL.startsWith("mariadb://")) {
    errors.push(`DATABASE_URL com protocolo inválido (${maskDatabaseUrl(env.DATABASE_URL)}). O Prisma requer 'mysql://'.`);
  }

  // 2. Validação da Chave JWT
  if (!env.JWT_SECRET || env.JWT_SECRET.trim().length < 16) {
    errors.push("Falta a variável JWT_SECRET no .env ou ela possui menos de 16 caracteres.");
  } else if (isProduction && env.JWT_SECRET === "nacif-electric-jwt-secret-production-2026-default-key") {
    warnings.push("JWT_SECRET está utilizando a chave padrão no ambiente de produção. Recomenda-se gerar um segredo exclusivo de alta entropia.");
  }

  const apiKey = env.ASAAS_API_KEY;
  const token = env.ASAAS_WEBHOOK_TOKEN;
  const billingErrors: string[] = [];
  if (!apiKey || apiKey.includes("...")) billingErrors.push("Configure ASAAS_API_KEY com a chave do ambiente Asaas selecionado.");
  if (token.length < 32 || token.length > 255 || /\s/.test(token) || token === apiKey)
    billingErrors.push("Configure ASAAS_WEBHOOK_TOKEN exclusivo, sem espaços, entre 32 e 255 caracteres.");
  if (isProduction && env.ASAAS_ENVIRONMENT !== "production" && process.env.ALLOW_SANDBOX_ASAAS !== "true")
    billingErrors.push("Use ASAAS_ENVIRONMENT=production em produção; staging pode usar ALLOW_SANDBOX_ASAAS=true.");
  (isProduction ? errors : warnings).push(...billingErrors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Executa a checagem fail-fast e interrompe a inicialização caso faltem variáveis críticas.
 */
export function assertStartupEnvironment(): void {
  const result = validateStartupEnvironment();

  if (result.warnings.length > 0) {
    console.warn("\n⚠️  [AVISOS DE CONFIGURAÇÃO DO BACKEND]:");
    for (const warning of result.warnings) {
      console.warn(`   • ${warning}`);
    }
    console.warn("");
  }

  if (!result.valid) {
    console.error("\n" + "=".repeat(78));
    console.error("❌ [FALHA DE INICIALIZAÇÃO - FAIL-FAST] NACIF ELECTRIC API");
    console.error("O servidor foi interrompido graciosamente devido a variáveis ausentes ou inválidas:");
    console.error("=".repeat(78));
    for (const error of result.errors) {
      console.error(`   ❌ ${error}`);
    }
    console.error("-".repeat(78));
    console.error("👉 Verifique o arquivo .env no diretório raiz ou backend/.env e reinicie a aplicação.");
    console.error("=".repeat(78) + "\n");

    // Interrupção graciosa conforme requisito
    process.exit(1);
  }
}

/**
 * Valida a conectividade ativa com o banco de dados MySQL antes de iniciar o listener HTTP.
 */
export async function assertDatabaseConnection(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRawUnsafe("SELECT 1;");
    console.log("✅ [DATABASE] Conexão com o banco de dados MySQL verificada e ativa.");
  } catch (error: any) {
    console.error("\n" + "=".repeat(78));
    console.error("❌ [FALHA CRÍTICA DE BANCO DE DADOS] NACIF ELECTRIC API");
    console.error("Não foi possível conectar ao banco de dados MySQL através do Prisma:");
    console.error("=".repeat(78));
    console.error(`   Erro: ${error?.message || error}`);
    console.error(`   URL:  ${maskDatabaseUrl(env.DATABASE_URL)}`);
    console.error("-".repeat(78));
    console.error("👉 Certifique-se de que o serviço MySQL está ativo na VPS (systemctl status mysql)");
    console.error("   e que o banco 'nacif_electric' e credenciais no .env estão corretos.");
    console.error("=".repeat(78) + "\n");

    process.exit(1);
  }
}
