CREATE TABLE `post_presence` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`seen_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_presence_seen` ON `post_presence` (`seen_at`);