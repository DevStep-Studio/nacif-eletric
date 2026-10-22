/**
 * Sistema de Controle de Acesso Baseado em Papéis (RBAC) e Permissões Granulares
 * Nacif Electric — Super Admin Engine
 */

export const SYSTEM_MODULES = [
  { id: "dashboard", name: "Dashboard", desc: "Visão geral, indicadores e métricas elétricas" },
  { id: "projects", name: "Projetos", desc: "Criação, listagem e gestão de projetos elétricos" },
  { id: "planta_ia", name: "Planta Elétrica", desc: "Editor de planta baixa, circuitos e scanner IA" },
  { id: "panel_generator", name: "Quadro Elétrico", desc: "Montagem de quadros DIN, disjuntores e cabeamento" },
  { id: "solar_project", name: "Projeto Solar", desc: "Dimensionamento fotovoltaico, módulos e inversores" },
  { id: "unifilar", name: "Diagrama Unifilar", desc: "Geração e exportação do diagrama unifilar NBR 5410" },
  { id: "calculator", name: "Calculadora", desc: "Queda de tensão, eletrodutos e dimensionamento" },
  { id: "ai_assistant", name: "Assistente IA", desc: "Consultas técnicas e inteligência artificial" },
  { id: "nbr_library", name: "Biblioteca NBR", desc: "Normas NBR 5410, NBR 5419, NBR 14039 e NBR 16690" },
  { id: "budget", name: "Orçamento & Materiais", desc: "Lista de materiais (BOM) e composição orçamentária" },
  { id: "issues", name: "Avisos e Erros", desc: "Central de suporte, tickets e reporte de falhas" },
  { id: "user_management", name: "Gerenciamento de Usuários", desc: "Controle de contas, acessos e bloqueios" },
  { id: "system_settings", name: "Configurações Administrativas", desc: "Configurações gerais, auditoria e segurança" },
];

export const ACTIONS = [
  { id: "view", label: "Visualizar" },
  { id: "create", label: "Criar" },
  { id: "edit", label: "Editar" },
  { id: "delete", label: "Excluir" },
  { id: "admin", label: "Administrar" },
];

/**
 * Perfis Padrão do Sistema
 */
export const DEFAULT_ROLES = [
  {
    id: "super_admin",
    name: "Super Administrador",
    level: 1,
    desc: "Acesso total irrestrito a todos os módulos, configurações, usuários e auditoria.",
    is_system: true,
    badge_color: "bg-purple-50 text-purple-700 border-purple-200",
    permissions: SYSTEM_MODULES.reduce((acc, mod) => {
      acc[mod.id] = { view: true, create: true, edit: true, delete: true, admin: true };
      return acc;
    }, {}),
  },
  {
    id: "admin",
    name: "Administrador",
    level: 2,
    desc: "Gerenciamento de projetos, relatórios autorizados e suporte técnico aos usuários.",
    is_system: true,
    badge_color: "bg-blue-50 text-blue-700 border-blue-200",
    permissions: SYSTEM_MODULES.reduce((acc, mod) => {
      const isSensitive = mod.id === "system_settings";
      acc[mod.id] = {
        view: true,
        create: !isSensitive,
        edit: !isSensitive,
        delete: false,
        admin: mod.id === "issues" || mod.id === "projects",
      };
      return acc;
    }, {}),
  },
  {
    id: "user",
    name: "Usuário Padrão",
    level: 3,
    desc: "Acesso operacional às ferramentas de cálculo, projetos e diagramas elétricos.",
    is_system: true,
    badge_color: "bg-slate-100 text-slate-700 border-slate-200",
    permissions: SYSTEM_MODULES.reduce((acc, mod) => {
      const canAccess = ![
        "user_management",
        "system_settings",
      ].includes(mod.id);
      acc[mod.id] = {
        view: canAccess,
        create: canAccess && mod.id !== "nbr_library",
        edit: canAccess && mod.id !== "nbr_library",
        delete: canAccess && mod.id === "projects",
        admin: false,
      };
      return acc;
    }, {}),
  },
  {
    id: "engenheiro",
    name: "Engenheiro Eletricista",
    level: 3,
    desc: "Acesso completo de elaboração técnica aos projetos e memórias de cálculo.",
    is_system: false,
    badge_color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    permissions: SYSTEM_MODULES.reduce((acc, mod) => {
      const canAccess = !["user_management", "system_settings"].includes(mod.id);
      acc[mod.id] = {
        view: canAccess,
        create: canAccess,
        edit: canAccess,
        delete: mod.id === "projects",
        admin: false,
      };
      return acc;
    }, {}),
  },
  {
    id: "visualizador",
    name: "Visualizador",
    level: 4,
    desc: "Apenas leitura e consulta aos projetos, relatórios e diagramas liberados.",
    is_system: false,
    badge_color: "bg-gray-100 text-gray-600 border-gray-200",
    permissions: SYSTEM_MODULES.reduce((acc, mod) => {
      const canView = !["user_management", "system_settings"].includes(mod.id);
      acc[mod.id] = {
        view: canView,
        create: false,
        edit: false,
        delete: false,
        admin: false,
      };
      return acc;
    }, {}),
  },
];

export const SUPER_ADMIN_EMAILS = [
  "admin@nacif.com",
  "grc22.09@hotmail.com",
  "ian.mellofla@gmail.com",
  "wellingtonalfredo550@gmail.com",
  "comercial@nacifsolutions.com.br",
  "gabrielderezende13@gmail.com",
];

/**
 * Verifica se um usuário possui o nível Super Admin
 */
export function isSuperAdmin(user) {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  if (user.is_super_admin === true) return true;
  const email = String(user.email || "").toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    return true;
  }
  // Compatibilidade inicial com o administrador raiz padrão
  if (user.role === "admin" && (email === "admin@nacif.com" || user.id === "local_admin_default")) {
    return true;
  }
  return false;
}

/**
 * Retorna o nível numérico do papel do usuário (1 = Super Admin, 2 = Admin, 3 = Usuário)
 */
export function getRoleLevel(roleId) {
  const found = DEFAULT_ROLES.find((r) => r.id === roleId);
  return found ? found.level : 3;
}

/**
 * Validação de permissão granular: módulo + ação
 */
export function hasPermission(user, moduleId, action = "view") {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  // Se o usuário possui permissões customizadas salvas
  if (user.custom_permissions && user.custom_permissions[moduleId]) {
    return Boolean(user.custom_permissions[moduleId][action]);
  }

  // Verifica pelo papel base do usuário
  const roleId = user.role || "user";
  const roleObj = DEFAULT_ROLES.find((r) => r.id === roleId);
  if (roleObj && roleObj.permissions && roleObj.permissions[moduleId]) {
    return Boolean(roleObj.permissions[moduleId][action]);
  }

  // Fallback padrão para visualização básica
  if (action === "view" && !["user_management", "system_settings"].includes(moduleId)) {
    return true;
  }

  return false;
}

/**
 * Valida se um operador pode gerenciar um determinado usuário alvo
 */
export function canOperatorManageTarget(operatorUser, targetUser) {
  if (!operatorUser) return false;
  if (isSuperAdmin(operatorUser)) {
    return true; // Super admin pode gerenciar qualquer um
  }

  if (operatorUser.role === "admin") {
    // Admin não pode gerenciar Super Admin nem outro Admin
    if (isSuperAdmin(targetUser) || targetUser.role === "admin") {
      return false;
    }
    return true;
  }

  return false;
}
