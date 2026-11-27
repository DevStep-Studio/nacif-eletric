import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  CreditCard,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  UserCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNotificationTime } from "@/lib/appPreferences";

export default function Topbar({
  onOpenMobileMenu,
  breadcrumbSection = "Workspace",
  breadcrumbPage = "Dashboard",
  onOpenSearch,
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  activeUser,
  displayName,
  displayEmail,
  initials,
  subscription,
  isUserSuperAdmin = false,
  onLogout,
}) {
  const navigate = useNavigate();
  const avatarUrl = activeUser?.avatar_url || activeUser?.profile_photo_url || activeUser?.photo_url;

  return (
    <header className="sticky top-0 z-30 flex h-[49px] min-w-0 items-center justify-between gap-3 border-b border-[#E5EBF1] bg-white/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Esquerda: Menu Mobile + Breadcrumb limpo ("Workspace / Dashboard") */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5EBF1] bg-white text-[#101828] hover:bg-[#F6F9FC] lg:hidden"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <div className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
          <span className="truncate font-medium text-[#64748B]">{breadcrumbSection}</span>
          <span className="text-[#CBD5E1]">/</span>
          <span className="truncate font-bold text-[#101828] max-w-[175px] sm:max-w-md">
            {breadcrumbPage}
          </span>
        </div>
      </div>

      {/* Direita: Busca Global + Sino + Avatar */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-[#E5EBF1] bg-[#F6F9FC] px-3 text-xs font-medium text-[#64748B] transition-colors hover:border-[#00D98A]/60 hover:bg-white focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-[#00D98A]/55 focus-visible:ring-offset-1 sm:w-64 sm:justify-start md:w-[300px]"
          title="Buscar projetos, normas, ferramentas (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
          <span className="hidden sm:block flex-1 truncate text-left text-[#94A3B8]">
            Buscar projetos, normas, ferramentas...
          </span>
          <span className="hidden md:inline-block rounded-md border border-[#E5EBF1] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B] leading-none">
            ⌘K
          </span>
        </button>

        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[#E5EBF1]" />

        <div className="flex items-center gap-2">
          {/* Notificações */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Notificações"
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5EBF1] bg-[#F6F9FC] text-[#475467] transition-colors hover:border-[#00D98A]/55 hover:bg-white hover:text-[#101828] data-[state=open]:border-[#00D98A]/65 data-[state=open]:bg-[#DDFCF0]/45 data-[state=open]:text-[#006F51] focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-[#00D98A]/55 focus-visible:ring-offset-1"
              >
                <Bell className="h-4 w-4 stroke-[1.85]" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#00D98A] ring-[1.5px] ring-white" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className="w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-[#E5EBF1] bg-white p-0 shadow-card-hover focus-visible:!outline-none"
            >
              <div className="flex items-center justify-between border-b border-[#E5EBF1] px-4 py-3">
                <DropdownMenuLabel className="p-0 text-xs font-extrabold text-[#101828]">
                  Notificações
                </DropdownMenuLabel>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-[11px] font-bold text-[#006F51] hover:underline"
                  >
                    Ler tudo
                  </button>
                  <Link
                    to="/notifications"
                    className="text-[11px] font-semibold text-[#64748B] hover:text-[#101828]"
                  >
                    Ver todas
                  </Link>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-xs font-medium text-[#64748B]">
                    Nenhuma notificação recente.
                  </p>
                ) : (
                  notifications.slice(0, 8).map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={() => {
                        onMarkRead?.(item.id);
                        if (item.href) navigate(item.href);
                      }}
                      className={`flex cursor-pointer flex-col items-start gap-1 rounded-xl p-2.5 transition ${
                        !item.read ? "bg-[#DDFCF0]/55 hover:bg-[#DDFCF0]" : "hover:bg-[#F6F9FC]"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#101828]">{item.title}</span>
                        <span className="shrink-0 text-[10px] text-[#64748B]">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </div>
                      <span className="line-clamp-2 text-[11px] text-[#64748B]">{item.description}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Menu da conta"
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#00D98A]/45 bg-[#DDFCF0] text-[11.5px] font-bold tracking-[0.02em] leading-none text-[#006F51] transition-colors hover:border-[#00D98A] hover:bg-[#CCF7E6] data-[state=open]:border-[#006F51] data-[state=open]:bg-[#CCF7E6] focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-[#00D98A]/55 focus-visible:ring-offset-1"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="select-none">{initials}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              collisionPadding={12}
              className="w-60 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[#E5EBF1] bg-white p-1.5 shadow-card-hover focus-visible:!outline-none"
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
                  <CreditCard className="h-4 w-4" /> Assinatura ({subscription?.plan?.name || "Gratuito"})
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
    </header>
  );
}
