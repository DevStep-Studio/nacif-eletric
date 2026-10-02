import { Link } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Chrome, Globe } from "lucide-react";

export default function UnsupportedBrowserPage() {
  return (
    <SystemPageLayout showBackButton={false} showHeader={true} showFooter={true}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <StatusState
          status="limit-reached"
          icon={AlertTriangle}
          code="NAVEGADOR DESATUALIZADO"
          title="Navegador não suportado"
          description="Para utilizar com máxima performance o editor de projetos elétricos com aceleração gráfica WebGL e renderização Konva, recomendamos utilizar uma versão recente de navegadores modernos."
          primaryAction={
            <Button asChild className="h-10 w-full sm:w-auto rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm">
              <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer">
                <Chrome className="h-3.5 w-3.5 mr-1.5" />
                Baixar Google Chrome
              </a>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-5">
              <Link to="/">Tentar continuar mesmo assim</Link>
            </Button>
          }
        />
      </div>
    </SystemPageLayout>
  );
}
