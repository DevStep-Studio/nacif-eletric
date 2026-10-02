# Nacif Eletric Front

Frontend de dimensionamento, gestão de projetos e engenharia elétrica inteligente com geração visual de quadros elétricos e diagramas unifilares em conformidade com as normas **NBR 5410** e **NBR 16690**.

---

## 📚 Documentação do Projeto

A documentação detalhada da arquitetura, motores de cálculo e especificações de interface encontra-se na pasta [`docs/`](./docs):

- 📐 **[Arquitetura do Sistema](./docs/ARCHITECTURE.md)**: Estrutura de pastas, padrões e fluxo de dados.
- ⚡ **[Gerador de Quadros e Roteamento Ortogonal](./docs/PANEL_GENERATOR_ROUTER.md)**: Roteador Manhattan, sistema de coordenadas do mundo, resolução de bornes e persistência determinística.
- 🧭 **[Guia de Navegação e UX](./docs/UX_NAVIGATION_REFACTOR.md)**: Especificação da experiência do usuário e refatoração de fluxos.

---

## 🚀 Como Executar Localmente

### 1. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
VITE_API_BASE_URL=http://localhost:3001
```

### 2. Instalação e Desenvolvimento
```bash
npm install
npm run dev
```

### 3. Testes Automatizados
```bash
npm run test:orthogonal-router
```

### 4. Build de Produção
```bash
npm run build
npm run preview
```
