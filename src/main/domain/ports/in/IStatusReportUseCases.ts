/**
 * Status Report Use Cases Port
 *
 * Drafts a weekly status report for the user by aggregating the past
 * N days (default 7) of journal entries, meeting summaries, completed
 * tasks, and recently-modified notes, then sending the evidence to
 * the configured text model.
 */

export interface GenerateStatusReportRequest {
  workspaceId?: string;
  /** How many days back to include in the evidence packet (default 7). */
  windowDays?: number;
  /** Optional prompt override; defaults to DEFAULT_STATUS_REPORT_PROMPT. */
  promptTemplate?: string;
}

export interface StatusReportEvidenceCounts {
  journalEntries: number;
  meetings: number;
  completedTasks: number;
  modifiedNotes: number;
}

export interface GenerateStatusReportResponse {
  /** Inclusive start date of the evidence window, YYYY-MM-DD. */
  windowStart: string;
  /** Inclusive end date (today), YYYY-MM-DD. */
  windowEnd: string;
  /** Counts of each evidence kind that fed the prompt. */
  evidence: StatusReportEvidenceCounts;
  /** The full LLM-drafted markdown report. */
  report: string;
}

export interface IGenerateStatusReportUseCase {
  execute(request?: GenerateStatusReportRequest): Promise<GenerateStatusReportResponse>;
}

export interface IStatusReportUseCases {
  generate: IGenerateStatusReportUseCase;
}
