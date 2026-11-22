import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLAN_COMPARISON_ROWS } from "@/lib/subscriptionPlans";

function renderComparisonBadge(val, isHighlight = false) {
  if (val === "Completo" || val === "Sim" || val === "Ilimitado") {
    return (
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${
          isHighlight
            ? "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]"
            : "border-[#BEEAD2] bg-[#E5FBF2]/75 text-[#006B50]"
        }`}
      >
        {val}
      </span>
    );
  }
  if (val === "Acadêmico") {
    return (
      <span className="inline-flex items-center rounded-md border border-blue-200 bg-[#EDF5FF] px-2 py-0.5 text-[11px] font-bold text-blue-800">
        Acadêmico
      </span>
    );
  }
  if (val === "Restrito") {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200 bg-[#FFF3E6] px-2 py-0.5 text-[11px] font-bold text-amber-800">
        Restrito
      </span>
    );
  }
  if (val === "Não incluído" || val === "Não") {
    return (
      <span className="inline-flex items-center rounded-md border border-[#E5EBF1] bg-[#F6F9FC] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
        {val}
      </span>
    );
  }
  return <span className="text-xs font-bold text-[#101828] tabular-nums">{val}</span>;
}

/**
 * Comparação detalhada de limites e módulos (tabela no desktop, cards no mobile).
 */
export default function PlanComparison() {
  return (
    <section
      id="tabela-comparativa"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-[#E5EBF1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
    >
      <div className="border-b border-[#E5EBF1] px-5 py-4">
        <h2 className="text-base font-extrabold text-[#101828]">Comparação de recursos e limites</h2>
        <p className="mt-0.5 text-xs font-medium text-[#64748B]">
          Limites mensais e permissões técnicas sincronizados com o catálogo vigente.
        </p>
      </div>

      {/* Desktop / Tablet Tabela */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
              <TableHead className="px-5 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Recurso
              </TableHead>
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                <div className="flex items-center gap-1.5">
                  <span>Estudante</span>
                  <span className="rounded-md border border-amber-200 bg-[#FFF3E6] px-1.5 py-0.5 text-[9.5px] font-bold normal-case text-amber-800">
                    Em breve
                  </span>
                </div>
              </TableHead>
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Elétrico
              </TableHead>
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                Solar
              </TableHead>
              <TableHead className="px-4 text-[11px] font-bold uppercase tracking-wider text-[#006B50]">
                Completo
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PLAN_COMPARISON_ROWS.map((row) => (
              <TableRow key={row.key} className="hover:bg-[#F6F9FC]/70">
                <TableCell className="px-5 py-3">
                  <p className="text-xs font-bold text-[#101828]">{row.label}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">{row.description}</p>
                </TableCell>
                <TableCell className="px-4 py-3">{renderComparisonBadge(row.values.estudante)}</TableCell>
                <TableCell className="px-4 py-3">{renderComparisonBadge(row.values.eletrico)}</TableCell>
                <TableCell className="px-4 py-3">{renderComparisonBadge(row.values.solar)}</TableCell>
                <TableCell className="px-4 py-3">{renderComparisonBadge(row.values.completo, true)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards Responsivos */}
      <div className="divide-y divide-[#E5EBF1] md:hidden">
        {PLAN_COMPARISON_ROWS.map((row) => (
          <div key={row.key} className="p-4 space-y-2.5">
            <div>
              <p className="text-xs font-extrabold text-[#101828]">{row.label}</p>
              <p className="mt-0.5 text-[11px] text-[#64748B]">{row.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-[#E5EBF1] bg-[#F8FAFC] px-2.5 py-1.5">
                <span className="text-[11px] font-semibold text-[#64748B]">Estudante</span>
                {renderComparisonBadge(row.values.estudante)}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5EBF1] bg-[#F8FAFC] px-2.5 py-1.5">
                <span className="text-[11px] font-semibold text-[#64748B]">Elétrico</span>
                {renderComparisonBadge(row.values.eletrico)}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5EBF1] bg-[#F8FAFC] px-2.5 py-1.5">
                <span className="text-[11px] font-semibold text-[#64748B]">Solar</span>
                {renderComparisonBadge(row.values.solar)}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#BEEAD2] bg-[#E5FBF2]/50 px-2.5 py-1.5">
                <span className="text-[11px] font-bold text-[#006B50]">Completo</span>
                {renderComparisonBadge(row.values.completo, true)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
