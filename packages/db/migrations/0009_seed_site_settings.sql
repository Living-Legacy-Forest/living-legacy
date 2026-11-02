-- The contact, business and social details the website used to hard-code
-- (footer, contact page, form fallbacks), moved into the CMS Settings page.
-- INSERT OR IGNORE keeps a row the CMS already saved; the UPDATE then fills
-- only the fields that row left blank, so nothing anyone typed is replaced.
INSERT OR IGNORE INTO `site_settings` (`id`, `data`, `updated_at`) VALUES ('site', '{}', unixepoch() * 1000);--> statement-breakpoint
UPDATE `site_settings` SET `data` = json_set(`data`,
  '$.siteTitle', coalesce(nullif(json_extract(`data`, '$.siteTitle'), ''), 'Living Legacy'),
  '$.tagline', coalesce(nullif(json_extract(`data`, '$.tagline'), ''), 'Welcome to Living Legacy, where we transform grief into growth by bringing communities together to create memorial forests and gardens.'),
  '$.contactEmail', coalesce(nullif(json_extract(`data`, '$.contactEmail'), ''), 'contact@livinglegacy.com.au'),
  '$.phone', coalesce(nullif(json_extract(`data`, '$.phone'), ''), '03 7019 6142'),
  '$.address', coalesce(nullif(json_extract(`data`, '$.address'), ''), '4/349 Collins St, Melbourne VIC 3000'),
  '$.openingHours', coalesce(nullif(json_extract(`data`, '$.openingHours'), ''), 'Monday to Friday, 9am to 6pm AEST'),
  '$.legalName', coalesce(nullif(json_extract(`data`, '$.legalName'), ''), 'Forest Conservation Australia Pty Ltd'),
  '$.abn', coalesce(nullif(json_extract(`data`, '$.abn'), ''), '59 639 330 617'),
  '$.facebookUrl', coalesce(nullif(json_extract(`data`, '$.facebookUrl'), ''), 'https://www.facebook.com/livinglegacyforest/'),
  '$.instagramUrl', coalesce(nullif(json_extract(`data`, '$.instagramUrl'), ''), 'https://www.instagram.com/living_legacy_forest/'),
  '$.youtubeUrl', coalesce(nullif(json_extract(`data`, '$.youtubeUrl'), ''), 'https://www.youtube.com/channel/UCA3aDohvY5Y8Hr2oviiH-gw'),
  '$.titlePattern', coalesce(nullif(json_extract(`data`, '$.titlePattern'), ''), '{page} | {site}')
) WHERE `id` = 'site';
