import { useCallback, useEffect, useMemo, useState } from "react";
import { backend } from "@/api/backendClient";
import {
  WEG_BLUE,
  WEG_BLUE_BORDER,
  WEG_BLUE_SOFT,
  WEG_BLUE_TINT,
  WEG_BRANDING_VERSION,
  DEFAULT_COMPACT_LOGO_URL,
  DEFAULT_LOGO_URL,
} from "@/lib/brandingDefaults";
import { calcProjectMetrics } from "@/lib/electricalEngine";

const BRANDING_KEY = "voltai_branding";
const NOTIFICATIONS_KEY = "voltai_notifications";
const BRANDING_EVENT = "voltai:branding";
const NOTIFICATIONS_EVENT = "voltai:notifications";

export const THEME_PRESETS = [
  {
    id: "default",
    name: "NACIF Solutions",
    primaryColor: WEG_BLUE,
    primaryForeground: "#ffffff",
    secondaryColor: WEG_BLUE_SOFT,
    accentColor: WEG_BLUE_TINT,
    borderColor: WEG_BLUE_BORDER,
    logoIconColor: WEG_BLUE,
    logoBackgroundColor: "#ffffff",
    authLogoIconColor: WEG_BLUE,
    authLogoBackgroundColor: "#ffffff",
  },
  {
    id: "teal",
    name: "Verde Engenharia",
    primaryColor: "#00d8b8",
    primaryForeground: "#ffffff",
    secondaryColor: "#dffbf5",
    accentColor: "#f1fef9",
    borderColor: "#bfeee3",
    logoIconColor: "#00d8b8",
    logoBackgroundColor: "#dffbf5",
    authLogoIconColor: "#00d8b8",
    authLogoBackgroundColor: "#dffbf5",
  },
  {
    id: "emerald",
    name: "Verde Técnico",
    primaryColor: "#16a34a",
    primaryForeground: "#ffffff",
    secondaryColor: "#dcfce7",
    accentColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    logoIconColor: "#16a34a",
    logoBackgroundColor: "#dcfce7",
    authLogoIconColor: "#16a34a",
    authLogoBackgroundColor: "#dcfce7",
  },
  {
    id: "graphite",
    name: "Grafite Premium",
    primaryColor: "#111827",
    primaryForeground: "#ffffff",
    secondaryColor: "#f3f4f6",
    accentColor: "#f9fafb",
    borderColor: "#d1d5db",
    logoIconColor: "#111827",
    logoBackgroundColor: "#f3f4f6",
    authLogoIconColor: "#111827",
    authLogoBackgroundColor: "#f3f4f6",
  },
];

export const DEFAULT_BRANDING = {
  brandingVersion: WEG_BRANDING_VERSION,
  appName: "NACIF Solutions",
  appSuffix: "Eletric",
  primaryColor: THEME_PRESETS[0].primaryColor,
  primaryForeground: THEME_PRESETS[0].primaryForeground,
  secondaryColor: THEME_PRESETS[0].secondaryColor,
  accentColor: THEME_PRESETS[0].accentColor,
  borderColor: THEME_PRESETS[0].borderColor,
  logoIconColor: THEME_PRESETS[0].logoIconColor,
  logoBackgroundColor: THEME_PRESETS[0].logoBackgroundColor,
  authLogoIconColor: THEME_PRESETS[0].authLogoIconColor,
  authLogoBackgroundColor: THEME_PRESETS[0].authLogoBackgroundColor,
  logoDataUrl: DEFAULT_LOGO_URL,
  compactLogoDataUrl: DEFAULT_COMPACT_LOGO_URL,
  authLogoDataUrl: DEFAULT_LOGO_URL,
};

const applyDefaultBranding = (branding) => ({
  ...branding,
  brandingVersion: WEG_BRANDING_VERSION,
  appName: DEFAULT_BRANDING.appName,
  appSuffix: DEFAULT_BRANDING.appSuffix,
  primaryColor: DEFAULT_BRANDING.primaryColor,
  primaryForeground: DEFAULT_BRANDING.primaryForeground,
  secondaryColor: DEFAULT_BRANDING.secondaryColor,
  accentColor: DEFAULT_BRANDING.accentColor,
  borderColor: DEFAULT_BRANDING.borderColor,
  logoIconColor: DEFAULT_BRANDING.logoIconColor,
  logoBackgroundColor: DEFAULT_BRANDING.logoBackgroundColor,
  authLogoIconColor: DEFAULT_BRANDING.authLogoIconColor,
  authLogoBackgroundColor: DEFAULT_BRANDING.authLogoBackgroundColor,
  logoDataUrl: DEFAULT_BRANDING.logoDataUrl,
  compactLogoDataUrl: DEFAULT_BRANDING.compactLogoDataUrl,
  authLogoDataUrl: DEFAULT_BRANDING.authLogoDataUrl,
});

const storage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const notificationUserKey = (user) => user?.id || user?.email || "anonymous";

const safeJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeBranding = (value) => {
  if (!value || typeof value !== "object") return DEFAULT_BRANDING;
  const normalized = {
    ...DEFAULT_BRANDING,
    ...value,
    brandingVersion: WEG_BRANDING_VERSION,
  };

  if (value.brandingVersion !== WEG_BRANDING_VERSION) {
    return applyDefaultBranding(normalized);
  }

  return normalized;
};

const hexToRgb = (hex) => {
  const raw = String(hex || "").replace("#", "").trim();
  const normalized = raw.length === 3
    ? raw.split("").map((char) => `${char}${char}`).join("")
    : raw;
  const int = Number.parseInt(normalized, 16);
  if (!Number.isFinite(int)) return { r: 0, g: 216, b: 184 };
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const hexToHsl = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r1) h = (g1 - b1) / d + (g1 < b1 ? 6 : 0);
    if (max === g1) h = (b1 - r1) / d + 2;
    if (max === b1) h = (r1 - g1) / d + 4;
    h /= 6;
  }

  const precision = (number) => Number(number.toFixed(2));
  return `${precision(h * 360)} ${precision(s * 100)}% ${precision(l * 100)}%`;
};

const setCssColor = (root, name, color) => {
  root.style.setProperty(name, hexToHsl(color));
};

export function readBranding() {
  const store = storage();
  if (!store) return DEFAULT_BRANDING;
  return normalizeBranding(safeJson(store.getItem(BRANDING_KEY), DEFAULT_BRANDING));
}

export function saveBranding(nextBranding) {
  const branding = normalizeBranding(nextBranding);
  const store = storage();
  if (store) store.setItem(BRANDING_KEY, JSON.stringify(branding));
  applyBranding(branding);
  window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: branding }));
  return branding;
}

export function applyBranding(brandingInput = readBranding()) {
  if (typeof document === "undefined") return;
  const branding = normalizeBranding(brandingInput);
  const root = document.documentElement;

  setCssColor(root, "--primary", branding.primaryColor);
  setCssColor(root, "--ring", branding.primaryColor);
  setCssColor(root, "--chart-1", branding.primaryColor);
  setCssColor(root, "--sidebar-primary", branding.primaryColor);
  setCssColor(root, "--primary-foreground", branding.primaryForeground);
  setCssColor(root, "--sidebar-primary-foreground", branding.primaryForeground);
  setCssColor(root, "--secondary", branding.secondaryColor);
  setCssColor(root, "--accent", branding.accentColor);
  setCssColor(root, "--sidebar-accent", branding.accentColor);
  setCssColor(root, "--border", branding.borderColor);
  setCssColor(root, "--input", branding.borderColor);
  root.style.setProperty("--brand-accent", branding.primaryColor);
  root.style.setProperty("--brand-accent-soft", branding.secondaryColor);
  root.style.setProperty("--brand-logo-icon", branding.logoIconColor);
  root.style.setProperty("--brand-logo-background", branding.logoBackgroundColor);
  root.style.setProperty("--brand-auth-logo-icon", branding.authLogoIconColor);
  root.style.setProperty("--brand-auth-logo-background", branding.authLogoBackgroundColor);
}

export function useBranding() {
  const [branding, setBranding] = useState(readBranding);

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  useEffect(() => {
    const handleBranding = () => setBranding(readBranding());

    let active = true;

    const syncBranding = async () => {
      try {
        const remoteBranding = normalizeBranding(await backend.entities.Settings.getBranding());
        saveBranding(remoteBranding);
        if (active) {
          setBranding(remoteBranding);
        }
      } catch {
        if (active) {
          setBranding(readBranding());
        }
      }
    };

    syncBranding();
    window.addEventListener(BRANDING_EVENT, handleBranding);
    window.addEventListener("storage", handleBranding);
    return () => {
      active = false;
      window.removeEventListener(BRANDING_EVENT, handleBranding);
      window.removeEventListener("storage", handleBranding);
    };
  }, []);

  const updateBranding = useCallback(async (patch) => {
    const next = normalizeBranding({ ...readBranding(), ...patch });
    const saved = normalizeBranding(await backend.entities.Settings.updateBranding(next));
    saveBranding(saved);
    setBranding(saved);
    return saved;
  }, []);

  const applyPreset = useCallback((presetId) => {
    const preset = THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return readBranding();
    return normalizeBranding({ ...readBranding(), ...preset, brandingVersion: WEG_BRANDING_VERSION });
  }, []);

  const resetBranding = useCallback(() => {
    const next = normalizeBranding(DEFAULT_BRANDING);
    setBranding(next);
    return next;
  }, []);

  return { branding, updateBranding, applyPreset, resetBranding };
}

export function BrandingBoot() {
  useBranding();
  return null;
}

const nowIso = () => new Date().toISOString();

export function readNotifications(user) {
  const store = storage();
  if (!store) return [];
  const saved = safeJson(store.getItem(NOTIFICATIONS_KEY), null);

  const userKey = notificationUserKey(user);

  if (Array.isArray(saved)) {
    const migrated = { [userKey]: saved };
    store.setItem(NOTIFICATIONS_KEY, JSON.stringify(migrated));
    return saved;
  }

  if (saved && typeof saved === "object") {
    return Array.isArray(saved[userKey]) ? saved[userKey] : [];
  }

  return [];
}

function persistNotifications(notifications, user, emit = true) {
  const store = storage();
  if (store) {
    const userKey = notificationUserKey(user);
    const saved = safeJson(store.getItem(NOTIFICATIONS_KEY), {});
    const nextState = Array.isArray(saved)
      ? { [userKey]: notifications }
      : { ...(saved || {}), [userKey]: notifications };
    store.setItem(NOTIFICATIONS_KEY, JSON.stringify(nextState));
  }
  if (emit) window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT, { detail: notifications }));
  return notifications;
}

export function saveNotifications(notifications, user) {
  return persistNotifications(notifications, user, true);
}

function saveNotificationsSilently(notifications, user) {
  return persistNotifications(notifications, user, false);
}

const sortNotifications = (notifications) => [...notifications].sort((a, b) => {
  const left = new Date(b.createdAt || 0).getTime();
  const right = new Date(a.createdAt || 0).getTime();
  return left - right;
});

const buildNotificationStateMap = (notifications = []) => new Map(
  notifications.map((item) => [item.id, item]),
);

const buildProjectNotifications = (projects, existingNotifications = []) => {
  const existingStateMap = buildNotificationStateMap(existingNotifications);
  const hasEquivalentNotification = (title, href, category) => existingNotifications.some((item) => (
    item.title === title &&
    item.href === href &&
    item.category === category &&
    !item.derived
  ));

  return projects.flatMap((project) => {
    const createdAt = project?.updated_date || project?.updatedAt || project?.created_date || project?.createdAt || nowIso();
    const circuits = project?.circuits || [];

    if (circuits.length === 0) {
      const id = `project-empty:${project.id}`;
      const title = `Projeto "${project.name}" sem circuitos`;
      const href = `/projects/${project.id}`;

      if (hasEquivalentNotification(title, href, "Projeto")) {
        return [];
      }

      return [{
        id,
        title,
        description: "Cadastre os primeiros circuitos para liberar analises, quadro e documentacao.",
        category: "Projeto",
        tone: "warning",
        href,
        read: existingStateMap.get(id)?.read ?? false,
        createdAt,
        hidden: existingStateMap.get(id)?.hidden ?? false,
        derived: true,
      }];
    }

    const metrics = calcProjectMetrics(project);
    const errorCount = metrics.validations.filter((item) => item.severity === "error").length;
    const warningCount = metrics.validations.filter((item) => item.severity === "warning").length;

    if (!errorCount && !warningCount) return [];

    const id = `project-alert:${project.id}:${errorCount}:${warningCount}:${metrics.nbrScore}`;
    const title = `Projeto "${project.name}" exige revisao`;
    const href = `/projects/${project.id}`;
    const issueLabel = [
      errorCount > 0 ? `${errorCount} erro${errorCount > 1 ? "s" : ""}` : null,
      warningCount > 0 ? `${warningCount} aviso${warningCount > 1 ? "s" : ""}` : null,
    ].filter(Boolean).join(" e ");

    if (hasEquivalentNotification(title, href, "Conformidade")) {
      return [];
    }

    return [{
      id,
      title,
      description: `${issueLabel} detectado${errorCount + warningCount > 1 ? "s" : ""} na analise NBR. Score atual: ${metrics.nbrScore}%.`,
      category: "Conformidade",
      tone: errorCount > 0 ? "warning" : "info",
      href,
      read: existingStateMap.get(id)?.read ?? false,
      createdAt,
      hidden: existingStateMap.get(id)?.hidden ?? false,
      derived: true,
    }];
  }).slice(0, 12);
};

const mergeNotifications = (notifications, projectNotifications, existingNotifications = []) => {
  const existingStateMap = buildNotificationStateMap(existingNotifications);
  const manual = notifications
    .filter((item) => !item.derived)
    .map((item) => ({
      ...item,
      read: existingStateMap.get(item.id)?.read ?? item.read ?? false,
      hidden: existingStateMap.get(item.id)?.hidden ?? item.hidden ?? false,
    }));

  return sortNotifications([...projectNotifications, ...manual])
    .filter((item) => !item.hidden)
    .slice(0, 30);
};

export function pushNotification(notification, user, options = {}) {
  return backend.entities.Notification.create({
    category: "Admin",
    tone: "info",
    href: "/",
    audience: options.audience,
    user_id: options.user_id,
    ...notification,
  }).then((created) => {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT, { detail: created }));
    return created;
  }).catch(() => {
    const current = readNotifications(user).filter((item) => !item.derived);
    const next = [
      {
        id: `notification_${Date.now()}`,
        category: "Admin",
        tone: "info",
        href: "/",
        read: false,
        createdAt: nowIso(),
        ...notification,
      },
      ...current,
    ].slice(0, 30);
    return saveNotifications(next, user);
  });
}

export function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);

  const refreshNotifications = useCallback(async () => {
    try {
      const localNotifications = readNotifications(user);
      const [remoteNotifications, projects] = await Promise.all([
        backend.entities.Notification.list(30),
        backend.entities.Project.list("-updated_date", 50),
      ]);

      const normalizedRemote = remoteNotifications.map((item) => ({
        ...item,
        createdAt: item.created_date || item.createdAt || nowIso(),
        updatedAt: item.updated_date || item.updatedAt || nowIso(),
      }));

      const existingState = [...localNotifications, ...normalizedRemote];
      const merged = mergeNotifications(
        normalizedRemote,
        buildProjectNotifications(projects, existingState),
        existingState,
      );
      setNotifications(merged);
      persistNotifications(merged, user, false);
      return merged;
    } catch {
      const fallback = sortNotifications(readNotifications(user));
      setNotifications(fallback);
      return fallback;
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    const handleNotifications = async () => {
      if (!active) return;
      await refreshNotifications();
    };

    handleNotifications();
    const intervalId = window.setInterval(handleNotifications, 15000);
    window.addEventListener(NOTIFICATIONS_EVENT, handleNotifications);
    window.addEventListener("storage", handleNotifications);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener(NOTIFICATIONS_EVENT, handleNotifications);
      window.removeEventListener("storage", handleNotifications);
    };
  }, [refreshNotifications]);

  const setAndSave = useCallback((next) => {
    const saved = saveNotifications(next, user);
    setNotifications(saved);
    return saved;
  }, [user]);

  const markRead = useCallback((id) => {
    const next = notifications.map((item) => item.id === id ? { ...item, read: true } : item);
    setNotifications(next);
    saveNotificationsSilently(next, user);
    const target = notifications.find((item) => item.id === id);
    if (target?.derived) {
      return;
    }
    backend.entities.Notification.markRead(id)
      .then(() => refreshNotifications())
      .catch(() => undefined);
  }, [notifications, refreshNotifications, user]);

  const markAllRead = useCallback(() => {
    const next = notifications.map((item) => ({ ...item, read: true }));
    setNotifications(next);
    saveNotificationsSilently(next, user);
    backend.entities.Notification.markAllRead()
      .then(() => refreshNotifications())
      .catch(() => undefined);
  }, [notifications, refreshNotifications, user]);

  const clearAll = useCallback(() => {
    const hidden = notifications.map((item) => ({ ...item, hidden: true, read: true }));
    setNotifications([]);
    saveNotificationsSilently(hidden, user);
    backend.entities.Notification.clearAll()
      .then(() => refreshNotifications())
      .catch(() => undefined);
  }, [refreshNotifications, user]);

  const addNotification = useCallback((notification, options = {}) => {
    return pushNotification(notification, user, options).then(() => refreshNotifications());
  }, [refreshNotifications, user]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  return { notifications, unreadCount, markRead, markAllRead, clearAll, addNotification };
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatNotificationTime(dateString) {
  const createdAt = new Date(dateString).getTime();
  if (!Number.isFinite(createdAt)) return "agora";
  const diff = Math.max(0, Date.now() - createdAt);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}
