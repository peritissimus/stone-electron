/**
 * Note List Component - Filesystem-centric note explorer
 *
 * Implements: specs/components.ts#NoteListProps
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNoteListData } from '@renderer/hooks/useNoteListData';
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
import { logger } from '@renderer/lib/logger';
import { normalizePath } from '@renderer/lib/path';
import { List, GridFour, Article, CaretUp, CaretDown, Plus } from 'phosphor-react';
import { Header, ControlGroup, ListContainer } from '@renderer/components/composites';
import { NoteListFolderItem } from './NoteListFolderItem';
import { NoteListFileItem } from './NoteListFileItem';
import type { FileTreeNode } from '@renderer/hooks/useFileTree';

export function NoteList() {
  const navigate = useNavigate();
  const {
    notesByPath,
    filteredNotes,
    tree,
    displayedNodes,
    activeFolder,
    selectedFile,
    expandedPaths,
    folderLabel,
    isEmpty,
    viewMode,
    sortBy,
    sortOrder,
    noteCountForFolder,
    sortNodes,
    toggleExpanded,
    setViewMode,
    setSortBy,
    toggleSortOrder,
    handleFolderClick,
    handleFileClick,
    createNote,
    setSelectedFile,
    loadNotes,
  } = useNoteListData();

  const [isCreating, setIsCreating] = useState(false);

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
      const now = new Date();
      const defaultTitle = `Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

      const note = await createNote({
        title: defaultTitle,
        content: '',
        folderPath: activeFolder || undefined,
      });

      if (note) {
        if (note.filePath) {
          setSelectedFile(normalizePath(note.filePath));
        }
        await loadNotes({ folderPath: activeFolder || undefined });
        navigate(`/note/${note.id}`);
      }
    } catch (error) {
      logger.error('Failed to create note:', error);
    } finally {
      setIsCreating(false);
    }
  };

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
        {isEmpty ? (
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
