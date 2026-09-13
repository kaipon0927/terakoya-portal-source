CREATE TABLE `house_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`house` text NOT NULL,
	`user_email` text NOT NULL,
	`slack_name` text NOT NULL,
	`body` text NOT NULL,
	`comment_date` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `house_comments_house_created_idx` ON `house_comments` (`house`,`created_at`);--> statement-breakpoint
CREATE INDEX `house_comments_user_date_idx` ON `house_comments` (`user_email`,`comment_date`);