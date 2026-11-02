-- The upcoming-locations page moved from its long old-site address to
-- /locations/upcoming/. The old address redirects there permanently, and the
-- older WordPress redirect that pointed at the long address now points
-- straight at the new one, so nobody goes through two hops.
INSERT OR IGNORE INTO `redirects` (`id`, `from_path`, `to_path`, `status_code`, `note`, `created_at`, `updated_at`) VALUES ('legacy_upcoming_short', '/locations/register-your-interest-for-locations-throughout-australia', '/locations/upcoming/', 301, 'Page renamed to a shorter address', unixepoch() * 1000, unixepoch() * 1000);--> statement-breakpoint
UPDATE `redirects` SET `to_path` = '/locations/upcoming/', `updated_at` = unixepoch() * 1000 WHERE `to_path` = '/locations/register-your-interest-for-locations-throughout-australia/';
