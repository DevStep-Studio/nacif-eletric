import { Link } from "react-router-dom";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Compass,
  Cpu,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export default function AboutPage() {
  return (
    <SystemPageLayout
      title="Sobre a Nacif Electric"
      subtitle="Engenharia elétrica computacional e inteligência para projetos em conformidade com as normas ABNT."
      maxWidth="max-w-4xl"
    >
      <div className="space-y-10">
        {/* Hero Card */}
        <div className="rounded-2xl border border-[#CDEFE8] bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8FCF8] text-[#00d8b8]">
            <Zap className="h-6 w-6 fill-current" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
            Nossa Missão: Revolucionar o Projeto Elétrico no Brasil
          </h2>
          <p className="text-xs sm:text-sm text-[#475467] leading-relaxed">
            A Nacif Electric nasceu para transformar a forma como engenheiros, técnicos, projetistas e integradores solares desenvolvem instalações elétricas em baixa tensão. Automatizamos tarefas repetitivas de cálculo, traçado de eletrodutos, balanceamento de quadros e geração de memoriais descritivos, garantindo 100% de aderência às normas técnicas vigentes.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#94A3B8]">
            Pilares da Plataforma
          </h3>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
                <FileCheck className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-extrabold text-[#0F172A]">Rigor Normativo</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Algoritmos fiéis às tabelas e métodos de instalação da NBR 5410, NBR 5444 e NBR 16690.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
                <Compass className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-extrabold text-[#0F172A]">Velocidade & CAD</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Editor de planta interativo em tempo real com exportação direta para pranchas ABNT (A0 a A4).
              </p>
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-extrabold text-[#0F172A]">Segurança & Nuvem</h4>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Armazenamento protegido com criptografia e isolamento total entre contas profissionais.
              </p>
            </div>
          </div>
        </div>

        {/* Commitment to Quality */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-[#0F172A]">
            Compromisso com o Profissional da Engenharia
          </h3>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Não acreditamos em soluções que substituam o julgamento crítico do engenheiro. Desenvolvemos ferramentas para empoderar o projetista, eliminando erros manuais de planilha e reduzindo o tempo de projeto de dias para poucas horas.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button asChild className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-6 shadow-sm">
              <Link to="/projects/new">Começar um Novo Projeto</Link>
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B]">
              <Link to="/contato">Falar com Nossa Equipe</Link>
            </Button>
          </div>
        </div>
      </div>
    </SystemPageLayout>
  );
}
