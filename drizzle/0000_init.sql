CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(255) NOT NULL,
	`dek` text NOT NULL,
	`category` varchar(32) NOT NULL,
	`author_id` varchar(64) NOT NULL,
	`published_on` date NOT NULL,
	`read_minutes` int NOT NULL DEFAULT 3,
	`image` varchar(500) NOT NULL,
	`body` longtext NOT NULL,
	`pull_quote` text,
	`tags` longtext NOT NULL,
	`related_car` varchar(120),
	`video_duration` varchar(16),
	`status` enum('published','draft') NOT NULL DEFAULT 'published',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `authors` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(80) NOT NULL,
	`country` varchar(60) NOT NULL,
	`founded` int NOT NULL,
	`tagline` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`hero_image` varchar(500) NOT NULL,
	`is_luxury` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `brands_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`brand` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`body_type` varchar(20) NOT NULL,
	`is_luxury` boolean NOT NULL DEFAULT false,
	`price_min` int NOT NULL,
	`price_max` int NOT NULL,
	`fuel_types` longtext NOT NULL,
	`transmissions` longtext NOT NULL,
	`efficiency` varchar(60) NOT NULL,
	`efficiency_value` double NOT NULL,
	`engine` varchar(160) NOT NULL,
	`power` varchar(80) NOT NULL,
	`torque` varchar(80) NOT NULL,
	`seats` longtext NOT NULL,
	`safety_rating` int NOT NULL DEFAULT 0,
	`safety_agency` varchar(20) NOT NULL DEFAULT 'Not tested',
	`airbags` int NOT NULL DEFAULT 2,
	`boot_space` int NOT NULL,
	`ground_clearance` int NOT NULL,
	`fuel_tank` int,
	`top_speed` int NOT NULL,
	`acceleration` varchar(40) NOT NULL,
	`dimensions` longtext NOT NULL,
	`rating` double NOT NULL DEFAULT 0,
	`review_count` int NOT NULL DEFAULT 0,
	`images` longtext NOT NULL,
	`focus` varchar(40),
	`colors` longtext NOT NULL,
	`tagline` varchar(200) NOT NULL,
	`overview` text NOT NULL,
	`highlights` longtext NOT NULL,
	`pros` longtext NOT NULL,
	`cons` longtext NOT NULL,
	`features` longtext NOT NULL,
	`ev` longtext,
	`expert_score` double NOT NULL DEFAULT 0,
	`expert_verdict` text NOT NULL,
	`competitors` longtext NOT NULL,
	`trending` boolean NOT NULL DEFAULT false,
	`launched_on` date,
	`status` enum('published','draft') NOT NULL DEFAULT 'published',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cars_id` PRIMARY KEY(`id`),
	CONSTRAINT `cars_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `dealer_reviews` (
	`id` varchar(64) NOT NULL,
	`dealer_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`visit` varchar(40) NOT NULL,
	`date` date NOT NULL,
	`rating` double NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dealer_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dealers` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`brand` varchar(80) NOT NULL,
	`city` varchar(64) NOT NULL,
	`area` varchar(120) NOT NULL,
	`address` varchar(300) NOT NULL,
	`rating` double NOT NULL DEFAULT 0,
	`review_count` int NOT NULL DEFAULT 0,
	`phone` varchar(30) NOT NULL,
	`email` varchar(190) NOT NULL,
	`hours` varchar(120) NOT NULL,
	`image` varchar(500) NOT NULL,
	`services` longtext NOT NULL,
	`established` int NOT NULL,
	`distance_km` double NOT NULL DEFAULT 0,
	`used_inventory` boolean NOT NULL DEFAULT false,
	`profile` longtext,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dealers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lead_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`author_id` int,
	`kind` enum('note','status','assign') NOT NULL DEFAULT 'note',
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`type` varchar(32) NOT NULL,
	`status` enum('new','contacted','qualified','converted','closed') NOT NULL DEFAULT 'new',
	`name` varchar(120) NOT NULL,
	`email` varchar(190),
	`phone` varchar(15),
	`city` varchar(64),
	`subject` varchar(200),
	`car_slug` varchar(120),
	`used_car_id` varchar(64),
	`dealer_id` varchar(64),
	`message` text,
	`details` longtext,
	`source` varchar(200),
	`user_id` int,
	`assigned_to` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `leads_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `owner_reviews` (
	`id` varchar(64) NOT NULL,
	`car_slug` varchar(120) NOT NULL,
	`user_id` int,
	`name` varchar(120) NOT NULL,
	`city` varchar(64) NOT NULL,
	`variant` varchar(120) NOT NULL,
	`owned_for` varchar(60) NOT NULL,
	`km_driven` int NOT NULL,
	`rating` double NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`date` date NOT NULL,
	`helpful` int NOT NULL DEFAULT 0,
	`ratings` longtext NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`user_agent` varchar(255),
	`ip` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(190) NOT NULL,
	`source` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_subscribers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `upcoming_cars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`brand` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`body_type` varchar(20) NOT NULL,
	`fuel` varchar(20) NOT NULL,
	`expected_launch` varchar(40) NOT NULL,
	`price_min` int NOT NULL,
	`price_max` int NOT NULL,
	`image` varchar(500) NOT NULL,
	`teaser` text NOT NULL,
	`highlights` longtext NOT NULL,
	`status` enum('published','draft') NOT NULL DEFAULT 'published',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `upcoming_cars_id` PRIMARY KEY(`id`),
	CONSTRAINT `upcoming_cars_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `used_cars` (
	`id` varchar(64) NOT NULL,
	`model_slug` varchar(120),
	`brand` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`variant` varchar(120) NOT NULL,
	`year` int NOT NULL,
	`km` int NOT NULL,
	`fuel` varchar(20) NOT NULL,
	`transmission` varchar(20) NOT NULL,
	`owners` int NOT NULL DEFAULT 1,
	`city` varchar(64) NOT NULL,
	`price` int NOT NULL,
	`new_price` int,
	`body_type` varchar(20) NOT NULL,
	`images` longtext NOT NULL,
	`focus` varchar(40),
	`verified` boolean NOT NULL DEFAULT false,
	`inspection_score` int NOT NULL DEFAULT 0,
	`registration` varchar(40) NOT NULL,
	`insurance` varchar(80) NOT NULL,
	`color` varchar(60) NOT NULL,
	`seller_name` varchar(120) NOT NULL,
	`seller_type` enum('Dealer','Individual') NOT NULL,
	`dealer_id` varchar(64),
	`highlights` longtext NOT NULL,
	`posted_on` date NOT NULL,
	`status` enum('active','reserved','sold','draft') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `used_cars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(190) NOT NULL,
	`phone` varchar(15),
	`city` varchar(64),
	`password_hash` varchar(100) NOT NULL,
	`role` enum('customer','editor','admin') NOT NULL DEFAULT 'customer',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`car_id` int NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(120) NOT NULL,
	`fuel` varchar(20) NOT NULL,
	`transmission` varchar(20) NOT NULL,
	`price` int NOT NULL,
	`efficiency` varchar(40) NOT NULL,
	`features` longtext NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `variants_car_slug_uq` UNIQUE(`car_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `wishlist_items` (
	`user_id` int NOT NULL,
	`kind` enum('cars','used') NOT NULL,
	`item_id` varchar(120) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wishlist_items_user_id_kind_item_id_pk` PRIMARY KEY(`user_id`,`kind`,`item_id`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_author_id_authors_id_fk` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `cars` ADD CONSTRAINT `cars_brand_brands_slug_fk` FOREIGN KEY (`brand`) REFERENCES `brands`(`slug`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `dealer_reviews` ADD CONSTRAINT `dealer_reviews_dealer_id_dealers_id_fk` FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_to_users_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `owner_reviews` ADD CONSTRAINT `owner_reviews_car_slug_cars_slug_fk` FOREIGN KEY (`car_slug`) REFERENCES `cars`(`slug`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `owner_reviews` ADD CONSTRAINT `owner_reviews_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `upcoming_cars` ADD CONSTRAINT `upcoming_cars_brand_brands_slug_fk` FOREIGN KEY (`brand`) REFERENCES `brands`(`slug`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `used_cars` ADD CONSTRAINT `used_cars_dealer_id_dealers_id_fk` FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `variants` ADD CONSTRAINT `variants_car_id_cars_id_fk` FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wishlist_items` ADD CONSTRAINT `wishlist_items_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `articles_published_idx` ON `articles` (`published_on`);--> statement-breakpoint
CREATE INDEX `cars_brand_idx` ON `cars` (`brand`);--> statement-breakpoint
CREATE INDEX `cars_status_idx` ON `cars` (`status`);--> statement-breakpoint
CREATE INDEX `dealer_reviews_dealer_idx` ON `dealer_reviews` (`dealer_id`);--> statement-breakpoint
CREATE INDEX `dealers_city_idx` ON `dealers` (`city`);--> statement-breakpoint
CREATE INDEX `lead_notes_lead_idx` ON `lead_notes` (`lead_id`);--> statement-breakpoint
CREATE INDEX `leads_type_idx` ON `leads` (`type`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `leads_created_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `leads_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX `leads_phone_idx` ON `leads` (`phone`);--> statement-breakpoint
CREATE INDEX `owner_reviews_car_idx` ON `owner_reviews` (`car_slug`);--> statement-breakpoint
CREATE INDEX `owner_reviews_status_idx` ON `owner_reviews` (`status`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `used_status_idx` ON `used_cars` (`status`);--> statement-breakpoint
CREATE INDEX `used_city_idx` ON `used_cars` (`city`);