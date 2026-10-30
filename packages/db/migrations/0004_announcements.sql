CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`message` text NOT NULL,
	`message_tablet` text,
	`message_desktop` text,
	`cta_label` text,
	`cta_url` text,
	`background` text DEFAULT 'moss' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`hide_paths` text DEFAULT '[]' NOT NULL,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `announcements_starts_at` ON `announcements` (`starts_at`);