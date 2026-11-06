import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.resolve(rootDir, "backend");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function checkHealth(port = 3001) {
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const [healthResponse, plansResponse] = await Promise.all([
      fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) }),
      fetch(`${baseUrl}/api/subscriptions/plans`, { signal: AbortSignal.timeout(3000) }),
    ]);
    if (!healthResponse.ok) return { ok: false, data: null, reason: `Health HTTP ${healthResponse.status}` };
    const health = await healthResponse.json();
    if (plansResponse.status === 404) {
      return { ok: false, data: health, reason: "Backend desatualizado: GET /api/subscriptions/plans não registrado. Atualize o checkout do servidor e reinicie nacif-electric-api." };
    }
    if (!plansResponse.ok) return { ok: false, data: health, reason: `Catálogo de planos HTTP ${plansResponse.status}` };
    const catalog = await plansResponse.json();
    const expectedPlans = ["free", "estudante", "eletrico", "solar", "completo"];
    if (health.ok !== true || health.service !== "nacif-electric-backend" || !Array.isArray(catalog?.plans) || !expectedPlans.every(code => catalog.plans.some(plan => plan.code === code))) {
      return { ok: false, data: health, reason: "A porta configurada não está servindo a API e o catálogo esperados." };
    }
    return { ok: true, data: health, reason: null };
  } catch (error) {
    return { ok: false, data: null, reason: error.message };
  }
}

async function main() {
  const isForce = process.argv.includes("--force");
  const isCi =
    process.env.GITHUB_ACTIONS === "true" ||
    process.env.CI === "true" ||
    process.env.VERCEL === "1" ||
    process.env.CF_PAGES === "1";

  if (!isForce && (isCi || process.platform === "win32")) {
    return;
  }

  if (!fs.existsSync(path.join(backendDir, "package.json"))) {
    console.log("[deploy-backend] Diretório backend não encontrado; pulando inicialização da API.");
    return;
  }

  console.log("[deploy-backend] Preparando dependências e Prisma Client do backend Stripe...");
  try {
    execSync("npm install --include=dev --no-audit --no-fund", {
      cwd: backendDir,
      stdio: "inherit",
    });
    execSync("npx prisma generate", {
      cwd: backendDir,
      stdio: "inherit",
    });
  } catch (err) {
    throw new Error(`Falha ao preparar dependências do backend: ${err.message}`);
  }

  let startedWithPm2 = false;
  try {
    execSync("pm2 -v", { stdio: "ignore" });
    console.log("[deploy-backend] PM2 detectado. Iniciando/recarregando nacif-electric-api na porta 3001...");
    execSync("pm2 startOrReload ecosystem.config.cjs --update-env", {
      cwd: rootDir,
      stdio: "inherit",
    });
    execSync("pm2 save", { cwd: rootDir, stdio: "ignore" });
    startedWithPm2 = true;
  } catch {
    console.log("[deploy-backend] PM2 não disponível no PATH; iniciando processo em background direto...");
  }

  if (!startedWithPm2) {
    try {
      if (process.platform !== "win32") {
        try {
          execSync("pkill -f 'tsx.*src/server.ts' || true", { stdio: "ignore" });
        } catch {
          // sem processo anterior
        }
      }

      const logPath = path.join(backendDir, "backend-prod.log");
      const out = fs.openSync(logPath, "a");
      const tsxCli = path.join(backendDir, "node_modules", "tsx", "dist", "cli.mjs");

      const child = spawn(process.execPath, [tsxCli, "src/server.ts"], {
        cwd: backendDir,
        detached: true,
        stdio: ["ignore", out, out],
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || "production",
          PORT: process.env.PORT || "3001",
        },
      });
      child.unref();
    } catch (spawnErr) {
      console.warn("[deploy-backend] Aviso ao iniciar daemon em background:", spawnErr.message);
    }
  }

  let lastReason = "API indisponível";
  for (let i = 0; i < 8; i++) {
    await sleep(600);
    const health = await checkHealth(Number(process.env.PORT || 3001));
    lastReason = health.reason;
    if (health.ok) {
      console.log(
        `[deploy-backend] Backend API e catálogo de planos ativos em 127.0.0.1:${Number(process.env.PORT || 3001)} (stripeConfigured=${Boolean(health.data?.stripeConfigured)})`,
      );
      return;
    }
  }

  throw new Error(`Backend não ficou pronto: ${lastReason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error("[deploy-backend] Falha ao iniciar a API:", err.message);
    process.exitCode = 1;
  });
}
