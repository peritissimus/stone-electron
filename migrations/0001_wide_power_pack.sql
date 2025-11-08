CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`folder_path` text NOT NULL,
	`is_active` integer DEFAULT false,
	`created_at` integer NOT NULL,
	`last_accessed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_folder_path_unique` ON `workspaces` (`folder_path`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT 'Untitled',
	`content` text,
	`file_path` text,
	`notebook_id` text,
	`workspace_id` text,
	`is_favorite` integer DEFAULT false,
	`is_pinned` integer DEFAULT false,
	`is_archived` integer DEFAULT false,
	`is_deleted` integer DEFAULT false,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_notes`("id", "title", "content", "file_path", "notebook_id", "workspace_id", "is_favorite", "is_pinned", "is_archived", "is_deleted", "deleted_at", "created_at", "updated_at") SELECT "id", "title", "content", NULL, "notebook_id", NULL, "is_favorite", "is_pinned", "is_archived", "is_deleted", "deleted_at", "created_at", "updated_at" FROM `notes`;--> statement-breakpoint
DROP TABLE `notes`;--> statement-breakpoint
ALTER TABLE `__new_notes` RENAME TO `notes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `notebooks` ADD `workspace_id` text REFERENCES workspaces(id);--> statement-breakpoint
ALTER TABLE `notebooks` ADD `folder_path` text;