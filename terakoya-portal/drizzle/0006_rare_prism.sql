DROP INDEX `difficulty_user_course_idx`;--> statement-breakpoint
ALTER TABLE `difficulty_ratings` ADD `academic_year` integer DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `difficulty_ratings` ADD `quarter` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `difficulty_ratings` ADD `respondent_year` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `difficulty_user_course_period_idx` ON `difficulty_ratings` (`user_email`,`course_id`,`academic_year`,`quarter`);