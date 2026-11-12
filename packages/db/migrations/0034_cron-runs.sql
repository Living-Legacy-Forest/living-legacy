CREATE TABLE `cron_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job` text NOT NULL,
	`started_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `cron_runs_job_started` ON `cron_runs` (`job`,`started_at`);--> statement-breakpoint
CREATE INDEX `cron_runs_started` ON `cron_runs` (`started_at`);