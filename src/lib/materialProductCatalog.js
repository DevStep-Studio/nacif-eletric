import { getMaterialSymbolDataUri } from "./materialSymbolUtils.js";

const normalize = (value = "") => (
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
);

export const CATEGORY_STYLES = {
  protecao: {
    label: "PROTEÇÃO",
    badgeClass: "border-[#BCEEE5] bg-[#F2FFFC] text-[#004E82]",
    color: "#004E82",
  },
  cabos: {
    label: "CABOS",
    badgeClass: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
    color: "#1D4ED8",
  },
  quadro: {
    label: "QUADRO",
    badgeClass: "border-[#CBD5E1] bg-[#F8FAFC] text-[#334155]",
    color: "#334155",
  },
  conectores: {
    label: "CONECTORES",
    badgeClass: "border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9]",
    color: "#6D28D9",
  },
  infraestrutura: {
    label: "INFRAESTRUTURA",
    badgeClass: "border-[#CCFBF1] bg-[#F0FDFA] text-[#0F766E]",
    color: "#0F766E",
  },
  acabamentos: {
    label: "ACABAMENTOS",
    badgeClass: "border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]",
    color: "#C2410C",
  },
  consumiveis: {
    label: "CONSUMÍVEIS",
    badgeClass: "border-[#FEF08A] bg-[#FEFCE8] text-[#854D0E]",
    color: "#854D0E",
  },
  identificacao: {
    label: "IDENTIFICAÇÃO",
    badgeClass: "border-[#E2E8F0] bg-[#F1F5F9] text-[#475569]",
    color: "#475569",
  },
  telecom: {
    label: "TELECOM",
    badgeClass: "border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]",
    color: "#0369A1",
  },
  material: {
    label: "MATERIAL",
    badgeClass: "border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]",
    color: "#475569",
  },
};

export const PRODUCT_CATALOG_DEFAULTS = [
  {
    matcher: (term) => term.includes("disjuntor") && (term.includes("3p") || term.includes("tripolar") || term.includes("trifas")),
    imageUrl: "/products/breaker-3p.jpg",
    brand: "Schneider / WEG",
    specShort: "Curva C · 3P · 6kA · NBR NM 60898",
    categoryKey: "protecao",
  },
  {
    matcher: (term) => term.includes("disjuntor") && (term.includes("2p") || term.includes("bipolar") || term.includes("bifas")),
    imageUrl: "/products/breaker-2p.jpg",
    brand: "Siemens / WEG",
    specShort: "Curva C · 2P · 4.5kA · NBR NM 60898",
    categoryKey: "protecao",
  },
  {
    matcher: (term) => term.includes("disjuntor"),
    imageUrl: "/products/breaker-1p.jpg",
    brand: "WEG / Schneider",
    specShort: "Curva C · 1P · 4.5kA · NBR NM 60898",
    categoryKey: "protecao",
  },
  {
    matcher: (term) => (term.includes("dr") || term.includes("idr") || term.includes("diferencial")) && (term.includes("tetrapolar") || term.includes("4p") || term.includes("trifas")),
    imageUrl: "/products/idr-4p.svg",
    brand: "WEG / Schneider",
    specShort: "IDR Tetrapolar · 4P · 30mA · Classe AC",
    categoryKey: "protecao",
  },
  {
    matcher: (term) => term.includes("dr") || term.includes("idr") || term.includes("diferencial"),
    imageUrl: "/products/idr-2p.jpg",
    brand: "Schneider / WEG",
    specShort: "IDR Bipolar · 2P · 30mA · Classe AC",
    categoryKey: "protecao",
  },
  {
    matcher: (term) => term.includes("dps") || term.includes("surto"),
    imageUrl: "/products/dps.jpg",
    brand: "Clamper Front V",
    specShort: "Classe II · 1P · 20kA/45kA · 275V",
    categoryKey: "protecao",
  },
  {
    matcher: (term) => term.includes("cabo") || term.includes("fio") || term.includes("condutor"),
    imageUrl: "/products/cable.png",
    brand: "Cobrecom / Prysmian",
    specShort: "Cobre flexível 750V · Antichama BWF",
    categoryKey: "cabos",
  },
  {
    matcher: (term) => term.includes("quadro"),
    imageUrl: "/products/panel.jpg",
    brand: "Steck / Tigre",
    specShort: "Quadro DIN · IP40 · Porta fumê",
    categoryKey: "quadro",
  },
  {
    matcher: (term) => term.includes("trilho"),
    imageUrl: "/products/din-rail.jpg",
    brand: "Altex / Steck",
    specShort: "Trilho DIN 35x7.5mm zincado perfurado",
    categoryKey: "quadro",
  },
  {
    matcher: (term) => term.includes("barramento") && (term.includes("fase") || term.includes("pente")),
    imageUrl: "/products/busbar-phase.jpg",
    brand: "Legrand / Steck",
    specShort: "Barramento tipo pente cobre isolado 80A",
    categoryKey: "quadro",
  },
  {
    matcher: (term) => term.includes("barramento") && (term.includes("neutro") || term.includes("terra")),
    imageUrl: "/products/busbar-neutral.jpg",
    brand: "Steck",
    specShort: "Barramento neutro/terra c/ base isolada",
    categoryKey: "quadro",
  },
  {
    matcher: (term) => term.includes("wago") || term.includes("emenda"),
    imageUrl: "/products/connector-wago.svg",
    brand: "WAGO 221",
    specShort: "Conector alavanca 3 vias · 32A 450V",
    categoryKey: "conectores",
  },
  {
    matcher: (term) => term.includes("borne") || term.includes("sak"),
    imageUrl: "/products/terminal-block.jpg",
    brand: "Phoenix / Weidmüller",
    specShort: "Borne de passagem parafuso trilho DIN",
    categoryKey: "conectores",
  },
  {
    matcher: (term) => term.includes("terminal") && (term.includes("tubular") || term.includes("ilhos")),
    imageUrl: "/products/terminal-ferrule.svg",
    brand: "HellermannTyton",
    specShort: "Terminal tubular ilhós cobre estanhado",
    categoryKey: "conectores",
  },
  {
    matcher: (term) => term.includes("terminal") && (term.includes("olhal") || term.includes("garfo")),
    imageUrl: "/products/terminal-lug.svg",
    brand: "Magnet / Hellermann",
    specShort: "Terminal olhal/garfo pré-isolado M5",
    categoryKey: "conectores",
  },
  {
    matcher: (term) => term.includes("tomada"),
    imageUrl: "/products/outlet-10a.svg",
    brand: "WEG / Tramontina",
    specShort: "Tomada 2P+T NBR 14136 com placa",
    categoryKey: "acabamentos",
  },
  {
    matcher: (term) => term.includes("interruptor"),
    imageUrl: "/products/switch-simple.svg",
    brand: "Tramontina Liz / Pial",
    specShort: "Interruptor modular 10A 250V~ com placa",
    categoryKey: "acabamentos",
  },
  {
    matcher: (term) => term.includes("caixa") && (term.includes("4x2") || term.includes("4x4") || term.includes("luz")),
    imageUrl: "/products/box-4x2.svg",
    brand: "Tigre / Tramontina",
    specShort: "Caixa PVC embutir c/ orelhas reforçadas",
    categoryKey: "infraestrutura",
  },
  {
    matcher: (term) => term.includes("eletroduto"),
    imageUrl: "/products/conduit-flexible.svg",
    brand: "Tigre / Kanaflex",
    specShort: "Eletroduto corrugado flexível PVC",
    categoryKey: "infraestrutura",
  },
  {
    matcher: (term) => term.includes("curva") || term.includes("luva") || term.includes("bucha e arruela"),
    imageUrl: "/products/conduit-fittings.svg",
    brand: "Tigre",
    specShort: "Conexões em PVC rosqueável / soldável",
    categoryKey: "infraestrutura",
  },
  {
    matcher: (term) => term.includes("parafuso") || term.includes("bucha") || term.includes("fixador"),
    imageUrl: "/products/fasteners-kit.svg",
    brand: "Fischer / Âncora",
    specShort: "Kit buchas nylon S6/S8 e parafusos",
    categoryKey: "consumiveis",
  },
  {
    matcher: (term) => term.includes("fita isolante"),
    imageUrl: "/products/tape-insulating.svg",
    brand: "3M Imperial",
    specShort: "Fita isolante antichama 750V 18mmx20m",
    categoryKey: "consumiveis",
  },
  {
    matcher: (term) => term.includes("anilha") || term.includes("etiqueta") || term.includes("identifica"),
    imageUrl: "/products/wire-markers.jpg",
    brand: "HellermannTyton",
    specShort: "Marcadores anilha para cabos e bornes",
    categoryKey: "identificacao",
  },
  {
    matcher: (term) => term.includes("rack") || term.includes("cftv") || term.includes("telecom"),
    imageUrl: "/products/rack-telecom.svg",
    brand: "Intelbras / Max Eletron",
    specShort: "Rack parede 19 polegadas 6U",
    categoryKey: "telecom",
  },
];

export function getMaterialProductInfo(materialOrName) {
  const isObject = typeof materialOrName === "object" && materialOrName !== null;
  const rawName = isObject ? materialOrName.name || "" : String(materialOrName || "");
  const term = normalize(rawName);
  const explicitImage = isObject ? (materialOrName.image || materialOrName.imageUrl || materialOrName.thumbnail || materialOrName.photo) : null;
  const explicitBrand = isObject ? (materialOrName.brand || materialOrName.manufacturer) : null;
  const explicitCategory = isObject ? materialOrName.category : null;

  const catalogEntry = PRODUCT_CATALOG_DEFAULTS.find((entry) => entry.matcher(term)) || {
    imageUrl: "/products/breaker-1p.jpg",
    brand: "Base de fornecedores",
    specShort: "Material elétrico padronizado NBR 5410",
    categoryKey: "material",
  };

  const categoryKey = normalize(explicitCategory) || catalogEntry.categoryKey;
  const categoryConfig = CATEGORY_STYLES[categoryKey] || CATEGORY_STYLES.material;

  return {
    name: rawName,
    imageUrl: explicitImage || catalogEntry.imageUrl,
    brand: explicitBrand || catalogEntry.brand,
    specShort: catalogEntry.specShort,
    categoryKey,
    categoryLabel: categoryConfig.label,
    badgeClass: categoryConfig.badgeClass,
    badgeColor: categoryConfig.color,
  };
}

export function getMaterialDataUriForPrint(materialOrName) {
  const info = getMaterialProductInfo(materialOrName);
  if (info.imageUrl && (info.imageUrl.startsWith("data:") || info.imageUrl.startsWith("http"))) {
    return info.imageUrl;
  }
  // For relative paths like /products/..., provide the reliable SVG data URI as 100% self-contained print asset
  return getMaterialSymbolDataUri(info.name);
}
