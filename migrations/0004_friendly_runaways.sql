CREATE TABLE IF NOT EXISTS `note_topics` (
	`note_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`confidence` real DEFAULT 1,
	`is_manual` integer DEFAULT false,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`note_id`, `topic_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_note_topics_note_id` ON `note_topics` (`note_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_note_topics_topic_id` ON `note_topics` (`topic_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#6366f1',
	`is_predefined` integer DEFAULT false,
	`centroid` blob,
	`note_count` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `topics_name_unique` ON `topics` (`name`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_topics_name` ON `topics` (`name`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_topics_is_predefined` ON `topics` (`is_predefined`);--> statement-breakpoint
ALTER TABLE `notes` ADD `embedding` blob;