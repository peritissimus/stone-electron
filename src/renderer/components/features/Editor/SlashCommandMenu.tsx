/**
 * Slash Command Menu Component - Notion-like command palette
 */

import { forwardRef, useImperativeHandle, useState } from 'react';
import { CommandMenuItem } from '@renderer/components/composites';
import type { SlashCommandItem } from './slashCommands';

export interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const [prevItems, setPrevItems] = useState(items);
    if (items !== prevItems) {
      setPrevItems(items);
      setSelectedIndex(0);
    }

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return null;
    }

    return (
      <div
        className="z-50 min-w-[280px] max-h-[400px] overflow-y-auto rounded-xl border border-white/10"
        style={{
          boxShadow: 'var(--shadow-popover)',
          backgroundColor: 'hsl(var(--popover-base) / 0.85)',
          backdropFilter: 'blur(8px) saturate(180%)',
          WebkitBackdropFilter: 'blur(8px) saturate(180%)',
        }}
      >
        <div className="p-1">
          {items.map((item, index) => (
            <CommandMenuItem
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
              size="spacious"
              isSelected={index === selectedIndex}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            />
          ))}
        </div>
      </div>
    );
  },
);

SlashCommandMenu.displayName = 'SlashCommandMenu';
