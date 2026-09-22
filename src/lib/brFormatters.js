/**
 * brFormatters.js — Utilitários de formatação e máscaras padrão brasileiro (pt-BR)
 */

export function maskCep(value = "") {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function cleanDigits(value = "") {
  return String(value || "").replace(/\D/g, "");
}

export function maskPhone(value = "") {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function maskCpfCnpj(value = "") {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  // CNPJ: 00.000.000/0000-00
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function maskCurrencyBrl(value = "") {
  const numeric = typeof value === "number" ? value : parsePtBrFloat(value);
  if (!Number.isFinite(numeric)) return "R$ 0,00";
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Converte qualquer entrada de texto (ex: "11,55", "11.55", "R$ 1.250,50") em número float padrão.
 */
export function parsePtBrFloat(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (!value) return fallback;
  const str = String(value).trim();
  // Remove moeda e espaços
  const clean = str.replace(/[R$\s]/g, "");
  // Se contiver ponto e vírgula (ex: 1.250,50), remove o ponto e troca vírgula por ponto
  if (clean.includes(".") && clean.includes(",")) {
    const standardized = clean.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(standardized);
    return Number.isFinite(num) ? num : fallback;
  }
  // Se contiver apenas vírgula (ex: 11,55), troca por ponto
  if (clean.includes(",")) {
    const num = parseFloat(clean.replace(",", "."));
    return Number.isFinite(num) ? num : fallback;
  }
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Formata número float para string pt-BR com casas decimais configuráveis.
 */
export function formatPtBrDecimal(value, { minDecimals = 0, maxDecimals = 2 } = {}) {
  const num = typeof value === "number" ? value : parsePtBrFloat(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}
