import fs from "fs";
import path from "path";

const products = {
  "idr-4p.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="blueToggle" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <!-- Background panel / device housing -->
  <rect x="25" y="20" width="150" height="160" rx="8" fill="url(#bodyGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)"/>
  <!-- Top Screw Terminals -->
  <circle cx="48" cy="36" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <line x1="42" y1="36" x2="54" y2="36" stroke="#334155" stroke-width="2.5"/>
  <circle cx="82" cy="36" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <line x1="76" y1="36" x2="88" y2="36" stroke="#334155" stroke-width="2.5"/>
  <circle cx="118" cy="36" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <line x1="112" y1="36" x2="124" y2="36" stroke="#334155" stroke-width="2.5"/>
  <circle cx="152" cy="36" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <line x1="146" y1="36" x2="158" y2="36" stroke="#334155" stroke-width="2.5"/>
  <!-- Labels 1 3 5 N -->
  <text x="48" y="55" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#64748b" text-anchor="middle">1</text>
  <text x="82" y="55" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#64748b" text-anchor="middle">3</text>
  <text x="118" y="55" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#64748b" text-anchor="middle">5</text>
  <text x="152" y="55" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#0284c7" text-anchor="middle">N</text>
  <!-- Middle Faceplate -->
  <rect x="35" y="62" width="130" height="76" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
  <!-- Branding & Specs -->
  <text x="50" y="78" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#0f172a">IDR · DR 4P</text>
  <text x="50" y="90" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#0369a1">40A / 30mA</text>
  <text x="50" y="100" font-family="system-ui, sans-serif" font-size="7.5" font-weight="600" fill="#64748b">400V~ Tetrapolar</text>
  <!-- Test Button (T) -->
  <rect x="50" y="108" width="22" height="18" rx="3" fill="#eab308" stroke="#ca8a04" stroke-width="1.2"/>
  <text x="61" y="121" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle">T</text>
  <!-- Main Lever Switch (Tetrapolar connected) -->
  <rect x="88" y="94" width="70" height="26" rx="4" fill="url(#blueToggle)" stroke="#075985" stroke-width="1.5"/>
  <rect x="92" y="98" width="62" height="8" rx="2" fill="#38bdf8" opacity="0.6"/>
  <text x="123" y="111" font-family="system-ui, sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle">I-ON</text>
  <!-- Bottom Screw Terminals -->
  <circle cx="48" cy="164" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <line x1="42" y1="164" x2="54" y2="164" stroke="#334155" stroke-width="2.5"/>
  <circle cx="82" cy="164" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <line x1="76" y1="164" x2="88" y2="164" stroke="#334155" stroke-width="2.5"/>
  <circle cx="118" cy="164" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <line x1="112" y1="164" x2="124" y2="164" stroke="#334155" stroke-width="2.5"/>
  <circle cx="152" cy="164" r="9" fill="#94a3b8" stroke="#64748b" stroke-width="1.5"/>
  <line x1="146" y1="164" x2="158" y2="164" stroke="#334155" stroke-width="2.5"/>
</svg>`,

  "connector-wago.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="wagoBody" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="50%" stop-color="#f1f5f9" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#cbd5e1" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="orangeLever" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff7a00"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
    <filter id="wagoShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.15"/>
    </filter>
  </defs>
  <!-- Main Transparent Housing -->
  <rect x="30" y="45" width="140" height="110" rx="10" fill="url(#wagoBody)" stroke="#94a3b8" stroke-width="2" filter="url(#wagoShadow)"/>
  <!-- Internal copper bus / clamps visible through transparent body -->
  <rect x="45" y="110" width="30" height="24" rx="3" fill="#d97706" opacity="0.7"/>
  <rect x="85" y="110" width="30" height="24" rx="3" fill="#d97706" opacity="0.7"/>
  <rect x="125" y="110" width="30" height="24" rx="3" fill="#d97706" opacity="0.7"/>
  <!-- Wire entry ports at bottom -->
  <circle cx="60" cy="144" r="7" fill="#334155"/>
  <circle cx="100" cy="144" r="7" fill="#334155"/>
  <circle cx="140" cy="144" r="7" fill="#334155"/>
  <!-- Orange Levers -->
  <!-- Lever 1 -->
  <rect x="46" y="52" width="28" height="48" rx="4" fill="url(#orangeLever)" stroke="#c2410c" stroke-width="1.5"/>
  <line x1="52" y1="62" x2="68" y2="62" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <line x1="52" y1="70" x2="68" y2="70" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <!-- Lever 2 -->
  <rect x="86" y="52" width="28" height="48" rx="4" fill="url(#orangeLever)" stroke="#c2410c" stroke-width="1.5"/>
  <line x1="92" y1="62" x2="108" y2="62" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <line x1="92" y1="70" x2="108" y2="70" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <!-- Lever 3 (Raised slightly) -->
  <rect x="126" y="44" width="28" height="48" rx="4" fill="url(#orangeLever)" stroke="#c2410c" stroke-width="1.5" transform="rotate(-5 140 44)"/>
  <line x1="132" y1="54" x2="148" y2="54" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <!-- Wago 221 text -->
  <text x="100" y="104" font-family="system-ui, sans-serif" font-size="9" font-weight="900" fill="#475569" text-anchor="middle">221 · 32A 450V</text>
</svg>`,

  "terminal-ferrule.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="copperPin" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f1f5f9"/>
      <stop offset="50%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <linearGradient id="redCollar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#b91c1c"/>
    </linearGradient>
    <linearGradient id="blueCollar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="yellowCollar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#a16207"/>
    </linearGradient>
    <filter id="drop" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.15"/>
    </filter>
  </defs>
  <!-- Ferrule 1 (Red 1.5mm) -->
  <g transform="translate(30, 40) rotate(25)" filter="url(#drop)">
    <!-- Metal Tube -->
    <rect x="40" y="8" width="55" height="14" rx="2" fill="url(#copperPin)" stroke="#475569" stroke-width="1"/>
    <!-- Plastic Collar -->
    <path d="M5 0 L40 5 L40 25 L5 30 Z" fill="url(#redCollar)" stroke="#991b1b" stroke-width="1.5"/>
    <ellipse cx="5" cy="15" rx="5" ry="15" fill="#7f1d1d"/>
  </g>
  <!-- Ferrule 2 (Blue 2.5mm) -->
  <g transform="translate(45, 85) rotate(-15)" filter="url(#drop)">
    <rect x="42" y="7" width="60" height="18" rx="2" fill="url(#copperPin)" stroke="#475569" stroke-width="1"/>
    <path d="M5 0 L42 5 L42 27 L5 32 Z" fill="url(#blueCollar)" stroke="#1e3a8a" stroke-width="1.5"/>
    <ellipse cx="5" cy="16" rx="5" ry="16" fill="#1e3a8a"/>
  </g>
  <!-- Ferrule 3 (Yellow 6.0mm) -->
  <g transform="translate(60, 130) rotate(10)" filter="url(#drop)">
    <rect x="45" y="6" width="65" height="22" rx="2" fill="url(#copperPin)" stroke="#475569" stroke-width="1"/>
    <path d="M5 0 L45 4 L45 30 L5 34 Z" fill="url(#yellowCollar)" stroke="#713f12" stroke-width="1.5"/>
    <ellipse cx="5" cy="17" rx="5" ry="17" fill="#713f12"/>
  </g>
</svg>`,

  "terminal-lug.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="ringMetal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="50%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <linearGradient id="blueIns" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <filter id="lugShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.15"/>
    </filter>
  </defs>
  <!-- Ring Terminal (Olhal) -->
  <g transform="translate(35, 30) rotate(15)" filter="url(#lugShadow)">
    <circle cx="100" cy="40" r="28" fill="url(#ringMetal)" stroke="#475569" stroke-width="2"/>
    <circle cx="100" cy="40" r="14" fill="#ffffff" stroke="#475569" stroke-width="1.5"/>
    <rect x="40" y="30" width="45" height="20" fill="url(#ringMetal)" stroke="#475569" stroke-width="1.5"/>
    <rect x="0" y="24" width="48" height="32" rx="6" fill="url(#blueIns)" stroke="#0369a1" stroke-width="2"/>
  </g>
  <!-- Fork Terminal (Garfo) -->
  <g transform="translate(25, 110) rotate(-10)" filter="url(#lugShadow)">
    <path d="M75 25 L115 25 L115 42 L95 42 L95 54 L115 54 L115 71 L75 71 Z" fill="url(#ringMetal)" stroke="#475569" stroke-width="2"/>
    <rect x="40" y="38" width="40" height="20" fill="url(#ringMetal)" stroke="#475569" stroke-width="1.5"/>
    <rect x="0" y="32" width="48" height="32" rx="6" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>
  </g>
</svg>`,

  "outlet-10a.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="plateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <filter id="plateShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <!-- Wall Plate (Placa 4x2) -->
  <rect x="45" y="15" width="110" height="170" rx="12" fill="url(#plateGrad)" stroke="#cbd5e1" stroke-width="2" filter="url(#plateShadow)"/>
  <!-- Inner Bevel -->
  <rect x="55" y="25" width="90" height="150" rx="8" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
  <!-- Central Modular Socket (Módulo Tomada NBR 14136) -->
  <rect x="68" y="65" width="64" height="70" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <!-- Recessed Hexagonal Socket Cup -->
  <polygon points="82,78 118,78 126,100 118,122 82,122 74,100" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
  <!-- 3 Socket Holes (2P + T) -->
  <circle cx="88" cy="100" r="3.5" fill="#1e293b"/>
  <circle cx="100" cy="100" r="3.5" fill="#1e293b"/>
  <circle cx="112" cy="100" r="3.5" fill="#1e293b"/>
  <!-- Rating Text -->
  <text x="100" y="150" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#64748b" text-anchor="middle">10A · 250V~</text>
  <text x="100" y="160" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#94a3b8" text-anchor="middle">NBR 14136</text>
</svg>`,

  "switch-simple.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="switchPlate" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <linearGradient id="rockerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <filter id="switchShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>
  <!-- Wall Plate -->
  <rect x="45" y="15" width="110" height="170" rx="12" fill="url(#switchPlate)" stroke="#cbd5e1" stroke-width="2" filter="url(#switchShadow)"/>
  <!-- Inner Bevel -->
  <rect x="55" y="25" width="90" height="150" rx="8" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>
  <!-- Switch Rocker Frame -->
  <rect x="70" y="55" width="60" height="90" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <!-- Rocker Button (Tecla) -->
  <rect x="74" y="60" width="52" height="80" rx="4" fill="url(#rockerGrad)" stroke="#94a3b8" stroke-width="1.5"/>
  <!-- Rocker Divider Groove & Indicator -->
  <line x1="74" y1="100" x2="126" y2="100" stroke="#cbd5e1" stroke-width="1.5"/>
  <circle cx="100" cy="78" r="3" fill="#0284c7" opacity="0.8"/>
  <!-- Spec Text -->
  <text x="100" y="158" font-family="system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#64748b" text-anchor="middle">10A · 250V~</text>
</svg>`,

  "box-4x2.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="yellowBox" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#facc15"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>
    <filter id="boxShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <!-- 4x2 Yellow PVC Junction Box -->
  <rect x="35" y="30" width="130" height="140" rx="14" fill="url(#yellowBox)" stroke="#a16207" stroke-width="2.5" filter="url(#boxShadow)"/>
  <!-- Inner Recess -->
  <rect x="47" y="42" width="106" height="116" rx="10" fill="#eab308" stroke="#854d0e" stroke-width="2"/>
  <!-- Screw fixing lugs top & bottom -->
  <rect x="85" y="32" width="30" height="14" rx="3" fill="#ca8a04" stroke="#854d0e" stroke-width="1"/>
  <circle cx="100" cy="39" r="3" fill="#334155"/>
  <rect x="85" y="154" width="30" height="14" rx="3" fill="#ca8a04" stroke="#854d0e" stroke-width="1"/>
  <circle cx="100" cy="161" r="3" fill="#334155"/>
  <!-- Conduit Knockout Holes (Destacáveis 1/2 e 3/4) -->
  <circle cx="68" cy="70" r="12" fill="none" stroke="#854d0e" stroke-width="1.8" stroke-dasharray="4 2"/>
  <circle cx="132" cy="70" r="12" fill="none" stroke="#854d0e" stroke-width="1.8" stroke-dasharray="4 2"/>
  <circle cx="68" cy="130" r="12" fill="none" stroke="#854d0e" stroke-width="1.8" stroke-dasharray="4 2"/>
  <circle cx="132" cy="130" r="12" fill="none" stroke="#854d0e" stroke-width="1.8" stroke-dasharray="4 2"/>
  <circle cx="100" cy="100" r="15" fill="none" stroke="#854d0e" stroke-width="2" stroke-dasharray="5 2.5"/>
  <!-- Branding / Type -->
  <text x="100" y="104" font-family="system-ui, sans-serif" font-size="10" font-weight="900" fill="#713f12" text-anchor="middle">4x2 PVC</text>
</svg>`,

  "conduit-flexible.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="yellowConduit" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>
    <filter id="conduitShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <!-- Outer Coil of Corrugated Conduit -->
  <circle cx="100" cy="100" r="75" fill="none" stroke="url(#yellowConduit)" stroke-width="26" filter="url(#conduitShadow)"/>
  <!-- Corrugation Ribs -->
  <circle cx="100" cy="100" r="75" fill="none" stroke="#a16207" stroke-width="26" stroke-dasharray="4 4"/>
  <!-- Inner Coil -->
  <circle cx="100" cy="100" r="48" fill="none" stroke="url(#yellowConduit)" stroke-width="22"/>
  <circle cx="100" cy="100" r="48" fill="none" stroke="#a16207" stroke-width="22" stroke-dasharray="4 4"/>
  <!-- Center Hole -->
  <circle cx="100" cy="100" r="32" fill="#ffffff"/>
  <!-- Label tag in center -->
  <text x="100" y="96" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#854d0e" text-anchor="middle">ELETRODUTO</text>
  <text x="100" y="108" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#a16207" text-anchor="middle">3/4" · DN 25</text>
  <text x="100" y="118" font-family="system-ui, sans-serif" font-size="7.5" font-weight="700" fill="#a16207" text-anchor="middle">Corrugado Flexível</text>
</svg>`,

  "conduit-fittings.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="pvcBlack" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <filter id="fittingShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <!-- Curva 90 Graus -->
  <path d="M40 140 L40 90 A 70 70 0 0 1 110 20 L160 20" fill="none" stroke="url(#pvcBlack)" stroke-width="28" stroke-linecap="square" filter="url(#fittingShadow)"/>
  <!-- Collar / Thread rings at ends -->
  <rect x="26" y="132" width="28" height="16" rx="2" fill="#334155" stroke="#64748b" stroke-width="1.5"/>
  <rect x="152" y="6" width="16" height="28" rx="2" fill="#334155" stroke="#64748b" stroke-width="1.5"/>
  <!-- Coupling Sleeve (Luva) beside it -->
  <g transform="translate(100, 95)" filter="url(#fittingShadow)">
    <rect x="10" y="10" width="60" height="36" rx="4" fill="url(#pvcBlack)" stroke="#475569" stroke-width="1.5"/>
    <line x1="40" y1="10" x2="40" y2="46" stroke="#64748b" stroke-width="2"/>
    <rect x="6" y="14" width="8" height="28" rx="1" fill="#334155"/>
    <rect x="66" y="14" width="8" height="28" rx="1" fill="#334155"/>
  </g>
  <text x="100" y="172" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#64748b" text-anchor="middle">Curva 90° &amp; Luvas 3/4"</text>
</svg>`,

  "fasteners-kit.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="plugGrey" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="50%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
    <linearGradient id="screwMetal" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="50%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <filter id="plugShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.15"/>
    </filter>
  </defs>
  <!-- Nylon Wall Plug (Bucha S6 / S8) -->
  <g transform="translate(30, 30) rotate(30)" filter="url(#plugShadow)">
    <path d="M10 0 L90 0 L100 8 L90 16 L10 16 Z" fill="url(#plugGrey)" stroke="#475569" stroke-width="1.5"/>
    <!-- Collar ring -->
    <rect x="5" y="-3" width="8" height="22" rx="2" fill="#64748b"/>
    <!-- Expansion Fins / Barbs -->
    <polygon points="35,0 45,-6 50,0" fill="#64748b"/>
    <polygon points="35,16 45,22 50,16" fill="#64748b"/>
    <polygon points="65,0 75,-6 80,0" fill="#64748b"/>
    <polygon points="65,16 75,22 80,16" fill="#64748b"/>
  </g>
  <!-- Galvanized Steel Screw (Parafuso Phillips) -->
  <g transform="translate(45, 95) rotate(-15)" filter="url(#plugShadow)">
    <!-- Screw Head -->
    <ellipse cx="15" cy="15" rx="8" ry="14" fill="#64748b" stroke="#334155" stroke-width="1.5"/>
    <line x1="15" y1="5" x2="15" y2="25" stroke="#0f172a" stroke-width="2.5"/>
    <!-- Screw Shank & Thread -->
    <rect x="23" y="9" width="80" height="12" fill="url(#screwMetal)" stroke="#475569" stroke-width="1.2"/>
    <!-- Threads -->
    <line x1="35" y1="8" x2="40" y2="22" stroke="#334155" stroke-width="2"/>
    <line x1="50" y1="8" x2="55" y2="22" stroke="#334155" stroke-width="2"/>
    <line x1="65" y1="8" x2="70" y2="22" stroke="#334155" stroke-width="2"/>
    <line x1="80" y1="8" x2="85" y2="22" stroke="#334155" stroke-width="2"/>
    <polygon points="103,9 118,15 103,21" fill="url(#screwMetal)" stroke="#475569" stroke-width="1.2"/>
  </g>
  <text x="100" y="172" font-family="system-ui, sans-serif" font-size="9" font-weight="800" fill="#475569" text-anchor="middle">Kit Buchas S6/S8 + Parafusos</text>
</svg>`,

  "tape-insulating.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="tapeBody" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <filter id="tapeShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.2"/>
    </filter>
  </defs>
  <!-- Roll of PVC Electrical Tape -->
  <circle cx="100" cy="100" r="70" fill="url(#tapeBody)" stroke="#475569" stroke-width="2" filter="url(#tapeShadow)"/>
  <circle cx="100" cy="100" r="35" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="100" cy="100" r="28" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
  <!-- Cardboard core label -->
  <text x="100" y="97" font-family="system-ui, sans-serif" font-size="9" font-weight="900" fill="#ef4444" text-anchor="middle">3M</text>
  <text x="100" y="108" font-family="system-ui, sans-serif" font-size="7" font-weight="800" fill="#0f172a" text-anchor="middle">IMPERIAL</text>
  <text x="100" y="117" font-family="system-ui, sans-serif" font-size="6" font-weight="700" fill="#64748b" text-anchor="middle">750V · Antichama</text>
</svg>`,

  "rack-telecom.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="rackGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <filter id="rackShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.2"/>
    </filter>
  </defs>
  <!-- 19 Inch Wall Rack Housing -->
  <rect x="35" y="25" width="130" height="150" rx="8" fill="url(#rackGrad)" stroke="#475569" stroke-width="2" filter="url(#rackShadow)"/>
  <!-- Acrylic / Glass Door with Bevel -->
  <rect x="47" y="37" width="106" height="126" rx="4" fill="#0284c7" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <!-- 19 Inch Mounting Rails -->
  <rect x="52" y="42" width="10" height="116" fill="#475569"/>
  <rect x="138" y="42" width="10" height="116" fill="#475569"/>
  <!-- 1U Equipment Slots -->
  <rect x="66" y="50" width="68" height="16" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
  <circle cx="72" cy="58" r="2" fill="#22c55e"/>
  <circle cx="78" cy="58" r="2" fill="#22c55e"/>
  <rect x="66" y="74" width="68" height="16" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
  <circle cx="72" cy="82" r="2" fill="#3b82f6"/>
  <rect x="66" y="98" width="68" height="16" rx="2" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
  <!-- Lock Keyhole -->
  <circle cx="146" cy="100" r="3" fill="#cbd5e1"/>
  <!-- Text -->
  <text x="100" y="140" font-family="system-ui, sans-serif" font-size="8.5" font-weight="900" fill="#94a3b8" text-anchor="middle">RACK 19" 6U</text>
</svg>`
};

const dir = path.resolve("public/products");
fs.mkdirSync(dir, { recursive: true });

for (const [filename, content] of Object.entries(products)) {
  fs.writeFileSync(path.join(dir, filename), content.trim());
  console.log(`✓ Generated ${filename}`);
}
