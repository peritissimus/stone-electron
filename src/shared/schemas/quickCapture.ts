/**
 * Quick Capture IPC wire schemas.
 *
 * Consumed by:
 *   - main `adapters/in/ipc/QuickCaptureIPC.ts`
 *   - renderer `api/quickCaptureAPI.ts`
 */

import { z } from 'zod';

export const AppendToJournalRequestSchema = z
  .object({
    // Renderer sends `text`; legacy callers may send `content`. Accept either.
    text: z.string().optional(),
    content: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .passthrough();

export const AppendToJournalResponseSchema = z.object({
  noteId: z.string(),
  appended: z.boolean(),
});

export type AppendToJournalResponse = z.infer<typeof AppendToJournalResponseSchema>;
