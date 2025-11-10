CREATE INDEX `idx_attachments_note_id` ON `attachments` (`note_id`);--> statement-breakpoint
CREATE INDEX `idx_note_tags_note_id` ON `note_tags` (`note_id`);--> statement-breakpoint
CREATE INDEX `idx_note_tags_tag_id` ON `note_tags` (`tag_id`);--> statement-breakpoint
CREATE INDEX `idx_note_tags_composite` ON `note_tags` (`tag_id`,`note_id`);--> statement-breakpoint
CREATE INDEX `idx_notebooks_workspace_id` ON `notebooks` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_notebooks_folder_path` ON `notebooks` (`folder_path`);--> statement-breakpoint
CREATE INDEX `idx_notebooks_parent_id` ON `notebooks` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_workspace_id` ON `notes` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_notebook_id` ON `notes` (`notebook_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_file_path` ON `notes` (`file_path`);--> statement-breakpoint
CREATE INDEX `idx_notes_flags` ON `notes` (`is_favorite`,`is_pinned`,`is_archived`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_notes_updated_at` ON `notes` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_notes_created_at` ON `notes` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notes_deleted` ON `notes` (`is_deleted`);