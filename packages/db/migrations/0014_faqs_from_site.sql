ALTER TABLE `faq_groups` ADD `nav_label` text;--> statement-breakpoint
ALTER TABLE `faq_groups` ADD `slug` text;
--> statement-breakpoint
-- Group headings, side-menu labels and #anchors as the FAQs page had them.
-- A group that already exists (same name) keeps its id and gets the label and
-- anchor only where they are blank.
--> statement-breakpoint
INSERT INTO `faq_groups` (`id`, `name`, `nav_label`, `slug`, `sort_order`, `created_at`, `updated_at`)
SELECT '01M6G7WK5HT0WX9HND9007PNNN', 'General questions', NULL, 'general-questions', 0, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faq_groups` WHERE lower(`name`) = lower('General questions'));
--> statement-breakpoint
UPDATE `faq_groups` SET `nav_label` = coalesce(`nav_label`, NULL), `slug` = coalesce(`slug`, 'general-questions')
WHERE lower(`name`) = lower('General questions');
--> statement-breakpoint
INSERT INTO `faq_groups` (`id`, `name`, `nav_label`, `slug`, `sort_order`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JBHCA8YGC7W03N89E', 'The process', NULL, 'the-process', 1, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faq_groups` WHERE lower(`name`) = lower('The process'));
--> statement-breakpoint
UPDATE `faq_groups` SET `nav_label` = coalesce(`nav_label`, NULL), `slug` = coalesce(`slug`, 'the-process')
WHERE lower(`name`) = lower('The process');
--> statement-breakpoint
INSERT INTO `faq_groups` (`id`, `name`, `nav_label`, `slug`, `sort_order`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J1YT0283BFP89FKMK', 'Protection and care', NULL, 'protection', 2, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faq_groups` WHERE lower(`name`) = lower('Protection and care'));
--> statement-breakpoint
UPDATE `faq_groups` SET `nav_label` = coalesce(`nav_label`, NULL), `slug` = coalesce(`slug`, 'protection')
WHERE lower(`name`) = lower('Protection and care');
--> statement-breakpoint
INSERT INTO `faq_groups` (`id`, `name`, `nav_label`, `slug`, `sort_order`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JGQFE9H6YTABR2HCE', 'Pricing and packages', NULL, 'pricing', 3, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faq_groups` WHERE lower(`name`) = lower('Pricing and packages'));
--> statement-breakpoint
UPDATE `faq_groups` SET `nav_label` = coalesce(`nav_label`, NULL), `slug` = coalesce(`slug`, 'pricing')
WHERE lower(`name`) = lower('Pricing and packages');
--> statement-breakpoint
INSERT INTO `faq_groups` (`id`, `name`, `nav_label`, `slug`, `sort_order`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J4TTGPPBYDBD9V2CF', 'Tree selection', NULL, 'tree-selection', 4, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faq_groups` WHERE lower(`name`) = lower('Tree selection'));
--> statement-breakpoint
UPDATE `faq_groups` SET `nav_label` = coalesce(`nav_label`, NULL), `slug` = coalesce(`slug`, 'tree-selection')
WHERE lower(`name`) = lower('Tree selection');
--> statement-breakpoint
INSERT INTO `faq_groups` (`id`, `name`, `nav_label`, `slug`, `sort_order`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JD0FBW8D68KYFDNXV', 'Sustainability and environmental impact', 'Sustainability', 'sustainability', 5, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faq_groups` WHERE lower(`name`) = lower('Sustainability and environmental impact'));
--> statement-breakpoint
UPDATE `faq_groups` SET `nav_label` = coalesce(`nav_label`, 'Sustainability'), `slug` = coalesce(`slug`, 'sustainability')
WHERE lower(`name`) = lower('Sustainability and environmental impact');
--> statement-breakpoint
INSERT INTO `faq_groups` (`id`, `name`, `nav_label`, `slug`, `sort_order`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JX48GD4YDQV3X2THB', 'Locations and experience', NULL, 'locations', 6, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faq_groups` WHERE lower(`name`) = lower('Locations and experience'));
--> statement-breakpoint
UPDATE `faq_groups` SET `nav_label` = coalesce(`nav_label`, NULL), `slug` = coalesce(`slug`, 'locations')
WHERE lower(`name`) = lower('Locations and experience');
--> statement-breakpoint
INSERT INTO `faq_groups` (`id`, `name`, `nav_label`, `slug`, `sort_order`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JV1YFHPX2QF82ZZ66', 'Family and sharing options', 'Family and sharing', 'family-sharing', 7, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faq_groups` WHERE lower(`name`) = lower('Family and sharing options'));
--> statement-breakpoint
UPDATE `faq_groups` SET `nav_label` = coalesce(`nav_label`, 'Family and sharing'), `slug` = coalesce(`slug`, 'family-sharing')
WHERE lower(`name`) = lower('Family and sharing options');
--> statement-breakpoint
-- Every question from the FAQs page in its group, then the home page's own
-- five (worded for the home page, so separate questions), tagged "home" and
-- left ungrouped. A question already in the CMS is not added again (for the
-- home ones, only an ungrouped question counts: "Are the trees protected?" is
-- on both pages, answered differently).
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JHH6N20HKPZS68CYW', 'What is a Living Legacy Tree?', json_object('type', 'text', 'text', 'A Living Legacy Tree is a memorial tree grown from the ashes of a loved one, turning remembrance into something living and seasonal. Each tree becomes a real place to visit, sit under, and feel close. Both Mornington Green in Victoria and Wellington Dam in Western Australia follow the same patented ash infusion process.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('General questions') LIMIT 1), '[]', 0, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('What is a Living Legacy Tree?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JVG2QBJ85ET28GATB', 'How does the ash infusion process work?', json_object('type', 'text', 'text', 'Cremated ashes have a pH of around 12 and a high salt content, which is harmful to soil and tree roots. The patented Living Legacy formula balances these levels and transforms the ashes into micronutrients that living soil microbes can exchange with the tree. The ceremony is carried out by trained horticulturists and can be shared with family at the planting site.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('General questions') LIMIT 1), '[]', 1, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('How does the ash infusion process work?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JTNNEKEPAT1Q8AEVB', 'Why are untreated ashes harmful to trees?', json_object('type', 'text', 'text', 'Untreated cremated remains have a pH of 12 and contain around two cups of salt, which suppresses photosynthesis and kills most seedlings. Independent laboratory tests found that 90% of trees planted directly into untreated ashes died from toxic shock. The Living Legacy treatment shifts the composition so roots can thrive rather than grow around a hardened clump.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('General questions') LIMIT 1), '[]', 2, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Why are untreated ashes harmful to trees?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JWF8E7M7TV3EG7R4E', 'Can a tree be pre-planned?', json_object('type', 'text', 'text', 'Yes. Most families choose to pre-plan, selecting and planting a tree while still alive so it can grow into a living family heirloom. This takes the weight of these decisions off loved ones later and lets families visit their tree together for years before it holds any ashes.

To walk through the process, families can [schedule a call with the Mornington Green team](https://morningtongreen.com.au/talk-to-a-legacy-planner-form/) or [schedule a call with the Wellington Dam team](https://livinglegacywellingtondam.org.au/schedule-a-call/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('The process') LIMIT 1), '[]', 3, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Can a tree be pre-planned?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JXP90KWXDSWA7MSC3', 'Is a funeral director still required?', json_object('type', 'text', 'text', 'Not necessarily. If cremation has already taken place, the legacy planners coordinate the ash treatment, plaque, certification, and planting ceremony directly. If cremation has not yet occurred, a family''s own funeral director can be used, or the team can arrange cremation through a trusted local provider.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('The process') LIMIT 1), '[]', 4, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Is a funeral director still required?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JJFP78EQQQSF1207T', 'Can the family hold a ceremony?', json_object('type', 'text', 'text', 'Yes. The planting itself usually becomes the ceremony, with family gathering to water the treated ashes into the soil around the sapling. The moment can be as quiet or as full of ritual as feels right.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('The process') LIMIT 1), '[]', 5, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Can the family hold a ceremony?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JJM8GKHJBK6D1BGTA', 'Do older ashes still work?', json_object('type', 'text', 'text', 'Yes. The Living Legacy process has been proven to work with cremated ashes dating back to the 1960s. There is no expiry on the memorial.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('The process') LIMIT 1), '[]', 6, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Do older ashes still work?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JDJY75X7DVQHKYVRQ', 'Are the trees protected?', json_object('type', 'text', 'text', 'Yes. Mornington Green is protected by a conservation agreement with Mornington Peninsula Shire Council that prevents the land from being developed or logged. Wellington Dam is protected by a conservation covenant policed by the WA Department of Biodiversity, Conservation and Attractions, which legally prevents the trees from ever being cut down. Both sites are safeguarded in perpetuity.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Protection and care') LIMIT 1), '[]', 7, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Are the trees protected?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JR04JJSVBZ483SCM6', 'What happens if a tree does not survive?', json_object('type', 'text', 'text', 'If a tree fails to thrive, it is replaced at no cost and replanted in the same reserved location. At Mornington Green, a single reapplication of the living formula reactivates the soil so a new sapling can take root, and mulch or seedlings from the original tree are used where possible. At Wellington Dam, replacement is handled directly by the forest manager.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Protection and care') LIMIT 1), '[]', 8, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('What happens if a tree does not survive?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JVZ9WBNKQF5EHDBGZ', 'What happens in the event of a fire?', json_object('type', 'text', 'text', 'Mornington Green sits on low-risk land around 300m from Western Port Bay, with over 4km of fully integrated sprinkler systems and enough dam and bore water to deliver more than 20 litres to every tree daily. Wellington Dam is managed within a protected conservation forest with its own fire response plan. Both sites were chosen specifically for their low fire risk.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Protection and care') LIMIT 1), '[]', 9, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('What happens in the event of a fire?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JHW2WJ9ZJVRGW7YQF', 'What happens if the company is sold or closes?', json_object('type', 'text', 'text', 'The land at each site is protected independently of the business. Mornington Green is cared for by an associated not-for-profit landcare partner whose sole responsibility is the land itself. Wellington Dam is managed by Legacy Conservation Forest, a registered public charity with a board of directors, forest manager, staff, and volunteers.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Protection and care') LIMIT 1), '[]', 10, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('What happens if the company is sold or closes?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JJDBZRDHSCB97W1TV', 'Is the purchase protected under Australian Consumer Law?', json_object('type', 'text', 'text', 'Yes. Forest Conservation Australia Pty Ltd (ABN 59 639 330 617) operates under the Australian Consumer Law and applies additional warranties on top of those statutory protections. Every purchase at Mornington Green and Wellington Dam is covered.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Protection and care') LIMIT 1), '[]', 11, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Is the purchase protected under Australian Consumer Law?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J0QQ8N3H52PJ89XND', 'Who cares for the tree long term?', json_object('type', 'text', 'text', 'Certified horticulturists maintain every tree at Mornington Green in perpetuity. Wellington Dam is cared for by a dedicated forest manager, staff, and volunteers under Legacy Conservation Forest. Both teams care for the trees long after the family has said goodbye.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Protection and care') LIMIT 1), '[]', 12, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Who cares for the tree long term?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JEPWYWGHZJ2K4SP05', 'Mornington Green pricing', json_object('type', 'text', 'text', 'Founders packages at Mornington Green in Victoria start from around $8,000 including GST. Final pricing depends on tree type, garden location, and chosen inclusions.

For a tailored quote, families can [schedule a call with the Mornington Green team](https://morningtongreen.com.au/talk-to-a-legacy-planner-form/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Pricing and packages') LIMIT 1), '[]', 13, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Mornington Green pricing') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J39ZBR84G84BTT9M5', 'Wellington Dam pricing', json_object('type', 'text', 'text', 'Packages at Wellington Dam in Western Australia start from around $4,950 including GST and come in two clear options: a Legacy Tree for one person, or a Love Tree for two. Both include the ash treatment, a tree-side ceremony, a marker, and a permanent place in the protected forest.

To walk through what is included, families can [schedule a call with the Wellington Dam team](https://livinglegacywellingtondam.org.au/schedule-a-call/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Pricing and packages') LIMIT 1), '[]', 14, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Wellington Dam pricing') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JKZAKVEDNV3DBPM0M', 'How does this compare to a traditional funeral?', json_object('type', 'text', 'text', 'According to ASIC, the average spend on a funeral in Australia is around $19,000 once professional fees, headstones, rights of interment, and grave liners are combined. A Living Legacy Tree starts at less than half that cost, and in some cases closer to a quarter, while removing the need for many of those separate charges.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Pricing and packages') LIMIT 1), '[]', 15, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('How does this compare to a traditional funeral?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J2G9VT45GT7S0YBF9', 'Will the family need to pay again later?', json_object('type', 'text', 'text', 'No. Both sites include long-term care in the original package, so there are no renewal fees, maintenance invoices, or upkeep charges over the years. Unlike a grave that needs ongoing upkeep, the forest naturally matures.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Pricing and packages') LIMIT 1), '[]', 16, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Will the family need to pay again later?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JD96MDVCB3TVXBJC6', 'Tree options at Mornington Green', json_object('type', 'text', 'text', 'Mornington Green offers a broad curated range of around 26 tree varieties, from flowering ornamentals to strong natives, so each tree can reflect a personality or a meaningful season. Many families choose a tree that blooms on a birthday, anniversary, or other significant day, bringing flowers back year after year.

To explore the full list, families can [schedule a call with the Mornington Green team](https://morningtongreen.com.au/talk-to-a-legacy-planner-form/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Tree selection') LIMIT 1), '[]', 17, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Tree options at Mornington Green') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JN5Y5TADYM0V6PD13', 'Tree options at Wellington Dam', json_object('type', 'text', 'text', 'Wellington Dam offers a focused selection of native species, chosen specifically for their role in restoring the surrounding conservation forest and supporting local wildlife, including endangered Quokkas and Carnaby''s black cockatoos. These trees grow over 40 metres tall and live for hundreds of years.

To learn which native species suits best, families can [schedule a call with the Wellington Dam team](https://livinglegacywellingtondam.org.au/schedule-a-call/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Tree selection') LIMIT 1), '[]', 18, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Tree options at Wellington Dam') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JF0W35T60PAE7ET74', 'Can another type of tree be chosen?', json_object('type', 'text', 'text', 'Yes. Selection differs by site: Mornington Green offers around 26 curated varieties suited to a landscaped garden, while Wellington Dam offers a focused selection of native species suited to a conservation forest.

To see which options are currently available, families can [schedule a call with the Mornington Green team](https://morningtongreen.com.au/talk-to-a-legacy-planner-form/) or [schedule a call with the Wellington Dam team](https://livinglegacywellingtondam.org.au/schedule-a-call/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Tree selection') LIMIT 1), '[]', 19, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Can another type of tree be chosen?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JTVTH311R8TTQGEY8', 'What is the carbon impact compared to a traditional funeral?', json_object('type', 'text', 'text', 'Research from Adelaide''s Centennial Park found that cremation produces around 160kg of CO2, almost four times more than a burial, though long-term grave maintenance eventually generates even more carbon. Planting a single tree is generally enough to offset the carbon impact of a cremation. Every Living Legacy Tree goes further by triggering an additional 400 offset trees planted in high-need habitats.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Sustainability and environmental impact') LIMIT 1), '[]', 20, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('What is the carbon impact compared to a traditional funeral?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JPKNAHHK23MD3KEJ1', 'How is this different from a biodegradable urn?', json_object('type', 'text', 'text', 'A biodegradable urn breaks down, but the ashes inside do not. The remains stay toxic for years, forming a salty clump that roots grow around at best, or die in at worst. A Living Legacy Tree works the other way around, transforming the ashes into living nutrients that feed the tree rather than resist it.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Sustainability and environmental impact') LIMIT 1), '[]', 21, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('How is this different from a biodegradable urn?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JQQSKQ586TCHC6SMJ', 'Is scattering ashes in nature harmful?', json_object('type', 'text', 'text', 'Yes, more often than people realise. Scattered ashes carry the same high pH and salt levels that damage soil biology and suppress plant growth in the very places chosen for their beauty. The Living Legacy treatment offers a way to honour a loved one in nature without harming it.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Sustainability and environmental impact') LIMIT 1), '[]', 22, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Is scattering ashes in nature harmful?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JTH8887AK35S1PP4K', 'What is the difference between a garden memorial and a forest memorial?', json_object('type', 'text', 'text', 'A garden memorial, as found at Mornington Green in Victoria, is a landscaped and curated space designed for quiet visits, reflection, and multiple generations of family. A forest memorial, as found at Wellington Dam in Western Australia, is a working conservation forest where every tree contributes to native habitat and wildlife.

Both honour life fully. One leans into beauty and presence, the other into ecological legacy.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Locations and experience') LIMIT 1), '[]', 23, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('What is the difference between a garden memorial and a forest memorial?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JND3GR5PAKGBPFAEP', 'How is site access guaranteed?', json_object('type', 'text', 'text', 'Access is protected by law, not just policy. Wellington Dam is held under a conservation covenant policed by the WA Department of Biodiversity, Conservation and Attractions, with legal penalties for breach. Mornington Green is held under a conservation agreement with council. The land cannot be developed, logged, or resold at either site.'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Locations and experience') LIMIT 1), '[]', 24, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('How is site access guaranteed?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J88SPYK5FFXF10KY9', 'Can the sites be visited?', json_object('type', 'text', 'text', 'Yes. Both sites are open across most of the year, with some conditions on public holidays. Guided tours are available by appointment only.

Tours can be booked through [the Mornington Green team](https://morningtongreen.com.au/book-a-tour/) or [the Wellington Dam team](https://livinglegacywellingtondam.org.au/book-a-tour/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Locations and experience') LIMIT 1), '[]', 25, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Can the sites be visited?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J7FQMFCH4DQM0KFFX', 'How many people can share one tree?', json_object('type', 'text', 'text', 'At Mornington Green, one tree can hold the legacy of multiple family members over time, with ashes added at different moments to create a true multigenerational memorial. At Wellington Dam, trees are offered in two package options: a Legacy Tree for one person, or a Love Tree for two people.

To plan sharing across the family, families can [schedule a call with the Mornington Green team](https://morningtongreen.com.au/talk-to-a-legacy-planner-form/) or [schedule a call with the Wellington Dam team](https://livinglegacywellingtondam.org.au/schedule-a-call/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Family and sharing options') LIMIT 1), '[]', 26, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('How many people can share one tree?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JC91T2AA6RADV7X2P', 'Can a tree become a multigenerational family tree?', json_object('type', 'text', 'text', 'Yes, particularly at Mornington Green. The LL Thrive formula can be infused into the soil at the base of the same tree at different times across the years, so the tree grows into a living heirloom passed down through generations.

To plan a family tree, families can [schedule a call with the Mornington Green team](https://morningtongreen.com.au/talk-to-a-legacy-planner-form/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Family and sharing options') LIMIT 1), '[]', 27, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Can a tree become a multigenerational family tree?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JBRBK31WSNTG4GP6G', 'Can pets be included?', json_object('type', 'text', 'text', 'Yes at both sites. At Mornington Green, pets can be added to a family tree alongside loved ones. At Wellington Dam, pet ashes and pet memorials can be placed with any tree, and a free pet ashes infusion is currently offered with new Legacy Trees.

To discuss the options, families can [schedule a call with the Mornington Green team](https://morningtongreen.com.au/talk-to-a-legacy-planner-form/) or [schedule a call with the Wellington Dam team](https://livinglegacywellingtondam.org.au/schedule-a-call/).'), (SELECT `id` FROM `faq_groups` WHERE lower(`name`) = lower('Family and sharing options') LIMIT 1), '[]', 28, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Can pets be included?') AND `deleted_at` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J7N28VHQGMRVGHN3K', 'How much does a Living Legacy tree cost?', json_object('type', 'text', 'text', 'Living Legacy trees start from $7,000 including GST. There are no hidden fees or inflation costs. Price ranges can vary based on different factors such as the size and type of the tree, location, quantity of ashes infused into the tree, inclusions and more.'), NULL, '["home"]', 29, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('How much does a Living Legacy tree cost?') AND `deleted_at` IS NULL AND `group_id` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JJQ07VRSH55V6QN82', 'What happens if the tree dies?', json_object('type', 'text', 'text', 'Our Living Legacy was carefully chosen for its excellent conditions and low risk for fire, flood and drought. If a tree does die, it is replaced by us at our cost. We use mulch where possible to pass on the energy from the tree.'), NULL, '["home"]', 30, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('What happens if the tree dies?') AND `deleted_at` IS NULL AND `group_id` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J1Q9N78WY937V71EJ', 'I have pet ashes. Can my fur babies have a memorial in the forest?', json_object('type', 'text', 'text', 'Yes, our families love that their pets'' ashes and memorial can be placed with their tree.'), NULL, '["home"]', 31, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('I have pet ashes. Can my fur babies have a memorial in the forest?') AND `deleted_at` IS NULL AND `group_id` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5J7ES9ME7FKFWSTX9A', 'Are the trees protected?', json_object('type', 'text', 'text', 'Living Legacy has a council permit, a conservation and heritage covenant, and a member review committee. Customers are also protected under Australian Consumer Law. In addition, 20% of the tree sales fund a trust, dedicated to ongoing tree care and maintenance.'), NULL, '["home"]', 32, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('Are the trees protected?') AND `deleted_at` IS NULL AND `group_id` IS NULL);
--> statement-breakpoint
INSERT INTO `faqs` (`id`, `question`, `answer`, `group_id`, `tags`, `sort_order`, `status`, `published_at`, `created_at`, `updated_at`)
SELECT '01M6G7WK5JEZWA8N110SG388DM', 'I have kept the ashes of a loved one in an urn, can I still create a Legacy Tree for them?', json_object('type', 'text', 'text', 'While cremation methods have changed over time, ashes do not have a used-by date. The Living Legacy procedure has been proven to work with cremated ashes dating back to the 1960s.'), NULL, '["home"]', 33, 'published', 1793693994161, 1793693994161, 1793693994161
WHERE NOT EXISTS (SELECT 1 FROM `faqs` WHERE lower(`question`) = lower('I have kept the ashes of a loved one in an urn, can I still create a Legacy Tree for them?') AND `deleted_at` IS NULL AND `group_id` IS NULL);
