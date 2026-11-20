ALTER TABLE `invitation` ADD `extra_permissions` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `extra_permissions` text DEFAULT '[]' NOT NULL;