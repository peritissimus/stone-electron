/** Shared request schemas for feature IPC adapters. */
import { z } from './schema';

const OptionalWorkspaceSchema = {
  workspaceId: z.string().optional(),
};
const ArrayBufferSchema = z
  .unknown()
  .refine((value) => value instanceof ArrayBuffer, 'Expected ArrayBuffer') as z.ZodType<ArrayBuffer>;

export const AskNotesRequestSchema = z
  .object({ query: z.string(), ...OptionalWorkspaceSchema, limit: z.number().int().positive().optional() })
  .strict();
export const NoteIdRequestSchema = z.object({ noteId: z.string() }).strict();
export const NoteIdWithLimitRequestSchema = z
  .object({ noteId: z.string(), limit: z.number().int().positive().optional(), ...OptionalWorkspaceSchema })
  .strict();

export const IndexStatsRequestSchema = z.object(OptionalWorkspaceSchema).strict();
export const IndexNoteRequestSchema = z
  .object({ noteId: z.string(), force: z.boolean().optional() })
  .strict();
export const RebuildIndexRequestSchema = z
  .object({ ...OptionalWorkspaceSchema, force: z.boolean().optional() })
  .strict();

export const ListTemplatesRequestSchema = z.object(OptionalWorkspaceSchema).strict();
export const CreateNoteFromTemplateRequestSchema = z
  .object({
    templateId: z.string(),
    promptAnswers: z.record(z.string()).optional(),
    ...OptionalWorkspaceSchema,
    destinationFolder: z.string().optional(),
  })
  .strict();

export const TextSearchRequestSchema = z
  .object({
    query: z.string(),
    ...OptionalWorkspaceSchema,
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict();
export const HybridSearchRequestSchema = z
  .object({
    query: z.string(),
    weights: z.object({ fts: z.number(), semantic: z.number() }).strict().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    ...OptionalWorkspaceSchema,
    notebookId: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
  })
  .strict();
export const SearchByTagsRequestSchema = z
  .object({
    tagIds: z.array(z.string()).optional(),
    tagId: z.string().optional(),
    matchAll: z.boolean().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.tagId || value.tagIds?.length), 'A tag is required')
  .transform(({ tagId, tagIds, ...rest }) => ({
    ...rest,
    tagIds: tagIds ?? [tagId as string],
  }));
const WireDateSchema = z.union([z.number(), z.string()]).transform((value) =>
  typeof value === 'number' ? value : Date.parse(value),
);
export const SearchByDateRangeRequestSchema = z
  .object({
    startDate: WireDateSchema,
    endDate: WireDateSchema,
    ...OptionalWorkspaceSchema,
    field: z.literalEnum(['created', 'updated']).optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict();

export const AddAttachmentRequestSchema = z
  .object({ noteId: z.string(), filePath: z.string(), filename: z.string().optional() })
  .strict();
export const DeleteAttachmentRequestSchema = z
  .object({ id: z.string(), deleteFile: z.boolean().optional() })
  .strict();
export const GetAttachmentsRequestSchema = z.object({ noteId: z.string() }).strict();
export const UploadImageRequestSchema = z
  .object({
    noteId: z.string(),
    imageData: z.string(),
    filename: z.string(),
    mimeType: z.string().optional(),
  })
  .strict();

export const GitWorkspaceIdRequestSchema = z.object({ workspaceId: z.string() }).strict();
export const GitMessageRequestSchema = z
  .object({ workspaceId: z.string(), message: z.string().optional() })
  .strict();
export const SetGitRemoteRequestSchema = z
  .object({ workspaceId: z.string(), url: z.string() })
  .strict();
export const GetGitCommitsRequestSchema = z
  .object({ workspaceId: z.string(), limit: z.number().int().positive().optional() })
  .strict();

export const UpdateTaskStateRequestSchema = z
  .object({
    noteId: z.string(),
    taskIndex: z.number().int().nonnegative(),
    newState: z.literalEnum(['todo', 'doing', 'done', 'waiting', 'hold', 'canceled', 'idea']),
  })
  .strict();
export const ToggleTaskRequestSchema = z
  .object({ noteId: z.string(), taskIndex: z.number().int().nonnegative() })
  .strict();

export const ReserveRecordingRequestSchema = z
  .object({ ...OptionalWorkspaceSchema, title: z.string().optional() })
  .strict();
export const AppendRecordingAudioRequestSchema = z
  .object({
    recordingId: z.string(),
    chunk: ArrayBufferSchema,
    channel: z.literalEnum(['mic', 'system']).optional(),
  })
  .strict();
export const FinalizeRecordingRequestSchema = z
  .object({ recordingId: z.string(), durationMs: z.number().nonnegative().optional() })
  .strict();
export const ListMeetingsRequestSchema = z
  .object({
    ...OptionalWorkspaceSchema,
    limit: z.number().int().positive().optional(),
    cursor: z.number().optional(),
  })
  .strict();
export const RecordingIdRequestSchema = z.object({ recordingId: z.string() }).strict();
export const ResummarizeMeetingRequestSchema = z
  .object({ recordingId: z.string(), promptTemplate: z.string().optional() })
  .strict();
export const LiveChunkRequestSchema = z.object({ wav: ArrayBufferSchema }).strict();
export const SendMeetingToJournalRequestSchema = z
  .object({ recordingId: z.string(), journalDate: z.string().optional() })
  .strict();
