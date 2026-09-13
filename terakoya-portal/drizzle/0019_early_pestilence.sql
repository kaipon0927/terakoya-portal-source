CREATE TABLE `barrier_battle_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`house` text NOT NULL,
	`battle_date` text NOT NULL,
	`damage` integer NOT NULL,
	`taps` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `barrier_battle_user_date_idx` ON `barrier_battle_attempts` (`user_email`,`battle_date`);--> statement-breakpoint
CREATE INDEX `barrier_battle_house_idx` ON `barrier_battle_attempts` (`house`);