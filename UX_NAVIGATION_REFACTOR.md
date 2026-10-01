# ⚡ Nacif Electric — Reestruturação de UX, Navegação, Dashboard e Onboarding

Este documento descreve detalhadamente a reestruturação da experiência do usuário (UX), arquitetura de informação, sidebar/header, dashboard e fluxo inicial de onboarding implementados no **Nacif Electric**.

---

## 1. Arquitetura Anterior vs. Nova Arquitetura

### 🛑 Arquitetura Anterior (Problemas Identificados)
- **Sobrecarga Cognitiva na Sidebar**: Exposição simultânea de mais de 12 ferramentas técnicas o tempo todo (Dashboard, Projetos, Editor de Planta, Circuitos, Quadro, Diagrama Unifilar, Balanço de Fases, Scanner IA, Calculadora, Biblioteca NBR, Materiais, Orçamento, Memorial). O usuário não sabia qual era o próximo passo lógico.
- **Dashboard Poluído**: Múltiplos cards grandes e coloridos exibindo zeros quando o workspace não possuía projetos, além de checklists persistentes e tripla duplicação do botão "Novo projeto" (na sidebar, no header e no hero).
- **Falta de Contexto**: As ferramentas funcionavam como módulos isolados sem transmitir a sensação de "estar dentro de um projeto específico".
- **Sem Onboarding**: Usuários de primeiro acesso eram direcionados diretamente para um dashboard cheio de módulos sem orientação.

---

### 🚀 Nova Arquitetura de Navegação (Progressive Disclosure)

A navegação foi dividida em **duas camadas distintas**:

```
                                  NACIF ELECTRIC
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     CAMADA 1: NAVEGAÇÃO GLOBAL                     CAMADA 2: CONTEXTO DO PROJETO
   (Fora de um projeto específico)                 (Ao abrir /projects/:id ou ?project=id)
                 │                                               │
 ├── VISÃO GERAL                                 ├── ← Meus projetos (Voltar)
 │   └── Início (Dashboard Limpo)                ├── Card do Projeto (Nome + Tipo + Progresso %)
 │                                               ├── VISÃO GERAL
 ├── PROJETOS                                    │   └── Visão Geral do Projeto
 │   ├── Meus projetos                           ├── PROJETO
 │   └── + Novo projeto                          │   ├── Planta (Planta IA)
 │                                               │   ├── Circuitos (Editor de Circuitos)
 ├── RECURSOS                                    │   └── Quadro Elétrico (Gerador DIN)
 │   ├── Ferramentas (Calculadoras + Scanner)    ├── ANÁLISE
 │   └── Biblioteca (Normas NBR + Materiais)     │   └── Balanço de Fases
 │                                               └── DOCUMENTAÇÃO
 └── PLANO & CONTA (Discreto no rodapé)              ├── Diagrama Unifilar
     └── Profissional (Uso de Projetos)              ├── Documentos & Memorial
                                                     ├── Lista de Materiais (BOM)
                                                     └── Orçamento
```

---

## 2. Camada 1: Menu Global

Quando o usuário está navegando no sistema fora de um projeto:
1. **VISÃO GERAL**:
   - `Início` (`/`): Dashboard limpo focado em continuar trabalho, criar projeto ou importar planta.
2. **PROJETOS**:
   - `Meus projetos` (`/projects`): Listagem completa com busca, filtros de status, visualização em tabela e cards com barra de progresso real.
   - `Novo projeto` (`/projects/new`): Criação guiada de projetos.
3. **RECURSOS** (Agrupados em Modais/Drawers Rápidos):
   - `Ferramentas`: Calculadoras de Engenharia (Queda de tensão, Dimensionamento NBR 5410, Taxa de ocupação de eletrodutos), Scanner IA de Plantas e Assistente IA.
   - `Biblioteca`: Normas NBR (NBR 5410, 5419, 14039), Catálogo de Materiais, Componentes e Orçamento.
4. **Rodapé da Sidebar**:
   - Card compacto de uso do plano (`Profissional · Projetos: X / 50 · [Gerenciar plano]`).

---

## 3. Camada 2: Menu Contextual do Projeto

Quando o usuário acessa `/projects/:projectId` ou qualquer ferramenta com `?project=:projectId`:
1. **Cabeçalho da Sidebar**:
   - Botão `← Meus projetos` para retornar rapidamente à listagem global.
   - **Card Resumo do Projeto**: Nome do projeto (ex: `Casa João`), Cliente, Pill de Alimentação (`Residencial · Bifásico`) e **Progresso Real** calculado.
2. **Seções de Engenharia**:
   - **VISÃO GERAL**: Dados técnicos, demanda calculada, corrente geral e conformidade NBR.
   - **PROJETO**: Planta Baixa, Circuitos Elétricos, Quadro de Distribuição.
   - **ANÁLISE**: Balanço de Fases e Verificação de Erros NBR.
   - **DOCUMENTAÇÃO**: Diagrama Unifilar, Memorial Descritivo, Lista de Materiais e Orçamento.

---

## 4. Fluxo Lógico do Projeto & Cálculo de Progresso

O motor central de progresso está implementado em `src/lib/projectProgress.js` através da função `getProjectProgress(project)`.

### Sequência Recomendada de 8 Etapas:
1. **Informações**: Nome, cliente, tensão de entrada e tipo de fornecimento cadastrados.
2. **Planta**: Paredes, cômodos ou arquivo de planta baixa importados.
3. **Pontos**: Locação de tomadas (TUG/TUE), pontos de luz e interruptores.
4. **Circuitos**: Distribuição de cargas e dimensionamento de cabos/disjuntores.
5. **Quadro Elétrico**: Layout DIN do QDG montado com IDR e DPS.
6. **Balanço de Fases**: Verificação de equilíbrio e ausência de erros impeditivos na NBR 5410.
7. **Diagrama Unifilar**: Esquema elétrico gerado e revisado.
8. **Documentação**: Memorial descritivo, lista de compras e relatórios executivos.

O progresso é **100% dinâmico e calculado com base em dados reais do backend**, sem porcentagens fictícias.

---

## 5. Novo Dashboard (Home)

O Dashboard (`src/pages/Home.jsx`) foi simplificado e estruturado por ordem de prioridade:

1. **Saudação Personalizada**: `Olá, {Nome} 👋` — *"O que você quer fazer hoje?"*
2. **Barra de Ações do Dia**:
   - Card de destaque: `[ Continuar projeto: {Nome} · Última edição {tempo} ]`
   - `[ + Novo projeto ]`
   - `[ ↑ Importar planta ]`
3. **Barra Compacta de Indicadores**:
   - Exemplo: `2 projetos • 18 circuitos • 24.5 kW • ✓ Sem erros NBR` (substituindo os 4 cards gigantes cheios de zeros).
4. **Projetos Recentes**:
   - Listagem limpa com nome, tipo, quantidade de circuitos, barra de progresso real e botão direto `Continuar`.
5. **Atenção Necessária**:
   - Exibe alertas **apenas se houver pendências reais** (ex: *"2 circuitos precisam de revisão"*). Se estiver tudo certo: `✓ Tudo certo por aqui - Nenhuma pendência nos seus projetos.`
6. **Empty State**:
   - Quando não há projetos cadastrados, orienta o usuário com clareza: *"Seu primeiro projeto começa aqui — Crie um projeto do zero ou importe uma planta existente."*

---

## 6. Onboarding de Primeiro Acesso

Implementado em `src/components/onboarding/OnboardingModal.jsx`:
- Disparado automaticamente quando `user.onboarding_completed === false`.
- **Etapa 1**: Boas-vindas (`Bem-vindo ao Nacif Electric ⚡`).
- **Etapa 2 (Perfil)**: Engenheiro eletricista, Técnico/Eletricista, Projetista, Empresa, Estudante, Outro.
- **Etapa 3 (Objetivo)**: Criar projeto, Importar planta, Digitalizar com IA, Explorar sistema.
- **Etapa 4 (Tipo de Projeto)**: Residencial, Comercial, Industrial, Condomínios.
- **Etapa 5 (Modo)**:
  - **Modo Guiado**: O sistema exibe cards de *"Próxima etapa recomendada"* em cada fase do projeto.
  - **Modo Livre**: Interface desobstruída para acesso direto a qualquer ferramenta.
- **Persistência**: Salvo diretamente no perfil do usuário no backend através de `backend.auth.updateMe()`.

---

## 7. Novos Componentes Criados

| Componente | Caminho | Finalidade |
|---|---|---|
| `ProjectProgress` | `src/components/navigation/ProjectProgress.jsx` | Indicador visual reutilizável de progresso (compacto, horizontal, card ou completo). |
| `NextStepCard` | `src/components/navigation/NextStepCard.jsx` | Card contextual do Modo Guiado indicando o próximo passo e ações recomendadas. |
| `OnboardingModal` | `src/components/onboarding/OnboardingModal.jsx` | Modal de 5 etapas para novos usuários configurarem seu espaço de trabalho. |
| `ToolsModal` | `src/components/navigation/ToolsModal.jsx` | Central unificada para acesso a Calculadoras, Scanner IA e Biblioteca NBR. |
| `projectProgress.js` | `src/lib/projectProgress.js` | Engine matemática de cálculo do progresso de projetos elétricos. |

---

## 8. Arquivos Principais Modificados

- [src/components/Layout.jsx](file:///c:/Users/grc22/Documents/GitHub/nacif-eletric/src/components/Layout.jsx): Implementação da navegação em duas camadas (Global vs Projeto), drawer mobile e cabeçalho limpo.
- [src/pages/Home.jsx](file:///c:/Users/grc22/Documents/GitHub/nacif-eletric/src/pages/Home.jsx): Redesenho completo do dashboard orientado a tarefas com progressive disclosure.
- [src/pages/ProjectDetail.jsx](file:///c:/Users/grc22/Documents/GitHub/nacif-eletric/src/pages/ProjectDetail.jsx): Integração do `NextStepCard` e `ProjectProgress`.
- [src/pages/Projects.jsx](file:///c:/Users/grc22/Documents/GitHub/nacif-eletric/src/pages/Projects.jsx): Exibição de progresso real em cada cartão de projeto.

---

## 9. Testes Realizados & Validação

- ✅ **Compilação e Build**: `npm run build` executado com **código de saída 0**.
- ✅ **Preservação de Rotas**: Todas as rotas existentes (`/projects`, `/circuit-editor`, `/panel-generator`, `/unifilar`, `/phase-balance`, `/scanner`, `/calculator`, `/nbr-library`, `/materials`, `/memorial`, `/planta-ia`, `/solar-project`, `/subscription`, `/settings`, `/admin`) permanecem 100% funcionais.
- ✅ **Compatibilidade Retroativa de Parâmetros**: Todas as ferramentas aceitam `?project=:id` e navegam de forma coesa dentro do contexto do projeto.
- ✅ **Responsividade**: Drawer mobile funcional em telas `< 1024px` e sidebar colapsável em desktop (`≥ 1024px`).
- ✅ **Design System**: Mantida a paleta oficial (branco, cinza suave `#F5F7FA`, `#EAECF0` e turquesa/verde Nacif `#00d8b8`), tipografia Inter e ícones lineares do Lucide.
