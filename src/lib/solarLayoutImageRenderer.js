/**
 * Renderizador de Imagens Técnicas de Engenharia Solar Fotovoltaica | NACIF ELECTRIC
 *
 * Gera imagens de alta resolução em formato PNG DataURL para exibição na tela
 * e inclusão na "Planta de Implantação Solar" e Relatórios Técnicos:
 * 1. Imagem de Layout Físico dos Módulos sobre o Telhado (Vista Superior)
 * 2. Imagem de Arranjo Elétrico de Strings e Circuitos CC
 */

import {
  DEFAULT_SOLAR_MAP_CENTER,
  buildRoofPolygon,
  calculateStringGrouping,
  computeAreaPanels,
  computeMultiAreaLayouts,
  getAzimuthWithCardinal,
  latLngToMeters,
} from "./solarDesignerGeometry.js";

export const STRING_PALETTE = [
  { fill: "#0284c7", stroke: "#38bdf8", text: "#ffffff", name: "String 01", rgb: [2, 132, 199] },
  { fill: "#059669", stroke: "#34d399", text: "#ffffff", name: "String 02", rgb: [5, 150, 105] },
  { fill: "#d97706", stroke: "#fbbf24", text: "#ffffff", name: "String 03", rgb: [217, 119, 6] },
  { fill: "#9333ea", stroke: "#c084fc", text: "#ffffff", name: "String 04", rgb: [147, 51, 234] },
  { fill: "#db2777", stroke: "#f472b6", text: "#ffffff", name: "String 05", rgb: [219, 39, 119] },
  { fill: "#2563eb", stroke: "#60a5fa", text: "#ffffff", name: "String 06", rgb: [37, 99, 235] },
];

/**
 * Normaliza e extrai os arranjos de telhado e painéis reais do projeto
 */
export function extractSolarProjectGeometry(project = {}, config = {}, sizing = {}) {
  const p = project || {};
  const c = config || {};
  const s = sizing || {};

  const moduleWp = Number(c.module_wp ?? 550);
  const inverterKw = Number(c.inverter_kw ?? 5);
  const roofWidth = Number(c.roof_width_m ?? 14.67);
  const roofHeight = Number(c.roof_height_m ?? 4.8);
  const roofPitch = Number(c.roof_pitch_deg ?? 12);
  const roofRotation = Number(c.roof_rotation_deg ?? 24);
  const azimuth = getAzimuthWithCardinal(roofRotation);

  // Áreas computadas
  let areas = s.areas || c.areas || [];
  if (!Array.isArray(areas) || areas.length === 0 || !areas[0]?.panelPolygons?.length) {
    const computed = computeMultiAreaLayouts(c);
    if (computed && computed.length > 0 && computed[0]?.panelPolygons?.length) {
      areas = computed;
    } else {
      // Gera área com dimensões reais do telhado
      const center = DEFAULT_SOLAR_MAP_CENTER;
      const targetPanels = Number(s.panelCount || 21);
      const colsNeeded = Math.ceil(targetPanels / 2);
      const effectiveW = Math.max(roofWidth, colsNeeded * 1.18 + 0.8);
      const effectiveH = Math.max(roofHeight, 2 * 2.32 + 0.8);
      const poly = buildRoofPolygon(center, effectiveW, effectiveH, roofRotation);
      const singleArea = computeAreaPanels(
        { polygon: poly, name: "Água 01", roof_width_m: effectiveW, roof_height_m: effectiveH, roof_rotation_deg: roofRotation, roof_pitch_deg: roofPitch },
        c
      );
      areas = [singleArea];
    }
  }

  // Agrupamento de todas as áreas e painéis
  let allPanels = areas.flatMap((a) => a.panelPolygons || []);
  const totalPanels = (s.panelCount && Number(s.panelCount) > 0)
    ? Number(s.panelCount)
    : (allPanels.length || 21);

  if (allPanels.length > totalPanels) {
    allPanels = allPanels.slice(0, totalPanels);
  }
  const totalDcPowerKw = Number(s.dcPowerKw ?? ((totalPanels * moduleWp) / 1000));

  // Strings calculadas do sistema
  const strings = s.strings && s.strings.length > 0
    ? s.strings
    : calculateStringGrouping(totalPanels, { moduleWp, inverterKw });

  // Mapeamento painel -> string
  const moduleStringMap = new Map();
  strings.forEach((str, sIdx) => {
    for (let m = str.startModule; m <= str.endModule; m++) {
      moduleStringMap.set(m - 1, {
        stringIndex: sIdx,
        stringName: str.stringName,
        powerKw: str.powerKw,
        vocV: str.vocV,
        vmpV: str.vmpV,
        impA: str.impA,
      });
    }
  });

  return {
    project: p,
    config: c,
    sizing: s,
    areas,
    allPanels,
    totalPanels,
    totalDcPowerKw,
    moduleWp,
    inverterKw,
    roofWidth,
    roofHeight,
    roofPitch,
    roofRotation,
    azimuth,
    strings,
    moduleStringMap,
  };
}

/**
 * Converte coordenadas geográficas para espaço métrico 2D local
 */
function projectToLocalMeters(areas, allPanels, fallbackW = 15, fallbackH = 6) {
  let minEast = Infinity;
  let maxEast = -Infinity;
  let minNorth = Infinity;
  let maxNorth = -Infinity;

  const center = areas[0]?.polygon?.[0] || DEFAULT_SOLAR_MAP_CENTER;
  const areaPolygonsMeters = [];
  const panelsMeters = [];

  for (const area of areas) {
    const polyMeters = (area.polygon || []).map((pt) => {
      const m = latLngToMeters(pt, center);
      if (m.east < minEast) minEast = m.east;
      if (m.east > maxEast) maxEast = m.east;
      if (m.north < minNorth) minNorth = m.north;
      if (m.north > maxNorth) maxNorth = m.north;
      return m;
    });
    areaPolygonsMeters.push({ name: area.name || "Água", polygon: polyMeters });
  }

  for (const panel of allPanels) {
    const pMeters = (panel || []).map((pt) => {
      const m = latLngToMeters(pt, center);
      if (m.east < minEast) minEast = m.east;
      if (m.east > maxEast) maxEast = m.east;
      if (m.north < minNorth) minNorth = m.north;
      if (m.north > maxNorth) maxNorth = m.north;
      return m;
    });
    panelsMeters.push(pMeters);
  }

  if (!Number.isFinite(minEast) || minEast === maxEast) {
    minEast = -fallbackW / 2;
    maxEast = fallbackW / 2;
    minNorth = -fallbackH / 2;
    maxNorth = fallbackH / 2;
  }

  const widthM = Math.max(1, maxEast - minEast);
  const heightM = Math.max(1, maxNorth - minNorth);

  return {
    minEast,
    maxEast,
    minNorth,
    maxNorth,
    widthM,
    heightM,
    areaPolygonsMeters,
    panelsMeters,
  };
}

/**
 * Renderizador de Imagem via HTML5 Canvas (execução no navegador)
 */
function renderCanvasInBrowser({ geo, mode = "layout", width = 1200, height = 650 }) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const {
    areas,
    allPanels,
    totalPanels,
    totalDcPowerKw,
    moduleWp,
    inverterKw,
    roofWidth,
    roofHeight,
    roofPitch,
    azimuth,
    strings,
    moduleStringMap,
    project,
  } = geo;

  const local = projectToLocalMeters(areas, allPanels, roofWidth, roofHeight);

  // 1. Fundo Técnico Blueprint
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#081325");
  bgGrad.addColorStop(1, "#0f1e36");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Grade métrica técnica sutil
  ctx.strokeStyle = "rgba(56, 189, 248, 0.07)";
  ctx.lineWidth = 1;
  const gridStep = 30;
  for (let x = 0; x < width; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Margens e escala
  const padX = 110;
  const padY = 95;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2 - 45; // espaço para legenda inferior
  const scale = Math.min(usableW / local.widthM, usableH / local.heightM);

  const toPx = (m) => ({
    x: padX + (usableW - local.widthM * scale) / 2 + (m.east - local.minEast) * scale,
    y: padY + (usableH - local.heightM * scale) / 2 + (local.maxNorth - m.north) * scale,
  });

  // 2. Contorno do Telhado / Áreas
  local.areaPolygonsMeters.forEach((area) => {
    if (area.polygon.length < 3) return;
    const pts = area.polygon.map(toPx);

    // Sombra do telhado
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#162740";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Borda do telhado
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();

    // Setback periférico (linha tracejada amarela)
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.65)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  });

  // 3. Módulos Fotovoltaicos
  const panelCenters = [];
  local.panelsMeters.forEach((pMeters, idx) => {
    if (pMeters.length < 3) return;
    const pts = pMeters.map(toPx);

    // Centro do módulo para fiação de strings
    const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
    const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
    panelCenters.push({ x: cx, y: cy, idx });

    const strInfo = moduleStringMap.get(idx);
    const strColor = STRING_PALETTE[(strInfo?.stringIndex || 0) % STRING_PALETTE.length];

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();

    if (mode === "electrical") {
      // Modo Elétrico: Módulos coloridos por string
      ctx.fillStyle = strColor.fill;
      ctx.fill();
      ctx.strokeStyle = strColor.stroke;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Rótulo da String no centro do módulo (se couber)
      if (scale > 18) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`S${(strInfo?.stringIndex || 0) + 1}`, cx, cy);
      }
    } else {
      // Modo Layout: Silício monocristalino realista com moldura de alumínio
      ctx.fillStyle = "#10233f";
      ctx.fill();
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Linha central Half-Cut
      if (pts.length >= 4) {
        const midX1 = (pts[0].x + pts[1].x) / 2;
        const midY1 = (pts[0].y + pts[1].y) / 2;
        const midX2 = (pts[2].x + pts[3].x) / 2;
        const midY2 = (pts[2].y + pts[3].y) / 2;
        ctx.strokeStyle = "#476b92";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(midX1, midY1);
        ctx.lineTo(midX2, midY2);
        ctx.stroke();
      }
    }
    ctx.restore();
  });

  // 4. Modo Elétrico: Linhas de Cabeamento das Strings em Série
  if (mode === "electrical" && panelCenters.length > 1) {
    strings.forEach((str, sIdx) => {
      const color = STRING_PALETTE[sIdx % STRING_PALETTE.length];
      const strPanels = panelCenters.filter(
        (p) => p.idx >= str.startModule - 1 && p.idx <= str.endModule - 1
      );
      if (strPanels.length < 2) return;

      ctx.save();
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(strPanels[0].x, strPanels[0].y);
      for (let i = 1; i < strPanels.length; i++) {
        ctx.lineTo(strPanels[i].x, strPanels[i].y);
      }
      ctx.stroke();

      // Marcadores nos terminais de conexão
      ctx.setLineDash([]);
      ctx.fillStyle = color.stroke;
      strPanels.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });
  }

  // 5. Cotas Técnicas Dimensionais (Largura e Altura em metros)
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.75)";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.lineWidth = 1;

  // Cota inferior de largura
  const cotaY = padY + usableH + 18;
  const cotaX1 = padX;
  const cotaX2 = padX + local.widthM * scale;
  ctx.beginPath();
  ctx.moveTo(cotaX1, cotaY); ctx.lineTo(cotaX2, cotaY);
  ctx.moveTo(cotaX1, cotaY - 5); ctx.lineTo(cotaX1, cotaY + 5);
  ctx.moveTo(cotaX2, cotaY - 5); ctx.lineTo(cotaX2, cotaY + 5);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillText(`${roofWidth.toFixed(2)} m (Largura do Telhado)`, (cotaX1 + cotaX2) / 2, cotaY - 4);

  // Cota lateral de altura
  const cotaX = padX - 18;
  const cotaY1 = padY;
  const cotaY2 = padY + local.heightM * scale;
  ctx.beginPath();
  ctx.moveTo(cotaX, cotaY1); ctx.lineTo(cotaX, cotaY2);
  ctx.moveTo(cotaX - 5, cotaY1); ctx.lineTo(cotaX + 5, cotaY1);
  ctx.moveTo(cotaX - 5, cotaY2); ctx.lineTo(cotaX + 5, cotaY2);
  ctx.stroke();
  ctx.save();
  ctx.translate(cotaX - 6, (cotaY1 + cotaY2) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(`${roofHeight.toFixed(2)} m (Comprimento)`, 0, 0);
  ctx.restore();
  ctx.restore();

  // 6. Rosa dos Ventos e Azimute (Canto Superior Direito)
  const compassX = width - 85;
  const compassY = 65;
  const compassR = 26;

  ctx.save();
  ctx.fillStyle = "rgba(15, 30, 54, 0.85)";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(compassX, compassY, compassR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Agulha do Norte
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(compassX, compassY - compassR + 5);
  ctx.lineTo(compassX + 5, compassY);
  ctx.lineTo(compassX - 5, compassY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(compassX, compassY + compassR - 5);
  ctx.lineTo(compassX + 5, compassY);
  ctx.lineTo(compassX - 5, compassY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 9px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("N", compassX, compassY - compassR + 14);

  // Leitura do Azimute
  ctx.font = "bold 9.5px Inter, sans-serif";
  ctx.fillStyle = "#00d8b8";
  ctx.fillText(azimuth.formatted, compassX, compassY + compassR + 14);
  ctx.restore();

  // 7. Top Banner / Identificação Técnica
  ctx.save();
  ctx.fillStyle = "rgba(14, 23, 38, 0.9)";
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.fillRect(16, 14, 480, 40);
  ctx.strokeRect(16, 14, 480, 40);

  ctx.fillStyle = mode === "electrical" ? "#38bdf8" : "#00d8b8";
  ctx.font = "900 11px Inter, sans-serif";
  ctx.fillText(
    mode === "electrical"
      ? "ARRANJO ELÉTRICO · STRINGS & CIRCUITOS FOTOVOLTAICOS"
      : "PLANTA DE IMPLANTAÇÃO · LAYOUT FÍSICO DOS MÓDULOS",
    26,
    30
  );

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "600 9.5px Inter, sans-serif";
  ctx.fillText(
    `${project?.name || "Projeto Solar"} · ${totalPanels} Módulos (${moduleWp}Wp) · ${totalDcPowerKw.toFixed(2)} kWp · ${azimuth.formatted}`,
    26,
    45
  );
  ctx.restore();

  // 8. Barra Inferior de Legenda e Indicadores
  const legendY = height - 38;
  ctx.save();
  ctx.fillStyle = "rgba(14, 23, 38, 0.95)";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
  ctx.lineWidth = 1;
  ctx.fillRect(16, legendY, width - 32, 28);
  ctx.strokeRect(16, legendY, width - 32, 28);

  ctx.font = "bold 9.5px Inter, sans-serif";
  ctx.textBaseline = "middle";

  if (mode === "electrical") {
    // Legenda das Strings
    let curX = 30;
    strings.forEach((str, sIdx) => {
      const color = STRING_PALETTE[sIdx % STRING_PALETTE.length];
      ctx.fillStyle = color.fill;
      ctx.beginPath();
      ctx.arc(curX, legendY + 14, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.fillText(
        `${str.stringName}: ${str.moduleCount} Módulos (${str.powerKw?.toFixed(2) || ((str.moduleCount * moduleWp) / 1000).toFixed(2)} kWp · Voc ${str.vocV || 450}V)`,
        curX + 10,
        legendY + 14
      );
      curX += 270;
    });
  } else {
    // Legenda Física de Implantação
    ctx.fillStyle = "#00d8b8";
    ctx.fillText("● Módulos Monocristalinos 550Wp", 30, legendY + 14);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("● Borda e Afastamento Setback 0,30m", 250, legendY + 14);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`● Inclinação do Telhado: ${roofPitch}°`, 490, legendY + 14);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`● Estrutura: Alumínio Anodizado`, 700, legendY + 14);
  }
  ctx.restore();

  return canvas.toDataURL("image/png");
}

/**
 * Mini-Rasterizador Fallback para Node.js (execução sem DOM/headless)
 * Gera um PNG técnico válido utilizando Node zlib para testes e automação.
 */
function renderFallbackInNode({ geo, mode = "layout", width = 800, height = 460 }) {
  try {
    // Invocação dinâmica de zlib para ambiente Node (CJS e ESM)
    let zlibModule = null;
    if (typeof process !== "undefined" && process?.versions?.node) {
      if (typeof process.getBuiltinModule === "function") {
        zlibModule = process.getBuiltinModule("zlib") || process.getBuiltinModule("node:zlib");
      }
      if (!zlibModule && typeof require !== "undefined") {
        try {
          zlibModule = require("zlib");
        } catch {
          // ignore
        }
      }
    }

    if (!zlibModule) return null;

    const rowSize = 1 + width * 4;
    const buf = Buffer.alloc(rowSize * height);

    // Cor de fundo #091526
    const bgR = 9, bgG = 21, bgB = 38;
    for (let y = 0; y < height; y++) {
      const row = y * rowSize;
      buf[row] = 0;
      for (let x = 0; x < width; x++) {
        const px = row + 1 + x * 4;
        buf[px] = bgR;
        buf[px + 1] = bgG;
        buf[px + 2] = bgB;
        buf[px + 3] = 255;
      }
    }

    const setPixel = (x, y, r, g, b) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const px = y * rowSize + 1 + x * 4;
      buf[px] = r;
      buf[px + 1] = g;
      buf[px + 2] = b;
      buf[px + 3] = 255;
    };

    const fillRect = (x0, y0, w, h, r, g, b) => {
      const rx0 = Math.max(0, Math.round(x0));
      const ry0 = Math.max(0, Math.round(y0));
      const rx1 = Math.min(width, Math.round(x0 + w));
      const ry1 = Math.min(height, Math.round(y0 + h));
      for (let cy = ry0; cy < ry1; cy++) {
        for (let cx = rx0; cx < rx1; cx++) {
          setPixel(cx, cy, r, g, b);
        }
      }
    };

    const strokeRect = (x0, y0, w, h, r, g, b, strokeW = 1) => {
      for (let sw = 0; sw < strokeW; sw++) {
        for (let cx = x0 + sw; cx <= x0 + w - sw; cx++) {
          setPixel(cx, y0 + sw, r, g, b);
          setPixel(cx, y0 + h - sw, r, g, b);
        }
        for (let cy = y0 + sw; cy <= y0 + h - sw; cy++) {
          setPixel(x0 + sw, cy, r, g, b);
          setPixel(x0 + w - sw, cy, r, g, b);
        }
      }
    };

    // Desenha Telhado Principal
    fillRect(80, 60, width - 160, height - 140, 22, 39, 64);
    strokeRect(80, 60, width - 160, height - 140, 56, 189, 248, 2);

    // Desenha Arranjo de Painéis
    const cols = 8;
    const rows = 3;
    const pw = 60;
    const ph = 68;
    const startX = 110;
    const startY = 85;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const px = startX + c * (pw + 7);
        const py = startY + r * (ph + 8);
        const modIdx = r * cols + c;

        if (mode === "electrical") {
          const strIdx = modIdx < 12 ? 0 : 1;
          const col = strIdx === 0 ? [2, 132, 199] : [5, 150, 105];
          fillRect(px, py, pw, ph, col[0], col[1], col[2]);
          strokeRect(px, py, pw, ph, 255, 255, 255, 1);
        } else {
          fillRect(px, py, pw, ph, 16, 35, 63);
          strokeRect(px, py, pw, ph, 203, 213, 225, 1);
          // Linha central Half-Cut
          for (let cx = px; cx < px + pw; cx++) setPixel(cx, py + Math.round(ph / 2), 71, 107, 146);
        }
      }
    }

    // Banner Topo
    fillRect(16, 12, width - 32, 34, 14, 23, 38);
    strokeRect(16, 12, width - 32, 34, 56, 189, 248, 1);

    // Banner Rodapé
    fillRect(16, height - 36, width - 32, 24, 14, 23, 38);
    strokeRect(16, height - 36, width - 32, 24, 0, 216, 184, 1);

    const compressed = zlibModule.deflateSync(buf, { level: 6 });
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr.writeUInt8(8, 8);
    ihdr.writeUInt8(6, 9);

    function makeChunk(type, data) {
      const b = Buffer.alloc(12 + data.length);
      b.writeUInt32BE(data.length, 0);
      b.write(type, 4, 4, "ascii");
      data.copy(b, 8);
      b.writeUInt32BE(zlibModule.crc32(b.subarray(4, 8 + data.length)) >>> 0, 8 + data.length);
      return b;
    }

    const pngBuffer = Buffer.concat([
      signature,
      makeChunk("IHDR", ihdr),
      makeChunk("IDAT", compressed),
      makeChunk("IEND", Buffer.alloc(0)),
    ]);

    return `data:image/png;base64,${pngBuffer.toString("base64")}`;
  } catch (err) {
    console.warn("Fallback Node PNG render failed:", err);
    return null;
  }
}

/**
 * 1. Gera a imagem oficial do Layout dos Módulos no Telhado
 */
export function generateRoofLayoutImage({ project = {}, config = {}, sizing = {}, width = 1200, height = 650 } = {}) {
  const geo = extractSolarProjectGeometry(project, config, sizing);
  const browserUrl = renderCanvasInBrowser({ geo, mode: "layout", width, height });
  if (browserUrl) return browserUrl;
  return renderFallbackInNode({ geo, mode: "layout", width: 800, height: 460 });
}

/**
 * 2. Gera a imagem oficial do Arranjo de Strings / Circuitos Solares
 */
export function generateStringLayoutImage({ project = {}, config = {}, sizing = {}, width = 1200, height = 650 } = {}) {
  const geo = extractSolarProjectGeometry(project, config, sizing);
  const browserUrl = renderCanvasInBrowser({ geo, mode: "electrical", width, height });
  if (browserUrl) return browserUrl;
  return renderFallbackInNode({ geo, mode: "electrical", width: 800, height: 460 });
}

/**
 * Resolve todas as imagens obrigatórias e complementares para o relatório solar
 */
export function resolveSolarReportImages({ project = {}, config = {}, sizing = {} } = {}) {
  const p = project || {};
  const c = config || {};
  const s = sizing || {};

  // Imagem 1: Layout dos Módulos no Telhado
  const candidateLayout = (
    s.layoutImageDataUrl
    || c.layout_image_data_url
    || p.layout_image
    || c.layout_image
    || p.site_plan_image
  );
  const layoutImage = (typeof candidateLayout === "string" && candidateLayout.startsWith("data:image"))
    ? candidateLayout
    : generateRoofLayoutImage({ project: p, config: c, sizing: s });

  // Imagem 2: Arranjo de Strings e Circuitos
  const candidateStrings = (
    s.stringsImageDataUrl
    || c.strings_image_data_url
    || p.strings_image
    || c.strings_image
    || p.electrical_diagram_image
  );
  const stringsImage = (typeof candidateStrings === "string" && candidateStrings.startsWith("data:image"))
    ? candidateStrings
    : generateStringLayoutImage({ project: p, config: c, sizing: s });

  // Imagens Extras Complementares
  const extraImages = [];
  const rawExtras = p.extra_images || c.extra_images || p.images || c.images || [];
  if (Array.isArray(rawExtras)) {
    rawExtras.forEach((img, i) => {
      const url = typeof img === "string" ? img : img?.url || img?.dataUrl;
      if (typeof url === "string" && url.startsWith("data:image") && url !== layoutImage && url !== stringsImage) {
        extraImages.push({
          title: img?.title || `Vista Complementar 0${i + 1}`,
          dataUrl: url,
        });
      }
    });
  }

  return {
    layoutImage,
    stringsImage,
    extraImages,
  };
}
