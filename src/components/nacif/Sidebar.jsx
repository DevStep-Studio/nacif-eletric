import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  CreditCard,
  Crown,
  FileSpreadsheet,
  FolderOpen,
  GitBranch,
  HelpCircle,
  Home,
  LayoutGrid,
  Lock,
  LogOut,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Sun,
  UserCircle,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import brandLogoDarkmode from "@/assets/brand-logo-darkmode.png";
import brandMarkEnergy from "@/assets/brand-symbol-pure.png";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

const isCustomLogoUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  return !(
    url.includes("brand-logo-principal") ||
    url.includes("brand-mark-principal") ||
    url.includes("Logo-Principal") ||
    url.includes("Logo-black") ||
    url.includes("Logo-white") ||
    url.includes("nacif")
  );
};

export function SidebarBrandLogo({ branding, collapsed = false }) {
  const brandTitle = [branding?.appName, branding?.appSuffix].filter(Boolean).join(" ") || "NACIF Energy";
  const hasCustomFull = isCustomLogoUrl(branding?.logoDataUrl);
  const hasCustomCompact = isCustomLogoUrl(branding?.compactLogoDataUrl);
  const src = collapsed
    ? hasCustomCompact
      ? branding.compactLogoDataUrl
      : brandMarkEnergy
    : hasCustomFull
    ? branding.logoDataUrl
    : brandLogoDarkmode;

  return (
    <div className={`flex items-center ${collapsed ? "h-8 w-8 justify-center" : "h-8 max-w-[155px]"}`}>
      <img
        src={src}
        alt={brandTitle}
        className={`h-full w-full object-contain ${collapsed ? "object-center" : "object-left"}`}
        onError={(e) => {
          const fallback = collapsed ? brandMarkEnergy : brandLogoDarkmode;
          if (e.currentTarget.src !== fallback) {
            e.currentTarget.src = fallback;
          }
        }}
      />
    </div>
  );
}

export default function Sidebar({
  collapsed = false,
  onToggleCollapsed,
  mobileOpen = false,
  onCloseMobile,
  branding,
  currentProject,
  projects = [],
  onSelectProject,
  effectiveProjectId,
  accessMap = {},
  isItemActive,
  unreadIssuesCount = 0,
  unreadNotificationsCount = 0,
  subscription,
  activeUser,
  displayName,
  displayEmail,
  initials,
  isUserAdmin = false,
  isUserSuperAdmin = false,
  onLogout,
}) {
  const projectSuffix = effectiveProjectId ? `?project=${effectiveProjectId}` : "";

  const generalItems = [
    { label: "Dashboard", to: "/", icon: Home, match: "/" },
    { label: "Projetos", to: "/projects", icon: FolderOpen, match: "/projects" },
    {
      label: "Planta Elétrica",
      to: `/planta-ia${projectSuffix}`,
      icon: Compass,
      match: "/planta-ia",
      locked: accessMap.plant === false,
    },
    {
      label: "Quadro Elétrico",
      to: `/panel-generator${projectSuffix}`,
      icon: LayoutGrid,
      match: "/panel-generator",
      locked: accessMap.panel === false,
    },
    {
      label: "Projeto Solar",
      to: `/solar-project${projectSuffix}`,
      icon: Sun,
      match: "/solar-project",
      locked: accessMap.solar === false,
    },
    {
      label: "Simulações",
      to: "/simulations",
      icon: Sparkles,
      match: "/simulations",
      aiBadge: true,
    },
  ];

  const toolsItems = [
    {
      label: "Diagrama Unifilar",
      to: `/unifilar${projectSuffix}`,
      icon: GitBranch,
      match: "/unifilar",
      locked: accessMap.unifilar === false,
    },
    { label: "Calculadora", to: "/calculator", icon: Calculator, match: "/calculator" },
    { label: "Biblioteca NBR", to: "/nbr-library", icon: BookOpen, match: "/nbr-library" },
    {
      label: "Orçamento",
      to: `/budget${projectSuffix}`,
      icon: FileSpreadsheet,
      match: "/budget",
      locked: accessMap.budget === false,
    },
    {
      label: "Avisos e Erros",
      to: "/avisos-erros",
      icon: AlertTriangle,
      match: "/avisos-erros",
      alertCount: unreadIssuesCount,
    },
  ];

  const renderSidebarBody = (isMobile = false) => {
    const isCompact = !isMobile && collapsed;
    const avatarUrl = activeUser?.avatar_url || activeUser?.profile_photo_url || activeUser?.photo_url;

    const navItemClass = (active) =>
      `group flex items-center rounded-xl text-[12.5px] font-medium transition-all duration-150 ${
        isCompact ? "mx-auto h-9 w-9 justify-center p-0" : "h-8 w-full justify-between px-2.5"
      } ${
        active
          ? "bg-gradient-to-r from-[#037B54] via-[#049768] to-[#00C480] text-white font-semibold shadow-[0_6px_16px_rgba(0,217,138,0.28)]"
          : "text-slate-300/90 hover:bg-[#082732] hover:text-white"
      }`;

    return (
      <div className="flex h-full flex-col bg-[#02161F] text-white">
        {/* Topo Logo */}
        <div
          className={`flex h-14 shrink-0 items-center ${
            isCompact ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <Link to="/" onClick={isMobile ? onCloseMobile : undefined} className="flex items-center">
            <SidebarBrandLogo branding={branding} collapsed={isCompact} />
          </Link>

          {isMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-[#082732] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Workspace Selector */}
        <div className={isCompact ? "px-2 pb-2 pt-1" : "px-3 pb-2.5 pt-1"}>
          <WorkspaceSwitcher
            collapsed={isCompact}
            currentProject={currentProject}
            projects={projects}
            onSelectProject={(id) => {
              onSelectProject?.(id);
              if (isMobile) onCloseMobile?.();
            }}
          />
        </div>

        {/* Navegação Principal */}
        <nav className={`flex-1 overflow-y-auto space-y-3 ${isCompact ? "px-2 py-1" : "px-3 py-1"}`}>
          <div className="space-y-0.5">
            {!isCompact && (
              <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400/80">
                GERAL
              </p>
            )}
            <div className="space-y-0.5">
              {generalItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.match);
                return (
                  <Link
                    key={item.match}
                    to={item.to}
                    title={isCompact ? item.label : undefined}
                    onClick={isMobile ? onCloseMobile : undefined}
                    className={navItemClass(active)}
                  >
                    <div className={`flex items-center ${isCompact ? "justify-center" : "gap-2.5 min-w-0"}`}>
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-white" : "text-slate-400 group-hover:text-[#00F0A0]"
                        }`}
                      />
                      {!isCompact && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCompact && item.aiBadge && (
                      <span className="rounded-full bg-[#5B4AE8] px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-white leading-tight">
                        IA
                      </span>
                    )}
                    {!isCompact && item.locked && !item.aiBadge && (
                      <Lock className="h-3 w-3 shrink-0 text-slate-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-0.5">
            {!isCompact && (
              <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400/80">
                FERRAMENTAS
              </p>
            )}
            <div className="space-y-0.5">
              {toolsItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.match);
                return (
                  <Link
                    key={item.match}
                    to={item.to}
                    title={isCompact ? item.label : undefined}
                    onClick={isMobile ? onCloseMobile : undefined}
                    className={navItemClass(active)}
                  >
                    <div className={`flex items-center ${isCompact ? "justify-center" : "gap-2.5 min-w-0"}`}>
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-white" : "text-slate-400 group-hover:text-[#00F0A0]"
                        }`}
                      />
                      {!isCompact && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isCompact && item.alertCount > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[10px] font-extrabold text-white">
                        {item.alertCount}
                      </span>
                    )}
                    {!isCompact && !item.alertCount && item.locked && (
                      <Lock className="h-3 w-3 shrink-0 text-slate-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Card Plano Profissional */}
          <div className="pt-1">
            <Link
              to="/subscription"
              onClick={isMobile ? onCloseMobile : undefined}
              title={isCompact ? subscription?.plan?.name || "Planos e Assinaturas" : undefined}
              className={`group flex items-center rounded-xl border border-[#00D98A]/50 bg-gradient-to-r from-[#05362E] to-[#082B2E] transition hover:border-[#00F0A0] ${
                isCompact ? "mx-auto h-9 w-9 justify-center p-0" : "justify-between gap-2 px-2.5 py-2"
              }`}
            >
              {isCompact ? (
                <Crown className="h-4 w-4 text-amber-400" />
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#00D98A]/15 text-amber-400">
                      <Crown className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white leading-tight">
                        {subscription?.plan?.name || "Plano Profissional"}
                      </p>
                      <p className="truncate text-[10px] font-medium text-emerald-100/75 leading-tight mt-0.5">
                        Recursos avançados, IA e mais...
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-[#00F0A0]" />
                </>
              )}
            </Link>
          </div>
        </nav>

        {/* Seção Conta & Rodapé Compacta */}
        <div className={`border-t border-white/10 space-y-0.5 ${isCompact ? "p-2" : "px-3 py-2"}`}>
          <Link
            to="/notifications"
            onClick={isMobile ? onCloseMobile : undefined}
            title={isCompact ? "Notificações" : undefined}
            className={navItemClass(isItemActive("/notifications"))}
          >
            <div className={`flex items-center ${isCompact ? "justify-center" : "gap-2.5 min-w-0"}`}>
              <Bell className="h-4 w-4 shrink-0 text-slate-400" />
              {!isCompact && <span className="truncate">Notificações</span>}
            </div>
            {!isCompact && unreadNotificationsCount > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00D98A] px-1.5 text-[10px] font-extrabold text-[#031923]">
                {unreadNotificationsCount}
              </span>
            )}
          </Link>

          <Link
            to="/settings"
            onClick={isMobile ? onCloseMobile : undefined}
            title={isCompact ? "Configurações" : undefined}
            className={navItemClass(isItemActive("/settings"))}
          >
            <div className={`flex items-center ${isCompact ? "justify-center" : "gap-2.5 min-w-0"}`}>
              <Settings className="h-4 w-4 shrink-0 text-slate-400" />
              {!isCompact && <span className="truncate">Configurações</span>}
            </div>
          </Link>

          <Link
            to="/ajuda"
            onClick={isMobile ? onCloseMobile : undefined}
            title={isCompact ? "Ajuda e Suporte" : undefined}
            className={navItemClass(isItemActive("/ajuda"))}
          >
            <div className={`flex items-center ${isCompact ? "justify-center" : "gap-2.5 min-w-0"}`}>
              <HelpCircle className="h-4 w-4 shrink-0 text-slate-400" />
              {!isCompact && <span className="truncate">Ajuda e Suporte</span>}
            </div>
          </Link>

          {isUserAdmin && (
            <Link
              to="/admin"
              onClick={isMobile ? onCloseMobile : undefined}
              title={isCompact ? "Painel Admin" : undefined}
              className={navItemClass(isItemActive("/admin"))}
            >
              <div className={`flex items-center ${isCompact ? "justify-center" : "gap-2.5 min-w-0"}`}>
                <Shield className="h-4 w-4 shrink-0 text-[#00F0A0]" />
                {!isCompact && <span className="truncate">Painel Admin</span>}
              </div>
            </Link>
          )}

          {/* Avatar / Perfil */}
          <div className="mt-1 pt-1.5 border-t border-white/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={isCompact ? `${displayName} (${displayEmail})` : undefined}
                  className={`flex items-center rounded-xl transition hover:bg-[#082732] ${
                    isCompact ? "mx-auto h-9 w-9 justify-center p-0" : "w-full justify-between gap-2 px-1.5 py-1"
                  }`}
                >
                  <div className={`flex items-center ${isCompact ? "justify-center" : "gap-2.5 min-w-0"}`}>
                    <span className="relative flex h-7.5 w-7.5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#00D98A]/50 bg-[#DDFCF0] text-[11px] font-extrabold text-[#006F51]">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                      ) : (
                        <span>{initials}</span>
                      )}
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-[#02161F] bg-[#00F0A0]" />
                    </span>
                    {!isCompact && (
                      <div className="min-w-0 text-left">
                        <p className="truncate text-xs font-bold text-white leading-tight">{displayName}</p>
                        <p className="truncate text-[10px] font-medium text-slate-400 leading-tight">{displayEmail}</p>
                      </div>
                    )}
                  </div>
                  {!isCompact && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side={isCompact ? "right" : "top"}
                className="w-60 rounded-2xl border-[#E5EBF1] bg-white p-1.5 shadow-2xl"
              >
                <div className="border-b border-[#E5EBF1] p-2">
                  <p className="truncate text-xs font-bold text-[#101828]">{displayName}</p>
                  <p className="truncate text-[10px] text-[#64748B]">{displayEmail}</p>
                </div>
                {isUserSuperAdmin && (
                  <DropdownMenuItem asChild>
                    <Link
                      to="/super-admin"
                      className="flex cursor-pointer items-center gap-2 rounded-xl bg-purple-50 px-2.5 py-2 text-xs font-bold text-purple-700"
                    >
                      <ShieldAlert className="h-4 w-4" /> Painel Super Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold">
                    <UserCircle className="h-4 w-4" /> Minha conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/subscription" className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold">
                    <CreditCard className="h-4 w-4" /> Plano ({subscription?.plan?.name || "Gratuito"})
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onLogout}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-[#EF4444]"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-white/10 bg-[#02161F] transition-all duration-200 ease-in-out lg:flex lg:flex-col ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        <button
          type="button"
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          onClick={onToggleCollapsed}
          title={collapsed ? "Expandir menu (Ctrl+B)" : "Recolher menu (Ctrl+B)"}
          className="absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-[#E5EBF1] bg-white text-[#101828] shadow-sm transition hover:border-[#00D98A] hover:bg-[#00D98A] hover:text-[#031923]"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>

        {renderSidebarBody(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#031923]/65 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-72 max-w-[85vw] shadow-2xl">
            {renderSidebarBody(true)}
          </div>
        </div>
      )}
    </>
  );
}
