import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { isAdminUser, isSuperAdmin } from "@/lib/professionalAccess";
import { canAccessModule } from "@/lib/subscriptionPlans";
import { useBranding, useNotifications } from "@/lib/appPreferences";
import { backend } from "@/api/backendClient";
import { ISSUES_CHANGED_EVENT } from "@/lib/issuePersistence";
import { normalizeSubscription } from "@/lib/subscriptionPlans";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import PublicFooter from "@/components/system/PublicFooter";
import SupportWhatsAppWidget from "@/components/SupportWhatsAppWidget";
import Sidebar from "@/components/nacif/Sidebar";
import Topbar from "@/components/nacif/Topbar";
import GlobalSearch from "@/components/nacif/GlobalSearch";

const SIDEBAR_STORAGE_KEY = "nacif:sidebar-collapsed";

const initialsFromUser = (user) => {
  const source = user?.full_name || user?.email || "Engenheiro";
  const parts = source.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] || "NE").slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function Layout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [activeUser, setActiveUser] = useState(user);

  const accessMap = useMemo(() => ({
    plant: canAccessModule(user, "plant").allowed,
    panel: canAccessModule(user, "panel").allowed,
    solar: canAccessModule(user, "solar").allowed,
    unifilar: canAccessModule(user, "unifilar").allowed,
    budget: canAccessModule(user, "budget").allowed,
  }), [user]);

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
  const [shellProjects, setShellProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [unreadIssuesCount, setUnreadIssuesCount] = useState(0);
  const { branding } = useBranding();

  const currentProjectId = useMemo(() => {
    if (location.pathname.startsWith("/projects/") && location.pathname !== "/projects/new") {
      const parts = location.pathname.split("/");
      return parts[2] || null;
    }
    return searchParams.get("project") || null;
  }, [location.pathname, searchParams]);

  const storedProjectId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("voltai_active_project_id") || null;
  }, [location.pathname, location.search]);

  const effectiveProjectId = currentProjectId || storedProjectId;

  useEffect(() => {
    if (currentProjectId && typeof window !== "undefined") {
      try {
        window.localStorage.setItem("voltai_active_project_id", currentProjectId);
      } catch {}
    }
  }, [currentProjectId]);

  useEffect(() => {
    setActiveUser(user);
  }, [user]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    let cancelled = false;
    backend.entities.Project.list("-updated_date", 60)
      .then((data) => {
        if (!cancelled) setShellProjects(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setShellProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!currentProjectId) {
      setCurrentProject(null);
      return;
    }
    const cached = shellProjects.find((p) => p.id === currentProjectId);
    if (cached) setCurrentProject(cached);

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

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarCollapsed((collapsed) => !collapsed);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadUnreadIssues = async () => {
      try {
        const data = await backend.entities.Issue.list({ limit: 100 });
        if (!cancelled && Array.isArray(data)) {
          const isUserAdminFlag = isAdminUser(activeUser);
          const count = data.filter((i) => (isUserAdminFlag ? i.unread_admin : i.unread_user)).length;
          setUnreadIssuesCount(count);
        }
      } catch {
        if (!cancelled) setUnreadIssuesCount(0);
      }
    };
    loadUnreadIssues();
    window.addEventListener(ISSUES_CHANGED_EVENT, loadUnreadIssues);
    return () => {
      cancelled = true;
      window.removeEventListener(ISSUES_CHANGED_EVENT, loadUnreadIssues);
    };
  }, [activeUser]);

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(activeUser);
  const initials = initialsFromUser(activeUser);
  const displayName = activeUser?.full_name || (activeUser?.email ? activeUser.email.split("@")[0] : "Minha Conta");
  const displayEmail = activeUser?.email || "";
  const subscription = normalizeSubscription(activeUser);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  useEffect(() => {
    if (activeUser && activeUser.onboarding_completed === false) {
      const dismissed = typeof window !== "undefined" && window.sessionStorage.getItem("onboarding_dismissed") === "true";
      if (!dismissed) setOnboardingOpen(true);
    } else {
      setOnboardingOpen(false);
    }
  }, [activeUser]);

  const handleCloseOnboarding = () => {
    setOnboardingOpen(false);
    try {
      window.sessionStorage.setItem("onboarding_dismissed", "true");
    } catch {}
  };

  const breadcrumbInfo = useMemo(() => {
    if (currentProject) return { section: "Projetos", page: currentProject.name };
    if (location.pathname === "/") return { section: "Workspace", page: "Dashboard" };
    if (location.pathname === "/projects") return { section: "Workspace", page: "Projetos" };
    if (location.pathname === "/projects/new") return { section: "Projetos", page: "Novo Projeto" };
    if (location.pathname === "/simulations") return { section: "Workspace", page: "Simulações" };
    if (location.pathname === "/calculator") return { section: "Ferramentas", page: "Calculadora" };
    if (location.pathname === "/ai-assistant") return { section: "Ferramentas", page: "Nacif IA" };
    if (location.pathname === "/scanner") return { section: "Ferramentas", page: "Scanner IA" };
    if (location.pathname === "/nbr-library") return { section: "Ferramentas", page: "Biblioteca NBR" };
    if (location.pathname === "/budget") return { section: "Ferramentas", page: "Orçamento" };
    if (location.pathname === "/materials") return { section: "Ferramentas", page: "Lista de Materiais" };
    if (location.pathname === "/components-library") return { section: "Ferramentas", page: "Componentes" };
    if (location.pathname === "/circuit-editor") return { section: "Engenharia", page: "Editor de Circuitos" };
    if (location.pathname === "/phase-balance") return { section: "Engenharia", page: "Balanceamento de Fases" };
    if (location.pathname === "/unifilar" || location.pathname === "/diagram") return { section: "Ferramentas", page: "Diagrama Unifilar" };
    if (location.pathname === "/memorial") return { section: "Engenharia", page: "Memorial Descritivo" };
    if (location.pathname.startsWith("/avisos-erros")) return { section: "Ferramentas", page: "Avisos e Erros" };
    if (location.pathname === "/notifications") return { section: "Conta", page: "Notificações" };
    if (location.pathname.startsWith("/subscription") || location.pathname.startsWith("/billing")) return { section: "Conta", page: "Planos e Assinaturas" };
    if (location.pathname === "/settings") return { section: "Conta", page: "Configurações" };
    if (location.pathname.startsWith("/admin")) return { section: "Administração", page: "Painel Administrativo" };
    if (location.pathname.startsWith("/super-admin")) return { section: "Administração", page: "Painel Super Admin" };
    return { section: "Workspace", page: "Nacif Energy" };
  }, [currentProject, location.pathname]);

  const isItemActive = (path) => {
    if (!path) return false;
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleSelectWorkspaceProject = (projectId) => {
    try {
      if (projectId) window.localStorage.setItem("voltai_active_project_id", projectId);
      else window.localStorage.removeItem("voltai_active_project_id");
    } catch {}
  };

  const isImmersiveStudioRoute = location.pathname === "/planta-ia" || location.pathname === "/panel-generator";
  if (isImmersiveStudioRoute) {
    return (
      <div className="h-screen w-screen min-h-screen overflow-hidden bg-[#F6F9FC]">
        <Outlet />
      </div>
    );
  }

  const isImmersiveSolarRoute = location.pathname.startsWith("/solar-project");
  if (isImmersiveSolarRoute) {
    return (
      <main className="min-h-screen font-sans bg-[#F6F9FC] text-[#101828]">
        <Outlet />
      </main>
    );
  }

  return (
    <div
      className={`min-h-screen overflow-x-hidden bg-[#F6F9FC] font-sans text-[#101828] transition-all duration-200 ease-in-out ${
        sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[252px]"
      }`}
    >
      <OnboardingModal user={activeUser} open={onboardingOpen} onComplete={handleCloseOnboarding} />

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
        branding={branding}
        currentProject={currentProject}
        projects={shellProjects}
        onSelectProject={handleSelectWorkspaceProject}
        effectiveProjectId={effectiveProjectId}
        accessMap={accessMap}
        isItemActive={isItemActive}
        unreadIssuesCount={unreadIssuesCount}
        unreadNotificationsCount={unreadCount}
        subscription={subscription}
        activeUser={activeUser}
        displayName={displayName}
        displayEmail={displayEmail}
        initials={initials}
        isUserAdmin={isAdminUser(activeUser)}
        isUserSuperAdmin={isSuperAdmin(activeUser)}
        onLogout={() => logout()}
      />

      <main className="min-h-screen min-w-0 flex flex-col">
        <GlobalSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          searchValue={searchValue}
          onSearchValueChange={setSearchValue}
          projects={shellProjects}
          effectiveProjectId={effectiveProjectId}
        />

        <Topbar
          onOpenMobileMenu={() => setMobileDrawerOpen(true)}
          breadcrumbSection={breadcrumbInfo.section}
          breadcrumbPage={breadcrumbInfo.page}
          onOpenSearch={() => setSearchOpen(true)}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          activeUser={activeUser}
          displayName={displayName}
          displayEmail={displayEmail}
          initials={initials}
          subscription={subscription}
          isUserSuperAdmin={isSuperAdmin(activeUser)}
          onLogout={() => logout()}
        />

        <motion.div
          key={`${location.pathname}${location.search}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="app-page-enter flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8"
        >
          <Outlet />
        </motion.div>

        <PublicFooter className="mt-auto" />
      </main>

      <SupportWhatsAppWidget />
    </div>
  );
}
