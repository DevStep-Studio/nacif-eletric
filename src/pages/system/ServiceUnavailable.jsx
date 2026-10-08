import { Link } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw } from "lucide-react";

export default function ServiceUnavailablePage() {
  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <StatusState
          status="503"
          code="503"
          title="Serviço temporariamente indisponível"
          description="Estamos operando sob alta demanda ou realizando uma atualização rápida de infraestrutura. Por favor, aguarde alguns instantes e tente novamente."
          primaryAction={
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Tentar novamente
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5">
              <Link to="/status">
                <Activity className="h-3.5 w-3.5 mr-1.5 text-[#00d8b8]" />
                Ver status dos serviços
              </Link>
            </Button>
          }
        />
      </div>
    </SystemPageLayout>
  );
}
