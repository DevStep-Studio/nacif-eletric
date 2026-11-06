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

  // 3. Validação das Chaves Stripe para Live Mode / Produção
  const stripeKey = (env.STRIPE_SECRET_KEY || "").trim();
  const webhookKey = (env.STRIPE_WEBHOOK_SECRET || "").trim();

  if (isProduction) {
    // Em produção, a Stripe em Live Mode é obrigatória
    if (!stripeKey) {
      errors.push("Falta a variável STRIPE_SECRET_KEY no .env.");
    } else if (stripeKey.includes("...") || stripeKey === "sk_live_" || stripeKey === "sk_test_") {
      errors.push(`A variável STRIPE_SECRET_KEY contém um valor de exemplo/placeholder ('${stripeKey}'). Substitua pela chave real da Stripe no .env.`);
    } else if (stripeKey.startsWith("sk_test_") && process.env.ALLOW_TEST_STRIPE !== "true") {
      errors.push("A variável STRIPE_SECRET_KEY está em modo de teste ('sk_test_...'). Em produção (Live Mode), configure a chave oficial 'sk_live_...' da Stripe (ou defina ALLOW_TEST_STRIPE=true para staging).");
    } else if (!stripeKey.startsWith("sk_live_") && !stripeKey.startsWith("sk_test_")) {
      errors.push("A variável STRIPE_SECRET_KEY possui formato inválido. Para Live Mode, deve iniciar com 'sk_live_'.");
    }

    if (!webhookKey) {
      errors.push("Falta a variável STRIPE_WEBHOOK_SECRET no .env.");
    } else if (webhookKey.includes("...") || webhookKey === "whsec_") {
      errors.push(`A variável STRIPE_WEBHOOK_SECRET contém um valor placeholder ('${webhookKey}'). Substitua pelo segredo real do webhook (whsec_...) configurado no painel da Stripe.`);
    } else if (!webhookKey.startsWith("whsec_")) {
      errors.push("A variável STRIPE_WEBHOOK_SECRET possui formato inválido. Deve iniciar com 'whsec_'.");
    }

    // Validação dos IDs de Preço dos Planos
    const priceConfigs = [
      { name: "STRIPE_PRICE_ESTUDANTE_MONTHLY", value: env.STRIPE_PRICE_ESTUDANTE_MONTHLY, desc: "Plano Estudante (Mensal R$ 99,99)" },
      { name: "STRIPE_PRICE_ELETRICO_MONTHLY", value: env.STRIPE_PRICE_ELETRICO_MONTHLY, desc: "Plano Elétrico (Mensal R$ 149,90)" },
      { name: "STRIPE_PRICE_SOLAR_MONTHLY", value: env.STRIPE_PRICE_SOLAR_MONTHLY, desc: "Plano Solar (Mensal R$ 149,90)" },
      { name: "STRIPE_PRICE_COMPLETO_MONTHLY", value: env.STRIPE_PRICE_COMPLETO_MONTHLY, desc: "Plano Completo (Mensal R$ 210,00)" },
    ];

    const missingPrices = priceConfigs.filter(p => !p.value || p.value.includes("...") || !p.value.startsWith("price_"));
    if (missingPrices.length > 0) {
      warnings.push(
        `Os seguintes Price IDs da Stripe não foram configurados ou contêm placeholders:\n` +
        missingPrices.map(p => `   • ${p.name} (${p.desc})`).join("\n") +
        `\n   Execute 'npm --prefix backend run stripe:check' para auditar a sincronização com a Stripe.`
      );
    }
  } else {
    // Em desenvolvimento/teste, apenas adverte se faltar
    if (!stripeKey || stripeKey.includes("...")) {
      warnings.push("STRIPE_SECRET_KEY não configurada ou usando placeholder. O checkout de assinaturas ficará desabilitado.");
    }
    if (!webhookKey || webhookKey.includes("...")) {
      warnings.push("STRIPE_WEBHOOK_SECRET não configurada. O recebimento de eventos webhook da Stripe ficará inativo.");
    }
  }

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
