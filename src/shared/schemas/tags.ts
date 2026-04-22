/**
 * Tag IPC wire schemas.
 *
 * Single source of truth for the wire shape of tags:* channels.
 * Consumed by:
 *   - main `adapters/in/ipc/TagIPC.ts` (request .parse() + response types)
 *   - renderer `api/tagAPI.ts` (response validation)
 */

import { z } from 'zod';

const IsoOrDate = z.union([z.string(), z.date(), z.number()]);

// ============================================================================
// Response shapes (entity DTOs)
// ============================================================================

export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: IsoOrDate,
  updatedAt: IsoOrDate,
});

export const TagWithCountSchema = TagSchema.extend({
  note_count: z.number(),
});

export type TagResponse = z.infer<typeof TagSchema>;

export const ListTagsResponseSchema = z.object({
  tags: z.array(TagWithCountSchema),
});

export type ListTagsResponse = z.infer<typeof ListTagsResponseSchema>;

// ============================================================================
// Request payloads
// ============================================================================

export const CreateTagRequestSchema = z
  .object({
    name: z.string(),
    color: z.string().optional(),
  })
  .strict();

export const DeleteTagRequestSchema = z
  .object({
    id: z.string(),
  })
  .strict();

export const ListTagsRequestSchema = z
  .object({
    sort: z.enum(['name', 'count', 'recent']).optional(),
  })
  .passthrough();

export const AddTagToNoteRequestSchema = z
  .object({
    noteId: z.string(),
    // Renderer sends `tagIds`; legacy callers may send `tagId`. Accept both;
    // at least one must be present.
    tagId: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
  })
  .refine((v) => typeof v.tagId === 'string' || (Array.isArray(v.tagIds) && v.tagIds.length > 0), {
    message: 'Either "tagId" or non-empty "tagIds" is required',
  });

export const RemoveTagFromNoteRequestSchema = z
  .object({
    noteId: z.string(),
    tagId: z.string(),
  })
  .strict();
