DROP INDEX `events_slug`;--> statement-breakpoint
CREATE INDEX `events_slug` ON `events` (`slug`);--> statement-breakpoint
-- The dates of a repeating event now share one address. Each existing series takes
-- its first date's, without the "-2026-11-14" (and "-1000" time) added per date.
CREATE TABLE `__series_slug` (`series_id` text PRIMARY KEY NOT NULL, `slug` text NOT NULL);--> statement-breakpoint
INSERT INTO `__series_slug` (`series_id`, `slug`)
SELECT e.`series_id`,
  CASE
    -- "-2026-11-14-1000": a date and a time (D1 refuses long GLOB patterns,
    -- so the suffix is checked a piece at a time).
    WHEN length(e.`slug`) > 16
      AND substr(e.`slug`, -16, 1) = '-' AND substr(e.`slug`, -11, 1) = '-'
      AND substr(e.`slug`, -8, 1) = '-' AND substr(e.`slug`, -5, 1) = '-'
      AND substr(e.`slug`, -15, 4) GLOB '[0-9][0-9][0-9][0-9]'
      AND substr(e.`slug`, -4, 4) GLOB '[0-9][0-9][0-9][0-9]'
      THEN substr(e.`slug`, 1, length(e.`slug`) - 16)
    -- "-2026-11-14": a date.
    WHEN length(e.`slug`) > 11
      AND substr(e.`slug`, -11, 1) = '-' AND substr(e.`slug`, -6, 1) = '-'
      AND substr(e.`slug`, -3, 1) = '-'
      AND substr(e.`slug`, -10, 4) GLOB '[0-9][0-9][0-9][0-9]'
      THEN substr(e.`slug`, 1, length(e.`slug`) - 11)
    ELSE e.`slug`
  END
FROM `events` e
WHERE e.`series_id` IS NOT NULL
  AND e.`id` = (
    SELECT f.`id` FROM `events` f WHERE f.`series_id` = e.`series_id`
    ORDER BY f.`starts_at`, f.`id` LIMIT 1
  );--> statement-breakpoint
-- An address another event already has gets a short code from its series.
UPDATE `__series_slug` SET `slug` = `slug` || '-' || lower(substr(`series_id`, 1, 4))
WHERE EXISTS (
    SELECT 1 FROM `events` o WHERE o.`slug` = `__series_slug`.`slug` AND o.`series_id` IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM `__series_slug` s2
    WHERE s2.`slug` = `__series_slug`.`slug` AND s2.`series_id` < `__series_slug`.`series_id`
  );--> statement-breakpoint
UPDATE `events` SET `slug` = (
  SELECT s.`slug` FROM `__series_slug` s WHERE s.`series_id` = `events`.`series_id`
)
WHERE `series_id` IS NOT NULL;--> statement-breakpoint
DROP TABLE `__series_slug`;
