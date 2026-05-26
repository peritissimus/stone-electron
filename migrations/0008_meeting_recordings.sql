CREATE TABLE IF NOT EXISTS `meeting_recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'recording' NOT NULL,
	`audio_path` text,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`transcript_text` text,
	`transcript_segments` text DEFAULT '[]' NOT NULL,
	`summary` text,
	`prompt_used` text,
	`journal_date` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_meeting_recordings_workspace_id` ON `meeting_recordings` (`workspace_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_meeting_recordings_status` ON `meeting_recordings` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_meeting_recordings_created_at` ON `meeting_recordings` (`created_at`);
