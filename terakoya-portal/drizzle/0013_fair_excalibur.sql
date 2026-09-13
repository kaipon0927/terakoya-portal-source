ALTER TABLE `game_settings` ADD `payout_10` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_settings` ADD `payout_50` integer DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_settings` ADD `payout_100` integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_settings` ADD `win_chance` integer DEFAULT 18 NOT NULL;--> statement-breakpoint
ALTER TABLE `house_results` ADD `answers_json` text;--> statement-breakpoint
INSERT INTO `point_requests` (`user_email`,`category`,`amount`,`description`,`status`,`reviewed_at`)
SELECT `chatgpt_email`,'founder_bonus',3000-`pon`,'初期PONを一律3,000へ調整','approved',CURRENT_TIMESTAMP
FROM `users` WHERE `role` <> 'admin' AND `pon` <> 3000;--> statement-breakpoint
UPDATE `users` SET `pon` = 3000 WHERE `role` <> 'admin';
