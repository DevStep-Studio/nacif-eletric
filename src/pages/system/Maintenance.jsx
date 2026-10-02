import { Link } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, ShieldCheck } from "lucide-react";

export default function MaintenancePage() {
  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <StatusState
          status="maintenance"
          code="MANUTENÇÃO PROGRAMADA"
          title="Estamos fazendo melhorias no sistema"
          description="Nossa equipe está aplicando otimizações de segurança e atualizações nos motores de dimensionamento elétrico. Seus dados e projetos permanecem seguros e estarão acessíveis em breve."
          primaryAction={
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Recarregar página
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5">
              <Link to="/status">
                <Activity className="h-3.5 w-3.5 mr-1.5 text-[#00d8b8]" />
                Acompanhar status
              </Link>
            </Button>
          }
        />
      </div>
    </SystemPageLayout>
  );
}
