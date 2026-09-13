CREATE TABLE `difficulty_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`course_id` text NOT NULL,
	`rating` integer NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `difficulty_user_course_idx` ON `difficulty_ratings` (`user_email`,`course_id`);--> statement-breakpoint
CREATE TABLE `grade_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`course_id` text NOT NULL,
	`rating` integer NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grade_user_course_idx` ON `grade_ratings` (`user_email`,`course_id`);--> statement-breakpoint
CREATE TABLE `house_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`house` text NOT NULL,
	`scores_json` text NOT NULL,
	`chimimoryo_rate` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `house_results_user_email_unique` ON `house_results` (`user_email`);--> statement-breakpoint
CREATE TABLE `point_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`evidence_url` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chatgpt_email` text NOT NULL,
	`zen_email` text NOT NULL,
	`slack_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`house` text,
	`pon` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_chatgpt_email_unique` ON `users` (`chatgpt_email`);