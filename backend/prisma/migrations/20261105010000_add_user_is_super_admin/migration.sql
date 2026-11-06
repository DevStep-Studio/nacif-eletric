-- Execute no banco utilizado pela DATABASE_URL (neste ambiente: wegdb).
ALTER TABLE `users`
  ADD COLUMN `is_super_admin` BOOLEAN NOT NULL DEFAULT FALSE;
