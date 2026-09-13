CREATE TABLE `survey_bonus_awards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`amount` integer DEFAULT 500 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `survey_bonus_user_idx` ON `survey_bonus_awards` (`user_email`);
--> statement-breakpoint
UPDATE `users`
SET `pon` = `pon` + 500
WHERE `chatgpt_email` IN (SELECT DISTINCT `user_email` FROM `difficulty_ratings`)
  AND `chatgpt_email` NOT IN (SELECT `user_email` FROM `survey_bonus_awards`);
--> statement-breakpoint
INSERT INTO `survey_bonus_awards` (`user_email`, `amount`)
SELECT DISTINCT `user_email`, 500
FROM `difficulty_ratings`
WHERE `user_email` NOT IN (SELECT `user_email` FROM `survey_bonus_awards`);
--> statement-breakpoint
INSERT INTO `point_requests` (`user_email`, `category`, `amount`, `description`, `status`, `reviewed_at`)
SELECT `user_email`, 'survey_bonus', 500, '試験アンケート回答（さかのぼり付与）', 'approved', CURRENT_TIMESTAMP
FROM `survey_bonus_awards`
WHERE `user_email` NOT IN (
	SELECT `user_email` FROM `point_requests` WHERE `category` = 'survey_bonus' AND `status` = 'approved'
);
