# Documentação Técnica e Migração — Central de Avisos e Erros | Nacif Electric

## 1. Visão Geral
A funcionalidade **Avisos e Erros** permite que usuários autenticados reportem bugs, falhas, comportamentos inesperados e inconsistências encontradas no sistema, com acompanhamento de status em tempo real, anexos de diagnóstico, linha do tempo de evolução e gestão administrativa.

---

## 2. Modelagem do Banco de Dados

### 2.1 Tabela `issues` (Relatos)
- `id`: VARCHAR(64) PK
- `protocol`: VARCHAR(32) UNIQUE (ex: `#ERR-2026-0001`)
- `type`: VARCHAR(16) (`'erro'` | `'aviso'`)
- `title`: VARCHAR(255)
- `module`: VARCHAR(64) (`Dashboard`, `Projetos`, `Planta Elétrica`, `Quadro Elétrico`, `Projeto Solar`, `Diagrama Unifilar`, `Calculadora`, `Assistente IA`, `Biblioteca NBR`, `Orçamento`, `Outros`)
- `description`: TEXT
- `steps_to_reproduce`: TEXT
- `expected_result`: TEXT
- `actual_result`: TEXT
- `status`: VARCHAR(32) (`'recebido'`, `'em_analise'`, `'em_correcao'`, `'resolvido'`, `'encerrado'`)
- `priority`: VARCHAR(16) (`'baixa'`, `'media'`, `'alta'`, `'critica'`)
- `user_id`: VARCHAR(64)
- `user_name`: VARCHAR(128)
- `user_email`: VARCHAR(128)
- `workspace_id`: VARCHAR(64)
- `project_id`: VARCHAR(64)
- `technical_info`: JSONB (SO, navegador, resolução de tela, rota, data/hora)
- `internal_notes`: TEXT (notas privadas da equipe)
- `unread_user`: BOOLEAN (indica atualização não lida pelo usuário)
- `unread_admin`: BOOLEAN (indica relato ou comentário novo para a equipe)
- `created_date`: TIMESTAMPTZ
- `updated_date`: TIMESTAMPTZ

### 2.2 Tabela `issue_attachments` (Anexos de Imagem)
- `id`: VARCHAR(64) PK
- `issue_id`: VARCHAR(64) FK -> `issues.id` (ON DELETE CASCADE)
- `name`: VARCHAR(255)
- `size`: INTEGER (máximo 5 MB validado em runtime e banco)
- `type`: VARCHAR(64) (`image/png`, `image/jpeg`, `image/webp`)
- `storage_path`: TEXT
- `data_url`: TEXT
- `created_date`: TIMESTAMPTZ

### 2.3 Tabela `issue_comments` (Interações & Respostas)
- `id`: VARCHAR(64) PK
- `issue_id`: VARCHAR(64) FK -> `issues.id` (ON DELETE CASCADE)
- `author_id`: VARCHAR(64)
- `author_name`: VARCHAR(128)
- `author_email`: VARCHAR(128)
- `author_role`: VARCHAR(32) (`'user'`, `'admin'`)
- `message`: TEXT
- `is_internal`: BOOLEAN (true para observação restrita à equipe)
- `created_date`: TIMESTAMPTZ

### 2.4 Tabela `issue_audit_logs` (Histórico & Linha do Tempo)
- `id`: VARCHAR(64) PK
- `issue_id`: VARCHAR(64) FK -> `issues.id` (ON DELETE CASCADE)
- `event`: VARCHAR(64)
- `title`: VARCHAR(255)
- `details`: TEXT
- `actor_name`: VARCHAR(128)
- `actor_role`: VARCHAR(32)
- `timestamp`: TIMESTAMPTZ

---

## 3. Instruções de Aplicação das Migrations

O script SQL está localizado em:
`src/db/migrations/20261016_create_issues_system.sql`

Para aplicar no PostgreSQL / Supabase:
```bash
psql -h <host> -U <usuario> -d <database> -f src/db/migrations/20261016_create_issues_system.sql
```

No ambiente frontend local standalone:
A persistência utiliza **IndexedDB nativo (`nacif_issues_db`)** com fallback sincronizado, permitindo armazenamento seguro de dados reais e imagens de até 5MB sem esgotar cotas de LocalStorage.

---

## 4. Endpoints da API Backend
Quando integrado ao servidor REST (`VITE_API_BASE_URL`):
- `GET /api/issues`: Lista relatos com suporte a filtros (`status`, `type`, `module`, `search`, `userOnly`).
- `GET /api/issues/:id`: Retorna detalhes completos do relato.
- `POST /api/issues`: Criação de novo relato com validação de payload.
- `PATCH /api/issues/:id/status`: Alteração de status, prioridade e resposta da equipe (exclusivo para administradores).
- `POST /api/issues/:id/comments`: Envio de comentário ou nota interna.
- `PATCH /api/issues/:id/read`: Atualização de leitura (limpa contador de atualizações).
- `GET /api/issues/stats`: Totais agregados de relatos por status.
