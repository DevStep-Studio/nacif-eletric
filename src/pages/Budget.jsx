import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { FileText, Printer, Upload, ChevronDown, FolderOpen, Zap, Plus, Sparkles, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { openHTMLPrint, PAPER_SIZES } from "@/lib/printUtils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import { DEFAULT_LOGO_URL } from "@/lib/brandingDefaults";
import MaterialSymbol, { getMaterialSymbolDataUri } from "@/components/MaterialSymbol";
import {
  buildProjectBudgetMaterials,
  estimateLocalMaterialPrice,
  getProjectLogo,
  normalizeManualBudgetItems,
} from "@/lib/projectBudgetMaterials";

function MaterialThumb({ material, size = "normal" }) {
  const sizeClass = size === "small" ? "h-8 w-8" : "h-11 w-11";

  return <MaterialSymbol name={material.name} className={sizeClass} />;
}

const formatCurrencyBR = (value = 0) => `R$ ${Number(value || 0).toLocaleString("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatQty = (value = 0) => {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
};

const formatUnit = (unit = "un") => {
  if (!unit || unit === "un") return "un.";
  if (unit === "m") return "m";
  return unit;
};

export default function BudgetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("project");
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [project, setProject] = useState(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [margin, setMargin] = useState(30);
  const [laborCost, setLaborCost] = useState(800);
  const [productAdjustment, setProductAdjustment] = useState(0);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL);
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualEstimating, setManualEstimating] = useState(false);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePrint = (size) => {
    const rows = materials.map(m => `
      <tr>
        <td style="width:44px;text-align:center"><img src="${getMaterialSymbolDataUri(m.name)}" alt="" style="width:30px;height:30px;object-fit:contain" /></td>
        <td>${m.name}</td>
        <td style="text-align:center">${formatQty(m.qty)}</td>
        <td style="text-align:center">${formatUnit(m.unit)}</td>
        <td style="text-align:right">${formatCurrencyBR(m.price)}</td>
        <td style="text-align:right">${formatCurrencyBR(m.qty * m.price)}</td>
      </tr>`).join("");
    const html = `
      <h2>Orçamento — ${project?.name || ""}</h2>
      <p class="sub">Proposta gerada automaticamente · NACIF Solutions Eletric · NBR 5410:2004</p>
      <table>
        <thead><tr><th></th><th>Material</th><th style="text-align:center">Qtd.</th><th style="text-align:center">Unidade</th><th style="text-align:right">Valor unitário</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div class="total-row"><span>Materiais base:</span><span>${formatCurrencyBR(baseMaterialTotal)}</span></div>
        <div class="total-row"><span>Variação produtos (${productAdjustment}%):</span><span>${formatCurrencyBR(productAdjustmentValue)}</span></div>
        <div class="total-row"><span>Materiais ajustados:</span><span>${formatCurrencyBR(materialTotal)}</span></div>
        <div class="total-row"><span>Mão de Obra:</span><span>${formatCurrencyBR(laborCost)}</span></div>
        <div class="total-row"><span>Margem (${margin}%):</span><span>${formatCurrencyBR(subtotal * margin / 100)}</span></div>
        <div class="grand-total">Total: ${formatCurrencyBR(total)}</div>
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

  useEffect(() => {
    setLoadingProjects(true);
    backend.entities.Project.list("-updated_date", 100)
      .then(setProjects)
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    setLoadingProject(true);
    backend.entities.Project.get(projectId)
      .then(setProject)
      .finally(() => setLoadingProject(false));
  }, [projectId]);

  const selectProject = (id) => {
    navigate(`/budget?project=${id}`);
  };

  const updateManualItems = async (nextItems) => {
    if (!projectId) return;
    const normalized = normalizeManualBudgetItems(nextItems);
    setProject((current) => current ? { ...current, manual_budget_items: normalized } : current);
    setProjects((current) => current.map((item) => item.id === projectId ? { ...item, manual_budget_items: normalized } : item));
    await backend.entities.Project.update(projectId, { manual_budget_items: normalized });
  };

  const estimateManualPrice = async (name) => {
    const fallback = estimateLocalMaterialPrice(name);
    try {
      const response = await backend.integrations.Core.InvokeLLM({
        prompt: `Estime o preço unitário médio em reais no Brasil para este material elétrico: "${name}". Responda somente JSON com name, unit_price e note. Use preço realista de varejo/fornecedor elétrico, sem pesquisar em tempo real.`,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            unit_price: { type: "number" },
            note: { type: "string" },
          },
        },
      });
      const value = Number(response?.unit_price);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    } catch {
      return fallback;
    }
  };

  const addManualItem = async () => {
    const name = manualName.trim();
    if (!project || !name) return;
    setManualEstimating(true);
    try {
      const price = await estimateManualPrice(name);
      const nextItem = {
        id: `manual-${Date.now()}`,
        name,
        qty: Math.max(1, Number(manualQty) || 1),
        price: Math.round(price * 100) / 100,
        source: "ia-estimado",
      };
      await updateManualItems([...normalizeManualBudgetItems(project.manual_budget_items), nextItem]);
      setManualName("");
      setManualQty(1);
    } finally {
      setManualEstimating(false);
    }
  };

  const removeManualItem = async (id) => {
    if (!project) return;
    await updateManualItems(normalizeManualBudgetItems(project.manual_budget_items).filter((item) => item.id !== id));
  };

  const {
    materials,
    customManualItems,
    baseMaterialTotal,
    materialTotal,
    productAdjustmentValue,
    isPanelAssemblyOnly,
  } = buildProjectBudgetMaterials(project, { productAdjustment });
  const subtotal = materialTotal + Number(laborCost || 0);
  const total = subtotal * (1 + Number(margin || 0) / 100);

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
      <PageHeader
        icon={FileText}
        title="Orçamento Automático"
        subtitle={project?.name ? `Proposta técnica e comercial para ${project.name}` : "Abra a partir de um projeto para gerar materiais, mão de obra e margem."}
        actions={
          <>
          <label className="flex items-center gap-1.5 cursor-pointer px-2 py-1.5 rounded border border-dashed border-border hover:bg-secondary/50 text-xs text-muted-foreground">
            <Upload className="w-3.5 h-3.5" />
            <img src={logoUrl || DEFAULT_LOGO_URL} className="h-5 object-contain" alt="Logo NACIF Solutions" />
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </label>
          {project && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-secondary/50">
                  <Printer className="w-3.5 h-3.5" />Imprimir<ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.keys(PAPER_SIZES).map(size => (
                  <DropdownMenuItem key={size} onClick={() => handlePrint(size)}>
                    <Printer className="w-4 h-4 mr-2" />Formato {size}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </>
        }
      />

      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-border/50 bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-[#0f172a]">Projetos</h3>
              <p className="text-xs font-semibold text-muted-foreground">Selecione o orçamento</p>
            </div>
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>

          {loadingProjects ? (
            <div className="py-8 text-center text-sm font-semibold text-muted-foreground">Carregando projetos...</div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm font-semibold text-muted-foreground">
              Nenhum projeto cadastrado.
            </div>
          ) : (
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {projects.map((item) => {
                const active = item.id === projectId;
                const circuitCount = Array.isArray(item.circuits) ? item.circuits.length : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectProject(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/60 bg-white hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#CDEFE8] bg-white p-2">
                      {getProjectLogo(item, logoUrl) ? (
                        <img src={getProjectLogo(item, logoUrl)} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Zap className="h-5 w-5 text-primary" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-[#0f172a]">{item.name || "Projeto sem nome"}</span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
                        {item.client_name || "Sem cliente"} · {circuitCount} circuito{circuitCount === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <main className="min-w-0 space-y-6">
      {!project ? (
        <div className="rounded-2xl border border-border/50 bg-card p-6 text-center text-muted-foreground">
          {loadingProject ? "Carregando orçamento..." : "Selecione um projeto na lista para visualizar o orçamento."}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#CDEFE8] bg-white p-2">
              <img src={getProjectLogo(project, logoUrl)} className="h-full w-full object-contain" alt="" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Orçamento selecionado</p>
              <h2 className="truncate text-xl font-black text-[#0f172a]">{project.name}</h2>
              <p className="truncate text-sm font-semibold text-muted-foreground">{project.client_name || "Sem cliente"} · {project.supply_type || "Alimentação não informada"} · {project.voltage ? `${project.voltage}V` : "Tensão não informada"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Adicionar item manual</h3>
                <p className="text-xs font-semibold text-muted-foreground">Informe o nome; a IA estima o valor unitário e salva no projeto.</p>
              </div>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_150px]">
              <div className="space-y-2">
                <Label>Nome do item</Label>
                <Input
                  value={manualName}
                  onChange={(event) => setManualName(event.target.value)}
                  placeholder="Ex: disjuntor bipolar 32A, eletroduto 25mm, tomada dupla"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addManualItem();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd.</Label>
                <Input type="number" min="1" value={manualQty} onChange={(event) => setManualQty(Number(event.target.value))} />
              </div>
              <button
                type="button"
                onClick={addManualItem}
                disabled={!manualName.trim() || manualEstimating}
                className="mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {manualEstimating ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Plus className="h-4 w-4" />}
                {manualEstimating ? "Estimando..." : "Adicionar"}
              </button>
            </div>

            {customManualItems.length > 0 && (
              <div className="mt-4 space-y-1 border-t border-border/50 pt-3">
                {customManualItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-secondary/40">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{formatQty(item.qty)} {formatUnit(item.unit)} · IA estimado · {formatCurrencyBR(item.price)} unit.</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-bold text-muted-foreground">{formatCurrencyBR(item.qty * item.price)}</span>
                      <button
                        type="button"
                        onClick={() => removeManualItem(item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                        aria-label="Remover item manual"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/50 p-6 pb-4">
              <div>
                <h3 className="font-semibold">Lista de Materiais</h3>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Quantitativo com unidade, valor unitário e total por item.</p>
                {isPanelAssemblyOnly && (
                  <p className="mt-1 text-xs font-semibold text-primary">
                    Escopo: montagem de quadro · itens de infraestrutura (planta baixa) não incluídos.
                  </p>
                )}
              </div>
              <span className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-black text-primary">{materials.length} itens</span>
            </div>
            <div className="hidden grid-cols-[minmax(220px,1fr)_72px_80px_116px_116px] gap-3 border-b border-border/50 bg-[#F8FAFC] px-6 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <span>Material</span>
              <span className="text-center">Qtd.</span>
              <span className="text-center">Unidade</span>
              <span className="text-right">Valor unitário</span>
              <span className="text-right">Total</span>
            </div>
            <div className="divide-y divide-border/40">
              {materials.length === 0 ? (
                <div className="p-6 text-center text-sm font-semibold text-muted-foreground">Nenhum material calculado para este projeto.</div>
              ) : materials.map((m, i) => (
                <div key={`${m.name}-${i}`} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(220px,1fr)_72px_80px_116px_116px] md:items-center md:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <MaterialThumb material={m} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[#0f172a]">{m.name}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-500">{m.category || "material"}</span>
                        {m.manual ? <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-primary">manual</span> : null}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-muted-foreground sm:grid-cols-4 md:contents">
                    <div className="rounded-lg bg-[#F8FAFC] p-2 md:bg-transparent md:p-0 md:text-center">
                      <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 md:hidden">Qtd.</span>
                      <span className="text-sm font-bold text-[#0f172a]">{formatQty(m.qty)}</span>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] p-2 md:bg-transparent md:p-0 md:text-center">
                      <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 md:hidden">Unidade</span>
                      <span className="text-sm font-bold text-[#0f172a]">{formatUnit(m.unit)}</span>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] p-2 md:bg-transparent md:p-0 md:text-right">
                      <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 md:hidden">Valor unitário</span>
                      <span className="text-sm font-bold text-[#0f172a]">{formatCurrencyBR(m.price)}</span>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] p-2 md:bg-transparent md:p-0 md:text-right">
                      <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 md:hidden">Total</span>
                      <span className="text-sm font-black text-primary">{formatCurrencyBR(m.qty * m.price)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/50 bg-[#FCFEFF] px-6 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Materiais base</span><span>{formatCurrencyBR(baseMaterialTotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-muted-foreground">Variação produtos ({productAdjustment}%)</span><span>{formatCurrencyBR(productAdjustmentValue)}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-border pt-2 font-semibold">
                <span>Materiais ajustados</span><span>{formatCurrencyBR(materialTotal)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Mão de Obra (R$)</Label>
              <Input type="number" value={laborCost} onChange={e => setLaborCost(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Variação Produtos (%)</Label>
              <Input type="number" value={productAdjustment} onChange={e => setProductAdjustment(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Margem (%)</Label>
              <Input type="number" value={margin} onChange={e => setMargin(Number(e.target.value))} />
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-primary/10 border border-primary/20">
            <div className="flex justify-between text-sm"><span>Materiais base</span><span>{formatCurrencyBR(baseMaterialTotal)}</span></div>
            <div className="flex justify-between text-sm mt-1"><span>Variação produtos ({productAdjustment}%)</span><span>{formatCurrencyBR(productAdjustmentValue)}</span></div>
            <div className="flex justify-between text-sm mt-1"><span>Materiais ajustados</span><span>{formatCurrencyBR(materialTotal)}</span></div>
            <div className="flex justify-between text-sm mt-1"><span>Mão de Obra</span><span>{formatCurrencyBR(laborCost)}</span></div>
            <div className="flex justify-between text-sm mt-1"><span>Margem ({margin}%)</span><span>{formatCurrencyBR(subtotal * margin / 100)}</span></div>
            <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-primary/20">
              <span>Total</span><span className="text-primary">{formatCurrencyBR(total)}</span>
            </div>
          </div>
        </>
      )}
        </main>
      </div>
    </div>
  );
}
