import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Lock, ShieldAlert, GraduationCap, ArrowRight, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { canAccessModule, normalizeSubscription } from "@/lib/subscriptionPlans";

/**
 * Componente centralizado de guarda de recursos por plano de assinatura.
 * Se o usuário possuir acesso, renderiza os filhos (com identificação acadêmica quando aplicável).
 * Se o recurso for restrito pelo plano atual, renderiza o bloqueio contextual com botão "Ver planos".
 */
export default function ModuleAccessGate({
  moduleKey,
  moduleTitle = "Recurso Avançado",
  children,
  fallback = null,
  showAcademicBanner = true,
}) {
  const { user } = useAuth();
  const subscription = useMemo(() => normalizeSubscription(user), [user]);
  const access = useMemo(() => canAccessModule(user, moduleKey), [user, moduleKey]);

  if (!access.allowed) {
    if (fallback) return fallback;

    return (
      <div className="mx-auto my-8 max-w-3xl rounded-[16px] border border-[#BCEEE5] bg-white p-8 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[12px] bg-[#E8FCF8] text-[#00d8b8]">
            {access.level === "expired" ? (
              <AlertTriangle className="h-7 w-7 text-[#0f4f49]" />
            ) : (
              <Lock className="h-7 w-7 text-[#0f4f49]" />
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge variant="outline" className="border-[#BCEEE5] bg-[#F7FBFE] text-xs font-bold text-[#0f4f49]">
              Plano atual: {subscription.plan.name}
            </Badge>
            {access.level === "expired" && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                Vínculo acadêmico expirado
              </Badge>
            )}
          </div>

          <h2 className="mt-3 text-2xl font-extrabold text-[#101828]">
            {moduleTitle ? `${moduleTitle} indisponível neste plano` : "Recurso exclusivo"}
          </h2>

          <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#667085]">
            {access.message || "Este recurso exige um plano superior ou específico com autorização técnica."}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="h-10 rounded-[8px] bg-[#00d8b8] px-5 font-extrabold text-[#0f172a] hover:bg-[#00bda1]">
              <Link to="/subscription">
                Ver planos e fazer upgrade
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-[8px] border-[#D0D5DD] font-extrabold text-[#344054]">
              <Link to="/projects">Voltar para Projetos</Link>
            </Button>
          </div>

          <p className="mt-4 text-xs font-semibold text-[#98A2B3]">
            Seus projetos e documentos existentes permanecem 100% seguros e preservados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showAcademicBanner && access.isAcademic && (
        <div className="mb-4 flex items-center justify-between rounded-[8px] border border-blue-200 bg-blue-50/80 px-4 py-2.5 text-xs text-blue-900 shadow-sm">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 shrink-0 text-blue-700" />
            <span className="font-bold">
              Versão Acadêmica — Nacif Estudante — Uso Educacional
            </span>
          </div>
          <span className="hidden text-[11px] font-semibold text-blue-700 md:inline">
            Documentos emitidos com identificação acadêmica
          </span>
        </div>
      )}
      {children}
    </>
  );
}
