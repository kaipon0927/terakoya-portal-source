CREATE TABLE `house_comment_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comment_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`reaction` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `house_comment_reaction_unique_idx` ON `house_comment_reactions` (`comment_id`,`user_email`,`reaction`);--> statement-breakpoint
CREATE INDEX `house_comment_reaction_comment_idx` ON `house_comment_reactions` (`comment_id`);