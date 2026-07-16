/**
 * NoteLinkMenu Component - Autocomplete menu for [[note name]] links
 */

import { forwardRef, useEffect, useImperativeHandle, useState, useCallback, useRef } from 'react';
import { Note } from '@shared/types';
import { Link, MagnifyingGlass, File, ArrowRight } from '@phosphor-icons/react';
import { cn } from '@renderer/lib/utils';

export interface NoteLinkItem {
  id: string;
  title: string;
  filePath?: string | null;
  note: Note;
}

export interface NoteLinkMenuProps {
  items: NoteLinkItem[];
  command: (item: NoteLinkItem) => void;
  query: string;
}

export interface NoteLinkMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const NoteLinkMenu = forwardRef<NoteLinkMenuRef, NoteLinkMenuProps>(
  ({ items, command, query }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Reset selection when items change
    const [prevItems, setPrevItems] = useState(items);
    if (items !== prevItems) {
      setPrevItems(items);
      setSelectedIndex(0);
    }

    // Scroll selected item into view
    useEffect(() => {
      const selectedItem = itemRefs.current[selectedIndex];
      if (selectedItem && menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const itemRect = selectedItem.getBoundingClientRect();

        if (itemRect.bottom > menuRect.bottom) {
          selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (itemRect.top < menuRect.top) {
          selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command],
    );

    const upHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    }, [items.length]);

    const downHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev + 1) % items.length);
    }, [items.length]);

    const enterHandler = useCallback(() => {
      selectItem(selectedIndex);
    }, [selectItem, selectedIndex]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }

        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }

        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[280px] max-w-[400px]">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <MagnifyingGlass size={16} />
            <span>{query ? `No notes found for "${query}"` : 'Type to search notes...'}</span>
          </div>
          {query && (
            <div className="mt-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => command({ id: 'create-new', title: query, note: null as any })}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]"
              >
                <File size={14} />
                <span>Create note "{query}"</span>
                <ArrowRight size={12} className="ml-auto" />
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        ref={menuRef}
        className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden min-w-[280px] max-w-[400px] max-h-[300px] overflow-y-auto"
      >
        <div className="p-1">
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;
            const folderPath = item.filePath?.includes('/')
              ? item.filePath.slice(0, item.filePath.lastIndexOf('/'))
              : '';

            return (
              <button
                type="button"
                key={item.id}
                ref={(el) => (itemRefs.current[index] = el)}
                onClick={() => selectItem(index)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]',
                  isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
                )}
              >
                <Link size={14} className="shrink-0 text-primary" weight="bold" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium line-clamp-1">{item.title}</div>
                  {folderPath && (
                    <div className="text-xs text-muted-foreground line-clamp-1">{folderPath}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);

NoteLinkMenu.displayName = 'NoteLinkMenu';
