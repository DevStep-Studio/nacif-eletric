-- Execute no banco da aplicacao: USE `wegdb`;
-- Repara apenas tabelas/colunas ausentes da auditoria e configuracoes administrativas.
-- Preserva tabelas existentes e seus registros. Pode ser executado novamente.
SET @nacif_previous_group_concat = @@SESSION.group_concat_max_len;
SET SESSION group_concat_max_len = 65535;

CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `actor_name` VARCHAR(191) NOT NULL,
    `actor_email` VARCHAR(191) NOT NULL,
    `actor_role` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target_type` VARCHAR(191) NOT NULL,
    `target_id` VARCHAR(191) NULL,
    `target_name` VARCHAR(191) NULL,
    `details` TEXT NOT NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actor_id_idx`(`actor_id`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_target_type_idx`(`target_type`),
    INDEX `audit_logs_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT GROUP_CONCAT(CONCAT('ADD COLUMN `', expected.column_name, '` ', expected.column_definition) ORDER BY expected.position SEPARATOR ', ') INTO @nacif_missing_columns
FROM (
  SELECT 1 AS position, 'id' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 2 AS position, 'actor_id' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 3 AS position, 'actor_name' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 4 AS position, 'actor_email' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 5 AS position, 'actor_role' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 6 AS position, 'action' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 7 AS position, 'target_type' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 8 AS position, 'target_id' AS column_name, 'VARCHAR(191) NULL' AS column_definition
  UNION ALL
  SELECT 9 AS position, 'target_name' AS column_name, 'VARCHAR(191) NULL' AS column_definition
  UNION ALL
  SELECT 10 AS position, 'details' AS column_name, 'TEXT NOT NULL' AS column_definition
  UNION ALL
  SELECT 11 AS position, 'metadata' AS column_name, 'JSON NULL' AS column_definition
  UNION ALL
  SELECT 12 AS position, 'ip_address' AS column_name, 'VARCHAR(191) NULL' AS column_definition
  UNION ALL
  SELECT 13 AS position, 'user_agent' AS column_name, 'TEXT NULL' AS column_definition
  UNION ALL
  SELECT 14 AS position, 'timestamp' AS column_name, 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)' AS column_definition
) AS expected
LEFT JOIN information_schema.COLUMNS AS actual
  ON actual.TABLE_SCHEMA = DATABASE() AND actual.TABLE_NAME = 'audit_logs' AND actual.COLUMN_NAME = expected.column_name
WHERE actual.COLUMN_NAME IS NULL;
SET @nacif_admin_sql = IF(@nacif_missing_columns IS NULL,
  'SELECT ''audit_logs: todas as colunas ja existem'' AS resultado',
  CONCAT('ALTER TABLE `audit_logs` ', @nacif_missing_columns));
PREPARE nacif_admin_statement FROM @nacif_admin_sql;
EXECUTE nacif_admin_statement;
DEALLOCATE PREPARE nacif_admin_statement;

CREATE TABLE IF NOT EXISTS `system_settings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'global_settings',
    `require_mfa_super_admin` BOOLEAN NOT NULL DEFAULT false,
    `session_timeout_minutes` INTEGER NOT NULL DEFAULT 60,
    `max_login_attempts` INTEGER NOT NULL DEFAULT 5,
    `allow_user_registration` BOOLEAN NOT NULL DEFAULT true,
    `maintenance_mode` BOOLEAN NOT NULL DEFAULT false,
    `system_version` VARCHAR(191) NOT NULL DEFAULT '1.4.0',
    `updated_by` VARCHAR(191) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT GROUP_CONCAT(CONCAT('ADD COLUMN `', expected.column_name, '` ', expected.column_definition) ORDER BY expected.position SEPARATOR ', ') INTO @nacif_missing_columns
FROM (
  SELECT 1 AS position, 'id' AS column_name, 'VARCHAR(191) NOT NULL DEFAULT ''global_settings''' AS column_definition
  UNION ALL
  SELECT 2 AS position, 'require_mfa_super_admin' AS column_name, 'BOOLEAN NOT NULL DEFAULT false' AS column_definition
  UNION ALL
  SELECT 3 AS position, 'session_timeout_minutes' AS column_name, 'INTEGER NOT NULL DEFAULT 60' AS column_definition
  UNION ALL
  SELECT 4 AS position, 'max_login_attempts' AS column_name, 'INTEGER NOT NULL DEFAULT 5' AS column_definition
  UNION ALL
  SELECT 5 AS position, 'allow_user_registration' AS column_name, 'BOOLEAN NOT NULL DEFAULT true' AS column_definition
  UNION ALL
  SELECT 6 AS position, 'maintenance_mode' AS column_name, 'BOOLEAN NOT NULL DEFAULT false' AS column_definition
  UNION ALL
  SELECT 7 AS position, 'system_version' AS column_name, 'VARCHAR(191) NOT NULL DEFAULT ''1.4.0''' AS column_definition
  UNION ALL
  SELECT 8 AS position, 'updated_by' AS column_name, 'VARCHAR(191) NULL' AS column_definition
  UNION ALL
  SELECT 9 AS position, 'updated_at' AS column_name, 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)' AS column_definition
) AS expected
LEFT JOIN information_schema.COLUMNS AS actual
  ON actual.TABLE_SCHEMA = DATABASE() AND actual.TABLE_NAME = 'system_settings' AND actual.COLUMN_NAME = expected.column_name
WHERE actual.COLUMN_NAME IS NULL;
SET @nacif_admin_sql = IF(@nacif_missing_columns IS NULL,
  'SELECT ''system_settings: todas as colunas ja existem'' AS resultado',
  CONCAT('ALTER TABLE `system_settings` ', @nacif_missing_columns));
PREPARE nacif_admin_statement FROM @nacif_admin_sql;
EXECUTE nacif_admin_statement;
DEALLOCATE PREPARE nacif_admin_statement;

SET SESSION group_concat_max_len = @nacif_previous_group_concat;
