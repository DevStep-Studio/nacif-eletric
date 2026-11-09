-- Alternativa para importacao pelo phpMyAdmin.
-- Mesma reconciliacao da migration 20261109020000, sem SELECTs preparados.
-- Evita resultados intermediarios de EXECUTE que algumas versoes do phpMyAdmin
-- nao conseguem exibir (avisos sobre statement/parser em Display/Results.php).
-- O aviso da interface, sozinho, nao informa se o ALTER foi executado.
-- Primeiro selecione o banco da aplicacao, nao information_schema.
-- Esta consulta direta confirma a existencia das colunas antes de alterar tipos.
SHOW COLUMNS FROM `users` WHERE `Field` IN ('role', 'plan');

-- MySQL 8 / MariaDB: selecione o banco apontado pela DATABASE_URL antes de importar.
-- Corrige erro 1265 (Data truncated) ao gravar role/plan em schemas antigos.
-- Requer a tabela users e as colunas role e plan existentes.
-- Preserva registros, valores legados dos ENUMs, ordem dos membros, NULL e DEFAULT.
-- Nao promove usuarios, nao altera senhas e nao desativa o modo SQL estrito.
-- Pode ser executado novamente. DDL MySQL nao e desfeito por ROLLBACK.

-- Amplia ENUM de role sem remover valores existentes nem alterar os registros.
SELECT COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH
INTO @nacif_enum_type, @nacif_data_type, @nacif_nullable, @nacif_default, @nacif_max_length
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
  IF(
    @nacif_data_type IN ('char', 'varchar') AND @nacif_max_length < 11,
    CONCAT('ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(191) ',
      IF(@nacif_nullable = 'YES', 'NULL', 'NOT NULL'),
      IF(@nacif_default IS NULL, '', CONCAT(' DEFAULT ', QUOTE(@nacif_default)))
    ),
    'DO 0'
  )
);
PREPARE nacif_users_statement FROM @nacif_users_sql;
EXECUTE nacif_users_statement;
DEALLOCATE PREPARE nacif_users_statement;

-- Amplia ENUM de plan sem remover valores existentes nem alterar os registros.
SELECT COLUMN_TYPE, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH
INTO @nacif_enum_type, @nacif_data_type, @nacif_nullable, @nacif_default, @nacif_max_length
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
  IF(
    @nacif_data_type IN ('char', 'varchar') AND @nacif_max_length < 12,
    CONCAT('ALTER TABLE `users` MODIFY COLUMN `plan` VARCHAR(191) ',
      IF(@nacif_nullable = 'YES', 'NULL', 'NOT NULL'),
      IF(@nacif_default IS NULL, '', CONCAT(' DEFAULT ', QUOTE(@nacif_default)))
    ),
    'DO 0'
  )
);
PREPARE nacif_users_statement FROM @nacif_users_sql;
EXECUTE nacif_users_statement;
DEALLOCATE PREPARE nacif_users_statement;

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
  AND COLUMN_NAME IN ('role', 'plan')
ORDER BY COLUMN_NAME;
