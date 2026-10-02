import LegalPageLayout from "@/components/system/LegalPageLayout";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, Database, RefreshCw, KeyRound, AlertTriangle } from "lucide-react";

const SECTIONS = [
  { id: "arquitetura-seguranca", title: "1. Arquitetura e Proteção em Camadas" },
  { id: "criptografia", title: "2. Criptografia em Trânsito e Repouso" },
  { id: "autenticacao", title: "3. Autenticação e Controle de Sessão" },
  { id: "isolamento-dados", title: "4. Isolamento e Proteção de Projetos" },
  { id: "backups-resiliencia", title: "5. Backups e Recuperação de Desastres" },
  { id: "vulnerabilidades", title: "6. Divulgação Responsável de Vulnerabilidades" },
  { id: "contato-seguranca", title: "7. Contato com a Equipe de Segurança" },
];

export default function SecurityPolicyPage() {
  return (
    <LegalPageLayout
      title="Segurança & Proteção de Dados"
      subtitle="Práticas de segurança da informação, criptografia e proteção adotadas na plataforma Nacif Electric."
      version="1.0"
      lastUpdated="02 de Outubro de 2026"
      sections={SECTIONS}
    >
      <div className="space-y-10">
        {/* Intro Card */}
        <div className="rounded-xl border border-[#CDEFE8] bg-white p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0f4f49]">
            <ShieldCheck className="h-4 w-4 text-[#00d8b8]" />
            Compromisso com a Segurança da Informação
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed">
            A proteção dos projetos de engenharia elétrica, memoriais descritivos e dados cadastrais dos nossos usuários é tratada como prioridade máxima de arquitetura e engenharia de software.
          </p>
        </div>

        {/* 1. Arquitetura */}
        <section id="arquitetura-seguranca" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            1. Arquitetura e Proteção em Camadas
          </h2>
          <p>
            Nossa infraestrutura opera em ambiente de nuvem de alta confiabilidade com proteção ativa contra ataques distribuídos de negação de serviço (DDoS), Web Application Firewall (WAF) e regras estritas de mitigação de injeção de código e cross-site scripting (XSS).
          </p>
        </section>

        {/* 2. Criptografia */}
        <section id="criptografia" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            2. Criptografia em Trânsito e Repouso
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1.5">
              <div className="flex items-center gap-2 font-extrabold text-[#0F172A]">
                <Lock className="h-4 w-4 text-[#00d8b8]" />
                Em Trânsito:
              </div>
              <p className="text-[#64748B]">Toda a comunicação entre seu navegador e nossos servidores é criptografada utilizando TLS 1.3/HTTPS com certificados digitais de chave pública robusta.</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1.5">
              <div className="flex items-center gap-2 font-extrabold text-[#0F172A]">
                <Database className="h-4 w-4 text-[#00d8b8]" />
                Em Repouso:
              </div>
              <p className="text-[#64748B]">Bancos de dados e volumes de armazenamento de plantas e arquivos anexos são protegidos com criptografia AES-256 no nível de armazenamento físico.</p>
            </div>
          </div>
        </section>

        {/* 3. Autenticação */}
        <section id="autenticacao" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            3. Autenticação e Controle de Sessão
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#475467]">
            <li>Senhas de acesso são armazenadas exclusivamente através de funções hash criptográficas unidirecionais com salt (bcrypt/argon2);</li>
            <li>Sessões de usuário são protegidas com tokens criptográficos assinados e expiração automática;</li>
            <li>Mecanismo de proteção contra tentativas sucessivas de força bruta (rate limiting).</li>
          </ul>
        </section>

        {/* 4. Isolamento */}
        <section id="isolamento-dados" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            4. Isolamento e Proteção de Projetos
          </h2>
          <p>
            Aplicamos regras estritas de isolamento lógico no nível de banco de dados (Row-Level Security e controle de acesso baseado em escopo de usuário). Nenhum usuário tem acesso aos dados, esquemas elétricos ou clientes de outro profissional, a menos que haja compartilhamento explícito.
          </p>
        </section>

        {/* 5. Backups */}
        <section id="backups-resiliencia" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            5. Backups e Recuperação de Desastres
          </h2>
          <p>
            Realizamos rotinas diárias e automáticas de backup de dados estruturados com redundância geográfica, garantindo a integridade dos seus projetos mesmo em cenários de falhas físicas de hardware em data centers.
          </p>
        </section>

        {/* 6. Vulnerabilidades */}
        <section id="vulnerabilidades" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            6. Divulgação Responsável de Vulnerabilidades
          </h2>
          <p>
            Se você for um pesquisador de segurança e identificar uma potencial vulnerabilidade em nossos sistemas, solicitamos que nos informe de maneira privada e responsável para que possamos corrigir prontamente antes de qualquer divulgação pública.
          </p>
        </section>

        {/* 7. Contato */}
        <section id="contato-seguranca" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            7. Contato de Segurança
          </h2>
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-xs space-y-1">
            <p className="font-extrabold text-[#0F172A]">Reporte de Incidentes de Segurança:</p>
            <p className="text-[#64748B]">E-mail direto: <a href="mailto:seguranca@nacifelectric.com.br" className="text-[#00d8b8] font-bold underline">seguranca@nacifelectric.com.br</a></p>
            <p className="text-[#94A3B8] text-[11px]">Tratamos relatórios de segurança com máxima prioridade.</p>
          </div>
        </section>
      </div>
    </LegalPageLayout>
  );
}
