import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Lock,
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  SunMedium,
  Layers,
  Cpu,
  FileCode2,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { canAccessModule, normalizeSubscription } from "@/lib/subscriptionPlans";
import brandLogoEnergy from "@/assets/brand-logo-principal.png";

const MODULE_DEFINITIONS = {
  solar: {
    title: "Projeto Solar Fotovoltaico",
    tagline: "Dimensione usinas solares, analise irradiação, posicione módulos em 2D/3D e gere memoriais técnicos completos.",
    icon: SunMedium,
    accentColor: "#00d8b8",
    badgeLabel: "Módulo Fotovoltaico",
    features: [
      "Dimensionamento de potência fotovoltaica, strings, MPPTs e inversores",
      "Posicionamento inteligente de módulos sobre telhados em mapas de satélite de alta resolução",
      "Simulação 3D com análise de irradiação solar, orientação e azimute",
      "Geração automática de Memorial Solar Descritivo e lista executiva de componentes",
    ],
    recommendedPlan: "Nacif Solar ou Nacif Completo",
  },
  solar_project: {
    title: "Projeto Solar Fotovoltaico",
    tagline: "Dimensione usinas solares, analise irradiação, posicione módulos em 2D/3D e gere memoriais técnicos completos.",
    icon: SunMedium,
    accentColor: "#00d8b8",
    badgeLabel: "Módulo Fotovoltaico",
    features: [
      "Dimensionamento de potência fotovoltaica, strings, MPPTs e inversores",
      "Posicionamento inteligente de módulos sobre telhados em mapas de satélite de alta resolução",
      "Simulação 3D com análise de irradiação solar, orientação e azimute",
      "Geração automática de Memorial Solar Descritivo e lista executiva de componentes",
    ],
    recommendedPlan: "Nacif Solar ou Nacif Completo",
  },
  solar_3d: {
    title: "Layout Solar 2D/3D",
    tagline: "Visualização e organização tridimensional de módulos fotovoltaicos e strings sobre estruturas prediais.",
    icon: SunMedium,
    accentColor: "#00d8b8",
    badgeLabel: "Módulo Solar 3D",
    features: [
      "Renderização 3D de coberturas, águas de telhado e obstáculos",
      "Distribuição e arranjo de painéis solares em tempo real",
      "Análise de sombreamento mútuo e sombreamento por obstáculos",
      "Exportação de imagens técnicas de apresentação para propostas comerciais",
    ],
    recommendedPlan: "Nacif Solar ou Nacif Completo",
  },
  plant: {
    title: "Editor de Planta Elétrica NBR 5410",
    tagline: "Desenhe instalações elétricas profissionais com lançamento automático de circuitos, iluminação e tomadas.",
    icon: Layers,
    accentColor: "#00d8b8",
    badgeLabel: "Planta Elétrica",
    features: [
      "Lançamento automatizado de pontos de iluminação, TUGs e TUEs",
      "Roteamento inteligente de eletrodutos e distribuição de fases",
      "Cálculo de queda de tensão e dimensionamento automático de condutores",
      "Exportação de pranchas executivas em PDF e compatibilidade com DWG/DXF",
    ],
    recommendedPlan: "Nacif Elétrico ou Nacif Completo",
  },
  panel: {
    title: "Gerador de Quadro de Distribuição DIN",
    tagline: "Configure quadros elétricos com disjuntores, barramentos, DRs e DPSs em total conformidade com normas técnicas.",
    icon: Cpu,
    accentColor: "#00d8b8",
    badgeLabel: "Quadro de Distribuição",
    features: [
      "Diagramação visual de barramento fase, neutro e condutor de proteção (PE)",
      "Balanceamento automático de cargas e potências entre as fases",
      "Dimensionamento de disjuntores termomagnéticos, IDR e DPS classe II",
      "Etiquetas técnicas para identificação e lista executiva para montagem",
    ],
    recommendedPlan: "Nacif Elétrico ou Nacif Completo",
  },
  unifilar: {
    title: "Diagrama Unifilar & Trifilar Automático",
    tagline: "Transforme seus dados de circuitos em diagramas unifilares e trifilares padronizados com 1 clique.",
    icon: FileCode2,
    accentColor: "#00d8b8",
    badgeLabel: "Diagrama Elétrico",
    features: [
      "Desenho vetorial padronizado conforme simbologia da NBR 5410",
      "Representação de ramais de entrada, proteção geral e circuitos terminais",
      "Tabelas de resumo de carga, bitolas e disjuntores integradas",
      "Exportação em alta resolução para aprovação em concessionárias de energia",
    ],
    recommendedPlan: "Nacif Elétrico ou Nacif Completo",
  },
  electrical_tools: {
    title: "Ferramentas Elétricas NBR 5410",
    tagline: "Dimensionamento e balanceamento elétrico predial conforme NBR 5410.",
    icon: Cpu,
    accentColor: "#00d8b8",
    badgeLabel: "NBR 5410",
    features: [
      "Balanceamento automático de fases trifásicas",
      "Editor de circuitos e proteções DIN",
      "Memorial descritivo da instalação",
      "Scanner de plantas e quadros por IA",
    ],
    recommendedPlan: "Nacif Elétrico ou Nacif Completo",
  },
  circuit_editor: {
    title: "Editor de Circuitos NBR 5410",
    tagline: "Dimensionamento detalhado de condutores, disjuntores e proteções.",
    icon: Cpu,
    accentColor: "#00d8b8",
    badgeLabel: "Circuitos",
    features: [
      "Cálculo de corrente de projeto Ib e capacidade de condução Iz",
      "Dimensionamento de disjuntores e curvas B/C/D",
      "Coordenação de proteção contra sobrecargas e curtos-circuitos",
    ],
    recommendedPlan: "Nacif Elétrico ou Nacif Completo",
  },
  phase_balance: {
    title: "Balanceamento de Fases",
    tagline: "Otimização de carregamento trifásico para redução de perdas.",
    icon: Layers,
    accentColor: "#00d8b8",
    badgeLabel: "Fases",
    features: [
      "Distribuição equilibrada entre fases A, B e C",
      "Minimização de corrente no condutor neutro",
    ],
    recommendedPlan: "Nacif Elétrico ou Nacif Completo",
  },
  memorial: {
    title: "Memorial Descritivo da Instalação",
    tagline: "Documentação técnica oficial para emissão de ART/TRT.",
    icon: FileCode2,
    accentColor: "#00d8b8",
    badgeLabel: "Memorial",
    features: [
      "Emissão estruturada conforme normas ABNT",
      "Exportação oficial para apresentação a concessionárias",
    ],
    recommendedPlan: "Nacif Elétrico ou Nacif Completo",
  },
  scanner: {
    title: "Scanner Técnico Assistido por IA",
    tagline: "Reconhecimento automatizado de componentes elétricos e cargas.",
    icon: Sparkles,
    accentColor: "#00d8b8",
    badgeLabel: "Scanner IA",
    features: [
      "Leitura assistida de quadros e equipamentos",
      "Sugestão inteligente de proteções NBR 5410",
    ],
    recommendedPlan: "Nacif Elétrico, Solar ou Completo",
  },
  team: {
    title: "Gestão de Equipe Multi-Usuário",
    tagline: "Colaboração técnica simultânea com controle de membros.",
    icon: Layers,
    accentColor: "#00d8b8",
    badgeLabel: "Equipe",
    features: [
      "Múltiplos projetistas no mesmo workspace",
      "Gestão de permissões de acesso",
    ],
    recommendedPlan: "Nacif Elétrico, Solar ou Completo",
  },
};

/**
 * Componente centralizado de guarda de recursos por plano de assinatura.
 * Se o usuário possuir acesso, renderiza os filhos (com identificação acadêmica quando aplicável).
 * Se o recurso for restrito pelo plano atual, renderiza a tela contextual premium com identidade Nacif Energy.
 */
export default function ModuleAccessGate({
  moduleKey,
  moduleTitle = "Recurso Avançado",
  children,
  fallback = null,
  showAcademicBanner = true,
  immersive = false,
}) {
  const { user } = useAuth();
  const subscription = useMemo(() => normalizeSubscription(user), [user]);
  const access = useMemo(() => canAccessModule(user, moduleKey), [user, moduleKey]);

  if (!access.allowed) {
    if (fallback) return fallback;

    const moduleInfo = MODULE_DEFINITIONS[moduleKey] || {
      title: moduleTitle || "Recurso Exclusivo",
      tagline: access.message || "Este recurso exige um plano com autorização técnica específica.",
      icon: Lock,
      accentColor: "#00d8b8",
      badgeLabel: "Recurso Pro",
      features: [
        "Acesso completo a ferramentas profissionais de engenharia de alta precisão",
        "Cálculos e dimensionamentos automatizados conforme normas vigentes",
        "Geração e exportação de documentação executiva em PDF com a sua marca",
        "Armazenamento seguro em nuvem com preservação contínua dos seus dados",
      ],
      recommendedPlan: access.requiredPlans?.length ? access.requiredPlans.join(" ou ") : "Nacif Completo",
    };

    const IconComponent = access.level === "expired" ? AlertTriangle : moduleInfo.icon;
    const requiredPlansText = access.requiredPlans?.length
      ? access.requiredPlans.join(" ou ")
      : moduleInfo.recommendedPlan;

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-inter text-slate-900 antialiased selection:bg-[#00d8b8]/20 selection:text-slate-950">
        {/* TOPBAR INSTITUCIONAL ELEGANTE */}
        <header className="h-14 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <Link to="/projects" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <img
                src={brandLogoEnergy}
                alt="Nacif Energy"
                className="h-6 sm:h-7 object-contain"
              />
            </Link>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <Badge
              variant="outline"
              className="hidden sm:inline-flex items-center gap-1.5 border-teal-200/80 bg-teal-50/60 text-[#0f4f49] text-xs font-semibold px-2.5 py-0.5 rounded-full"
            >
              <Lock className="h-3 w-3 text-[#009b84]" />
              {moduleInfo.badgeLabel}
            </Badge>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 gap-1.5"
            >
              <Link to="/projects">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar aos Projetos</span>
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="h-8 text-xs font-extrabold bg-[#00d8b8] text-slate-950 hover:bg-[#00bda1] shadow-xs gap-1.5"
            >
              <Link to="/subscription">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ver Planos</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* CORPO CENTRAL COM VISUAL ELEGANTE E HALO AMBIENTE */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
          {/* Ambient glow effects */}
          <div className="absolute -top-32 -right-32 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-[#00d8b8]/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-[#0f4f49]/8 blur-3xl pointer-events-none" />

          {/* CARD CENTRAL */}
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-[#BCEEE5] shadow-[0_20px_50px_-15px_rgba(0,216,184,0.14)] p-6 sm:p-10 relative z-10">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#00d8b8] via-[#0f4f49] to-[#00d8b8] rounded-t-3xl" />

            <div className="flex flex-col items-center text-center">
              {/* Ícone com anel duplo iluminado */}
              <div className="relative mb-4">
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#E8FCF8] to-[#C9F6EE] text-[#0f4f49] shadow-inner ring-8 ring-[#E8FCF8]/70">
                  <IconComponent className="h-8 w-8 sm:h-9 sm:w-9 text-[#009b84]" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm ring-2 ring-white">
                  <Lock className="h-3 w-3 text-[#00d8b8]" />
                </div>
              </div>

              {/* Badges de Contexto do Plano */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full"
                >
                  Plano atual: <strong className="ml-1 text-slate-900">{subscription.plan.name}</strong>
                </Badge>
                {access.level === "expired" ? (
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-xs px-3 py-1 rounded-full">
                    Vínculo acadêmico pendente
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-teal-300/80 bg-teal-50 text-[#0f4f49] text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3 text-[#009b84]" />
                    Incluso em: {requiredPlansText}
                  </Badge>
                )}
              </div>

              {/* Título Principal */}
              <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {moduleInfo.title} indisponível neste plano
              </h1>

              {/* Descrição */}
              <p className="mt-2.5 max-w-lg text-sm sm:text-base font-normal leading-relaxed text-slate-600">
                {access.message || moduleInfo.tagline}
              </p>

              {/* Box de Benefícios do Módulo */}
              <div className="w-full mt-6 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/80 via-teal-50/20 to-slate-50/60 p-4 sm:p-5 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-[#009b84]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    O que este módulo adiciona ao seu workspace:
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {moduleInfo.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-[#009b84] shrink-0 mt-0.5" />
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs de Ação */}
              <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto">
                <Button
                  asChild
                  className="h-11 sm:h-12 rounded-xl bg-[#00d8b8] px-6 font-extrabold text-slate-950 hover:bg-[#00bda1] shadow-md hover:shadow-lg transition-all gap-2 text-sm"
                >
                  <Link to="/subscription">
                    <span>Ver planos e fazer upgrade</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 sm:h-12 rounded-xl border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-5 text-sm"
                >
                  <Link to="/projects">
                    <ArrowLeft className="mr-1.5 h-4 w-4 text-slate-500" />
                    <span>Voltar para Projetos</span>
                  </Link>
                </Button>
              </div>

              {/* Garantia e Segurança de Dados */}
              <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 pt-2 border-t border-slate-100 w-full">
                <ShieldCheck className="h-4 w-4 text-[#009b84] shrink-0" />
                <span>Seus projetos e documentos existentes permanecem 100% seguros e preservados.</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      {showAcademicBanner && access.isAcademic && (
        immersive ? (
          <div className="fixed bottom-3 left-4 z-50 pointer-events-none flex items-center gap-2 rounded-full border border-blue-300/40 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 text-xs text-blue-200 shadow-lg">
            <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-semibold text-[11px]">Nacif Estudante — Uso Educacional</span>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between rounded-[8px] border border-blue-200 bg-blue-50/80 px-4 py-2.5 text-xs text-blue-900 shadow-sm">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 shrink-0 text-blue-700" />
              <span className="font-bold">
                Versão Acadêmica — Nacif Estudante — Uso Educacional
              </span>
            </div>
            <span className="hidden text-[11px] font-semibold text-blue-700 md:inline">
              Documentos emitidos com identificação acadêmica
            </span>
          </div>
        )
      )}
      {showAcademicBanner && access.isFreeRestricted && (
        immersive ? (
          <div className="fixed bottom-3 left-4 z-50 pointer-events-none flex items-center gap-2 rounded-full border border-amber-300/40 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 text-xs text-amber-200 shadow-lg">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-semibold text-[11px]">Avaliação Gratuita — Limite de até 3 projetos</span>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between rounded-[8px] border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="font-bold">
                Versão de Avaliação Gratuita — Nacif Energy
              </span>
            </div>
            <span className="hidden text-[11px] font-semibold text-amber-700 md:inline">
              Faça upgrade para exportações e projetos ilimitados
            </span>
          </div>
        )
      )}
      {children}
    </>
  );
}
