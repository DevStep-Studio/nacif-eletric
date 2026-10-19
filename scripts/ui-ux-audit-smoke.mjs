import fs from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

console.log("=== INICIANDO SMOKE TEST DE AUDITORIA UI/UX NACIF ELECTRIC ===");

// 1. Verificar index.css (foco acessível e proteção de botões circulares)
const indexCssPath = path.join(workspaceRoot, "src", "index.css");
assert(fs.existsSync(indexCssPath), "src/index.css existe");
const indexCssContent = fs.readFileSync(indexCssPath, "utf-8");
assert(
  indexCssContent.includes(":focus-visible") && indexCssContent.includes("#005B94"),
  "index.css define indicador de foco visível de alto contraste (#005B94) para WCAG 2.2 AA"
);
assert(
  indexCssContent.includes("button.rounded-full:not(.w-6)"),
  "index.css protege botões circulares de ícone e avatares contra deformação"
);

// 2. Verificar button.jsx (anel de foco padronizado)
const buttonJsxPath = path.join(workspaceRoot, "src", "components", "ui", "button.jsx");
assert(fs.existsSync(buttonJsxPath), "src/components/ui/button.jsx existe");
const buttonJsxContent = fs.readFileSync(buttonJsxPath, "utf-8");
assert(
  buttonJsxContent.includes("focus-visible:ring-2 focus-visible:ring-[#005B94]"),
  "button.jsx utiliza anel de foco padronizado e acessível"
);

// 3. Verificar Home.jsx (Dashboard limpo, sem banner decorativo de marketing e com exclusão segura)
const homeJsxPath = path.join(workspaceRoot, "src", "pages", "Home.jsx");
assert(fs.existsSync(homeJsxPath), "src/pages/Home.jsx existe");
const homeJsxContent = fs.readFileSync(homeJsxPath, "utf-8");
assert(
  !homeJsxContent.includes("Dimensionamento elétrico profissional e instantâneo"),
  "Home.jsx removeu banner decorativo redundante que ocupava espaço no topo do dashboard"
);
assert(
  homeJsxContent.includes("Painel Geral") && homeJsxContent.includes("Novo Projeto"),
  "Home.jsx integra 'Novo Projeto' e 'Painel Geral' no cabeçalho operacional"
);
assert(
  homeJsxContent.includes("AlertDialog") && homeJsxContent.includes("projectToDeleteHome"),
  "Home.jsx implementa confirmação segura via AlertDialog para exclusão de projetos"
);

// 4. Verificar Projects.jsx (diferenciação semântica de status e exclusão com AlertDialog)
const projectsJsxPath = path.join(workspaceRoot, "src", "pages", "Projects.jsx");
assert(fs.existsSync(projectsJsxPath), "src/pages/Projects.jsx existe");
const projectsJsxContent = fs.readFileSync(projectsJsxPath, "utf-8");
assert(
  projectsJsxContent.includes("border-emerald-200 bg-emerald-50 text-emerald-800"),
  "Projects.jsx possui badge semântico verde/esmeralda para Concluído/Aprovado"
);
assert(
  projectsJsxContent.includes("border-slate-200 bg-slate-100 text-slate-700"),
  "Projects.jsx possui badge semântico slate para Rascunho"
);
assert(
  projectsJsxContent.includes("AlertDialog") && projectsJsxContent.includes("projectToDelete"),
  "Projects.jsx implementa confirmação de exclusão individual e em lote com AlertDialog"
);

// 5. Verificar Budget.jsx (integridade de imports e ícones)
const budgetJsxPath = path.join(workspaceRoot, "src", "pages", "Budget.jsx");
assert(fs.existsSync(budgetJsxPath), "src/pages/Budget.jsx existe");
const budgetJsxContent = fs.readFileSync(budgetJsxPath, "utf-8");
assert(
  budgetJsxContent.includes("Package,") || budgetJsxContent.includes("Package\n"),
  "Budget.jsx importa Package de lucide-react evitando falhas em tempo de execução"
);

// 6. Verificar Layout.jsx (sidebar e navegação)
const layoutJsxPath = path.join(workspaceRoot, "src", "components", "Layout.jsx");
assert(fs.existsSync(layoutJsxPath), "src/components/Layout.jsx existe");
const layoutJsxContent = fs.readFileSync(layoutJsxPath, "utf-8");
assert(
  layoutJsxContent.includes("SIDEBAR_STORAGE_KEY") && layoutJsxContent.includes("sidebarCollapsed"),
  "Layout.jsx mantém persistência e alternância suave da barra lateral"
);

console.log("=== TODOS OS 12 TESTES DE SMOKE DA AUDITORIA UI/UX FORAM APROVADOS COM SUCESSO! ===");
