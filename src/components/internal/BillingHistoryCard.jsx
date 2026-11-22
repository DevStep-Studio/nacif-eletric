import { ExternalLink, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAYMENT_STATUS = {
  PENDING: { label: "Aguardando pagamento", tone: "border-amber-200 bg-[#FFF3E6] text-amber-800" },
  OVERDUE: { label: "Vencida", tone: "border-red-200 bg-[#FEF2F2] text-[#EF4444]" },
  CONFIRMED: { label: "Confirmada", tone: "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]" },
  RECEIVED: { label: "Recebida", tone: "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]" },
  RECEIVED_IN_CASH: { label: "Recebida", tone: "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]" },
  REFUNDED: { label: "Estornada", tone: "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B]" },
  DELETED: { label: "Cancelada", tone: "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B]" },
};

const formatDate = (value) => {
  if (!value) return "Não informada";
  const d = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
};

/**
 * Histórico compacto de cobranças e faturas da assinatura (alimentado por billingData real).
 */
export default function BillingHistoryCard({
  billingData = null,
  hasActiveTrial = false,
  onManage,
}) {
  const payments = Array.isArray(billingData?.payments) ? billingData.payments : [];
  const record = billingData?.subscription || null;

  return (
    <section className="rounded-2xl border border-[#E5EBF1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex flex-col gap-2 border-b border-[#E5EBF1] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
            <Receipt className="h-4 w-4 stroke-[2.1]" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-[#101828]">Histórico de cobranças e faturas</h2>
            <p className="text-xs font-medium text-[#64748B]">
              Registros financeiros sincronizados com o provedor de pagamento.
            </p>
          </div>
        </div>

        {record && onManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onManage}
            className="h-8 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-bold text-[#101828] hover:bg-[#F6F9FC]"
          >
            Detalhes da contratação
          </Button>
        )}
      </div>

      {payments.length === 0 ? (
        <p className="mt-3.5 text-xs font-medium text-[#64748B]">
          Nenhuma fatura ou cobrança registrada para esta conta até o momento.
        </p>
      ) : (
        <div className="mt-3.5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5EBF1] text-[11px] font-semibold text-[#64748B]">
                <th className="py-2 pr-3">Vencimento</th>
                <th className="py-2 px-3">Valor</th>
                <th className="py-2 px-3">Situação</th>
                <th className="py-2 pl-3 text-right">Fatura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {payments.map((payment) => {
                const statusCfg = PAYMENT_STATUS[payment.status] || {
                  label: "Em processamento",
                  tone: "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B]",
                };
                return (
                  <tr key={payment.id}>
                    <td className="py-2.5 pr-3 font-semibold text-[#101828] tabular-nums">
                      {formatDate(payment.dueDate)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#101828] tabular-nums">
                      {Number(payment.value || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${statusCfg.tone}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      {!hasActiveTrial && payment.invoiceUrl && payment.status !== "DELETED" ? (
                        <a
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-[#006B50] hover:underline"
                        >
                          <span>{["PENDING", "OVERDUE"].includes(payment.status) ? "Pagar" : "Ver fatura"}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[#64748B]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
