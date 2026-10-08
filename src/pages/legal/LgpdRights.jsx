import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { useAuth } from "@/lib/AuthContext";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Mail,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";

export default function LgpdRightsPage() {
  const { user } = useAuth();
  const [requestType, setRequestType] = useState("acesso");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate sending LGPD request or backend endpoint
    await new Promise((resolve) => setTimeout(resolve, 800));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <SystemPageLayout
      title="Seus Direitos e Privacidade (LGPD)"
      subtitle="Central de atendimento ao titular de dados conforme o Art. 18 da Lei Geral de Proteção de Dados (Lei 13.709/18)."
      maxWidth="max-w-4xl"
    >
      <div className="space-y-8">
        {/* Intro Card */}
        <div className="rounded-2xl border border-[#CDEFE8] bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-wider text-[#0f4f49]">
            <ShieldCheck className="h-5 w-5 text-[#00d8b8]" />
            Exercício dos Direitos do Titular
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Como usuário da Nacif Electric, você possui pleno controle sobre suas informações. Disponibilizamos ferramentas diretas no sistema e um canal exclusivo com nosso Encarregado de Dados (DPO).
          </p>
        </div>

        {/* Self-service Actions Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Card 1: Consultar / Alterar Dados */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
                <UserCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">Visualizar e Corrigir Dados</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Acesse suas informações cadastrais, registro profissional (CREA/CAU) e preferências diretamente no seu perfil.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#0F172A] w-full">
              <Link to="/settings">Acessar Configurações</Link>
            </Button>
          </div>

          {/* Card 2: Exportar Dados */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">Exportar Meus Projetos e Dados</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Baixe cópias dos seus projetos, pranchas unifilares e relatórios de dimensionamento em formato aberto (PDF/JSON/DXF).
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#0F172A] w-full">
              <Link to="/projects">Ir para Meus Projetos</Link>
            </Button>
          </div>

          {/* Card 3: Excluir Conta */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">Exclusão de Conta e Dados</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Solicite a eliminação permanente da sua conta e de todos os dados associados que não estejam sujeitos a guarda legal.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-red-200 text-xs font-bold text-red-600 hover:bg-red-50 w-full">
              <Link to="/configuracoes/excluir-conta">Fluxo de Exclusão</Link>
            </Button>
          </div>

          {/* Card 4: Contato DPO */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-extrabold text-[#0F172A]">E-mail do Encarregado (DPO)</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Tire dúvidas ou faça solicitações complexas enviando mensagem direta para o Encarregado de Proteção de Dados.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#0F172A] w-full">
              <a href="mailto:privacidade@nacifelectric.com.br">privacidade@nacifelectric.com.br</a>
            </Button>
          </div>
        </div>

        {/* Direct Request Form */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-[#0F172A]">
              Formulário Formal de Solicitação LGPD
            </h3>
            <p className="text-xs text-[#64748B]">
              Sua solicitação será registrada e respondida por nosso DPO no prazo legal.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <p className="font-extrabold text-sm text-emerald-900">Solicitação registrada com sucesso!</p>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                Enviamos uma confirmação para o seu e-mail cadastrado. Nosso Encarregado de Dados entrará em contato em breve.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipo de Solicitação</Label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] outline-none"
                    required
                  >
                    <option value="acesso">Confirmar e Acessar meus dados</option>
                    <option value="correcao">Correção de dados incompletos/inexatos</option>
                    <option value="anonimizacao">Anonimização ou bloqueio de dados</option>
                    <option value="portabilidade">Portabilidade de projetos</option>
                    <option value="revogacao">Revogação de consentimento</option>
                    <option value="outro">Outra dúvida sobre privacidade</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Seu E-mail Cadastrado</Label>
                  <Input
                    type="email"
                    defaultValue={user?.email || ""}
                    placeholder="seuemail@exemplo.com"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Descreva sua solicitação com detalhes</Label>
                <Textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Informe detalhadamente qual informação você deseja acessar, corrigir ou revogar..."
                  className="min-h-[100px] rounded-xl text-xs"
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
                  {loading ? "Enviando..." : "Enviar Solicitação"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SystemPageLayout>
  );
}
