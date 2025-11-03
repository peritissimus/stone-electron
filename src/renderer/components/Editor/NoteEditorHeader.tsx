/**
 * Note Editor Header Component
 */
import { Star, PushPin, Archive, DotsThreeVertical, Check, Trash, FloppyDisk } from 'phosphor-react';
import { Input } from '@renderer/components/ui/input';
import { IconButton, sizeHeightClasses } from '@renderer/components/composites';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { cn } from '@/renderer/lib/utils';

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
  return (
    <div className={cn("px-4 border-b border-border flex-shrink-0 bg-card flex items-center gap-3",sizeHeightClasses['spacious'])}>
      <div className="flex-1 min-w-0">
        <div className="flex-1 min-w-0 flex items-center">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled Note"
            className="w-full h-full px-0 border-0 bg-transparent text-2xl font-semibold leading-tight text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showSave && (
          <IconButton
            size="normal"
            icon={<FloppyDisk size={16} />}
            tooltip="Save changes"
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
                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
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
