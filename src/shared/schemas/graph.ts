/**
 * Graph (note-link) IPC wire schemas.
 *
 * NOTE: GraphIPC is intentionally NOT migrated to these schemas on the
 * main side. The backend currently returns NoteLink[] (source/target/
 * linkText) from getBacklinks/getForwardLinks, but the renderer
 * (BacklinksPanel) consumes the response as Note[] (`note.id`,
 * `note.title`, etc.). Aligning the wire schema to backend reality
 * breaks the renderer UI; aligning to the renderer's expectation
 * breaks validation. These schemas reflect the RENDERER'S EXPECTATION —
 * so the contract here is "what the UI needs", not "what the backend
 * actually ships today". Both sides will drift until the backend is
 * extended to resolve NoteLink -> Note before returning.
 *
 * Consumed by:
 *   - renderer `api/noteAPI.ts` (response validation)
 */

import { z } from 'zod';
import { NoteSchema } from './notes';

// ============================================================================
// Request payloads
// ============================================================================

export const GetLinksRequestSchema = z
  .object({
    id: z.string(),
  })
  .strict();

export const GetGraphDataRequestSchema = z
  .object({
    centerNoteId: z.string().optional(),
    depth: z.number().optional(),
    includeOrphans: z.boolean().optional(),
  })
  .passthrough();

// ============================================================================
// Response shapes (renderer-expected; see note above)
// ============================================================================

export const GetLinksResponseSchema = z.object({
  notes: z.array(NoteSchema),
});

export type GetLinksResponse = z.infer<typeof GetLinksResponseSchema>;

export const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['note', 'notebook', 'tag', 'topic']),
  metadata: z.record(z.unknown()).optional(),
});

export const GraphLinkSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(['link', 'reference', 'tag', 'topic', 'parent']),
  weight: z.number().optional(),
});

export const GraphDataSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  links: z.array(GraphLinkSchema),
});

export type GraphDataResponse = z.infer<typeof GraphDataSchema>;
