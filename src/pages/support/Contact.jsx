import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";

export default function ContactPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.full_name || "",
    email: user?.email || "",
    subject: "",
    category: "suporte_tecnico",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || user.full_name || "",
        email: prev.email || user.email || "",
      }));
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate sending message or call backend
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoading(false);
    setSent(true);
  };

  return (
    <SystemPageLayout
      title="Fale Conosco"
      subtitle="Dúvidas sobre projetos, suporte técnico ou questões comerciais? Envie sua mensagem."
      maxWidth="max-w-4xl"
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Contact Form */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-6">
          {sent ? (
            <div className="py-12 text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8FCF8] text-[#00d8b8] mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-extrabold text-[#0F172A]">Mensagem enviada com sucesso!</h2>
              <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
                Recebemos seu contato. Um de nossos especialistas em engenharia elétrica responderá para o e-mail <strong className="text-[#0F172A]">{form.email}</strong> em até 1 dia útil.
              </p>
              <div className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSent(false);
                    setForm((prev) => ({ ...prev, subject: "", message: "" }));
                  }}
                  className="h-10 rounded-xl border-[#E2E8F0] text-xs font-bold"
                >
                  Enviar outra mensagem
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Seu Nome Completo</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Eng. João Silva"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail para Resposta</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="joao@engenharia.com"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Ex: Dúvida no cálculo de queda de tensão"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
                  >
                    <option value="suporte_tecnico">Suporte Técnico / Cálculos</option>
                    <option value="duvida_planta">Dúvida no Editor de Planta</option>
                    <option value="comercial_planos">Comercial / Planos e Faturas</option>
                    <option value="sugestao_recurso">Sugestão de Nova Funcionalidade</option>
                    <option value="outro">Outro assunto</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Escreva sua mensagem com detalhes..."
                  className="min-h-[140px] rounded-xl text-xs"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-6 shadow-sm"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {loading ? "Enviando mensagem..." : "Enviar Mensagem"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4 text-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
              Canais Diretos
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8FCF8] text-[#00d8b8]">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-extrabold text-[#0F172A]">Suporte Técnico</p>
                  <a href="mailto:suporte@nacifelectric.com.br" className="text-[#64748B] hover:text-[#00d8b8] transition">
                    suporte@nacifelectric.com.br
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8FCF8] text-[#00d8b8]">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-extrabold text-[#0F172A]">Horário de Atendimento</p>
                  <p className="text-[#64748B]">Segunda a Sexta, 08h às 18h (BRT)</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8FCF8] text-[#00d8b8]">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-extrabold text-[#0F172A]">Respostas Rápidas</p>
                  <Link to="/ajuda" className="text-[#00d8b8] font-bold hover:underline">
                    Ver Central de Ajuda
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SystemPageLayout>
  );
}
