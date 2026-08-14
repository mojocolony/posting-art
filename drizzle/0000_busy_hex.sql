CREATE TABLE `posting_records` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`format` text NOT NULL,
	`created_at` text NOT NULL,
	`thumbnail_key` text NOT NULL,
	`instagram_at` text,
	`facebook_at` text
);
