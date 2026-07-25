/** Topic command/query payloads decoded at the main-process IPC edge. */
import { z } from './schema';

export const TopicIdRequestSchema = z.object({ id: z.string() }).strict();
export const CreateTopicRequestSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
  })
  .strict();
export const UpdateTopicRequestSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    color: z.string().optional(),
  })
  .strict();
export const TopicNotePairRequestSchema = z
  .object({ noteId: z.string(), topicId: z.string() })
  .strict();
export const ClassifyNoteRequestSchema = z
  .object({ noteId: z.string(), force: z.boolean().optional() })
  .strict();
export const ClassifyAllRequestSchema = z
  .object({ force: z.boolean().optional(), excludeJournal: z.boolean().optional() })
  .strict();
export const ReclassifyAllRequestSchema = z
  .object({ excludeJournal: z.boolean().optional() })
  .strict();
export const TopicSemanticSearchRequestSchema = z
  .object({ query: z.string(), limit: z.number().int().positive().optional() })
  .strict();
export const SuggestTopicsRequestSchema = z
  .object({ workspaceId: z.string().optional() })
  .strict();
export const AdoptSuggestedTopicRequestSchema = z
  .object({
    name: z.string(),
    color: z.string().optional(),
    noteIds: z.array(z.string()),
  })
  .strict();
export const NotesByTopicRequestSchema = z
  .object({
    topicId: z.string(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().nonnegative().optional(),
    excludeJournal: z.boolean().optional(),
  })
  .strict();
