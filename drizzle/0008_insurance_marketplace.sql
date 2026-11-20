CREATE TABLE `ad_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`placement_id` int NOT NULL,
	`ins_vendor_id` int,
	`partner_id` int,
	`house` boolean NOT NULL DEFAULT false,
	`name` varchar(160) NOT NULL,
	`product_id` int,
	`target_url` varchar(300),
	`starts_on` date NOT NULL,
	`ends_on` date NOT NULL,
	`days` int NOT NULL,
	`price_per_day` int NOT NULL,
	`amount` int NOT NULL,
	`gst` int NOT NULL,
	`total` int NOT NULL,
	`status` enum('draft','pending_approval','changes_requested','approved','rejected','paused','cancelled') NOT NULL DEFAULT 'draft',
	`admin_remarks` text,
	`submitted_at` datetime,
	`approved_at` datetime,
	`decided_by` int,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `ad_campaigns_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `ad_creatives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`desktop_image` varchar(300),
	`mobile_image` varchar(300),
	`headline` varchar(120),
	`body` varchar(240),
	`cta_label` varchar(40),
	`alt` varchar(200) NOT NULL,
	`status` enum('pending','approved','changes_requested','rejected') NOT NULL DEFAULT 'pending',
	`remarks` text,
	`decided_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_creatives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ad_placements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(48) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(300) NOT NULL,
	`location` varchar(160) NOT NULL,
	`format` enum('banner','sponsored_listing') NOT NULL,
	`desktop_size` varchar(20),
	`mobile_size` varchar(20),
	`price_per_day` int NOT NULL,
	`min_days` int NOT NULL DEFAULT 7,
	`max_days` int NOT NULL DEFAULT 90,
	`slots` int NOT NULL DEFAULT 1,
	`audience` enum('all','insurer','dealer') NOT NULL DEFAULT 'all',
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ad_placements_id` PRIMARY KEY(`id`),
	CONSTRAINT `ad_placements_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `ad_stats` (
	`campaign_id` int NOT NULL,
	`day` date NOT NULL,
	`impressions` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`enquiries` int NOT NULL DEFAULT 0,
	CONSTRAINT `ad_stats_campaign_id_day_pk` PRIMARY KEY(`campaign_id`,`day`)
);
--> statement-breakpoint
CREATE TABLE `ins_activity` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`user_id` int,
	`action` varchar(30) NOT NULL,
	`entity` varchar(40) NOT NULL,
	`entity_id` varchar(64),
	`summary` varchar(300) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_activity_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`target` enum('vendor','product','cover','campaign','ad_campaign','ad_creative','document','profile_change','payment','conversion','company') NOT NULL,
	`target_id` int,
	`action` varchar(30) NOT NULL,
	`from_status` varchar(30),
	`to_status` varchar(30),
	`remarks` text,
	`actor_user_id` int,
	`actor_side` enum('vendor','admin','system') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`address` varchar(300) NOT NULL,
	`city` varchar(64) NOT NULL,
	`state` varchar(64) NOT NULL,
	`pin` varchar(6) NOT NULL,
	`phone` varchar(30),
	`email` varchar(190),
	`is_primary` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`reference` varchar(16) NOT NULL,
	`title` varchar(160) NOT NULL,
	`summary` varchar(300) NOT NULL,
	`description` text,
	`type` enum('product_launch','renewal_drive','ev_promotion','seasonal','awareness','add_on_highlight','other') NOT NULL,
	`product_ids` longtext NOT NULL,
	`banner` varchar(300),
	`cta_label` varchar(40),
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`status` enum('draft','pending_approval','changes_requested','approved','rejected','paused','cancelled') NOT NULL DEFAULT 'draft',
	`admin_remarks` text,
	`submitted_at` datetime,
	`approved_at` datetime,
	`decided_by` int,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_campaigns_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `ins_change_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`fields` longtext NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`remarks` text,
	`requested_by` int,
	`decided_by` int,
	`decided_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_change_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`short_name` varchar(60),
	`logo` varchar(300),
	`about` text,
	`website` varchar(300),
	`regulator_reg_no` varchar(60),
	`headquarters` varchar(120),
	`established_year` int,
	`garage_count` int,
	`garage_note` varchar(200),
	`claim_info` longtext,
	`support_phone` varchar(30),
	`claims_phone` varchar(30),
	`claims_email` varchar(190),
	`vendor_id` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_companies_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `ins_covers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`type` enum('coverage','addon') NOT NULL,
	`key` varchar(40) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`eligibility` varchar(300),
	`max_vehicle_age_years` int,
	`fuels` longtext NOT NULL,
	`exclusions` longtext NOT NULL,
	`limits` varchar(300),
	`pricing` longtext NOT NULL,
	`status` enum('draft','pending_approval','changes_requested','approved','rejected') NOT NULL DEFAULT 'draft',
	`admin_remarks` text,
	`submitted_at` datetime,
	`decided_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_covers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_enquiries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`vendor_id` int NOT NULL,
	`product_id` int,
	`company_id` int,
	`user_id` int,
	`intent` enum('new','renewal') NOT NULL,
	`name` varchar(120) NOT NULL,
	`mobile` varchar(15) NOT NULL,
	`email` varchar(190),
	`reg_number` varchar(16),
	`vehicle_is_new` boolean NOT NULL DEFAULT false,
	`brand` varchar(80),
	`brand_name` varchar(80),
	`model` varchar(120),
	`model_name` varchar(120),
	`variant` varchar(120),
	`variant_name` varchar(120),
	`year` int,
	`fuel` varchar(16),
	`city` varchar(64),
	`state` varchar(64),
	`policy_status` enum('new_vehicle','active','expired_recent','expired_long','not_sure'),
	`policy_expiry` date,
	`previous_insurer` varchar(160),
	`ncb_pct` int NOT NULL DEFAULT 0,
	`claimed_last_year` boolean NOT NULL DEFAULT false,
	`add_ons` longtext NOT NULL,
	`idv` int,
	`indicative_premium` int,
	`estimate` longtext,
	`message` varchar(1000),
	`status` enum('new','assigned','contacted','quote_requested','quote_submitted','follow_up','interested','policy_issued','lost','closed') NOT NULL DEFAULT 'new',
	`assigned_member_id` int,
	`follow_up_at` datetime,
	`source` varchar(40) NOT NULL,
	`campaign_id` int,
	`ad_campaign_id` int,
	`consent_at` datetime NOT NULL,
	`policy_issued_at` datetime,
	`policy_number` varchar(60),
	`policy_premium` int,
	`conversion_verified_at` datetime,
	`conversion_verified_by` int,
	`lost_reason` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_enquiries_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_enquiries_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `ins_enquiry_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enquiry_id` int NOT NULL,
	`vendor_id` int NOT NULL,
	`user_id` int,
	`kind` enum('created','note','call','email','whatsapp','status','assign','reminder','quote','policy','renewal') NOT NULL,
	`body` text,
	`meta` longtext,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_enquiry_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`kind` enum('provider_view','product_view','quote_listing','compare_add','enquiry_cta','campaign_view','campaign_click','quote_view','document_download') NOT NULL,
	`ref_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`kind` varchar(40) NOT NULL,
	`filename` varchar(200) NOT NULL,
	`mime` varchar(60) NOT NULL,
	`size` int NOT NULL,
	`data` longblob NOT NULL,
	`status` enum('pending','verified','rejected') NOT NULL DEFAULT 'pending',
	`remarks` text,
	`uploaded_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`number` varchar(24) NOT NULL,
	`kind` enum('subscription','advertising','lead_fee','other') NOT NULL,
	`description` varchar(300) NOT NULL,
	`plan` varchar(32),
	`ad_campaign_id` int,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`amount` int NOT NULL,
	`gst` int NOT NULL,
	`total` int NOT NULL,
	`status` enum('due','verifying','paid','overdue','void') NOT NULL DEFAULT 'due',
	`due_on` date NOT NULL,
	`paid_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_invoices_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `ins_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role` enum('owner','admin','manager','executive','marketing','finance') NOT NULL,
	`permissions` longtext,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_members_uq` UNIQUE(`vendor_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `ins_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`user_id` int,
	`kind` varchar(40) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` varchar(500),
	`href` varchar(300),
	`read_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`invoice_id` int NOT NULL,
	`amount` int NOT NULL,
	`method` enum('bank_transfer','upi','cheque') NOT NULL,
	`utr` varchar(40) NOT NULL,
	`paid_on` date NOT NULL,
	`proof` longtext,
	`status` enum('submitted','verified','rejected') NOT NULL DEFAULT 'submitted',
	`remarks` text,
	`verified_by` int,
	`verified_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`company_id` int NOT NULL,
	`reference` varchar(16) NOT NULL,
	`code` varchar(40) NOT NULL,
	`uin` varchar(60),
	`name` varchar(160) NOT NULL,
	`category` enum('comprehensive','third_party','own_damage','bundled','new_car','used_car','ev','long_term') NOT NULL,
	`tagline` varchar(200),
	`description` text NOT NULL,
	`eligibility` longtext NOT NULL,
	`coverage` longtext NOT NULL,
	`add_ons` longtext NOT NULL,
	`pricing` longtext NOT NULL,
	`deductibles` longtext NOT NULL,
	`garage_count` int,
	`exclusions` longtext NOT NULL,
	`documents` longtext NOT NULL,
	`terms` text,
	`status` enum('draft','submitted','pending_approval','changes_requested','approved','published','rejected','suspended') NOT NULL DEFAULT 'draft',
	`admin_remarks` text,
	`required_corrections` longtext,
	`submitted_at` datetime,
	`approved_at` datetime,
	`published_at` datetime,
	`decided_by` int,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_products_reference_unique` UNIQUE(`reference`),
	CONSTRAINT `ins_products_code_uq` UNIQUE(`vendor_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `ins_quotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`vendor_id` int NOT NULL,
	`enquiry_id` int NOT NULL,
	`product_id` int,
	`status` enum('draft','submitted','accepted','declined','withdrawn') NOT NULL DEFAULT 'draft',
	`authorization` enum('indicative','insurer_authorised') NOT NULL DEFAULT 'indicative',
	`insurer_quote_ref` varchar(80),
	`idv` int NOT NULL,
	`coverage` longtext NOT NULL,
	`breakdown` longtext NOT NULL,
	`total` int NOT NULL,
	`valid_until` date NOT NULL,
	`notes` text,
	`terms` text,
	`share_token` varchar(48) NOT NULL,
	`viewed_at` datetime,
	`submitted_at` datetime,
	`responded_at` datetime,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_quotes_reference_unique` UNIQUE(`reference`),
	CONSTRAINT `ins_quotes_share_token_unique` UNIQUE(`share_token`)
);
--> statement-breakpoint
CREATE TABLE `ins_refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`invoice_id` int NOT NULL,
	`payment_id` int,
	`amount` int NOT NULL,
	`reason` varchar(300) NOT NULL,
	`reference` varchar(60) NOT NULL,
	`refunded_on` date NOT NULL,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_renewals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`vendor_id` int NOT NULL,
	`enquiry_id` int,
	`name` varchar(120) NOT NULL,
	`mobile` varchar(15) NOT NULL,
	`email` varchar(190),
	`reg_number` varchar(16),
	`brand_name` varchar(80),
	`model_name` varchar(120),
	`variant_name` varchar(120),
	`year` int,
	`fuel` varchar(16),
	`city` varchar(64),
	`current_insurer` varchar(160),
	`policy_number` varchar(60),
	`policy_type` varchar(40),
	`expiry_date` date NOT NULL,
	`ncb_pct` int NOT NULL DEFAULT 0,
	`premium` int,
	`status` enum('upcoming','contacted','quote_sent','follow_up','renewed','lapsed','lost','closed') NOT NULL DEFAULT 'upcoming',
	`assigned_member_id` int,
	`follow_up_at` datetime,
	`notes` text,
	`renewed_at` datetime,
	`source` varchar(20) NOT NULL,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_renewals_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_renewals_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `ins_ticket_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticket_id` int NOT NULL,
	`user_id` int,
	`from_staff` boolean NOT NULL DEFAULT false,
	`body` text NOT NULL,
	`attachments` longtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ins_ticket_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ins_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendor_id` int NOT NULL,
	`reference` varchar(16) NOT NULL,
	`subject` varchar(200) NOT NULL,
	`category` varchar(40) NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','awaiting_dealer','awaiting_support','resolved','closed') NOT NULL DEFAULT 'open',
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_tickets_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `ins_vendors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(16) NOT NULL,
	`owner_user_id` int NOT NULL,
	`status` enum('draft','submitted','pending_approval','under_review','documents_required','changes_requested','approved','rejected','suspended') NOT NULL DEFAULT 'draft',
	`application` longtext NOT NULL,
	`step` int NOT NULL DEFAULT 1,
	`category` enum('insurer','broker','corporate_agent','web_aggregator','imf','other_intermediary'),
	`legal_name` varchar(200),
	`brand_name` varchar(200),
	`city` varchar(64),
	`state` varchar(64),
	`gst` varchar(20),
	`licence_number` varchar(60),
	`licence_valid_until` date,
	`profile` longtext,
	`plan` varchar(32) NOT NULL DEFAULT 'basic',
	`plan_status` enum('trial','active','past_due','cancelled') NOT NULL DEFAULT 'trial',
	`plan_renews_at` date,
	`admin_remarks` text,
	`required_corrections` longtext,
	`submitted_at` datetime,
	`approved_at` datetime,
	`decided_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ins_vendors_id` PRIMARY KEY(`id`),
	CONSTRAINT `ins_vendors_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('customer','editor','admin','dealer','insurer') NOT NULL DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE `media` ADD `ins_vendor_id` int;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD CONSTRAINT `ad_campaigns_placement_id_ad_placements_id_fk` FOREIGN KEY (`placement_id`) REFERENCES `ad_placements`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD CONSTRAINT `ad_campaigns_ins_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`ins_vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD CONSTRAINT `ad_campaigns_partner_id_partners_id_fk` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD CONSTRAINT `ad_campaigns_product_id_ins_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `ins_products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD CONSTRAINT `ad_campaigns_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_campaigns` ADD CONSTRAINT `ad_campaigns_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_creatives` ADD CONSTRAINT `ad_creatives_campaign_id_ad_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_creatives` ADD CONSTRAINT `ad_creatives_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ad_stats` ADD CONSTRAINT `ad_stats_campaign_id_ad_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `ad_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_activity` ADD CONSTRAINT `ins_activity_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_activity` ADD CONSTRAINT `ins_activity_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_approvals` ADD CONSTRAINT `ins_approvals_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_approvals` ADD CONSTRAINT `ins_approvals_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_branches` ADD CONSTRAINT `ins_branches_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_campaigns` ADD CONSTRAINT `ins_campaigns_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_campaigns` ADD CONSTRAINT `ins_campaigns_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_campaigns` ADD CONSTRAINT `ins_campaigns_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_change_requests` ADD CONSTRAINT `ins_change_requests_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_change_requests` ADD CONSTRAINT `ins_change_requests_requested_by_users_id_fk` FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_change_requests` ADD CONSTRAINT `ins_change_requests_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_companies` ADD CONSTRAINT `ins_companies_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_covers` ADD CONSTRAINT `ins_covers_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_covers` ADD CONSTRAINT `ins_covers_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiries` ADD CONSTRAINT `ins_enquiries_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiries` ADD CONSTRAINT `ins_enquiries_product_id_ins_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `ins_products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiries` ADD CONSTRAINT `ins_enquiries_company_id_ins_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `ins_companies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiries` ADD CONSTRAINT `ins_enquiries_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiries` ADD CONSTRAINT `ins_enquiries_assigned_member_id_ins_members_id_fk` FOREIGN KEY (`assigned_member_id`) REFERENCES `ins_members`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiries` ADD CONSTRAINT `ins_enquiries_campaign_id_ins_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `ins_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiries` ADD CONSTRAINT `ins_enquiries_ad_campaign_id_ad_campaigns_id_fk` FOREIGN KEY (`ad_campaign_id`) REFERENCES `ad_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiries` ADD CONSTRAINT `ins_enquiries_conversion_verified_by_users_id_fk` FOREIGN KEY (`conversion_verified_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiry_events` ADD CONSTRAINT `ins_enquiry_events_enquiry_id_ins_enquiries_id_fk` FOREIGN KEY (`enquiry_id`) REFERENCES `ins_enquiries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiry_events` ADD CONSTRAINT `ins_enquiry_events_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_enquiry_events` ADD CONSTRAINT `ins_enquiry_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_events` ADD CONSTRAINT `ins_events_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_files` ADD CONSTRAINT `ins_files_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_files` ADD CONSTRAINT `ins_files_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_invoices` ADD CONSTRAINT `ins_invoices_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_invoices` ADD CONSTRAINT `ins_invoices_ad_campaign_id_ad_campaigns_id_fk` FOREIGN KEY (`ad_campaign_id`) REFERENCES `ad_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_members` ADD CONSTRAINT `ins_members_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_members` ADD CONSTRAINT `ins_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_notifications` ADD CONSTRAINT `ins_notifications_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_notifications` ADD CONSTRAINT `ins_notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_payments` ADD CONSTRAINT `ins_payments_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_payments` ADD CONSTRAINT `ins_payments_invoice_id_ins_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `ins_invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_payments` ADD CONSTRAINT `ins_payments_verified_by_users_id_fk` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_products` ADD CONSTRAINT `ins_products_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_products` ADD CONSTRAINT `ins_products_company_id_ins_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `ins_companies`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_products` ADD CONSTRAINT `ins_products_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_products` ADD CONSTRAINT `ins_products_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_quotes` ADD CONSTRAINT `ins_quotes_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_quotes` ADD CONSTRAINT `ins_quotes_enquiry_id_ins_enquiries_id_fk` FOREIGN KEY (`enquiry_id`) REFERENCES `ins_enquiries`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_quotes` ADD CONSTRAINT `ins_quotes_product_id_ins_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `ins_products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_quotes` ADD CONSTRAINT `ins_quotes_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_refunds` ADD CONSTRAINT `ins_refunds_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_refunds` ADD CONSTRAINT `ins_refunds_invoice_id_ins_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `ins_invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_refunds` ADD CONSTRAINT `ins_refunds_payment_id_ins_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `ins_payments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_refunds` ADD CONSTRAINT `ins_refunds_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_renewals` ADD CONSTRAINT `ins_renewals_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_renewals` ADD CONSTRAINT `ins_renewals_enquiry_id_ins_enquiries_id_fk` FOREIGN KEY (`enquiry_id`) REFERENCES `ins_enquiries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_renewals` ADD CONSTRAINT `ins_renewals_assigned_member_id_ins_members_id_fk` FOREIGN KEY (`assigned_member_id`) REFERENCES `ins_members`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_renewals` ADD CONSTRAINT `ins_renewals_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_ticket_messages` ADD CONSTRAINT `ins_ticket_messages_ticket_id_ins_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `ins_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_ticket_messages` ADD CONSTRAINT `ins_ticket_messages_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_tickets` ADD CONSTRAINT `ins_tickets_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_tickets` ADD CONSTRAINT `ins_tickets_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_vendors` ADD CONSTRAINT `ins_vendors_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ins_vendors` ADD CONSTRAINT `ins_vendors_decided_by_users_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ad_campaigns_placement_idx` ON `ad_campaigns` (`placement_id`,`status`,`starts_on`,`ends_on`);--> statement-breakpoint
CREATE INDEX `ad_campaigns_vendor_idx` ON `ad_campaigns` (`ins_vendor_id`,`status`);--> statement-breakpoint
CREATE INDEX `ad_campaigns_partner_idx` ON `ad_campaigns` (`partner_id`);--> statement-breakpoint
CREATE INDEX `ad_creatives_campaign_idx` ON `ad_creatives` (`campaign_id`,`status`);--> statement-breakpoint
CREATE INDEX `ins_activity_vendor_idx` ON `ins_activity` (`vendor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ins_approvals_vendor_idx` ON `ins_approvals` (`vendor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ins_approvals_target_idx` ON `ins_approvals` (`target`,`target_id`);--> statement-breakpoint
CREATE INDEX `ins_branches_vendor_idx` ON `ins_branches` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `ins_campaigns_vendor_idx` ON `ins_campaigns` (`vendor_id`,`status`);--> statement-breakpoint
CREATE INDEX `ins_campaigns_window_idx` ON `ins_campaigns` (`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `ins_change_requests_vendor_idx` ON `ins_change_requests` (`vendor_id`,`status`);--> statement-breakpoint
CREATE INDEX `ins_companies_active_idx` ON `ins_companies` (`is_active`);--> statement-breakpoint
CREATE INDEX `ins_covers_vendor_idx` ON `ins_covers` (`vendor_id`,`type`);--> statement-breakpoint
CREATE INDEX `ins_covers_status_idx` ON `ins_covers` (`status`);--> statement-breakpoint
CREATE INDEX `ins_enquiries_vendor_idx` ON `ins_enquiries` (`vendor_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `ins_enquiries_user_idx` ON `ins_enquiries` (`user_id`);--> statement-breakpoint
CREATE INDEX `ins_enquiries_mobile_idx` ON `ins_enquiries` (`mobile`);--> statement-breakpoint
CREATE INDEX `ins_enquiries_created_idx` ON `ins_enquiries` (`created_at`);--> statement-breakpoint
CREATE INDEX `ins_enquiry_events_enquiry_idx` ON `ins_enquiry_events` (`enquiry_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ins_events_vendor_idx` ON `ins_events` (`vendor_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `ins_files_vendor_idx` ON `ins_files` (`vendor_id`,`kind`);--> statement-breakpoint
CREATE INDEX `ins_invoices_vendor_idx` ON `ins_invoices` (`vendor_id`,`status`);--> statement-breakpoint
CREATE INDEX `ins_invoices_kind_idx` ON `ins_invoices` (`kind`);--> statement-breakpoint
CREATE INDEX `ins_members_user_idx` ON `ins_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `ins_notifications_vendor_idx` ON `ins_notifications` (`vendor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ins_payments_vendor_idx` ON `ins_payments` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `ins_payments_invoice_idx` ON `ins_payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `ins_products_vendor_idx` ON `ins_products` (`vendor_id`,`status`);--> statement-breakpoint
CREATE INDEX `ins_products_status_idx` ON `ins_products` (`status`);--> statement-breakpoint
CREATE INDEX `ins_products_company_idx` ON `ins_products` (`company_id`);--> statement-breakpoint
CREATE INDEX `ins_quotes_vendor_idx` ON `ins_quotes` (`vendor_id`,`status`);--> statement-breakpoint
CREATE INDEX `ins_quotes_enquiry_idx` ON `ins_quotes` (`enquiry_id`);--> statement-breakpoint
CREATE INDEX `ins_refunds_vendor_idx` ON `ins_refunds` (`vendor_id`);--> statement-breakpoint
CREATE INDEX `ins_renewals_vendor_idx` ON `ins_renewals` (`vendor_id`,`status`,`expiry_date`);--> statement-breakpoint
CREATE INDEX `ins_ticket_messages_ticket_idx` ON `ins_ticket_messages` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ins_tickets_vendor_idx` ON `ins_tickets` (`vendor_id`,`status`);--> statement-breakpoint
CREATE INDEX `ins_vendors_status_idx` ON `ins_vendors` (`status`);--> statement-breakpoint
CREATE INDEX `ins_vendors_owner_idx` ON `ins_vendors` (`owner_user_id`);--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_ins_vendor_id_ins_vendors_id_fk` FOREIGN KEY (`ins_vendor_id`) REFERENCES `ins_vendors`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_ins_vendor_idx` ON `media` (`ins_vendor_id`);