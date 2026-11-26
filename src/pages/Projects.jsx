import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Columns2,
  Copy,
  Edit3,
  FileText,
  FolderOpen,
  GitBranch,
  Grid2X2,
  LayoutGrid,
  List,
  Map,
  MoreVertical,
  PencilLine,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { getPlanByCode } from "@/lib/subscriptionPlans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/PageHeader";
import BrandLoadingScreen from "@/components/system/BrandLoadingScreen";
import ProjectProgress from "@/components/navigation/ProjectProgress";
import EditProjectModal from "@/components/EditProjectModal";
import ProjectStatusBadge, { formatProjectStatusLabel } from "@/components/ProjectStatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusStyles = {
  Rascunho: "border-slate-200 bg-slate-100 text-slate-700",
  "Em Andamento": "border-[#BCEEE5] bg-[#E8FCF8] text-[#007a68]",
  "Concluído": "border-emerald-200 bg-emerald-50 text-emerald-800",
  Aprovado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  Arquivado: "border-slate-200 bg-slate-50 text-slate-500",
};

const projectToneStyles = {
  blue: {
    card: "border-slate-200 bg-white hover:border-[#00d8b8]/60",
    icon: "bg-blue-50 text-blue-600",
    rail: "bg-blue-600",
  },
  cyan: {
    card: "border-[#BCEEE5] bg-white hover:border-[#00d8b8]",
    icon: "bg-[#E8FCF8] text-[#007a68]",
    rail: "bg-[#00d8b8]",
  },
  green: {
    card: "border-emerald-200 bg-white hover:border-emerald-400",
    icon: "bg-emerald-50 text-emerald-700",
    rail: "bg-emerald-600",
  },
  amber: {
    card: "border-amber-200 bg-white hover:border-amber-400",
    icon: "bg-amber-50 text-amber-700",
    rail: "bg-amber-500",
  },
  slate: {
    card: "border-slate-200 bg-white hover:border-slate-400",
    icon: "bg-slate-100 text-slate-600",
    rail: "bg-slate-400",
  },
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isSolarProjectType = (project) =>
  String(project?.project_type || "").toLowerCase().includes("solar") || Boolean(project?.solar_config);

const getProjectTone = (project) => {
  const status = normalizeText(project?.status);
  if (isSolarProjectType(project)) return "amber";
  if (status.includes("concluido") || status.includes("aprovado")) return "green";
  if (status.includes("andamento")) return "cyan";
  if (status.includes("arquivado")) return "slate";
  return "blue";
};

const getProjectDate = (project) => project?.updated_date || project?.updated_at || project?.created_date || project?.created_at;

const formatProjectDate = (project) => {
  const value = getProjectDate(project);
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getProjectActions = (project) => [
  ...(isSolarProjectType(project) ? [{ label: "Projeto solar", icon: Sun, href: `/solar-project?project=${project.id}` }] : []),
  { label: "Planta", icon: Map, href: `/planta-ia?project=${project.id}` },
  { label: "Circuitos", icon: PencilLine, href: `/circuit-editor?project=${project.id}` },
  { label: "Quadro", icon: Grid2X2, href: `/panel-generator?project=${project.id}` },
  { label: "Diagrama", icon: GitBranch, href: `/unifilar?project=${project.id}` },
  { label: "Materiais", icon: BarChart3, href: `/materials?project=${project.id}` },
  { label: "Memorial", icon: FileText, href: `/memorial?project=${project.id}` },
];

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const loadVersion = useRef(0);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryView, setCategoryView] = useState("split"); // "split" | "electrical" | "solar" | "all"
  const [viewMode, setViewMode] = useState("table");
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingProject, setEditingProject] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const load = async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(false);
    try {
      const data = await backend.entities.Project.list("-updated_date", 100);
      if (version !== loadVersion.current) return;
      setProjects(Array.isArray(data) ? data.filter(project => project.owner_id === user?.id) : []);
    } catch (err) {
      if (version !== loadVersion.current) return;
      console.error("Falha ao carregar projetos:", err);
      if (err?.status === 401) {
        window.location.href = "/login";
      }
      setProjects([]);
      setError(true);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    setProjects([]);
    setSelectedIds([]);
    setEditingProject(null);
    setProjectToDelete(null);
    if (user?.id) load();
    return () => { loadVersion.current++; };
  }, [user?.id]);

  const handleDuplicate = async (id) => {
    setDuplicating(true);
    try {
      const duplicated = await backend.entities.Project.duplicate(id);
      load();
      alert(`Projeto duplicado com sucesso: "${duplicated.name}"`);
    } catch (err) {
      console.error("Erro ao duplicar projeto:", err);
      alert(err?.message || "Não foi possível duplicar o projeto.");
    } finally {
      setDuplicating(false);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
  };

  const statusOptions = useMemo(() => {
    const uniqueStatuses = Array.from(new Set(projects.map((project) => project.status || "Rascunho")));
    return ["all", ...uniqueStatuses];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return projects.filter((project) => {
      const status = project.status || "Rascunho";
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const searchable = normalizeText(
        [
          project.name,
          project.client_name,
          project.project_type,
          project.supply_type,
          project.voltage,
          status,
        ].join(" "),
      );

      return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [projects, query, statusFilter]);

  const electricalProjects = useMemo(
    () => filteredProjects.filter((project) => !isSolarProjectType(project)),
    [filteredProjects],
  );

  const solarProjects = useMemo(
    () => filteredProjects.filter((project) => isSolarProjectType(project)),
    [filteredProjects],
  );

  const visibleProjectsForSingleView = useMemo(() => {
    if (categoryView === "electrical") return electricalProjects;
    if (categoryView === "solar") return solarProjects;
    return filteredProjects;
  }, [categoryView, electricalProjects, solarProjects, filteredProjects]);

  const handleDelete = (id) => {
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      setProjectToDelete(proj);
    } else {
      setProjectToDelete({ id, name: "este projeto", isBulk: false });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setProjectToDelete({ count: selectedIds.length, isBulk: true });
  };

  const confirmDeleteAction = async () => {
    if (!projectToDelete) return;
    try {
      if (projectToDelete.isBulk) {
        await Promise.all(selectedIds.map((id) => backend.entities.Project.delete(id)));
        setSelectedIds([]);
      } else {
        await backend.entities.Project.delete(projectToDelete.id);
        setSelectedIds((ids) => ids.filter((selectedId) => selectedId !== projectToDelete.id));
      }
      load();
    } catch (err) {
      console.error("Erro ao excluir projeto(s):", err);
      alert("Não foi possível excluir o(s) projeto(s) selecionado(s). Tente novamente.");
    } finally {
      setProjectToDelete(null);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]));
  };

  const toggleGroupSelection = (groupList) => {
    if (!groupList || groupList.length === 0) return;
    const groupIds = groupList.map((project) => project.id);
    const allGroupSelected = groupIds.every((id) => selectedIds.includes(id));

    if (allGroupSelected) {
      setSelectedIds((ids) => ids.filter((id) => !groupIds.includes(id)));
      return;
    }

    setSelectedIds((ids) => Array.from(new Set([...ids, ...groupIds])));
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-20">
      <PageHeader
        icon={FolderOpen}
        title="Projetos"
        subtitle="Gerencie projetos elétricos e solares, clientes, status técnico e documentação."
        actionsPlacement="right"
        actions={
          <Button asChild className="h-10 rounded-[8px] font-extrabold">
            <Link to="/projects/new">
              <Plus className="h-4 w-4" />
              Novo projeto
            </Link>
          </Button>
        }
      />

      {(() => {
        const userPlan = getPlanByCode(user?.plan || "free");
        const maxProjects = typeof userPlan?.limits?.projects === "number" ? userPlan.limits.projects : null;
        const isLimitReached = maxProjects !== null && projects.length >= maxProjects;

        if (!isLimitReached) return null;

        return (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-950">
                  Limite de {maxProjects} projetos ativos atingido no plano {userPlan.name}.
                </p>
                <p className="text-xs text-amber-800 mt-0.5">
                  Seus {projects.length} projetos existentes continuam 100% seguros, editáveis e exportáveis. Para criar novos projetos, realize upgrade de plano.
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="bg-[#0f4f49] hover:bg-[#156961] text-white font-bold shrink-0">
              <Link to="/subscription">Ver planos & Upgrade</Link>
            </Button>
          </div>
        );
      })()}

      {/* Barra de Busca, Filtro de Status, Seletor de Divisão e Ações */}
      <section className="rounded-2xl border border-[#E5EBF1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#E5EBF1] p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
            <label className="relative min-w-0 flex-1 md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por projeto, cliente ou tipo"
                className="h-10 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] pl-9 text-sm focus:bg-white"
              />
            </label>

            <label className="flex h-10 items-center gap-2 rounded-xl border border-[#E5EBF1] bg-white px-3 text-sm font-semibold text-[#101828] shrink-0">
              <SlidersHorizontal className="h-4 w-4 text-[#64748B]" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="bg-transparent text-sm font-semibold outline-none"
                aria-label="Filtrar por status"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "Todos os status" : formatProjectStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            {/* Abas de Separação por Disciplina */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-1">
              <button
                type="button"
                onClick={() => setCategoryView("split")}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold transition-all ${
                  categoryView === "split"
                    ? "bg-white text-[#006F51] shadow-xs ring-1 ring-[#00D98A]/35"
                    : "text-[#64748B] hover:text-[#101828]"
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
                <span>Meio a Meio</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryView("electrical")}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold transition-all ${
                  categoryView === "electrical"
                    ? "bg-white text-blue-700 shadow-xs ring-1 ring-blue-200"
                    : "text-[#64748B] hover:text-[#101828]"
                }`}
              >
                <Zap className="h-3.5 w-3.5 text-blue-600" />
                <span>Projetos Elétricos</span>
                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-700">
                  {electricalProjects.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryView("solar")}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold transition-all ${
                  categoryView === "solar"
                    ? "bg-white text-amber-700 shadow-xs ring-1 ring-amber-200"
                    : "text-[#64748B] hover:text-[#101828]"
                }`}
              >
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>Projetos Solares</span>
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
                  {solarProjects.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryView("all")}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold transition-all ${
                  categoryView === "all"
                    ? "bg-white text-[#101828] shadow-xs"
                    : "text-[#64748B] hover:text-[#101828]"
                }`}
              >
                <span>Todos</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-700">
                  {filteredProjects.length}
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 xl:justify-end">
            {selectedIds.length === 1 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/projects/${selectedIds[0]}`)}
                  className="h-10 rounded-xl border-[#00D98A] bg-[#DDFCF0] text-sm font-bold text-[#006F51] hover:bg-[#c5f9e5]"
                >
                  <FolderOpen className="h-4 w-4 mr-1.5" />
                  Abrir
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const p = projects.find((item) => item.id === selectedIds[0]);
                    if (p) handleEdit(p);
                  }}
                  className="h-10 rounded-xl border-[#E5EBF1] bg-white text-sm font-bold text-[#101828] hover:bg-[#F6F9FC]"
                >
                  <Edit3 className="h-4 w-4 mr-1.5 text-[#006F51]" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDuplicate(selectedIds[0])}
                  disabled={duplicating}
                  className="h-10 rounded-xl border-[#E5EBF1] bg-white text-sm font-bold text-[#101828] hover:bg-[#F6F9FC]"
                >
                  <Copy className="h-4 w-4 mr-1.5 text-[#006F51]" />
                  Duplicar
                </Button>
              </div>
            )}
            {selectedIds.length > 0 && (
              <Button variant="outline" onClick={handleBulkDelete} className="h-10 rounded-xl border-red-200 text-sm font-bold text-[#EF4444] hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
                Excluir {selectedIds.length}
              </Button>
            )}
            <div className="flex rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-1">
              <button
                type="button"
                aria-label="Visualização em tabela"
                onClick={() => setViewMode("table")}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${viewMode === "table" ? "bg-white text-[#006F51] shadow-xs" : "text-[#64748B]"}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Visualização em cartões"
                onClick={() => setViewMode("cards")}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${viewMode === "cards" ? "bg-white text-[#006F51] shadow-xs" : "text-[#64748B]"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            Falha ao carregar projetos. Verifique a conexão com o backend e tente novamente.
            <Button variant="outline" onClick={load} className="ml-0 mt-3 h-9 rounded-[8px] border-red-200 bg-white text-red-700 hover:bg-red-50 sm:ml-3 sm:mt-0">
              Tentar novamente
            </Button>
          </div>
        )}

        {loading ? (
          <ProjectLoading />
        ) : projects.length === 0 ? (
          <EmptyProjects />
        ) : filteredProjects.length === 0 ? (
          <FilteredEmpty query={query} />
        ) : categoryView === "split" ? (
          /* Visualização Dividida Meio a Meio: Projetos Elétricos (50%) | Projetos Solares (50%) */
          <div className="grid grid-cols-1 gap-5 p-4 xl:grid-cols-2 bg-[#F8FAFC]/60">
            {/* Coluna 1: Projetos Elétricos */}
            <DisciplineSection
              title="Projetos Elétricos"
              badge="Instalações Elétricas • NBR 5410"
              subtitle="Planta elétrica, circuitos, quadros de distribuição e diagrama unifilar"
              icon={Zap}
              variant="electrical"
              newProjectHref="/projects/new?type=eletrico"
              newProjectLabel="Novo Elétrico"
              projects={electricalProjects}
              viewMode={viewMode}
              selectedIds={selectedIds}
              onToggleGroup={() => toggleGroupSelection(electricalProjects)}
              onToggleSelected={toggleSelected}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />

            {/* Coluna 2: Projetos Solares */}
            <DisciplineSection
              title="Projetos Solares"
              badge="Projeto Solar Fotovoltaico"
              subtitle="Dimensionamento solar, inversores, geração fotovoltaica e memorial"
              icon={Sun}
              variant="solar"
              newProjectHref="/projects/new?type=solar"
              newProjectLabel="Novo Solar"
              projects={solarProjects}
              viewMode={viewMode}
              selectedIds={selectedIds}
              onToggleGroup={() => toggleGroupSelection(solarProjects)}
              onToggleSelected={toggleSelected}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          </div>
        ) : viewMode === "cards" ? (
          <div key={`cards-${statusFilter}-${categoryView}`} className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-3 crud-tab-enter">
            {visibleProjectsForSingleView.length === 0 ? (
              <div className="col-span-full">
                <FilteredEmpty query={query} />
              </div>
            ) : (
              visibleProjectsForSingleView.map((project, idx) => (
                <div
                  key={project.id}
                  className="crud-card-enter"
                  style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                >
                  <ProjectCard
                    project={project}
                    selected={selectedIds.includes(project.id)}
                    onSelect={() => toggleSelected(project.id)}
                    onEdit={handleEdit}
                    onDuplicate={handleDuplicate}
                    onDelete={() => handleDelete(project.id)}
                  />
                </div>
              ))
            )}
          </div>
        ) : (
          <div key={`table-${statusFilter}-${categoryView}`} className="crud-tab-enter">
            {visibleProjectsForSingleView.length === 0 ? (
              <FilteredEmpty query={query} />
            ) : (
              <ProjectTable
                projects={visibleProjectsForSingleView}
                selectedIds={selectedIds}
                allSelected={
                  visibleProjectsForSingleView.length > 0 &&
                  visibleProjectsForSingleView.every((project) => selectedIds.includes(project.id))
                }
                onToggleAll={() => toggleGroupSelection(visibleProjectsForSingleView)}
                onToggleSelected={toggleSelected}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            )}
          </div>
        )}
      </section>

      <EditProjectModal
        isOpen={Boolean(editingProject)}
        onClose={() => setEditingProject(null)}
        project={editingProject}
        onSuccess={() => {
          setEditingProject(null);
          load();
        }}
      />

      <AlertDialog open={Boolean(projectToDelete)} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-[#0F172A]">
              {projectToDelete?.isBulk
                ? `Excluir ${projectToDelete.count} projetos selecionados?`
                : `Excluir o projeto "${projectToDelete?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-[#64748B] leading-relaxed">
              Esta ação é permanente e não pode ser desfeita. Todos os circuitos elétricos, diagramas unifilares, memoriais descritivos e orçamentos vinculados serão permanentemente excluídos do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              className="h-9 rounded-xl border-[#E2E8F0] bg-white px-4 text-xs font-bold text-[#475467] hover:bg-[#F8FAFC]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAction}
              className="h-9 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700 shadow-sm transition"
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DisciplineSection({
  title,
  badge,
  subtitle,
  icon: SectionIcon,
  variant,
  newProjectHref,
  newProjectLabel,
  projects,
  viewMode,
  selectedIds,
  onToggleGroup,
  onToggleSelected,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const isSolar = variant === "solar";
  const allSectionSelected =
    projects.length > 0 && projects.every((project) => selectedIds.includes(project.id));

  const theme = isSolar
    ? {
        wrapper: "border-amber-200/80 bg-white",
        headerBg: "border-b border-amber-100 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-white",
        iconBox: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
        badgePill: "border-amber-200 bg-amber-50 text-amber-800",
        countPill: "bg-amber-100 text-amber-900",
        addBtn: "border-amber-200 bg-white text-amber-800 hover:bg-amber-50",
        emptyIcon: "bg-amber-50 text-amber-600",
      }
    : {
        wrapper: "border-blue-200/80 bg-white",
        headerBg: "border-b border-blue-100 bg-gradient-to-r from-blue-50/80 via-slate-50/40 to-white",
        iconBox: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
        badgePill: "border-blue-200 bg-blue-50 text-blue-800",
        countPill: "bg-blue-100 text-blue-900",
        addBtn: "border-blue-200 bg-white text-blue-800 hover:bg-blue-50",
        emptyIcon: "bg-blue-50 text-blue-600",
      };

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border shadow-xs ${theme.wrapper}`}>
      {/* Cabeçalho da Coluna */}
      <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 ${theme.headerBg}`}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.iconBox}`}>
            <SectionIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-[#101828]">{title}</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${theme.badgePill}`}>
                {badge}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-black ${theme.countPill}`}>
                {projects.length}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-[#64748B]">{subtitle}</p>
          </div>
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className={`h-8 rounded-lg border text-xs font-extrabold shrink-0 ${theme.addBtn}`}
        >
          <Link to={newProjectHref}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {newProjectLabel}
          </Link>
        </Button>
      </div>

      {/* Corpo da Coluna */}
      {projects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme.emptyIcon}`}>
            <SectionIcon className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-sm font-extrabold text-[#101828]">
            Nenhum {isSolar ? "projeto solar" : "projeto elétrico"} encontrado
          </h3>
          <p className="mt-1 max-w-xs text-xs font-medium text-[#667085]">
            {isSolar
              ? "Crie um projeto solar fotovoltaico para dimensionar módulos, inversores e geração."
              : "Crie um projeto de instalações elétricas para planta, circuitos, quadro e diagrama."}
          </p>
          <Button asChild variant="outline" size="sm" className={`mt-4 h-8 rounded-lg text-xs font-extrabold ${theme.addBtn}`}>
            <Link to={newProjectHref}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {newProjectLabel}
            </Link>
          </Button>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              selected={selectedIds.includes(project.id)}
              onSelect={() => onToggleSelected(project.id)}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={() => onDelete(project.id)}
            />
          ))}
        </div>
      ) : (
        <ProjectTable
          projects={projects}
          selectedIds={selectedIds}
          allSelected={allSectionSelected}
          onToggleAll={onToggleGroup}
          onToggleSelected={onToggleSelected}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          compactSplit
        />
      )}
    </div>
  );
}

function ProjectLoading() {
  return <BrandLoadingScreen compact className="py-16" />;
}

function EmptyProjects() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#E8FCF8] text-[#00d8b8]">
        <FolderOpen className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-[#101828]">Nenhum projeto criado</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-6 text-[#667085]">
        Crie o primeiro projeto para organizar planta, circuitos, quadro, materiais e documentação técnica.
      </p>
      <Button asChild className="mt-5 h-10 rounded-[8px] font-extrabold">
        <Link to="/projects/new">
          <Plus className="h-4 w-4" />
          Criar primeiro projeto
        </Link>
      </Button>
    </div>
  );
}

function FilteredEmpty({ query }) {
  return (
    <div className="px-6 py-14 text-center">
      <h2 className="text-lg font-extrabold text-[#101828]">Nenhum projeto encontrado</h2>
      <p className="mt-2 text-sm font-medium text-[#667085]">
        Ajuste a busca{query ? ` por "${query}"` : ""} ou remova o filtro de status.
      </p>
    </div>
  );
}

function ProjectTable({
  projects,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggleSelected,
  onEdit,
  onDuplicate,
  onDelete,
  compactSplit = false,
}) {
  const navigate = useNavigate();

  if (compactSplit) {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
              <TableHead className="w-9 px-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Selecionar todos os projetos desta seção"
                  className="h-4 w-4 rounded border-[#D0D5DD]"
                />
              </TableHead>
              <TableHead className="px-3 text-[11px] font-extrabold uppercase tracking-[0.06em]">
                Projeto / Cliente
              </TableHead>
              <TableHead className="px-3 text-[11px] font-extrabold uppercase tracking-[0.06em]">
                Status / Data
              </TableHead>
              <TableHead className="px-3 text-right text-[11px] font-extrabold uppercase tracking-[0.06em]">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const isSolar = isSolarProjectType(project);
              return (
                <TableRow
                  key={project.id}
                  className="hover:bg-[#F9FAFB] cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <TableCell className="px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(project.id)}
                      onChange={() => onToggleSelected(project.id)}
                      aria-label={`Selecionar ${project.name}`}
                      className="h-4 w-4 rounded border-[#D0D5DD]"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-3.5">
                    <Link to={`/projects/${project.id}`} className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
                          projectToneStyles[getProjectTone(project)].icon
                        }`}
                      >
                        {isSolar ? <Sun className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-[#101828] hover:text-[#00d8b8] transition-colors">
                          {project.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-[#475467]">
                          {project.client_name || "Sem cliente"}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-medium text-[#667085]">
                          {isSolar ? "Projeto Solar" : project.project_type || "Instalações Elétricas"} •{" "}
                          {project.supply_type || "Sem alimentação"} •{" "}
                          {project.voltage ? `${project.voltage}V` : "Sem tensão"}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-3.5">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={project.status} />
                      <span className="text-[11px] font-medium text-[#667085]">
                        {formatProjectDate(project)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <ProjectActions
                      project={project}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onDelete={() => onDelete(project.id)}
                      align="end"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
            <TableHead className="w-10 px-4">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Selecionar todos os projetos filtrados"
                className="h-4 w-4 rounded border-[#D0D5DD]"
              />
            </TableHead>
            <TableHead className="min-w-[260px] px-4 text-xs font-extrabold uppercase tracking-[0.06em]">Projeto</TableHead>
            <TableHead className="px-4 text-xs font-extrabold uppercase tracking-[0.06em]">Cliente</TableHead>
            <TableHead className="px-4 text-xs font-extrabold uppercase tracking-[0.06em]">Status</TableHead>
            <TableHead className="px-4 text-xs font-extrabold uppercase tracking-[0.06em]">Atualizado</TableHead>
            <TableHead className="px-4 text-right text-xs font-extrabold uppercase tracking-[0.06em]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const isSolar = isSolarProjectType(project);
            return (
              <TableRow
                key={project.id}
                className="hover:bg-[#F9FAFB] cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(project.id)}
                    onChange={() => onToggleSelected(project.id)}
                    aria-label={`Selecionar ${project.name}`}
                    className="h-4 w-4 rounded border-[#D0D5DD]"
                  />
                </TableCell>
                <TableCell className="px-4 py-4">
                  <Link to={`/projects/${project.id}`} className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${projectToneStyles[getProjectTone(project)].icon}`}>
                      {isSolar ? <Sun className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-[#101828] hover:text-[#00d8b8] transition-colors">{project.name}</span>
                      <span className="mt-1 block truncate text-xs font-medium text-[#667085]">
                        {isSolar ? "Projeto Solar" : project.project_type || "Instalações Elétricas"} - {project.supply_type || "Sem alimentação"} - {project.voltage ? `${project.voltage}V` : "Sem tensão"}
                      </span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="px-4 text-sm font-medium text-[#667085]">{project.client_name || "Sem cliente"}</TableCell>
                <TableCell className="px-4">
                  <StatusBadge status={project.status} />
                </TableCell>
                <TableCell className="px-4 text-sm font-medium text-[#667085]">{formatProjectDate(project)}</TableCell>
                <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                  <ProjectActions
                    project={project}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onDelete={() => onDelete(project.id)}
                    align="end"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ProjectCard({ project, selected, onSelect, onEdit, onDuplicate, onDelete }) {
  const navigate = useNavigate();
  const circuitCount = project?.circuits?.length || 0;
  const tone = projectToneStyles[getProjectTone(project)] || projectToneStyles.blue;
  const isSolar = isSolarProjectType(project);

  return (
    <article
      onClick={() => navigate(`/projects/${project.id}`)}
      className={`relative overflow-hidden rounded-[12px] border p-4 cursor-pointer crud-card-hover ${tone.card}`}
    >
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${tone.rail}`} />
      <div className="flex items-start justify-between gap-3">
        <Link to={`/projects/${project.id}`} className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${tone.icon}`}>
            {isSolar ? <Sun className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold text-[#101828] hover:text-[#00d8b8] transition-colors">{project.name}</span>
            <span className="mt-1 block truncate text-xs font-medium text-[#667085]">{project.client_name || "Sem cliente"}</span>
          </span>
        </Link>
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            aria-label={`Selecionar ${project.name}`}
            className="h-4 w-4 shrink-0 rounded border-[#D0D5DD]"
          />
        </div>
      </div>

      <div className="mt-3">
        <ProjectProgress project={project} variant="compact" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-[#667085]">
        <InfoPill label="Tipo" value={isSolar ? "Projeto Solar" : project.project_type || "Instalações Elétricas"} />
        <InfoPill label="Circuitos" value={circuitCount} />
        <InfoPill label="Alimentação" value={project.supply_type || "Não definida"} />
        <InfoPill label="Atualizado" value={formatProjectDate(project)} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <StatusBadge status={project.status} />
        <ProjectActions
          project={project}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          align="end"
        />
      </div>
    </article>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-[8px] border border-[#EAECF0] bg-[#F9FAFB] px-3 py-2">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#98A2B3]">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-[#344054]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return <ProjectStatusBadge status={status} />;
}

function ProjectActions({ project, onEdit, onDuplicate, onDelete, align = "end" }) {
  const actions = getProjectActions(project);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <TooltipProvider delayDuration={160}>
        {actions.slice(0, 4).map((action) => {
          const ActionIcon = action.icon;
          return (
            <Tooltip key={action.href}>
              <TooltipTrigger asChild>
                <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-[8px] border-[#D0D5DD] bg-white text-[#344054] shadow-none hover:bg-[#F9FAFB]">
                  <Link to={action.href} aria-label={action.label}>
                    <ActionIcon className="h-4 w-4" />
                    <span className="sr-only">{action.label}</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{action.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[8px] text-[#667085] hover:bg-[#F2F4F7]" aria-label="Mais opções">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-56 rounded-[10px] border-[#E4E7EC] bg-white p-1 shadow-lg">
          {actions.slice(4).map((action) => {
            const ActionIcon = action.icon;
            return (
              <DropdownMenuItem key={action.href} asChild>
                <Link to={action.href} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold">
                  <ActionIcon className="h-4 w-4" />
                  {action.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
          {onEdit && (
            <DropdownMenuItem
              onClick={() => onEdit(project)}
              className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold text-slate-800 focus:bg-slate-50"
            >
              <Edit3 className="h-4 w-4 text-[#00d8b8]" />
              Editar dados
            </DropdownMenuItem>
          )}
          {onDuplicate && (
            <DropdownMenuItem
              onClick={() => onDuplicate(project.id)}
              className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold text-slate-800 focus:bg-slate-50"
            >
              <Copy className="h-4 w-4 text-[#00d8b8]" />
              Duplicar projeto
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onDelete} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold text-red-600 focus:text-red-600">
            <Trash2 className="h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
