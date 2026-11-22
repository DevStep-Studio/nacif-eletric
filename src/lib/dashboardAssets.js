/**
 * Centralização de Assets Visuais Substituíveis — NACIF ENERGY
 *
 * Para substituir a arte definitiva do banner do projeto em destaque ou do mascote da IA
 * sem alterar nenhum componente de layout:
 *
 * 1. Banner padrão do Projeto em Destaque:
 *    - Substitua o arquivo: `public/assets/banners/featured-residence-default.jpg`
 *      e/ou `src/assets/featured-residence-default.jpg`
 *    - Ou informe `banner_desktop_url` / `banner_mobile_url` / `cover_image_url` no objeto do projeto.
 *
 * 2. Mascote Nacif IA:
 *    - Substitua o arquivo: `public/assets/mascot/nacif-ia-mascot.png`
 *      e/ou `src/assets/nacif-ia-mascot.png` (preferencialmente PNG com fundo transparente).
 */

import featuredResidenceDefaultImg from "@/assets/featured-residence-default.jpg";
import nacifIaMascotImg from "@/assets/nacif-ia-mascot.png";

export const FEATURED_PROJECT_ASSETS = {
  default: featuredResidenceDefaultImg,
  desktop: featuredResidenceDefaultImg,
  mobile: featuredResidenceDefaultImg,
  publicDefaultUrl: "/assets/banners/featured-residence-default.jpg",
  defaultObjectPosition: "right center",
  alt: "Ilustração arquitetônica 3D de instalação elétrica residencial",
};

export const NACIF_AI_ASSETS = {
  mascot: nacifIaMascotImg,
  publicMascotUrl: "/assets/mascot/nacif-ia-mascot.png",
  mascotAlt: "Mascote Nacif IA — Assistente de Engenharia Elétrica",
};

/**
 * Resolve as imagens desktop, mobile e fallback para o card de Projeto em Destaque.
 * Mantém compatibilidade com campos personalizados de projeto quando existirem.
 */
export function resolveFeaturedProjectBanner(project = null) {
  const customDesktop =
    project?.banner_desktop_url ||
    project?.banner_url ||
    project?.cover_image_url ||
    project?.thumbnail_url ||
    "";
  const customMobile =
    project?.banner_mobile_url ||
    customDesktop ||
    "";
  const objectPosition =
    project?.banner_position ||
    FEATURED_PROJECT_ASSETS.defaultObjectPosition;

  return {
    desktopSrc: customDesktop || FEATURED_PROJECT_ASSETS.desktop,
    mobileSrc: customMobile || FEATURED_PROJECT_ASSETS.mobile,
    fallbackSrc: FEATURED_PROJECT_ASSETS.default,
    objectPosition,
    isCustom: Boolean(customDesktop || customMobile),
    alt: project?.name
      ? `${project.name} — ${FEATURED_PROJECT_ASSETS.alt}`
      : FEATURED_PROJECT_ASSETS.alt,
  };
}
