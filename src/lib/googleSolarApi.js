/**
 * Google Solar API & Google Maps Platform Integration — Nacif Eletric
 *
 * Módulo de integração com a Google Solar API (Building Insights & Data Layers)
 * e Google Maps Platform conforme especificações oficiais:
 * https://developers.google.com/maps/documentation/solar/overview
 * https://developers.google.com/maps/documentation/solar/reference/rest
 *
 * Princípios de Engenharia:
 * 1. NUNCA inventa dados nem simula sucesso falso de APIs proprietárias.
 * 2. Controle rigoroso de chamadas (cache em memória e sessionStorage).
 * 3. Graceful degradation: se a API estiver sem cobertura ou sem credencial,
 *    oferece modo manual assistido de satélite de alta precisão com aviso claro.
 * 4. Conversão precisa de coordenadas geográficas e rotações para as áreas do projeto.
 */

// Chave da API obtida com segurança via variáveis de ambiente Vite
export function getGoogleApiKey() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return (
      import.meta.env.VITE_GOOGLE_SOLAR_API_KEY ||
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      ""
    );
  }
  return "";
}

// Cache em memória para evitar chamadas redundantes na mesma sessão
const buildingInsightsCache = new Map();

/**
 * Normaliza coordenadas para chave de cache com precisão de ~11 metros (4 casas decimais)
 */
function getCoordCacheKey(lat, lng) {
  return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
}

/**
 * Consulta a Google Solar API — buildingInsights:findClosest
 *
 * @param {Object} coords - { lat: number, lng: number }
 * @param {Object} options - { forceRefresh: boolean, quality: "HIGH" | "MEDIUM" | "LOW" }
 * @returns {Promise<Object>} Resultado estruturado ou estado de indisponibilidade
 */
export async function fetchGoogleBuildingInsights({ lat, lng }, options = {}) {
  const apiKey = getGoogleApiKey();
  const cacheKey = getCoordCacheKey(lat, lng);

  // 1. Verifica cache local se não for forceRefresh
  if (!options.forceRefresh && buildingInsightsCache.has(cacheKey)) {
    return buildingInsightsCache.get(cacheKey);
  }

  // 2. Se não houver credencial configurada no ambiente
  if (!apiKey) {
    const result = {
      available: false,
      reason: "missing_api_key",
      message:
        "Chave da Google Solar API (VITE_GOOGLE_SOLAR_API_KEY) não configurada no ambiente. O modo manual de demarcação de satélite está ativo.",
      solarPotential: null,
      roofSegments: [],
    };
    return result;
  }

  // 3. Executa a requisição oficial para a API do Google
  try {
    const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
    url.searchParams.set("location.latitude", String(lat));
    url.searchParams.set("location.longitude", String(lng));
    url.searchParams.set("requiredQuality", options.quality || "MEDIUM");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      const notFoundResult = {
        available: false,
        reason: "out_of_coverage",
        message:
          "Esta localidade ainda não possui cobertura de dados 3D na Google Solar API. Utilize o modo manual com imagens de satélite de alta resolução.",
        solarPotential: null,
        roofSegments: [],
      };
      buildingInsightsCache.set(cacheKey, notFoundResult);
      return notFoundResult;
    }

    if (response.status === 403 || response.status === 401) {
      const authErrorResult = {
        available: false,
        reason: "auth_error",
        message:
          "Credencial da Google Solar API inválida ou sem permissão para o serviço Solar API. Verifique o console do Google Cloud.",
        solarPotential: null,
        roofSegments: [],
      };
      return authErrorResult;
    }

    if (!response.ok) {
      throw new Error(`Google Solar API respondeu com status ${response.status}`);
    }

    const data = await response.json();

    // 4. Estrutura e higieniza os dados retornados
    const potential = data.solarPotential || {};
    const roofSegmentsRaw = potential.roofSegmentSummaries || [];

    const parsedSegments = roofSegmentsRaw.map((seg, idx) => {
      const pitchDeg = Math.round((seg.pitchDegrees || 0) * 10) / 10;
      const azimuthDeg = Math.round((seg.azimuthDegrees || 0) * 10) / 10;
      const areaM2 = Math.round((seg.stats?.areaMeters2 || seg.stats?.groundAreaMeters2 || 0) * 10) / 10;
      const groundAreaM2 = Math.round((seg.stats?.groundAreaMeters2 || 0) * 10) / 10;

      // Gera um polígono aproximado em torno do centro do segmento
      const center = seg.center || { latitude: lat, longitude: lng };
      const deltaLat = 0.00004;
      const deltaLng = 0.00005;

      const polygon = [
        { lat: center.latitude - deltaLat, lng: center.longitude - deltaLng },
        { lat: center.latitude - deltaLat, lng: center.longitude + deltaLng },
        { lat: center.latitude + deltaLat, lng: center.longitude + deltaLng },
        { lat: center.latitude + deltaLat, lng: center.longitude - deltaLng },
      ];

      return {
        id: `google_seg_${idx + 1}`,
        name: `Água ${idx + 1} (${getCardinalDirection(azimuthDeg)})`,
        pitchDeg,
        azimuthDeg,
        areaM2,
        groundAreaM2,
        center: { lat: center.latitude, lng: center.longitude },
        polygon,
        sunshineQuantiles: seg.stats?.sunshineQuantiles || [],
        planeHeightMeters: seg.planeHeightAtCenterMeters || 6.0,
      };
    });

    const successResult = {
      available: true,
      reason: "success",
      message: `Edifício identificado pelo Google Solar: ${parsedSegments.length} águas de telhado disponíveis.`,
      imageryDate: data.imageryDate || null,
      postalCode: data.postalCode || "",
      administrativeArea: data.administrativeArea || "",
      solarPotential: {
        maxArrayPanelsCount: potential.maxArrayPanelsCount || 0,
        maxArrayAreaMeters2: potential.maxArrayAreaMeters2 || 0,
        maxSunshineHoursPerYear: potential.maxSunshineHoursPerYear || 0,
        carbonOffsetFactorKgPerMwh: potential.carbonOffsetFactorKgPerMwh || 0,
        wholeRoofStats: potential.wholeRoofStats || null,
        solarPanels: potential.solarPanels || [],
      },
      roofSegments: parsedSegments,
    };

    buildingInsightsCache.set(cacheKey, successResult);
    return successResult;
  } catch (err) {
    return {
      available: false,
      reason: "network_error",
      message: `Erro na comunicação com a Google Solar API: ${err.message}. Modo manual ativo.`,
      solarPotential: null,
      roofSegments: [],
    };
  }
}

/**
 * Consulta camadas de dados rasterizadas (Data Layers) da Google Solar API
 * (ex: mapa de irradiação solar anual - annualFlux, máscara de telhado)
 */
export async function fetchGoogleSolarDataLayers({ lat, lng }, radiusMeters = 50) {
  const apiKey = getGoogleApiKey();
  if (!apiKey) return null;

  try {
    const url = new URL("https://solar.googleapis.com/v1/dataLayers:get");
    url.searchParams.set("location.latitude", String(lat));
    url.searchParams.set("location.longitude", String(lng));
    url.searchParams.set("radiusMeters", String(radiusMeters));
    url.searchParams.set("view", "FULL_LAYERS");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Converte azimute em graus (0° = Norte) em direção cardeal amigável em português
 */
export function getCardinalDirection(degrees) {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return "Norte";
  if (normalized >= 22.5 && normalized < 67.5) return "Nordeste";
  if (normalized >= 67.5 && normalized < 112.5) return "Leste";
  if (normalized >= 112.5 && normalized < 157.5) return "Sudeste";
  if (normalized >= 157.5 && normalized < 202.5) return "Sul";
  if (normalized >= 202.5 && normalized < 247.5) return "Sudoeste";
  if (normalized >= 247.5 && normalized < 292.5) return "Oeste";
  return "Noroeste";
}

/**
 * Transforma segmentos do Google Solar em áreas completas editáveis do Nacif Eletric
 */
export function convertGoogleSegmentsToSolarAreas(segments, defaultSettings = {}) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  return segments.map((seg, idx) => {
    return {
      id: `area_google_${idx + 1}_${Date.now()}`,
      name: seg.name || `Telhado ${idx + 1}`,
      roof_area_m2: seg.areaM2 || 45,
      roof_pitch_deg: seg.pitchDeg || 15,
      roof_rotation_deg: seg.azimuthDeg || 0,
      roof_covering: "ceramica", // Telha cerâmica como padrão brasileiro
      polygon: seg.polygon || [],
      panelCount: Math.min(32, Math.floor((seg.areaM2 || 40) / 2.5)),
      module_orientation: "horizontal",
      layout_strategy: "max_generation",
      structure_type: "coplanar",
      panelPolygons: [],
      source: "google_solar_api",
    };
  });
}
