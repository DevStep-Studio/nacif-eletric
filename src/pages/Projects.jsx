import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/PageHeader";

const statusStyles = {
  Rascunho: "border-[#BCEEE5] bg-[#E8FCF8] text-[#0f4f49]",
  "Em Andamento": "border-[#BCEEE5] bg-[#E8FCF8] text-[#0f4f49]",
  "Concluído": "border-[#BCEEE5] bg-[#E8FCF8] text-[#0f4f49]",
  Aprovado: "border-[#BCEEE5] bg-[#E8FCF8] text-[#0f4f49]",
  Arquivado: "border-[#BCEEE5] bg-[#E8FCF8] text-[#0f4f49]",
};

const projectToneStyles = {
  blue: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  cyan: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  green: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  amber: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  slate: {
    card: "border-[#BCEEE5] bg-[#F7FBFE] hover:border-[#7DBDDF]",
    icon: "bg-[#E8FCF8] text-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
};

const getProjectTone = (project) => {
  const status = normalizeText(project?.status);
  if (project?.project_type === "Solar") return "amber";
  if (status.includes("concluido") || status.includes("aprovado")) return "green";
  if (status.includes("andamento")) return "cyan";
  if (status.includes("arquivado")) return "slate";
  return "blue";
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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
  ...(project.project_type === "Solar" ? [{ label: "Projeto solar", icon: Sun, href: `/solar-project?project=${project.id}` }] : []),
  { label: "Planta", icon: Map, href: `/planta-ia?project=${project.id}` },
  { label: "Circuitos", icon: PencilLine, href: `/circuit-editor?project=${project.id}` },
  { label: "Quadro", icon: Grid2X2, href: `/panel-generator?project=${project.id}` },
  { label: "Diagrama", icon: GitBranch, href: `/unifilar?project=${project.id}` },
  { label: "Materiais", icon: BarChart3, href: `/materials?project=${project.id}` },
  { label: "Memorial", icon: FileText, href: `/memorial?project=${project.id}` },
];

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("table");
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await backend.entities.Project.list("-updated_date", 100);
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Falha ao carregar projetos:", err);
      if (err?.status === 401) {
        window.location.href = "/login";
      }
      setProjects([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  const allFilteredSelected = filteredProjects.length > 0 && filteredProjects.every((project) => selectedIds.includes(project.id));

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Excluir este projeto? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    await backend.entities.Project.delete(id);
    setSelectedIds((ids) => ids.filter((selectedId) => selectedId !== id));
    load();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(`Excluir ${selectedIds.length} projeto(s) selecionado(s)? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    await Promise.all(selectedIds.map((id) => backend.entities.Project.delete(id)));
    setSelectedIds([]);
    load();
  };

  const toggleSelected = (id) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((selectedId) => selectedId !== id) : [...ids, id]));
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((ids) => ids.filter((id) => !filteredProjects.some((project) => project.id === id)));
      return;
    }

    setSelectedIds((ids) => Array.from(new Set([...ids, ...filteredProjects.map((project) => project.id)])));
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-20">
      <PageHeader
        icon={FolderOpen}
        title="Projetos"
        subtitle="Gerencie projetos, clientes, status técnico e documentação."
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

      <section className="rounded-[12px] border border-[#E4E7EC] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#EAECF0] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
            <label className="relative min-w-0 flex-1 md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por projeto, cliente ou tipo"
                className="h-10 rounded-[8px] border-[#D0D5DD] pl-9 text-sm"
              />
            </label>

            <label className="flex h-10 items-center gap-2 rounded-[8px] border border-[#D0D5DD] bg-white px-3 text-sm font-semibold text-[#344054]">
              <SlidersHorizontal className="h-4 w-4 text-[#667085]" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="bg-transparent text-sm font-semibold outline-none"
                aria-label="Filtrar por status"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "Todos os status" : status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 lg:justify-end">
            {selectedIds.length > 0 && (
              <Button variant="outline" onClick={handleBulkDelete} className="h-10 rounded-[8px] border-red-200 text-sm font-extrabold text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
                Excluir {selectedIds.length}
              </Button>
            )}
            <div className="flex rounded-[8px] border border-[#D0D5DD] bg-white p-1">
              <button
                type="button"
                aria-label="Visualização em tabela"
                onClick={() => setViewMode("table")}
                className={`flex h-8 w-8 items-center justify-center rounded-[6px] ${viewMode === "table" ? "bg-[#E8FCF8] text-[#00d8b8]" : "text-[#667085]"}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Visualização em cartões"
                onClick={() => setViewMode("cards")}
                className={`flex h-8 w-8 items-center justify-center rounded-[6px] ${viewMode === "cards" ? "bg-[#E8FCF8] text-[#00d8b8]" : "text-[#667085]"}`}
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
        ) : viewMode === "cards" ? (
          <div className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} selected={selectedIds.includes(project.id)} onSelect={() => toggleSelected(project.id)} onDelete={() => handleDelete(project.id)} />
            ))}
          </div>
        ) : (
          <ProjectTable
            projects={filteredProjects}
            selectedIds={selectedIds}
            allSelected={allFilteredSelected}
            onToggleAll={toggleAllFiltered}
            onToggleSelected={toggleSelected}
            onDelete={handleDelete}
          />
        )}
      </section>
    </div>
  );
}

function ProjectLoading() {
  return (
    <div className="p-4">
      <p className="text-sm font-extrabold text-[#101828]">Carregando projetos</p>
      <p className="mt-1 text-sm font-medium text-[#667085]">Buscando projetos reais do workspace.</p>
      <div className="mt-5 space-y-3">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-16 rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB]" />
        ))}
      </div>
    </div>
  );
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

function ProjectTable({ projects, selectedIds, allSelected, onToggleAll, onToggleSelected, onDelete }) {
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
          {projects.map((project) => (
            <TableRow key={project.id} className="hover:bg-[#F9FAFB]">
              <TableCell className="px-4">
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
                    {project.project_type === "Solar" ? <Sun className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-[#101828]">{project.name}</span>
                    <span className="mt-1 block truncate text-xs font-medium text-[#667085]">
                      {project.project_type || "Instalações elétricas"} - {project.supply_type || "Sem alimentação"} - {project.voltage ? `${project.voltage}V` : "Sem tensão"}
                    </span>
                  </span>
                </Link>
              </TableCell>
              <TableCell className="px-4 text-sm font-medium text-[#667085]">{project.client_name || "Sem cliente"}</TableCell>
              <TableCell className="px-4">
                <StatusBadge status={project.status} />
              </TableCell>
              <TableCell className="px-4 text-sm font-medium text-[#667085]">{formatProjectDate(project)}</TableCell>
              <TableCell className="px-4">
                <ProjectActions project={project} onDelete={() => onDelete(project.id)} align="end" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProjectCard({ project, selected, onSelect, onDelete }) {
  const circuitCount = project?.circuits?.length || 0;
  const tone = projectToneStyles[getProjectTone(project)] || projectToneStyles.blue;

  return (
    <article className={`relative overflow-hidden rounded-[12px] border p-4 transition ${tone.card}`}>
      <span className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${tone.rail}`} />
      <div className="flex items-start justify-between gap-3">
        <Link to={`/projects/${project.id}`} className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${tone.icon}`}>
            {project.project_type === "Solar" ? <Sun className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold text-[#101828]">{project.name}</span>
            <span className="mt-1 block truncate text-xs font-medium text-[#667085]">{project.client_name || "Sem cliente"}</span>
          </span>
        </Link>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Selecionar ${project.name}`}
          className="h-4 w-4 shrink-0 rounded border-[#D0D5DD]"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-[#667085]">
        <InfoPill label="Tipo" value={project.project_type || "Elétrico"} />
        <InfoPill label="Circuitos" value={circuitCount} />
        <InfoPill label="Alimentação" value={project.supply_type || "Não definida"} />
        <InfoPill label="Atualizado" value={formatProjectDate(project)} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <StatusBadge status={project.status} />
        <ProjectActions project={project} onDelete={onDelete} align="end" />
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
  const normalized = status || "Rascunho";
  return (
    <Badge className={`h-8 rounded-[8px] border px-3 text-xs font-extrabold ${statusStyles[normalized] || statusStyles.Rascunho}`}>
      {normalized}
    </Badge>
  );
}

function ProjectActions({ project, onDelete, align = "end" }) {
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
        <DropdownMenuContent align={align} className="w-56 rounded-[10px] border-[#E4E7EC] bg-white p-1">
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
          <DropdownMenuItem onClick={onDelete} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-bold text-red-600 focus:text-red-600">
            <Trash2 className="h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
