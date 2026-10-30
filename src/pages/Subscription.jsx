import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  CreditCard,
  FolderOpen,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Settings,
  Loader2,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageHeader from "@/components/PageHeader";
import { createBillingProvider } from "@/lib/billingProvider";
import {
  FEATURE_KEYS,
  PLAN_CATALOG,
  PLAN_COMPARISON_ROWS,
  buildUsageFromProjects,
  getUsageRows,
  normalizeSubscription,
  formatPlanPrice,
  calculateAnnualSavings,
} from "@/lib/subscriptionPlans";
import AcademicVerificationModal from "@/components/subscription/AcademicVerificationModal";
import PlanChangeModal from "@/components/subscription/PlanChangeModal";
import ManageSubscriptionModal from "@/components/subscription/ManageSubscriptionModal";
import {
  getPlanPriceId,
  createCheckoutSession,
  createPortalSession,
  verifyCheckoutSession,
  syncStripeSubscription,
} from "@/lib/stripeConfig";

const featureDescriptions = {
  [FEATURE_KEYS.PROJECTS]: "Quantidade de projetos ativos no workspace.",
  [FEATURE_KEYS.STORAGE_MB]: "Arquivos, importações e anexos associados aos projetos.",
  [FEATURE_KEYS.TEAM_MEMBERS]: "Usuários que podem participar da organização.",
  [FEATURE_KEYS.EXPORTS]: "Geração de PDF, memorial, listas e documentação.",
  [FEATURE_KEYS.AI_SCANS]: "Processamentos de imagem e leitura assistida por IA.",
  [FEATURE_KEYS.CUSTOM_TEMPLATES]: "Modelos criados pela organização.",
};

const stateStyles = {
  normal: "text-[#0f4f49] bg-[#E8FCF8] border-[#BCEEE5]",
  near: "text-amber-800 bg-amber-50 border-amber-200",
  limit: "text-rose-800 bg-rose-50 border-rose-200",
  unlimited: "text-[#0f4f49] bg-[#E8FCF8] border-[#BCEEE5]",
};

const usageCardStyles = {
  normal: "border-[#E4E7EC] bg-white",
  near: "border-amber-200 bg-amber-50/30",
  limit: "border-rose-200 bg-rose-50/30",
  unlimited: "border-[#E4E7EC] bg-white",
};

const formatIsoDate = (iso) => {
  if (!iso) return "Não informada";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return String(iso);
  }
};

const PLAN_HIGHLIGHTS = {
  estudante: [
    "Até 5 projetos ativos (1 GB)",
    "Editor de plantas e quadros acadêmico",
    "Calculadora elétrica NBR 5410",
    "20 exportações e scans IA/mês",
  ],
  eletrico: [
    "Até 30 projetos ativos (5 GB)",
    "Editor completo de plantas NBR 5410",
    "Quadros DIN e diagramas unifilares",
    "3 usuários inclusos na equipe",
  ],
  solar: [
    "Até 30 projetos ativos (5 GB)",
    "Dimensionamento fotovoltaico e strings",
    "Layout solar 2D/3D no mapa",
    "Memorial solar e 3 usuários inclusos",
  ],
  completo: [
    "Projetos e exportações ilimitados",
    "Todas as ferramentas Elétrico + Solar",
    "50 GB de armazenamento (15 membros)",
    "500 operações de IA por mês",
    "Suporte técnico prioritário",
  ],
};

const PLAN_SUBTITLES = {
  estudante: "Uso acadêmico para formação técnica",
  eletrico: "Projetos elétricos prediais e NBR 5410",
  solar: "Dimensionamento e usinas fotovoltaicas",
  completo: "Acesso total elétrico e solar unificado",
};

export default function Subscription() {
  const { user } = useAuth();
  const [activeUser, setActiveUser] = useState(user);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingMessage, setBillingMessage] = useState("");
  const [cycle, setCycle] = useState("monthly");

  // Modais
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
      const [me, projectList] = await Promise.all([
        backend.auth.me().catch(() => user),
        backend.entities.Project.list("-updated_date", 100).catch(() => []),
      ]);
      setActiveUser(me || user);
      setProjects(Array.isArray(projectList) ? projectList : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const subscription = normalizeSubscription(activeUser);
  const usage = useMemo(() => buildUsageFromProjects(projects, {}, activeUser), [projects, activeUser]);
  const usageRows = useMemo(() => getUsageRows(subscription.plan, usage), [subscription.plan, usage]);
  const billingProvider = useMemo(() => createBillingProvider(activeUser), [activeUser]);

  const handlePlanSelect = (plan) => {
    if (plan.code === subscription.planCode) return;

    if (plan.isAcademic) {
      // Se o usuário ainda não enviou comprovação acadêmica
      if (!activeUser?.academic_status || activeUser?.academic_status === "not_submitted") {
        setIsAcademicModalOpen(true);
        return;
      }
    }

    setSelectedTargetPlan(plan);
    setIsPlanChangeOpen(true);
  };

  const handlePlanChangeSuccess = (newPlan) => {
    setBillingMessage(`Plano alterado para ${newPlan.name} com sucesso.`);
    loadData();
    setTimeout(() => setBillingMessage(""), 5000);
  };

  const handleAcademicSuccess = () => {
    setBillingMessage("Comprovante acadêmico enviado com sucesso. Aguardando aprovação administrativa.");
    loadData();
    setTimeout(() => setBillingMessage(""), 5000);
  };

  const [subscribingPriceId, setSubscribingPriceId] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Sincroniza em segundo plano o estado real da assinatura da conta na Stripe
  useEffect(() => {
    if (!activeUser?.email) return;
    let cancelled = false;

    syncStripeSubscription({
      userId: activeUser.id,
      userEmail: activeUser.email,
      stripeCustomerId: activeUser.stripe_customer_id,
    })
      .then(async (syncRes) => {
        if (cancelled || !syncRes?.synced) return;
        if (syncRes.hasActiveSubscription && syncRes.plan) {
          if (backend.subscriptions?.syncFromStripe) {
            const updated = await backend.subscriptions.syncFromStripe(syncRes);
            if (!cancelled && updated) {
              setActiveUser(updated);
            }
          }
        } else if (
          !syncRes.hasActiveSubscription &&
          syncRes.status === "cancelled" &&
          activeUser.billing_provider === "stripe"
        ) {
          if (backend.subscriptions?.syncFromStripe) {
            const updated = await backend.subscriptions.syncFromStripe({
              ...syncRes,
              plan: "free",
              status: "cancelled",
              autoRenew: false,
            });
            if (!cancelled && updated) {
              setActiveUser(updated);
            }
          }
        }
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [activeUser?.id, activeUser?.email]);

  // Monitora retorno do checkout ou Customer Portal do Stripe via parâmetros na URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get("checkout");
    const portalReturn = params.get("portal_return");
    const sessionId = params.get("session_id");
    const returnPlan = params.get("plan");
    const returnCycle = params.get("cycle") || "monthly";

    if (checkoutStatus === "success") {
      setBillingMessage("🎉 Pagamento confirmado com sucesso! Sincronizando sua assinatura com a Stripe...");
      window.history.replaceState({}, document.title, window.location.pathname);

      const finalizeCheckoutSync = async () => {
        let syncedViaApi = false;

        if (
          sessionId &&
          sessionId !== "{CHECKOUT_SESSION_ID}" &&
          !sessionId.startsWith("cs_simulated")
        ) {
          const verified = await verifyCheckoutSession({ sessionId }).catch(() => null);
          if (verified?.plan && backend.subscriptions?.syncFromStripe) {
            await backend.subscriptions.syncFromStripe(verified).catch(() => null);
            syncedViaApi = true;
          } else if (verified?.plan && backend.subscriptions?.changePlan) {
            await backend.subscriptions
              .changePlan({
                planCode: verified.plan,
                cycle: verified.cycle || returnCycle,
              })
              .catch(() => null);
            syncedViaApi = true;
          }
        }

        if (!syncedViaApi && returnPlan && backend.subscriptions?.changePlan) {
          await backend.subscriptions
            .changePlan({
              planCode: returnPlan,
              cycle: returnPlan === "estudante" ? "monthly" : returnCycle,
            })
            .catch(() => null);
        }

        await loadData();
        setBillingMessage("🎉 Assinatura Nacif ativada e sincronizada com a Stripe com sucesso!");
        setTimeout(() => setBillingMessage(""), 8000);
      };

      finalizeCheckoutSync();
    } else if (checkoutStatus === "cancelled") {
      setBillingMessage("O processo de checkout foi cancelado. Nenhuma cobrança foi efetuada.");
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setBillingMessage(""), 5000);
    } else if (portalReturn === "true") {
      window.history.replaceState({}, document.title, window.location.pathname);
      setBillingMessage("Sincronizando dados atualizados do Portal da Stripe...");
      loadData().finally(() => {
        setTimeout(() => setBillingMessage(""), 4000);
      });
    }
  }, []);

  /**
   * Função handleSubscription:
   * Disparada pelos botões "Contratar com documento" e "Fazer upgrade"
   * Comunica com a API da Stripe e redireciona o cliente para o Checkout seguro
   */
  const handleSubscription = async (priceId, planCode) => {
    if (!priceId && !planCode) {
      setBillingMessage("Identificador de preço (priceId) não configurado para este plano.");
      return;
    }

    const effectiveCycle = planCode === "estudante" ? "monthly" : cycle;

    try {
      setSubscribingPriceId(planCode || priceId);
      setBillingMessage("Redirecionando com segurança para a Stripe...");

      const data = await createCheckoutSession({
        priceId,
        planCode,
        cycle: effectiveCycle,
        userId: activeUser?.id,
        userEmail: activeUser?.email,
        userName: activeUser?.fullName || activeUser?.full_name || activeUser?.name,
      });

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de checkout não retornada pelo servidor.");
      }
    } catch (err) {
      console.error("[handleSubscription] Erro:", err);
      setBillingMessage(`Erro ao iniciar sessão na Stripe: ${err.message || "Tente novamente mais tarde."}`);
      setTimeout(() => setBillingMessage(""), 6000);
    } finally {
      setSubscribingPriceId(null);
    }
  };

  /**
   * Função handleCustomerPortal:
   * Abre o Customer Portal da Stripe ou o modal de gerenciamento da assinatura
   */
  const handleCustomerPortal = async () => {
    try {
      setPortalLoading(true);
      const data = await createPortalSession({
        userId: activeUser?.id,
        userEmail: activeUser?.email,
        userName: activeUser?.fullName || activeUser?.full_name || activeUser?.name,
        stripeCustomerId: subscription.stripeCustomerId,
        allowDirectFallback: false,
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setIsManageModalOpen(true);
      }
    } catch (err) {
      console.warn("[handleCustomerPortal] Abrindo modal de assinatura:", err);
      setIsManageModalOpen(true);
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7 pb-20">
      {/* 3.1 Cabeçalho */}
      <PageHeader
        icon={CreditCard}
        title="Assinatura e uso"
        subtitle="Gerencie seu plano, acompanhe seu consumo e escolha os recursos ideais para seus projetos."
        actionsPlacement="right"
        actions={
          <Button asChild variant="outline" className="h-10 rounded-[8px] border-[#D0D5DD] font-extrabold text-[#344054]">
            <Link to="/settings">
              <Settings className="mr-1.5 h-4 w-4 text-[#667085]" />
              Configurações da conta
            </Link>
          </Button>
        }
      />

      {billingMessage && (
        <section className="flex items-center justify-between rounded-[10px] border border-[#BCEEE5] bg-[#F7FBFE] p-4 text-sm font-semibold text-[#0f4f49]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-[#00d8b8]" />
            <span>{billingMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setBillingMessage("")}
            className="text-xs font-bold text-[#667085] hover:text-[#101828]"
          >
            Fechar
          </button>
        </section>
      )}

      {/* 3.2 Plano Atual e Uso no Período */}
      <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* Bloco Plano Atual */}
        <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#667085]">Plano atual</p>
              <h2 className="mt-1.5 text-2xl font-extrabold text-[#101828]">{subscription.plan.name}</h2>
              <p className="mt-1 text-xs font-medium leading-5 text-[#667085]">{subscription.plan.commercialTagline}</p>
            </div>
            <Badge className="rounded-[6px] border border-[#BCEEE5] bg-[#E8FCF8] text-xs font-extrabold text-[#0f4f49] hover:bg-[#E8FCF8]">
              Atual
            </Badge>
          </div>

          <div className="mt-4 rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB] p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[#101828]">Status da assinatura:</span>
              <Badge className="rounded-[4px] bg-emerald-100 text-emerald-800 text-[11px] font-bold hover:bg-emerald-100">
                {subscription.status === "active" ? "Ativa" : subscription.status}
              </Badge>
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[#667085]">Valor contratado:</span>
              <span className="font-extrabold text-[#101828]">
                {formatPlanPrice(subscription.plan, subscription.cycle)} / {subscription.cycle === "annual" ? "ano" : "mês"}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[#667085]">Periodicidade:</span>
              <span className="font-bold text-[#344054] capitalize">
                {subscription.cycle === "annual" ? "Anual (-30% OFF)" : "Mensal"}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[#667085]">Início do contrato:</span>
              <span className="font-semibold text-[#344054]">
                {formatIsoDate(subscription.startDate)}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[#667085]">Próxima renovação:</span>
              <span className="font-semibold text-[#344054]">
                {formatIsoDate(subscription.renewalDate)}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span className="text-[#667085]">Renovação automática:</span>
              <span className={`font-semibold ${subscription.autoRenew ? "text-emerald-700" : "text-amber-700"}`}>
                {subscription.autoRenew ? "Ativa" : "Encerra no fim do período"}
              </span>
            </div>
          </div>

          {/* Vínculo acadêmico para plano Estudante */}
          {subscription.plan.isAcademic && (
            <div className="mt-3.5 rounded-[8px] border border-blue-200 bg-blue-50/60 p-3 text-xs">
              <div className="flex items-center justify-between">
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
                  : "Necessário enviar comprovante de matrícula ativo."}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAcademicModalOpen(true)}
                className="mt-2 h-7 w-full rounded-[6px] border-blue-300 bg-white text-xs font-bold text-blue-900 hover:bg-blue-100"
              >
                {subscription.academicStatus === "approved" ? "Atualizar Documento" : "Enviar Comprovante"}
              </Button>
            </div>
          )}

          <Button
            type="button"
            disabled={portalLoading}
            onClick={handleCustomerPortal}
            className="mt-4 h-10 w-full rounded-[8px] border border-[#D0D5DD] bg-white font-extrabold text-[#344054] hover:bg-[#F9FAFB]"
          >
            {portalLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#00d8b8]" />
                Abrindo Portal Stripe...
              </span>
            ) : (
              "Gerenciar assinatura"
            )}
          </Button>
        </article>

        {/* Bloco 6. Uso no período */}
        <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[#101828]">Uso no período</h2>
              <p className="mt-0.5 text-xs font-medium text-[#667085]">
                {loading ? "Calculando consumo real..." : "Consumo calculado a partir dos projetos carregados no workspace."}
              </p>
            </div>
            <Badge variant="outline" className="w-fit rounded-[6px] border-[#D0D5DD] text-xs font-bold text-[#344054]">
              Renovação: {formatIsoDate(subscription.renewalDate)}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {usageRows.map((row) => (
              <div
                key={row.key}
                className={`rounded-[10px] border p-3.5 transition-all ${usageCardStyles[row.state] || usageCardStyles.normal}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-[#101828]">{row.label}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#667085] line-clamp-1" title={featureDescriptions[row.key]}>
                      {featureDescriptions[row.key]}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-[4px] border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.05em] ${
                      stateStyles[row.state] || stateStyles.normal
                    }`}
                  >
                    {row.state === "unlimited"
                      ? "Ilimitado"
                      : row.state === "limit"
                      ? "Limite"
                      : row.state === "near"
                      ? "Próximo"
                      : "Normal"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-bold text-[#344054]">
                  <span>{row.usedLabel} usado</span>
                  <span>{row.limitLabel}</span>
                </div>

                <Progress
                  value={row.limit === Number.POSITIVE_INFINITY ? 15 : row.percent}
                  className="mt-1.5 h-1.5 bg-[#EAECF0]"
                />

                <p className="mt-1.5 text-[11px] font-semibold text-[#667085]">
                  Restante: {row.remainingLabel}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* 3.3 Comparação de Planos (4 Cards Minimalistas) */}
      <section id="compare-plans" className="scroll-mt-8 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Planos & Assinaturas</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Escolha a estrutura ideal para a sua rotina técnica. Altere ou cancele a qualquer momento.
            </p>
          </div>

          {/* Seletor Mensal / Anual */}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`h-8 rounded-full px-4 text-xs font-bold transition-all ${
                cycle === "monthly"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`flex items-center gap-1.5 h-8 rounded-full px-4 text-xs font-bold transition-all ${
                cycle === "annual"
                  ? "bg-[#00d8b8] text-slate-950 font-extrabold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Anual</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${cycle === "annual" ? "bg-slate-950 text-[#00d8b8]" : "bg-emerald-100 text-emerald-800"}`}>
                -30% OFF
              </span>
            </button>
          </div>
        </div>

        {/* Grid dos 4 Cards Minimalistas */}
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_CATALOG.map((plan) => {
            const isCurrent = plan.code === subscription.planCode;
            const isCompleto = plan.code === "completo";
            const annualSavings = calculateAnnualSavings(plan);
            const targetPriceId = getPlanPriceId(plan.code, cycle);
            const isSubscribingThis = subscribingPriceId === plan.code || subscribingPriceId === targetPriceId;

            const highlights = PLAN_HIGHLIGHTS[plan.code] || plan.features.slice(0, 4);
            const subtitle = PLAN_SUBTITLES[plan.code] || plan.description;

            return (
              <article
                key={plan.code}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-all duration-200 ${
                  isCompleto
                    ? "border-[#00d8b8] bg-gradient-to-b from-white via-white to-[#F0FDFA]/40 shadow-[0_12px_32px_-10px_rgba(0,216,184,0.18)] ring-1 ring-[#00d8b8]"
                    : isCurrent
                    ? "border-teal-300 bg-[#F7FBFE] shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div>
                  {/* Top badges */}
                  <div className="flex items-center justify-between gap-2 min-h-[26px]">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[11px] font-bold text-[#0f4f49]">
                        <CheckCircle2 className="h-3 w-3 text-[#009b84]" />
                        Seu plano atual
                      </span>
                    ) : isCompleto ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8FCF8] border border-[#BCEEE5] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0f4f49]">
                        <Sparkles className="h-3 w-3 text-[#009b84]" />
                        Mais Completo
                      </span>
                    ) : (
                      <span />
                    )}
                  </div>

                  {/* Nome e subtítulo */}
                  <div className="mt-3">
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{plan.name}</h3>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed min-h-[32px]">
                      {subtitle}
                    </p>
                  </div>

                  {/* Preço */}
                  <div className="mt-4 pb-5 border-b border-slate-100">
                    {cycle === "annual" && plan.hasAnnualOption ? (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            R$ {annualSavings.monthlyEquiv.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">/mês</span>
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-emerald-700">
                          R$ {plan.annualPrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} /ano (-30% OFF)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            R$ {plan.monthlyPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">/mês</span>
                        </div>
                        {cycle === "annual" && !plan.hasAnnualOption && (
                          <p className="mt-1 text-[11px] font-medium text-amber-700">
                            Apenas faturamento mensal
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botão de Ação */}
                  <div className="mt-5">
                    <Button
                      type="button"
                      disabled={isCurrent || subscribingPriceId !== null}
                      onClick={() => {
                        if (plan.isAcademic && (!activeUser?.academic_status || activeUser?.academic_status === "not_submitted" || activeUser?.academic_status === "rejected")) {
                          setIsAcademicModalOpen(true);
                          return;
                        }
                        handleSubscription(targetPriceId, plan.code);
                      }}
                      className={`h-11 w-full rounded-xl font-bold text-xs transition-all ${
                        isCurrent
                          ? "bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-default border border-slate-200"
                          : isCompleto
                          ? "bg-[#00d8b8] text-slate-950 font-extrabold hover:bg-[#00bda1] shadow-xs hover:shadow"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      {isSubscribingThis ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Redirecionando...
                        </span>
                      ) : isCurrent ? (
                        "Plano em uso"
                      ) : plan.isAcademic ? (
                        "Contratar com documento"
                      ) : (
                        "Fazer upgrade"
                      )}
                    </Button>
                  </div>

                  {/* Lista de Recursos Principais (Minimalista) */}
                  <div className="mt-6 space-y-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Incluso neste plano:
                    </p>
                    <ul className="space-y-2.5">
                      {highlights.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-xs text-slate-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00d8b8]" />
                          <span className="leading-snug">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Link para comparação completa no rodapé do card */}
                <div className="mt-6 pt-3 border-t border-slate-100">
                  <a
                    href="#tabela-comparativa"
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors"
                  >
                    <span>Ver limites e detalhes</span>
                    <span>→</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. Nova Tabela Comparativa de Limites e Recursos */}
      <section id="tabela-comparativa" className="scroll-mt-8 overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white shadow-sm">
        <div className="border-b border-[#EAECF0] px-5 py-4">
          <h2 className="text-lg font-extrabold text-[#101828]">Tabela de limites</h2>
          <p className="mt-0.5 text-xs font-medium text-[#667085]">
            Fonte única usada pelo dashboard, sidebar e feature gating do Nacif Energy.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
              <TableHead className="px-5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">
                Recurso
              </TableHead>
              <TableHead className="px-5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">
                Estudante
              </TableHead>
              <TableHead className="px-5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">
                Elétrico
              </TableHead>
              <TableHead className="px-5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">
                Solar
              </TableHead>
              <TableHead className="px-5 text-xs font-extrabold uppercase tracking-[0.06em] text-[#0f4f49]">
                Completo
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PLAN_COMPARISON_ROWS.map((row) => {
              const renderValueBadge = (val, isCompleto = false) => {
                if (val === "Completo" || val === "Sim" || val === "Ilimitado") {
                  return (
                    <span className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-extrabold ${isCompleto ? "bg-[#E8FCF8] text-[#0f4f49]" : "bg-[#F0FDF4] text-[#166534]"}`}>
                      {val}
                    </span>
                  );
                }
                if (val === "Acadêmico") {
                  return (
                    <span className="inline-flex items-center rounded-[4px] bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800">
                      Acadêmico
                    </span>
                  );
                }
                if (val === "Restrito") {
                  return (
                    <span className="inline-flex items-center rounded-[4px] bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">
                      Restrito
                    </span>
                  );
                }
                if (val === "Não incluído" || val === "Não") {
                  return (
                    <span className="inline-flex items-center rounded-[4px] bg-[#F1F5F9] px-2 py-0.5 text-xs font-medium text-[#64748B]">
                      {val}
                    </span>
                  );
                }
                return <span className="font-semibold text-[#344054]">{val}</span>;
              };

              return (
                <TableRow key={row.key} className="hover:bg-[#F9FAFB]">
                  <TableCell className="px-5 py-3.5">
                    <p className="text-xs font-extrabold text-[#101828]">{row.label}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-[#667085]">{row.description}</p>
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-xs">
                    {renderValueBadge(row.values.estudante)}
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-xs">
                    {renderValueBadge(row.values.eletrico)}
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-xs">
                    {renderValueBadge(row.values.solar)}
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-xs">
                    {renderValueBadge(row.values.completo, true)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {/* Feature Gating e Retenção de Projetos */}
      <section className="rounded-[12px] border border-[#E4E7EC] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E8FCF8] text-[#00d8b8]">
              <ShieldCheck className="h-5 w-5 text-[#0f4f49]" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-[#101828]">Feature gating e retenção de dados</h2>
              <p className="mt-0.5 text-xs font-medium leading-5 text-[#667085]">
                A criação de novos bloqueios usa a camada unificada de planos. Downgrades ou alterações nunca apagam projetos, plantas ou orçamentos existentes, preservando o trabalho realizado.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-10 rounded-[8px] border-[#D0D5DD] font-extrabold text-[#344054]">
            <Link to="/projects">
              <FolderOpen className="mr-1.5 h-4 w-4" />
              Ver projetos
            </Link>
          </Button>
        </div>
      </section>

      {/* Modais de Fluxo Funcional */}
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
        user={activeUser}
        onChangePlanClick={() => {
          const el = document.querySelector("#compare-plans");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        onVerifyStudentClick={() => setIsAcademicModalOpen(true)}
      />
    </div>
  );
}
