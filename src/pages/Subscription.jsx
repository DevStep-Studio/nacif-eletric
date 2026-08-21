import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CreditCard, FolderOpen, Info, ShieldCheck } from "lucide-react";
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
  buildUsageFromProjects,
  formatLimitValue,
  getUsageRows,
  normalizeSubscription,
} from "@/lib/subscriptionPlans";

const featureDescriptions = {
  [FEATURE_KEYS.PROJECTS]: "Quantidade de projetos ativos no workspace.",
  [FEATURE_KEYS.STORAGE_MB]: "Arquivos, importações e anexos associados aos projetos.",
  [FEATURE_KEYS.TEAM_MEMBERS]: "Usuários que podem participar da organização.",
  [FEATURE_KEYS.EXPORTS]: "Geração de PDF, memorial, listas e documentação.",
  [FEATURE_KEYS.AI_SCANS]: "Processamentos de imagem e leitura assistida por IA.",
  [FEATURE_KEYS.CUSTOM_TEMPLATES]: "Modelos criados pela organização.",
};

const formatPrice = (plan, cycle) => {
  const value = cycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
  if (value === 0) return "R$ 0";
  return `R$ ${Number(value).toLocaleString("pt-BR")}`;
};

const stateStyles = {
  normal: "text-[#0f4f49]",
  near: "text-[#0f4f49]",
  limit: "text-[#0f4f49]",
};

const usageStateStyles = {
  normal: "border-[#BCEEE5] bg-[#F7FBFE]",
  near: "border-[#BCEEE5] bg-[#F7FBFE]",
  limit: "border-[#BCEEE5] bg-[#F7FBFE]",
};

const planToneStyles = {
  free: {
    card: "border-[#BCEEE5] bg-[#F7FBFE]",
    badge: "bg-[#00d8b8] text-white hover:bg-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  professional: {
    card: "border-[#BCEEE5] bg-[#F7FBFE]",
    badge: "bg-[#00d8b8] text-white hover:bg-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
  engineering: {
    card: "border-[#BCEEE5] bg-[#F7FBFE]",
    badge: "bg-[#00d8b8] text-white hover:bg-[#00d8b8]",
    rail: "bg-[#00d8b8]",
  },
};

const isLocalDevelopment = () => {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
};

export default function Subscription() {
  const { user } = useAuth();
  const [activeUser, setActiveUser] = useState(user);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingMessage, setBillingMessage] = useState("");
  const [cycle, setCycle] = useState("monthly");

  useEffect(() => {
    setActiveUser(user);
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [me, projectList] = await Promise.all([
          backend.auth.me().catch(() => user),
          backend.entities.Project.list("-updated_date", 100).catch(() => []),
        ]);
        if (cancelled) return;
        setActiveUser(me || user);
        setProjects(Array.isArray(projectList) ? projectList : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const subscription = normalizeSubscription(activeUser);
  const usage = useMemo(() => buildUsageFromProjects(projects), [projects]);
  const usageRows = useMemo(() => getUsageRows(subscription.plan, usage), [subscription.plan, usage]);
  const billingProvider = useMemo(() => createBillingProvider(activeUser), [activeUser]);
  const showBillingNotConfigured = !billingProvider.isConfigured && (isLocalDevelopment() || activeUser?.role === "admin");

  const requestUpgrade = async (plan) => {
    setBillingMessage("");
    try {
      await billingProvider.startCheckout({ planCode: plan.code, cycle });
      setBillingMessage("Checkout iniciado pelo provedor de cobrança.");
    } catch (error) {
      setBillingMessage(error.message || "Não foi possível iniciar a cobrança.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-20">
      <PageHeader
        icon={CreditCard}
        title="Assinatura e uso"
        subtitle="Planos, limites e consumo da conta com base nos dados reais disponíveis."
        actionsPlacement="right"
        actions={
          <Button asChild variant="outline" className="h-10 rounded-[8px] border-[#D0D5DD] font-extrabold">
            <Link to="/settings">Configurações da conta</Link>
          </Button>
        }
      />

      {showBillingNotConfigured && (
        <section className="rounded-[10px] border border-[#BCEEE5] bg-[#F7FBFE] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#00d8b8]" />
            <div>
              <p className="text-sm font-extrabold text-[#0f4f49]">Cobrança ainda não configurada</p>
              <p className="mt-1 text-sm font-medium leading-6 text-[#0f4f49]">
                A interface está pronta para um BillingProvider, mas o gateway real ainda não foi conectado para esta conta.
              </p>
            </div>
          </div>
        </section>
      )}

      {billingMessage && (
        <section className="rounded-[10px] border border-[#D0D5DD] bg-white p-4 text-sm font-semibold text-[#344054]">
          {billingMessage}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#667085]">Plano atual</p>
              <h2 className="mt-2 text-2xl font-extrabold text-[#101828]">{subscription.plan.name}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">{subscription.plan.description}</p>
            </div>
            <Badge className="rounded-[8px] bg-[#E8FCF8] text-[#0f4f49] hover:bg-[#E8FCF8]">Atual</Badge>
          </div>

          <div className="mt-5 rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB] p-4">
            <p className="text-sm font-extrabold text-[#101828]">Status da assinatura</p>
            <p className="mt-1 text-sm font-medium text-[#667085]">{subscription.status}</p>
            <p className="mt-3 text-sm font-extrabold text-[#101828]">Provedor</p>
            <p className="mt-1 text-sm font-medium text-[#667085]">{billingProvider.provider}</p>
          </div>

          <div className="mt-5 flex rounded-[8px] border border-[#D0D5DD] bg-white p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`h-9 flex-1 rounded-[6px] text-sm font-extrabold ${cycle === "monthly" ? "bg-[#E8FCF8] text-[#00d8b8]" : "text-[#667085]"}`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`h-9 flex-1 rounded-[6px] text-sm font-extrabold ${cycle === "annual" ? "bg-[#E8FCF8] text-[#00d8b8]" : "text-[#667085]"}`}
            >
              Anual
            </button>
          </div>
        </article>

        <article className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[#101828]">Uso no período</h2>
              <p className="mt-1 text-sm font-medium text-[#667085]">
                {loading ? "Carregando consumo real..." : "Consumo calculado a partir dos projetos carregados."}
              </p>
            </div>
            <Badge variant="outline" className="w-fit rounded-[8px] border-[#D0D5DD] text-[#344054]">
              Renovação: {subscription.renewalDate || "não informada"}
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {usageRows.map((row) => (
              <div key={row.key} className={`rounded-[10px] border p-4 ${usageStateStyles[row.state] || usageStateStyles.normal}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#101828]">{row.label}</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-[#667085]">{featureDescriptions[row.key]}</p>
                  </div>
                  <span className={`text-xs font-extrabold uppercase tracking-[0.06em] ${stateStyles[row.state]}`}>
                    {row.state === "limit" ? "Limite" : row.state === "near" ? "Próximo" : "Normal"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[#667085]">
                  <span>{row.usedLabel} usado</span>
                  <span>{row.limitLabel}</span>
                </div>
                <Progress value={row.percent} className="mt-2 h-2 bg-[#EAECF0]" />
                <p className="mt-2 text-xs font-semibold text-[#667085]">Restante: {row.remainingLabel}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#101828]">Comparar planos</h2>
            <p className="mt-1 text-sm font-medium text-[#667085]">Estrutura centralizada para limites, recursos e upgrade.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {PLAN_CATALOG.map((plan) => {
            const isCurrent = plan.code === subscription.planCode;
            const tone = planToneStyles[plan.code] || planToneStyles.free;
            return (
              <article key={plan.code} className={`relative overflow-hidden rounded-[12px] border p-5 ${isCurrent ? tone.card : "border-[#E4E7EC] bg-white"}`}>
                <span className={`absolute inset-x-5 top-0 h-1 rounded-b-full ${tone.rail}`} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-[#101828]">{plan.name}</h3>
                    <p className="mt-1 text-sm font-medium leading-6 text-[#667085]">{plan.description}</p>
                  </div>
                  {plan.recommended && <Badge className={`rounded-[8px] ${tone.badge}`}>Recomendado</Badge>}
                </div>
                <p className="mt-5 text-3xl font-extrabold text-[#101828]">
                  {formatPrice(plan, cycle)}
                  <span className="ml-1 text-sm font-semibold text-[#667085]">/{cycle === "annual" ? "ano" : "mês"}</span>
                </p>
                <ul className="mt-5 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm font-medium leading-5 text-[#344054]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00d8b8]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => requestUpgrade(plan)}
                  className="mt-5 h-10 w-full rounded-[8px] font-extrabold"
                  variant={isCurrent ? "secondary" : "default"}
                >
                  {isCurrent ? "Plano atual" : billingProvider.isConfigured ? "Fazer upgrade" : "Solicitar upgrade"}
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[12px] border border-[#E4E7EC] bg-white">
        <div className="border-b border-[#EAECF0] px-5 py-4">
          <h2 className="text-lg font-extrabold text-[#101828]">Tabela de limites</h2>
          <p className="mt-1 text-sm font-medium text-[#667085]">Fonte única usada pelo dashboard, sidebar e feature gating.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
              <TableHead className="px-5 text-xs font-extrabold uppercase tracking-[0.06em]">Recurso</TableHead>
              {PLAN_CATALOG.map((plan) => (
                <TableHead key={plan.code} className="px-5 text-xs font-extrabold uppercase tracking-[0.06em]">{plan.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(FEATURE_KEYS).map((featureKey) => (
              <TableRow key={featureKey}>
                <TableCell className="px-5 py-4">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#00d8b8]" />
                    <span>
                      <span className="block text-sm font-extrabold text-[#101828]">{usageRows.find((row) => row.key === featureKey)?.label}</span>
                      <span className="mt-1 block text-xs font-medium text-[#667085]">{featureDescriptions[featureKey]}</span>
                    </span>
                  </div>
                </TableCell>
                {PLAN_CATALOG.map((plan) => (
                  <TableCell key={plan.code} className="px-5 py-4 text-sm font-semibold text-[#344054]">
                    {formatLimitValue(plan.limits[featureKey], featureKey)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-[12px] border border-[#E4E7EC] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E8FCF8] text-[#00d8b8]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold text-[#101828]">Feature gating centralizado</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-[#667085]">
                A criação de novos bloqueios deve usar a camada de planos, preservando projetos existentes e explicando limites sem perder trabalho.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-10 rounded-[8px] border-[#D0D5DD] font-extrabold">
            <Link to="/projects">
              <FolderOpen className="h-4 w-4" />
              Ver projetos
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
