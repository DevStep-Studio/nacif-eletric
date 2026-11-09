import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BILLING_TYPE_LABELS } from "@/lib/billingApi";
import { getPlanByCode } from "@/lib/subscriptionPlans";

const paymentLabels = { PENDING: "Aguardando pagamento", OVERDUE: "Vencida", CONFIRMED: "Confirmada", RECEIVED: "Recebida", RECEIVED_IN_CASH: "Recebida", REFUNDED: "Estornada", REFUND_REQUESTED: "Estorno solicitado", REFUND_IN_PROGRESS: "Estorno em processamento", CHARGEBACK_REQUESTED: "Contestada", CHARGEBACK_DISPUTE: "Em disputa", AWAITING_CHARGEBACK_REVERSAL: "Contestação em análise", DELETED: "Cancelada", AWAITING_RISK_ANALYSIS: "Em análise" };
const formatDate = value => value ? new Date(String(value).length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("pt-BR") : "Não informada";
export default function ManageSubscriptionModal({ isOpen, onClose, subscription, billingData, onRefresh, onChangePlanClick, onVerifyStudentClick }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const record = billingData?.subscription;
  const refresh = async () => {
    setLoading(true); setError("");
    try { await onRefresh(); } catch (err) { setError(err.message || "Não foi possível atualizar a cobrança."); }
    finally { setLoading(false); }
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Gerenciar assinatura</DialogTitle><DialogDescription>Detalhes e cobranças da sua assinatura no Asaas.</DialogDescription></DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border p-4 space-y-2">
          <p className="font-bold">{record ? getPlanByCode(record.planCode).name : subscription?.plan?.name}</p>
          <p>Situação: {({ active: "Ativa", pending: "Aguardando pagamento", past_due: "Pagamento atrasado", cancelled: "Cancelada", cancelling: "Cancelamento em andamento", creating: "Preparando contratação", failed: "Contratação não concluída" })[record?.status] || "Sem assinatura paga"}</p>
          <p>Forma de pagamento: {BILLING_TYPE_LABELS[record?.billingType] || "Não definida"}</p>
          {record && <p>Valor contratado: {Number(record.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} / {record.cycle === "annual" ? "ano" : "mês"}</p>}
          <p>Acesso pago até: {formatDate(subscription?.renewalDate)}</p>
          {record && !record.cancelRequested && record.status !== "cancelled" && <p>Próximo vencimento: {formatDate(record.nextDueDate)}</p>}
          {record?.billingType !== "CREDIT_CARD" && record && <p className="text-slate-600">Pix e boleto precisam ser pagos a cada vencimento.</p>}
          {record?.pendingChange?.state === "scheduled" && <p className="text-teal-800">Alteração para {getPlanByCode(record.pendingChange.planCode).name}, ciclo {record.pendingChange.cycle === "annual" ? "anual" : "mensal"}, a partir de {formatDate(record.pendingChange.effectiveDate)}.</p>}
        </div>
        {record?.pendingChange?.state === "applying" && <p role="status" className="text-amber-800">Alteração de plano em conciliação. Atualize os pagamentos para confirmar o resultado.</p>}
        <div className="space-y-2">
          <h3 className="font-bold">Cobranças</h3>
          {!billingData?.payments?.length && <p className="text-slate-600">Nenhuma cobrança disponível.</p>}
          {billingData?.payments?.map(payment => <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div><p className="font-semibold">{Number(payment.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {formatDate(payment.dueDate)}</p><p className="text-slate-600">{paymentLabels[payment.status] || "Em processamento"}</p></div>
            {payment.invoiceUrl && payment.status !== "DELETED" && <a className="font-semibold text-teal-800 underline" href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">{["PENDING", "OVERDUE"].includes(payment.status) ? "Pagar cobrança" : "Ver fatura"}</a>}
          </div>)}
        </div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <Button variant="outline" onClick={refresh} disabled={loading}>{loading ? "Atualizando..." : "Atualizar pagamentos"}</Button>
        {onChangePlanClick && <Button onClick={() => { onClose(); onChangePlanClick(); }} className="ml-2">Ver planos</Button>}
        {onVerifyStudentClick && <Button className="w-full" variant="outline" onClick={onVerifyStudentClick}>Enviar ou atualizar comprovante acadêmico</Button>}
        {record && record.status !== "cancelled" && <Button asChild variant="outline" className="w-full text-red-700"><Link to="/billing/cancelar">Cancelar assinatura e cobranças futuras</Link></Button>}
        <p className="text-xs text-slate-500">O cancelamento preserva os períodos pagos e seus projetos.</p>
      </div>
    </DialogContent>
  </Dialog>;
}
