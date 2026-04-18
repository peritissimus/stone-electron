/**
 * useCommandCenter Hook - Manages command palette state and navigation
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModals } from '@renderer/hooks/useUI';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useCommandStore } from '@renderer/stores/commandStore';
import type { CommandDefinition } from '@renderer/stores/commandStore';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { fuzzyFilter } from '@renderer/lib/fuzzyMatch';
import {
  FileText,
  Gear,
  House,
  Plus,
  SidebarSimple,
  Calendar,
  CalendarBlank,
  Briefcase,
  FilePdf,
  Moon,
} from 'phosphor-react';
import type { ReactNode } from 'react';

export interface CommandItem {
  id: string;
  type: 'command' | 'note';
  title: string;
  subtitle?: string;
  icon: ReactNode;
  shortcut?: string;
  score?: number;
  isRecent?: boolean;
  action: () => void;
}

export function useCommandCenter() {
  const navigate = useNavigate();
  const { commandCenterOpen } = useModals();
  const { notes, activeNoteId } = useNoteStore();
  const registerCommands = useCommandStore((state) => state.register);
  const unregisterCommands = useCommandStore((state) => state.unregister);
  const setContext = useCommandStore((state) => state.setContext);
  const getVisibleCommands = useCommandStore((state) => state.getVisibleCommands);
  const recordUsage = useCommandStore((state) => state.recordUsage);
  const { openOrCreateTodayJournal, openOrCreateYesterdayJournal } = useJournalActions();
  const { createNote, exportPdf } = useNoteAPI();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Stable action callbacks
  const handleClose = useCallback(() => {
    useUIStore.getState().closeCommandCenter();
  }, []);

  const handleSelectNote = useCallback(
    (noteId: string) => {
      navigate(`/note/${noteId}`);
      useUIStore.getState().closeCommandCenter();
    },
    [navigate],
  );

  const handleCreateWorkNote = useCallback(async () => {
    const now = new Date();
    const defaultTitle = `Untitled Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    const note = await createNote({
      title: defaultTitle,
      content: '',
      folderPath: 'Work',
    });
    if (note) {
      navigate(`/note/${note.id}`);
    }
    useUIStore.getState().closeCommandCenter();
  }, [createNote, navigate]);

  const handleExportPdf = useCallback(async () => {
    if (!activeNoteId) return;
    const activeNote = notes.find((n) => n.id === activeNoteId);
    const title = activeNote?.title || 'Untitled';
    handleClose();
    // Use empty string for renderedHtml - backend will use markdown fallback
    await exportPdf(activeNoteId, '', title);
  }, [activeNoteId, notes, exportPdf, handleClose]);

  const handleToggleTheme = useCallback(() => {
    const currentTheme = useUIStore.getState().theme;
    // If system, check actual preference and toggle to opposite
    if (currentTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      useUIStore.getState().setTheme(prefersDark ? 'light' : 'dark');
    } else {
      useUIStore.getState().setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }
    handleClose();
  }, [handleClose]);

  useEffect(() => {
    setContext('hasActiveNote', Boolean(activeNoteId));
  }, [activeNoteId, setContext]);

  // Build static command list
  const commandDefinitions = useMemo<CommandDefinition[]>(
    () => [
      {
        id: 'new-note',
        title: 'New Note',
        subtitle: 'Create a new note',
        icon: <Plus size={18} weight="bold" />,
        shortcut: '⌘N',
        run: handleClose,
      },
      {
        id: 'go-home',
        title: 'Go Home',
        subtitle: 'Navigate to home view',
        icon: <House size={18} />,
        shortcut: '⌘⇧H',
        run: () => {
          navigate('/home');
          handleClose();
        },
      },
      {
        id: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        subtitle: 'Show or hide the sidebar',
        icon: <SidebarSimple size={18} />,
        shortcut: '⌘\\',
        run: () => {
          useUIStore.getState().toggleSidebar();
          handleClose();
        },
      },
      {
        id: 'open-settings',
        title: 'Open Settings',
        subtitle: 'Configure app preferences',
        icon: <Gear size={18} />,
        shortcut: '⌘,',
        run: () => {
          handleClose();
          useUIStore.getState().openSettings();
        },
      },
      {
        id: 'today-journal',
        title: "Today's Journal",
        subtitle: "Open or create today's journal entry",
        icon: <Calendar size={18} />,
        shortcut: '⌘J',
        run: () => {
          handleClose();
          openOrCreateTodayJournal();
        },
      },
      {
        id: 'yesterday-journal',
        title: "Yesterday's Journal",
        subtitle: "Open or create yesterday's journal entry",
        icon: <CalendarBlank size={18} />,
        run: () => {
          handleClose();
          openOrCreateYesterdayJournal();
        },
      },
      {
        id: 'new-work-note',
        title: 'New Work Note',
        subtitle: 'Create a new note in Work folder',
        icon: <Briefcase size={18} />,
        shortcut: '⌘⇧W',
        run: handleCreateWorkNote,
      },
      {
        id: 'export-pdf',
        title: 'Export as PDF',
        subtitle: activeNoteId ? 'Export current note to PDF' : 'Open a note first',
        icon: <FilePdf size={18} />,
        when: 'hasActiveNote',
        run: handleExportPdf,
      },
      {
        id: 'toggle-theme',
        title: 'Toggle Theme',
        subtitle: 'Switch between light and dark mode',
        icon: <Moon size={18} />,
        shortcut: '⌘⇧T',
        run: handleToggleTheme,
      },
    ],
    [
      handleClose,
      navigate,
      openOrCreateTodayJournal,
      openOrCreateYesterdayJournal,
      handleCreateWorkNote,
      handleExportPdf,
      handleToggleTheme,
      activeNoteId,
    ],
  );

  useEffect(() => {
    registerCommands(commandDefinitions);
    return () => unregisterCommands(commandDefinitions.map((command) => command.id));
  }, [registerCommands, unregisterCommands, commandDefinitions]);

  // Filtered notes with fuzzy matching
  const filteredNotes = useMemo<CommandItem[]>(() => {
    const activeNotes = notes.filter((n) => !n.isDeleted);
    const q = query.trim();

    if (q.length === 0) {
      // No query - return recent notes (top 3)
      const getTime = (date: Date | string | number | undefined) => {
        if (!date) return 0;
        if (date instanceof Date) return date.getTime();
        if (typeof date === 'string') return new Date(date).getTime();
        return date;
      };
      return activeNotes
        .sort((a, b) => {
          const aTime = getTime(a.updatedAt);
          const bTime = getTime(b.updatedAt);
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
    return fuzzyFilter(activeNotes, q, (note) => [note.title || 'Untitled', note.filePath || ''])
      .slice(0, 15)
      .map(({ score, ...note }) => ({
        id: `note-${note.id}`,
        type: 'note' as const,
        title: note.title || 'Untitled',
        subtitle: note.filePath?.replace(/^.*[/\\]/, '') || undefined,
        icon: <FileText size={18} />,
        score,
        action: () => handleSelectNote(note.id),
      }));
  }, [notes, query, handleSelectNote]);

  const visibleCommands = useMemo(() => getVisibleCommands(query), [getVisibleCommands, query]);

  const commandItems = useMemo<CommandItem[]>(() => {
    return visibleCommands.map((command) => ({
      id: command.id,
      type: 'command' as const,
      title: command.title,
      subtitle: command.subtitle,
      icon: command.icon,
      shortcut: command.shortcut,
      score: command.score,
      isRecent: command.isRecent,
      action: () => {
        recordUsage(command.id);
        command.run();
      },
    }));
  }, [visibleCommands, recordUsage]);

  const recentCommandCount = useMemo(
    () => (query.trim().length === 0 ? commandItems.filter((item) => item.isRecent).length : 0),
    [commandItems, query],
  );

  // Combined items list - commands take priority over notes
  const items = useMemo<CommandItem[]>(
    () => [...commandItems, ...filteredNotes],
    [commandItems, filteredNotes],
  );

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length, query]);

  // Focus input when opened
  useEffect(() => {
    if (commandCenterOpen) {
      setQuery('');
      setSelectedIndex(0);
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

  const noteItems = filteredNotes;

  return {
    // State
    isOpen: commandCenterOpen,
    query,
    selectedIndex,
    items,
    noteItems,
    commandItems,
    recentCommandCount,
    // Refs
    inputRef,
    listRef,
    // Actions
    setQuery,
    setSelectedIndex,
    handleClose,
  };
}
