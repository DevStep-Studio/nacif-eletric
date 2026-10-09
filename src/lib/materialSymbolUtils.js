const normalize = (value = "") => (
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
);

export const getMaterialKind = (name = "") => {
  const term = normalize(name);
  if (term.includes("dps") || term.includes("surto")) return "dps";
  if (term.includes("dr") || term.includes("idr") || term.includes("diferencial")) return "dr";
  if (term.includes("disjuntor")) return "breaker";
  if (term.includes("cabo") || term.includes("fio")) return "cable";
  if (term.includes("eletroduto") || term.includes("condulete") || term.includes("curva") || term.includes("luva")) return "conduit";
  if (term.includes("quadro")) return "panel";
  if (term.includes("rack") || term.includes("cftv") || term.includes("dvr") || term.includes("nvr")) return "rack";
  if (term.includes("tomada")) return "outlet";
  if (term.includes("interruptor")) return "switch";
  if (term.includes("caixa")) return "box";
  if (term.includes("barramento")) return "busbar";
  if (term.includes("trilho")) return "rail";
  if (term.includes("borne") || term.includes("terminal") || term.includes("conector")) return "connector";
  return "accessory";
};

const palette = {
  breaker: ["#0F172A", "#E8FCF8", "#00d8b8"],
  dr: ["#7C3AED", "#F3E8FF", "#A855F7"],
  dps: ["#DC2626", "#FEF2F2", "#F87171"],
  cable: ["#111827", "#EEF2FF", "#2563EB"],
  conduit: ["#0F766E", "#ECFDF5", "#14B8A6"],
  panel: ["#475569", "#F8FAFC", "#94A3B8"],
  rack: ["#1D4ED8", "#EFF6FF", "#60A5FA"],
  outlet: ["#D97706", "#FFF7ED", "#FDBA74"],
  switch: ["#0891B2", "#ECFEFF", "#67E8F9"],
  box: ["#0F766E", "#ECFDF5", "#5EEAD4"],
  busbar: ["#B45309", "#FFFBEB", "#F59E0B"],
  rail: ["#64748B", "#F8FAFC", "#CBD5E1"],
  connector: ["#334155", "#F1F5F9", "#94A3B8"],
  accessory: ["#0F4F49", "#F2FFFC", "#00d8b8"],
};

export const getMaterialSymbolSvg = (name = "") => {
  const kind = getMaterialKind(name);
  const [stroke, fill, accent] = palette[kind] || palette.accessory;
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  const text = (value, y, size = 8) => `<text x="24" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size}" font-weight="800" fill="${stroke}">${value}</text>`;

  const body = {
    breaker: `
      <rect x="13" y="10" width="22" height="28" rx="4" ${common}/>
      <line x1="24" y1="10" x2="24" y2="17" stroke="${stroke}" stroke-width="2.2"/>
      <line x1="24" y1="31" x2="24" y2="38" stroke="${stroke}" stroke-width="2.2"/>
      <rect x="20" y="19" width="8" height="10" rx="2" fill="${accent}" stroke="${stroke}" stroke-width="1.6"/>
      ${text("DJ", 36, 7)}
    `,
    dr: `
      <rect x="11" y="10" width="26" height="28" rx="4" ${common}/>
      <path d="M18 19 C18 15 30 15 30 19 C30 23 18 23 18 27 C18 31 30 31 30 27" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="31" cy="16" r="2" fill="${stroke}"/>
      ${text("DR", 36, 7)}
    `,
    dps: `
      <polygon points="24,9 35,16 35,31 24,39 13,31 13,16" ${common}/>
      <path d="M25 15 L19 25 H24 L23 33 L29 23 H24 Z" fill="${accent}" stroke="${stroke}" stroke-width="1.2"/>
      ${text("DPS", 36, 6.5)}
    `,
    cable: `
      <path d="M10 24 C16 16 20 32 26 24 C32 16 36 32 40 24" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M10 24 C16 16 20 32 26 24 C32 16 36 32 40 24" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="10" cy="24" r="3" fill="${stroke}"/>
      <circle cx="40" cy="24" r="3" fill="${stroke}"/>
    `,
    conduit: `
      <rect x="10" y="15" width="28" height="18" rx="3" ${common}/>
      <line x1="16" y1="15" x2="16" y2="33" stroke="${stroke}" stroke-width="1.8"/>
      <line x1="22" y1="15" x2="22" y2="33" stroke="${accent}" stroke-width="1.8"/>
      <line x1="28" y1="15" x2="28" y2="33" stroke="${stroke}" stroke-width="1.8"/>
      <line x1="34" y1="15" x2="34" y2="33" stroke="${accent}" stroke-width="1.8"/>
    `,
    panel: `
      <rect x="10" y="10" width="28" height="28" rx="4" ${common}/>
      <line x1="10" y1="10" x2="38" y2="38" stroke="${stroke}" stroke-width="1.8"/>
      <polygon points="10,10 38,10 38,38" fill="${accent}" opacity="0.6"/>
      ${text("QD", 34, 7)}
    `,
    rack: `
      <rect x="10" y="10" width="28" height="28" rx="3" ${common}/>
      <line x1="10" y1="18" x2="38" y2="18" stroke="${stroke}" stroke-width="1.6"/>
      <line x1="10" y1="26" x2="38" y2="26" stroke="${stroke}" stroke-width="1.6"/>
      <circle cx="14" cy="14" r="1.5" fill="${accent}"/>
      <circle cx="14" cy="22" r="1.5" fill="${accent}"/>
      <circle cx="14" cy="30" r="1.5" fill="${accent}"/>
      ${text("RACK", 36, 6)}
    `,
    outlet: `
      <circle cx="24" cy="24" r="14" ${common}/>
      <path d="M16 24 H32 M24 16 V24" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
      <polygon points="24,10 34,24 24,24" fill="${accent}"/>
    `,
    switch: `
      <circle cx="24" cy="24" r="14" ${common}/>
      <line x1="14" y1="24" x2="34" y2="24" stroke="${stroke}" stroke-width="2.2"/>
      <line x1="24" y1="14" x2="34" y2="24" stroke="${accent}" stroke-width="2.2"/>
    `,
    box: `
      <rect x="12" y="12" width="24" height="24" rx="3" ${common}/>
      <line x1="12" y1="12" x2="36" y2="36" stroke="${stroke}" stroke-width="1.8"/>
      <line x1="36" y1="12" x2="12" y2="36" stroke="${accent}" stroke-width="1.8"/>
    `,
    busbar: `
      <rect x="9" y="20" width="30" height="8" rx="2" ${common}/>
      <line x1="14" y1="16" x2="14" y2="32" stroke="${stroke}" stroke-width="2"/>
      <line x1="20" y1="16" x2="20" y2="32" stroke="${accent}" stroke-width="2"/>
      <line x1="26" y1="16" x2="26" y2="32" stroke="${stroke}" stroke-width="2"/>
      <line x1="32" y1="16" x2="32" y2="32" stroke="${accent}" stroke-width="2"/>
    `,
    rail: `
      <rect x="9" y="18" width="30" height="12" rx="1.5" ${common}/>
      <line x1="14" y1="18" x2="14" y2="30" stroke="${accent}" stroke-width="1.7"/>
      <line x1="21" y1="18" x2="21" y2="30" stroke="${accent}" stroke-width="1.7"/>
      <line x1="28" y1="18" x2="28" y2="30" stroke="${accent}" stroke-width="1.7"/>
      <line x1="35" y1="18" x2="35" y2="30" stroke="${accent}" stroke-width="1.7"/>
    `,
    connector: `
      <rect x="11" y="16" width="26" height="16" rx="3" ${common}/>
      <line x1="7" y1="24" x2="15" y2="24" stroke="${stroke}" stroke-width="2.5"/>
      <line x1="33" y1="24" x2="41" y2="24" stroke="${stroke}" stroke-width="2.5"/>
      <circle cx="19" cy="24" r="2" fill="${accent}"/>
      <circle cx="29" cy="24" r="2" fill="${accent}"/>
    `,
    accessory: `
      <rect x="11" y="11" width="26" height="26" rx="5" ${common}/>
      <path d="M17 24 H31 M24 17 V31" stroke="${accent}" stroke-width="3"/>
    `,
  }[kind];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%">${body}</svg>`;
};

export const getMaterialSymbolDataUri = (name = "") => (
  `data:image/svg+xml;utf8,${encodeURIComponent(getMaterialSymbolSvg(name))}`
);
