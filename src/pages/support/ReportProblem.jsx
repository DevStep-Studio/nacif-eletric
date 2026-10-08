import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Monitor, Send, ShieldCheck } from "lucide-react";

export default function ReportProblemPage() {
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const fromPage = searchParams.get("from") || window.location.pathname;

  const [form, setForm] = useState({
    type: "erro_calculo",
    description: "",
    steps: "",
    email: user?.email || "",
  });
  const [clientInfo, setClientInfo] = useState({
    page: fromPage,
    screen: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
    browser: typeof navigator !== "undefined" ? navigator.userAgent : "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <SystemPageLayout
      title="Reportar um Problema"
      subtitle="Ajude-nos a manter os motores de cálculo e a interface funcionando com máxima precisão."
      maxWidth="max-w-3xl"
    >
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-6">
        {submitted ? (
          <div className="py-10 text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8FCF8] text-[#00d8b8] mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-extrabold text-[#0F172A]">Relatório recebido com sucesso!</h2>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto">
              Agradecemos seu reporte. Nossa equipe técnica analisará os dados de diagnóstico para aplicar as correções necessárias.
            </p>
            <div className="pt-4">
              <Button asChild className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-6">
                <Link to="/">Voltar ao Dashboard</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tipo de Ocorrência</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
                >
                  <option value="erro_calculo">Inconsistência em Cálculo Elétrico (NBR 5410)</option>
                  <option value="falha_renderizacao">Falha na Planta Elétrica / Canvas</option>
                  <option value="falha_exportacao">Problema na Exportação de PDF / Prancha</option>
                  <option value="lentidao">Lentidão / Travamento na Interface</option>
                  <option value="outro">Outro comportamento inesperado</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Seu E-mail para Retorno</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="seuemail@exemplo.com"
                  className="h-10 rounded-xl text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>O que aconteceu?</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descreva o que ocorreu de forma clara..."
                className="min-h-[100px] rounded-xl text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Passos para reproduzir (opcional)</Label>
              <Textarea
                value={form.steps}
                onChange={(e) => setForm({ ...form, steps: e.target.value })}
                placeholder="Ex: 1. Abri o projeto X -> 2. Inseri tomada 220V -> 3. Cliquei em balancear fases..."
                className="min-h-[70px] rounded-xl text-xs"
              />
            </div>

            {/* Diagnostic Box */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[11px] text-[#64748B] space-y-1">
              <p className="font-bold text-[#0F172A] flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5 text-[#00d8b8]" />
                Contexto técnico não sensível capturado automaticamente:
              </p>
              <div className="font-mono text-[10px] space-y-0.5 text-[#475467]">
                <p>Página de origem: {clientInfo.page}</p>
                <p>Resolução: {clientInfo.screen}</p>
              </div>
              <p className="text-[10px] text-[#94A3B8] pt-1">
                Nenhum dado confidencial, senha ou token é enviado neste relatório.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-6 shadow-sm"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {loading ? "Enviando relatório..." : "Enviar Relatório de Diagnóstico"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </SystemPageLayout>
  );
}
