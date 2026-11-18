CREATE TABLE `media_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`variants` text,
	`replaced_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`replaced_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_versions_r2_key_unique` ON `media_versions` (`r2_key`);--> statement-breakpoint
CREATE INDEX `media_versions_media` ON `media_versions` (`media_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `media` ADD `focal_x` real;--> statement-breakpoint
ALTER TABLE `media` ADD `focal_y` real;--> statement-breakpoint
ALTER TABLE `media` ADD `tags` text;