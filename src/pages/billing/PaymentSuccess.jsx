import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusState from "@/components/system/StatusState";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import { syncSubscription } from "@/lib/billingApi";
import { normalizeSubscription, resolveEffectiveSubscription } from "@/lib/subscriptionPlans";

export default function PaymentSuccessPage() {
  const [state, setState] = useState({ paid: false, message: "Consultando confirmação do Asaas..." });
  useEffect(() => {
    let stopped = false;
    syncSubscription().then(({ user }) => {
      if (stopped) return;
      const subscription = normalizeSubscription(user);
      const effective = resolveEffectiveSubscription(user);
      const paid = subscription.provider === "asaas" && !effective.isInactive;
      setState({ paid, message: paid ? `Seu plano ${subscription.plan.name} está ativo.` : "O pagamento ainda não foi confirmado. Seu plano será liberado após a confirmação do Asaas." });
    }).catch(error => { if (!stopped) setState({ paid: false, message: error.message }); });
    return () => { stopped = true; };
  }, []);
  return <SystemPageLayout showBackButton={false} showHeader showFooter>
    <div className="flex min-h-[60vh] items-center justify-center">
      <StatusState status={state.paid ? "payment-success" : "payment-pending"} code={state.paid ? "PAGAMENTO CONFIRMADO" : "VERIFICAÇÃO DE PAGAMENTO"}
        title={state.paid ? "Assinatura ativada com sucesso!" : "Aguardando confirmação do pagamento"} description={state.message}
        primaryAction={<Button asChild><Link to="/subscription">Ver assinatura e pagamentos</Link></Button>} />
    </div>
  </SystemPageLayout>;
}
