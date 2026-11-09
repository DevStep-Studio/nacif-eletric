import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { parse } from "@babel/parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "src/pages/SolarProject.jsx");
const source = await fs.readFile(entry, "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["jsx"] });
const imports = new Map(ast.program.body
  .filter(node => node.type === "ImportDeclaration")
  .map(node => [node.source.value, node.specifiers]));
const component = ast.program.body.find(node => node.type === "ExportDefaultDeclaration").declaration;
const stateNames = component.body.body.filter(node => node.type === "VariableDeclaration")
  .flatMap(node => node.declarations)
  .filter(node => node.id.type === "ArrayPattern" && node.init?.type === "CallExpression" && node.init.callee.name === "useState")
  .map(node => node.id.elements[0].name);
const overrides = values => Object.fromEntries(Object.entries(values).map(([name, value]) => {
  const index = stateNames.indexOf(name);
  assert.ok(index >= 0, `Estado desconhecido: ${name}`);
  return [index, value];
}));
const require = createRequire(path.join(root, "package.json"));
const globalKey = "__nacifSolarRenderTest";

// Execute the page's render computations with real solar calculations. Browser-only
// children and effects are isolated: this checks initialization, not map interaction.
for (const minify of [false, true]) {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, format: "cjs",
    platform: "node", jsx: "automatic", minify,
    plugins: [{ name: "solar-render-isolation", setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({ path: "hooks", namespace: "isolated" }));
      builder.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: "jsx", namespace: "isolated" }));
      builder.onResolve({ filter: /^(react-router-dom|lucide-react)$/ }, args => ({ path: args.path, namespace: "isolated" }));
      builder.onResolve({ filter: /^@\// }, args => {
        const isolated = args.path.includes("/components/") || args.path.includes("/assets/") ||
          ["/api/", "/lib/AuthContext", "/lib/planEnforcement", "/lib/solarAiServices", "/lib/geocodingService", "/lib/solarReportGenerator", "/lib/solarLayoutImageRenderer"]
            .some(part => args.path.includes(part));
        return isolated ? { path: args.path, namespace: "isolated" } : { path: path.join(root, "src", `${args.path.slice(2)}.js`) };
      });
      builder.onLoad({ filter: /.*/, namespace: "isolated" }, ({ path: modulePath }) => {
        if (modulePath === "hooks") return { contents: `
          const state = () => globalThis.${globalKey};
          export const useState = initial => {
            const index = state().index++;
            return [Object.hasOwn(state().values, index) ? state().values[index] : typeof initial === 'function' ? initial() : initial, () => {}];
          };
          export const useMemo = fn => { const value = fn(); state().memos.push(value); return value; };
          export const useCallback = fn => fn;
          export const useEffect = () => {};
          export const useRef = initial => ({ current: initial });
        ` };
        if (modulePath === "jsx") return { contents: "export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx; export const Fragment = 'fragment';" };
        const exports = (imports.get(modulePath) || []).map(specifier => {
          if (specifier.type === "ImportDefaultSpecifier") return "export default Stub;";
          const name = specifier.imported.name;
          if (name === "useToast") return "export const useToast = () => ({ toast: () => {} });";
          if (name === "useAuth") return "export const useAuth = () => ({ user: { id: 'test', full_name: 'Responsável Teste', role: 'admin' } });";
          if (name === "useSearchParams") return "export const useSearchParams = () => [new URLSearchParams(), () => {}];";
          if (name === "backend") return "export const backend = {};";
          return `export const ${name} = Stub;`;
        });
        return { contents: `function Stub() { return null; }\n${exports.join("\n")}` };
      });
    } }],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
  const project = {
    id: "solar-render-test", name: "Projeto Solar Teste", address: "Endereço de teste",
    consumption: { monthly_consumption_kwh: 420, tariff_brl_kwh: 0.95 },
  };
  const cases = [
    ["carregando", {}],
    ["projeto ausente", overrides({ loadingProject: false })],
    ["projeto carregado", overrides({ project, loadingProject: false })],
    ["módulo selecionado", overrides({ project, loadingProject: false, selectedEntity: { type: "module", id: 0 } })],
  ];
  try {
    for (const [name, values] of cases) {
      globalThis[globalKey] = { index: 0, values, memos: [] };
      const tree = module.exports.default();
      assert.equal(tree.type, "div", `${name}: a página precisa renderizar sem ReferenceError`);
      if (values[stateNames.indexOf("project")]) {
        const report = globalThis[globalKey].memos.find(value => value?.id === project.id && value.technical_responsible);
        assert.ok(report, "os dados do relatório precisam ser calculados");
        assert.equal(report.consumption.monthly_consumption_kwh, 420);
        assert.equal(report.technical_responsible.name, "Responsável Teste");
      }
    }
  } finally { delete globalThis[globalKey]; }
}
console.log("PASS: renderização solar inicial e carregada, dados de relatório e bundle minificado sem erro de inicialização.");
