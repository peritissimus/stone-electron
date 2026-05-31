/**
 * StatusReportDialog — preview the generated weekly status with copy +
 * send-to-journal actions. Mounted from DailyReviewPage; visibility
 * driven by statusReportStore.open.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowClockwise,
  CircleNotch,
  Copy,
  PaperPlaneTilt,
  Warning,
} from 'phosphor-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/base/ui/dialog';
import { Button } from '@renderer/components/base/ui/button';
import { Body } from '@renderer/components/base/ui/text';
import { useStatusReport } from '@renderer/hooks/useStatusReport';
import { toNote } from '@renderer/navigation';

export function StatusReportDialog() {
  const {
    open,
    generating,
    sending,
    result,
    error,
    close,
    regenerate,
    sendToJournal,
  } = useStatusReport();

  const navigate = useNavigate();

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.report);
    } catch {
      // Best-effort — old browsers / restricted contexts may deny.
    }
  }, [result]);

  const handleSend = useCallback(async () => {
    const noteId = await sendToJournal();
    if (noteId) navigate(toNote(noteId));
  }, [navigate, sendToJournal]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Weekly status</DialogTitle>
          <DialogDescription>
            {result
              ? `Evidence window: ${result.windowStart} → ${result.windowEnd} · ${result.evidence.journalEntries} journal entries · ${result.evidence.meetings} meetings · ${result.evidence.completedTasks} completed tasks · ${result.evidence.modifiedNotes} notes touched`
              : 'Drafted from the last 7 days of your journal, meetings, completed tasks, and modified notes.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-destructive" />
            <Body size="sm" className="text-destructive">
              {error}
            </Body>
          </div>
        )}

        {generating && !result && (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <CircleNotch size={18} className="animate-spin" />
            <Body size="sm">Drafting…</Body>
          </div>
        )}

        {result && (
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-card px-5 py-4 font-sans text-[13px] leading-relaxed text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            {result.report}
          </pre>
        )}

        <DialogFooter className="flex-row flex-wrap justify-end gap-2">
          {result && (
            <>
              <Button variant="ghost" size="sm" onClick={() => void regenerate()} disabled={generating || sending}>
                <ArrowClockwise size={14} className={generating ? 'animate-spin' : ''} />
                Regenerate
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleCopy()} disabled={generating || sending}>
                <Copy size={14} />
                Copy
              </Button>
              <Button onClick={() => void handleSend()} disabled={generating || sending}>
                {sending ? (
                  <>
                    <CircleNotch size={14} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <PaperPlaneTilt size={14} weight="fill" />
                    Send to journal
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

