/**
 * geocodingService.js
 * Motor de Geocodificação de Alta Precisão para Endereços e CEPs Brasileiros.
 *
 * Arquitetura multicamada com validação estrita de município/UF:
 *   1. Endereço completo com número + CEP (PointAddress / StreetAddress) -> Zoom 20
 *   2. Logradouro exato + CEP + Bairro + Município + UF (StreetName)     -> Zoom 19
 *   3. Setor postal de 8 dígitos validado no município (PostalExt)       -> Zoom 18
 *   4. Bairro + Município + UF                                           -> Zoom 17
 *   5. Centro municipal (Município + UF)                                 -> Zoom 15
 *
 * Nunca utiliza cegamente coordenadas genéricas de centro municipal (como OpenCEP/BrasilAPI)
 * quando existe logradouro identificado pelos Correios.
 */

import { cleanDigits, maskCep } from "./brFormatters.js";
import { fetchAddressByCep } from "./cepService.js";

const ARCGIS_FIND_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const PHOTON_SEARCH_URL = "https://photon.komoot.io/api/";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

const GEO_CACHE_TTL_MS = 30 * 60 * 1000;
const geocodeCache = new Map();

const UF_TO_STATE_NAME = {
  AC: "acre",
  AL: "alagoas",
  AP: "amapa",
  AM: "amazonas",
  BA: "bahia",
  CE: "ceara",
  DF: "distrito federal",
  ES: "espirito santo",
  GO: "goias",
  MA: "maranhao",
  MT: "mato grosso",
  MS: "mato grosso do sul",
  MG: "minas gerais",
  PA: "para",
  PB: "paraiba",
  PR: "parana",
  PE: "pernambuco",
  PI: "piaui",
  RJ: "rio de janeiro",
  RN: "rio grande do norte",
  RS: "rio grande do sul",
  RO: "rondonia",
  RR: "roraima",
  SC: "santa catarina",
  SP: "sao paulo",
  SE: "sergipe",
  TO: "tocantins",
};

const STATE_NAME_TO_UF = Object.fromEntries(
  Object.entries(UF_TO_STATE_NAME).map(([uf, name]) => [name, uf])
);

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveStateUf(rawState = "") {
  const trimmed = String(rawState || "").trim();
  if (!trimmed) return "";
  const upper = trimmed.toUpperCase();
  if (UF_TO_STATE_NAME[upper]) return upper;
  const norm = normalizeText(trimmed);
  return STATE_NAME_TO_UF[norm] || "";
}

function createTimeoutSignal(externalSignal = null, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Timeout")), timeoutMs);

  const onAbort = () => {
    clearTimeout(timer);
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onAbort);
      }
    },
  };
}

/**
 * Verifica se o candidato geocodificado pertence ao município/UF esperados,
 * impedindo redirecionamentos para ruas homônimas em outras cidades.
 */
function candidateMatchesLocality(
  { city = "", state = "", displayName = "", postcode = "" },
  expectedCity = "",
  expectedState = "",
  expectedCepDigits = ""
) {
  const expUf = resolveStateUf(expectedState);
  const candUf = resolveStateUf(state);
  const normDisplay = normalizeText(displayName);

  // Validação de UF quando informada
  if (expUf) {
    const expStateFull = UF_TO_STATE_NAME[expUf] || "";
    const stateOk =
      (candUf && candUf === expUf) ||
      normDisplay.includes(` ${expUf.toLowerCase()} `) ||
      (expStateFull && normDisplay.includes(expStateFull));
    if (!stateOk && candUf && candUf !== expUf) {
      return false;
    }
  }

  // Validação de Município quando informado
  const normExpCity = normalizeText(expectedCity);
  if (normExpCity) {
    // Caso especial DF (Brasília e Regiões Administrativas)
    if (expUf === "DF") {
      if (candUf === "DF" || normDisplay.includes("distrito federal") || normDisplay.includes("brasilia")) {
        return true;
      }
    }

    const normCandCity = normalizeText(city);
    if (normCandCity && (normCandCity === normExpCity || normCandCity.includes(normExpCity) || normExpCity.includes(normCandCity))) {
      return true;
    }
    if (normDisplay.includes(normExpCity)) {
      return true;
    }

    // Se o prefixo de 5 dígitos do CEP bater exatamente, aceita (distritos emancipados/subdistritos)
    const candCepDigits = cleanDigits(postcode);
    if (expectedCepDigits.length === 8 && candCepDigits.length >= 5) {
      if (candCepDigits.slice(0, 5) === expectedCepDigits.slice(0, 5)) {
        return true;
      }
    }

    return false;
  }

  return true;
}

const ARCGIS_EXACT_ADDRESS_TYPES = new Set([
  "Subaddress",
  "PointAddress",
  "BuildingName",
  "StreetAddress",
  "StreetInt",
]);

const ARCGIS_STREET_TYPES = new Set([
  "StreetName",
  "StreetMidBlock",
]);

function classifyArcGisAddrType(addrType = "", hasNumber = false) {
  if (ARCGIS_EXACT_ADDRESS_TYPES.has(addrType)) {
    return { tier: 1, precision: hasNumber ? "exact_number" : "street_address", zoom: hasNumber ? 20 : 19 };
  }
  if (ARCGIS_STREET_TYPES.has(addrType)) {
    return { tier: 2, precision: "street", zoom: 19 };
  }
  if (addrType === "PostalExt") {
    return { tier: 3, precision: "cep_sector", zoom: 18 };
  }
  if (addrType === "PostalLoc" || addrType === "Postal" || addrType === "Neighborhood") {
    return { tier: 4, precision: "neighborhood", zoom: 17 };
  }
  if (addrType === "Locality" || addrType === "AdminPlaces") {
    return { tier: 5, precision: "city", zoom: 15 };
  }
  return { tier: 4, precision: "approximate", zoom: 17 };
}

/**
 * Consulta estruturada ou linha única no ArcGIS World Geocoder (cobertura nacional de CEPs e ruas).
 */
async function queryArcGisCandidates(paramsObj, externalSignal = null) {
  const { signal, cleanup } = createTimeoutSignal(externalSignal, 4800);
  try {
    const searchParams = new URLSearchParams({
      f: "json",
      countryCode: "BRA",
      maxLocations: "6",
      outFields: "Addr_type,Match_addr,StName,StType,AddNum,Nbrhd,City,Subregion,Region,RegionAbbr,Postal",
      ...paramsObj,
    });

    const response = await fetch(`${ARCGIS_FIND_URL}?${searchParams.toString()}`, {
      signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.candidates)) return [];

    return data.candidates
      .map((cand) => {
        const lat = Number(cand?.location?.y);
        const lng = Number(cand?.location?.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const attr = cand.attributes || {};
        const uf = resolveStateUf(attr.RegionAbbr || attr.Region || "");
        const city = (attr.City || attr.Subregion || "").trim();
        const road = (attr.StName ? [attr.StType, attr.StName].filter(Boolean).join(" ").trim() : "").trim();
        const rawMatch = (cand.address || attr.Match_addr || "").trim();
        return {
          lat,
          lng,
          score: Number(cand.score) || 0,
          addrType: attr.Addr_type || "",
          displayName: rawMatch,
          road: road || rawMatch.split(",")[0]?.trim() || "",
          number: (attr.AddNum || "").trim(),
          neighborhood: (attr.Nbrhd || "").trim(),
          city,
          state: uf,
          postcode: attr.Postal ? maskCep(attr.Postal) : "",
          source: "arcgis",
        };
      })
      .filter(Boolean);
  } catch (error) {
    if (externalSignal?.aborted && error?.name === "AbortError") {
      throw error;
    }
    return [];
  } finally {
    cleanup();
  }
}

/**
 * Consulta secundária no Photon (OpenStreetMap / Komoot) com CORS aberto e baixa latência.
 */
async function queryPhotonCandidates(queryText, externalSignal = null) {
  if (!queryText || queryText.trim().length < 3) return [];
  const { signal, cleanup } = createTimeoutSignal(externalSignal, 4200);
  try {
    const url = `${PHOTON_SEARCH_URL}?q=${encodeURIComponent(queryText.trim())}&limit=5`;
    const response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.features)) return [];

    return data.features
      .filter((f) => {
        const cc = String(f?.properties?.countrycode || "").toUpperCase();
        return !cc || cc === "BR";
      })
      .map((f) => {
        const coords = f?.geometry?.coordinates;
        const lng = Number(coords?.[0]);
        const lat = Number(coords?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const p = f.properties || {};
        const road = (p.street || (p.osm_key === "highway" ? p.name : "") || "").trim();
        const number = (p.housenumber || "").trim();
        const neighborhood = (p.district || p.suburb || p.locality || "").trim();
        const city = (p.city || p.town || p.county || "").trim();
        const state = resolveStateUf(p.state || "");
        const postcode = p.postcode ? maskCep(p.postcode) : "";
        const labelParts = [
          road ? (number ? `${road}, ${number}` : road) : p.name,
          neighborhood,
          city && state ? `${city} - ${state}` : city || state,
          postcode,
        ].filter(Boolean);
        return {
          lat,
          lng,
          displayName: labelParts.join(", "),
          road,
          number,
          neighborhood,
          city,
          state,
          postcode,
          osmType: p.type || p.osm_key || "",
          source: "photon",
        };
      })
      .filter(Boolean);
  } catch (error) {
    if (externalSignal?.aborted && error?.name === "AbortError") {
      throw error;
    }
    return [];
  } finally {
    cleanup();
  }
}

/**
 * Consulta estruturada ou textual ao OpenStreetMap Nominatim (fallback adicional).
 */
async function queryNominatimCandidates(paramsOrQuery, externalSignal = null) {
  const { signal, cleanup } = createTimeoutSignal(externalSignal, 4500);
  try {
    let url = "";
    if (typeof paramsOrQuery === "string") {
      if (paramsOrQuery.trim().length < 3) return [];
      const sp = new URLSearchParams({
        format: "json",
        limit: "5",
        countrycodes: "br",
        addressdetails: "1",
        q: paramsOrQuery.trim(),
      });
      url = `${NOMINATIM_SEARCH_URL}?${sp.toString()}`;
    } else {
      const sp = new URLSearchParams({
        format: "json",
        limit: "5",
        countrycodes: "br",
        addressdetails: "1",
        ...paramsOrQuery,
      });
      url = `${NOMINATIM_SEARCH_URL}?${sp.toString()}`;
    }

    const headers = {
      Accept: "application/json",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    };
    if (typeof window === "undefined") {
      headers["User-Agent"] = "NacifEnergySolar/2.0";
    }

    const res = await fetch(url, { signal, headers });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((item) => {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const addr = item.address || {};
        return {
          lat,
          lng,
          displayName: item.display_name || "",
          road: (addr.road || addr.street || addr.pedestrian || "").trim(),
          number: (addr.house_number || "").trim(),
          neighborhood: (addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || "").trim(),
          city: (addr.city || addr.town || addr.municipality || addr.village || "").trim(),
          state: resolveStateUf(addr.state_code || addr.state || ""),
          postcode: addr.postcode ? maskCep(addr.postcode) : "",
          type: item.type || "",
          class: item.class || "",
          source: "nominatim",
        };
      })
      .filter(Boolean);
  } catch (error) {
    if (externalSignal?.aborted && error?.name === "AbortError") {
      throw error;
    }
    return [];
  } finally {
    cleanup();
  }
}

function buildFormattedBrazilianAddress({ road = "", number = "", neighborhood = "", city = "", state = "", postcode = "" }) {
  const streetPart = road ? (number ? `${road}, ${number}` : road) : "";
  const cityState = city && state ? `${city} - ${state}` : city || state;
  return [streetPart, neighborhood, cityState, postcode].filter(Boolean).join(", ");
}

/**
 * Geocodificação em cascata de alta precisão.
 */
export async function geocodeAddressCascade({
  street = "",
  number = "",
  neighborhood = "",
  city = "",
  state = "",
  cep = "",
  cepCoordinates = null,
  signal = null,
}) {
  const cleanStreet = (street || "").trim();
  const cleanNumber = (number || "").trim();
  const cleanNeighborhood = (neighborhood || "").trim();
  const cleanCity = (city || "").trim();
  const cleanState = resolveStateUf(state);
  const cepDigits = cleanDigits(cep);
  const formattedCep = cepDigits.length === 8 ? maskCep(cepDigits) : "";

  const cacheKey = JSON.stringify([
    normalizeText(cleanStreet),
    normalizeText(cleanNumber),
    normalizeText(cleanNeighborhood),
    normalizeText(cleanCity),
    cleanState,
    cepDigits,
  ]);
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL_MS) {
    return cached.value;
  }

  let bestPostalSectorFallback = null;

  // ETAPA 1: Consulta estruturada ArcGIS com Rua + Número (se houver) + Bairro + Cidade + UF + CEP
  if (cleanStreet || formattedCep) {
    const addressLine = cleanStreet
      ? cleanNumber
        ? `${cleanStreet}, ${cleanNumber}`
        : cleanStreet
      : "";

    const arcStructured = await queryArcGisCandidates(
      {
        ...(addressLine ? { address: addressLine } : {}),
        ...(cleanNeighborhood ? { neighborhood: cleanNeighborhood } : {}),
        ...(cleanCity ? { city: cleanCity } : {}),
        ...(cleanState ? { region: cleanState } : {}),
        ...(formattedCep ? { postal: formattedCep } : {}),
      },
      signal
    );

    const validArc = arcStructured.filter(
      (c) =>
        c.score >= 78 &&
        candidateMatchesLocality(c, cleanCity, cleanState, cepDigits)
    );

    // Se buscávamos uma rua específica, priorizamos estritamente acertos de nível Rua/Número (tiers 1 e 2)
    if (cleanStreet) {
      const streetMatch = validArc.find((c) => {
        const info = classifyArcGisAddrType(c.addrType, Boolean(cleanNumber));
        return info.tier <= 2;
      });

      if (streetMatch) {
        const info = classifyArcGisAddrType(streetMatch.addrType, Boolean(cleanNumber));
        const res = {
          lat: streetMatch.lat,
          lng: streetMatch.lng,
          zoom: info.zoom,
          precision: info.precision,
          displayName: buildFormattedBrazilianAddress({
            road: cleanStreet,
            number: cleanNumber || streetMatch.number,
            neighborhood: cleanNeighborhood || streetMatch.neighborhood,
            city: cleanCity || streetMatch.city,
            state: cleanState || streetMatch.state,
            postcode: formattedCep || streetMatch.postcode,
          }) || streetMatch.displayName,
          source: "arcgis_structured",
        };
        geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
        return res;
      }

      // Guarda eventual setor postal (PostalExt) caso a rua seja nova e não conste em OSM
      const postalSector = validArc.find((c) => c.addrType === "PostalExt");
      if (postalSector) {
        bestPostalSectorFallback = postalSector;
      }

      // Tenta ArcGIS sem o bairro caso a grafia do bairro divirja da base cartográfica
      if (cleanNeighborhood) {
        const arcNoBairro = await queryArcGisCandidates(
          {
            address: addressLine,
            ...(cleanCity ? { city: cleanCity } : {}),
            ...(cleanState ? { region: cleanState } : {}),
            ...(formattedCep ? { postal: formattedCep } : {}),
          },
          signal
        );
        const streetNoBairro = arcNoBairro.find((c) => {
          if (c.score < 78 || !candidateMatchesLocality(c, cleanCity, cleanState, cepDigits)) return false;
          return classifyArcGisAddrType(c.addrType, Boolean(cleanNumber)).tier <= 2;
        });
        if (streetNoBairro) {
          const info = classifyArcGisAddrType(streetNoBairro.addrType, Boolean(cleanNumber));
          const res = {
            lat: streetNoBairro.lat,
            lng: streetNoBairro.lng,
            zoom: info.zoom,
            precision: info.precision,
            displayName: buildFormattedBrazilianAddress({
              road: cleanStreet,
              number: cleanNumber || streetNoBairro.number,
              neighborhood: cleanNeighborhood || streetNoBairro.neighborhood,
              city: cleanCity || streetNoBairro.city,
              state: cleanState || streetNoBairro.state,
              postcode: formattedCep || streetNoBairro.postcode,
            }),
            source: "arcgis_street",
          };
          geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
          return res;
        }
      }
    } else if (validArc.length > 0) {
      // CEP geral de cidade/distrito (sem logradouro específico)
      const top = validArc[0];
      const info = classifyArcGisAddrType(top.addrType, false);
      const res = {
        lat: top.lat,
        lng: top.lng,
        zoom: info.zoom,
        precision: info.precision,
        displayName: buildFormattedBrazilianAddress({
          neighborhood: cleanNeighborhood || top.neighborhood,
          city: cleanCity || top.city,
          state: cleanState || top.state,
          postcode: formattedCep || top.postcode,
        }) || top.displayName,
        source: "arcgis_postal",
      };
      geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
      return res;
    }
  }

  // ETAPA 2: Photon (OpenStreetMap) validando estritamente Município + UF
  if (cleanStreet && cleanCity) {
    const photonQuery = [
      cleanNumber ? `${cleanStreet} ${cleanNumber}` : cleanStreet,
      cleanCity,
      cleanState,
      "Brasil",
    ]
      .filter(Boolean)
      .join(", ");

    const photonResults = await queryPhotonCandidates(photonQuery, signal);
    const validPhoton = photonResults.find(
      (c) =>
        Boolean(c.road) &&
        candidateMatchesLocality(c, cleanCity, cleanState, cepDigits)
    );

    if (validPhoton) {
      const res = {
        lat: validPhoton.lat,
        lng: validPhoton.lng,
        zoom: cleanNumber ? 20 : 19,
        precision: cleanNumber ? "exact_number" : "street",
        displayName: buildFormattedBrazilianAddress({
          road: cleanStreet,
          number: cleanNumber || validPhoton.number,
          neighborhood: cleanNeighborhood || validPhoton.neighborhood,
          city: cleanCity || validPhoton.city,
          state: cleanState || validPhoton.state,
          postcode: formattedCep || validPhoton.postcode,
        }),
        source: "photon_street",
      };
      geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
      return res;
    }
  }

  // ETAPA 3: Nominatim Estruturado (street + city + state — evita falha quando bairro diverge no OSM)
  if (cleanStreet && cleanCity) {
    const nomStructured = await queryNominatimCandidates(
      {
        street: cleanNumber ? `${cleanNumber} ${cleanStreet}` : cleanStreet,
        city: cleanCity,
        ...(cleanState ? { state: cleanState } : {}),
      },
      signal
    );

    const validNom = nomStructured.find((c) =>
      candidateMatchesLocality(c, cleanCity, cleanState, cepDigits)
    );

    if (validNom) {
      const res = {
        lat: validNom.lat,
        lng: validNom.lng,
        zoom: cleanNumber ? 20 : 19,
        precision: cleanNumber ? "exact_number" : "street",
        displayName: buildFormattedBrazilianAddress({
          road: cleanStreet,
          number: cleanNumber || validNom.number,
          neighborhood: cleanNeighborhood || validNom.neighborhood,
          city: cleanCity || validNom.city,
          state: cleanState || validNom.state,
          postcode: formattedCep || validNom.postcode,
        }),
        source: "nominatim_structured",
      };
      geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
      return res;
    }
  }

  // ETAPA 4: Setor Postal de 8 dígitos (PostalExt) caso a rua seja recém-criada
  if (bestPostalSectorFallback) {
    const res = {
      lat: bestPostalSectorFallback.lat,
      lng: bestPostalSectorFallback.lng,
      zoom: 18,
      precision: "cep_sector",
      displayName: buildFormattedBrazilianAddress({
        road: cleanStreet,
        number: cleanNumber,
        neighborhood: cleanNeighborhood,
        city: cleanCity || bestPostalSectorFallback.city,
        state: cleanState || bestPostalSectorFallback.state,
        postcode: formattedCep,
      }),
      source: "arcgis_postal_sector",
    };
    geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
    return res;
  }

  if (formattedCep) {
    const arcPostalOnly = await queryArcGisCandidates(
      {
        postal: formattedCep,
        ...(cleanCity ? { city: cleanCity } : {}),
        ...(cleanState ? { region: cleanState } : {}),
      },
      signal
    );
    const validPostal = arcPostalOnly.find(
      (c) => c.score >= 80 && candidateMatchesLocality(c, cleanCity, cleanState, cepDigits)
    );
    if (validPostal) {
      const res = {
        lat: validPostal.lat,
        lng: validPostal.lng,
        zoom: validPostal.addrType === "PostalExt" ? 18 : 17,
        precision: "cep_sector",
        displayName: buildFormattedBrazilianAddress({
          road: cleanStreet,
          number: cleanNumber,
          neighborhood: cleanNeighborhood || validPostal.neighborhood,
          city: cleanCity || validPostal.city,
          state: cleanState || validPostal.state,
          postcode: formattedCep,
        }),
        source: "arcgis_postal_fallback",
      };
      geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
      return res;
    }
  }

  // ETAPA 5: Bairro + Cidade + UF
  if (cleanNeighborhood && cleanCity) {
    const bairroQuery = [cleanNeighborhood, cleanCity, cleanState, "Brasil"].filter(Boolean).join(", ");
    const bairroPhoton = await queryPhotonCandidates(bairroQuery, signal);
    const validBairro = bairroPhoton.find((c) =>
      candidateMatchesLocality(c, cleanCity, cleanState, cepDigits)
    );
    if (validBairro) {
      const res = {
        lat: validBairro.lat,
        lng: validBairro.lng,
        zoom: 17,
        precision: "neighborhood",
        displayName: buildFormattedBrazilianAddress({
          road: cleanStreet,
          neighborhood: cleanNeighborhood,
          city: cleanCity,
          state: cleanState,
          postcode: formattedCep,
        }),
        source: "photon_neighborhood",
      };
      geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
      return res;
    }
  }

  // ETAPA 6: Coordenada aproximada de CEP pré-obtida (apenas último recurso antes do centro municipal)
  if (cepCoordinates && Number.isFinite(Number(cepCoordinates.lat)) && Number.isFinite(Number(cepCoordinates.lng))) {
    return {
      lat: Number(cepCoordinates.lat),
      lng: Number(cepCoordinates.lng),
      zoom: 17,
      precision: "cep_approximate",
    };
  }

  // ETAPA 7: Município + UF
  if (cleanCity) {
    const cityQuery = [cleanCity, cleanState, "Brasil"].filter(Boolean).join(", ");
    const cityArc = await queryArcGisCandidates({ SingleLine: cityQuery }, signal);
    const validCity =
      cityArc.find((c) => candidateMatchesLocality(c, cleanCity, cleanState, cepDigits)) ||
      (await queryPhotonCandidates(cityQuery, signal)).find((c) =>
        candidateMatchesLocality(c, cleanCity, cleanState, cepDigits)
      );

    if (validCity) {
      const res = {
        lat: validCity.lat,
        lng: validCity.lng,
        zoom: 15,
        precision: "city",
        displayName: buildFormattedBrazilianAddress({
          road: cleanStreet,
          neighborhood: cleanNeighborhood,
          city: cleanCity,
          state: cleanState,
          postcode: formattedCep,
        }),
        source: "city_fallback",
      };
      geocodeCache.set(cacheKey, { timestamp: Date.now(), value: res });
      return res;
    }
  }

  return null;
}

/**
 * Geocodifica qualquer CEP brasileiro de 8 dígitos com precisão de rua/quadra.
 */
export async function geocodeByCepPrecise(rawCep, { number = "", signal = null } = {}) {
  const digits = cleanDigits(rawCep);
  if (digits.length !== 8) return null;

  const formattedCep = maskCep(digits);
  const cepLookup = await fetchAddressByCep(digits, { signal });
  if (cepLookup?.aborted) return null;

  if (cepLookup?.success && cepLookup.data) {
    const d = cepLookup.data;
    const geo = await geocodeAddressCascade({
      street: d.address,
      number,
      neighborhood: d.neighborhood,
      city: d.city,
      state: d.state,
      cep: digits,
      cepCoordinates: d.coordinates,
      signal,
    });

    if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
      const displayName = buildFormattedBrazilianAddress({
        road: d.address,
        number,
        neighborhood: d.neighborhood,
        city: d.city,
        state: d.state,
        postcode: d.zip_code || formattedCep,
      });

      return {
        display_name: displayName || geo.displayName || formattedCep,
        lat: geo.lat,
        lng: geo.lng,
        zoom: geo.zoom || (d.address ? 19 : 17),
        precision: geo.precision,
        road: d.address || "",
        number: number || "",
        neighborhood: d.neighborhood || "",
        city: d.city || "",
        state: d.state || "",
        postcode: d.zip_code || formattedCep,
        source: `${cepLookup.provider}+${geo.source || "cascade"}`,
      };
    }
  }

  // Fallback direto por código postal caso bases DNE não tenham o CEP recém-emancipado
  const directPostal = await queryArcGisCandidates({ postal: formattedCep }, signal);
  if (directPostal.length > 0 && directPostal[0].score >= 80) {
    const top = directPostal[0];
    return {
      display_name: top.displayName || formattedCep,
      lat: top.lat,
      lng: top.lng,
      zoom: top.addrType === "PostalExt" ? 18 : 17,
      precision: "cep_sector",
      road: top.road || "",
      number: number || top.number || "",
      neighborhood: top.neighborhood || "",
      city: top.city || "",
      state: top.state || "",
      postcode: top.postcode || formattedCep,
      source: "arcgis_direct_postal",
    };
  }

  return null;
}

/**
 * Obtém coordenadas de um CEP (mantido por compatibilidade com consumidores existentes).
 */
export async function fetchCepCoordinates(cepInput, signal = null) {
  const res = await geocodeByCepPrecise(cepInput, { signal });
  if (!res) return null;
  return {
    lat: res.lat,
    lng: res.lng,
    zoom: res.zoom,
    city: res.city,
    state: res.state,
    street: res.road,
    neighborhood: res.neighborhood,
  };
}

/**
 * Interpreta consultas livres do usuário:
 *  - CEP puro ("26313240", "26313-240", "26.313-240")
 *  - CEP + Número ("26313-240, 120", "26313240 nº 120", "26313240 120")
 *  - Endereço contendo CEP ("Rua Marco Aurélio, 120 - 26313-240")
 *  - Endereço textual ("Rua Marco Aurélio, Jardim Alzira", "Av. Paulista 1578, SP")
 */
export function parseBrazilianSearchInput(rawQuery = "") {
  const clean = String(rawQuery || "").trim();
  if (!clean) return { kind: "empty", query: "" };

  // 1. CEP puro (8 dígitos com ou sem máscara)
  const pureCepMatch = clean.match(/^(\d{2}\.?\d{3}-?\d{3}|\d{8})$/);
  if (pureCepMatch) {
    return {
      kind: "cep",
      cep: cleanDigits(pureCepMatch[1]),
      number: "",
      query: clean,
    };
  }

  // 2. CEP + número do imóvel ("26313-240, 150" / "26313240 nº 150" / "26313240 150")
  const cepWithNumberMatch = clean.match(
    /^(\d{2}\.?\d{3}-?\d{3}|\d{8})\s*(?:[,/-]|\bn[º°.]?\b|\bnumero\b|\bnúmero\b|\s)\s*(\d{1,5}[A-Za-z]?)$/i
  );
  if (cepWithNumberMatch) {
    return {
      kind: "cep",
      cep: cleanDigits(cepWithNumberMatch[1]),
      number: cepWithNumberMatch[2].trim(),
      query: clean,
    };
  }

  // 3. Frase de endereço contendo CEP embutido
  const embeddedCepMatch = clean.match(/\b(\d{5})[-.]?(\d{3})\b/);
  if (embeddedCepMatch) {
    const cepDigits = `${embeddedCepMatch[1]}${embeddedCepMatch[2]}`;
    const withoutCep = clean.replace(embeddedCepMatch[0], " ").trim();
    const numberInTextMatch = withoutCep.match(/(?:,\s*|\bn[º°.]?\s*)(\d{1,5}[A-Za-z]?)\b/i);
    return {
      kind: "cep_in_address",
      cep: cepDigits,
      number: numberInTextMatch ? numberInTextMatch[1] : "",
      query: clean,
    };
  }

  return {
    kind: "text",
    cep: "",
    number: "",
    query: clean,
  };
}

/**
 * Busca universal de endereços e CEPs retornando lista ranqueada de candidatos precisos.
 */
export async function searchAddressPrecise(rawQuery, { signal = null } = {}) {
  const parsed = parseBrazilianSearchInput(rawQuery);
  if (parsed.kind === "empty" || parsed.query.length < 3) return [];

  // Caso A: CEP puro ou CEP + número ou endereço com CEP
  if (parsed.kind === "cep" || parsed.kind === "cep_in_address") {
    const precise = await geocodeByCepPrecise(parsed.cep, {
      number: parsed.number,
      signal,
    });
    if (precise) {
      return [precise];
    }
  }

  // Caso B: Endereço textual livre
  const results = [];
  const seenKeys = new Set();

  const pushUnique = (item) => {
    if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;
    const dedupeKey = `${item.lat.toFixed(4)}:${item.lng.toFixed(4)}`;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    results.push(item);
  };

  // 1. ArcGIS SingleLine (resolve "Rua Marco Aurélio, Jardim Alzira" com score 100 e CEP!)
  const arcCandidates = await queryArcGisCandidates({ SingleLine: parsed.query }, signal);
  for (const cand of arcCandidates) {
    if (cand.score < 75) continue;
    const info = classifyArcGisAddrType(cand.addrType, Boolean(cand.number));
    const formatted = buildFormattedBrazilianAddress({
      road: cand.road,
      number: cand.number,
      neighborhood: cand.neighborhood,
      city: cand.city,
      state: cand.state,
      postcode: cand.postcode,
    });
    pushUnique({
      display_name: formatted || cand.displayName,
      lat: cand.lat,
      lng: cand.lng,
      zoom: info.zoom,
      precision: info.precision,
      road: cand.road,
      number: cand.number,
      neighborhood: cand.neighborhood,
      city: cand.city,
      state: cand.state,
      postcode: cand.postcode,
      source: "arcgis",
    });
  }

  // 2. Photon (complementa POIs, condomínios, loteamentos e ruas mapeadas no OSM)
  if (results.length < 3) {
    const photonCandidates = await queryPhotonCandidates(`${parsed.query}, Brasil`, signal);
    for (const cand of photonCandidates) {
      pushUnique({
        display_name: cand.displayName,
        lat: cand.lat,
        lng: cand.lng,
        zoom: cand.number ? 20 : cand.road ? 19 : 17,
        precision: cand.number ? "exact_number" : cand.road ? "street" : "locality",
        road: cand.road,
        number: cand.number,
        neighborhood: cand.neighborhood,
        city: cand.city,
        state: cand.state,
        postcode: cand.postcode,
        source: "photon",
      });
    }
  }

  // 3. Nominatim como último fallback textual
  if (results.length === 0) {
    const nomCandidates = await queryNominatimCandidates(parsed.query, signal);
    for (const cand of nomCandidates) {
      const formatted = buildFormattedBrazilianAddress({
        road: cand.road,
        number: cand.number,
        neighborhood: cand.neighborhood,
        city: cand.city,
        state: cand.state,
        postcode: cand.postcode,
      });
      pushUnique({
        display_name: formatted || cand.displayName,
        lat: cand.lat,
        lng: cand.lng,
        zoom: cand.number ? 20 : cand.road ? 19 : 16,
        precision: cand.road ? "street" : "locality",
        road: cand.road,
        number: cand.number,
        neighborhood: cand.neighborhood,
        city: cand.city,
        state: cand.state,
        postcode: cand.postcode,
        source: "nominatim",
      });
    }
  }

  return results.slice(0, 6);
}
