import { Canvg } from "canvg";
import { NACIF_SYMBOL_BASE64 } from "./solarLogoAsset.js";

/**
 * Converte uma URL de imagem (relativa, blob ou http) para Data URL PNG/JPEG
 * para garantir que <image> dentro de SVGs renderize no canvas e no jsPDF.
 */
async function resolveImageUrlToDataUrl(url) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (trimmed.startsWith("data:")) return trimmed;

  try {
    const response = await fetch(trimmed);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return NACIF_SYMBOL_BASE64;
  }
}

/**
 * Serializa um elemento <svg> do DOM e renderiza em PNG de alta resolução
 * evitando falhas do addSvgAsImage do jsPDF em builds ESM/Vite e baixas resoluções.
 */
export async function svgElementToHighResPngDataUrl(
  svgElement,
  {
    widthPx = 1189,
    heightPx = 841,
    scale = 2.5,
    backgroundColor = "#ffffff",
  } = {}
) {
  if (!svgElement) {
    throw new Error("Elemento SVG não encontrado para exportação.");
  }

  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(widthPx));
  clone.setAttribute("height", String(heightPx));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${widthPx} ${heightPx}`);
  }

  // Inline de imagens referenciadas por URL para evitar perda no XMLSerializer/Canvg
  const imageNodes = Array.from(clone.querySelectorAll("image"));
  await Promise.all(
    imageNodes.map(async (imgNode) => {
      const href = imgNode.getAttribute("href") || imgNode.getAttribute("xlink:href") || "";
      if (href && !href.startsWith("data:")) {
        const dataUrl = await resolveImageUrlToDataUrl(href);
        if (dataUrl) {
          imgNode.setAttribute("href", dataUrl);
          imgNode.setAttribute("xlink:href", dataUrl);
        }
      }
    })
  );

  // Limita dimensão máxima do canvas para ~4200px mantendo nitidez sem estourar memória
  const maxCanvasSide = 4200;
  const maxDim = Math.max(widthPx, heightPx);
  const safeScale = Math.min(scale, maxCanvasSide / Math.max(1, maxDim));
  const canvasW = Math.max(1, Math.round(widthPx * safeScale));
  const canvasH = Math.max(1, Math.round(heightPx * safeScale));

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Contexto 2D indisponível para renderizar SVG.");
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const svgMarkup = new XMLSerializer().serializeToString(clone);

  try {
    const v = Canvg.fromString(ctx, svgMarkup, {
      ignoreMouse: true,
      ignoreAnimation: true,
      ignoreDimensions: false,
      scaleWidth: canvasW,
      scaleHeight: canvasH,
    });
    await v.render();
    return canvas.toDataURL("image/png");
  } catch (canvgErr) {
    // Fallback via Blob + Image nativo do navegador
    const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(svgBlob);
    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvasW, canvasH);
          resolve();
        };
        img.onerror = (err) => reject(err || canvgErr);
        img.src = blobUrl;
      });
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }
}
