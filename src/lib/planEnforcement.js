import { toast } from "sonner";
import { backend } from "../api/backendClient.js";
import { resolveEffectiveSubscription } from "./subscriptionPlans.js";

/**
 * Autoriza e consome a cota de exportação técnica da conta.
 * NUNCA bloqueia a exportação de dados pessoais LGPD (porta de saída garantida por lei).
 */
export async function authorizePlanExport({
  projectId = null,
  format = "PDF",
  label = "Exportação Técnica",
} = {}) {
  try {
    const response = await backend.subscriptions.consumeExportQuota({
      projectId,
      format,
      label,
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("voltai:user-updated"));
    }

    if (!response?.allowed) {
      const msg = response?.reason || "Limite de exportações mensais atingido para o seu plano.";
      try {
        toast.error("Limite de exportação atingido", {
          description: `${msg} Faça upgrade para continuar exportando sem restrições.`,
          duration: 6000,
        });
      } catch {}
      return {
        allowed: false,
        isAcademic: false,
        isFreeRestricted: false,
        watermark: null,
        remaining: 0,
        limit: response?.limit ?? 0,
        reason: msg,
      };
    }

    return {
      allowed: true,
      isAcademic: Boolean(response.isAcademic),
      isFreeRestricted: Boolean(response.isFreeRestricted),
      watermark: response.watermark || null,
      remaining: response.remaining,
      limit: response.limit,
      planCode: response.planCode,
    };
  } catch (error) {
    const errorMsg = error?.message || "Não foi possível autorizar a exportação neste momento.";
    try {
      toast.error("Exportação bloqueada", {
        description: errorMsg,
        duration: 6000,
      });
    } catch {}

    return {
      allowed: false,
      isAcademic: false,
      isFreeRestricted: false,
      watermark: null,
      remaining: 0,
      limit: 0,
      reason: errorMsg,
    };
  }
}

/**
 * Aplica carimbo/marca d'água oficial em todas as páginas de um documento jsPDF
 * para planos com restrição técnica (Nacif Estudante e Avaliação Gratuita).
 */
export function stampPdfWithPlanWatermark(doc, exportAuth = {}) {
  if (!doc || typeof doc.getNumberOfPages !== "function") return doc;

  const isAcademic = Boolean(exportAuth.isAcademic);
  const isFree = Boolean(exportAuth.isFreeRestricted);

  if (!isAcademic && !isFree && !exportAuth.watermark) {
    return doc;
  }

  const watermarkText =
    exportAuth.watermark ||
    (isAcademic
      ? "VERSÃO ACADÊMICA — NACIF ESTUDANTE — USO EXCLUSIVAMENTE EDUCACIONAL — PROIBIDO USO COMERCIAL"
      : "VERSÃO DE AVALIAÇÃO GRATUITA — NACIF ENERGY — UPGRADE NECESSÁRIO PARA USO PROFISSIONAL");

  const totalPages = doc.getNumberOfPages();

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Faixa superior/inferior discreta de identificação
    doc.saveGraphicsState && doc.saveGraphicsState();
    try {
      if (typeof doc.setGState === "function" && doc.GState) {
        doc.setGState(new doc.GState({ opacity: 0.15 }));
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(pageWidth > 400 ? 18 : 12);
      doc.setTextColor(isAcademic ? 13 : 220, isAcademic ? 148 : 38, isAcademic ? 136 : 38);

      // Marca diagonal de centro
      if (typeof doc.text === "function") {
        try {
          doc.text(watermarkText, pageWidth / 2, pageHeight / 2, {
            align: "center",
            angle: 35,
          });
        } catch {
          doc.text(watermarkText, pageWidth / 2, pageHeight / 2, { align: "center" });
        }
      }

      // Rodapé de segurança em todas as páginas
      if (typeof doc.setGState === "function" && doc.GState) {
        doc.setGState(new doc.GState({ opacity: 0.9 }));
      }
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(watermarkText, pageWidth / 2, pageHeight - 6, { align: "center" });
    } finally {
      doc.restoreGraphicsState && doc.restoreGraphicsState();
    }
  }

  return doc;
}

