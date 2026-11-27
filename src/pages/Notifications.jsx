import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, FolderOpen, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { formatNotificationTime, useNotifications } from "@/lib/appPreferences";
import PageHeader from "@/components/PageHeader";
import FilterBar from "@/components/nacif/FilterBar";
import EmptyState from "@/components/nacif/EmptyState";
import { Button } from "@/components/ui/button";

export default function Notifications() {
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
  } = useNotifications(user);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (notifications || []).filter((item) => {
      if (filter === "unread" && item.read) return false;
      if (filter === "projects" && item.category !== "Projeto") return false;
      if (q) {
        const hay = `${item.title || ""} ${item.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, filter, search]);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 pb-10">
      <PageHeader
        icon={Bell}
        badge="CENTRAL DE AVISOS"
        title="Notificações"
        subtitle="Acompanhe alertas automáticos de projetos, verificações técnicas e atualizações da plataforma."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828]"
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5 text-[#006F51]" />
              Marcar todas como lidas
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#64748B] hover:text-[#EF4444]"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Limpar
            </Button>
          </div>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar notificações..."
        activeTab={filter}
        onTabChange={setFilter}
        tabs={[
          { id: "all", label: "Todas", count: notifications.length },
          { id: "unread", label: "Não lidas", count: unreadCount },
          { id: "projects", label: "Projetos" },
        ]}
      />

      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nenhuma notificação nesta visualização"
            description="Quando seus projetos apresentarem novos alertas, atualizações ou cálculos pendentes, eles aparecerão aqui."
            actionLabel="Ir para Projetos"
            actionTo="/projects"
          />
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between transition ${
                item.read
                  ? "border-[#E5EBF1] bg-white"
                  : "border-[#00D98A]/45 bg-[#DDFCF0]/30 shadow-[0_2px_8px_rgba(0,217,138,0.08)]"
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    item.read ? "bg-[#F6F9FC] text-[#64748B]" : "bg-[#DDFCF0] text-[#006F51]"
                  }`}
                >
                  <FolderOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[#101828]">{item.title}</h3>
                    {!item.read && (
                      <span className="rounded-full bg-[#00D98A] px-2 py-0.5 text-[10px] font-extrabold text-[#031923]">
                        Nova
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-[#64748B]">
                      {formatNotificationTime(item.createdAt)}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-[#64748B] leading-relaxed">{item.description}</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!item.read && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => markRead(item.id)}
                    className="h-8 rounded-xl border-[#E5EBF1] text-xs font-semibold"
                  >
                    <Check className="mr-1 h-3.5 w-3.5 text-[#006F51]" />
                    Lida
                  </Button>
                )}
                {item.href && (
                  <Button
                    asChild
                    size="sm"
                    onClick={() => markRead(item.id)}
                    className="h-8 rounded-xl bg-[#031923] text-xs font-semibold text-white hover:bg-[#082732]"
                  >
                    <Link to={item.href}>Abrir</Link>
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
