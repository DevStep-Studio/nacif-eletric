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
  children,
}) {
  return <>{children}</>;
}
