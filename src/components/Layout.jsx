import { useEffect, useMemo, useState } from "react";
import { Outlet, Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Building2,
  Calculator,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GitBranch,
  Grid2X2,
  HelpCircle,
  Home,
  Info,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelTop,
  Palette,
  PencilLine,
  Plus,
  ScanLine,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCircle,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { hasFullSystemAccess } from "@/lib/professionalAccess";
import { useBranding, useNotifications, formatNotificationTime } from "@/lib/appPreferences";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FEATURE_KEYS,
  buildUsageFromProjects,
  getUsageRows,
  normalizeSubscription,
} from "@/lib/subscriptionPlans";
import { getProjectProgress } from "@/lib/projectProgress";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import ToolsModal from "@/components/navigation/ToolsModal";
import PublicFooter from "@/components/system/PublicFooter";

const SIDEBAR_STORAGE_KEY = "nacif:sidebar-collapsed";

const initialsFromUser = (user) => {
  const source = user?.full_name || user?.email || "Admin";
  const parts = source.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);

  if (parts.length <= 1) return (parts[0] || "AD").slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

function BrandLogo({ branding, compact = false, className = "" }) {
  const logo = compact ? branding.compactLogoDataUrl || branding.logoDataUrl : branding.logoDataUrl;

  if (logo) {
    return (
      <img
        src={logo}
        alt={`${branding.appName} ${branding.appSuffix}`}
        className={`h-full w-full object-contain ${className}`}
      />
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#00bda1] to-[#00d8b8] text-white font-black shadow-[0_2px_8px_rgba(0,216,184,0.35)]">
        <Zap className="h-5 w-5 fill-current" />
      </div>
      {!compact && (
        <div className="flex flex-col text-left">
          <span className="text-base font-black tracking-tight text-[#0F172A] leading-none">Nacif</span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00d8b8] mt-0.5 leading-none">Electric</span>
        </div>
      )}
    </div>
  );
}

function AvatarDisplay({ user, initials, className = "" }) {
  const avatar = user?.avatar_url || user?.profile_photo_url || user?.photo_url;

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={user?.full_name || user?.email || "Perfil"}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return <span className="font-extrabold text-xs text-[#0f4f49]">{initials}</span>;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [activeUser, setActiveUser] = useState(user);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [toolsModalMode, setToolsModalMode] = useState("tools"); // "tools" | "library"
  const [shellProjects, setShellProjects] = useState([]);
  const [loadingShellProjects, setLoadingShellProjects] = useState(false);
  const [currentProject, setCurrentProject] = useState(null);
  const { branding } = useBranding();

  // Identifica se estamos dentro de um contexto de projeto
  const currentProjectId = useMemo(() => {
    if (location.pathname.startsWith("/projects/") && location.pathname !== "/projects/new") {
      const parts = location.pathname.split("/");
      return parts[2] || null;
    }
    const queryParam = searchParams.get("project");
    if (queryParam) return queryParam;
    return null;
  }, [location.pathname, searchParams]);

  useEffect(() => {
    setActiveUser(user);
  }, [user]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // Storage fallback
    }
  }, [sidebarCollapsed]);

  // Carrega a lista de projetos para busca global e contexto
  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      setLoadingShellProjects(true);
      try {
        const data = await backend.entities.Project.list("-updated_date", 50);
        if (!cancelled) setShellProjects(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setShellProjects([]);
      } finally {
        if (!cancelled) setLoadingShellProjects(false);
      }
    };

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, []);

  // Busca dados do projeto ativo quando em contexto de projeto
  useEffect(() => {
    if (!currentProjectId) {
      setCurrentProject(null);
      return;
    }

    const cached = shellProjects.find((p) => p.id === currentProjectId);
    if (cached) {
      setCurrentProject(cached);
    }

    let cancelled = false;
    backend.entities.Project.get(currentProjectId)
      .then((data) => {
        if (!cancelled && data) setCurrentProject(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentProjectId, shellProjects]);

  // Fecha o drawer mobile ao mudar de rota
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname, location.search]);

  // Atalhos de teclado (Ctrl+K)
  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const fullAccess = hasFullSystemAccess(activeUser);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(activeUser);
  const initials = initialsFromUser(activeUser);
  const displayName = activeUser?.full_name || "Gabriel Rezende";
  const displayEmail = activeUser?.email || "gabriel@nacifelectric.com.br";
  const subscription = normalizeSubscription(activeUser);
  const usage = useMemo(() => buildUsageFromProjects(shellProjects), [shellProjects]);
  const usageRows = useMemo(() => getUsageRows(subscription.plan, usage), [subscription.plan, usage]);
  const projectUsage = usageRows.find((row) => row.key === FEATURE_KEYS.PROJECTS);

  const activeProjectProgress = useMemo(
    () => (currentProject ? getProjectProgress(currentProject) : null),
    [currentProject]
  );

  // Controla o onboarding de primeiro acesso
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  useEffect(() => {
    if (activeUser && activeUser.onboarding_completed === false) {
      setOnboardingOpen(true);
    }
  }, [activeUser]);

  // Breadcrumb Title Generation
  const breadcrumbInfo = useMemo(() => {
    if (currentProject) {
      return { section: "Projetos", page: currentProject.name };
    }
    if (location.pathname === "/") return { section: "Pages", page: "Dashboard" };
    if (location.pathname === "/projects") return { section: "Pages", page: "Meus Projetos" };
    if (location.pathname === "/projects/new") return { section: "Projetos", page: "Novo Projeto" };
    if (location.pathname === "/calculator") return { section: "Ferramentas", page: "Calculadora" };
    if (location.pathname === "/ai-assistant") return { section: "Ferramentas", page: "Assistente IA" };
    if (location.pathname === "/nbr-library") return { section: "Biblioteca", page: "Normas NBR" };
    if (location.pathname === "/budget") return { section: "Relatórios", page: "Orçamento & Materiais" };
    if (location.pathname === "/subscription") return { section: "Conta", page: "Assinatura e Uso" };
    if (location.pathname === "/settings") return { section: "Conta", page: "Configurações" };
    return { section: "Pages", page: "Nacif Electric" };
  }, [currentProject, location.pathname]);

  const isItemActive = (path) => {
    if (!path) return false;
    const [pathBase, pathQuery] = path.split("?");
    if (pathQuery) {
      return location.pathname === pathBase && location.search.includes(pathQuery);
    }
    return location.pathname === path && !location.search;
  };

  const isImmersiveStudioRoute = location.pathname === "/planta-ia" || location.pathname === "/panel-generator";
  if (isImmersiveStudioRoute) {
    return (
      <div className="h-screen w-screen min-h-screen overflow-hidden bg-background">
        <Outlet />
      </div>
    );
  }

  const isImmersiveSolarRoute = location.pathname.startsWith("/solar-project");
  if (isImmersiveSolarRoute) {
    return (
      <main className="min-h-screen font-inter bg-[#070c14] text-white">
        <Outlet />
      </main>
    );
  }

  return (
    <div
      className={`min-h-screen overflow-x-hidden bg-[#F8FAFC] font-inter text-[#0F172A] transition-[padding] duration-200 ${
        sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[256px]"
      }`}
    >
      {/* Onboarding de Primeiro Acesso */}
      <OnboardingModal
        user={activeUser}
        open={onboardingOpen}
        onComplete={() => setOnboardingOpen(false)}
      />

      {/* Modal de Ferramentas & Biblioteca */}
      <ToolsModal
        open={toolsModalOpen}
        onOpenChange={setToolsModalOpen}
        mode={toolsModalMode}
      />

      {/* ── SIDEBAR FIXA (Estilo Shopall com Verde do Projeto) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E2E8F0] bg-white transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? "w-[76px]" : "w-[256px]"
        }`}
      >
        {/* Topo da Sidebar: Logo & Collapse Button */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[#F1F5F9]">
          <Link
            to="/"
            className={`flex shrink-0 items-center overflow-hidden transition ${
              sidebarCollapsed ? "h-10 w-10 justify-center" : "h-12 justify-start"
            }`}
          >
            <BrandLogo branding={branding} compact={sidebarCollapsed} />
          </Link>

          <button
            type="button"
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Workspace / Store Selector Pill Card (Exato da referência 'Capstore') */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3.5 pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-left transition hover:border-[#CBD5E1] hover:bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00d8b8] text-white font-black text-xs shadow-sm">
                      {currentProject ? currentProject.name.slice(0, 1).toUpperCase() : "N"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-[#0F172A]">
                        {currentProject ? currentProject.name : "Nacif Studio"}
                      </p>
                      <p className="truncate text-[10px] font-bold text-[#64748B]">
                        {currentProject ? (currentProject.client_name || "Projeto ativo") : "Workspace principal"}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[232px] rounded-xl border-[#E2E8F0] bg-white p-1.5 shadow-xl">
                <DropdownMenuLabel className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#94A3B8]">
                  Projetos Recentes
                </DropdownMenuLabel>
                {shellProjects.slice(0, 5).map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs font-bold hover:bg-[#F8FAFC]"
                  >
                    <span className="truncate">{p.name}</span>
                    {p.id === currentProjectId && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00d8b8]" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate("/projects/new")}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold text-[#00d8b8] hover:bg-[#E8FCF8]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Criar novo projeto</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Lista de Navegação por Grupos */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {/* Grupo 1: General */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                General
              </p>
            )}
            <div className="space-y-0.5">
              <Link
                to="/"
                title={sidebarCollapsed ? "Dashboard" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/")
                    ? "bg-[#0F172A] text-white font-black shadow-sm"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Home className={`h-4 w-4 shrink-0 ${isItemActive("/") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Dashboard</span>}
                </div>
              </Link>

              <Link
                to="/projects"
                title={sidebarCollapsed ? "Meus Projetos" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/projects")
                    ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FolderOpen className={`h-4 w-4 shrink-0 ${isItemActive("/projects") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Projetos</span>}
                </div>
                {!sidebarCollapsed && shellProjects.length > 0 && (
                  <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-black text-[#64748B]">
                    {shellProjects.length}
                  </span>
                )}
              </Link>

              <Link
                to={currentProjectId ? `/planta-ia?project=${currentProjectId}` : "/planta-ia"}
                title={sidebarCollapsed ? "Planta Elétrica" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/planta-ia")
                    ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Compass className={`h-4 w-4 shrink-0 ${isItemActive("/planta-ia") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Planta Elétrica</span>}
                </div>
              </Link>

              <Link
                to={currentProjectId ? `/panel-generator?project=${currentProjectId}` : "/panel-generator"}
                title={sidebarCollapsed ? "Quadro Elétrico" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/panel-generator")
                    ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <LayoutGrid className={`h-4 w-4 shrink-0 ${isItemActive("/panel-generator") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Quadro Elétrico</span>}
                </div>
              </Link>
            </div>
          </div>

          {/* Grupo 2: Tools */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                Tools
              </p>
            )}
            <div className="space-y-0.5">
              <Link
                to={currentProjectId ? `/unifilar?project=${currentProjectId}` : "/unifilar"}
                title={sidebarCollapsed ? "Diagrama Unifilar" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/unifilar")
                    ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GitBranch className={`h-4 w-4 shrink-0 ${isItemActive("/unifilar") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Diagrama Unifilar</span>}
                </div>
              </Link>

              <Link
                to="/calculator"
                title={sidebarCollapsed ? "Calculadora" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/calculator")
                    ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Calculator className={`h-4 w-4 shrink-0 ${isItemActive("/calculator") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Calculadora</span>}
                </div>
              </Link>

              <Link
                to="/ai-assistant"
                title={sidebarCollapsed ? "Assistente IA" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/ai-assistant")
                    ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles className={`h-4 w-4 shrink-0 ${isItemActive("/ai-assistant") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Assistente IA</span>}
                </div>
              </Link>

              <Link
                to="/nbr-library"
                title={sidebarCollapsed ? "Biblioteca NBR" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/nbr-library")
                    ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <BookOpen className={`h-4 w-4 shrink-0 ${isItemActive("/nbr-library") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Biblioteca NBR</span>}
                </div>
              </Link>

              <Link
                to={currentProjectId ? `/budget?project=${currentProjectId}` : "/budget"}
                title={sidebarCollapsed ? "Orçamento & Materiais" : undefined}
                className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                  sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                } ${
                  isItemActive("/budget")
                    ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                    : "text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className={`h-4 w-4 shrink-0 ${isItemActive("/budget") ? "text-[#00d8b8]" : "text-[#64748B]"}`} />
                  {!sidebarCollapsed && <span className="truncate">Orçamento</span>}
                </div>
                {!sidebarCollapsed && (
                  <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-black text-[#64748B]">
                    2
                  </span>
                )}
              </Link>
            </div>
          </div>
        </nav>

        {/* Rodapé da Sidebar: Account & Profile Pill (Exato da referência 'Hecham GAZHI') */}
        <div className="border-t border-[#F1F5F9] p-3 space-y-2">
          <div className="space-y-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={sidebarCollapsed ? "Notificações" : undefined}
                  className={`flex h-9 w-full items-center rounded-xl text-xs font-bold transition ${
                    sidebarCollapsed ? "justify-center px-0" : "justify-between px-2.5"
                  } text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative">
                      <Bell className="h-4 w-4 shrink-0 text-[#64748B]" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#00d8b8]" />
                      )}
                    </div>
                    {!sidebarCollapsed && <span className="truncate">Notificações</span>}
                  </div>
                  {!sidebarCollapsed && unreadCount > 0 && (
                    <span className="rounded-md bg-[#E8FCF8] px-1.5 py-0.5 text-[10px] font-black text-[#00d8b8]">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-2xl border-[#E2E8F0] bg-white p-0 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
                  <DropdownMenuLabel className="p-0 text-xs font-black text-[#0F172A]">Notificações</DropdownMenuLabel>
                  <button type="button" onClick={markAllRead} className="text-[11px] font-bold text-[#00d8b8] hover:underline">
                    Marcar todas lidas
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-xs font-medium text-[#64748B]">Nenhuma notificação recente.</p>
                  ) : (
                    notifications.slice(0, 6).map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => markRead(item.id)}
                        className="flex flex-col items-start gap-1 p-2.5 rounded-xl cursor-pointer hover:bg-[#F8FAFC]"
                      >
                        <span className="text-xs font-bold text-[#0F172A]">{item.title}</span>
                        <span className="text-[11px] text-[#64748B] leading-tight line-clamp-2">{item.description}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              to="/settings"
              title={sidebarCollapsed ? "Configurações" : undefined}
              className={`flex h-9 items-center rounded-xl text-xs font-bold transition ${
                sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
              } text-[#475467] hover:bg-[#F1F5F9] hover:text-[#0F172A]`}
            >
              <Settings className="h-4 w-4 shrink-0 text-[#64748B]" />
              {!sidebarCollapsed && <span className="truncate">Configurações</span>}
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              title={sidebarCollapsed ? "Sair" : undefined}
              className={`flex h-9 w-full items-center rounded-xl text-xs font-bold transition ${
                sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
              } text-[#475467] hover:bg-red-50 hover:text-red-600`}
            >
              <LogOut className="h-4 w-4 shrink-0 text-[#64748B]" />
              {!sidebarCollapsed && <span className="truncate">Sair</span>}
            </button>
          </div>

          {/* User Profile Card */}
          <div className="pt-2 border-t border-[#F1F5F9]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex w-full items-center rounded-xl p-1.5 transition hover:bg-[#F1F5F9] ${
                    sidebarCollapsed ? "justify-center" : "justify-between gap-2.5"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#CBD5E1] bg-[#E8FCF8] text-xs font-extrabold text-[#0f4f49]">
                      <AvatarDisplay user={activeUser} initials={initials} className="h-full w-full" />
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-emerald-500" />
                    </span>
                    {!sidebarCollapsed && (
                      <div className="min-w-0 text-left">
                        <p className="truncate text-xs font-black text-[#0F172A]">{displayName}</p>
                        <p className="truncate text-[10px] font-medium text-[#64748B]">{displayEmail}</p>
                      </div>
                    )}
                  </div>
                  {!sidebarCollapsed && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-60 rounded-2xl border-[#E2E8F0] bg-white p-1.5 shadow-2xl">
                <div className="p-2 border-b border-[#F1F5F9]">
                  <p className="text-xs font-black text-[#0F172A] truncate">{displayName}</p>
                  <p className="text-[10px] text-[#64748B] truncate">{displayEmail}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold">
                    <UserCircle className="h-4 w-4" /> Minha conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/subscription" className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold">
                    <CreditCard className="h-4 w-4" /> Plano ({subscription.plan.name})
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-red-600 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* ── HEADER & CONTEÚDO PRINCIPAL ── */}
      <main className="min-h-screen min-w-0 flex flex-col">
        {/* Modal de Busca Global (Ctrl+K) */}
        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <CommandInput
            placeholder="Buscar páginas, projetos e ferramentas..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup heading="Ações rápidas">
              <CommandItem onSelect={() => { setSearchOpen(false); navigate("/projects/new"); }}>
                <Plus className="mr-2 h-4 w-4 text-[#00d8b8]" /> Novo projeto
              </CommandItem>
              <CommandItem onSelect={() => { setSearchOpen(false); navigate("/planta-ia"); }}>
                <Zap className="mr-2 h-4 w-4 text-[#00d8b8]" /> Editor de planta
              </CommandItem>
              <CommandItem onSelect={() => { setSearchOpen(false); setToolsModalMode("tools"); setToolsModalOpen(true); }}>
                <Calculator className="mr-2 h-4 w-4 text-[#00d8b8]" /> Calculadoras de engenharia
              </CommandItem>
              <CommandItem onSelect={() => { setSearchOpen(false); setToolsModalMode("library"); setToolsModalOpen(true); }}>
                <BookOpen className="mr-2 h-4 w-4 text-[#00d8b8]" /> Biblioteca NBR
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Projetos recentes">
              {shellProjects.slice(0, 8).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.client_name}`}
                  onSelect={() => { setSearchOpen(false); navigate(`/projects/${p.id}`); }}
                >
                  <FolderOpen className="mr-2 h-4 w-4 text-[#00d8b8]" />
                  <span>{p.name}</span>
                  <span className="ml-2 text-xs text-[#64748B]">{p.client_name || "Sem cliente"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        {/* ── Topbar (Exato da referência '< > Pages / Dashboard' + Pill Search + Avatar) ── */}
        <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white/80 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
          {/* Lado Esquerdo: Mobile Menu Toggle & Breadcrumbs com '< >' */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#475467] hover:bg-[#F1F5F9] lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Setas de navegação '< >' da referência */}
            <div className="hidden sm:flex items-center gap-1 text-[#94A3B8]">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#F1F5F9] hover:text-[#0F172A] transition"
                title="Voltar página"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#F1F5F9] hover:text-[#0F172A] transition"
                title="Avançar página"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Breadcrumb Path 'Pages / Dashboard' */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-[#94A3B8]">{breadcrumbInfo.section}</span>
              <span className="text-[#CBD5E1]">/</span>
              <h1 className="font-extrabold text-[#0F172A] truncate max-w-[200px] sm:max-w-md text-sm">
                {breadcrumbInfo.page}
              </h1>
            </div>
          </div>

          {/* Lado Direito: Pill Search Bar, Help, Notifications & Avatar */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 text-xs font-medium text-[#94A3B8] hover:border-[#CBD5E1] hover:bg-white w-44 sm:w-64 transition shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
              <span className="flex-1 truncate text-left">Buscar no sistema...</span>
              <span className="hidden sm:inline-block rounded-md border border-[#E2E8F0] bg-white px-1.5 py-0.5 text-[9px] font-extrabold text-[#64748B]">
                Ctrl K
              </span>
            </button>

            {/* Botão de Ajuda / Informações */}
            <button
              type="button"
              onClick={() => { setToolsModalMode("library"); setToolsModalOpen(true); }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition"
              title="Biblioteca de Normas & Ajuda"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* Notificações */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Notificações"
                  className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-[#00d8b8]" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-2xl border-[#E2E8F0] bg-white p-0 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
                  <DropdownMenuLabel className="p-0 text-xs font-black text-[#0F172A]">Notificações</DropdownMenuLabel>
                  <button type="button" onClick={markAllRead} className="text-[11px] font-bold text-[#00d8b8] hover:underline">
                    Ler tudo
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-xs font-medium text-[#64748B]">Nenhuma notificação recente.</p>
                  ) : (
                    notifications.slice(0, 6).map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => markRead(item.id)}
                        className="flex flex-col items-start gap-1 p-2.5 rounded-xl cursor-pointer hover:bg-[#F8FAFC]"
                      >
                        <span className="text-xs font-bold text-[#0F172A]">{item.title}</span>
                        <span className="text-[11px] text-[#64748B] leading-tight line-clamp-2">{item.description}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar no Topbar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center rounded-full p-0.5 hover:ring-2 hover:ring-[#00d8b8]/40 transition">
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#CBD5E1] bg-[#E8FCF8] text-xs font-extrabold text-[#0f4f49]">
                    <AvatarDisplay user={activeUser} initials={initials} className="h-full w-full" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-2xl border-[#E2E8F0] bg-white p-1.5 shadow-2xl">
                <div className="p-2 border-b border-[#F1F5F9]">
                  <p className="text-xs font-black text-[#0F172A] truncate">{displayName}</p>
                  <p className="text-[10px] text-[#64748B] truncate">{displayEmail}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold">
                    <UserCircle className="h-4 w-4" /> Minha conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/subscription" className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold">
                    <CreditCard className="h-4 w-4" /> Assinatura ({subscription.plan.name})
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-red-600 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Drawer Mobile da Sidebar */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in"
              onClick={() => setMobileDrawerOpen(false)}
            />
            <div className="relative flex w-72 max-w-[85vw] flex-col bg-white p-4 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between border-b border-[#EAECF0] pb-3">
                <BrandLogo branding={branding} />
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-4 space-y-4">
                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    General
                  </p>
                  <div className="space-y-0.5">
                    <Link
                      to="/"
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold ${
                        isItemActive("/") ? "bg-[#0F172A] text-white" : "text-[#475467] hover:bg-[#F1F5F9]"
                      }`}
                    >
                      <Home className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      to="/projects"
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold ${
                        isItemActive("/projects") ? "bg-[#E8FCF8] text-[#0f4f49]" : "text-[#475467] hover:bg-[#F1F5F9]"
                      }`}
                    >
                      <FolderOpen className="h-4 w-4" />
                      <span>Projetos</span>
                    </Link>
                    <Link
                      to="/planta-ia"
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold text-[#475467] hover:bg-[#F1F5F9]"
                    >
                      <Compass className="h-4 w-4" />
                      <span>Planta Elétrica</span>
                    </Link>
                    <Link
                      to="/panel-generator"
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold text-[#475467] hover:bg-[#F1F5F9]"
                    >
                      <LayoutGrid className="h-4 w-4" />
                      <span>Quadro Elétrico</span>
                    </Link>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="px-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    Tools
                  </p>
                  <div className="space-y-0.5">
                    <Link
                      to="/unifilar"
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold text-[#475467] hover:bg-[#F1F5F9]"
                    >
                      <GitBranch className="h-4 w-4" />
                      <span>Diagrama Unifilar</span>
                    </Link>
                    <Link
                      to="/calculator"
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold text-[#475467] hover:bg-[#F1F5F9]"
                    >
                      <Calculator className="h-4 w-4" />
                      <span>Calculadora</span>
                    </Link>
                    <Link
                      to="/nbr-library"
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-bold text-[#475467] hover:bg-[#F1F5F9]"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Biblioteca NBR</span>
                    </Link>
                  </div>
                </div>
              </nav>

              <div className="border-t border-[#EAECF0] pt-3">
                <Button asChild variant="outline" className="w-full h-9 text-xs font-bold rounded-xl">
                  <Link to="/subscription">Assinatura ({subscription.plan.name})</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Viewport da Página */}
        <div key={`${location.pathname}${location.search}`} className="app-page-enter flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>

        {/* Public Institutional & Legal Footer */}
        <PublicFooter className="mt-auto" />
      </main>
    </div>
  );
}
