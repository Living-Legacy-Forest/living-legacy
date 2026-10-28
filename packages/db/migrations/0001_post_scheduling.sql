ALTER TABLE `posts` ADD `scheduled_at` integer;--> statement-breakpoint
CREATE INDEX `posts_scheduled_at` ON `posts` (`scheduled_at`);