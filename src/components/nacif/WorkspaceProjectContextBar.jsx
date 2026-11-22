import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, GitBranch, LayoutGrid, Compass, Zap, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectProgress } from "@/lib/projectProgress";

const TOOL_TABS = [
  { id: "overview", label: "Visão Geral", icon: FolderOpen, path: (id) => `/projects/${id}` },
  { id: "plant", label: "Planta", icon: Compass, path: (id) => `/planta-ia?project=${id}` },
  { id: "circuits", label: "Circuitos", icon: Zap, path: (id) => `/circuit-editor?project=${id}` },
  { id: "panel", label: "Quadro", icon: LayoutGrid, path: (id) => `/panel-generator?project=${id}` },
  { id: "unifilar", label: "Unifilar", icon: GitBranch, path: (id) => `/unifilar?project=${id}` },
  { id: "budget", label: "Orçamento", icon: FileSpreadsheet, path: (id) => `/budget?project=${id}` },
];

export default function WorkspaceProjectContextBar({
  project,
  activeTool = "overview",
  backTo = null,
  className = "",
}) {
  if (!project?.id) return null;
  const progress = getProjectProgress(project);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to={backTo || `/projects/${project.id}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B] hover:border-[#00D98A] hover:text-[#101828] transition"
          title="Voltar ao projeto"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-extrabold text-[#101828]">{project.name}</span>
            <span className="shrink-0 rounded-full bg-[#DDFCF0] px-2 py-0.5 text-[10px] font-bold text-[#006F51]">
              {progress.percent}% concluído
            </span>
          </div>
          <p className="truncate text-[11px] font-medium text-[#64748B]">
            {project.client_name || "Cliente não informado"} · {project.supply_type || "Bifásico"}
          </p>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
        {TOOL_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTool;
          return (
            <Link
              key={tab.id}
              to={tab.path(project.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-[#031923] text-white"
                  : "text-[#64748B] hover:bg-[#F6F9FC] hover:text-[#101828]"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active && "text-[#00F0A0]")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
