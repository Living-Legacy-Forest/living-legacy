CREATE TABLE `event_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`reference` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text,
	`email` text,
	`phone` text,
	`party_size` integer NOT NULL,
	`note` text,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`source` text NOT NULL,
	`manage_token_hash` text,
	`consent_at` integer,
	`checked_in_at` integer,
	`checked_in_by` text,
	`crm_synced_at` integer,
	`crm_contact_id` text,
	`crm_error` text,
	`created_at` integer NOT NULL,
	`cancelled_at` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`checked_in_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_bookings_reference` ON `event_bookings` (`reference`);--> statement-breakpoint
CREATE INDEX `event_bookings_event_status` ON `event_bookings` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `event_bookings_email` ON `event_bookings` (`email`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`location_id` text,
	`venue` text,
	`time_zone` text DEFAULT 'Australia/Melbourne' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`summary` text,
	`description` text,
	`hero_media_id` text,
	`capacity` integer,
	`max_party_size` integer DEFAULT 6 NOT NULL,
	`bookings_close_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`cancelled_at` integer,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`hero_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `events_starts_at` ON `events` (`starts_at`);--> statement-breakpoint
CREATE INDEX `events_series` ON `events` (`series_id`);