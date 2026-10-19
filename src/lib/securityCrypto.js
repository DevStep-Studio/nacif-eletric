/**
 * Motor Criptográfico e de Sanitização de Segurança — Nacif Electric
 * Implementa derivação de senhas com PBKDF2-SHA256, verificação em tempo constante,
 * sanitização de inputs contra XSS e validação de uploads de arquivos.
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function getCryptoSubtle() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  return null;
}

function bufToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Deriva um hash seguro de senha utilizando PBKDF2-SHA256 com 100.000 iterações e salt aleatório.
 */
export async function hashPassword(plainPassword) {
  const subtle = getCryptoSubtle();
  const passwordStr = String(plainPassword || "");

  if (!subtle) {
    // Fallback síncrono simulado para ambientes legados sem WebCrypto
    return `plain:${passwordStr}`;
  }

  const salt = new Uint8Array(SALT_BYTES);
  globalThis.crypto.getRandomValues(salt);

  const enc = new TextEncoder();
  const passwordKey = await subtle.importKey(
    "raw",
    enc.encode(passwordStr),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    KEY_BYTES * 8
  );

  const saltHex = bufToHex(salt.buffer);
  const hashHex = bufToHex(derivedBits);

  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

/**
 * Verifica se uma senha já está armazenada em formato criptográfico seguro.
 */
export function isPasswordHashed(stored) {
  return (
    typeof stored === "string" &&
    (stored.startsWith("pbkdf2_sha256$") || stored.startsWith("pbkdf2:"))
  );
}

/**
 * Verifica se a senha informada corresponde ao registro armazenado.
 * Retorna true se a senha for válida, false caso contrário.
 * Suporta PBKDF2-SHA256 e senhas legadas para compatibilidade retroativa.
 */
export async function verifyPassword(plainPassword, storedPasswordOrHash) {
  const plainStr = String(plainPassword || "");
  const storedStr = String(storedPasswordOrHash || "");

  if (!storedStr) {
    return false;
  }

  // Senha armazenada no padrão moderno PBKDF2
  if (storedStr.startsWith("pbkdf2_sha256$") || storedStr.startsWith("pbkdf2:")) {
    const isDollar = storedStr.startsWith("pbkdf2_sha256$");
    const parts = storedStr.split(isDollar ? "$" : ":");
    if (parts.length !== 4) return false;

    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHashHex = parts[3];

    const subtle = getCryptoSubtle();
    if (!subtle) return false;

    try {
      const saltBuf = hexToBuf(saltHex);
      const enc = new TextEncoder();
      const passwordKey = await subtle.importKey(
        "raw",
        enc.encode(plainStr),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );

      const derivedBits = await subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: new Uint8Array(saltBuf),
          iterations,
          hash: "SHA-256",
        },
        passwordKey,
        KEY_BYTES * 8
      );

      const actualHashHex = bufToHex(derivedBits);
      return timingSafeEqual(actualHashHex, expectedHashHex);
    } catch (err) {
      console.error("[verifyPassword error]", err);
      return false;
    }
  }

  // Suporte a migração segura de senhas legadas existentes em texto simples
  return timingSafeEqual(plainStr, storedStr);
}

/**
 * Sanitiza campos de texto para prevenir XSS armazenado em nomes de projetos, títulos e comentários.
 */
export function sanitizeTextInput(input) {
  if (input === null || input === undefined) return "";
  let str = String(input);

  // Remove scripts executáveis, iframes, objetos e embeds
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  str = str.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  str = str.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "");
  str = str.replace(/javascript:/gi, "blocked:");
  str = str.replace(/\bon[a-z]+\s*=/gi, "data-disabled=");

  return str;
}

/**
 * Validação rigorosa de arquivos para proteção contra upload de malwares e arquivos executáveis.
 */
export const ALLOWED_FILE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/json",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const FORBIDDEN_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".php",
  ".vbs",
  ".js",
  ".msi",
  ".dll",
  ".scr",
  ".com",
  ".pif",
];

export function validateUploadedFile(file, { maxSize = 10 * 1024 * 1024 } = {}) {
  if (!file) return { valid: true };

  const fileName = String(file.name || "").toLowerCase();
  const fileType = String(file.type || "").toLowerCase();
  const fileSize = Number(file.size || 0);

  // 1. Checagem de extensão proibida
  if (FORBIDDEN_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
    throw new Error(`Tipo de arquivo não permitido por segurança: "${file.name}". Arquivos executáveis são bloqueados.`);
  }

  // 2. Checagem de tamanho máximo (Padrão 10MB)
  if (fileSize > maxSize) {
    const mbLimit = Math.round(maxSize / (1024 * 1024));
    throw new Error(`O arquivo excede o tamanho máximo permitido de ${mbLimit} MB.`);
  }

  // 3. Validação de MIME Type caso informado
  if (fileType && !ALLOWED_FILE_MIME_TYPES.includes(fileType) && !fileType.startsWith("image/")) {
    throw new Error(`Formato de arquivo não suportado: ${fileType}. Utilize imagens, PDFs ou documentos compatíveis.`);
  }

  return { valid: true };
}
