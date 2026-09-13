CREATE TABLE `baccarat_rounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`house` text NOT NULL,
	`wager` integer NOT NULL,
	`bet_on` text NOT NULL,
	`winner` text NOT NULL,
	`payout` integer DEFAULT 0 NOT NULL,
	`player_cards_json` text NOT NULL,
	`banker_cards_json` text NOT NULL,
	`player_score` integer NOT NULL,
	`banker_score` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
