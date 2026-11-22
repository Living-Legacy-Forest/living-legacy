ALTER TABLE `media` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `media` ADD `deleted_by` text REFERENCES user(id) ON DELETE set null;