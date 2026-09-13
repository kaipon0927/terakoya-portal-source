DROP INDEX `grade_user_course_idx`;--> statement-breakpoint
ALTER TABLE `grade_ratings` ADD `academic_year` integer DEFAULT 2026 NOT NULL;--> statement-breakpoint
ALTER TABLE `grade_ratings` ADD `quarter` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `grade_user_course_period_idx` ON `grade_ratings` (`user_email`,`course_id`,`academic_year`,`quarter`);