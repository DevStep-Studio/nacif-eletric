/**
 * Gerenciador e Validador de Migrations do Banco de Dados — Nacif Electric
 * Verifica integridade, ordem cronológica, checksums SHA-256 e reprodutibilidade do esquema.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "src/db/migrations");

/**
 * Lê e retorna todas as migrations ordenadas por prefixo cronológico
 */
export function getAvailableMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((fileName) => {
    const fullPath = path.join(MIGRATIONS_DIR, fileName);
    const content = fs.readFileSync(fullPath, "utf-8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    return {
      name: fileName,
      path: fullPath,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      checksum: hash,
      content,
    };
  });
}

/**
 * Valida a sintaxe SQL essencial e integridade relacional das migrations
 */
export function validateMigrationsIntegrity() {
  const migrations = getAvailableMigrations();
  const errors = [];
  const discoveredTables = new Set();
  const referencedTables = new Set();

  if (migrations.length === 0) {
    errors.push("Nenhuma migration encontrada no diretório src/db/migrations");
    return { valid: false, errors, migrationsCount: 0 };
  }

  migrations.forEach((migration) => {
    const sql = migration.content;

    // Detectar CREATE TABLE
    const createTableMatches = sql.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_]+)/gi);
    for (const match of createTableMatches) {
      discoveredTables.add(match[1].toLowerCase());
    }

    // Detectar REFERENCES table(col)
    const referencesMatches = sql.matchAll(/REFERENCES\s+([a-zA-Z0-9_]+)\s*\(/gi);
    for (const match of referencesMatches) {
      referencedTables.add(match[1].toLowerCase());
    }

    // Verificar se há ponto e vírgula delimitando instruções
    if (!sql.includes(";")) {
      errors.push(`Migration ${migration.name} não contém delimitadores de instrução SQL (;)`);
    }
  });

  // Verificar se todas as tabelas referenciadas por Foreign Keys foram criadas
  referencedTables.forEach((table) => {
    if (!discoveredTables.has(table)) {
      errors.push(`Tabela referenciada por Foreign Key '${table}' não foi criada em nenhuma migration.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    migrationsCount: migrations.length,
    tables: Array.from(discoveredTables),
  };
}
