import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCheckoutSession, BILLING_TYPE_LABELS } from "@/lib/billingApi";
import { formatPlanPrice } from "@/lib/subscriptionPlans";
import { cleanDigits, maskCep, maskCpfCnpj, maskPhone } from "@/lib/brFormatters";
import { fetchAddressByCep } from "@/lib/cepService";

export default function BillingCheckoutModal({ isOpen, onClose, targetPlan, cycle, user }) {
  const [billingType, setBillingType] = useState("CREDIT_CARD");
  const [details, setDetails] = useState({ cpfCnpj: "", postalCode: "", address: "", addressNumber: "", province: "", phone: maskPhone(user?.phone || "") });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cepStatus, setCepStatus] = useState({ loading: false, message: "", error: false });
  const addressEdits = useRef({ address: 0, province: 0 });
  const cepDigits = cleanDigits(details.postalCode);

  useEffect(() => {
    if (!isOpen || cepDigits.length !== 8) {
      setCepStatus({ loading: false, message: "", error: false });
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    const editsAtStart = { ...addressEdits.current };
    setCepStatus({ loading: true, message: "Buscando endereço pelo CEP...", error: false });
    const timer = setTimeout(async () => {
      try {
        const result = await fetchAddressByCep(cepDigits, { signal: controller.signal });
        if (cancelled || controller.signal.aborted) return;
        if (!result.success) {
          setCepStatus({ loading: false, message: result.error || "Não foi possível consultar o CEP. Preencha o endereço manualmente.", error: true });
          return;
        }
        setDetails(current => {
          if (cleanDigits(current.postalCode) !== cepDigits) return current;
          return {
            ...current,
            address: addressEdits.current.address === editsAtStart.address ? result.data.address || current.address : current.address,
            province: addressEdits.current.province === editsAtStart.province ? result.data.neighborhood || current.province : current.province,
          };
        });
        const complete = result.data.address && result.data.neighborhood;
        setCepStatus({ loading: false, message: complete ? "Endereço preenchido. Informe o número e confira os dados." : "CEP encontrado. Complete o endereço e o bairro se necessário.", error: false });
      } catch {
        if (!cancelled && !controller.signal.aborted)
          setCepStatus({ loading: false, message: "Não foi possível consultar o CEP. Preencha o endereço manualmente.", error: true });
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [isOpen, cepDigits]);

  const handleDetailsChange = (key, value) => {
    if (key === "address" || key === "province") addressEdits.current[key] += 1;
    const format = { cpfCnpj: maskCpfCnpj, postalCode: maskCep, phone: maskPhone }[key];
    setDetails(current => ({ ...current, [key]: format ? format(value) : value }));
  };

  if (!targetPlan) return null;
  const effectiveCycle = targetPlan.hasAnnualOption ? cycle : "monthly";
  const fields = [
    ["cpfCnpj", "CPF ou CNPJ", "numeric", "off"], ["phone", "Telefone com DDD", "tel", "tel-national"],
    ["postalCode", "CEP", "numeric", "postal-code"], ["address", "Endereço", "text", "street-address"],
    ["addressNumber", "Número", "text", "off"], ["province", "Bairro", "text", "off"],
  ];
  const submit = async event => {
    event.preventDefault();
    if (loading || cepStatus.loading) return;
    setLoading(true); setError("");
    try {
      const result = await createCheckoutSession({ planCode: targetPlan.code, cycle: effectiveCycle, billingType, billingDetails: { ...details, cpfCnpj: cleanDigits(details.cpfCnpj), postalCode: cleanDigits(details.postalCode), phone: cleanDigits(details.phone) } });
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
            <Input required disabled={loading} inputMode={inputMode} autoComplete={autoComplete}
              maxLength={({ cpfCnpj: 18, postalCode: 9, phone: 15, address: 255, province: 100, addressNumber: 20 })[key]}
              placeholder={({ cpfCnpj: "000.000.000-00", postalCode: "00000-000", phone: "(00) 00000-0000" })[key]}
              aria-describedby={key === "postalCode" && cepStatus.message ? "billing-cep-status" : undefined}
              value={details[key]} onChange={e => handleDetailsChange(key, e.target.value)} />
            {key === "postalCode" && cepStatus.message && <span id="billing-cep-status" role="status" aria-live="polite" className={`mt-1 block text-xs font-normal ${cepStatus.error ? "text-amber-700" : "text-slate-600"}`}>{cepStatus.message}</span>}
          </label>)}
        </div>
        <p className="text-xs text-slate-500">Os dados de cobrança serão enviados ao Asaas para emitir a assinatura. Não armazenamos dados do cartão.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <Button type="button" variant="outline" disabled={loading} onClick={onClose}>Voltar</Button>
          <Button type="submit" disabled={loading || cepStatus.loading} className="flex-1 bg-[#00d8b8] text-slate-900 hover:bg-[#00bda1]">{loading ? "Preparando cobrança..." : "Continuar para o Asaas"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
