CREATE TABLE `media_coverage` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'article' NOT NULL,
	`category` text,
	`source` text NOT NULL,
	`coverage_date` integer,
	`excerpt` text,
	`reading_minutes` integer,
	`image_media_id` text,
	`external_url` text NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`draft` text,
	`published_at` integer,
	`deleted_at` integer,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`image_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_coverage_slug_live` ON `media_coverage` (`slug`) WHERE "media_coverage"."deleted_at" IS NULL;--> statement-breakpoint
-- The seven items the page carried before it was managed here, in the same
-- order. News thumbnails were bundled with the site, so they need uploading
-- again in the CMS; videos use YouTube's own thumbnail until one is set.
INSERT INTO `media_coverage` (`id`, `title`, `slug`, `kind`, `category`, `source`, `external_url`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`) VALUES
	('01M6G1F6ZYCTM0K6Q3JKQ0SFXT', 'How human ashes can be treated to become part of living memorials', 'how-human-ashes-can-be-treated-to-become-part-of-living-memorials', 'article', 'News', 'The Senior', 'https://www.thesenior.com.au/story/8816635/how-human-ashes-can-be-treated-to-become-part-of-living-memorials/', 1, 'published', 1793687264000, 1793687264000, 1793687264000),
	('01M6G1F70004VRVER7Q1ES13BH', 'Living Legacy, Western Australia', 'living-legacy-western-australia', 'video', 'Broadcast', 'Today Tonight', 'https://www.youtube.com/watch?v=_fxvSz2XfU8', 2, 'published', 1793687264000, 1793687264000, 1793687264000),
	('01M6G1F7009H382A9YPV8YC86E', 'Weird science brings eternal life to Peninsula', 'weird-science-brings-eternal-life-to-peninsula', 'article', 'News', 'Herald Sun', 'https://www.heraldsun.com.au/leader/south-east/funeral-cost-living-legacy-forest-opens-mornington-green/news-story/b378415dba3f734ccd9ff571442d9630', 3, 'published', 1793687264000, 1793687264000, 1793687264000),
	('01M6G1F701XZ8ZX7R2B8FH4HD9', 'Studio 10', 'studio-10', 'video', 'Broadcast', 'Network 10', 'https://www.youtube.com/watch?v=TZTP7yN7kfE', 4, 'published', 1793687264000, 1793687264000, 1793687264000),
	('01M6G1F701000BNZ4C2XW5YZ5P', 'Australian scientists in Melbourne turn human cremated ashes into plant food', 'australian-scientists-in-melbourne-turn-human-cremated-ashes-into-plant-food', 'article', 'News', 'Daily Mail', 'https://www.dailymail.co.uk/news/article-3597861/Australian-scientists-Melbourne-turn-humans-cremated-ashes-turned-plant-food.html', 5, 'published', 1793687264000, 1793687264000, 1793687264000),
	('01M6G1F701MXXCBAPR3NHQ1C87', 'The Project', 'the-project', 'video', 'Broadcast', 'Studio 10', 'https://www.youtube.com/watch?v=IpvLFePdRlQ', 6, 'published', 1793687264000, 1793687264000, 1793687264000),
	('01M6G1F701Q0QEDXTDYGV4F57N', 'Allan for Breakfast', 'allan-for-breakfast', 'video', 'Broadcast', 'Triple M', 'https://www.youtube.com/watch?v=b_yZqCOx3EU', 7, 'published', 1793687264000, 1793687264000, 1793687264000);
