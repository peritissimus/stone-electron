/**
 * Note Editor Header Component
 *
 * Implements: specs/components.ts#NoteHeaderProps
 */
import React, { useState, useCallback, memo } from 'react';
import {
  Star,
  PushPin,
  Archive,
  DotsThreeVertical,
  Check,
  Trash,
  FloppyDisk,
  CaretRight,
  Export,
  FilePdf,
  FileHtml,
  FileText,
  Code,
  TextAa,
} from '@phosphor-icons/react';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
import { cn } from '@renderer/lib/utils';
import { formatShortcut } from '@renderer/hooks/useKeyboardShortcuts';
import { useSidebarUI, useEditorUI } from '@renderer/hooks/useUI';

export interface NoteEditorHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  showSave?: boolean;
  onSave?: () => void;
  onExportHtml?: () => void;
  onExportPdf?: () => void;
  onExportMarkdown?: () => void;
  onModeToggle?: () => Promise<boolean> | boolean; // Returns true if mode switch should proceed
}

export const NoteEditorHeader = memo(function NoteEditorHeader({
  title,
  onTitleChange,
  isFavorite,
  isPinned,
  isArchived,
  onToggleFavorite,
  onTogglePin,
  onToggleArchive,
  onDelete,
  showSave = false,
  onSave,
  onExportHtml,
  onExportPdf,
  onExportMarkdown,
  onModeToggle,
}: NoteEditorHeaderProps) {
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const { editorMode, toggleEditorMode } = useEditorUI();

  const handleModeToggle = useCallback(async () => {
    // If onModeToggle returns false, don't toggle
    if (onModeToggle) {
      const shouldProceed = await onModeToggle();
      if (!shouldProceed) return;
    }
    toggleEditorMode();
  }, [onModeToggle, toggleEditorMode]);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  // Sync editValue when the title prop changes (e.g., switching notes),
  // but never while the user is mid-edit — that would clobber their input.
  // Render-time prev-prop sync, so external changes land before paint.
  const [prevTitle, setPrevTitle] = useState(title);
  if (title !== prevTitle) {
    setPrevTitle(title);
    if (!isEditing) setEditValue(title);
  }

  // Focus and select all when the edit input mounts (entering edit mode).
  const focusInputOnMount = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus();
      node.select();
    }
  }, []);

  const handleStartEditing = useCallback(() => {
    setIsEditing(true);
    setEditValue(title);
  }, [title]);

  const handleSaveAndExit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onTitleChange(trimmed);
    } else {
      setEditValue(title); // Restore original if empty or unchanged
    }
    setIsEditing(false);
  }, [editValue, title, onTitleChange]);

  const handleCancel = useCallback(() => {
    setEditValue(title);
    setIsEditing(false);
  }, [title]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveAndExit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSaveAndExit, handleCancel],
  );

  return (
    <div
      className={cn(
        'px-4 border-b border-border shrink-0 bg-card flex items-center gap-3',
        sizeHeightClasses['spacious'],
      )}
    >
      {!sidebarOpen && (
        <IconButton
          size="normal"
          icon={<CaretRight size={16} weight="bold" />}
          tooltip="Expand sidebar"
          onClick={toggleSidebar}
        />
      )}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={focusInputOnMount}
            type="text"
            aria-label="Note title"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveAndExit}
            onKeyDown={handleKeyDown}
            placeholder="Untitled Note"
            className={cn(
              'w-full px-1.5 py-0.5 -mx-1.5',
              'text-sm font-medium',
              'bg-accent/20 rounded',
              'text-foreground placeholder:text-muted-foreground/60',
              'border border-accent/40',
              'outline-none focus:border-ring focus:bg-accent/30',
              'transition-colors duration-150',
            )}
          />
        ) : (
          <button
            type="button"
            onClick={handleStartEditing}
            className={cn(
              'w-full text-left px-1.5 py-0.5 -mx-1.5',
              'text-sm font-medium truncate',
              'rounded transition-colors duration-150',
              'hover:bg-accent/20',
              title ? 'text-foreground' : 'text-muted-foreground/60',
            )}
          >
            {title || 'Untitled Note'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showSave && (
          <IconButton
            size="normal"
            icon={<FloppyDisk size={16} />}
            tooltip={`Save changes (${formatShortcut('S', true)})`}
            onClick={onSave}
          />
        )}
        <IconButton
          size="normal"
          icon={
            <div className="relative size-4">
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  "transition-[opacity,filter,scale] duration-300",
                  "[transition-timing-function:cubic-bezier(0.2,0,0,1)]",
                  editorMode === 'rich'
                    ? "scale-100 opacity-100 blur-0"
                    : "scale-[0.25] opacity-0 blur-[4px]"
                )}
              >
                <Code size={16} />
              </div>
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center",
                  "transition-[opacity,filter,scale] duration-300",
                  "[transition-timing-function:cubic-bezier(0.2,0,0,1)]",
                  editorMode === 'rich'
                    ? "scale-[0.25] opacity-0 blur-[4px]"
                    : "scale-100 opacity-100 blur-0"
                )}
              >
                <TextAa size={16} />
              </div>
            </div>
          }
          tooltip={
            editorMode === 'rich'
              ? `Switch to raw markdown (${formatShortcut('M', true, true)})`
              : `Switch to rich editor (${formatShortcut('M', true, true)})`
          }
          onClick={handleModeToggle}
        />
        <div className="flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="normal"
                icon={<DotsThreeVertical size={16} />}
                tooltip="More Options"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleFavorite}>
                <Star size={14} className="mr-2" weight={isFavorite ? 'fill' : 'regular'} />
                {isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                {isFavorite && <Check size={14} className="ml-auto text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePin}>
                <PushPin size={14} className="mr-2" weight={isPinned ? 'fill' : 'regular'} />
                {isPinned ? 'Unpin Note' : 'Pin Note'}
                {isPinned && <Check size={14} className="ml-auto text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleArchive}>
                <Archive size={14} className="mr-2" weight={isArchived ? 'fill' : 'regular'} />
                {isArchived ? 'Unarchive Note' : 'Archive Note'}
                {isArchived && <Check size={14} className="ml-auto text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Export size={14} className="mr-2" />
                  Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={onExportPdf}>
                    <FilePdf size={14} className="mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExportHtml}>
                    <FileHtml size={14} className="mr-2" />
                    Export as HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onExportMarkdown}>
                    <FileText size={14} className="mr-2" />
                    Export as Markdown
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash size={14} className="mr-2" />
                Delete Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});
