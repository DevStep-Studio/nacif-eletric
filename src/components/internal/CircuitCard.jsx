import { AlertTriangle, ChevronDown, Edit3, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CircuitFormDialog from "@/components/CircuitFormDialog";
import CircuitDetails from "./CircuitDetails";
import { cn } from "@/lib/utils";

const numFmt = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const fmtNum = (val, suffix = "") => {
  const n = Number(val);
  if (!Number.isFinite(n)) return `0${suffix}`;
  return `${numFmt.format(n)}${suffix}`;
};

const fmtPower = (watts = 0) => {
  const v = Number(watts) || 0;
  return v >= 1000 ? `${fmtNum(v / 1000)} kW` : `${fmtNum(v)} W`;
};

const PHASE_BADGE = {
  A: "border-amber-200 bg-[#FFF3E6] text-amber-800",
  B: "border-blue-200 bg-[#EDF5FF] text-blue-800",
  C: "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]",
  AB: "border-[#DDD6FE] bg-[#F2EDFF] text-[#5B4AE8]",
  BC: "border-[#DDD6FE] bg-[#F2EDFF] text-[#5B4AE8]",
  AC: "border-[#DDD6FE] bg-[#F2EDFF] text-[#5B4AE8]",
  ABC: "border-[#DDD6FE] bg-[#F2EDFF] text-[#5B4AE8]",
};

/**
 * Cartão operacional compacto de circuito com resumo rápido e gaveta técnica expansível.
 */
export default function CircuitCard({
  circuit,
  index,
  expanded = false,
  onToggleExpand,
  onEdit,
  onRemove,
  saving = false,
  highlighted = false,
  viewMode = "cards", // "cards" | "list"
}) {
  const phase = circuit.phase || "A";
  const phaseLabel =
    phase === "ABC"
      ? "Fases ABC"
      : phase.length === 2
      ? `Fases ${phase.split("").join("/")}`
      : `Fase ${phase}`;

  const installedPower = Number(circuit.power_w) || 0;
  const demandFactor =
    circuit.demand_factor !== undefined && !Number.isNaN(Number(circuit.demand_factor))
      ? Number(circuit.demand_factor)
      : 1;
  const effectivePower =
    circuit.demand_power_w !== undefined && !Number.isNaN(Number(circuit.demand_power_w))
      ? Number(circuit.demand_power_w)
      : Math.round(installedPower * demandFactor);

  const ok = circuit.voltage_drop_ok !== false;

  return (
    <article
      id={`circuit-card-${index}`}
      className={cn(
        "rounded-2xl border bg-white transition-all shadow-[0_1px_2px_rgba(16,24,40,0.03)]",
        highlighted
          ? "border-[#00D98A] ring-2 ring-[#00D98A]/30"
          : ok
          ? "border-[#E5EBF1] hover:border-[#CBEAD9]"
          : "border-red-200 hover:border-red-300"
      )}
    >
      <div className={viewMode === "list" ? "px-4 py-3" : "p-4"}>
        {/* Cabeçalho compacto + Ações */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 shrink-0 items-center rounded-md border border-[#BEEAD2] bg-[#E5FBF2] px-2 text-[11px] font-extrabold text-[#006B50] tabular-nums">
                C{String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="truncate text-[15px] font-extrabold text-[#101828]">
                {circuit.name || "Circuito sem nome"}
              </h3>
              <span className="rounded-md border border-[#E5EBF1] bg-[#F6F9FC] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
                {circuit.type || "Circuito"}
              </span>
              <span
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-bold",
                  PHASE_BADGE[phase] || "border-[#E5EBF1] bg-[#F6F9FC] text-[#101828]"
                )}
              >
                {phaseLabel}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold",
                  ok
                    ? "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]"
                    : "border-red-200 bg-[#FEF2F2] text-[#EF4444]"
                )}
              >
                {ok ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {ok ? "Conforme" : `Revisar ΔU (${fmtNum(circuit.voltage_drop_pct, "%")})`}
              </span>
            </div>

            {circuit.description && !expanded && (
              <p className="mt-1 truncate text-xs font-medium text-[#64748B]">
                {circuit.description}
              </p>
            )}
          </div>

          {/* Ações sempre alinhadas à direita */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <CircuitFormDialog
              initialData={circuit}
              onSave={onEdit}
              saving={saving}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  className="h-8 rounded-lg border-[#E5EBF1] bg-white px-3 text-xs font-bold text-[#101828] hover:border-[#00D98A] hover:bg-[#E5FBF2] hover:text-[#006B50]"
                >
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                  Editar
                </Button>
              }
            />

            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5EBF1] bg-[#F6F9FC] px-2.5 text-xs font-bold text-[#101828] transition hover:border-[#00D98A] hover:bg-[#E5FBF2] hover:text-[#006B50]"
            >
              <span>{expanded ? "Recolher" : "Detalhes"}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Mais ações para ${circuit.name || `C${index + 1}`}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5EBF1] bg-white text-[#64748B] hover:bg-[#F6F9FC] hover:text-[#101828] transition"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-xl border-[#E5EBF1] bg-white p-1 shadow-xl text-xs font-semibold">
                <DropdownMenuItem onClick={onToggleExpand} className="cursor-pointer rounded-lg">
                  {expanded ? "Ocultar detalhes técnicos" : "Expandir detalhes técnicos"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={saving}
                  onClick={onRemove}
                  className="cursor-pointer rounded-lg text-[#EF4444] focus:text-[#EF4444]"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Excluir circuito
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Resumo Rápido 4 Colunas (Compacto e Legível) */}
        <div
          className={cn(
            "mt-3 grid gap-2 border-t border-[#F1F5F9] pt-3",
            viewMode === "list"
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-2 md:grid-cols-4"
          )}
        >
          <div className="rounded-xl border border-[#BEEAD2]/70 bg-[#E5FBF2]/65 px-3 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-[#006B50]">
              Carga / Demanda
            </span>
            <span className="mt-0.5 block text-sm font-extrabold text-[#101828] tabular-nums">
              {fmtPower(effectivePower)}
            </span>
          </div>

          <div className="rounded-xl border border-[#DBEAFE] bg-[#EDF5FF] px-3 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-blue-700">
              Corrente (Ib)
            </span>
            <span className="mt-0.5 block text-sm font-extrabold text-[#101828] tabular-nums">
              {fmtNum(circuit.project_current_a, " A")}
            </span>
          </div>

          <div className="rounded-xl border border-[#E5EBF1] bg-[#F8FAFC] px-3 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
              Proteção
            </span>
            <span className="mt-0.5 block text-sm font-extrabold text-[#101828] tabular-nums">
              {circuit.breaker_a || "—"}A {circuit.breaker_poles || 1}P/{circuit.breaker_curve || "C"}
            </span>
          </div>

          <div className="rounded-xl border border-[#E2D9FE] bg-[#F2EDFF] px-3 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-[#5B4AE8]">
              Condutor
            </span>
            <span className="mt-0.5 block text-sm font-extrabold text-[#101828] tabular-nums">
              {circuit.wire_gauge || "—"}
            </span>
          </div>
        </div>

        {/* Gaveta Expansível */}
        {expanded && <CircuitDetails circuit={circuit} />}
      </div>
    </article>
  );
}
