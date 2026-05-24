CREATE TABLE IF NOT EXISTS `note_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`heading_path` text DEFAULT '[]' NOT NULL,
	`text` text NOT NULL,
	`content_hash` text NOT NULL,
	`token_count` integer DEFAULT 0 NOT NULL,
	`embedding` blob,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_note_chunks_note_id` ON `note_chunks` (`note_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_note_chunks_workspace_id` ON `note_chunks` (`workspace_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_note_chunks_content_hash` ON `note_chunks` (`content_hash`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `note_index_records` (
	`note_id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`chunk_count` integer DEFAULT 0 NOT NULL,
	`indexed_at` integer,
	`model` text,
	`dimensions` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_note_index_records_workspace_id` ON `note_index_records` (`workspace_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_note_index_records_status` ON `note_index_records` (`status`);--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `note_chunks_fts` USING fts5(
	chunk_id UNINDEXED,
	note_id UNINDEXED,
	workspace_id UNINDEXED,
	title,
	heading_path,
	text,
	tokenize='porter unicode61'
);
