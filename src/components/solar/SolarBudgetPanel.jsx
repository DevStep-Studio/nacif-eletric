import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUpRight,
  Calculator,
  Check,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Percent,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  SOLAR_MARGIN_PRESETS,
  buildDefaultSolarCaAndServiceItems,
  buildDefaultSolarEquipmentItems,
  buildDetailedSolarBudget,
} from "@/lib/solarBudgetMath";
import { downloadPdfBlob, generateCommercialProposalReport } from "@/lib/solarReportGenerator";
import { authorizePlanExport, stampPdfWithPlanWatermark } from "@/lib/planEnforcement";

const brl = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function BudgetItemsTable({
  title,
  subtitle,
  items,
  onChangeItem,
  onRemoveItem,
  onAddItem,
  accentColor = "#009b84",
  disabled = false,
}) {
  return (
    <div className={`border border-slate-200 bg-white ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: accentColor }} />
            {title}
          </h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {onAddItem && (
          <button
            type="button"
            disabled={disabled}
            onClick={onAddItem}
            className="flex h-7 items-center gap-1 border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 hover:border-[#009b84] hover:text-[#009b84] transition disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> Adicionar Item
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-2 px-3">Descrição</th>
              <th className="py-2 px-2 w-16 text-center">Un.</th>
              <th className="py-2 px-2 w-20 text-right">Qtd.</th>
              <th className="py-2 px-2 w-28 text-right">Preço Unit. (R$)</th>
              <th className="py-2 px-3 w-28 text-right">Subtotal</th>
              <th className="py-2 px-2 w-9"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-slate-50/60 transition">
                <td className="py-1.5 px-3">
                  <Input
                    value={item.name}
                    disabled={disabled}
                    onChange={(e) => onChangeItem(idx, "name", e.target.value)}
                    className="h-7 rounded-none border-transparent bg-transparent px-1 text-xs font-medium text-slate-800 hover:border-slate-200 focus:border-[#00d8b8] focus:bg-white"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <Input
                    value={item.unit}
                    disabled={disabled}
                    onChange={(e) => onChangeItem(idx, "unit", e.target.value)}
                    className="h-7 rounded-none border-slate-200 bg-white px-1 text-center text-[11px] font-semibold text-slate-600"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    disabled={disabled}
                    value={item.quantity}
                    onChange={(e) => onChangeItem(idx, "quantity", Math.max(0, Number(e.target.value) || 0))}
                    className="h-7 rounded-none border-slate-200 bg-white px-2 text-right text-xs font-bold text-slate-900"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={disabled}
                    value={item.unitPrice}
                    onChange={(e) => onChangeItem(idx, "unitPrice", Math.max(0, Number(e.target.value) || 0))}
                    className="h-7 rounded-none border-slate-200 bg-white px-2 text-right text-xs font-bold text-slate-900"
                  />
                </td>
                <td className="py-1.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                  {brl(item.subtotal)}
                </td>
                <td className="py-1.5 px-2 text-center">
                  <button
                    type="button"
                    disabled={disabled || items.length <= 1}
                    onClick={() => onRemoveItem(idx)}
                    className="p-1 text-slate-300 hover:text-rose-600 disabled:opacity-20 transition"
                    title="Remover linha"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SolarBudgetPanel({
  project,
  config,
  sizing,
  onUpdateSolarBudget,
  onSaveProjectBudget,
  saving = false,
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const budget = useMemo(
    () => buildDetailedSolarBudget({ project, config, sizing }),
    [project, config, sizing]
  );

  const savedRaw = config?.solar_budget || {};

  const patchBudget = (patch) => {
    const mergedRaw = {
      ...savedRaw,
      equipmentItems: budget.equipmentItems,
      caItems: budget.caItems,
      serviceItems: budget.serviceItems,
      marginPercent: budget.marginPercent,
      discountBrl: budget.discountBrl,
      useKitTotalOverride: budget.useKitTotalOverride,
      kitTotalOverride: budget.kitTotalOverride,
      validityDays: budget.validityDays,
      selectedPaymentOption: budget.selectedPaymentOption,
      commercialContact: budget.commercialContact,
      ...patch,
    };
    const preview = buildDetailedSolarBudget({
      project,
      config: { ...config, solar_budget: mergedRaw },
      sizing,
    });
    onUpdateSolarBudget?.({ ...mergedRaw, finalTotal: preview.finalTotal });
  };

  const updateListItem = (listKey, list, index, field, value) => {
    const nextList = list.map((item, idx) => (idx === index ? { ...item, [field]: value } : item));
    patchBudget({ [listKey]: nextList });
  };

  const removeListItem = (listKey, list, index) => {
    const nextList = list.filter((_, idx) => idx !== index);
    patchBudget({ [listKey]: nextList });
  };

  const addListItem = (listKey, list, defaults) => {
    patchBudget({
      [listKey]: [...list, { id: `${listKey}_${Date.now()}`, ...defaults }],
    });
  };

  const handleResetDefaults = () => {
    const equip = buildDefaultSolarEquipmentItems({ project, config, sizing });
    const { caItems, serviceItems } = buildDefaultSolarCaAndServiceItems({ project, config, sizing });
    patchBudget({
      equipmentItems: equip,
      caItems,
      serviceItems,
      useKitTotalOverride: false,
      kitTotalOverride: 0,
      discountBrl: 0,
    });
    toast({
      title: "Preços restaurados",
      description: "Tabela recalculada com os quantitativos atuais do projeto.",
    });
  };

  const handleSave = async () => {
    await onSaveProjectBudget?.(budget);
  };

  const handleExportProposalPdf = async () => {
    setGeneratingPdf(true);
    try {
      const auth = await authorizePlanExport({
        projectId: project?.id,
        moduleKey: "solar",
        label: "Proposta Comercial NACIF Energy",
      });
      if (!auth.allowed) return;
      const hydratedConfig = {
        ...config,
        solar_budget: {
          ...savedRaw,
          equipmentItems: budget.equipmentItems,
          caItems: budget.caItems,
          serviceItems: budget.serviceItems,
          marginPercent: budget.marginPercent,
          discountBrl: budget.discountBrl,
          useKitTotalOverride: budget.useKitTotalOverride,
          kitTotalOverride: budget.kitTotalOverride,
          validityDays: budget.validityDays,
          selectedPaymentOption: budget.selectedPaymentOption,
          commercialContact: budget.commercialContact,
        },
      };
      const doc = generateCommercialProposalReport(
        { ...project, investment_brl: budget.finalTotal },
        hydratedConfig,
        sizing
      );
      stampPdfWithPlanWatermark(doc, auth);
      await downloadPdfBlob(doc, `Proposta_Comercial_${String(project?.name || "Solar").replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
      toast({
        title: "Proposta Comercial gerada",
        description: "PDF completo com análise financeira e fluxo de caixa baixado.",
      });
    } catch (err) {
      toast({
        title: "Erro ao gerar proposta",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#F8FAFC] p-5 lg:p-7">
      <div className="mx-auto max-w-[1440px] space-y-5">
        {/* Cabeçalho Minimalista (sem gradiente) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-[#0E1726] text-[#00D8B8]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-slate-950">
                  Orçamento Solar Detalhado
                </h2>
                <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {budget.dcPowerKw.toFixed(2)} kWp · {budget.panelCount} módulos
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Defina o preço do equipamento, serviços de engenharia e a margem solicitada para emitir a proposta.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-9 rounded-none border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Recalcular Itens
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/budget${project?.id ? `?project=${project.id}` : ""}`)}
              className="h-9 rounded-none border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowUpRight className="mr-1.5 h-3.5 w-3.5 text-[#009b84]" /> Módulo Orçamentos
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={handleSave}
              className="h-9 rounded-none border-slate-900 bg-white text-xs font-black text-slate-900 hover:bg-slate-100"
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Salvar no Projeto
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={generatingPdf}
              onClick={handleExportProposalPdf}
              className="h-9 rounded-none bg-[#0E1726] hover:bg-slate-900 text-white text-xs font-black px-4"
            >
              {generatingPdf ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-[#00D8B8]" /> : <Download className="mr-1.5 h-3.5 w-3.5 text-[#00D8B8]" />}
              Gerar Proposta Comercial (PDF)
            </Button>
          </div>
        </div>

        {/* Faixa de 4 KPIs Minimalistas (Sólidos, sem gradiente) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              1. Preço dos Equipamentos (Kit CC)
            </p>
            <p className="mt-1.5 text-xl font-black text-slate-950">{brl(budget.equipmentTotal)}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              {budget.useKitTotalOverride ? "Valor fechado do kit informado" : `${budget.equipmentItems.length} itens no kit solar`} · {budget.equipmentSharePct}% do total
            </p>
          </div>

          <div className="border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              2. Infra CA, Instalação & Engenharia
            </p>
            <p className="mt-1.5 text-xl font-black text-slate-950">{brl(budget.caTotal + budget.servicesTotal)}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">
              CA {brl(budget.caTotal)} + Serviços {brl(budget.servicesTotal)}
            </p>
          </div>

          <div className="border border-[#009b84]/40 bg-[#F2FFFC] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#009b84]">
              3. Margem Solicitada ({budget.marginPercent}%)
            </p>
            <p className="mt-1.5 text-xl font-black text-[#0F4F49]">+ {brl(budget.marginBrl)}</p>
            <p className="mt-1 text-[11px] font-medium text-[#009b84]">
              Sobre custo base de {brl(budget.baseCostTotal)}
            </p>
          </div>

          <div className="border border-[#0E1726] bg-[#0E1726] p-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00D8B8]">
              4. Valor Final da Proposta
            </p>
            <p className="mt-1.5 text-xl font-black text-white">{brl(budget.finalTotal)}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-300">
              {brl(budget.pricePerWp)} / Wp · Payback {budget.financial.paybackYears.toFixed(1)} anos
            </p>
          </div>
        </div>

        {/* Grid Principal: Tabelas de Custos (7 col) + Margem & Viabilidade (5 col) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Esquerda: Equipamentos + Infra CA + Serviços */}
          <div className="xl:col-span-7 space-y-4">
            {/* Controle rápido de Preço do Equipamento (Kit Fechado vs Itemizado) */}
            <div className="border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-[#009b84]" />
                  Preço do Equipamento Solar (Kit Distribuidor)
                </p>
                <p className="text-[11px] text-slate-500">
                  Edite item a item abaixo ou informe diretamente o preço fechado do kit do fornecedor.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patchBudget({ useKitTotalOverride: false })}
                  className={`h-8 px-3 text-xs font-bold border transition ${
                    !budget.useKitTotalOverride
                      ? "border-[#0E1726] bg-[#0E1726] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Detalhado por Item
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patchBudget({
                      useKitTotalOverride: true,
                      kitTotalOverride: budget.kitTotalOverride > 0 ? budget.kitTotalOverride : budget.itemizedEquipmentTotal,
                    })
                  }
                  className={`h-8 px-3 text-xs font-bold border transition ${
                    budget.useKitTotalOverride
                      ? "border-[#009b84] bg-[#009b84] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Preço Fechado do Kit
                </button>
              </div>

              {budget.useKitTotalOverride && (
                <div className="w-full pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-700">
                    Valor total do kit de equipamentos (R$):
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget.kitTotalOverride}
                    onChange={(e) => patchBudget({ kitTotalOverride: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-8 w-44 rounded-none border-slate-300 bg-white text-right text-sm font-black text-slate-950"
                  />
                </div>
              )}
            </div>

            <BudgetItemsTable
              title="Equipamentos Fotovoltaicos (Kit CC)"
              subtitle={`Total: ${brl(budget.equipmentTotal)}`}
              items={budget.equipmentItems}
              disabled={budget.useKitTotalOverride}
              accentColor="#009b84"
              onChangeItem={(idx, field, val) => updateListItem("equipmentItems", budget.equipmentItems, idx, field, val)}
              onRemoveItem={(idx) => removeListItem("equipmentItems", budget.equipmentItems, idx)}
              onAddItem={() =>
                addListItem("equipmentItems", budget.equipmentItems, {
                  name: "Equipamento / Acessório CC",
                  category: "Equipamentos CC",
                  unit: "un",
                  quantity: 1,
                  unitPrice: 250,
                })
              }
            />

            <BudgetItemsTable
              title="Infraestrutura Elétrica CA & Padrão"
              subtitle={`Total Infra CA: ${brl(budget.caTotal)}`}
              items={budget.caItems}
              accentColor="#0D3B82"
              onChangeItem={(idx, field, val) => updateListItem("caItems", budget.caItems, idx, field, val)}
              onRemoveItem={(idx) => removeListItem("caItems", budget.caItems, idx)}
              onAddItem={() =>
                addListItem("caItems", budget.caItems, {
                  name: "Material Elétrico CA",
                  category: "Infraestrutura CA",
                  unit: "un",
                  quantity: 1,
                  unitPrice: 120,
                })
              }
            />

            <BudgetItemsTable
              title="Instalação, Projeto Executivo & Homologação"
              subtitle={`Total Serviços: ${brl(budget.servicesTotal)}`}
              items={budget.serviceItems}
              accentColor="#0E1726"
              onChangeItem={(idx, field, val) => updateListItem("serviceItems", budget.serviceItems, idx, field, val)}
              onRemoveItem={(idx) => removeListItem("serviceItems", budget.serviceItems, idx)}
              onAddItem={() =>
                addListItem("serviceItems", budget.serviceItems, {
                  name: "Serviço Técnico Especializado",
                  category: "Engenharia & Homologação",
                  unit: "sv",
                  quantity: 1,
                  unitPrice: 600,
                })
              }
            />
          </div>

          {/* Direita: Margem Solicitada, Desconto, Resumo e Condições */}
          <div className="xl:col-span-5 space-y-4">
            {/* Margem que a pessoa pede */}
            <div className="border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-[#009b84]" />
                    Margem Comercial Solicitada
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Defina o percentual de margem/BDI desejado sobre o custo total.
                  </p>
                </div>
                <span className="border border-[#009b84]/30 bg-[#F2FFFC] px-2.5 py-1 text-xs font-black text-[#0F4F49]">
                  {budget.marginPercent}%
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {SOLAR_MARGIN_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => patchBudget({ marginPercent: pct })}
                    className={`h-8 border text-xs font-bold transition ${
                      budget.marginPercent === pct
                        ? "border-[#0E1726] bg-[#0E1726] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-[#009b84]"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Margem Personalizada (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="300"
                    step="0.5"
                    value={budget.marginPercent}
                    onChange={(e) => patchBudget({ marginPercent: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })}
                    className="h-9 rounded-none border-slate-300 bg-white text-sm font-black text-slate-950"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Desconto Comercial (R$)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={budget.discountBrl}
                    onChange={(e) => patchBudget({ discountBrl: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-9 rounded-none border-slate-300 bg-white text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Barra minimalista de composição do preço */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex h-2.5 w-full overflow-hidden bg-slate-100">
                  <div style={{ width: `${budget.equipmentSharePct}%`, backgroundColor: "#0E1726" }} />
                  <div style={{ width: `${budget.caAndServicesSharePct}%`, backgroundColor: "#0D3B82" }} />
                  <div style={{ width: `${budget.marginSharePct}%`, backgroundColor: "#00D8B8" }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-slate-600">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 bg-[#0E1726] inline-block" /> Equipamentos ({budget.equipmentSharePct}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 bg-[#0D3B82] inline-block" /> CA + Serviços ({budget.caAndServicesSharePct}%)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 bg-[#00D8B8] inline-block" /> Margem ({budget.marginSharePct}%)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Custo Base (Equipamentos + CA + Serviços)</span>
                  <span className="font-bold text-slate-900">{brl(budget.baseCostTotal)}</span>
                </div>
                <div className="flex justify-between text-[#009b84]">
                  <span>Margem Aplicada ({budget.marginPercent}%)</span>
                  <span className="font-bold">+ {brl(budget.marginBrl)}</span>
                </div>
                {budget.discountBrl > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Desconto Concedido</span>
                    <span className="font-bold">- {brl(budget.discountBrl)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-950">
                  <span>TOTAL PROPOSTA TURNKEY</span>
                  <span>{brl(budget.finalTotal)}</span>
                </div>
              </div>
            </div>

            {/* Indicadores Financeiros & Financiamento (Alimentam a Proposta de 9 páginas) */}
            <div className="border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <FileText className="h-3.5 w-3.5 text-[#009b84]" />
                Viabilidade Financeira & Parcelamento
              </h3>

              <div className="grid grid-cols-3 gap-2">
                <div className="border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Payback</p>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{budget.financial.paybackYears.toFixed(1)} anos</p>
                </div>
                <div className="border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-500">VPL (25 anos)</p>
                  <p className="text-xs font-black text-emerald-700 mt-0.5">{brl(budget.financial.npvBrl)}</p>
                </div>
                <div className="border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-bold uppercase text-slate-500">TIR Estimada</p>
                  <p className="text-xs font-black text-[#009b84] mt-0.5">{budget.financial.irrPct.toFixed(1)}% a.a.</p>
                </div>
              </div>

              <div className="border border-slate-200 divide-y divide-slate-100 text-xs">
                <div className="flex justify-between px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <span>Opção de Pagamento (Proposta)</span>
                  <span>Parcela Estimada</span>
                </div>
                <button
                  type="button"
                  onClick={() => patchBudget({ selectedPaymentOption: "cash" })}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition ${
                    budget.selectedPaymentOption === "cash" ? "bg-[#F2FFFC] font-black text-[#0F4F49]" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {budget.selectedPaymentOption === "cash" && <Check className="h-3.5 w-3.5 text-[#009b84]" />}
                    À vista (Pix / TED / Boleto)
                  </span>
                  <span>{brl(budget.finalTotal)}</span>
                </button>
                {budget.financial.financingOptions.map((opt) => {
                  const key = `${opt.months}x`;
                  const active = budget.selectedPaymentOption === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patchBudget({ selectedPaymentOption: key })}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left transition ${
                        active ? "bg-[#F2FFFC] font-black text-[#0F4F49]" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {active && <Check className="h-3.5 w-3.5 text-[#009b84]" />}
                        Financiamento {opt.months}x (Sem entrada)
                      </span>
                      <span>{brl(opt.installmentBrl)}/mês</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dados Comerciais do Aceite / Contato */}
            <div className="border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
                Dados Comerciais & Assinatura da Proposta
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Validade (dias)</label>
                  <Input
                    type="number"
                    min="1"
                    value={budget.validityDays}
                    onChange={(e) => patchBudget({ validityDays: Math.max(1, Number(e.target.value) || 15) })}
                    className="h-8 rounded-none border-slate-200 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Consultor / Responsável</label>
                  <Input
                    value={budget.commercialContact.responsibleName}
                    onChange={(e) =>
                      patchBudget({
                        commercialContact: { ...budget.commercialContact, responsibleName: e.target.value },
                      })
                    }
                    className="h-8 rounded-none border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Telefone / WhatsApp</label>
                  <Input
                    value={budget.commercialContact.phone}
                    onChange={(e) =>
                      patchBudget({
                        commercialContact: { ...budget.commercialContact, phone: e.target.value },
                      })
                    }
                    className="h-8 rounded-none border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">E-mail Comercial</label>
                  <Input
                    value={budget.commercialContact.email}
                    onChange={(e) =>
                      patchBudget({
                        commercialContact: { ...budget.commercialContact, email: e.target.value },
                      })
                    }
                    className="h-8 rounded-none border-slate-200 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Endereço da Empresa</label>
                <Input
                  value={budget.commercialContact.address}
                  onChange={(e) =>
                    patchBudget({
                      commercialContact: { ...budget.commercialContact, address: e.target.value },
                    })
                  }
                  className="h-8 rounded-none border-slate-200 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
