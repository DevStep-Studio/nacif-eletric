import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CreditCard, FolderOpen, Settings, ShieldCheck } from "lucide-react";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import BrandLoadingScreen from "@/components/system/BrandLoadingScreen";
import BillingCheckoutModal from "@/components/subscription/BillingCheckoutModal";
import AcademicVerificationModal from "@/components/subscription/AcademicVerificationModal";
import PlanChangeModal from "@/components/subscription/PlanChangeModal";
import ManageSubscriptionModal from "@/components/subscription/ManageSubscriptionModal";
import InternalPageHeader from "@/components/internal/InternalPageHeader";
import SubscriptionOverview from "@/components/internal/SubscriptionOverview";
import BillingNotice from "@/components/internal/BillingNotice";
import UsageMetricCard from "@/components/internal/UsageMetricCard";
import PricingCard from "@/components/internal/PricingCard";
import PlanComparison from "@/components/internal/PlanComparison";
import BillingHistoryCard from "@/components/internal/BillingHistoryCard";
import {
  FEATURE_KEYS,
  applyRemotePlanCatalog,
  buildUsageFromProjects,
  formatPlanPrice,
  getUsageRows,
  normalizeSubscription,
} from "@/lib/subscriptionPlans";
import { syncSubscription, verifyCheckoutSession } from "@/lib/billingApi";

const FEATURE_DESCRIPTIONS = {
  [FEATURE_KEYS.PROJECTS]: "Quantidade de projetos ativos no workspace.",
  [FEATURE_KEYS.STORAGE_MB]: "Arquivos, plantas e anexos vinculados.",
  [FEATURE_KEYS.TEAM_MEMBERS]: "Usuários participantes da organização.",
  [FEATURE_KEYS.EXPORTS]: "PDFs técnicos, memoriais e planilhas no ciclo.",
  [FEATURE_KEYS.AI_SCANS]: "Leituras e análises assistidas por IA no ciclo.",
  [FEATURE_KEYS.CUSTOM_TEMPLATES]: "Modelos personalizados da organização.",
};

const formatIsoDate = (iso) => {
  if (!iso) return null;
  const d = new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function Subscription() {
  const { user, checkUserAuth } = useAuth();
  const [activeUser, setActiveUser] = useState(user);
  const [serverUsage, setServerUsage] = useState({});
  const [catalog, setCatalog] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingMessage, setBillingMessage] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [billingData, setBillingData] = useState({ subscription: null, payments: [] });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [isPlanChangeOpen, setIsPlanChangeOpen] = useState(false);
  const [selectedTargetPlan, setSelectedTargetPlan] = useState(null);
  const [isAcademicModalOpen, setIsAcademicModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  useEffect(() => {
    setActiveUser(user);
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [me, projectList, plans, status] = await Promise.all([
        backend.auth.me(),
        backend.entities.Project.list("-updated_date", 100),
        backend.subscriptions.getPlans(),
        backend.subscriptions.getStatus(),
      ]);
      setServerUsage(status.usage || {});
      setBillingData(status.billing || { subscription: null, payments: [] });
      applyRemotePlanCatalog(plans.plans);
      setCatalog(plans.plans.filter((p) => p.code !== "free"));
      setLoadError("");
      setActiveUser(me || user);
      setProjects(Array.isArray(projectList) ? projectList : []);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const subscription = normalizeSubscription(activeUser);
  const hasBillingInProgress =
    billingData.subscription && !["cancelled", "failed"].includes(billingData.subscription.status);
  const canStartTrial = subscription.trialEligible && !subscription.hasAccess && !hasBillingInProgress;

  const usage = useMemo(
    () => ({ ...buildUsageFromProjects(projects, {}, activeUser), ...serverUsage }),
    [projects, activeUser, serverUsage]
  );
  const usageRows = useMemo(() => getUsageRows(subscription.plan, usage), [subscription.plan, usage]);

  const completoPlan = catalog.find((p) => p.code === "completo");
  const trialPriceLabel = completoPlan ? `${formatPlanPrice(completoPlan, "monthly")}/mês` : "R$ 210,00/mês";

  const handlePlanChangeSuccess = (newPlan, result) => {
    setBillingMessage(
      `Alteração para ${newPlan.name} agendada para ${
        result?.effectiveDate
          ? new Date(`${result.effectiveDate}T12:00:00`).toLocaleDateString("pt-BR")
          : "o próximo ciclo"
      }.`
    );
    loadData();
    setTimeout(() => setBillingMessage(""), 5000);
  };

  const handleAcademicSuccess = () => {
    setBillingMessage("Comprovante acadêmico enviado com sucesso. Aguardando aprovação administrativa.");
    loadData();
    setTimeout(() => setBillingMessage(""), 5000);
  };

  const subscribingPriceId = null;
  const portalLoading = false;

  const refreshBilling = async () => {
    const result = await syncSubscription();
    setActiveUser(result.user);
    setBillingData({ subscription: result.subscription, payments: result.payments });
    await checkUserAuth({ silent: true });
  };

  useEffect(() => {
    if (!user?.id) return;
    let stopped = false;
    let timer;
    const params = new URLSearchParams(window.location.search);
    const returned = params.get("checkout") === "success";
    const subscriptionId = params.get("subscription_id");
    const poll = async (attempt = 0) => {
      try {
        let paid = false;
        if (returned && subscriptionId) {
          const result = await verifyCheckoutSession({ subscriptionId });
          paid = result.paid;
          if (!stopped) setActiveUser(result.user);
        }
        if (stopped) return;
        await refreshBilling();
        if (stopped) return;
        if (returned) {
          setBillingMessage(
            paid
              ? "Pagamento confirmado pelo Asaas. Seu plano está disponível."
              : "Pagamento em processamento. O plano será liberado após a confirmação."
          );
          if (!paid && subscriptionId && attempt < 9) timer = setTimeout(() => poll(attempt + 1), 3000);
          else window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        if (!stopped) {
          setBillingMessage(err.message);
          if (returned && attempt < 9) timer = setTimeout(() => poll(attempt + 1), 3000);
        }
      }
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [user?.id]);

  const handleSubscription = (planCode) => {
    const target = catalog.find((plan) => plan.code === planCode);
    if (!target) return;
    if (target.isPendingRelease || target.code === "estudante") {
      setBillingMessage(
        "O plano Estudante está temporariamente em aguardo e será liberado nas próximas atualizações."
      );
      return;
    }
    setSelectedTargetPlan(target);
    const current = billingData.subscription;
    if (current && !["cancelled", "failed"].includes(current.status)) {
      if (["active", "past_due"].includes(current.status) && !current.cancelRequested) {
        setIsPlanChangeOpen(true);
      } else {
        setBillingMessage("Você já possui uma contratação em andamento. Consulte suas cobranças.");
        setIsManageModalOpen(true);
      }
    } else {
      setIsCheckoutOpen(true);
    }
  };

  const scrollToPlans = () => {
    const el = document.querySelector("#compare-plans");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  if (loadError) {
    return (
      <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center">
        <p className="text-sm font-bold text-[#EF4444]">{loadError}</p>
        <Button type="button" onClick={loadData} className="mt-3 h-9 rounded-xl bg-[#00D98A] text-xs font-extrabold text-[#031923]">
          Tentar novamente
        </Button>
      </div>
    );
  }
  if (loading && !catalog.length) return <BrandLoadingScreen />;

  const renewalLabel = subscription.hasActiveTrial
    ? formatIsoDate(subscription.trialEndDate)
    : subscription.hasPaidSubscription
    ? formatIsoDate(subscription.renewalDate)
    : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 pb-16">
      {/* Cabeçalho Unificado */}
      <InternalPageHeader
        icon={CreditCard}
        title="Assinatura e uso"
        subtitle="Gerencie seu plano, acompanhe seus recursos e escolha a melhor opção para seus projetos."
        actions={
          <Button
            asChild
            variant="outline"
            className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3.5 text-xs font-bold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
          >
            <Link to="/settings">
              <Settings className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" />
              Configurações da conta
            </Link>
          </Button>
        }
      />

      {billingMessage && (
        <section className="flex items-center justify-between gap-3 rounded-2xl border border-[#BEEAD2] bg-[#E5FBF2] px-4 py-3 text-xs font-semibold text-[#006B50]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{billingMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBillingMessage("")}
            className="shrink-0 font-bold text-[#006B50] hover:underline"
          >
            Fechar
          </button>
        </section>
      )}

      {/* Aviso de Teste Grátis (Compacto, sólido e transparente) */}
      <BillingNotice
        canStartTrial={canStartTrial}
        hasActiveTrial={subscription.hasActiveTrial}
        trialEndDate={subscription.trialEndDate}
        firstChargeDate={subscription.firstChargeDate}
        autoRenew={subscription.autoRenew}
        trialPriceLabel={trialPriceLabel}
        onStartTrial={() => {
          setCycle("monthly");
          handleSubscription("completo");
        }}
        onManageTrial={() => setIsManageModalOpen(true)}
      />

      {/* Plano Atual + Uso do seu plano */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SubscriptionOverview
          subscription={subscription}
          activeUser={activeUser}
          billingRecord={billingData.subscription}
          hasBillingPayments={(billingData.payments || []).length > 0}
          portalLoading={portalLoading}
          onManageSubscription={() => setIsManageModalOpen(true)}
          onViewPlans={scrollToPlans}
          onOpenAcademicModal={() => setIsAcademicModalOpen(true)}
        />

        <article className="min-w-0 rounded-2xl border border-[#E5EBF1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div className="flex flex-col gap-2 border-b border-[#E5EBF1] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-extrabold text-[#101828]">Uso do seu plano</h2>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                {loading ? "Atualizando consumo..." : "Medição consolidada de recursos e espaço no workspace."}
              </p>
            </div>
            {renewalLabel && (
              <span className="w-fit rounded-md border border-[#E5EBF1] bg-[#F6F9FC] px-2.5 py-1 text-[11px] font-bold text-[#101828] tabular-nums">
                Renovação: {renewalLabel}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {usageRows.map((row) => (
              <UsageMetricCard
                key={row.key}
                row={row}
                description={FEATURE_DESCRIPTIONS[row.key]}
              />
            ))}
          </div>
        </article>
      </section>

      {/* Escolha seu plano */}
      <section
        id="compare-plans"
        className="scroll-mt-8 rounded-2xl border border-[#E5EBF1] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
      >
        <div className="flex flex-col gap-3 border-b border-[#E5EBF1] pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-[#101828]">
              Escolha seu plano
            </h2>
            <p className="mt-0.5 text-xs font-medium text-[#64748B]">
              Encontre os recursos ideais para seus projetos.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`h-8 rounded-lg px-3.5 text-xs font-bold transition ${
                cycle === "monthly"
                  ? "bg-white text-[#101828] shadow-2xs"
                  : "text-[#64748B] hover:text-[#101828]"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold transition ${
                cycle === "annual"
                  ? "bg-[#00D98A] text-[#031923] font-extrabold shadow-2xs"
                  : "text-[#64748B] hover:text-[#101828]"
              }`}
            >
              <span>Anual</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                  cycle === "annual"
                    ? "bg-[#031923] text-[#00F0A0]"
                    : "bg-[#E5FBF2] text-[#006B50]"
                }`}
              >
                -30% OFF
              </span>
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {catalog.map((plan) => {
            const isCurrent =
              plan.code === subscription.planCode &&
              (plan.code === "estudante" || cycle === subscription.cycle);
            const isRecommended = Boolean(plan.recommended || plan.code === "completo");
            const showTrialOffer = plan.code === "completo" && cycle === "monthly" && canStartTrial;
            const isEstudante = plan.code === "estudante" || Boolean(plan.isPendingRelease);
            const isPendingRelease = Boolean(plan.isPendingRelease || (isEstudante && !isCurrent));

            return (
              <PricingCard
                key={plan.code}
                plan={plan}
                cycle={cycle}
                isCurrent={isCurrent}
                isRecommended={isRecommended}
                isPendingRelease={isPendingRelease}
                showTrialOffer={showTrialOffer}
                subscribing={subscribingPriceId === plan.code}
                hasAccess={subscription.hasAccess}
                onSelect={() => {
                  if (isPendingRelease) return;
                  const academicExpired =
                    activeUser?.academic_valid_until &&
                    Date.parse(activeUser.academic_valid_until) <= Date.now();
                  if (
                    plan.isAcademic &&
                    (!activeUser?.academic_status ||
                      activeUser.academic_status === "not_submitted" ||
                      activeUser.academic_status === "rejected" ||
                      activeUser.academic_status === "expired" ||
                      academicExpired)
                  ) {
                    setIsAcademicModalOpen(true);
                    return;
                  }
                  handleSubscription(plan.code);
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Comparação Detalhada de Recursos */}
      <PlanComparison />

      {/* Histórico e Faturas */}
      <BillingHistoryCard
        billingData={billingData}
        hasActiveTrial={subscription.hasActiveTrial}
        onManage={() => setIsManageModalOpen(true)}
      />

      {/* Política de Retenção de Projetos */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[#E5EBF1] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
            <ShieldCheck className="h-[18px] w-[18px] stroke-[2.1]" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-[#101828]">Retenção e preservação de projetos</h2>
            <p className="mt-0.5 text-xs font-medium leading-relaxed text-[#64748B]">
              Alterações ou cancelamentos de plano nunca apagam projetos, plantas elétricas ou orçamentos existentes. Seus dados continuam acessíveis para consulta e exportação.
            </p>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-9 shrink-0 rounded-xl border-[#E5EBF1] bg-white px-3.5 text-xs font-bold text-[#101828] hover:border-[#00D98A] hover:bg-[#F6F9FC]"
        >
          <Link to="/projects">
            <FolderOpen className="mr-1.5 h-3.5 w-3.5 text-[#006B50]" />
            Ver meus projetos
          </Link>
        </Button>
      </section>

      {/* Modais Funcionais Preservados */}
      <BillingCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        targetPlan={selectedTargetPlan}
        cycle={cycle}
        user={activeUser}
        onSuccess={async () => {
          await refreshBilling();
          await loadData();
          setBillingMessage("Cartão validado. Seu teste grátis do Completo está ativo.");
        }}
      />

      <PlanChangeModal
        isOpen={isPlanChangeOpen}
        onClose={() => setIsPlanChangeOpen(false)}
        targetPlan={selectedTargetPlan}
        currentPlan={subscription.plan}
        cycle={cycle}
        onSuccess={handlePlanChangeSuccess}
      />

      <AcademicVerificationModal
        isOpen={isAcademicModalOpen}
        onClose={() => setIsAcademicModalOpen(false)}
        user={activeUser}
        onSuccess={handleAcademicSuccess}
      />

      <ManageSubscriptionModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        subscription={subscription}
        billingData={billingData}
        onRefresh={refreshBilling}
        user={activeUser}
        onChangePlanClick={scrollToPlans}
        onVerifyStudentClick={() => setIsAcademicModalOpen(true)}
      />
    </div>
  );
}
