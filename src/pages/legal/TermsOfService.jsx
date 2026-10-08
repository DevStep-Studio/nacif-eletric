import LegalPageLayout from "@/components/system/LegalPageLayout";
import { Link } from "react-router-dom";

const SECTIONS = [
  { id: "aceitacao", title: "1. Aceitação dos Termos" },
  { id: "conta", title: "2. Cadastro e Segurança da Conta" },
  { id: "uso-permitido", title: "3. Uso Permitido e Restrições" },
  { id: "responsabilidades", title: "4. Responsabilidade Técnica e Normas" },
  { id: "propriedade-intelectual", title: "5. Propriedade Intelectual" },
  { id: "pagamentos", title: "6. Pagamentos e Faturamento" },
  { id: "assinaturas", title: "7. Assinaturas e Renovação" },
  { id: "cancelamento", title: "8. Cancelamento e Reembolso" },
  { id: "limitacoes", title: "9. Limitação de Responsabilidade" },
  { id: "disponibilidade", title: "10. Níveis de Serviço e Disponibilidade" },
  { id: "encerramento", title: "11. Suspensão e Encerramento" },
  { id: "alteracoes", title: "12. Alterações destes Termos" },
  { id: "contato", title: "13. Foro e Contato Jurídico" },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      title="Termos de Uso"
      subtitle="Condições gerais para utilização da plataforma de cálculo elétrico e engenharia Nacif Electric."
      version="1.2"
      lastUpdated="02 de Outubro de 2026"
      sections={SECTIONS}
    >
      <div className="space-y-10">
        {/* Intro */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
          <p className="text-xs font-bold text-[#0F172A]">
            Bem-vindo à plataforma <strong className="text-[#00d8b8]">Nacif Electric</strong>.
          </p>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Ao acessar, cadastrar-se ou utilizar qualquer funcionalidade do nosso software como serviço (SaaS), você declara ter lido, compreendido e aceito integralmente as presentes condições de uso. Caso não concorde com qualquer disposição aqui estabelecida, solicitamos que não utilize nossos serviços.
          </p>
        </div>

        {/* 1. Aceitação */}
        <section id="aceitacao" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            1. Aceitação dos Termos
          </h2>
          <p>
            Estes Termos de Uso constituem um acordo vinculante entre você (usuário individual ou pessoa jurídica representada) e a <strong>Nacif Electric Soluções Tecnológicas</strong>. O uso continuado da plataforma após quaisquer atualizações implica em consentimento tácito com os termos revisados.
          </p>
          <div className="text-xs text-[#64748B] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
            <strong>Nota de escopo:</strong> A plataforma destina-se a engenheiros eletricistas, técnicos em eletrotécnica, projetistas solares, instaladores e estudantes habilitados que necessitam de auxílio computacional em cálculos baseados em normas técnicas.
          </div>
        </section>

        {/* 2. Conta */}
        <section id="conta" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            2. Cadastro e Segurança da Conta
          </h2>
          <p>
            Para acessar determinados módulos da plataforma, é obrigatório criar uma conta fornecendo dados verdadeiros, completos e atualizados. Você é o único responsável pela guarda e confidencialidade de suas credenciais de acesso (e-mail e senha).
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#475467]">
            <li>Não compartilhe suas credenciais com terceiros;</li>
            <li>Notifique imediatamente nossa equipe em caso de suspeita de invasão ou uso não autorizado de sua conta;</li>
            <li>A Nacif Electric não se responsabiliza por perdas decorrentes do uso indevido de senhas por negligência do próprio usuário.</li>
          </ul>
        </section>

        {/* 3. Uso Permitido */}
        <section id="uso-permitido" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            3. Uso Permitido e Restrições
          </h2>
          <p>
            Você concorda em utilizar o sistema exclusivamente para fins lícitos e profissionais. É terminantemente proibido:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#475467]">
            <li>Realizar engenharia reversa, descompilação ou cópia do código-fonte dos motores de cálculo;</li>
            <li>Utilizar scrapers, bots ou mecanismos automatizados para extrair dados sem autorização expressa por escrito;</li>
            <li>Tentar violar firewalls, sistemas de autenticação ou limites de cotas do seu plano contratado;</li>
            <li>Utilizar a plataforma para hospedar ou transmitir arquivos maliciosos, códigos destrutivos ou conteúdo ilícito.</li>
          </ul>
        </section>

        {/* 4. Responsabilidades */}
        <section id="responsabilidades" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            4. Responsabilidade Técnica e Normas
          </h2>
          <p>
            Os módulos de cálculo elétrico foram desenvolvidos com rigor técnico com base na norma brasileira <strong>NBR 5410</strong> (Instalações Elétricas em Baixa Tensão) e normas correlatas (como NBR 5444 e NBR 16690 para sistemas fotovoltaicos).
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 space-y-1.5">
            <p className="font-extrabold text-amber-800 uppercase tracking-wider">
              Importante — Responsabilidade do Responsável Técnico (ART/RRT):
            </p>
            <p>
              A Nacif Electric é uma ferramenta de produtividade e cálculo assistido. O dimensionamento final, a emissão de Anotação de Responsabilidade Técnica (ART/TRT/RRT) e a validação em campo são de responsabilidade exclusiva do profissional habilitado responsável pelo projeto ou execução da obra.
            </p>
          </div>
        </section>

        {/* 5. Propriedade Intelectual */}
        <section id="propriedade-intelectual" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            5. Propriedade Intelectual
          </h2>
          <p>
            Todos os direitos autorais, marcas, algoritmos, interfaces gráficas, símbolos esquemáticos e arquitetura de software pertencem exclusivamente à Nacif Electric.
          </p>
          <p className="text-xs text-[#475467]">
            <strong>Seus Projetos:</strong> Você mantém a propriedade integral sobre os dados, plantas arquitetônicas, esquemas elétricos e memoriais descritivos gerados ou importados por você no sistema.
          </p>
        </section>

        {/* 6. Pagamentos */}
        <section id="pagamentos" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            6. Pagamentos e Faturamento
          </h2>
          <p>
            O acesso a determinados recursos profissionais exige contratação de plano de assinatura. Os preços, ciclos de faturamento e formas aceitas (Cartão de Crédito, PIX, Boleto) são informados de forma transparente na página de <Link to="/subscription" className="text-[#00d8b8] underline font-bold">Assinaturas</Link>.
          </p>
          <p className="text-xs text-[#64748B]">
            [REVISAR COM JURÍDICO — POLÍTICA DE EMISSÃO DE NOTAS FISCAIS E IMPOSTOS APLICÁVEIS].
          </p>
        </section>

        {/* 7. Assinaturas */}
        <section id="assinaturas" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            7. Assinaturas e Renovação Automática
          </h2>
          <p>
            Salvo disposição em contrário no momento da contratação, as assinaturas possuem renovação automática ao final de cada período (mensal ou anual), visando garantir a continuidade do acesso aos seus projetos em andamento.
          </p>
        </section>

        {/* 8. Cancelamento */}
        <section id="cancelamento" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            8. Cancelamento e Reembolso
          </h2>
          <p>
            Você pode cancelar a renovação da sua assinatura a qualquer momento através do painel de controle ou na página de <Link to="/billing/cancelar" className="text-[#00d8b8] underline font-bold">Cancelamento</Link>. Conforme o Código de Defesa do Consumidor (Art. 49), para novas assinaturas contratadas online, é garantido o direito de arrependimento no prazo de 7 (sete) dias corridos a partir da contratação inicial.
          </p>
        </section>

        {/* 9. Limitações */}
        <section id="limitacoes" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            9. Limitação de Responsabilidade
          </h2>
          <p>
            Em nenhuma hipótese a Nacif Electric será responsável por lucros cessantes, perdas indiretas, danos decorrentes de erros de execução física na obra por profissionais terceiros ou por falhas oriundas de dados incorretos inseridos pelo usuário.
          </p>
        </section>

        {/* 10. Disponibilidade */}
        <section id="disponibilidade" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            10. Níveis de Serviço e Disponibilidade
          </h2>
          <p>
            Empregamos infraestrutura em nuvem de alta disponibilidade. Eventuais manutenções programadas para melhorias e correções serão comunicadas previamente em nossa página de <Link to="/status" className="text-[#00d8b8] underline font-bold">Status do Sistema</Link>.
          </p>
        </section>

        {/* 11. Encerramento */}
        <section id="encerramento" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            11. Suspensão e Encerramento
          </h2>
          <p>
            Podemos suspender ou encerrar contas que violem reiteradamente estes Termos de Uso, tentem fraudar pagamentos ou realizem atividades ilegais. Você também pode solicitar a exclusão de sua conta a qualquer momento na seção de privacidade.
          </p>
        </section>

        {/* 12. Alterações */}
        <section id="alteracoes" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            12. Alterações destes Termos
          </h2>
          <p>
            Reservamo-nos o direito de modificar estes Termos periodicamente. Modificações substanciais serão notificadas por e-mail ou aviso no painel com antecedência razoável.
          </p>
        </section>

        {/* 13. Contato */}
        <section id="contato" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            13. Foro e Contato Jurídico
          </h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil. Para dirimir quaisquer controvérsias decorrentes deste contrato, elege-se o foro da comarca da sede da empresa, com renúncia expressa a qualquer outro.
          </p>
          <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-4 text-xs space-y-1">
            <p className="font-bold text-[#0F172A]">Dúvidas sobre estes termos?</p>
            <p className="text-[#64748B]">E-mail de contato jurídico: <a href="mailto:juridico@nacifelectric.com.br" className="text-[#00d8b8] font-bold underline">juridico@nacifelectric.com.br</a></p>
          </div>
        </section>
      </div>
    </LegalPageLayout>
  );
}
