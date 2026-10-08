# Arquitetura do Projeto Nacif Eletric

Documento explicativo da estrutura de pastas, fluxos de dados e padrões de desenvolvimento do frontend **Nacif Eletric**.

---

## 1. Estrutura de Diretórios

```
nacif-eletric/
├── docs/                      # Documentação técnica e guias de arquitetura
│   ├── ARCHITECTURE.md        # Visão geral da arquitetura do frontend
│   ├── PANEL_GENERATOR_ROUTER.md # Detalhamento do gerador de quadros e roteador ortogonal
│   └── UX_NAVIGATION_REFACTOR.md # Especificação do fluxo de navegação e UX
├── public/                    # Assets estáticos públicos (ícones, imagens)
├── scripts/                   # Testes automatizados (smoke tests, testes de roteador)
│   ├── orthogonal-router-tests.mjs
│   └── *.smoke.mjs
├── src/                       # Código-fonte da aplicação React
│   ├── api/                   # Clientes de integração e API backend
│   ├── components/            # Componentes reutilizáveis de UI
│   │   └── ui/                # Primitivos base (Shadcn UI / Tailwind)
│   ├── context/               # React Contexts (Autenticação, Notificações, etc.)
│   ├── hooks/                 # Custom React Hooks
│   ├── lib/                   # Motores de cálculo, utilitários e algoritmos centrais
│   │   ├── electricalEngine.js  # Cálculos elétricos NBR 5410, disjuntores, quedas de tensão
│   │   ├── orthogonalRouter.js  # Roteamento ortogonal e geometria 2D
│   │   └── utils.js             # Funções utilitárias auxiliares
│   ├── pages/                 # Páginas e fluxos principais da aplicação
│   │   ├── PanelGenerator.jsx   # Editor visual de quadros elétricos
│   │   ├── SingleLineDiagram.jsx # Diagrama unifilar
│   │   ├── SolarWizard.jsx      # Assistente de dimensionamento solar fotovoltaico
│   │   └── Projects.jsx         # Gerenciamento de projetos elétricos
│   └── App.jsx                # Roteamento central e inicialização
├── package.json               # Dependências e scripts npm
├── tailwind.config.js         # Configuração de tema e design system Tailwind
└── vite.config.js             # Configuração do Vite Bundler
```

---

## 2. Padrões de Código e Boas Práticas

- **Componentização:** Manter componentes focados e com responsabilidade clara.
- **Rigor Matemático & Elétrico:** Todos os cálculos elétricos e dimensionamentos seguem estritamente as diretrizes da **NBR 5410** e **NBR 16690** (solar).
- **Testes Obrigatórios:** Antes de efetuar commits ou releases, validar os testes automatizados:
  ```bash
  npm run test:orthogonal-router
  npm run build
  ```
- **Auto-Commit Obrigatório:** Seguir o padrão Conventional Commits (`feat:`, `fix:`, `style:`, `refactor:`, `docs:`, `chore:`).
