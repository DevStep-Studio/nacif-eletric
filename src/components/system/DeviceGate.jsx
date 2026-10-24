import React from "react";
import { useLocation } from "react-router-dom";
import useDeviceRestriction from "@/hooks/useDeviceRestriction";
import MobileDeviceBlockedScreen from "./MobileDeviceBlockedScreen";
import TabletOrientationAdvisory from "./TabletOrientationAdvisory";
import DesktopResizeAdvisory from "./DesktopResizeAdvisory";

/**
 * Rotas públicas institucionais e regulatórias isentas de bloqueio móvel
 * (Documentos de conformidade LGPD, termos e suporte acessíveis em qualquer dispositivo)
 */
const EXEMPT_PUBLIC_ROUTES = [
  "/termos",
  "/privacidade",
  "/cookies",
  "/seguranca",
  "/privacidade/direitos",
  "/ajuda",
  "/suporte",
  "/contato",
  "/status",
  "/novidades",
  "/changelog",
  "/sobre",
  "/reportar-problema",
];

/**
 * DeviceGate - Controlador central de restrição de acesso por dispositivo
 *
 * Aplica as diretrizes de experiência da Nacif Energy:
 * - Celulares: Bloqueia acesso a editores, dashboard e ferramentas operacionais,
 *   exibindo a tela informativa exclusiva sem expor o sistema por trás.
 * - Tablets: Garante acesso completo com recomendação de rotação para horizontal em modo vertical.
 * - Desktops: Acesso completo com orientação de ampliação se a janela for reduzida abaixo de 768px.
 */
export default function DeviceGate({ children }) {
  const location = useLocation();
  const {
    isPhone,
    isDesktopNarrow,
    shouldPromptTabletRotate,
    width,
  } = useDeviceRestriction();

  // Verifica se a rota atual é pública institucional (Termos, LGPD, Suporte)
  const isExempt = EXEMPT_PUBLIC_ROUTES.some((route) =>
    location.pathname.startsWith(route)
  );

  // 1. Bloqueio para Celulares em todas as rotas operacionais e internas
  if (isPhone && !isExempt) {
    return <MobileDeviceBlockedScreen />;
  }

  // 2. Orientação para Desktop com janela reduzida (< 768px)
  if (isDesktopNarrow && !isExempt) {
    return <DesktopResizeAdvisory currentWidth={width} />;
  }

  // 3. Tablet ou Desktop em tamanho padrão: Renderiza o sistema completo
  return (
    <>
      {shouldPromptTabletRotate && <TabletOrientationAdvisory />}
      {children}
    </>
  );
}
