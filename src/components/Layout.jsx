import { useEffect, useMemo, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Calculator,
  CheckCheck,
  ChevronDown,
  CreditCard,
  FileText,
  FolderOpen,
  GitBranch,
  HelpCircle,
  Home,
  Info,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  PencilLine,
  Plus,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  UserCircle,
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

const SIDEBAR_STORAGE_KEY = "voltai:shell-sidebar-collapsed";

const NAV_GROUPS = [
  {
    label: "VISÃO GERAL",
    items: [{ path: "/", icon: Home, label: "Dashboard", fullAccess: true }],
  },
  {
    label: "PROJETOS",
    items: [
      { path: "/projects", icon: FolderOpen, label: "Meus projetos", fullAccess: true },
      { path: "/projects/new", icon: Plus, label: "Novo projeto", fullAccess: true },
      { path: "/planta-ia", icon: Zap, label: "Editor de planta", fullAccess: false },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      { path: "/circuit-editor", icon: PencilLine, label: "Circuitos", fullAccess: true },
      { path: "/panel-generator", icon: LayoutGrid, label: "Quadro elétrico", fullAccess: true },
      { path: "/unifilar", icon: GitBranch, label: "Diagrama unifilar", fullAccess: true },
      { path: "/phase-balance", icon: Activity, label: "Balanço de fases", fullAccess: true },
      { path: "/scanner", icon: ScanLine, label: "Scanner IA", fullAccess: true },
      { path: "/calculator", icon: Calculator, label: "Calculadora", fullAccess: true },
      { path: "/nbr-library", icon: BookOpen, label: "Biblioteca NBR", fullAccess: true },
      { path: "/materials", icon: BarChart3, label: "Materiais", fullAccess: true },
      { path: "/budget", icon: FileText, label: "Orçamento", fullAccess: true },
      { path: "/memorial", icon: BookOpen, label: "Memorial descritivo", fullAccess: true },
      { path: "/ai-assistant", icon: Zap, label: "Assistente IA", fullAccess: true },
    ],
  },
  {
    label: "GESTÃO",
    items: [
      { path: "/components-library", icon: Shield, label: "Biblioteca", fullAccess: true },
    ],
  },
  {
    label: "CONTA",
    items: [
      { path: "/subscription", icon: CreditCard, label: "Assinatura e uso", fullAccess: false },
      { path: "/settings", icon: Settings, label: "Configurações", fullAccess: false },
    ],
  },
];

const QUICK_ACTIONS = [
  { label: "Criar projeto", description: "Iniciar um novo projeto técnico", icon: Plus, target: "/projects/new" },
  { label: "Importar planta", description: "Abrir o editor de planta baixa", icon: Zap, target: "/planta-ia" },
  { label: "Ver assinatura", description: "Planos, limites e uso", icon: CreditCard, target: "/subscription" },
  { label: "Configurações", description: "Perfil e preferências", icon: Settings, target: "/settings" },
];

const projectSearchActions = [
  { key: "overview", label: "Abrir projeto", icon: FolderOpen, href: (id) => `/projects/${id}` },
  { key: "plant", label: "Planta", icon: Zap, href: (id) => `/planta-ia?project=${id}` },
  { key: "circuits", label: "Circuitos", icon: PencilLine, href: (id) => `/circuit-editor?project=${id}` },
  { key: "panel", label: "Quadro", icon: LayoutGrid, href: (id) => `/panel-generator?project=${id}` },
  { key: "diagram", label: "Diagrama", icon: GitBranch, href: (id) => `/unifilar?project=${id}` },
  { key: "materials", label: "Materiais", icon: BarChart3, href: (id) => `/materials?project=${id}` },
  { key: "memorial", label: "Memorial", icon: BookOpen, href: (id) => `/memorial?project=${id}` },
];

const NAV_ITEM_TONES = {
  "/": "blue",
  "/projects": "blue",
  "/projects/new": "green",
  "/planta-ia": "cyan",
  "/circuit-editor": "green",
  "/panel-generator": "amber",
  "/unifilar": "indigo",
  "/phase-balance": "teal",
  "/scanner": "rose",
  "/calculator": "slate",
  "/nbr-library": "blue",
  "/materials": "green",
  "/budget": "amber",
  "/memorial": "blue",
  "/ai-assistant": "cyan",
  "/components-library": "indigo",
  "/subscription": "amber",
  "/settings": "slate",
};

const navToneStyles = {
  blue: { active: "bg-[#E8FCF8] text-[#0f4f49]", icon: "text-[#00d8b8]", rail: "bg-[#00d8b8]" },
  cyan: { active: "bg-[#E8FCF8] text-[#0f4f49]", icon: "text-[#00d8b8]", rail: "bg-[#00d8b8]" },
  green: { active: "bg-[#E8FCF8] text-[#0f4f49]", icon: "text-[#00d8b8]", rail: "bg-[#00d8b8]" },
  amber: { active: "bg-[#E8FCF8] text-[#0f4f49]", icon: "text-[#00d8b8]", rail: "bg-[#00d8b8]" },
  indigo: { active: "bg-[#E8FCF8] text-[#0f4f49]", icon: "text-[#00d8b8]", rail: "bg-[#00d8b8]" },
  teal: { active: "bg-[#E8FCF8] text-[#0f4f49]", icon: "text-[#00d8b8]", rail: "bg-[#00d8b8]" },
  rose: { active: "bg-[#E8FCF8] text-[#0f4f49]", icon: "text-[#00d8b8]", rail: "bg-[#00d8b8]" },
  slate: { active: "bg-[#E8FCF8] text-[#0f4f49]", icon: "text-[#00d8b8]", rail: "bg-[#00d8b8]" },
};

const notificationIcon = {
  info: Info,
  warning: AlertTriangle,
  success: ShieldCheck,
};

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

  return <Zap className={compact ? "h-5 w-5" : "h-6 w-6"} />;
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

function isActivePath(pathname, itemPath) {
  if (itemPath === "/") return pathname === "/";
  if (itemPath === "/projects") return pathname === "/projects" || pathname.startsWith("/projects/");
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeUser, setActiveUser] = useState(user);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [shellProjects, setShellProjects] = useState([]);
  const [loadingShellProjects, setLoadingShellProjects] = useState(false);
  const { branding } = useBranding();

  useEffect(() => {
    setActiveUser(user);
  }, [user]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // The collapsed state is a convenience only.
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    const refreshUser = async () => {
      try {
        setActiveUser(await backend.auth.me());
      } catch {
        setActiveUser(user);
      }
    };

    window.addEventListener("voltai:user-updated", refreshUser);
    return () => window.removeEventListener("voltai:user-updated", refreshUser);
  }, [user]);

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

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }

      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const tagName = document.activeElement?.tagName?.toLowerCase();
        if (tagName !== "input" && tagName !== "textarea" && document.activeElement?.isContentEditable !== true) {
          event.preventDefault();
          setSearchOpen(true);
          setSearchValue("atalhos");
        }
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
  const accent = branding.primaryColor;
  const accentSoft = branding.secondaryColor;
  const logoIconColor = branding.logoIconColor || accent;
  const logoBackgroundColor = branding.logoBackgroundColor || accentSoft;
  const subscription = normalizeSubscription(activeUser);
  const usage = useMemo(() => buildUsageFromProjects(shellProjects), [shellProjects]);
  const usageRows = useMemo(() => getUsageRows(subscription.plan, usage), [subscription.plan, usage]);
  const projectUsage = usageRows.find((row) => row.key === FEATURE_KEYS.PROJECTS);

  const visibleNavGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.fullAccess || fullAccess),
      })).filter((group) => group.items.length > 0),
    [fullAccess],
  );

  const flatNavItems = useMemo(() => visibleNavGroups.flatMap((group) => group.items), [visibleNavGroups]);
  const pageResults = useMemo(
    () => flatNavItems.map((item) => ({ ...item, searchLabel: `${item.label} ${item.path}` })),
    [flatNavItems],
  );
  const activeNav = useMemo(
    () =>
      [...flatNavItems]
        .sort((a, b) => b.path.length - a.path.length)
        .find((item) => isActivePath(location.pathname, item.path)),
    [flatNavItems, location.pathname],
  );
  const routeTitle =
    location.pathname === "/projects/new"
      ? "Novo projeto"
      : location.pathname === "/subscription" || location.pathname.startsWith("/billing")
        ? "Assinatura e uso"
        : activeNav?.label || "Dashboard";

  const projectResults = useMemo(
    () =>
      shellProjects.flatMap((project) => {
        const baseLabel = `${project.name || ""} ${project.client_name || ""} ${project.project_type || ""}`.trim();

        return projectSearchActions.map((action) => ({
          id: `${project.id}:${action.key}`,
          project,
          actionLabel: action.label,
          icon: action.icon,
          target: action.href(project.id),
          searchLabel: `${baseLabel} ${action.label}`,
        }));
      }),
    [shellProjects],
  );
  const notificationResults = useMemo(
    () =>
      notifications.slice(0, 12).map((item) => ({
        ...item,
        searchLabel: `${item.title || ""} ${item.description || ""} ${item.category || ""}`,
        icon: notificationIcon[item.tone] || Info,
        target: item.href || "/",
      })),
    [notifications],
  );

  const handleSearchNavigate = (target) => {
    setSearchOpen(false);
    setSearchValue("");
    navigate(target);
  };

  const isImmersiveSolarRoute = location.pathname.startsWith("/solar-project");
  const isImmersivePlantRoute = location.pathname.startsWith("/planta-ia");

  if (isImmersiveSolarRoute || isImmersivePlantRoute) {
    return (
      <main className={`min-h-screen font-inter text-[#0f1728] ${isImmersiveSolarRoute ? "bg-[#172637]" : "bg-[#F5F7FA]"}`}>
        <Outlet />
      </main>
    );
  }

  return (
    <div
      className={`min-h-screen overflow-x-hidden bg-[#F5F7FA] font-inter text-[#101828] transition-[padding] duration-200 ${
        sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[248px]"
      }`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E4E7EC] bg-white transition-[width] duration-200 lg:flex ${
          sidebarCollapsed ? "w-[72px]" : "w-[248px]"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#E4E7EC] px-3">
          <Link
            to="/"
            className={`flex shrink-0 items-center overflow-hidden ${
              sidebarCollapsed ? "h-10 w-10 justify-center" : "h-12 w-[118px] justify-start"
            }`}
          >
            <BrandLogo branding={branding} compact={sidebarCollapsed} className={sidebarCollapsed ? "" : "object-left"} />
          </Link>
          <button
            type="button"
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[#475467] transition hover:bg-[#F2F4F7] hover:text-[#101828]"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {visibleNavGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!sidebarCollapsed && (
                <p className="mb-1 px-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#98A2B3]">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isActivePath(location.pathname, item.path);
                  const Icon = item.icon;
                  const tone = navToneStyles[NAV_ITEM_TONES[item.path]] || navToneStyles.blue;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={sidebarCollapsed ? item.label : undefined}
                      aria-current={isActive ? "page" : undefined}
                      className={`relative flex h-10 items-center rounded-[8px] text-sm font-semibold transition ${
                        sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"
                      } ${
                        isActive
                          ? tone.active
                          : "text-[#344054] hover:bg-[#F2F4F7] hover:text-[#101828]"
                      }`}
                    >
                      {isActive && <span className={`absolute left-0 top-2 h-6 w-1 rounded-r-full ${tone.rail}`} />}
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "" : tone.icon}`} strokeWidth={isActive ? 2.35 : 2} />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#E4E7EC] p-3">
          {sidebarCollapsed ? (
            <Link
              to="/subscription"
              title="Assinatura e uso"
              className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#E8FCF8] text-[#00d8b8]"
            >
              <CreditCard className="h-4 w-4" />
            </Link>
          ) : (
            <div className="rounded-[10px] border border-[#E4E7EC] bg-[#F9FAFB] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-[#101828]">{subscription.plan.name}</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#667085]">Assinatura e uso</p>
                </div>
                <CreditCard className="h-4 w-4 shrink-0 text-[#00d8b8]" />
              </div>
              {projectUsage && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#667085]">
                    <span>Projetos</span>
                    <span>
                      {projectUsage.usedLabel} / {projectUsage.limitLabel}
                    </span>
                  </div>
                  <Progress value={projectUsage.percent} className="h-1.5 bg-[#EAECF0]" />
                </div>
              )}
              <Button asChild variant="outline" className="mt-3 h-9 w-full rounded-[8px] border-[#D0D5DD] text-xs font-extrabold">
                <Link to="/subscription">Gerenciar plano</Link>
              </Button>
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-screen min-w-0">
        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <CommandInput
            placeholder="Buscar páginas, projetos e ações..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>Nada encontrado.</CommandEmpty>

            <CommandGroup heading="Ações rápidas">
              {QUICK_ACTIONS.filter((action) => fullAccess || !["/projects/new"].includes(action.target)).map((action) => (
                <CommandItem
                  key={action.target}
                  value={`${action.label} ${action.description}`}
                  onSelect={() => handleSearchNavigate(action.target)}
                  className="flex items-center gap-3 rounded-[8px] px-3 py-3"
                >
                  <action.icon className="h-4 w-4 text-[#00d8b8]" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[#101828]">{action.label}</span>
                    <span className="block truncate text-xs font-medium text-[#667085]">{action.description}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Páginas">
              {pageResults.map((item) => (
                <CommandItem
                  key={item.path}
                  value={item.searchLabel}
                  onSelect={() => handleSearchNavigate(item.path)}
                  className="flex items-center gap-3 rounded-[8px] px-3 py-3"
                >
                  <item.icon className="h-4 w-4 text-[#00d8b8]" />
                  <span className="font-semibold text-[#101828]">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Projetos">
              {loadingShellProjects ? (
                <div className="px-3 py-4 text-sm font-medium text-[#667085]">Carregando projetos...</div>
              ) : projectResults.length > 0 ? (
                projectResults.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.searchLabel}
                    onSelect={() => handleSearchNavigate(result.target)}
                    className="flex items-center gap-3 rounded-[8px] px-3 py-3"
                  >
                    <result.icon className="h-4 w-4 text-[#00d8b8]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#101828]">{result.project.name}</span>
                      <span className="block truncate text-xs font-medium text-[#667085]">
                        {result.actionLabel} - {result.project.client_name || "Sem cliente"}
                      </span>
                    </span>
                  </CommandItem>
                ))
              ) : (
                <div className="px-3 py-4 text-sm font-medium text-[#667085]">Nenhum projeto encontrado.</div>
              )}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Notificações">
              {notificationResults.length > 0 ? (
                notificationResults.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.searchLabel}
                    onSelect={() => {
                      markRead(item.id);
                      handleSearchNavigate(item.target);
                    }}
                    className="flex items-center gap-3 rounded-[8px] px-3 py-3"
                  >
                    <item.icon className="h-4 w-4 text-[#00d8b8]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[#101828]">{item.title}</span>
                      <span className="block truncate text-xs font-medium text-[#667085]">
                        {item.category || "Sistema"}{item.read ? "" : " - Não lida"}
                      </span>
                    </span>
                  </CommandItem>
                ))
              ) : (
                <div className="px-3 py-4 text-sm font-medium text-[#667085]">Nenhuma notificação recente.</div>
              )}
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-[#E4E7EC] bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] lg:hidden" style={{ backgroundColor: logoBackgroundColor, color: logoIconColor }}>
              <BrandLogo branding={branding} compact />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#667085]">
                <Link to="/" className="transition hover:text-[#00d8b8]">Dashboard</Link>
                {routeTitle !== "Dashboard" && (
                  <>
                    <span>/</span>
                    <span className="truncate text-[#344054]">{routeTitle}</span>
                  </>
                )}
              </div>
              <h1 className="truncate text-[18px] font-extrabold leading-6 text-[#101828] sm:text-[20px]">
                {routeTitle}
              </h1>
            </div>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-10 min-w-0 items-center rounded-[8px] border border-[#D0D5DD] bg-white px-3 text-left text-sm font-medium text-[#667085] transition hover:border-[#98A2B3] md:flex md:w-[260px] xl:w-[340px]"
            >
              <Search className="mr-2 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Buscar no sistema</span>
              <span className="ml-2 rounded-[6px] border border-[#E4E7EC] bg-[#F9FAFB] px-1.5 py-0.5 text-[11px] font-bold text-[#667085]">
                Ctrl K
              </span>
            </button>

            {fullAccess && (
              <Button asChild className="hidden h-10 rounded-[8px] px-3 text-sm font-extrabold sm:inline-flex">
                <Link to="/projects/new">
                  <Plus className="h-4 w-4" />
                  Novo projeto
                </Link>
              </Button>
            )}

            <button
              type="button"
              aria-label="Ajuda e atalhos"
              onClick={() => {
                setSearchOpen(true);
                setSearchValue("atalhos");
              }}
              className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[#475467] transition hover:bg-[#F2F4F7] hover:text-[#101828]"
            >
              <HelpCircle className="h-5 w-5" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Notificações"
                  className="relative flex h-10 w-10 items-center justify-center rounded-[8px] text-[#475467] transition hover:bg-[#F2F4F7] hover:text-[#101828]"
                >
                  {unreadCount > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00d8b8] px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] overflow-hidden rounded-[12px] border-[#E4E7EC] bg-white p-0 shadow-[0_16px_40px_rgba(16,24,40,0.12)] sm:w-[380px]">
                <div className="flex items-center justify-between border-b border-[#EAECF0] px-4 py-3">
                  <div>
                    <DropdownMenuLabel className="p-0 text-sm font-extrabold text-[#101828]">Notificações</DropdownMenuLabel>
                    <p className="mt-0.5 text-xs font-medium text-[#667085]">
                      {unreadCount > 0 ? `${unreadCount} pendente${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#D0D5DD] px-2.5 text-xs font-extrabold text-[#344054] transition hover:bg-[#F9FAFB]"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Ler tudo
                  </button>
                </div>

                <div className="max-h-[365px] overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#F2F4F7] text-[#475467]">
                        <Bell className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-extrabold text-[#101828]">Sem notificações</p>
                      <p className="mt-1 text-xs font-medium text-[#667085]">Alertas técnicos e avisos administrativos aparecerão aqui.</p>
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((item) => {
                      const Icon = notificationIcon[item.tone] || Info;
                      const toneColor = "#00d8b8";

                      return (
                        <DropdownMenuItem key={item.id} asChild>
                          <Link
                            to={item.href || "/"}
                            onClick={() => markRead(item.id)}
                            className="flex cursor-pointer items-start gap-3 rounded-[10px] px-3 py-3 outline-none transition hover:bg-[#F9FAFB] focus:bg-[#F9FAFB]"
                          >
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#F2F4F7]" style={{ color: toneColor }}>
                              <Icon className="h-[18px] w-[18px]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-extrabold text-[#101828]">{item.title}</span>
                                {!item.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#00d8b8]" />}
                              </span>
                              <span className="mt-1 line-clamp-2 block text-xs font-medium leading-5 text-[#667085]">
                                {item.description}
                              </span>
                              <span className="mt-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#98A2B3]">
                                {item.category || "Sistema"} - {formatNotificationTime(item.createdAt)}
                              </span>
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </div>

                {activeUser?.role === "admin" && (
                  <div className="border-t border-[#EAECF0] p-3">
                    <Link
                      to="/admin"
                      className="flex h-9 items-center justify-center rounded-[8px] bg-[#E8FCF8] text-sm font-extrabold text-[#00d8b8] transition hover:bg-[#D6E8F3]"
                    >
                      Gerenciar notificações
                    </Link>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex min-w-0 items-center gap-2 rounded-[8px] p-1 transition hover:bg-[#F2F4F7]">
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#D0D5DD] bg-[#F9FAFB] text-xs font-extrabold text-[#101828]">
                    <AvatarDisplay user={activeUser} initials={initials} className="h-full w-full" />
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-[#475467] sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] rounded-[12px] border-[#E4E7EC] bg-white p-2 shadow-[0_16px_40px_rgba(16,24,40,0.12)] sm:w-72">
                <div className="flex items-center gap-3 rounded-[10px] bg-[#F9FAFB] p-3">
                  <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#D0D5DD] text-sm font-extrabold text-[#101828]">
                    <AvatarDisplay user={activeUser} initials={initials} className="h-full w-full" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[#101828]">{displayName}</p>
                    <p className="truncate text-xs font-medium text-[#667085]">{displayEmail}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold">
                    <UserCircle className="h-4 w-4" />
                    Minha conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/subscription" className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold">
                    <CreditCard className="h-4 w-4" />
                    Assinatura e uso
                  </Link>
                </DropdownMenuItem>
                {activeUser?.role === "admin" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold">
                        <Settings className="h-4 w-4" />
                        Painel administrativo
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold">
                        <Palette className="h-4 w-4" />
                        Aparência e marca
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold text-red-600 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <nav className="sticky top-16 z-20 border-b border-[#E4E7EC] bg-white lg:hidden">
          <div className="flex gap-2 overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
            {flatNavItems.map((item) => {
              const isActive = isActivePath(location.pathname, item.path);
              const tone = navToneStyles[NAV_ITEM_TONES[item.path]] || navToneStyles.blue;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] border px-3 text-xs font-bold transition ${
                    isActive
                      ? `${tone.active} border-transparent`
                      : "border-[#E4E7EC] bg-white text-[#344054]"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${isActive ? "" : tone.icon}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div key={location.pathname} className="app-page-enter min-w-0 overflow-x-hidden px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
