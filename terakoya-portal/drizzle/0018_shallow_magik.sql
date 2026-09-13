ALTER TABLE `house_comment_reports` ADD `reporter_slack_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `house_comment_reports` ADD `reported_user_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `house_comment_reports` ADD `reported_slack_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `house_comment_reports` ADD `house` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `house_comment_reports` ADD `body_snapshot` text DEFAULT '' NOT NULL;