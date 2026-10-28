-- Sample content for local development only: `bun run db:seed:local`.
-- Fixed "seed_" IDs make it safe to run more than once. Dates are relative to
-- now so the dashboard charts always have recent activity.

INSERT OR REPLACE INTO team_members (id, name, role, sort_order, status, published_at, created_at, updated_at)
VALUES ('seed_team_1', 'Forest team', 'Editorial', 0, 'published', 0,
  unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT OR REPLACE INTO terms (id, type, name, slug, created_at, updated_at) VALUES
  ('seed_cat_guides', 'category', 'Guides', 'guides', unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed_cat_forests', 'category', 'Our forests', 'our-forests', unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed_cat_stories', 'category', 'Stories', 'stories', unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT OR REPLACE INTO posts (id, title, slug, excerpt, body, author_id, status, published_at, created_at, updated_at) VALUES
  ('seed_post_1', 'What happens at a tree planting ceremony', 'tree-planting-ceremony', 'A gentle walk through the day.', '{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Planting day is quiet and unhurried. Families gather at the forest entrance, walk together to the chosen spot and plant the tree side by side."}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Before you arrive"}]}, {"type": "bulletList", "content": [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Wear comfortable shoes for uneven ground"}]}]}, {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Bring anything you would like to place with the tree"}]}]}]}, {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "On the day"}]}, {"type": "paragraph", "content": [{"type": "text", "text": "Our team prepares the site and the "}, {"type": "text", "marks": [{"type": "bold"}], "text": "Living Legacy Formula"}, {"type": "text", "text": " so the tree gets the best possible start."}]}, {"type": "blockquote", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "It felt like we were giving something back."}]}]}]}', 'seed_team_1', 'published',
    (unixepoch('now') - 3 * 86400) * 1000, (unixepoch('now') - 4 * 86400) * 1000, (unixepoch('now') - 3 * 86400) * 1000),
  ('seed_post_2', 'Choosing a native tree for your loved one', 'choosing-a-native-tree', 'How families choose a species.', NULL, 'seed_team_1', 'published',
    (unixepoch('now') - 9 * 86400) * 1000, (unixepoch('now') - 10 * 86400) * 1000, (unixepoch('now') - 9 * 86400) * 1000),
  ('seed_post_3', 'How the Living Legacy Formula works', 'living-legacy-formula', 'The science behind the formula.', NULL, 'seed_team_1', 'published',
    (unixepoch('now') - 16 * 86400) * 1000, (unixepoch('now') - 18 * 86400) * 1000, (unixepoch('now') - 16 * 86400) * 1000),
  ('seed_post_4', 'Visiting the forest through the seasons', 'forest-through-the-seasons', 'What to expect each season.', NULL, 'seed_team_1', 'published',
    (unixepoch('now') - 24 * 86400) * 1000, (unixepoch('now') - 25 * 86400) * 1000, (unixepoch('now') - 24 * 86400) * 1000),
  ('seed_post_5', 'Planning a memorial with your family', 'planning-a-memorial', 'Steps to plan together.', NULL, 'seed_team_1', 'published',
    (unixepoch('now') - 41 * 86400) * 1000, (unixepoch('now') - 42 * 86400) * 1000, (unixepoch('now') - 41 * 86400) * 1000),
  ('seed_post_6', 'Why memorial forests matter for conservation', 'memorial-forests-and-conservation', 'Restoring habitat, tree by tree.', NULL, 'seed_team_1', 'published',
    (unixepoch('now') - 67 * 86400) * 1000, (unixepoch('now') - 68 * 86400) * 1000, (unixepoch('now') - 67 * 86400) * 1000),
  ('seed_post_7', 'A guide to writing a tree plaque', 'writing-a-tree-plaque', NULL, NULL, 'seed_team_1', 'draft',
    NULL, (unixepoch('now') - 2 * 86400) * 1000, (unixepoch('now') - 5 * 3600) * 1000),
  ('seed_post_8', 'Questions families ask us most', 'questions-families-ask', NULL, NULL, 'seed_team_1', 'draft',
    NULL, (unixepoch('now') - 6 * 86400) * 1000, (unixepoch('now') - 2 * 86400) * 1000);

INSERT OR REPLACE INTO post_terms (post_id, term_id) VALUES
  ('seed_post_1', 'seed_cat_guides'),
  ('seed_post_2', 'seed_cat_guides'),
  ('seed_post_3', 'seed_cat_forests'),
  ('seed_post_4', 'seed_cat_forests'),
  ('seed_post_5', 'seed_cat_guides'),
  ('seed_post_6', 'seed_cat_stories');

INSERT OR REPLACE INTO media (id, r2_key, filename, mime, size, width, height, alt, created_at, updated_at) VALUES
  ('seed_media_1', 'seed/forest-canopy.jpg', 'forest-canopy.jpg', 'image/jpeg', 2457600, 2400, 1600, 'Sunlight through the forest canopy', unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed_media_2', 'seed/planting-day.jpg', 'planting-day.jpg', 'image/jpeg', 1843200, 2400, 1600, 'A family planting a young tree', unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed_media_3', 'seed/brochure.pdf', 'brochure.pdf', 'application/pdf', 524288, NULL, NULL, NULL, unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT OR REPLACE INTO faq_groups (id, name, sort_order, created_at, updated_at)
VALUES ('seed_faq_group', 'General', 0, unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT OR REPLACE INTO faqs (id, question, group_id, sort_order, status, published_at, created_at, updated_at) VALUES
  ('seed_faq_1', 'Can we visit the tree after the ceremony?', 'seed_faq_group', 0, 'published', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed_faq_2', 'Which trees can we choose from?', 'seed_faq_group', 1, 'published', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed_faq_3', 'How long does the tree take to grow?', 'seed_faq_group', 2, 'published', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000);

-- A fictional second editor and publish history, so the activity feed in the
-- header has something to show. This account cannot sign in.
INSERT OR REPLACE INTO user (id, name, email, email_verified, role, created_at, updated_at)
VALUES ('seed_user_editor', 'Sample Editor', 'sample.editor@example.com', 1, 'editor',
  unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT OR REPLACE INTO revisions (id, entity_type, entity_id, snapshot, created_by, created_at) VALUES
  ('seed_rev_1', 'post', 'seed_post_4', '{"title": "Visiting the forest through the seasons", "slug": "forest-through-the-seasons", "excerpt": "What to expect each season.", "body": null, "authorId": "seed_team_1", "categoryIds": ["seed_cat_forests"], "tags": [], "seoTitle": "", "seoDescription": "", "noindex": false}', 'seed_user_editor', (unixepoch('now') - 24 * 86400) * 1000),
  ('seed_rev_2', 'post', 'seed_post_3', '{"title": "How the Living Legacy Formula works", "slug": "living-legacy-formula", "excerpt": "The science behind the formula.", "body": null, "authorId": "seed_team_1", "categoryIds": ["seed_cat_forests"], "tags": [], "seoTitle": "", "seoDescription": "", "noindex": false}', 'seed_user_editor', (unixepoch('now') - 16 * 86400) * 1000),
  ('seed_rev_3', 'post', 'seed_post_2', '{"title": "Choosing a native tree for your loved one", "slug": "choosing-a-native-tree", "excerpt": "How families choose a species.", "body": null, "authorId": "seed_team_1", "categoryIds": ["seed_cat_guides"], "tags": [], "seoTitle": "", "seoDescription": "", "noindex": false}', 'seed_user_editor', (unixepoch('now') - 9 * 86400) * 1000),
  ('seed_rev_4', 'post', 'seed_post_1', '{"title": "What happens at a tree planting ceremony", "slug": "tree-planting-ceremony", "excerpt": "A gentle walk through the day.", "body": null, "authorId": "seed_team_1", "categoryIds": ["seed_cat_guides"], "tags": [], "seoTitle": "", "seoDescription": "", "noindex": false}', 'seed_user_editor', (unixepoch('now') - 3 * 86400) * 1000),
  ('seed_rev_5', 'post', 'seed_post_1', '{"title": "What happens at a tree planting ceremony", "slug": "tree-planting-ceremony", "excerpt": "A gentle walk through the day.", "body": null, "authorId": "seed_team_1", "categoryIds": ["seed_cat_guides"], "tags": [], "seoTitle": "", "seoDescription": "", "noindex": false}', 'seed_user_editor', (unixepoch('now') - 2 * 3600) * 1000);
