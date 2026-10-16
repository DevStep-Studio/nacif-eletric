/**
 * geocodingService.js
 * Serviço de geocodificação em cascata para centralização precisa do mapa solar no Brasil.
 *
 * Ordem de prioridade:
 * 1. Endereço completo com número (quando disponível) -> Zoom 19 (edificação/telhado)
 * 2. Rua + Bairro + Cidade + Estado -> Zoom 18 (rua)
 * 3. Rua + Cidade + Estado -> Zoom 18 (rua)
 * 4. Centro aproximado do CEP (BrasilAPI v2 / OpenCEP) -> Zoom 17 (quadra/bairro)
 * 5. Centro da cidade (Cidade - UF, Brasil) -> Zoom 14
 */

import { cleanDigits } from "./brFormatters.js";

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/**
 * Consulta pontual ao OpenStreetMap Nominatim com headers e parâmetros otimizados para o Brasil.
 */
async function queryNominatim(query, signal) {
  if (!query || query.trim().length < 3) return null;

  try {
    const url = `${NOMINATIM_SEARCH_URL}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query.trim())}`;
    const headers = {
      Accept: "application/json",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    };
    if (typeof window === "undefined") {
      headers["User-Agent"] = "NacifEletricApp/1.0 (dev-test)";
    }

    const res = await fetch(url, {
      signal,
      headers,
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          lat,
          lng,
          displayName: first.display_name,
          type: first.type,
          class: first.class,
          raw: first,
        };
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
  }
  return null;
}

/**
 * Obtém coordenadas aproximadas do CEP diretamente via BrasilAPI v2 (OpenCEP).
 */
export async function fetchCepCoordinates(cepInput, signal) {
  const digits = cleanDigits(cepInput);
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
      signal,
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      const coords = data?.location?.coordinates;
      if (coords && coords.latitude && coords.longitude) {
        const lat = Number(coords.latitude);
        const lng = Number(coords.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return {
            lat,
            lng,
            city: data.city || "",
            state: data.state || "",
            street: data.street || "",
            neighborhood: data.neighborhood || "",
          };
        }
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
  }
  return null;
}

/**
 * Geocodificação em cascata respeitando a ordem de prioridade estipulada.
 *
 * @param {Object} params
 * @param {string} params.street - Logradouro / Rua
 * @param {string} [params.number] - Número do imóvel
 * @param {string} [params.neighborhood] - Bairro
 * @param {string} params.city - Cidade
 * @param {string} params.state - Estado (UF)
 * @param {string} [params.cep] - CEP com 8 dígitos
 * @param {Object} [params.cepCoordinates] - Coordenadas pré-obtidas do CEP ({ lat, lng })
 * @param {AbortSignal} [params.signal] - Sinal de cancelamento
 * @returns {Promise<{ lat: number, lng: number, zoom: number, precision: string } | null>}
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
  const cleanState = (state || "").trim().slice(0, 2).toUpperCase();

  // 1. Prioridade 1: Endereço completo com número (quando disponível)
  if (cleanStreet && cleanNumber && cleanCity && cleanState) {
    if (cleanNeighborhood) {
      const queryWithBairro = `${cleanStreet}, ${cleanNumber}, ${cleanNeighborhood}, ${cleanCity} - ${cleanState}, Brasil`;
      const result = await queryNominatim(queryWithBairro, signal);
      if (result) {
        return {
          lat: result.lat,
          lng: result.lng,
          zoom: 19,
          precision: "exact_number",
          displayName: result.displayName,
        };
      }
    }

    const queryStreetNumber = `${cleanStreet}, ${cleanNumber}, ${cleanCity} - ${cleanState}, Brasil`;
    const resultStreetNumber = await queryNominatim(queryStreetNumber, signal);
    if (resultStreetNumber) {
      return {
        lat: resultStreetNumber.lat,
        lng: resultStreetNumber.lng,
        zoom: 19,
        precision: "exact_number",
        displayName: resultStreetNumber.displayName,
      };
    }
  }

  // 2. Prioridade 2: Rua + Bairro + Cidade + Estado
  if (cleanStreet && cleanNeighborhood && cleanCity && cleanState) {
    const queryStreetBairro = `${cleanStreet}, ${cleanNeighborhood}, ${cleanCity} - ${cleanState}, Brasil`;
    const resultStreetBairro = await queryNominatim(queryStreetBairro, signal);
    if (resultStreetBairro) {
      return {
        lat: resultStreetBairro.lat,
        lng: resultStreetBairro.lng,
        zoom: 18,
        precision: "street_neighborhood",
        displayName: resultStreetBairro.displayName,
      };
    }
  }

  // 3. Prioridade 3: Rua + Cidade + Estado
  if (cleanStreet && cleanCity && cleanState) {
    const queryStreetCity = `${cleanStreet}, ${cleanCity} - ${cleanState}, Brasil`;
    const resultStreetCity = await queryNominatim(queryStreetCity, signal);
    if (resultStreetCity) {
      return {
        lat: resultStreetCity.lat,
        lng: resultStreetCity.lng,
        zoom: 18,
        precision: "street",
        displayName: resultStreetCity.displayName,
      };
    }
  }

  // 4. Prioridade 4: Centro aproximado do CEP
  if (cepCoordinates && Number.isFinite(cepCoordinates.lat) && Number.isFinite(cepCoordinates.lng)) {
    return {
      lat: cepCoordinates.lat,
      lng: cepCoordinates.lng,
      zoom: 17,
      precision: "cep_approximate",
    };
  }

  const digits = cleanDigits(cep);
  if (digits.length === 8) {
    const fetchedCepCoords = await fetchCepCoordinates(digits, signal);
    if (fetchedCepCoords) {
      return {
        lat: fetchedCepCoords.lat,
        lng: fetchedCepCoords.lng,
        zoom: 17,
        precision: "cep_approximate",
      };
    }
  }

  // 5. Fallback seguro: Cidade + Estado (não altera para coordenadas aleatórias)
  if (cleanCity && cleanState) {
    const queryCity = `${cleanCity} - ${cleanState}, Brasil`;
    const resultCity = await queryNominatim(queryCity, signal);
    if (resultCity) {
      return {
        lat: resultCity.lat,
        lng: resultCity.lng,
        zoom: 14,
        precision: "city",
        displayName: resultCity.displayName,
      };
    }
  }

  return null;
}
