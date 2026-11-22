import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderOpen,
  GitBranch,
  Home,
  LayoutGrid,
  MoreHorizontal,
  Search,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import ProjectStatusBadge from "@/components/ProjectStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  computeProjectMetricsSafe,
  formatShortProjectDate,
  isProjectCompleted,
  isSolarTypedProject,
  normalizeProjectText,
} from "@/lib/projectAnalytics";

const formatBrl = (val) =>
  `R$ ${Number(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function RecentProjectsTable({
  projects = [],
  onRequestDelete,
  pageSize = 5,
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated"); // updated | demand | budget | name
  const [page, setPage] = useState(1);

  const enriched = useMemo(
    () => (projects || []).map((p) => computeProjectMetricsSafe(p)).filter(Boolean),
    [projects]
  );

  const filtered = useMemo(() => {
    const q = normalizeProjectText(search);
    return enriched
      .filter((item) => {
        const { project } = item;
        const completed = isProjectCompleted(project);
        const solar = isSolarTypedProject(project);
        if (statusFilter === "completed" && !completed) return false;
        if (statusFilter === "in_progress" && (completed || !item.circuitsCount)) return false;
        if (statusFilter === "solar" && !solar) return false;
        if (q) {
          const hay = normalizeProjectText(`${project.name} ${project.client_name} ${project.city} ${project.project_type}`);
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "demand") return b.demandKw - a.demandKw;
        if (sortBy === "budget") return b.budgetTotal - a.budgetTotal;
        if (sortBy === "name") return String(a.project.name || "").localeCompare(String(b.project.name || ""));
        return (b.updatedTimestamp || 0) - (a.updatedTimestamp || 0);
      });
  }, [enriched, search, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-sm font-bold text-[#101828]">Últimos projetos</h3>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: "all", label: "Todos" },
                { id: "in_progress", label: "Em andamento" },
                { id: "completed", label: "Concluídos" },
                { id: "solar", label: "Solar" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                    statusFilter === tab.id
                      ? "bg-[#DDFCF0] text-[#006F51]"
                      : "text-[#64748B] hover:bg-[#F6F9FC] hover:text-[#101828]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Filtrar projetos..."
                className="h-8 w-40 rounded-lg border border-[#E5EBF1] bg-[#F6F9FC] pl-7 pr-2 text-xs text-[#101828] placeholder:text-[#94A3B8] focus:border-[#00D98A] focus:bg-white focus:outline-none"
              />
            </div>

            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#006F51] hover:text-[#00D98A] transition whitespace-nowrap"
            >
              <span>Ver todos</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5EBF1] text-[11px] font-semibold text-[#64748B]">
                <th className="py-2.5 pr-3">
                  <button type="button" onClick={() => setSortBy("name")} className="hover:text-[#101828]">
                    Projeto
                  </button>
                </th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2">
                  <button type="button" onClick={() => setSortBy("demand")} className="hover:text-[#101828]">
                    Demanda
                  </button>
                </th>
                <th className="py-2.5 px-2">
                  <button type="button" onClick={() => setSortBy("budget")} className="hover:text-[#101828]">
                    Orçamento
                  </button>
                </th>
                <th className="py-2.5 px-2">
                  <button type="button" onClick={() => setSortBy("updated")} className="hover:text-[#101828]">
                    Atualizado em
                  </button>
                </th>
                <th className="py-2.5 pl-2 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E5EBF1]">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs font-medium text-[#64748B]">
                    Nenhum projeto encontrado com o filtro atual.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => {
                  const { project } = item;
                  const solar = isSolarTypedProject(project);
                  const ProjectIcon = solar ? Sun : project.circuits?.length > 0 ? Home : FolderOpen;

                  const derivedStatus = project.status
                    ? project.status
                    : item.circuitsCount > 0
                    ? "Em andamento"
                    : "Em análise";

                  return (
                    <tr
                      key={project.id}
                      className="group transition hover:bg-[#F6F9FC]/80"
                    >
                      <td className="py-3 pr-3">
                        <Link
                          to={`/projects/${project.id}`}
                          className="flex items-center gap-2.5 font-semibold text-[#101828] group-hover:text-[#006F51]"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#DDFCF0] text-[#006F51]">
                            <ProjectIcon className="h-4 w-4" />
                          </span>
                          <span className="truncate max-w-[180px]">{project.name}</span>
                        </Link>
                      </td>

                      <td className="py-3 px-2">
                        <ProjectStatusBadge status={derivedStatus} size="sm" />
                      </td>

                      <td className="py-3 px-2 font-bold text-[#101828] tabular-nums whitespace-nowrap">
                        {item.demandKw > 0
                          ? `${item.demandKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`
                          : "—"}
                      </td>

                      <td className="py-3 px-2 font-bold text-[#101828] tabular-nums whitespace-nowrap">
                        {item.budgetHasRealSource ? formatBrl(item.budgetTotal) : "—"}
                      </td>

                      <td className="py-3 px-2 font-medium text-[#64748B] whitespace-nowrap">
                        {formatShortProjectDate(project)}
                      </td>

                      <td className="py-3 pl-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Link
                            to={`/projects/${project.id}`}
                            aria-label={`Abrir ${project.name}`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#DDFCF0] hover:text-[#006F51] transition"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Ações para ${project.name}`}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-[#E5EBF1] bg-white p-1 shadow-xl text-xs font-semibold">
                              <DropdownMenuItem onClick={() => navigate(`/projects/${project.id}`)}>
                                <Eye className="mr-2 h-3.5 w-3.5 text-[#64748B]" /> Abrir projeto
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/planta-ia?project=${project.id}`)}>
                                <Zap className="mr-2 h-3.5 w-3.5 text-[#00D98A]" /> Planta elétrica
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/panel-generator?project=${project.id}`)}>
                                <LayoutGrid className="mr-2 h-3.5 w-3.5 text-[#00D98A]" /> Quadro elétrico
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/unifilar?project=${project.id}`)}>
                                <GitBranch className="mr-2 h-3.5 w-3.5 text-[#00D98A]" /> Diagrama unifilar
                              </DropdownMenuItem>
                              {onRequestDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onRequestDelete(project)}
                                    className="text-[#EF4444] focus:text-[#EF4444] cursor-pointer"
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir projeto
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > pageSize && (
        <div className="mt-3 flex items-center justify-between border-t border-[#E5EBF1] pt-3 text-xs font-medium text-[#64748B]">
          <span>
            Página {safePage} de {totalPages} ({filtered.length} projetos)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E5EBF1] hover:bg-[#F6F9FC] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E5EBF1] hover:bg-[#F6F9FC] disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
