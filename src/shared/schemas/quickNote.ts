/**
 * Quick Note (slot-based) IPC wire schemas.
 *
 * Consumed by:
 *   - main `adapters/in/ipc/QuickNoteIPC.ts`
 *   - renderer `api/quickNoteAPI.ts`
 */

import { z } from 'zod';

export const QuickNoteSlotSchema = z.enum(['personal', 'work']);
export type QuickNoteSlot = z.infer<typeof QuickNoteSlotSchema>;

export const CreateQuickNoteRequestSchema = z
  .object({
    slot: QuickNoteSlotSchema,
    title: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict();

export const CreateQuickNoteResponseSchema = z.object({
  noteId: z.string(),
});

export type CreateQuickNoteResponse = z.infer<typeof CreateQuickNoteResponseSchema>;
