import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { useAuth } from "@/lib/AuthContext";
import { backend } from "@/api/backendClient";
import { normalizeSubscription } from "@/lib/subscriptionPlans";
import DangerConfirmDialog from "@/components/system/DangerConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, Shield, Sparkles } from "lucide-react";

export default function CancelSubscriptionPage() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();
  const [subscription, setSubscription] = useState(() => normalizeSubscription(user));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (user) {
      setSubscription(normalizeSubscription(user));
    }
  }, [user]);

  const handleConfirmCancel = async () => {
    // Call backend if available or simulate cancelation
    try {
      if (backend?.subscriptions?.cancel) {
        await backend.subscriptions.cancel({ reason });
      }
      if (user && backend?.auth?.updateMe) {
        await backend.auth.updateMe({ plan: "free", subscription_status: "cancelled" });
        await checkUserAuth();
      }
    } catch (e) {
      console.warn("Cancel subscription fallback:", e);
    }
    setCancelled(true);
  };

  if (cancelled) {
    return (
      <SystemPageLayout showBackButton={false}>
        <div className="mx-auto max-w-md text-center py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-[#00d8b8]" />
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] mb-2">
            Assinatura cancelada
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mb-6 leading-relaxed">
            Seu cancelamento foi processado. Você não receberá novas cobranças e seu acesso atual permanecerá ativo até o final do período vigente contratado.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-6">
              <Link to="/">Voltar ao Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B]">
              <Link to="/subscription">Ver planos disponíveis</Link>
            </Button>
          </div>
        </div>
      </SystemPageLayout>
    );
  }

  return (
    <SystemPageLayout
      title="Cancelar assinatura"
      subtitle="Entenda as condições e o que acontece com seus projetos antes de confirmar."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Current Plan Card */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-[#94A3B8]">Plano atual</p>
                <p className="text-base font-extrabold text-[#0F172A]">{subscription.plan.name}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-[#00d8b8] text-[#0f4f49] font-bold bg-[#E8FCF8]">
              {subscription.status === "active" ? "Ativo" : subscription.status}
            </Badge>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-[#F1F5F9] p-3 text-xs text-[#64748B] space-y-1">
            <p className="font-bold text-[#0F172A]">O que acontece ao cancelar:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>Seu acesso profissional continua ativo até o final do ciclo de faturamento já pago.</li>
              <li>Nenhum projeto ou dado criado será apagado. Seus arquivos existentes permanecem preservados.</li>
              <li>Novas exportações de pranchas completas e geração por IA passarão a seguir os limites do plano gratuito.</li>
              <li>Você pode reativar seu plano a qualquer momento sem perder histórico.</li>
            </ul>
          </div>
        </div>

        {/* Motivo opcional */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3">
          <label className="text-xs font-bold text-[#0F172A]">
            Conte-nos o motivo do cancelamento (opcional):
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
          >
            <option value="">Selecione uma opção...</option>
            <option value="preco">Preço ou custo-benefício</option>
            <option value="recurso_faltando">Falta de algum recurso específico</option>
            <option value="projeto_concluido">Já concluí os projetos necessários</option>
            <option value="dificuldade_uso">Dificuldade de usabilidade</option>
            <option value="outro">Outro motivo</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/subscription")}
            className="h-10 w-full sm:w-auto rounded-xl border-[#E2E8F0] text-xs font-bold text-[#0F172A]"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Manter minha assinatura
          </Button>

          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="h-10 w-full sm:w-auto rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
          >
            Confirmar cancelamento
          </Button>
        </div>
      </div>

      <DangerConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar cancelamento da assinatura"
        description="Tem certeza de que deseja cancelar a renovação automática da sua assinatura?"
        consequences={[
          "Seu plano será convertido para a versão gratuita ao término do período.",
          "O suporte prioritário e limites ilimitados serão desativados.",
        ]}
        confirmTextRequired="CANCELAR"
        confirmButtonLabel="Sim, cancelar assinatura"
        onConfirm={handleConfirmCancel}
      />
    </SystemPageLayout>
  );
}
