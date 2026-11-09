import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCheckoutSession, BILLING_TYPE_LABELS } from "@/lib/billingApi";
import { formatPlanPrice } from "@/lib/subscriptionPlans";

export default function BillingCheckoutModal({ isOpen, onClose, targetPlan, cycle, user }) {
  const [billingType, setBillingType] = useState("CREDIT_CARD");
  const [details, setDetails] = useState({ cpfCnpj: "", postalCode: "", address: "", addressNumber: "", province: "", phone: user?.phone || "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!targetPlan) return null;
  const effectiveCycle = targetPlan.hasAnnualOption ? cycle : "monthly";
  const fields = [
    ["cpfCnpj", "CPF ou CNPJ", "numeric", "off"], ["phone", "Telefone com DDD", "tel", "tel-national"],
    ["postalCode", "CEP", "numeric", "postal-code"], ["address", "Endereço", "text", "street-address"],
    ["addressNumber", "Número", "text", "off"], ["province", "Bairro", "text", "off"],
  ];
  const submit = async event => {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError("");
    try {
      const result = await createCheckoutSession({ planCode: targetPlan.code, cycle: effectiveCycle, billingType, billingDetails: details });
      if (!result.url) throw new Error("Cobrança ainda indisponível. Consulte Gerenciar assinatura.");
      window.location.assign(result.url);
    } catch (err) { setError(err.message || "Não foi possível iniciar o pagamento."); }
    finally { setLoading(false); }
  };
  return <Dialog open={isOpen} onOpenChange={open => { if (!open && !loading) onClose(); }}>
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Contratar {targetPlan.name}</DialogTitle>
        <DialogDescription>{formatPlanPrice(targetPlan, effectiveCycle)} por {effectiveCycle === "annual" ? "ano" : "mês"}. Pagamento seguro pelo Asaas.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold">Forma de pagamento
          <select value={billingType} onChange={e => setBillingType(e.target.value)} disabled={loading} className="mt-1 h-10 w-full rounded-md border bg-white px-3">
            {Object.entries(BILLING_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="text-sm text-slate-600">{billingType === "CREDIT_CARD" ? "Você informa o cartão somente na página do Asaas. As próximas cobranças serão automáticas após a autorização." : "A cada ciclo será gerada uma cobrança para pagamento manual. O Asaas enviará os avisos para seu e-mail."} O plano é liberado após a confirmação do pagamento. A primeira cobrança vence em três dias.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map(([key,label,inputMode,autoComplete]) => <label key={key} className="text-sm font-semibold">{label}
            <Input required disabled={loading} inputMode={inputMode} autoComplete={autoComplete} maxLength={key === "address" ? 255 : key === "province" ? 100 : 25} value={details[key]} onChange={e => setDetails(current => ({ ...current, [key]: e.target.value }))} />
          </label>)}
        </div>
        <p className="text-xs text-slate-500">Os dados de cobrança serão enviados ao Asaas para emitir a assinatura. Não armazenamos dados do cartão.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="outline" disabled={loading} onClick={onClose}>Voltar</Button>
          <Button type="submit" disabled={loading} className="flex-1 bg-[#00d8b8] text-slate-900 hover:bg-[#00bda1]">{loading ? "Preparando cobrança..." : "Continuar para o Asaas"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
