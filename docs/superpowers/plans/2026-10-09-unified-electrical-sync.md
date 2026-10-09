# PROJETO ELÉTRICO INTELIGENTE — SINCRONIZAÇÃO TOTAL ENTRE PLANTA, CIRCUITOS, DIMENSIONAMENTO, QUADRO DIN E SISTEMA SOLAR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o sistema elétrico em uma plataforma integrada com Fonte Única de Verdade (Single Source of Truth), sincronização bidirecional idempotente e não-destrutiva entre Planta IA, Circuitos NBR 5410, Dimensionamento Técnico, Quadro Elétrico DIN, Roteamento de Cabos e Sistema Fotovoltaico.

**Architecture:** Módulo central de sincronização transacional (`src/lib/projectUnifiedSync.js`) que orquestra entidades persistentes com identificadores estáveis, cálculo elétrico unificado (`electricalEngine.js`), preservação estrita de configurações e layouts manuais (`panel_layout`, `panel_boards`, `diagram_layout`), propagação inteligente de cargas de pontos e circuitos fotovoltaicos.

**Tech Stack:** React 18, Vite, Zod, NBR 5410 / NBR 16690, Orthogonal Router SVG, Leaflet / Turf.js / Three.js, Node.js test runners.

**Spec:** Documento mestre de requisitos elétricos inteligentes do usuário.

---

## Global Constraints

1. PROIBIDO apagar ou reconstruir do zero telas, componentes e designs existentes.
2. PROIBIDO resetar ou reorganizar quadros personalizados pelo usuário sem permissão explícita.
3. PROIBIDO zerar `diagram_layout` (Diagrama Unifilar) em atualizações de circuitos ou sincronizações.
4. Preservar o realismo industrial dos disjuntores, barramentos e rotas ortogonais no SVG.
5. Todos os cálculos de corrente, queda de tensão, condutores e proteções devem usar `electricalEngine.js` conforme NBR 5410.
6. A sincronização deve ser idempotente: executar N vezes seguidas deve produzir o mesmo resultado exato (sem duplicação de circuitos ou disjuntores).
7. Regra obrigatória do repositório: Auto-commit após validação de cada tarefa e testes com código limpo.

---

## Review Focus

1. **Alteração de potência na planta**: Deve atualizar a carga acumulada do circuito sem apagar disjuntores nem criar circuitos clones.
2. **Exclusão de ponto**: Não deve excluir disjuntor do quadro se houver outros pontos ou configurações manuais.
3. **Disjuntor manual menor que a carga ($I_n < I_b$)**: Deve sinalizar incompatibilidade/alerta técnico na NBR 5410, e jamais alterar silenciosamente a bitola do cabo ou reverter o disjuntor sem consentimento.
4. **Projeto Solar**: Ao aceitar arranjo solar ou alterar inversor, deve atualizar ou criar o circuito CA do inversor e o disjuntor no quadro mantendo o quadro existente intacto.
5. **Prevenção de loops de atualização**: Sincronização Planta ↔ Quadro com controle de transação (`syncSource` / `version`) para evitar re-renderizações e ciclos recursivos infinitos.

---

## Tasks

### Task 1: Criar o Módulo Central de Sincronização Unificada (`src/lib/projectUnifiedSync.js`)
**Files:**
- Create: `src/lib/projectUnifiedSync.js`
- Test: `scripts/unified-electrical-sync-smoke.mjs`

- [ ] Criar estrutura do modelo unificado com normalização de IDs persistentes (`normalizeProjectEntities`).
- [ ] Implementar `syncPlantPointsToCircuits(project, plantPoints)`: agrega cargas por circuito, recalcula correntes nominais, atualiza ambientes atendidos e quantidade de pontos.
- [ ] Implementar `syncCircuitsToPanelBoard(project, options)`: sincronização idempotente que preserva posições, fiação existente, metadados manuais e insere apenas novos circuitos em espaços livres/reserva técnica.
- [ ] Implementar `syncPanelDeviceToCircuit(project, componentId, updates)`: propaga alterações de disjuntor (corrente, curva, fase, identificação) para `project.circuits` com auditoria NBR 5410.
- [ ] Implementar `syncSolarToProjectCircuits(project, solarConfig)`: cria/atualiza circuito CA do inversor com proteção NBR 16690 e reflete no quadro.
- [ ] Implementar `validateUnifiedProject(project)`: motor completo de validação (pontos sem circuito, sobrecargas, seletividade, DR obrigatório, desbalanceamento de fases).
- [ ] Escrever bateria de testes em `scripts/unified-electrical-sync-smoke.mjs` cobrindo Cenários A a L.
- [ ] Executar `node scripts/unified-electrical-sync-smoke.mjs` e garantir aprovação de 100% dos testes.
- [ ] Commit das alterações: `feat(sync): criar modulo central de sincronizacao eletrica unificada e testes de integracao`.

---

### Task 2: Integrar Sincronização Idempotente no Motor Elétrico (`src/lib/electricalEngine.js`)
**Files:**
- Modify: `src/lib/electricalEngine.js`
- Test: `scripts/device-deletion-sync-smoke.mjs` e `scripts/electrical-engine-audit-smoke.mjs`

- [ ] Refatorar `buildProjectElectricalSyncPayload` para utilizar sincronização não-destrutiva quando `panel_layout` ou `panel_boards` já contiverem edições manuais.
- [ ] Garantir que `diagram_layout` NUNCA seja sobrescrito com `null` quando o projeto já possuir nós e conexões do unifilar.
- [ ] Validar compatibilidade de disjuntores manuais em `calcCircuit` retornando flags de aviso técnico (`breaker_manual_incompatible`, `breaker_manual_undersized`).
- [ ] Executar testes de auditoria elétrica: `node scripts/electrical-engine-audit-smoke.mjs` e `node scripts/device-deletion-sync-smoke.mjs`.
- [ ] Commit das alterações: `refactor(engine): preservar layouts de painel e unifilar na sincronizacao eletrica`.

---

### Task 3: Integrar Planta Elétrica Inteligente (`src/pages/PlantaIA.jsx`)
**Files:**
- Modify: `src/pages/PlantaIA.jsx`

- [ ] Conectar `removePoint` e `addPointToCanvas` à sincronização automática de cargas de circuitos via `syncPlantPointsToCircuits`.
- [ ] Atualizar alteração de potência de pontos (`handleSavePointCircuit` e `updatePointCircuitForm`) para disparar recálculo atômico e transacional.
- [ ] Garantir que ao mover um ponto de C1 para C2, ambos os circuitos sejam recalculados e atualizados sem duplicação.
- [ ] Exibir no Painel Técnico da Planta o status da validação do projeto (circuitos válidos, pendências, alertas).
- [ ] Testar fluxo completo e executar `npm run test:editor-foundation`.
- [ ] Commit das alterações: `feat(planta): integrar sincronizacao transacional de cargas e circuitos com o modelo central`.

---

### Task 4: Integrar Sincronização Bidirecional no Quadro DIN (`src/pages/PanelGenerator.jsx`)
**Files:**
- Modify: `src/pages/PanelGenerator.jsx`

- [ ] Conectar `handleUpdateComponent` e `handleUpdateComponentFields` a `syncPanelDeviceToCircuit`, garantindo que alteração de corrente nominal (ex: 16A -> 20A) ou curva propague imediatamente para `project.circuits`.
- [ ] Ao carregar ou alterar o quadro, realizar sincronização não-destrutiva de novos circuitos provenientes da Planta IA ou Sistema Solar.
- [ ] Manter integridade total das rotas ortogonais e barramentos ao sincronizar circuitos.
- [ ] Executar `node scripts/panel-generator-smoke.mjs` e `npm run test:orthogonal-router`.
- [ ] Commit das alterações: `feat(quadro): sincronizacao bidirecional de disjuntores com circuitos e preservacao do layout DIN`.

---

### Task 5: Integrar Sistema Fotovoltaico ao Modelo Elétrico (`src/pages/SolarProject.jsx`)
**Files:**
- Modify: `src/pages/SolarProject.jsx`
- Modify: `src/components/solar/SolarProjectParametersModal.jsx`

- [ ] Em `saveConfig` e `handleAcceptLayout`, chamar `syncSolarToProjectCircuits` para criar ou sincronizar o circuito CA do inversor em `project.circuits`.
- [ ] Garantir que a potência CA, corrente nominal e disjuntor calculados pelo inversor fiquem disponíveis para o Quadro Elétrico DIN e Planta.
- [ ] Executar testes solares: `npm run test:solar-sizing`, `npm run test:solar-board-merge`.
- [ ] Commit das alterações: `feat(solar): integrar circuito do inversor e dimensionamento CA ao modelo eletrico central`.

---

### Task 6: Validação Completa, Testes de Regressão e Build de Produção
**Files:**
- Test: Toda a suíte de testes do projeto (`npm run test:*`)
- Build: `npm run build`

- [ ] Executar `node scripts/unified-electrical-sync-smoke.mjs` (Cenários A a L).
- [ ] Executar testes de fiação, rotas e auditoria:
  - `npm run test:cables`
  - `npm run test:orthogonal-router`
  - `npm run test:electrical-audit`
  - `npm run test:main-protection`
  - `npm run test:panel-generator`
  - `npm run test:budget`
- [ ] Executar `npm run build` e confirmar 0 erros.
- [ ] Finalizar commit das alterações de validação: `chore: validar integracao total do projeto eletrico inteligente e build de producao`.
- [ ] Apresentar diagnóstico detalhado da arquitetura original e final conforme requerido.
