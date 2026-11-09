ALTER TABLE `posts` ADD `focus_keyword` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `related_terms` text DEFAULT '[]' NOT NULL;