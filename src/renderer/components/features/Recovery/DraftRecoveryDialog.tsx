/**
 * Draft Recovery Dialog - Shows unsaved drafts after crash
 */

import { useEffect, useState } from 'react';
import { getAllDrafts, deleteDraft, clearAllDrafts } from '@renderer/lib/draftStorage';
import { useNotes } from '@renderer/hooks/useNotes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@renderer/components/base/ui/dialog';
import { Button } from '@renderer/components/base/ui/button';
import { FileText, X, CheckCircle } from '@phosphor-icons/react';
import { logger } from '@renderer/lib/logger';

interface DraftRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecover: (noteId: string, content: string) => void;
}

export function DraftRecoveryDialog({ open, onOpenChange, onRecover }: DraftRecoveryDialogProps) {
  const [drafts, setDrafts] = useState<
    Array<{ noteId: string; title?: string; timestamp: number; content: string }>
  >([]);
  const { notes } = useNotes();

  useEffect(() => {
    if (open) {
      const allDrafts = getAllDrafts();
      logger.info('[DraftRecovery] Found drafts:', allDrafts.length);
      setDrafts(allDrafts);
    }
  }, [open]);

  const handleRecover = (noteId: string, content: string) => {
    onRecover(noteId, content);
    // Remove this draft from list
    setDrafts((prev) => prev.filter((d) => d.noteId !== noteId));
  };

  const handleDiscard = (noteId: string) => {
    deleteDraft(noteId);
    setDrafts((prev) => prev.filter((d) => d.noteId !== noteId));
    logger.info('[DraftRecovery] Discarded draft:', noteId);
  };

  const handleDiscardAll = () => {
    clearAllDrafts();
    setDrafts([]);
    onOpenChange(false);
    logger.info('[DraftRecovery] Discarded all drafts');
  };

  const handleRecoverAll = () => {
    drafts.forEach((draft) => {
      onRecover(draft.noteId, draft.content);
    });
    setDrafts([]);
    onOpenChange(false);
    logger.info('[DraftRecovery] Recovered all drafts');
  };

  // Auto-close when all drafts are processed
  useEffect(() => {
    if (drafts.length === 0 && open) {
      onOpenChange(false);
    }
  }, [drafts.length, open, onOpenChange]);

  const getNoteTitleById = (noteId: string): string => {
    const note = notes.find((n) => n.id === noteId);
    return note?.title || 'Unknown Note';
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={20} />
            Recover Unsaved Changes
          </DialogTitle>
          <DialogDescription>
            We found {drafts.length} note{drafts.length !== 1 ? 's' : ''} with unsaved changes.
            Would you like to recover them?
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {drafts.map((draft) => (
            <div
              key={draft.noteId}
              className="border border-border rounded-lg p-4 bg-card hover:bg-accent/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {draft.title || getNoteTitleById(draft.noteId)}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last edited {formatTimestamp(draft.timestamp)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleRecover(draft.noteId, draft.content)}
                    className="gap-1.5"
                  >
                    <CheckCircle size={14} />
                    Recover
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDiscard(draft.noteId)}
                    className="gap-1.5"
                  >
                    <X size={14} />
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={handleDiscardAll}>
            Discard All
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecoverAll}>Recover All</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
