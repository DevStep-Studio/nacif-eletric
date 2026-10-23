import { useState } from "react";
import { CheckCircle2, ShieldCheck, ArrowRight, AlertTriangle, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { backend } from "@/api/backendClient";
import { calculateAnnualSavings, formatPlanPrice } from "@/lib/subscriptionPlans";

export default function PlanChangeModal({
  isOpen,
  onClose,
  targetPlan,
  currentPlan,
  cycle = "monthly",
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!targetPlan) return null;

  const isUpgrade = targetPlan.monthlyPrice > (currentPlan?.monthlyPrice || 0);
  const isDowngrade = targetPlan.monthlyPrice < (currentPlan?.monthlyPrice || 0);
  const annualSavings = calculateAnnualSavings(targetPlan);

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      if (backend?.subscriptions?.changePlan) {
        await backend.subscriptions.changePlan({
          planCode: targetPlan.code,
          cycle: targetPlan.hasAnnualOption ? cycle : "monthly",
        });
      } else {
        await backend.auth.updateMe({
          plan: targetPlan.code,
          subscription_cycle: targetPlan.hasAnnualOption ? cycle : "monthly",
          subscription_price: cycle === "annual" && targetPlan.annualPrice ? targetPlan.annualPrice : targetPlan.monthlyPrice,
          subscription_status: "active",
        });
      }

      if (onSuccess) onSuccess(targetPlan);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "Não foi possível atualizar o plano. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-[16px] border border-[#E4E7EC] bg-white p-6 sm:p-7">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-extrabold text-[#101828]">
                {isUpgrade ? "Confirmar Upgrade de Plano" : isDowngrade ? "Confirmar Alteração de Plano" : "Confirmar Assinatura"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs font-medium text-[#667085]">
                {targetPlan.commercialTagline}
              </DialogDescription>
            </div>
            {targetPlan.highlightBadge && (
              <Badge className="bg-[#E8FCF8] text-[#0f4f49] hover:bg-[#E8FCF8] border border-[#BCEEE5]">
                {targetPlan.highlightBadge}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-[8px] border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-4 rounded-[12px] border border-[#BCEEE5] bg-[#F7FBFE] p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#667085]">Plano Selecionado</p>
              <h3 className="mt-1 text-2xl font-extrabold text-[#101828]">{targetPlan.name}</h3>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-[#101828]">
                {formatPlanPrice(targetPlan, cycle)}
              </p>
              <p className="text-xs font-semibold text-[#667085]">
                {cycle === "annual" && targetPlan.hasAnnualOption ? "/ano (cobrado anualmente)" : "/mês"}
              </p>
            </div>
          </div>

          {cycle === "annual" && targetPlan.hasAnnualOption && (
            <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-white p-2.5 text-xs font-bold text-[#0f4f49] border border-[#BCEEE5]">
              <Sparkles className="h-4 w-4 text-[#00d8b8]" />
              <span>
                Economia anual de 30% aplicada (Equivalente a R$ {annualSavings.monthlyEquiv.toLocaleString("pt-BR")}/mês)
              </span>
            </div>
          )}

          {targetPlan.isAcademic && (
            <p className="mt-3 text-xs font-semibold text-blue-700">
              * Válido mediante comprovação de matrícula acadêmica para uso educacional.
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">
            O que você terá acesso:
          </p>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {targetPlan.features.slice(0, 5).map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs font-medium text-[#344054]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00d8b8]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Garantia oficial de preservação de projetos */}
        <div className="mt-4 flex items-start gap-3 rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB] p-3 text-xs">
          <ShieldCheck className="h-5 w-5 shrink-0 text-[#00d8b8]" />
          <div>
            <p className="font-extrabold text-[#101828]">Garantia de Preservação de Dados</p>
            <p className="mt-0.5 text-[#667085]">
              Nenhum projeto, planta ou orçamento existente será excluído. Seus dados permanecem seguros e acessíveis para consulta.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 flex-1 rounded-[8px] border-[#D0D5DD] font-bold text-[#344054]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="h-10 flex-1 rounded-[8px] bg-[#00d8b8] font-extrabold text-[#0f172a] hover:bg-[#00bda1]"
          >
            {loading ? "Processando..." : isUpgrade ? "Confirmar Upgrade" : "Confirmar Alteração"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
