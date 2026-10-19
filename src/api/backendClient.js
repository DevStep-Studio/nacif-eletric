import {
  getAllIssues,
  saveIssue,
  deleteIssue,
  generateProtocol,
  getIssueById,
} from "@/lib/issuePersistence";
import { recordAuditEvent, readAuditLogs, filterAuditLogs } from "@/lib/auditLogger";
import { isSuperAdmin, DEFAULT_ROLES, SUPER_ADMIN_EMAILS } from "@/lib/rbac";

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
  try {
    store.setItem(key, JSON.stringify(value));
    return value;
  } catch (err) {
    console.warn(`[writeLocal] Erro ao gravar ${key} no localStorage:`, err);
    if (key === LOCAL_PROJECTS_KEY && Array.isArray(value)) {
      try {
        const sanitized = value.map((p, idx) => {
          if (idx === 0) return p;
          if (p?.plant_design?.imageUrl?.startsWith("data:")) {
            return {
              ...p,
              plant_design: { ...p.plant_design, imageUrl: "" },
            };
          }
          return p;
        });
        store.setItem(key, JSON.stringify(sanitized));
        return sanitized;
      } catch (innerErr) {
        console.warn(`[writeLocal] Cota estourada no localStorage:`, innerErr);
      }
    }
    return value;
  }
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

const INITIAL_SUPER_ADMINS = [
  {
    id: "local_admin_default",
    email: "admin@nacif.com",
    password: "admin",
    full_name: "Administrador Nacif",
    profession: "Engenheiro Eletricista",
    profissao: "Engenheiro Eletricista",
    role: "super_admin",
    is_super_admin: true,
    status: "active",
    plan: "profissional",
  },
  {
    id: "local_super_admin_grc",
    email: "grc22.09@hotmail.com",
    password: "admin",
    full_name: "Gabriel Nacif",
    profession: "Engenheiro Eletricista",
    profissao: "Engenheiro Eletricista",
    role: "super_admin",
    is_super_admin: true,
    status: "active",
    plan: "profissional",
  },
  {
    id: "local_super_admin_ian",
    email: "ian.mellofla@gmail.com",
    password: "admin",
    full_name: "Ian Mello",
    profession: "Engenheiro Eletricista",
    profissao: "Engenheiro Eletricista",
    role: "super_admin",
    is_super_admin: true,
    status: "active",
    plan: "profissional",
  },
  {
    id: "local_super_admin_wellington",
    email: "wellingtonalfredo550@gmail.com",
    password: "admin",
    full_name: "Wellington Alfredo",
    profession: "Engenheiro Eletricista",
    profissao: "Engenheiro Eletricista",
    role: "super_admin",
    is_super_admin: true,
    status: "active",
    plan: "profissional",
  },
  {
    id: "local_super_admin_comercial",
    email: "comercial@nacifsolutions.com.br",
    password: "admin",
    full_name: "Comercial Nacif Solutions",
    profession: "Engenheiro Eletricista",
    profissao: "Engenheiro Eletricista",
    role: "super_admin",
    is_super_admin: true,
    status: "active",
    plan: "profissional",
  },
];

const readLocalUsers = () => {
  const d = readLocal(LOCAL_USERS_KEY, []);
  if (Array.isArray(d) && d.length > 0) {
    let modified = false;
    const existingEmails = new Set(d.map((u) => String(u.email || "").toLowerCase().trim()));

    const mapped = d.map((u) => {
      const emailLower = String(u.email || "").toLowerCase().trim();
      // Garante que os administradores principais possuem papel super_admin e status ativo
      if (SUPER_ADMIN_EMAILS.includes(emailLower) &&
          (u.role !== "super_admin" || !u.is_super_admin || u.status !== "active")) {
        modified = true;
        return { ...u, role: "super_admin", is_super_admin: true, status: "active" };
      }
      if (!u.status) {
        modified = true;
        return { ...u, status: "active" };
      }
      return u;
    });

    INITIAL_SUPER_ADMINS.forEach((adm) => {
      if (!existingEmails.has(adm.email.toLowerCase())) {
        modified = true;
        const now = nowIso();
        mapped.push({
          ...adm,
          created_date: now,
          updated_date: now,
          last_access: now,
        });
        existingEmails.add(adm.email.toLowerCase());
      }
    });

    if (modified) writeLocalUsers(mapped);
    return mapped;
  }

  const seeded = INITIAL_SUPER_ADMINS.map((adm) => {
    const now = nowIso();
    return {
      ...adm,
      created_date: now,
      updated_date: now,
      last_access: now,
    };
  });
  writeLocalUsers(seeded);
  return seeded;
};
const writeLocalUsers = (users) => writeLocal(LOCAL_USERS_KEY, users);
export const readLocalProjects = () => { const d = readLocal(LOCAL_PROJECTS_KEY, []); return Array.isArray(d) ? d : []; };
export const writeLocalProjects = (projects) => writeLocal(LOCAL_PROJECTS_KEY, projects);
const readLocalNotifications = () => { const d = readLocal(LOCAL_NOTIFICATIONS_KEY, []); return Array.isArray(d) ? d : []; };
const writeLocalNotifications = (notifications) => writeLocal(LOCAL_NOTIFICATIONS_KEY, notifications);
const readLocalResetTokens = () => readLocal(LOCAL_RESET_TOKENS_KEY, {});
const writeLocalResetTokens = (tokens) => writeLocal(LOCAL_RESET_TOKENS_KEY, tokens);

const createLocalToken = (userId) => `local:${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

const getLocalUserFromToken = () => {
  const token = getStoredToken();
  const users = readLocalUsers();
  if (token?.startsWith("local:")) {
    const userId = token.split(":")[1];
    const found = users.find((user) => user.id === userId);
    if (found) return found;
  }
  if (users.length > 0) {
    const defaultUser = users[0];
    const devToken = createLocalToken(defaultUser.id);
    setStoredToken(devToken);
    return defaultUser;
  }
  return null;
};

const requireLocalUser = () => {
  const user = getLocalUserFromToken();
  if (!user) {
    clearStoredToken();
    throw createError("Autenticacao obrigatoria.", 401);
  }
  if (user.status === "suspended") {
    clearStoredToken();
    throw createError("Sua conta está suspensa pela administração.", 403);
  }
  if (user.is_deleted) {
    clearStoredToken();
    throw createError("Conta desativada.", 404);
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
      const users = readLocalUsers();
      const userIndex = users.findIndex((item) => item.email === normalizedEmail);
      const user = userIndex >= 0 ? users[userIndex] : null;

      if (!user || user.password !== password) {
        throw createError("Email ou senha invalidos.", 401);
      }

      if (user.status === "suspended") {
        throw createError("Sua conta está suspensa. Entre em contato com o suporte.", 403);
      }

      if (user.is_deleted) {
        throw createError("Conta desativada.", 404);
      }

      // Atualiza último acesso
      const timestamp = nowIso();
      const updatedUsers = [...users];
      updatedUsers[userIndex] = { ...user, last_access: timestamp, updated_date: timestamp };
      writeLocalUsers(updatedUsers);

      const access_token = createLocalToken(user.id);
      setStoredToken(access_token);
      return { access_token, user: publicUser(updatedUsers[userIndex]) };
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
      const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(normalizedEmail);
      const user = {
        id: randomId("local_user"),
        email: normalizedEmail,
        password,
        full_name: normalizedEmail.split("@")[0],
        profession,
        profissao: profession,
        role: isSuperAdminEmail ? "super_admin" : (users.length === 0 ? "admin" : "user"),
        is_super_admin: isSuperAdminEmail,
        status: "active",
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

  async deleteAccount() {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      const users = readLocalUsers();
      const nextUsers = users.filter((item) => item.id !== currentUser.id);
      writeLocalUsers(nextUsers);
      clearStoredToken();
      return { ok: true };
    }
    return request("/api/auth/me", { method: "DELETE" });
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

      const nextProjects = [...projects];
      if (projectIndex < 0) {
        const newProject = {
          id,
          name: data?.name || "Projeto Elétrico",
          created_date: nowIso(),
          updated_date: nowIso(),
          circuits: [],
          ...data,
        };
        writeLocalProjects([newProject, ...projects]);
        return cloneLocal(newProject);
      }

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

const issueEntity = {
  async list(filters = {}) {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      const all = await getAllIssues();
      const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin" || isSuperAdmin(currentUser);

      let filtered = all;

      if (!isAdmin || filters.userOnly) {
        filtered = filtered.filter(
          (i) => i.user_id === currentUser.id || i.user_email === currentUser.email
        );
      }

      if (filters.status && filters.status !== "todos") {
        filtered = filtered.filter((i) => i.status === filters.status);
      }

      if (filters.type && filters.type !== "todos") {
        filtered = filtered.filter((i) => i.type === filters.type);
      }

      if (filters.module && filters.module !== "todos") {
        filtered = filtered.filter((i) => i.module === filters.module);
      }

      if (filters.search) {
        const q = String(filters.search).toLowerCase().trim();
        filtered = filtered.filter(
          (i) =>
            i.title?.toLowerCase().includes(q) ||
            i.protocol?.toLowerCase().includes(q) ||
            i.description?.toLowerCase().includes(q) ||
            i.user_name?.toLowerCase().includes(q)
        );
      }

      return sortLocalItems(filtered, filters.sortBy || "-created_date", filters.limit);
    }

    return request("/api/issues", { query: filters });
  },

  async get(id) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const issue = await getIssueById(id);
      if (!issue) throw createError("Relato não encontrado.", 404);
      return cloneLocal(issue);
    }
    return request(`/api/issues/${id}`);
  },

  async create(data) {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      const all = await getAllIssues();
      const timestamp = nowIso();
      const protocol = generateProtocol(all);

      const newIssue = {
        id: randomId("issue"),
        protocol,
        type: data.type || "erro",
        title: String(data.title || "").trim(),
        module: data.module || "Outros",
        description: String(data.description || "").trim(),
        steps_to_reproduce: data.steps_to_reproduce || "",
        expected_result: data.expected_result || "",
        actual_result: data.actual_result || "",
        status: "recebido",
        priority: "media",
        user_id: currentUser.id,
        user_name: currentUser.full_name || currentUser.name || "Usuário",
        user_email: currentUser.email,
        workspace_id: data.workspace_id || "default_workspace",
        project_id: data.project_id || null,
        technical_info: data.technical_info || {},
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        comments: [],
        timeline: [
          {
            id: randomId("tl"),
            event: "criado",
            title: "Relato Aberto",
            details: `Problema registrado no sistema com protocolo ${protocol}`,
            actor_name: currentUser.full_name || "Usuário",
            actor_role: currentUser.role || "user",
            timestamp,
          },
        ],
        unread_user: false,
        unread_admin: true,
        internal_notes: "",
        created_date: timestamp,
        updated_date: timestamp,
      };

      await saveIssue(newIssue);

      try {
        await notificationEntity.create({
          title: `Novo problema reportado: ${protocol}`,
          description: `[${newIssue.type.toUpperCase()}] ${newIssue.title} (${newIssue.module})`,
          category: "Avisos e Erros",
          tone: newIssue.type === "erro" ? "warning" : "info",
          href: `/avisos-erros?issue=${newIssue.id}`,
          audience: "admin",
        });
      } catch (notifErr) {
        console.warn("[notificationEntity create warning]", notifErr);
      }

      return cloneLocal(newIssue);
    }

    return request("/api/issues", { method: "POST", body: data });
  },

  async update(id, updates) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const issue = await getIssueById(id);
      if (!issue) throw createError("Relato não encontrado.", 404);

      const timestamp = nowIso();
      const updated = {
        ...issue,
        ...updates,
        updated_date: timestamp,
      };

      await saveIssue(updated);
      return cloneLocal(updated);
    }

    return request(`/api/issues/${id}`, { method: "PATCH", body: updates });
  },

  async updateStatusAndPriority(id, { status, priority, admin_response, internal_notes }) {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      const issue = await getIssueById(id);
      if (!issue) throw createError("Relato não encontrado.", 404);

      const timestamp = nowIso();
      const timelineEvents = [...(issue.timeline || [])];
      const comments = [...(issue.comments || [])];

      if (status && status !== issue.status) {
        const statusLabels = {
          recebido: "Recebido",
          em_analise: "Em análise",
          em_correcao: "Em correção",
          resolvido: "Resolvido",
          encerrado: "Encerrado",
        };
        timelineEvents.push({
          id: randomId("tl"),
          event: "status_change",
          title: `Status alterado para "${statusLabels[status] || status}"`,
          details: `Status alterado por ${currentUser.full_name || "Administrador"}`,
          actor_name: currentUser.full_name || "Administrador",
          actor_role: "admin",
          timestamp,
        });
      }

      if (priority && priority !== issue.priority) {
        timelineEvents.push({
          id: randomId("tl"),
          event: "priority_change",
          title: `Prioridade alterada para "${priority}"`,
          details: "Prioridade atualizada pela equipe técnica",
          actor_name: currentUser.full_name || "Administrador",
          actor_role: "admin",
          timestamp,
        });
      }

      if (admin_response && admin_response.trim()) {
        const commentId = randomId("comm");
        comments.push({
          id: commentId,
          author_id: currentUser.id,
          author_name: currentUser.full_name || "Equipe Nacif Electric",
          author_email: currentUser.email,
          author_role: "admin",
          message: admin_response.trim(),
          is_internal: false,
          created_date: timestamp,
        });
        timelineEvents.push({
          id: randomId("tl"),
          event: "team_reply",
          title: "Resposta da Equipe Técnica",
          details:
            admin_response.trim().slice(0, 100) +
            (admin_response.length > 100 ? "..." : ""),
          actor_name: currentUser.full_name || "Equipe Nacif Electric",
          actor_role: "admin",
          timestamp,
        });
      }

      const updated = {
        ...issue,
        status: status || issue.status,
        priority: priority || issue.priority,
        internal_notes:
          internal_notes !== undefined ? internal_notes : issue.internal_notes,
        comments,
        timeline: timelineEvents,
        unread_user: true,
        updated_date: timestamp,
      };

      await saveIssue(updated);

      try {
        await notificationEntity.create({
          title: `Atualização no relato ${issue.protocol}`,
          description:
            status === "resolvido"
              ? `Seu problema "${issue.title}" foi marcado como RESOLVIDO!`
              : `Status atualizado para "${status}" por nossa equipe técnica.`,
          category: "Avisos e Erros",
          tone: status === "resolvido" ? "success" : "info",
          href: `/avisos-erros?issue=${issue.id}`,
          user_id: issue.user_id,
        });
      } catch (err) {
        console.warn("[notify user error]", err);
      }

      return cloneLocal(updated);
    }

    return request(`/api/issues/${id}/status`, {
      method: "PATCH",
      body: { status, priority, admin_response, internal_notes },
    });
  },

  async addComment(id, { message, is_internal = false }) {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      const issue = await getIssueById(id);
      if (!issue) throw createError("Relato não encontrado.", 404);

      const timestamp = nowIso();
      const isAdmin = currentUser.role === "admin" || currentUser.role === "super_admin" || isSuperAdmin(currentUser);
      const comments = [...(issue.comments || [])];
      const timelineEvents = [...(issue.timeline || [])];

      const newComment = {
        id: randomId("comm"),
        author_id: currentUser.id,
        author_name: currentUser.full_name || currentUser.name || "Usuário",
        author_email: currentUser.email,
        author_role: isAdmin ? "admin" : "user",
        message: String(message || "").trim(),
        is_internal: Boolean(is_internal && isAdmin),
        created_date: timestamp,
      };

      comments.push(newComment);

      if (!newComment.is_internal) {
        timelineEvents.push({
          id: randomId("tl"),
          event: "comment",
          title: isAdmin ? "Resposta da Equipe Técnica" : "Comentário do Usuário",
          details:
            newComment.message.slice(0, 100) +
            (newComment.message.length > 100 ? "..." : ""),
          actor_name: newComment.author_name,
          actor_role: newComment.author_role,
          timestamp,
        });
      }

      const updated = {
        ...issue,
        comments,
        timeline: timelineEvents,
        unread_user: isAdmin && !newComment.is_internal ? true : issue.unread_user,
        unread_admin: !isAdmin ? true : issue.unread_admin,
        updated_date: timestamp,
      };

      await saveIssue(updated);

      if (isAdmin && !newComment.is_internal) {
        await notificationEntity.create({
          title: `Nova resposta no relato ${issue.protocol}`,
          description: newComment.message.slice(0, 120),
          category: "Avisos e Erros",
          tone: "info",
          href: `/avisos-erros?issue=${issue.id}`,
          user_id: issue.user_id,
        });
      } else if (!isAdmin) {
        await notificationEntity.create({
          title: `Novo comentário no relato ${issue.protocol}`,
          description: `${currentUser.full_name || "Usuário"}: ${newComment.message.slice(0, 100)}`,
          category: "Avisos e Erros",
          tone: "info",
          href: `/avisos-erros?issue=${issue.id}`,
          audience: "admin",
        });
      }

      return cloneLocal(updated);
    }

    return request(`/api/issues/${id}/comments`, {
      method: "POST",
      body: { message, is_internal },
    });
  },

  async markAsRead(id, forUser = true) {
    if (isLocalAuthMode) {
      const issue = await getIssueById(id);
      if (!issue) return { ok: false };
      const updated = {
        ...issue,
        unread_user: forUser ? false : issue.unread_user,
        unread_admin: !forUser ? false : issue.unread_admin,
      };
      await saveIssue(updated);
      return { ok: true };
    }
    return request(`/api/issues/${id}/read`, { method: "PATCH", body: { forUser } });
  },

  async getStats() {
    if (isLocalAuthMode) {
      const all = await getAllIssues();
      return {
        total: all.length,
        recebido: all.filter((i) => i.status === "recebido").length,
        em_analise: all.filter((i) => i.status === "em_analise").length,
        em_correcao: all.filter((i) => i.status === "em_correcao").length,
        resolvido: all.filter((i) => i.status === "resolvido").length,
        encerrado: all.filter((i) => i.status === "encerrado").length,
      };
    }
    return request("/api/issues/stats");
  },

  async delete(id) {
    if (isLocalAuthMode) {
      requireLocalUser();
      await deleteIssue(id);
      return { ok: true };
    }
    return request(`/api/issues/${id}`, { method: "DELETE" });
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
        if (API_BASE_URL) {
          try {
            return await request("/api/ai/invoke", {
              method: "POST",
              body: payload,
            });
          } catch (e) {
            console.warn("[InvokeLLM] Backend remoto indisponível, usando motor de IA local:", e);
          }
        }

        const prompt = String(payload?.prompt || "").toLowerCase();
        const schema = payload?.response_json_schema?.properties;

        // 1. Scanner de Imagem / Equipamentos elétricos
        if (schema?.equipments) {
          return {
            equipments: [
              { name: "Iluminação Geral (LED)", power_w: 160, current_a: 0.73, circuit_type: "Iluminação", needs_dr: false, needs_dps: true, wire_gauge: "1.5mm²" },
              { name: "Tomadas de Uso Geral (TUG)", power_w: 1200, current_a: 5.45, circuit_type: "TUG", needs_dr: true, needs_dps: true, wire_gauge: "2.5mm²" },
              { name: "Tomada de Uso Específico (Ar Condicionado 12.000 BTU)", power_w: 1400, current_a: 6.36, circuit_type: "TUE", needs_dr: true, needs_dps: true, wire_gauge: "2.5mm²" },
              { name: "Chuveiro Elétrico (Circuito Dedicado)", power_w: 5500, current_a: 25.0, circuit_type: "TUE", needs_dr: true, needs_dps: true, wire_gauge: "4.0mm²" },
            ],
            summary: "Ambiente inspecionado conforme NBR 5410. Identificados pontos padrão para instalação elétrica com exigência de proteção residual (DR 30mA) e surtos (DPS Classe II).",
          };
        }

        // 2. Sugestão de circuito individual (CircuitFormDialog)
        if (schema?.power_w && schema?.voltage) {
          let power_w = 1200;
          let voltage = 220;
          let supply_type = "Monofásico";
          let power_factor = 0.95;
          let demand_factor = 1.0;
          let justification = "Dimensionamento padrão conforme NBR 5410.";

          if (prompt.includes("chuveiro")) {
            power_w = 5500;
            voltage = 220;
            justification = "Chuveiro elétrico: circuito dedicado (TUE), tensão recomendada 220V para menor corrente e bitola mínima 4mm².";
          } else if (prompt.includes("ar condicionado") || prompt.includes("ar-condicionado")) {
            power_w = 1400;
            voltage = 220;
            power_factor = 0.85;
            justification = "Ar condicionado: circuito exclusivo (TUE) com proteção contra sobrecarga e partida do compressor.";
          } else if (prompt.includes("ilumina") || prompt.includes("luz")) {
            power_w = 200;
            voltage = 127;
            power_factor = 1.0;
            justification = "Iluminação residencial LED: circuito agrupado conforme NBR 5410 item 6.5.4.3, bitola mínima 1.5mm².";
          } else if (prompt.includes("motor") || prompt.includes("bomba")) {
            power_w = 2200;
            voltage = 220;
            supply_type = "Trifásico";
            power_factor = 0.80;
            justification = "Carga indutiva/motor: recomendado circuito trifásico balanceado com partida direta ou suave.";
          }

          return {
            power_w,
            voltage,
            supply_type,
            power_factor,
            demand_factor,
            justification,
          };
        }

        // 3. Estimativa de preço de material (Budget)
        if (schema?.unit_price) {
          let unit_price = 28.5;
          let note = "Preço médio de mercado conforme catálogo técnico WEG/Schneider.";
          if (prompt.includes("disjuntor")) unit_price = 24.9;
          else if (prompt.includes("dr") || prompt.includes("diferencial")) unit_price = 145.0;
          else if (prompt.includes("dps")) unit_price = 85.0;
          else if (prompt.includes("cabo") || prompt.includes("fio")) unit_price = 4.8;
          else if (prompt.includes("eletroduto")) unit_price = 18.5;
          return { name: payload?.prompt || "Material Elétrico", unit_price, note };
        }

        // 4. Estratégia de compra de materiais (MaterialsList)
        if (schema?.strategy) {
          return {
            strategy: "Compra consolidada recomendada em distribuidor especializado para obter melhores descontos em cabos e proteções DIN.",
            note: "Valores baseados em tabelas de referência técnica NBR 5410.",
          };
        }

        // 5. Assistente de IA de Engenharia Elétrica (Chat aberto)
        if (prompt.includes("chuveiro") || prompt.includes("5500w")) {
          return "### Dimensionamento para Chuveiro 5500W (NBR 5410)\n\n" +
            "- **Tensão Recomendada**: 220V (evite 127V para esta potência devido à corrente excessiva de 43.3A).\n" +
            "- **Corrente de Projeto (Ib)**: $5500W / 220V = 25.0A$.\n" +
            "- **Disjuntor Termomagnético (In)**: **32A** (Curva B ou C).\n" +
            "- **Seção Mínima do Condutor**: **4,0 mm²** (para eletroduto embutido em alvenaria - Método B1, $Iz \\approx 28A$ a $32A$). Para distâncias superiores a 25 metros, verifique queda de tensão e utilize **6,0 mm²**.\n" +
            "- **Proteção DR**: **Obrigatório** dispositivo DR de 30mA (proteção contra choque elétrico em áreas molhadas conforme NBR 5410 item 5.1.3.2.2).";
        }

        if (prompt.includes("dr") || prompt.includes("diferencial residual")) {
          return "### Dispositivo Diferencial Residual (DR) - NBR 5410:2004\n\n" +
            "O uso de proteção diferencial residual de alta sensibilidade ($I_{\\Delta n} \\le 30mA$) é **obrigatório** em:\n\n" +
            "1. Circuitos que sirvam a pontos de utilização situados em locais contendo banheira ou chuveiro;\n" +
            "2. Circuitos que alimentem tomadas de corrente situadas em áreas externas;\n" +
            "3. Circuitos de tomadas de corrente situadas em áreas internas que possam alimentar equipamentos no exterior;\n" +
            "4. Circuitos de tomadas de corrente em cozinhas, copas, lavanderias, garagens e áreas de serviço;\n\n" +
            "**Nota de projeto**: O DR pode ser geral no quadro ou individual por circuito. O uso de DRs individuais evita que uma fuga de corrente em um circuito desligue a residência inteira.";
        }

        if (prompt.includes("dps") || prompt.includes("surto")) {
          return "### Dispositivo de Proteção contra Surtos (DPS) - NBR 5410\n\n" +
            "- **Obrigatoriedade**: A NBR 5410 (item 5.4.2) estabelece a obrigatoriedade de DPS em praticamente todas as edificações no Brasil devido à alta densidade de descargas atmosféricas.\n" +
            "- **Classe I**: Instalado na entrada de energia quando a edificação possui SPDA (para-raios) ou linha aérea exposta.\n" +
            "- **Classe II**: Instalado no Quadro de Distribuição Principal (QDF/QGBT) para atenuar sobretensões induzidas (típico: 20kA a 45kA, $U_c \\ge 275V$).\n" +
            "- **Esquema de Ligação**: Em esquema TN-S, instala-se um DPS entre cada fase e o barramento PE, e um DPS entre o neutro e o PE (ou barramento equipotencial).";
        }

        return "### Assistente Técnico NBR 5410 & Nacif Electric\n\n" +
          "Olá! Sou seu assistente de engenharia elétrica especializado nas normas **NBR 5410:2004** (baixa tensão), **NBR 14039** (média tensão) e **NR-10** (segurança).\n\n" +
          "Posso auxiliar no dimensionamento de condutores, disjuntores, quadros DIN/QGBT, cálculo de queda de tensão, balanceamento de fases e sistemas fotovoltaicos. Como posso ajudar com seu projeto?";
      }

      return request("/api/ai/invoke", {
        method: "POST",
        body: payload,
      });
    },
  },
};

const superAdminEntity = {
  async getMetrics() {
    if (isLocalAuthMode) {
      requireLocalUser();
      const users = readLocalUsers().filter((u) => !u.is_deleted);
      const total = users.length;
      const active = users.filter((u) => (u.status || "active") === "active").length;
      const suspended = users.filter((u) => u.status === "suspended").length;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const newThisMonth = users.filter((u) => {
        if (!u.created_date) return false;
        const d = new Date(u.created_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).length;

      const admins = users.filter((u) => u.role === "admin" && !isSuperAdmin(u)).length;
      const superAdmins = users.filter((u) => isSuperAdmin(u)).length;

      return {
        total_users: total,
        active_users: active,
        suspended_users: suspended,
        new_users_month: newThisMonth,
        total_admins: admins,
        total_super_admins: superAdmins,
      };
    }
    return request("/api/super-admin/metrics");
  },

  async listUsers(filters = {}) {
    if (isLocalAuthMode) {
      const currentUser = requireLocalUser();
      if (!isSuperAdmin(currentUser) && currentUser.role !== "admin") {
        throw createError("Acesso negado. Requer privilégios administrativos.", 403);
      }

      const allProjects = readLocalProjects();
      let users = readLocalUsers()
        .filter((u) => !u.is_deleted)
        .map((u) => ({
          ...publicUser(u),
          status: u.status || "active",
          is_super_admin: isSuperAdmin(u),
          role_label: DEFAULT_ROLES.find((r) => r.id === u.role)?.name || u.role || "Usuário",
          projects_count: allProjects.filter((p) => p.user_id === u.id).length,
        }));

      if (filters.search) {
        const q = String(filters.search).toLowerCase().trim();
        users = users.filter(
          (u) =>
            u.full_name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.role?.toLowerCase().includes(q)
        );
      }

      if (filters.role && filters.role !== "todos") {
        users = users.filter((u) => u.role === filters.role);
      }

      if (filters.status && filters.status !== "todos") {
        users = users.filter((u) => u.status === filters.status);
      }

      return sortLocalItems(users, filters.sortBy || "-created_date", filters.limit);
    }
    return request("/api/super-admin/users", { query: filters });
  },

  async getUser(id) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const users = readLocalUsers();
      const user = users.find((u) => u.id === id && !u.is_deleted);
      if (!user) throw createError("Usuário não encontrado.", 404);
      const allProjects = readLocalProjects();
      return {
        ...publicUser(user),
        status: user.status || "active",
        is_super_admin: isSuperAdmin(user),
        projects_count: allProjects.filter((p) => p.user_id === user.id).length,
      };
    }
    return request(`/api/super-admin/users/${id}`);
  },

  async createUser(data) {
    if (isLocalAuthMode) {
      const currentAdmin = requireLocalUser();
      if (!isSuperAdmin(currentAdmin) && currentAdmin.role !== "admin") {
        throw createError("Acesso restrito a administradores.", 403);
      }

      if ((data.role === "super_admin" || data.role === "admin") && !isSuperAdmin(currentAdmin)) {
        throw createError("Apenas Super Administradores podem criar administradores.", 403);
      }

      const normalizedEmail = normalizeEmail(data.email);
      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        throw createError("Informe um e-mail válido.", 400);
      }

      const users = readLocalUsers();
      if (users.some((u) => !u.is_deleted && u.email === normalizedEmail)) {
        throw createError("Este e-mail já está cadastrado no sistema.", 409);
      }

      const timestamp = nowIso();
      const initialPassword = data.password || Math.random().toString(36).slice(2, 10);
      const newUser = {
        id: randomId("user"),
        email: normalizedEmail,
        password: initialPassword,
        full_name: String(data.full_name || "").trim() || normalizedEmail.split("@")[0],
        profession: data.profession || "projetista",
        profissao: data.profession || "projetista",
        role: data.role || "user",
        is_super_admin: data.role === "super_admin",
        status: data.status || "active",
        plan: data.plan || "profissional",
        custom_permissions: data.custom_permissions || null,
        created_date: timestamp,
        updated_date: timestamp,
        last_access: null,
      };

      writeLocalUsers([...users, newUser]);

      recordAuditEvent({
        actor: currentAdmin,
        action: "USER_CREATED",
        targetType: "user",
        targetId: newUser.id,
        targetName: newUser.full_name,
        details: `Usuário ${newUser.email} cadastrado com perfil ${newUser.role}`,
        metadata: { role: newUser.role, status: newUser.status },
      });

      return {
        user: publicUser(newUser),
        temporary_password: initialPassword,
      };
    }
    return request("/api/super-admin/users", { method: "POST", body: data });
  },

  async updateUser(id, updates) {
    if (isLocalAuthMode) {
      const currentAdmin = requireLocalUser();
      if (!isSuperAdmin(currentAdmin) && currentAdmin.role !== "admin") {
        throw createError("Acesso restrito a administradores.", 403);
      }

      const users = readLocalUsers();
      const targetIndex = users.findIndex((u) => u.id === id);
      if (targetIndex < 0) {
        throw createError("Usuário não encontrado.", 404);
      }

      const targetUser = users[targetIndex];

      // Bloqueio de escalada indevida de privilégios
      if ((updates.role === "super_admin" || updates.role === "admin") && !isSuperAdmin(currentAdmin)) {
        throw createError("Apenas Super Administradores podem promover usuários a Administrador ou Super Admin.", 403);
      }

      // Proteção rigorosa do ÚLTIMO Super Admin ativo
      const activeSuperAdmins = users.filter(
        (u) => !u.is_deleted && isSuperAdmin(u) && (u.status || "active") === "active"
      );
      if (isSuperAdmin(targetUser) && activeSuperAdmins.length <= 1) {
        if (updates.role && updates.role !== "super_admin") {
          throw createError("Operação bloqueada: não é permitido rebaixar o nível do único Super Administrador ativo.", 400);
        }
        if (updates.status === "suspended") {
          throw createError("Operação bloqueada: não é permitido suspender o único Super Administrador ativo.", 400);
        }
      }

      const timestamp = nowIso();
      const updatedUser = {
        ...targetUser,
        ...updates,
        is_super_admin: updates.role ? updates.role === "super_admin" : targetUser.is_super_admin,
        updated_date: timestamp,
      };

      const nextUsers = [...users];
      nextUsers[targetIndex] = updatedUser;
      writeLocalUsers(nextUsers);

      recordAuditEvent({
        actor: currentAdmin,
        action: updates.role && updates.role !== targetUser.role ? "USER_ROLE_CHANGED" : "USER_UPDATED",
        targetType: "user",
        targetId: targetUser.id,
        targetName: targetUser.full_name || targetUser.email,
        details: `Atualizou dados do usuário ${targetUser.email}`,
        metadata: { updates },
      });

      return publicUser(updatedUser);
    }
    return request(`/api/super-admin/users/${id}`, { method: "PATCH", body: updates });
  },

  async toggleStatus(id, newStatus) {
    if (isLocalAuthMode) {
      const currentAdmin = requireLocalUser();
      const users = readLocalUsers();
      const target = users.find((u) => u.id === id);
      if (!target) throw createError("Usuário não encontrado.", 404);

      if (newStatus === "suspended" && isSuperAdmin(target)) {
        const activeSuperAdmins = users.filter(
          (u) => !u.is_deleted && isSuperAdmin(u) && (u.status || "active") === "active"
        );
        if (activeSuperAdmins.length <= 1) {
          throw createError("Não é permitido suspender o único Super Administrador ativo.", 400);
        }
      }

      return this.updateUser(id, { status: newStatus });
    }
    return request(`/api/super-admin/users/${id}/status`, { method: "PATCH", body: { status: newStatus } });
  },

  async deleteUser(id) {
    if (isLocalAuthMode) {
      const currentAdmin = requireLocalUser();
      const users = readLocalUsers();
      const target = users.find((u) => u.id === id);
      if (!target) throw createError("Usuário não encontrado.", 404);

      if (isSuperAdmin(target)) {
        const activeSuperAdmins = users.filter((u) => !u.is_deleted && isSuperAdmin(u));
        if (activeSuperAdmins.length <= 1) {
          throw createError("Operação bloqueada: não é permitido excluir o único Super Administrador.", 400);
        }
      }

      const timestamp = nowIso();
      const updatedUser = {
        ...target,
        is_deleted: true,
        status: "suspended",
        deleted_at: timestamp,
        updated_date: timestamp,
      };

      const nextUsers = users.map((u) => (u.id === id ? updatedUser : u));
      writeLocalUsers(nextUsers);

      recordAuditEvent({
        actor: currentAdmin,
        action: "USER_DELETED",
        targetType: "user",
        targetId: target.id,
        targetName: target.full_name || target.email,
        details: `Exclusão lógica da conta ${target.email} realizada`,
      });

      return { ok: true };
    }
    return request(`/api/super-admin/users/${id}`, { method: "DELETE" });
  },

  async sendPasswordReset(id) {
    if (isLocalAuthMode) {
      const currentAdmin = requireLocalUser();
      const users = readLocalUsers();
      const target = users.find((u) => u.id === id);
      if (!target) throw createError("Usuário não encontrado.", 404);

      const token = randomId(`reset_${target.id}`);
      writeLocalResetTokens({
        ...readLocalResetTokens(),
        [token]: { userId: target.id, createdAt: nowIso() },
      });

      const recoveryLink = typeof window !== "undefined"
        ? `${window.location.origin}/reset-password?token=${encodeURIComponent(token)}`
        : `/reset-password?token=${encodeURIComponent(token)}`;

      recordAuditEvent({
        actor: currentAdmin,
        action: "PASSWORD_RESET_SENT",
        targetType: "user",
        targetId: target.id,
        targetName: target.full_name || target.email,
        details: `Link de redefinição de senha gerado para ${target.email}`,
      });

      return { ok: true, recoveryLink };
    }
    return request(`/api/super-admin/users/${id}/reset-password`, { method: "POST" });
  },

  async listAuditLogs(filters = {}) {
    if (isLocalAuthMode) {
      requireLocalUser();
      const logs = readAuditLogs();
      return filterAuditLogs(logs, filters);
    }
    return request("/api/super-admin/audit-logs", { query: filters });
  },

  async getSettings() {
    if (isLocalAuthMode) {
      const defaultSettings = {
        require_mfa_super_admin: false,
        session_timeout_minutes: 60,
        max_login_attempts: 5,
        allow_user_registration: true,
        maintenance_mode: false,
        system_version: "1.4.0",
      };
      return readLocal("voltai_superadmin_settings", defaultSettings);
    }
    return request("/api/super-admin/settings");
  },

  async updateSettings(newSettings) {
    if (isLocalAuthMode) {
      const currentAdmin = requireLocalUser();
      if (!isSuperAdmin(currentAdmin)) {
        throw createError("Apenas Super Administradores podem alterar configurações globais.", 403);
      }
      writeLocal("voltai_superadmin_settings", newSettings);
      recordAuditEvent({
        actor: currentAdmin,
        action: "SETTINGS_UPDATED",
        targetType: "settings",
        details: "Configurações administrativas atualizadas",
        metadata: newSettings,
      });
      return newSettings;
    }
    return request("/api/super-admin/settings", { method: "PUT", body: newSettings });
  },
};

const subscriptionEntity = {
  async cancel({ reason } = {}) {
    if (isLocalAuthMode) {
      const user = requireLocalUser();
      const updated = await auth.updateMe({
        plan: "free",
        subscription_status: "cancelled",
        subscription_cancelled_at: nowIso(),
        subscription_cancel_reason: reason || "Cancelamento solicitado pelo usuário",
      });
      recordAuditEvent({
        actor: user,
        action: "SUBSCRIPTION_CANCELLED",
        targetType: "subscription",
        details: `Assinatura cancelada. Motivo: ${reason || "Não informado"}`,
      });
      return updated;
    }
    return request("/api/subscriptions/cancel", { method: "POST", body: { reason } });
  },

  async getStatus() {
    if (isLocalAuthMode) {
      const user = requireLocalUser();
      return {
        plan: user.plan || "free",
        status: user.subscription_status || "active",
        validUntil: user.subscription_valid_until || null,
      };
    }
    return request("/api/subscriptions/status");
  },
};

export const backend = {
  auth,
  subscriptions: subscriptionEntity,
  entities: {
    Project: projectEntity,
    User: userEntity,
    SuperAdmin: superAdminEntity,
    Notification: notificationEntity,
    Issue: issueEntity,
    Settings: settingsEntity,
    Catalog: catalogEntity,
    Analysis: analysisEntity,
  },
  integrations,
};

