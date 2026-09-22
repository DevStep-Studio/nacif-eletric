/**
 * cepService.js — Consulta automática de CEP com fallback e tratamento de erros
 * Provedores: ViaCEP (primário) -> BrasilAPI (secundário/fallback)
 */

import { cleanDigits } from "./brFormatters";

let currentAbortController = null;

export async function fetchAddressByCep(cepInput) {
  const cep = cleanDigits(cepInput);
  if (cep.length !== 8) {
    return { success: false, error: "CEP deve conter exatamente 8 dígitos." };
  }

  // Cancela consulta anterior se o usuário continuou digitando
  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();
  const { signal } = currentAbortController;

  // 1. Tenta ViaCEP
  try {
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal,
      headers: { Accept: "application/json" },
    });

    if (viaCepResponse.ok) {
      const data = await viaCepResponse.json();
      if (!data.erro) {
        return {
          success: true,
          provider: "viacep",
          data: {
            zip_code: data.cep || `${cep.slice(0, 5)}-${cep.slice(5)}`,
            address: data.logradouro || "",
            complement: data.complemento || "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: (data.uf || "").toUpperCase(),
            ibge: data.ibge || "",
          },
        };
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return { success: false, aborted: true };
    }
    // Prossegue para o fallback BrasilAPI
  }

  // 2. Fallback: BrasilAPI
  try {
    const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
      signal,
      headers: { Accept: "application/json" },
    });

    if (brasilApiResponse.ok) {
      const data = await brasilApiResponse.json();
      if (data && data.cep) {
        return {
          success: true,
          provider: "brasilapi",
          data: {
            zip_code: data.cep || `${cep.slice(0, 5)}-${cep.slice(5)}`,
            address: data.street || "",
            complement: "",
            neighborhood: data.neighborhood || "",
            city: data.city || "",
            state: (data.state || "").toUpperCase(),
            ibge: data.ibge || "",
          },
        };
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return { success: false, aborted: true };
    }
  }

  return {
    success: false,
    error: "CEP não encontrado. Confira o número ou preencha o endereço manualmente.",
  };
}
