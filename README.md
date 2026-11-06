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
VITE_API_BASE_URL=
```

### 2. Instalação e Desenvolvimento
```bash
npm ci
npm --prefix backend ci
# Configure backend/.env a partir de backend/.env.example, com MySQL e JWT_SECRET.
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
npm run dev:api
# Em outro terminal:
npm run dev
```

O endereço vazio usa `/api` pelo proxy do Vite em desenvolvimento. Para um backend
separado, informe sua origem em `VITE_API_BASE_URL`. Em produção com a mesma origem,
configure o proxy de `/api` e `/uploads` para o Fastify. Ajuste `FRONTEND_URL` no backend
para a origem exata do frontend, inclusive a porta em desenvolvimento.

Sessões antigas com token `local:` são descartadas. Faça login com uma conta do
backend; usuários e projetos do navegador não são migrados automaticamente.

### Planos e Stripe

O catálogo está em `backend/src/lib/planCatalog.js` e é servido por
`GET /api/subscriptions/plans`. O frontend carrega preços, recursos e limites dessa
rota; `null` em um limite significa ilimitado. Códigos legados permanecem compatíveis.

Configure no **backend** `STRIPE_SECRET_KEY`, os sete `STRIPE_PRICE_*` e
`STRIPE_WEBHOOK_SECRET`. Aponte o webhook para `/api/subscriptions/webhook` com eventos
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.

O checkout usa apenas código de plano e ciclo. Planos pagos são liberados após
confirmação da Stripe, com estado persistido no MySQL. Trocas de uma assinatura
existente usam o portal Stripe; habilite os produtos/preços e alterações no portal.
O cancelamento interrompe a renovação e conserva o período pago. Estudante exige
comprovante aprovado e permite apenas cobrança mensal.

A tabela `stripe_events` impede o processamento duplicado de webhooks. Em uma
instalação existente, aplique a migration
`backend/prisma/migrations/20261105000000_stripe_events/migration.sql` após backup,
ou use o procedimento de sincronização Prisma já adotado pelo ambiente. O histórico
antigo não contém uma migration inicial completa: não execute `migrate deploy` em
um banco novo sem estabelecer o baseline. Para banco novo, use `prisma:push`.

### 3. Testes Automatizados
```bash
node scripts/api-client-integration.mjs
npm --prefix backend run typecheck
# Use exclusivamente um banco descartável cujo nome termine em _test:
DATABASE_URL=mysql://usuario:senha@localhost:3306/nacif_test npm --prefix backend run prisma:push
DATABASE_URL=mysql://usuario:senha@localhost:3306/nacif_test npm --prefix backend run test:integration
```

### 4. Build de Produção
```bash
npm run build --ignore-scripts
npm run preview
```
