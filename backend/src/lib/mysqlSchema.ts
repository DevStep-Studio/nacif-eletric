export interface MysqlColumnType {
  column_type: string;
  data_type: string;
  maximum_length: number | bigint | null;
}

// information_schema renders ENUM members as SQL string literals.
export function mysqlEnumValues(columnType: string): string[] {
  return [...columnType.matchAll(/'((?:[^'\\]|\\.|'')*)'/g)]
    .map(match => match[1].replace(/''/g, "'").replace(/\\(.)/g, "$1"));
}

export function enumCompatibilityIssue(column: MysqlColumnType, expected: string[]): string | null {
  if (column.data_type === "enum") {
    const actual = new Set(mysqlEnumValues(column.column_type));
    const missing = expected.filter(value => !actual.has(value));
    return missing.length ? `ENUM sem os valores: ${missing.join(", ")}` : null;
  }
  if (["char", "varchar"].includes(column.data_type)) {
    const required = Math.max(...expected.map(value => value.length));
    return Number(column.maximum_length) < required ? `comprimento insuficiente; requer pelo menos ${required} caracteres` : null;
  }
  if (["tinytext", "text", "mediumtext", "longtext"].includes(column.data_type)) return null;
  return `tipo ${column.data_type} incompatível com os valores de enum do Prisma`;
}
