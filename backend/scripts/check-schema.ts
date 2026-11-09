import "../src/config/env.js";
import { Prisma } from "@prisma/client";
import { enumCompatibilityIssue, type MysqlColumnType } from "../src/lib/mysqlSchema.js";
import { prisma } from "../src/lib/prisma.js";

try {
  const columns = await prisma.$queryRaw<
    Array<{ table_name: string; column_name: string } & MysqlColumnType>
  >`
    SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
      COLUMN_TYPE AS column_type, DATA_TYPE AS data_type, CHARACTER_MAXIMUM_LENGTH AS maximum_length
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
  `;
  const present = new Set(
    columns.map((column) => `${column.table_name}.${column.column_name}`),
  );
  const missing: string[] = [];
  const incompatible: string[] = [];
  const byName = new Map(columns.map(column => [`${column.table_name}.${column.column_name}`, column]));
  for (const model of Prisma.dmmf.datamodel.models) {
    const table = model.dbName || model.name;
    for (const field of model.fields) {
      if (field.kind === "object") continue;
      const name = `${table}.${field.dbName || field.name}`;
      if (!present.has(name)) missing.push(name);
      if (field.kind === "enum") {
        const definition = Prisma.dmmf.datamodel.enums.find(item => item.name === field.type);
        const column = byName.get(name);
        if (definition && column) {
          const issue = enumCompatibilityIssue(column, definition.values.map(value => value.dbName || value.name));
          if (issue) incompatible.push(`${name}: ${issue}`);
        }
      }
    }
  }
  if (missing.length) {
    console.error("Tabelas/colunas esperadas pelo Prisma que faltam no banco:");
    missing.forEach((name) => console.error(`- ${name}`));
    process.exitCode = 1;
  }
  if (incompatible.length) {
    console.error("Colunas com tipos incompatíveis com o schema Prisma:");
    incompatible.forEach(issue => console.error(`- ${issue}`));
    console.error("Para users.role/plan, aplique a migration 20261109020000_reconcile_user_role_plan_enums.");
    process.exitCode = 1;
  }
  if (!missing.length && !incompatible.length) {
    console.log(
      "OK: tabelas, colunas e valores de enums compatíveis com o Prisma. Nenhum dado foi alterado.",
    );
  }
} catch (error: any) {
  console.error(
    `Não foi possível verificar o banco (${error.code || "erro de conexão"}). Confira DATABASE_URL e o acesso ao banco no backend.`,
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
