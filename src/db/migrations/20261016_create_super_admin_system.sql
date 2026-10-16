-- Migration: Sistema de Painel Super Administrador (RBAC, Auditoria e Usuários)
-- Data: 2026-10-16
-- Projeto: Nacif Electric

-- 1. Atualização e Extensão da Tabela de Usuários (users)
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_access TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

-- 2. Tabela de Papéis e Perfis de Acesso (roles)
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    level INTEGER NOT NULL DEFAULT 3,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserção dos Papéis Padrão
INSERT INTO roles (id, name, level, description, is_system, permissions)
VALUES 
    ('super_admin', 'Super Administrador', 1, 'Acesso irrestrito a todos os módulos, configurações e auditoria.', TRUE, '{"*": {"*": true}}'::jsonb),
    ('admin', 'Administrador', 2, 'Gerenciamento de projetos, relatórios e suporte a usuários.', TRUE, '{"projects": {"*": true}, "issues": {"*": true}}'::jsonb),
    ('user', 'Usuário Padrão', 3, 'Acesso operacional a projetos e ferramentas elétricas.', TRUE, '{"projects": {"view": true, "create": true, "edit": true}}'::jsonb),
    ('engenheiro', 'Engenheiro Eletricista', 3, 'Elaboração técnica de projetos e memórias de cálculo.', FALSE, '{"projects": {"*": true}, "planta_ia": {"*": true}, "panel_generator": {"*": true}}'::jsonb),
    ('visualizador', 'Visualizador', 4, 'Apenas consulta e leitura de projetos autorizados.', FALSE, '{"projects": {"view": true}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 3. Tabela de Auditoria e Logs Administrativos (audit_logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(128) NOT NULL,
    actor_email VARCHAR(128) NOT NULL,
    actor_role VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(64),
    target_name VARCHAR(255),
    details TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- 4. Tabela de Configurações Administrativas do Sistema (system_settings)
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'global_settings',
    require_mfa_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
    max_login_attempts INTEGER NOT NULL DEFAULT 5,
    allow_user_registration BOOLEAN NOT NULL DEFAULT TRUE,
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    system_version VARCHAR(32) NOT NULL DEFAULT '1.4.0',
    updated_by VARCHAR(64),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (id, system_version)
VALUES ('global_settings', '1.4.0')
ON CONFLICT (id) DO NOTHING;

-- 5. Função de Provisionamento do Super Admin Inicial
-- Promove os e-mails administrativos caso já existam na base
UPDATE users 
SET role = 'super_admin', is_super_admin = TRUE, status = 'active'
WHERE email IN ('admin@nacif.com', 'grc22.09@hotmail.com');
