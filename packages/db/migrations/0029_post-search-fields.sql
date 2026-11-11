ALTER TABLE `posts` ADD `canonical_url` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `social_title` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `social_description` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `nofollow` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `nosnippet` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `noimageindex` integer DEFAULT false NOT NULL;