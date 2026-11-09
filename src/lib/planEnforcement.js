/**
 * Autoriza e consome a cota de exportação técnica da conta.
 * Durante a fase de testes com aplicativo 100% liberado, retorna acesso irrestrito e sem marca d'água.
 */
export async function authorizePlanExport(_options = {}) {
  return {
    allowed: true,
    isAcademic: false,
    isFreeRestricted: false,
    watermark: null,
    remaining: Number.POSITIVE_INFINITY,
    limit: Number.POSITIVE_INFINITY,
    planCode: "completo",
  };
}

/**
 * Carimbo de marca d'água desativado durante a fase de testes com acesso total liberado.
 */
export function stampPdfWithPlanWatermark(doc, _exportAuth = {}) {
  return doc;
}
