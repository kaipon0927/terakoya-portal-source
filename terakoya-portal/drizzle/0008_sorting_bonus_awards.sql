CREATE TABLE `sorting_bonus_awards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`amount` integer DEFAULT 300 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sorting_bonus_user_idx` ON `sorting_bonus_awards` (`user_email`);
--> statement-breakpoint
INSERT INTO `sorting_bonus_awards` (`user_email`, `amount`)
SELECT `users`.`chatgpt_email`, 300
FROM `users`
LEFT JOIN `house_results` ON `house_results`.`user_email` = `users`.`chatgpt_email`
WHERE `users`.`house` IS NOT NULL
  AND (`house_results`.`user_email` IS NULL OR datetime(`house_results`.`updated_at`) < datetime('2026-08-24T03:57:16Z'));
--> statement-breakpoint
UPDATE `users`
SET `pon` = `pon` + 300
WHERE `chatgpt_email` IN (SELECT `user_email` FROM `sorting_bonus_awards`);
