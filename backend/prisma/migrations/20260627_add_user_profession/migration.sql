ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `profession` VARCHAR(191) NULL AFTER `plan`;

UPDATE `users`
SET `profession` = 'projetista'
WHERE `profession` IS NULL OR TRIM(`profession`) = '';
