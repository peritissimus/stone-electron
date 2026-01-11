/**
 * Note List Component - Filesystem-centric note explorer
 *
 * Implements: specs/components.ts#NoteListProps
 */

import React, { useEffect, useMemo, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteListUI } from '@renderer/hooks/useUI';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { Button } from '@renderer/components/base/ui/button';
import { Heading3, Text } from '@renderer/components/base/ui/text';
import { ContainerFlex } from '@renderer/components/base/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import { Toggle } from '@renderer/components/base/ui/toggle';
import { logger } from '@renderer/utils/logger';
import { normalizePath, getParentPath } from '@renderer/utils/path';
import { List, GridFour, Article, CaretUp, CaretDown, Plus } from 'phosphor-react';
import { Header, ControlGroup, ListContainer } from '@renderer/components/composites';
import { NoteListFolderItem } from './NoteListFolderItem';
import { NoteListFileItem } from './NoteListFileItem';

import type { FileTreeNode } from '@renderer/stores/fileTreeStore';
import type { Note } from '@shared/types';

export function NoteList() {
  const notes = useNoteStore((state) => state.notes, shallow);
  const notesByPath = useNoteStore((state) => state.notesByPath);
  const setActiveNote = useNoteStore((state) => state.setActiveNote);
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
  const [isCreating, setIsCreating] = useState(false);

  // Helper to get note from Map (O(1) lookup)
  const getNoteByPath = (path: string): Note | undefined => {
    return notesByPath.get(normalizePath(path));
  };

  useEffect(() => {
    if (activeFolder) {
      logger.info('[NoteList] loadNotes by folder', { folderPath: activeFolder });
      loadNotes({ folderPath: activeFolder });
    } else {
      logger.info('[NoteList] loadNotes all');
      loadNotes();
    }
  }, [activeFolder, loadNotes]);

  useEffect(() => {
    if (!selectedFile) return;
    const note = getNoteByPath(selectedFile);
    if (note) {
      setActiveNote(note.id);
    }
  }, [selectedFile, notesByPath, setActiveNote]);

  const filteredNotes = useMemo(
    () => (showArchived ? notes : notes.filter((note) => !note.isArchived)),
    [notes, showArchived],
  );

  const findFolderNode = (nodes: FileTreeNode[], path: string): FileTreeNode | null => {
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
  };

  const displayedNodes = useMemo(() => {
    if (!activeFolder) return tree;
    const folderNode = findFolderNode(tree, activeFolder);
    if (folderNode?.children) {
      return folderNode.children;
    }
    return [];
  }, [tree, activeFolder]);

  // Pre-compute folder note counts in O(n) time instead of O(n×m)
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

  const noteCountForFolder = (folderPath: string): number => {
    const normalized = normalizePath(folderPath);
    return folderNoteCounts.get(normalized) || 0;
  };

  const handleFolderClick = (path: string) => {
    setActiveFolder(path);
    setSelectedFile(null);
  };

  const handleFileClick = (path: string) => {
    const normalized = normalizePath(path);
    const parent = getParentPath(normalized);
    if (parent) {
      setActiveFolder(parent);
    }
    setSelectedFile(normalized);
    const note = getNoteByPath(normalized);
    if (note) {
      setActiveNote(note.id);
    }
  };

  // Memoized sort function - only re-sorts when dependencies change
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

  const renderNodes = (nodes: FileTreeNode[], level = 0): React.ReactElement[] => {
    if (!nodes || nodes.length === 0) return [];

    return sortNodes(nodes).map((node) => {
      const normalizedPath = normalizePath(node.path);

      if (node.type === 'folder') {
        const isExpanded = expandedPaths.has(normalizedPath);
        const isActive = normalizePath(activeFolder || '') === normalizedPath;
        const count = noteCountForFolder(normalizedPath);

        return (
          <NoteListFolderItem
            key={`folder-${normalizedPath}`}
            node={node}
            level={level}
            isActive={isActive}
            isExpanded={isExpanded}
            noteCount={count}
            onClick={() => handleFolderClick(normalizedPath)}
            onToggle={() => toggleExpanded(normalizedPath)}
          >
            {node.children && node.children.length > 0 && renderNodes(node.children, level + 1)}
          </NoteListFolderItem>
        );
      }

      const note = notesByPath.get(normalizedPath);
      const isSelected = normalizePath(selectedFile || '') === normalizedPath;

      return (
        <NoteListFileItem
          key={`file-${normalizedPath}`}
          note={note}
          fileName={node.name}
          level={level}
          isActive={isSelected}
          onClick={() => handleFileClick(normalizedPath)}
        />
      );
    });
  };

  const handleCreateNote = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      // Generate a default title for the new note
      const now = new Date();
      const defaultTitle = `Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

      const note = await createNote({
        title: defaultTitle,
        content: '',
        folderPath: activeFolder || undefined,
      });

      if (note) {
        setActiveNote(note.id);
        if (note.filePath) {
          setSelectedFile(normalizePath(note.filePath));
        }
        await loadNotes({ folderPath: activeFolder || undefined });
      }
    } catch (error) {
      logger.error('Failed to create note:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const folderLabel = activeFolder
    ? activeFolder.split('/').filter(Boolean).slice(-1)[0] || activeFolder
    : 'All Notes';

  return (
    <div className="flex flex-col h-full bg-secondary">
      <Header
        left={
          <div className="flex flex-col">
            <Heading3 className="text-sm">{folderLabel}</Heading3>
            {activeFolder && (
              <Text size="xs" variant="muted" className="text-[10px]">
                {activeFolder}
              </Text>
            )}
          </div>
        }
        right={
          <ControlGroup gap="xs" background="bg-muted">
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              size="sm"
              className="h-6 w-6 p-0"
              title="List view"
            >
              <List size={12} />
            </Toggle>
            <Toggle
              pressed={viewMode === 'grid'}
              onPressedChange={() => setViewMode('grid')}
              size="sm"
              className="h-6 w-6 p-0"
              title="Grid view"
            >
              <GridFour size={12} />
            </Toggle>
            <Toggle
              pressed={viewMode === 'card'}
              onPressedChange={() => setViewMode('card')}
              size="sm"
              className="h-6 w-6 p-0"
              title="Card view"
            >
              <Article size={12} />
            </Toggle>
          </ControlGroup>
        }
      />

      <div className="px-3 py-2 border-b border-border flex-shrink-0 bg-card">
        <Button
          onClick={handleCreateNote}
          disabled={isCreating}
          size="sm"
          className="w-full h-7 text-xs"
          title="Create a new note"
        >
          <Plus size={12} />
          {isCreating ? 'Creating...' : 'New Note'}
        </Button>
      </div>

      <div className="px-3 py-2.5 border-b border-border flex-shrink-0 bg-card">
        <ContainerFlex gap="xs" align="center" className="mb-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="flex-1 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last Updated</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="favorite">Favorites</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSortOrder}
            className="h-7 w-7 p-0 flex-shrink-0"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <div className="flex flex-col">
              <CaretUp size={7} />
              <CaretDown size={7} />
            </div>
          </Button>
        </ContainerFlex>

        <Text size="xs" variant="muted" as="div">
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
        </Text>
      </div>

      <div className="flex-1 overflow-y-auto bg-card">
        {(!activeFolder && tree.length === 0) || (activeFolder && displayedNodes.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-xs">
            <Text size="xs" variant="muted">
              No files found
            </Text>
            <Button onClick={handleCreateNote} disabled={isCreating} variant="outline" size="sm">
              <Plus size={14} />
              {isCreating ? 'Creating...' : 'Create your first note'}
            </Button>
          </div>
        ) : (
          <ListContainer viewMode={viewMode}>
            {renderNodes(activeFolder ? displayedNodes : tree)}
          </ListContainer>
        )}
      </div>
    </div>
  );
}
