/**
 * cepService.js — Consulta automática de CEP de alta disponibilidade
 * Provedores oficiais DNE/Correios em cascata:
 *   1. ViaCEP (primário)
 *   2. OpenCEP CDN (secundário ultrarrápido)
 *   3. BrasilAPI v2 / v1 (terciário)
 */

import { cleanDigits, maskCep } from "./brFormatters.js";

const CEP_CACHE_TTL_MS = 30 * 60 * 1000;
const cepCache = new Map();

function createTimeoutSignal(externalSignal = null, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Timeout")), timeoutMs);

  const onExternalAbort = () => {
    clearTimeout(timer);
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener("abort", onExternalAbort);
      }
    },
  };
}

async function fetchJsonWithTimeout(url, externalSignal = null, timeoutMs = 4000) {
  const { signal, cleanup } = createTimeoutSignal(externalSignal, timeoutMs);
  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    cleanup();
  }
}

export async function fetchAddressByCep(cepInput, options = {}) {
  const cep = cleanDigits(cepInput);
  if (cep.length !== 8) {
    return { success: false, error: "CEP deve conter exatamente 8 dígitos." };
  }

  const externalSignal = options?.signal || null;
  if (externalSignal?.aborted) {
    return { success: false, aborted: true };
  }

  const cached = cepCache.get(cep);
  if (cached && Date.now() - cached.timestamp < CEP_CACHE_TTL_MS) {
    return cached.value;
  }

  const formattedZip = maskCep(cep);

  // 1. Provedor Primário: ViaCEP (Espelho DNE Correios)
  try {
    const data = await fetchJsonWithTimeout(`https://viacep.com.br/ws/${cep}/json/`, externalSignal, 3800);
    if (data && !data.erro && (data.localidade || data.logradouro)) {
      const result = {
        success: true,
        provider: "viacep",
        data: {
          zip_code: data.cep || formattedZip,
          address: (data.logradouro || "").trim(),
          complement: (data.complemento || "").trim(),
          neighborhood: (data.bairro || "").trim(),
          city: (data.localidade || "").trim(),
          state: (data.uf || "").trim().toUpperCase(),
          ibge: data.ibge || "",
          coordinates: null,
        },
      };
      cepCache.set(cep, { timestamp: Date.now(), value: result });
      return result;
    }
  } catch (error) {
    if (externalSignal?.aborted || error?.name === "AbortError") {
      if (externalSignal?.aborted) return { success: false, aborted: true };
    }
  }

  // 2. Provedor Secundário: OpenCEP CDN (Alta disponibilidade)
  try {
    const data = await fetchJsonWithTimeout(`https://opencep.com/v1/${cep}.json`, externalSignal, 3800);
    if (data && !data.erro && (data.localidade || data.logradouro)) {
      const result = {
        success: true,
        provider: "opencep",
        data: {
          zip_code: data.cep || formattedZip,
          address: (data.logradouro || "").trim(),
          complement: (data.complemento || "").trim(),
          neighborhood: (data.bairro || "").trim(),
          city: (data.localidade || "").trim(),
          state: (data.uf || "").trim().toUpperCase(),
          ibge: data.ibge || "",
          coordinates: null,
        },
      };
      cepCache.set(cep, { timestamp: Date.now(), value: result });
      return result;
    }
  } catch {
    if (externalSignal?.aborted) return { success: false, aborted: true };
  }

  // 3. Provedor Terciário: BrasilAPI (v2 -> v1)
  try {
    let data = await fetchJsonWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`, externalSignal, 4000);
    if (!data || !data.cep) {
      data = await fetchJsonWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cep}`, externalSignal, 4000);
    }

    if (data && (data.cep || data.city)) {
      const coords = data.location?.coordinates;
      const lat = Number(coords?.latitude);
      const lng = Number(coords?.longitude);
      const approximateCoordinates =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat, lng, approximate: true }
          : null;

      const result = {
        success: true,
        provider: "brasilapi",
        data: {
          zip_code: maskCep(data.cep || cep),
          address: (data.street || "").trim(),
          complement: "",
          neighborhood: (data.neighborhood || "").trim(),
          city: (data.city || "").trim(),
          state: (data.state || "").trim().toUpperCase(),
          ibge: typeof data.ibge === "object" ? (data.ibge?.city || "") : (data.ibge || ""),
          coordinates: approximateCoordinates,
        },
      };
      cepCache.set(cep, { timestamp: Date.now(), value: result });
      return result;
    }
  } catch {
    if (externalSignal?.aborted) return { success: false, aborted: true };
  }

  return {
    success: false,
    error: "CEP não encontrado. Confira os 8 dígitos ou informe o endereço.",
  };
}
