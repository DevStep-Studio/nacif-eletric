import LegalPageLayout from "@/components/system/LegalPageLayout";
import { openCookiePreferences } from "@/components/system/CookieConsentBanner";
import { Button } from "@/components/ui/button";
import { Cookie, Settings2 } from "lucide-react";

const SECTIONS = [
  { id: "o-que-sao-cookies", title: "1. O que são Cookies" },
  { id: "como-utilizamos", title: "2. Como Utilizamos Cookies" },
  { id: "categorias-cookies", title: "3. Categorias de Cookies Utilizados" },
  { id: "gerenciar-preferencias", title: "4. Como Gerenciar suas Preferências" },
  { id: "cookies-terceiros", title: "5. Cookies de Terceiros" },
  { id: "alteracoes", title: "6. Alterações nesta Política" },
  { id: "contato", title: "7. Contato e Dúvidas" },
];

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout
      title="Política de Cookies"
      subtitle="Entenda como e por que utilizamos cookies e tecnologias de armazenamento local na Nacif Electric."
      version="1.0"
      lastUpdated="02 de Outubro de 2026"
      sections={SECTIONS}
    >
      <div className="space-y-10">
        {/* Intro */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0F172A]">
            <Cookie className="h-4 w-4 text-[#00d8b8]" />
            Transparência e Controle
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Esta política fornece informações claras e detalhadas sobre as tecnologias de armazenamento local e cookies que empregamos em nossa plataforma, permitindo que você controle suas preferências a qualquer momento.
          </p>
        </div>

        {/* 1. O que são */}
        <section id="o-que-sao-cookies" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            1. O que são Cookies?
          </h2>
          <p>
            Cookies são pequenos arquivos de texto armazenados no navegador do seu computador, tablet ou smartphone quando você visita websites e aplicações web. Eles servem para lembrar suas preferências, autenticar sua sessão e garantir o funcionamento correto de editores interativos.
          </p>
        </section>

        {/* 2. Como utilizamos */}
        <section id="como-utilizamos" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            2. Como Utilizamos Cookies na Nacif Electric
          </h2>
          <p>
            Utilizamos cookies e o armazenamento local do navegador (<code>localStorage</code> e <code>sessionStorage</code>) primordialmente para garantir a segurança da autenticação e a velocidade de resposta do editor elétrico (por exemplo, retenção do estado de colapso do menu lateral e zoom da tela).
          </p>
        </section>

        {/* 3. Categorias */}
        <section id="categorias-cookies" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            3. Categorias de Cookies Utilizados
          </h2>

          <div className="space-y-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#0F172A]">1. Cookies Estritamente Necessários (Sempre Ativos)</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-700">Obrigatórios</span>
              </div>
              <p className="text-[#64748B]">
                Indispensáveis para a autenticação, segurança e roteamento da aplicação. Sem eles, o login e a navegação segura não funcionam.
              </p>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#0F172A]">2. Cookies Funcionais e de Preferências</span>
                <span className="rounded bg-[#E8FCF8] px-1.5 py-0.5 text-[9px] font-black text-[#0f4f49]">Configuráveis</span>
              </div>
              <p className="text-[#64748B]">
                Lembram suas configurações no editor elétrico (filtros de materiais, visualização de camadas da planta e zoom preferido).
              </p>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[#0F172A]">3. Cookies Analíticos e de Performance</span>
                <span className="rounded bg-[#E8FCF8] px-1.5 py-0.5 text-[9px] font-black text-[#0f4f49]">Configuráveis</span>
              </div>
              <p className="text-[#64748B]">
                Coletam dados estatísticos agregados e anônimos sobre tempo de carregamento e eventuais falhas nos cálculos elétricos.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Gerenciar */}
        <section id="gerenciar-preferencias" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            4. Como Gerenciar suas Preferências
          </h2>
          <p>
            Você pode alterar suas escolhas de consentimento a qualquer momento com um clique:
          </p>
          <div className="pt-2">
            <Button
              type="button"
              onClick={openCookiePreferences}
              className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-5 shadow-sm"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Abrir Gerenciador de Preferências de Cookies
            </Button>
          </div>
        </section>

        {/* 5. Terceiros */}
        <section id="cookies-terceiros" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            5. Cookies de Terceiros
          </h2>
          <p>
            Não utilizamos redes de publicidade comportamental ou rastreadores de marketing de terceiros que compartilhem seus dados com brokers de dados.
          </p>
        </section>

        {/* 6. Alterações */}
        <section id="alteracoes" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            6. Alterações nesta Política
          </h2>
          <p>
            Quaisquer atualizações sobre o uso de novos recursos que utilizem cookies serão refletidas nesta página.
          </p>
        </section>

        {/* 7. Contato */}
        <section id="contato" className="space-y-3 pt-2">
          <h2 className="text-lg font-extrabold text-[#0F172A] border-b border-[#F1F5F9] pb-2">
            7. Contato e Dúvidas
          </h2>
          <p>
            Dúvidas sobre o tratamento de cookies podem ser encaminhadas para: <a href="mailto:privacidade@nacifelectric.com.br" className="text-[#00d8b8] font-bold underline">privacidade@nacifelectric.com.br</a>.
          </p>
        </section>
      </div>
    </LegalPageLayout>
  );
}
