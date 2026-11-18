ALTER TABLE `billing_subscriptions`
  ADD COLUMN `trial_requested` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `trial_started_at` DATETIME(3) NULL,
  ADD COLUMN `trial_ends_at` DATETIME(3) NULL;
