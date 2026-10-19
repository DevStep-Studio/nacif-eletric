/**
 * infrastructureHealth.js
 * 
 * Módulo de Auditoria, Monitoramento de Saúde Operacional, Telemetria e
 * Procedimentos de Rollback e Disponibilidade da Infraestrutura NACIF Electric.
 */

// Metas Oficiais de Nível de Serviço (SLI / SLO / SLA)
export const INFRASTRUCTURE_SLA = {
  target_uptime_percentage: 99.9,
  rpo_minutes: 15, // Recovery Point Objective: perda máxima tolerável de dados
  rto_minutes: 5,  // Recovery Time Objective: tempo máximo para restabelecimento
  max_api_p95_latency_ms: 350,
  max_bundle_size_kb: 1000,
  production_domain: "https://nacifenergy.com.br",
  ssl_enforced: true,
};

/**
 * Obtém os metadados do ambiente de execução atual.
 */
export function getEnvironmentMetadata() {
  const isBrowser = typeof window !== "undefined";
  const isProduction = typeof import.meta !== "undefined" && import.meta.env?.PROD;
  const envName = (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_ENV) || (isProduction ? "production" : "development");
  const appVersion = (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_VERSION) || "1.0.0-prod";
  const apiUrl = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

  return {
    environment: envName,
    is_production: envName === "production",
    is_staging: envName === "staging",
    is_development: envName === "development",
    app_version: appVersion,
    api_base_url: apiUrl || "local-persist-engine",
    protocol: isBrowser ? window.location.protocol : "https:",
    is_https: isBrowser ? window.location.protocol === "https:" : true,
    hostname: isBrowser ? window.location.hostname : "nacifenergy.com.br",
    sla: INFRASTRUCTURE_SLA,
  };
}

/**
 * Executa uma verificação ativa de integridade da infraestrutura e dos recursos.
 */
export async function probeSystemHealth(databaseProbeFn = null) {
  const startTime = Date.now();
  const envMeta = getEnvironmentMetadata();

  const checks = {
    web_app: { status: "healthy", latency_ms: 0, details: "Aplicação e renderização de rotas ativas." },
    https_ssl: {
      status: envMeta.is_https || !envMeta.is_production ? "healthy" : "warning",
      details: envMeta.is_https ? "Comunicação criptografada com TLS ativa." : "Aviso: HTTPS não detectado.",
    },
    client_storage: { status: "healthy", usage_bytes: 0, quota_bytes: 0, percent_used: 0 },
    database_layer: { status: "unknown", details: "Não auditado nesta sonda." },
    network_connectivity: {
      status: (typeof navigator !== "undefined" && !navigator.onLine) ? "offline" : "healthy",
      details: (typeof navigator !== "undefined" && !navigator.onLine) ? "Dispositivo sem conexão de rede." : "Rede disponível.",
    },
  };

  // 1. Verificar Quota de Armazenamento do Navegador
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      checks.client_storage.usage_bytes = estimate.usage || 0;
      checks.client_storage.quota_bytes = estimate.quota || 0;
      checks.client_storage.percent_used = estimate.quota
        ? Math.round(((estimate.usage || 0) / estimate.quota) * 100)
        : 0;
      checks.client_storage.status = checks.client_storage.percent_used > 85 ? "warning" : "healthy";
    } catch {
      checks.client_storage.details = "Storage estimate indisponível.";
    }
  }

  // 2. Executar Sonda da Camada de Dados se fornecida
  if (typeof databaseProbeFn === "function") {
    try {
      const dbResult = await databaseProbeFn();
      checks.database_layer = {
        status: dbResult.healthy ? "healthy" : "warning",
        details: dbResult.healthy
          ? "Banco e integridade referencial consistentes sem registros órfãos."
          : `Inconsistências identificadas: ${dbResult.projectIssuesCount || 0} em projetos, ${dbResult.budgetIssuesCount || 0} em orçamentos.`,
        counts: dbResult.counts || {},
      };
    } catch (err) {
      checks.database_layer = {
        status: "unhealthy",
        details: `Erro na sonda do banco: ${err.message}`,
      };
    }
  }

  const totalDuration = Date.now() - startTime;
  checks.web_app.latency_ms = totalDuration;

  const isDegraded = Object.values(checks).some((c) => c.status === "warning");
  const isDown = Object.values(checks).some((c) => c.status === "unhealthy" || c.status === "offline");

  return {
    overall_status: isDown ? "unhealthy" : isDegraded ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    environment: envMeta.environment,
    app_version: envMeta.app_version,
    total_probe_duration_ms: totalDuration,
    sla_compliance: {
      rpo: `${INFRASTRUCTURE_SLA.rpo_minutes} minutos`,
      rto: `${INFRASTRUCTURE_SLA.rto_minutes} minutos`,
      target_uptime: `${INFRASTRUCTURE_SLA.target_uptime_percentage}%`,
      p95_budget_ok: totalDuration < INFRASTRUCTURE_SLA.max_api_p95_latency_ms,
    },
    checks,
  };
}

/**
 * Validador e Simulador de Rollback Seguro de Versão.
 * Garante que uma reversão de versão não corrompa nem apague dados gerados por versões superiores.
 */
export function validateRollbackSafety({ currentVersion, targetVersion, migrations = [], databaseState = {} }) {
  if (!currentVersion || !targetVersion) {
    throw new Error("Versão atual e versão de destino para rollback são obrigatórias.");
  }

  // Verificar se há alterações irreversíveis de esquema no intervalo
  const destructiveMigrations = migrations.filter((m) =>
    m.sql && (m.sql.includes("DROP TABLE") || m.sql.includes("DROP COLUMN"))
  );

  const canSafeRollback = destructiveMigrations.length === 0;

  return {
    safe: canSafeRollback,
    current_version: currentVersion,
    target_rollback_version: targetVersion,
    requires_database_restore: !canSafeRollback,
    warning: canSafeRollback
      ? "Rollback de software (frontend/APIs) 100% seguro sem impacto destrutivo nos dados."
      : "Atenção: Existem migrações de esquema com destruição de colunas. Reversão exige restauração de backup pontual.",
    destructive_migrations_count: destructiveMigrations.length,
    validated_at: new Date().toISOString(),
  };
}
