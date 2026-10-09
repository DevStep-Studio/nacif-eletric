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
import PageHeader from "@/components/PageHeader";
import { buildProjectBudgetMaterials } from "@/lib/projectBudgetMaterials";
import MaterialProductThumb from "@/components/MaterialProductThumb";
import { CATEGORY_STYLES, getMaterialProductInfo, getMaterialDataUriForPrint } from "@/lib/materialProductCatalog";

const SUPPLIERS = [
  {
    name: "Loja do Eletricista",
    type: "Especializada",
    badge: "melhor mix técnico",
    searchBase: "https://www.google.com/search?tbm=shop&q=",
    multipliers: { protecao: 0.94, cabos: 1.02, quadro: 0.98, conectores: 0.95, infraestrutura: 0.97, default: 0.97 },
  },
  {
    name: "Mercado Livre",
    type: "Marketplace",
    badge: "menor preço frequente",
    searchBase: "https://lista.mercadolivre.com.br/",
    multipliers: { protecao: 0.91, cabos: 0.97, quadro: 1.03, conectores: 0.92, infraestrutura: 0.94, default: 0.95 },
  },
  {
    name: "Leroy Merlin",
    type: "Varejo técnico",
    badge: "retirada rápida",
    searchBase: "https://www.google.com/search?q=site%3Aleroymerlin.com.br+",
    multipliers: { protecao: 1.03, cabos: 0.99, quadro: 0.95, conectores: 1.02, infraestrutura: 0.98, default: 1.01 },
  },
  {
    name: "Amazon Brasil",
    type: "Marketplace",
    badge: "entrega rápida",
    searchBase: "https://www.amazon.com.br/s?k=",
    multipliers: { protecao: 0.98, cabos: 1.08, quadro: 1.02, conectores: 0.94, infraestrutura: 0.96, default: 1.0 },
  },
  {
    name: "Distribuidor local",
    type: "Atacado",
    badge: "melhor para volume",
    searchBase: "https://www.google.com/search?q=distribuidor+material+eletrico+",
    multipliers: { protecao: 0.96, cabos: 0.93, quadro: 0.97, conectores: 0.93, infraestrutura: 0.95, default: 0.96 },
  },
];

const formatCurrency = (value) => (value || 0).toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatQty = (qty) => Number.isInteger(qty) ? qty : qty.toFixed(1);

const hashString = (value) => String(value).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

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

function supplierOffers(material) {
  const categoryKey = material.category || "material";
  const seed = hashString(`${material.name}${material.code}`);

  return SUPPLIERS.map((supplier, index) => {
    const multiplier = supplier.multipliers[categoryKey] || supplier.multipliers.default;
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
  const category = material.category || "MAT";
  const prefix = category.slice(0, 3).toUpperCase();
  return `${prefix}-${String(hashString(material.name) % 10000).padStart(4, "0")}`;
}

function enrichMaterial(material) {
  const productInfo = getMaterialProductInfo(material);
  const normalized = {
    ...material,
    imageUrl: material.image || material.imageUrl || productInfo.imageUrl,
    brand: material.brand || productInfo.brand,
    specShort: material.specShort || productInfo.specShort,
    code: materialReferenceCode({ ...material, category: productInfo.categoryKey }),
    category: material.category || productInfo.categoryKey,
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

function buildBudget(project) {
  const budget = buildProjectBudgetMaterials(project);
  return { ...budget, materials: budget.materials.map(enrichMaterial) };
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
  const bestSingleSupplier = supplierTotals[0] || SUPPLIERS[0];
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
  const norm = String(category || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const config = CATEGORY_STYLES[norm] || CATEGORY_STYLES.material;

  return (
    <span className={`inline-flex items-center rounded-[8px] border px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase ${config.badgeClass}`}>
      {config.label}
    </span>
  );
}

function MaterialProductCard({ material }) {
  const [expanded, setExpanded] = useState(false);
  const bestOffer = material.bestOffer;
  const savingValue = Math.max(0, material.referenceTotal - bestOffer.total);
  const googleUrl = googleImagesUrl(material);

  if (!expanded) {
    return (
      <article className="rounded-[16px] border border-[#e2e8f0] bg-white p-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition duration-150 hover:border-primary/40 hover:shadow-[0_8px_20px_rgba(15,23,42,0.05)] sm:p-4">
        <div className="grid min-w-0 gap-3.5 lg:grid-cols-[72px_minmax(0,1.45fr)_92px_104px_128px_128px_96px] lg:items-center">
          <a
            href={googleUrl}
            target="_blank"
            rel="noreferrer"
            className="group/link relative block shrink-0"
            title={`Ver fotos reais e referências de ${material.name}`}
          >
            <MaterialProductThumb material={material} size="normal" />
            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg border border-[#BCEEE5] bg-white/95 text-[#004E82] opacity-0 shadow-sm transition group-hover/link:opacity-100">
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>

          <div className="min-w-0 lg:pr-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CategoryBadge category={material.category} />
              <span className="truncate rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-2 py-0.5 text-[11px] font-bold text-[#64748b]">
                {material.code}
              </span>
            </div>
            <h3 className="mt-2 truncate text-base font-extrabold text-[#0f172a] sm:text-lg">{material.name}</h3>
            <p className="mt-0.5 truncate text-xs font-semibold text-[#64748b]">
              {material.brand}{material.specShort ? ` · ${material.specShort}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[#f1f5f9] pt-3 text-sm lg:contents lg:border-t-0 lg:pt-0">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#64748b] lg:hidden">Qtd.</p>
              <p className="mt-1 font-extrabold text-[#0f172a] lg:mt-0 lg:text-right">{formatQty(material.qty)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#64748b] lg:hidden">Unidade</p>
              <p className="mt-1 font-extrabold text-[#0f172a] lg:mt-0 lg:text-center">{material.unit}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#64748b] lg:hidden">Valor unit.</p>
              <p className="mt-1 font-extrabold text-[#0f172a] lg:mt-0 lg:text-right">{formatCurrency(material.price)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#64748b] lg:hidden">Total</p>
              <p className="mt-1 font-extrabold text-primary lg:mt-0 lg:text-right">{formatCurrency(material.referenceTotal)}</p>
            </div>
            <div className="col-span-2 flex justify-start lg:col-span-1 lg:justify-end">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-[#CDEFE8] bg-white px-3 text-xs font-extrabold text-[#0f172a] transition hover:bg-[#F2FFFC]"
                title={`Melhor estimativa: ${bestOffer.supplier} ${formatCurrency(bestOffer.total)}`}
              >
                Detalhes
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-[18px] border border-[#cbd5e1] bg-white shadow-[0_12px_34px_rgba(15,23,42,0.045)]">
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="grid min-w-0 gap-4 sm:grid-cols-[118px_minmax(0,1fr)]">
            <div className="flex shrink-0 items-center justify-center">
              <MaterialProductThumb material={material} size="expanded" />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CategoryBadge category={material.category} />
                <span className="rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-bold text-[#64748b]">
                  {material.code}
                </span>
              </div>

              <h3 className="mt-2.5 truncate text-lg font-extrabold leading-tight text-[#0f172a] sm:text-xl">
                {material.name}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                {material.brand} · {material.specShort}
              </p>

              <div className="mt-4 grid border-y border-[#e2e8f0] py-3 sm:grid-cols-3">
                <div className="px-1 sm:px-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">Qtd.</p>
                  <p className="mt-1 text-base font-extrabold text-[#0f172a]">{formatQty(material.qty)} {material.unit}</p>
                </div>
                <div className="mt-2 border-[#e2e8f0] px-1 sm:mt-0 sm:border-l sm:px-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">Unit. base</p>
                  <p className="mt-1 text-base font-extrabold text-[#0f172a]">{formatCurrency(material.price)}</p>
                </div>
                <div className="mt-2 border-[#e2e8f0] px-1 sm:mt-0 sm:border-l sm:px-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">Economia</p>
                  <p className="mt-1 text-base font-extrabold text-primary">{formatCurrency(savingValue)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[12px] border border-[#e2e8f0]">
            {material.offers.slice(0, 3).map((offer, index) => (
              <a
                key={offer.supplier}
                href={offer.url}
                target="_blank"
                rel="noreferrer"
                className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e2e8f0] px-3.5 py-2.5 last:border-b-0 ${
                  index === 0 ? "bg-[#F2FFFC]" : "bg-white hover:bg-[#F8FAFC]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-sm font-extrabold text-[#0f172a] sm:text-base">{offer.supplier}</span>
                  {index === 0 && (
                    <span className="hidden rounded-[8px] border border-[#BCEEE5] bg-white/80 px-2 py-0.5 text-[11px] font-bold text-[#004E82] sm:inline">
                      menor preço
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-extrabold text-[#0f172a] sm:text-base">{formatCurrency(offer.unitPrice)}</span>
              </a>
            ))}
          </div>

          <div className="mt-3.5 flex min-w-0 flex-wrap items-center gap-3 text-sm font-medium text-[#64748b]">
            <a href={googleImagesUrl(material)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition hover:text-[#0f172a]">
              <ImageIcon className="h-4 w-4" />
              Imagens reais
            </a>
            <span className="hidden h-4 w-px bg-[#cbd5e1] sm:block" />
            <a href={googleShoppingUrl(material)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition hover:text-[#0f172a]">
              <Search className="h-4 w-4" />
              Shopping
            </a>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-xs font-extrabold text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            >
              Recolher
              <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            </button>
          </div>
        </div>

        <aside className="min-w-0 border-t border-[#e2e8f0] bg-[#fafafa] p-4 sm:p-5 xl:border-l xl:border-t-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Melhor Cotação</p>
          <p className="mt-2 truncate text-base font-extrabold text-[#0f172a]">{bestOffer.supplier}</p>
          <p className="mt-4 text-2xl font-black tracking-tight text-primary sm:text-3xl">{formatCurrency(bestOffer.total)}</p>
          <p className="mt-2 text-xs font-semibold text-[#64748b]">
            {formatQty(material.qty)} {material.unit} · {formatCurrency(bestOffer.unitPrice)} un.
          </p>

          <a
            href={bestOffer.url}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm transition hover:brightness-105"
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
  const [selected, setSelected] = useState(() => (
    searchParams.get("project")
    || (typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : "")
    || ""
  ));
  const [project, setProject] = useState(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  useEffect(() => {
    const urlProjectId = searchParams.get("project");
    if (urlProjectId && urlProjectId !== selected) {
      setSelected(urlProjectId);
      try { window.localStorage.setItem("voltai_active_project_id", urlProjectId); } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    backend.entities.Project.list("-updated_date", 100).then((list) => {
      if (cancelled) return;
      const safeList = Array.isArray(list) ? list : [];
      setProjects(safeList);
      const currentUrlId = searchParams.get("project");
      if (!currentUrlId && !selected && safeList.length > 0) {
        const storedId = typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : null;
        const target = safeList.find((p) => p.id === storedId) || safeList[0];
        if (target?.id) {
          setSelected(target.id);
          try { window.localStorage.setItem("voltai_active_project_id", target.id); } catch {}
        }
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleSelectProject = (newId) => {
    setSelected(newId || "");
    if (newId) {
      try { window.localStorage.setItem("voltai_active_project_id", newId); } catch {}
    }
  };

  useEffect(() => {
    if (!selected) {
      setProject(null);
      setAiInsight(null);
      return;
    }
    backend.entities.Project.get(selected).then((value) => {
      setProject(value);
      setAiInsight(null);
    }).catch((err) => {
      console.error("Erro ao carregar projeto:", err);
    });
  }, [selected]);

  const budget = useMemo(() => buildBudget(project), [project]);
  const materials = budget.materials;
  const isPanelAssemblyOnly = budget.isPanelAssemblyOnly;
  const recommendation = useMemo(() => buildAiRecommendation(materials), [materials]);
  const activeInsight = aiInsight || recommendation;

  const filtered = materials.filter((material) => {
    const term = search.toLowerCase();
    const matchesSearch = [
      material.name,
      material.brand,
      material.code,
      material.specShort,
      material.bestOffer?.supplier,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(term);

    if (categoryFilter === "all") return matchesSearch;
    const cat = String(material.category || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const filterKey = categoryFilter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const matchesCategory = cat === filterKey || cat.startsWith(filterKey.slice(0, 4));
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

    openHTMLPrint({
      paperSize: size,
      projectName: project?.name,
      documentTitle: `Lista de Materiais — ${project?.name || "Projeto"}`,
      subtitle: "Quantitativo automático com cotação de mercado e IA estimada · NBR 5410:2004",
      logoUrl,
      items: materials.map((m) => ({
        name: m.name,
        qty: m.qty,
        unit: m.unit,
        price: m.price,
        category: m.category,
        brand: m.brand,
        imageUrl: getMaterialDataUriForPrint(m.name),
      })),
      totals: {
        referenceTotal: recommendation.referenceTotal,
        mixedTotal: recommendation.mixedTotal,
        saving: recommendation.mixedSaving,
        bestSingleSupplier: recommendation.bestSingleSupplier?.name,
      },
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
        subtitle="Quantitativo automático com fotos reais dos itens e cotação inteligente de compra."
        actions={
          <>
          <label className="inline-flex h-11 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#BCEEE5] bg-white px-3 text-sm font-extrabold text-[#5f6877] transition hover:bg-[#F2FFFC] sm:px-4">
            <Upload className="h-4 w-4" />
            <img
              src={logoUrl || DEFAULT_LOGO_URL}
              className="h-6 min-w-0 max-w-[140px] object-contain"
              alt="Logo NACIF Solutions"
              onError={(e) => {
                if (e.currentTarget.src !== DEFAULT_LOGO_URL) {
                  e.currentTarget.src = DEFAULT_LOGO_URL;
                }
              }}
            />
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
        <Select value={selected} onValueChange={handleSelectProject}>
          <SelectTrigger className="h-12 min-w-0 flex-1 rounded-[14px] border-[#BCEEE5] bg-white text-sm font-bold shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <SelectValue placeholder="Selecionar projeto..." />
          </SelectTrigger>
          <SelectContent>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
      </PageHeader>

      {project ? (
        <>
          {isPanelAssemblyOnly && (
            <div className="min-w-0 rounded-[16px] border border-[#CDEFE8] bg-[#F2FFFC] px-4 py-3 text-sm font-semibold text-[#004E82]">
              Escopo: montagem de quadro. A lista traz apenas o material do quadro — itens de infraestrutura (eletrodutos, caixas, tomadas, cabeamento) aparecem depois que a planta baixa for criada.
            </div>
          )}
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
                      ["protecao", "Proteção"],
                      ["cabos", "Cabos"],
                      ["quadro", "Quadro"],
                      ["conectores", "Conectores"],
                      ["infraestrutura", "Infra"],
                      ["acabamentos", "Acabamentos"],
                      ["consumiveis", "Consumíveis"],
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
                  <>
                    <div className="hidden rounded-[12px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-[#64748B] lg:grid lg:grid-cols-[72px_minmax(0,1.45fr)_92px_104px_128px_128px_96px] lg:items-center">
                      <span>Produto</span>
                      <span>Material</span>
                      <span className="text-right">Qtd.</span>
                      <span className="text-center">Unidade</span>
                      <span className="text-right">Valor unit.</span>
                      <span className="text-right">Total</span>
                      <span className="text-right">Ações</span>
                    </div>
                    {filtered.map((material) => (
                      <MaterialProductCard key={material.name} material={material} />
                    ))}
                  </>
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
