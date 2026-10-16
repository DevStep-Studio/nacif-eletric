-- Migration: Criação da Central de Avisos e Erros (Nacif Electric)
-- Data: 2026-10-16
-- Descrição: Estrutura relacional para relatos de bugs/avisos, anexos, comentários e auditoria.

-- 1. Tabela Principal de Relatos (issues)
CREATE TABLE IF NOT EXISTS issues (
    id VARCHAR(64) PRIMARY KEY,
    protocol VARCHAR(32) NOT NULL UNIQUE,
    type VARCHAR(16) NOT NULL CHECK (type IN ('erro', 'aviso')),
    title VARCHAR(255) NOT NULL,
    module VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    steps_to_reproduce TEXT,
    expected_result TEXT,
    actual_result TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'em_analise', 'em_correcao', 'resolvido', 'encerrado')),
    priority VARCHAR(16) NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'critica')),
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(128) NOT NULL,
    user_email VARCHAR(128) NOT NULL,
    workspace_id VARCHAR(64) NOT NULL DEFAULT 'default_workspace',
    project_id VARCHAR(64),
    technical_info JSONB DEFAULT '{}'::jsonb,
    internal_notes TEXT DEFAULT '',
    unread_user BOOLEAN NOT NULL DEFAULT FALSE,
    unread_admin BOOLEAN NOT NULL DEFAULT TRUE,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para otimização de busca e filtragem
CREATE INDEX IF NOT EXISTS idx_issues_user_id ON issues (user_id);
CREATE INDEX IF NOT EXISTS idx_issues_workspace_id ON issues (workspace_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues (status);
CREATE INDEX IF NOT EXISTS idx_issues_module ON issues (module);
CREATE INDEX IF NOT EXISTS idx_issues_type ON issues (type);
CREATE INDEX IF NOT EXISTS idx_issues_created_date ON issues (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_issues_protocol ON issues (protocol);

-- 2. Tabela de Anexos (issue_attachments)
CREATE TABLE IF NOT EXISTS issue_attachments (
    id VARCHAR(64) PRIMARY KEY,
    issue_id VARCHAR(64) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    size INTEGER NOT NULL,
    type VARCHAR(64) NOT NULL,
    storage_path TEXT NOT NULL,
    data_url TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_issue_id ON issue_attachments (issue_id);

-- 3. Tabela de Comentários / Interações (issue_comments)
CREATE TABLE IF NOT EXISTS issue_comments (
    id VARCHAR(64) PRIMARY KEY,
    issue_id VARCHAR(64) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(128) NOT NULL,
    author_email VARCHAR(128) NOT NULL,
    author_role VARCHAR(32) NOT NULL DEFAULT 'user',
    message TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON issue_comments (issue_id);

-- 4. Tabela de Histórico de Auditoria / Linha do Tempo (issue_audit_logs)
CREATE TABLE IF NOT EXISTS issue_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    issue_id VARCHAR(64) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    event VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    details TEXT,
    actor_name VARCHAR(128) NOT NULL,
    actor_role VARCHAR(32) NOT NULL DEFAULT 'user',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_issue_id ON issue_audit_logs (issue_id);

-- Trigger para atualização automática de updated_date
CREATE OR REPLACE FUNCTION update_issue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_issue_timestamp ON issues;
CREATE TRIGGER trg_update_issue_timestamp
BEFORE UPDATE ON issues
FOR EACH ROW
EXECUTE FUNCTION update_issue_timestamp();
