import { backend } from "../api/backendClient.js";

const pathModule = () => {
  const path = typeof window !== "undefined" ? window.location?.pathname || "" : "";
  if (path.includes("solar")) return "solar";
  if (/panel/.test(path)) return "panel";
  if (/unifilar|diagram|memorial/.test(path)) return "unifilar";
  if (/planta|circuit-editor/.test(path)) return "plant";
  return "budget";
};

/** Server authorization is mandatory. Errors and exhausted quotas never allow export. */
export async function authorizePlanExport(options = {}) {
  try {
    const result = await backend.subscriptions.consumeExportQuota({ ...options, moduleKey: options.moduleKey || pathModule() });
    if (result?.allowed !== true) throw new Error(result?.reason || "Seu plano não permite esta exportação.");
    return result;
  } catch (error) {
    const reason = error?.message || "Não foi possível autorizar a exportação. Tente novamente.";
    if (typeof window !== "undefined" && typeof window.alert === "function") window.alert(reason);
    return { allowed: false, reason };
  }
}

export function stampPdfWithPlanWatermark(doc, authorization = {}) {
  if (!authorization.watermark || !doc?.internal?.pageSize || typeof doc.text !== "function") return doc;
  const current = doc.internal.getCurrentPageInfo?.().pageNumber || 1;
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState?.();
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(authorization.watermark, width / 2, height - 6, { align: "center", maxWidth: width - 16 });
    doc.restoreGraphicsState?.();
  }
  doc.setPage(current);
  return doc;
}

export function stampSvgWithPlanWatermark(source, authorization = {}) {
  if (!authorization.watermark) return source;
  const text = String(authorization.watermark).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return source.replace(/<\/svg>\s*$/, `<text x="50%" y="96%" text-anchor="middle" fill="#777" font-size="14">${text}</text></svg>`);
}

export function printPageWithPlanWatermark(authorization = {}) {
  const label = authorization.watermark;
  const element = label ? document.createElement("div") : null;
  if (element) {
    element.textContent = label;
    element.style.cssText = "position:fixed;bottom:8mm;left:0;width:100%;text-align:center;font:12px sans-serif;color:#777;z-index:2147483647;pointer-events:none";
    document.body.appendChild(element);
    window.addEventListener("afterprint", () => element.remove(), { once: true });
    setTimeout(() => element.remove(), 60000);
  }
  window.print();
}
