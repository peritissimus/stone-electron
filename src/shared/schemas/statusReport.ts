import { z } from './schema';

export const GenerateStatusReportRequestSchema = z.object({
  workspaceId: z.string().optional(),
  windowDays: z.number().int().positive().optional(),
  promptTemplate: z.string().optional(),
});

export const StatusReportResultSchema = z.object({
  windowStart: z.string(),
  windowEnd: z.string(),
  evidence: z.object({
    journalEntries: z.number(),
    meetings: z.number(),
    completedTasks: z.number(),
    modifiedNotes: z.number(),
  }),
  report: z.string(),
});

export type StatusReportResult = z.infer<typeof StatusReportResultSchema>;
