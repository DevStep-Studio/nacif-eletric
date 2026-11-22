import { Clock, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const formatIsoDate = (iso) => {
  if (!iso) return "Não informada";
  const d = new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/**
 * Card compacto e transparente de oferta/andamento do teste grátis (sem gradientes).
 */
export default function BillingNotice({
  canStartTrial = false,
  hasActiveTrial = false,
  trialEndDate = null,
  firstChargeDate = null,
  autoRenew = false,
  trialPriceLabel = "R$ 210,00/mês",
  onStartTrial,
  onManageTrial,
}) {
  if (!canStartTrial && !hasActiveTrial) return null;

  if (hasActiveTrial) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-[#BEEAD2] bg-[#E5FBF2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#BEEAD2] bg-white text-[#006B50]">
            <Clock className="h-4 w-4 stroke-[2.1]" />
          </span>
          <div>
            <h2 className="text-sm font-extrabold text-[#101828]">
              Teste grátis do Nacif Completo ativo até {formatIsoDate(trialEndDate)}
            </h2>
            <p className="mt-0.5 text-xs font-medium leading-relaxed text-[#006B50]">
              {autoRenew
                ? `Após o teste, a assinatura será renovada por ${trialPriceLabel} em ${formatIsoDate(firstChargeDate)}. Você pode cancelar a qualquer momento antes dessa data.`
                : "Renovação automática cancelada. Seu acesso permanece liberado até o término do período sem novas cobranças."}
            </p>
          </div>
        </div>

        {onManageTrial && (
          <Button
            type="button"
            variant="outline"
            onClick={onManageTrial}
            className="h-9 shrink-0 rounded-xl border-[#BEEAD2] bg-white px-4 text-xs font-bold text-[#006B50] hover:bg-[#F6F9FC]"
          >
            Gerenciar teste
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#BEEAD2] bg-[#E5FBF2] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#BEEAD2] bg-white text-[#006B50]">
          <Sparkles className="h-[18px] w-[18px] stroke-[2.1]" />
        </span>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-extrabold text-[#101828]">
              Experimente o plano Nacif Completo por 7 dias
            </h2>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#BEEAD2] bg-white px-2 py-0.5 text-[10.5px] font-bold text-[#006B50]">
              <ShieldCheck className="h-3 w-3" />
              Com validação de cartão
            </span>
          </div>
          <p className="text-xs font-medium leading-relaxed text-[#006B50]">
            Acesso completo por 7 dias na primeira contratação elegível. Após o período de avaliação, será cobrado {trialPriceLabel}; cancele antes da primeira cobrança caso não deseje continuar.
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={onStartTrial}
        className="h-9 shrink-0 rounded-xl bg-[#00D98A] px-4 text-xs font-extrabold text-[#031923] hover:bg-[#00C987]"
      >
        Testar Completo por 7 dias
      </Button>
    </section>
  );
}
