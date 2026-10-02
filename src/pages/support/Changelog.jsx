import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Wrench, CheckCircle2 } from "lucide-react";

const RELEASES = [
  {
    version: "v2.4.0",
    date: "Outubro de 2026",
    title: "Refatoração de Usabilidade na Planta Elétrica & Central Institucional",
    items: [
      { type: "melhoria", text: "Abertura do modal de configuração de circuito do ponto agora ativada exclusivamente por duplo clique/toque, evitando aberturas acidentais na seleção simples." },
      { type: "novo", text: "Criação da Central de Ajuda, Status do Sistema, Termos de Uso e Política de Privacidade compatível com a LGPD." },
      { type: "melhoria", text: "Gerenciador de consentimento e preferências de cookies com persistência de preferências de navegação." },
      { type: "novo", text: "Portal de Direitos do Titular (LGPD) com formulário direto de requisições ao DPO." },
    ],
  },
  {
    version: "v2.3.0",
    date: "Setembro de 2026",
    title: "Imagens Reais de Produtos na Lista de Materiais e Pranchas ABNT",
    items: [
      { type: "novo", text: "Substituição de ícones genéricos por thumbnails realistas e profissionais de disjuntores DIN (1P, 2P, 3P), IDR, DPS e barramentos." },
      { type: "melhoria", text: "Renderização vetorial nítida em pranchas técnicas A0 a A4 com carimbo/selo normatizado ABNT." },
      { type: "correcao", text: "Ajuste na renderização de linhas e conexões ortogonais em plantas de grande porte." },
    ],
  },
  {
    version: "v2.2.0",
    date: "Agosto de 2026",
    title: "Módulo Solar Fotovoltaico & Balanceamento Automático",
    items: [
      { type: "novo", text: "Dimensionamento de arranjos fotovoltaicos, cálculo de strings e memorial descritivo solar integrado." },
      { type: "melhoria", text: "Algoritmo de balanceamento de fases (R, S, T) com menor índice de desbalanceamento no neutro." },
      { type: "correcao", text: "Correção de tolerâncias no cálculo de corrente corrigida pelo método de instalação B1/C." },
    ],
  },
];

export default function ChangelogPage() {
  const getBadge = (type) => {
    switch (type) {
      case "novo":
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600 text-[10px] font-black uppercase">Novo</Badge>;
      case "melhoria":
        return <Badge className="bg-[#00d8b8] text-[#0f4f49] hover:bg-[#00d8b8] text-[10px] font-black uppercase">Melhoria</Badge>;
      case "correcao":
        return <Badge className="bg-slate-600 text-white hover:bg-slate-600 text-[10px] font-black uppercase">Correção</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] font-black uppercase">{type}</Badge>;
    }
  };

  return (
    <SystemPageLayout
      title="Novidades & Atualizações"
      subtitle="Acompanhe as melhorias, novos recursos e correções contínuas na plataforma Nacif Electric."
      maxWidth="max-w-4xl"
    >
      <div className="space-y-8">
        {RELEASES.map((rel, idx) => (
          <div
            key={rel.version}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 shadow-sm space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] pb-4">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-[#E8FCF8] px-3 py-1 font-mono text-xs font-black text-[#0f4f49]">
                  {rel.version}
                </span>
                <span className="text-xs font-bold text-[#64748B]">
                  {rel.date}
                </span>
              </div>
              {idx === 0 && (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Versão Atual
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A]">
                {rel.title}
              </h2>
            </div>

            <ul className="space-y-2.5">
              {rel.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-[#334155] leading-relaxed">
                  <span className="shrink-0 mt-0.5">{getBadge(item.type)}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SystemPageLayout>
  );
}
