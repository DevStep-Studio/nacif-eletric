# Nacif Electric — Especificação Completa da API REST

Este documento detalha todos os endpoints, parâmetros, schemas de dados, contratos de requisição e resposta expostos pelo backend Fastify para integração com o frontend da plataforma **Nacif Electric**.

---

## 1. Convenções Globais

- **Base URL:** `http://localhost:3001` (ou valor definido em `VITE_API_BASE_URL`)
- **Content-Type:** `application/json` (exceto uploads com `multipart/form-data`)
- **Autenticação:** Cabeçalho padrão `Authorization: Bearer <jwt_token>`
- **Padrão de Resposta de Erro:**
  ```json
  {
    "statusCode": 400,
    "error": "Bad Request",
    "message": "Mensagem descritiva do erro para o usuário."
  }
  ```
- **Paginação e Ordenação:**
  - Query parameters comuns: `limit=N` (número máximo de itens) e `sortBy=campo` (ou `-campo` para ordem decrescente).
  - Exemplos: `sortBy=-updated_date`, `sortBy=created_date`.

---

## 2. Autenticação, Usuários & LGPD (`/api/auth`)

### 2.1 Cadastrar Novo Usuário
- **Rota:** `POST /api/auth/register`
- **Acesso:** Público
- **Payload:**
  ```json
  {
    "email": "engenheiro@nacif.com",
    "password": "senhaForte@123",
    "profession": "projetista"
  }
  ```
- **Resposta (201 Created):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "user": {
      "id": "cuid_123",
      "email": "engenheiro@nacif.com",
      "full_name": "engenheiro",
      "role": "user",
      "plan": "gratuito",
      "created_date": "2026-10-19T20:00:00.000Z"
    }
  }
  ```

### 2.2 Efetuar Login
- **Rota:** `POST /api/auth/login`
- **Acesso:** Público
- **Payload:**
  ```json
  {
    "email": "engenheiro@nacif.com",
    "password": "senhaForte@123"
  }
  ```
- **Resposta (200 OK):** Retorna `access_token` e objeto `user`.
- **Bloqueio por Força Bruta:** Após 5 tentativas incorretas consecutivas, a conta sofre bloqueio temporário de 15 minutos (retornando HTTP 429).

### 2.3 Obter Perfil Atual (`me`)
- **Rota:** `GET /api/auth/me`
- **Acesso:** Autenticado (`user`, `admin`, `super_admin`)
- **Resposta (200 OK):** Objeto com dados do usuário, plano, registros e configurações.

### 2.4 Atualizar Perfil
- **Rota:** `PATCH /api/auth/me`
- **Acesso:** Autenticado
- **Payload:**
  ```json
  {
    "full_name": "Gabriel Nacif",
    "profession": "eletricista",
    "company": "Nacif Engenharia Elétrica",
    "crea": "12345678-SP",
    "phone": "(11) 98765-4321",
    "avatar_url": "https://..."
  }
  ```

### 2.5 Exportação de Dados (LGPD - Portabilidade)
- **Rota:** `GET /api/auth/export-data`
- **Acesso:** Autenticado
- **Resposta (200 OK):** Retorna arquivo/payload JSON contendo todos os dados cadastrais, projetos, orçamentos, revisões e relatos do titular.

### 2.6 Exclusão de Conta (LGPD - Direito ao Esquecimento)
- **Rota:** `DELETE /api/auth/me`
- **Acesso:** Autenticado
- **Efeito:** Marcação lógica (`is_deleted: true`, `status: suspended`) e expurgo de dados pessoais sensíveis respeitando obrigações legais de guarda.

### 2.7 Solicitação de Redefinição de Senha
- **Rota:** `POST /api/auth/reset-password-request`
- **Payload:** `{ "email": "usuario@dominio.com" }`
- **Resposta (200 OK):** `{ "ok": true }` (gera token de uso único com expiração de 1 hora).

### 2.8 Confirmação de Redefinição de Senha
- **Rota:** `POST /api/auth/reset-password`
- **Payload:**
  ```json
  {
    "reset_token": "token_hex_64_chars",
    "new_password": "NovaSenhaForte@456"
  }
  ```

---

## 3. Gestão de Projetos Elétricos (`/api/projects`)

### 3.1 Listar Projetos
- **Rota:** `GET /api/projects`
- **Query:** `limit=50&sortBy=-updated_date`
- **Regra de Acesso:** Usuários comuns listam apenas seus projetos (`owner_id = user.id`); administradores têm visão geral da organização.

### 3.2 Obter Projeto por ID
- **Rota:** `GET /api/projects/:id`
- **Proteção IDOR:** Bloqueia acesso caso o projeto pertença a outro usuário e o solicitante não possua privilégios administrativos.

### 3.3 Criar Projeto
- **Rota:** `POST /api/projects`
- **Payload:**
  ```json
  {
    "name": "Residência Unifamiliar - Bloco A",
    "client_name": "João da Silva",
    "supply_type": "Trifásico",
    "voltage": 220,
    "circuits": [],
    "panel_boards": [],
    "plant_design": { "points": [], "routes": [] },
    "status": "Em Andamento"
  }
  ```

### 3.4 Atualizar Projeto (com Histórico de Revisões)
- **Rota:** `PUT /api/projects/:id` (ou `PATCH /api/projects/:id`)
- **Efeito:** Atualiza os dados e automaticamente registra uma entrada na tabela `project_revisions` com snapshot imutável da alteração.

### 3.5 Duplicar Projeto
- **Rota:** `POST /api/projects/:id/duplicate`
- **Resposta (201 Created):** Clona toda a estrutura de circuitos, quadros e plantas em um novo projeto nomeado como `Cópia de <nome>`.

### 3.6 Histórico de Revisões
- **Rota:** `GET /api/projects/:id/revisions`
- **Resposta (200 OK):** Lista de revisões contendo autor, data, ação e resumo das mudanças.

---

## 4. Módulo de Orçamentos Financeiros (`/api/budgets`)

Módulo auditado e alinhado com as formulações de BDI, encargos, taxa horária de mão de obra e composição orçamentária.

### 4.1 Listar Orçamentos
- **Rota:** `GET /api/budgets`
- **Query:** `sortBy=-updated_date&limit=100`

### 4.2 Filtrar Orçamentos
- **Rota:** `POST /api/budgets/filter`
- **Payload:**
  ```json
  {
    "project_id": "cuid_proj_123",
    "status": "Aprovado"
  }
  ```

### 4.3 Obter Orçamento por ID
- **Rota:** `GET /api/budgets/:id`

### 4.4 Criar Orçamento
- **Rota:** `POST /api/budgets`
- **Payload:**
  ```json
  {
    "name": "Orçamento Elétrico - Instalação Geral",
    "project_id": "cuid_proj_123",
    "margin": 30.0,
    "labor_cost": 2500.0,
    "product_adjustment": 0.0,
    "discount_type": "percent",
    "discount_value": 5.0,
    "validity_days": 15,
    "payment_terms": "50% entrada e 50% na conclusão",
    "execution_deadline": "15 dias úteis",
    "materials": [
      {
        "id": "mat_1",
        "description": "Cabo Flexível 2,5mm² Antichama 750V",
        "quantity": 100,
        "unit": "m",
        "unitPrice": 3.85,
        "total": 385.0
      }
    ],
    "services": [
      {
        "id": "srv_1",
        "description": "Montagem e Barramento do QDC 24 Polos",
        "quantity": 1,
        "unit": "un",
        "unitPrice": 1200.0,
        "total": 1200.0
      }
    ]
  }
  ```

### 4.5 Atualizar Orçamento (com Concorrência Otimista)
- **Rota:** `PUT /api/budgets/:id`
- **Cabeçalho/Payload de Concorrência:** O payload pode enviar `expected_updated_date`. Caso o registro tenha sido modificado no servidor por outra sessão, o backend rejeita com HTTP 409 (Conflict).

### 4.6 Duplicar Orçamento
- **Rota:** `POST /api/budgets/:id/duplicate`

### 4.7 Excluir Orçamento
- **Rota:** `DELETE /api/budgets/:id`

---

## 5. Central de Avisos e Erros (`/api/issues`)

Módulo de auditoria, rastreamento de defeitos e suporte técnico com geração de protocolos de atendimento.

### 5.1 Listar Relatos
- **Rota:** `GET /api/issues`
- **Filtros suportados via Query:** `status`, `type` (`erro` | `aviso`), `priority` (`baixa`, `media`, `alta`, `critica`), `module`, `userId`.

### 5.2 Obter Detalhes do Relato
- **Rota:** `GET /api/issues/:id`
- **Retorno:** Objeto da issue acompanhado de comentários (`comments`), anexos (`attachments`) e linha do tempo de auditoria (`auditLogs`).

### 5.3 Registrar Novo Relato
- **Rota:** `POST /api/issues`
- **Payload:**
  ```json
  {
    "type": "erro",
    "title": "Inconsistência no cálculo de queda de tensão em circuitos bifásicos",
    "module": "circuit-editor",
    "priority": "alta",
    "description": "Ao inserir condutor de 4mm² com comprimento superior a 35m, a porcentagem calculada excede o limite sem disparar o badge de alerta.",
    "steps_to_reproduce": "1. Abrir circuito 3; 2. Alterar distância para 40m; 3. Observar cálculo.",
    "expected_result": "Badge de alerta em vermelho indicando queda > 4%.",
    "actual_result": "Badge permanece neutro.",
    "technical_info": { "browser": "Chrome 128", "os": "Windows 11" }
  }
  ```
- **Resposta (201 Created):** Gera automaticamente protocolo sequencial único: `NCF-ISSUE-202610-XXXX`.

### 5.4 Atualizar Status do Relato
- **Rota:** `PATCH /api/issues/:id/status`
- **Acesso:** Restrito a Administradores e Super Administradores.
- **Payload:**
  ```json
  {
    "status": "em_correcao",
    "comment": "Falha isolada no algoritmo de cálculo. Patch em homologação.",
    "isInternalComment": false
  }
  ```

### 5.5 Adicionar Comentário ou Interação
- **Rota:** `POST /api/issues/:id/comments`
- **Payload:**
  ```json
  {
    "message": "Enviando arquivo de memorial atualizado em anexo.",
    "isInternal": false
  }
  ```

### 5.6 Marcar como Lido / Não Lido
- **Rota:** `PATCH /api/issues/:id/read`
- **Payload:** `{ "forUser": true }`

### 5.7 Estatísticas da Central
- **Rota:** `GET /api/issues/stats`
- **Resposta (200 OK):** Contadores agregados por tipo, status e severidade crítica.

---

## 6. Painel Super Administrador & RBAC (`/api/super-admin`)

Acesso restrito exclusivamente a usuários com papel `super_admin`.

### 6.1 Métricas Corporativas Globais
- **Rota:** `GET /api/super-admin/metrics`
- **Resposta (200 OK):**
  ```json
  {
    "totalUsers": 128,
    "activeUsers": 120,
    "suspendedUsers": 8,
    "totalProjects": 450,
    "totalBudgets": 310,
    "openIssues": 14,
    "resolvedIssues": 86,
    "systemUptimeSeconds": 124580,
    "dbStatus": "healthy"
  }
  ```

### 6.2 Gerenciar Usuários
- **Listar:** `GET /api/super-admin/users` (filtros: `status`, `role`, `search`)
- **Criar Usuário:** `POST /api/super-admin/users`
- **Atualizar Dados/Plano:** `PATCH /api/super-admin/users/:id`
- **Alterar Status (Ativar / Suspender):** `PATCH /api/super-admin/users/:id/status`
  - *Regra de Salvaguarda:* Rejeita suspensão caso seja o único `super_admin` ativo do sistema.
- **Exclusão Lógica:** `DELETE /api/super-admin/users/:id`
- **Redefinir Senha pelo Admin:** `POST /api/super-admin/users/:id/reset-password` (gera link direto de redefinição com auditoria).

### 6.3 Consulta de Trilha de Auditoria Inviolável
- **Rota:** `GET /api/super-admin/audit-logs`
- **Query:** `actorId`, `action`, `targetType`, `limit`, `sortBy=-timestamp`

### 6.4 Configurações Globais Administrativas
- **Consultar:** `GET /api/super-admin/settings`
- **Atualizar:** `PUT /api/super-admin/settings`
- **Campos:** `require_mfa_super_admin`, `session_timeout_minutes`, `max_login_attempts`, `allow_user_registration`, `maintenance_mode`.

---

## 7. Integridade do Banco de Dados & Disaster Recovery (`/api/database`)

### 7.1 Exportar Backup Completo
- **Rota:** `GET /api/database/backup/export`
- **Acesso:** `super_admin` ou `admin`
- **Resposta:** Arquivo compactado/JSON contendo tabelas e o cabeçalho criptográfico com checksum `SHA-256`.

### 7.2 Restaurar Backup
- **Rota:** `POST /api/database/backup/restore`
- **Acesso:** Restrito a `super_admin`
- **Validação:** Valida rigorosamente a assinatura do checksum SHA-256 antes de qualquer inserção; desfaz alterações em caso de discrepância.

### 7.3 Auditoria de Integridade Referencial
- **Rota:** `GET /api/database/integrity/audit`
- **Resposta:** Detecta projetos sem dono, orçamentos desconectados e inconsistências estruturais.

### 7.4 Saneamento de Registros Órfãos
- **Rota:** `POST /api/database/integrity/sanitize-orphans`

---

## 8. Notificações, Catálogos e Análises Técnicas

### 8.1 Notificações
- `GET /api/notifications`: Lista as notificações do usuário logado.
- `POST /api/notifications`: Cria notificações (usuários comuns apenas para si; administradores podem direcionar a usuários específicos ou em broadcast).
- `PATCH /api/notifications/:id/read`: Marca notificação como lida.
- `PATCH /api/notifications/read-all`: Marca todas as notificações como lidas.

### 8.2 Catálogos WEG & NBR 5410
- `GET /api/catalog/components`: Lista disjuntores, DRs, DPS e barramentos certificados.
- `GET /api/catalog/nbr-sections`: Lista seções nominais padronizadas de cabos em cobre e alumínio.
- `GET /api/catalog/memorial-materials`: Lista descrições técnicas de insumos para memoriais descritivos.
- `GET /api/catalog/material-price?name=...`: Consulta estimativa de preço de insumos.

### 8.3 Análise de Plantas e Dimensionamento Solar
- `POST /api/analysis/planta/requested-plan`: Processa texto em linguagem natural e gera pontos elétricos correspondentes.
- `POST /api/analysis/planta/professional-plan`: Executa análise técnica em prancha 2D (cômodos, tomadas, iluminação, infraestrutura).
- `POST /api/analysis/solar/roof-estimate`: Calcula área útil de telhado, sombreamento e potência de módulos fotovoltaicos.
- `POST /api/files/upload`: Upload seguro com validação de extensão e limite de 20MB.

### 8.4 Telemetria e Monitoramento de Saúde (`/api/health`)
- `GET /api/health`
- **Resposta (200 OK):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-19T21:00:00.000Z",
    "uptime": 14523,
    "database": { "connected": true, "latency_ms": 4 },
    "memory": { "heapUsedMB": 42.5, "rssMB": 98.1 }
  }
  ```
