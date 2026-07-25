/** Shared response schemas for AI, meetings, search, templates, topics, and indexing. */
import { z } from './schema';

export const CitationSourceSchema = z.object({
  chunkId: z.string(),
  noteId: z.string(),
  title: z.string(),
  headingPath: z.array(z.string()).optional(),
  excerpt: z.string(),
});
export const AskNotesResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(CitationSourceSchema),
});
export const SummarizeNoteResponseSchema = z.object({
  summary: z.string(),
  sources: z.array(CitationSourceSchema),
});
export const SuggestLinksResponseSchema = z.object({
  links: z.array(
    z.object({
      noteId: z.string(),
      title: z.string(),
      reason: z.string(),
      score: z.number(),
    }),
  ),
});
export const AIWarmupResponseSchema = z.object({ ready: z.boolean() });

export const MeetingRecordingStatusSchema = z.literalEnum([
  'recording',
  'transcribing',
  'summarizing',
  'ready',
  'failed',
]);
export const MeetingTranscriptSegmentSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  source: z.literalEnum(['mic', 'system']).optional(),
});
const DateLikeSchema = z
  .union([z.date(), z.string(), z.number()])
  .transform((value) => new Date(value));
export const MeetingRecordingSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  status: MeetingRecordingStatusSchema,
  audioPath: z.string().nullable(),
  durationMs: z.number(),
  transcriptText: z.string().nullable(),
  transcriptSegments: z.array(MeetingTranscriptSegmentSchema),
  summary: z.string().nullable(),
  promptUsed: z.string().nullable(),
  journalDate: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: DateLikeSchema,
  updatedAt: DateLikeSchema,
});
export const RecordingSlotSchema = z.object({
  recordingId: z.string(),
  audioAbsolutePath: z.string(),
  systemAudio: z.boolean().optional(),
});
export const ListMeetingsResponseSchema = z.object({
  recordings: z.array(MeetingRecordingSchema),
  nextCursor: z.number().nullable(),
});
export const FinalizeMeetingResponseSchema = z.object({ jobId: z.string() });
export const MeetingRecordingResponseSchema = z.object({ recording: MeetingRecordingSchema });
export const GetMeetingResponseSchema = z.object({ recording: MeetingRecordingSchema.nullable() });
export const SendMeetingToJournalResponseSchema = z.object({
  recording: MeetingRecordingSchema,
  journalNoteId: z.string(),
});

export const RelatedNotesResponseSchema = z.object({
  results: z.array(
    z.object({
      noteId: z.string(),
      title: z.string(),
      similarity: z.number(),
      matchedChunks: z.number(),
      bestChunk: z.object({
        chunkId: z.string(),
        headingPath: z.array(z.string()),
        excerpt: z.string(),
      }),
    }),
  ),
});

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  body: z.string(),
  prompts: z.array(z.string()),
});
export const ListTemplatesResponseSchema = z.object({ templates: z.array(TemplateSchema) });
export const CreateFromTemplateResponseSchema = z.object({
  noteId: z.string(),
  cursorOffset: z.number().nullable(),
});

export const IndexStatsSchema = z.object({
  workspaceId: z.string(),
  totalNotes: z.number(),
  indexedNotes: z.number(),
  pendingNotes: z.number(),
  failedNotes: z.number(),
  chunkCount: z.number(),
});
export const IndexNoteResultSchema = z.object({
  noteId: z.string(),
  status: z.literalEnum(['indexed', 'skipped', 'failed', 'missing']),
  chunkCount: z.number(),
  error: z.string().optional(),
});
export const RebuildAllIndexResultSchema = z.object({
  workspaceId: z.string(),
  total: z.number(),
  indexed: z.number(),
  skipped: z.number(),
  failed: z.number(),
  missing: z.number(),
});
