import { Link, useSearchParams } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const planName = searchParams.get("plan") || "Profissional";

  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <StatusState
          status="payment-success"
          code="PAGAMENTO CONFIRMADO"
          title="Assinatura ativada com sucesso!"
          description={`Seu plano ${planName} já está ativo. Todos os recursos profissionais de dimensionamento NBR 5410, exportação de pranchas, plantas e diagramas unifilares ilimitados estão liberados.`}
          primaryAction={
            <Button asChild className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-6 shadow-sm">
              <Link to="/">
                Ir para o Dashboard
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5">
              <Link to="/subscription">Ver detalhes da assinatura</Link>
            </Button>
          }
        />
      </div>
    </SystemPageLayout>
  );
}
