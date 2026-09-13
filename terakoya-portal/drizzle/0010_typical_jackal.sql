CREATE TABLE `access_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`code_hint` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slot_spins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`wager` integer NOT NULL,
	`payout` integer DEFAULT 0 NOT NULL,
	`result` text NOT NULL,
	`symbols_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
