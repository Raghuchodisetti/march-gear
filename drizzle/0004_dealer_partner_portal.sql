CREATE TABLE `partner_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`user_id` int,
	`action` varchar(30) NOT NULL,
	`entity` varchar(40) NOT NULL,
	`entity_id` varchar(64),
	`summary` varchar(300) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`target` enum('partner','vehicle','offer','brand','document','profile_change','payment') NOT NULL,
	`target_id` int,
	`action` varchar(30) NOT NULL,
	`from_status` varchar(30),
	`to_status` varchar(30),
	`remarks` text,
	`actor_user_id` int,
	`actor_side` enum('dealer','admin','system') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`brand` varchar(80) NOT NULL,
	`models` longtext NOT NULL,
	`variants` longtext NOT NULL,
	`certificate` longtext,
	`valid_until` date,
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`showroom_ids` longtext NOT NULL,
	`remarks` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_brands_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_brands_uq` UNIQUE(`partner_id`,`brand`)
);
--> statement-breakpoint
CREATE TABLE `partner_change_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`fields` longtext NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`remarks` text,
	`requested_by` int,
	`decided_by` int,
	`decided_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_change_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`kind` enum('profile_view','vehicle_view','offer_view','phone_click','whatsapp_click','direction_click') NOT NULL,
	`ref_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`kind` varchar(40) NOT NULL,
	`filename` varchar(200) NOT NULL,
	`mime` varchar(60) NOT NULL,
	`size` int NOT NULL,
	`data` longblob NOT NULL,
	`status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
	`remarks` text,
	`uploaded_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`number` varchar(24) NOT NULL,
	`plan` varchar(32) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`amount` int NOT NULL,
	`gst` int NOT NULL,
	`total` int NOT NULL,
	`status` enum('due','verifying','paid','overdue','void') NOT NULL DEFAULT 'due',
	`due_on` date NOT NULL,
	`paid_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_invoices_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `partner_lead_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`member_id` int,
	`kind` enum('note','call','status','assign','reminder','email','whatsapp','test_drive','created') NOT NULL,
	`body` text NOT NULL,
	`meta` longtext,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_lead_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`reference` varchar(16) NOT NULL,
	`name` varchar(120) NOT NULL,
	`mobile` varchar(15),
	`email` varchar(190),
	`car_label` varchar(200),
	`car_slug` varchar(120),
	`variant` varchar(120),
	`vehicle_id` int,
	`offer_id` int,
	`budget` varchar(60),
	`location` varchar(120),
	`source` varchar(30) NOT NULL DEFAULT 'website',
	`status` enum('new','contacted','follow_up','interested','test_drive_scheduled','negotiation','booking_completed','converted','lost','closed') NOT NULL DEFAULT 'new',
	`assigned_member_id` int,
	`follow_up_at` datetime,
	`lost_reason` varchar(200),
	`site_lead_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_leads_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_leads_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `partner_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role` enum('owner','admin','sales_manager','sales_executive','inventory_manager','marketing_manager') NOT NULL,
	`permissions` longtext,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_members_uq` UNIQUE(`partner_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `partner_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`user_id` int,
	`kind` varchar(40) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` varchar(500),
	`href` varchar(300),
	`read_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`reference` varchar(16) NOT NULL,
	`title` varchar(160) NOT NULL,
	`campaign_name` varchar(160) NOT NULL,
	`category` varchar(40) NOT NULL,
	`description` text NOT NULL,
	`tagline` varchar(200) NOT NULL,
	`terms` text NOT NULL,
	`scope` longtext NOT NULL,
	`discount` longtext NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`limited_stock` int,
	`max_redemptions` int,
	`redemptions` int NOT NULL DEFAULT 0,
	`media` longtext NOT NULL,
	`locations` longtext NOT NULL,
	`status` enum('draft','submitted','pending_approval','changes_requested','approved','rejected','cancelled','paused') NOT NULL DEFAULT 'draft',
	`admin_remarks` text,
	`views` int NOT NULL DEFAULT 0,
	`enquiries` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`submitted_at` datetime,
	`approved_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_offers_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_offers_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `partner_otps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`channel` enum('mobile','email') NOT NULL,
	`target` varchar(190) NOT NULL,
	`code_hash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expires_at` datetime NOT NULL,
	`consumed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_otps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`invoice_id` int NOT NULL,
	`amount` int NOT NULL,
	`method` enum('bank_transfer','upi','cheque') NOT NULL,
	`utr` varchar(40) NOT NULL,
	`paid_on` date NOT NULL,
	`proof` longtext,
	`status` enum('submitted','verified','rejected') NOT NULL DEFAULT 'submitted',
	`remarks` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_showrooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`address` varchar(300) NOT NULL,
	`state` varchar(64) NOT NULL,
	`district` varchar(64) NOT NULL,
	`city` varchar(64) NOT NULL,
	`pin` varchar(6) NOT NULL,
	`lat` double,
	`lng` double,
	`phone` varchar(30),
	`hours` longtext NOT NULL,
	`photos` longtext NOT NULL,
	`service_centre` boolean NOT NULL DEFAULT false,
	`is_primary` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_showrooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_test_drives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`reference` varchar(16) NOT NULL,
	`lead_id` int,
	`customer_name` varchar(120) NOT NULL,
	`mobile` varchar(15) NOT NULL,
	`email` varchar(190),
	`car_label` varchar(200) NOT NULL,
	`vehicle_id` int,
	`showroom_id` int,
	`requested_for` datetime,
	`scheduled_at` datetime,
	`status` enum('requested','accepted','scheduled','rescheduled','completed','cancelled','rejected','no_show') NOT NULL DEFAULT 'requested',
	`assigned_member_id` int,
	`feedback` text,
	`rating` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_test_drives_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_test_drives_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `partner_ticket_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticket_id` int NOT NULL,
	`user_id` int,
	`from_staff` boolean NOT NULL DEFAULT false,
	`body` text NOT NULL,
	`attachments` longtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partner_ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`reference` varchar(16) NOT NULL,
	`subject` varchar(200) NOT NULL,
	`category` varchar(40) NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','awaiting_dealer','awaiting_support','resolved','closed') NOT NULL DEFAULT 'open',
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_tickets_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `partner_vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partner_id` int NOT NULL,
	`reference` varchar(16) NOT NULL,
	`kind` enum('new','used') NOT NULL,
	`brand` varchar(80) NOT NULL,
	`model_slug` varchar(120),
	`model` varchar(120) NOT NULL,
	`variant` varchar(120) NOT NULL,
	`year` int NOT NULL,
	`fuel` varchar(20) NOT NULL,
	`transmission` varchar(20) NOT NULL,
	`colour` varchar(60) NOT NULL,
	`ex_showroom` int,
	`selling_price` int NOT NULL,
	`stock` int NOT NULL DEFAULT 1,
	`vin` varchar(32),
	`description` text NOT NULL,
	`specs` longtext NOT NULL,
	`features` longtext NOT NULL,
	`images` longtext NOT NULL,
	`videos` longtext NOT NULL,
	`showroom_id` int,
	`used` longtext,
	`status` enum('draft','pending_approval','changes_requested','approved','published','rejected','unpublished','archived') NOT NULL DEFAULT 'draft',
	`admin_remarks` text,
	`public_used_car_id` varchar(64),
	`views` int NOT NULL DEFAULT 0,
	`enquiries` int NOT NULL DEFAULT 0,
	`submitted_at` datetime,
	`approved_at` datetime,
	`published_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `partner_vehicles_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`owner_user_id` int NOT NULL,
	`status` enum('draft','submitted','pending_approval','under_review','documents_required','changes_requested','approved','rejected','suspended','deactivated') NOT NULL DEFAULT 'draft',
	`application` longtext NOT NULL,
	`step` int NOT NULL DEFAULT 1,
	`legal_name` varchar(200),
	`trade_name` varchar(200),
	`city` varchar(64),
	`state` varchar(64),
	`gst` varchar(20),
	`profile` longtext,
	`public_dealer_id` varchar(64),
	`plan` varchar(32) NOT NULL DEFAULT 'starter',
	`plan_status` enum('trial','active','past_due','cancelled') NOT NULL DEFAULT 'trial',
	`plan_renews_at` date,
	`admin_remarks` text,
	`required_corrections` longtext,
	`submitted_at` datetime,
	`approved_at` datetime,
	`decided_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partners_id` PRIMARY KEY(`id`),
	CONSTRAINT `partners_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('customer','editor','admin','dealer') NOT NULL DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE `dealer_reviews` ADD `reply` text;--> statement-breakpoint
ALTER TABLE `dealer_reviews` ADD `replied_at` datetime;--> statement-breakpoint
ALTER TABLE `partner_activity` ADD CONSTRAINT `partner_activity_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_activity` ADD CONSTRAINT `partner_activity_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_approvals` ADD CONSTRAINT `partner_approvals_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_approvals` ADD CONSTRAINT `partner_approvals_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_brands` ADD CONSTRAINT `partner_brands_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_change_requests` ADD CONSTRAINT `partner_change_requests_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_change_requests` ADD CONSTRAINT `partner_change_requests_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_change_requests` ADD CONSTRAINT `partner_change_requests_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_events` ADD CONSTRAINT `partner_events_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_files` ADD CONSTRAINT `partner_files_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_files` ADD CONSTRAINT `partner_files_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_invoices` ADD CONSTRAINT `partner_invoices_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_lead_events` ADD CONSTRAINT `partner_lead_events_lead_id_partner_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `partner_leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_lead_events` ADD CONSTRAINT `partner_lead_events_member_id_partner_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `partner_members`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_leads` ADD CONSTRAINT `partner_leads_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_leads` ADD CONSTRAINT `partner_leads_vehicle_id_partner_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `partner_vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_leads` ADD CONSTRAINT `partner_leads_offer_id_partner_offers_id_fk` FOREIGN KEY (`offer_id`) REFERENCES `partner_offers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_leads` ADD CONSTRAINT `partner_leads_assigned_member_id_partner_members_id_fk` FOREIGN KEY (`assigned_member_id`) REFERENCES `partner_members`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_leads` ADD CONSTRAINT `partner_leads_site_lead_id_leads_id_fk` FOREIGN KEY (`site_lead_id`) REFERENCES `leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_members` ADD CONSTRAINT `partner_members_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_members` ADD CONSTRAINT `partner_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_notifications` ADD CONSTRAINT `partner_notifications_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_notifications` ADD CONSTRAINT `partner_notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD CONSTRAINT `partner_offers_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_otps` ADD CONSTRAINT `partner_otps_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_payments` ADD CONSTRAINT `partner_payments_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_payments` ADD CONSTRAINT `partner_payments_invoice_id_partner_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `partner_invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_showrooms` ADD CONSTRAINT `partner_showrooms_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_test_drives` ADD CONSTRAINT `partner_test_drives_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_test_drives` ADD CONSTRAINT `partner_test_drives_lead_id_partner_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `partner_leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_test_drives` ADD CONSTRAINT `partner_test_drives_vehicle_id_partner_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `partner_vehicles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_test_drives` ADD CONSTRAINT `partner_test_drives_showroom_id_partner_showrooms_id_fk` FOREIGN KEY (`showroom_id`) REFERENCES `partner_showrooms`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_test_drives` ADD CONSTRAINT `partner_test_drives_assigned_member_id_partner_members_id_fk` FOREIGN KEY (`assigned_member_id`) REFERENCES `partner_members`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_ticket_messages` ADD CONSTRAINT `partner_ticket_messages_ticket_id_partner_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `partner_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_ticket_messages` ADD CONSTRAINT `partner_ticket_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_tickets` ADD CONSTRAINT `partner_tickets_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_tickets` ADD CONSTRAINT `partner_tickets_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_vehicles` ADD CONSTRAINT `partner_vehicles_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_vehicles` ADD CONSTRAINT `partner_vehicles_showroom_id_partner_showrooms_id_fk` FOREIGN KEY (`showroom_id`) REFERENCES `partner_showrooms`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partners` ADD CONSTRAINT `partners_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partners` ADD CONSTRAINT `partners_public_dealer_id_dealers_id_fk` FOREIGN KEY (`public_dealer_id`) REFERENCES `dealers`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `partners` ADD CONSTRAINT `partners_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `partner_activity_partner_idx` ON `partner_activity` (`partner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `partner_approvals_partner_idx` ON `partner_approvals` (`partner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `partner_approvals_target_idx` ON `partner_approvals` (`target`,`target_id`);--> statement-breakpoint
CREATE INDEX `partner_change_requests_partner_idx` ON `partner_change_requests` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `partner_events_partner_idx` ON `partner_events` (`partner_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `partner_files_partner_idx` ON `partner_files` (`partner_id`,`kind`);--> statement-breakpoint
CREATE INDEX `partner_invoices_partner_idx` ON `partner_invoices` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `partner_lead_events_lead_idx` ON `partner_lead_events` (`lead_id`);--> statement-breakpoint
CREATE INDEX `partner_leads_partner_idx` ON `partner_leads` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `partner_leads_follow_idx` ON `partner_leads` (`partner_id`,`follow_up_at`);--> statement-breakpoint
CREATE INDEX `partner_leads_created_idx` ON `partner_leads` (`partner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `partner_members_user_idx` ON `partner_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `partner_notifications_partner_idx` ON `partner_notifications` (`partner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `partner_offers_partner_idx` ON `partner_offers` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `partner_offers_window_idx` ON `partner_offers` (`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `partner_otps_user_idx` ON `partner_otps` (`user_id`,`channel`);--> statement-breakpoint
CREATE INDEX `partner_payments_partner_idx` ON `partner_payments` (`partner_id`);--> statement-breakpoint
CREATE INDEX `partner_showrooms_partner_idx` ON `partner_showrooms` (`partner_id`);--> statement-breakpoint
CREATE INDEX `partner_test_drives_partner_idx` ON `partner_test_drives` (`partner_id`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `partner_ticket_messages_ticket_idx` ON `partner_ticket_messages` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `partner_tickets_partner_idx` ON `partner_tickets` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `partner_vehicles_partner_idx` ON `partner_vehicles` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `partner_vehicles_status_idx` ON `partner_vehicles` (`status`);--> statement-breakpoint
CREATE INDEX `partners_status_idx` ON `partners` (`status`);--> statement-breakpoint
CREATE INDEX `partners_owner_idx` ON `partners` (`owner_user_id`);