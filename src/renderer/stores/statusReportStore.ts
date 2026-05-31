/**
 * statusReportStore — generates the weekly status report on demand and
 * holds the result so a dialog can render it. Send-to-journal piggybacks
 * on the existing quickCaptureAPI.appendToJournal.
 */

import { create } from 'zustand';
import { quickCaptureAPI, statusReportAPI } from '@renderer/api';
import { logger } from '@renderer/lib/logger';
import type { StatusReportResult } from '@renderer/api';

interface StatusReportState {
  open: boolean;
  generating: boolean;
  sending: boolean;
  result: StatusReportResult | null;
  error: string | null;

  openAndGenerate: () => Promise<void>;
  regenerate: () => Promise<void>;
  close: () => void;
  /** Returns the noteId of the journal entry the report was appended to. */
  sendToJournal: () => Promise<string | null>;
}

export const useStatusReportStore = create<StatusReportState>((set, get) => ({
  open: false,
  generating: false,
  sending: false,
  result: null,
  error: null,

  openAndGenerate: async () => {
    set({ open: true, generating: true, error: null, result: null });
    await runGenerate(set);
  },

  regenerate: async () => {
    set({ generating: true, error: null });
    await runGenerate(set);
  },

  close: () => set({ open: false, result: null, error: null, generating: false, sending: false }),

  sendToJournal: async () => {
    const { result } = get();
    if (!result) return null;
    set({ sending: true });
    try {
      const body = formatJournalBody(result);
      const response = await quickCaptureAPI.appendToJournal(body);
      if (!response.success || !response.data) {
        set({ sending: false, error: response.error?.message ?? 'Failed to send to journal' });
        return null;
      }
      set({ sending: false, open: false, result: null });
      return response.data.noteId;
    } catch (err) {
      logger.error('[statusReportStore] sendToJournal failed', err);
      set({ sending: false, error: err instanceof Error ? err.message : 'Failed to send to journal' });
      return null;
    }
  },
}));

async function runGenerate(
  set: (state: Partial<StatusReportState>) => void,
): Promise<void> {
  try {
    const response = await statusReportAPI.generate();
    if (!response.success || !response.data) {
      set({
        generating: false,
        error: response.error?.message ?? 'Failed to generate status report',
      });
      return;
    }
    set({ result: response.data, generating: false, error: null });
  } catch (err) {
    logger.error('[statusReportStore] generate failed', err);
    set({
      generating: false,
      error: err instanceof Error ? err.message : 'Failed to generate status report',
    });
  }
}

function formatJournalBody(result: StatusReportResult): string {
  return [`### Weekly status (${result.windowStart} → ${result.windowEnd})`, '', result.report.trim()].join(
    '\n',
  );
}
