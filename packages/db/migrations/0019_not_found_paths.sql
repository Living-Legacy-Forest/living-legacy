CREATE TABLE `not_found_paths` (
	`path` text PRIMARY KEY NOT NULL,
	`hits` integer DEFAULT 1 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`dismissed_at` integer
);
--> statement-breakpoint
CREATE INDEX `not_found_paths_last_seen` ON `not_found_paths` (`last_seen_at`);