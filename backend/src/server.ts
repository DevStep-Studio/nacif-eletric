// ============================================================================
// 1. Crash Tracking: Captura de Erros Fatais no nível mais alto do processo
// ============================================================================
process.on("uncaughtException", (error: Error) => {
  console.error("\n" + "=".repeat(78));
  console.error("💥 [FATAL CRASH] uncaughtException interceptada no servidor Fastify:");
  console.error("=".repeat(78));
  console.error(`Mensagem: ${error?.message || error}`);
  console.error(`Stack trace:\n${error?.stack || "Sem stack trace"}`);
  console.error("=".repeat(78) + "\n");
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("\n" + "=".repeat(78));
  console.error("💥 [FATAL CRASH] unhandledRejection interceptada no servidor Fastify:");
  console.error("=".repeat(78));
  if (reason instanceof Error) {
    console.error(`Mensagem: ${reason.message}`);
    console.error(`Stack trace:\n${reason.stack}`);
  } else {
    console.error("Motivo:", reason);
  }
  console.error("=".repeat(78) + "\n");
  process.exit(1);
});

// ============================================================================
// 2. Importações e Validação de Inicialização (Fail-fast)
// ============================================================================
import { env } from "./config/env.js";
import { assertStartupEnvironment, assertDatabaseConnection } from "./config/startupValidation.js";
import { prisma } from "./lib/prisma.js";
import { buildApp } from "./app.js";

// Valida variáveis críticas de produção (.env, Stripe, Database) antes de inicializar
assertStartupEnvironment();

const start = async () => {
  // Valida a conectividade ativa com o MySQL antes de abrir a porta
  await assertDatabaseConnection(prisma);

  const app = await buildApp();

  try {
    const address = await app.listen({
      host: "0.0.0.0",
      port: env.PORT,
    });
    console.log(`🚀 [SERVER] Nacif Electric API escutando em ${address}`);
    console.log(`📡 [SERVER] Ambiente: ${env.NODE_ENV.toUpperCase()} | Live Mode: ${env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "ATIVO" : "INATIVO"}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

// ============================================================================
// 3. Graceful Shutdown
// ============================================================================
const shutdown = async () => {
  console.log("\n🛑 [SHUTDOWN] Desconectando serviços e encerrando servidor...");
  try {
    await prisma.$disconnect();
    console.log("🔒 [SHUTDOWN] Conexão com banco Prisma desconectada.");
  } catch (err) {
    console.error("Erro ao desconectar Prisma:", err);
  }
};

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});
