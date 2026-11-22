import { ArrowRight, CheckCircle2, CreditCard, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPlanPrice } from "@/lib/subscriptionPlans";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  none: "Sem plano ativo",
  trialing: "Teste grátis ativo",
  active: "Assinatura ativa",
  pending: "Aguardando pagamento",
  past_due: "Pagamento em atraso",
  cancelled: "Assinatura cancelada",
  expired: "Assinatura expirada",
};

const formatIsoDate = (iso) => {
  if (!iso) return null;
  const d = new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/**
 * Resumo principal do plano contratado atualmente (exibe apenas informações reais do backend).
 */
export default function SubscriptionOverview({
  subscription,
  activeUser,
  billingRecord = null,
  hasBillingPayments = false,
  portalLoading = false,
  onManageSubscription,
  onViewPlans,
  onOpenAcademicModal,
}) {
  const hasAccess = Boolean(subscription?.hasAccess);
  const statusLabel = STATUS_LABELS[subscription?.status] || "Sem plano ativo";

  const statusTone = hasAccess
    ? subscription.hasActiveTrial
      ? "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]"
      : "border-[#00D98A]/50 bg-[#E5FBF2] text-[#006B50]"
    : subscription?.status === "past_due"
    ? "border-amber-200 bg-[#FFF3E6] text-amber-800"
    : "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B]";

  const startDateLabel = subscription?.hasActiveTrial
    ? formatIsoDate(activeUser?.trial_start_date)
    : subscription?.hasPaidSubscription
    ? formatIsoDate(subscription?.startDate)
    : null;

  const renewalDateLabel = subscription?.hasActiveTrial
    ? formatIsoDate(subscription?.trialEndDate)
    : subscription?.hasPaidSubscription
    ? formatIsoDate(subscription?.renewalDate)
    : null;

  return (
    <article className="min-w-0 flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              Plano atual
            </p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-[#101828]">
              {hasAccess ? subscription.plan.name : "Sem plano ativo"}
            </h2>
          </div>

          <span className={cn("shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-bold", statusTone)}>
            {statusLabel}
          </span>
        </div>

        {!hasAccess ? (
          <div className="mt-3 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3.5 text-xs leading-relaxed text-[#64748B]">
            <p>
              Sua conta não possui uma assinatura contratada no momento. Seus projetos já cadastrados continuam salvos e você pode escolher um plano abaixo para liberar todos os recursos.
            </p>
          </div>
        ) : (
          <dl className="mt-4 space-y-2.5 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#64748B] font-medium">
                {subscription.hasActiveTrial ? "Valor após o teste" : "Valor contratado"}
              </dt>
              <dd className="font-extrabold text-[#101828] tabular-nums">
                {formatPlanPrice(subscription.plan, subscription.cycle || "monthly")} /{" "}
                {subscription.cycle === "annual" ? "ano" : "mês"}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2">
              <dt className="text-[#64748B] font-medium">Periodicidade</dt>
              <dd className="font-bold text-[#101828]">
                {subscription.cycle === "annual" ? "Anual (-30% OFF)" : "Mensal"}
              </dd>
            </div>

            {startDateLabel && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#64748B] font-medium">Início</dt>
                <dd className="font-semibold text-[#101828] tabular-nums">{startDateLabel}</dd>
              </div>
            )}

            {renewalDateLabel && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#64748B] font-medium">
                  {subscription.hasActiveTrial
                    ? subscription.autoRenew
                      ? "Primeira cobrança"
                      : "Término do teste"
                    : "Próxima renovação"}
                </dt>
                <dd className="font-semibold text-[#101828] tabular-nums">{renewalDateLabel}</dd>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-[#E5EBF1] pt-2">
              <dt className="text-[#64748B] font-medium">Renovação automática</dt>
              <dd
                className={cn(
                  "font-bold",
                  subscription.autoRenew ? "text-[#006B50]" : "text-amber-700"
                )}
              >
                {subscription.autoRenew
                  ? subscription.billingType === "CREDIT_CARD"
                    ? "Ativa no cartão"
                    : "Ativa (cobrança periódica)"
                  : "Desativada"}
              </dd>
            </div>
          </dl>
        )}

        {subscription?.plan?.isAcademic && (
          <div className="mt-3 rounded-xl border border-blue-200 bg-[#EDF5FF] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold text-blue-900">
                <GraduationCap className="h-4 w-4 text-blue-700" />
                Elegibilidade Acadêmica
              </span>
              <span className="font-extrabold text-blue-800">
                {subscription.academicStatus === "approved"
                  ? "Aprovada"
                  : subscription.academicStatus === "pending_review"
                  ? "Em Análise"
                  : "Pendente"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-blue-800">
              {subscription.academicInstitution
                ? `${subscription.academicInstitution} (${subscription.academicCourse})`
                : "Envie um comprovante de matrícula ativo."}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={onOpenAcademicModal}
              className="mt-2 h-8 w-full rounded-lg border-blue-300 bg-white text-xs font-bold text-blue-900 hover:bg-blue-50"
            >
              {subscription.academicStatus === "approved" ? "Atualizar documento" : "Enviar comprovante"}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {!hasAccess ? (
          <>
            <Button
              type="button"
              onClick={onViewPlans}
              className="h-10 w-full rounded-xl bg-[#00D98A] text-xs font-extrabold text-[#031923] hover:bg-[#00C987]"
            >
              <span>Ver planos disponíveis</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            {(billingRecord || hasBillingPayments) && (
              <Button
                type="button"
                variant="outline"
                onClick={onManageSubscription}
                className="h-9 w-full rounded-xl border-[#E5EBF1] bg-white text-xs font-bold text-[#101828] hover:bg-[#F6F9FC]"
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
                Consultar cobranças e histórico
              </Button>
            )}
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={portalLoading}
            onClick={onManageSubscription}
            className="h-10 w-full rounded-xl border-[#E5EBF1] bg-white text-xs font-bold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
          >
            {portalLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#00D98A]" />
                Atualizando cobrança...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#006B50]" />
                Gerenciar assinatura e cobranças
              </span>
            )}
          </Button>
        )}
      </div>
    </article>
  );
}
