/**
 * BacklinksPanel Component - Shows notes that link to the current note
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowsInLineVertical,
  ArrowsOutLineVertical,
  Link,
  ArrowRight,
  CaretRight,
  CaretDown,
} from 'phosphor-react';
import { Note } from '@shared/types';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNavigateToNote } from '@renderer/navigation';
import { cn } from '@renderer/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@renderer/lib/logger';
import { ListItem, SectionHeader } from '@renderer/components/composites';

export interface BacklinksPanelProps {
  noteId: string;
}

interface BacklinkItemProps {
  note: Note;
  onClick: () => void;
}

function BacklinkItem({ note, onClick }: BacklinkItemProps) {
  const folderPath = note.filePath?.includes('/')
    ? note.filePath.slice(0, note.filePath.lastIndexOf('/'))
    : '';

  const timeAgo = note.updatedAt
    ? formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })
    : null;

  return (
    <ListItem
      size="normal"
      onClick={onClick}
      className="group rounded-md border-none"
      left={<Link size={14} weight="bold" />}
      title={note.title}
      subtitle={folderPath}
      right={
        <>
          <span className="text-xs text-muted-foreground hidden group-hover:flex items-center gap-1">
            Open <ArrowRight size={12} />
          </span>
          {timeAgo && (
            <span className="text-xs text-muted-foreground group-hover:hidden">{timeAgo}</span>
          )}
        </>
      }
    />
  );
}

export function BacklinksPanel({ noteId }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [forwardLinks, setForwardLinks] = useState<Note[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { getBacklinks, getForwardLinks } = useNoteAPI();
  const navigateToNote = useNavigateToNote();

  // Fetch backlinks and forward links
  const fetchLinks = useCallback(async () => {
    if (!noteId) return;

    setIsLoading(true);
    try {
      const [fetchedBacklinks, fetchedForwardLinks] = await Promise.all([
        getBacklinks(noteId),
        getForwardLinks(noteId),
      ]);
      setBacklinks(fetchedBacklinks || []);
      setForwardLinks(fetchedForwardLinks || []);
    } catch (error) {
      logger.error('Failed to fetch links:', error);
      setBacklinks([]);
      setForwardLinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [noteId, getBacklinks, getForwardLinks]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleNoteClick = (targetNoteId: string) => {
    navigateToNote(targetNoteId);
  };

  const totalLinks = backlinks.length + forwardLinks.length;

  // Don't render anything if no links exist
  if (!isLoading && totalLinks === 0) {
    return null;
  }

  return (
    <div className="border-t border-border bg-muted/20">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between',
          'px-4 py-2',
          'text-sm font-medium text-muted-foreground',
          'hover:bg-muted/30 transition-colors',
        )}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <CaretDown size={14} weight="bold" />
          ) : (
            <CaretRight size={14} weight="bold" />
          )}
          <Link size={14} weight="bold" />
          <span>Linked Notes</span>
          {totalLinks > 0 && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{totalLinks}</span>
          )}
        </div>
        {isExpanded ? <ArrowsInLineVertical size={14} /> : <ArrowsOutLineVertical size={14} />}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-2">
          {isLoading ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Loading links...
            </div>
          ) : (
            <>
              {/* Backlinks Section */}
              {backlinks.length > 0 && (
                <div>
                  <SectionHeader
                    size="compact"
                    divided={false}
                    title={`${backlinks.length} ${backlinks.length === 1 ? 'note links' : 'notes link'} to this`}
                    className="text-muted-foreground uppercase tracking-wider"
                  />
                  <div className="space-y-0.5">
                    {backlinks.map((note) => (
                      <BacklinkItem
                        key={note.id}
                        note={note}
                        onClick={() => handleNoteClick(note.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Forward Links Section */}
              {forwardLinks.length > 0 && (
                <div>
                  <SectionHeader
                    size="compact"
                    divided={false}
                    title={`This note links to ${forwardLinks.length} ${forwardLinks.length === 1 ? 'note' : 'notes'}`}
                    className="text-muted-foreground uppercase tracking-wider"
                  />
                  <div className="space-y-0.5">
                    {forwardLinks.map((note) => (
                      <BacklinkItem
                        key={note.id}
                        note={note}
                        onClick={() => handleNoteClick(note.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

BacklinksPanel.displayName = 'BacklinksPanel';
