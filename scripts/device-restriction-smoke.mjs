import assert from "node:assert/strict";
import { classifyDevice } from "../src/lib/deviceDetection.js";

console.log("=================================================");
console.log("📱 INICIANDO TESTES DE RESTRIÇÃO POR DISPOSITIVO - NACIF ENERGY");
console.log("=================================================");

function mockBrowserEnv({
  ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  maxTouchPoints = 0,
  hasTouchStart = false,
  screenWidth = 1920,
  screenHeight = 1080,
  innerWidth = 1920,
  innerHeight = 1080,
  coarsePointer = false,
  finePointer = true,
}) {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      userAgent: ua,
      maxTouchPoints,
      platform: ua.includes("Mac") ? "MacIntel" : ua.includes("iPhone") ? "iPhone" : "Win32",
    },
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, "window", {
    value: {
      innerWidth,
      innerHeight,
      screen: {
        width: screenWidth,
        height: screenHeight,
        orientation: {
          type: innerWidth > innerHeight ? "landscape-primary" : "portrait-primary",
          addEventListener: () => {},
          removeEventListener: () => {},
        },
      },
      ontouchstart: hasTouchStart ? () => {} : undefined,
      matchMedia: (query) => ({
        matches: query.includes("pointer: coarse")
          ? coarsePointer
          : query.includes("pointer: fine")
          ? finePointer
          : false,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    configurable: true,
    writable: true,
  });
}

// ── 1. Cenário: iPhone em Modo Retrato ──────────────────────────────────────────
console.log("\n[1/8] Testando iPhone (iOS) em Modo Retrato...");
mockBrowserEnv({
  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  maxTouchPoints: 5,
  hasTouchStart: true,
  screenWidth: 393,
  screenHeight: 852,
  innerWidth: 393,
  innerHeight: 852,
  coarsePointer: true,
  finePointer: false,
});

let result = classifyDevice();
assert.equal(result.isPhone, true, "iPhone deve ser classificado como Phone");
assert.equal(result.isTablet, false, "iPhone não deve ser classificado como Tablet");
assert.equal(result.isDesktop, false, "iPhone não deve ser classificado como Desktop");
assert.equal(result.shouldBlock, true, "iPhone deve ter shouldBlock = true (bloquear ferramentas operacionais)");
console.log("✓ iPhone em retrato: Bloqueado com sucesso para exibição da tela exclusiva.");

// ── 2. Cenário: Celular Android em Modo Retrato ─────────────────────────────────
console.log("\n[2/8] Testando Smartphone Android (Galaxy/Pixel) em Modo Retrato...");
mockBrowserEnv({
  ua: "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36",
  maxTouchPoints: 5,
  hasTouchStart: true,
  screenWidth: 412,
  screenHeight: 915,
  innerWidth: 412,
  innerHeight: 915,
  coarsePointer: true,
  finePointer: false,
});

result = classifyDevice();
assert.equal(result.isPhone, true, "Android Mobile deve ser classificado como Phone");
assert.equal(result.shouldBlock, true, "Android Mobile deve ter shouldBlock = true");
console.log("✓ Celular Android em retrato: Bloqueado com sucesso.");

// ── 3. Cenário: Celular na Horizontal (Landscape) - Rotação NÃO libera o sistema ──
console.log("\n[3/8] Testando Celular na Horizontal (Landscape)...");
mockBrowserEnv({
  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  maxTouchPoints: 5,
  hasTouchStart: true,
  screenWidth: 852,
  screenHeight: 393,
  innerWidth: 852,
  innerHeight: 393,
  coarsePointer: true,
  finePointer: false,
});

result = classifyDevice();
assert.equal(result.isPhone, true, "Celular rotacionado para horizontal DEVE continuar sendo Phone");
assert.equal(result.shouldBlock, true, "Celular rotacionado NÃO DEVE liberar o sistema (shouldBlock = true)");
console.log("✓ Celular na horizontal: Rotação respeita a restrição e continua bloqueado.");

// ── 4. Cenário: iPad em Modo Paisagem (Horizontal) ─────────────────────────────
console.log("\n[4/8] Testando iPad em Modo Horizontal (Paisagem)...");
mockBrowserEnv({
  ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  maxTouchPoints: 5,
  hasTouchStart: true,
  screenWidth: 1180,
  screenHeight: 820,
  innerWidth: 1180,
  innerHeight: 820,
  coarsePointer: true,
  finePointer: false,
});

result = classifyDevice();
assert.equal(result.isTablet, true, "iPad deve ser classificado como Tablet");
assert.equal(result.isPhone, false, "iPad NÃO deve ser classificado como Phone");
assert.equal(result.shouldBlock, false, "iPad deve ter ACESSO LIBERADO (shouldBlock = false)");
assert.equal(result.shouldPromptTabletRotate, false, "iPad em paisagem não precisa de aviso de rotação");
console.log("✓ iPad em paisagem: Acesso completo liberado à plataforma.");

// ── 5. Cenário: Tablet na Vertical com Espaço Reduzido (iPad Mini / 10th Gen) ──
console.log("\n[5/8] Testando Tablet na Vertical com Orientação de Rotação...");
mockBrowserEnv({
  ua: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  maxTouchPoints: 5,
  hasTouchStart: true,
  screenWidth: 768,
  screenHeight: 1024,
  innerWidth: 768,
  innerHeight: 1024,
  coarsePointer: true,
  finePointer: false,
});

result = classifyDevice();
assert.equal(result.isTablet, true, "iPad portrait deve ser Tablet");
assert.equal(result.shouldBlock, false, "Tablet na vertical NÃO deve ser bloqueado");
assert.equal(result.shouldPromptTabletRotate, true, "Tablet na vertical DEVE orientar a rotação para horizontal");
console.log("✓ Tablet na vertical: Acesso permitido com recomendação de rotação para horizontal.");

// ── 6. Cenário: Tablet Android (Samsung Galaxy Tab) ────────────────────────────
console.log("\n[6/8] Testando Tablet Android (sem 'Mobile' na UA)...");
mockBrowserEnv({
  ua: "Mozilla/5.0 (Linux; Android 13; SM-X800) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  maxTouchPoints: 5,
  hasTouchStart: true,
  screenWidth: 1280,
  screenHeight: 800,
  innerWidth: 1280,
  innerHeight: 800,
  coarsePointer: true,
  finePointer: false,
});

result = classifyDevice();
assert.equal(result.isTablet, true, "Galaxy Tab deve ser Tablet");
assert.equal(result.shouldBlock, false, "Galaxy Tab deve ter acesso completo");
console.log("✓ Tablet Android: Acesso liberado sem restrições.");

// ── 7. Cenário: Notebook / Computador Desktop ─────────────────────────────────
console.log("\n[7/8] Testando Notebook e Desktop...");
mockBrowserEnv({
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  maxTouchPoints: 0,
  hasTouchStart: false,
  screenWidth: 1920,
  screenHeight: 1080,
  innerWidth: 1920,
  innerHeight: 1080,
  coarsePointer: false,
  finePointer: true,
});

result = classifyDevice();
assert.equal(result.isDesktop, true, "Desktop deve ser classificado como Desktop");
assert.equal(result.shouldBlock, false, "Desktop deve ter acesso completo liberado");
assert.equal(result.isDesktopNarrow, false, "Desktop com largura 1920px não é estreito");
console.log("✓ Computador / Notebook: Acesso 100% completo e operacional.");

// ── 8. Cenário: Redimensionamento de Janela no Desktop (< 768px) ──────────────
console.log("\n[8/8] Testando Redimensionamento de Janela Desktop (< 768px)...");
mockBrowserEnv({
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  maxTouchPoints: 0,
  hasTouchStart: false,
  screenWidth: 1920,
  screenHeight: 1080,
  innerWidth: 600, // Janela redimensionada para 600px
  innerHeight: 800,
  coarsePointer: false,
  finePointer: true,
});

result = classifyDevice();
assert.equal(result.isDesktop, true, "Continua sendo Desktop");
assert.equal(result.shouldBlock, false, "Não é celular");
assert.equal(result.isDesktopNarrow, true, "Desktop redimensionado para 600px é considerado estreito para orientar expansão");
console.log("✓ Redimensionamento de janela: Orienta expansão sem quebrar o layout.");

console.log("\n=================================================");
console.log("🎉 TODOS OS 8 CENÁRIOS DE TESTE PASSARAM COM SUCESSO!");
console.log("=================================================");
