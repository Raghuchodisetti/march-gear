-- Editors become staff with every section (what editors could use before); admins keep full access.
ALTER TABLE `users` MODIFY COLUMN `role` enum('customer','editor','staff','admin','dealer','insurer') NOT NULL DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE `users` ADD `permissions` longtext;--> statement-breakpoint
UPDATE `users` SET `permissions` = '["leads","dealers","insurance","advertising","catalogue","content","customers","site"]' WHERE `role` = 'editor';--> statement-breakpoint
UPDATE `users` SET `role` = 'staff' WHERE `role` = 'editor';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('customer','staff','admin','dealer','insurer') NOT NULL DEFAULT 'customer';
