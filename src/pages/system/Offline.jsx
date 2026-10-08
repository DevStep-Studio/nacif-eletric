import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Wifi } from "lucide-react";

export default function OfflinePage() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        {isOnline ? (
          <StatusState
            status="payment-success"
            code="CONECTADO"
            icon={Wifi}
            title="Conexão restabelecida"
            description="Sua conexão com a internet foi restaurada com sucesso. Você pode continuar trabalhando em seus projetos."
            primaryAction={
              <Button asChild className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm">
                <Link to="/">Continuar para o Dashboard</Link>
              </Button>
            }
          />
        ) : (
          <StatusState
            status="offline"
            code="SEM CONEXÃO"
            title="Sem conexão com a internet"
            description="Não foi possível estabelecer contato com a rede. Verifique seu cabo de rede, Wi-Fi ou dados móveis e tente reconectar."
            primaryAction={
              <Button
                type="button"
                onClick={() => window.location.reload()}
                className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Tentar reconectar
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
        )}
      </div>
    </SystemPageLayout>
  );
}
