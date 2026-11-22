ALTER TABLE `locations` ADD `seo_title` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `seo_description` text;--> statement-breakpoint
ALTER TABLE `locations` ADD `og_media_id` text REFERENCES media(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `locations` ADD `noindex` integer DEFAULT false NOT NULL;