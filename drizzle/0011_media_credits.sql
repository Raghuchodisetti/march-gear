ALTER TABLE `media` ADD `source_url` varchar(500);--> statement-breakpoint
ALTER TABLE `media` ADD `author` varchar(160);--> statement-breakpoint
ALTER TABLE `media` ADD `author_url` varchar(500);--> statement-breakpoint
ALTER TABLE `media` ADD `license` varchar(60);--> statement-breakpoint
ALTER TABLE `media` ADD `license_url` varchar(300);--> statement-breakpoint
ALTER TABLE `media` ADD `credit_note` varchar(200);--> statement-breakpoint
ALTER TABLE `media` ADD `thumb` longblob;--> statement-breakpoint
CREATE INDEX `media_source_idx` ON `media` (`source_url`);