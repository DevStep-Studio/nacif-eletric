/**
 * Nacif Energy - Utilitário de Detecção e Classificação de Dispositivos
 *
 * Classifica os acessos em:
 * 1. CELULAR (Phone): Smartphones (iPhone, Android Mobile) em qualquer orientação.
 *    -> Bloqueado para uso das ferramentas internas da plataforma.
 *    -> Rotação para horizontal NÃO libera indevidamente o editor.
 * 2. TABLET: iPads e Tablets Android em modo vertical e horizontal.
 *    -> Acesso COMPLETO liberado.
 *    -> Em modo vertical (espaço reduzido), orienta a rotação para horizontal sem bloquear.
 * 3. COMPUTADOR / NOTEBOOK (Desktop):
 *    -> Acesso COMPLETO liberado.
 *    -> Se a janela for redimensionada para menos de 768px, orienta a ampliação sem quebrar o layout.
 */

export function parseDeviceSignals() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      ua: "",
      isIPhone: false,
      isIPad: false,
      isAndroidPhone: false,
      isAndroidTablet: false,
      isPhoneUA: false,
      isTabletUA: false,
      hasTouch: false,
      isCoarse: false,
      isFine: true,
      screenMin: 1920,
      screenMax: 1080,
      width: 1920,
      height: 1080,
      isLandscape: true,
      isPortrait: false,
    };
  }

  const ua = navigator.userAgent || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const hasTouch = maxTouchPoints > 0 || "ontouchstart" in window;

  // Dimensões físicas e lógicas da tela
  const screenW = window.screen?.width || window.innerWidth;
  const screenH = window.screen?.height || window.innerHeight;
  const screenMin = Math.min(screenW, screenH);
  const screenMax = Math.max(screenW, screenH);

  // Viewport atual (reage dinamicamente a resize e rotação)
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;
  const isPortrait = !isLandscape;

  // Características do ponteiro (mouse vs toque)
  const isCoarse = window.matchMedia ? window.matchMedia("(pointer: coarse)").matches : hasTouch;
  const isFine = window.matchMedia ? window.matchMedia("(pointer: fine)").matches : !hasTouch;

  // Detecção via User-Agent & Platform
  const isIPhone = /iPhone|iPod/i.test(ua);

  // iPads modernos com iPadOS reportam "Macintosh", mas possuem touch e tela de tablet
  const isIPad =
    /iPad/i.test(ua) ||
    (/Macintosh/i.test(ua) && maxTouchPoints > 1 && screenMin >= 768);

  // No Android, o Chrome inclui "Mobile" apenas em smartphones; em tablets Android, omite "Mobile"
  const isAndroidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);

  // Outros dispositivos móveis legados ou incomuns
  const isOtherPhoneUA =
    /Windows Phone|BlackBerry|Opera Mini|IEMobile|Mobile/i.test(ua) &&
    !isIPad &&
    !isAndroidTablet;

  const isPhoneUA = isIPhone || isAndroidPhone || isOtherPhoneUA;
  const isTabletUA = isIPad || isAndroidTablet || /Tablet|PlayBook|Silk/i.test(ua);

  return {
    ua,
    isIPhone,
    isIPad,
    isAndroidPhone,
    isAndroidTablet,
    isPhoneUA,
    isTabletUA,
    hasTouch,
    isCoarse,
    isFine,
    screenMin,
    screenMax,
    width,
    height,
    isLandscape,
    isPortrait,
  };
}

export function classifyDevice() {
  const signals = parseDeviceSignals();
  const {
    isPhoneUA,
    isTabletUA,
    isIPad,
    isAndroidTablet,
    hasTouch,
    isFine,
    screenMin,
    screenMax,
    width,
    height,
    isLandscape,
    isPortrait,
  } = signals;

  // 1. Identificação de Tablet
  // - iPads (qualquer modelo)
  // - Tablets Android (sem "Mobile" na UA ou com dimensões típicas de tablet)
  // - Dispositivos com toque onde a menor dimensão física da tela é >= 600px e < 1100px (ex: tablets 7" a 12.9")
  const isTablet =
    !isPhoneUA &&
    (isTabletUA ||
      isIPad ||
      isAndroidTablet ||
      (hasTouch && screenMin >= 600 && screenMin <= 1024 && !isFine));

  // 2. Identificação de Smartphone / Celular
  // - Telefone confirmado por UA (iPhone, Android Mobile)
  // - OU dispositivo com toque cuja menor dimensão de tela é < 600px (todos smartphones comerciais possuem largura de 320px a 440px)
  // - OU celular em modo horizontal: tem toque, tela com screenMin < 600px ou altura do viewport < 500px em modo landscape
  // - Rotação para horizontal NÃO o desclassifica como celular!
  const isPhone =
    !isTablet &&
    (isPhoneUA ||
      (hasTouch && screenMin < 600) ||
      (hasTouch && isLandscape && height < 500 && screenMin < 600) ||
      (hasTouch && !isFine && width < 768 && screenMax <= 950));

  // 3. Identificação de Computador / Notebook
  const isDesktop = !isPhone && !isTablet;

  // Regras de Restrição:
  // - Celular: SEMPRE BLOQUEADO nas ferramentas da plataforma
  const shouldBlock = isPhone;

  // - Desktop redimensionado com largura menor que 768px: orienta expansão da janela para não quebrar layout
  const isDesktopNarrow = isDesktop && width < 768;

  // - Tablet na vertical: orienta a rotação para horizontal sem bloquear o acesso
  //   (Recomendado especialmente para ferramentas de engenharia como Planta IA, Unifilar, Painéis e Solar)
  const shouldPromptTabletRotate = isTablet && isPortrait;

  return {
    ...signals,
    deviceType: isPhone ? "phone" : isTablet ? "tablet" : "desktop",
    isPhone,
    isTablet,
    isDesktop,
    shouldBlock,
    isDesktopNarrow,
    shouldPromptTabletRotate,
  };
}
