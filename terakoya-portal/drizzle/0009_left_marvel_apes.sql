CREATE TABLE `game_settings` (
	`game` text PRIMARY KEY NOT NULL,
	`multiplier_10` integer DEFAULT 3 NOT NULL,
	`multiplier_50` integer DEFAULT 2 NOT NULL,
	`multiplier_100` integer DEFAULT 3 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `janken_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`wager` integer NOT NULL,
	`payout` integer DEFAULT 0 NOT NULL,
	`result` text NOT NULL,
	`player_hand` text NOT NULL,
	`kaipon_hand` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
