CREATE TABLE `direct_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_email` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `direct_messages_recipient_idx` ON `direct_messages` (`recipient_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `house_comment_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comment_id` integer NOT NULL,
	`reporter_email` text NOT NULL,
	`reason` text DEFAULT 'ルール違反の可能性' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `house_report_comment_user_idx` ON `house_comment_reports` (`comment_id`,`reporter_email`);