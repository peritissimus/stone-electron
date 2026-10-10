/**
 * FileTree Component - container that wires actions and renders folder/file nodes.
 *
 * Implements: specs/components.ts#FileTreeProps
 */

import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Heading3 } from '@renderer/components/base/ui/text';
import { InputModal } from '@renderer/components/composites';
import { useVirtualFileTree } from '@renderer/services/workspace/hooks/useVirtualFileTree';
import { useNoteTitleValidation } from '@renderer/features/notes/hooks/useNoteTitleValidation';
import { useNoteAPI } from '@renderer/features/notes/commands/useNoteAPI';
import { useFileTreeAPI } from '@renderer/services/workspace/commands/useFileTreeAPI';
import { useNavigateToNote } from '@renderer/services/navigation';
import { logger } from '@renderer/services/telemetry/logger';
import { FileLeaf } from './FileLeaf';
import { FolderNode } from './FolderNode';

export const FileTree = React.memo(function FileTree({
  scrollContainer,
}: {
  scrollContainer: HTMLDivElement | null;
}) {
  const navigateToNote = useNavigateToNote();
  const {
    items,
    listRef,
    measureRef,
    rowSize,
    renderedIndices,
    setDragPath,
    setFocusPath,
    onMenuOpenChange,
  } = useVirtualFileTree(scrollContainer);
  const validateNoteTitle = useNoteTitleValidation();
  const { createNote, updateNote, deleteNote, moveNote } = useNoteAPI();
  const { loadFileTree, moveFolder } = useFileTreeAPI();
  const [renameTarget, setRenameTarget] = useState<{ noteId: string; title: string } | null>(null);

  const handleCreateNoteInFolder = useCallback(
    async (folderPath: string | null) => {
      logger.info('[FileTree] Creating note in folder', { folderPath });
      try {
        const now = new Date();
        const defaultTitle = `Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

        const note = await createNote({
          title: defaultTitle,
          content: '',
          folderPath: folderPath || undefined,
        });
        if (note) {
          navigateToNote(note.id);
          await loadFileTree();
        }
      } catch (error) {
        logger.error('Failed to create note in folder', error);
      }
    },
    [createNote, navigateToNote, loadFileTree],
  );

  const handleRenameNote = useCallback(
    async (noteId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return false;
      try {
        const updated = await updateNote(noteId, { title: trimmed });
        if (!updated) toast.error('Could not rename note. Please try again.');
        return !!updated;
      } catch (error) {
        logger.error('Failed to rename note', error);
        toast.error('Could not rename note. Please try again.');
        return false;
      }
    },
    [updateNote],
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      const confirmed = window.confirm(
        'Are you sure you want to delete this note? This cannot be undone.',
      );
      if (!confirmed) return;
      try {
        const success = await deleteNote(noteId, true);
        if (success) {
          await loadFileTree();
        }
      } catch (error) {
        logger.error('Failed to delete note', error);
      }
    },
    [deleteNote, loadFileTree],
  );

  const handleMoveNote = useCallback(
    async (noteId: string, destinationPath: string | null) => {
      logger.info('[FileTree] Moving note', { noteId, destinationPath });
      try {
        await moveNote(noteId, destinationPath);
        await loadFileTree();
      } catch (error) {
        logger.error('[FileTree] Failed to move note', { error, noteId, destinationPath });
      }
    },
    [moveNote, loadFileTree],
  );

  const handleMoveFolder = useCallback(
    async (sourcePath: string, destinationPath: string | null) => {
      logger.info('[FileTree] Moving folder', { sourcePath, destinationPath });
      try {
        await moveFolder(sourcePath, destinationPath);
        await loadFileTree();
      } catch (error) {
        logger.error('[FileTree] Failed to move folder', { error, sourcePath, destinationPath });
      }
    },
    [moveFolder, loadFileTree],
  );

  const handleShowRename = useCallback((noteId: string, title: string) => {
    setRenameTarget({ noteId, title });
  }, []);

  const rowPath = (target: EventTarget | null): string | null =>
    target instanceof Element
      ? (target.closest<HTMLElement>('[data-file-tree-path]')?.dataset.fileTreePath ?? null)
      : null;

  return (
    <div data-file-tree data-file-tree-row-count={items.length}>
      <div className="mb-1 flex h-8 items-center px-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground/80">
          Files
        </span>
      </div>
      <div
        ref={listRef}
        className="relative"
        style={{ height: items.length * rowSize, overflowAnchor: 'none' }}
        onDragStartCapture={(event) => setDragPath(rowPath(event.target))}
        onDragEndCapture={() => setDragPath(null)}
        onDropCapture={() => setDragPath(null)}
        onFocusCapture={(event) => setFocusPath(rowPath(event.target))}
        onBlurCapture={(event) => setFocusPath(rowPath(event.relatedTarget))}
      >
        <div
          ref={measureRef}
          aria-hidden
          className="pointer-events-none invisible absolute h-8 w-px"
        />
        {renderedIndices.map((index) => {
          const { node, level, path, positionInSet, setSize } = items[index];
          return (
            <div
              key={`${node.type}-${path}`}
              data-file-tree-row
              data-file-tree-path={path}
              data-file-tree-level={level}
              className="absolute inset-x-0"
              style={{ top: index * rowSize }}
            >
              {node.type === 'folder' ? (
                <FolderNode
                  node={node}
                  level={level}
                  positionInSet={positionInSet}
                  setSize={setSize}
                  onCreateNote={handleCreateNoteInFolder}
                  onMoveFile={handleMoveNote}
                  onMoveFolder={handleMoveFolder}
                />
              ) : (
                <FileLeaf
                  node={node}
                  level={level}
                  positionInSet={positionInSet}
                  setSize={setSize}
                  onRename={handleShowRename}
                  onDelete={handleDeleteNote}
                  onMove={handleMoveNote}
                  onMenuOpenChange={onMenuOpenChange}
                />
              )}
            </div>
          );
        })}
      </div>

      <InputModal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={async (value) => {
          if (renameTarget) {
            const renamed = await handleRenameNote(renameTarget.noteId, value);
            if (renamed) setRenameTarget(null);
            return renamed;
          }
          return false;
        }}
        validate={validateNoteTitle}
        left={<Heading3>Rename Note</Heading3>}
        placeholder="Note title"
        submitLabel="Rename"
        defaultValue={renameTarget?.title ?? ''}
      />
    </div>
  );
});
