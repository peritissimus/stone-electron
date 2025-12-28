/**
 * Note Editor Header Component
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Star,
  PushPin,
  Archive,
  DotsThreeVertical,
  Check,
  Trash,
  FloppyDisk,
  CaretRight,
} from 'phosphor-react';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
import { cn } from '@renderer/lib/utils';
import { formatShortcut } from '@renderer/hooks/useKeyboardShortcuts';
import { useUIStore } from '@renderer/stores/uiStore';

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
}

export function NoteEditorHeader({
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
}: NoteEditorHeaderProps) {
  const { toggleSidebar, sidebarOpen } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync editValue when title prop changes (e.g., switching notes)
  useEffect(() => {
    setEditValue(title);
  }, [title]);

  // Focus and select all when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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
            ref={inputRef}
            type="text"
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
              'outline-none focus:border-primary/50 focus:bg-accent/30',
              'transition-colors duration-150',
            )}
          />
        ) : (
          <button
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
}
