CREATE TABLE `daily_login_rewards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`reward_date` text NOT NULL,
	`amount` integer DEFAULT 10 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_login_user_date_idx` ON `daily_login_rewards` (`user_email`,`reward_date`);