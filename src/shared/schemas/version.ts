/**
 * Version (note history) IPC wire schemas.
 *
 * Consumed by:
 *   - main `adapters/in/ipc/VersionIPC.ts`
 *   - renderer `api/noteAPI.ts` (getVersions / restoreVersion)
 *
 * getVersion / createVersion are registered on the backend but have no
 * renderer wrapper; schemas exist for shape parity but are not exercised
 * from the UI today.
 */

import { z } from 'zod';

// ============================================================================
// Request payloads
// ============================================================================

export const GetVersionsRequestSchema = z
  .object({
    id: z.string().optional(),
    noteId: z.string().optional(),
  })
  .refine((v) => typeof v.id === 'string' || typeof v.noteId === 'string', {
    message: 'Either "id" or "noteId" is required',
  });

export const RestoreVersionRequestSchema = z
  .object({
    id: z.string(),
    versionId: z.string(),
  })
  .strict();

// ============================================================================
// Response shapes
// ============================================================================

// Versions endpoint returns an envelope + preview shape — content is
// deliberately elided to a preview so the list view isn't carrying full
// note bodies over IPC.
export const VersionSummarySchema = z.object({
  id: z.string(),
  noteId: z.string(),
  versionNumber: z.number(),
  title: z.string(),
  contentPreview: z.string(),
  createdAt: z.string(),
  sizeBytes: z.number(),
});

export const GetVersionsResponseSchema = z.object({
  versions: z.array(VersionSummarySchema),
});

export type GetVersionsResponse = z.infer<typeof GetVersionsResponseSchema>;

// getVersion / createVersion return the full version record including
// content; dates are serialized as ISO strings at the wire.
export const VersionDetailSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  versionNumber: z.number(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export type VersionDetailResponse = z.infer<typeof VersionDetailSchema>;
