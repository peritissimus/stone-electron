/**
 * Note List Component - Filesystem-centric note explorer
 */

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { shallow } from 'zustand/shallow';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useUIStore } from '@renderer/stores/uiStore';
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
import {
  Star,
  PushPin,
  Archive,
  List,
  GridFour,
  Article,
  CaretUp,
  CaretDown,
  CaretRight,
  Plus,
} from 'phosphor-react';
import { Header, ControlGroup, ListContainer, TreeItem } from '@renderer/components/composites';

import type { FileTreeNode } from '@renderer/stores/fileTreeStore';

const normalizePath = (path: string) =>
  path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
const getParentPath = (path: string) => {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  if (idx === -1) return '';
  return normalized.slice(0, idx);
};
const stripHtml = (html?: string | null) =>
  html
    ? html
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

export function NoteList() {
  const notes = useNoteStore((state) => state.notes, shallow);
  const setActiveNote = useNoteStore((state) => state.setActiveNote);
  const getNoteByFilePath = useNoteStore((state) => state.getNoteByFilePath);
  const { viewMode, sortBy, sortOrder, showArchived, setViewMode, setSortBy, toggleSortOrder } =
    useUIStore();
  const {
    tree,
    activeFolder,
    selectedFile,
    expandedPaths,
    setActiveFolder,
    setSelectedFile,
    toggleExpanded,
  } = useFileTreeStore();
  const { createNote, loadNotes, loadNoteById } = useNoteAPI();
  const [isCreating, setIsCreating] = useState(false);

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
    const note = getNoteByFilePath(selectedFile);
    if (note) {
      setActiveNote(note.id);
    }
  }, [selectedFile, notes, getNoteByFilePath, setActiveNote, loadNoteById]);

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
    const note = getNoteByFilePath(normalized);
    if (note) {
      setActiveNote(note.id);
    }
  };

  const sortNodesForView = (nodes: FileTreeNode[]): FileTreeNode[] => {
    const copy = [...nodes];
    const compareFiles = (a: FileTreeNode, b: FileTreeNode) => {
      const noteA = getNoteByFilePath(normalizePath(a.path));
      const noteB = getNoteByFilePath(normalizePath(b.path));

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

  const renderNodes = (nodes: FileTreeNode[], level = 0): JSX.Element[] => {
    if (!nodes || nodes.length === 0) return [];

    return sortNodesForView(nodes).map((node) => {
      if (node.type === 'folder') {
        const normalizedPath = normalizePath(node.path);
        const hasChildren = (node.children?.length ?? 0) > 0;
        const isExpanded = expandedPaths.has(normalizedPath);
        const isActive = normalizePath(activeFolder || '') === normalizedPath;
        const count = noteCountForFolder(normalizedPath);

        return (
          <div key={`folder-${normalizedPath}`}>
            <TreeItem
              level={level}
              isActive={isActive}
              icon="📁"
              label={node.name}
              onClick={() => handleFolderClick(normalizedPath)}
              right={
                <>
                  {hasChildren && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpanded(normalizedPath);
                      }}
                      aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                    >
                      {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
                    </Button>
                  )}
                  <Text size="xs" variant="muted" className="text-[10px]">
                    {count}
                  </Text>
                </>
              }
            />
            {isExpanded && node.children && node.children.length > 0 && (
              <div>{renderNodes(node.children, level + 1)}</div>
            )}
          </div>
        );
      }

      const normalizedPath = normalizePath(node.path);
      const note = getNoteByFilePath(normalizedPath);
      const isSelected = normalizePath(selectedFile || '') === normalizedPath;
      const title = note?.title?.trim() ? note.title : node.name.replace(/\.md$/i, '');
      const updatedAt = note
        ? formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })
        : '';
      const preview = '';
      const isPinned = note?.isPinned;
      const isFavorite = note?.isFavorite;

      return (
        <TreeItem
          key={`file-${normalizedPath}`}
          level={level}
          isActive={isSelected}
          icon="📄"
          label={title || node.name}
          onClick={() => handleFileClick(normalizedPath)}
          right={
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {isPinned && <PushPin size={10} className="text-primary" />}
              {isFavorite && <Star size={10} className="text-yellow-500" />}
              {updatedAt}
            </div>
          }
        >
          {preview && (
            <Text size="xs" variant="muted" className="text-[10px] line-clamp-1">
              {preview}
            </Text>
          )}
        </TreeItem>
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
