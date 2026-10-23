import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FolderOpen,
  Info,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Settings,
  Calendar,
  XCircle,
  HelpCircle,
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
  formatLimitValue,
  getUsageRows,
  normalizeSubscription,
  formatPlanPrice,
  calculateAnnualSavings,
} from "@/lib/subscriptionPlans";
import AcademicVerificationModal from "@/components/subscription/AcademicVerificationModal";
import PlanChangeModal from "@/components/subscription/PlanChangeModal";
import ManageSubscriptionModal from "@/components/subscription/ManageSubscriptionModal";

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
  const usage = useMemo(() => buildUsageFromProjects(projects), [projects]);
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
              <span className="font-semibold text-emerald-700">Ativa</span>
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
            onClick={() => setIsManageModalOpen(true)}
            className="mt-4 h-10 w-full rounded-[8px] border border-[#D0D5DD] bg-white font-extrabold text-[#344054] hover:bg-[#F9FAFB]"
          >
            Gerenciar assinatura
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

      {/* 3.3 Comparação de Planos (4 Cards) */}
      <section className="rounded-[12px] border border-[#E4E7EC] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#101828]">Comparar planos</h2>
            <p className="mt-0.5 text-xs font-medium text-[#667085]">
              Escolha a estrutura comercial ideal para sua demanda técnica e profissional.
            </p>
          </div>

          {/* Seletor Mensal / Anual */}
          <div className="flex items-center gap-2 rounded-[10px] border border-[#D0D5DD] bg-[#F9FAFB] p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`h-8 rounded-[6px] px-4 text-xs font-extrabold transition-all ${
                cycle === "monthly"
                  ? "bg-[#00d8b8] text-[#0f172a] shadow-sm"
                  : "text-[#667085] hover:text-[#101828]"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`flex items-center gap-1.5 h-8 rounded-[6px] px-4 text-xs font-extrabold transition-all ${
                cycle === "annual"
                  ? "bg-[#00d8b8] text-[#0f172a] shadow-sm"
                  : "text-[#667085] hover:text-[#101828]"
              }`}
            >
              <span>Anual</span>
              <span className="rounded-full bg-[#0f172a] px-1.5 py-0.2 text-[10px] text-[#00d8b8]">
                -30% OFF
              </span>
            </button>
          </div>
        </div>

        {/* Grid dos 4 Cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_CATALOG.map((plan) => {
            const isCurrent = plan.code === subscription.planCode;
            const isCompleto = plan.code === "completo";
            const annualSavings = calculateAnnualSavings(plan);

            return (
              <article
                key={plan.code}
                className={`relative flex flex-col justify-between rounded-[14px] border p-5 transition-all ${
                  isCurrent
                    ? "border-[#00d8b8] bg-[#F7FBFE] shadow-sm ring-1 ring-[#00d8b8]"
                    : isCompleto
                    ? "border-[#BCEEE5] bg-white shadow-sm ring-1 ring-[#BCEEE5]"
                    : "border-[#E4E7EC] bg-white hover:border-[#D0D5DD]"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-extrabold text-[#101828]">{plan.name}</h3>
                      <p className="mt-1 text-xs font-semibold text-[#667085] leading-relaxed">
                        {plan.targetAudience}
                      </p>
                    </div>
                    {plan.highlightBadge && (
                      <Badge className="shrink-0 rounded-[6px] border border-[#BCEEE5] bg-[#E8FCF8] text-[10px] font-extrabold text-[#0f4f49] hover:bg-[#E8FCF8]">
                        {plan.highlightBadge}
                      </Badge>
                    )}
                  </div>

                  {/* 3.4 Texto Comercial do Card */}
                  <div className="mt-3 rounded-[8px] bg-[#F9FAFB] p-2.5 text-xs font-medium italic text-[#475467] border border-[#EAECF0]">
                    "{plan.commercialTagline}"
                  </div>

                  {/* Preço e Ciclo */}
                  <div className="mt-4">
                    {cycle === "annual" && plan.hasAnnualOption ? (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-[#101828]">
                            R$ {annualSavings.monthlyEquiv.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs font-semibold text-[#667085]">/mês</span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold text-emerald-700">
                          R$ {plan.annualPrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} cobrado anualmente (-30%)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-[#101828]">
                            R$ {plan.monthlyPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs font-semibold text-[#667085]">/mês</span>
                        </div>
                        {cycle === "annual" && !plan.hasAnnualOption && (
                          <p className="mt-0.5 text-[11px] font-medium text-amber-700">
                            Apenas contratação mensal disponível
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Lista de Recursos Principais */}
                  <div className="mt-5 space-y-2 border-t border-[#EAECF0] pt-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#667085]">
                      Recursos incluídos:
                    </p>
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs font-medium leading-5 text-[#344054]">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00d8b8]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Limitações importantes */}
                  {plan.limitations?.length > 0 && (
                    <div className="mt-4 border-t border-[#EAECF0] pt-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#667085]">
                        Avisos e Limitações:
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {plan.limitations.map((lim) => (
                          <li key={lim} className="flex items-start gap-1.5 text-[11px] font-medium leading-4 text-[#667085]">
                            <Info className="mt-0.5 h-3 w-3 shrink-0 text-[#98A2B3]" />
                            <span>{lim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-3">
                  <Button
                    type="button"
                    disabled={isCurrent}
                    onClick={() => handlePlanSelect(plan)}
                    className={`h-10 w-full rounded-[8px] font-extrabold text-xs transition-all ${
                      isCurrent
                        ? "bg-[#EAECF0] text-[#667085] hover:bg-[#EAECF0] cursor-default"
                        : isCompleto
                        ? "bg-[#00d8b8] text-[#0f172a] hover:bg-[#00bda1] shadow-sm"
                        : "bg-[#0f172a] text-white hover:bg-[#1e293b]"
                    }`}
                  >
                    {isCurrent
                      ? "Plano atual"
                      : plan.isAcademic
                      ? "Contratar com documento"
                      : "Fazer upgrade"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. Nova Tabela Comparativa de Limites e Recursos */}
      <section className="overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white shadow-sm">
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
        onChangePlanClick={() => {
          const el = document.querySelector("#compare-plans");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
        onVerifyStudentClick={() => setIsAcademicModalOpen(true)}
      />
    </div>
  );
}
