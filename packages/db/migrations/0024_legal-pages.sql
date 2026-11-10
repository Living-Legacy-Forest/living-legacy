CREATE TABLE `legal_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`seo_description` text,
	`last_published_at` integer,
	`review_requested_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`draft` text,
	`published_at` integer,
	`deleted_at` integer,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_pages_slug_unique` ON `legal_pages` (`slug`);