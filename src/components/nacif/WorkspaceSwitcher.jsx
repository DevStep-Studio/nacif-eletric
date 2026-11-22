import { ChevronDown, FolderOpen, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function WorkspaceSwitcher({
  collapsed = false,
  currentProject = null,
  projects = [],
  onSelectProject,
}) {
  const navigate = useNavigate();
  const title = currentProject?.name || "Nacif Studio";
  const subtitle = currentProject
    ? currentProject.client_name || "Projeto ativo"
    : "Workspace principal";
  const badgeLetter = title.slice(0, 1).toUpperCase() || "N";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={collapsed ? `${title} · ${subtitle}` : undefined}
          className={`flex items-center rounded-xl border border-white/10 bg-[#082732] text-left transition hover:border-[#00D98A]/40 hover:bg-[#0B323F] ${
            collapsed
              ? "mx-auto h-10 w-10 justify-center p-0"
              : "w-full justify-between gap-2.5 px-2.5 py-2"
          }`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00D98A] text-xs font-extrabold text-[#031923] shadow-[0_0_12px_rgba(0,217,138,0.25)]">
            {badgeLetter}
          </span>

          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{title}</p>
                <p className="truncate text-[10px] font-medium text-slate-400">{subtitle}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side={collapsed ? "right" : "bottom"}
        className="w-60 rounded-2xl border-[#E5EBF1] bg-white p-1.5 shadow-2xl"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
          Workspace & Projetos
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => {
            onSelectProject?.(null);
            navigate("/");
          }}
          className={`flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold ${
            !currentProject ? "bg-[#DDFCF0] text-[#006F51]" : "text-[#101828]"
          }`}
        >
          <span>Nacif Studio (Principal)</span>
          {!currentProject && <span className="h-2 w-2 rounded-full bg-[#00D98A]" />}
        </DropdownMenuItem>

        {projects.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              Projetos Recentes
            </DropdownMenuLabel>
            {projects.slice(0, 6).map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => {
                  onSelectProject?.(p.id);
                  navigate(`/projects/${p.id}`);
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold ${
                  p.id === currentProject?.id ? "bg-[#DDFCF0] text-[#006F51]" : "text-[#101828]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#00D98A]" />
                  <span className="truncate">{p.name}</span>
                </span>
                {p.id === currentProject?.id && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#00D98A]" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate("/projects/new")}
          className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold text-[#006F51] hover:bg-[#DDFCF0]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Criar novo projeto</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
