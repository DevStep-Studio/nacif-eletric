/**
 * Utilitário de Coleta Ética e Mínima de Informações Técnicas
 * Captura dados do ambiente para diagnóstico de bugs sem expor dados confidenciais.
 */

export function parseUserAgent() {
  if (typeof window === "undefined" || !navigator) {
    return { browser: "Desconhecido", os: "Desconhecido" };
  }

  const ua = navigator.userAgent || "";
  let browser = "Navegador Web";
  let os = "Sistema Operacional";

  // SO Detection
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows nt 6\.3/i.test(ua)) os = "Windows 8.1";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  // Browser Detection
  if (/edg\//i.test(ua)) {
    const match = ua.match(/edg\/([0-9.]+)/i);
    browser = `Microsoft Edge ${match ? match[1] : ""}`.trim();
  } else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) {
    const match = ua.match(/chrome\/([0-9.]+)/i);
    browser = `Google Chrome ${match ? match[1] : ""}`.trim();
  } else if (/firefox\//i.test(ua)) {
    const match = ua.match(/firefox\/([0-9.]+)/i);
    browser = `Mozilla Firefox ${match ? match[1] : ""}`.trim();
  } else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) {
    const match = ua.match(/version\/([0-9.]+)/i);
    browser = `Apple Safari ${match ? match[1] : ""}`.trim();
  }

  return { browser, os };
}

export function collectTechnicalInfo({
  module = "Outros",
  projectId = null,
  workspaceId = "default_workspace",
  user = null,
} = {}) {
  const { browser, os } = parseUserAgent();
  const screenResolution = typeof window !== "undefined"
    ? `${window.screen?.width || 0}x${window.screen?.height || 0} (Janela: ${window.innerWidth}x${window.innerHeight})`
    : "N/A";

  const currentRoute = typeof window !== "undefined"
    ? `${window.location.pathname}${window.location.search}`
    : "/";

  return {
    timestamp: new Date().toISOString(),
    app_version: "1.4.0",
    browser,
    os,
    route: currentRoute,
    module,
    user_id: user?.id || "anônimo",
    user_email: user?.email || "não informado",
    workspace_id: workspaceId || "default",
    project_id: projectId || null,
    screen_resolution: screenResolution,
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    language: typeof navigator !== "undefined" ? navigator.language : "pt-BR",
  };
}
