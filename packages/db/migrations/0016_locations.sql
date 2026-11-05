CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`state` text NOT NULL,
	`region` text,
	`stage` text DEFAULT 'coming_soon' NOT NULL,
	`external_url` text,
	`hero_media_id` text,
	`intro` text,
	`about` text,
	`address` text,
	`latitude` real,
	`longitude` real,
	`map_url` text,
	`hours` text,
	`phone` text,
	`email` text,
	`hubspot_form_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`draft` text,
	`published_at` integer,
	`deleted_at` integer,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`hero_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_slug_live` ON `locations` (`slug`) WHERE "locations"."deleted_at" IS NULL;
--> statement-breakpoint
-- The locations named in the national site plan. Mornington and Wellington
-- Dam keep their own websites until they move here; Logan is the first to
-- launch on this site. Details already on the website are copied across;
-- the rest is filled in from the CMS.
INSERT INTO `locations` (`id`, `name`, `slug`, `state`, `region`, `stage`, `external_url`, `intro`, `address`, `latitude`, `longitude`, `phone`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G1F6R0J1FKXVJH7AB7SYJV', 'Living Legacy Logan', 'logan', 'QLD', NULL, 'coming_soon', NULL, NULL, NULL, NULL, NULL, NULL, 1, 'published', 1793846777000, 1793846777000, 1793846777000
WHERE NOT EXISTS (SELECT 1 FROM `locations` WHERE `slug` = 'logan' AND `deleted_at` IS NULL);--> statement-breakpoint
INSERT INTO `locations` (`id`, `name`, `slug`, `state`, `region`, `stage`, `external_url`, `intro`, `address`, `latitude`, `longitude`, `phone`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G1F6R1J0W8D4EHTXWRGX40', 'Brisbane', 'brisbane', 'QLD', NULL, 'coming_soon', NULL, NULL, NULL, NULL, NULL, NULL, 2, 'published', 1793846777000, 1793846777000, 1793846777000
WHERE NOT EXISTS (SELECT 1 FROM `locations` WHERE `slug` = 'brisbane' AND `deleted_at` IS NULL);--> statement-breakpoint
INSERT INTO `locations` (`id`, `name`, `slug`, `state`, `region`, `stage`, `external_url`, `intro`, `address`, `latitude`, `longitude`, `phone`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G1F6R2H7PQAGQA1S4B7JNS', 'Living Legacy Mornington', 'mornington', 'VIC', 'Mornington Peninsula', 'external', 'https://morningtongreen.com.au/', 'Our first protected Living Legacy Garden, located on the Mornington Peninsula in Melbourne, Australia. Choose from a selection of blossoming European trees.', '125 Tyabb-Tooradin Rd, Somerville VIC 3912', -38.2263664, 145.2367573, '+61 3 9059 4959', 3, 'published', 1793846777000, 1793846777000, 1793846777000
WHERE NOT EXISTS (SELECT 1 FROM `locations` WHERE `slug` = 'mornington' AND `deleted_at` IS NULL);--> statement-breakpoint
INSERT INTO `locations` (`id`, `name`, `slug`, `state`, `region`, `stage`, `external_url`, `intro`, `address`, `latitude`, `longitude`, `phone`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G1F6R30HDMNKXTJ8NPHHXF', 'Wellington Dam', 'wellington-dam', 'WA', NULL, 'external', 'https://livinglegacywellingtondam.org.au/', 'Join the community creating a creek front forest for the native quokka and black cockatoo in Perth, Western Australia. Choose from trees that stand tall among giants growing over 30 metres.', '1 Wellington Dam Rd, Worsley WA 6225', -33.4005027, 115.9801541, '0427 096 944', 4, 'published', 1793846777000, 1793846777000, 1793846777000
WHERE NOT EXISTS (SELECT 1 FROM `locations` WHERE `slug` = 'wellington-dam' AND `deleted_at` IS NULL);--> statement-breakpoint
INSERT INTO `locations` (`id`, `name`, `slug`, `state`, `region`, `stage`, `external_url`, `intro`, `address`, `latitude`, `longitude`, `phone`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G1F6R41KY1ZPX6FQCB8S45', 'Wallerawang', 'wallerawang', 'NSW', 'Piper Ridge', 'external', NULL, NULL, NULL, NULL, NULL, NULL, 5, 'published', 1793846777000, 1793846777000, 1793846777000
WHERE NOT EXISTS (SELECT 1 FROM `locations` WHERE `slug` = 'wallerawang' AND `deleted_at` IS NULL);--> statement-breakpoint
INSERT INTO `locations` (`id`, `name`, `slug`, `state`, `region`, `stage`, `external_url`, `intro`, `address`, `latitude`, `longitude`, `phone`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G1F6R5AXWQZ8N7MYXFB93X', 'Sydney', 'sydney', 'NSW', NULL, 'coming_soon', NULL, NULL, NULL, NULL, NULL, NULL, 6, 'published', 1793846777000, 1793846777000, 1793846777000
WHERE NOT EXISTS (SELECT 1 FROM `locations` WHERE `slug` = 'sydney' AND `deleted_at` IS NULL);--> statement-breakpoint
INSERT INTO `locations` (`id`, `name`, `slug`, `state`, `region`, `stage`, `external_url`, `intro`, `address`, `latitude`, `longitude`, `phone`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G1F6R66WQXG0SHSZJ4R9NB', 'Blue Mountains', 'blue-mountains', 'NSW', NULL, 'coming_soon', NULL, NULL, NULL, NULL, NULL, NULL, 7, 'published', 1793846777000, 1793846777000, 1793846777000
WHERE NOT EXISTS (SELECT 1 FROM `locations` WHERE `slug` = 'blue-mountains' AND `deleted_at` IS NULL);
