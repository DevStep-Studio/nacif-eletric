# Nacif Electric — Backend API & Documentação de Integração

Backend de alta performance desenvolvido em **Node.js com Fastify e TypeScript**, utilizando **Prisma ORM** e banco de dados relacional **MySQL** (com compatibilidade para migrações PostgreSQL). Fornece a camada de serviços RESTful para a plataforma de engenharia elétrica **Nacif Electric**.

---

## 1. Visão Geral da Arquitetura

O ecossistema **Nacif Electric** adota uma arquitetura híbrida e resiliente:
- **Frontend SPA (React 19 + Vite):** Opera prioritariamente em modo *offline-first* com persistência em IndexedDB / LocalStorage para cálculos e dimensionamentos elétricos ininterruptos em campo.
- **Backend API (Fastify + Prisma):** Atua como autoridade central de sincronização, autenticação robusta, governança multi-usuário (RBAC), controle orçamentário avançado, auditoria inviolável, processamento de plantas assistidas por inteligência artificial e backup/disaster recovery.

```mermaid
graph TD
    Client[Frontend React 19 / Vite] -->|REST API + Bearer JWT| FastifyApp[Fastify Server :3001]
    FastifyApp --> AuthPlugin[Auth Plugin / RBAC Guard]
    FastifyApp --> Router[Rotas Modulares / Zod Validation]
    
    Router --> ServiceAuth[Auth & LGPD Service]
    Router --> ServiceProjects[Projects & Revisions Service]
    Router --> ServiceBudgets[Budgets & BDI Service]
    Router --> ServiceIssues[Central de Avisos e Erros]
    Router --> ServiceAdmin[Super Admin & Audit Service]
    Router --> ServiceDB[Database Integrity & Backups]
    Router --> ServiceAnalysis[Technical & AI Analysis]
    
    ServiceAuth --> Prisma[Prisma ORM Client]
    ServiceProjects --> Prisma
    ServiceBudgets --> Prisma
    ServiceIssues --> Prisma
    ServiceAdmin --> Prisma
    ServiceDB --> Prisma
    
    Prisma --> MySQL[(Banco de Dados MySQL / MariaDB)]
```

---

## 2. Tecnologias & Bibliotecas

| Componente | Tecnologia | Versão | Propósito |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | >= 20.x / 24.x | Ambiente de execução JavaScript/TypeScript |
| **Framework HTTP** | Fastify | ^5.6.1 | Servidor web assíncrono de altíssimo throughput |
| **Linguagem** | TypeScript | ^6.0.3 | Tipagem estática rigorosa e contratos seguros |
| **ORM** | Prisma | ^6.19.0 | Modelagem declarativa e consultas seguras tipadas |
| **Validação** | Zod | ^4.1.12 | Validação e sanitização de payloads e queries |
| **Autenticação** | @fastify/jwt | ^10.0.0 | Emissão e verificação de JWT com claims RBAC |
| **Criptografia** | PBKDF2 / Bcrypt | nativo / ^3.0.3 | Hashing de senhas com salitre individual |
| **Uploads** | @fastify/multipart | ^9.3.0 | Processamento de anexos, memoriais e pranchas |
| **Inteligência** | OpenAI SDK | ^6.42.0 | Processamento de linguagem natural para plantas |

---

## 3. Mapeamento de Módulos: Frontend vs Backend

Todos os contratos de integração foram sincronizados com as entidades do cliente [`src/api/backendClient.js`](../src/api/backendClient.js):

| Módulo Frontend | Entidade Backend | Endpoints Principais | Status Sincronização |
| :--- | :--- | :--- | :---: |
| **Autenticação & Perfil** | `User`, `PasswordResetToken` | `/api/auth/*` | ✅ Sincronizado |
| **Projetos Elétricos** | `Project`, `ProjectRevision` | `/api/projects/*` | ✅ Sincronizado |
| **Módulo de Orçamentos** | `Budget` | `/api/budgets/*` | ✅ Sincronizado |
| **Central de Avisos e Erros** | `Issue`, `IssueComment`, `IssueAttachment`, `IssueAuditLog` | `/api/issues/*` | ✅ Sincronizado |
| **Painel Super Admin** | `User`, `AuditLog`, `SystemSetting` | `/api/super-admin/*` | ✅ Sincronizado |
| **Integridade & Backups** | `DatabaseIntegrity` | `/api/database/*` | ✅ Sincronizado |
| **Notificações** | `Notification` | `/api/notifications/*` | ✅ Sincronizado |
| **Configurações Globais** | `AppSetting`, `SystemSetting` | `/api/settings/*` | ✅ Sincronizado |
| **Catálogo NBR/WEG** | `Catalogs` | `/api/catalog/*` | ✅ Sincronizado |
| **Análise de Plantas / IA** | `Analysis`, `AI` | `/api/analysis/*`, `/api/ai/*` | ✅ Sincronizado |
| **Saúde da Infraestrutura** | `SystemHealth` | `/api/health` | ✅ Sincronizado |
| **Assinaturas & Planos** | `Subscription` | `/api/subscriptions/*` | ✅ Sincronizado |

---

## 4. Estrutura de Documentos Técnicos

Para aprofundamento específico em cada área do backend, consulte os documentos dedicados nesta pasta:

- 📘 [**API_SPECIFICATION.md**](./API_SPECIFICATION.md): Especificação completa de todas as rotas REST, headers, payloads, query parameters e respostas HTTP.
- 🗄️ [**DATABASE_SCHEMA.md**](./DATABASE_SCHEMA.md): Dicionário de dados, tabelas, diagramas de relacionamento (ERD), chaves estrangeiras, índices e scripts SQL.
- 🔒 [**SECURITY_AND_PERFORMANCE.md**](./SECURITY_AND_PERFORMANCE.md): Diretrizes de segurança cibernética, algoritmo PBKDF2/SHA-256, políticas RBAC, conformidade LGPD e SLAs de resposta a incidentes.

---

## 5. Configuração e Execução

### Pré-requisitos
- Node.js versão 20.x ou superior (testado na 24.x)
- MySQL versão 8.0+ ou MariaDB 10.5+

### Instalação Passo a Passo

1. **Clone o repositório e navegue até a pasta do backend:**
   ```bash
   cd backend
   ```

2. **Crie e configure as variáveis de ambiente:**
   Copie o arquivo de exemplo e preencha as credenciais do seu banco de dados:
   ```bash
   cp .env.example .env
   ```

3. **Instale as dependências:**
   ```bash
   npm install
   ```

4. **Provisione o banco de dados e gere o Prisma Client:**
   ```bash
   # Gera os tipos TypeScript a partir do schema.prisma
   npm run prisma:generate

   # Sincroniza a estrutura com o banco de dados configurado no DATABASE_URL
   npm run prisma:push
   ```

5. **Inicie o servidor em modo de desenvolvimento:**
   ```bash
   npm run dev
   ```
   O servidor estará ativo em: `http://localhost:3001` (com documentação de rotas e CORS habilitado para o frontend).

---

## 6. Variáveis de Ambiente

As configurações do backend são gerenciadas através do arquivo `.env`:

```env
# Ambiente de execução (development | test | production)
NODE_ENV=development

# Porta do servidor HTTP Fastify
PORT=3001

# URL base do Frontend (para liberação de CORS e redirecionamento de tokens)
FRONTEND_URL=http://localhost:5173

# String de conexão do Prisma com o MySQL
DATABASE_URL="mysql://root:root@127.0.0.1:3306/nacif_electric"

# Chave secreta de alta entropia para assinatura dos tokens JWT (mínimo 32 caracteres)
JWT_SECRET="segredo-super-seguro-nacif-eletric-2026-prod"

# Diretório para armazenamento local de uploads
UPLOAD_DIR="./uploads"

# Chave de API da OpenAI (opcional - necessária para análise automática de plantas)
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.5"
```

---

## 7. Políticas de Controle de Acesso (RBAC)

O backend implementa três níveis fundamentais de acesso validados por middleware:

1. **`super_admin`:**
   - Acesso irrestrito a auditoria completa (`audit_logs`), métricas corporativas, gerenciamento de status de contas (ativo/suspenso), redefinição forçada de credenciais e exportação/restauração de backups.
   - Proteção de salvaguarda: o sistema bloqueia a suspensão ou exclusão do último Super Administrador ativo da base.
2. **`admin`:**
   - Gerenciamento de projetos da equipe, moderação da Central de Avisos e Erros, resposta a tickets com notas internas e notificações em massa.
3. **`user`:**
   - Gestão estrita dos próprios projetos elétricos, diagramas unifilares, quadros, orçamentos e relatos de bugs na Central de Avisos e Erros.
   - Proteção contra IDOR (Insecure Direct Object Reference) em todas as rotas com cláusula `ownerId === request.authUser.id`.

---

## 8. Sincronização e Modo Offline do Frontend

Quando o frontend está configurado com `isLocalAuthMode = true` (padrão de desenvolvimento sem servidor remoto ativo), as operações são armazenadas no IndexedDB/LocalStorage do navegador. 

Para conectar o frontend diretamente a este backend Fastify:
1. No arquivo `.env` da raiz do frontend, configure:
   ```env
   VITE_API_BASE_URL=http://localhost:3001
   ```
2. O cliente [`src/api/backendClient.js`](../src/api/backendClient.js) enviará requisições autenticadas automaticamente usando os cabeçalhos `Authorization: Bearer <token>`.
