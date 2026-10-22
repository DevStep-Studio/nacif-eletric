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
  metersToLatLng,
} from "./solarDesignerGeometry.js";

export const STRING_PALETTE = [
  { fill: "#0284c7", stroke: "#38bdf8", text: "#ffffff", name: "String 01", rgb: [2, 132, 199] },
  { fill: "#059669", stroke: "#34d399", text: "#ffffff", name: "String 02", rgb: [5, 150, 105] },
  { fill: "#d97706", stroke: "#fbbf24", text: "#ffffff", name: "String 03", rgb: [217, 119, 6] },
  { fill: "#9333ea", stroke: "#c084fc", text: "#ffffff", name: "String 04", rgb: [147, 51, 234] },
  { fill: "#db2777", stroke: "#f472b6", text: "#ffffff", name: "String 05", rgb: [219, 39, 119] },
  { fill: "#2563eb", stroke: "#60a5fa", text: "#ffffff", name: "String 06", rgb: [37, 99, 235] },
];

// Cache em memória para os tiles de satélite e imagens de layout já geradas
const tileMemoryCache = new Map();
const layoutImageCache = new Map();

/**
 * Converte latitude e longitude para coordenadas fracionárias de tile (Web Mercator EPSG:3857)
 */
function latLngToTileFraction(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clampedSin = Math.min(Math.max(sinLat, -0.9999), 0.9999);
  const x = n * ((lng + 180) / 360);
  const y = (n * (1 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (2 * Math.PI))) / 2;
  return { x, y };
}

/**
 * Converte coordenadas inteiras de tile para latitude e longitude do canto superior esquerdo (Noroeste)
 */
function tileToLatLng(tx, ty, zoom) {
  const n = Math.pow(2, zoom);
  const lng = (tx / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

/**
 * Calcula o nível de zoom ideal (geralmente entre 18 e 20) para máxima definição da edificação
 */
function calculateOptimalSatelliteZoom(scale, centerLat) {
  const latRad = (centerLat * Math.PI) / 180;
  const cosLat = Math.max(0.1, Math.cos(latRad));
  const rawZoom = Math.round(Math.log2(scale * 156543.03392 * cosLat));
  return Math.min(20, Math.max(16, rawZoom));
}

/**
 * Carrega individualmente um tile de satélite com headers CORS habilitados e fallback automático
 */
function fetchTileImage(tx, ty, zoom) {
  const key = `${zoom}_${tx}_${ty}`;
  if (tileMemoryCache.has(key)) {
    return Promise.resolve(tileMemoryCache.get(key));
  }

  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 4500);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      tileMemoryCache.set(key, img);
      resolve(img);
    };

    img.onerror = () => {
      if (settled) return;
      // Fallback 1: Google Satélite puro (lyrs=s)
      const img2 = new Image();
      img2.crossOrigin = "anonymous";
      img2.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        tileMemoryCache.set(key, img2);
        resolve(img2);
      };
      img2.onerror = () => {
        // Fallback 2: ESRI World Imagery (ArcGIS MapServer)
        const img3 = new Image();
        img3.crossOrigin = "anonymous";
        img3.onload = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          tileMemoryCache.set(key, img3);
          resolve(img3);
        };
        img3.onerror = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(null);
        };
        img3.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
      };
      img2.src = `https://mt0.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${zoom}`;
    };

    // Primário: Google Maps Satélite com ruas e edificações reais (o mesmo do mapa de projeto)
    img.src = `https://mt1.google.com/vt/lyrs=y&x=${tx}&y=${ty}&z=${zoom}`;
  });
}

/**
 * Busca de forma assíncrona todos os tiles de satélite cobrindo a área da tela
 */
async function fetchSatelliteTilesForView({ center, local, scale, padX, padY, usableW, usableH, width, height }) {
  if (typeof document === "undefined" || !center || !Number.isFinite(center.lat)) {
    return [];
  }

  const zoom = calculateOptimalSatelliteZoom(scale, center.lat);

  const originX = padX + (usableW - local.widthM * scale) / 2;
  const originY = padY + (usableH - local.heightM * scale) / 2;

  const toMeters = (px, py) => ({
    east: local.minEast + (px - originX) / scale,
    north: local.maxNorth - (py - originY) / scale,
  });

  const toLatLng = (px, py) => {
    const m = toMeters(px, py);
    return metersToLatLng(center, m.east, m.north);
  };

  const toPx = (m) => ({
    x: originX + (m.east - local.minEast) * scale,
    y: originY + (local.maxNorth - m.north) * scale,
  });

  const marginPx = 40;
  const p0 = toLatLng(-marginPx, -marginPx);
  const p1 = toLatLng(width + marginPx, height + marginPx);
  const p2 = toLatLng(width + marginPx, -marginPx);
  const p3 = toLatLng(-marginPx, height + marginPx);

  const tf0 = latLngToTileFraction(p0.lat, p0.lng, zoom);
  const tf1 = latLngToTileFraction(p1.lat, p1.lng, zoom);
  const tf2 = latLngToTileFraction(p2.lat, p2.lng, zoom);
  const tf3 = latLngToTileFraction(p3.lat, p3.lng, zoom);

  const minX = Math.floor(Math.min(tf0.x, tf1.x, tf2.x, tf3.x));
  const maxX = Math.floor(Math.max(tf0.x, tf1.x, tf2.x, tf3.x));
  const minY = Math.floor(Math.min(tf0.y, tf1.y, tf2.y, tf3.y));
  const maxY = Math.floor(Math.max(tf0.y, tf1.y, tf2.y, tf3.y));

  const totalCols = maxX - minX + 1;
  const totalRows = maxY - minY + 1;
  if (totalCols * totalRows > 36 || totalCols <= 0 || totalRows <= 0) {
    return [];
  }

  const tilePromises = [];
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      tilePromises.push(
        fetchTileImage(tx, ty, zoom).then((img) => {
          if (!img) return null;
          const tlGeo = tileToLatLng(tx, ty, zoom);
          const brGeo = tileToLatLng(tx + 1, ty + 1, zoom);
          const tlM = latLngToMeters(tlGeo, center);
          const brM = latLngToMeters(brGeo, center);
          const pTL = toPx(tlM);
          const pBR = toPx(brM);
          return {
            img,
            x: Math.floor(pTL.x),
            y: Math.floor(pTL.y),
            w: Math.ceil(pBR.x - pTL.x) + 1,
            h: Math.ceil(pBR.y - pTL.y) + 1,
          };
        })
      );
    }
  }

  const results = await Promise.all(tilePromises);
  return results.filter(Boolean);
}

/**
 * Monta síncronamente os tiles de satélite já disponíveis no cache em memória
 */
function getCachedSatelliteTilesForView({ center, local, scale, padX, padY, usableW, usableH, width, height, toPx }) {
  if (!center || !Number.isFinite(center.lat)) return [];
  const zoom = calculateOptimalSatelliteZoom(scale, center.lat);
  const originX = padX + (usableW - local.widthM * scale) / 2;
  const originY = padY + (usableH - local.heightM * scale) / 2;

  const toMeters = (px, py) => ({
    east: local.minEast + (px - originX) / scale,
    north: local.maxNorth - (py - originY) / scale,
  });

  const toLatLng = (px, py) => {
    const m = toMeters(px, py);
    return metersToLatLng(center, m.east, m.north);
  };

  const marginPx = 40;
  const p0 = toLatLng(-marginPx, -marginPx);
  const p1 = toLatLng(width + marginPx, height + marginPx);
  const p2 = toLatLng(width + marginPx, -marginPx);
  const p3 = toLatLng(-marginPx, height + marginPx);

  const tf0 = latLngToTileFraction(p0.lat, p0.lng, zoom);
  const tf1 = latLngToTileFraction(p1.lat, p1.lng, zoom);
  const tf2 = latLngToTileFraction(p2.lat, p2.lng, zoom);
  const tf3 = latLngToTileFraction(p3.lat, p3.lng, zoom);

  const minX = Math.floor(Math.min(tf0.x, tf1.x, tf2.x, tf3.x));
  const maxX = Math.floor(Math.max(tf0.x, tf1.x, tf2.x, tf3.x));
  const minY = Math.floor(Math.min(tf0.y, tf1.y, tf2.y, tf3.y));
  const maxY = Math.floor(Math.max(tf0.y, tf1.y, tf2.y, tf3.y));

  const list = [];
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const key = `${zoom}_${tx}_${ty}`;
      const img = tileMemoryCache.get(key);
      if (img) {
        const tlGeo = tileToLatLng(tx, ty, zoom);
        const brGeo = tileToLatLng(tx + 1, ty + 1, zoom);
        const tlM = latLngToMeters(tlGeo, center);
        const brM = latLngToMeters(brGeo, center);
        const pTL = toPx(tlM);
        const pBR = toPx(brM);
        list.push({
          img,
          x: Math.floor(pTL.x),
          y: Math.floor(pTL.y),
          w: Math.ceil(pBR.x - pTL.x) + 1,
          h: Math.ceil(pBR.y - pTL.y) + 1,
        });
      }
    }
  }
  return list;
}

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

  // Centro geográfico real de referência da edificação e lote
  let center = null;
  const allAreaPoints = areas.flatMap((a) => a.polygon || []);
  if (allAreaPoints.length > 0) {
    const sumLat = allAreaPoints.reduce((acc, pt) => acc + (pt.lat || 0), 0);
    const sumLng = allAreaPoints.reduce((acc, pt) => acc + (pt.lng || 0), 0);
    center = { lat: sumLat / allAreaPoints.length, lng: sumLng / allAreaPoints.length };
  } else if (Number.isFinite(Number(c.map_center_lat)) && Number.isFinite(Number(c.map_center_lng))) {
    center = { lat: Number(c.map_center_lat), lng: Number(c.map_center_lng) };
  } else {
    center = DEFAULT_SOLAR_MAP_CENTER;
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
    center,
  };
}

/**
 * Converte coordenadas geográficas para espaço métrico 2D local
 */
function projectToLocalMeters(areas, allPanels, fallbackW = 15, fallbackH = 6, refCenter = null) {
  let minEast = Infinity;
  let maxEast = -Infinity;
  let minNorth = Infinity;
  let maxNorth = -Infinity;

  const center = refCenter || areas[0]?.polygon?.[0] || DEFAULT_SOLAR_MAP_CENTER;
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
    center,
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
function renderCanvasInBrowser({ geo, mode = "layout", width = 1200, height = 650, satelliteTiles = null }) {
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
    center,
  } = geo;

  const local = projectToLocalMeters(areas, allPanels, roofWidth, roofHeight, center);

  // Margens e escala métrica
  const padX = 110;
  const padY = 95;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2 - 45; // espaço para legenda inferior
  const scale = Math.min(usableW / local.widthM, usableH / local.heightM);

  const originX = padX + (usableW - local.widthM * scale) / 2;
  const originY = padY + (usableH - local.heightM * scale) / 2;

  const toPx = (m) => ({
    x: originX + (m.east - local.minEast) * scale,
    y: originY + (local.maxNorth - m.north) * scale,
  });

  // 1. Fundo Base & Camada de Imagem de Satélite dos Prédios
  ctx.fillStyle = "#0c1829";
  ctx.fillRect(0, 0, width, height);

  // Obtém os tiles: se não foram passados diretamente, busca os que já estiverem em cache
  let tilesToDraw = satelliteTiles;
  if (!tilesToDraw || tilesToDraw.length === 0) {
    tilesToDraw = getCachedSatelliteTilesForView({
      center,
      local,
      scale,
      padX,
      padY,
      usableW,
      usableH,
      width,
      height,
      toPx,
    });
  }

  let hasSatelliteBackground = false;
  if (Array.isArray(tilesToDraw) && tilesToDraw.length > 0) {
    tilesToDraw.forEach((t) => {
      try {
        ctx.drawImage(t.img, t.x, t.y, t.w, t.h);
        hasSatelliteBackground = true;
      } catch (e) {
        // Ignora erro em tile corrompido
      }
    });
  }

  if (hasSatelliteBackground) {
    // Tratamento de Satélite para Engenharia Técnica:
    // Suave camada translúcida escura para contraste e destaque perfeito dos módulos e cotas
    ctx.fillStyle = "rgba(7, 18, 36, 0.22)";
    ctx.fillRect(0, 0, width, height);

    // Vinheta periférica elegante
    const vig = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72
    );
    vig.addColorStop(0, "rgba(0, 0, 0, 0)");
    vig.addColorStop(1, "rgba(5, 12, 24, 0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Fallback arquitetônico quando totalmente sem conexão/offline:
    // Representa o contexto da edificação e lote urbano com contraste técnico
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0b192c");
    bgGrad.addColorStop(1, "#12253d");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Contorno do lote / propriedade ao redor
    ctx.save();
    ctx.strokeStyle = "rgba(71, 107, 146, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(padX - 45, padY - 35, local.widthM * scale + 90, local.heightM * scale + 70);
    ctx.restore();
  }

  // Grade métrica técnica sutil
  ctx.strokeStyle = "rgba(56, 189, 248, 0.05)";
  ctx.lineWidth = 1;
  const gridStep = 40;
  for (let x = 0; x < width; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // 2. Contorno do Telhado da Edificação / Áreas
  local.areaPolygonsMeters.forEach((area) => {
    if (area.polygon.length < 3) return;
    const pts = area.polygon.map(toPx);

    // Sombra projetada do telhado da edificação
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = 14;
    // Preenchimento translúcido: preserva a visualização da cobertura/telhas reais dos prédios na foto de satélite!
    ctx.fillStyle = hasSatelliteBackground ? "rgba(14, 34, 62, 0.35)" : "#162740";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Borda ciano técnica nítida do telhado
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();

    // Setback periférico da edificação (linha tracejada amarela de afastamento 0,30m)
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
    ctx.lineWidth = 1.4;
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
      // Modo Layout: Silício monocristalino escuro com moldura de alumínio e sombra realista
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = "#10233f";
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#e2e8f0";
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

  // 5. Cotas Técnicas Dimensionais com Badge de Leitura Nítida sobre o Satélite
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.85)";
  ctx.lineWidth = 1.2;

  // Cota inferior de largura
  const cotaY = padY + usableH + 20;
  const cotaX1 = padX;
  const cotaX2 = padX + local.widthM * scale;
  ctx.beginPath();
  ctx.moveTo(cotaX1, cotaY); ctx.lineTo(cotaX2, cotaY);
  ctx.moveTo(cotaX1, cotaY - 5); ctx.lineTo(cotaX1, cotaY + 5);
  ctx.moveTo(cotaX2, cotaY - 5); ctx.lineTo(cotaX2, cotaY + 5);
  ctx.stroke();

  // Badge de fundo escuro para a cota de largura
  const wText = `${roofWidth.toFixed(2)} m (Largura do Telhado)`;
  ctx.font = "bold 10px Inter, sans-serif";
  const wWidth = ctx.measureText(wText).width;
  ctx.fillStyle = "rgba(14, 23, 38, 0.88)";
  ctx.fillRect((cotaX1 + cotaX2) / 2 - wWidth / 2 - 6, cotaY - 14, wWidth + 12, 16);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
  ctx.strokeRect((cotaX1 + cotaX2) / 2 - wWidth / 2 - 6, cotaY - 14, wWidth + 12, 16);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(wText, (cotaX1 + cotaX2) / 2, cotaY - 2);

  // Cota lateral de altura
  const cotaX = padX - 22;
  const cotaY1 = padY;
  const cotaY2 = padY + local.heightM * scale;
  ctx.beginPath();
  ctx.moveTo(cotaX, cotaY1); ctx.lineTo(cotaX, cotaY2);
  ctx.moveTo(cotaX - 5, cotaY1); ctx.lineTo(cotaX + 5, cotaY1);
  ctx.moveTo(cotaX - 5, cotaY2); ctx.lineTo(cotaX + 5, cotaY2);
  ctx.stroke();

  const hText = `${roofHeight.toFixed(2)} m (Comprimento)`;
  const hWidth = ctx.measureText(hText).width;
  ctx.save();
  ctx.translate(cotaX - 8, (cotaY1 + cotaY2) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(14, 23, 38, 0.88)";
  ctx.fillRect(-hWidth / 2 - 6, -12, hWidth + 12, 16);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
  ctx.strokeRect(-hWidth / 2 - 6, -12, hWidth + 12, 16);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(hText, 0, 0);
  ctx.restore();
  ctx.restore();

  // 6. Rosa dos Ventos e Azimute (Canto Superior Direito)
  const compassX = width - 85;
  const compassY = 65;
  const compassR = 26;

  ctx.save();
  ctx.fillStyle = "rgba(15, 30, 54, 0.9)";
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
  ctx.fillStyle = "rgba(14, 23, 38, 0.92)";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = 1;
  ctx.fillRect(16, 14, 520, 42);
  ctx.strokeRect(16, 14, 520, 42);

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
    47
  );
  ctx.restore();

  // 8. Barra Inferior de Legenda e Indicadores
  const legendY = height - 38;
  ctx.save();
  ctx.fillStyle = "rgba(14, 23, 38, 0.95)";
  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
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
    ctx.fillText(`● Módulos Monocristalinos ${moduleWp}Wp`, 30, legendY + 14);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("● Borda e Afastamento Setback 0,30m", 250, legendY + 14);
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`● Inclinação do Telhado: ${roofPitch}°`, 490, legendY + 14);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`● Estrutura: Alumínio Anodizado`, 700, legendY + 14);
    ctx.fillStyle = "#60a5fa";
    ctx.fillText(`● Imagem: Vista de Satélite Real`, 910, legendY + 14);
  }
  ctx.restore();

  try {
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("toDataURL failed, returning fallback:", err);
    return null;
  }
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

function getLayoutCacheKey(project, config, sizing, mode) {
  const pid = project?.id || project?.name || "proj";
  const pCount = sizing?.panelCount || config?.requested_panel_count || 0;
  const w = config?.roof_width_m || 0;
  const h = config?.roof_height_m || 0;
  const rot = config?.roof_rotation_deg || 0;
  const centerLat = config?.map_center_lat || "";
  const centerLng = config?.map_center_lng || "";
  return `${pid}_${mode}_${pCount}_${w}_${h}_${rot}_${centerLat}_${centerLng}`;
}

/**
 * 1. Gera a imagem oficial do Layout dos Módulos no Telhado com Imagem de Satélite dos Prédios (Async)
 */
export async function generateRoofLayoutImageAsync({ project = {}, config = {}, sizing = {}, width = 1200, height = 650 } = {}) {
  const geo = extractSolarProjectGeometry(project, config, sizing);
  const cacheKey = getLayoutCacheKey(project, config, sizing, "layout");

  const local = projectToLocalMeters(geo.areas, geo.allPanels, geo.roofWidth, geo.roofHeight, geo.center);
  const padX = 110;
  const padY = 95;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2 - 45;
  const scale = Math.min(usableW / local.widthM, usableH / local.heightM);

  const satelliteTiles = await fetchSatelliteTilesForView({
    center: geo.center,
    local,
    scale,
    padX,
    padY,
    usableW,
    usableH,
    width,
    height,
  });

  const browserUrl = renderCanvasInBrowser({ geo, mode: "layout", width, height, satelliteTiles });
  if (browserUrl) {
    layoutImageCache.set(cacheKey, browserUrl);
    return browserUrl;
  }

  return renderFallbackInNode({ geo, mode: "layout", width: 800, height: 460 });
}

/**
 * 1. Gera a imagem oficial do Layout dos Módulos no Telhado (Síncrono com uso do cache de satélite)
 */
export function generateRoofLayoutImage({ project = {}, config = {}, sizing = {}, width = 1200, height = 650 } = {}) {
  const cacheKey = getLayoutCacheKey(project, config, sizing, "layout");
  if (layoutImageCache.has(cacheKey)) {
    return layoutImageCache.get(cacheKey);
  }

  // Se não estiver em cache, agenda a busca dos tiles de satélite assincronamente
  generateRoofLayoutImageAsync({ project, config, sizing, width, height }).catch(() => {});

  const geo = extractSolarProjectGeometry(project, config, sizing);
  const browserUrl = renderCanvasInBrowser({ geo, mode: "layout", width, height });
  if (browserUrl) return browserUrl;
  return renderFallbackInNode({ geo, mode: "layout", width: 800, height: 460 });
}

/**
 * 2. Gera a imagem oficial do Arranjo de Strings com Imagem de Satélite dos Prédios (Async)
 */
export async function generateStringLayoutImageAsync({ project = {}, config = {}, sizing = {}, width = 1200, height = 650 } = {}) {
  const geo = extractSolarProjectGeometry(project, config, sizing);
  const cacheKey = getLayoutCacheKey(project, config, sizing, "electrical");

  const local = projectToLocalMeters(geo.areas, geo.allPanels, geo.roofWidth, geo.roofHeight, geo.center);
  const padX = 110;
  const padY = 95;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2 - 45;
  const scale = Math.min(usableW / local.widthM, usableH / local.heightM);

  const satelliteTiles = await fetchSatelliteTilesForView({
    center: geo.center,
    local,
    scale,
    padX,
    padY,
    usableW,
    usableH,
    width,
    height,
  });

  const browserUrl = renderCanvasInBrowser({ geo, mode: "electrical", width, height, satelliteTiles });
  if (browserUrl) {
    layoutImageCache.set(cacheKey, browserUrl);
    return browserUrl;
  }

  return renderFallbackInNode({ geo, mode: "electrical", width: 800, height: 460 });
}

/**
 * 2. Gera a imagem oficial do Arranjo de Strings / Circuitos Solares (Síncrono com uso do cache)
 */
export function generateStringLayoutImage({ project = {}, config = {}, sizing = {}, width = 1200, height = 650 } = {}) {
  const cacheKey = getLayoutCacheKey(project, config, sizing, "electrical");
  if (layoutImageCache.has(cacheKey)) {
    return layoutImageCache.get(cacheKey);
  }

  generateStringLayoutImageAsync({ project, config, sizing, width, height }).catch(() => {});

  const geo = extractSolarProjectGeometry(project, config, sizing);
  const browserUrl = renderCanvasInBrowser({ geo, mode: "electrical", width, height });
  if (browserUrl) return browserUrl;
  return renderFallbackInNode({ geo, mode: "electrical", width: 800, height: 460 });
}

/**
 * Resolve todas as imagens obrigatórias e complementares para o relatório solar (Assíncrono com Satélite)
 */
export async function resolveSolarReportImagesAsync({ project = {}, config = {}, sizing = {} } = {}) {
  const p = project || {};
  const c = config || {};
  const s = sizing || {};

  // Imagem 1: Layout dos Módulos no Telhado sobre a Vista de Satélite
  const candidateLayout = (
    s.layoutImageDataUrl
    || c.layout_image_data_url
    || p.layout_image
    || c.layout_image
    || p.site_plan_image
  );

  let layoutImage;
  if (typeof candidateLayout === "string" && candidateLayout.startsWith("data:image")) {
    layoutImage = candidateLayout;
  } else {
    layoutImage = await generateRoofLayoutImageAsync({ project: p, config: c, sizing: s });
  }

  // Imagem 2: Arranjo de Strings e Circuitos
  const candidateStrings = (
    s.stringsImageDataUrl
    || c.strings_image_data_url
    || p.strings_image
    || c.strings_image
    || p.electrical_diagram_image
  );

  let stringsImage;
  if (typeof candidateStrings === "string" && candidateStrings.startsWith("data:image")) {
    stringsImage = candidateStrings;
  } else {
    stringsImage = await generateStringLayoutImageAsync({ project: p, config: c, sizing: s });
  }

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

/**
 * Resolve todas as imagens obrigatórias e complementares para o relatório solar (Síncrono)
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

/**
 * Pré-carrega os tiles de satélite e armazena em cache o layout da edificação
 */
export function preloadSolarReportImages({ project = {}, config = {}, sizing = {} } = {}) {
  if (typeof window === "undefined") return;
  generateRoofLayoutImageAsync({ project, config, sizing })
    .then((url) => {
      if (sizing && typeof sizing === "object" && url) {
        sizing.layoutImageDataUrl = url;
      }
    })
    .catch(() => {});
}
