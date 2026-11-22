import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  FolderOpen,
  GitBranch,
  LayoutGrid,
  Loader2,
  AlertCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectProgress } from "@/lib/projectProgress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";

const MODULE_TABS = [
  { id: "overview", label: "Visão Geral", icon: FolderOpen, path: (id) => `/projects/${id}` },
  { id: "plant", label: "Planta", icon: Compass, path: (id) => `/planta-ia?project=${id}` },
  { id: "circuits", label: "Circuitos", icon: Zap, path: (id) => `/circuit-editor?project=${id}` },
  { id: "panel", label: "Quadro", icon: LayoutGrid, path: (id) => `/panel-generator?project=${id}` },
  { id: "unifilar", label: "Unifilar", icon: GitBranch, path: (id) => `/unifilar?project=${id}` },
  { id: "budget", label: "Orçamento", icon: FileSpreadsheet, path: (id) => `/budget?project=${id}` },
];

/**
 * Barra unificada de contexto do projeto, seletor de workspace e navegação técnica.
 */
export default function ProjectContextBar({
  project,
  projects = [],
  onSelectProject,
  activeTool = "circuits",
  saveState = "idle", // "idle" | "saving" | "saved" | "error"
  saveError = "",
}) {
  if (!project?.id) return null;

  const progress = getProjectProgress(project);
  const progressPct = progress?.percent ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)] xl:flex-row xl:items-center xl:justify-between">
      {/* Esquerda: Voltar + Seletor Inline + Estado & Progresso */}
      <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:flex-nowrap">
        <Link
          to={`/projects/${project.id}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B] transition hover:border-[#00D98A] hover:bg-[#E5FBF2] hover:text-[#006B50]"
          title="Voltar à visão do projeto"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {projects.length > 0 && onSelectProject ? (
              <Select value={project.id} onValueChange={onSelectProject}>
                <SelectTrigger className="h-8 w-auto max-w-[230px] gap-2 rounded-lg border-[#E5EBF1] bg-[#F6F9FC] px-2.5 text-xs font-extrabold text-[#101828] hover:border-[#00D98A] focus:ring-[#00D98A]/25">
                  <SelectValue placeholder="Selecionar projeto" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#E5EBF1] bg-white">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs font-semibold">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="truncate text-sm font-extrabold text-[#101828]">{project.name}</span>
            )}

            <ProjectStatusBadge status={project.status} size="sm" />

            <span className="inline-flex items-center rounded-md border border-[#BEEAD2] bg-[#E5FBF2] px-2 py-0.5 text-[11px] font-bold text-[#006B50] tabular-nums">
              {progressPct}% concluído
            </span>

            {saveState === "saving" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#EDF5FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Salvando...
              </span>
            )}
            {saveState === "saved" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#E5FBF2] px-2 py-0.5 text-[11px] font-semibold text-[#006B50]">
                <CheckCircle2 className="h-3 w-3" />
                Alterações salvas
              </span>
            )}
            {saveState === "error" && (
              <span
                title={saveError || "Erro ao salvar alterações"}
                className="inline-flex items-center gap-1 rounded-md bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#EF4444]"
              >
                <AlertCircle className="h-3 w-3" />
                Falha ao salvar
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#64748B]">
            <span className="truncate">
              {project.client_name || "Cliente não informado"} · {project.supply_type || "Fornecimento não definido"}
              {project.voltage ? ` (${project.voltage} V)` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Direita: Navegação Técnica nas Rotas Reais */}
      <nav
        aria-label="Módulos do projeto"
        className="flex items-center gap-1 overflow-x-auto border-t border-[#E5EBF1] pt-2.5 xl:border-t-0 xl:pt-0"
      >
        {MODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTool;
          return (
            <Link
              key={tab.id}
              to={tab.path(project.id)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition whitespace-nowrap",
                active
                  ? "border-[#00D98A]/50 bg-[#E5FBF2] font-bold text-[#006B50]"
                  : "border-transparent text-[#64748B] hover:border-[#E5EBF1] hover:bg-[#F6F9FC] hover:text-[#101828]"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-[#006B50]" : "text-[#64748B]")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
