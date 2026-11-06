import "../src/config/env.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

try {
  const columns = await prisma.$queryRaw<
    Array<{ table_name: string; column_name: string }>
  >`
    SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
  `;
  const present = new Set(
    columns.map((column) => `${column.table_name}.${column.column_name}`),
  );
  const missing: string[] = [];
  for (const model of Prisma.dmmf.datamodel.models) {
    const table = model.dbName || model.name;
    for (const field of model.fields) {
      if (field.kind === "object") continue;
      const name = `${table}.${field.dbName || field.name}`;
      if (!present.has(name)) missing.push(name);
    }
  }
  if (missing.length) {
    console.error("Tabelas/colunas esperadas pelo Prisma que faltam no banco:");
    missing.forEach((name) => console.error(`- ${name}`));
    process.exitCode = 1;
  } else {
    console.log(
      "OK: todas as tabelas e colunas do schema Prisma existem. Nenhum dado foi alterado.",
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
