import assert from "node:assert/strict";
import { test } from "node:test";
import { mysqlEnumValues, enumCompatibilityIssue } from "../src/lib/mysqlSchema.js";

const roles = ["super_admin", "admin", "user"];
test("detects legacy role enums even when the column exists", () => {
  assert.equal(enumCompatibilityIssue({ column_type: "enum('admin','cliente')", data_type: "enum", maximum_length: 7 }, roles), "ENUM sem os valores: super_admin, user");
});
test("accepts extended enums without requiring deletion of legacy values", () => {
  assert.equal(enumCompatibilityIssue({ column_type: "enum('cliente','super_admin','admin','user')", data_type: "enum", maximum_length: 11 }, roles), null);
});
test("identifies narrow string columns and accepts sufficient capacity", () => {
  assert.match(enumCompatibilityIssue({ column_type: "varchar(5)", data_type: "varchar", maximum_length: 5 }, roles)!, /11 caracteres/);
  assert.equal(enumCompatibilityIssue({ column_type: "varchar(191)", data_type: "varchar", maximum_length: 191n }, roles), null);
  assert.match(enumCompatibilityIssue({ column_type: "int", data_type: "int", maximum_length: null }, roles)!, /incompatível/);
});
test("parses SQL escapes without splitting values that contain commas", () => {
  assert.deepEqual(mysqlEnumValues("enum('user','legacy,role','it''s','can\\'t')"), ["user", "legacy,role", "it's", "can't"]);
});
