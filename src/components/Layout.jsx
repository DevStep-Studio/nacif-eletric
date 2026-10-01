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
  ChevronRight,
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
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00d8b8] text-slate-950 font-black shadow-sm">
        <Zap className="h-5 w-5 fill-current" />
      </div>
      {!compact && (
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-tight text-[#101828]">NACIF</span>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#00d8b8] -mt-1">ELECTRIC</span>
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

  return initials;
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
  const displayName = activeUser?.full_name || "Admin";
  const displayEmail = activeUser?.email || "admin@nacifsolutions.com.br";
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

  // Rotas Imersivas em tela cheia (Projeto Solar e Planta IA quando em tela cheia)
  const isImmersiveSolarRoute = location.pathname.startsWith("/solar-project");
  if (isImmersiveSolarRoute) {
    return (
      <main className="min-h-screen font-inter bg-[#070c14] text-white">
        <Outlet />
      </main>
    );
  }

  // Definição dos Itens de Navegação Contextuais do Projeto
  const projectNavGroups = [
    {
      label: "VISÃO GERAL",
      items: [
        { path: `/projects/${currentProjectId}`, icon: Home, label: "Visão geral" },
      ],
    },
    {
      label: "PROJETO",
      items: [
        { path: `/planta-ia?project=${currentProjectId}`, icon: Zap, label: "Planta" },
        { path: `/circuit-editor?project=${currentProjectId}`, icon: PencilLine, label: "Circuitos" },
        { path: `/panel-generator?project=${currentProjectId}`, icon: LayoutGrid, label: "Quadro elétrico" },
      ],
    },
    {
      label: "ANÁLISE",
      items: [
        { path: `/phase-balance?project=${currentProjectId}`, icon: Activity, label: "Balanço de fases" },
      ],
    },
    {
      label: "DOCUMENTAÇÃO",
      items: [
        { path: `/unifilar?project=${currentProjectId}`, icon: GitBranch, label: "Diagrama unifilar" },
        { path: `/memorial?project=${currentProjectId}`, icon: BookOpen, label: "Documentos & Memorial" },
        { path: `/materials?project=${currentProjectId}`, icon: BarChart3, label: "Lista de materiais" },
        { path: `/budget?project=${currentProjectId}`, icon: FileText, label: "Orçamento" },
      ],
    },
  ];

  // Definição dos Itens de Navegação Global (Fora do contexto de projeto)
  const globalNavGroups = [
    {
      label: "VISÃO GERAL",
      items: [
        { path: "/", icon: Home, label: "Início", fullAccess: true },
      ],
    },
    {
      label: "PROJETOS",
      items: [
        { path: "/projects", icon: FolderOpen, label: "Meus projetos", fullAccess: true },
        { path: "/projects/new", icon: Plus, label: "Novo projeto", fullAccess: true, isAction: true },
      ],
    },
    {
      label: "RECURSOS",
      items: [
        {
          id: "tools",
          icon: Calculator,
          label: "Ferramentas",
          onClick: () => {
            setToolsModalMode("tools");
            setToolsModalOpen(true);
          },
        },
        {
          id: "library",
          icon: BookOpen,
          label: "Biblioteca",
          onClick: () => {
            setToolsModalMode("library");
            setToolsModalOpen(true);
          },
        },
      ],
    },
  ];

  const currentNavGroups = currentProjectId ? projectNavGroups : globalNavGroups;

  const isItemActive = (path) => {
    if (!path) return false;
    const [pathBase, pathQuery] = path.split("?");
    if (pathQuery) {
      return location.pathname === pathBase && location.search.includes(pathQuery);
    }
    return location.pathname === path && !location.search;
  };

  const routeTitle = useMemo(() => {
    if (currentProject) {
      return currentProject.name;
    }
    if (location.pathname === "/") return "Dashboard";
    if (location.pathname === "/projects") return "Meus projetos";
    if (location.pathname === "/projects/new") return "Novo projeto";
    if (location.pathname === "/subscription") return "Assinatura e uso";
    if (location.pathname === "/settings") return "Configurações";
    return "Nacif Electric";
  }, [currentProject, location.pathname]);

  const isImmersiveStudioRoute = location.pathname === "/planta-ia" || location.pathname === "/panel-generator";

  if (isImmersiveStudioRoute) {
    return (
      <div className="h-screen w-screen min-h-screen overflow-hidden bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen overflow-x-hidden bg-[#F5F7FA] font-inter text-[#101828] transition-[padding] duration-200 ${
        sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
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

      {/* Sidebar Desktop Fixa */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E4E7EC] bg-white transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {/* Topo da Sidebar: Logo ou Botão Voltar Meus Projetos */}
        <div className="flex h-16 items-center justify-between border-b border-[#E4E7EC] px-4">
          {currentProjectId ? (
            <Link
              to="/projects"
              className={`flex items-center gap-2 text-xs font-black text-[#475467] hover:text-[#101828] transition ${
                sidebarCollapsed ? "justify-center w-full" : ""
              }`}
              title="Voltar para Meus Projetos"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F4F7] text-[#344054] hover:bg-[#E4E7EC]">
                <ArrowLeft className="h-4 w-4" />
              </div>
              {!sidebarCollapsed && <span>Meus projetos</span>}
            </Link>
          ) : (
            <Link
              to="/"
              className={`flex shrink-0 items-center overflow-hidden ${
                sidebarCollapsed ? "h-10 w-10 justify-center" : "h-12 justify-start"
              }`}
            >
              <BrandLogo branding={branding} compact={sidebarCollapsed} />
            </Link>
          )}

          <button
            type="button"
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#667085] transition hover:bg-[#F2F4F7] hover:text-[#101828]"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Card do Projeto Ativo (Quando em contexto de projeto) */}
        {currentProjectId && currentProject && !sidebarCollapsed && (
          <div className="border-b border-[#EAECF0] bg-[#F9FAFB] p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-[#101828]">
                  {currentProject.name}
                </h3>
                <p className="truncate text-[11px] font-medium text-[#667085]">
                  {currentProject.client_name || "Sem cliente"}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-[#E8FCF8] px-2 py-0.5 text-[10px] font-black text-[#0f4f49]">
                {currentProject.supply_type || currentProject.project_type || "Bifásico"}
              </span>
            </div>

            {activeProjectProgress && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#667085]">
                  <span>Progresso</span>
                  <span className="text-[#00d8b8] font-black">{activeProjectProgress.percent}%</span>
                </div>
                <Progress value={activeProjectProgress.percent} className="h-1.5 bg-[#EAECF0]" />
              </div>
            )}
          </div>
        )}

        {/* Lista de Navegação */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {currentNavGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#98A2B3]">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.path ? isItemActive(item.path) : false;

                  if (item.onClick) {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onClick}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`w-full flex h-9 items-center rounded-lg text-xs font-bold transition ${
                          sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                        } text-[#344054] hover:bg-[#F2F4F7] hover:text-[#101828]`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-[#667085]" />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`relative flex h-9 items-center rounded-lg text-xs font-bold transition ${
                        sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                      } ${
                        isActive
                          ? "bg-[#E8FCF8] text-[#0f4f49] font-black"
                          : "text-[#344054] hover:bg-[#F2F4F7] hover:text-[#101828]"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 h-6 w-1 rounded-r-full bg-[#00d8b8]" />
                      )}
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive ? "text-[#00d8b8]" : "text-[#667085]"
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Rodapé da Sidebar: Plano & Uso Discreto */}
        <div className="border-t border-[#E4E7EC] p-3">
          {sidebarCollapsed ? (
            <Link
              to="/subscription"
              title="Assinatura e uso"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8FCF8] text-[#00d8b8]"
            >
              <CreditCard className="h-4 w-4" />
            </Link>
          ) : (
            <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-[#101828]">{subscription.plan.name}</p>
                  <p className="text-[10px] font-semibold text-[#667085]">
                    Projetos: {projectUsage ? `${projectUsage.usedLabel} / ${projectUsage.limitLabel}` : "1 / 50"}
                  </p>
                </div>
                <CreditCard className="h-4 w-4 text-[#00d8b8]" />
              </div>

              {projectUsage && (
                <Progress value={projectUsage.percent} className="h-1 bg-[#EAECF0]" />
              )}

              <Button asChild variant="outline" size="sm" className="h-7 w-full rounded-lg border-[#D0D5DD] text-[10px] font-black bg-white">
                <Link to="/subscription">Gerenciar plano</Link>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Conteúdo Principal + Header */}
      <main className="min-h-screen min-w-0">
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
                  <span className="ml-2 text-xs text-[#667085]">{p.client_name || "Sem cliente"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        {/* Header Superior Limpo */}
        <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between gap-3 border-b border-[#E4E7EC] bg-white px-4 sm:px-6 lg:px-8">
          {/* Lado Esquerdo: Mobile Menu Toggle & Título/Breadcrumbs */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#475467] hover:bg-[#F2F4F7] lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              {currentProjectId && currentProject ? (
                <div className="flex items-center gap-2 text-xs">
                  <Link to="/projects" className="font-bold text-[#667085] hover:text-[#101828] transition">
                    Meus projetos
                  </Link>
                  <span className="text-[#98A2B3]">/</span>
                  <span className="truncate font-black text-[#101828]">{currentProject.name}</span>
                </div>
              ) : (
                <h1 className="truncate text-base font-black text-[#101828]">
                  {routeTitle}
                </h1>
              )}
            </div>
          </div>

          {/* Lado Direito: Busca, Notificações e Perfil */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 items-center rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] px-3 text-xs font-medium text-[#667085] hover:border-[#98A2B3] md:flex md:w-56 lg:w-64 transition"
            >
              <Search className="mr-2 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate text-left">Buscar no sistema...</span>
              <span className="rounded border border-[#E4E7EC] bg-white px-1 py-0.5 text-[10px] font-bold">Ctrl K</span>
            </button>

            {/* Notificações */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Notificações"
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#475467] hover:bg-[#F2F4F7] transition"
                >
                  {unreadCount > 0 ? <BellRing className="h-4 w-4 text-[#00d8b8]" /> : <Bell className="h-4 w-4" />}
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-[#00d8b8]" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-xl border-[#E4E7EC] bg-white p-0 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#EAECF0] px-4 py-3">
                  <DropdownMenuLabel className="p-0 text-xs font-black text-[#101828]">Notificações</DropdownMenuLabel>
                  <button type="button" onClick={markAllRead} className="text-[11px] font-bold text-[#00d8b8] hover:underline">
                    Ler tudo
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-center text-xs font-medium text-[#667085]">Nenhuma notificação recente.</p>
                  ) : (
                    notifications.slice(0, 6).map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => markRead(item.id)}
                        className="flex flex-col items-start gap-1 p-2.5 rounded-lg cursor-pointer hover:bg-[#F9FAFB]"
                      >
                        <span className="text-xs font-bold text-[#101828]">{item.title}</span>
                        <span className="text-[11px] text-[#667085] leading-tight line-clamp-2">{item.description}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Menu do Usuário */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-2 rounded-lg p-1 hover:bg-[#F2F4F7] transition">
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#D0D5DD] bg-[#F9FAFB] text-xs font-extrabold text-[#101828]">
                    <AvatarDisplay user={activeUser} initials={initials} className="h-full w-full" />
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl border-[#E4E7EC] bg-white p-2 shadow-xl">
                <div className="p-2 border-b border-[#EAECF0]">
                  <p className="text-xs font-black text-[#101828] truncate">{displayName}</p>
                  <p className="text-[11px] text-[#667085] truncate">{displayEmail}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold">
                    <UserCircle className="h-4 w-4" /> Minha conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/subscription" className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold">
                    <CreditCard className="h-4 w-4" /> Assinatura e uso
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold text-red-600 focus:text-red-600"
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-4 space-y-4">
                {currentNavGroups.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="px-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#98A2B3]">
                      {group.label}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.path ? isItemActive(item.path) : false;

                        if (item.onClick) {
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setMobileDrawerOpen(false);
                                item.onClick();
                              }}
                              className="w-full flex h-10 items-center gap-3 rounded-lg px-3 text-xs font-bold text-[#344054] hover:bg-[#F2F4F7]"
                            >
                              <Icon className="h-4 w-4 text-[#667085]" />
                              <span>{item.label}</span>
                            </button>
                          );
                        }

                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileDrawerOpen(false)}
                            className={`flex h-10 items-center gap-3 rounded-lg px-3 text-xs font-bold ${
                              isActive ? "bg-[#E8FCF8] text-[#0f4f49] font-black" : "text-[#344054] hover:bg-[#F2F4F7]"
                            }`}
                          >
                            <Icon className={`h-4 w-4 ${isActive ? "text-[#00d8b8]" : "text-[#667085]"}`} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="border-t border-[#EAECF0] pt-3">
                <Button asChild variant="outline" className="w-full h-9 text-xs font-bold">
                  <Link to="/subscription">Assinatura ({subscription.plan.name})</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Viewport da Página */}
        <div key={`${location.pathname}${location.search}`} className="app-page-enter min-w-0 overflow-x-hidden px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
