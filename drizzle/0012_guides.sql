CREATE TABLE `guide_files` (
	`guide_id` int NOT NULL,
	`seq` int NOT NULL,
	`data` longblob NOT NULL,
	CONSTRAINT `guide_files_guide_id_seq_pk` PRIMARY KEY(`guide_id`,`seq`)
);
--> statement-breakpoint
CREATE TABLE `guides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`subject` varchar(120) NOT NULL,
	`title` varchar(200) NOT NULL,
	`summary` text NOT NULL,
	`content` longtext NOT NULL,
	`words` int NOT NULL DEFAULT 0,
	`pdf_name` varchar(200),
	`pdf_size` int,
	`pdf_pages` int,
	`show_pdf` boolean NOT NULL DEFAULT true,
	`status` enum('published','draft') NOT NULL DEFAULT 'published',
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guides_id` PRIMARY KEY(`id`),
	CONSTRAINT `guides_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `guide_files` ADD CONSTRAINT `guide_files_guide_id_guides_id_fk` FOREIGN KEY (`guide_id`) REFERENCES `guides`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `guides` ADD CONSTRAINT `guides_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `guides_subject_idx` ON `guides` (`subject`);--> statement-breakpoint
CREATE INDEX `guides_status_idx` ON `guides` (`status`);