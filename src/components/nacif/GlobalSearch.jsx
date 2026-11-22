import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Calculator,
  Compass,
  FileSpreadsheet,
  FolderOpen,
  GitBranch,
  LayoutGrid,
  Plus,
  Sparkles,
  Sun,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const NBR_QUICK_ENTRIES = [
  { id: "nbr5410", label: "NBR 5410 — Instalações Elétricas de Baixa Tensão", path: "/nbr-library" },
  { id: "nbr16690", label: "NBR 16690 — Instalações Elétricas de Arranjos Fotovoltaicos", path: "/nbr-library" },
  { id: "nbr5419", label: "NBR 5419 — Proteção contra Descargas Atmosféricas (SPDA)", path: "/nbr-library" },
  { id: "nbr14039", label: "NBR 14039 — Instalações Elétricas de Média Tensão", path: "/nbr-library" },
];

export default function GlobalSearch({
  open,
  onOpenChange,
  searchValue,
  onSearchValueChange,
  projects = [],
  effectiveProjectId = null,
}) {
  const navigate = useNavigate();

  const goTo = (path) => {
    onOpenChange(false);
    navigate(path);
  };

  const projectQuery = effectiveProjectId ? `?project=${effectiveProjectId}` : "";

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar projetos, normas NBR, ferramentas..."
        value={searchValue}
        onValueChange={onSearchValueChange}
      />
      <CommandList>
        <CommandEmpty>Nenhum projeto, norma ou ferramenta encontrado.</CommandEmpty>

        <CommandGroup heading="Ferramentas de Engenharia">
          <CommandItem onSelect={() => goTo("/projects/new")}>
            <Plus className="mr-2 h-4 w-4 text-[#00D98A]" />
            <span>Novo projeto</span>
          </CommandItem>
          <CommandItem onSelect={() => goTo(`/planta-ia${projectQuery}`)}>
            <Compass className="mr-2 h-4 w-4 text-[#00D98A]" />
            <span>Planta Elétrica</span>
          </CommandItem>
          <CommandItem onSelect={() => goTo(`/panel-generator${projectQuery}`)}>
            <LayoutGrid className="mr-2 h-4 w-4 text-[#00D98A]" />
            <span>Quadro Elétrico</span>
          </CommandItem>
          <CommandItem onSelect={() => goTo(`/solar-project${projectQuery}`)}>
            <Sun className="mr-2 h-4 w-4 text-[#00D98A]" />
            <span>Projeto Solar</span>
          </CommandItem>
          <CommandItem onSelect={() => goTo(`/unifilar${projectQuery}`)}>
            <GitBranch className="mr-2 h-4 w-4 text-[#00D98A]" />
            <span>Diagrama Unifilar</span>
          </CommandItem>
          <CommandItem onSelect={() => goTo("/simulations")}>
            <Sparkles className="mr-2 h-4 w-4 text-[#5B4AE8]" />
            <span>Simulações e Nacif IA</span>
          </CommandItem>
          <CommandItem onSelect={() => goTo("/calculator")}>
            <Calculator className="mr-2 h-4 w-4 text-[#00D98A]" />
            <span>Calculadora NBR 5410</span>
          </CommandItem>
          <CommandItem onSelect={() => goTo(`/budget${projectQuery}`)}>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-[#00D98A]" />
            <span>Orçamento & Materiais</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Normas Técnicas (ABNT)">
          {NBR_QUICK_ENTRIES.map((nbr) => (
            <CommandItem key={nbr.id} onSelect={() => goTo(nbr.path)}>
              <BookOpen className="mr-2 h-4 w-4 text-[#006F51]" />
              <span>{nbr.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Seus Projetos">
              {projects.slice(0, 12).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name || ""} ${p.client_name || ""} ${p.city || ""}`}
                  onSelect={() => goTo(`/projects/${p.id}`)}
                >
                  <FolderOpen className="mr-2 h-4 w-4 text-[#00D98A]" />
                  <span>{p.name}</span>
                  {p.client_name && (
                    <span className="ml-2 text-xs text-[#64748B] truncate">{p.client_name}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
