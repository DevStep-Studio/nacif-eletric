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

### Planos e Asaas

O catálogo e seus preços continuam em `backend/src/lib/planCatalog.js`. A aplicação
aceita cartão recorrente, Pix e boleto pela fatura hospedada do Asaas. Pix e boleto
exigem pagamento manual a cada ciclo. Nenhum dado de cartão passa pelo backend.
Planos só são liberados após confirmação financeira; callbacks do navegador não
ativam acesso. Estudante exige comprovante aprovado e permite apenas ciclo mensal.

Configure `ASAAS_ENVIRONMENT`, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` em
`backend/.env`. Siga [o guia de configuração e publicação](docs/asaas.md), incluindo
a alteração de banco e o webhook `/api/subscriptions/webhook/asaas`.

Não existem assinantes Stripe a migrar. As dependências Stripe foram removidas;
o histórico e a tabela antiga de eventos são preservados. Novos usuários começam
no plano gratuito; o login não promove mais contas para o plano Completo.

### 3. Testes Automatizados
```bash
node scripts/api-client-integration.mjs
npm --prefix backend run test:billing
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

### Backend publicado responde “Route GET:/api/subscriptions/plans not found”

Essa rota está registrada no backend atual e não depende do banco ou do Asaas.
Um `/api/health` com HTTP 200, acompanhado de 404 em `/api/subscriptions/plans`,
indica uma instância antiga ou outro checkout sendo servido. No checkout do
servidor de produção, publique o código atual e recarregue o processo:

```bash
git pull --ff-only
npm run start:api
curl --fail http://127.0.0.1:3001/api/subscriptions/plans
curl --fail https://nacifenergy.com.br/api/subscriptions/plans
```

O comando `start:api` instala as dependências do backend, gera o Prisma Client e
recarrega o PM2 usando `ecosystem.config.cjs`. Agora verifica também a rota de planos
e retorna erro se a instância continuar desatualizada. Compilar apenas o frontend
com `--ignore-scripts` não recarrega o backend. Se apenas o endereço público falhar,
confira se o proxy de `/api` aponta para a mesma porta/processo testado localmente.

### Login seguido de “Conta indisponível”

Login e rotas autenticadas usam a mesma validação de conta. Os valores legados
`ativo`, `ativa`, diferenças de caixa/espaços e status vazio são tratados como
`active`. Contas suspensas, inativas ou excluídas continuam bloqueadas, com uma
mensagem específica; sessões cujo usuário não existe exigem novo login.

Para corrigir dados antigos no banco selecionado, execute
`backend/prisma/migrations/20261105030000_normalize_legacy_account_status/migration.sql`.
Esse SQL normaliza somente os status ativos reconhecidos e não reativa contas
suspensas, inativas ou excluídas. Publique o backend atualizado e recarregue a API
com `npm run start:api` antes de fazer login novamente.

### Pagamento Asaas indisponível

Execute `npm --prefix backend run asaas:check`. O diagnóstico é somente leitura e
verifica o acesso à API, as tabelas de cobrança e os eventos do webhook. Chaves de
sandbox e produção são independentes. Veja [docs/asaas.md](docs/asaas.md) para
configuração, token do webhook e recuperação de tentativas interrompidas.

### Erro ao carregar auditoria ou configurações do Super Admin

Execute `npm --prefix backend run db:check` para listar todas as tabelas e colunas
ausentes em relação ao Prisma. O diagnóstico é somente leitura e não mostra
registros de usuários nem credenciais.

Erros Prisma de tabela/coluna ausente retornam `DATABASE_SCHEMA_OUTDATED`, sem
expor SQL ou dados internos. Para reconciliar `audit_logs` e `system_settings`,
execute no banco da aplicação
`backend/prisma/migrations/20261105040000_reconcile_admin_tables/migration.sql`.
O SQL é aditivo e pode ser executado novamente. Se a falha tiver outra causa,
consulte o log da API: o painel agora identifica a seção que falhou e mantém as
outras seções carregadas, com aviso persistente e opção de tentar novamente.

### Cadastro falha com `Data truncated for column 'role'` (MySQL 1265)

O banco pode ter um ENUM antigo em `users.role`, sem os valores `super_admin`,
`admin` e `user`, ou uma coluna de texto curta demais. `users.plan` também precisa
aceitar os planos atuais. O diagnóstico `npm --prefix backend run db:check` agora
verifica esses tipos e valores, além da existência das colunas.

Selecione o banco apontado pela `DATABASE_URL` e importe
`backend/prisma/migrations/20261109020000_reconcile_user_role_plan_enums/migration.sql`.
O SQL acrescenta os membros ausentes sem remover os legados, preserva registros,
NULL e valores padrão, e amplia colunas CHAR/VARCHAR curtas. Pode ser executado
novamente; não altera permissões dos usuários nem desativa o modo SQL estrito.
Depois execute `npm --prefix backend run db:check` e tente o cadastro novamente.


### phpMyAdmin mostra avisos `statement` / `parser` ao importar a correcao

Avisos em `Display/Results.php` ao exibir `EXECUTE nacif_users_statement` podem
ocorrer no tratamento dos resultados intermediarios. Nao confirmam, isoladamente,
falha ou sucesso da alteracao. Selecione o banco da aplicacao e execute na aba SQL:

```sql
SELECT DATABASE() AS banco_atual;
SHOW COLUMNS FROM users WHERE Field IN ('role', 'plan');
```

`role` deve aceitar `super_admin`, `admin` e `user`; `plan` deve aceitar os planos
do Prisma. Se ainda faltarem valores, importe
`backend/prisma/repair-user-enums-phpmyadmin.sql`. Essa alternativa preserva os
dados e substitui os SELECTs preparados de confirmacao por `DO 0`, sem resultados
intermediarios de EXECUTE. As migrations historicas permanecem inalteradas.


### Contas novas sem assinatura

O cadastro publico cria usuarios comuns com `plan=gratuito`, inclusive quando o
banco ainda nao tem usuarios. Cadastros administrativos explicitamente reconhecidos
continuam com suas permissoes, mas essas permissoes nao representam assinatura paga.

As respostas de cadastro, login e perfil indicam `subscription_status=none`,
`subscription_plan=null`, `has_paid_subscription=false`, preco zero, ciclo e datas
nulos, e renovacao desativada enquanto nao houver contratacao. A interface mostra
**Sem assinatura**. O plano comercial so e informado quando existir um periodo pago
confirmado no Asaas. Rotulos antigos de plano Completo, sozinhos, nao ativam assinatura.
Nao e necessaria nova migration para essa correcao; publique backend e frontend.

Validacao: `npm --prefix backend run test:auth-register`,
`npm --prefix backend run test:billing` e `npm run test:subscription-state`.
