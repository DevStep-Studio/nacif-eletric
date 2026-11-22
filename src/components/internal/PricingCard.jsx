import { CheckCircle2, Clock, Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateAnnualSavings, formatPlanPrice } from "@/lib/subscriptionPlans";
import { cn } from "@/lib/utils";

/**
 * Card individual de plano comercial sem gradientes CSS.
 */
export default function PricingCard({
  plan,
  cycle = "monthly",
  isCurrent = false,
  isRecommended = false,
  isPendingRelease = false,
  showTrialOffer = false,
  subscribing = false,
  hasAccess = false,
  onSelect,
}) {
  const annualSavings = calculateAnnualSavings(plan);
  const highlights = (plan.features || []).slice(0, 5);
  const limitations = plan.limitations || [];

  return (
    <article
      className={cn(
        "relative flex flex-col justify-between rounded-2xl border p-5 transition-all",
        isRecommended
          ? "border-2 border-[#00D98A] bg-white shadow-[0_6px_18px_rgba(3,25,35,0.06)]"
          : isCurrent
          ? "border-2 border-[#006B50] bg-[#E5FBF2]/35"
          : isPendingRelease
          ? "border-[#E5EBF1] bg-[#F8FAFC]"
          : "border-[#E5EBF1] bg-white hover:border-[#BEEAD2]"
      )}
    >
      <div>
        {/* Badge de contexto no topo */}
        <div className="flex min-h-[26px] items-center justify-between gap-2">
          {isCurrent ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BEEAD2] bg-[#E5FBF2] px-2.5 py-0.5 text-[11px] font-bold text-[#006B50]">
              <CheckCircle2 className="h-3 w-3" />
              Plano atual
            </span>
          ) : isRecommended ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#00D98A]/45 bg-[#E5FBF2] px-2.5 py-0.5 text-[11px] font-extrabold text-[#006B50]">
              <Sparkles className="h-3 w-3" />
              {showTrialOffer ? "Recomendado · 7 dias grátis" : "Mais completo"}
            </span>
          ) : isPendingRelease ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-[#FFF3E6] px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
              <Clock className="h-3 w-3" />
              Em breve
            </span>
          ) : (
            <span />
          )}
        </div>

        {/* Nome e público/descrição */}
        <div className="mt-3">
          <h3 className="text-lg font-extrabold tracking-tight text-[#101828]">
            {plan.name}
          </h3>
          <p className="mt-1 min-h-[34px] text-xs font-medium leading-relaxed text-[#64748B]">
            {plan.description}
          </p>
        </div>

        {/* Preço real */}
        <div className="mt-4 border-b border-[#E5EBF1] pb-4">
          {isPendingRelease ? (
            <div>
              <div className="flex items-baseline gap-1 opacity-80">
                <span className="text-2xl font-extrabold tracking-tight text-[#101828] tabular-nums">
                  R$ {Number(plan.monthlyPrice || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-[#64748B]">/mês</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-[#FFF3E6] px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                <Lock className="h-3 w-3 shrink-0" />
                <span>Em aguardo para próximas atualizações</span>
              </div>
            </div>
          ) : cycle === "annual" && plan.hasAnnualOption ? (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-[26px] font-extrabold tracking-tight text-[#101828] tabular-nums">
                  R$ {annualSavings.monthlyEquiv.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-[#64748B]">/mês</span>
              </div>
              <p className="mt-1 text-[11px] font-bold text-[#006B50] tabular-nums">
                Cobrado R$ {Number(plan.annualPrice || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/ano (-{annualSavings.discountPercent}% OFF)
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-[26px] font-extrabold tracking-tight text-[#101828] tabular-nums">
                  R$ {Number(plan.monthlyPrice || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-semibold text-[#64748B]">/mês</span>
              </div>
              {cycle === "annual" && !plan.hasAnnualOption && (
                <p className="mt-1 text-[11px] font-medium text-amber-700">
                  Apenas faturamento mensal disponível
                </p>
              )}
            </div>
          )}
        </div>

        {/* Botão de Contratação */}
        <div className="mt-4">
          <Button
            type="button"
            disabled={isCurrent || subscribing || isPendingRelease}
            onClick={onSelect}
            className={cn(
              "h-10 w-full rounded-xl text-xs font-extrabold transition",
              isCurrent
                ? "border border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B] hover:bg-[#F6F9FC] cursor-default"
                : isPendingRelease
                ? "border border-[#E5EBF1] bg-[#F1F5F9] text-[#64748B] hover:bg-[#F1F5F9] cursor-not-allowed"
                : isRecommended
                ? "bg-[#00D98A] text-[#031923] hover:bg-[#00C987]"
                : "bg-[#031923] text-white hover:bg-[#082732]"
            )}
          >
            {subscribing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecionando...
              </span>
            ) : isCurrent ? (
              "Plano em uso"
            ) : isPendingRelease ? (
              "Disponível em breve"
            ) : showTrialOffer ? (
              "Testar grátis por 7 dias"
            ) : plan.isAcademic ? (
              "Solicitar acesso acadêmico"
            ) : hasAccess ? (
              "Alterar para este plano"
            ) : (
              "Assinar plano"
            )}
          </Button>
          {showTrialOffer && (
            <p className="mt-2 text-[11px] leading-snug text-[#64748B]">
              Depois, {formatPlanPrice(plan, "monthly")}/mês com cartão. Cancele antes da 1ª cobrança para não pagar.
            </p>
          )}
        </div>

        {/* Recursos principais */}
        <div className="mt-5 space-y-2">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">
            Principais recursos
          </p>
          <ul className="space-y-2">
            {highlights.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs text-[#101828]">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#006B50]" />
                <span className="leading-snug">{feature}</span>
              </li>
            ))}
          </ul>
          {limitations.length > 0 && !isPendingRelease && (
            <p className="pt-1 text-[11px] font-medium leading-snug text-[#64748B]">
              Nota: {limitations[0]}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-[#E5EBF1] pt-3">
        <a
          href="#tabela-comparativa"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006B50] hover:underline"
        >
          Ver comparação completa →
        </a>
      </div>
    </article>
  );
}
