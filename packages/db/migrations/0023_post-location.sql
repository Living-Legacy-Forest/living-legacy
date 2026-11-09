ALTER TABLE `posts` ADD `location_id` text REFERENCES locations(id) ON DELETE set null;
