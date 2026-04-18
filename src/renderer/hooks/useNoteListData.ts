/**
 * useNoteListData Hook - Handles note list data, sorting, and navigation
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { shallow } from 'zustand/shallow';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteListUI } from '@renderer/hooks/useUI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { logger } from '@renderer/lib/logger';
import { normalizePath, getParentPath } from '@renderer/lib/path';
import type { FileTreeNode } from '@renderer/stores/fileTreeStore';
import type { Note } from '@shared/types';

/**
 * Recursively find a folder node by path
 */
function findFolderNode(nodes: FileTreeNode[], path: string): FileTreeNode | null {
  const normalized = normalizePath(path);
  for (const node of nodes) {
    if (node.type !== 'folder') continue;
    if (normalizePath(node.path) === normalized) return node;
    if (node.children) {
      const found = findFolderNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function useNoteListData() {
  const navigate = useNavigate();
  const notes = useNoteStore((state) => state.notes, shallow);
  const notesByPath = useNoteStore((state) => state.notesByPath);

  const { viewMode, sortBy, sortOrder, showArchived, setViewMode, setSortBy, toggleSortOrder } =
    useNoteListUI();

  const {
    tree,
    activeFolder,
    selectedFile,
    expandedPaths,
    setActiveFolder,
    setSelectedFile,
    toggleExpanded,
  } = useFileTreeStore();

  const { createNote, loadNotes } = useNoteAPI();

  // Helper to get note from Map (O(1) lookup)
  const getNoteByPath = useCallback(
    (path: string): Note | undefined => {
      return notesByPath.get(normalizePath(path));
    },
    [notesByPath],
  );

  // Load notes when folder changes
  useEffect(() => {
    if (activeFolder) {
      logger.info('[NoteList] loadNotes by folder', { folderPath: activeFolder });
      loadNotes({ folderPath: activeFolder });
    } else {
      logger.info('[NoteList] loadNotes all');
      loadNotes();
    }
  }, [activeFolder, loadNotes]);

  // Sync selected file to active note - navigate to it
  useEffect(() => {
    if (!selectedFile) return;
    const note = getNoteByPath(selectedFile);
    if (note) {
      navigate(`/note/${note.id}`);
    }
  }, [selectedFile, getNoteByPath, navigate]);

  // Filter notes based on archived status
  const filteredNotes = useMemo(
    () => (showArchived ? notes : notes.filter((note) => !note.isArchived)),
    [notes, showArchived],
  );

  // Get nodes to display based on active folder
  const displayedNodes = useMemo(() => {
    if (!activeFolder) return tree;
    const folderNode = findFolderNode(tree, activeFolder);
    return folderNode?.children ?? [];
  }, [tree, activeFolder]);

  // Pre-compute folder note counts in O(n) time
  const folderNoteCounts = useMemo(() => {
    const counts = new Map<string, number>();

    filteredNotes.forEach((note) => {
      if (!note.filePath) return;

      const normalized = normalizePath(note.filePath);
      const segments = normalized.split('/');

      // Count for root (files without folders)
      if (segments.length === 1) {
        counts.set('', (counts.get('') || 0) + 1);
        return;
      }

      // Count for each parent folder
      let currentPath = '';
      segments.slice(0, -1).forEach((segment) => {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        counts.set(currentPath, (counts.get(currentPath) || 0) + 1);
      });
    });

    return counts;
  }, [filteredNotes]);

  const noteCountForFolder = useCallback(
    (folderPath: string): number => {
      const normalized = normalizePath(folderPath);
      return folderNoteCounts.get(normalized) || 0;
    },
    [folderNoteCounts],
  );

  // Memoized sort function
  const sortNodes = useMemo(() => {
    const compareFiles = (a: FileTreeNode, b: FileTreeNode) => {
      const noteA = notesByPath.get(normalizePath(a.path));
      const noteB = notesByPath.get(normalizePath(b.path));

      switch (sortBy) {
        case 'updated': {
          const timeA = noteA ? new Date(noteA.updatedAt).getTime() : 0;
          const timeB = noteB ? new Date(noteB.updatedAt).getTime() : 0;
          return timeA - timeB;
        }
        case 'created': {
          const timeA = noteA ? new Date(noteA.createdAt).getTime() : 0;
          const timeB = noteB ? new Date(noteB.createdAt).getTime() : 0;
          return timeA - timeB;
        }
        case 'favorite': {
          const favA = noteA?.isFavorite ? 1 : 0;
          const favB = noteB?.isFavorite ? 1 : 0;
          return favA - favB;
        }
        case 'title':
        default: {
          const titleA = (noteA?.title || a.name).toLowerCase();
          const titleB = (noteB?.title || b.name).toLowerCase();
          return titleA.localeCompare(titleB);
        }
      }
    };

    return (nodes: FileTreeNode[]): FileTreeNode[] => {
      const copy = [...nodes];
      copy.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        if (a.type === 'folder' && b.type === 'folder') {
          return a.name.localeCompare(b.name);
        }
        const comparison = compareFiles(a, b);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
      return copy;
    };
  }, [notesByPath, sortBy, sortOrder]);

  // Navigation handlers
  const handleFolderClick = useCallback(
    (path: string) => {
      setActiveFolder(path);
      setSelectedFile(null);
    },
    [setActiveFolder, setSelectedFile],
  );

  const handleFileClick = useCallback(
    (path: string) => {
      const normalized = normalizePath(path);
      const parent = getParentPath(normalized);
      if (parent) {
        setActiveFolder(parent);
      }
      setSelectedFile(normalized);
      const note = getNoteByPath(normalized);
      if (note) {
        navigate(`/note/${note.id}`);
      }
    },
    [setActiveFolder, setSelectedFile, getNoteByPath, navigate],
  );

  // Folder label for header
  const folderLabel = activeFolder
    ? activeFolder.split('/').filter(Boolean).slice(-1)[0] || activeFolder
    : 'All Notes';

  // Check if list is empty
  const isEmpty =
    (!activeFolder && tree.length === 0) || (activeFolder && displayedNodes.length === 0);

  return {
    // State
    notes,
    notesByPath,
    filteredNotes,
    tree,
    displayedNodes,
    activeFolder,
    selectedFile,
    expandedPaths,
    folderLabel,
    isEmpty,

    // UI state
    viewMode,
    sortBy,
    sortOrder,

    // Functions
    getNoteByPath,
    noteCountForFolder,
    sortNodes,
    toggleExpanded,

    // Actions
    setViewMode,
    setSortBy,
    toggleSortOrder,
    handleFolderClick,
    handleFileClick,
    createNote,
    setSelectedFile,
    loadNotes,
  };
}
