CREATE TABLE `content_version` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- The website caches pages under this version; every change it shows adds one.
-- Left out on purpose: tables written on every visit (redirect hits, missing
-- pages), presence, bookings, logs and revisions.
INSERT INTO `content_version` (`id`, `version`) VALUES (1, 0);
--> statement-breakpoint
CREATE TRIGGER `content_version_posts_insert` AFTER INSERT ON `posts` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_posts_update` AFTER UPDATE OF `title`, `slug`, `excerpt`, `body`, `featured_media_id`, `author_id`, `location_id`, `seo_title`, `seo_description`, `og_media_id`, `noindex`, `canonical_url`, `social_title`, `social_description`, `nofollow`, `nosnippet`, `noimageindex`, `status`, `published_at`, `deleted_at` ON `posts` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_posts_delete` AFTER DELETE ON `posts` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_legal_pages_insert` AFTER INSERT ON `legal_pages` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_legal_pages_update` AFTER UPDATE OF `title`, `body`, `seo_description`, `status`, `published_at`, `last_published_at` ON `legal_pages` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_legal_pages_delete` AFTER DELETE ON `legal_pages` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_post_terms_insert` AFTER INSERT ON `post_terms` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_post_terms_update` AFTER UPDATE ON `post_terms` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_post_terms_delete` AFTER DELETE ON `post_terms` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_terms_insert` AFTER INSERT ON `terms` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_terms_update` AFTER UPDATE ON `terms` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_terms_delete` AFTER DELETE ON `terms` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_faqs_insert` AFTER INSERT ON `faqs` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_faqs_update` AFTER UPDATE ON `faqs` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_faqs_delete` AFTER DELETE ON `faqs` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_faq_groups_insert` AFTER INSERT ON `faq_groups` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_faq_groups_update` AFTER UPDATE ON `faq_groups` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_faq_groups_delete` AFTER DELETE ON `faq_groups` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_testimonials_insert` AFTER INSERT ON `testimonials` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_testimonials_update` AFTER UPDATE ON `testimonials` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_testimonials_delete` AFTER DELETE ON `testimonials` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_team_members_insert` AFTER INSERT ON `team_members` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_team_members_update` AFTER UPDATE ON `team_members` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_team_members_delete` AFTER DELETE ON `team_members` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_announcements_insert` AFTER INSERT ON `announcements` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_announcements_update` AFTER UPDATE ON `announcements` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_announcements_delete` AFTER DELETE ON `announcements` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_media_coverage_insert` AFTER INSERT ON `media_coverage` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_media_coverage_update` AFTER UPDATE ON `media_coverage` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_media_coverage_delete` AFTER DELETE ON `media_coverage` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_locations_insert` AFTER INSERT ON `locations` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_locations_update` AFTER UPDATE ON `locations` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_locations_delete` AFTER DELETE ON `locations` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_media_insert` AFTER INSERT ON `media` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_media_update` AFTER UPDATE ON `media` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_media_delete` AFTER DELETE ON `media` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_site_settings_insert` AFTER INSERT ON `site_settings` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_site_settings_update` AFTER UPDATE ON `site_settings` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_site_settings_delete` AFTER DELETE ON `site_settings` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_events_insert` AFTER INSERT ON `events` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_events_update` AFTER UPDATE ON `events` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
--> statement-breakpoint
CREATE TRIGGER `content_version_events_delete` AFTER DELETE ON `events` BEGIN UPDATE `content_version` SET `version` = `version` + 1 WHERE `id` = 1; END;
