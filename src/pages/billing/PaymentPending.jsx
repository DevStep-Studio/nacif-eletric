import { Link } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { Clock, Home, RefreshCw } from "lucide-react";

export default function PaymentPendingPage() {
  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <StatusState
          status="payment-pending"
          code="AGUARDANDO COMPENSAÇÃO"
          title="Pagamento em processamento"
          description="Recebemos sua solicitação de assinatura. Pagamentos via PIX costumam ser confirmados em poucos segundos, enquanto boletos bancários podem levar até 2 dias úteis. Assim que compensado, seu plano será liberado automaticamente."
          primaryAction={
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Verificar status agora
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5">
              <Link to="/">
                <Home className="h-3.5 w-3.5 mr-1.5" />
                Ir para o Dashboard
              </Link>
            </Button>
          }
        />
      </div>
    </SystemPageLayout>
  );
}
