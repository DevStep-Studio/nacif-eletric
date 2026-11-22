import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Eye,
  FolderOpen,
  GitBranch,
  Home,
  LayoutGrid,
  MoreHorizontal,
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
  isSolarTypedProject,
} from "@/lib/projectAnalytics";

const formatBrl = (val) =>
  `R$ ${Number(val || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function RecentProjectsTable({
  projects = [],
  onRequestDelete,
  maxRows = 4,
}) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState("updated");

  const rows = useMemo(() => {
    const items = (projects || []).map((p) => computeProjectMetricsSafe(p)).filter(Boolean);
    return items
      .sort((a, b) => {
        if (sortBy === "demand") return b.demandKw - a.demandKw;
        if (sortBy === "budget") return b.budgetTotal - a.budgetTotal;
        if (sortBy === "name") return String(a.project.name || "").localeCompare(String(b.project.name || ""));
        return (b.updatedTimestamp || 0) - (a.updatedTimestamp || 0);
      })
      .slice(0, maxRows);
  }, [projects, sortBy, maxRows]);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold text-[#101828]">Últimos projetos</h3>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#00A86B] hover:text-[#006F51] transition whitespace-nowrap"
          >
            <span>Ver todos</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5EBF1] text-[11px] font-semibold text-[#64748B]">
                <th className="py-2 pr-3">
                  <button type="button" onClick={() => setSortBy("name")} className="hover:text-[#101828]">
                    Projeto
                  </button>
                </th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">
                  <button type="button" onClick={() => setSortBy("demand")} className="hover:text-[#101828]">
                    Demanda
                  </button>
                </th>
                <th className="py-2 px-2">
                  <button type="button" onClick={() => setSortBy("budget")} className="hover:text-[#101828]">
                    Orçamento
                  </button>
                </th>
                <th className="py-2 px-2">
                  <button type="button" onClick={() => setSortBy("updated")} className="hover:text-[#101828]">
                    Atualizado em
                  </button>
                </th>
                <th className="py-2 pl-2 text-right w-14"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F1F5F9]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs font-medium text-[#64748B]">
                    Nenhum projeto cadastrado até o momento.
                  </td>
                </tr>
              ) : (
                rows.map((item) => {
                  const { project } = item;
                  const solar = isSolarTypedProject(project);
                  const ProjectIcon = solar ? Sun : project.circuits?.length > 0 ? Home : FolderOpen;

                  const derivedStatus = project.status
                    ? project.status
                    : item.circuitsCount > 0
                    ? "Em andamento"
                    : "Em análise";

                  return (
                    <tr key={project.id} className="group transition hover:bg-[#F6F9FC]/80">
                      <td className="py-2.5 pr-3">
                        <Link
                          to={`/projects/${project.id}`}
                          className="flex items-center gap-2.5 font-semibold text-[#101828] group-hover:text-[#006F51]"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#DDFCF0] text-[#00A86B]">
                            <ProjectIcon className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate max-w-[180px]">{project.name}</span>
                        </Link>
                      </td>

                      <td className="py-2.5 px-2">
                        <ProjectStatusBadge status={derivedStatus} size="sm" />
                      </td>

                      <td className="py-2.5 px-2 font-bold text-[#101828] tabular-nums whitespace-nowrap">
                        {item.demandKw > 0
                          ? `${item.demandKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`
                          : "—"}
                      </td>

                      <td className="py-2.5 px-2 font-bold text-[#101828] tabular-nums whitespace-nowrap">
                        {item.budgetHasRealSource ? formatBrl(item.budgetTotal) : "—"}
                      </td>

                      <td className="py-2.5 px-2 font-medium text-[#64748B] whitespace-nowrap">
                        {formatShortProjectDate(project)}
                      </td>

                      <td className="py-2.5 pl-2 text-right">
                        <div className="inline-flex items-center justify-end gap-0.5">
                          <Link
                            to={`/projects/${project.id}`}
                            aria-label={`Abrir ${project.name}`}
                            className="flex h-6 w-6 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#DDFCF0] hover:text-[#006F51] transition"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Ações para ${project.name}`}
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
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
    </div>
  );
}
