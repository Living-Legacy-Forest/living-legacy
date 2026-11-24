CREATE TABLE `trashed_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`area` text NOT NULL,
	`row_id` text NOT NULL,
	`payload` text NOT NULL,
	`deleted_by` text,
	`deleted_at` integer NOT NULL,
	FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trashed_rows_row` ON `trashed_rows` (`area`,`row_id`);--> statement-breakpoint
CREATE INDEX `trashed_rows_deleted_at` ON `trashed_rows` (`deleted_at`);