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
      <rect x="14" y="7" width="20" height="34" rx="3" ${common}/>
      <rect x="18" y="11" width="12" height="7" rx="1.5" fill="${accent}" stroke="none"/>
      <line x1="19" y1="27" x2="29" y2="21" stroke="${stroke}" stroke-width="2.4"/>
      <circle cx="18" cy="34" r="1.7" fill="${stroke}"/>
      <circle cx="30" cy="34" r="1.7" fill="${stroke}"/>
    `,
    dr: `
      <rect x="13" y="7" width="22" height="34" rx="3" ${common}/>
      <circle cx="24" cy="17" r="5" fill="white" stroke="${accent}" stroke-width="2"/>
      <line x1="18" y1="29" x2="30" y2="29" stroke="${stroke}" stroke-width="2"/>
      ${text("DR", 38, 8)}
    `,
    dps: `
      <rect x="17" y="7" width="14" height="34" rx="4" ${common}/>
      <path d="M25 11 L20 25 H24 L22 37 L29 21 H25 Z" fill="${accent}" stroke="${stroke}" stroke-width="1.4"/>
    `,
    cable: `
      <path d="M9 30 C15 14, 33 14, 39 30" fill="none" stroke="${stroke}" stroke-width="5"/>
      <path d="M9 30 C15 14, 33 14, 39 30" fill="none" stroke="${accent}" stroke-width="2"/>
      <circle cx="9" cy="30" r="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="39" cy="30" r="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    `,
    conduit: `
      <path d="M8 28 C13 16, 35 16, 40 28" fill="none" stroke="${stroke}" stroke-width="4"/>
      <path d="M10 30 C16 39, 32 39, 38 30" fill="none" stroke="${accent}" stroke-width="4"/>
      <line x1="15" y1="19" x2="18" y2="27" stroke="${fill}" stroke-width="1.4"/>
      <line x1="24" y1="17" x2="24" y2="27" stroke="${fill}" stroke-width="1.4"/>
      <line x1="33" y1="20" x2="30" y2="28" stroke="${fill}" stroke-width="1.4"/>
    `,
    panel: `
      <rect x="10" y="8" width="28" height="32" rx="3" ${common}/>
      <rect x="15" y="14" width="18" height="5" rx="1" fill="${accent}" stroke="none"/>
      <line x1="16" y1="25" x2="32" y2="25" stroke="${stroke}" stroke-width="1.8"/>
      <line x1="16" y1="31" x2="32" y2="31" stroke="${stroke}" stroke-width="1.8"/>
      <circle cx="33" cy="36" r="1.6" fill="${stroke}"/>
    `,
    rack: `
      <rect x="9" y="9" width="30" height="30" rx="3" ${common}/>
      <rect x="14" y="14" width="20" height="4" rx="1" fill="${accent}" stroke="none"/>
      <rect x="14" y="22" width="20" height="4" rx="1" fill="white" stroke="${stroke}" stroke-width="1.4"/>
      <rect x="14" y="30" width="20" height="4" rx="1" fill="white" stroke="${stroke}" stroke-width="1.4"/>
      ${text("CFTV", 45, 6)}
    `,
    outlet: `
      <rect x="12" y="11" width="24" height="26" rx="5" ${common}/>
      <circle cx="20" cy="24" r="2.2" fill="${stroke}"/>
      <circle cx="28" cy="24" r="2.2" fill="${stroke}"/>
      <path d="M21 31 C23 33, 25 33, 27 31" fill="none" stroke="${accent}" stroke-width="2"/>
    `,
    switch: `
      <rect x="12" y="11" width="24" height="26" rx="4" ${common}/>
      <rect x="18" y="17" width="12" height="14" rx="2" fill="white" stroke="${stroke}" stroke-width="1.8"/>
      <line x1="20" y1="28" x2="29" y2="19" stroke="${accent}" stroke-width="2.4"/>
    `,
    box: `
      <rect x="10" y="10" width="28" height="28" rx="2.5" ${common}/>
      <path d="M16 16 L32 32 M32 16 L16 32" stroke="${accent}" stroke-width="2.3"/>
      <rect x="15" y="15" width="18" height="18" rx="2" fill="none" stroke="${stroke}" stroke-width="1.4" stroke-dasharray="4 3"/>
    `,
    busbar: `
      <rect x="8" y="18" width="32" height="12" rx="2" ${common}/>
      <circle cx="15" cy="24" r="2" fill="${accent}"/>
      <circle cx="24" cy="24" r="2" fill="${accent}"/>
      <circle cx="33" cy="24" r="2" fill="${accent}"/>
    `,
    rail: `
      <rect x="8" y="18" width="32" height="12" rx="1.5" ${common}/>
      <line x1="13" y1="18" x2="13" y2="30" stroke="${accent}" stroke-width="1.7"/>
      <line x1="20" y1="18" x2="20" y2="30" stroke="${accent}" stroke-width="1.7"/>
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

export default function MaterialSymbol({ name = "", className = "" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#CDEFE8] bg-white ${className}`}
      dangerouslySetInnerHTML={{ __html: getMaterialSymbolSvg(name) }}
      aria-hidden="true"
    />
  );
}
