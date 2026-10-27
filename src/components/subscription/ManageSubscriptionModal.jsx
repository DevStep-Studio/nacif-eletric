import { useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Calendar, CheckCircle2, AlertTriangle, GraduationCap, ArrowUpRight, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPlanPrice } from "@/lib/subscriptionPlans";
import { createPortalSession } from "@/lib/stripeConfig";

export default function ManageSubscriptionModal({
  isOpen,
  onClose,
  subscription,
  onChangePlanClick,
  onVerifyStudentClick,
}) {
  if (!subscription) return null;

  const plan = subscription?.plan;
  const isStudent = plan?.isAcademic;
  const [portalLoading, setPortalLoading] = useState(false);

  const handleOpenPortal = async () => {
    try {
      setPortalLoading(true);
      const data = await createPortalSession();
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.warn("Portal da Stripe indisponível:", err);
    } finally {
      setPortalLoading(false);
    }
  };

  const formatIsoDate = (iso) => {
    if (!iso) return "Não informada";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return String(iso);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ativa</Badge>;
      case "cancelled":
        return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">Cancelada</Badge>;
      case "pending":
      case "pending_review":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Em Análise</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100">{status || "Ativa"}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-[16px] border border-[#E4E7EC] bg-white p-6 sm:p-7">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#E8FCF8] text-[#00d8b8]">
              <CreditCard className="h-5 w-5 text-[#0f4f49]" />
            </div>
            <div>
              <DialogTitle className="text-xl font-extrabold text-[#101828]">
                Gerenciar Assinatura
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-[#667085]">
                Informações da conta, periodicidade, cobrança e benefícios
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-[12px] border border-[#BCEEE5] bg-[#F7FBFE] p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#667085]">Plano Contratado</span>
                <h3 className="mt-1 text-2xl font-extrabold text-[#101828]">{plan.name}</h3>
                <p className="mt-0.5 text-xs font-semibold text-[#667085]">{plan.commercialTagline}</p>
              </div>
              {getStatusBadge(subscription.status)}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#BCEEE5]/60 pt-3 text-xs">
              <div>
                <span className="text-[#667085]">Valor atual</span>
                <p className="font-extrabold text-[#101828]">
                  {formatPlanPrice(plan, subscription.cycle)} / {subscription.cycle === "annual" ? "ano" : "mês"}
                </p>
              </div>
              <div>
                <span className="text-[#667085]">Periodicidade</span>
                <p className="font-extrabold text-[#101828] capitalize">
                  {subscription.cycle === "annual" ? "Anual (-30% OFF)" : "Mensal"}
                </p>
              </div>
              <div>
                <span className="text-[#667085]">Data de início</span>
                <p className="font-semibold text-[#101828]">{formatIsoDate(subscription.startDate)}</p>
              </div>
              <div>
                <span className="text-[#667085]">Próxima renovação</span>
                <p className="font-semibold text-[#101828]">{formatIsoDate(subscription.renewalDate)}</p>
              </div>
            </div>
          </div>

          {/* Seção específica para plano Estudante */}
          {isStudent && (
            <div className="rounded-[10px] border border-blue-200 bg-blue-50/60 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-extrabold text-blue-900">
                  <GraduationCap className="h-4 w-4 text-blue-700" />
                  <span>Vínculo Acadêmico</span>
                </div>
                <span className="font-bold text-blue-800">
                  {subscription.academicStatus === "approved"
                    ? "Validado"
                    : subscription.academicStatus === "pending_review"
                    ? "Em análise"
                    : subscription.academicStatus === "expired"
                    ? "Vencido"
                    : "Pendente"}
                </span>
              </div>
              <p className="mt-1 text-blue-800">
                {subscription.academicInstitution
                  ? `${subscription.academicInstitution} — ${subscription.academicCourse}`
                  : "Comprovante de matrícula em análise ou pendente de envio."}
              </p>
              {onVerifyStudentClick && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onVerifyStudentClick}
                  className="mt-2.5 h-8 w-full rounded-[6px] border-blue-300 bg-white text-xs font-bold text-blue-900 hover:bg-blue-100"
                >
                  Atualizar Comprovante Acadêmico
                </Button>
              )}
            </div>
          )}

          {/* Garantia de dados */}
          <div className="flex items-center gap-2 rounded-[8px] bg-[#F9FAFB] p-2.5 text-xs text-[#667085]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#00d8b8]" />
            <span>Seus projetos e plantas nunca são apagados ao mudar ou encerrar a assinatura.</span>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              disabled={portalLoading}
              onClick={handleOpenPortal}
              className="h-10 rounded-[8px] border border-[#D0D5DD] bg-white font-extrabold text-[#344054] hover:bg-[#F9FAFB] shadow-xs"
            >
              {portalLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#00d8b8]" />
                  Conectando ao Stripe...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <ExternalLink className="h-4 w-4 text-[#667085]" />
                  Acessar Portal do Cliente Stripe
                </span>
              )}
            </Button>

            {onChangePlanClick && (
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onChangePlanClick();
                }}
                className="h-10 rounded-[8px] bg-[#00d8b8] font-extrabold text-[#0f172a] hover:bg-[#00bda1]"
              >
                Mudar de plano
              </Button>
            )}

            <Button
              asChild
              variant="outline"
              className="h-10 rounded-[8px] border-[#D0D5DD] font-bold text-[#667085] hover:text-red-700 hover:border-red-200"
            >
              <Link to="/billing/cancelar">
                Solicitar cancelamento da assinatura
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
