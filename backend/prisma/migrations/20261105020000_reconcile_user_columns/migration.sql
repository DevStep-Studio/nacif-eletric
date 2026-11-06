-- MySQL 8 / MariaDB. Selecione o banco da aplicacao antes de executar: USE `wegdb`;
-- Adiciona os campos ausentes de users; nao remove tabelas, colunas ou usuarios.
-- Pode ser executado novamente: consulta information_schema antes de cada ALTER.
-- Campos existentes e seus dados sao preservados. Se passwordHash/full_name forem
-- criados em uma tabela antiga, ficam vazios para os registros existentes: nao ha
-- conversao automatica de senhas de outro formato nem concessao de privilegios.
SET @nacif_previous_group_concat = @@SESSION.group_concat_max_len;
SET SESSION group_concat_max_len = 65535;

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL DEFAULT '',
  `full_name` VARCHAR(191) NOT NULL DEFAULT '',
  `role` ENUM('super_admin','admin','user') NOT NULL DEFAULT 'user',
  `plan` ENUM('gratuito','profissional','engenharia','estudante','eletrico','solar','completo') NOT NULL DEFAULT 'gratuito',
  `is_super_admin` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
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
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT GROUP_CONCAT(
  CONCAT('ADD COLUMN `', expected.column_name, '` ', expected.column_definition)
  ORDER BY expected.ordinal_position SEPARATOR ', '
) INTO @nacif_missing_user_columns
FROM (
  SELECT 1 AS ordinal_position, 'id' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 2 AS ordinal_position, 'email' AS column_name, 'VARCHAR(191) NOT NULL' AS column_definition
  UNION ALL
  SELECT 3 AS ordinal_position, 'passwordHash' AS column_name, 'VARCHAR(191) NOT NULL DEFAULT ''''' AS column_definition
  UNION ALL
  SELECT 4 AS ordinal_position, 'full_name' AS column_name, 'VARCHAR(191) NOT NULL DEFAULT ''''' AS column_definition
  UNION ALL
  SELECT 5 AS ordinal_position, 'role' AS column_name, 'ENUM(''super_admin'',''admin'',''user'') NOT NULL DEFAULT ''user''' AS column_definition
  UNION ALL
  SELECT 6 AS ordinal_position, 'plan' AS column_name, 'ENUM(''gratuito'',''profissional'',''engenharia'',''estudante'',''eletrico'',''solar'',''completo'') NOT NULL DEFAULT ''gratuito''' AS column_definition
  UNION ALL
  SELECT 7 AS ordinal_position, 'is_super_admin' AS column_name, 'BOOLEAN NOT NULL DEFAULT FALSE' AS column_definition
  UNION ALL
  SELECT 8 AS ordinal_position, 'status' AS column_name, 'VARCHAR(191) NOT NULL DEFAULT ''active''' AS column_definition
  UNION ALL
  SELECT 9 AS ordinal_position, 'profession' AS column_name, 'VARCHAR(191) NULL' AS column_definition
  UNION ALL
  SELECT 10 AS ordinal_position, 'company' AS column_name, 'VARCHAR(191) NULL' AS column_definition
  UNION ALL
  SELECT 11 AS ordinal_position, 'crea' AS column_name, 'VARCHAR(191) NULL' AS column_definition
  UNION ALL
  SELECT 12 AS ordinal_position, 'phone' AS column_name, 'VARCHAR(191) NULL' AS column_definition
  UNION ALL
  SELECT 13 AS ordinal_position, 'avatar_url' AS column_name, 'LONGTEXT NULL' AS column_definition
  UNION ALL
  SELECT 14 AS ordinal_position, 'custom_permissions' AS column_name, 'JSON NULL' AS column_definition
  UNION ALL
  SELECT 15 AS ordinal_position, 'is_deleted' AS column_name, 'BOOLEAN NOT NULL DEFAULT FALSE' AS column_definition
  UNION ALL
  SELECT 16 AS ordinal_position, 'deleted_at' AS column_name, 'DATETIME(3) NULL' AS column_definition
  UNION ALL
  SELECT 17 AS ordinal_position, 'last_access' AS column_name, 'DATETIME(3) NULL' AS column_definition
  UNION ALL
  SELECT 18 AS ordinal_position, 'created_at' AS column_name, 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)' AS column_definition
  UNION ALL
  SELECT 19 AS ordinal_position, 'updated_at' AS column_name, 'DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)' AS column_definition
) AS expected
LEFT JOIN information_schema.COLUMNS AS actual
  ON actual.TABLE_SCHEMA = DATABASE()
  AND actual.TABLE_NAME = 'users'
  AND actual.COLUMN_NAME = expected.column_name
WHERE actual.COLUMN_NAME IS NULL;

SET @nacif_users_sql = IF(
  @nacif_missing_user_columns IS NULL,
  'SELECT ''users: todas as colunas ja existem'' AS resultado',
  CONCAT('ALTER TABLE `users` ', @nacif_missing_user_columns)
);
PREPARE nacif_users_statement FROM @nacif_users_sql;
EXECUTE nacif_users_statement;
DEALLOCATE PREPARE nacif_users_statement;

-- Amplia ENUM de role sem remover valores existentes nem alterar os registros.
SELECT COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
INTO @nacif_enum_type, @nacif_data_type, @nacif_nullable, @nacif_default
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role';
SET @nacif_enum_additions = CONCAT(
  IF(LOCATE('''super_admin''', @nacif_enum_type) = 0, ',''super_admin''', ''),
  IF(LOCATE('''admin''', @nacif_enum_type) = 0, ',''admin''', ''),
  IF(LOCATE('''user''', @nacif_enum_type) = 0, ',''user''', '')
);
SET @nacif_users_sql = IF(
  @nacif_data_type = 'enum' AND @nacif_enum_additions <> '',
  CONCAT('ALTER TABLE `users` MODIFY COLUMN `role` ',
    LEFT(@nacif_enum_type, CHAR_LENGTH(@nacif_enum_type) - 1), @nacif_enum_additions, ') ',
    IF(@nacif_nullable = 'YES', 'NULL', 'NOT NULL'),
    IF(@nacif_default IS NULL, '', CONCAT(' DEFAULT ', QUOTE(@nacif_default)))
  ),
  'SELECT ''users.role: tipo compativel preservado'' AS resultado'
);
PREPARE nacif_users_statement FROM @nacif_users_sql;
EXECUTE nacif_users_statement;
DEALLOCATE PREPARE nacif_users_statement;

-- Amplia ENUM de plan sem remover valores existentes nem alterar os registros.
SELECT COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
INTO @nacif_enum_type, @nacif_data_type, @nacif_nullable, @nacif_default
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'plan';
SET @nacif_enum_additions = CONCAT(
  IF(LOCATE('''gratuito''', @nacif_enum_type) = 0, ',''gratuito''', ''),
  IF(LOCATE('''profissional''', @nacif_enum_type) = 0, ',''profissional''', ''),
  IF(LOCATE('''engenharia''', @nacif_enum_type) = 0, ',''engenharia''', ''),
  IF(LOCATE('''estudante''', @nacif_enum_type) = 0, ',''estudante''', ''),
  IF(LOCATE('''eletrico''', @nacif_enum_type) = 0, ',''eletrico''', ''),
  IF(LOCATE('''solar''', @nacif_enum_type) = 0, ',''solar''', ''),
  IF(LOCATE('''completo''', @nacif_enum_type) = 0, ',''completo''', '')
);
SET @nacif_users_sql = IF(
  @nacif_data_type = 'enum' AND @nacif_enum_additions <> '',
  CONCAT('ALTER TABLE `users` MODIFY COLUMN `plan` ',
    LEFT(@nacif_enum_type, CHAR_LENGTH(@nacif_enum_type) - 1), @nacif_enum_additions, ') ',
    IF(@nacif_nullable = 'YES', 'NULL', 'NOT NULL'),
    IF(@nacif_default IS NULL, '', CONCAT(' DEFAULT ', QUOTE(@nacif_default)))
  ),
  'SELECT ''users.plan: tipo compativel preservado'' AS resultado'
);
PREPARE nacif_users_statement FROM @nacif_users_sql;
EXECUTE nacif_users_statement;
DEALLOCATE PREPARE nacif_users_statement;

SET SESSION group_concat_max_len = @nacif_previous_group_concat;

-- Conferencia final: compare com o model User de schema.prisma.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;
