/**
 * CommandCenter - Cmd+K command palette for quick navigation and actions
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useSearchAPI } from '@renderer/hooks/useSearchAPI';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import {
  MagnifyingGlass,
  FileText,
  Gear,
  House,
  Plus,
  Keyboard,
  SidebarSimple,
  Calendar,
  CalendarBlank,
  ArrowRight,
  Command,
} from 'phosphor-react';
import {
  DEFAULT_SHORTCUTS,
  formatShortcutDisplay,
} from '@renderer/stores/shortcutsStore';
import { logger } from '@renderer/utils/logger';

interface CommandItem {
  id: string;
  type: 'note' | 'command' | 'shortcut';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export function CommandCenter() {
  const { commandCenterOpen, closeCommandCenter, openSettings, toggleSidebar } = useUIStore();
  const { setActiveNote, notes } = useNoteStore();
  const { fullTextSearch } = useSearchAPI();
  const { openOrCreateTodayJournal, openOrCreateYesterdayJournal } = useJournalActions();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [
      {
        id: 'new-note',
        type: 'command',
        title: 'New Note',
        subtitle: 'Create a new note in current folder',
        icon: <Plus size={18} weight="bold" />,
        shortcut: '⌘N',
        action: () => {
          closeCommandCenter();
          // Will be handled by parent
        },
      },
      {
        id: 'go-home',
        type: 'command',
        title: 'Go Home',
        subtitle: 'Navigate to home view',
        icon: <House size={18} />,
        shortcut: '⌘⇧H',
        action: () => {
          setActiveNote(null);
          closeCommandCenter();
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
          toggleSidebar();
          closeCommandCenter();
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
          closeCommandCenter();
          openSettings();
        },
      },
      {
        id: 'today-journal',
        type: 'command',
        title: "Today's Journal",
        subtitle: 'Open or create today\'s journal entry',
        icon: <Calendar size={18} />,
        shortcut: '⌘J',
        action: () => {
          closeCommandCenter();
          openOrCreateTodayJournal();
        },
      },
      {
        id: 'yesterday-journal',
        type: 'command',
        title: "Yesterday's Journal",
        subtitle: 'Open or create yesterday\'s journal entry',
        icon: <CalendarBlank size={18} />,
        action: () => {
          closeCommandCenter();
          openOrCreateYesterdayJournal();
        },
      },
    ];

    // Add shortcuts section
    const shortcutItems: CommandItem[] = DEFAULT_SHORTCUTS.map((shortcut) => ({
      id: `shortcut-${shortcut.id}`,
      type: 'shortcut' as const,
      title: shortcut.label,
      subtitle: shortcut.description,
      icon: <Keyboard size={18} />,
      shortcut: formatShortcutDisplay(shortcut),
      action: () => {
        closeCommandCenter();
      },
    }));

    return [...cmds, ...shortcutItems];
  }, [closeCommandCenter, openSettings, toggleSidebar, setActiveNote, openOrCreateTodayJournal, openOrCreateYesterdayJournal]);

  // Recent notes (top 5)
  const recentNotes = useMemo<CommandItem[]>(() => {
    return notes
      .filter((n) => !n.isDeleted)
      .sort((a, b) => {
        const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : a.updatedAt;
        const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : b.updatedAt;
        return bTime - aTime;
      })
      .slice(0, 5)
      .map((note) => ({
        id: `note-${note.id}`,
        type: 'note' as const,
        title: note.title || 'Untitled',
        subtitle: note.filePath || undefined,
        icon: <FileText size={18} />,
        action: () => {
          setActiveNote(note.id);
          closeCommandCenter();
        },
      }));
  }, [notes, setActiveNote, closeCommandCenter]);

  // Search for notes
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await fullTextSearch(searchQuery, { limit: 10 });
        if (results?.results) {
          setSearchResults(results.results);
        }
      } catch (error) {
        logger.error('Command center search failed:', error);
      } finally {
        setIsSearching(false);
      }
    },
    [fullTextSearch]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query);
      }, 200);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // Build filtered items list
  const items = useMemo<CommandItem[]>(() => {
    const lowerQuery = query.toLowerCase();

    // If searching, show search results first
    if (query.length >= 2) {
      const noteResults: CommandItem[] = searchResults.map((result) => ({
        id: `search-${result.id}`,
        type: 'note' as const,
        title: result.title || 'Untitled',
        subtitle: result.filePath,
        icon: <FileText size={18} />,
        action: () => {
          setActiveNote(result.id);
          closeCommandCenter();
        },
      }));

      // Also filter commands
      const filteredCommands = commands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(lowerQuery) ||
          cmd.subtitle?.toLowerCase().includes(lowerQuery)
      );

      return [...noteResults, ...filteredCommands];
    }

    // No query - show recent notes and commands
    return [...recentNotes, ...commands.filter((cmd) => cmd.type === 'command')];
  }, [query, searchResults, commands, recentNotes, setActiveNote, closeCommandCenter]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Focus input when opened
  useEffect(() => {
    if (commandCenterOpen) {
      setQuery('');
      setSelectedIndex(0);
      setSearchResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandCenterOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!commandCenterOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeCommandCenter();
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
  }, [commandCenterOpen, closeCommandCenter, items, selectedIndex]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/40 dark:bg-black/60 backdrop-blur-md"
        onClick={closeCommandCenter}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-popover rounded-xl overflow-hidden border border-border shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
        {/* Search Input */}
        <div className="flex items-center gap-4 px-5 py-4">
          <MagnifyingGlass size={22} weight="regular" className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-lg text-foreground placeholder:text-muted-foreground/50 outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="h-px bg-border" />

        {/* Results List */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">
          {items.length === 0 && query.length >= 2 && !isSearching && (
            <div className="px-5 py-12 text-center">
              <p className="text-muted-foreground text-sm">No results found for "{query}"</p>
            </div>
          )}

          {items.length === 0 && query.length < 2 && (
            <div className="px-5 py-12 text-center">
              <p className="text-muted-foreground text-sm">Start typing to search notes...</p>
            </div>
          )}

          {/* Group: Recent Notes */}
          {query.length < 2 && recentNotes.length > 0 && (
            <>
              <div className="px-5 py-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Recent Notes
                </span>
              </div>
              {recentNotes.map((item, idx) => (
                <CommandItem
                  key={item.id}
                  item={item}
                  index={idx}
                  isSelected={selectedIndex === idx}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                />
              ))}
            </>
          )}

          {/* Group: Commands */}
          {query.length < 2 && (
            <>
              <div className="px-5 py-2 mt-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Commands
                </span>
              </div>
              {commands
                .filter((cmd) => cmd.type === 'command')
                .map((item, idx) => {
                  const actualIndex = recentNotes.length + idx;
                  return (
                    <CommandItem
                      key={item.id}
                      item={item}
                      index={actualIndex}
                      isSelected={selectedIndex === actualIndex}
                      onClick={() => item.action()}
                      onMouseEnter={() => setSelectedIndex(actualIndex)}
                    />
                  );
                })}
            </>
          )}

          {/* Search Results */}
          {query.length >= 2 && items.length > 0 && (
            <>
              {searchResults.length > 0 && (
                <div className="px-5 py-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Notes
                  </span>
                </div>
              )}
              {items
                .filter((item) => item.type === 'note')
                .map((item, idx) => (
                  <CommandItem
                    key={item.id}
                    item={item}
                    index={idx}
                    isSelected={selectedIndex === idx}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  />
                ))}

              {items.filter((item) => item.type !== 'note').length > 0 && (
                <div className="px-5 py-2 mt-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Commands
                  </span>
                </div>
              )}
              {items
                .filter((item) => item.type !== 'note')
                .map((item, idx) => {
                  const actualIndex = items.filter((i) => i.type === 'note').length + idx;
                  return (
                    <CommandItem
                      key={item.id}
                      item={item}
                      index={actualIndex}
                      isSelected={selectedIndex === actualIndex}
                      onClick={() => item.action()}
                      onMouseEnter={() => setSelectedIndex(actualIndex)}
                    />
                  );
                })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/50">
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">esc</kbd>
              close
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Command size={12} />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CommandItemProps {
  item: CommandItem;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CommandItem({ item, index, isSelected, onClick, onMouseEnter }: CommandItemProps) {
  return (
    <button
      data-index={index}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${
        isSelected ? 'bg-secondary' : 'hover:bg-secondary/50'
      }`}
    >
      <span className={`flex-shrink-0 ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
          {item.title}
        </div>
        {item.subtitle && (
          <div className={`text-sm truncate ${isSelected ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
            {item.subtitle}
          </div>
        )}
      </div>
      {item.shortcut && (
        <kbd className={`ml-2 px-2 py-1 rounded text-xs font-mono ${
          isSelected ? 'bg-muted text-foreground/80' : 'bg-muted/50 text-muted-foreground'
        }`}>
          {item.shortcut}
        </kbd>
      )}
      {isSelected && (
        <ArrowRight size={16} className="flex-shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}
