import { Link, useNavigate } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Lock } from "lucide-react";

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <StatusState
          status="403"
          code="403"
          title="Acesso restrito"
          description="Você não possui permissão para acessar esta área ou recurso do sistema. Se você acredita que isto é um engano, entre em contato com o administrador da sua conta."
          primaryAction={
            <Button asChild className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm">
              <Link to="/">
                <Home className="h-3.5 w-3.5 mr-1.5" />
                Ir para o Início
              </Link>
            </Button>
          }
          secondaryAction={
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Voltar
            </Button>
          }
        />
      </div>
    </SystemPageLayout>
  );
}
