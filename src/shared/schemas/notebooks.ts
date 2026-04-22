/**
 * Notebook IPC wire schemas.
 *
 * Single source of truth for the wire shape of notebook:* channels.
 * Consumed by:
 *   - main `adapters/in/ipc/NotebookIPC.ts` (request .parse() + response types)
 *   - renderer `api/notebookAPI.ts` (response validation)
 *
 * Wire payloads use snake_case field names where the renderer already does
 * (e.g. parent_id, delete_notes, include_counts); the IPC handler maps them
 * to the camelCase names the use case expects.
 */

import { z } from 'zod';

const IsoOrDate = z.union([z.string(), z.date(), z.number()]);

// ============================================================================
// Response shapes (entity DTOs)
// ============================================================================

export const NotebookSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  folderPath: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  position: z.number().nullable(),
  createdAt: IsoOrDate,
  updatedAt: IsoOrDate,
});

export type NotebookResponse = z.infer<typeof NotebookSchema>;

// Recursive tree: a notebook carries a count and optional children of the same
// shape. Typed as ZodType<any> because the cycle can't be inferred cleanly.
export const NotebookWithCountSchema: z.ZodType<any> = NotebookSchema.extend({
  note_count: z.number(),
  children: z.lazy(() => z.array(NotebookWithCountSchema)).optional(),
});

export const ListNotebooksResponseSchema = z.object({
  notebooks: z.array(NotebookWithCountSchema),
});

export type ListNotebooksResponse = z.infer<typeof ListNotebooksResponseSchema>;

// ============================================================================
// Request payloads
// ============================================================================

export const CreateNotebookRequestSchema = z
  .object({
    name: z.string(),
    parent_id: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .strict();

export const UpdateNotebookRequestSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
  })
  .strict();

export const DeleteNotebookRequestSchema = z
  .object({
    id: z.string(),
    delete_notes: z.boolean().optional(),
  })
  .strict();

export const ListNotebooksRequestSchema = z
  .object({
    include_counts: z.boolean().optional(),
    flat: z.boolean().optional(),
  })
  .passthrough();

export const MoveNotebookRequestSchema = z
  .object({
    id: z.string(),
    parent_id: z.string().optional(),
    position: z.number().optional(),
  })
  .strict();
