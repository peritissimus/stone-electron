/**
 * useCommandCenter Hook - Manages command palette state and navigation
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModals } from '@renderer/hooks/useUI';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { fuzzyFilter } from '@renderer/utils/fuzzyMatch';
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
  action: () => void;
}

export function useCommandCenter() {
  const navigate = useNavigate();
  const { commandCenterOpen } = useModals();
  const { notes, activeNoteId } = useNoteStore();
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

  // Build static command list
  const commands = useMemo<CommandItem[]>(
    () => [
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
          navigate('/home');
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
      {
        id: 'new-work-note',
        type: 'command',
        title: 'New Work Note',
        subtitle: 'Create a new note in Work folder',
        icon: <Briefcase size={18} />,
        shortcut: '⌘⇧W',
        action: handleCreateWorkNote,
      },
      {
        id: 'export-pdf',
        type: 'command',
        title: 'Export as PDF',
        subtitle: activeNoteId ? 'Export current note to PDF' : 'Open a note first',
        icon: <FilePdf size={18} />,
        action: handleExportPdf,
      },
      {
        id: 'toggle-theme',
        type: 'command',
        title: 'Toggle Theme',
        subtitle: 'Switch between light and dark mode',
        icon: <Moon size={18} />,
        shortcut: '⌘⇧T',
        action: handleToggleTheme,
      },
    ],
    [handleClose, navigate, openOrCreateTodayJournal, openOrCreateYesterdayJournal, handleCreateWorkNote, handleExportPdf, handleToggleTheme, activeNoteId],
  );

  // Filtered notes with fuzzy matching
  const filteredNotes = useMemo<CommandItem[]>(() => {
    const activeNotes = notes.filter((n) => !n.isDeleted);
    const q = query.trim();

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
    return fuzzyFilter(
      activeNotes,
      q,
      (note) => [note.title || 'Untitled', note.filePath || ''],
    )
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

  // Filtered commands
  const filteredCommands = useMemo<CommandItem[]>(() => {
    if (query.length === 0) return commands;

    return fuzzyFilter(commands, query, (cmd) => [cmd.title, cmd.subtitle || '']);
  }, [commands, query]);

  // Combined items list - commands take priority over notes
  const items = useMemo<CommandItem[]>(() => {
    if (query.length === 0) {
      return [...commands, ...filteredNotes];
    }
    return [...filteredCommands, ...filteredNotes];
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

  const noteItems = items.filter((i) => i.type === 'note');
  const commandItems = items.filter((i) => i.type === 'command');

  return {
    // State
    isOpen: commandCenterOpen,
    query,
    selectedIndex,
    items,
    noteItems,
    commandItems,
    // Refs
    inputRef,
    listRef,
    // Actions
    setQuery,
    setSelectedIndex,
    handleClose,
  };
}
