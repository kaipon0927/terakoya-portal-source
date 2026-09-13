CREATE TABLE `slot_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`wager` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`phases_json` text NOT NULL,
	`stops_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
