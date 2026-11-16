CREATE TABLE `redirect_daily_hits` (
	`redirect_id` text NOT NULL,
	`day` text NOT NULL,
	`hits` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`redirect_id`, `day`),
	FOREIGN KEY (`redirect_id`) REFERENCES `redirects`(`id`) ON UPDATE no action ON DELETE cascade
);
