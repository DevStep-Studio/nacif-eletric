-- Selecione o banco da aplicacao (USE `wegdb`;).
-- Normaliza apenas contas ativas legadas, preservando suspensoes e exclusoes.
UPDATE `users`
SET `status` = 'active'
WHERE `is_deleted` = FALSE
  AND `deleted_at` IS NULL
  AND (
    `status` IS NULL
    OR LOWER(TRIM(`status`)) IN ('', 'active', 'ativo', 'ativa')
  );
