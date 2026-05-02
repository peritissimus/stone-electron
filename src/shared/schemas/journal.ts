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

export const ListJournalRangeRequestSchema = z
  .object({
    /** Number of recent days to include (going back from today). */
    limit: z.number().int().min(1).max(31).default(7),
    workspaceId: z.string().optional(),
  })
  .strict();

export const JournalEntrySchema = z.object({
  date: z.string(),
  noteId: z.string().nullable(),
  exists: z.boolean(),
  content: z.string().nullable(),
});

export const ListJournalRangeResponseSchema = z.object({
  entries: z.array(JournalEntrySchema),
});

export type OpenOrCreateJournalResponse = z.infer<typeof OpenOrCreateJournalResponseSchema>;
export type ListJournalRangeRequest = z.infer<typeof ListJournalRangeRequestSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type ListJournalRangeResponse = z.infer<typeof ListJournalRangeResponseSchema>;
