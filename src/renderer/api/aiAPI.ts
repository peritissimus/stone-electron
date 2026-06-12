/**
 * AI API - IPC wrappers for LLM-assisted PKM actions.
 *
 * Thin renderer boundary only. Components must access this through hooks/stores.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { AI_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  AskNotesResponse,
  CitationSource,
  IpcResponse,
  SuggestLinksResponse,
  SummarizeNoteResponse,
} from '@shared/types';
import { validateResponse } from './validation';

// Backwards-compatible DTO aliases — wire shapes now live in @shared/types.
export type CitationSourceDTO = CitationSource;
export type AskNotesResponseDTO = AskNotesResponse;
export type SummarizeNoteResponseDTO = SummarizeNoteResponse;
export type SuggestLinksResponseDTO = SuggestLinksResponse;

const CitationSourceSchema = z.object({
  chunkId: z.string(),
  noteId: z.string(),
  title: z.string(),
  headingPath: z.array(z.string()).optional(),
  excerpt: z.string(),
});

const AskNotesResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(CitationSourceSchema),
});

const SummarizeNoteResponseSchema = z.object({
  summary: z.string(),
  sources: z.array(CitationSourceSchema),
});

const SuggestLinksResponseSchema = z.object({
  links: z.array(
    z.object({
      noteId: z.string(),
      title: z.string(),
      reason: z.string(),
      score: z.number(),
    }),
  ),
});

export const aiAPI = {
  askNotes: async (params: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<IpcResponse<AskNotesResponseDTO>> => {
    const response = await invokeIpc(AI_CHANNELS.ASK_NOTES, params);
    return validateResponse(response, AskNotesResponseSchema);
  },

  summarizeNote: async (noteId: string): Promise<IpcResponse<SummarizeNoteResponseDTO>> => {
    const response = await invokeIpc(AI_CHANNELS.SUMMARIZE_NOTE, { noteId });
    return validateResponse(response, SummarizeNoteResponseSchema);
  },

  suggestLinks: async (
    noteId: string,
    limit?: number,
  ): Promise<IpcResponse<SuggestLinksResponseDTO>> => {
    const response = await invokeIpc(AI_CHANNELS.SUGGEST_LINKS, { noteId, limit });
    return validateResponse(response, SuggestLinksResponseSchema);
  },

  /**
   * Pre-download/load the Whisper model so first transcription is instant.
   * Idempotent; resolves when the model is ready (or failed: ready=false).
   */
  warmTranscriber: async (): Promise<IpcResponse<{ ready: boolean }>> => {
    const response = await invokeIpc(AI_CHANNELS.WARM_TRANSCRIBER, {});
    return validateResponse(response, z.object({ ready: z.boolean() }));
  },
};
