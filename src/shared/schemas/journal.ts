/**
 * Journal IPC wire schemas.
 *
 * Consumed by:
 *   - main `adapters/in/ipc/JournalIPC.ts`
 *   - renderer `api/journalAPI.ts`
 */

import { z } from 'zod';

export const OpenOrCreateJournalRequestSchema = z
  .object({
    date: z.string(),
    workspaceId: z.string().optional(),
  })
  .strict();

export const OpenOrCreateJournalResponseSchema = z.object({
  noteId: z.string(),
  created: z.boolean(),
});

export type OpenOrCreateJournalResponse = z.infer<typeof OpenOrCreateJournalResponseSchema>;
