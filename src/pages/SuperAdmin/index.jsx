import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit,
  Filter,
  KeyRound,
  Lock,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "@/lib/professionalAccess";
import { backend } from "@/api/backendClient";
import { SYSTEM_MODULES, ACTIONS, DEFAULT_ROLES } from "@/lib/rbac";
import { AUDIT_LOGS_EVENT } from "@/lib/auditLogger";

import CreateUserModal from "./modals/CreateUserModal";
import EditUserModal from "./modals/EditUserModal";
import ResetPasswordModal from "./modals/ResetPasswordModal";
import RoleModal from "./modals/RoleModal";

const STATUS_BADGES = {
  active: { label: "Ativo", className: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  suspended: { label: "Bloqueado", className: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  pending: { label: "Pendente", className: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
};

export default function SuperAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Abas: "dashboard" | "users" | "roles" | "audit" | "settings"
  const [activeTab, setActiveTab] = useState("dashboard");

  // Dados
  const [metrics, setMetrics] = useState({
    total_users: 0,
    active_users: 0,
    suspended_users: 0,
    new_users_month: 0,
    total_admins: 0,
    total_super_admins: 0,
  });
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [settings, setSettings] = useState({
    require_mfa_super_admin: false,
    session_timeout_minutes: 60,
    max_login_attempts: 5,
    allow_user_registration: true,
    maintenance_mode: false,
    system_version: "1.4.0",
  });
  const [loading, setLoading] = useState(true);

  // Filtros de Usuários
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const USERS_PER_PAGE = 10;

  // Filtros de Auditoria
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("todos");

  // Modais de Ação
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  // Diálogo de Confirmação Crítica (Bloquear / Excluir)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    actionType: null, // "suspend" | "delete"
    targetUser: null,
  });

  // Notificação / Feedback de Ação
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: "", message: "" }), 4000);
  };

  // Carrega todos os dados do painel
  const loadData = async () => {
    setLoading(true);
    try {
      const [m, uList, logs, sysSettings] = await Promise.all([
        backend.entities.SuperAdmin.getMetrics(),
        backend.entities.SuperAdmin.listUsers({ sortBy: sortOrder === "desc" ? "-created_date" : "created_date" }),
        backend.entities.SuperAdmin.listAuditLogs({ limit: 150 }),
        backend.entities.SuperAdmin.getSettings(),
      ]);

      setMetrics(m);
      setUsers(Array.isArray(uList) ? uList : []);
      setAuditLogs(Array.isArray(logs) ? logs : []);
      if (sysSettings) setSettings(sysSettings);
    } catch (err) {
      console.error("Erro ao carregar dados do Super Admin:", err);
      showFeedback("error", err.message || "Erro ao carregar dados administrativos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sortOrder]);

  // Listener para eventos de auditoria em tempo real
  useEffect(() => {
    const handleAudit = () => {
      backend.entities.SuperAdmin.listAuditLogs({ limit: 150 }).then((logs) => {
        if (Array.isArray(logs)) setAuditLogs(logs);
      }).catch(() => {});
    };
    window.addEventListener(AUDIT_LOGS_EVENT, handleAudit);
    return () => window.removeEventListener(AUDIT_LOGS_EVENT, handleAudit);
  }, []);

  // Filtragem e Paginação de Usuários
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase().trim();
        const matchesName = u.full_name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      if (roleFilter !== "todos" && u.role !== roleFilter) return false;
      if (statusFilter !== "todos" && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, userSearch, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, page]);

  // Filtragem de Auditoria
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditActionFilter !== "todos" && log.action !== auditActionFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase().trim();
        const matchesActor = log.actor_name?.toLowerCase().includes(q) || log.actor_email?.toLowerCase().includes(q);
        const matchesTarget = log.target_name?.toLowerCase().includes(q);
        const matchesDetails = log.details?.toLowerCase().includes(q);
        if (!matchesActor && !matchesTarget && !matchesDetails) return false;
      }
      return true;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  // Ações de Usuário
  const handleToggleSuspend = (targetUser) => {
    const isSuspending = targetUser.status !== "suspended";
    setConfirmDialog({
      open: true,
      title: isSuspending ? "Bloquear Acesso do Usuário" : "Desbloquear Acesso do Usuário",
      description: isSuspending
        ? `Tem certeza que deseja suspender o acesso de ${targetUser.full_name}? O usuário não conseguirá mais entrar na plataforma, mas seus projetos e dados permanecerão preservados.`
        : `Deseja reativar o acesso de ${targetUser.full_name}? O usuário voltará a ter acesso normal ao sistema.`,
      actionType: "suspend",
      targetUser: { ...targetUser, nextStatus: isSuspending ? "suspended" : "active" },
    });
  };

  const handleDeleteUser = (targetUser) => {
    setConfirmDialog({
      open: true,
      title: "Excluir Usuário do Sistema",
      description: `Confirma a exclusão de ${targetUser.full_name} (${targetUser.email})? Esta operação realizará uma exclusão lógica, desativando a conta em conformidade com as diretrizes de LGPD e preservando a integridade dos projetos criados.`,
      actionType: "delete",
      targetUser,
    });
  };

  const handleExecuteCriticalAction = async () => {
    const { actionType, targetUser } = confirmDialog;
    if (!targetUser) return;

    try {
      if (actionType === "suspend") {
        await backend.entities.SuperAdmin.toggleStatus(targetUser.id, targetUser.nextStatus);
        showFeedback(
          "success",
          targetUser.nextStatus === "suspended" ? "Usuário suspenso com sucesso!" : "Usuário ativado com sucesso!"
        );
      } else if (actionType === "delete") {
        await backend.entities.SuperAdmin.deleteUser(targetUser.id);
        showFeedback("success", "Usuário desativado com sucesso!");
      }
      loadData();
    } catch (err) {
      console.error("Erro na operação:", err);
      showFeedback("error", err.message || "Falha na operação.");
    } finally {
      setConfirmDialog({ open: false, title: "", description: "", actionType: null, targetUser: null });
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await backend.entities.SuperAdmin.updateSettings(settings);
      showFeedback("success", "Configurações administrativas salvas com sucesso!");
    } catch (err) {
      showFeedback("error", err.message || "Erro ao salvar configurações.");
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans">
      {/* Barra de Topo do Super Admin */}
      <div className="border-b border-[#0F172A] bg-[#0F172A] text-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs gap-1.5"
            >
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao App
              </Link>
            </Button>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#00d8b8]" />
              <span className="font-extrabold text-sm tracking-tight text-white">
                PAINEL SUPER ADMINISTRADOR
              </span>
              <span className="rounded-full bg-[#00d8b8]/20 text-[#00d8b8] border border-[#00d8b8]/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                Nível 1 • Autoridade Máxima
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Operador: <strong className="text-white">{user?.full_name || user?.email}</strong></span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={`rounded-xl p-3 text-xs font-bold border flex items-center gap-2 transition-all ${
              feedback.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            {feedback.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Abas de Navegação */}
        <div className="flex flex-wrap border-b border-[#E2E8F0] gap-2 sm:gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`pb-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "dashboard"
                ? "border-[#00d8b8] text-[#0F172A]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Activity className="h-4 w-4 text-[#00d8b8]" />
            Dashboard Geral
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "users"
                ? "border-[#00d8b8] text-[#0F172A]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Users className="h-4 w-4 text-[#00d8b8]" />
            Gerenciamento de Usuários
            <span className="rounded-md bg-[#E8FCF8] text-[#009b84] px-1.5 py-0.5 text-[10px] font-black">
              {metrics.total_users}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`pb-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "roles"
                ? "border-[#00d8b8] text-[#0F172A]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Shield className="h-4 w-4 text-[#00d8b8]" />
            Níveis & Matriz de Permissões
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`pb-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "audit"
                ? "border-[#00d8b8] text-[#0F172A]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Clock className="h-4 w-4 text-[#00d8b8]" />
            Histórico & Auditoria
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`pb-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "settings"
                ? "border-[#00d8b8] text-[#0F172A]"
                : "border-transparent text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            <Lock className="h-4 w-4 text-[#00d8b8]" />
            Configurações Administrativas
          </button>
        </div>

        {/* ── ABA 1: DASHBOARD GERAL ────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Cards Indicadores */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
                <p className="text-[11px] font-bold text-[#64748B]">Total de Usuários</p>
                <p className="text-2xl font-black text-[#0F172A]">{metrics.total_users}</p>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
                <p className="text-[11px] font-bold text-emerald-600">Usuários Ativos</p>
                <p className="text-2xl font-black text-emerald-700">{metrics.active_users}</p>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
                <p className="text-[11px] font-bold text-rose-600">Usuários Bloqueados</p>
                <p className="text-2xl font-black text-rose-700">{metrics.suspended_users}</p>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
                <p className="text-[11px] font-bold text-sky-600">Novos no Mês</p>
                <p className="text-2xl font-black text-sky-700">{metrics.new_users_month}</p>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
                <p className="text-[11px] font-bold text-blue-600">Administradores</p>
                <p className="text-2xl font-black text-blue-700">{metrics.total_admins}</p>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
                <p className="text-[11px] font-bold text-purple-600">Super Admins</p>
                <p className="text-2xl font-black text-purple-700">{metrics.total_super_admins}</p>
              </div>
            </div>

            {/* Painéis Duplos: Últimos Usuários & Auditoria Recente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Últimos Usuários */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-[#00d8b8]" />
                    Últimos Usuários Cadastrados
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("users")}
                    className="h-7 text-xs font-bold text-[#009b84]"
                  >
                    Ver Todos
                  </Button>
                </div>

                <div className="divide-y divide-[#F1F5F9]">
                  {users.slice(0, 5).map((u) => (
                    <div key={u.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-[#0F172A] truncate">{u.full_name}</p>
                        <p className="text-[11px] text-[#64748B] truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="capitalize text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {u.role}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            STATUS_BADGES[u.status]?.className || STATUS_BADGES.active.className
                          }`}
                        >
                          {STATUS_BADGES[u.status]?.label || "Ativo"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Atividades Recentes */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#00d8b8]" />
                    Atividades Administrativas Recentes
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("audit")}
                    className="h-7 text-xs font-bold text-[#009b84]"
                  >
                    Ver Logs
                  </Button>
                </div>

                <div className="divide-y divide-[#F1F5F9] max-h-80 overflow-y-auto pr-1">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="py-2.5 text-xs space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-[#0F172A]">{log.actor_name}</span>
                        <span className="text-[#94A3B8]">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-[11px] text-[#475467]">{log.details}</p>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="text-xs text-[#94A3B8] italic py-4 text-center">
                      Nenhum registro de auditoria gravado ainda.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 2: GERENCIAMENTO DE USUÁRIOS ──────────────────────────── */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Barra de Busca e Ações */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                    <Input
                      type="text"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Buscar por nome ou e-mail..."
                      className="h-9 pl-9 rounded-xl text-xs border-[#CBD5E1]"
                    />
                  </div>

                  <select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A]"
                  >
                    <option value="todos">Todos os Níveis</option>
                    {DEFAULT_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A]"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="active">Apenas Ativos</option>
                    <option value="suspended">Apenas Bloqueados</option>
                    <option value="pending">Apenas Pendentes</option>
                  </select>
                </div>

                <Button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-black text-xs px-4 shadow-sm gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  Novo Usuário
                </Button>
              </div>

              <div className="flex justify-between items-center text-[11px] text-[#64748B]">
                <span>
                  Exibindo <strong>{paginatedUsers.length}</strong> de{" "}
                  <strong>{filteredUsers.length}</strong> usuário(s) encontrados
                </span>
                <button
                  type="button"
                  onClick={() => setSortOrder((p) => (p === "desc" ? "asc" : "desc"))}
                  className="flex items-center gap-1 font-bold text-[#0F172A] hover:text-[#009b84]"
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {sortOrder === "desc" ? "Mais recentes primeiro" : "Mais antigos primeiro"}
                </button>
              </div>
            </div>

            {/* Tabela de Usuários */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold">
                      <th className="p-3.5">Nome Completo</th>
                      <th className="p-3.5">E-mail</th>
                      <th className="p-3.5">Nível de Acesso</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Cadastro</th>
                      <th className="p-3.5">Último Acesso</th>
                      <th className="p-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {paginatedUsers.map((u) => {
                      const statusCfg = STATUS_BADGES[u.status] || STATUS_BADGES.active;
                      const roleObj = DEFAULT_ROLES.find((r) => r.id === u.role);
                      const isSuper = isSuperAdmin(u);

                      return (
                        <tr key={u.id} className="hover:bg-[#F8FAFC]/70 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0F172A] text-white font-bold text-xs uppercase">
                                {(u.full_name || u.email || "U").slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-extrabold text-[#0F172A]">{u.full_name}</p>
                                <p className="text-[10px] text-[#94A3B8]">{u.profession || u.profissao || "Projetista"}</p>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5 font-mono text-[11px] text-[#475467]">{u.email}</td>

                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                roleObj?.badge_color || "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {isSuper ? <ShieldAlert className="h-3 w-3 text-purple-600" /> : <Shield className="h-3 w-3 text-blue-600" />}
                              {roleObj?.name || u.role}
                            </span>
                          </td>

                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.className}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                              {statusCfg.label}
                            </span>
                          </td>

                          <td className="p-3.5 text-[#64748B] text-[11px]">{formatDate(u.created_date)}</td>
                          <td className="p-3.5 text-[#64748B] text-[11px]">{formatDate(u.last_access)}</td>

                          <td className="p-3.5 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100">
                                  <MoreVertical className="h-4 w-4 text-[#64748B]" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl border-[#E2E8F0] shadow-xl text-xs">
                                <DropdownMenuLabel className="text-[10px] font-bold text-[#94A3B8] uppercase">
                                  Gerenciar Conta
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setEditModalOpen(true);
                                  }}
                                  className="cursor-pointer gap-2 font-medium"
                                >
                                  <Edit className="h-3.5 w-3.5 text-blue-600" />
                                  Editar Cadastro
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setResetModalOpen(true);
                                  }}
                                  className="cursor-pointer gap-2 font-medium"
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                                  Redefinir Acesso
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() => handleToggleSuspend(u)}
                                  className={`cursor-pointer gap-2 font-medium ${
                                    u.status === "suspended" ? "text-emerald-700" : "text-amber-700"
                                  }`}
                                >
                                  {u.status === "suspended" ? (
                                    <>
                                      <Unlock className="h-3.5 w-3.5 text-emerald-600" />
                                      Desbloquear Usuário
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="h-3.5 w-3.5 text-amber-600" />
                                      Bloquear / Suspender
                                    </>
                                  )}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleDeleteUser(u)}
                                  className="cursor-pointer gap-2 font-medium text-rose-600 focus:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Excluir Conta
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}

                    {paginatedUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs text-[#94A3B8]">
                          Nenhum usuário encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#F1F5F9] px-4 py-3 text-xs">
                  <span className="text-[#64748B]">
                    Página <strong>{page}</strong> de <strong>{totalPages}</strong>
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-8 rounded-lg text-xs"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="h-8 rounded-lg text-xs"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ABA 3: NÍVEIS & MATRIZ DE PERMISSÕES ───────────────────────── */}
        {activeTab === "roles" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#0F172A]">
                    Níveis de Acesso e Papéis Cadastrados
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Controle de Acesso Baseado em Papéis (RBAC) com permissões granulares por módulo.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    setSelectedRole(null);
                    setRoleModalOpen(true);
                  }}
                  className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-black text-xs px-4 shadow-sm gap-1.5"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  Criar Novo Nível
                </Button>
              </div>

              {/* Lista de Papéis */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3 relative hover:border-[#00d8b8] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${r.badge_color}`}>
                            Nível {r.level}
                          </span>
                          {r.is_system && (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-200/60 px-1.5 py-0.5 rounded">
                              Sistema
                            </span>
                          )}
                        </div>
                        <h4 className="mt-1 font-bold text-sm text-[#0F172A]">{r.name}</h4>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRole(r);
                          setRoleModalOpen(true);
                        }}
                        className="h-7 text-xs font-bold text-[#009b84]"
                      >
                        Editar
                      </Button>
                    </div>

                    <p className="text-xs text-[#64748B] min-h-[36px]">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Matriz Geral de Referência */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                Módulos do Sistema Monitorados
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SYSTEM_MODULES.map((m) => (
                  <div key={m.id} className="rounded-xl border border-[#E2E8F0] p-3 text-xs bg-white">
                    <p className="font-extrabold text-[#0F172A]">{m.name}</p>
                    <p className="text-[11px] text-[#64748B]">{m.desc}</p>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {ACTIONS.map((a) => (
                        <span key={a.id} className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {a.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 4: HISTÓRICO & AUDITORIA ──────────────────────────────── */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                    <Input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="Buscar por operador, alvo ou detalhe..."
                      className="h-9 pl-9 rounded-xl text-xs border-[#CBD5E1]"
                    />
                  </div>

                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="h-9 rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A]"
                  >
                    <option value="todos">Todas as Ações</option>
                    <option value="USER_CREATED">Criação de Usuário</option>
                    <option value="USER_UPDATED">Edição de Usuário</option>
                    <option value="USER_ROLE_CHANGED">Alteração de Nível</option>
                    <option value="USER_SUSPENDED">Bloqueio de Usuário</option>
                    <option value="USER_ACTIVATED">Desbloqueio de Usuário</option>
                    <option value="USER_DELETED">Exclusão de Conta</option>
                    <option value="PASSWORD_RESET_SENT">Redefinição de Senha</option>
                    <option value="SETTINGS_UPDATED">Alteração de Configurações</option>
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  className="h-9 rounded-xl text-xs font-bold border-[#CBD5E1] gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Atualizar Logs
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold">
                      <th className="p-3.5">Data & Horário</th>
                      <th className="p-3.5">Operador (Ator)</th>
                      <th className="p-3.5">Ação Executada</th>
                      <th className="p-3.5">Recurso Afetado</th>
                      <th className="p-3.5">Detalhes da Operação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8FAFC]/70 transition-colors">
                        <td className="p-3.5 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-[#0F172A]">{log.actor_name}</p>
                          <p className="text-[10px] text-[#94A3B8]">{log.actor_email}</p>
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-[#0F172A]">
                          {log.target_name || log.target_type}
                        </td>
                        <td className="p-3.5 text-[#475467] text-[11px]">{log.details}</td>
                      </tr>
                    ))}

                    {filteredAuditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-xs text-[#94A3B8]">
                          Nenhum registro de auditoria encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 5: CONFIGURAÇÕES ADMINISTRATIVAS ──────────────────────── */}
        {activeTab === "settings" && (
          <div className="max-w-2xl rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Políticas de Segurança e Configurações Globais
              </h3>
              <p className="text-xs text-[#64748B]">
                Ajuste os parâmetros de sessão, limites de login e segurança do Super Admin.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.require_mfa_super_admin}
                    onChange={(e) => setSettings({ ...settings, require_mfa_super_admin: e.target.checked })}
                    className="mt-0.5 rounded border-[#CBD5E1] text-[#00d8b8] focus:ring-[#00d8b8]"
                  />
                  <div>
                    <p className="font-bold text-[#0F172A]">Exigir Autenticação de Múltiplos Fatores (MFA)</p>
                    <p className="text-[11px] text-[#64748B]">
                      Exige verificação de código ou segundo fator para todos os acessos ao nível Super Admin.
                    </p>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#0F172A]">Tempo Limite de Sessão (minutos)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="1440"
                    value={settings.session_timeout_minutes}
                    onChange={(e) => setSettings({ ...settings, session_timeout_minutes: Number(e.target.value) })}
                    className="h-9 rounded-xl text-xs border-[#CBD5E1]"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#0F172A]">Tentativas Máximas de Login</Label>
                  <Input
                    type="number"
                    min="3"
                    max="20"
                    value={settings.max_login_attempts}
                    onChange={(e) => setSettings({ ...settings, max_login_attempts: Number(e.target.value) })}
                    className="h-9 rounded-xl text-xs border-[#CBD5E1]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allow_user_registration}
                    onChange={(e) => setSettings({ ...settings, allow_user_registration: e.target.checked })}
                    className="mt-0.5 rounded border-[#CBD5E1] text-[#00d8b8] focus:ring-[#00d8b8]"
                  />
                  <div>
                    <p className="font-bold text-[#0F172A]">Permitir Auto-Cadastro de Novos Usuários</p>
                    <p className="text-[11px] text-[#64748B]">
                      Habilita o formulário de cadastro público `/register`. Se desmarcado, novos usuários só podem ser cadastrados pelo Super Admin.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-5 shadow-sm"
                >
                  Salvar Configurações
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Modais Administrativos */}
      <CreateUserModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onUserCreated={() => {
          loadData();
          showFeedback("success", "Novo usuário cadastrado com sucesso!");
        }}
      />

      <EditUserModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        user={selectedUser}
        onUserUpdated={() => {
          loadData();
          showFeedback("success", "Cadastro do usuário atualizado!");
        }}
      />

      <ResetPasswordModal
        open={resetModalOpen}
        onOpenChange={setResetModalOpen}
        user={selectedUser}
      />

      <RoleModal
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
        role={selectedRole}
        onRoleSaved={(savedRole) => {
          setRoles((prev) => {
            const exists = prev.some((r) => r.id === savedRole.id);
            return exists ? prev.map((r) => (r.id === savedRole.id ? savedRole : r)) : [...prev, savedRole];
          });
          showFeedback("success", `Nível "${savedRole.name}" salvo com sucesso!`);
        }}
      />

      {/* Confirmação de Ação Crítica (Bloqueio / Exclusão) */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(isOpen) => !isOpen && setConfirmDialog({ ...confirmDialog, open: false })}
      >
        <AlertDialogContent className="max-w-md rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
          <AlertDialogHeader className="text-left space-y-2">
            <AlertDialogTitle className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#64748B] leading-relaxed">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2 gap-2">
            <AlertDialogCancel className="h-9 rounded-xl text-xs font-bold border-[#CBD5E1]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteCriticalAction}
              className={`h-9 rounded-xl text-xs font-extrabold px-4 shadow-sm ${
                confirmDialog.actionType === "delete"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-[#0F172A] hover:bg-[#1E293B] text-white"
              }`}
            >
              Confirmar Operação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
