import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, RefreshCw, AlertCircle } from "lucide-react";

export default function ServerErrorPage({ error = null }) {
  const [errorId] = useState(() => Math.random().toString(36).substring(2, 9).toUpperCase());
  const [showStack, setShowStack] = useState(false);

  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <StatusState
          status="500"
          code="500"
          errorId={`ERR-${errorId}`}
          title="Algo não saiu como esperado"
          description="Ocorreu um erro interno ao processar sua solicitação. Nossos servidores registraram o evento e estamos trabalhando para normalizar a operação."
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
              <Link to="/">
                <Home className="h-3.5 w-3.5 mr-1.5" />
                Ir para o Início
              </Link>
            </Button>
          }
        />

        {error && (
          <div className="mt-6 max-w-xl w-full text-center">
            <button
              type="button"
              onClick={() => setShowStack((prev) => !prev)}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline font-medium cursor-pointer"
            >
              {showStack ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos do erro"}
            </button>
            {showStack && (
              <pre className="mt-2 p-3 bg-slate-900 text-rose-300 rounded-xl text-[11px] overflow-x-auto whitespace-pre-wrap font-mono text-left">
                {String(error.message || error)}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            )}
          </div>
        )}
      </div>
    </SystemPageLayout>
  );
}
