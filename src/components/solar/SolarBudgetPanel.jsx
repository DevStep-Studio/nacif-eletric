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
  Package,
  Percent,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  TrendingUp,
  Wrench,
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
  icon: Icon = Package,
  disabled = false,
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[#E5EBF1] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-opacity ${
        disabled ? "opacity-55 pointer-events-none" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#E5EBF1] bg-white px-5 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E1FCEF] text-[#00A86B]">
            <Icon className="h-4 w-4 stroke-[2.1]" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[13.5px] font-bold text-[#101828] leading-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11px] font-medium text-[#64748B] leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {onAddItem && (
          <button
            type="button"
            disabled={disabled}
            onClick={onAddItem}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-3 text-[11px] font-bold text-[#101828] transition hover:border-[#00D98A] hover:bg-[#E1FCEF] hover:text-[#006F51] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar Item
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E5EBF1] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B]">
              <th className="py-2 pl-4 pr-2">Descrição</th>
              <th className="py-2 px-1.5 w-14 text-center">Un.</th>
              <th className="py-2 px-1.5 w-[72px] text-right">Qtd.</th>
              <th className="py-2 px-1.5 w-24 text-right">Preço Unit. (R$)</th>
              <th className="py-2 pl-2 pr-3 w-24 text-right">Subtotal</th>
              <th className="py-2 pr-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="group transition hover:bg-[#F6F9FC]/75">
                <td className="py-1.5 pl-4 pr-2">
                  <Input
                    value={item.name}
                    disabled={disabled}
                    onChange={(e) => onChangeItem(idx, "name", e.target.value)}
                    className="h-8 rounded-md border-transparent bg-transparent px-1.5 text-xs font-semibold text-[#101828] hover:border-[#E5EBF1] hover:bg-white focus:border-[#00D98A] focus:bg-white"
                  />
                </td>
                <td className="py-1.5 px-1">
                  <Input
                    value={item.unit}
                    disabled={disabled}
                    onChange={(e) => onChangeItem(idx, "unit", e.target.value)}
                    className="h-8 rounded-md border-[#E5EBF1] bg-[#F6F9FC] px-1 text-center text-[11px] font-semibold text-[#64748B] focus:border-[#00D98A] focus:bg-white"
                  />
                </td>
                <td className="py-1.5 px-1">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    disabled={disabled}
                    value={item.quantity}
                    onChange={(e) => onChangeItem(idx, "quantity", Math.max(0, Number(e.target.value) || 0))}
                    className="h-8 rounded-md border-[#E5EBF1] bg-[#F6F9FC] px-2 text-right text-xs font-bold text-[#101828] tabular-nums focus:border-[#00D98A] focus:bg-white"
                  />
                </td>
                <td className="py-1.5 px-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={disabled}
                    value={item.unitPrice}
                    onChange={(e) => onChangeItem(idx, "unitPrice", Math.max(0, Number(e.target.value) || 0))}
                    className="h-8 rounded-md border-[#E5EBF1] bg-[#F6F9FC] px-2 text-right text-xs font-bold text-[#101828] tabular-nums focus:border-[#00D98A] focus:bg-white"
                  />
                </td>
                <td className="py-1.5 pl-2 pr-3 text-right font-extrabold text-[#101828] tabular-nums whitespace-nowrap">
                  {brl(item.subtotal)}
                </td>
                <td className="py-1.5 pr-2 text-center">
                  <button
                    type="button"
                    disabled={disabled || items.length <= 1}
                    onClick={() => onRemoveItem(idx)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-20 transition"
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
    <div className="flex-1 h-full overflow-y-auto bg-[#F6F9FC] p-4 sm:p-5 lg:p-6">
      <div className="mx-auto max-w-[1440px] space-y-4">
        {/* Cabeçalho Operacional no Estilo da Home */}
        <header className="flex flex-col gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1FCEF] text-[#00A86B]">
              <Calculator className="h-5 w-5 stroke-[2.1]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[19px] font-extrabold tracking-tight text-[#101828] leading-tight">
                  Orçamento Solar Detalhado
                </h2>
                <span className="rounded-md border border-[#BEEAD2] bg-[#E1FCEF] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#006F51]">
                  {budget.dcPowerKw.toFixed(2)} kWp · {budget.panelCount} módulos
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                Defina o preço do equipamento, serviços de engenharia e a margem solicitada para emitir a proposta.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] shadow-2xs hover:bg-[#F6F9FC]"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-[#64748B]" /> Recalcular Itens
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/budget${project?.id ? `?project=${project.id}` : ""}`)}
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3 text-xs font-semibold text-[#101828] shadow-2xs hover:bg-[#F6F9FC]"
            >
              <ArrowUpRight className="mr-1.5 h-3.5 w-3.5 text-[#00A86B]" /> Módulo Orçamentos
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={handleSave}
              className="h-9 rounded-xl border-[#E5EBF1] bg-white px-3.5 text-xs font-bold text-[#101828] shadow-2xs hover:border-[#00D98A] hover:bg-[#F6F9FC]"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-[#00A86B]" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5 text-[#00A86B]" />
              )}
              Salvar no Projeto
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={generatingPdf}
              onClick={handleExportProposalPdf}
              className="h-9 rounded-xl bg-[#00D98A] px-4 text-xs font-extrabold text-[#031923] shadow-[0_4px_14px_rgba(0,217,138,0.28)] hover:bg-[#00C87F] transition"
            >
              {generatingPdf ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Gerar Proposta Comercial (PDF)
            </Button>
          </div>
        </header>

        {/* Faixa de 4 Indicadores no Padrão da Home */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1FCEF] text-[#00A86B]">
              <Package className="h-4.5 w-4.5 stroke-[2.1]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-[#64748B]">
                Equipamentos (Kit CC)
              </p>
              <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-[#101828] tabular-nums leading-tight">
                {brl(budget.equipmentTotal)}
              </p>
              <p className="mt-0.5 truncate text-[10.5px] font-medium text-[#64748B]">
                {budget.useKitTotalOverride
                  ? "Valor fechado informado"
                  : `${budget.equipmentItems.length} itens · ${budget.equipmentSharePct}% do total`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E1FCEF] text-[#00A86B]">
              <Wrench className="h-4.5 w-4.5 stroke-[2.1]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-[#64748B]">
                Infra CA, Instalação & Engenharia
              </p>
              <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-[#101828] tabular-nums leading-tight">
                {brl(budget.caTotal + budget.servicesTotal)}
              </p>
              <p className="mt-0.5 truncate text-[10.5px] font-medium text-[#64748B] tabular-nums">
                CA {brl(budget.caTotal)} + Serviços {brl(budget.servicesTotal)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#BEEAD2] bg-[#F2FCF7] px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00D98A]/20 text-[#006F51]">
              <Percent className="h-4.5 w-4.5 stroke-[2.1]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-[#006F51]">
                Margem Solicitada ({budget.marginPercent}%)
              </p>
              <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-[#031923] tabular-nums leading-tight">
                + {brl(budget.marginBrl)}
              </p>
              <p className="mt-0.5 truncate text-[10.5px] font-medium text-[#006F51]/85 tabular-nums">
                Sobre custo base de {brl(budget.baseCostTotal)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[18px] border border-[#00D98A]/25 bg-[#022A25] px-4 py-3.5 text-white shadow-[0_10px_24px_rgba(2,38,42,0.14)]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00F0A0]/16 text-[#00F0A0]">
              <TrendingUp className="h-4.5 w-4.5 stroke-[2.1]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-[#00F0A0]">
                Valor Final da Proposta
              </p>
              <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight text-white tabular-nums leading-tight">
                {brl(budget.finalTotal)}
              </p>
              <p className="mt-0.5 truncate text-[10.5px] font-medium text-emerald-100/80 tabular-nums">
                {brl(budget.pricePerWp)} / Wp · Payback {budget.financial.paybackYears.toFixed(1)} anos
              </p>
            </div>
          </div>
        </section>

        {/* Grid Principal: Tabelas de Custos (7 col) + Margem & Viabilidade (5 col) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Esquerda: Equipamentos + Infra CA + Serviços */}
          <div className="xl:col-span-7 space-y-4">
            {/* Controle rápido de Preço do Equipamento (Kit Fechado vs Itemizado) */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <div className="flex items-center gap-2.5 min-w-0 sm:flex-1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E1FCEF] text-[#00A86B]">
                  <DollarSign className="h-4 w-4 stroke-[2.1]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-[#101828] leading-tight">
                    Preço do Equipamento Solar
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-[#64748B] leading-tight">
                    Edite por item ou informe o valor fechado do kit.
                  </p>
                </div>
              </div>

              <div className="inline-flex w-fit shrink-0 rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => patchBudget({ useKitTotalOverride: false })}
                  className={`rounded-lg px-3 py-1.5 transition whitespace-nowrap ${
                    !budget.useKitTotalOverride
                      ? "bg-[#00D98A] text-[#031923] shadow-2xs"
                      : "text-[#64748B] hover:text-[#101828]"
                  }`}
                >
                  Detalhado por Item
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patchBudget({
                      useKitTotalOverride: true,
                      kitTotalOverride:
                        budget.kitTotalOverride > 0 ? budget.kitTotalOverride : budget.itemizedEquipmentTotal,
                    })
                  }
                  className={`rounded-lg px-3 py-1.5 transition whitespace-nowrap ${
                    budget.useKitTotalOverride
                      ? "bg-[#00D98A] text-[#031923] shadow-2xs"
                      : "text-[#64748B] hover:text-[#101828]"
                  }`}
                >
                  Preço Fechado do Kit
                </button>
              </div>

              {budget.useKitTotalOverride && (
                <div className="w-full pt-3 border-t border-[#E5EBF1] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[#101828]">
                    Valor total do kit de equipamentos (R$):
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget.kitTotalOverride}
                    onChange={(e) => patchBudget({ kitTotalOverride: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-9 w-44 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-right text-sm font-extrabold text-[#101828] tabular-nums focus:border-[#00D98A] focus:bg-white"
                  />
                </div>
              )}
            </div>

            <BudgetItemsTable
              title="Equipamentos Fotovoltaicos (Kit CC)"
              subtitle={`Total: ${brl(budget.equipmentTotal)}`}
              items={budget.equipmentItems}
              disabled={budget.useKitTotalOverride}
              icon={Package}
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
              icon={DollarSign}
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
              icon={Wrench}
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
            <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <div className="flex items-center justify-between gap-2 border-b border-[#E5EBF1] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E1FCEF] text-[#00A86B]">
                    <Percent className="h-4 w-4 stroke-[2.1]" />
                  </span>
                  <div>
                    <h3 className="text-[13.5px] font-bold text-[#101828] leading-tight">
                      Margem Comercial Solicitada
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-[#64748B] leading-tight">
                      Defina o percentual de margem/BDI desejado sobre o custo total.
                    </p>
                  </div>
                </div>
                <span className="rounded-md border border-[#BEEAD2] bg-[#E1FCEF] px-2.5 py-1 text-xs font-extrabold text-[#006F51] tabular-nums">
                  {budget.marginPercent}%
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SOLAR_MARGIN_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => patchBudget({ marginPercent: pct })}
                    className={`h-9 rounded-[10px] border text-xs font-bold tabular-nums transition ${
                      budget.marginPercent === pct
                        ? "border-[#00D98A] bg-[#DDFCF0] text-[#006F51] font-extrabold"
                        : "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B] hover:border-[#00D98A]/60 hover:bg-white hover:text-[#101828]"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-0.5">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">
                    Margem Personalizada (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="300"
                    step="0.5"
                    value={budget.marginPercent}
                    onChange={(e) => patchBudget({ marginPercent: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })}
                    className="h-9 rounded-[10px] border-[#E5EBF1] bg-[#F6F9FC] text-sm font-extrabold text-[#101828] tabular-nums focus:border-[#00D98A] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">
                    Desconto Comercial (R$)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={budget.discountBrl}
                    onChange={(e) => patchBudget({ discountBrl: Math.max(0, Number(e.target.value) || 0) })}
                    className="h-9 rounded-[10px] border-[#E5EBF1] bg-[#F6F9FC] text-sm font-bold text-[#101828] tabular-nums focus:border-[#00D98A] focus:bg-white"
                  />
                </div>
              </div>

              {/* Barra minimalista de composição do preço */}
              <div className="space-y-2 pt-2 border-t border-[#E5EBF1]">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div style={{ width: `${budget.equipmentSharePct}%`, backgroundColor: "#031923" }} />
                  <div style={{ width: `${budget.caAndServicesSharePct}%`, backgroundColor: "#5B4AE8" }} />
                  <div style={{ width: `${budget.marginSharePct}%`, backgroundColor: "#00D98A" }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-semibold text-[#64748B] tabular-nums">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-[#031923] inline-block" /> Equipamentos ({budget.equipmentSharePct}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-[#5B4AE8] inline-block" /> CA + Serviços ({budget.caAndServicesSharePct}%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-[#00D98A] inline-block" /> Margem ({budget.marginSharePct}%)
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-[#E5EBF1] bg-[#F8FAFC] p-3.5 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>Custo Base (Equipamentos + CA + Serviços)</span>
                  <span className="font-bold text-[#101828] tabular-nums">{brl(budget.baseCostTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-[#006F51]">
                  <span>Margem Aplicada ({budget.marginPercent}%)</span>
                  <span className="font-bold tabular-nums">+ {brl(budget.marginBrl)}</span>
                </div>
                {budget.discountBrl > 0 && (
                  <div className="flex justify-between font-semibold text-rose-600">
                    <span>Desconto Concedido</span>
                    <span className="font-bold tabular-nums">- {brl(budget.discountBrl)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#E5EBF1] pt-2 text-sm font-extrabold text-[#101828]">
                  <span>Total Proposta Turnkey</span>
                  <span className="tabular-nums">{brl(budget.finalTotal)}</span>
                </div>
              </div>
            </div>

            {/* Indicadores Financeiros & Financiamento (Alimentam a Proposta de 9 páginas) */}
            <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <div className="flex items-center gap-2.5 border-b border-[#E5EBF1] pb-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E1FCEF] text-[#00A86B]">
                  <FileText className="h-4 w-4 stroke-[2.1]" />
                </span>
                <h3 className="text-[13.5px] font-bold text-[#101828]">
                  Viabilidade Financeira & Parcelamento
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <p className="text-[10.5px] font-semibold text-[#64748B]">Payback</p>
                  <p className="mt-0.5 text-sm font-extrabold text-[#101828] tabular-nums">
                    {budget.financial.paybackYears.toFixed(1)} anos
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <p className="text-[10.5px] font-semibold text-[#64748B]">VPL (25 anos)</p>
                  <p
                    className={`mt-0.5 text-sm font-extrabold tabular-nums ${
                      budget.financial.npvBrl >= 0 ? "text-[#006F51]" : "text-rose-600"
                    }`}
                  >
                    {brl(budget.financial.npvBrl)}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <p className="text-[10.5px] font-semibold text-[#64748B]">TIR Estimada</p>
                  <p className="mt-0.5 text-sm font-extrabold text-[#00A86B] tabular-nums">
                    {budget.financial.irrPct.toFixed(1)}% a.a.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#E5EBF1] divide-y divide-[#F1F5F9] text-xs">
                <div className="flex justify-between px-3.5 py-2 bg-[#F8FAFC] text-[10.5px] font-semibold text-[#64748B]">
                  <span>Opção de Pagamento (Proposta)</span>
                  <span>Parcela Estimada</span>
                </div>
                <button
                  type="button"
                  onClick={() => patchBudget({ selectedPaymentOption: "cash" })}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition ${
                    budget.selectedPaymentOption === "cash"
                      ? "bg-[#E1FCEF]/75 font-bold text-[#006F51]"
                      : "text-[#101828] hover:bg-[#F6F9FC]"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {budget.selectedPaymentOption === "cash" && <Check className="h-3.5 w-3.5 text-[#00A86B]" />}
                    À vista (Pix / TED / Boleto)
                  </span>
                  <span className="font-bold tabular-nums">{brl(budget.finalTotal)}</span>
                </button>
                {budget.financial.financingOptions.map((opt) => {
                  const key = `${opt.months}x`;
                  const active = budget.selectedPaymentOption === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patchBudget({ selectedPaymentOption: key })}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition ${
                        active ? "bg-[#E1FCEF]/75 font-bold text-[#006F51]" : "text-[#101828] hover:bg-[#F6F9FC]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {active && <Check className="h-3.5 w-3.5 text-[#00A86B]" />}
                        Financiamento {opt.months}x (Sem entrada)
                      </span>
                      <span className="font-bold tabular-nums">{brl(opt.installmentBrl)}/mês</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dados Comerciais do Aceite / Contato */}
            <div className="rounded-2xl border border-[#E5EBF1] bg-white p-5 space-y-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <h3 className="text-[13.5px] font-bold text-[#101828] border-b border-[#E5EBF1] pb-2.5">
                Dados Comerciais & Assinatura da Proposta
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">Validade (dias)</label>
                  <Input
                    type="number"
                    min="1"
                    value={budget.validityDays}
                    onChange={(e) => patchBudget({ validityDays: Math.max(1, Number(e.target.value) || 15) })}
                    className="h-9 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs font-bold text-[#101828] tabular-nums focus:border-[#00D98A] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">Consultor / Responsável</label>
                  <Input
                    value={budget.commercialContact.responsibleName}
                    onChange={(e) =>
                      patchBudget({
                        commercialContact: { ...budget.commercialContact, responsibleName: e.target.value },
                      })
                    }
                    className="h-9 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs text-[#101828] focus:border-[#00D98A] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">Telefone / WhatsApp</label>
                  <Input
                    value={budget.commercialContact.phone}
                    onChange={(e) =>
                      patchBudget({
                        commercialContact: { ...budget.commercialContact, phone: e.target.value },
                      })
                    }
                    className="h-9 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs text-[#101828] focus:border-[#00D98A] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">E-mail Comercial</label>
                  <Input
                    value={budget.commercialContact.email}
                    onChange={(e) =>
                      patchBudget({
                        commercialContact: { ...budget.commercialContact, email: e.target.value },
                      })
                    }
                    className="h-9 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs text-[#101828] focus:border-[#00D98A] focus:bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1.5">Endereço da Empresa</label>
                <Input
                  value={budget.commercialContact.address}
                  onChange={(e) =>
                    patchBudget({
                      commercialContact: { ...budget.commercialContact, address: e.target.value },
                    })
                  }
                  className="h-9 rounded-xl border-[#E5EBF1] bg-[#F6F9FC] text-xs text-[#101828] focus:border-[#00D98A] focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
