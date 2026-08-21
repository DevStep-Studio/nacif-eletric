/**
 * Simbologia tecnica para plantas eletricas.
 * Mantem uma unica fonte visual para paletas, canvas Konva e futuras telas de planta.
 */

export const CATEGORY_STYLES = {
  tomadas: {
    color: "#00d8b8",
    soft: "#DBEAFE",
    surface: "#F3F7FF",
    border: "#93C5FD",
    text: "#1E3A8A",
  },
  comando: {
    color: "#7C3AED",
    soft: "#EDE9FE",
    surface: "#F8F5FF",
    border: "#C4B5FD",
    text: "#4C1D95",
  },
  iluminacao: {
    color: "#D97706",
    soft: "#FEF3C7",
    surface: "#FFFBEB",
    border: "#FCD34D",
    text: "#78350F",
  },
  forca: {
    color: "#DC2626",
    soft: "#FEE2E2",
    surface: "#FFF5F5",
    border: "#FCA5A5",
    text: "#7F1D1D",
  },
  infra: {
    color: "#059669",
    soft: "#D1FAE5",
    surface: "#F0FDF4",
    border: "#86EFAC",
    text: "#064E3B",
  },
  extra: {
    color: "#0891B2",
    soft: "#CFFAFE",
    surface: "#ECFEFF",
    border: "#67E8F9",
    text: "#164E63",
  },
};

const colorFor = (category) => CATEGORY_STYLES[category]?.color || "#050505";

export const TOOL_TYPES = [
  { id: "arandela",    label: "Arandela",                 color: colorFor("iluminacao"), category: "iluminacao" },
  { id: "spot",        label: "Luz fluorescente no teto", color: colorFor("iluminacao"), category: "iluminacao" },
  { id: "luminaria",   label: "Luz incandescente no teto",color: colorFor("iluminacao"), category: "iluminacao" },
  { id: "interruptor", label: "Interruptor 1 seção",      color: colorFor("comando"), category: "comando" },
  { id: "inter2",      label: "Interruptor 2 seções",     color: colorFor("comando"), category: "comando" },
  { id: "inter3",      label: "Interruptor 3 seções",     color: colorFor("comando"), category: "comando" },
  { id: "inter3way",   label: "Interruptor paralelo",     color: colorFor("comando"), category: "comando" },
  { id: "tue",         label: "Tomada média 130 cm",      color: colorFor("tomadas"), category: "tomadas" },
  { id: "arcond",      label: "Ar condicionado",          color: colorFor("forca"), category: "forca" },
  { id: "tug",         label: "Tomada baixa 30 cm",       color: colorFor("tomadas"), category: "tomadas" },
  { id: "chuveiro",    label: "Tomada para chuveiro",     color: colorFor("forca"), category: "forca" },
  { id: "qgbt",        label: "QGBT - Quadro geral",      color: colorFor("infra"), category: "infra" },
  { id: "qe",          label: "Quadro de distribuição",   color: colorFor("infra"), category: "infra" },
  { id: "caixa",       label: "Cx. passagem 4x4",         color: colorFor("infra"), category: "infra" },
  { id: "rack-cftv",   label: "Rack CFTV",                color: "#2563EB", category: "extra" },
  { id: "rede",        label: "Telefone/dados 300 mm",    color: colorFor("extra"), category: "extra" },
  { id: "motor",       label: "Motor / força motriz",     color: colorFor("forca"), category: "forca" },
  { id: "sensor",      label: "WIFI",                     color: colorFor("extra"), category: "extra" },
  { id: "camera",      label: "Câmera CFTV",              color: colorFor("extra"), category: "extra" },
];

export const CATEGORY_LABELS = {
  tomadas:    "Tomadas",
  comando:    "Interruptores",
  iluminacao: "Iluminação",
  forca:      "Força / TUE",
  infra:      "Infraestrutura",
  extra:      "Tecnologia",
};

export const PLANT_SYMBOL_LABELS = {
  arandela: "Arandela",
  spot: "Ponto de luz fluorescente no teto",
  luminaria: "Ponto de luz incandescente no teto",
  inter2: "Interruptor de duas seções",
  inter3: "Interruptor de três seções",
  interruptor: "Interruptor de uma seção",
  inter3way: "Interruptor paralelo (Three-Way)",
  tue: "Tomada 130cm",
  arcond: "Ar condicionado",
  tug: "Tomada baixa 30cm",
  chuveiro: "Tomada para chuveiro",
  qgbt: "QGBT - Quadro geral de baixa tensão",
  qe: "Quadro de distribuição",
  caixa: "Cx. de Passagem em chapa 4x4",
  "rack-cftv": "Rack CFTV",
  rede: "Tomada para telefone a 300mm do piso",
  motor: "Motor / força motriz",
  sensor: "WIFI",
  camera: "Câmera CFTV",
};

export const CONDUIT_SYMBOLS = [
  { id: "embutido", label: "Eletroduto embutido no teto ou na alvenaria", dash: "solid" },
  { id: "piso", label: "Eletroduto no piso", dash: "dashed" },
  { id: "externa", label: "Eletroduto sobre o teto (externa)", dash: "dashdot" },
  { id: "nfr", label: "Neutro, Fase, Retorno", dash: "ticks" },
];

const lineProps = (color, width = 5) => ({
  stroke: color,
  strokeWidth: width,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
});

export function ElectricalSymbol({ type, size = 24, color = "#050505" }) {
  const c = color || "#050505";
  const s = 100;
  const common = lineProps(c);
  const thin = lineProps(c, 4);

  const symbols = {
    arandela: (
      <g>
        <line x1="34" y1="26" x2="34" y2="74" {...common} />
        <path d="M34 36 A18 18 0 0 1 34 64" {...common} />
        <line x1="22" y1="50" x2="34" y2="50" {...thin} />
      </g>
    ),
    spot: (
      <g>
        <rect x="20" y="30" width="60" height="40" fill="white" stroke={c} strokeWidth="5" />
        <circle cx="50" cy="50" r="17" fill="white" stroke={c} strokeWidth="4" />
      </g>
    ),
    luminaria: (
      <circle cx="50" cy="50" r="22" fill="white" stroke={c} strokeWidth="5" />
    ),
    interruptor: (
      <circle cx="50" cy="50" r="19" fill="white" stroke={c} strokeWidth="5" />
    ),
    inter2: (
      <g>
        <circle cx="50" cy="50" r="19" fill="white" stroke={c} strokeWidth="5" />
        <line x1="32" y1="50" x2="68" y2="50" {...thin} />
      </g>
    ),
    inter3: (
      <g>
        <circle cx="50" cy="50" r="19" fill="white" stroke={c} strokeWidth="5" />
        <line x1="37" y1="37" x2="63" y2="63" {...thin} />
        <line x1="63" y1="37" x2="37" y2="63" {...thin} />
      </g>
    ),
    inter3way: (
      <g>
        <circle cx="50" cy="50" r="19" fill={c} stroke={c} strokeWidth="5" />
        <line x1="35" y1="50" x2="65" y2="50" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </g>
    ),
    tue: (
      <g>
        <line x1="18" y1="50" x2="40" y2="50" {...common} />
        <path d="M40 36 L76 50 L40 64 Z" fill="white" stroke={c} strokeWidth="5" strokeLinejoin="round" />
      </g>
    ),
    arcond: (
      <g>
        <rect x="18" y="28" width="64" height="34" rx="7" fill="white" stroke={c} strokeWidth="5" />
        <line x1="26" y1="50" x2="74" y2="50" {...thin} />
        <path d="M30 62 C38 74 44 74 50 62" {...thin} />
        <path d="M50 62 C58 74 64 74 70 62" {...thin} />
        <circle cx="68" cy="40" r="4" fill={c} />
      </g>
    ),
    tug: (
      <g>
        <line x1="18" y1="50" x2="38" y2="50" {...thin} />
        <path d="M38 38 L72 50 L38 62 Z" fill="white" stroke={c} strokeWidth="4.5" strokeLinejoin="round" />
      </g>
    ),
    chuveiro: (
      <g>
        <path d="M26 35 L74 50 L26 65 Z" fill="white" stroke={c} strokeWidth="5" strokeLinejoin="round" />
        <circle cx="43" cy="50" r="8" fill="white" stroke={c} strokeWidth="3.5" />
      </g>
    ),
    qgbt: (
      <g>
        <rect x="20" y="30" width="60" height="42" fill="white" stroke={c} strokeWidth="5" />
        <path d="M20 72 L80 30 L80 72 Z" fill={c} />
        <text x="50" y="22" fill={c} fontSize="19" textAnchor="middle" fontWeight="900">QGBT</text>
      </g>
    ),
    qe: (
      <g>
        <rect x="20" y="28" width="60" height="44" fill="white" stroke={c} strokeWidth="5" />
        <path d="M20 72 L80 28 L80 72 Z" fill={c} />
      </g>
    ),
    caixa: (
      <g>
        <rect x="28" y="28" width="44" height="44" fill="white" stroke={c} strokeWidth="5" />
        <line x1="28" y1="28" x2="72" y2="72" {...thin} />
        <line x1="72" y1="28" x2="28" y2="72" {...thin} />
      </g>
    ),
    "rack-cftv": (
      <g>
        <rect x="22" y="28" width="56" height="44" fill="white" stroke={c} strokeWidth="5" />
        <path d="M22 72 L78 28 L78 72 Z" fill={c} />
        <text x="50" y="23" fill={c} fontSize="15" textAnchor="middle" fontWeight="900">CFTV</text>
      </g>
    ),
    rede: (
      <g>
        <line x1="26" y1="26" x2="26" y2="74" {...common} />
        <path d="M26 34 L72 50 L26 66 Z" fill={c} stroke={c} strokeWidth="4" strokeLinejoin="round" />
      </g>
    ),
    motor: (
      <g>
        <circle cx="50" cy="50" r="24" fill="white" stroke={c} strokeWidth="5" />
        <text x="50" y="58" fill={c} fontSize="26" textAnchor="middle" fontWeight="700">M</text>
      </g>
    ),
    sensor: (
      <g>
        <path d="M25 58 A25 25 0 0 1 75 58" {...common} />
        <circle cx="50" cy="58" r="9" fill={c} />
      </g>
    ),
    camera: (
      <g>
        <rect x="22" y="38" width="38" height="24" fill="white" stroke={c} strokeWidth="5" />
        <path d="M60 40 L80 32 L80 68 L60 60 Z" fill="white" stroke={c} strokeWidth="4" />
      </g>
    ),
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${s} ${s}`} style={{ display: "block", overflow: "visible" }} aria-hidden="true">
      {symbols[type] || symbols.tug}
    </svg>
  );
}
