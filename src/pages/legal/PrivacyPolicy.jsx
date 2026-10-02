import LegalPageLayout from "@/components/system/LegalPageLayout";
import { Link } from "react-router-dom";
import { openCookiePreferences } from "@/components/system/CookieConsentBanner";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Cookie } from "lucide-react";

const SECTIONS = [
  { id: "visao-geral", title: "1. Visão Geral e Compromisso" },
  { id: "dados-coletados", title: "2. Dados Pessoais Coletados" },
  { id: "finalidade", title: "3. Finalidade do Tratamento" },
  { id: "bases-legais", title: "4. Bases Legais (LGPD)" },
  { id: "compartilhamento", title: "5. Compartilhamento de Dados" },
  { id: "armazenamento", title: "6. Armazenamento e Retenção" },
  { id: "seguranca", title: "7. Medidas de Segurança" },
  { id: "cookies-rastreamento", title: "8. Cookies e Tecnologias Semelhantes" },
  { id: "direitos-titular", title: "9. Seus Direitos como Titular" },
  { id: "dpo", title: "10. Encarregado de Dados (DPO) e Contato" },
  { id: "alteracoes", title: "11. Atualizações desta Política" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Política de Privacidade"
      subtitle="Transparência sobre como tratamos seus dados pessoais em total conformidade com a LGPD (Lei nº 13.709/2018)."
      version="1.1"
      lastUpdated="02 de Outubro de 2026"
      sections={SECTIONS}
    >
      <div className="space-y-10">
        {/* Intro */}
        <div className="rounded-xl border border-[#CDEFE8] bg-[#F8FBFD] p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0f4f49]">
            <ShieldCheck className="h-4 w-4 text-[#00d8b8]" />
            Conformidade com a LGPD (Lei 13.709/18)
          </div>
          <p className="text-xs text-[#475467] leading-relaxed">
            A <strong>Nacif Electric</strong> valoriza a sua privacidade e a confidencialidade dos seus dados e projetos de engenharia. Esta Política explica detalhadamente quais informações coletamos, como as utilizamos, onde são armazenadas e como você pode exercer todos os seus direitos garantidos pela legislação brasileira de proteção de dados.
          </p>
        </div>

        {/* 1. Visão Geral */}
        <section id="visao-geral" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            1. Visão Geral e Compromisso
          </h2>
          <p>
            Tratamos apenas os dados estritamente necessários para permitir a autenticação segura, a execução dos cálculos elétricos, o gerenciamento de assinaturas e a emissão de relatórios e memoriais descritivos solicitados pelo próprio usuário.
          </p>
        </section>

        {/* 2. Dados Coletados */}
        <section id="dados-coletados" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            2. Dados Pessoais Coletados
          </h2>
          <p>Coletamos os seguintes tipos de informações:</p>
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1.5">
              <p className="font-extrabold text-[#0F172A]">Dados Cadastrais:</p>
              <p className="text-[#64748B]">Nome completo, e-mail de login, telefone de contato, empresa, registro profissional (CREA/CAU/CFT) e foto de perfil opcional.</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1.5">
              <p className="font-extrabold text-[#0F172A]">Dados de Projetos:</p>
              <p className="text-[#64748B]">Nomes de clientes dos projetos, plantas elétricas, circuitos, diagramas unifilares e memoriais técnicos inseridos pelo usuário.</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1.5">
              <p className="font-extrabold text-[#0F172A]">Dados Financeiros & Faturamento:</p>
              <p className="text-[#64748B]">Histórico de transações e status do plano. Não armazenamos números completos de cartões de crédito em nossos servidores (processados por gateways certificados PCI-DSS).</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1.5">
              <p className="font-extrabold text-[#0F172A]">Dados Técnicos de Navegação:</p>
              <p className="text-[#64748B]">Endereço IP, tipo de navegador, sistema operacional e logs de erros de cálculo para aprimoramento da estabilidade.</p>
            </div>
          </div>
        </section>

        {/* 3. Finalidade */}
        <section id="finalidade" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            3. Finalidade do Tratamento
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[#475467]">
            <li>Autenticar o usuário e proteger a segurança da sua conta;</li>
            <li>Processar e salvar projetos de plantas elétricas, diagramas e dimensionamentos;</li>
            <li>Gerar relatórios técnicos, orçamentos e memoriais descritivos personalizados;</li>
            <li>Faturar planos de assinatura e fornecer suporte técnico especializado;</li>
            <li>Cumprir obrigações legais, regulatórias e fiscais brasileiras.</li>
          </ul>
        </section>

        {/* 4. Bases Legais */}
        <section id="bases-legais" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            4. Bases Legais (Art. 7º da LGPD)
          </h2>
          <p>
            O tratamento de dados fundamenta-se nas seguintes hipóteses legais:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[#475467]">
            <li><strong>Execução de Contrato:</strong> para fornecer as funcionalidades contratadas no plano de uso;</li>
            <li><strong>Cumprimento de Obrigação Legal ou Regulatória:</strong> manutenção de registros de acesso conforme o Marco Civil da Internet (Lei 12.965/14) e emissão fiscal;</li>
            <li><strong>Legítimo Interesse:</strong> para proteção contra fraudes e segurança da plataforma;</li>
            <li><strong>Consentimento:</strong> para comunicações opcionais e cookies analíticos não essenciais.</li>
          </ul>
        </section>

        {/* 5. Compartilhamento */}
        <section id="compartilhamento" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            5. Compartilhamento de Dados com Terceiros
          </h2>
          <p>
            A Nacif Electric <strong>não vende nem comercializa dados de usuários ou projetos</strong>. O compartilhamento ocorre estritamente com provedores de infraestrutura homologados:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[#475467]">
            <li>Provedores de hospedagem em nuvem e banco de dados com criptografia;</li>
            <li>Processadores de pagamento autorizados (gateways PCI-DSS);</li>
            <li>Autoridades públicas judiciais, quando formalmente requisitado por ordem judicial competente.</li>
          </ul>
        </section>

        {/* 6. Armazenamento */}
        <section id="armazenamento" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            6. Armazenamento e Retenção
          </h2>
          <p>
            Seus dados são armazenados em data centers com elevados padrões de segurança física e digital. Mantemos suas informações enquanto sua conta estiver ativa ou pelo período necessário para cumprimento de obrigações legais (como prazos fiscais e de registro de logs do Marco Civil).
          </p>
        </section>

        {/* 7. Segurança */}
        <section id="seguranca" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            7. Medidas de Segurança
          </h2>
          <p>
            Adotamos medidas técnicas e administrativas aptas a proteger seus dados contra acessos não autorizados e situações acidentais de destruição ou perda, incluindo:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[#475467]">
            <li>Criptografia em trânsito com protocolo TLS/HTTPS de 256 bits;</li>
            <li>Armazenamento seguro de senhas com algoritmo de hash criptográfico;</li>
            <li>Backups periódicos e isolamento de sessões de usuário.</li>
          </ul>
        </section>

        {/* 8. Cookies */}
        <section id="cookies-rastreamento" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            8. Cookies e Tecnologias Semelhantes
          </h2>
          <p>
            Utilizamos cookies estritamente necessários para permitir sua sessão e cookies analíticos para melhorar a plataforma. Você pode conferir detalhes na nossa <Link to="/cookies" className="text-[#00d8b8] font-bold underline">Política de Cookies</Link> ou gerenciar suas preferências diretamente:
          </p>
          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCookiePreferences}
              className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#0F172A]"
            >
              <Cookie className="h-3.5 w-3.5 mr-1.5 text-[#00d8b8]" />
              Gerenciar Preferências de Cookies
            </Button>
          </div>
        </section>

        {/* 9. Direitos do Titular */}
        <section id="direitos-titular" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            9. Seus Direitos como Titular (Art. 18 da LGPD)
          </h2>
          <p>
            Você tem o direito de solicitar a qualquer momento:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-[#475467]">
            <li>Confirmação da existência de tratamento e acesso aos dados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>Portabilidade e exportação dos seus projetos e dados cadastrais;</li>
            <li>Eliminação dos dados pessoais tratados com consentimento;</li>
            <li>Revogação do consentimento concedido.</li>
          </ul>
          <p className="text-xs text-[#64748B] pt-1">
            Para exercer seus direitos de titular, acesse nosso portal de <Link to="/privacidade/direitos" className="text-[#00d8b8] font-bold underline">Direitos do Titular</Link> ou envie uma mensagem ao nosso Encarregado de Dados.
          </p>
        </section>

        {/* 10. DPO */}
        <section id="dpo" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            10. Encarregado de Proteção de Dados (DPO)
          </h2>
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-xs space-y-1.5">
            <p className="font-extrabold text-[#0F172A]">Canal Oficial do Encarregado (DPO):</p>
            <p className="text-[#64748B]">Encarregado de Proteção de Dados da Nacif Electric</p>
            <p className="text-[#64748B]">E-mail direto: <a href="mailto:privacidade@nacifelectric.com.br" className="text-[#00d8b8] font-bold underline">privacidade@nacifelectric.com.br</a></p>
            <p className="text-[#94A3B8] text-[11px]">Prazo de resposta conforme diretrizes da Autoridade Nacional de Proteção de Dados (ANPD).</p>
          </div>
        </section>

        {/* 11. Alterações */}
        <section id="alteracoes" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            11. Atualizações desta Política
          </h2>
          <p>
            Esta política poderá ser atualizada periodicamente para refletir melhorias no sistema ou alterações na legislação. Recomendamos a consulta regular desta página.
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
