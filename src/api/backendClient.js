const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "";
const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");
const TOKEN_KEYS = ["voltai_access_token", "voltai_token"];
export const isLocalAuthMode = true;
const LOCAL_USERS_KEY = "voltai_local_users";
const LOCAL_PROJECTS_KEY = "voltai_local_projects";
const LOCAL_NOTIFICATIONS_KEY = "voltai_local_backend_notifications";
const LOCAL_RESET_TOKENS_KEY = "voltai_local_reset_tokens";
const LOCAL_BRANDING_KEY = "voltai_branding";

const createError = (message, status = 400) => Object.assign(new Error(message), { status });

const storage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const safeJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readLocal = (key, fallback) => {
  const store = storage();
  if (!store) return fallback;
  return safeJson(store.getItem(key), fallback);
};

const writeLocal = (key, value) => {
  const store = storage();
  if (!store) return value;
  store.setItem(key, JSON.stringify(value));
  return value;
};

const cloneLocal = (value) => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
};

const nowIso = () => new Date().toISOString();
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const randomId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const sortLocalItems = (items, sortBy, limit) => {
  const sortKey = String(sortBy || "-created_date");
  const descending = sortKey.startsWith("-");
  const field = descending ? sortKey.slice(1) : sortKey;
  const safeItems = Array.isArray(items) ? items : [];
  const sorted = [...safeItems].sort((a, b) => {
    const left = a?.[field] ?? "";
    const right = b?.[field] ?? "";
    const leftTime = Date.parse(left);
    const rightTime = Date.parse(right);
    const leftValue = Number.isNaN(leftTime) ? String(left) : leftTime;
    const rightValue = Number.isNaN(rightTime) ? String(right) : rightTime;

    if (leftValue < rightValue) return descending ? 1 : -1;
    if (leftValue > rightValue) return descending ? -1 : 1;
    return 0;
  });

  return Number(limit) > 0 ? sorted.slice(0, Number(limit)) : sorted;
};

const publicUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return cloneLocal(safeUser);
};

const readLocalUsers = () => { const d = readLocal(LOCAL_USERS_KEY, []); return Array.isArray(d) ? d : []; };
const writeLocalUsers = (users) => writeLocal(LOCAL_USERS_KEY, users);
const readLocalProjects = () => { const d = readLocal(LOCAL_PROJECTS_KEY, []); return Array.isArray(d) ? d : []; };
const writeLocalProjects = (projects) => writeLocal(LOCAL_PROJECTS_KEY, projects);
const readLocalNotifications = () => { const d = readLocal(LOCAL_NOTIFICATIONS_KEY, []); return Array.isArray(d) ? d : []; };
const writeLocalNotifications = (notifications) => writeLocal(LOCAL_NOTIFICATIONS_KEY, notifications);
const readLocalResetTokens = () => readLocal(LOCAL_RESET_TOKENS_KEY, {});
const writeLocalResetTokens = (tokens) => writeLocal(LOCAL_RESET_TOKENS_KEY, tokens);

const createLocalToken = (userId) => `local:${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

const getLocalUserFromToken = () => {
  const token = getStoredToken();
  if (!token?.startsWith("local:")) return null;
  const userId = token.split(":")[1];
  return readLocalUsers().find((user) => user.id === userId) || null;
};

const requireLocalUser = () => {
  const user = getLocalUserFromToken();
  if (!user) {
    clearStoredToken();
    throw createError("Autenticacao obrigatoria.", 401);
  }
  return user;
};

const localUploadFile = (file) => new Promise((resolve, reject) => {
  if (!file || typeof FileReader === "undefined") {
    resolve({ file_url: "", file_name: file?.name || "", content_type: file?.type || "" });
    return;
  }

  const reader = new FileReader();
  reader.onload = () => resolve({
    file_url: reader.result,
    file_name: file.name,
    content_type: file.type,
  });
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  return TOKEN_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) || null;
};

const setStoredToken = (value) => {
  if (typeof window === "undefined") return;
  TOKEN_KEYS.forEach((key) => window.localStorage.setItem(key, value));
};

const clearStoredToken = () => {
  if (typeof window === "undefined") return;
  TOKEN_KEYS.forEach((key) => window.localStorage.removeItem(key));
};

const buildUrl = (path, query) => {
  const resolvedBase =
    API_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3001");
  const normalizedBase = resolvedBase.endsWith("/") ? resolvedBase : `${resolvedBase}/`;
  const url = new URL(path.replace(/^\/+/, ""), normalizedBase);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  if (!API_BASE_URL && typeof window !== "undefined") {
    return `${url.pathname}${url.search}`;
  }

  return url.toString();
};

const readResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
};

const request = async (path, options = {}) => {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  const hasJsonBody = options.body !== undefined && !(options.body instanceof FormData);

  if (hasJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method || "GET",
    headers,
    body: options.body instanceof FormData || options.body === undefined ? options.body : JSON.stringify(options.body),
  });

  const data = await readResponse(response);

  if (!response.ok) {
    throw createError(data?.message || "Falha na comunicação com o servidor.", response.status);
  }

  return data;
};

const auth = {
  getToken: getStoredToken,
  setToken: setStoredToken,

  async me() {
    if (isLocalAuthMode) {
      return publicUser(requireLocalUser());
    }

    return request("/api/auth/me");
  },

  async loginViaEmailPassword(email, password) {
    if (isLocalAuthMode) {
      const normalizedEmail = normalizeEmail(email);
      const user = readLocalUsers().find((item) => item.email === normalizedEmail);

      if (!user || user.password !== password) {
        throw createError("Email ou senha invalidos.", 401);
      }

      const access_token = createLocalToken(user.id);
      setStoredToken(access_token);
      return { access_token, user: publicUser(user) };
    }

    const result = await request("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });

    if (result?.access_token) {
      setStoredToken(result.access_token);
    }

    return result;
  },

  async register({ email, password, profession }) {
    if (isLocalAuthMode) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        throw createError("Informe um email valido.", 400);
      }

      const users = readLocalUsers();
      if (users.some((item) => item.email === normalizedEmail)) {
        throw createError("Este email ja esta cadastrado.", 409);
      }

      const timestamp = nowIso();
      const user = {
        id: randomId("local_user"),
        email: normalizedEmail,
        password,
        full_name: normalizedEmail.split("@")[0],
        profession,
        profissao: profession,
        role: users.length === 0 ? "admin" : "user",
        plan: "profissional",
        created_date: timestamp,
        updated_date: timestamp,
      };
      writeLocalUsers([...users, user]);

      const access_token = createLocalToken(user.id);
      setStoredToken(access_token);
      return { access_token, user: publicUser(user) };
    }

    const result = await request("/api/auth/register", {
      method: "POST",
      body: { email, password, profession },
    });

    if (result?.access_token) {
      setStoredToken(result.access_token);
    }

    return result;
  },

  async verifyOtp({ email, otpCode }) {
    if (isLocalAuthMode) {
      throw createError("Verificacao por codigo nao e usada no modo local.", 501);
    }

    return request("/api/auth/verify-otp", {
      method: "POST",
      body: { email, otpCode },
    });
  },

  async resendOtp(email) {
    if (isLocalAuthMode) {
      throw createError("Reenvio de codigo nao esta disponivel no modo local.", 501);
    }

    return request("/api/auth/resend-otp", {
      method: "POST",
      body: { email },
    });
  },

  async resetPasswordRequest(email) {
    if (isLocalAuthMode) {
      const normalizedEmail = normalizeEmail(email);
      const user = readLocalUsers().find((item) => item.email === normalizedEmail);

      if (!user) {
        return { ok: true };
      }

      const token = randomId(`reset_${user.id}`);
      writeLocalResetTokens({
        ...readLocalResetTokens(),
        [token]: { userId: user.id, createdAt: nowIso() },
      });

      const recoveryLink = typeof window !== "undefined"
        ? `${window.location.origin}/reset-password?token=${encodeURIComponent(token)}`
        : `/reset-password?token=${encodeURIComponent(token)}`;

      return { ok: true, recoveryLink };
    }

    return request("/api/auth/reset-password-request", {
      method: "POST",
      body: { email },
    });
  },

  async resetPassword({ resetToken, newPassword }) {
    if (isLocalAuthMode) {
      const tokens = readLocalResetTokens();
      const entry = tokens[resetToken];

      if (!entry) {
        throw createError("Link de redefinicao invalido ou expirado.", 400);
      }

      const users = readLocalUsers();
      const userIndex = users.findIndex((item) => item.id === entry.userId);
      if (userIndex < 0) {
        throw createError("Usuario nao encontrado.", 404);
      }

      const nextUsers = [...users];
      nextUsers[userIndex] = {
        ...nextUsers[userIndex],
        password: newPassword,
        updated_date: nowIso(),
      };
      writeLocalUsers(nextUsers);
      delete tokens[resetToken];
      writeLocalResetTokens(tokens);
      return { ok: true };
    }

    return request("/api/auth/reset-password", {
      method: "POST",
      body: { resetToken, newPassword },
    });
  },

  async updateMe(data) {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      const users = readLocalUsers();
      const userIndex = users.findIndex((item) => item.id === currentUser.id);

      if (userIndex < 0) {
        throw createError("Usuario nao encontrado.", 404);
      }

      const nextUsers = [...users];
      nextUsers[userIndex] = {
        ...nextUsers[userIndex],
        ...data,
        profissao: data?.profession ?? data?.profissao ?? nextUsers[userIndex].profissao,
        updated_date: nowIso(),
      };
      writeLocalUsers(nextUsers);
      return publicUser(nextUsers[userIndex]);
    }

    return request("/api/auth/me", {
      method: "PATCH",
      body: data,
    });
  },

  loginWithProvider() {
    throw createError("Login com provedor externo não está habilitado neste backend.", 501);
  },

  logout(redirectTo) {
    const target = redirectTo === undefined ? "/login" : redirectTo;
    clearStoredToken();

    if (target !== false && typeof window !== "undefined") {
      window.location.href = typeof target === "string" ? target : "/login";
    }
  },

  redirectToLogin(target = "/login") {
    if (typeof window !== "undefined") {
      window.location.href = typeof target === "string" ? target : "/login";
    }
  },
};

const projectEntity = {
  async list(sortBy, limit) {
    if (isLocalAuthMode) {
      requireLocalUser();
      return cloneLocal(sortLocalItems(readLocalProjects(), sortBy, limit));
    }

    return request("/api/projects", {
      query: { sortBy, limit },
    });
  },

  async get(id) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const project = readLocalProjects().find((item) => item.id === id);
      if (!project) {
        throw createError("Projeto nao encontrado.", 404);
      }
      return cloneLocal(project);
    }

    return request(`/api/projects/${id}`);
  },

  async getRevisions(id) {
    if (isLocalAuthMode) {
      requireLocalUser();
      return [];
    }

    return request(`/api/projects/${id}/revisions`);
  },

  async create(data) {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      const timestamp = nowIso();
      const project = {
        id: randomId("local_project"),
        created_date: timestamp,
        updated_date: timestamp,
        owner_id: currentUser.id,
        circuits: [],
        ...data,
      };
      writeLocalProjects([project, ...readLocalProjects()]);
      return cloneLocal(project);
    }

    return request("/api/projects", {
      method: "POST",
      body: data,
    });
  },

  async update(id, data) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const projects = readLocalProjects();
      const projectIndex = projects.findIndex((item) => item.id === id);

      if (projectIndex < 0) {
        throw createError("Projeto nao encontrado.", 404);
      }

      const nextProjects = [...projects];
      nextProjects[projectIndex] = {
        ...nextProjects[projectIndex],
        ...data,
        id,
        updated_date: nowIso(),
      };
      writeLocalProjects(nextProjects);
      return cloneLocal(nextProjects[projectIndex]);
    }

    return request(`/api/projects/${id}`, {
      method: "PATCH",
      body: data,
    });
  },

  async delete(id) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const projects = readLocalProjects();
      writeLocalProjects(projects.filter((item) => item.id !== id));
      return { ok: true };
    }

    return request(`/api/projects/${id}`, {
      method: "DELETE",
    });
  },
};

const userEntity = {
  async list() {
    if (isLocalAuthMode) {
      requireLocalUser();
      return readLocalUsers().map(publicUser);
    }

    return request("/api/users");
  },

  async update(id, data) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const users = readLocalUsers();
      const userIndex = users.findIndex((item) => item.id === id);

      if (userIndex < 0) {
        throw createError("Usuario nao encontrado.", 404);
      }

      const nextUsers = [...users];
      nextUsers[userIndex] = {
        ...nextUsers[userIndex],
        ...data,
        profissao: data?.profession ?? data?.profissao ?? nextUsers[userIndex].profissao,
        updated_date: nowIso(),
      };
      writeLocalUsers(nextUsers);
      return publicUser(nextUsers[userIndex]);
    }

    return request(`/api/users/${id}`, {
      method: "PATCH",
      body: data,
    });
  },
};

const notificationEntity = {
  async list(limit) {
    if (isLocalAuthMode) {
      requireLocalUser();
      return cloneLocal(sortLocalItems(readLocalNotifications(), "-created_date", limit));
    }

    return request("/api/notifications", {
      query: { limit },
    });
  },

  async create(data) {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      const timestamp = nowIso();
      const notification = {
        id: randomId("local_notification"),
        read: false,
        created_date: timestamp,
        updated_date: timestamp,
        user_id: data?.user_id || currentUser.id,
        ...data,
      };
      writeLocalNotifications([notification, ...readLocalNotifications()]);
      return cloneLocal(notification);
    }

    return request("/api/notifications", {
      method: "POST",
      body: data,
    });
  },

  async markRead(id) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const notifications = readLocalNotifications();
      const nextNotifications = notifications.map((item) => (
        item.id === id ? { ...item, read: true, updated_date: nowIso() } : item
      ));
      writeLocalNotifications(nextNotifications);
      return { ok: true };
    }

    return request(`/api/notifications/${id}/read`, {
      method: "PATCH",
    });
  },

  async markAllRead() {
    if (isLocalAuthMode) {
      requireLocalUser();
      const timestamp = nowIso();
      writeLocalNotifications(readLocalNotifications().map((item) => ({
        ...item,
        read: true,
        updated_date: timestamp,
      })));
      return { ok: true };
    }

    return request("/api/notifications/read-all", {
      method: "POST",
    });
  },

  async clearAll() {
    if (isLocalAuthMode) {
      requireLocalUser();
      writeLocalNotifications([]);
      return { ok: true };
    }

    return request("/api/notifications", {
      method: "DELETE",
    });
  },
};

const settingsEntity = {
  async getBranding() {
    if (isLocalAuthMode) {
      return cloneLocal(readLocal(LOCAL_BRANDING_KEY, null));
    }

    return request("/api/settings/branding");
  },

  async updateBranding(data) {
    if (isLocalAuthMode) {
      writeLocal(LOCAL_BRANDING_KEY, data);
      return cloneLocal(data);
    }

    return request("/api/settings/branding", {
      method: "PATCH",
      body: data,
    });
  },
};

const catalogEntity = {
  async listComponents() {
    if (isLocalAuthMode) {
      return [];
    }

    return request("/api/catalog/components");
  },

  async listNbrSections() {
    if (isLocalAuthMode) {
      return [];
    }

    return request("/api/catalog/nbr-sections");
  },

  async listMemorialMaterials() {
    if (isLocalAuthMode) {
      return [];
    }

    return request("/api/catalog/memorial-materials");
  },

  async estimateMaterialPrice(name) {
    if (isLocalAuthMode) {
      return { name, unit_price: 0, price: 0, currency: "BRL" };
    }

    return request("/api/catalog/material-price", {
      query: { name },
    });
  },
};

const analysisEntity = {
  async generateRequestedPlan(data) {
    if (isLocalAuthMode) {
      throw createError("Geracao por IA exige o backend em http://localhost:3001.", 501);
    }

    return request("/api/analysis/planta/requested-plan", {
      method: "POST",
      body: data,
    });
  },

  async generateProfessionalPlan(data) {
    if (isLocalAuthMode) {
      throw createError("Geracao por IA exige o backend em http://localhost:3001.", 501);
    }

    return request("/api/analysis/planta/professional-plan", {
      method: "POST",
      body: data,
    });
  },

  async estimateSolarRoof(data) {
    if (isLocalAuthMode) {
      throw createError("Estimativa solar por IA exige o backend em http://localhost:3001.", 501);
    }

    return request("/api/analysis/solar/roof-estimate", {
      method: "POST",
      body: data,
    });
  },
};

const integrations = {
  Core: {
    async UploadFile({ file }) {
      if (isLocalAuthMode) {
        requireLocalUser();
        return localUploadFile(file);
      }

      const formData = new FormData();
      formData.append("file", file);

      return request("/api/files/upload", {
        method: "POST",
        body: formData,
      });
    },

    async InvokeLLM(payload) {
      if (isLocalAuthMode) {
        throw createError("Recursos de IA exigem o backend em http://localhost:3001.", 501);
      }

      return request("/api/ai/invoke", {
        method: "POST",
        body: payload,
      });
    },
  },
};

export const backend = {
  auth,
  entities: {
    Project: projectEntity,
    User: userEntity,
    Notification: notificationEntity,
    Settings: settingsEntity,
    Catalog: catalogEntity,
    Analysis: analysisEntity,
  },
  integrations,
};
