CREATE DATABASE IF NOT EXISTS `nacif_electric`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `nacif_electric`;

-- 1. Tabela de Usuários (users)
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NOT NULL,
    `role` ENUM('super_admin', 'admin', 'user') NOT NULL DEFAULT 'user',
    `plan` ENUM('gratuito', 'profissional', 'engenharia') NOT NULL DEFAULT 'gratuito',
    `is_super_admin` BOOLEAN NOT NULL DEFAULT FALSE,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `profession` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `crea` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `avatar_url` LONGTEXT NULL,
    `custom_permissions` JSON NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE,
    `deleted_at` DATETIME(3) NULL,
    `last_access` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_status_idx`(`status`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_is_deleted_idx`(`is_deleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Tabela de Projetos Elétricos (projects)
CREATE TABLE IF NOT EXISTS `projects` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `client_name` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `project_type` VARCHAR(191) NULL,
    `solar_config` JSON NULL,
    `voltage` INTEGER NULL,
    `supply_type` VARCHAR(191) NULL,
    `circuits` JSON NULL,
    `total_demand_w` DOUBLE NOT NULL DEFAULT 0,
    `panel_size` INTEGER NULL,
    `panel_boards` JSON NULL,
    `panel_layout` JSON NULL,
    `diagram_layout` JSON NULL,
    `plant_design` JSON NULL,
    `plant_points_count` INTEGER NULL,
    `plant_routes_count` INTEGER NULL,
    `plant_infra_type` VARCHAR(191) NULL,
    `status` ENUM('Rascunho', 'Em_Andamento', 'Concluido', 'Aprovado') NOT NULL DEFAULT 'Rascunho',
    `notes` TEXT NULL,
    `materials` JSON NULL,
    `manual_budget_items` JSON NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `projects_created_by_id_idx`(`created_by_id`),
    INDEX `projects_status_idx`(`status`),
    INDEX `projects_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `projects_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Tabela de Revisões de Projetos (project_revisions)
CREATE TABLE IF NOT EXISTS `project_revisions` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `actor_user_id` VARCHAR(191) NOT NULL,
    `actor_email` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `summary` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_revisions_project_id_created_at_idx`(`project_id`, `created_at`),
    UNIQUE INDEX `project_revisions_project_id_version_key`(`project_id`, `version`),
    PRIMARY KEY (`id`),
    CONSTRAINT `project_revisions_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Tabela de Orçamentos (budgets)
CREATE TABLE IF NOT EXISTS `budgets` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('Rascunho', 'Enviado', 'Aprovado', 'Recusado', 'Em_Revisao') NOT NULL DEFAULT 'Rascunho',
    `margin` DOUBLE NOT NULL DEFAULT 30.0,
    `labor_cost` DOUBLE NOT NULL DEFAULT 0.0,
    `product_adjustment` DOUBLE NOT NULL DEFAULT 0.0,
    `discount_type` VARCHAR(32) NOT NULL DEFAULT 'percent',
    `discount_value` DOUBLE NOT NULL DEFAULT 0.0,
    `surcharge_type` VARCHAR(32) NOT NULL DEFAULT 'percent',
    `surcharge_value` DOUBLE NOT NULL DEFAULT 0.0,
    `validity_days` INTEGER NOT NULL DEFAULT 15,
    `payment_terms` VARCHAR(255) NULL,
    `execution_deadline` VARCHAR(255) NULL,
    `materials` JSON NULL,
    `services` JSON NULL,
    `client_info` JSON NULL,
    `notes` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `project_id` VARCHAR(191) NULL,
    `owner_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `budgets_owner_id_idx`(`owner_id`),
    INDEX `budgets_project_id_idx`(`project_id`),
    INDEX `budgets_status_idx`(`status`),
    INDEX `budgets_updated_at_idx`(`updated_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `budgets_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `budgets_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Tabela de Relatos de Avisos e Erros (issues)
CREATE TABLE IF NOT EXISTS `issues` (
    `id` VARCHAR(191) NOT NULL,
    `protocol` VARCHAR(64) NOT NULL,
    `type` VARCHAR(32) NOT NULL DEFAULT 'erro',
    `title` VARCHAR(255) NOT NULL,
    `module` VARCHAR(64) NOT NULL,
    `description` TEXT NOT NULL,
    `steps_to_reproduce` TEXT NULL,
    `expected_result` TEXT NULL,
    `actual_result` TEXT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'recebido',
    `priority` VARCHAR(32) NOT NULL DEFAULT 'media',
    `technical_info` JSON NULL,
    `internal_notes` TEXT NULL,
    `unread_user` BOOLEAN NOT NULL DEFAULT FALSE,
    `unread_admin` BOOLEAN NOT NULL DEFAULT TRUE,
    `user_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `issues_protocol_key`(`protocol`),
    INDEX `issues_user_id_idx`(`user_id`),
    INDEX `issues_project_id_idx`(`project_id`),
    INDEX `issues_status_idx`(`status`),
    INDEX `issues_priority_idx`(`priority`),
    INDEX `issues_module_idx`(`module`),
    INDEX `issues_type_idx`(`type`),
    INDEX `issues_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `issues_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `issues_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 6. Tabela de Comentários de Issues (issue_comments)
CREATE TABLE IF NOT EXISTS `issue_comments` (
    `id` VARCHAR(191) NOT NULL,
    `issue_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `author_name` VARCHAR(191) NOT NULL,
    `author_email` VARCHAR(191) NOT NULL,
    `author_role` VARCHAR(64) NOT NULL DEFAULT 'user',
    `message` TEXT NOT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `issue_comments_issue_id_idx`(`issue_id`),
    INDEX `issue_comments_author_id_idx`(`author_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `issue_comments_issue_id_fkey` FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `issue_comments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 7. Tabela de Anexos de Issues (issue_attachments)
CREATE TABLE IF NOT EXISTS `issue_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `issue_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `size` INTEGER NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `storage_path` TEXT NOT NULL,
    `data_url` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `issue_attachments_issue_id_idx`(`issue_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `issue_attachments_issue_id_fkey` FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 8. Tabela de Auditoria de Issues (issue_audit_logs)
CREATE TABLE IF NOT EXISTS `issue_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `issue_id` VARCHAR(191) NOT NULL,
    `event` VARCHAR(64) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `details` TEXT NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `actor_role` VARCHAR(64) NOT NULL DEFAULT 'user',
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `issue_audit_logs_issue_id_idx`(`issue_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `issue_audit_logs_issue_id_fkey` FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 9. Tabela Geral de Auditoria do Sistema (audit_logs)
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `actor_email` VARCHAR(191) NOT NULL,
    `actor_role` VARCHAR(64) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `target_type` VARCHAR(64) NOT NULL,
    `target_id` VARCHAR(191) NULL,
    `target_name` VARCHAR(255) NULL,
    `details` TEXT NOT NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actor_id_idx`(`actor_id`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_target_type_idx`(`target_type`),
    INDEX `audit_logs_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 10. Tabela de Configurações Globais Administrativas (system_settings)
CREATE TABLE IF NOT EXISTS `system_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'global_settings',
    `require_mfa_super_admin` BOOLEAN NOT NULL DEFAULT FALSE,
    `session_timeout_minutes` INTEGER NOT NULL DEFAULT 60,
    `max_login_attempts` INTEGER NOT NULL DEFAULT 5,
    `allow_user_registration` BOOLEAN NOT NULL DEFAULT TRUE,
    `maintenance_mode` BOOLEAN NOT NULL DEFAULT FALSE,
    `system_version` VARCHAR(32) NOT NULL DEFAULT '1.4.0',
    `updated_by` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 11. Tabela de Tokens de Recuperação de Senha (password_reset_tokens)
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 12. Tabela de Notificações (notifications)
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'Sistema',
    `tone` VARCHAR(191) NOT NULL DEFAULT 'info',
    `href` VARCHAR(191) NOT NULL DEFAULT '/',
    `read` BOOLEAN NOT NULL DEFAULT FALSE,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `notifications_user_id_read_idx`(`user_id`, `read`),
    PRIMARY KEY (`id`),
    CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 13. Tabela de Configurações da Aplicação (app_settings)
CREATE TABLE IF NOT EXISTS `app_settings` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
