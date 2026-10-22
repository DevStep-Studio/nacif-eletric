import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import {
  FileText,
  Printer,
  Upload,
  ChevronDown,
  FolderOpen,
  Plus,
  Sparkles,
  Trash2,
  Sun,
  Download,
  FileSpreadsheet,
  Copy,
  Save,
  RefreshCw,
  CheckCircle2,
  Wrench,
  Percent,
  Calendar,
  PlusCircle,
  Package,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { openHTMLPrint, PAPER_SIZES } from "@/lib/printUtils";
import { downloadBudgetPDF, downloadBudgetCSV } from "@/lib/budgetExportUtils";
import {
  calculateBudgetFinancials,
  formatCurrencyBR,
  BUDGET_STATUS_CONFIG,
  calcItemSubtotal,
} from "@/lib/budgetFinancialMath";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/PageHeader";
import { DEFAULT_LOGO_URL } from "@/lib/brandingDefaults";
import MaterialProductThumb from "@/components/MaterialProductThumb";
import {
  CATEGORY_STYLES,
  getMaterialDataUriForPrint,
} from "@/lib/materialProductCatalog";
import {
  buildProjectBudgetMaterials,
  estimateLocalMaterialPrice,
} from "@/lib/projectBudgetMaterials";
import brandLogoEnergy from "@/assets/brand-logo-principal.png";
import brandMarkEnergy from "@/assets/brand-mark-principal.png";

function BrandLogoUploaderDisplay({ logoUrl }) {
  const [hasError, setHasError] = useState(false);
  const isCustom = logoUrl && typeof logoUrl === "string" && logoUrl.startsWith("data:");

  if (isCustom && !hasError) {
    return (
      <img
        src={logoUrl}
        className="h-5 max-w-[120px] object-contain"
        alt="Logo personalizada"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <img
      src={brandLogoEnergy}
      className="h-5 max-w-[130px] object-contain"
      alt="NACIF Energy"
    />
  );
}

function ProjectThumbBadge({ project, size = "md", customLogo = null }) {
  const [hasError, setHasError] = useState(false);
  const rawLogo = customLogo || project?.logo_url || project?.logoUrl || project?.project_logo || project?.logo;
  const isSolar = String(project?.project_type || "").toLowerCase().includes("solar");

  const sizeClasses = size === "lg" ? "h-14 w-14" : "h-12 w-12";
  const iconSize = size === "lg" ? "h-7 w-7" : "h-5 w-5";

  if (rawLogo && typeof rawLogo === "string" && !hasError) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#CDEFE8] bg-white p-1.5 ${sizeClasses}`}>
        <img
          src={rawLogo}
          alt={project?.name || "Logo"}
          className="h-full w-full object-contain"
          onError={() => setHasError(true)}
        />
      </span>
    );
  }

  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl border border-[#CDEFE8] bg-[#F2FFFC] ${sizeClasses}`}>
      {isSolar ? (
        <Sun className={`${iconSize} text-amber-500`} />
      ) : (
        <img
          src={brandMarkEnergy}
          alt="NACIF Energy"
          className={`${iconSize} object-contain`}
        />
      )}
    </span>
  );
}

const formatUnit = (unit = "un") => {
  if (!unit || unit === "un") return "un.";
  if (unit === "m") return "m";
  return unit;
};

// Exemplos de serviços elétricos rápidos
const QUICK_SERVICE_TEMPLATES = [
  { name: "Montagem e estruturação de QDC (Quadro de Distribuição)", unit: "vb.", price: 650 },
  { name: "Passagem de condutores e fiação de circuitos", unit: "m", price: 6.5 },
  { name: "Instalação e ligação de tomadas e interruptores", unit: "pt.", price: 25 },
  { name: "Sistema de aterramento e instalação de DPS", unit: "vb.", price: 450 },
  { name: "Emissão de ART / Laudo Técnico de Conformidade", unit: "un.", price: 350 },
  { name: "Instalação de luminárias e pontos de luz", unit: "pt.", price: 30 },
];

export default function BudgetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("project");

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [project, setProject] = useState(null);
  const [loadingProject, setLoadingProject] = useState(false);

  // Lista de orçamentos do projeto ativo
  const [projectBudgets, setProjectBudgets] = useState([]);
  const [activeBudgetId, setActiveBudgetId] = useState(null);
  const [loadingBudgets, setLoadingBudgets] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle"); // 'idle' | 'saving' | 'saved' | 'error'

  // Dados do orçamento ativo em edição
  const [budgetName, setBudgetName] = useState("");
  const [budgetStatus, setBudgetStatus] = useState("rascunho");
  const [materials, setMaterials] = useState([]);
  const [services, setServices] = useState([]);
  const [margin, setMargin] = useState(30);
  const [productAdjustment, setProductAdjustment] = useState(0);
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [surchargeType, setSurchargeType] = useState("fixed");
  const [surchargeValue, setSurchargeValue] = useState(0);

  // Termos comerciais
  const [validityDays, setValidityDays] = useState("15 dias");
  const [paymentTerms, setPaymentTerms] = useState("50% entrada + 50% na conclusão");
  const [executionTime, setExecutionTime] = useState("5 a 10 dias úteis");
  const [notes, setNotes] = useState("");

  // Logo da empresa
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO_URL);

  // Adição de material manual com IA
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualPriceInput, setManualPriceInput] = useState("");
  const [manualEstimating, setManualEstimating] = useState(false);

  // Adição de novo serviço
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceQty, setNewServiceQty] = useState(1);
  const [newServiceUnit, setNewServiceUnit] = useState("vb.");
  const [newServicePrice, setNewServicePrice] = useState(350);

  // Filtro de busca na lista de projetos
  const [projectSearch, setProjectSearch] = useState("");

  // Referência para controlar se o orçamento foi modificado
  const hasUnsavedChanges = useRef(false);

  // Cálculos financeiros com alta precisão
  const financials = useMemo(() => {
    return calculateBudgetFinancials({
      materials,
      services,
      productAdjustmentPercent: productAdjustment,
      marginPercent: margin,
      discountType,
      discountValue,
      surchargeType,
      surchargeValue,
    });
  }, [materials, services, productAdjustment, margin, discountType, discountValue, surchargeType, surchargeValue]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Carregar lista de projetos ao montar
  useEffect(() => {
    setLoadingProjects(true);
    backend.entities.Project.list("-updated_date", 100)
      .then((list) => {
        const safeList = Array.isArray(list) ? list : [];
        setProjects(safeList);
        if (!projectId && safeList.length > 0) {
          const storedId = typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : null;
          const target = safeList.find((p) => p.id === storedId) || safeList[0];
          if (target?.id) {
            try { window.localStorage.setItem("voltai_active_project_id", target.id); } catch {}
            navigate(`/budget?project=${target.id}`, { replace: true });
          }
        }
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  // Carregar projeto ativo
  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    try { window.localStorage.setItem("voltai_active_project_id", projectId); } catch {}
    setLoadingProject(true);
    backend.entities.Project.get(projectId)
      .then(setProject)
      .catch((err) => {
        console.error("Erro ao carregar projeto no orçamento:", err);
        setProject(null);
      })
      .finally(() => setLoadingProject(false));
  }, [projectId]);

  // Carregar ou inicializar orçamentos do projeto
  useEffect(() => {
    if (!project || !project.id) return;

    let isMounted = true;
    setLoadingBudgets(true);

    backend.entities.Budget.filter({ project_id: project.id })
      .then(async (budgets) => {
        if (!isMounted) return;
        const list = Array.isArray(budgets) ? budgets : [];

        if (list.length > 0) {
          setProjectBudgets(list);
          const chosen = list.find((b) => b.id === activeBudgetId) || list[0];
          loadBudgetDataIntoForm(chosen);
        } else {
          // Inicializar primeiro orçamento a partir do projeto
          const initial = createInitialBudgetFromProject(project);
          const created = await backend.entities.Budget.create(initial);
          if (isMounted) {
            setProjectBudgets([created]);
            loadBudgetDataIntoForm(created);
          }
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar orçamentos:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingBudgets(false);
      });

    return () => { isMounted = false; };
  }, [project?.id]);

  // Função para criar o payload do primeiro orçamento do projeto
  const createInitialBudgetFromProject = (proj) => {
    const { materials: projMaterials } = buildProjectBudgetMaterials(proj, { productAdjustment: 0 });
    const initialServices = [
      {
        id: `srv-${Date.now()}-1`,
        name: "Mão de obra e execução técnica especializada",
        qty: 1,
        unit: "vb.",
        price: 800,
      },
    ];

    const initialFinancials = calculateBudgetFinancials({
      materials: projMaterials,
      services: initialServices,
      productAdjustmentPercent: 0,
      marginPercent: 30,
      discountType: "fixed",
      discountValue: 0,
      surchargeType: "fixed",
      surchargeValue: 0,
    });

    return {
      name: `Proposta Comercial — ${proj.name || "Projeto"}`,
      project_id: proj.id,
      project_name: proj.name,
      client_name: proj.client_name,
      status: "rascunho",
      margin_percent: 30,
      product_adjustment_percent: 0,
      discount_type: "fixed",
      discount_value: 0,
      surcharge_type: "fixed",
      surcharge_value: 0,
      validity_days: "15 dias",
      payment_terms: "50% de entrada + 50% na conclusão da obra",
      execution_time: "5 a 10 dias úteis",
      notes: "Proposta técnica conforme normas vigentes ABNT NBR 5410:2004 e padrões de segurança.",
      materials: projMaterials,
      services: initialServices,
      ...initialFinancials,
    };
  };

  // Carregar dados de um orçamento para os states
  const loadBudgetDataIntoForm = (b) => {
    if (!b) return;
    setActiveBudgetId(b.id);
    setBudgetName(b.name || "Orçamento sem nome");
    setBudgetStatus(b.status || "rascunho");
    setMaterials(Array.isArray(b.materials) ? b.materials : []);
    setServices(Array.isArray(b.services) ? b.services : []);
    setMargin(b.margin_percent ?? 30);
    setProductAdjustment(b.product_adjustment_percent ?? 0);
    setDiscountType(b.discount_type || "fixed");
    setDiscountValue(b.discount_value ?? 0);
    setSurchargeType(b.surcharge_type || "fixed");
    setSurchargeValue(b.surcharge_value ?? 0);
    setValidityDays(b.validity_days || "15 dias");
    setPaymentTerms(b.payment_terms || "50% entrada + 50% na conclusão");
    setExecutionTime(b.execution_time || "5 a 10 dias úteis");
    setNotes(b.notes || "");
    hasUnsavedChanges.current = false;
  };

  // Salvar o orçamento ativo
  const handleSaveBudget = async () => {
    if (!activeBudgetId || !project) return;
    setSaveStatus("saving");

    try {
      const payload = {
        name: budgetName,
        status: budgetStatus,
        materials,
        services,
        margin_percent: margin,
        product_adjustment_percent: productAdjustment,
        discount_type: discountType,
        discount_value: discountValue,
        surcharge_type: surchargeType,
        surcharge_value: surchargeValue,
        validity_days: validityDays,
        payment_terms: paymentTerms,
        execution_time: executionTime,
        notes,
        ...financials,
      };

      const updated = await backend.entities.Budget.update(activeBudgetId, payload);
      setProjectBudgets((prev) => prev.map((b) => (b.id === activeBudgetId ? updated : b)));

      // Sincronizar total do orçamento no projeto se aprovado ou orçamento principal
      await backend.entities.Project.update(project.id, {
        budget_total: financials.total,
        total_budget: financials.total,
      });

      setSaveStatus("saved");
      hasUnsavedChanges.current = false;
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Erro ao salvar orçamento:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  };

  // Criar novo orçamento para o projeto
  const handleCreateNewBudget = async () => {
    if (!project) return;
    const count = projectBudgets.length + 1;
    const newName = `Orçamento #${count} — Opção ${String.fromCharCode(64 + count)}`;

    const newBudgetData = {
      ...createInitialBudgetFromProject(project),
      name: newName,
    };

    try {
      const created = await backend.entities.Budget.create(newBudgetData);
      setProjectBudgets((prev) => [created, ...prev]);
      loadBudgetDataIntoForm(created);
    } catch (err) {
      console.error("Erro ao criar novo orçamento:", err);
      alert("Não foi possível criar um novo orçamento.");
    }
  };

  // Duplicar o orçamento ativo
  const handleDuplicateBudget = async () => {
    if (!activeBudgetId) return;
    try {
      const duplicated = await backend.entities.Budget.duplicate(activeBudgetId);
      setProjectBudgets((prev) => [duplicated, ...prev]);
      loadBudgetDataIntoForm(duplicated);
    } catch (err) {
      console.error("Erro ao duplicar orçamento:", err);
      alert("Não foi possível duplicar este orçamento.");
    }
  };

  // Excluir o orçamento ativo
  const handleDeleteBudget = async () => {
    if (!activeBudgetId) return;
    const confirmDelete = window.confirm(`Tem certeza que deseja excluir o orçamento "${budgetName}"?`);
    if (!confirmDelete) return;

    try {
      await backend.entities.Budget.delete(activeBudgetId);
      const remaining = projectBudgets.filter((b) => b.id !== activeBudgetId);
      setProjectBudgets(remaining);

      if (remaining.length > 0) {
        loadBudgetDataIntoForm(remaining[0]);
      } else {
        // Se excluiu o último, cria um novo padrão
        const fresh = createInitialBudgetFromProject(project);
        const created = await backend.entities.Budget.create(fresh);
        setProjectBudgets([created]);
        loadBudgetDataIntoForm(created);
      }
    } catch (err) {
      console.error("Erro ao excluir orçamento:", err);
      alert("Não foi possível excluir o orçamento.");
    }
  };

  // Sincronizar itens de materiais a partir dos circuitos atuais do projeto
  const handleSyncWithProject = () => {
    if (!project) return;
    const confirmSync = window.confirm(
      "Deseja resincronizar os materiais a partir dos circuitos técnicos do projeto? Itens manuais e serviços existentes serão preservados."
    );
    if (!confirmSync) return;

    const { materials: syncedMaterials } = buildProjectBudgetMaterials(project, { productAdjustment });
    // Preservar itens manuais existentes no orçamento atual
    const manualOnly = materials.filter((m) => m.manual || m.source === "ia-estimado" || m.source === "manual");
    const merged = [...syncedMaterials, ...manualOnly];
    setMaterials(merged);
    hasUnsavedChanges.current = true;
  };

  // Modificar quantidade ou preço de um material
  const handleMaterialChange = (index, field, value) => {
    setMaterials((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      const numeric = Number(value);
      if (field === "qty") {
        item.qty = Math.max(0, isNaN(numeric) ? 0 : numeric);
      } else if (field === "price") {
        item.price = Math.max(0, isNaN(numeric) ? 0 : numeric);
      }
      next[index] = item;
      return next;
    });
    hasUnsavedChanges.current = true;
  };

  // Remover um material da lista
  const handleRemoveMaterial = (index) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
    hasUnsavedChanges.current = true;
  };

  // Adicionar item manual de material
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

  const addManualMaterialItem = async () => {
    const name = manualName.trim();
    if (!name) return;
    setManualEstimating(true);
    try {
      let price = manualPriceInput ? Number(manualPriceInput) : null;
      if (!price || isNaN(price)) {
        price = await estimateManualPrice(name);
      }
      const newItem = {
        name,
        qty: Math.max(1, Number(manualQty) || 1),
        unit: "un.",
        price: Math.round(price * 100) / 100,
        category: "manual",
        manual: true,
        source: "manual",
      };
      setMaterials((prev) => [...prev, newItem]);
      setManualName("");
      setManualQty(1);
      setManualPriceInput("");
      hasUnsavedChanges.current = true;
    } finally {
      setManualEstimating(false);
    }
  };

  // Manipulação de serviços
  const handleAddService = (itemToAdd = null) => {
    const name = itemToAdd ? itemToAdd.name : newServiceName.trim();
    if (!name) return;

    const newService = {
      id: `srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      qty: itemToAdd ? 1 : Math.max(1, Number(newServiceQty) || 1),
      unit: itemToAdd ? itemToAdd.unit : newServiceUnit,
      price: itemToAdd ? itemToAdd.price : Math.max(0, Number(newServicePrice) || 0),
    };

    setServices((prev) => [...prev, newService]);
    if (!itemToAdd) {
      setNewServiceName("");
      setNewServiceQty(1);
      setNewServicePrice(350);
    }
    hasUnsavedChanges.current = true;
  };

  const handleServiceChange = (id, field, value) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const numeric = Number(value);
        if (field === "qty") {
          return { ...s, qty: Math.max(0, isNaN(numeric) ? 0 : numeric) };
        }
        if (field === "price") {
          return { ...s, price: Math.max(0, isNaN(numeric) ? 0 : numeric) };
        }
        if (field === "name") {
          return { ...s, name: value };
        }
        if (field === "unit") {
          return { ...s, unit: value };
        }
        return s;
      })
    );
    hasUnsavedChanges.current = true;
  };

  const handleRemoveService = (id) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    hasUnsavedChanges.current = true;
  };

  // Ações de Impressão e Exportação
  const handlePrint = (size) => {
    try {
      openHTMLPrint({
        paperSize: size,
        projectName: project?.name,
        documentTitle: budgetName || `Orçamento — ${project?.name || "Projeto"}`,
        subtitle: `Proposta Comercial · NACIF Solutions Eletric · NBR 5410:2004 · Status: ${BUDGET_STATUS_CONFIG[budgetStatus]?.label || "Rascunho"}`,
        logoUrl: logoUrl && logoUrl.startsWith("data:") ? logoUrl : DEFAULT_LOGO_URL,
        items: materials.map((m) => ({
          name: m.name,
          qty: m.qty,
          unit: m.unit,
          price: m.price,
          category: m.category,
          manual: m.manual,
          imageUrl: getMaterialDataUriForPrint(m.name),
        })),
        services: services.map((s) => ({
          name: s.name,
          qty: s.qty,
          unit: s.unit,
          price: s.price,
        })),
        totals: {
          baseMaterialTotal: financials.baseMaterialTotal,
          productAdjustment,
          productAdjustmentValue: financials.productAdjustmentValue,
          materialTotal: financials.materialTotal,
          servicesTotal: financials.servicesTotal,
          laborCost: financials.servicesTotal,
          subtotal: financials.subtotal,
          discountAmount: financials.discountAmount,
          surchargeAmount: financials.surchargeAmount,
          marginBrl: financials.marginBrl,
          margin,
          total: financials.total,
        },
        commercialTerms: {
          validityDays,
          paymentTerms,
          executionTime,
          notes,
        },
        projectInfo: {
          clientName: project?.client_name,
          address: project?.address,
        },
      });
    } catch (err) {
      console.error("Erro ao imprimir orçamento:", err);
      alert("Não foi possível abrir o diálogo de impressão. Tente a opção 'Baixar PDF'.");
    }
  };

  const handleDownloadPDF = () => {
    if (!project) return;
    try {
      downloadBudgetPDF({
        project,
        budgetName,
        budgetStatus,
        materials,
        services,
        totals: financials,
        commercialTerms: {
          validityDays,
          paymentTerms,
          executionTime,
          notes,
        },
        logoUrl: logoUrl && logoUrl.startsWith("data:") ? logoUrl : DEFAULT_LOGO_URL,
      });
    } catch (err) {
      console.error("Erro ao gerar PDF do orçamento:", err);
      alert("Erro ao gerar PDF do orçamento. Por favor, tente novamente.");
    }
  };

  const handleDownloadCSV = () => {
    if (!project) return;
    try {
      downloadBudgetCSV({
        project,
        budgetName,
        materials,
        services,
        totals: financials,
        commercialTerms: {
          validityDays,
          paymentTerms,
          executionTime,
        },
      });
    } catch (err) {
      console.error("Erro ao exportar CSV do orçamento:", err);
      alert("Erro ao exportar CSV do orçamento.");
    }
  };

  const selectProject = (id) => {
    if (id) {
      try { window.localStorage.setItem("voltai_active_project_id", id); } catch {}
      navigate(`/budget?project=${id}`, { replace: true });
    }
  };

  // Filtragem de projetos na barra lateral
  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects;
    const q = projectSearch.toLowerCase();
    return projects.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.client_name && p.client_name.toLowerCase().includes(q))
    );
  }, [projects, projectSearch]);

  const activeStatusConfig = BUDGET_STATUS_CONFIG[budgetStatus] || BUDGET_STATUS_CONFIG.rascunho;

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
      <PageHeader
        icon={FileText}
        title="Orçamentos & Propostas"
        subtitle={
          project?.name
            ? `Elaboração e gestão financeira para ${project.name}`
            : "Gerencie orçamentos detalhados com precisão matemática, materiais e serviços."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-[11px] border border-dashed border-[#BCEEE5] bg-white hover:bg-[#F2FFFC] text-xs font-bold text-[#5f6877] transition shadow-xs"
              title="Carregar logotipo personalizado para a proposta/orçamento"
            >
              <Upload className="w-3.5 h-3.5 text-primary shrink-0" />
              <BrandLogoUploaderDisplay logoUrl={logoUrl} />
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>

            {project && (
              <>
                <button
                  type="button"
                  onClick={handleSaveBudget}
                  disabled={saveStatus === "saving"}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold shadow-sm transition ${
                    saveStatus === "saved"
                      ? "bg-emerald-600 text-white"
                      : saveStatus === "error"
                      ? "bg-red-600 text-white"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                  title="Salvar alterações no orçamento ativo"
                >
                  {saveStatus === "saving" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : saveStatus === "saved" ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {saveStatus === "saving"
                      ? "Salvando..."
                      : saveStatus === "saved"
                      ? "Salvo!"
                      : "Salvar Orçamento"}
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs font-bold hover:bg-secondary/50 shadow-xs transition">
                      <Download className="w-3.5 h-3.5 text-primary" />
                      <span>Exportar</span>
                      <ChevronDown className="w-3 h-3 ml-0.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleDownloadPDF} className="cursor-pointer font-medium">
                      <Download className="w-4 h-4 mr-2 text-primary" />
                      <span>Baixar Proposta em PDF</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownloadCSV} className="cursor-pointer font-medium">
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                      <span>Baixar Planilha (Excel/CSV)</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handlePrint("A4")} className="cursor-pointer font-medium">
                      <Printer className="w-4 h-4 mr-2 text-slate-600" />
                      <span>Imprimir em A4</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-secondary/50 transition">
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.keys(PAPER_SIZES).map((size) => (
                      <DropdownMenuItem key={size} onClick={() => handlePrint(size)} className="cursor-pointer">
                        <Printer className="w-4 h-4 mr-2" />
                        Formato {size}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        }
      />

      <div className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Painel lateral: Projetos */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-[#0f172a]">Projetos</h3>
                <p className="text-xs font-semibold text-muted-foreground">Selecione para ver orçamentos</p>
              </div>
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>

            <div className="mb-3">
              <Input
                placeholder="Buscar projeto..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="h-8 text-xs bg-slate-50 border-border/70"
              />
            </div>

            {loadingProjects ? (
              <div className="py-8 text-center text-xs font-semibold text-muted-foreground">Carregando projetos...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs font-semibold text-muted-foreground">
                Nenhum projeto encontrado.
              </div>
            ) : (
              <div className="max-h-[580px] space-y-2 overflow-y-auto pr-1">
                {filteredProjects.map((item) => {
                  const active = item.id === projectId;
                  const circuitCount = Array.isArray(item.circuits) ? item.circuits.length : 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectProject(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                        active
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border/60 bg-white hover:border-primary/40 hover:bg-secondary/40"
                      }`}
                    >
                      <ProjectThumbBadge project={item} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black text-[#0f172a]">{item.name || "Projeto sem nome"}</span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground">
                          {item.client_name || "Sem cliente"} · {circuitCount} cto{circuitCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Conteúdo Principal do Orçamento */}
        <main className="min-w-0 space-y-6">
          {!project ? (
            <div className="rounded-2xl border border-border/50 bg-card p-12 text-center text-muted-foreground">
              {loadingProject ? "Carregando projeto e orçamentos..." : "Selecione um projeto na lista lateral para gerenciar os orçamentos."}
            </div>
          ) : (
            <>
              {/* Barra de Seleção / Gestão de Orçamentos do Projeto */}
              <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <ProjectThumbBadge
                      project={project}
                      size="lg"
                      customLogo={logoUrl && logoUrl.startsWith("data:") ? logoUrl : null}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                          Projeto Selecionado
                        </span>
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {projectBudgets.length} proposta{projectBudgets.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <h2 className="truncate text-lg font-black text-[#0f172a]">{project.name}</h2>
                      <p className="truncate text-xs font-semibold text-muted-foreground">
                        {project.client_name ? `Cliente: ${project.client_name}` : "Cliente não informado"}
                        {project.voltage ? ` · ${project.voltage}V` : ""}
                        {project.supply_type ? ` · ${project.supply_type}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Ações de Orçamento: Novo, Duplicar, Excluir, Sincronizar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreateNewBudget}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/15 text-xs font-bold text-primary transition"
                      title="Criar novo orçamento para este projeto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nova Proposta</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDuplicateBudget}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-xs font-semibold text-[#334155] transition"
                      title="Duplicar orçamento ativo como cópia independente"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Duplicar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncWithProject}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-slate-50 text-xs font-semibold text-[#334155] transition"
                      title="Atualizar materiais a partir dos circuitos técnicos do projeto"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-primary" />
                      <span>Sincronizar</span>
                    </button>

                    {projectBudgets.length > 1 && (
                      <button
                        type="button"
                        onClick={handleDeleteBudget}
                        className="inline-flex items-center justify-center p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition"
                        title="Excluir este orçamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Abas / Switcher de Orçamentos do Projeto */}
                {projectBudgets.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground mr-1">Propostas:</span>
                    {projectBudgets.map((b) => {
                      const isActive = b.id === activeBudgetId;
                      const statusConf = BUDGET_STATUS_CONFIG[b.status] || BUDGET_STATUS_CONFIG.rascunho;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => loadBudgetDataIntoForm(b)}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            isActive
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <span className="truncate max-w-[180px]">{b.name}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider ${statusConf.badgeClass}`}>
                            {statusConf.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cabeçalho de Edição do Orçamento Ativo: Título e Status */}
              <div className="grid gap-4 sm:grid-cols-[1fr_200px] rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">Título do Orçamento / Proposta</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={budgetName}
                      onChange={(e) => {
                        setBudgetName(e.target.value);
                        hasUnsavedChanges.current = true;
                      }}
                      className="font-black text-base text-[#0f172a]"
                      placeholder="Ex: Proposta Comercial Inicial"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">Status do Orçamento</Label>
                  <select
                    value={budgetStatus}
                    onChange={(e) => {
                      setBudgetStatus(e.target.value);
                      hasUnsavedChanges.current = true;
                    }}
                    className={`w-full h-10 px-3 rounded-lg border text-xs font-black appearance-none cursor-pointer ${activeStatusConfig.badgeClass}`}
                  >
                    {Object.entries(BUDGET_STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key} className="bg-white text-slate-900">
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Seção 1: Lista de Materiais */}
              <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xs">
                <div className="flex items-center justify-between gap-3 border-b border-border/50 p-5 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[#0f172a] flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      1. Materiais & Componentes
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      Quantitativos, unidades e preços unitários congelados para esta proposta.
                    </p>
                  </div>
                  <span className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                    {materials.length} itens · {formatCurrencyBR(financials.materialTotal)}
                  </span>
                </div>

                {/* Formulário de inclusão rápida de material manual */}
                <div className="border-b border-border/40 bg-slate-50/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_80px_130px_130px]">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Nome do material</Label>
                      <Input
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Ex: Disjuntor bipolar 32A DIN, Eletroduto 3/4..."
                        className="h-9 text-xs"
                        onKeyDown={(e) => { if (e.key === "Enter") addManualMaterialItem(); }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Qtd.</Label>
                      <Input
                        type="number"
                        min="1"
                        value={manualQty}
                        onChange={(e) => setManualQty(Number(e.target.value))}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Preço Unit. (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Auto (IA)"
                        value={manualPriceInput}
                        onChange={(e) => setManualPriceInput(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={addManualMaterialItem}
                        disabled={!manualName.trim() || manualEstimating}
                        className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
                      >
                        {manualEstimating ? <Sparkles className="h-3.5 w-3.5 animate-pulse" /> : <Plus className="h-3.5 w-3.5" />}
                        <span>{manualEstimating ? "Estimando..." : "Adicionar"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cabeçalho da Tabela de Materiais */}
                <div className="hidden grid-cols-[minmax(220px,1fr)_80px_70px_120px_110px_45px] gap-2 border-b border-border/50 bg-[#F8FAFC] px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground md:grid">
                  <span>Material / Descrição</span>
                  <span className="text-center">Qtd.</span>
                  <span className="text-center">Unid.</span>
                  <span className="text-right">Unitário (R$)</span>
                  <span className="text-right">Subtotal</span>
                  <span className="text-center">Ação</span>
                </div>

                {/* Linhas de Materiais */}
                <div className="divide-y divide-border/40 max-h-[500px] overflow-y-auto">
                  {materials.length === 0 ? (
                    <div className="p-8 text-center text-xs font-semibold text-muted-foreground">
                      Nenhum material incluído neste orçamento. Adicione manualmente acima ou clique em "Sincronizar".
                    </div>
                  ) : (
                    materials.map((m, index) => {
                      const normCategory = String(m.category || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                      const badgeConfig = CATEGORY_STYLES[normCategory] || CATEGORY_STYLES.material;
                      const lineSubtotal = calcItemSubtotal(m.qty, m.price);

                      return (
                        <div
                          key={`${m.name}-${index}`}
                          className="grid gap-2 px-4 py-2.5 text-xs md:grid-cols-[minmax(220px,1fr)_80px_70px_120px_110px_45px] md:items-center md:px-5 hover:bg-slate-50/60 transition"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <MaterialProductThumb material={m} size="compact" />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate font-extrabold text-[#0f172a]">{m.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`inline-flex items-center rounded border px-1 py-0.2 text-[8px] font-black uppercase ${badgeConfig.badgeClass}`}>
                                  {badgeConfig.label}
                                </span>
                                {m.manual && (
                                  <span className="inline-flex rounded border border-primary/20 bg-primary/10 px-1 py-0.2 text-[8px] font-black uppercase text-primary">
                                    Manual
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-center">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={m.qty}
                              onChange={(e) => handleMaterialChange(index, "qty", e.target.value)}
                              className="h-7 text-xs text-center font-bold"
                            />
                          </div>

                          <div className="text-center font-bold text-muted-foreground text-xs">
                            {formatUnit(m.unit)}
                          </div>

                          <div className="flex items-center justify-end">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={m.price}
                              onChange={(e) => handleMaterialChange(index, "price", e.target.value)}
                              className="h-7 text-xs text-right font-bold"
                            />
                          </div>

                          <div className="text-right font-black text-slate-800 text-xs">
                            {formatCurrencyBR(lineSubtotal)}
                          </div>

                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterial(index)}
                              className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition"
                              title="Remover material"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Subtotais de Materiais */}
                <div className="border-t border-border/50 bg-[#FCFEFF] px-5 py-3 text-xs flex flex-wrap justify-between items-center gap-4">
                  <div className="text-muted-foreground">
                    Materiais base: <span className="font-bold text-slate-800">{formatCurrencyBR(financials.baseMaterialTotal)}</span>
                    {productAdjustment !== 0 && (
                      <span className="ml-3">
                        Variação ({productAdjustment}%):{" "}
                        <span className={`font-bold ${productAdjustment > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {formatCurrencyBR(financials.productAdjustmentValue)}
                        </span>
                      </span>
                    )}
                  </div>
                  <div>
                    Subtotal Materiais:{" "}
                    <span className="text-sm font-black text-slate-900">{formatCurrencyBR(financials.materialTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Seção 2: Serviços & Mão de Obra Especializada */}
              <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xs">
                <div className="flex items-center justify-between gap-3 border-b border-border/50 p-5 pb-4">
                  <div>
                    <h3 className="font-extrabold text-[#0f172a] flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-primary" />
                      2. Serviços & Mão de Obra
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      Discriminação técnica de serviços, montagem, laudos e horas especializadas.
                    </p>
                  </div>
                  <span className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                    {services.length} serviços · {formatCurrencyBR(financials.servicesTotal)}
                  </span>
                </div>

                {/* Templates Rápidos de Serviços */}
                <div className="border-b border-border/40 bg-slate-50/70 p-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-muted-foreground mr-1">Sugestões rápidas:</span>
                    {QUICK_SERVICE_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAddService(tmpl)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:border-primary/50 hover:bg-primary/5 text-[11px] font-medium text-slate-700 transition"
                      >
                        <PlusCircle className="w-3 h-3 text-primary" />
                        <span>{tmpl.name}</span>
                        <span className="text-muted-foreground">({formatCurrencyBR(tmpl.price)})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formulário de Novo Serviço Customizado */}
                <div className="border-b border-border/40 bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_80px_90px_130px_120px]">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Descrição do Serviço</Label>
                      <Input
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        placeholder="Ex: Instalação e passagem de fiação..."
                        className="h-9 text-xs"
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddService(); }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Qtd.</Label>
                      <Input
                        type="number"
                        min="1"
                        value={newServiceQty}
                        onChange={(e) => setNewServiceQty(Number(e.target.value))}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Unidade</Label>
                      <select
                        value={newServiceUnit}
                        onChange={(e) => setNewServiceUnit(e.target.value)}
                        className="w-full h-9 px-2 rounded-md border border-input text-xs bg-white font-medium"
                      >
                        <option value="vb.">vb. (Verba)</option>
                        <option value="h">h (Hora)</option>
                        <option value="un.">un. (Item)</option>
                        <option value="pt.">pt. (Ponto)</option>
                        <option value="m">m (Metro)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Valor Unit. (R$)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(Number(e.target.value))}
                        className="h-9 text-xs font-bold"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => handleAddService()}
                        disabled={!newServiceName.trim()}
                        className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Adicionar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabela de Serviços */}
                <div className="hidden grid-cols-[minmax(240px,1fr)_80px_70px_120px_110px_45px] gap-2 border-b border-border/50 bg-[#F8FAFC] px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground md:grid">
                  <span>Serviço / Descrição Técnica</span>
                  <span className="text-center">Qtd.</span>
                  <span className="text-center">Unid.</span>
                  <span className="text-right">Unitário (R$)</span>
                  <span className="text-right">Subtotal</span>
                  <span className="text-center">Ação</span>
                </div>

                <div className="divide-y divide-border/40">
                  {services.length === 0 ? (
                    <div className="p-6 text-center text-xs font-semibold text-muted-foreground">
                      Nenhum serviço cadastrado. Adicione acima ou utilize as sugestões rápidas.
                    </div>
                  ) : (
                    services.map((s) => {
                      const lineSubtotal = calcItemSubtotal(s.qty, s.price);
                      return (
                        <div
                          key={s.id}
                          className="grid gap-2 px-4 py-2.5 text-xs md:grid-cols-[minmax(240px,1fr)_80px_70px_120px_110px_45px] md:items-center md:px-5 hover:bg-slate-50/60 transition"
                        >
                          <div className="min-w-0">
                            <Input
                              value={s.name}
                              onChange={(e) => handleServiceChange(s.id, "name", e.target.value)}
                              className="h-7 text-xs font-bold"
                            />
                          </div>

                          <div className="flex items-center justify-center">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              value={s.qty}
                              onChange={(e) => handleServiceChange(s.id, "qty", e.target.value)}
                              className="h-7 text-xs text-center font-bold"
                            />
                          </div>

                          <div className="text-center font-bold text-muted-foreground text-xs">
                            <select
                              value={s.unit}
                              onChange={(e) => handleServiceChange(s.id, "unit", e.target.value)}
                              className="h-7 px-1 rounded border border-input text-xs bg-white font-medium"
                            >
                              <option value="vb.">vb.</option>
                              <option value="h">h</option>
                              <option value="un.">un.</option>
                              <option value="pt.">pt.</option>
                              <option value="m">m</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-end">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={s.price}
                              onChange={(e) => handleServiceChange(s.id, "price", e.target.value)}
                              className="h-7 text-xs text-right font-bold"
                            />
                          </div>

                          <div className="text-right font-black text-slate-800 text-xs">
                            {formatCurrencyBR(lineSubtotal)}
                          </div>

                          <div className="flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveService(s.id)}
                              className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition"
                              title="Remover serviço"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-border/50 bg-[#FCFEFF] px-5 py-3 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground font-semibold">Total de Mão de Obra e Serviços:</span>
                  <span className="text-sm font-black text-slate-900">{formatCurrencyBR(financials.servicesTotal)}</span>
                </div>
              </div>

              {/* Seção 3: Condições Comerciais & Prazos */}
              <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-xs">
                <h3 className="font-extrabold text-[#0f172a] flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-primary" />
                  3. Condições Comerciais & Prazos
                </h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">Validade da Proposta</Label>
                    <Input
                      value={validityDays}
                      onChange={(e) => {
                        setValidityDays(e.target.value);
                        hasUnsavedChanges.current = true;
                      }}
                      placeholder="Ex: 15 dias"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">Condições de Pagamento</Label>
                    <Input
                      value={paymentTerms}
                      onChange={(e) => {
                        setPaymentTerms(e.target.value);
                        hasUnsavedChanges.current = true;
                      }}
                      placeholder="Ex: 50% entrada + 50% na conclusão"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">Prazo de Execução</Label>
                    <Input
                      value={executionTime}
                      onChange={(e) => {
                        setExecutionTime(e.target.value);
                        hasUnsavedChanges.current = true;
                      }}
                      placeholder="Ex: 5 a 10 dias úteis"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">Observações / Escopo da Proposta</Label>
                  <Input
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      hasUnsavedChanges.current = true;
                    }}
                    placeholder="Instruções adicionais, restrições de garantia ou detalhamento do escopo comercial..."
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Seção 4: Ajustes Financeiros, Descontos, Acréscimos e Margem BDI */}
              <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-xs">
                <h3 className="font-extrabold text-[#0f172a] flex items-center gap-2 mb-4">
                  <Percent className="w-4 h-4 text-primary" />
                  4. Ajustes Financeiros, BDI e Descontos
                </h3>

                <div className="grid gap-4 sm:grid-cols-4">
                  {/* Variação Produtos (%) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">Variação Produtos (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={productAdjustment}
                      onChange={(e) => {
                        setProductAdjustment(Number(e.target.value));
                        hasUnsavedChanges.current = true;
                      }}
                      className="text-xs font-bold"
                    />
                    <p className="text-[10px] text-muted-foreground">Ajuste global inflacionário ou regional</p>
                  </div>

                  {/* Margem / BDI (%) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">Margem BDI (%)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={margin}
                      onChange={(e) => {
                        setMargin(Number(e.target.value));
                        hasUnsavedChanges.current = true;
                      }}
                      className="text-xs font-bold text-primary"
                    />
                    <p className="text-[10px] text-muted-foreground">Bonificação e Despesas Indiretas</p>
                  </div>

                  {/* Desconto */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-muted-foreground">Desconto</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType((t) => (t === "fixed" ? "percent" : "fixed"));
                          hasUnsavedChanges.current = true;
                        }}
                        className="text-[10px] font-extrabold text-primary hover:underline"
                      >
                        {discountType === "fixed" ? "Mudar para %" : "Mudar para R$"}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step={discountType === "fixed" ? "1" : "0.5"}
                        value={discountValue}
                        onChange={(e) => {
                          setDiscountValue(Number(e.target.value));
                          hasUnsavedChanges.current = true;
                        }}
                        className="text-xs font-bold pr-8"
                      />
                      <span className="absolute right-2.5 top-2.5 text-xs font-bold text-muted-foreground">
                        {discountType === "fixed" ? "R$" : "%"}
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-600 font-bold">
                      - {formatCurrencyBR(financials.discountAmount)}
                    </p>
                  </div>

                  {/* Acréscimos / Taxas */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-muted-foreground">Acréscimos / Taxas</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setSurchargeType((t) => (t === "fixed" ? "percent" : "fixed"));
                          hasUnsavedChanges.current = true;
                        }}
                        className="text-[10px] font-extrabold text-primary hover:underline"
                      >
                        {surchargeType === "fixed" ? "Mudar para %" : "Mudar para R$"}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step={surchargeType === "fixed" ? "1" : "0.5"}
                        value={surchargeValue}
                        onChange={(e) => {
                          setSurchargeValue(Number(e.target.value));
                          hasUnsavedChanges.current = true;
                        }}
                        className="text-xs font-bold pr-8"
                      />
                      <span className="absolute right-2.5 top-2.5 text-xs font-bold text-muted-foreground">
                        {surchargeType === "fixed" ? "R$" : "%"}
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-600 font-bold">
                      + {formatCurrencyBR(financials.surchargeAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quadro Resumo Financeiro & Consolidação */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-white border-2 border-primary/30 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Consolidação Financeira da Proposta</h3>
                    <p className="text-xs font-semibold text-muted-foreground">
                      Cálculos em conformidade com as regras financeiras do projeto
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${activeStatusConfig.badgeClass}`}>
                    Status: {activeStatusConfig.label}
                  </span>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-muted-foreground text-xs">
                      <span>Materiais Base:</span>
                      <span className="font-semibold text-slate-800">{formatCurrencyBR(financials.baseMaterialTotal)}</span>
                    </div>
                    {productAdjustment !== 0 && (
                      <div className="flex justify-between text-muted-foreground text-xs">
                        <span>Variação de Produtos ({productAdjustment}%):</span>
                        <span className="font-semibold text-slate-800">{formatCurrencyBR(financials.productAdjustmentValue)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold">
                      <span>Materiais Ajustados:</span>
                      <span className="text-slate-900">{formatCurrencyBR(financials.materialTotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span>Serviços & Mão de Obra:</span>
                      <span className="text-slate-900">{formatCurrencyBR(financials.servicesTotal)}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-primary/20 pt-2 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>Subtotal Bruto:</span>
                      <span>{formatCurrencyBR(financials.subtotal)}</span>
                    </div>
                    {financials.discountAmount > 0 && (
                      <div className="flex justify-between text-xs font-bold text-emerald-600">
                        <span>Desconto ({discountType === "percent" ? `${discountValue}%` : "Fixo"}):</span>
                        <span>- {formatCurrencyBR(financials.discountAmount)}</span>
                      </div>
                    )}
                    {financials.surchargeAmount > 0 && (
                      <div className="flex justify-between text-xs font-bold text-amber-600">
                        <span>Acréscimos / Taxas ({surchargeType === "percent" ? `${surchargeValue}%` : "Fixo"}):</span>
                        <span>+ {formatCurrencyBR(financials.surchargeAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Margem BDI ({margin}%):</span>
                      <span className="font-semibold text-slate-800">{formatCurrencyBR(financials.marginBrl)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t-2 border-primary/20">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-extrabold text-muted-foreground block">
                      Valor Total da Proposta
                    </span>
                    <span className="text-2xl font-black text-primary">
                      {formatCurrencyBR(financials.total)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveBudget}
                      disabled={saveStatus === "saving"}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-sm transition"
                    >
                      <Save className="w-3.5 h-3.5 text-primary" />
                      <span>{saveStatus === "saving" ? "Salvando..." : "Salvar Alterações"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 shadow-sm transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Proposta em PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
