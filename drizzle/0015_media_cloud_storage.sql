ALTER TABLE `media` MODIFY COLUMN `data` longblob;--> statement-breakpoint
ALTER TABLE `media` ADD `storage` varchar(8) DEFAULT 'db' NOT NULL;