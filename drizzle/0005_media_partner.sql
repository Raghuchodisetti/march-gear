ALTER TABLE `media` ADD `partner_id` int;--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_partner_idx` ON `media` (`partner_id`);