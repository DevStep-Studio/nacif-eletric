-- Migration: Esquema Relacional Central e Integridade (Core Schema)
-- Data: 2026-10-01
-- Projeto: Nacif Electric
-- Descrição: Estrutura relacional base contendo Usuários, Projetos Elétricos, Orçamentos e Notificações
-- com chaves primárias, integridade referencial (FKs), restrições de validação (CHECK/UNIQUE), índices e RLS.

-- 1. Extensão para UUID e Criptografia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela Base de Usuários (users)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    password_changed_at TIMESTAMPTZ,
    full_name VARCHAR(255) NOT NULL,
    profession VARCHAR(128) DEFAULT 'projetista',
    profissao VARCHAR(128) DEFAULT 'projetista',
    role VARCHAR(64) NOT NULL DEFAULT 'user',
    plan VARCHAR(64) NOT NULL DEFAULT 'profissional',
    company VARCHAR(255),
    crea VARCHAR(64),
    phone VARCHAR(64),
    avatar_url TEXT,
    profile_photo_url TEXT,
    photo_url TEXT,
    theme VARCHAR(32) DEFAULT 'light',
    preferences JSONB DEFAULT '{"notifications": true, "theme": "light"}'::jsonb,
    subscription_status VARCHAR(64) DEFAULT 'active',
    subscription_valid_until TIMESTAMPTZ,
    subscription_cancelled_at TIMESTAMPTZ,
    subscription_cancel_reason TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_date ON users(created_date DESC);

-- 3. Tabela de Projetos Elétricos (projects)
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'rascunho', 'arquivado', 'em_revisao')),
    supply_type VARCHAR(64) DEFAULT 'Trifásico' CHECK (supply_type IN ('Monofásico', 'Bifásico', 'Trifásico')),
    voltage INTEGER DEFAULT 220 CHECK (voltage IN (110, 127, 220, 380, 440)),
    circuits JSONB NOT NULL DEFAULT '[]'::jsonb,
    panel_boards JSONB NOT NULL DEFAULT '[]'::jsonb,
    plant_design JSONB NOT NULL DEFAULT '{"points":[],"routes":[]}'::jsonb,
    solar_data JSONB DEFAULT '{}'::jsonb,
    technical_notes TEXT DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_date ON projects(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_date ON projects(updated_date DESC);

-- 4. Tabela de Orçamentos Financeiros (budgets)
CREATE TABLE IF NOT EXISTS budgets (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'Rascunho' CHECK (status IN ('Rascunho', 'Enviado', 'Aprovado', 'Recusado', 'Em Revisão')),
    materials JSONB NOT NULL DEFAULT '[]'::jsonb,
    services JSONB NOT NULL DEFAULT '[]'::jsonb,
    margin NUMERIC(10,2) NOT NULL DEFAULT 30.00 CHECK (margin >= 0 AND margin <= 100),
    labor_cost NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (labor_cost >= 0),
    product_adjustment NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount_type VARCHAR(32) NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
    discount_value NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
    surcharge_type VARCHAR(32) NOT NULL DEFAULT 'percent' CHECK (surcharge_type IN ('percent', 'fixed')),
    surcharge_value NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (surcharge_value >= 0),
    validity_days INTEGER NOT NULL DEFAULT 15 CHECK (validity_days > 0),
    payment_terms VARCHAR(255) DEFAULT '50% entrada e 50% na conclusão dos serviços',
    execution_deadline VARCHAR(255) DEFAULT '15 dias úteis',
    notes TEXT DEFAULT '',
    client_info JSONB DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_owner_id ON budgets(owner_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_project_id ON budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_updated_date ON budgets(updated_date DESC);

-- 5. Tabela de Notificações do Sistema (notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) DEFAULT 'Geral',
    tone VARCHAR(32) DEFAULT 'info' CHECK (tone IN ('info', 'success', 'warning', 'danger', 'primary')),
    href VARCHAR(255),
    audience VARCHAR(32) DEFAULT 'user' CHECK (audience IN ('user', 'admin', 'all')),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications(audience);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_date ON notifications(created_date DESC);

-- 6. Triggers para Atualização Automática de Timestamp (updated_date)
CREATE OR REPLACE FUNCTION update_entity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_users_timestamp ON users;
CREATE TRIGGER trg_update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_entity_timestamp();

DROP TRIGGER IF EXISTS trg_update_projects_timestamp ON projects;
CREATE TRIGGER trg_update_projects_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_entity_timestamp();

DROP TRIGGER IF EXISTS trg_update_budgets_timestamp ON budgets;
CREATE TRIGGER trg_update_budgets_timestamp
BEFORE UPDATE ON budgets
FOR EACH ROW EXECUTE FUNCTION update_entity_timestamp();

DROP TRIGGER IF EXISTS trg_update_notifications_timestamp ON notifications;
CREATE TRIGGER trg_update_notifications_timestamp
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION update_entity_timestamp();

-- 7. Políticas de Segurança em Nível de Linha (Row Level Security - RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas para users
DROP POLICY IF EXISTS p_users_self ON users;
CREATE POLICY p_users_self ON users
    FOR ALL
    USING (id = current_setting('request.jwt.claim.sub', true) OR current_setting('request.jwt.claim.role', true) = 'super_admin');

-- Políticas para projects
DROP POLICY IF EXISTS p_projects_owner ON projects;
CREATE POLICY p_projects_owner ON projects
    FOR ALL
    USING (owner_id = current_setting('request.jwt.claim.sub', true) OR current_setting('request.jwt.claim.role', true) IN ('super_admin', 'admin'));

-- Políticas para budgets
DROP POLICY IF EXISTS p_budgets_owner ON budgets;
CREATE POLICY p_budgets_owner ON budgets
    FOR ALL
    USING (owner_id = current_setting('request.jwt.claim.sub', true) OR current_setting('request.jwt.claim.role', true) IN ('super_admin', 'admin'));

-- Políticas para notifications
DROP POLICY IF EXISTS p_notifications_recipient ON notifications;
CREATE POLICY p_notifications_recipient ON notifications
    FOR ALL
    USING (user_id = current_setting('request.jwt.claim.sub', true) OR (audience = 'admin' AND current_setting('request.jwt.claim.role', true) IN ('super_admin', 'admin')));
