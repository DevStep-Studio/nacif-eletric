import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CircuitFormDialog from "@/components/CircuitFormDialog";
import CircuitCard from "./CircuitCard";
import { cn } from "@/lib/utils";

/**
 * Área operacional de circuitos com barra de ferramentas (busca, filtros e ordenação) e lista expansível.
 */
export default function CircuitList({
  circuits = [],
  saving = false,
  onAddCircuit,
  onEditCircuit,
  onRemoveCircuit,
  highlightedIndex = null,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("order");
  const [viewMode, setViewMode] = useState("cards");
  const [expandedMap, setExpandedMap] = useState({});

  const availableTypes = useMemo(() => {
    const set = new Set();
    circuits.forEach((c) => {
      if (c?.type) set.add(c.type);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [circuits]);

  const availablePhases = useMemo(() => {
    const set = new Set();
    circuits.forEach((c) => {
      if (c?.phase) set.add(c.phase);
    });
    return Array.from(set).sort();
  }, [circuits]);

  const filteredItems = useMemo(() => {
    const indexed = circuits.map((circuit, originalIndex) => ({ circuit, originalIndex }));
    const q = searchQuery.trim().toLowerCase();

    const filtered = indexed.filter(({ circuit, originalIndex }) => {
      if (phaseFilter !== "all" && (circuit.phase || "A") !== phaseFilter) return false;
      if (typeFilter !== "all" && (circuit.type || "") !== typeFilter) return false;
      if (statusFilter === "ok" && circuit.voltage_drop_ok === false) return false;
      if (statusFilter === "attention" && circuit.voltage_drop_ok !== false) return false;

      if (q) {
        const code = `c${String(originalIndex + 1).padStart(2, "0")}`;
        const haystack = [
          code,
          circuit.name,
          circuit.type,
          circuit.description,
          circuit.wire_gauge,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    if (sortBy === "power_desc") {
      filtered.sort((a, b) => (Number(b.circuit.power_w) || 0) - (Number(a.circuit.power_w) || 0));
    } else if (sortBy === "current_desc") {
      filtered.sort(
        (a, b) =>
          (Number(b.circuit.project_current_a) || 0) - (Number(a.circuit.project_current_a) || 0)
      );
    } else if (sortBy === "name_asc") {
      filtered.sort((a, b) =>
        String(a.circuit.name || "").localeCompare(String(b.circuit.name || ""))
      );
    }

    return filtered;
  }, [circuits, searchQuery, phaseFilter, typeFilter, statusFilter, sortBy]);

  const toggleExpand = (idx) => {
    setExpandedMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    phaseFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    sortBy !== "order";

  return (
    <section className="space-y-3">
      {/* Cabeçalho Operacional de Circuitos (Sólido, sem gradiente) */}
      <div className="rounded-2xl border border-[#E5EBF1] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
              <Zap className="h-[18px] w-[18px] stroke-[2.1]" />
            </span>
            <div>
              <h2 className="text-[16px] font-extrabold text-[#101828] leading-tight">
                Circuitos
              </h2>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                {circuits.length} circuito{circuits.length === 1 ? "" : "s"} configurado
                {circuits.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <CircuitFormDialog
            onSave={onAddCircuit}
            saving={saving}
            trigger={
              <Button
                type="button"
                size="sm"
                disabled={saving}
                className="h-9 rounded-xl bg-[#00D98A] px-4 text-xs font-extrabold text-[#031923] hover:bg-[#00C987]"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Novo circuito
              </Button>
            }
          />
        </div>

        {/* Barra de Ferramentas: Pesquisa, Filtros Reais e Alternância Lista/Cards */}
        {circuits.length > 0 && (
          <div className="mt-3.5 grid grid-cols-1 gap-2 border-t border-[#E5EBF1] pt-3.5 md:grid-cols-2 lg:grid-cols-[minmax(200px,1.4fr)_auto_auto_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar circuito por código, nome ou cabo..."
                aria-label="Pesquisar circuitos"
                className="h-9 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] pl-8 text-xs focus:border-[#00D98A] focus:bg-white"
              />
            </div>

            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="h-9 w-full lg:w-[130px] rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs font-semibold">
                <SelectValue placeholder="Fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fases</SelectItem>
                {availablePhases.map((ph) => (
                  <SelectItem key={ph} value={ph}>
                    {ph === "ABC" ? "Trifásico ABC" : `Fase ${ph}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 w-full lg:w-[155px] rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs font-semibold">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full lg:w-[156px] rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs font-semibold">
                <SelectValue placeholder="Verificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="ok">Conforme</SelectItem>
                <SelectItem value="attention">Com pendência</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 w-full lg:w-[154px] rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs font-semibold">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order">Ordem do projeto</SelectItem>
                <SelectItem value="power_desc">Maior potência</SelectItem>
                <SelectItem value="current_desc">Maior corrente</SelectItem>
                <SelectItem value="name_asc">Nome (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            <div className="inline-flex h-9 items-center rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-0.5 justify-self-start lg:justify-self-end">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Visualização em cards"
                className={cn(
                  "flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition",
                  viewMode === "cards"
                    ? "bg-white text-[#101828] shadow-2xs"
                    : "text-[#64748B] hover:text-[#101828]"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="Visualização em lista"
                className={cn(
                  "flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition",
                  viewMode === "list"
                    ? "bg-white text-[#101828] shadow-2xs"
                    : "text-[#64748B] hover:text-[#101828]"
                )}
              >
                <List className="h-3.5 w-3.5" />
                <span>Lista</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Circuitos */}
      {circuits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#BEEAD2] bg-white px-6 py-10 text-center">
          <Zap className="mx-auto mb-2.5 h-8 w-8 text-[#00D98A]" />
          <p className="text-sm font-extrabold text-[#101828]">Nenhum circuito cadastrado</p>
          <p className="mt-1 text-xs font-medium text-[#64748B]">
            Adicione circuitos para calcular proteção, distribuição de fases e verificações NBR.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-[#E5EBF1] bg-white px-6 py-8 text-center">
          <p className="text-sm font-bold text-[#101828]">Nenhum circuito encontrado com os filtros atuais.</p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPhaseFilter("all");
                setTypeFilter("all");
                setStatusFilter("all");
                setSortBy("order");
              }}
              className="mt-2 text-xs font-bold text-[#006B50] hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === "list" ? "space-y-2" : "space-y-3"}>
          {filteredItems.map(({ circuit, originalIndex }) => (
            <CircuitCard
              key={`${circuit.id || circuit.name || "c"}-${originalIndex}`}
              circuit={circuit}
              index={originalIndex}
              expanded={Boolean(expandedMap[originalIndex] || highlightedIndex === originalIndex)}
              highlighted={highlightedIndex === originalIndex}
              onToggleExpand={() => toggleExpand(originalIndex)}
              onEdit={(calc) => onEditCircuit(originalIndex, calc)}
              onRemove={() => onRemoveCircuit(originalIndex, circuit)}
              saving={saving}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}
    </section>
  );
}
