/**
 * Note IPC wire schemas.
 *
 * Single source of truth for the wire shape of note:* channels.
 * Consumed by:
 *   - main `adapters/in/ipc/NoteIPC.ts` (request .parse() + response return types)
 *   - renderer `api/noteAPI.ts` (response validation)
 *
 * Date fields use a permissive union (string | Date | number) because
 * Electron IPC preserves Date objects within the process boundary but
 * JSON round-trips strip them to strings. Don't tighten this without
 * also aligning serialization.
 */

import { z } from 'zod';

const IsoOrDate = z.union([z.string(), z.date(), z.number()]);

// ============================================================================
// Response shapes (entity DTOs)
// ============================================================================

export const NoteSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  filePath: z.string().nullable(),
  notebookId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  isPinned: z.boolean().nullable(),
  isFavorite: z.boolean().nullable(),
  isArchived: z.boolean().nullable(),
  isDeleted: z.boolean().nullable(),
  deletedAt: IsoOrDate.nullable(),
  embedding: z.unknown().nullable(),
  createdAt: IsoOrDate,
  updatedAt: IsoOrDate,
});

export const NoteWithMetaSchema = NoteSchema.extend({
  tags: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        color: z.string().nullable(),
      }),
    )
    .optional(),
  topics: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        color: z.string().nullable(),
        confidence: z.number(),
      }),
    )
    .optional(),
  // Some paths in the API return `path` instead of `filePath` for
  // backwards compatibility; keep both tolerated.
  path: z.string().optional(),
});

export type NoteResponse = z.infer<typeof NoteSchema>;
export type NoteWithMetaResponse = z.infer<typeof NoteWithMetaSchema>;

// ============================================================================
// Request payloads
// ============================================================================

export const CreateNoteRequestSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    content: z.string().optional(),
    folderPath: z.string().optional(),
    notebookId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict();

export const GetNoteRequestSchema = z
  .object({
    id: z.string(),
  })
  .strict();

export const GetNoteContentRequestSchema = GetNoteRequestSchema;

export const UpdateNoteRequestSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    content: z.string().optional(),
    notebookId: z.string().optional(),
    // Renderer passes a `silent` flag on autosave; accepted but unused by
    // the current use case. Kept for wire-compat.
    silent: z.boolean().optional(),
  })
  .strict();

export const DeleteNoteRequestSchema = z
  .object({
    id: z.string(),
    permanent: z.boolean().optional(),
  })
  .strict();

export const GetAllNotesRequestSchema = z
  .object({
    notebookId: z.string().optional(),
    workspaceId: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
    isArchived: z.boolean().optional(),
    isDeleted: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough();

export const MoveNoteRequestSchema = z
  .object({
    id: z.string(),
    targetPath: z.string().optional(),
    targetNotebookId: z.string().nullable().optional(),
  })
  .strict();

export const GetNoteByPathRequestSchema = z
  .object({
    // Either `path` or `filePath` is accepted for historical reasons.
    path: z.string().optional(),
    filePath: z.string().optional(),
  })
  .refine((v) => typeof v.path === 'string' || typeof v.filePath === 'string', {
    message: 'Either "path" or "filePath" is required',
  });

export const ToggleFlagRequestSchema = z
  .object({
    id: z.string(),
    favorite: z.boolean().optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .passthrough();

// ============================================================================
// Response shapes for list endpoints
// ============================================================================

export const GetAllNotesResponseSchema = z.object({
  notes: z.array(NoteWithMetaSchema),
  total: z.number().optional(),
});

export const GetNoteContentResponseSchema = z.object({
  content: z.string(),
});

export type GetAllNotesResponse = z.infer<typeof GetAllNotesResponseSchema>;
export type GetNoteContentResponse = z.infer<typeof GetNoteContentResponseSchema>;
