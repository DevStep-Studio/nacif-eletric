import { useLocation, Link } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { LogIn, Home } from "lucide-react";

export default function UnauthorizedPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirect = searchParams.get("redirect") || "/";

  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <StatusState
          status="401"
          code="401"
          title="Sessão expirada"
          description="Sua sessão terminou por segurança ou você precisa autenticar-se para continuar acessando os projetos e ferramentas de engenharia."
          primaryAction={
            <Button asChild className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm">
              <Link to={`/login?redirect=${encodeURIComponent(redirect)}`}>
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Entrar novamente
              </Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5">
              <Link to="/">
                <Home className="h-3.5 w-3.5 mr-1.5" />
                Ir para o Início
              </Link>
            </Button>
          }
        />
      </div>
    </SystemPageLayout>
  );
}
