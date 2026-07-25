/** Topic command/query payloads decoded at the main-process IPC edge. */
import { z } from './schema';

export const TopicSemanticSearchRequestSchema = z
  .object({ query: z.string(), limit: z.number().int().positive().optional() })
  .strict();
