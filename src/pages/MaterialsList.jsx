import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Filter,
  ImageIcon,
  Package,
  Printer,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingDown,
  Upload,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { openHTMLPrint, PAPER_SIZES } from "@/lib/printUtils";
import { DEFAULT_LOGO_URL } from "@/lib/brandingDefaults";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/PageHeader";
import { buildProjectBudgetMaterials } from "@/lib/projectBudgetMaterials";
import MaterialSymbol from "@/components/MaterialSymbol";

const SUPPLIERS = [
  {
    name: "Loja do Eletricista",
    type: "Especializada",
    badge: "melhor mix técnico",
    searchBase: "https://www.google.com/search?tbm=shop&q=",
    multipliers: { protection: 0.94, cable: 1.02, panel: 0.98, accessory: 0.96, default: 0.97 },
  },
  {
    name: "Mercado Livre",
    type: "Marketplace",
    badge: "menor preço frequente",
    searchBase: "https://lista.mercadolivre.com.br/",
    multipliers: { protection: 0.91, cable: 0.97, panel: 1.03, accessory: 0.92, default: 0.95 },
  },
  {
    name: "Leroy Merlin",
    type: "Varejo técnico",
    badge: "retirada rápida",
    searchBase: "https://www.google.com/search?q=site%3Aleroymerlin.com.br+",
    multipliers: { protection: 1.03, cable: 0.99, panel: 0.95, accessory: 1.02, default: 1.01 },
  },
  {
    name: "Amazon Brasil",
    type: "Marketplace",
    badge: "entrega rápida",
    searchBase: "https://www.amazon.com.br/s?k=",
    multipliers: { protection: 0.98, cable: 1.08, panel: 1.02, accessory: 0.94, default: 1.0 },
  },
  {
    name: "Distribuidor local",
    type: "Atacado",
    badge: "melhor para volume",
    searchBase: "https://www.google.com/search?q=distribuidor+material+eletrico+",
    multipliers: { protection: 0.96, cable: 0.93, panel: 0.97, accessory: 0.95, default: 0.96 },
  },
];

const PRODUCT_IMAGE_URLS = {
  breaker: [
    "https://zennyt.com.br/wp-content/uploads/2025/04/mini_disjuntor_weg_unipolar_16a_curva_c_mdw_c16_5291_1_b83d06e37dabf8827df140ca9ebcab4f.jpg",
  ],
  dr: [
    "https://el12.com/zdjecia/residual-current-device-iid-2p-25a-30ma,p94293,w400_m.webp",
  ],
  dps: [
    "https://i.shopar.openk.com.br/protetor_de_surto_dps_classe_ii_1p_20ka_275v_clamper_16235_plug_in_front_v_vermelho_21532_38290.jpg",
    "https://cdn.awsli.com.br/800x800/2780/2780585/produto/318575198/clamper--4--6a3ro94drj.jpg",
  ],
  cable: [
    "https://images.tcdn.com.br/img/img_prod/1223709/1690997268_design_sem_nome_5.png",
    "https://images.tcdn.com.br/img/img_prod/1061963/cabo_flexivel_750v_6_0mm_cores_rolo_com_100_metros_cobrecom_743_1_7126131d38bc4e0dcc93786f4a526376.png",
  ],
  panel: [
    "https://images.tcdn.com.br/img/img_prod/1061963/quadro_de_distribuicao_de_sobrepor_para_12_disjuntores_din_pvc_porta_opaca_steck_911_1_7f1f8dbea4c6c71931a80104efd459d1.jpg",
  ],
  rail: [
    "https://altex.com/cdn/shop/files/altex-preferred-mfg-din-rail-1m-35mm-x-75mm-slotted-aluminum-din-rail-564798.jpg",
  ],
  terminal: [
    "https://www.classicautomation.com/media/catalog/product/cache/6517c62f5899ad6aa0ba23ceb3eeff97/u/k/uk-10.jpg",
  ],
  busbarPhase: [
    "https://5df841b7b6204c6b.cdn.gocache.net/images/1738202/master_barramento-pente-bifasico-para-disjuntor-80a-6-polos-legrand-928028-116623ec..jpg",
  ],
  busbarNeutral: [
    "https://www.abastece.com.br/cdn/shop/products/barramento_neutro_6_terminais_azul_sbn6_steck_89869346_0001_600x600_b3fbe835-dee6-4ec0-b538-8530a0b27303.jpg",
  ],
  label: [
    "https://images.salsify.com/image/upload/s--6zSy4KGG--/e_trim/w_1190,h_1190,c_pad/bo_5px_solid_white/73a1d004f0d0ca77ef71a1bdf5ace89f476dc122.jpg",
  ],
};

const formatCurrency = (value) => (value || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatQty = (qty) => Number.isInteger(qty) ? qty : qty.toFixed(1);

const hashString = (value) => String(value).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

function materialCategory(name) {
  const lower = name.toLowerCase();
  if (lower.includes("disjuntor") || lower.includes("dr") || lower.includes("dps")) return "protection";
  if (lower.includes("cabo")) return "cable";
  if (lower.includes("quadro") || lower.includes("trilho") || lower.includes("rack")) return "panel";
  return "accessory";
}

function materialUnit(name) {
  if (name.includes("(m)")) return "m";
  return "un.";
}

function buildSearchUrl(supplier, material) {
  const query = `${material.name} ${material.brand || ""} ${material.code || ""}`.trim();
  return `${supplier.searchBase}${encodeURIComponent(query)}`;
}

function googleImagesUrl(material) {
  const query = `${material.name} ${material.brand || ""} ${material.code || ""} material elétrico produto`.trim();
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}

function googleShoppingUrl(material) {
  const query = `${material.name} ${material.brand || ""} ${material.code || ""}`.trim();
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

function productImageCandidates(material) {
  const lower = material.name.toLowerCase();

  if (lower.includes("dps")) return PRODUCT_IMAGE_URLS.dps;
  if (lower.includes("dr 30ma")) return PRODUCT_IMAGE_URLS.dr;
  if (lower.includes("disjuntor")) return PRODUCT_IMAGE_URLS.breaker;
  if (lower.includes("cabo")) return PRODUCT_IMAGE_URLS.cable;
  if (lower.includes("trilho")) return PRODUCT_IMAGE_URLS.rail;
  if (lower.includes("barramento fase")) return PRODUCT_IMAGE_URLS.busbarPhase;
  if (lower.includes("barramento neutro")) return PRODUCT_IMAGE_URLS.busbarNeutral;
  if (lower.includes("quadro") || lower.includes("rack")) return PRODUCT_IMAGE_URLS.panel;
  if (lower.includes("borne")) return PRODUCT_IMAGE_URLS.terminal;
  if (lower.includes("etiqueta")) return PRODUCT_IMAGE_URLS.label;

  return [];
}

function supplierOffers(material) {
  const category = materialCategory(material.name);
  const seed = hashString(`${material.name}${material.code}`);

  return SUPPLIERS.map((supplier, index) => {
    const multiplier = supplier.multipliers[category] || supplier.multipliers.default;
    const variation = ((seed + index * 7) % 9 - 4) / 100;
    const volumeDiscount = material.qty >= 10 ? 0.96 : material.qty >= 3 ? 0.98 : 1;
    const unit = Math.max(0.5, (material.price || 0) * multiplier * volumeDiscount * (1 + variation));
    const unitPrice = Math.round(unit * 100) / 100;

    return {
      supplier: supplier.name,
      type: supplier.type,
      badge: supplier.badge,
      unitPrice,
      total: Math.round(unitPrice * material.qty * 100) / 100,
      url: buildSearchUrl(supplier, material),
    };
  }).sort((a, b) => a.unitPrice - b.unitPrice);
}

function materialReferenceCode(material) {
  const explicit = material.code || material.sku || material.reference;
  if (explicit) return explicit;
  const prefix = materialCategory(material.name).slice(0, 3).toUpperCase();
  return `${prefix}-${String(hashString(material.name) % 10000).padStart(4, "0")}`;
}

function enrichMaterial(material) {
  const normalized = {
    ...material,
    brand: material.brand || material.manufacturer || "Base do orçamento",
    code: materialReferenceCode(material),
    category: materialCategory(material.name),
    unit: material.unit || materialUnit(material.name),
  };
  const offers = supplierOffers(normalized);
  return {
    ...normalized,
    offers,
    bestOffer: offers[0],
    referenceTotal: Math.round(normalized.qty * (normalized.price || 0) * 100) / 100,
  };
}

function buildMaterials(project) {
  return buildProjectBudgetMaterials(project).materials.map(enrichMaterial);
}

function buildAiRecommendation(materials) {
  const referenceTotal = materials.reduce((sum, item) => sum + item.referenceTotal, 0);
  const mixedTotal = materials.reduce((sum, item) => sum + item.bestOffer.total, 0);
  const supplierTotals = SUPPLIERS.map((supplier) => {
    const total = materials.reduce((sum, item) => {
      const offer = item.offers.find((entry) => entry.supplier === supplier.name);
      return sum + (offer?.total || item.referenceTotal);
    }, 0);
    return { ...supplier, total: Math.round(total * 100) / 100 };
  }).sort((a, b) => a.total - b.total);
  const bestSingleSupplier = supplierTotals[0];
  const mixedSaving = Math.max(0, referenceTotal - mixedTotal);
  const singleSaving = Math.max(0, referenceTotal - bestSingleSupplier.total);
  const useSingleSupplier = (bestSingleSupplier.total - mixedTotal) / Math.max(mixedTotal, 1) <= 0.06;

  const topSavings = [...materials]
    .map((item) => ({
      name: item.name,
      saving: Math.max(0, item.referenceTotal - item.bestOffer.total),
      supplier: item.bestOffer.supplier,
    }))
    .sort((a, b) => b.saving - a.saving)
    .slice(0, 3);

  return {
    referenceTotal,
    mixedTotal: Math.round(mixedTotal * 100) / 100,
    mixedSaving: Math.round(mixedSaving * 100) / 100,
    bestSingleSupplier,
    singleSaving: Math.round(singleSaving * 100) / 100,
    supplierTotals,
    topSavings,
    strategy: useSingleSupplier
      ? `Comprar tudo em ${bestSingleSupplier.name} reduz frete e simplifica a entrega.`
      : "Comprar por menor preço item a item traz a maior economia estimada.",
    note: "Preços estimados por inteligência de cotação. Confirme estoque, frete, impostos e modelo exato antes de comprar.",
  };
}

function CategoryBadge({ category }) {
  const labels = {
    protection: "Proteção",
    cable: "Cabos",
    panel: "Quadro",
    accessory: "Acessório",
  };

  return <Badge variant="outline" className="rounded-[10px] border-[#BCEEE5] bg-[#F2FFFC] px-3 py-1 text-[#004E82]">{labels[category]}</Badge>;
}

function MaterialPhoto({ material, variant = "compact" }) {
  const [imageIndex, setImageIndex] = useState(0);
  const imageCandidates = productImageCandidates(material);
  const currentImage = imageCandidates[imageIndex];
  const googleUrl = googleImagesUrl(material);
  const sizeClass = variant === "expanded"
    ? "h-28 w-full sm:h-[118px] lg:h-[118px] lg:w-[118px]"
    : "h-[88px] w-full sm:h-24 lg:h-[88px] lg:w-[88px] xl:h-24 xl:w-24";

  return (
    <a
      href={googleUrl}
      target="_blank"
      rel="noreferrer"
      className={`group relative flex shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#d9d9d9] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${sizeClass}`}
      title={`Buscar ${material.name} no Google Imagens`}
    >
      {currentImage ? (
        <img
          src={currentImage}
          alt={material.name}
          className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105"
          loading="lazy"
          onError={() => setImageIndex((value) => value + 1)}
        />
      ) : (
        <MaterialSymbol name={material.name} className="h-full w-full rounded-none border-0 bg-transparent" />
      )}
      <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#BCEEE5] bg-white/95 text-[#004E82] opacity-0 shadow-sm transition group-hover:opacity-100">
        <ExternalLink className="h-3.5 w-3.5" />
      </span>
    </a>
  );
}

function MaterialProductCard({ material }) {
  const [expanded, setExpanded] = useState(false);
  const bestOffer = material.bestOffer;
  const savingValue = Math.max(0, material.referenceTotal - bestOffer.total);

  if (!expanded) {
    return (
      <article className="rounded-[18px] border border-[#e7e2d6] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)] transition hover:border-primary/30 hover:shadow-[0_16px_38px_rgba(15,23,42,0.055)] sm:p-5">
        <div className="grid min-w-0 gap-4 sm:grid-cols-[96px_minmax(0,1fr)] lg:grid-cols-[96px_minmax(0,1fr)_260px] lg:items-center">
          <MaterialPhoto material={material} />

          <div className="min-w-0 lg:pr-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <CategoryBadge category={material.category} />
              <span className="truncate rounded-[10px] bg-[#f4f4f5] px-2.5 py-1 text-xs font-bold text-[#6b7280]">
                {material.code}
              </span>
            </div>
            <h3 className="mt-3 truncate text-lg font-extrabold text-[#111827] sm:text-xl">{material.name}</h3>
            <p className="mt-1 truncate text-sm font-semibold text-[#6b7280]">{material.brand}</p>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[#eee9dd] pt-4 sm:col-span-2 lg:col-span-1 lg:border-t-0 lg:pt-0 lg:text-right">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#7a8495]">melhor preço</p>
              <p className="mt-1 text-xl font-extrabold text-primary sm:text-2xl">{formatCurrency(bestOffer.total)}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[#6b7280]">{bestOffer.supplier}</p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[12px] border border-[#CDEFE8] bg-white px-5 text-sm font-extrabold text-[#111827] transition hover:bg-[#F2FFFC]"
            >
              Detalhes
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-[18px] border border-[#dedede] bg-white shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 p-4">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[118px_minmax(0,1fr)]">
            <MaterialPhoto material={material} variant="expanded" />

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CategoryBadge category={material.category} />
                <span className="rounded-[10px] bg-[#f0f0f1] px-3 py-1 text-sm font-bold text-[#666d78]">
                  {material.code}
                </span>
              </div>

              <h3 className="mt-3 truncate text-xl font-extrabold leading-tight tracking-[-0.01em] text-[#111827] sm:text-2xl">
                {material.name}
              </h3>
              <p className="mt-1 truncate text-base font-bold text-[#5f6877]">
                {material.brand}
              </p>

              <div className="mt-4 grid border-y border-[#e5e5e5] py-3 sm:grid-cols-3">
                <div className="px-1 sm:px-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#737b8a]">Qtd.</p>
                  <p className="mt-1 text-base font-extrabold text-[#111827]">{formatQty(material.qty)} {material.unit}</p>
                </div>
                <div className="mt-2 border-[#e5e5e5] px-1 sm:mt-0 sm:border-l sm:px-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#737b8a]">Unit. base</p>
                  <p className="mt-1 text-base font-extrabold text-[#111827]">{formatCurrency(material.price)}</p>
                </div>
                <div className="mt-2 border-[#e5e5e5] px-1 sm:mt-0 sm:border-l sm:px-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#737b8a]">Economia</p>
                  <p className="mt-1 text-base font-extrabold text-primary">{formatCurrency(savingValue)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[12px] border border-[#e5e1d8]">
            {material.offers.slice(0, 3).map((offer, index) => (
              <a
                key={offer.supplier}
                href={offer.url}
                target="_blank"
                rel="noreferrer"
                className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e7e4dd] px-3 py-2.5 last:border-b-0 ${
                  index === 0 ? "bg-[#F2FFFC]" : "bg-white hover:bg-[#F2FFFC]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-sm font-extrabold text-[#111827] sm:text-base">{offer.supplier}</span>
                  {index === 0 && (
                    <span className="hidden rounded-[9px] border border-[#BCEEE5] bg-white/70 px-2.5 py-0.5 text-xs font-bold text-[#0f4f49] sm:inline">
                      menor preço
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-extrabold text-[#111827] sm:text-base">{formatCurrency(offer.unitPrice)}</span>
              </a>
            ))}
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3 text-sm font-medium text-[#6b7280]">
            <a href={googleImagesUrl(material)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 transition hover:text-[#111827]">
              <ImageIcon className="h-4 w-4" />
              Imagens
            </a>
            <span className="hidden h-5 w-px bg-[#dddddd] sm:block" />
            <a href={googleShoppingUrl(material)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 transition hover:text-[#111827]">
              <Search className="h-4 w-4" />
              Shopping
            </a>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="ml-auto inline-flex items-center gap-2 rounded-[10px] px-3 py-1 text-sm font-extrabold text-[#6b7280] transition hover:bg-[#f7f7f7] hover:text-[#111827]"
            >
              Recolher
              <ChevronDown className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </div>

        <aside className="min-w-0 border-t border-[#dedede] p-4 xl:border-l xl:border-t-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#737b8a]">Recomendado</p>
          <p className="mt-3 truncate text-lg font-extrabold text-[#111827]">{bestOffer.supplier}</p>
          <p className="mt-7 text-3xl font-extrabold tracking-[-0.04em] text-primary">{formatCurrency(bestOffer.total)}</p>
          <p className="mt-3 text-sm font-medium text-[#6b7280]">
            {formatQty(material.qty)} {material.unit} · {formatCurrency(bestOffer.unitPrice)} un.
          </p>

          <a
            href={bestOffer.url}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-base font-bold text-primary-foreground shadow-[0_10px_20px_rgba(0,100,166,0.16)] transition hover:brightness-105"
          >
            Comprar
            <ExternalLink className="h-4 w-4" />
          </a>
        </aside>
      </div>
    </article>
  );
}

export default function MaterialsList() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(searchParams.get("project") || "");
  const [project, setProject] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  useEffect(() => { backend.entities.Project.list().then(setProjects); }, []);
  useEffect(() => {
    if (!selected) return;
    backend.entities.Project.get(selected).then((value) => {
      setProject(value);
      setAiInsight(null);
    });
  }, [selected]);

  const materials = useMemo(() => buildMaterials(project), [project]);
  const recommendation = useMemo(() => buildAiRecommendation(materials), [materials]);
  const activeInsight = aiInsight || recommendation;

  const filtered = materials.filter((material) => {
    const term = search.toLowerCase();
    const matchesSearch = [material.name, material.brand, material.code, material.bestOffer.supplier]
      .join(" ")
      .toLowerCase()
      .includes(term);
    const matchesCategory = categoryFilter === "all" || material.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const referenceTotal = filtered.reduce((sum, item) => sum + item.referenceTotal, 0);
  const aiTotal = filtered.reduce((sum, item) => sum + item.bestOffer.total, 0);
  const filteredSaving = Math.max(0, referenceTotal - aiTotal);
  const bestSupplierName = activeInsight.bestSingleSupplier?.name || "—";

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const runAiShopping = async () => {
    if (!materials.length) return;
    setAiLoading(true);
    const localInsight = buildAiRecommendation(materials);

    try {
      const response = await backend.integrations.Core.InvokeLLM({
        prompt: `Você é um comprador técnico de materiais elétricos no Brasil. Analise esta lista de materiais NBR 5410 e recomende a estratégia de compra mais econômica e segura. Não invente preços em tempo real; use os valores estimados abaixo e destaque que deve confirmar no checkout.

Materiais:
${materials.map((item) => `- ${item.name} (${item.code}) qty ${formatQty(item.qty)}: referencia ${formatCurrency(item.price)}; melhor estimado ${item.bestOffer.supplier} ${formatCurrency(item.bestOffer.unitPrice)}`).join("\n")}

Total referencia: ${formatCurrency(localInsight.referenceTotal)}
Menor total estimado por item: ${formatCurrency(localInsight.mixedTotal)}
Melhor compra consolidada: ${localInsight.bestSingleSupplier.name} ${formatCurrency(localInsight.bestSingleSupplier.total)}`,
        response_json_schema: {
          type: "object",
          properties: {
            strategy: { type: "string" },
            note: { type: "string" },
          },
        },
      });

      setAiInsight({ ...localInsight, ...response });
    } catch {
      setAiInsight(localInsight);
    } finally {
      setAiLoading(false);
    }
  };

  const handlePrint = (size) => {
    const rows = materials.map((material) => `
      <tr>
        <td><strong>${material.name}</strong><br><span style="font-size:7pt;color:#666">${material.brand || ""} · ${material.code || ""}</span></td>
        <td style="text-align:center">${formatQty(material.qty)} ${material.unit}</td>
        <td style="text-align:right">R$ ${(material.price || 0).toFixed(2)}</td>
        <td style="text-align:right">${material.bestOffer.supplier}<br><span style="font-size:7pt;color:#666">${formatCurrency(material.bestOffer.unitPrice)}</span></td>
        <td style="text-align:right;font-weight:bold">R$ ${material.bestOffer.total.toFixed(2)}</td>
      </tr>`).join("");
    const html = `
      <h2>Lista de Materiais — ${project?.name || ""}</h2>
      <p class="sub">Quantitativo automático com cotação IA estimada · NACIF Solutions Eletric · NBR 5410:2004</p>
      <table>
        <thead><tr><th>Material</th><th style="text-align:center">Qtd.</th><th style="text-align:right">Referência</th><th style="text-align:right">Melhor compra</th><th style="text-align:right">Total IA</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="grand-total">Total estimado IA: R$ ${recommendation.mixedTotal.toFixed(2)}</div>
      </div>`;
    openHTMLPrint({
      htmlContent: html,
      paperSize: size,
      projectName: project?.name,
      logoUrl,
      projectInfo: {
        clientName: project?.client_name,
        address: project?.address,
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-none min-w-0 space-y-5 overflow-hidden pb-20 sm:space-y-6">
      <PageHeader
        icon={Package}
        title="Lista de Materiais"
        subtitle="Quantitativo automático, imagens dos itens e cotação inteligente de compra."
        actions={
          <>
          <label className="inline-flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#BCEEE5] bg-white px-3 text-sm font-extrabold text-[#5f6877] transition hover:bg-[#F2FFFC] sm:px-4">
            <Upload className="h-4 w-4" />
            <img src={logoUrl || DEFAULT_LOGO_URL} className="h-6 min-w-0 object-contain" alt="Logo NACIF Solutions" />
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </label>
          {project && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 min-w-0 rounded-[12px] font-extrabold">
                  <Printer className="h-4 w-4" />
                  Imprimir
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.keys(PAPER_SIZES).map((size) => (
                  <DropdownMenuItem key={size} onClick={() => handlePrint(size)}>
                    <Printer className="mr-2 h-4 w-4" />Formato {size}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </>
        }
      >
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-12 min-w-0 flex-1 rounded-[14px] border-[#BCEEE5] bg-white text-sm font-bold shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <SelectValue placeholder="Selecionar projeto..." />
          </SelectTrigger>
          <SelectContent>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
      </PageHeader>

      {project ? (
        <>
          <div className="grid min-w-0 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {[
              { label: "Itens técnicos", value: materials.length, icon: Package },
              { label: "Total referência", value: formatCurrency(recommendation.referenceTotal), icon: ShoppingCart },
              { label: "Economia IA", value: formatCurrency(recommendation.mixedSaving), icon: TrendingDown },
              { label: "Fornecedor destaque", value: bestSupplierName, icon: Store },
            ].map((item) => (
              <div key={item.label} className="min-w-0 rounded-[18px] border border-[#CDEFE8] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:rounded-[20px] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="rounded-[9px] bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">IA</span>
                </div>
                <p className="mt-4 truncate text-2xl font-extrabold text-[#0f1728]">{item.value}</p>
                <p className="mt-1 text-sm font-semibold text-[#687386]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4">
              <div className="min-w-0 rounded-[18px] border border-[#CDEFE8] bg-white p-3 shadow-[0_16px_42px_rgba(15,23,42,0.045)] sm:rounded-[20px] sm:p-4">
                <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6b7280] sm:left-4" />
                    <Input
                      placeholder="Buscar material, fabricante, código ou fornecedor..."
                      className="h-11 min-w-0 rounded-[14px] border-[#CDEFE8] pl-11 pr-3 text-sm placeholder:text-[#6b7280] sm:h-12 sm:pl-12 sm:text-base"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] xl:justify-end xl:pb-0 [&::-webkit-scrollbar]:hidden">
                    <Filter className="h-4 w-4 shrink-0 text-[#6b7280]" />
                    {[
                      ["all", "Todos"],
                      ["protection", "Proteção"],
                      ["cable", "Cabos"],
                      ["panel", "Quadro"],
                      ["accessory", "Acessórios"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCategoryFilter(value)}
                        className={`h-9 shrink-0 rounded-[12px] border px-3 text-xs font-extrabold transition sm:h-10 sm:px-4 sm:text-sm ${
                          categoryFilter === value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-[#CDEFE8] bg-white text-[#5f6877] hover:bg-[#F2FFFC]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {filtered.length === 0 ? (
                  <div className="rounded-[22px] border border-[#CDEFE8] bg-white p-10 text-center text-sm font-semibold text-[#687386] shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                    Nenhum material encontrado.
                  </div>
                ) : (
                  filtered.map((material) => (
                    <MaterialProductCard key={material.name} material={material} />
                  ))
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-[20px] border border-primary/25 bg-primary/10 p-4 md:flex-row md:items-center md:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-primary">Total filtrado</p>
                  <p className="mt-1 text-sm font-medium text-[#5f6877]">Comparação entre referência e menor preço estimado.</p>
                </div>
                <div className="shrink-0 md:text-right">
                  <p className="text-sm font-bold text-[#5f6877] line-through">{formatCurrency(referenceTotal)}</p>
                  <p className="text-2xl font-extrabold text-primary sm:text-3xl">{formatCurrency(aiTotal)}</p>
                  <p className="text-sm font-extrabold text-[#16a34a]">Economia {formatCurrency(filteredSaving)}</p>
                </div>
              </div>
            </div>

            <aside className="min-w-0 space-y-4">
              <section className="rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-primary/15 text-primary">
                    <Bot className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-extrabold text-[#0f1728]">IA de compras</h2>
                    <p className="mt-1 text-sm font-medium leading-5 text-[#5f6877]">
                      Sugere onde comprar, compara menor preço estimado e abre busca no fornecedor.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[16px] border border-[#CDEFE8] bg-[#F2FFFC] p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-4 w-4" />
                    <p className="text-sm font-extrabold">Estratégia recomendada</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#111827]">{activeInsight.strategy}</p>
                  <p className="mt-2 text-xs font-medium leading-5 text-[#687386]">{activeInsight.note}</p>
                </div>

                <Button className="mt-4 h-11 w-full rounded-[12px] font-extrabold" onClick={runAiShopping} disabled={aiLoading}>
                  {aiLoading ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Atualizar cotação IA
                    </>
                  )}
                </Button>
              </section>

              <section className="rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-[#0f1728]">
                  <Store className="h-4 w-4 text-primary" />
                  Ranking de fornecedores
                </h3>
                <div className="mt-4 space-y-3">
                  {activeInsight.supplierTotals.slice(0, 4).map((supplier, index) => (
                    <div key={supplier.name} className="rounded-[16px] border border-[#CDEFE8] bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-extrabold text-[#111827]">{index + 1}. {supplier.name}</p>
                          <p className="mt-1 text-xs font-semibold text-[#687386]">{supplier.type} · {supplier.badge}</p>
                        </div>
                        <p className="text-sm font-extrabold text-primary">{formatCurrency(supplier.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-[#0f1728]">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  Maiores economias
                </h3>
                <div className="mt-4 space-y-3">
                  {activeInsight.topSavings.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-[14px] bg-[#fafafa] p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-[#111827]">{item.name}</p>
                        <p className="text-xs font-semibold text-[#687386]">{item.supplier}</p>
                      </div>
                      <p className="shrink-0 text-sm font-extrabold text-[#16a34a]">{formatCurrency(item.saving)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[22px] border border-[#CDEFE8] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-[#0f1728]">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Checklist técnico
                </h3>
                <div className="mt-4 space-y-3 text-sm font-semibold text-[#5f6877]">
                  {["Confirmar curva, polos e Icu/Icn do disjuntor.", "Validar bitola, cor e norma do cabo.", "Comparar frete e prazo antes de fechar pedido."].map((item) => (
                    <div key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <div className="rounded-[24px] border border-[#CDEFE8] bg-white p-16 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <Package className="mx-auto mb-3 h-12 w-12 text-primary/30" />
          <p className="text-sm font-semibold text-[#687386]">Selecione um projeto para gerar a lista de materiais com cotação IA.</p>
        </div>
      )}
    </div>
  );
}
