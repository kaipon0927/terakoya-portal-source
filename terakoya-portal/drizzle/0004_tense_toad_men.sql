CREATE TABLE `omikuji_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`fortune_date` text NOT NULL,
	`rank` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `omikuji_user_date_idx` ON `omikuji_results` (`user_email`,`fortune_date`);