-- CreateTable
CREATE TABLE `billing_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `environment` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `customer_attempted` BOOLEAN NOT NULL DEFAULT false,
    `lock_token` VARCHAR(191) NULL,
    `lock_until` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `billing_accounts_user_id_environment_key`(`user_id`, `environment`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `account_id` VARCHAR(191) NOT NULL,
    `remote_id` VARCHAR(191) NULL,
    `plan_code` VARCHAR(191) NOT NULL,
    `cycle` VARCHAR(191) NOT NULL,
    `billing_type` VARCHAR(191) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'creating',
    `create_attempted` BOOLEAN NOT NULL DEFAULT false,
    `schedule_aligned` BOOLEAN NOT NULL DEFAULT false,
    `next_due_date` VARCHAR(191) NOT NULL,
    `pending_change` JSON NULL,
    `cancel_requested` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `billing_subscriptions_remote_id_idx`(`remote_id`),
    INDEX `billing_subscriptions_account_id_created_at_idx`(`account_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_payments` (
    `id` VARCHAR(191) NOT NULL,
    `remote_id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `plan_code` VARCHAR(191) NOT NULL,
    `cycle` VARCHAR(191) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `due_date` VARCHAR(191) NOT NULL,
    `invoice_url` VARCHAR(191) NULL,
    `paid_at` DATETIME(3) NULL,
    `period_start` DATETIME(3) NULL,
    `period_end` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `billing_payments_subscription_id_due_date_idx`(`subscription_id`, `due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_events` (
    `id` VARCHAR(191) NOT NULL,
    `environment` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

