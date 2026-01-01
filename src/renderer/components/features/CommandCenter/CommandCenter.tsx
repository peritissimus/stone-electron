/**
 * CommandCenter - Cmd+K command palette for quick navigation and actions
 *
 * Performance optimizations:
 * - In-memory filtering for instant results (no API calls)
 * - Fuzzy matching for typo-tolerant search
 * - Memoized commands and stable callbacks
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import {
  MagnifyingGlass,
  FileText,
  Gear,
  House,
  Plus,
  SidebarSimple,
  Calendar,
  CalendarBlank,
  ArrowRight,
  Command,
} from 'phosphor-react';

interface CommandItem {
  id: string;
  type: 'note' | 'command';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  score?: number;
  action: () => void;
}

/**
 * Simple fuzzy match - checks if query chars appear in order in target
 * Returns match score (higher = better) or 0 if no match
 */
function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Empty query matches everything
  if (q.length === 0) return 1;

  // Exact match gets highest score
  if (t === q) return 100;

  // Starts with gets high score
  if (t.startsWith(q)) return 90 + (q.length / t.length) * 10;

  // Contains gets medium score
  if (t.includes(q)) return 70 + (q.length / t.length) * 10;

  // Fuzzy match - chars in order
  let qi = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let lastMatchIndex = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (ti === lastMatchIndex + 1) {
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 1;
      }
      lastMatchIndex = ti;
      qi++;
    }
  }

  // All chars matched
  if (qi === q.length) {
    // Score based on consecutive matches and coverage
    const coverage = q.length / t.length;
    return 30 + maxConsecutive * 10 + coverage * 20;
  }

  return 0;
}

export function CommandCenter() {
  const { commandCenterOpen } = useUIStore();
  const { notes } = useNoteStore();
  const { openOrCreateTodayJournal, openOrCreateYesterdayJournal } = useJournalActions();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Stable action callbacks - no dependencies on closeCommandCenter
  const handleClose = useCallback(() => {
    useUIStore.getState().closeCommandCenter();
  }, []);

  const handleSelectNote = useCallback((noteId: string) => {
    useNoteStore.getState().setActiveNote(noteId);
    useUIStore.getState().closeCommandCenter();
  }, []);

  // Build static command list once
  const commands = useMemo<CommandItem[]>(() => [
    {
      id: 'new-note',
      type: 'command',
      title: 'New Note',
      subtitle: 'Create a new note',
      icon: <Plus size={18} weight="bold" />,
      shortcut: '⌘N',
      action: handleClose,
    },
    {
      id: 'go-home',
      type: 'command',
      title: 'Go Home',
      subtitle: 'Navigate to home view',
      icon: <House size={18} />,
      shortcut: '⌘⇧H',
      action: () => {
        useNoteStore.getState().setActiveNote(null);
        handleClose();
      },
    },
    {
      id: 'toggle-sidebar',
      type: 'command',
      title: 'Toggle Sidebar',
      subtitle: 'Show or hide the sidebar',
      icon: <SidebarSimple size={18} />,
      shortcut: '⌘\\',
      action: () => {
        useUIStore.getState().toggleSidebar();
        handleClose();
      },
    },
    {
      id: 'open-settings',
      type: 'command',
      title: 'Open Settings',
      subtitle: 'Configure app preferences',
      icon: <Gear size={18} />,
      shortcut: '⌘,',
      action: () => {
        handleClose();
        useUIStore.getState().openSettings();
      },
    },
    {
      id: 'today-journal',
      type: 'command',
      title: "Today's Journal",
      subtitle: "Open or create today's journal entry",
      icon: <Calendar size={18} />,
      shortcut: '⌘J',
      action: () => {
        handleClose();
        openOrCreateTodayJournal();
      },
    },
    {
      id: 'yesterday-journal',
      type: 'command',
      title: "Yesterday's Journal",
      subtitle: "Open or create yesterday's journal entry",
      icon: <CalendarBlank size={18} />,
      action: () => {
        handleClose();
        openOrCreateYesterdayJournal();
      },
    },
  ], [handleClose, openOrCreateTodayJournal, openOrCreateYesterdayJournal]);

  // In-memory filtered notes (instant) - with fuzzy matching
  const filteredNotes = useMemo<CommandItem[]>(() => {
    const q = query.trim();

    // Get all non-deleted notes
    const activeNotes = notes.filter((n) => !n.isDeleted);

    if (q.length === 0) {
      // No query - return recent notes (top 3)
      return activeNotes
        .sort((a, b) => {
          const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : a.updatedAt;
          const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : b.updatedAt;
          return bTime - aTime;
        })
        .slice(0, 3)
        .map((note) => ({
          id: `note-${note.id}`,
          type: 'note' as const,
          title: note.title || 'Untitled',
          subtitle: note.filePath?.replace(/^.*[/\\]/, '') || undefined,
          icon: <FileText size={18} />,
          score: 100,
          action: () => handleSelectNote(note.id),
        }));
    }

    // Fuzzy match against titles and file paths
    return activeNotes
      .map((note) => {
        const titleScore = fuzzyMatch(q, note.title || 'Untitled');
        const pathScore = note.filePath ? fuzzyMatch(q, note.filePath) * 0.5 : 0;
        const score = Math.max(titleScore, pathScore);
        return { note, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ note, score }) => ({
        id: `note-${note.id}`,
        type: 'note' as const,
        title: note.title || 'Untitled',
        subtitle: note.filePath?.replace(/^.*[/\\]/, '') || undefined,
        icon: <FileText size={18} />,
        score,
        action: () => handleSelectNote(note.id),
      }));
  }, [notes, query, handleSelectNote]);

  // Filtered commands (instant)
  const filteredCommands = useMemo<CommandItem[]>(() => {
    if (query.length === 0) return commands;

    return commands
      .map((cmd) => {
        const titleScore = fuzzyMatch(query, cmd.title);
        const subtitleScore = cmd.subtitle ? fuzzyMatch(query, cmd.subtitle) * 0.5 : 0;
        const score = Math.max(titleScore, subtitleScore);
        return { cmd, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd, score }) => ({ ...cmd, score }));
  }, [commands, query]);

  // Combined items list
  const items = useMemo<CommandItem[]>(() => {
    if (query.length === 0) {
      // No query: show recent notes then commands
      return [...filteredNotes, ...commands];
    }

    // With query: notes first, then commands
    return [...filteredNotes, ...filteredCommands];
  }, [query, filteredNotes, filteredCommands, commands]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length, query]);

  // Focus input when opened
  useEffect(() => {
    if (commandCenterOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus immediately - no setTimeout needed
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandCenterOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!commandCenterOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          handleClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            items[selectedIndex].action();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandCenterOpen, handleClose, items, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!commandCenterOpen) return null;

  const noteItems = items.filter((i) => i.type === 'note');
  const commandItems = items.filter((i) => i.type === 'command');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-popover rounded-xl overflow-hidden border border-border shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3">
          <MagnifyingGlass size={20} weight="regular" className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes and commands..."
            className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground/60 outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="h-px bg-border" />

        {/* Results List */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-1.5">
          {items.length === 0 && query.length >= 2 && (
            <div className="px-4 py-10 text-center">
              <p className="text-muted-foreground text-sm">No results for "{query}"</p>
            </div>
          )}

          {/* Notes Section */}
          {noteItems.length > 0 && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  {query.length > 0 ? 'Notes' : 'Recent'}
                </span>
              </div>
              {noteItems.map((item, idx) => (
                <CommandItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  isSelected={selectedIndex === idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                />
              ))}
            </>
          )}

          {/* Commands Section */}
          {commandItems.length > 0 && (
            <>
              <div className="px-4 py-1.5 mt-1">
                <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Commands
                </span>
              </div>
              {commandItems.map((item, idx) => {
                const actualIndex = noteItems.length + idx;
                return (
                  <CommandItemRow
                    key={item.id}
                    item={item}
                    index={actualIndex}
                    isSelected={selectedIndex === actualIndex}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(actualIndex)}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↵</kbd>
              <span>open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">esc</kbd>
              <span>close</span>
            </span>
          </div>
          <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
            <Command size={11} />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CommandItemRowProps {
  item: CommandItem;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CommandItemRow({ item, index, isSelected, onClick, onMouseEnter }: CommandItemRowProps) {
  return (
    <button
      data-index={index}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      }`}
    >
      <span className={`flex-shrink-0 ${isSelected ? 'text-accent-foreground' : 'text-muted-foreground'}`}>
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${isSelected ? 'text-accent-foreground' : 'text-foreground'}`}>
          {item.title}
        </div>
        {item.subtitle && (
          <div className={`text-xs truncate ${isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
            {item.subtitle}
          </div>
        )}
      </div>
      {item.shortcut && (
        <kbd className={`ml-auto px-1.5 py-0.5 rounded text-[11px] font-mono ${
          isSelected ? 'bg-accent-foreground/10 text-accent-foreground/80' : 'bg-muted text-muted-foreground'
        }`}>
          {item.shortcut}
        </kbd>
      )}
      {isSelected && !item.shortcut && (
        <ArrowRight size={14} className="flex-shrink-0 text-accent-foreground/50" />
      )}
    </button>
  );
}
