import { z } from './schema';
import { NoteSchema, TodoItemSchema } from './notes';

const DateLike = z.union([z.date(), z.string(), z.number()]).transform((value) => new Date(value));

export const CalendarEventSchema = z.object({
  title: z.string(),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean(),
  calendar: z.string(),
  location: z.string().nullable(),
});
export const MailMessageSchema = z.object({
  subject: z.string(),
  sender: z.string(),
  receivedAt: z.string(),
});
export const LinearIssueSchema = z.object({
  identifier: z.string(),
  title: z.string(),
  state: z.string(),
  priority: z.number(),
  url: z.string(),
  dueDate: z.string().nullable(),
});
export const CalendarDescriptorSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
});
const IntegrationStatusSchema = z.literalEnum([
  'connected',
  'denied',
  'unavailable',
  'error',
]);
export const LoadDailyReviewIntegrationRequestSchema = z.object({
  source: z.literalEnum(['calendar', 'mail', 'linear']),
  date: z.string().optional(),
});
export const LoadDailyReviewIntegrationsRequestSchema = z.object({
  date: z.string().optional(),
});

export const DailyReviewIntegrationResultSchema = z.union([
  z.object({
    source: z.literalEnum(['calendar']),
    status: IntegrationStatusSchema,
    message: z.string().optional(),
    data: z.object({ events: z.array(CalendarEventSchema) }),
  }),
  z.object({
    source: z.literalEnum(['mail']),
    status: IntegrationStatusSchema,
    message: z.string().optional(),
    data: z.object({
      unreadCount: z.number(),
      messages: z.array(MailMessageSchema),
    }),
  }),
  z.object({
    source: z.literalEnum(['linear']),
    status: IntegrationStatusSchema,
    message: z.string().optional(),
    data: z.object({ issues: z.array(LinearIssueSchema) }),
  }),
]);
export const DailyReviewIntegrationsResultSchema = z.array(
  DailyReviewIntegrationResultSchema,
);

export const ListDailyReviewCalendarsResultSchema = z.object({
  status: IntegrationStatusSchema,
  calendars: z.array(CalendarDescriptorSchema),
  message: z.string().optional(),
});

export const DailyReviewSnapshotSchema = z.object({
  date: z.string(),
  todayJournal: z.object({
    date: z.string(),
    exists: z.boolean(),
    noteId: z.string().nullable(),
    contentPreview: z.string().nullable(),
  }),
  todayMeetings: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.literalEnum(['recording', 'transcribing', 'summarizing', 'ready', 'failed']),
      durationMs: z.number(),
      summary: z.string().nullable(),
      createdAt: DateLike,
      inJournal: z.boolean(),
    }),
  ),
  openTasks: z.array(TodoItemSchema),
  recentNotes: z.array(NoteSchema),
  onThisDay: z.array(
    z.object({
      yearsAgo: z.number(),
      date: DateLike,
      note: NoteSchema,
    }),
  ),
  calendarEvents: z.array(CalendarEventSchema).optional(),
  mailUnreadCount: z.number().optional(),
  mailMessages: z.array(MailMessageSchema).optional(),
  linearIssues: z.array(LinearIssueSchema).optional(),
});

/**
 * Loading an integration also yields the snapshot it belongs in.
 *
 * The external data and the snapshot it merges into used to travel separately:
 * the caller received a result, discarded its payload, and fetched the whole
 * snapshot again to pick the same data back up out of a cache. Returning both
 * together lets the merge stay in one module and costs the caller one request
 * instead of two.
 *
 * `snapshot` is null where a transport has no sources to merge — the browser
 * build — meaning "nothing newer to apply", not "empty day".
 */
export const DailyReviewIntegrationOutcomeSchema = z.object({
  result: DailyReviewIntegrationResultSchema,
  snapshot: DailyReviewSnapshotSchema.nullable(),
});

export const DailyReviewIntegrationsOutcomeSchema = z.object({
  results: DailyReviewIntegrationsResultSchema,
  snapshot: DailyReviewSnapshotSchema.nullable(),
});

export const DailyReviewSummarySchema = z.object({
  summary: z.string(),
  journalNoteId: z.string().nullable(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type MailMessage = z.infer<typeof MailMessageSchema>;
export type LinearIssue = z.infer<typeof LinearIssueSchema>;
export type CalendarDescriptor = z.infer<typeof CalendarDescriptorSchema>;
export type DailyReviewIntegrationResult = z.infer<typeof DailyReviewIntegrationResultSchema>;
export type DailyReviewIntegrationOutcome = z.infer<
  typeof DailyReviewIntegrationOutcomeSchema
>;
export type DailyReviewIntegrationsOutcome = z.infer<
  typeof DailyReviewIntegrationsOutcomeSchema
>;
export type ListDailyReviewCalendarsResult = z.infer<
  typeof ListDailyReviewCalendarsResultSchema
>;
export type DailyReviewSnapshot = z.infer<typeof DailyReviewSnapshotSchema>;
export type DailyReviewSummary = z.infer<typeof DailyReviewSummarySchema>;
export type DailyReviewTodayJournal = DailyReviewSnapshot['todayJournal'];
export type DailyReviewMeetingSummary = DailyReviewSnapshot['todayMeetings'][number];
export type DailyReviewOnThisDayEntry = DailyReviewSnapshot['onThisDay'][number];
export type DailyReviewIntegrationSource = DailyReviewIntegrationResult['source'];
export type DailyReviewIntegrationStatus =
  DailyReviewIntegrationResult['status'];
