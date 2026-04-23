/**
 * Scratch Editor IPC wire schemas.
 *
 * Scratch mode opens an arbitrary .md file on disk, edits it, and saves
 * back to the same absolute path — with no DB entry, workspace, or
 * noteRepository involvement. Consumed by:
 *   - main `adapters/in/ipc/ScratchIPC.ts`
 *   - renderer `api/scratchAPI.ts`
 */

import { z } from 'zod';

export const ScratchPickResponseSchema = z.object({
  path: z.string().nullable(),
});
export type ScratchPickResponse = z.infer<typeof ScratchPickResponseSchema>;

export const ScratchReadRequestSchema = z.object({
  path: z.string().min(1),
});
export type ScratchReadRequest = z.infer<typeof ScratchReadRequestSchema>;

export const ScratchReadResponseSchema = z.object({
  path: z.string(),
  name: z.string(),
  content: z.string(),
});
export type ScratchReadResponse = z.infer<typeof ScratchReadResponseSchema>;

export const ScratchWriteRequestSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});
export type ScratchWriteRequest = z.infer<typeof ScratchWriteRequestSchema>;

export const ScratchWriteResponseSchema = z.object({
  path: z.string(),
});
export type ScratchWriteResponse = z.infer<typeof ScratchWriteResponseSchema>;
