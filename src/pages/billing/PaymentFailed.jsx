import { Link, useSearchParams } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { CreditCard, HelpCircle, RefreshCw } from "lucide-react";

export default function PaymentFailedPage() {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason") || "recusa_operadora";

  const reasonText = {
    recusa_operadora: "A transação foi recusada pela emissora do seu cartão ou banco. Recomendamos verificar o limite disponível ou tentar outro meio de pagamento.",
    expirado: "O prazo de pagamento do boleto ou código PIX expirou.",
    dados_invalidos: "Os dados de cartão ou identificação informados não puderam ser validados.",
  }[reason] || "Não foi possível concluir o processamento da transação.";

  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <StatusState
          status="payment-failed"
          code="PAGAMENTO NÃO CONCLUÍDO"
          title="Não foi possível concluir o pagamento"
          description={reasonText}
          primaryAction={
            <Button asChild className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm">
              <Link to="/subscription">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Tentar novamente / Alterar forma
              </Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5">
              <Link to="/suporte">
                <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                Falar com suporte
              </Link>
            </Button>
          }
        />
      </div>
    </SystemPageLayout>
  );
}
