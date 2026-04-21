import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@renderer/stores/uiStore';
import { useSettingsStore } from '@renderer/stores/settingsStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useCommandStore } from '@renderer/stores/commandStore';
import type { CommandDefinition } from '@renderer/stores/commandStore';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useActiveNoteId, useNavigateToNote } from '@renderer/navigation';
import {
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
import type { CommandItem } from './types';

export function useCommandDefinitions(query: string) {
  const navigate = useNavigate();
  const navigateToNote = useNavigateToNote();
  const notes = useNoteStore((s) => s.notes);
  const activeNoteId = useActiveNoteId();
  const registerCommands = useCommandStore((state) => state.register);
  const unregisterCommands = useCommandStore((state) => state.unregister);
  const setContext = useCommandStore((state) => state.setContext);
  const getVisibleCommands = useCommandStore((state) => state.getVisibleCommands);
  const recordUsage = useCommandStore((state) => state.recordUsage);
  const { openOrCreateTodayJournal, openOrCreateYesterdayJournal } = useJournalActions();
  const { createNote, exportPdf } = useNoteAPI();

  const handleClose = useCallback(() => {
    useUIStore.getState().closeCommandCenter();
  }, []);

  const handleCreateWorkNote = useCallback(async () => {
    const now = new Date();
    const defaultTitle = `Untitled Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    const note = await createNote({
      title: defaultTitle,
      content: '',
      folderPath: 'Work',
    });
    if (note) {
      navigateToNote(note.id);
    }
    useUIStore.getState().closeCommandCenter();
  }, [createNote, navigateToNote]);

  const handleExportPdf = useCallback(async () => {
    if (!activeNoteId) return;
    const activeNote = notes.find((n) => n.id === activeNoteId);
    const title = activeNote?.title || 'Untitled';
    handleClose();
    await exportPdf(activeNoteId, '', title);
  }, [activeNoteId, notes, exportPdf, handleClose]);

  const handleToggleTheme = useCallback(() => {
    const { appearance, setTheme } = useSettingsStore.getState();
    const currentTheme = appearance.theme;
    if (currentTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      void setTheme(prefersDark ? 'light' : 'dark');
    } else {
      void setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }
    handleClose();
  }, [handleClose]);

  useEffect(() => {
    setContext('hasActiveNote', Boolean(activeNoteId));
  }, [activeNoteId, setContext]);

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

  return { commandItems, recentCommandCount, handleClose };
}
