/**
 * Motor Financeiro do Módulo de Orçamentos
 * Cálculo de precisão monetária estrita, sem desvios de ponto flutuante,
 * com suporte a descontos, acréscimos, margem BDI, serviços e materiais.
 */

/**
 * Arredondamento financeiro estrito para 2 casas decimais (centavos),
 * prevenindo imperfeições de ponto flutuante binário (ex: 0.1 + 0.2 = 0.30000000000000004).
 */
export function roundMoney(value = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Subtotal do item: Quantidade * Preço Unitário arredondado ao centavo.
 */
export function calcItemSubtotal(qty = 0, unitPrice = 0) {
  const q = Math.max(0, Number(qty) || 0);
  const p = Math.max(0, Number(unitPrice) || 0);
  return roundMoney(q * p);
}

/**
 * Formatação monetária para padrão brasileiro (R$ 1.234,56).
 */
export function formatCurrencyBR(value = 0) {
  const rounded = roundMoney(value);
  return `R$ ${rounded.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formatação de quantidades inteiras ou decimais.
 */
export function formatQtyBR(value = 0) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/**
 * Status comerciais padronizados de orçamentos.
 */
export const BUDGET_STATUS_CONFIG = {
  rascunho: {
    label: "Rascunho",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  },
  enviado: {
    label: "Enviado",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300",
  },
  aprovado: {
    label: "Aprovado",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  recusado: {
    label: "Recusado",
    badgeClass: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300",
  },
  cancelado: {
    label: "Cancelado",
    badgeClass: "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400",
  },
  // Aliases capitalizados para robustez
  Rascunho: {
    label: "Rascunho",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
  },
  Enviado: {
    label: "Enviado",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300",
  },
  Aprovado: {
    label: "Aprovado",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  Recusado: {
    label: "Recusado",
    badgeClass: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300",
  },
  Cancelado: {
    label: "Cancelado",
    badgeClass: "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

/**
 * Consolidação e Composição Financeira Completa do Orçamento.
 * Ordem estrita de cálculo:
 * 1. Base Materiais = Soma dos itens de materiais
 * 2. Variação Produtos (%) = Base Materiais * (productAdjustment / 100)
 * 3. Materiais Ajustados = Base Materiais + Variação Produtos
 * 4. Serviços = Soma dos itens de serviços (ou laborCost como fallback)
 * 5. Subtotal Bruto = Materiais Ajustados + Serviços
 * 6. Desconto = percentual sobre Subtotal Bruto ou valor fixo (limitado ao Subtotal)
 * 7. Base com Desconto = Subtotal Bruto - Desconto
 * 8. Acréscimo / Taxas = percentual sobre Base com Desconto ou valor fixo
 * 9. Base com Acréscimo = Base com Desconto + Acréscimo
 * 10. Margem BDI = Base com Acréscimo * (margin / 100)
 * 11. Total da Proposta = Base com Acréscimo + Margem BDI
 */
export function calculateBudgetFinancials(options = {}) {
  const {
    materials = [],
    services = [],
    productAdjustment,
    productAdjustmentPercent,
    product_adjustment_percent,
    laborCost = 0,
    margin,
    marginPercent,
    margin_percent,
    discountType,
    discount_type,
    discountValue,
    discount_value,
    surchargeType,
    surcharge_type,
    surchargeValue,
    surcharge_value,
  } = options;

  const effectiveProductAdjustment = Number(
    productAdjustment ?? productAdjustmentPercent ?? product_adjustment_percent ?? 0
  );
  const effectiveMargin = Number(margin ?? marginPercent ?? margin_percent ?? 0);
  const effectiveDiscountType = discountType ?? discount_type ?? "percent";
  const effectiveDiscountVal = Number(discountValue ?? discount_value ?? 0);
  const effectiveSurchargeType = surchargeType ?? surcharge_type ?? "percent";
  const effectiveSurchargeVal = Number(surchargeValue ?? surcharge_value ?? 0);
  // 1. Materiais
  let baseMaterialTotal = 0;
  const normalizedMaterials = (Array.isArray(materials) ? materials : []).map((m, idx) => {
    const qty = Math.max(0, Number(m.qty ?? m.quantity) || 0);
    const price = Math.max(0, Number(m.price ?? m.unit_price) || 0);
    const subtotal = calcItemSubtotal(qty, price);
    baseMaterialTotal = roundMoney(baseMaterialTotal + subtotal);
    return {
      ...m,
      id: m.id || `mat-${idx}`,
      qty,
      price,
      subtotal,
    };
  });

  const productAdjustmentPct = effectiveProductAdjustment;
  const productAdjustmentValue = roundMoney(baseMaterialTotal * (productAdjustmentPct / 100));
  const materialTotal = roundMoney(Math.max(0, baseMaterialTotal + productAdjustmentValue));

  // 2. Serviços / Mão de Obra
  let calculatedServicesTotal = 0;
  const hasDetailedServices = Array.isArray(services) && services.length > 0;
  const normalizedServices = (hasDetailedServices ? services : []).map((s, idx) => {
    const qty = Math.max(0, Number(s.qty ?? s.quantity) || 1);
    const price = Math.max(0, Number(s.price ?? s.unit_price) || 0);
    const subtotal = calcItemSubtotal(qty, price);
    calculatedServicesTotal = roundMoney(calculatedServicesTotal + subtotal);
    return {
      ...s,
      id: s.id || `srv-${idx}`,
      qty,
      price,
      subtotal,
    };
  });

  const servicesTotal = hasDetailedServices
    ? calculatedServicesTotal
    : roundMoney(Math.max(0, Number(laborCost) || 0));

  // 3. Subtotal Bruto
  const grossTotal = roundMoney(materialTotal + servicesTotal);

  // 4. Desconto
  const rawDiscountVal = Math.max(0, Number(effectiveDiscountVal) || 0);
  let discountAmount = 0;
  if (effectiveDiscountType === "percent") {
    const pct = Math.min(100, rawDiscountVal);
    discountAmount = roundMoney(grossTotal * (pct / 100));
  } else {
    discountAmount = roundMoney(Math.min(grossTotal, rawDiscountVal));
  }
  const baseAfterDiscount = roundMoney(Math.max(0, grossTotal - discountAmount));

  // 5. Acréscimo / Taxas / BDI Adicional
  const rawSurchargeVal = Math.max(0, Number(effectiveSurchargeVal) || 0);
  let surchargeAmount = 0;
  if (effectiveSurchargeType === "percent") {
    surchargeAmount = roundMoney(baseAfterDiscount * (rawSurchargeVal / 100));
  } else {
    surchargeAmount = roundMoney(rawSurchargeVal);
  }
  const baseAfterSurcharge = roundMoney(baseAfterDiscount + surchargeAmount);

  // 6. Margem de Lucro / BDI
  const marginPct = Math.max(0, effectiveMargin);
  const marginAmount = roundMoney(baseAfterSurcharge * (marginPct / 100));

  // 7. Total Final
  const total = roundMoney(baseAfterSurcharge + marginAmount);

  return {
    materials: normalizedMaterials,
    services: normalizedServices,
    baseMaterialTotal,
    productAdjustmentPct,
    productAdjustmentValue,
    materialTotal,
    servicesTotal,
    laborCost: servicesTotal,
    grossTotal,
    subtotal: grossTotal,
    discountType: discountType === "fixed" ? "fixed" : "percent",
    discountValue: rawDiscountVal,
    discountAmount,
    baseAfterDiscount,
    surchargeType: surchargeType === "fixed" ? "fixed" : "percent",
    surchargeValue: rawSurchargeVal,
    surchargeAmount,
    baseAfterSurcharge,
    marginPct,
    marginAmount,
    marginBrl: marginAmount,
    total,
  };
}
