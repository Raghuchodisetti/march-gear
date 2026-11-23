CREATE TABLE `customer_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`kind` varchar(40) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` varchar(500),
	`href` varchar(300),
	`read_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`nickname` varchar(60),
	`brand` varchar(80),
	`brand_name` varchar(80) NOT NULL,
	`model` varchar(120),
	`model_name` varchar(120) NOT NULL,
	`variant` varchar(120),
	`variant_name` varchar(120),
	`year` int,
	`fuel` varchar(16),
	`transmission` varchar(20),
	`reg_number` varchar(16),
	`city` varchar(64),
	`state` varchar(64),
	`purchased_on` date,
	`odometer_km` int,
	`insurer` varchar(160),
	`policy_number` varchar(60),
	`insurance_expiry` date,
	`puc_expiry` date,
	`service_due_on` date,
	`service_due_km` int,
	`warranty_until` date,
	`notes` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_vehicles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customer_notifications` ADD CONSTRAINT `customer_notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_vehicles` ADD CONSTRAINT `customer_vehicles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_notifications_user_idx` ON `customer_notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `customer_vehicles_user_idx` ON `customer_vehicles` (`user_id`);